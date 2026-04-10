# Project Structure Rules

## Runtime & Language

- **Runtime**: Bun (not Node.js directly)
- **Language**: TypeScript (strict mode)
- **No frontend framework** — plain HTML/JS/CSS served statically
- **No bundler** — Bun serves TypeScript directly

## Directory Layout

```
alt-tester-desktop-alt/
  src/
    index.ts              # Entry point — starts server + HTTP
    server/               # WebSocket server (AltTester protocol)
      registry.ts         # ConnectionRegistry: tracks apps and drivers
      router.ts           # Message routing between paired clients
      server.ts           # Bun.serve() setup, WS upgrade handling
      __tests__/
    web/                  # Dashboard HTTP + live-update feed
      handler.ts          # HTTP request handler (serves HTML, SSE/WS feed)
      dashboard.html      # Single-file dashboard page
      __tests__/
    inspector/            # Inspector: synthetic driver for scene queries
      inspector.ts
      __tests__/
  .agent/
    docs/                 # Protocol and design documentation
    rules/                # Process rules for agents
  .pair-programmer/       # Pair programmer config and review artifacts
  .backlog/               # Task backlog
  AltTester-Unity-SDK/    # Cloned SDK (read-only reference)
```

## Scripts (package.json)

| Script | Command |
|--------|---------|
| `bun run dev` | `bun --watch src/index.ts` |
| `bun run start` | `bun src/index.ts` |
| `bun test` | `bun test` |
| `bun test --watch` | `bun test --watch` |

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
