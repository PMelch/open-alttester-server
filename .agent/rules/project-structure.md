# Project Structure Rules

## Runtime & Language

- **Runtimes**: Bun ≥ 1.0 **and** Node.js ≥ 20.0 — both fully supported
- **Language**: TypeScript (strict mode)
- **Runtime adapter**: `ServerAdapter` interface with `BunServerAdapter` (Bun.serve) and `NodeServerAdapter` (node:http + ws); auto-detected at startup via `createAltTesterServer()`
- **Frontend framework**: Vue 3 (for all web UI — dashboard and inspector)
- **CSS framework**: Tailwind CSS
- **Bundler**: Bun's built-in bundler for the frontend; server-side TypeScript run directly by Bun or via tsx on Node.js

## Directory Layout

```
open-alttester-server/
  src/
    index.ts              # Entry point — starts server + HTTP
    cli.ts                # CLI argument parsing
    server/               # WebSocket server (AltTester protocol)
      adapter.ts          # ServerAdapter interface (runtime-agnostic)
      adapters/
        bun.ts            # BunServerAdapter (Bun.serve)
        node.ts           # NodeServerAdapter (node:http + ws)
      registry.ts         # ConnectionRegistry: tracks apps and drivers
      server.ts           # createAltTesterServer() — auto-selects adapter
      inspector.ts        # Inspector service (synthetic driver)
      __tests__/
    web/                  # Dashboard HTTP + live-update feed
      handler.ts          # HTTP request handler (serves HTML, SSE feed)
      inspector-handler.ts
      dashboard.html      # Single-file dashboard page
      __tests__/
  bin/
    open-alttester-server.ts  # Bun CLI entry (#!/usr/bin/env bun)
    open-alttester-server.js  # Node.js CLI wrapper (#!/usr/bin/env node)
  .agent/
    docs/                 # Protocol and design documentation
    rules/                # Process rules for agents
  .pair-programmer/       # Pair programmer config and review artifacts
  .backlog/               # Task backlog
  AltTester-Unity-SDK/    # Cloned SDK (read-only reference)
```

## Scripts (package.json)

| Script | Command | Runtime |
|--------|---------|---------|
| `npm start` | `tsx src/index.ts` | Node.js |
| `npm run start:bun` | `bun src/index.ts` | Bun |
| `npm test` | `vitest run` | Node.js (cross-runtime) |
| `npm run test:watch` | `vitest` | Node.js |
| `npm run test:bun` | `bun test` | Bun |
| `npm run dev` | `bun --watch src/index.ts` | Bun |
| `npm run typecheck` | `tsc --project tsconfig.node.json --noEmit` | Node.js |
| `npm run typecheck:bun` | `tsc --project tsconfig.bun.json --noEmit` | Bun |

## Environment Variables

| Variable | Default | Purpose |
|----------|---------|---------|
| `ALTSERVER_PORT` | `13000` | WebSocket server port |
| `WEB_PORT` | same as `ALTSERVER_PORT` | HTTP/dashboard port (same server) |

## TypeScript Config

- `strict: true`
- `target: "ES2022"`
- `module: "ESNext"`
- `moduleResolution: "bundler"`
