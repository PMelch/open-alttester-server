import type { ServerWebSocket } from "bun";
import { ConnectionRegistry, CloseCode, ClientRole, type WsConn } from "./registry";
import { DashboardFeed, handleDashboardRequest } from "../web/handler";

export interface AltTesterServerOptions {
  port: number;
  /** Heartbeat interval in ms for SSE keepalive comments. Default: 20000. */
  heartbeatMs?: number;
}

export interface AltTesterServer {
  port: number;
  registry: ConnectionRegistry;
  feed: DashboardFeed;
  stop(): void;
}

interface WsData {
  params: URLSearchParams;
  appName: string;
  role: "app" | "driver";
}

const DRIVER_REGISTERED = JSON.stringify({
  isNotification: true,
  commandName: "driverRegistered",
  data: "",
});

const DRIVER_DISCONNECTED = JSON.stringify({
  isNotification: true,
  commandName: "driverDisconnected",
  data: "",
});

const CLOSE_REASONS: Record<number, string> = {
  [CloseCode.NoAppConnected]: "No app connected with that appName.",
  [CloseCode.MultipleDrivers]: "A driver is already connected to that app.",
  [CloseCode.MultipleDriversTrying]: "Another driver is already trying to connect.",
};

export async function createAltTesterServer(
  opts: AltTesterServerOptions,
): Promise<AltTesterServer> {
  const registry = new ConnectionRegistry();
  const feed = new DashboardFeed();
  feed.startHeartbeat(opts.heartbeatMs ?? 20_000);
  const startTime = Date.now();

  const server = Bun.serve<WsData>({
    port: opts.port,

    fetch(req, server) {
      const url = new URL(req.url);
      const params = url.searchParams;
      const appName = params.get("appName") ?? "__default__";
      const path = url.pathname;

      // Path-based role distinction (from SDK source):
      //   /altws/app  → Unity SDK app (RuntimeWebSocketClient)
      //   /altws      → test driver (Python AltDriver, C# DriverWebSocketClient)
      if (path === "/altws/app") {
        const upgraded = server.upgrade(req, { data: { params, appName, role: "app" } });
        if (upgraded) return undefined;
      }

      if (path === "/altws") {
        const upgraded = server.upgrade(req, { data: { params, appName, role: "driver" } });
        if (upgraded) return undefined;
      }

      // Dashboard HTTP routes
      const dashResponse = handleDashboardRequest(req, registry, feed, startTime);
      if (dashResponse) return dashResponse;

      return new Response("Not found", { status: 404 });
    },

    websocket: {
      open(ws: ServerWebSocket<WsData>) {
        const { params, appName, role } = ws.data;
        const platform = params.get("platform") ?? "unknown";
        const platformVersion = params.get("platformVersion") ?? "unknown";
        const deviceInstanceId = params.get("deviceInstanceId") ?? "unknown";
        const driverType = params.get("driverType") ?? "unknown";
        const appId = params.get("appId") ?? undefined;

        if (role === "app") {
          registry.registerApp(appName, ws, { platform, platformVersion, deviceInstanceId, appId });
          feed.emit({ type: "appConnected", appName, platform, platformVersion, deviceInstanceId });
          return;
        }

        // registerDriver checks pendingDrivers — callers can pre-mark a socket
        // as pending via registry.markDriverPending() to trigger close code 4007.
        const result = registry.registerDriver(appName, ws, { driverType, platform, platformVersion, deviceInstanceId });

        if (result === "paired") {
          ws.send(DRIVER_REGISTERED);
          feed.emit({ type: "driverConnected", appName, driverType, paired: true });
          return;
        }

        const code = result as number;
        queueMicrotask(() => ws.close(code, CLOSE_REASONS[code] ?? "Connection rejected."));
      },

      message(ws: ServerWebSocket<WsData>, msg: string | Buffer) {
        const peer = registry.getPeer(ws) as ServerWebSocket<WsData> | undefined;
        if (!peer) return;
        peer.send(msg);
      },

      close(ws: ServerWebSocket<WsData>, _code: number, _reason: string) {
        const role = registry.getRole(ws);

        if (role === ClientRole.App) {
          // Capture appName before removal (removeApp clears the metadata map)
          const appName = ws.data.appName;
          const driverWs = registry.removeApp(ws);
          feed.emit({ type: "appDisconnected", appName });
          if (driverWs) {
            queueMicrotask(() => (driverWs as ServerWebSocket<WsData>).close(CloseCode.AppDisconnected, "App disconnected."));
          }
          return;
        }

        if (role === ClientRole.Driver) {
          // Capture appName before removal
          const appName = ws.data.appName;
          const appWs = registry.removeDriver(ws) as ServerWebSocket<WsData> | undefined;
          feed.emit({ type: "driverDisconnected", appName });
          if (appWs) {
            appWs.send(DRIVER_DISCONNECTED);
          }
        }
      },
    },
  });

  return {
    port: server.port,
    registry,
    feed,
    stop() {
      feed.stopHeartbeat();
      server.stop(true);
    },
  };
}
