/**
 * Runtime-agnostic server adapter interface.
 *
 * BunServerAdapter  — wraps Bun.serve (unchanged Bun behaviour)
 * NodeServerAdapter — wraps node:http + ws
 *
 * createAltTesterServer() picks the right adapter via runtime detection or
 * accepts one via options for testing.
 */

/** Data attached to every WebSocket connection on upgrade. */
export interface WsData {
  params: URLSearchParams;
  appName: string;
  role: "app" | "driver";
}

/**
 * Uniform handle for a live WebSocket connection.
 * Structurally satisfies WsConn so it can be stored directly in the registry.
 */
export interface WsHandle {
  readonly data: WsData;
  send(msg: string | ArrayBuffer | ArrayBufferView): void;
  close(code?: number, reason?: string): void;
  readonly readyState: number;
}

/**
 * Returns WsData when the request should be upgraded to WebSocket,
 * or null / undefined to fall through to the fetch handler.
 */
export type UpgradeHandler = (req: Request) => WsData | null | undefined;

/**
 * Returns a Response (or a promise of one) for the request.
 * Returning null / undefined means "not handled" → adapter responds 404.
 */
export type FetchHandler = (
  req: Request,
) => Response | Promise<Response | null | undefined> | null | undefined;

/** Lifecycle callbacks for WebSocket connections. */
export interface WsHandlers {
  open(ws: WsHandle): void;
  message(ws: WsHandle, msg: string | Buffer): void;
  close(ws: WsHandle, code: number, reason: string): void;
}

/** Public contract that both adapters must satisfy. */
export interface ServerAdapter {
  setFetchHandler(handler: FetchHandler): void;
  setUpgradeHandler(handler: UpgradeHandler): void;
  setWebSocketHandlers(handlers: WsHandlers): void;
  /** Start listening. Returns the actual bound port (important for port 0). */
  listen(port: number): Promise<number>;
  close(): void;
}
