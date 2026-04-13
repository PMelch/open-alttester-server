/**
 * Focused regression tests for BunServerAdapter.
 * The full BDD suite (server.bdd.test.ts, inspector.bdd.test.ts) covers the happy
 * path; these unit tests target contract-level edge cases caught by code review.
 */
import { describe, it, expect, afterEach } from "vitest";
import type { ServerAdapter } from "../adapter";
import { BunServerAdapter } from "../adapters/bun";

// BunServerAdapter calls Bun.serve() at runtime — only runnable under Bun.
const isBun = typeof (globalThis as Record<string, unknown>)["Bun"] !== "undefined";

describe.skipIf(!isBun)("BunServerAdapter", () => {
  let adapter: BunServerAdapter;

  afterEach(() => {
    adapter?.close();
  });

  describe("AC#1: implements the ServerAdapter interface", () => {
    it("exposes all required methods", () => {
      adapter = new BunServerAdapter();
      const _typed: ServerAdapter = adapter;
      expect(typeof adapter.listen).toBe("function");
      expect(typeof adapter.close).toBe("function");
      expect(typeof adapter.setFetchHandler).toBe("function");
      expect(typeof adapter.setUpgradeHandler).toBe("function");
      expect(typeof adapter.setWebSocketHandlers).toBe("function");
    });
  });

  describe("R2-1 regression: binary WebSocket frames are forwarded without corruption", () => {
    it("sends an ArrayBuffer payload and the client receives the same bytes", async () => {
      adapter = new BunServerAdapter();
      adapter.setUpgradeHandler(() => ({
        params: new URLSearchParams(),
        appName: "bin-test",
        role: "app" as const,
      }));

      const sentBytes = new Uint8Array([0x01, 0x02, 0x03, 0xfe, 0xff]);
      adapter.setWebSocketHandlers({
        open: (ws) => ws.send(sentBytes.buffer),
        message: () => {},
        close: () => {},
      });

      const port = await adapter.listen(0);

      let receivedBuffer: ArrayBuffer | null = null;
      await new Promise<void>((resolve) => {
        const ws = new WebSocket(`ws://127.0.0.1:${port}/ws`);
        ws.binaryType = "arraybuffer";
        ws.onmessage = (e) => {
          receivedBuffer = e.data as ArrayBuffer;
          ws.close();
        };
        ws.onclose = () => resolve();
        ws.onerror = () => resolve();
      });

      expect(receivedBuffer).not.toBeNull();
      expect(Array.from(new Uint8Array(receivedBuffer!))).toEqual(Array.from(sentBytes));
    });
  });

  describe("R1-2 regression: async fetch handler that resolves to null returns 404", () => {
    it("returns 404 when handler returns Promise<null>", async () => {
      adapter = new BunServerAdapter();
      adapter.setFetchHandler(() => Promise.resolve(null));
      const port = await adapter.listen(0);

      const res = await fetch(`http://127.0.0.1:${port}/any`);
      expect(res.status).toBe(404);
    });

    it("returns 404 when handler returns Promise<undefined>", async () => {
      adapter = new BunServerAdapter();
      adapter.setFetchHandler(() => Promise.resolve(undefined));
      const port = await adapter.listen(0);

      const res = await fetch(`http://127.0.0.1:${port}/any`);
      expect(res.status).toBe(404);
    });

    it("returns the response when handler returns Promise<Response>", async () => {
      adapter = new BunServerAdapter();
      adapter.setFetchHandler(() => Promise.resolve(new Response("async-ok", { status: 200 })));
      const port = await adapter.listen(0);

      const res = await fetch(`http://127.0.0.1:${port}/any`);
      expect(res.status).toBe(200);
      expect(await res.text()).toBe("async-ok");
    });
  });
});
