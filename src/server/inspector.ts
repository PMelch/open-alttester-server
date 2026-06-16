import type { WsConn } from "./registry";
import type { CommandDebugLog, CommandDebugSource } from "./debug";

export interface InspectorDebugTrace {
  debug: CommandDebugLog;
  appName: string;
  source: CommandDebugSource;
  toolName?: string;
}

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
    debugTrace?: InspectorDebugTrace,
  ): Promise<unknown> {
    const WS_OPEN = 1;
    if (appWs.readyState !== WS_OPEN) {
      return Promise.reject(new Error(`Inspector: app socket is not open (readyState=${appWs.readyState})`));
    }
    return new Promise((resolve, reject) => {
      const messageId = this.nextId();
      const requestPayload = { commandName: command, messageId, ...parameters };
      const debugEvent = debugTrace?.debug.recordRequest({
        appName: debugTrace.appName,
        source: debugTrace.source,
        toolName: debugTrace.toolName,
        commandName: command,
        messageId,
        requestPayload,
      });
      let settled = false;

      this.pending.set(messageId, (raw) => {
        if (settled) return;
        settled = true;
        try {
          const msg = JSON.parse(raw);
          if (msg.error) {
            const err = new Error(msg.error.message ?? "Inspector command failed");
            if (msg.error.trace) (err as Error & { unityTrace: string }).unityTrace = msg.error.trace;
            if (debugEvent) {
              debugTrace?.debug.recordCompletion(debugEvent.id, {
                status: "error",
                durationMs: Date.now() - Date.parse(debugEvent.time),
                responsePayload: msg,
                error: err.message,
              });
            }
            reject(err);
          } else if (msg.data === undefined || msg.data === null) {
            if (debugEvent) {
              debugTrace?.debug.recordCompletion(debugEvent.id, {
                status: "ok",
                durationMs: Date.now() - Date.parse(debugEvent.time),
                responsePayload: msg,
              });
            }
            resolve(null);
          } else {
            const parsedData = typeof msg.data === "string" ? JSON.parse(msg.data) : msg.data;
            if (debugEvent) {
              debugTrace?.debug.recordCompletion(debugEvent.id, {
                status: "ok",
                durationMs: Date.now() - Date.parse(debugEvent.time),
                responsePayload: msg,
              });
            }
            resolve(parsedData);
          }
        } catch (e) {
          if (debugEvent) {
            debugTrace?.debug.recordCompletion(debugEvent.id, {
              status: "error",
              durationMs: Date.now() - Date.parse(debugEvent.time),
              responsePayload: raw,
              error: e instanceof Error ? e.message : String(e),
            });
          }
          reject(e);
        }
      });

      // Unity deserialises the message directly into the command params class (flat, no wrapper).
      appWs.send(JSON.stringify(requestPayload));

      setTimeout(() => {
        if (this.pending.delete(messageId)) {
          settled = true;
          if (debugEvent) {
            debugTrace?.debug.recordCompletion(debugEvent.id, {
              status: "timeout",
              durationMs: Date.now() - Date.parse(debugEvent.time),
              error: `Inspector command "${command}" timed out`,
            });
          }
          reject(new Error(`Inspector command "${command}" timed out`));
        }
      }, timeoutMs);
    });
  }
}
