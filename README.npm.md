# open-alttester-server

Open-source replacement for the AltTester Desktop app. Provides the WebSocket server that bridges Unity SDK apps and Python/C# test drivers, plus a real-time web dashboard.

## Why this project exists

The [AltTester® Unity SDK](https://github.com/alttester/AltTester-Unity-SDK) is open source (GPL v3), but the **AltTester Desktop** app — which acts as the relay between the SDK running in your Unity app and your test drivers — is a paid, closed-source product.

This project is a free, open-source alternative to that Desktop app: a drop-in WebSocket server that speaks the same protocol, so you can run AltTester-based UI automation end to end without a commercial license. The Unity SDK and your existing Python/C#/Java/Robot test drivers connect to this server exactly the way they would connect to the Desktop app.

If you need the extended features that ship with the commercial Desktop app — such as UI test recording and other productivity tooling — please consider purchasing a license from [AltTester](https://alttester.com/) to support the upstream project.

## Requirements

- **Node.js** ≥ 20.0 — or — **[Bun](https://bun.sh)** ≥ 1.0

Both runtimes are fully supported. The server auto-detects the runtime at startup.

## Usage

Run directly without installing:

```bash
# Node.js / npm
npx open-alttester-server

# Bun
bunx open-alttester-server
```

Or install globally:

```bash
# Node.js / npm
npm install -g open-alttester-server

# Bun
bun install -g open-alttester-server

open-alttester-server
```

Custom port:

```bash
open-alttester-server --port 9000
# or
ALTSERVER_PORT=9000 open-alttester-server
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

## Unity SDK setup

Configure the AltTester SDK to connect to this server:

| SDK field | Value |
|-----------|-------|
| Host | `127.0.0.1` (or the machine's IP for device testing) |
| Port | `13000` (or your custom `ALTSERVER_PORT`) |

## Python driver setup

No changes needed if you already use the `AltDriver` class:

```python
from alttester import AltDriver

driver = AltDriver()                              # defaults: host=127.0.0.1, port=13000
driver = AltDriver(host="127.0.0.1", port=9000)  # custom port
```

## Environment variables

| Variable | Default | Description |
|----------|---------|-------------|
| `ALTSERVER_PORT` | `13000` | Port for both the WebSocket server and HTTP dashboard |

## Changelog

See [CHANGELOG.md](./CHANGELOG.md) for release notes.

## License

MIT
