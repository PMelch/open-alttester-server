# Open UITester Skill Tool Surface

Source of truth: `src/server/mcp.ts`, `src/server/__tests__/mcp.bdd.test.ts`, and the independent skill script `skill/open-uitester-tools/scripts/uitester_tools.mjs`.

Keep this reference and the skill script in sync whenever the MCP-exposed functionality changes. The MCP integration and this skill must stay functionally equivalent, but neither implementation may call or depend on the other.

## Purpose

This skill is an optional dynamic implementation of the same six user-facing operations that the project also exposes through MCP. The skill does not use the MCP server, MCP endpoint, or MCP configuration.

The skill uses:

- `GET /dashboard/state` to discover connected apps.
- `ws://<host>/altws?...` as a temporary UiTester driver to send commands to a connected app.

Users can choose either MCP or this skill. Both should provide the same tool behavior, but they are independent entry points.

## Server Location

Default Open UITester server origin:

```text
http://127.0.0.1:13000
```

Override it with:

```bash
OPEN_UITESTER_SERVER_URL=http://127.0.0.1:13000 node skill/open-uitester-tools/scripts/uitester_tools.mjs state
node skill/open-uitester-tools/scripts/uitester_tools.mjs --server-url http://127.0.0.1:13000 state
```

## Skill Transport Behavior

Run the skill script from the repository root:

```bash
node skill/open-uitester-tools/scripts/uitester_tools.mjs tools
node skill/open-uitester-tools/scripts/uitester_tools.mjs state
node skill/open-uitester-tools/scripts/uitester_tools.mjs call scenes.query '{"appName":"__default__"}'
node skill/open-uitester-tools/scripts/uitester_tools.mjs invoke __default__ getAllScenes '{}'
```

Output for skill tool calls mirrors the MCP tool result shape:

```json
{
  "content": [{ "type": "text", "text": "<pretty JSON>" }],
  "structuredContent": {},
  "isError": false
}
```

Errors use the same tool error shape:

```json
{
  "content": [{ "type": "text", "text": "<error message>" }],
  "isError": true
}
```

The `initialize` command returns protocol-style metadata for parity. The `tools` command returns the six tool definitions including input schemas.

## App Access Model

All skill app-specific tools require `appName`.

The skill does not use MCP modes because it is not an MCP server. It verifies that the target app is connected through `/dashboard/state`; commands then connect as a temporary UiTester driver.

Connected app entries contain `appName`, `platform`, `platformVersion`, `deviceInstanceId`, optional `appId`, and `connectedAt`. The Unity SDK default app name is `__default__`.

The skill uses the UiTester driver type `codex_skill` for its temporary WebSocket connection so the dashboard Debug tab can attribute captured command requests and responses to the independent skill path rather than to a normal test driver.

Important implementation difference: the MCP integration sends commands internally through the app socket and can inspect while an external driver exists. The skill connects through `/altws` as a normal driver, so the server can reject it with close code `4005` when another driver is already paired to that app. This is the only intentional transport-level difference; tool names, inputs, allowlist, and result shapes should otherwise stay equivalent.

## Skill Tools

### hierarchy.query

Return current UiTester object hierarchy for a connected app.

Command:

```bash
node skill/open-uitester-tools/scripts/uitester_tools.mjs call hierarchy.query '{"appName":"__default__","enabled":true}'
```

Arguments:

```json
{
  "appName": "__default__",
  "enabled": true
}
```

`enabled` defaults to `true`; pass `false` to include disabled objects.

Skill implementation: connect to `/altws`, then send UiTester `findObjects` with:

```json
{
  "path": "//*",
  "cameraBy": "NAME",
  "cameraPath": "//",
  "enabled": true
}
```

Result:

```json
{
  "appName": "__default__",
  "objects": []
}
```

### scenes.query

Return loaded scenes and current scene.

Command:

```bash
node skill/open-uitester-tools/scripts/uitester_tools.mjs call scenes.query '{"appName":"__default__"}'
```

Arguments:

```json
{ "appName": "__default__" }
```

Skill implementation: connect to `/altws`, then send `getAllLoadedScenes` and `getCurrentScene`.

Result:

```json
{
  "appName": "__default__",
  "scenes": ["Lobby"],
  "currentScene": { "name": "Lobby" }
}
```

If Unity returns a single scene string, the tool surface normalizes it to a one-item array.

### object.components

Resolve an object by UiTester path and return all attached components.

Command:

```bash
node skill/open-uitester-tools/scripts/uitester_tools.mjs call object.components '{"appName":"__default__","path":"//Canvas/Button"}'
```

Arguments:

```json
{
  "appName": "__default__",
  "path": "//Canvas/Button"
}
```

Skill implementation:

1. `findObject` with the path.
2. `getAllComponents` with `altObjectId` from the resolved object.

Result:

