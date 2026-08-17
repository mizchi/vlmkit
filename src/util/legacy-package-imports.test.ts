import assert from "node:assert/strict";
import { readdir, readFile } from "node:fs/promises";
import { extname, join, relative } from "node:path";
import { existsSync } from "node:fs";
import { test } from "vitest";

type LegacyImport = {
  file: string;
  specifier: string;
};

const legacyScope = "@mizchi/" + "vrt-";
/**
 * `e2e` was here until the capture spec was retired (it is now
 * `packages/vlmkit-capture/src/route-capture.ts`, already covered by `packages`). Filtered
 * rather than just shortened: `readdir` throws ENOENT on a missing root, so this file failed
 * with a scandir error about a directory instead of reporting anything about imports.
 */
const sourceRoots = (["src", "packages", "e2e"] as const)
  .filter((root) => existsSync(new URL(`../../${root}`, import.meta.url)));
const ignoredDirectories = new Set(["node_modules", "dist", "_build"]);
const sourceExtensions = new Set([".ts", ".tsx", ".mts", ".cts", ".js", ".jsx", ".mjs", ".cjs"]);

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

const legacyImportPattern = new RegExp(
  String.raw`(?:\bfrom\s*["']|\bimport\s*(?:\(\s*)?["']|\brequire\s*\(\s*["'])(${escapeRegExp(legacyScope)}[^"']+)`,
  "g",
);

function findLegacyPackageImportsInText(content: string): string[] {
  return [...content.matchAll(legacyImportPattern)].map((match) => match[1]);
}

async function collectSourceFiles(dir: string): Promise<string[]> {
  const entries = await readdir(dir, { withFileTypes: true });
  const files: string[] = [];
  for (const entry of entries) {
    if (entry.isDirectory()) {
      if (!ignoredDirectories.has(entry.name)) {
        files.push(...await collectSourceFiles(join(dir, entry.name)));
      }
      continue;
    }
    if (!entry.isFile()) continue;
    if (sourceExtensions.has(extname(entry.name))) {
      files.push(join(dir, entry.name));
    }
  }
  return files.sort();
}

async function findLegacyPackageImports(repoRoot: string): Promise<LegacyImport[]> {
  const findings: LegacyImport[] = [];
  for (const sourceRoot of sourceRoots) {
    const files = await collectSourceFiles(join(repoRoot, sourceRoot));
    for (const file of files) {
      const content = await readFile(file, "utf8");
      for (const specifier of findLegacyPackageImportsInText(content)) {
        findings.push({ file: relative(repoRoot, file), specifier });
      }
    }
  }
  return findings;
}

test("detects legacy VRT package import specifiers", () => {
  const captureConfig = legacyScope + "capture/capture-config.ts";
  const corePackage = legacyScope + "core";
  const aiPackage = legacyScope + "ai";
  const content = [
    `import { resolveCaptureRoutes } from "${captureConfig}";`,
    `import "${captureConfig}";`,
    `await import("${corePackage}");`,
    `const provider = require("${aiPackage}");`,
    `export { diffA11yTrees } from "${corePackage}";`,
    `"${captureConfig}"`,
  ].join("\n");

  assert.deepEqual(findLegacyPackageImportsInText(content), [
    captureConfig,
    captureConfig,
    corePackage,
    aiPackage,
    corePackage,
  ]);
});

test("source tree does not import legacy VRT package names", async () => {
  const findings = await findLegacyPackageImports(process.cwd());
  const message = findings.map((finding) => `${finding.file}: ${finding.specifier}`).join("\n");
  assert.deepEqual(findings, [], message);
});
