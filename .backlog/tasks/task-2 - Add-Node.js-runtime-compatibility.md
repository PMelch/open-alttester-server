---
id: TASK-2
title: Add Node.js runtime compatibility
status: Done
assignee: []
created_date: '2026-04-13 07:09'
updated_date: '2026-04-14 08:00'
labels: []
dependencies: []
priority: high
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
The server is currently hard-coupled to Bun.serve for HTTP + WebSocket handling, making Node.js incompatible. This initiative refactors the runtime-specific surface so the package can run on both Bun (≥1.0) and Node.js (≥20 LTS). The four layers of Bun coupling are: (1) Bun.serve HTTP/WS server, (2) Bun-specific types (ServerWebSocket, Bun.BufferSource, import.meta.dir), (3) bun:test framework in all test files, (4) package.json / tsconfig wired exclusively for Bun.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Package starts and serves traffic when run with node (>=20 LTS)
- [x] #2 Package starts and serves traffic when run with bun (>=1.0) — no regression
- [x] #3 All existing BDD tests pass on both runtimes
- [x] #4 README documents how to run with each runtime
- [x] #5 engines field in package.json reflects both supported runtimes
<!-- AC:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Node.js runtime support added across four layers: (1) ServerAdapter interface with BunServerAdapter/NodeServerAdapter; (2) Bun-specific types removed; (3) bun:test → vitest migration; (4) bin, package.json, tsconfig, README, CI updated. Package runs on Bun ≥1.0 and Node.js ≥20. All 87 tests pass on both runtimes.
<!-- SECTION:FINAL_SUMMARY:END -->
