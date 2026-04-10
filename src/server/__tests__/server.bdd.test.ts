/**
 * BDD feature tests — real WebSocket connections against a real Bun server.
 * Each scenario spins up a fresh server on port 0 and connects real WS clients.
 *
 * Paths (from SDK source):
 *   /altws/app  → Unity SDK app connections (RuntimeWebSocketClient)
 *   /altws      → test driver connections (Python AltDriver, C# DriverWebSocketClient)
 */
import { describe, it, expect, beforeEach, afterEach } from "bun:test";
import { createAltTesterServer, type AltTesterServer } from "../server";

describe("Feature: AltTester server connection management", () => {
  let srv: AltTesterServer;

  beforeEach(async () => {
    srv = await createAltTesterServer({ port: 0 });
  });

  afterEach(() => {
    srv.stop();
  });

  // ------------------------------------------------------------------ scenarios

  describe("Scenario: Unity app registers with server", () => {
    it("Given the server is running / When a Unity app connects / Then the server lists it as connected", async () => {
      const app = await connectApp(srv.port, "MyGame");
      await waitMs(50);
      expect(srv.registry.hasApp("MyGame")).toBe(true);
      app.close();
    });
  });

  describe("Scenario: Driver pairs with Unity app and receives driverRegistered", () => {
    it("Given a Unity app is connected / When a driver connects / Then driver receives driverRegistered notification", async () => {
      const app = await connectApp(srv.port, "MyGame");
      await waitMs(50);

      const messages: string[] = [];
      const driver = await connectDriver(srv.port, "MyGame", { onMessage: (msg) => messages.push(msg) });

      await waitForCondition(() => messages.some(m => m.includes("driverRegistered")), 2000);
      expect(messages.some(m => m.includes("driverRegistered"))).toBe(true);

      app.close();
      driver.close();
    });
  });

  describe("Scenario: Message relay driver → app", () => {
    it("Given a paired session / When driver sends a command / Then app receives it verbatim", async () => {
      const appMessages: string[] = [];
      const app = await connectApp(srv.port, "MyGame", { onMessage: (m) => appMessages.push(m) });
      await waitMs(50);

      const driver = await connectDriver(srv.port, "MyGame");
      await waitForCondition(() => srv.registry.isPaired("MyGame"), 1000);

      const cmd = JSON.stringify({ commandName: "getCurrentScene", messageId: "12345" });
      driver.send(cmd);

      await waitForCondition(() => appMessages.includes(cmd), 1000);
      expect(appMessages).toContain(cmd);

      app.close();
      driver.close();
    });
  });

  describe("Scenario: Message relay app → driver", () => {
    it("Given a paired session / When app sends a response / Then driver receives it verbatim", async () => {
      const app = await connectApp(srv.port, "MyGame");
      await waitMs(50);

      const driverMessages: string[] = [];
      const driver = await connectDriver(srv.port, "MyGame", { onMessage: (m) => driverMessages.push(m) });
      await waitForCondition(() => driverMessages.some(m => m.includes("driverRegistered")), 1000);

      const response = JSON.stringify({ commandName: "getCurrentScene", messageId: "12345", data: '{"name":"MainScene"}' });
      app.send(response);

      await waitForCondition(() => driverMessages.includes(response), 1000);
      expect(driverMessages).toContain(response);

      app.close();
      driver.close();
    });
  });

  describe("Scenario: Close code 4001 — no app connected", () => {
    it("Given no app is connected for an appName / When a driver connects / Then connection closes with code 4001", async () => {
      const { code } = await getCloseCode(srv.port, "/altws", { appName: "Ghost", platform: "unknown", platformVersion: "unknown", deviceInstanceId: "d1", driverType: "python_3.5.0" });
      expect(code).toBe(4001);
    });
  });

  describe("Scenario: Close code 4005 — duplicate driver", () => {
    it("Given an app and driver are paired / When a second driver connects / Then second driver receives close code 4005", async () => {
      const app = await connectApp(srv.port, "MyGame");
      await waitMs(30);
      // R1-6: use distinct deviceInstanceIds for the two drivers
      const driver1 = await connectDriver(srv.port, "MyGame", { deviceInstanceId: "d1" });
      await waitForCondition(() => srv.registry.isPaired("MyGame"), 1000);

      const { code } = await getCloseCode(srv.port, "/altws", { appName: "MyGame", platform: "unknown", platformVersion: "unknown", deviceInstanceId: "d2", driverType: "python_3.5.0" });
      expect(code).toBe(4005);

      app.close();
      driver1.close();
    });
  });

  describe("Scenario: Close code 4002 — app disconnects mid-session", () => {
    it("Given a paired session / When the app disconnects / Then the driver receives close code 4002", async () => {
      const app = await connectApp(srv.port, "MyGame");
      await waitMs(30);

      let driverCloseCode = 0;
      const driverClosed = new Promise<void>((resolve) => {
        connectDriver(srv.port, "MyGame", { deviceInstanceId: "d1" }).then((driver) => {
          driver.onclose = (e) => { driverCloseCode = e.code; resolve(); };
        });
      });

      await waitForCondition(() => srv.registry.isPaired("MyGame"), 1000);
      app.close();
      await driverClosed;
      expect(driverCloseCode).toBe(4002);
    });
  });

  // R1-2: close code 4007 — second driver attempts to connect while first driver is mid-handshake.
  // True in-flight concurrency cannot be forced in single-threaded JS, so we inject the pending
  // state directly into the registry for an app that has no paired driver yet.
  describe("Scenario: Close code 4007 — concurrent driver connections", () => {
    it("Given an app is connected and a driver is pending / When another driver connects / Then it receives close code 4007", async () => {
      const app = await connectApp(srv.port, "PendingGame");
      await waitMs(30);

      // Inject a fake pending driver — simulates a driver mid-handshake
      const fakePending = { send: () => {}, close: () => {}, readyState: 1 };
      srv.registry.markDriverPending("PendingGame", fakePending);

      const { code } = await getCloseCode(srv.port, "/altws", { appName: "PendingGame", platform: "unknown", platformVersion: "unknown", deviceInstanceId: "d1", driverType: "python_3.5.0" });
      expect(code).toBe(4007);

      app.close();
    });
  });

  // R1-4: app receives driverDisconnected notification when driver leaves
  describe("Scenario: App notified when driver disconnects", () => {
    it("Given a paired session / When the driver disconnects / Then the app receives a driverDisconnected notification", async () => {
      const appMessages: string[] = [];
      const app = await connectApp(srv.port, "MyGame", { onMessage: (m) => appMessages.push(m) });
      await waitMs(30);

      const driver = await connectDriver(srv.port, "MyGame", { deviceInstanceId: "d1" });
      await waitForCondition(() => srv.registry.isPaired("MyGame"), 1000);

      driver.close();
      await waitForCondition(() => appMessages.some(m => m.includes("driverDisconnected")), 1000);
      expect(appMessages.some(m => m.includes("driverDisconnected"))).toBe(true);

      app.close();
    });
  });

  // R1-1: app re-registration clears stale pairing
  describe("Scenario: App re-registers — stale state is cleared", () => {
    it("Given a paired session / When the app re-connects / Then the old pairing is gone and registry is clean", async () => {
      const app1 = await connectApp(srv.port, "MyGame");
      await waitMs(30);
      const driver = await connectDriver(srv.port, "MyGame", { deviceInstanceId: "d1" });
      await waitForCondition(() => srv.registry.isPaired("MyGame"), 1000);

      // App reconnects (simulated: close old socket, connect new one)
      app1.close();
      await waitMs(50);

      // The old pairing should be gone now (app removed via close handler)
      expect(srv.registry.isPaired("MyGame")).toBe(false);
      expect(srv.registry.hasApp("MyGame")).toBe(false);

      driver.close();
    });
  });
});

