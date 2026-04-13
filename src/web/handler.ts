import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import type { ConnectionRegistry } from "../server/registry";

const { version: SERVER_VERSION } = JSON.parse(
  readFileSync(join(dirname(fileURLToPath(import.meta.url)), "../../package.json"), "utf8"),
) as { version: string };

// import.meta.dir is Bun-specific; fileURLToPath(new URL('.', import.meta.url)) works on both runtimes.
const DASHBOARD_HTML = readFileSync(
  join(dirname(fileURLToPath(import.meta.url)), "dashboard.html"),
  "utf8",
);

export type DashboardEvent =
  | { type: "appConnected"; appName: string; platform: string; platformVersion: string; deviceInstanceId: string }
  | { type: "appDisconnected"; appName: string }
  | { type: "driverConnected"; appName: string; driverType: string; paired: boolean }
  | { type: "driverDisconnected"; appName: string };

export class DashboardFeed {
  private clients = new Set<ReadableStreamDefaultController<Uint8Array>>();
  private encoder = new TextEncoder();
  private heartbeatTimer: ReturnType<typeof setInterval> | null = null;

  startHeartbeat(intervalMs = 5_000): void {
    if (this.heartbeatTimer !== null) {
      clearInterval(this.heartbeatTimer);
    }
    this.heartbeatTimer = setInterval(() => {
      this.emitRaw(": keepalive\n\n");
    }, intervalMs);
  }

  stopHeartbeat(): void {
    if (this.heartbeatTimer !== null) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
  }

  private emitRaw(raw: string): void {
    const bytes = this.encoder.encode(raw);
    for (const ctrl of this.clients) {
      try {
        ctrl.enqueue(bytes.slice());
      } catch {
        this.clients.delete(ctrl);
      }
    }
  }

  subscribe(): ReadableStream<Uint8Array> {
    let ctrl!: ReadableStreamDefaultController<Uint8Array>;
    const stream = new ReadableStream<Uint8Array>({
      start: (c) => {
        ctrl = c;
        this.clients.add(ctrl);
        // Flush headers immediately so the client knows the connection is live
        ctrl.enqueue(this.encoder.encode(": keepalive\n\n"));
      },
      cancel: () => {
        this.clients.delete(ctrl);
      },
    });
    return stream;
  }

  emit(event: DashboardEvent): void {
    this.emitRaw(`event: ${event.type}\ndata: ${JSON.stringify(event)}\n\n`);
  }

  subscriberCount(): number {
    return this.clients.size;
  }
}

export function handleDashboardRequest(
  req: Request,
  registry: ConnectionRegistry,
  feed: DashboardFeed,
  startTime: number,
): Response | null {
  const url = new URL(req.url);

  if (url.pathname === "/" || url.pathname === "/index.html") {
    return new Response(DASHBOARD_HTML, {
      headers: { "Content-Type": "text/html; charset=utf-8" },
    });
  }

  if (url.pathname === "/dashboard/state") {
    const state = {
      apps: registry.connectedApps(),
      drivers: registry.connectedDrivers(),
      uptime: (Date.now() - startTime) / 1000,
      version: SERVER_VERSION,
    };
    return new Response(JSON.stringify(state), {
      headers: { "Content-Type": "application/json; charset=utf-8" },
    });
  }

  if (url.pathname === "/dashboard/events") {
    const stream = feed.subscribe();
    return new Response(stream, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        "Connection": "keep-alive",
        "X-Accel-Buffering": "no",  // R3-4: prevent nginx buffering
      },
    });
  }

  return null;
}
