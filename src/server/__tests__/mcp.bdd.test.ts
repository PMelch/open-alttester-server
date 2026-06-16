/**
 * BDD tests for the embedded MCP endpoint.
 */
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { createUiTesterServer, type UiTesterServer } from "../server";

describe("Feature: Embedded MCP server", () => {
  let srv: UiTesterServer;

  beforeEach(async () => {
    srv = await createUiTesterServer({ port: 0 });
  });

  afterEach(() => {
    srv.stop();
  });

  describe("Scenario: MCP starts with a configured access policy", () => {
    it("Given startup MCP config for all apps / When dashboard state is read / Then MCP is already enabled", async () => {
      srv.stop();
      srv = await createUiTesterServer({ port: 0, mcp: { mode: "all" } });

      const state = await fetch(`http://127.0.0.1:${srv.port}/dashboard/state`).then((r) => r.json()) as {
        mcp: { mode: string; enabledApps: string[]; activeSessions: number };
      };
      expect(state.mcp).toEqual({ mode: "all", enabledApps: [], activeSessions: 0 });

      const init = await mcpPost(srv.port, {
        jsonrpc: "2.0",
        id: 1,
        method: "initialize",
        params: { protocolVersion: "2025-11-25", capabilities: {}, clientInfo: { name: "test", version: "1" } },
      });
      expect(init.status).toBe(200);
    });

    it("Given startup MCP config for one app / When dashboard state is read / Then that app is enabled", async () => {
      srv.stop();
      srv = await createUiTesterServer({
        port: 0,
        mcp: { mode: "selected", enabledApps: ["StartupGame"] },
      });

      const state = await fetch(`http://127.0.0.1:${srv.port}/dashboard/state`).then((r) => r.json()) as {
        mcp: { mode: string; enabledApps: string[] };
      };
      expect(state.mcp).toEqual({
        mode: "selected",
        enabledApps: ["StartupGame"],
        activeSessions: 0,
      });
    });
  });

  describe("Scenario: MCP is disabled by default", () => {
    it("Given a fresh server / When an MCP initialize request is sent / Then the endpoint is unavailable", async () => {
      const res = await mcpPost(srv.port, {
        jsonrpc: "2.0",
        id: 1,
        method: "initialize",
        params: { protocolVersion: "2025-11-25", capabilities: {}, clientInfo: { name: "test", version: "1" } },
      });

      expect(res.status).toBe(404);
    });
  });

  describe("Scenario: Dashboard controls MCP selected-app mode", () => {
    it("Given MCP is off / When the dashboard enables one app / Then dashboard state exposes selected-app MCP config", async () => {
      const update = await fetch(`http://127.0.0.1:${srv.port}/dashboard/mcp`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode: "selected", enabledApps: ["McpGame"] }),
      });

      expect(update.status).toBe(200);
      const body = await update.json() as { mcp: { mode: string; enabledApps: string[]; activeSessions: number } };
      expect(body.mcp).toEqual({ mode: "selected", enabledApps: ["McpGame"], activeSessions: 0 });

      const state = await fetch(`http://127.0.0.1:${srv.port}/dashboard/state`).then(r => r.json()) as {
        mcp: { mode: string; enabledApps: string[]; activeSessions: number };
      };
      expect(state.mcp).toEqual({ mode: "selected", enabledApps: ["McpGame"], activeSessions: 0 });
    });
  });

  describe("Scenario: MCP initializes and lists tools", () => {
    it("Given MCP is enabled / When initialize and tools/list are called / Then MCP returns tool capability and UiTester tools", async () => {
      await setMcp(srv.port, { mode: "all", enabledApps: [] });

      const init = await mcpJson(srv.port, {
        jsonrpc: "2.0",
        id: 1,
        method: "initialize",
        params: { protocolVersion: "2025-11-25", capabilities: {}, clientInfo: { name: "test-client", version: "1" } },
      });

      expect(init.result.protocolVersion).toBe("2025-11-25");
      expect(init.result.capabilities.tools).toEqual({ listChanged: false });
      expect(init.result.serverInfo.name).toBe("open-uitester-server");

      const listed = await mcpJson(srv.port, { jsonrpc: "2.0", id: 2, method: "tools/list", params: {} });
      const names = listed.result.tools.map((tool: { name: string }) => tool.name);
      expect(names).toEqual(expect.arrayContaining([
        "hierarchy.query",
        "scenes.query",
        "object.components",
        "component.fields",
        "commands.list",
        "command.invoke",
      ]));
    });
  });

  describe("Scenario: MCP tools query app-specific state", () => {
    it("Given an enabled app / When hierarchy and scenes tools are called / Then app-specific data is returned", async () => {
      await setMcp(srv.port, { mode: "selected", enabledApps: ["McpGame"] });
      const { app, close, received } = await connectMockApp(srv.port, "McpGame", {
        getAllLoadedScenes: ["Main", "Overlay"],
        getCurrentScene: { name: "Main" },
        findObjects: [{ id: 1, name: "Canvas", transformId: 10, transformParentId: 0 }],
      });

      const scenes = await callTool(srv.port, "scenes.query", { appName: "McpGame" });
      expect(scenes.result.isError).toBe(false);
      expect(scenes.result.structuredContent).toEqual({
        appName: "McpGame",
        scenes: ["Main", "Overlay"],
        currentScene: { name: "Main" },
      });

      const hierarchy = await callTool(srv.port, "hierarchy.query", { appName: "McpGame" });
      expect(hierarchy.result.isError).toBe(false);
      expect(hierarchy.result.structuredContent.objects).toEqual([
        { id: 1, name: "Canvas", transformId: 10, transformParentId: 0 },
      ]);
      const findObjects = received.find(msg => msg.commandName === "findObjects");
      expect(findObjects?.path).toBe("//*");
      expect(findObjects?.cameraPath).toBe("//");

      close();
      app.close();
    });
  });

  describe("Scenario: MCP tools inspect components and fields by object path", () => {
    it("Given an enabled app with a target object / When component tools are called / Then object path is resolved before component commands run", async () => {
      await setMcp(srv.port, { mode: "selected", enabledApps: ["McpGame"] });
      const altObject = { id: 42, name: "StartButton", transformId: 22, transformParentId: 20 };
      const components = [{ componentName: "UnityEngine.UI.Button", assemblyName: "UnityEngine.UI" }];
      const fields = [{ name: "m_Interactable", value: "True", type: "PRIMITIVE" }];
      const { app, close, received } = await connectMockApp(srv.port, "McpGame", {
        findObject: altObject,
        getAllComponents: components,
        getAllFields: fields,
      });

      const componentResult = await callTool(srv.port, "object.components", {
        appName: "McpGame",
        path: "//Canvas/MainMenuPanel/StartButton",
      });
      expect(componentResult.result.isError).toBe(false);
      expect(componentResult.result.structuredContent).toEqual({
        appName: "McpGame",
        path: "//Canvas/MainMenuPanel/StartButton",
        object: altObject,
        components,
      });

      const fieldsResult = await callTool(srv.port, "component.fields", {
        appName: "McpGame",
        path: "//Canvas/MainMenuPanel/StartButton",
        component: components[0],
      });
      expect(fieldsResult.result.isError).toBe(false);
      expect(fieldsResult.result.structuredContent.fields).toEqual(fields);

      const findObject = received.find(msg => msg.commandName === "findObject");
      expect(findObject?.path).toBe("//Canvas/MainMenuPanel/StartButton");
      expect(received.some(msg => msg.commandName === "getAllComponents" && msg.altObjectId === 42)).toBe(true);
      expect(received.some(msg =>
        msg.commandName === "getAllFields" &&
        msg.altObjectId === 42 &&
        msg.altFieldsSelections === "ALLFIELDS" &&
        (msg.altComponent as { componentName?: string })?.componentName === "UnityEngine.UI.Button",
      )).toBe(true);

      close();
      app.close();
    });
  });

  describe("Scenario: MCP exposes tester commands to AI agents", () => {
    it("Given an enabled app / When commands.list and command.invoke are called / Then known tester commands are listed and invoked", async () => {
      await setMcp(srv.port, { mode: "selected", enabledApps: ["McpGame"] });
      const { app, close, received } = await connectMockApp(srv.port, "McpGame", {
        getServerVersion: "2.1.0",
      });

      const listed = await callTool(srv.port, "commands.list", { appName: "McpGame" });
      expect(listed.result.structuredContent.commands).toEqual(expect.arrayContaining([
        "getCurrentScene",
        "getAllLoadedScenes",
        "getAllComponents",
        "getAllFields",
        "getServerVersion",
      ]));

      const invoked = await callTool(srv.port, "command.invoke", {
        appName: "McpGame",
        command: "getServerVersion",
        parameters: {},
      });
      expect(invoked.result.isError).toBe(false);
      expect(invoked.result.structuredContent.result).toBe("2.1.0");
      expect(received.some(msg => msg.commandName === "getServerVersion")).toBe(true);

      const state = await dashboardState(srv.port);
      const event = state.debug.commands.find(commandEvent => commandEvent.commandName === "getServerVersion");
      expect(event).toMatchObject({
        appName: "McpGame",
        toolName: "command.invoke",
        commandName: "getServerVersion",
        source: { type: "mcp", label: "MCP agent" },
        status: "ok",
      });
      expect(event?.responsePayload).toMatchObject({
        commandName: "getServerVersion",
        data: JSON.stringify("2.1.0"),
      });

      close();
      app.close();
    });
  });

  describe("Scenario: MCP enforces app-specific access", () => {
    it("Given selected-app mode / When a disabled app is queried / Then the tool call is rejected without reaching the app", async () => {
      await setMcp(srv.port, { mode: "selected", enabledApps: ["AllowedGame"] });
      const { app, close, received } = await connectMockApp(srv.port, "BlockedGame", {
        getAllLoadedScenes: ["ShouldNotBeRead"],
        getCurrentScene: { name: "ShouldNotBeRead" },
      });

      const result = await callTool(srv.port, "scenes.query", { appName: "BlockedGame" });
      expect(result.result.isError).toBe(true);
      expect(result.result.content[0].text).toContain("MCP is not enabled for app");
      expect(received).toHaveLength(0);

      close();
      app.close();
    });
  });

  describe("Scenario: MCP processes more than one app at the same time", () => {
    it("Given all-apps mode and two connected apps / When both apps are queried concurrently / Then each result comes from its target app", async () => {
      await setMcp(srv.port, { mode: "all", enabledApps: [] });
      const first = await connectMockApp(srv.port, "FirstGame", {
        getAllLoadedScenes: ["FirstScene"],
        getCurrentScene: { name: "FirstScene" },
      });
      const second = await connectMockApp(srv.port, "SecondGame", {
        getAllLoadedScenes: ["SecondScene"],
        getCurrentScene: { name: "SecondScene" },
      });

      const [firstResult, secondResult] = await Promise.all([
        callTool(srv.port, "scenes.query", { appName: "FirstGame" }),
        callTool(srv.port, "scenes.query", { appName: "SecondGame" }),
      ]);

      expect(firstResult.result.structuredContent.currentScene).toEqual({ name: "FirstScene" });
      expect(secondResult.result.structuredContent.currentScene).toEqual({ name: "SecondScene" });

      first.close();
      first.app.close();
      second.close();
      second.app.close();
    });
  });
});

