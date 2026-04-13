export const enum CloseCode {
  NoAppConnected = 4001,
  AppDisconnected = 4002,
  MultipleDrivers = 4005,
  MultipleDriversTrying = 4007,
}

export const enum ClientRole {
  App = "app",
  Driver = "driver",
}

/** Minimal interface satisfied by BunWsHandle, NodeWsHandle, and mock sockets (tests). */
export interface WsConn {
  send(data: string | ArrayBuffer | ArrayBufferView): void;
  close(code?: number, reason?: string): void;
  readonly readyState: number;
}

export interface AppMeta {
  appName: string;
  platform: string;
  platformVersion: string;
  deviceInstanceId: string;
  appId?: string;
  connectedAt: number;
}

export interface DriverMeta {
  appName: string;
  driverType: string;
  platform: string;
  platformVersion: string;
  deviceInstanceId: string;
  connectedAt: number;
  paired: boolean;
}

export class ConnectionRegistry {
  private apps = new Map<string, WsConn>();
  private appMeta = new Map<WsConn, AppMeta>();
  private drivers = new Map<string, WsConn>();
  private pendingDrivers = new Map<string, WsConn>();
  private driverMeta = new Map<WsConn, DriverMeta>();
  private peers = new Map<WsConn, WsConn>();

  registerApp(
    appName: string,
    ws: WsConn,
    meta: Partial<Omit<AppMeta, "appName" | "connectedAt">> = {},
  ): void {
    // R1-1: clean up any previous registration for this appName before re-registering
    const existing = this.apps.get(appName);
    if (existing) {
      this.removeApp(existing);
    }

    this.apps.set(appName, ws);
    this.appMeta.set(ws, {
      appName,
      platform: meta.platform ?? "unknown",
      platformVersion: meta.platformVersion ?? "unknown",
      deviceInstanceId: meta.deviceInstanceId ?? "unknown",
      appId: meta.appId,
      connectedAt: Date.now(),
    });
  }

  getApp(appName: string): WsConn | undefined {
    return this.apps.get(appName);
  }

  hasApp(appName: string): boolean {
    return this.apps.has(appName);
  }

  isPaired(appName: string): boolean {
    return this.drivers.has(appName);
  }

  registerDriver(
    appName: string,
    ws: WsConn,
    meta: Partial<Omit<DriverMeta, "appName" | "connectedAt" | "paired">> = {},
  ): "paired" | CloseCode {
    const appWs = this.apps.get(appName);
    if (!appWs) return CloseCode.NoAppConnected;
    if (this.drivers.has(appName)) return CloseCode.MultipleDrivers;
    if (this.pendingDrivers.has(appName)) return CloseCode.MultipleDriversTrying;

    this.drivers.set(appName, ws);
    this.driverMeta.set(ws, {
      appName,
      driverType: meta.driverType ?? "unknown",
      platform: meta.platform ?? "unknown",
      platformVersion: meta.platformVersion ?? "unknown",
      deviceInstanceId: meta.deviceInstanceId ?? "unknown",
      connectedAt: Date.now(),
      paired: true,
    });
    this.peers.set(ws, appWs);
    this.peers.set(appWs, ws);
    return "paired";
  }

  markDriverPending(appName: string, ws: WsConn): void {
    this.pendingDrivers.set(appName, ws);
  }

  clearDriverPending(appName: string): void {
    this.pendingDrivers.delete(appName);
  }

  /** Remove an app and all associated state. Returns the paired driver (if any). */
  removeApp(ws: WsConn): WsConn | undefined {
    const meta = this.appMeta.get(ws);
    if (!meta) return undefined;
    const { appName } = meta;
    this.apps.delete(appName);
    this.appMeta.delete(ws);
    const driverWs = this.drivers.get(appName);
    if (driverWs) {
      this.drivers.delete(appName);
      this.driverMeta.delete(driverWs);
      this.peers.delete(driverWs);
    }
    this.peers.delete(ws);
    return driverWs;
  }

  /** Remove a driver. Returns the paired app (if any) so the caller can notify it. */
  removeDriver(ws: WsConn): WsConn | undefined {
    const meta = this.driverMeta.get(ws);
    if (!meta) return undefined;
    const { appName } = meta;
    this.drivers.delete(appName);
    this.driverMeta.delete(ws);
    const appWs = this.peers.get(ws);
    if (appWs) this.peers.delete(appWs);
    this.peers.delete(ws);
    return appWs;
  }

  getPairedApp(driverWs: WsConn): WsConn | undefined {
    return this.peers.get(driverWs);
  }

  getPairedDriver(appWs: WsConn): WsConn | undefined {
    return this.peers.get(appWs);
  }

  getPeer(ws: WsConn): WsConn | undefined {
    return this.peers.get(ws);
  }

  getRole(ws: WsConn): ClientRole | undefined {
    if (this.appMeta.has(ws)) return ClientRole.App;
    if (this.driverMeta.has(ws)) return ClientRole.Driver;
    return undefined;
  }

  connectedApps(): AppMeta[] {
    return Array.from(this.appMeta.values());
  }

  connectedDrivers(): DriverMeta[] {
    return Array.from(this.driverMeta.values());
  }
}
