---
id: TASK-1.2
title: Bootstrap Bun project structure
status: Done
assignee: []
created_date: '2026-04-10 05:31'
updated_date: '2026-04-10 06:10'
labels: []
dependencies:
  - TASK-1.1
parent_task_id: TASK-1
priority: high
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Set up the Bun project for the AltTester Desktop replacement. This is the foundation all other tasks build on. Project should live at the root of alt-tester-desktop-alt/. Tech stack: Bun runtime, TypeScript. Structure: src/server (WebSocket server), src/web (dashboard frontend, served statically), src/inspector (inspector logic). No framework needed for the web UI — plain HTML/CSS/JS or minimal vanilla approach.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 package.json initialised with bun, TypeScript configured
- [ ] #2 Entry point src/index.ts starts the app
- [ ] #3 bun run dev starts the server in watch mode
- [ ] #4 bun run start starts the server for production
- [ ] #5 Directory structure established: src/server/, src/web/, src/inspector/
<!-- AC:END -->
