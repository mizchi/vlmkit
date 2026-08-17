import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { resolve } from "node:path";
import { test } from "vitest";

const ROOT = resolve(import.meta.dirname, "..");
const sourceFiles = execFileSync("git", ["ls-files", "src/**/*.ts", "packages/*/src/**/*.ts"], {
  cwd: ROOT,
  encoding: "utf8",
}).split("\n").filter(Boolean);

test("runtime source contains no deprecated compatibility API", () => {
  const forbidden = [
    /@deprecated/,
    /\bcheckA11yTree\b/,
    /\bevaluateDomEquivalence\b/,
    /\bderiveComponentContractRuntime\b/,
    /\bminOverlapRatio\b/,
    /vlmkit diff region/,
    /\bDEPRECATED\b/,
  ];
  const findings = [];
  for (const file of sourceFiles) {
    const sourcePath = resolve(ROOT, file);
    if (!existsSync(sourcePath)) continue;
    const text = readFileSync(sourcePath, "utf8");
    for (const pattern of forbidden) {
      if (pattern.test(text)) findings.push(`${file}: ${pattern}`);
    }
  }
  assert.deepEqual(findings, [], findings.join("\n"));
});

test("deprecated CLI and project-name compatibility modules are removed", () => {
  assert.equal(existsSync(resolve(ROOT, "src/cli/deprecation.ts")), false);
  assert.equal(existsSync(resolve(ROOT, "packages/vlmkit-core/src/legacy-names.ts")), false);
  assert.equal(existsSync(resolve(ROOT, "packages/vlmkit-core/src/project-config.ts")), true);

  const cli = readFileSync(resolve(ROOT, "src/cli/cli.ts"), "utf8");
  assert.doesNotMatch(cli, /DEPRECATED_TOP_LEVEL|WORKFLOW_ALIASES|reportDeprecation|\[DEPRECATED\]/);
});

test("migration tools use only diff-report.json", () => {
  const findings = [];
  for (const file of sourceFiles) {
    const sourcePath = resolve(ROOT, file);
    if (!existsSync(sourcePath)) continue;
    const text = readFileSync(sourcePath, "utf8");
    if (text.includes("migration-report.json")) findings.push(file);
  }
  assert.deepEqual(findings, [], findings.join("\n"));
});
