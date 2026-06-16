import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { createUiTesterServer, type UiTesterServer } from "./server/server.ts";
import type { McpConfigUpdate } from "./server/mcp.ts";

const { version: VERSION } = JSON.parse(
  readFileSync(join(dirname(fileURLToPath(import.meta.url)), "../package.json"), "utf8"),
) as { version: string };

/**
 * Resolve the server port from CLI argv and environment variables.
 * Precedence: --port / -p flag > ALTSERVER_PORT env > 13000 default.
 * Throws if the resolved value is not a valid port number (1–65535).
 */
export function resolvePort(
  argv: string[],
  env: Record<string, string | undefined>,
): number {
  let raw: string | undefined;

  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === "--port" || argv[i] === "-p") {
      if (argv[i + 1] === undefined) throw new Error(`${argv[i]} requires a value`);
      raw = argv[++i];
      break;
    }
    const m = argv[i].match(/^--port=(.+)$/);
    if (m) { raw = m[1]; break; }
  }

  if (raw === undefined) raw = env.ALTSERVER_PORT;
  if (raw === undefined) return 13000;

  const n = Number(raw);
  if (!Number.isInteger(n) || n < 1 || n > 65535) {
    throw new Error(`Invalid port "${raw}": must be an integer between 1 and 65535`);
  }
  return n;
}

function envFlagEnabled(value: string | undefined): boolean {
  if (value === undefined) return false;
  const normalized = value.trim().toLowerCase();
  return normalized === "1" || normalized === "true" || normalized === "yes" || normalized === "on";
}

/**
 * Resolve initial MCP access from CLI argv and environment.
 * When omitted, MCP stays off (default).
 *
 * Flags:
 *   --mcp-all                  Enable MCP for all connected apps
 *   --mcp-app <appName>        Enable MCP for one app (repeatable)
 *
 * Env:
 *   ALTSERVER_MCP_ALL          Truthy value enables MCP for all apps
 *   ALTSERVER_MCP_APP          Comma-separated app names for selected MCP access
 */
export function resolveMcpConfig(
  argv: string[],
  env: Record<string, string | undefined>,
): McpConfigUpdate | undefined {
  let mcpAll = false;
  const apps: string[] = [];

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === "--mcp-all") {
      mcpAll = true;
      continue;
    }
    if (arg === "--mcp-app") {
      if (argv[i + 1] === undefined) throw new Error("--mcp-app requires a value");
      apps.push(argv[++i]);
      continue;
    }
    const appMatch = arg.match(/^--mcp-app=(.+)$/);
    if (appMatch) {
      apps.push(appMatch[1]);
    }
  }

  if (!mcpAll) {
    mcpAll = envFlagEnabled(env.ALTSERVER_MCP_ALL);
  }

  const envApps = env.ALTSERVER_MCP_APP ?? env.ALTSERVER_MCP_APPS;
  if (envApps) {
    for (const part of envApps.split(",").map((s) => s.trim()).filter(Boolean)) {
      if (!apps.includes(part)) apps.push(part);
    }
  }

  if (!mcpAll && apps.length === 0) return undefined;

  if (mcpAll && apps.length > 0) {
    throw new Error("Cannot combine --mcp-all with --mcp-app");
  }

  if (mcpAll) {
    return { mode: "all" };
  }

  return { mode: "selected", enabledApps: apps };
}

function formatMcpStartupLine(port: number, mcp: McpConfigUpdate | undefined): string | null {
  if (!mcp?.mode) return null;
  const endpoint = `http://127.0.0.1:${port}/mcp`;
  if (mcp.mode === "all") {
    return `MCP:                  enabled for all apps (${endpoint})`;
  }
  const apps = mcp.enabledApps?.join(", ") ?? "";
  return `MCP:                  enabled for: ${apps} (${endpoint})`;
}

export async function runCli(
  argv: string[],
  env: Record<string, string | undefined>,
  exit: (code: number) => never = (code) => process.exit(code),
): Promise<UiTesterServer> {
  if (argv[0] === "version") {
    console.log(VERSION);
    exit(0);
  }

  const port = resolvePort(argv, env);
  const mcp = resolveMcpConfig(argv, env);
  const server = await createUiTesterServer({ port, mcp });

  console.log(`Open UITester Server ${VERSION}`);
  console.log(`UiTester Server running on port ${server.port}`);
  console.log(`Dashboard:            http://127.0.0.1:${server.port}/`);
  console.log(`Apps:                 ws://127.0.0.1:${server.port}/altws/app`);
  console.log(`Test drivers:         ws://127.0.0.1:${server.port}/altws`);
  const mcpLine = formatMcpStartupLine(server.port, mcp);
  if (mcpLine) console.log(mcpLine);
  console.log("Press Ctrl+C to stop.");

  process.on("SIGINT", () => {
    console.log("\nShutting down…");
    server.stop();
    process.exit(0);
  });

  process.on("SIGTERM", () => {
    server.stop();
    process.exit(0);
  });

  return server;
}