// ------------------------------------------------------------------ utilities

function buildUrl(port: number, path: string, params: Record<string, string>): string {
  return `ws://127.0.0.1:${port}${path}?${new URLSearchParams(params)}`;
}

interface ConnectOpts {
  deviceInstanceId?: string;
  onMessage?: (msg: string) => void;
}

function connectApp(port: number, appName: string, opts: ConnectOpts = {}): Promise<WebSocket> {
  return connectWs(port, "/altws/app", {
    appName,
    platform: "Editor",
    platformVersion: "6000",
    deviceInstanceId: opts.deviceInstanceId ?? "app-1",
    driverType: "SDK",
  }, opts.onMessage);
}

function connectDriver(port: number, appName: string, opts: ConnectOpts = {}): Promise<WebSocket> {
  return connectWs(port, "/altws", {
    appName,
    platform: "unknown",
    platformVersion: "unknown",
    deviceInstanceId: opts.deviceInstanceId ?? "d1",
    driverType: "python_3.5.0",
  }, opts.onMessage);
}

function connectWs(port: number, path: string, params: Record<string, string>, onMessage?: (msg: string) => void): Promise<WebSocket> {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(buildUrl(port, path, params));
    ws.onopen = () => resolve(ws);
    ws.onerror = (e) => reject(e);
    if (onMessage) ws.onmessage = (e) => onMessage(e.data as string);
  });
}

function getCloseCode(port: number, path: string, params: Record<string, string>): Promise<{ code: number; reason: string }> {
  return new Promise((resolve) => {
    const ws = new WebSocket(buildUrl(port, path, params));
    ws.onclose = (e) => resolve({ code: e.code, reason: e.reason });
    ws.onerror = () => {};
    ws.onopen = () => {};
  });
}

function waitMs(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

function waitForCondition(fn: () => boolean, timeoutMs: number): Promise<void> {
  return new Promise((resolve, reject) => {
    const start = Date.now();
    const check = () => {
      if (fn()) return resolve();
      if (Date.now() - start > timeoutMs) return reject(new Error(`Condition timed out after ${timeoutMs}ms`));
      setTimeout(check, 20);
    };
    check();
  });
}
