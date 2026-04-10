import { createAltTesterServer } from "./server/server";

const port = parseInt(process.env.ALTSERVER_PORT ?? "13000");

const server = await createAltTesterServer({ port });

console.log(`AltTester Server running on port ${server.port}`);
console.log(`Dashboard: http://127.0.0.1:${server.port}/`);
console.log(`Unity apps connect to:  ws://127.0.0.1:${server.port}/altws/app`);
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
