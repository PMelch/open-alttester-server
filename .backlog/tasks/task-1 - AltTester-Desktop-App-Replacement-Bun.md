---
id: TASK-1
title: AltTester Desktop App Replacement (Bun)
status: To Do
assignee: []
created_date: '2026-04-10 05:31'
labels: []
dependencies: []
priority: high
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Build a Bun-based replacement for the proprietary AltTester Desktop app. The original app provides a licensed server that bridges WebSocket connections between Unity apps (instrumented with the AltTester Unity SDK) and Python/dotnet/etc. test drivers. This replacement must be open-source, license-free, and run as a Bun (Node-compatible) app. It exposes a web UI for monitoring. Default server port: 13000. SDK source is cloned at AltTester-Unity-SDK/.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 AltTester WebSocket server runs on Bun and accepts connections from both Unity SDK clients and Python driver clients
- [ ] #2 Web dashboard shows connected Unity apps, connected test drivers, and active pairings
- [ ] #3 Inspector feature lets user select a connected Unity app and view its current scene hierarchy
<!-- AC:END -->
