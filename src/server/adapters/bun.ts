/// <reference types="bun-types" />
/**
 * BunServerAdapter — wraps Bun.serve, preserving all existing behaviour.
 *
 * The triple-slash reference above makes Bun types available in this file
 * without requiring bun-types in the global tsconfig.json.
 */
import type { ServerWebSocket } from "bun";
import type {
  ServerAdapter,
  FetchHandler,
  UpgradeHandler,
  WsHandlers,
  WsHandle,
  WsData,
} from "../adapter";

/**
 * Thin handle around a Bun ServerWebSocket.
 * Uses a WeakMap on the adapter so every socket gets exactly one handle
 * instance — required for Map-based identity checks in ConnectionRegistry.
 */
class BunWsHandle implements WsHandle {
  constructor(private readonly ws: ServerWebSocket<WsData>) {}

  get data(): WsData {
    return this.ws.data;
  }

  get readyState(): number {
    return this.ws.readyState;
  }

  send(msg: string | ArrayBuffer | ArrayBufferView): void {
    // Bun's ServerWebSocket.send() accepts `string | Bun.BufferSource`.
    // `Bun.BufferSource` is a superset of ArrayBuffer | ArrayBufferView at runtime
    // but TypeScript's generic parameterisation (ArrayBufferView<ArrayBufferLike>)
    // prevents direct assignment — the double cast is the correct escape hatch.
    this.ws.send(msg as unknown as string | Bun.BufferSource);
  }

  close(code?: number, reason?: string): void {
    this.ws.close(code, reason);
  }
}

export class BunServerAdapter implements ServerAdapter {
  private fetchHandler: FetchHandler | null = null;
  private upgradeHandler: UpgradeHandler | null = null;
  private wsHandlers: WsHandlers | null = null;
  private server: ReturnType<typeof Bun.serve> | null = null;
  private handles = new WeakMap<ServerWebSocket<WsData>, BunWsHandle>();

  setFetchHandler(handler: FetchHandler): void {
    this.fetchHandler = handler;
  }

  setUpgradeHandler(handler: UpgradeHandler): void {
    this.upgradeHandler = handler;
  }

  setWebSocketHandlers(handlers: WsHandlers): void {
    this.wsHandlers = handlers;
  }

  async listen(port: number): Promise<number> {
    const self = this;

    this.server = Bun.serve<WsData>({
      port,

      fetch(req, bunServer) {
        const wsData = self.upgradeHandler?.(req);
        if (wsData) {
          const ok = bunServer.upgrade(req, { data: wsData });
          if (ok) return undefined;
        }
        const result = self.fetchHandler?.(req);
        if (result == null) return new Response("Not found", { status: 404 });
        // Normalise async handlers: a Promise resolving to null/undefined → 404
        if (result instanceof Promise) {
          return result.then((r) => r ?? new Response("Not found", { status: 404 }));
        }
        return result;
      },

      websocket: {
        open(ws: ServerWebSocket<WsData>) {
          const handle = self.getHandle(ws);
          self.wsHandlers?.open(handle);
        },
        message(ws: ServerWebSocket<WsData>, msg: string | Buffer) {
          const handle = self.getHandle(ws);
          self.wsHandlers?.message(handle, msg);
        },
        close(ws: ServerWebSocket<WsData>, code: number, reason: string) {
          const handle = self.getHandle(ws);
          self.wsHandlers?.close(handle, code, reason);
        },
      },
    });

    // Bun.serve always sets port on a successfully bound server.
    const boundPort = this.server.port;
    if (boundPort == null) throw new Error("Bun.serve did not return a bound port");
    return boundPort;
  }

  close(): void {
    this.server?.stop(true);
    this.server = null;
  }

  private getHandle(ws: ServerWebSocket<WsData>): BunWsHandle {
    let handle = this.handles.get(ws);
    if (!handle) {
      handle = new BunWsHandle(ws);
      this.handles.set(ws, handle);
    }
    return handle;
  }
}
