import { describe, it, expect } from "bun:test";
import { existsSync } from "fs";
import { join } from "path";

const root = join(import.meta.dir, "../..");

describe("Project bootstrap", () => {
  it("src/index.ts exists", () => {
    expect(existsSync(join(root, "src/index.ts"))).toBe(true);
  });

  it("src/server/ directory exists", () => {
    expect(existsSync(join(root, "src/server"))).toBe(true);
  });

  it("src/web/ directory exists", () => {
    expect(existsSync(join(root, "src/web"))).toBe(true);
  });

  it("src/inspector/ directory exists", () => {
    expect(existsSync(join(root, "src/inspector"))).toBe(true);
  });

  it("tsconfig.json exists", () => {
    expect(existsSync(join(root, "tsconfig.json"))).toBe(true);
  });

  it("package.json has dev and start scripts", async () => {
    const pkg = await import(join(root, "package.json"));
    expect(pkg.scripts?.dev).toBeDefined();
    expect(pkg.scripts?.start).toBeDefined();
  });
});
