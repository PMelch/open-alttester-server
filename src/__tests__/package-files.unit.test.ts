import { describe, expect, it } from "vitest";
import { dirname, extname, join, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import ts from "typescript";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const sourceExtensions = [".ts", ".tsx", ".js", ".mjs", ".json"] as const;

function packageAllowlistFiles(): Set<string> {
  const pkg = JSON.parse(readFileSync(join(root, "package.json"), "utf8")) as { files: string[] };
  return new Set(pkg.files.flatMap(entry => filesForPackageEntry(entry)));
}

function filesForPackageEntry(entry: string): string[] {
  const absolute = join(root, entry);
  if (!existsSync(absolute)) return [];

  const stat = statSync(absolute);
  if (stat.isFile()) return [toPackagePath(entry)];
  if (!stat.isDirectory()) return [];

  return readdirSync(absolute, { withFileTypes: true }).flatMap(dirent =>
    filesForPackageEntry(join(entry, dirent.name))
  );
}

function toPackagePath(path: string): string {
  return path.split(sep).join("/");
}

function resolveRelativeImport(importer: string, specifier: string): string | null {
  const base = resolve(dirname(importer), specifier);
  const candidates = extname(base)
    ? [base]
    : [
        ...sourceExtensions.map(extension => `${base}${extension}`),
        ...sourceExtensions.map(extension => join(base, `index${extension}`)),
      ];

  return candidates.find(candidate => existsSync(candidate) && statSync(candidate).isFile()) ?? null;
}

describe("npm package files", () => {
  it("include every relative source import reachable from packaged TypeScript and JavaScript", () => {
    const files = packageAllowlistFiles();
    const packagedSources = [...files].filter(file =>
      (file.startsWith("src/") || file.startsWith("bin/")) &&
      [".ts", ".tsx", ".js", ".mjs"].includes(extname(file))
    );

    const missingImports = packagedSources.flatMap(file => {
      const importer = join(root, file);
      const contents = ts.sys.readFile(importer) ?? "";
      const imports = [...new Set(ts.preProcessFile(contents, true, true).importedFiles
        .map(imported => imported.fileName)
        .filter(specifier => specifier.startsWith(".")))];

      return imports.flatMap(specifier => {
        const resolved = resolveRelativeImport(importer, specifier);
        if (!resolved) return [];

        const packedPath = toPackagePath(relative(root, resolved));
        return files.has(packedPath) ? [] : [`${file} imports ${specifier} -> ${packedPath}`];
      });
    });

    expect(missingImports).toEqual([]);
  });
});
