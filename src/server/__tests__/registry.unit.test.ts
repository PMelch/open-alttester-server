import { describe, it, expect, beforeEach } from "bun:test";
import { ConnectionRegistry, CloseCode, type WsConn } from "../registry";

describe("ConnectionRegistry", () => {
  let registry: ConnectionRegistry;

  beforeEach(() => {
    registry = new ConnectionRegistry();
  });

  // --- registerApp ---

  describe("registerApp", () => {
    it("registers a Unity app by appName", () => {
      const ws = mockWs();
      registry.registerApp("MyGame", ws);
      expect(registry.getApp("MyGame")).toBe(ws);
    });

    it("lists the app in connectedApps", () => {
      registry.registerApp("MyGame", mockWs());
      expect(registry.connectedApps()).toEqual(
        expect.arrayContaining([expect.objectContaining({ appName: "MyGame" })])
      );
    });

    // R1-1: re-registration must clean up the old socket's metadata and peer links
    it("cleans up old WsConn metadata when the same appName re-registers", () => {
      const ws1 = mockWs();
      const ws2 = mockWs();
      registry.registerApp("MyGame", ws1);
      registry.registerApp("MyGame", ws2);
      expect(registry.getApp("MyGame")).toBe(ws2);
      // old socket must not appear in metadata
      expect(registry.getRole(ws1)).toBeUndefined();
    });

    it("cleans up paired driver when app re-registers (prevents stale peer link)", () => {
      const appWs1 = mockWs();
      const driverWs = mockWs();
      registry.registerApp("MyGame", appWs1);
      registry.registerDriver("MyGame", driverWs);
      expect(registry.isPaired("MyGame")).toBe(true);

      // app reconnects
      const appWs2 = mockWs();
      registry.registerApp("MyGame", appWs2);

      // old pairing must be gone
      expect(registry.getPeer(appWs1)).toBeUndefined();
      expect(registry.getPeer(driverWs)).toBeUndefined();
      expect(registry.isPaired("MyGame")).toBe(false);
    });
  });

  // --- registerDriver ---

  describe("registerDriver", () => {
    it("returns NoAppConnected when no app is registered", () => {
      const result = registry.registerDriver("MissingGame", mockWs());
      expect(result).toBe(CloseCode.NoAppConnected);
    });

    it("pairs driver with app when app is available", () => {
      const appWs = mockWs();
      const driverWs = mockWs();
      registry.registerApp("MyGame", appWs);
      const result = registry.registerDriver("MyGame", driverWs);
      expect(result).toBe("paired");
      expect(registry.getPairedApp(driverWs)).toBe(appWs);
      expect(registry.getPairedDriver(appWs)).toBe(driverWs);
    });

    it("returns MultipleDrivers when a driver is already paired", () => {
      const appWs = mockWs();
      registry.registerApp("MyGame", appWs);
      registry.registerDriver("MyGame", mockWs());
      const result = registry.registerDriver("MyGame", mockWs());
      expect(result).toBe(CloseCode.MultipleDrivers);
    });

    it("returns MultipleDriversTrying when a driver is pending pairing", () => {
      registry.registerApp("MyGame", mockWs());
      registry.markDriverPending("MyGame", mockWs());
      const result = registry.registerDriver("MyGame", mockWs());
      expect(result).toBe(CloseCode.MultipleDriversTrying);
    });
  });

  // --- removeApp ---

  describe("removeApp", () => {
    it("removes the app and returns the paired driver if any", () => {
      const appWs = mockWs();
      const driverWs = mockWs();
      registry.registerApp("MyGame", appWs);
      registry.registerDriver("MyGame", driverWs);
      const driver = registry.removeApp(appWs);
      expect(driver).toBe(driverWs);
      expect(registry.getApp("MyGame")).toBeUndefined();
    });

    it("returns undefined when app had no driver", () => {
      const appWs = mockWs();
      registry.registerApp("MyGame", appWs);
      expect(registry.removeApp(appWs)).toBeUndefined();
    });
  });

  // --- removeDriver ---

  describe("removeDriver", () => {
    it("unpairs the driver and returns the paired app", () => {
      const appWs = mockWs();
      const driverWs = mockWs();
      registry.registerApp("MyGame", appWs);
      registry.registerDriver("MyGame", driverWs);
      const app = registry.removeDriver(driverWs);
      expect(app).toBe(appWs);
      expect(registry.getPairedDriver(appWs)).toBeUndefined();
      expect(registry.getPairedApp(driverWs)).toBeUndefined();
    });

    it("returns undefined for an unregistered driver", () => {
      expect(registry.removeDriver(mockWs())).toBeUndefined();
    });
  });

  // --- getPeer ---

  describe("getPeer", () => {
    it("returns the app when given the driver", () => {
      const appWs = mockWs();
      const driverWs = mockWs();
      registry.registerApp("MyGame", appWs);
      registry.registerDriver("MyGame", driverWs);
      expect(registry.getPeer(driverWs)).toBe(appWs);
    });

    it("returns the driver when given the app", () => {
      const appWs = mockWs();
      const driverWs = mockWs();
      registry.registerApp("MyGame", appWs);
      registry.registerDriver("MyGame", driverWs);
      expect(registry.getPeer(appWs)).toBe(driverWs);
    });

    it("returns undefined for an unknown socket", () => {
      expect(registry.getPeer(mockWs())).toBeUndefined();
    });
  });

  // --- connectedApps / connectedDrivers ---

  describe("connectedApps / connectedDrivers", () => {
    it("returns metadata for all connected apps", () => {
      registry.registerApp("Game1", mockWs(), { platform: "Android", platformVersion: "14", deviceInstanceId: "abc" });
      registry.registerApp("Game2", mockWs(), { platform: "iOS", platformVersion: "17", deviceInstanceId: "xyz" });
      expect(registry.connectedApps()).toHaveLength(2);
    });

    it("returns metadata for all connected drivers", () => {
      registry.registerApp("MyGame", mockWs());
      registry.registerDriver("MyGame", mockWs(), { driverType: "SDK", platform: "unknown", platformVersion: "unknown", deviceInstanceId: "d1" });
      expect(registry.connectedDrivers()).toHaveLength(1);
    });
  });

  // --- hasApp / isPaired ---

  describe("hasApp / isPaired", () => {
    it("hasApp returns true after registerApp", () => {
      registry.registerApp("MyGame", mockWs());
      expect(registry.hasApp("MyGame")).toBe(true);
    });

    it("hasApp returns false for unknown appName", () => {
      expect(registry.hasApp("Unknown")).toBe(false);
    });

    it("isPaired returns true after successful registerDriver", () => {
      registry.registerApp("MyGame", mockWs());
      registry.registerDriver("MyGame", mockWs());
      expect(registry.isPaired("MyGame")).toBe(true);
    });

    it("isPaired returns false before a driver connects", () => {
      registry.registerApp("MyGame", mockWs());
      expect(registry.isPaired("MyGame")).toBe(false);
    });
  });
});

// --- helpers ---

function mockWs(): WsConn {
  return { send: () => {}, close: () => {}, readyState: 1 } as WsConn;
}
