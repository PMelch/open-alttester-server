import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, dirname, isAbsolute, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import type { ConnectionRegistry } from "../server/registry";
import type { McpService } from "../server/mcp";
import type { CommandDebugEvent, CommandDebugLog } from "../server/debug";

export const { version: SERVER_VERSION } = JSON.parse(
  readFileSync(join(dirname(fileURLToPath(import.meta.url)), "../../package.json"), "utf8"),
) as { version: string };

// import.meta.dir is Bun-specific; fileURLToPath(new URL('.', import.meta.url)) works on both runtimes.
const DASHBOARD_HTML = readFileSync(
  join(dirname(fileURLToPath(import.meta.url)), "dashboard.html"),
  "utf8",
);

type AgentConfigMap = Record<string, boolean>;

interface DashboardAgentConfigPayload {
  scope?: unknown;
  projectFolder?: unknown;
  mcpEndpoint?: unknown;
  agents?: unknown;
  permissions?: unknown;
  allowlistedCommands?: unknown;
}

interface DashboardAgentConfig {
  scope: "global" | "project";
  projectFolder: string;
  mcpEndpoint: string;
  agents: AgentConfigMap;
  permissions: AgentConfigMap;
  allowlistedCommands: string[];
}

interface DashboardAgentConfigPaths {
  codexConfig: string;
  codexMcp: string;
  codexAgents: string;
  claudeMcp: string;
  geminiSettings: string;
  cursorMcp: string;
  opencodeConfig: string;
  piMcp: string;
}

export type DashboardEvent =
  | { type: "appConnected"; appName: string; platform: string; platformVersion: string; deviceInstanceId: string }
  | { type: "appDisconnected"; appName: string }
  | { type: "driverConnected"; appName: string; driverType: string; paired: boolean }
  | { type: "driverDisconnected"; appName: string }
  | { type: "mcpConfigChanged"; mode: string; enabledApps: string[] }
  | { type: "debugCommandChanged"; command: CommandDebugEvent };

export class DashboardFeed {
  private clients = new Set<ReadableStreamDefaultController<Uint8Array>>();
  private encoder = new TextEncoder();
  private heartbeatTimer: ReturnType<typeof setInterval> | null = null;

  startHeartbeat(intervalMs = 5_000): void {
    if (this.heartbeatTimer !== null) {
      clearInterval(this.heartbeatTimer);
    }
    this.heartbeatTimer = setInterval(() => {
      this.emitRaw(": keepalive\n\n");
    }, intervalMs);
  }

  stopHeartbeat(): void {
    if (this.heartbeatTimer !== null) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
  }

  private emitRaw(raw: string): void {
    const bytes = this.encoder.encode(raw);
    for (const ctrl of this.clients) {
      try {
        ctrl.enqueue(bytes.slice());
      } catch {
        this.clients.delete(ctrl);
      }
    }
  }

  subscribe(): ReadableStream<Uint8Array> {
    let ctrl!: ReadableStreamDefaultController<Uint8Array>;
    const stream = new ReadableStream<Uint8Array>({
      start: (c) => {
        ctrl = c;
        this.clients.add(ctrl);
        // Flush headers immediately so the client knows the connection is live
        ctrl.enqueue(this.encoder.encode(": keepalive\n\n"));
      },
      cancel: () => {
        this.clients.delete(ctrl);
      },
    });
    return stream;
  }

  emit(event: DashboardEvent): void {
    this.emitRaw(`event: ${event.type}\ndata: ${JSON.stringify(event)}\n\n`);
  }

  subscriberCount(): number {
    return this.clients.size;
  }
}

export function handleDashboardRequest(
  req: Request,
  registry: ConnectionRegistry,
  feed: DashboardFeed,
  startTime: number,
  mcp?: McpService,
  debug?: CommandDebugLog,
  projectFolder = "",
  userHomeFolder = "",
): Response | Promise<Response | null> | null {
  const url = new URL(req.url);

  if (url.pathname === "/" || url.pathname === "/index.html") {
    return new Response(DASHBOARD_HTML, {
      headers: { "Content-Type": "text/html; charset=utf-8" },
    });
  }

  if (url.pathname === "/dashboard/state") {
    const state = {
      apps: registry.connectedApps(),
      drivers: registry.connectedDrivers(),
      uptime: (Date.now() - startTime) / 1000,
      version: SERVER_VERSION,
      projectFolder,
      mcp: mcp?.state() ?? { mode: "off", enabledApps: [], activeSessions: 0 },
      debug: debug?.state() ?? { commands: [], sources: [], errorCount: 0 },
    };
    return new Response(JSON.stringify(state), {
      headers: { "Content-Type": "application/json; charset=utf-8" },
    });
  }

  if (url.pathname === "/dashboard/mcp") {
    if (!mcp) {
      return new Response(JSON.stringify({ error: "MCP service is not available" }), {
        status: 503,
        headers: { "Content-Type": "application/json; charset=utf-8" },
      });
    }
    if (req.method !== "POST") {
      return new Response(JSON.stringify({ error: "Method not allowed" }), {
        status: 405,
        headers: { "Content-Type": "application/json; charset=utf-8", "Allow": "POST" },
      });
    }
    return mcpDashboardUpdate(req, mcp, feed);
  }

  if (url.pathname === "/dashboard/agent-config") {
    if (req.method === "GET") {
      return agentConfigRead(projectFolder, userHomeFolder, req);
    }
    if (req.method === "POST") {
      return agentConfigWrite(req, projectFolder, userHomeFolder);
    }
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { "Content-Type": "application/json; charset=utf-8", "Allow": "GET, POST" },
    });
  }

  if (url.pathname === "/dashboard/events") {
    const stream = feed.subscribe();
    return new Response(stream, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        "Connection": "keep-alive",
        "X-Accel-Buffering": "no",  // R3-4: prevent nginx buffering
      },
    });
  }

  return null;
}

