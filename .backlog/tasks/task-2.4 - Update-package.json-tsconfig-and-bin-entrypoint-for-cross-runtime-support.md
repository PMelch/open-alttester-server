---
id: TASK-2.4
title: 'Update package.json, tsconfig and bin entrypoint for cross-runtime support'
status: Done
assignee: []
created_date: '2026-04-13 07:10'
updated_date: '2026-04-13 13:41'
labels: []
dependencies:
  - TASK-2.1
  - TASK-2.2
  - TASK-2.3
references:
  - package.json
  - tsconfig.json
  - bin/open-alttester-server.ts
parent_task_id: TASK-2
priority: high
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Once the code is runtime-agnostic, the project configuration must reflect and enable that:

1. package.json engines field currently declares only bun >=1.0.0 — must add node >=20.0.0.
2. package.json scripts (dev, start, test) use 'bun' directly — Node.js equivalents must be added or the existing scripts documented.
3. bin/open-alttester-server.ts shebang is '#!/usr/bin/env bun' — must fall back gracefully or the package must expose a node-compatible CLI entry that uses node.
4. tsconfig.json moduleResolution is 'bundler' (Bun/webpack compatible) — must be changed to 'nodenext' or 'node16' for Node.js ESM compatibility, or a second tsconfig for Node.js provided.
5. A GitHub Actions workflow (.github/workflows/ci.yml) should be added running tests on both Bun and Node.js to prevent regressions.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 package.json engines lists both node: '>=20.0.0' and bun: '>=1.0.0'
- [x] #2 npm start / node src/index.js (or equivalent compiled output) starts the server on Node.js
- [x] #3 npm test runs the full test suite on Node.js using the framework from TASK-2.3
- [x] #4 Bun scripts (dev, start:bun, test:bun) still work unchanged for Bun users
- [x] #5 bin shebang updated to '#!/usr/bin/env node' or a dual shebang / wrapper is provided; npx open-alttester-server works on Node.js
- [x] #6 tsconfig.json compiles without errors using tsc (Node.js native TypeScript runner or tsc CLI)
- [x] #7 GitHub Actions workflow added: matrix of [bun, node@20] runs install, typecheck, and test steps
- [x] #8 README updated with Node.js installation and startup instructions alongside the Bun instructions
<!-- AC:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Node.js-compatible CLI bin wrapper (bin/open-alttester-server.js) spawns tsx from the package's own node_modules, works with npx/npm i -g. start/test scripts updated: npm start uses tsx, test uses vitest. tsconfig.node.json added (bundler + allowJs + includes bin/). typescript added to devDeps. CI matrix added (Node 20, Node 22, Bun latest). README updated with Node.js quick-start, removed Bun-only requirement. Pair-programmer review approved after 2 rounds.
<!-- SECTION:FINAL_SUMMARY:END -->
