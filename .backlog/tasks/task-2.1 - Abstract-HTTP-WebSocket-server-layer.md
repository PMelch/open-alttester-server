---
id: TASK-2.1
title: Abstract HTTP + WebSocket server layer
status: Done
assignee: []
created_date: '2026-04-13 07:10'
updated_date: '2026-04-13 08:26'
labels: []
dependencies: []
references:
  - src/server/server.ts
parent_task_id: TASK-2
priority: high
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
src/server/server.ts calls Bun.serve<WsData>() at line 53, importing type ServerWebSocket from 'bun' at line 1. This is the single biggest blocker: Bun.serve provides HTTP routing AND WebSocket upgrade/open/message/close handlers in one call. On Node.js the equivalent requires node:http + the 'ws' package wired together manually.

The task is to define a runtime-agnostic ServerAdapter interface and provide two implementations — one wrapping Bun.serve (unchanged behaviour) and one wrapping node:http + ws. createAltTesterServer() detects the runtime or accepts an adapter via options and delegates to the appropriate implementation. The public API (port, registry, feed, stop()) must stay identical.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 A ServerAdapter interface is defined with at minimum: listen(port), close(), and the ability to register HTTP and WebSocket handlers
- [x] #2 BunServerAdapter wraps the existing Bun.serve call and all current behaviour is preserved
- [x] #3 NodeServerAdapter uses node:http + ws package and exposes the same handler surface
- [x] #4 createAltTesterServer() auto-detects runtime (typeof Bun !== 'undefined') and picks the correct adapter; adapter can also be injected via options for testing
- [x] #5 WebSocket open/message/close callbacks receive a connection object that implements the same interface on both adapters (send, close, data attachment)
- [x] #6 server.bdd.test passes on both runtimes with no test-code changes
- [x] #7 inspector.bdd.test passes on both runtimes with no test-code changes
- [x] #8 ws is added as a runtime dependency in package.json
<!-- AC:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
ServerAdapter interface (adapter.ts) + BunServerAdapter (adapters/bun.ts) + NodeServerAdapter (adapters/node.ts) implemented. createAltTesterServer() auto-detects runtime via typeof Bun. Adapter injectable via opts for testing. WsHandle identity guaranteed via WeakMap. Bun.BufferSource removed from WsConn, import.meta.dir replaced with fileURLToPath. ws@8.20.0 added as runtime dep. 87 tests green (8 new unit tests, 0 regressions). 3 review rounds with codex, 3 issues fixed (R1-1 package.json files, R1-2 async null→404, R2-1 binary frame corruption).
<!-- SECTION:FINAL_SUMMARY:END -->
