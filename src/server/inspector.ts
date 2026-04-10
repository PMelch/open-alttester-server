import type { WsConn } from "./registry";

export class InspectorService {
  private pending = new Map<string, (raw: string) => void>();
  private counter = 0;

  private nextId(): string {
    return `inspector-${++this.counter}`;
  }

  /**
   * Try to consume a raw WebSocket message as an inspector response.
   * Returns true if the message matched a pending request (and was consumed).
   */
  tryConsume(raw: string): boolean {
    let messageId: string | undefined;
    try {
      const parsed = JSON.parse(raw);
      messageId = parsed?.messageId;
    } catch {
      return false;
    }
    if (!messageId) return false;

    const resolve = this.pending.get(messageId);
    if (!resolve) return false;
    this.pending.delete(messageId);
    resolve(raw);
    return true;
  }

  /**
   * Send a command to the given app WebSocket and wait for its response.
   * Rejects if the app returns an error or the timeout elapses.
   */
  send(
    appWs: WsConn,
    command: string,
    parameters: Record<string, unknown> = {},
    timeoutMs = 5000,
  ): Promise<unknown> {
    return new Promise((resolve, reject) => {
      const messageId = this.nextId();
      let settled = false;

      this.pending.set(messageId, (raw) => {
        if (settled) return;
        settled = true;
        try {
          const msg = JSON.parse(raw);
          if (msg.error) {
            reject(new Error(msg.error.message ?? "Inspector command failed"));
          } else {
            resolve(JSON.parse(msg.data));
          }
        } catch (e) {
          reject(e);
        }
      });

      appWs.send(JSON.stringify({ commandName: command, messageId, parameters }));

      setTimeout(() => {
        if (this.pending.delete(messageId)) {
          settled = true;
          reject(new Error(`Inspector command "${command}" timed out`));
        }
      }, timeoutMs);
    });
  }
}
