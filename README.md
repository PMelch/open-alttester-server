![npm version](https://img.shields.io/npm/v/open-uitester-server)
![GitHub issues](https://img.shields.io/github/issues-raw/PMelch/open-uitester-server?style=flat-square)
![GitHub](https://img.shields.io/github/license/PMelch/open-uitester-server?style=flat-square)

# Open UITester Server (`open-uitester-server`)

Independent, open-source WebSocket relay and dashboard for Node.js and Bun, compatible with the AltTester® SDK (Unity and Unreal).

[Project website](https://pmelch.github.io/open-uitester-server/) · [npm package](https://www.npmjs.com/package/open-uitester-server)

> **Disclaimer:** This is an independent, open-source project and is not affiliated, associated, authorized, endorsed by, or in any way officially connected with Altom Consulting, AltTester®, or any of its subsidiaries. All product and company names are trademarks™ or registered® trademarks of their respective holders. Use of them does not imply any affiliation with or endorsement by them. AltTester® is a trademark of Altom — see [alttester.com](https://alttester.com/).

## Overview

The AltTester® SDK supports UI test automation for Unity and Unreal applications. SDK-based workflows use a local WebSocket relay between instrumented app builds and test drivers.

Open UITester Server provides an independent server implementation for that workflow: a WebSocket server that implements the protocol used by AltTester® SDK clients. Teams can run end-to-end UI automation with existing Python/C#/Java/Robot test drivers pointed at the server's host and port.

Open UITester Server does not impose a built-in limit on how many instrumented apps can connect at the same time. Practical capacity depends on your host machine's CPU, memory, and network resources.

## Requirements

- **Node.js** ≥ 20.6 — or — **[Bun](https://bun.sh)** ≥ 1.0

Both runtimes are fully supported. The server auto-detects the runtime at startup and selects the appropriate HTTP/WebSocket adapter.


![Dashboard live view](./docs/assets/dashboard-live.png)

---

## Quick start (from npm)

No install required — run directly with **npm / npx**:

```bash
npx open-uitester-server
```

Or install globally:

```bash
npm install -g open-uitester-server
open-uitester-server
```

**Bun** users can use `bunx` / `bun install -g` as before:

```bash
bunx open-uitester-server
```

Custom port:

```bash
open-uitester-server --port 9000
# or
ALTSERVER_PORT=9000 open-uitester-server
```

Auto-enable the embedded MCP server (instead of using the dashboard MCP tab):

```bash
# All connected apps
open-uitester-server --mcp-all

# One or more named apps (repeat --mcp-app)
open-uitester-server --mcp-app MyUnityGame

# Or via environment
ALTSERVER_MCP_ALL=1 open-uitester-server
ALTSERVER_MCP_APP=MyUnityGame,OtherGame open-uitester-server
```

The server listens on port **13000** by default and prints:

```
UiTester Server running on port 13000
Dashboard: http://127.0.0.1:13000/
Apps connect to:  ws://127.0.0.1:13000/altws/app
Test drivers connect to: ws://127.0.0.1:13000/altws
Press Ctrl+C to stop.
```

Open `http://127.0.0.1:13000/` in a browser to see connected apps, drivers, and live events.

## Agent integrations

Open UITester Server supports two agent integration paths:

- **Embedded MCP server:** start the server and enable access with `--mcp-all` or `--mcp-app <name>` (or `ALTSERVER_MCP_ALL` / `ALTSERVER_MCP_APP`), or use the dashboard MCP tab. Point MCP clients at `http://127.0.0.1:13000/mcp`. The dashboard can write project or global config files for Codex, Claude, Gemini, Cursor, OpenCode, and Pi. See [docs/agents.md](./docs/agents.md) for setup details.
- **GitHub skill bundle:** use `skill/open-uitester-tools/` directly from GitHub when you want the same UiTester operations without MCP configuration. Codex can install it as a skill. Other agents can clone or vendor that folder, read `SKILL.md`, and call `scripts/uitester_tools.mjs` directly. The bundle talks to `GET /dashboard/state` and `ws://127.0.0.1:13000/altws`; it does not call or depend on the MCP server.

![MCP dashboard panel](./docs/assets/dashboard-mcp.png)

Install the bundle as a Codex skill:

```bash
python3 ~/.codex/skills/.system/skill-installer/scripts/install-skill-from-github.py \
  --repo PMelch/open-uitester-server \
  --path skill/open-uitester-tools \
  --ref main
```

Restart Codex after installing the skill. For other agents, clone or vendor `skill/open-uitester-tools/` from this repo and use its `SKILL.md` plus `scripts/uitester_tools.mjs`. See [docs/agents.md](./docs/agents.md) for manual MCP config examples, dashboard auto-setup targets, and skill details.

## Stop

Press **Ctrl+C** in the terminal. The server handles `SIGINT` and `SIGTERM` for clean shutdown.

## Instrumented app setup

| SDK field | Value |
|-----------|-------|
| Host | `127.0.0.1` (or the machine's IP for device testing) |
| Port | `13000` (or your custom `ALTSERVER_PORT`) |

The SDK connects to the `/altws/app` path automatically.

## Python driver setup

No changes needed if you already use the `AltDriver` class — it connects to port 13000 on localhost by default:

```python
from alttester import AltDriver

driver = AltDriver()          # defaults: host=127.0.0.1, port=13000
# or
driver = AltDriver(host="127.0.0.1", port=9000)  # custom port
```

## Environment variables

| Variable | Default | Description |
|----------|---------|-------------|
| `ALTSERVER_PORT` | `13000` | Port for both the WebSocket server and HTTP dashboard |
| `ALTSERVER_MCP_ALL` | _(unset)_ | Set to `1` / `true` to enable MCP for all apps at startup |
| `ALTSERVER_MCP_APP` | _(unset)_ | Comma-separated app names for MCP access at startup |

## Contributing

Clone, build, test, and development workflow: [CONTRIBUTING.md](./CONTRIBUTING.md).

## Changelog

See [CHANGELOG.md](./CHANGELOG.md) for release notes.
