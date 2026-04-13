import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    // Node.js 22 provides WebSocket, fetch, and other globals natively —
    // no environment shims needed for the BDD tests.
    environment: "node",
    globals: true,
    include: ["src/**/__tests__/**/*.ts"],
  },
});
