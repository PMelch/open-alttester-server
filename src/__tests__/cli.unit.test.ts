import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { resolvePort, runCli } from "../cli.ts";

const { version: PACKAGE_VERSION } = JSON.parse(
  readFileSync(join(dirname(fileURLToPath(import.meta.url)), "../../package.json"), "utf8"),
) as { version: string };

describe("resolvePort", () => {
  it("returns 13000 when no args and no env", () => {
    expect(resolvePort([], {})).toBe(13000);
  });

  it("reads --port <value>", () => {
    expect(resolvePort(["--port", "9000"], {})).toBe(9000);
  });

  it("reads -p <value>", () => {
    expect(resolvePort(["-p", "9000"], {})).toBe(9000);
  });

  it("reads --port=<value>", () => {
    expect(resolvePort(["--port=9000"], {})).toBe(9000);
  });

  it("reads ALTSERVER_PORT env", () => {
    expect(resolvePort([], { ALTSERVER_PORT: "7777" })).toBe(7777);
  });

  it("--port takes precedence over ALTSERVER_PORT env", () => {
    expect(resolvePort(["--port", "9000"], { ALTSERVER_PORT: "7777" })).toBe(9000);
  });

  it("throws on non-numeric --port value", () => {
    expect(() => resolvePort(["--port", "abc"], {})).toThrow();
  });

  it("throws on port 0", () => {
    expect(() => resolvePort(["--port", "0"], {})).toThrow();
  });

  it("throws on port > 65535", () => {
    expect(() => resolvePort(["--port", "99999"], {})).toThrow();
  });

  it("throws when --port flag has no following value", () => {
    expect(() => resolvePort(["--port"], {})).toThrow(/requires a value/);
  });

  it("throws when -p flag has no following value", () => {
    expect(() => resolvePort(["-p"], {})).toThrow(/requires a value/);
  });
});

describe("runCli", () => {
  it("starts the server on the port resolved from argv and returns the server instance", async () => {
    const logged: string[] = [];
    const origLog = console.log;
    console.log = (...args: unknown[]) => { logged.push(args.map(String).join(" ")); origLog(...args); };

    let server: Awaited<ReturnType<typeof runCli>>;
    try {
      server = await runCli(["--port", "13901"], {});
    } finally {
      console.log = origLog;
    }

    try {
      expect(server!.port).toBe(13901);
      const res = await fetch(`http://127.0.0.1:${server!.port}/`);
      expect(res.status).toBe(200);
      expect(logged[0]).toBe(`Open AltTester Server ${PACKAGE_VERSION}`);
    } finally {
      server!.stop();
    }
  });

  it('prints the version and exits 0 when argv is ["version"]', async () => {
    const logged: string[] = [];
    const origLog = console.log;
    console.log = (...args: unknown[]) => { logged.push(args.map(String).join(" ")); };

    let exitCode: number | undefined;
    const mockExit = (code: number): never => {
      exitCode = code;
      throw new Error("exit");
    };

    try {
      await runCli(["version"], {}, mockExit);
    } catch {
      // swallow the thrown "exit" sentinel
    } finally {
      console.log = origLog;
    }

    expect(exitCode).toBe(0);
    expect(logged).toHaveLength(1);
    expect(logged[0]).toBe(PACKAGE_VERSION);
    expect(logged[0]).not.toMatch(/^Open AltTester Server/);
  });
});
