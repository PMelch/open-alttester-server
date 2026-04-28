# Open AltTester Server (open-alttester-server)

Open-source replacement for the AltTester Desktop app. Provides the WebSocket server that bridges Unity SDK apps and Python/C# test drivers, plus a real-time web dashboard.

## Why this project exists

The [AltTester® Unity SDK](https://github.com/alttester/AltTester-Unity-SDK) is open source (GPL v3), but the **AltTester Desktop** app — which acts as the relay between the SDK running in your Unity app and your test drivers — is a paid, closed-source product.

This project is a free, open-source alternative to that Desktop app: a drop-in WebSocket server that speaks the same protocol, so you can run AltTester-based UI automation end to end without a commercial license. The Unity SDK and your existing Python/C#/Java/Robot test drivers connect to this server exactly the way they would connect to the Desktop app.

If you need the extended features that ship with the commercial Desktop app — such as UI test recording and other productivity tooling — please consider purchasing a license from [AltTester](https://alttester.com/) to support the upstream project.

## Requirements

- **Node.js** ≥ 20.6 — or — **[Bun](https://bun.sh)** ≥ 1.0

Both runtimes are fully supported. The server auto-detects the runtime at startup and selects the appropriate HTTP/WebSocket adapter.


![Dashboard](./docs/assets/Screenshotv0.3.0.png)

---

## Quick start (from npm)

No clone required — run directly with **npm / npx**:

```bash
npx open-alttester-server
```

Or install globally:

```bash
npm install -g open-alttester-server
open-alttester-server
```

**Bun** users can use `bunx` / `bun install -g` as before:

```bash
bunx open-alttester-server
```

Custom port:

```bash
open-alttester-server --port 9000
# or
ALTSERVER_PORT=9000 open-alttester-server
```

---

## From source

### Install

```bash
# Node.js
npm install

# Bun
bun install
```

### Start

```bash
# Node.js
npm start            # uses tsx

# Bun (faster startup)
npm run start:bun    # uses bun directly
# or
bun run start:bun
```

The server starts on port **13000** by default and prints:

```
AltTester Server running on port 13000
Dashboard: http://127.0.0.1:13000/
Unity apps connect to:  ws://127.0.0.1:13000/altws/app
Test drivers connect to: ws://127.0.0.1:13000/altws
Press Ctrl+C to stop.
```

Open `http://127.0.0.1:13000/` in a browser to see connected apps, drivers, and live events.

### Custom port

```bash
ALTSERVER_PORT=9000 npm start
```

### Development (auto-restart on file changes)

```bash
bun run dev
```

## Stop

Press **Ctrl+C** in the terminal. The server handles `SIGINT` and `SIGTERM` for clean shutdown.

## Unity SDK setup

In your Unity project, configure the AltTester SDK to connect to this server instead of the AltTester Desktop app. The host and port fields map directly:

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

## Testing the CLI locally (before publishing)

**Node.js** — use `npm link`:

```bash
npm install
npm link

# Now test as if installed from npm:
open-alttester-server
open-alttester-server --port 9000

npm unlink open-alttester-server
```

**Bun** — use `bun link`:

```bash
bun link

bunx open-alttester-server
bunx open-alttester-server --port 9000

bun unlink open-alttester-server
```

---

## Tests

```bash
# Node.js
npm test                  # vitest (recommended for CI)

# Bun
npm run test:bun          # bun test
npm run test:bun:watch    # re-run on file changes
npm run test:bun:coverage # with coverage report
```

## Environment variables

| Variable | Default | Description |
|----------|---------|-------------|
| `ALTSERVER_PORT` | `13000` | Port for both the WebSocket server and HTTP dashboard |

## Changelog

See [CHANGELOG.md](./CHANGELOG.md) for release notes.
