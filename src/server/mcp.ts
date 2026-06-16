import type { InspectorService } from "./inspector";
import type { ConnectionRegistry, WsConn } from "./registry";
import type { CommandDebugLog } from "./debug";
import { MCP_DEBUG_SOURCE } from "./debug";

export type McpMode = "off" | "selected" | "all";

export interface McpState {
  mode: McpMode;
  enabledApps: string[];
  activeSessions: number;
}

export interface McpConfigUpdate {
  mode?: McpMode;
  enabledApps?: string[];
}

interface JsonRpcRequest {
  jsonrpc: "2.0";
  id?: string | number | null;
  method?: string;
  params?: Record<string, unknown>;
}

interface ToolDefinition {
  name: string;
  title: string;
  description: string;
  inputSchema: Record<string, unknown>;
}

const PROTOCOL_VERSION = "2025-11-25";

export const TESTER_COMMANDS = [
  "activateNotification",
  "beginTouch",
  "callComponentMethodForObject",
  "clickCoordinates",
  "clickElement",
  "deactivateNotification",
  "deleteKeyPlayerPref",
  "deletePlayerPrefs",
  "deletePlayerPref",
  "endTouch",
  "findObject",
  "findObjectAtCoordinates",
  "findObjects",
  "findObjectsLight",
  "findObjectsWhichContains",
  "findObjectWhichContains",
  "getAllActiveCameras",
  "getAllCameras",
  "getAllComponents",
  "getAllFields",
  "getAllLoadedScenes",
  "getAllLoadedScenesAndObjects",
  "getAllMethods",
  "getAllProperties",
  "getAllScenes",
  "getApplicationScreenSize",
  "getCurrentScene",
  "getKeyPlayerPref",
  "getObjectComponentProperty",
  "getPNGScreenshot",
  "getServerVersion",
  "getText",
  "getTimeScale",
  "getVisualElementProperty",
  "keysDown",
  "keysUp",
  "loadScene",
  "moveMouse",
  "moveTouch",
  "multipointSwipe",
  "pointerDownFromObject",
  "pointerEnterObject",
  "pointerExitObject",
  "pointerUpFromObject",
  "pressKeyboardKeys",
  "resetInput",
  "scroll",
  "setKeyPlayerPref",
  "setObjectComponentProperty",
  "setServerLogging",
  "setText",
  "setTimeScale",
  "swipe",
  "tapCoordinates",
  "tapElement",
  "tilt",
  "unloadScene",
] as const;

const TOOLS: ToolDefinition[] = [
  {
    name: "hierarchy.query",
    title: "Query Object Hierarchy",
    description: "Return the current UiTester object hierarchy for a connected app.",
    inputSchema: objectSchema({
      appName: { type: "string", description: "Connected appName to query." },
      enabled: { type: "boolean", description: "Whether to include enabled objects only. Defaults to true." },
    }, ["appName"]),
  },
  {
    name: "scenes.query",
    title: "Query Scenes",
    description: "Return the current scene and all loaded scenes for a connected app.",
    inputSchema: objectSchema({
      appName: { type: "string", description: "Connected appName to query." },
    }, ["appName"]),
  },
  {
    name: "object.components",
    title: "Query Object Components",
    description: "Resolve an object by UiTester path and return all components attached to it.",
    inputSchema: objectSchema({
      appName: { type: "string" },
      path: { type: "string", description: "UiTester path, for example //Canvas/Button." },
    }, ["appName", "path"]),
  },
  {
    name: "component.fields",
    title: "Query Component Fields",
    description: "Resolve an object by path and return fields for the given component.",
    inputSchema: objectSchema({
      appName: { type: "string" },
      path: { type: "string" },
      component: {
        type: "object",
        properties: {
          componentName: { type: "string" },
          assemblyName: { type: "string" },
        },
        required: ["componentName", "assemblyName"],
      },
    }, ["appName", "path", "component"]),
  },
  {
    name: "commands.list",
    title: "List Tester Commands",
    description: "List UiTester commands exposed through command.invoke.",
    inputSchema: objectSchema({
      appName: { type: "string", description: "Connected appName. Used for app-specific access checks." },
    }, ["appName"]),
  },
  {
    name: "command.invoke",
    title: "Invoke Tester Command",
    description: "Invoke an available UiTester command for a connected app.",
    inputSchema: objectSchema({
      appName: { type: "string" },
      command: { type: "string", enum: TESTER_COMMANDS },
      parameters: { type: "object", description: "Flat UiTester command parameters." },
    }, ["appName", "command"]),
  },
];