function resolveProjectFolder(baseProjectFolder: string, input: unknown): string {
  const raw = typeof input === "string" && input.trim() ? input.trim() : baseProjectFolder;
  return isAbsolute(raw) ? resolve(raw) : resolve(baseProjectFolder, raw);
}

function buildAgentConfigPaths(projectFolder: string, scope: "global" | "project" = "project"): DashboardAgentConfigPaths {
  return {
    codexConfig: join(projectFolder, ".codex", "config.toml"),
    codexMcp: join(projectFolder, ".codex", "mcp.json"),
    codexAgents: join(projectFolder, ".codex", "agents.json"),
    claudeMcp: scope === "global" ? join(projectFolder, ".claude.json") : join(projectFolder, ".mcp.json"),
    geminiSettings: join(projectFolder, ".gemini", "settings.json"),
    cursorMcp: join(projectFolder, ".cursor", "mcp.json"),
    opencodeConfig: scope === "global"
      ? join(projectFolder, ".config", "opencode", "opencode.json")
      : join(projectFolder, "opencode.json"),
    piMcp: scope === "global"
      ? join(projectFolder, ".pi", "agent", "mcp.json")
      : join(projectFolder, ".pi", "mcp.json"),
  };
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8" },
  });
}

function endpointFromRequest(req: Request): string {
  const url = new URL(req.url);
  return `${url.protocol}//${url.host}/mcp`;
}

function booleanRecord(input: unknown): AgentConfigMap {
  if (!input || typeof input !== "object" || Array.isArray(input)) return {};
  return Object.fromEntries(
    Object.entries(input as Record<string, unknown>)
      .filter(([key]) => key.length > 0)
      .map(([key, value]) => [key, Boolean(value)]),
  );
}

function stringArray(input: unknown): string[] {
  if (!Array.isArray(input)) return [];
  return input.filter((value): value is string => typeof value === "string" && value.length > 0);
}

function readJsonObject(path: string): Record<string, unknown> {
  if (!existsSync(path)) return {};
  const parsed = JSON.parse(readFileSync(path, "utf8")) as unknown;
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return {};
  return parsed as Record<string, unknown>;
}

function objectValue(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return value as Record<string, unknown>;
}

function uniqueStrings(...groups: string[][]): string[] {
  return Array.from(new Set(groups.flat()));
}

