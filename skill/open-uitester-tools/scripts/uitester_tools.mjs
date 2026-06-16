#!/usr/bin/env node
import WebSocket from "ws";

const SERVER_NAME = "open-uitester-server";
const SKILL_DRIVER_TYPE = "codex_skill";
const PROTOCOL_VERSION = "2025-11-25";
const DEFAULT_TIMEOUT_MS = 10_000;
const DEFAULT_SERVER_URL = "http://127.0.0.1:13000";

const TESTER_COMMANDS = [
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
];

const TOOL_DEFINITIONS = [
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

function usage() {
  console.log(`Usage:
  node skill/open-uitester-tools/scripts/uitester_tools.mjs [--server-url URL] initialize
  node skill/open-uitester-tools/scripts/uitester_tools.mjs [--server-url URL] [--timeout MS] state
  node skill/open-uitester-tools/scripts/uitester_tools.mjs [--server-url URL] tools
  node skill/open-uitester-tools/scripts/uitester_tools.mjs [--server-url URL] call <tool-name> <json-arguments>
  node skill/open-uitester-tools/scripts/uitester_tools.mjs [--server-url URL] invoke <appName> <command> [json-parameters]

Examples:
  node skill/open-uitester-tools/scripts/uitester_tools.mjs state
  node skill/open-uitester-tools/scripts/uitester_tools.mjs call scenes.query '{"appName":"__default__"}'
  node skill/open-uitester-tools/scripts/uitester_tools.mjs invoke __default__ getAllScenes '{}'
`);
}

function parseArgs(argv) {
  const args = { timeoutMs: DEFAULT_TIMEOUT_MS, positional: [] };
  for (let i = 0; i < argv.length; i += 1) {
    const value = argv[i];
    if (value === "--help" || value === "-h") {
      args.help = true;
    } else if (value === "--server-url") {
      args.serverUrl = argv[++i];
    } else if (value === "--timeout") {
      args.timeoutMs = Number(argv[++i]);
    } else {
      args.positional.push(value);
    }
  }
  return args;
}

function serverOrigin(inputUrl = process.env.OPEN_UITESTER_SERVER_URL || DEFAULT_SERVER_URL) {
  const url = new URL(inputUrl);
  url.pathname = "/";
  url.search = "";
  url.hash = "";
  return url;
}

function objectSchema(properties, required) {
  return { type: "object", properties, required, additionalProperties: false };
}

function dashboardUrl(origin) {
  const url = new URL(origin);
  url.pathname = "/dashboard/state";
  return url;
}

function driverUrl(origin, appName) {
  const url = new URL(origin);
  url.protocol = url.protocol === "https:" ? "wss:" : "ws:";
  url.pathname = "/altws";
  url.search = new URLSearchParams({
    appName,
    platform: "unknown",
    platformVersion: "unknown",
    deviceInstanceId: `codex-skill-${Date.now()}`,
    driverType: SKILL_DRIVER_TYPE,
  }).toString();
  return url;
}

async function fetchJson(url, timeoutMs) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, { signal: controller.signal, headers: { Accept: "application/json" } });
    const text = await response.text();
    if (!response.ok) throw new Error(`HTTP ${response.status}: ${text}`);
    return JSON.parse(text);
  } finally {
    clearTimeout(timer);
  }
}

class UiTesterDriver {
  constructor(origin, appName, timeoutMs) {
    this.origin = origin;
    this.appName = appName;
    this.timeoutMs = timeoutMs;
    this.counter = 0;
    this.pending = new Map();
  }

  connect() {
    return new Promise((resolve, reject) => {
      const ws = new WebSocket(driverUrl(this.origin, this.appName));
      this.ws = ws;
      const timer = setTimeout(() => {
        ws.close();
        reject(new Error(`Timed out waiting for driverRegistered for app "${this.appName}"`));
      }, this.timeoutMs);

      ws.on("message", (raw) => this.handleMessage(String(raw), resolve, timer));
      ws.on("close", (code, reason) => {
        const text = reason?.toString() || closeReason(code);
        const error = new Error(`Driver WebSocket closed (${code}): ${text}`);
        for (const pending of this.pending.values()) pending.reject(error);
        this.pending.clear();
        clearTimeout(timer);
        if (code !== 1000 && code !== 1005) reject(error);
      });
      ws.on("error", (error) => {
        clearTimeout(timer);
        reject(error);
      });
    });
  }

