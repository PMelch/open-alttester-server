# Contributing

Thanks for helping improve Open UITester Server. This guide covers cloning, running from source, and testing. End-user install docs live in [README.md](./README.md) and [README.npm.md](./README.npm.md).

## Prerequisites

- **Node.js** ≥ 20.6 — or — **[Bun](https://bun.sh)** ≥ 1.0

Both runtimes are supported. The server auto-detects the runtime at startup.

## Setup

```bash
git clone https://github.com/PMelch/open-uitester-server.git
cd open-uitester-server

# Node.js
npm install

# Bun
bun install
```

## Run from source

```bash
# Node.js
npm start            # uses tsx

# Bun (faster startup)
npm run start:bun
# or
bun run start:bun
```

Custom port when running from source:

```bash
ALTSERVER_PORT=9000 npm start
```

The server starts on port **13000** by default and prints:

```
UiTester Server running on port 13000
Dashboard: http://127.0.0.1:13000/
Apps connect to:  ws://127.0.0.1:13000/altws/app
Test drivers connect to: ws://127.0.0.1:13000/altws
Press Ctrl+C to stop.
```

## Development

Auto-restart on file changes:

```bash
bun run dev
```

Agent integration details for local development are in [docs/agents.md](./docs/agents.md).

## Tests

```bash
# Node.js (vitest — recommended for CI)
npm test
npm run test:watch
npm run test:coverage

# Bun
npm run test:bun
npm run test:bun:watch
npm run test:bun:coverage
```

Typecheck:

```bash
npm run typecheck
npm run typecheck:bun
```

## Test the CLI like an npm install

Before opening a PR that touches the CLI or packaging, verify the binary the way users invoke it.

**Node.js:**

```bash
npm link
open-uitester-server
open-uitester-server --port 9000
npm unlink open-uitester-server
```

**Bun:**

```bash
bun link
bunx open-uitester-server
bunx open-uitester-server --port 9000
bun unlink open-uitester-server
```

## Pull requests

1. Branch from `main`.
2. Keep changes focused; match existing code style.
3. Run the relevant test and typecheck commands before opening the PR.
4. Update [CHANGELOG.md](./CHANGELOG.md) when the change is user-facing.

MCP server, skill bundle, and dashboard changes must stay in parity per [AGENTS.md](./AGENTS.md).
