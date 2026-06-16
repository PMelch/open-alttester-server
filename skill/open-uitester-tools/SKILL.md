---
name: open-uitester-tools
description: Dynamically provide UiTester Unity app inspection and command tools equivalent to the project's MCP-exposed functionality, without depending on the MCP server or MCP configuration. Use when Codex should inspect UiTester scenes or object hierarchies, list or invoke the same UiTester command surface, inspect object components or fields, load scenes, or automate open-uitester-server workflows through a skill that is optional and independent from MCP.
---

# Open UITester Tools

## Overview

Use this skill as a dynamically-loaded implementation of the same UiTester operations exposed by the project MCP integration. It intentionally does **not** use the MCP server, MCP endpoint, or MCP config files. It talks directly to the normal Open UITester server:

- `GET /dashboard/state` for app discovery.
- `ws://<server>/altws` as a temporary UiTester driver for commands.

The MCP implementation and this skill are peers. Neither should depend on the other. If `src/server/mcp.ts`, its tests, or exposed tool semantics change, update this skill implementation and its reference files in the same change so both options stay equivalent.

## Quick Workflow

1. Determine the Open UITester server origin from `--server-url`, `OPEN_UITESTER_SERVER_URL`, or the default `http://127.0.0.1:13000`.
2. Confirm the server responds by reading `/dashboard/state`.
3. Discover connected app names from `/dashboard/state` when the user does not specify `appName`. The SDK default is `__default__`.
4. Use the skill tool names for high-level inspection:
   - `scenes.query` for current and loaded scenes.
   - `hierarchy.query` for `findObjects` over `//*`.
   - `object.components` and `component.fields` for object inspection by UiTester path.
5. Use `command.invoke` only when the high-level skill operation is insufficient or the user asks for a specific UiTester command.

## Helper Script

Use `scripts/uitester_tools.mjs` for repeatable calls without rewriting WebSocket or dashboard code:

```bash
node skill/open-uitester-tools/scripts/uitester_tools.mjs initialize
node skill/open-uitester-tools/scripts/uitester_tools.mjs tools
node skill/open-uitester-tools/scripts/uitester_tools.mjs state
node skill/open-uitester-tools/scripts/uitester_tools.mjs call scenes.query '{"appName":"__default__"}'
node skill/open-uitester-tools/scripts/uitester_tools.mjs invoke __default__ getAllScenes '{}'
```

Pass `--server-url http://127.0.0.1:13000` when the server is not on the default origin.

## Tool Rules

- Treat skill tool calls as operating on a live Unity app. Confirm destructive or state-changing commands when the intent is unclear.
- Prefer `structuredContent` in script output over parsing `content[0].text`.
- Remember this skill is an alternate implementation of the same functionality, not an MCP client.
- For path-based object calls, use UiTester paths such as `//Canvas/Button`; paths are resolved with `findObject` before component or field commands.
- For object-id commands through `command.invoke`, pass flat UiTester parameters exactly as the SDK command expects.
- The skill connects as a temporary UiTester driver. If another driver is already paired to the same app, the server may close the connection with code `4005`; tell the user the app already has a driver and retry after it disconnects.

## References

Read `references/tool-surface.md` when you need:

- The exact tool list, input shapes, and result shapes.
- The exposed `command.invoke` allowlist.
- Common command payloads such as `loadScene`, `getAllComponents`, `getObjectComponentProperty`, and `callComponentMethodForObject`.
- Connectivity and error-handling details for this independent skill implementation.