  handleMessage(raw, resolveConnect, connectTimer) {
    let message;
    try {
      message = JSON.parse(raw);
    } catch {
      return;
    }
    if (message.commandName === "driverRegistered" || raw.includes("driverRegistered")) {
      clearTimeout(connectTimer);
      resolveConnect();
      return;
    }
    const pending = this.pending.get(message.messageId);
    if (!pending) return;
    clearTimeout(pending.timer);
    this.pending.delete(message.messageId);
    if (message.error) {
      const error = new Error(message.error.message || "UiTester command failed");
      error.unityTrace = message.error.trace;
      pending.reject(error);
      return;
    }
    if (message.data === undefined || message.data === null) {
      pending.resolve(null);
      return;
    }
    try {
      pending.resolve(typeof message.data === "string" ? JSON.parse(message.data) : message.data);
    } catch (error) {
      pending.reject(error);
    }
  }

  send(command, parameters = {}, timeoutMs = this.timeoutMs) {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      throw new Error("Driver WebSocket is not open");
    }
    const messageId = `codex-skill-${++this.counter}`;
    const payload = JSON.stringify({ commandName: command, messageId, ...parameters });
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(messageId);
        reject(new Error(`UiTester command "${command}" timed out`));
      }, timeoutMs);
      this.pending.set(messageId, { resolve, reject, timer });
      this.ws.send(payload);
    });
  }

  close() {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) this.ws.close(1000, "done");
  }
}

function closeReason(code) {
  const reasons = {
    4001: "No app connected with that appName.",
    4002: "App disconnected.",
    4005: "A driver is already connected to that app.",
    4007: "Another driver is trying to connect to that app.",
    4009: "Too many drivers connected.",
  };
  return reasons[code] || "";
}

function findParams(path, enabled) {
  return {
    path,
    cameraBy: "NAME",
    cameraPath: "//",
    enabled,
  };
}

function requireString(args, key) {
  const value = args?.[key];
  if (typeof value !== "string" || value.trim() === "") throw new Error(`Missing required string argument "${key}"`);
  return value;
}

function objectId(object) {
  if (!object || typeof object.id !== "number") throw new Error("Resolved object did not include a numeric id");
  return object.id;
}

function componentArg(value) {
  if (!value || typeof value !== "object") throw new Error("Missing required component argument");
  const { componentName, assemblyName } = value;
  if (typeof componentName !== "string" || typeof assemblyName !== "string") {
    throw new Error("component must include componentName and assemblyName strings");
  }
  return { componentName, assemblyName };
}

function toolOk(data) {
  return {
    content: [{ type: "text", text: JSON.stringify(data, null, 2) }],
    structuredContent: data,
    isError: false,
  };
}

function toolError(error) {
  return {
    content: [{ type: "text", text: error instanceof Error ? error.message : String(error) }],
    isError: true,
  };
}

async function withDriver(origin, appName, timeoutMs, fn) {
  const driver = new UiTesterDriver(origin, appName, timeoutMs);
  await driver.connect();
  try {
    return await fn(driver);
  } finally {
    driver.close();
  }
}

async function ensureAppConnected(origin, appName, timeoutMs) {
  const state = await fetchJson(dashboardUrl(origin), timeoutMs);
  if (!Array.isArray(state.apps) || !state.apps.some((app) => app.appName === appName)) {
    throw new Error(`No app connected with appName "${appName}"`);
  }
}

async function callClonedTool(origin, name, args, timeoutMs) {
  try {
    switch (name) {
      case "hierarchy.query":
        return toolOk(await queryHierarchy(origin, args, timeoutMs));
      case "scenes.query":
        return toolOk(await queryScenes(origin, args, timeoutMs));
      case "object.components":
        return toolOk(await queryComponents(origin, args, timeoutMs));
      case "component.fields":
        return toolOk(await queryFields(origin, args, timeoutMs));
      case "commands.list":
        return toolOk(await listCommands(origin, args, timeoutMs));
      case "command.invoke":
        return toolOk(await invokeCommand(origin, args, timeoutMs));
      default:
        return toolError(`Unknown Open UITester skill tool "${name}"`);
    }
  } catch (error) {
    return toolError(error);
  }
}

