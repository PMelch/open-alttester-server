import { describe, it, expect, beforeEach } from "bun:test";
import { InspectorService } from "../inspector";
import type { WsConn } from "../registry";

// ------------------------------------------------------------------ mock socket

function makeMockWs(): { ws: WsConn; sent: string[] } {
  const sent: string[] = [];
  const ws: WsConn = {
    send: (data) => { sent.push(typeof data === "string" ? data : String(data)); },
    close: () => {},
    readyState: 1,
  };
  return { ws, sent };
}

// ------------------------------------------------------------------ tests

describe("InspectorService", () => {
  let svc: InspectorService;

  beforeEach(() => {
    svc = new InspectorService();
  });

  describe("tryConsume", () => {
    it("returns false for an unknown messageId", () => {
      expect(svc.tryConsume(JSON.stringify({ commandName: "x", messageId: "99" }))).toBe(false);
    });

    it("returns false for non-JSON input", () => {
      expect(svc.tryConsume("not-json")).toBe(false);
    });

    it("returns false for JSON with no messageId field", () => {
      expect(svc.tryConsume(JSON.stringify({ commandName: "x" }))).toBe(false);
    });

    it("returns true and removes the pending entry when messageId matches", async () => {
      const { ws } = makeMockWs();
      const promise = svc.send(ws, "getServerVersion", {}, 1000);

      // Capture the messageId from what was sent to the mock ws
      const { sent } = makeMockWs();
      // Re-run with the real ws to get the messageId
      const { ws: ws2, sent: sent2 } = makeMockWs();
      const p2 = svc.send(ws2, "getServerVersion", {}, 1000);
      const cmd2 = JSON.parse(sent2[0]);

      const response = JSON.stringify({ commandName: "getServerVersion", messageId: cmd2.messageId, data: JSON.stringify("1.0") });
      expect(svc.tryConsume(response)).toBe(true);
      expect(svc.tryConsume(response)).toBe(false); // second call — already consumed

      await p2;
    });
  });

  describe("send", () => {
    it("sends correctly shaped JSON to the app WebSocket", () => {
      const { ws, sent } = makeMockWs();
      svc.send(ws, "getAllLoadedScenes", {}, 1000).catch(() => {});

      expect(sent).toHaveLength(1);
      const cmd = JSON.parse(sent[0]);
      expect(cmd.commandName).toBe("getAllLoadedScenes");
      expect(typeof cmd.messageId).toBe("string");
      expect(cmd.messageId.length).toBeGreaterThan(0);
      expect(cmd.parameters).toEqual({});
    });

    it("includes provided parameters in the command", () => {
      const { ws, sent } = makeMockWs();
      svc.send(ws, "findObjects", { by: "PATH", value: "//*" }, 1000).catch(() => {});
      const cmd = JSON.parse(sent[0]);
      expect(cmd.parameters).toEqual({ by: "PATH", value: "//*" });
    });

    it("uses unique messageIds for concurrent requests", () => {
      const { ws, sent } = makeMockWs();
      svc.send(ws, "cmd1", {}, 1000).catch(() => {});
      svc.send(ws, "cmd2", {}, 1000).catch(() => {});
      const id1 = JSON.parse(sent[0]).messageId;
      const id2 = JSON.parse(sent[1]).messageId;
      expect(id1).not.toBe(id2);
    });

    it("resolves with the parsed data on a successful response", async () => {
      const { ws, sent } = makeMockWs();
      const promise = svc.send(ws, "getAllLoadedScenes", {}, 1000);

      const { messageId } = JSON.parse(sent[0]);
      svc.tryConsume(JSON.stringify({
        commandName: "getAllLoadedScenes",
        messageId,
        data: JSON.stringify(["Scene1", "Scene2"]),
      }));

      const result = await promise;
      expect(result).toEqual(["Scene1", "Scene2"]);
    });

    it("rejects with an error when the app returns an error response", async () => {
      const { ws, sent } = makeMockWs();
      const promise = svc.send(ws, "badCommand", {}, 1000);

      const { messageId } = JSON.parse(sent[0]);
      svc.tryConsume(JSON.stringify({
        commandName: "badCommand",
        messageId,
        error: { type: "invalidCommand", message: "Unknown command" },
      }));

      await expect(promise).rejects.toThrow("Unknown command");
    });

    it("rejects with a timeout error when no response arrives in time", async () => {
      const { ws } = makeMockWs();
      await expect(svc.send(ws, "slow", {}, 50)).rejects.toThrow(/timed out/i);
    });
  });
});
