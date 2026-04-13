#!/usr/bin/env node
/**
 * Cross-runtime CLI entry for open-alttester-server.
 *
 * Resolves the tsx CLI binary relative to THIS file so it is always found in
 * the package's own node_modules — even when installed globally or via npx.
 * Then spawns a child node process with tsx as the TypeScript runner.
 *
 * Bun users who want maximum startup speed can run the TypeScript entry
 * directly:  bun ./bin/open-alttester-server.ts
 */
import { spawn } from "node:child_process";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));

// Resolve tsx CLI relative to this file → finds it in the package's own
// node_modules regardless of where the user invokes the command from.
const require = createRequire(import.meta.url);
const tsxCli = require.resolve("tsx/cli");
const tsEntry = join(__dirname, "open-alttester-server.ts");

const child = spawn(process.execPath, [tsxCli, tsEntry, ...process.argv.slice(2)], {
  stdio: "inherit",
  env: process.env,
});

child.on("close", (code) => process.exit(code ?? 0));
child.on("error", (err) => {
  console.error(`open-alttester-server: failed to start — ${err.message}`);
  process.exit(1);
});

// Forward SIGTERM and SIGHUP to the child — the child does NOT receive these
// automatically from the terminal.  SIGINT is intentionally omitted: on Unix
// Ctrl+C sends SIGINT to every process in the foreground group, so the child
// already receives it directly; forwarding it again would cause a race between
// a clean shutdown and a second forced signal.
for (const sig of ["SIGTERM", "SIGHUP"]) {
  process.on(sig, () => child.kill(sig));
}
