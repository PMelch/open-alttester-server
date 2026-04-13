# Testing Rules

## Framework

- **Runtime**: Bun ≥ 1.0 or Node.js ≥ 20 — both supported
- **Test runner**: [vitest](https://vitest.dev/) — runs on both runtimes via `npm test` / `bunx vitest run`
- **Bun native runner**: `bun test` also works via `npm run test:bun` (Bun-only path)
- **BDD**: vitest `describe/it` blocks with Gherkin-style naming (`Given / When / Then`) for feature-level scenarios
- **Unit tests**: plain vitest `describe/it` blocks
- **Bun-only tests**: guard with `describe.skipIf(!isBun)` where `isBun = typeof globalThis.Bun !== 'undefined'`

## Test Commands

```bash
# Run all tests (Node.js / cross-runtime — recommended for CI)
npm test                     # vitest run
npm run test:watch           # vitest (watch mode)

# Run all tests (Bun native runner)
npm run test:bun             # bun test
npm run test:bun:watch       # bun test --watch
npm run test:bun:coverage    # bun test --coverage

# Run a specific file
bunx vitest run src/server/__tests__/registry.unit.test.ts

# Run tests matching a pattern
bunx vitest run --reporter=verbose -t "4001"
```

## Directory Structure

```
src/
  server/
    __tests__/
      registry.unit.test.ts       # ConnectionRegistry unit tests
      router.unit.test.ts         # Message router unit tests
      server.bdd.test.ts          # BDD feature scenarios for the server
  web/
    __tests__/
      dashboard.unit.test.ts
  inspector/
    __tests__/
      inspector.unit.test.ts
      inspector.bdd.test.ts
```

## BDD Naming Convention

High-level feature tests use Gherkin-style naming inside vitest:

```ts
import { describe, it } from "vitest";

describe("Feature: AltTester server connection management", () => {
  describe("Scenario: Unity app registers with server", () => {
    it("Given the server is running / When a Unity app connects / Then it is registered by appName", async () => { ... });
  });
});
```

## TDD Protocol

Follow Red-Green-Refactor strictly:

1. **RED**: Write the failing test first. Run `npm test` and confirm the failure is the expected one (missing implementation, not a syntax error).
2. **GREEN**: Write the minimum code to make it pass. Run `npm test` to confirm.
3. **REFACTOR**: Clean up, run `npm test` again after every change.

Never write implementation before a failing test exists.

## Test Isolation

- Each test must be fully isolated — no shared mutable state between tests.
- Use `beforeEach` / `afterEach` to set up and tear down servers on random ports.
- Prefer in-process testing: spin up a real server via `createAltTesterServer({ port: 0 })`, connect a real WebSocket client, then close both in `afterEach`.
- Mock only true external dependencies (filesystem, time-sensitive logic). Do not mock the WebSocket layer — use real connections.
- Use `waitForCondition(() => condition, timeoutMs)` instead of fixed `setTimeout` sleeps for async state checks.

## Port Allocation for Tests

Pass `port: 0` to `createAltTesterServer()` — the OS assigns a free port. Read it back via `srv.port`.

## What Requires Tests

- All public functions and classes: 100% coverage target
- Every close code path (4001, 4002, 4005, 4007, 4009)
- `driverRegistered` notification emission
- Message relay in both directions (driver→app, app→driver)
- Dashboard SSE/WS events on connect and disconnect
- Inspector command dispatch and response parsing
- Error paths (app disconnects, driver disconnects, malformed messages)
