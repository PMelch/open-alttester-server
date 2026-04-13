# open-alttester-server

Open-source replacement for the AltTester Desktop app. Provides the WebSocket server that bridges Unity SDK apps and Python/C# test drivers, plus a real-time web dashboard.

## Requirements

- [Bun](https://bun.sh) ≥ 1.0 (**required** — Node.js is not supported)

> The server is built on `Bun.serve`, which provides integrated HTTP + WebSocket handling in a single runtime call. There is no Node.js equivalent without replacing the entire server layer, so Bun is a hard runtime requirement.

## Usage

Run directly without installing:

```bash
bunx open-alttester-server
```

Or install globally:

```bash
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

## License

MIT
