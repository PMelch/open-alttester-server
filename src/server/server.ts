import type { ServerAdapter, WsHandle } from "./adapter";
import { homedir } from "node:os";
import { ConnectionRegistry, CloseCode, ClientRole } from "./registry";
import { DashboardFeed, SERVER_VERSION, handleDashboardRequest } from "../web/handler";
import { InspectorService } from "./inspector";
import { handleInspectorRequest } from "../web/inspector-handler";
import { McpService, type McpConfigUpdate } from "./mcp";
import { CommandDebugLog, parseCommandEnvelope, sourceFromDriver } from "./debug";

export interface UiTesterServerOptions {
  port: number;
  /** Heartbeat interval in ms for SSE keepalive comments. Default: 20000. */
  heartbeatMs?: number;
  /**
   * Inject a custom adapter for testing or to override runtime detection.
   * When omitted, the adapter is chosen automatically:
   *   Bun runtime  → BunServerAdapter
   *   Node runtime → NodeServerAdapter
   */
  adapter?: ServerAdapter;
  /** Project folder used for dashboard agent configuration. Defaults to process.cwd(). */
  projectFolder?: string;
  /** Home folder used for global dashboard agent configuration. Defaults to os.homedir(). */
  userHomeFolder?: string;
  /** Initial MCP access policy applied at startup (CLI / env). */
  mcp?: McpConfigUpdate;
}

export interface UiTesterServer {
  port: number;
  registry: ConnectionRegistry;
  feed: DashboardFeed;
  mcp: McpService;
  stop(): void;
}

const DRIVER_REGISTERED = JSON.stringify({
  isNotification: true,
  commandName: "driverRegistered",
  data: "",
});

const CLOSE_REASONS: Record<number, string> = {
  [CloseCode.NoAppConnected]: "No app connected with that appName.",
  [CloseCode.MultipleDrivers]: "A driver is already connected to that app.",
  [CloseCode.MultipleDriversTrying]: "Another driver is already trying to connect.",
};

function driverLifecycleNotification(commandName: string, driverId: string): string {
  return JSON.stringify({
    isNotification: true,
    commandName,
    driverId,
  });
}

function getDriverId(ws: WsHandle): string {
  return ws.data.params.get("deviceInstanceId") ?? "unknown";
}

function appIdCommand(appId: string): string {
  return JSON.stringify({
    commandName: "AppId",
    driverId: appId,
  });
}

