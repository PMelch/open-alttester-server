// Polyfill WebSocket for Node.js < 22.
// Node 22 ships WebSocket as a stable global; Node 20 does not.
// The `ws` package is already a production dependency so no extra install needed.
import { WebSocket as WsWebSocket } from "ws";

if (typeof globalThis.WebSocket === "undefined") {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (globalThis as any).WebSocket = WsWebSocket;
}