```json
{
  "appName": "__default__",
  "path": "//Canvas/Button",
  "object": { "id": 42, "name": "Button" },
  "components": [
    { "componentName": "UnityEngine.UI.Button", "assemblyName": "UnityEngine.UI" }
  ]
}
```

### component.fields

Resolve an object by path and return fields for a component.

Command:

```bash
node skill/open-uitester-tools/scripts/uitester_tools.mjs call component.fields '{"appName":"__default__","path":"//Canvas/Button","component":{"componentName":"UnityEngine.UI.Button","assemblyName":"UnityEngine.UI"}}'
```

Arguments:

```json
{
  "appName": "__default__",
  "path": "//Canvas/Button",
  "component": {
    "componentName": "UnityEngine.UI.Button",
    "assemblyName": "UnityEngine.UI"
  }
}
```

Skill implementation:

1. `findObject` with the path.
2. `getAllFields` with `altObjectId`, `altComponent`, and `altFieldsSelections: "ALLFIELDS"`.

### commands.list

List commands allowed through `command.invoke`.

Command:

```bash
node skill/open-uitester-tools/scripts/uitester_tools.mjs call commands.list '{"appName":"__default__"}'
```

Arguments:

```json
{ "appName": "__default__" }
```

Skill implementation: verify the app appears in `/dashboard/state`; return the local command allowlist.

### command.invoke

Invoke an allowed UiTester command for a connected app.

Command:

```bash
node skill/open-uitester-tools/scripts/uitester_tools.mjs invoke __default__ getCurrentScene '{}'
```

Arguments:

```json
{
  "appName": "__default__",
  "command": "getCurrentScene",
  "parameters": {}
}
```

The skill forwards `parameters` as flat UiTester command parameters over `/altws`.

## command.invoke Allowlist

```text
activateNotification
beginTouch
callComponentMethodForObject
clickCoordinates
clickElement
deactivateNotification
deleteKeyPlayerPref
deletePlayerPrefs
deletePlayerPref
endTouch
findObject
findObjectAtCoordinates
findObjects
findObjectsLight
findObjectsWhichContains
findObjectWhichContains
getAllActiveCameras
getAllCameras
getAllComponents
getAllFields
getAllLoadedScenes
getAllLoadedScenesAndObjects
getAllMethods
getAllProperties
getAllScenes
getApplicationScreenSize
getCurrentScene
getKeyPlayerPref
getObjectComponentProperty
getPNGScreenshot
getServerVersion
getText
getTimeScale
getVisualElementProperty
keysDown
keysUp
loadScene
moveMouse
moveTouch
multipointSwipe
pointerDownFromObject
pointerEnterObject
pointerExitObject
pointerUpFromObject
pressKeyboardKeys
resetInput
scroll
setKeyPlayerPref
setObjectComponentProperty
setServerLogging
setText
setTimeScale
swipe
tapCoordinates
tapElement
tilt
unloadScene
```

## Common Payloads

### Load a built Unity scene

```json
{
  "appName": "__default__",
  "command": "loadScene",
  "parameters": {
    "sceneName": "TestingStart",
    "loadSingle": true
  }
}
```

Addressable scenes are not necessarily listed by `getAllScenes` or loadable by `loadScene`. If the app exposes a test hook such as `LoadAddressableScene(System.String)`, use `callComponentMethodForObject`.

### Invoke a component method

UiTester expects method arguments serialized as JSON strings.

```json
{
  "appName": "__default__",
  "command": "callComponentMethodForObject",
  "parameters": {
    "altObject": { "id": 541332, "name": "@AltTesterInterface" },
    "component": "My.App.UiTestInterface",
    "method": "LoadAddressableScene",
    "parameters": ["\"Lobby\""],
    "typeOfParameters": ["System.String"],
    "assembly": "App"
  }
}
```

### Get object components by id

```json
{
  "appName": "__default__",
  "command": "getAllComponents",
  "parameters": {
    "altObjectId": 42
  }
}
```

### Get a component property

Useful for UI dimensions:

```json
{
  "appName": "__default__",
  "command": "getObjectComponentProperty",
  "parameters": {
    "altObject": { "id": -3680664, "name": "BackgroundImage" },
    "component": "UnityEngine.RectTransform",
    "property": "rect",
    "assembly": "UnityEngine.CoreModule",
    "maxDepth": 3
  }
}
```

For a `RectTransform`, `rect.width` and `rect.height` give rendered dimensions in pixels or canvas units.

## Error Patterns

- `No app connected with appName "<appName>"`: the app is not connected to the server.
- `Command "<name>" is not in the known tester command list`: the command is not in `TESTER_COMMANDS`.
- `Driver WebSocket closed (4005)`: another driver is already paired with the target app.
- `Driver WebSocket closed (4001)`: no app is connected for that app name.
- `UiTester command "<command>" timed out`: Unity did not return a matching response before timeout.
