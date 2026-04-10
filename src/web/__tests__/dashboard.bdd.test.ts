/**
 * BDD tests for the web dashboard (Vue 3 + Tailwind, served as static HTML).
 */
import { describe, it, expect, beforeEach, afterEach } from "bun:test";
import { createAltTesterServer, type AltTesterServer } from "../../server/server";

describe("Feature: Web dashboard", () => {
  let srv: AltTesterServer;

  beforeEach(async () => {
    srv = await createAltTesterServer({ port: 0 });
  });

  afterEach(() => {
    srv.stop();
  });

  // ------------------------------------------------------------------ scenarios

  describe("Scenario: Dashboard HTML served at root", () => {
    it("Given the server is running / When GET / is requested / Then it returns HTML with status 200", async () => {
      const res = await fetch(`http://127.0.0.1:${srv.port}/`);
      expect(res.status).toBe(200);
      expect(res.headers.get("content-type")).toMatch(/text\/html/);
      const html = await res.text();
      expect(html).toContain("<html");
      expect(html).toContain("AltTester");
      expect(html).toContain("vue");
      expect(html).toContain("tailwind");
    });
  });

  describe("Scenario: State endpoint returns current connection counts", () => {
    it("Given a Unity app is connected / When GET /dashboard/state is requested / Then JSON reflects the live count", async () => {
      const app = new WebSocket(appUrl(srv.port, "StatGame"));
      await wsOpen(app);

      const res = await fetch(`http://127.0.0.1:${srv.port}/dashboard/state`);
      expect(res.status).toBe(200);
      expect(res.headers.get("content-type")).toMatch(/application\/json/);
      const body = await res.json() as { apps: unknown[]; drivers: unknown[]; uptime: number };
      expect(body.apps).toHaveLength(1);
      expect(body.drivers).toHaveLength(0);
      expect(typeof body.uptime).toBe("number");

      app.close();
    });
  });

  describe("Scenario: SSE feed emits appConnected event", () => {
    it("Given an SSE subscriber / When a Unity app connects / Then an appConnected event is received", async () => {
      // Open SSE stream first, then trigger the action so no events are missed
      const { events, cancel } = openSseStream(srv.port, "/dashboard/events");

      const app = new WebSocket(appUrl(srv.port, "LiveGame"));
      await wsOpen(app);

      await waitForEvent(events, "appConnected", 2000);
      expect(events.some(e => e.event === "appConnected" && e.data.includes("LiveGame"))).toBe(true);

      cancel();
      app.close();
    });
  });

  describe("Scenario: SSE feed emits appDisconnected event", () => {
    it("Given a connected app / When it disconnects / Then an appDisconnected event is received", async () => {
      const app = new WebSocket(appUrl(srv.port, "GoneGame"));
      await wsOpen(app);

      const { events, cancel } = openSseStream(srv.port, "/dashboard/events");
      await waitMs(30);

      app.close();
      await waitForEvent(events, "appDisconnected", 2000);
      expect(events.some(e => e.event === "appDisconnected" && e.data.includes("GoneGame"))).toBe(true);

      cancel();
    });
  });

  describe("Scenario: SSE feed emits driverConnected event", () => {
    it("Given a paired session / When a driver connects / Then a driverConnected event is received", async () => {
      const app = new WebSocket(appUrl(srv.port, "DriverGame"));
      await wsOpen(app);
      await waitMs(30);

      const { events, cancel } = openSseStream(srv.port, "/dashboard/events");
      await waitMs(30);

      const driver = new WebSocket(driverUrl(srv.port, "DriverGame"));
      await wsOpen(driver);

      await waitForEvent(events, "driverConnected", 2000);
      expect(events.some(e => e.event === "driverConnected" && e.data.includes("DriverGame"))).toBe(true);

      cancel();
      app.close();
      driver.close();
    });
  });
  describe("Scenario: SSE feed emits driverDisconnected event", () => {
    it("Given a paired session / When the driver disconnects / Then a driverDisconnected event is received", async () => {
      const app = new WebSocket(appUrl(srv.port, "DiscoDriver"));
      await wsOpen(app);
      await waitMs(30);

      const driver = new WebSocket(driverUrl(srv.port, "DiscoDriver"));
      await wsOpen(driver);
      await waitMs(30);

      const { events, cancel } = openSseStream(srv.port, "/dashboard/events");
      await waitMs(30);

      driver.close();
      await waitForEvent(events, "driverDisconnected", 2000);
      expect(events.some(e => e.event === "driverDisconnected" && e.data.includes("DiscoDriver"))).toBe(true);

      cancel();
      app.close();
    });
  });
});

// ------------------------------------------------------------------ utilities

function appUrl(port: number, appName: string): string {
  return `ws://127.0.0.1:${port}/altws/app?appName=${appName}&platform=Editor&platformVersion=6000&deviceInstanceId=app-1&driverType=SDK`;
}

function driverUrl(port: number, appName: string): string {
  return `ws://127.0.0.1:${port}/altws?appName=${appName}&platform=unknown&platformVersion=unknown&deviceInstanceId=d1&driverType=python_3.5.0`;
}

function wsOpen(ws: WebSocket): Promise<void> {
  return new Promise((resolve, reject) => {
    if (ws.readyState === WebSocket.OPEN) return resolve();
    ws.onopen = () => resolve();
    ws.onerror = (e) => reject(e);
  });
}

interface SseEvent { event: string; data: string }

function openSseStream(port: number, path: string): { events: SseEvent[]; cancel: () => void } {
  const events: SseEvent[] = [];
  const ctrl = new AbortController();

  fetch(`http://127.0.0.1:${port}${path}`, {
    headers: { Accept: "text/event-stream" },
    signal: ctrl.signal,
  }).then(async (res) => {
    const reader = res.body!.getReader();
    const decoder = new TextDecoder();
    let buf = "";
    while (true) {
      const { done, value } = await reader.read().catch(() => ({ done: true, value: undefined }));
      if (done) break;
      buf += decoder.decode(value, { stream: true });
      const parts = buf.split("\n\n");
      buf = parts.pop() ?? "";
      for (const part of parts) {
        const ev = parseSseBlock(part);
        if (ev) events.push(ev);
      }
    }
  }).catch(() => {});

  return {
    events,
    cancel: () => ctrl.abort(),
  };
}

function parseSseBlock(block: string): SseEvent | null {
  let event = "message", data = "";
  for (const line of block.split("\n")) {
    if (line.startsWith("event: ")) event = line.slice(7).trim();
    if (line.startsWith("data: ")) data = line.slice(6).trim();
  }
  return data ? { event, data } : null;
}

function waitForEvent(events: SseEvent[], type: string, timeoutMs: number): Promise<void> {
  return new Promise((resolve, reject) => {
    const start = Date.now();
    const check = () => {
      if (events.some(e => e.event === type)) return resolve();
      if (Date.now() - start > timeoutMs) return reject(new Error(`Timed out waiting for SSE event: ${type}`));
      setTimeout(check, 20);
    };
    check();
  });
}

function waitMs(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}
