import { test } from "vite-plus/test";
import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import { join } from "node:path";

const repoRoot = join(import.meta.dirname, "..");
const workflowsDir = join(repoRoot, ".github", "workflows");

/**
 * package.json names pnpm's version (`packageManager`). `pnpm/action-setup` refuses to run when a
 * workflow names one too ("Multiple versions of pnpm specified"), and the only workflow left on it,
 * publish.yml, is the one that runs only on a release tag: v0.28.0's publish stopped there.
 */
test("no workflow gives pnpm/action-setup a version beside package.json's packageManager", async () => {
  const { packageManager } = JSON.parse(await readFile(join(repoRoot, "package.json"), "utf8"));
  assert.match(packageManager, /^pnpm@\d+\.\d+\.\d+$/);

  const offenders = [];
  for (const name of await readdir(workflowsDir)) {
    if (!/\.ya?ml$/.test(name)) continue;
    const lines = (await readFile(join(workflowsDir, name), "utf8")).split("\n");
    lines.forEach((line, i) => {
      const step = line.match(/^(\s*)-?\s*uses: pnpm\/action-setup@/);
      if (!step) return;
      const indent = step[1].length;
      for (let j = i + 1; j < lines.length; j++) {
        const next = lines[j];
        if (next.trim() === "") continue;
        if (next.match(/^\s*/)[0].length <= indent) break;
        if (/^\s*version:/.test(next)) offenders.push(`${name}:${j + 1}`);
      }
    });
  }
  assert.deepEqual(offenders, []);
});
