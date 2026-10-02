/**
 * The README's workspace map is the current one: regenerate with
 * `pnpm exec vlmkit-anim repo --mermaid` when a package or a workspace dependency changes.
 *
 * This was a test inside `packages/vlmkit-anim`. The package moved to mizchi/explainer
 * (0.24), where its own tests run on a copy of these manifests; whether THIS README is
 * current is this repository's question, answered with the package from npm.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { test } from "vitest";
import { workspaceMermaid } from "@mizchi/vlmkit-anim/generators/git.ts";

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "..");

test("the README's workspace diagram is the current one", () => {
  const fence = workspaceMermaid(repoRoot).match(/```mermaid\n[\s\S]*?```/)[0];
  assert.ok(
    readFileSync(join(repoRoot, "README.md"), "utf8").includes(fence),
    "README.md's ```mermaid workspace block is stale — run `pnpm exec vlmkit-anim repo --mermaid` and paste it:\n" + fence,
  );
});
