/**
 * BDD tests for the Inspector HTTP endpoints.
 * A mock Unity app WebSocket auto-responds to inspector commands.
 */
import { describe, it, expect, beforeEach, afterEach } from "bun:test";
import { createAltTesterServer, type AltTesterServer } from "../server";

describe("Feature: Inspector", () => {
  let srv: AltTesterServer;

  beforeEach(async () => {
    srv = await createAltTesterServer({ port: 0 });
  });

  afterEach(() => {
    srv.stop();
  });

  // ------------------------------------------------------------------ scenarios

  describe("Scenario: App not connected returns 404", () => {
    it("Given no app is connected / When GET /inspector/:appName is requested / Then it returns 404", async () => {
      const res = await fetch(`http://127.0.0.1:${srv.port}/inspector/NoSuchApp`);
      expect(res.status).toBe(404);
      const body = await res.json() as { error: string };
      expect(typeof body.error).toBe("string");
    });
  });

  describe("Scenario: Scene info returned for connected app", () => {
    it("Given a connected Unity app / When GET /inspector/:appName / Then scenes and currentScene are returned", async () => {
      const { app, close } = await connectMockApp(srv.port, "SceneGame", {
        getAllLoadedScenes: ["Level1", "Level2"],
        getCurrentScene: { name: "Level1" },
      });

      const res = await fetch(`http://127.0.0.1:${srv.port}/inspector/SceneGame`);
      expect(res.status).toBe(200);
      const body = await res.json() as { scenes: string[]; currentScene: { name: string } };
      expect(body.scenes).toEqual(["Level1", "Level2"]);
      expect(body.currentScene).toEqual({ name: "Level1" });

      close();
      app.close();
    });
  });

  describe("Scenario: Objects returned for connected app", () => {
    it("Given a connected Unity app / When GET /inspector/:appName/objects / Then the game object list is returned", async () => {
      const objects = [
        { id: 1, name: "Main Camera", parentId: 0, transformId: 10 },
        { id: 2, name: "Player", parentId: 0, transformId: 20 },
        { id: 3, name: "Sword", parentId: 2, transformId: 30 },
      ];
      const { app, close } = await connectMockApp(srv.port, "ObjectGame", {
        findObjects: objects,
      });

      const res = await fetch(`http://127.0.0.1:${srv.port}/inspector/ObjectGame/objects`);
      expect(res.status).toBe(200);
      const body = await res.json() as { objects: typeof objects };
      expect(body.objects).toEqual(objects);

      close();
      app.close();
    });
  });

  describe("Scenario: getAllLoadedScenes response is normalised to an array", () => {
    it("Given the app returns a string for getAllLoadedScenes / When GET /inspector/:appName / Then scenes is always an array", async () => {
      const { app, close } = await connectMockApp(srv.port, "NormGame", {
        getAllLoadedScenes: "OnlyScene",      // string, not array
        getCurrentScene: { name: "OnlyScene" },
      });

      const res = await fetch(`http://127.0.0.1:${srv.port}/inspector/NormGame`);
      expect(res.status).toBe(200);
      const body = await res.json() as { scenes: unknown[] };
      expect(Array.isArray(body.scenes)).toBe(true);
      expect(body.scenes).toContain("OnlyScene");

      close();
      app.close();
    });
  });

  describe("Scenario: Rapid consecutive inspector calls succeed (supports auto-update polling)", () => {
    it("Given a connected app / When the inspector endpoint is called 5 times in quick succession / Then all calls succeed", async () => {
      const { app, close } = await connectMockApp(srv.port, "RapidGame", {
        getAllLoadedScenes: ["Rapid"],
        getCurrentScene: { name: "Rapid" },
      });

      const results = await Promise.all(
        Array.from({ length: 5 }, () =>
          fetch(`http://127.0.0.1:${srv.port}/inspector/RapidGame`).then(r => r.status),
        ),
      );
      expect(results.every(s => s === 200)).toBe(true);

      close();
      app.close();
    });
  });

  describe("Scenario: findObjects command uses //* path selector", () => {
    it("Given a connected Unity app / When GET /inspector/:appName/objects / Then findObjects is sent with value '//*'", async () => {
      const received: Array<Record<string, unknown>> = [];
      const objects = [{ id: 1, name: "Root", parentId: 0, transformId: 1 }];

      const app = new WebSocket(appUrl(srv.port, "PathGame"));
      await wsOpen(app);

      app.addEventListener("message", (e: MessageEvent) => {
        try {
          const msg = JSON.parse(e.data as string) as Record<string, unknown>;
          received.push(msg);
          if (msg.commandName === "findObjects") {
            app.send(JSON.stringify({
              commandName: msg.commandName,
              messageId: msg.messageId,
              data: JSON.stringify(objects),
            }));
          }
        } catch {}
      });

      const res = await fetch(`http://127.0.0.1:${srv.port}/inspector/PathGame/objects`);
      expect(res.status).toBe(200);

      const cmd = received.find(m => m.commandName === "findObjects");
      expect(cmd).toBeDefined();
      // Unity deserialises the message flat (no "parameters" wrapper).
      // BaseFindObjectsParams fields: path, cameraBy, cameraPath, enabled.
      expect(cmd!.path).toBe("//*");
      // cameraPath="//" is the AltOldFindObjectsCommand sentinel: skip camera lookup.
      // null cameraPath causes NullReferenceException at AltOldFindObjectsCommand.cs:33.
      expect(cmd!.cameraPath).toBe("//");

      app.close();
    });
  });

  describe("Scenario: Inspector does not interfere with active driver pairing (AC#5)", () => {
    it("Given a paired app+driver / When the inspector queries the app / Then driver relay still works", async () => {
      // Connect mock app with auto-respond
      const { app, close } = await connectMockApp(srv.port, "PairedGame", {
        getAllLoadedScenes: ["Main"],
        getCurrentScene: { name: "Main" },
      });

      // Connect a real driver
      const driver = new WebSocket(driverUrl(srv.port, "PairedGame"));
      await wsOpen(driver);

      // Inspector query while driver is connected
      const res = await fetch(`http://127.0.0.1:${srv.port}/inspector/PairedGame`);
      expect(res.status).toBe(200);
      const body = await res.json() as { scenes: string[] };
      expect(body.scenes).toEqual(["Main"]);

      // driver→app direction: message sent by driver arrives at app
      const driverReceived: string[] = [];
      app.onmessage = (e: MessageEvent) => {
        try {
          const msg = JSON.parse(e.data as string);
          if (String(msg.messageId).startsWith("inspector-")) return;
          driverReceived.push(e.data as string);
        } catch {}
      };
      driver.send(JSON.stringify({ commandName: "ping", messageId: "42", parameters: {} }));
      await waitMs(100);
      expect(driverReceived).toHaveLength(1);
      expect(JSON.parse(driverReceived[0]).commandName).toBe("ping");

      // app→driver direction: message sent by app arrives at driver (R1-4)
      const driverIncoming: string[] = [];
      driver.onmessage = (e: MessageEvent) => { driverIncoming.push(e.data as string); };
      app.send(JSON.stringify({ commandName: "notification", messageId: "app-1", data: "{}" }));
      await waitMs(100);
      expect(driverIncoming.length).toBeGreaterThan(0);
      expect(JSON.parse(driverIncoming[0]).commandName).toBe("notification");

      close();
      app.close();
      driver.close();
    });
  });
});

