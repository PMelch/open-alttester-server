# Testing Rules

## Framework

- **Runtime**: Bun
- **Test runner**: `bun:test` (built-in, Jest-compatible API)
- **BDD**: `bun:test` describe/it blocks used with Gherkin-style naming (`Given / When / Then`) for feature-level scenarios
- **Unit tests**: plain `bun:test` describe/it blocks

## Test Commands

```bash
# Run all tests
bun test

# Run tests in watch mode
bun test --watch

# Run a specific file
bun test src/server/__tests__/registry.test.ts

# Run tests matching a pattern
bun test --test-name-pattern "4001"

# Coverage (built-in)
bun test --coverage
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

High-level feature tests use Gherkin-style naming inside `bun:test`:

```ts
describe("Feature: AltTester server connection management", () => {
  describe("Scenario: Unity app registers with server", () => {
    it("Given the server is running / When a Unity app connects / Then it is registered by appName", async () => { ... });
  });
});
```

## TDD Protocol

Follow Red-Green-Refactor strictly:

1. **RED**: Write the failing test first. Run `bun test` and confirm the failure is the expected one (missing implementation, not a syntax error).
2. **GREEN**: Write the minimum code to make it pass. Run `bun test` to confirm.
3. **REFACTOR**: Clean up, run `bun test` again after every change.

Never write implementation before a failing test exists.

## Test Isolation

- Each test must be fully isolated — no shared mutable state between tests.
- Use `beforeEach` / `afterEach` to set up and tear down WebSocket servers on random ports.
- Prefer in-process testing: spin up a real `Bun.serve()` server on a random port (pass `port: 0`), connect a real WebSocket client, then close both in `afterEach`.
- Mock only true external dependencies (filesystem, time-sensitive logic). Do not mock the WebSocket layer — use real connections.

## Port Allocation for Tests

Pass `port: 0` to `Bun.serve()` in tests — the OS assigns a free port. Read it back via `server.port`.

## What Requires Tests

- All public functions and classes: 100% coverage target
- Every close code path (4001, 4002, 4005, 4007, 4009)
- `driverRegistered` notification emission
- Message relay in both directions (driver→app, app→driver)
- Dashboard SSE/WS events on connect and disconnect
- Inspector command dispatch and response parsing
- Error paths (app disconnects, driver disconnects, malformed messages)
