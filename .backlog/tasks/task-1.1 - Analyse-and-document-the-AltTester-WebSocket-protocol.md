---
id: TASK-1.1
title: Analyse and document the AltTester WebSocket protocol
status: Done
assignee: []
created_date: '2026-04-10 05:31'
updated_date: '2026-04-10 05:47'
labels: []
dependencies: []
references:
  - >-
    AltTester-Unity-SDK/Assets/AltTester/Runtime/AltDriver/Communication/Utils.cs
  - >-
    AltTester-Unity-SDK/Assets/AltTester/Runtime/AltDriver/Communication/DriverWebSocketClient.cs
  - AltTester-Unity-SDK/Bindings~/python/alttester/_websocket.py
parent_task_id: TASK-1
priority: high
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Before implementing the server, fully understand the communication protocol by reading the SDK source. Both sides connect to the same server via WebSocket — Unity apps connect as driverType=SDK and Python drivers connect as driverType=SDK (or other). The server routes messages between matched pairs based on appName. Key files in AltTester-Unity-SDK/: Assets/AltTester/Runtime/AltDriver/Communication/Utils.cs (URI construction), Assets/AltTester/Runtime/AltDriver/Communication/DriverWebSocketClient.cs (close codes 4001/4002/4005/4007), Assets/AltTester/Runtime/Communication/RuntimeWebSocketClient.cs (Unity side), Bindings~/python/alttester/_websocket.py (Python driver side).
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 WebSocket connection URL format documented (scheme, host, port, path, all query params: appName, platform, platformVersion, deviceInstanceId, driverType, appId)
- [ ] #2 Close codes documented: 4001 NoAppConnected, 4002 AppDisconnected, 4005 MultipleDrivers, 4007 MultipleDriversTryingToConnect
- [ ] #3 Message JSON envelope format documented (commandName, messageId, data fields)
- [ ] #4 Connection lifecycle documented: how Unity app and driver are matched (by appName), how server notifies driver registration, how pairing works
- [ ] #5 Commands relevant to Inspector documented: GetCurrentScene, GetAllLoadedScenes, and hierarchy/scene response shape
<!-- AC:END -->