async function queryHierarchy(origin, args, timeoutMs) {
  const appName = requireString(args, "appName");
  const enabled = args.enabled !== false;
  return withDriver(origin, appName, timeoutMs, async (driver) => ({
    appName,
    objects: await driver.send("findObjects", findParams("//*", enabled), timeoutMs),
  }));
}

async function queryScenes(origin, args, timeoutMs) {
  const appName = requireString(args, "appName");
  return withDriver(origin, appName, timeoutMs, async (driver) => {
    const [rawScenes, currentScene] = await Promise.all([
      driver.send("getAllLoadedScenes", {}, timeoutMs),
      driver.send("getCurrentScene", {}, timeoutMs),
    ]);
    const scenes = Array.isArray(rawScenes) ? rawScenes : rawScenes != null ? [rawScenes] : [];
    return { appName, scenes, currentScene };
  });
}

async function queryComponents(origin, args, timeoutMs) {
  const appName = requireString(args, "appName");
  const path = requireString(args, "path");
  return withDriver(origin, appName, timeoutMs, async (driver) => {
    const object = await driver.send("findObject", findParams(path, true), timeoutMs);
    const components = await driver.send("getAllComponents", { altObjectId: objectId(object) }, timeoutMs);
    return { appName, path, object, components };
  });
}

async function queryFields(origin, args, timeoutMs) {
  const appName = requireString(args, "appName");
  const path = requireString(args, "path");
  const component = componentArg(args.component);
  return withDriver(origin, appName, timeoutMs, async (driver) => {
    const object = await driver.send("findObject", findParams(path, true), timeoutMs);
    const fields = await driver.send("getAllFields", {
      altObjectId: objectId(object),
      altComponent: component,
      altFieldsSelections: "ALLFIELDS",
    }, timeoutMs);
    return { appName, path, object, component, fields };
  });
}

async function listCommands(origin, args, timeoutMs) {
  const appName = requireString(args, "appName");
  await ensureAppConnected(origin, appName, timeoutMs);
  return { appName, commands: [...TESTER_COMMANDS] };
}

async function invokeCommand(origin, args, timeoutMs) {
  const appName = requireString(args, "appName");
  const command = requireString(args, "command");
  if (!TESTER_COMMANDS.includes(command)) throw new Error(`Command "${command}" is not in the known tester command list`);
  const parameters = args.parameters && typeof args.parameters === "object" && !Array.isArray(args.parameters) ? args.parameters : {};
  return withDriver(origin, appName, timeoutMs, async (driver) => ({
    appName,
    command,
    result: await driver.send(command, parameters, timeoutMs),
  }));
}

function parseJson(value, fallback = undefined) {
  if (value === undefined) return fallback;
  try {
    return JSON.parse(value);
  } catch (error) {
    throw new Error(`Invalid JSON argument: ${error.message}`);
  }
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help || args.positional.length === 0) {
    usage();
    return 0;
  }

  const origin = serverOrigin(args.serverUrl);
  const [command, ...rest] = args.positional;
  let output;

  if (command === "initialize") {
    output = {
      protocolVersion: PROTOCOL_VERSION,
      capabilities: { tools: { listChanged: false } },
      serverInfo: { name: SERVER_NAME, version: "skill-tools" },
    };
  } else if (command === "state") {
    output = await fetchJson(dashboardUrl(origin), args.timeoutMs);
  } else if (command === "tools") {
    output = { tools: TOOL_DEFINITIONS };
  } else if (command === "call") {
    const [toolName, jsonArgs] = rest;
    if (!toolName || !jsonArgs) throw new Error("call requires <tool-name> and <json-arguments>");
    output = await callClonedTool(origin, toolName, parseJson(jsonArgs), args.timeoutMs);
  } else if (command === "invoke") {
    const [appName, testerCommand, jsonParams] = rest;
    if (!appName || !testerCommand) throw new Error("invoke requires <appName> and <command>");
    output = await callClonedTool(origin, "command.invoke", {
      appName,
      command: testerCommand,
      parameters: parseJson(jsonParams, {}),
    }, args.timeoutMs);
  } else {
    throw new Error(`Unknown command "${command}"`);
  }

  console.log(JSON.stringify(output, null, 2));
  return 0;
}

main().then((code) => process.exit(code)).catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
