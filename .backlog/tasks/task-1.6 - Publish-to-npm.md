---
id: TASK-1.6
title: Publish to npm
status: Done
assignee: []
created_date: '2026-04-10 06:47'
updated_date: '2026-04-13 07:13'
labels: []
dependencies:
  - TASK-1.4
parent_task_id: TASK-1
priority: medium
---
## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Package and publish the AltTester Server to npm so users can run it without cloning the repo. The package should expose a CLI entry point so users can start the server with a single npx/bunx command. README must document the npm-based usage alongside the existing from-source instructions.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 package.json has a `bin` field pointing to the CLI entry point
- [x] #2 CLI entry point is executable and starts the server (same behaviour as `bun run start`)
- [x] #3 `bunx alt-tester-server` starts the server on port 13000
- [x] #4 `bunx alt-tester-server --port 9000` (or ALTSERVER_PORT=9000) starts on a custom port
- [x] #5 package.json has correct `name`, `version`, `description`, `license`, `files` and `engines` fields
- [x] #6 README documents: install globally (`bun install -g alt-tester-server`), run via bunx (`bunx alt-tester-server`), and custom port usage
- [ ] #7 Package published to npm registry and `bunx alt-tester-server` resolves correctly
<!-- AC:END -->
