---
id: TASK-1.4
title: Web dashboard — connection stats and monitoring
status: To Do
assignee: []
created_date: '2026-04-10 05:31'
updated_date: '2026-04-10 05:32'
labels: []
dependencies:
  - TASK-1.3
parent_task_id: TASK-1
priority: high
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Build the web dashboard served by the Bun HTTP server alongside the WebSocket server. The dashboard is a real-time status page showing all currently connected Unity apps and test drivers, active pairings, and server stats. Use WebSocket or SSE from the dashboard to the server for live updates. Keep the UI simple — plain HTML/JS, no bundler required (can use a single-file approach). Server must serve the static page on GET /.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Dashboard served at http://localhost:13000/ (or configurable port)
- [ ] #2 Lists all connected Unity apps with: appName, platform, platformVersion, deviceInstanceId, connection time
- [ ] #3 Lists all connected test drivers with: driverType, appName target, connection time, paired status
- [ ] #4 Active pairings shown (which driver is paired with which Unity app)
- [ ] #5 Dashboard updates in real time when connections are made or dropped (WebSocket or SSE)
- [ ] #6 Basic server stats shown: uptime, total connections served
<!-- AC:END -->