function writeJson(path: string, value: unknown): void {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function writeMergedMcpConfig(path: string, serverConfig: Record<string, unknown>): void {
  const existing = readJsonObject(path);
  writeJson(path, {
    ...existing,
    mcpServers: {
      ...objectValue(existing.mcpServers),
      "open-uitester-server": serverConfig,
    },
  });
}

function writeMergedOpenCodeConfig(path: string, mcpEndpoint: string): void {
  const existing = readJsonObject(path);
  writeJson(path, {
    ...existing,
    "$schema": typeof existing.$schema === "string" ? existing.$schema : "https://opencode.ai/config.json",
    mcp: {
      ...objectValue(existing.mcp),
      "open-uitester-server": {
        type: "remote",
        url: mcpEndpoint,
        enabled: true,
      },
    },
  });
}

function tomlString(value: string): string {
  return JSON.stringify(value);
}

function managedCodexMcpTable(mcpEndpoint: string): string[] {
  return [
    "[mcp_servers.open-uitester-server]",
    `url = ${tomlString(mcpEndpoint)}`,
    "enabled = true",
  ];
}

function writeMergedCodexConfig(path: string, mcpEndpoint: string): void {
  const lines = existsSync(path) ? readFileSync(path, "utf8").split(/\r?\n/) : [];
  const header = "[mcp_servers.open-uitester-server]";
  const start = lines.findIndex(line => line.trim() === header);
  const table = managedCodexMcpTable(mcpEndpoint);
  let nextLines: string[];

  if (start === -1) {
    const base = lines.filter((line, index) => index < lines.length - 1 || line.length > 0);
    nextLines = base.length > 0 ? [...base, "", ...table] : table;
  } else {
    let end = start + 1;
    while (end < lines.length && !/^\s*\[/.test(lines[end])) end += 1;
    nextLines = [...lines.slice(0, start), ...table, ...lines.slice(end)];
  }

  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, `${nextLines.join("\n").replace(/\n+$/, "")}\n`, "utf8");
}

function writeMergedAgentConfig(path: string, config: DashboardAgentConfig): void {
  const existing = readJsonObject(path);
  const existingAgents = booleanRecord(existing.agents);
  const existingPermissions = booleanRecord(existing.permissions);
  const existingAllowlistedCommands = stringArray(existing.allowlistedCommands);
  writeJson(path, {
    ...existing,
    ...config,
    agents: {
      ...existingAgents,
      ...config.agents,
    },
    permissions: {
      ...existingPermissions,
      ...config.permissions,
    },
    allowlistedCommands: uniqueStrings(existingAllowlistedCommands, config.allowlistedCommands),
  });
}

function configTargetFolder(scope: "global" | "project", projectFolder: string, userHomeFolder: string): string {
  return scope === "global" ? userHomeFolder : projectFolder;
}

function readSavedAgentConfig(scope: "global" | "project", projectFolder: string, userHomeFolder: string): DashboardAgentConfig | null {
  const path = buildAgentConfigPaths(configTargetFolder(scope, projectFolder, userHomeFolder), scope).codexAgents;
  if (!existsSync(path)) return null;
  return JSON.parse(readFileSync(path, "utf8")) as DashboardAgentConfig;
}

function agentConfigRead(projectFolder: string, userHomeFolder: string, req: Request): Response {
  const url = new URL(req.url);
  const scope = url.searchParams.get("scope") === "global" ? "global" : "project";
  const targetFolder = configTargetFolder(scope, projectFolder, userHomeFolder);
  const paths = buildAgentConfigPaths(targetFolder, scope);
  const config = readSavedAgentConfig(scope, projectFolder, userHomeFolder) ?? {
    scope,
    projectFolder,
    mcpEndpoint: endpointFromRequest(req),
    agents: {},
    permissions: {},
    allowlistedCommands: [],
  };
  return jsonResponse({ config, paths });
}

async function agentConfigWrite(req: Request, baseProjectFolder: string, userHomeFolder: string): Promise<Response> {
  try {
    const input = await req.json() as DashboardAgentConfigPayload;
    const scope = input.scope === "global" ? "global" : "project";
    const projectFolder = resolveProjectFolder(baseProjectFolder, input.projectFolder);
    const targetFolder = configTargetFolder(scope, projectFolder, userHomeFolder);
    const mcpEndpoint = typeof input.mcpEndpoint === "string" && input.mcpEndpoint.trim()
      ? input.mcpEndpoint.trim()
      : endpointFromRequest(req);
    const config: DashboardAgentConfig = {
      scope,
      projectFolder,
      mcpEndpoint,
      agents: booleanRecord(input.agents),
      permissions: booleanRecord(input.permissions),
      allowlistedCommands: stringArray(input.allowlistedCommands),
    };
    const paths = buildAgentConfigPaths(targetFolder, scope);

    writeMergedCodexConfig(paths.codexConfig, mcpEndpoint);
    writeMergedMcpConfig(paths.codexMcp, { url: mcpEndpoint });
    writeMergedMcpConfig(paths.claudeMcp, { type: "http", url: mcpEndpoint });
    writeMergedMcpConfig(paths.geminiSettings, { httpUrl: mcpEndpoint });
    writeMergedMcpConfig(paths.cursorMcp, { url: mcpEndpoint });
    writeMergedOpenCodeConfig(paths.opencodeConfig, mcpEndpoint);
    writeMergedMcpConfig(paths.piMcp, { transport: "streamable-http", url: mcpEndpoint });
    writeMergedAgentConfig(paths.codexAgents, config);

    return jsonResponse({ config, paths });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return jsonResponse({ error: message }, 400);
  }
}

async function mcpDashboardUpdate(
  req: Request,
  mcp: McpService,
  feed: DashboardFeed,
): Promise<Response> {
  try {
    const input = await req.json() as { mode?: unknown; enabledApps?: unknown };
    const state = mcp.updateConfig({
      mode: input.mode as never,
      enabledApps: input.enabledApps as never,
    });
    feed.emit({ type: "mcpConfigChanged", mode: state.mode, enabledApps: state.enabledApps });
    return new Response(JSON.stringify({ mcp: state }), {
      headers: { "Content-Type": "application/json; charset=utf-8" },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return new Response(JSON.stringify({ error: message }), {
      status: 400,
      headers: { "Content-Type": "application/json; charset=utf-8" },
    });
  }
}
