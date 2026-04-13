/**
 * Unit tests for NodeServerAdapter (AC#1, AC#3, AC#4, AC#5).
 * These tests run under bun test but exercise the Node.js adapter path directly.
 *
 * Run order mirrors TDD: tests were written BEFORE the implementation.
 */
import { describe, it, expect, afterEach } from "vitest";
import type { ServerAdapter } from "../adapter";
import { NodeServerAdapter } from "../adapters/node";
import { createAltTesterServer } from "../server";

// ---------------------------------------------------------------------------
// NodeServerAdapter unit tests
// ---------------------------------------------------------------------------

describe("NodeServerAdapter", () => {
  let adapter: NodeServerAdapter;

  afterEach(() => {
    adapter?.close();
  });

  // ── AC#1 ──────────────────────────────────────────────────────────────────

  describe("AC#1: implements the ServerAdapter interface", () => {
    it("exposes all required methods", () => {
      adapter = new NodeServerAdapter();
      // TypeScript assignment verifies structural compatibility at compile-time
      const _typed: ServerAdapter = adapter;
      expect(typeof adapter.listen).toBe("function");
      expect(typeof adapter.close).toBe("function");
      expect(typeof adapter.setFetchHandler).toBe("function");
      expect(typeof adapter.setUpgradeHandler).toBe("function");
      expect(typeof adapter.setWebSocketHandlers).toBe("function");
    });
  });

  // ── AC#3 ──────────────────────────────────────────────────────────────────

  describe("AC#3: uses node:http + ws for HTTP and WebSocket", () => {
    it("listen(0) returns an actual ephemeral port", async () => {
      adapter = new NodeServerAdapter();
      const port = await adapter.listen(0);
      expect(typeof port).toBe("number");
      expect(port).toBeGreaterThan(0);
    });

    it("routes HTTP requests to the registered fetch handler", async () => {
      adapter = new NodeServerAdapter();
      adapter.setFetchHandler(() =>
        new Response(JSON.stringify({ ok: true }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }),
      );
      const port = await adapter.listen(0);

      const res = await fetch(`http://127.0.0.1:${port}/any`);
      expect(res.status).toBe(200);
      const body = await res.json() as { ok: boolean };
      expect(body.ok).toBe(true);
    });

    it("returns 404 when fetch handler returns null", async () => {
      adapter = new NodeServerAdapter();
      adapter.setFetchHandler(() => null);
      const port = await adapter.listen(0);

      const res = await fetch(`http://127.0.0.1:${port}/any`);
      expect(res.status).toBe(404);
    });

    it("returns 404 when fetch handler returns Promise<null> (async null)", async () => {
      adapter = new NodeServerAdapter();
      adapter.setFetchHandler(() => Promise.resolve(null));
      const port = await adapter.listen(0);

      const res = await fetch(`http://127.0.0.1:${port}/any`);
      expect(res.status).toBe(404);
    });

    it("calls open / message / close WebSocket handlers with correct data", async () => {
      const events: string[] = [];

      adapter = new NodeServerAdapter();
      adapter.setUpgradeHandler((req) => {
        if (new URL(req.url).pathname !== "/ws") return null;
        return { params: new URLSearchParams(), appName: "test-app", role: "app" as const };
      });
      adapter.setWebSocketHandlers({
        open: (ws) => {
          events.push(`open:${ws.data.appName}:${ws.data.role}`);
          ws.send("hello-from-server");
        },
        message: (_ws, msg) => {
          events.push(`msg:${msg}`);
          _ws.close(1000, "done");
        },
        close: (_ws, code) => {
          events.push(`close:${code}`);
        },
      });

      const port = await adapter.listen(0);

      const received: string[] = [];
      await new Promise<void>((resolve) => {
        const ws = new WebSocket(`ws://127.0.0.1:${port}/ws`);
        ws.onmessage = (e) => {
          received.push(e.data as string);
          ws.send("hello-from-client");
        };
        ws.onclose = () => resolve();
        ws.onerror = () => resolve();
      });
      // Server-side close handler fires after the client onclose — wait briefly.
      await new Promise<void>((r) => setTimeout(r, 50));

      expect(events).toContain("open:test-app:app");
      expect(events).toContain("msg:hello-from-client");
      expect(events.some((e) => e.startsWith("close:"))).toBe(true);
      expect(received).toContain("hello-from-server");
    });

    it("rejects WebSocket upgrades when the upgrade handler returns null", async () => {
      adapter = new NodeServerAdapter();
      adapter.setUpgradeHandler(() => null);
      const port = await adapter.listen(0);

      let settled = false;
      await new Promise<void>((resolve) => {
        const ws = new WebSocket(`ws://127.0.0.1:${port}/ws`);
        ws.onerror = () => { settled = true; resolve(); };
        ws.onclose = () => { settled = true; resolve(); };
        // safety timeout
        setTimeout(resolve, 1000);
      });

      expect(settled).toBe(true);
    });
  });

  // ── AC#5 ──────────────────────────────────────────────────────────────────

  describe("AC#5: WsHandle identity is stable (same object across open/message/close)", () => {
    it("the same WsHandle instance is delivered to all three callbacks", async () => {
      const handles: object[] = [];

      adapter = new NodeServerAdapter();
      adapter.setUpgradeHandler(() => ({
        params: new URLSearchParams(),
        appName: "id-test",
        role: "app" as const,
      }));
      adapter.setWebSocketHandlers({
        open: (ws) => { handles.push(ws); ws.send("ping"); },
        message: (ws) => { handles.push(ws); ws.close(1000, "done"); },
        close: (ws) => { handles.push(ws); },
      });

      const port = await adapter.listen(0);

      await new Promise<void>((resolve) => {
        const ws = new WebSocket(`ws://127.0.0.1:${port}/ws`);
        ws.onmessage = () => ws.send("pong");
        ws.onclose = () => resolve();
        ws.onerror = () => resolve();
      });
      // Server-side close handler fires after the client onclose — wait briefly.
      await new Promise<void>((r) => setTimeout(r, 50));

      // All three callbacks must have received the exact same handle object
      expect(handles.length).toBeGreaterThanOrEqual(3);
      expect(handles[0]).toBe(handles[1]);
      expect(handles[1]).toBe(handles[2]);
    });
  });
});

// ---------------------------------------------------------------------------
// AC#4: createAltTesterServer adapter injection
// ---------------------------------------------------------------------------

describe("createAltTesterServer — adapter injection (AC#4)", () => {
  it("accepts a NodeServerAdapter via opts.adapter and returns a working server", async () => {
    const nodeAdapter = new NodeServerAdapter();
    const srv = await createAltTesterServer({ port: 0, adapter: nodeAdapter });
    expect(srv.port).toBeGreaterThan(0);
    expect(typeof srv.stop).toBe("function");
    srv.stop();
  });
});