function resolveAppId(appName: string, deviceInstanceId: string, suppliedAppId: string | null): string {
  if (suppliedAppId && suppliedAppId !== "unknown") return suppliedAppId;

  let hash = 0x811c9dc5;
  for (const char of `${appName}:${deviceInstanceId}`) {
    hash ^= char.charCodeAt(0);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(16).padStart(8, "0").toUpperCase();
}

async function resolveAdapter(): Promise<ServerAdapter> {
  // "Bun" in globalThis matches any truthy value; the typeof check excludes
  // cases where globalThis.Bun is set to null/undefined by a polyfill.
  // Casting via Record<string, unknown> avoids a TypeScript error for the
  // undeclared 'Bun' identifier when compiling without bun-types.
  const globals = globalThis as Record<string, unknown>;
  if (typeof globals["Bun"] !== "undefined") {
    const { BunServerAdapter } = await import("./adapters/bun");
    return new BunServerAdapter();
  }
  const { NodeServerAdapter } = await import("./adapters/node");
  return new NodeServerAdapter();
}

export async function createUiTesterServer(
  opts: UiTesterServerOptions,
): Promise<UiTesterServer> {
  const registry = new ConnectionRegistry();
  const feed = new DashboardFeed();
  feed.startHeartbeat(opts.heartbeatMs);
  const debug = new CommandDebugLog((command) => {
    feed.emit({ type: "debugCommandChanged", command });
  });
  const inspector = new InspectorService();
  const mcp = new McpService(registry, inspector, debug, SERVER_VERSION);
  if (opts.mcp) {
    const mcpState = mcp.updateConfig(opts.mcp);
    feed.emit({ type: "mcpConfigChanged", mode: mcpState.mode, enabledApps: mcpState.enabledApps });
  }
  const startTime = Date.now();
  const projectFolder = opts.projectFolder ?? process.cwd();
  const userHomeFolder = opts.userHomeFolder ?? homedir();

  const adapter = opts.adapter ?? (await resolveAdapter());

  // ── WebSocket upgrade routing ─────────────────────────────────────────────
  adapter.setUpgradeHandler((req) => {
    const url = new URL(req.url);
    const params = url.searchParams;
    const appName = params.get("appName") ?? "__default__";
    const path = url.pathname;

    // Paths from SDK source:
    //   /altws/app  → Unity SDK app (RuntimeWebSocketClient)
    //   /altws      → test driver (Python AltDriver, C# DriverWebSocketClient)
    //   /altws/live-update/app → Unity SDK live-update app channel
    if (path === "/altws/app") return { params, appName, role: "app" };
    if (path === "/altws") return { params, appName, role: "driver" };
    if (path === "/altws/live-update/app") return { params, appName, role: "live-update-app" };
    return null;
  });

  // ── HTTP routing ──────────────────────────────────────────────────────────
  adapter.setFetchHandler((req) => {
    const dashResponse = handleDashboardRequest(req, registry, feed, startTime, mcp, debug, projectFolder, userHomeFolder);
    if (dashResponse) return dashResponse;

    return Promise.resolve(mcp.handleRequest(req)).then((mcpResponse) => {
      if (mcpResponse) return mcpResponse;
      return handleInspectorRequest(req, registry, inspector).then(
        (r) => r ?? new Response("Not found", { status: 404 }),
      );
    });
  });

  // ── WebSocket lifecycle ───────────────────────────────────────────────────
  adapter.setWebSocketHandlers({
    open(ws: WsHandle) {
      const { params, appName, role } = ws.data;
      const platform = params.get("platform") ?? "unknown";
      const platformVersion = params.get("platformVersion") ?? "unknown";
      const deviceInstanceId = params.get("deviceInstanceId") ?? "unknown";
      const driverType = params.get("driverType") ?? "unknown";
      const appId = resolveAppId(appName, deviceInstanceId, params.get("appId"));

      if (role === "app") {
        registry.registerApp(appName, ws, { platform, platformVersion, deviceInstanceId, appId });
        ws.send(appIdCommand(appId));
        feed.emit({ type: "appConnected", appName, platform, platformVersion, deviceInstanceId });
        return;
      }

      if (role === "live-update-app") {
        return;
      }

      const result = registry.registerDriver(appName, ws, { driverType, platform, platformVersion, deviceInstanceId });

      if (result === "paired") {
        ws.send(DRIVER_REGISTERED);
        registry.getPairedApp(ws)?.send(
          driverLifecycleNotification("DriverConnectedNotification", deviceInstanceId),
        );
        feed.emit({ type: "driverConnected", appName, driverType, paired: true });
        return;
      }

      const code = result as number;
      queueMicrotask(() => ws.close(code, CLOSE_REASONS[code] ?? "Connection rejected."));
    },

    message(ws: WsHandle, msg: string | Buffer) {
      const raw = typeof msg === "string" ? msg : msg.toString();
      if (ws.data.role === "app") {
        const envelope = parseCommandEnvelope(raw);
        if (envelope?.messageId) {
          debug.recordResponse(ws.data.appName, envelope.messageId, envelope.payload);
        }
        if (inspector.tryConsume(raw)) return;
      }
      if (ws.data.role === "driver") {
        const envelope = parseCommandEnvelope(raw);
        const driverMeta = registry.getDriverMeta(ws);
        if (envelope && driverMeta) {
          debug.recordRequest({
            appName: driverMeta.appName,
            source: sourceFromDriver(driverMeta),
            commandName: envelope.commandName,
            messageId: envelope.messageId,
            requestPayload: envelope.payload,
          });
        }
      }
      const peer = registry.getPeer(ws);
      if (!peer) return;
      peer.send(msg);
    },

    close(ws: WsHandle, _code: number, _reason: string) {
      const role = registry.getRole(ws);

      if (role === ClientRole.App) {
        const appName = ws.data.appName;
        const driverWs = registry.removeApp(ws);
        feed.emit({ type: "appDisconnected", appName });
        if (driverWs) {
          queueMicrotask(() => driverWs.close(CloseCode.AppDisconnected, "App disconnected."));
        }
        return;
      }

      if (role === ClientRole.Driver) {
        const appName = ws.data.appName;
        const driverId = getDriverId(ws);
        const appWs = registry.removeDriver(ws);
        feed.emit({ type: "driverDisconnected", appName });
        if (appWs) {
          appWs.send(driverLifecycleNotification("DriverDisconnectedNotification", driverId));
        }
      }
    },
  });

  const port = await adapter.listen(opts.port);

  return {
    port,
    registry,
    feed,
    mcp,
    stop() {
      feed.stopHeartbeat();
      adapter.close();
    },
  };
}