export class McpService {
  private mode: McpMode = "off";
  private enabledApps = new Set<string>();
  private activeSessions = 0;

  constructor(
    private readonly registry: ConnectionRegistry,
    private readonly inspector: InspectorService,
    private readonly debug: CommandDebugLog,
    private readonly version = "unknown",
  ) {}

  state(): McpState {
    return {
      mode: this.mode,
      enabledApps: Array.from(this.enabledApps).sort(),
      activeSessions: this.activeSessions,
    };
  }

  updateConfig(update: McpConfigUpdate): McpState {
    if (update.mode !== undefined) {
      if (!isMcpMode(update.mode)) {
        throw new Error(`Invalid MCP mode "${String(update.mode)}"`);
      }
      this.mode = update.mode;
    }

    if (update.enabledApps !== undefined) {
      if (!Array.isArray(update.enabledApps) || !update.enabledApps.every(isNonEmptyString)) {
        throw new Error("enabledApps must be an array of appName strings");
      }
      this.enabledApps = new Set(update.enabledApps);
    }

    if (this.mode === "off") {
      this.enabledApps.clear();
    }

    return this.state();
  }

  isEnabled(): boolean {
    return this.mode !== "off";
  }

  isAppEnabled(appName: string): boolean {
    if (this.mode === "all") return this.registry.hasApp(appName);
    if (this.mode === "selected") return this.enabledApps.has(appName);
    return false;
  }

  async handleRequest(req: Request): Promise<Response | null> {
    const url = new URL(req.url);
    if (url.pathname !== "/mcp") return null;

    if (!this.isEnabled()) {
      return new Response("MCP server is disabled", { status: 404 });
    }

    if (!this.isAllowedOrigin(req)) {
      return this.jsonRpcError(null, -32000, "Invalid Origin", 403);
    }

    if (req.method === "GET") {
      return new Response("SSE stream is not supported", {
        status: 405,
        headers: { "Allow": "POST" },
      });
    }

    if (req.method !== "POST") {
      return new Response("Method not allowed", {
        status: 405,
        headers: { "Allow": "POST" },
      });
    }

    let message: JsonRpcRequest;
    try {
      message = await req.json() as JsonRpcRequest;
    } catch {
      return this.jsonRpcError(null, -32700, "Parse error", 400);
    }

    if (message.jsonrpc !== "2.0" || typeof message.method !== "string") {
      return this.jsonRpcError(message.id ?? null, -32600, "Invalid Request", 400);
    }

    if (message.id === undefined || message.id === null) {
      return new Response(null, { status: 202 });
    }

    try {
      const result = await this.handleJsonRpc(message);
      return jsonResponse({ jsonrpc: "2.0", id: message.id, result });
    } catch (err) {
      if (err instanceof McpMethodNotFoundError) {
        return this.jsonRpcError(message.id, -32601, err.message, 200);
      }
      const messageText = err instanceof Error ? err.message : String(err);
      return this.jsonRpcError(message.id, -32603, messageText, 200);
    }
  }

