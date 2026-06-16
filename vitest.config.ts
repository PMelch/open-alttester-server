import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    // Node.js 22 provides WebSocket natively; the setup file polyfills it for
    // Node 20 using the `ws` package so tests run on both matrix targets.
    environment: "node",
    globals: true,
    setupFiles: ["./src/test-setup.ts"],
    include: ["src/**/__tests__/**/*.ts"],
  },
});
