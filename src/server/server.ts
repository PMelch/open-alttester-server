import type { ServerWebSocket } from "bun";
import { ConnectionRegistry, CloseCode, ClientRole } from "./registry";

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

const CLOSE_REASONS: Record<number, string> = {
  [CloseCode.NoAppConnected]: "No app connected with that appName.",
  [CloseCode.MultipleDrivers]: "A driver is already connected to that app.",
  [CloseCode.MultipleDriversTrying]: "Another driver is already trying to connect.",
  [CloseCode.MaxConnections]: "Maximum number of connections exceeded.",
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

      // Determine role from path:
      //   /altws/app  → Unity SDK app
      //   /altws      → test driver (Python, C#, etc.)
      //   /           → HTTP dashboard (future)
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

        // role === "driver"
        const result = registry.registerDriver(appName, ws, { driverType, platform, platformVersion, deviceInstanceId });

        if (result === "paired") {
          ws.send(DRIVER_REGISTERED);
          return;
        }

        const code = result as number;
        queueMicrotask(() => ws.close(code, CLOSE_REASONS[code] ?? "Connection rejected."));
      },

      message(ws: ServerWebSocket<WsData>, msg: string | Buffer) {
        const peer = registry.getPeer(ws);
        if (!peer) return;
        (peer as ServerWebSocket<WsData>).send(msg as string);
      },

      close(ws: ServerWebSocket<WsData>, _code: number, _reason: string) {
        const role = registry.getRole(ws);

        if (role === ClientRole.App) {
          const driverWs = registry.removeApp(ws);
          if (driverWs) {
            queueMicrotask(() =>
              (driverWs as ServerWebSocket<WsData>).close(CloseCode.AppDisconnected, "App disconnected.")
            );
          }
          return;
        }

        if (role === ClientRole.Driver) {
          registry.removeDriver(ws);
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