  private async handleJsonRpc(message: JsonRpcRequest): Promise<unknown> {
    switch (message.method) {
      case "initialize":
        this.activeSessions += 1;
        return {
          protocolVersion: PROTOCOL_VERSION,
          capabilities: { tools: { listChanged: false } },
          serverInfo: { name: "open-uitester-server", version: this.version },
        };
      case "tools/list":
        return { tools: TOOLS };
      case "tools/call":
        return this.callTool(message.params ?? {});
      case "ping":
        return {};
      default:
        throw new McpMethodNotFoundError(`Unsupported MCP method "${message.method}"`);
    }
  }

  private async callTool(params: Record<string, unknown>): Promise<unknown> {
    const name = params.name;
    const args = isRecord(params.arguments) ? params.arguments : {};
    if (typeof name !== "string") {
      return toolError("tools/call requires a string tool name");
    }

    try {
      switch (name) {
        case "hierarchy.query":
          return toolOk(await this.queryHierarchy(args, name));
        case "scenes.query":
          return toolOk(await this.queryScenes(args, name));
        case "object.components":
          return toolOk(await this.queryComponents(args, name));
        case "component.fields":
          return toolOk(await this.queryFields(args, name));
        case "commands.list":
          return toolOk(await this.listCommands(args, name));
        case "command.invoke":
          return toolOk(await this.invokeCommand(args, name));
        default:
          return toolError(`Unknown MCP tool "${name}"`);
      }
    } catch (err) {
      const messageText = err instanceof Error ? err.message : String(err);
      return toolError(messageText);
    }
  }

  private async queryHierarchy(args: Record<string, unknown>, toolName: string): Promise<Record<string, unknown>> {
    const { appName, appWs } = this.resolveApp(args);
    const enabled = args.enabled !== false;
    const objects = await this.sendMcpCommand(appName, appWs, toolName, "findObjects", findParams("//*", enabled), 10_000);
    return { appName, objects };
  }

  private async queryScenes(args: Record<string, unknown>, toolName: string): Promise<Record<string, unknown>> {
    const { appName, appWs } = this.resolveApp(args);
    const [rawScenes, currentScene] = await Promise.all([
      this.sendMcpCommand(appName, appWs, toolName, "getAllLoadedScenes", {}),
      this.sendMcpCommand(appName, appWs, toolName, "getCurrentScene", {}),
    ]);
    const scenes = Array.isArray(rawScenes) ? rawScenes : rawScenes != null ? [rawScenes] : [];
    return { appName, scenes, currentScene };
  }

  private async queryComponents(args: Record<string, unknown>, toolName: string): Promise<Record<string, unknown>> {
    const { appName, appWs } = this.resolveApp(args);
    const path = requiredString(args, "path");
    const object = await this.findObject(appName, appWs, path, toolName);
    const altObjectId = objectId(object);
    const components = await this.sendMcpCommand(appName, appWs, toolName, "getAllComponents", { altObjectId });
    return { appName, path, object, components };
  }

  private async queryFields(args: Record<string, unknown>, toolName: string): Promise<Record<string, unknown>> {
    const { appName, appWs } = this.resolveApp(args);
    const path = requiredString(args, "path");
    const component = componentArg(args.component);
    const object = await this.findObject(appName, appWs, path, toolName);
    const altObjectId = objectId(object);
    const fields = await this.sendMcpCommand(appName, appWs, toolName, "getAllFields", {
      altObjectId,
      altComponent: component,
      altFieldsSelections: "ALLFIELDS",
    });
    return { appName, path, object, component, fields };
  }

  private async listCommands(args: Record<string, unknown>, toolName: string): Promise<Record<string, unknown>> {
    const { appName } = this.resolveApp(args);
    const request = this.debug.recordRequest({
      appName,
      source: MCP_DEBUG_SOURCE,
      commandName: toolName,
      toolName,
      requestPayload: { toolName, arguments: args },
    });
    const result = { appName, commands: [...TESTER_COMMANDS] };
    this.debug.recordCompletion(request.id, { status: "ok", durationMs: 0, responsePayload: result });
    return result;
  }

