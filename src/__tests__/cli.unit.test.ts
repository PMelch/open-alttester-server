import { describe, it, expect } from "bun:test";
import { resolvePort } from "../cli.ts";

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
});
