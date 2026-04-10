# AltTester Server

Open-source replacement for the AltTester Desktop app. Provides the WebSocket server that bridges Unity SDK apps and Python/C# test drivers, plus a real-time web dashboard.

## Requirements

- [Bun](https://bun.sh) ≥ 1.0

---

## Quick start (from npm)

No clone required — run directly with `bunx`:

```bash
bunx open-alttester-server
```

Or install globally and run as a command:

```bash
bun install -g open-alttester-server
open-alttester-server
```

Custom port:

```bash
bunx open-alttester-server --port 9000
# or
ALTSERVER_PORT=9000 bunx open-alttester-server
```

---

## From source

### Install

```bash
bun install
```

### Start

```bash
bun run start
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
ALTSERVER_PORT=9000 bun run start
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

## Tests

```bash
bun test            # run all tests once
bun test --watch    # re-run on file changes
bun test --coverage # with coverage report
```

## Environment variables

| Variable | Default | Description |
|----------|---------|-------------|
| `ALTSERVER_PORT` | `13000` | Port for both the WebSocket server and HTTP dashboard |