  private async invokeCommand(args: Record<string, unknown>, toolName: string): Promise<Record<string, unknown>> {
    const { appName, appWs } = this.resolveApp(args);
    const command = requiredString(args, "command");
    if (!TESTER_COMMANDS.includes(command as (typeof TESTER_COMMANDS)[number])) {
      throw new Error(`Command "${command}" is not in the known tester command list`);
    }
    const parameters = isRecord(args.parameters) ? args.parameters : {};
    const result = await this.sendMcpCommand(appName, appWs, toolName, command, parameters);
    return { appName, command, result };
  }

  private async findObject(appName: string, appWs: WsConn, path: string, toolName: string): Promise<unknown> {
    return this.sendMcpCommand(appName, appWs, toolName, "findObject", findParams(path, true), 10_000);
  }

  private sendMcpCommand(
    appName: string,
    appWs: WsConn,
    toolName: string,
    command: string,
    parameters: Record<string, unknown> = {},
    timeoutMs = 5000,
  ): Promise<unknown> {
    return this.inspector.send(appWs, command, parameters, timeoutMs, {
      debug: this.debug,
      appName,
      source: MCP_DEBUG_SOURCE,
      toolName,
    });
  }

  private resolveApp(args: Record<string, unknown>): { appName: string; appWs: WsConn } {
    const appName = requiredString(args, "appName");
    if (!this.isAppEnabled(appName)) {
      throw new Error(`MCP is not enabled for app "${appName}"`);
    }
    const appWs = this.registry.getApp(appName);
    if (!appWs) {
      throw new Error(`No app connected with appName "${appName}"`);
    }
    return { appName, appWs };
  }

  private isAllowedOrigin(req: Request): boolean {
    const origin = req.headers.get("origin");
    if (!origin) return true;
    try {
      const originUrl = new URL(origin);
      const requestUrl = new URL(req.url);
      return originUrl.host === requestUrl.host;
    } catch {
      return false;
    }
  }

  private jsonRpcError(id: string | number | null, code: number, message: string, status: number): Response {
    return jsonResponse({ jsonrpc: "2.0", id, error: { code, message } }, status);
  }
}

class McpMethodNotFoundError extends Error {}

function objectSchema(properties: Record<string, unknown>, required: string[]): Record<string, unknown> {
  return { type: "object", properties, required, additionalProperties: false };
}

function findParams(path: string, enabled: boolean): Record<string, unknown> {
  return {
    path,
    cameraBy: "NAME",
    cameraPath: "//",
    enabled,
  };
}

function toolOk(data: unknown): Record<string, unknown> {
  return {
    content: [{ type: "text", text: JSON.stringify(data, null, 2) }],
    structuredContent: data,
    isError: false,
  };
}

function toolError(message: string): Record<string, unknown> {
  return {
    content: [{ type: "text", text: message }],
    isError: true,
  };
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8" },
  });
}

function isMcpMode(value: unknown): value is McpMode {
  return value === "off" || value === "selected" || value === "all";
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function requiredString(args: Record<string, unknown>, key: string): string {
  const value = args[key];
  if (!isNonEmptyString(value)) {
    throw new Error(`Missing required string argument "${key}"`);
  }
  return value;
}

function objectId(object: unknown): number {
  if (!isRecord(object) || typeof object.id !== "number") {
    throw new Error("Resolved object did not include a numeric id");
  }
  return object.id;
}

function componentArg(value: unknown): { componentName: string; assemblyName: string } {
  if (!isRecord(value)) {
    throw new Error("Missing required component argument");
  }
  const componentName = value.componentName;
  const assemblyName = value.assemblyName;
  if (!isNonEmptyString(componentName) || !isNonEmptyString(assemblyName)) {
    throw new Error("component must include componentName and assemblyName strings");
  }
  return { componentName, assemblyName };
}
