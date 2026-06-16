
<!-- SKILLS_ACTIVATION_START -->
# Project Instructions
- Active global skills: `backlog-workflow`, `context-hunter`.
- MCP/skill parity: any change to the MCP server implementation, exposed tools, JSON-RPC behavior, command allowlist, dashboard MCP configuration, or related tests must also update the independent skill implementation in `skill/open-uitester-tools/`. The skill must not call or depend on the MCP server.
- Every release must add its changes to `CHANGELOG.md`.
- Any dashboard layout change must also update the relevant screenshots and their descriptions.
- Before changing `CHANGELOG.md` or screenshots, ask the user for manual confirmation.
<!-- SKILLS_ACTIVATION_END -->


## Agent Documentation Index

### `.agent/docs/` — Reference documentation

| File | Contents |
|------|----------|
| [`protocol.md`](.agent/docs/protocol.md) | Full AltTester® Unity SDK WebSocket protocol: connection URL format, query params, lifecycle, close codes (4001/4002/4005/4007/4009), message envelope (command/response/notification JSON shapes), all known command names, error types |

### `.agent/rules/` — Process rules

| File | Topic |
|------|-------|
| [`testing.md`](.agent/rules/testing.md) | Test framework (bun:test), test commands, BDD naming convention, TDD protocol, port allocation for tests, isolation rules, coverage targets |
| [`workflow.md`](.agent/rules/workflow.md) | Pair programmer config, mandatory commit-after-each-step policy, task execution order, task status update process |
| [`project-structure.md`](.agent/rules/project-structure.md) | Directory layout, runtime/language choices, npm scripts, environment variables, TypeScript config |
