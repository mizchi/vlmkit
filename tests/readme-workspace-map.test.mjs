/**
 * The README's workspace map is the current one: regenerate with
 * `node scripts/workspace-map.mjs --write` when a package or a workspace dependency changes.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { test } from "vite-plus/test";
import { workspaceMermaid } from "../scripts/workspace-map.mjs";

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "..");

test("the README's workspace diagram is the current one", () => {
  const fence = workspaceMermaid(repoRoot);
  assert.ok(
    readFileSync(join(repoRoot, "README.md"), "utf8").includes(fence),
    "README.md's ```mermaid workspace block is stale — run `node scripts/workspace-map.mjs --write`:\n" + fence,
  );
});
