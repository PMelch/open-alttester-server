# AltTester WebSocket Protocol

Source: analysed from `AltTester-Unity-SDK/` (commit at research time).

---

## Overview

Two clients connect to the same WebSocket server and are bridged together by **appName**:

| Role | Who | `driverType` param |
|------|-----|--------------------|
| **App** (Unity game) | `RuntimeWebSocketClient` (C#) | `SDK` |
| **Driver** (test code) | `WebsocketConnection` (Python) / `DriverWebSocketClient` (C#) | `SDK` (default) or custom |

The server pairs one App with one Driver per appName and relays all messages between them.

---

## Connection URL

```
ws[s]://<host>:<port><path>?appName=<name>&platform=<p>&platformVersion=<v>&deviceInstanceId=<id>&driverType=<t>[&appId=<id>]
```

| Parameter | Required | Notes |
|-----------|----------|-------|
| `appName` | Yes | Pairing key. Default `__default__` |
| `platform` | Yes | e.g. `Editor`, `Android`, `iOS`, `unknown` |
| `platformVersion` | Yes | OS/engine version string |
| `deviceInstanceId` | Yes | Unique device/instance ID |
| `driverType` | Yes | `SDK` for Unity app side; test drivers use `SDK` or custom string |
| `appId` | No | Optional secondary ID |

- Default port: **13000** (override via `ALTSERVER_PORT` env var)
- Unity app path: **`/altws/app`** (from `BaseCommunicationHandler` → `private readonly string path = "/altws/app"`)
- Driver path: **`/altws`** (from `DriverWebSocketClient` hardcoded `"/altws"`, Python: `path="altws"`)
- Live-update path: **`/altws/live-update/app`** (Unity app opens this after receiving `AppId`; server accepts it for AltDialog connection state)
- Default `appName`: `__default__`
- Scheme: `ws` (plain) or `wss` (TLS — requires non-GPL SDK build)

---

## Connection Lifecycle

### 1. App (Unity) connects

Unity SDK connects first. Server registers the App keyed by `appName`.

Server sends the App an `AppId` command. `AltDialog` uses this value to open the live-update channel and mark the server connection as established:

```json
{
  "commandName": "AppId",
  "driverId": "<8-hex app id>"
}
```

### 1a. App live-update channel connects

Unity SDK connects a second app-side WebSocket to `/altws/live-update/app` with the received `appId`. The server accepts this socket but does not start screenshot streaming unless a future live-update controller sends `Start`.

### 2. Driver connects

Driver connects with the same `appName`. Server checks:

| Condition | Action |
|-----------|--------|
| No App registered for `appName` | Close driver with **4001** |
| App already has an active Driver | Close new driver with **4005** |
| App already has a driver *trying* to connect | Close new driver with **4007** |
| App available | Pair App ↔ Driver, send `driverRegistered` notification to Driver |

### 3. driverRegistered notification

Server sends this JSON to the Driver to signal successful pairing. Both Python and C# clients wait up to **5 seconds** for this message before considering the connection failed.

```json
{
  "isNotification": true,
  "commandName": "driverRegistered",
  "data": ""
}
```

Detection in client: string-contains check `"driverRegistered" in message` (not strict JSON parse).

The server also sends the App a Unity-side lifecycle notification so `AltDialog` can hide itself:

```json
{
  "isNotification": true,
  "commandName": "DriverConnectedNotification",
  "driverId": "<driver deviceInstanceId>"
}
```

### 4. Message relay

After pairing, all messages from Driver are forwarded verbatim to App, and vice versa. The server is a transparent relay — it does not inspect or transform message content.

### 5. Driver disconnects

Server removes the pairing and sends the App this Unity-side lifecycle notification so `AltDialog` can show itself again:

```json
{
  "isNotification": true,
  "commandName": "DriverDisconnectedNotification",
  "driverId": "<driver deviceInstanceId>"
}
```

### 6. App disconnects mid-session

Server closes the Driver connection with **4002**. The Python client (`_on_close`) automatically calls `connect()` again on 4002 — it will retry until timeout.

### 7. Max connections (4009)

Close code **4009** = `MaxNoOfConnectionsDriversExceededException` — too many drivers connected globally (not per-app).

---

## WebSocket Close Codes

| Code | Exception (Python) | Meaning |
|------|--------------------|---------|
| 4001 | `NoAppConnected` | No Unity app connected for that appName |
| 4002 | `AppDisconnectedError` | App disconnected while driver was paired; driver auto-retries |
| 4005 | `MultipleDriverError` | Another driver already paired with this app |
| 4007 | `MultipleDriversTryingToConnectException` | Another driver is mid-handshake for this app |
| 4009 | `MaxNoOfConnectionsDriversExceededException` | Server-level connection cap exceeded |

---

## Message Envelope (JSON)

### Command (Driver → App, relayed verbatim)

```json
{
  "commandName": "<camelCase command>",
  "messageId": "<microsecond timestamp string>",
  "parameters": { ... }
}
```

`messageId` is generated as `str((datetime.now(UTC) - EPOCH).microseconds)` — microseconds component only (0–999999), not globally unique across seconds. Used by client to match responses.

### Response (App → Driver, relayed verbatim)

```json
{
  "commandName": "<same as request>",
  "messageId": "<same as request>",
  "data": "<JSON string or null>",
  "error": {
    "type": "<errorKey>",
    "message": "<human message>",
    "trace": "<stack trace>"
  }
}
```

`data` is a **JSON-encoded string** (double-encoded), not an inline object. Clients call `json.loads(response["data"])` to deserialise it.

`error` is present only on failure; `data` is present only on success.

### Notification (App → Driver, unsolicited)

```json
{
  "isNotification": true,
  "commandName": "<notificationName>",
  "data": "<JSON string>"
}
```

Known notification `commandName` values:
- `driverRegistered` — pairing complete (checked via string-contains, not JSON parse)
- `loadSceneNotification` — scene was loaded; data: `{ "sceneName": "...", "loadSceneMode": <int> }`
- `unloadSceneNotification` — scene was unloaded
- `logNotification` — Unity log entry; data: `{ "message": "...", "stack_trace": "...", "level": "..." }`
- `applicationPausedNotification` — app paused/resumed; data: bool

---

## Known Command Names (Python bindings)

Scene/app state:
- `getCurrentScene` → `{ "name": "<scene>" }`
- `getAllLoadedScenes` → `["scene1", "scene2"]`
- `loadScene`
- `getServerVersion`

Object finding:
- `findObject`, `findObjects`, `findObjectWhichContains`, `findObjectsWhichContains`, `findObjectAtCoordinates`

Input:
- `clickElement`, `tapElement`, `tapCoordinates`, `clickCoordinates`
- `keysDown`, `keysUp`, `pressKeyboardKeys`
- `beginTouch`, `moveTouch`, `endTouch`
- `moveMouse`, `scroll`, `swipe`, `multipointSwipe`, `tilt`
- `resetInput`

Object inspection:
- `getObjectComponentProperty`, `setObjectComponentProperty`
- `callComponentMethodForObject`
- `getText`, `setText`
- `getStaticProperty`, `setStaticProperty`
- `getVisualElementProperty`
- `getPNGScreenshot`

PlayerPrefs:
- `getKeyPlayerPref`, `setKeyPlayerPref`, `deleteKeyPlayerPref`, `deletePlayerPrefs`

Timing:
- `getTimeScale`, `setTimeScale`

Notifications:
- `activateNotification`, `deactivateNotification`

Server config:
- `setServerLogging`

---

## Error Types (from App responses)

| `error.type` string | Python exception |
|---------------------|-----------------|
| `notFound` | `NotFoundException` |
| `objectNotFound` | `ObjectNotFoundException` |
| `sceneNotFound` | `SceneNotFoundException` |
| `cameraNotFound` | `CameraNotFoundException` |
| `propertyNotFound` | `PropertyNotFoundException` |
| `methodNotFound` | `MethodNotFoundException` |
| `componentNotFound` | `ComponentNotFoundException` |
| `assemblyNotFound` | `AssemblyNotFoundException` |
| `invalidCommand` | `InvalidCommandException` |
| `invalidPath` | `InvalidPathException` |
| `couldNotPerformOperation` | `CouldNotPerformOperationException` |
| `couldNotParseJsonString` | `CouldNotParseJsonStringException` |
| `failedToParseMethodArguments` | `FailedToParseArgumentsException` |
| `unknownError` | `UnknownErrorException` |
| `ALTTESTERNotAddedAsDefineVariable` | `AltTesterInputModuleException` |
