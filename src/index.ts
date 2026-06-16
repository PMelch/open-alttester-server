import { createUiTesterServer } from "./server/server";
import { resolveMcpConfig, resolvePort } from "./cli";

const port = resolvePort([], process.env);
const mcp = resolveMcpConfig([], process.env);

const server = await createUiTesterServer({ port, mcp });

console.log(`UiTester Server running on port ${server.port}`);
console.log(`Dashboard: http://127.0.0.1:${server.port}/`);
console.log(`Apps connect to:  ws://127.0.0.1:${server.port}/altws/app`);
console.log(`Test drivers connect to: ws://127.0.0.1:${server.port}/altws`);
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
