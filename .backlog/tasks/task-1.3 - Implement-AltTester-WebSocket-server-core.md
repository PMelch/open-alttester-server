---
id: TASK-1.3
title: Implement AltTester WebSocket server core
status: In Progress
assignee: []
created_date: '2026-04-10 05:31'
updated_date: '2026-04-10 06:10'
labels: []
dependencies:
  - TASK-1.2
references:
  - >-
    AltTester-Unity-SDK/Assets/AltTester/Runtime/AltDriver/Communication/DriverWebSocketClient.cs
  - AltTester-Unity-SDK/Bindings~/python/alttester/_websocket.py
parent_task_id: TASK-1
priority: high
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Implement the core WebSocket server — the primary mandatory feature. The server must replicate the routing behaviour of the AltTester Desktop server. Protocol summary (from TASK-1.1 analysis): Unity apps and Python drivers both connect to the same WebSocket server. Connection URL: ws://host:13000/?appName=...&platform=...&platformVersion=...&deviceInstanceId=...&driverType=... Unity side uses driverType=SDK, driver side identifies as a different driverType. The server matches pairs by appName, relays all messages between the pair, and sends the correct WebSocket close codes on lifecycle events: 4001 (no app connected), 4002 (app disconnected), 4005 (duplicate driver), 4007 (driver already trying to connect).
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Server starts on port 13000 by default (configurable via ALTSERVER_PORT env var)
- [ ] #2 Unity SDK clients connect and are registered by appName
- [ ] #3 Python/driver clients connect and are paired with a matching Unity app by appName
- [ ] #4 Messages from driver are forwarded to the paired Unity app and vice versa
- [ ] #5 Close code 4001 sent to driver when no matching Unity app is connected
- [ ] #6 Close code 4002 sent to driver when the paired Unity app disconnects mid-session
- [ ] #7 Close code 4005 sent to driver when another driver is already paired with the target app
- [ ] #8 Close code 4007 sent to driver when another driver is already waiting to pair
- [ ] #9 driverRegistered notification sent to driver after successful pairing (matching original SDK behaviour)
<!-- AC:END -->
