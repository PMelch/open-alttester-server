import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { resolveMcpConfig, resolvePort, runCli } from "../cli.ts";

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

describe("resolveMcpConfig", () => {
  it("returns undefined when no MCP flags or env are set", () => {
    expect(resolveMcpConfig([], {})).toBeUndefined();
  });

  it("reads --mcp-all", () => {
    expect(resolveMcpConfig(["--mcp-all"], {})).toEqual({ mode: "all" });
  });

  it("reads repeatable --mcp-app flags as selected mode", () => {
    expect(resolveMcpConfig(["--mcp-app", "GameA", "--mcp-app", "GameB"], {})).toEqual({
      mode: "selected",
      enabledApps: ["GameA", "GameB"],
    });
  });

  it("reads --mcp-app=name", () => {
    expect(resolveMcpConfig(["--mcp-app=MyGame"], {})).toEqual({
      mode: "selected",
      enabledApps: ["MyGame"],
    });
  });

  it("reads ALTSERVER_MCP_ALL env", () => {
    expect(resolveMcpConfig([], { ALTSERVER_MCP_ALL: "1" })).toEqual({ mode: "all" });
  });

  it("reads comma-separated ALTSERVER_MCP_APP env as selected mode", () => {
    expect(resolveMcpConfig([], { ALTSERVER_MCP_APP: "A, B" })).toEqual({
      mode: "selected",
      enabledApps: ["A", "B"],
    });
  });

  it("throws when --mcp-app has no following value", () => {
    expect(() => resolveMcpConfig(["--mcp-app"], {})).toThrow(/requires a value/);
  });

  it("throws when combining --mcp-all with --mcp-app", () => {
    expect(() => resolveMcpConfig(["--mcp-all", "--mcp-app", "X"], {})).toThrow(/Cannot combine/);
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
      expect(logged[0]).toBe(`Open UITester Server ${PACKAGE_VERSION}`);
    } finally {
      server!.stop();
    }
  });

  it("enables MCP for all apps when started with --mcp-all", async () => {
    let server: Awaited<ReturnType<typeof runCli>>;
    try {
      server = await runCli(["--port", "13902", "--mcp-all"], {});
    } finally {
      // console.log restored by other tests if needed
    }

    try {
      const state = await fetch(`http://127.0.0.1:${server!.port}/dashboard/state`).then((r) => r.json()) as {
        mcp: { mode: string; enabledApps: string[] };
      };
      expect(state.mcp).toEqual({ mode: "all", enabledApps: [], activeSessions: 0 });
    } finally {
      server!.stop();
    }
  });

  it("enables MCP for a specific app when started with --mcp-app", async () => {
    let server: Awaited<ReturnType<typeof runCli>>;
    try {
      server = await runCli(["--port", "13903", "--mcp-app", "LaunchGame"], {});
    } finally {
      // noop
    }

    try {
      const state = await fetch(`http://127.0.0.1:${server!.port}/dashboard/state`).then((r) => r.json()) as {
        mcp: { mode: string; enabledApps: string[] };
      };
      expect(state.mcp).toEqual({
        mode: "selected",
        enabledApps: ["LaunchGame"],
        activeSessions: 0,
      });
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
    expect(logged[0]).not.toMatch(/^Open UITester Server/);
  });
});
