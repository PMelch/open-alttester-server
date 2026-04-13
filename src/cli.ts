import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { createAltTesterServer, type AltTesterServer } from "./server/server.ts";

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

export async function runCli(
  argv: string[],
  env: Record<string, string | undefined>,
  exit: (code: number) => never = (code) => process.exit(code),
): Promise<AltTesterServer> {
  if (argv[0] === "version") {
    console.log(`v${VERSION}`);
    exit(0);
  }

  const port = resolvePort(argv, env);
  const server = await createAltTesterServer({ port });

  console.log(`Open AltTester Server v${VERSION}`);
  console.log(`AltTester Server running on port ${server.port}`);
  console.log(`Dashboard:            http://127.0.0.1:${server.port}/`);
  console.log(`Unity apps:           ws://127.0.0.1:${server.port}/altws/app`);
  console.log(`Test drivers:         ws://127.0.0.1:${server.port}/altws`);
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
