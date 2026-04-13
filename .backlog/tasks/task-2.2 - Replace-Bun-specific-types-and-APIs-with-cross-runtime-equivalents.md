---
id: TASK-2.2
title: Replace Bun-specific types and APIs with cross-runtime equivalents
status: Done
assignee: []
created_date: '2026-04-13 07:10'
updated_date: '2026-04-13 09:39'
labels: []
dependencies:
  - TASK-2.1
references:
  - src/server/registry.ts
  - src/web/handler.ts
  - tsconfig.json
parent_task_id: TASK-2
priority: high
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Three Bun-specific constructs exist outside the server adapter itself and must be replaced with portable equivalents:

1. src/server/registry.ts line 15 — Bun.BufferSource used as the WebSocket message data type in the WsConn interface.
2. src/web/handler.ts line 5 — import.meta.dir used to resolve the path to the dashboard HTML file.
3. tsconfig.json — types: ['bun-types'] pulls in global Bun types; this must be conditionalised or replaced.

None of these changes should alter runtime behaviour. The replacements are purely type/path API swaps.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Bun.BufferSource in registry.ts replaced with ArrayBuffer | ArrayBufferView | string (the WebSocket message union that is valid on both runtimes)
- [x] #2 import.meta.dir in handler.ts replaced with fileURLToPath(new URL('.', import.meta.url)) which works on both Bun and Node.js ESM
- [x] #3 tsconfig.json no longer requires bun-types; Bun types are added only via a bun-specific tsconfig extension (tsconfig.bun.json) or via import type {} from 'bun' in Bun-only files
- [x] #4 No TypeScript errors on tsc --noEmit for Node.js-targeted compilation
- [x] #5 No TypeScript errors on bun run tsc --noEmit with Bun types available
- [x] #6 dashboard.bdd.test passes on both runtimes (validates the import.meta.dir fix)
<!-- AC:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
AC#1 (Bun.BufferSource) und AC#2 (import.meta.dir) waren bereits durch TASK-2.1 erledigt. AC#3: tsconfig.json ist jetzt Node.js-Baseline ohne bun-types; tsconfig.bun.json ist die neue Bun-Extension (extends base, adds bun-types+node). AC#4+5: beide tsc --noEmit Checks exit 0. AC#6: dashboard.bdd.test passt (87/87). Fixes: bun.ts erhielt triple-slash reference + TS2345/TS2322 Korrekturen; server.ts verwendet typeof globals[Bun] statt typeof Bun; package.json hat typecheck-Scripts und @types/node. 2 Review-Runden; R1-1 (moduleResolution:bundler) rebuttiert und akzeptiert.
<!-- SECTION:FINAL_SUMMARY:END -->
