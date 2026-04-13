/**
 * NodeServerAdapter — wraps node:http + ws, exposing the same ServerAdapter
 * interface as BunServerAdapter.
 */
import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import type { Socket } from "node:net";
import { WebSocketServer, type WebSocket } from "ws";
import type {
  ServerAdapter,
  FetchHandler,
  UpgradeHandler,
  WsHandlers,
  WsHandle,
  WsData,
} from "../adapter";

class NodeWsHandle implements WsHandle {
  constructor(
    private readonly ws: WebSocket,
    public readonly data: WsData,
  ) {}

  get readyState(): number {
    return this.ws.readyState;
  }

  send(msg: string | ArrayBuffer | ArrayBufferView): void {
    this.ws.send(msg);
  }

  close(code?: number, reason?: string): void {
    this.ws.close(code, reason);
  }
}

export class NodeServerAdapter implements ServerAdapter {
  private fetchHandler: FetchHandler | null = null;
  private upgradeHandler: UpgradeHandler | null = null;
  private wsHandlers: WsHandlers | null = null;

  private readonly httpServer = createServer();
  private readonly wss = new WebSocketServer({ noServer: true });
  private port = 0;

  /** One handle per underlying ws socket — required for registry identity checks. */
  private readonly handles = new WeakMap<WebSocket, NodeWsHandle>();

  setFetchHandler(handler: FetchHandler): void {
    this.fetchHandler = handler;
  }

  setUpgradeHandler(handler: UpgradeHandler): void {
    this.upgradeHandler = handler;
  }

  setWebSocketHandlers(handlers: WsHandlers): void {
    this.wsHandlers = handlers;
  }

  listen(port: number): Promise<number> {
    this.httpServer.on("request", (req, res) => {
      void this.handleRequest(req, res);
    });
    this.httpServer.on("upgrade", (req, socket, head) => {
      this.handleUpgrade(req, socket as Socket, head as Buffer);
    });

    return new Promise((resolve, reject) => {
      this.httpServer.once("error", reject);
      this.httpServer.listen(port, () => {
        const addr = this.httpServer.address();
        if (!addr || typeof addr === "string") {
          reject(new Error("Unable to determine bound port"));
          return;
        }
        this.port = addr.port;
        resolve(this.port);
      });
    });
  }

  close(): void {
    for (const ws of this.wss.clients) {
      ws.terminate();
    }
    this.wss.close();
    // closeAllConnections() is available in Node.js ≥18.2 (we target ≥20 LTS)
    this.httpServer.closeAllConnections?.();
    this.httpServer.close();
  }

  // ── private ───────────────────────────────────────────────────────────────

  private async handleRequest(
    nodeReq: IncomingMessage,
    nodeRes: ServerResponse,
  ): Promise<void> {
    const req = toRequest(nodeReq, this.port);
    try {
      const result = await this.fetchHandler?.(req);
      if (result) {
        await pipeResponse(result, nodeRes);
      } else {
        nodeRes.writeHead(404, { "Content-Type": "text/plain" });
        nodeRes.end("Not found");
      }
    } catch {
      if (!nodeRes.headersSent) {
        nodeRes.writeHead(500);
      }
      nodeRes.end();
    }
  }

  private handleUpgrade(
    req: IncomingMessage,
    socket: Socket,
    head: Buffer,
  ): void {
    const request = toRequest(req, this.port);
    const wsData = this.upgradeHandler?.(request);
    if (!wsData) {
      socket.destroy();
      return;
    }

    this.wss.handleUpgrade(req, socket, head, (ws) => {
      const handle = new NodeWsHandle(ws, wsData);
      this.handles.set(ws, handle);

      this.wsHandlers?.open(handle);

      ws.on("message", (data, isBinary) => {
        // ws delivers text frames as Buffer — preserve the frame type so
        // the relay sends text frames back as text (not binary).
        const msg = isBinary ? (data as Buffer) : (data as Buffer).toString();
        this.wsHandlers?.message(handle, msg);
      });

      ws.on("close", (code, reason) => {
        this.wsHandlers?.close(handle, code, reason.toString());
      });
    });
  }
}

// ── helpers ─────────────────────────────────────────────────────────────────

function toRequest(req: IncomingMessage, port: number): Request {
  const url = `http://127.0.0.1:${port}${req.url ?? "/"}`;
  const headers: Record<string, string> = {};
  for (const [key, val] of Object.entries(req.headers)) {
    if (val !== undefined) {
      headers[key] = Array.isArray(val) ? val.join(", ") : val;
    }
  }
  return new Request(url, { method: req.method ?? "GET", headers });
}

async function pipeResponse(
  response: Response,
  nodeRes: ServerResponse,
): Promise<void> {
  const headers: Record<string, string> = {};
  response.headers.forEach((val, key) => {
    headers[key] = val;
  });
  nodeRes.writeHead(response.status, headers);

  if (!response.body) {
    nodeRes.end();
    return;
  }

  const reader = response.body.getReader();
  // Trigger ReadableStream cancellation when the client disconnects
  nodeRes.on("close", () => {
    reader.cancel().catch(() => {});
  });

  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      const ok = nodeRes.write(value);
      if (!ok) {
        await new Promise<void>((r) => nodeRes.once("drain", r));
      }
    }
  } catch {
    // Stream cancelled — client disconnected or server closed
  }
  nodeRes.end();
}
