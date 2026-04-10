import type { ServerWebSocket } from "bun";
import { ConnectionRegistry, CloseCode, ClientRole, type WsConn } from "./registry";

export interface AltTesterServerOptions {
  port: number;
}

export interface AltTesterServer {
  port: number;
  registry: ConnectionRegistry;
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

  const server = Bun.serve<WsData>({
    port: opts.port,

    fetch(req, server) {
      const url = new URL(req.url);
      const params = url.searchParams;
      const appName = params.get("appName") ?? "__default__";
      const path = url.pathname;

      // Path-based role distinction (from SDK source):
      //   /altws/app  → Unity SDK app (RuntimeWebSocketClient)
      //   /altws      → test driver (Python, C# DriverWebSocketClient)
      //   /           → HTTP dashboard (served in TASK-1.4)
      if (path === "/altws/app") {
        const upgraded = server.upgrade(req, { data: { params, appName, role: "app" } });
        if (upgraded) return undefined;
      }

      if (path === "/altws") {
        const upgraded = server.upgrade(req, { data: { params, appName, role: "driver" } });
        if (upgraded) return undefined;
      }

      return new Response("AltTester Server", { status: 200 });
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
          return;
        }

        // R1-2: registerDriver checks pendingDrivers — callers can pre-mark a socket
        // as pending via registry.markDriverPending() before this open handler fires
        // (e.g. a future async path or test setup) to trigger close code 4007.
        const result = registry.registerDriver(appName, ws, { driverType, platform, platformVersion, deviceInstanceId });

        if (result === "paired") {
          ws.send(DRIVER_REGISTERED);
          return;
        }

        const code = result as number;
        queueMicrotask(() => ws.close(code, CLOSE_REASONS[code] ?? "Connection rejected."));
      },

      // R1-3: relay msg without casting — WsConn.send accepts both string and Buffer.
      message(ws: ServerWebSocket<WsData>, msg: string | Buffer) {
        const peer = registry.getPeer(ws) as ServerWebSocket<WsData> | undefined;
        if (!peer) return;
        peer.send(msg);
      },

      close(ws: ServerWebSocket<WsData>, _code: number, _reason: string) {
        const role = registry.getRole(ws);

        if (role === ClientRole.App) {
          const driverWs = registry.removeApp(ws) as ServerWebSocket<WsData> | undefined;
          if (driverWs) {
            queueMicrotask(() => driverWs.close(CloseCode.AppDisconnected, "App disconnected."));
          }
          return;
        }

        if (role === ClientRole.Driver) {
          // R1-4: notify the paired app that its driver disconnected.
          const appWs = registry.removeDriver(ws) as ServerWebSocket<WsData> | undefined;
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
    stop() {
      server.stop(true);
    },
  };
}