// ------------------------------------------------------------------ utilities

function appUrl(port: number, appName: string): string {
  return `ws://127.0.0.1:${port}/altws/app?appName=${appName}&platform=Editor&platformVersion=6000&deviceInstanceId=app-1&driverType=SDK`;
}

function driverUrl(port: number, appName: string): string {
  return `ws://127.0.0.1:${port}/altws?appName=${appName}&platform=unknown&platformVersion=unknown&deviceInstanceId=d1&driverType=python`;
}

function wsOpen(ws: WebSocket): Promise<void> {
  return new Promise((resolve, reject) => {
    if (ws.readyState === WebSocket.OPEN) return resolve();
    ws.onopen = () => resolve();
    ws.onerror = (e) => reject(e);
  });
}

function waitMs(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

type MockResponses = Record<string, unknown>;

async function connectMockApp(
  port: number,
  appName: string,
  responses: MockResponses,
): Promise<{ app: WebSocket; close: () => void }> {
  const app = new WebSocket(appUrl(port, appName));
  await wsOpen(app);

  const handler = (e: MessageEvent) => {
    try {
      const msg = JSON.parse(e.data as string) as { commandName: string; messageId: string };
      const data = responses[msg.commandName];
      if (data === undefined) return;
      app.send(JSON.stringify({
        commandName: msg.commandName,
        messageId: msg.messageId,
        data: JSON.stringify(data),
      }));
    } catch {}
  };

  app.addEventListener("message", handler);
  return {
    app,
    close: () => app.removeEventListener("message", handler),
  };
}