type Json = Record<string, unknown>;
type RpcResponse = Json & {
  result: any;
};
type MockResponseMap = Record<string, unknown>;
type DebugState = {
  debug: {
    commands: Array<{
      appName: string;
      toolName?: string;
      commandName: string;
      source: { type: string; label: string };
      status: string;
      responsePayload?: Record<string, unknown>;
    }>;
  };
};

async function mcpPost(port: number, body: Json): Promise<Response> {
  return fetch(`http://127.0.0.1:${port}/mcp`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Accept": "application/json, text/event-stream",
      "MCP-Protocol-Version": "2025-11-25",
    },
    body: JSON.stringify(body),
  });
}

async function mcpJson(port: number, body: Json): Promise<RpcResponse> {
  const res = await mcpPost(port, body);
  expect(res.status).toBe(200);
  return await res.json() as RpcResponse;
}

async function callTool(port: number, name: string, args: Json): Promise<RpcResponse> {
  return mcpJson(port, {
    jsonrpc: "2.0",
    id: `${name}-${Date.now()}`,
    method: "tools/call",
    params: { name, arguments: args },
  });
}

async function setMcp(port: number, body: { mode: string; enabledApps: string[] }): Promise<void> {
  const res = await fetch(`http://127.0.0.1:${port}/dashboard/mcp`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  expect(res.status).toBe(200);
}

async function dashboardState(port: number): Promise<DebugState> {
  const res = await fetch(`http://127.0.0.1:${port}/dashboard/state`);
  expect(res.status).toBe(200);
  return await res.json() as DebugState;
}

function appUrl(port: number, appName: string): string {
  return `ws://127.0.0.1:${port}/altws/app?appName=${appName}&platform=Editor&platformVersion=6000&deviceInstanceId=app-1&driverType=SDK`;
}

function wsOpen(ws: WebSocket): Promise<void> {
  return new Promise((resolve, reject) => {
    if (ws.readyState === WebSocket.OPEN) return resolve();
    ws.onopen = () => resolve();
    ws.onerror = (e) => reject(e);
  });
}

async function connectMockApp(
  port: number,
  appName: string,
  responses: MockResponseMap,
): Promise<{ app: WebSocket; close: () => void; received: Json[] }> {
  const app = new WebSocket(appUrl(port, appName));
  const received: Json[] = [];
  await wsOpen(app);

  const handler = (e: MessageEvent) => {
    try {
      const msg = JSON.parse(e.data as string) as { commandName: string; messageId: string };
      if (msg.commandName === "AppId") return;
      received.push(msg as unknown as Json);
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
    received,
    close: () => app.removeEventListener("message", handler),
  };
}
