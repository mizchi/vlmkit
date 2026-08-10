/**
 * The two CLI entry points must dispatch identically.
 *
 * There are two: `src/cli/vlmkit.ts`, which the workspace runs, and
 * `scripts/vlmkit-bundled.mjs`, which `tsdown.config.ts` builds into the published `bin`.
 * The bundled one exists only to inject the generated MoonBit bridge before loading the CLI
 * — everything else about it should be the workspace entry.
 *
 * ## Why a general guard rather than a fourth specific one
 *
 * That file has now diverged from its twin three times, and each divergence was invisible in
 * the repo and total in the shipped CLI:
 *
 * 1. It injected only `run_markup_core`, so every JSON-boundary command in the published CLI
 *    fell back to shelling out to `moon build` (see `markup-core-injection.test.mjs`).
 * 2. It caught errors with a bare `console.error(error); process.exit(1)`, so every
 *    prettifier in `cli-error.ts` — ENOENT, EISDIR, missing-browser — was dead in the
 *    published CLI. That is what vlmkit#112 reported (see `playwright-peer-contract.test.mjs`).
 * 3. Both of the above were live at the same time, and the person who fixed (1) was editing
 *    the very lines that carried (2).
 *
 * Each got its own regression test *after* it bit. That accumulates guards for the failures
 * already found and none for the next one. This test asserts the invariant instead: whatever
 * the workspace entry does with `runCli`, the bundled entry does the same. A new
 * responsibility added to one is a failure here rather than a silent gap in the shipped
 * binary.
 *
 * Text comparison is deliberate. The bundled entry cannot be imported in a test — it runs the
 * CLI on load — and the failure being guarded is a source-level divergence, so source is the
 * right thing to read.
 */
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { resolve } from "node:path";

const ROOT = resolve(fileURLToPath(import.meta.url), "..", "..");
const WORKSPACE = resolve(ROOT, "src/cli/vlmkit.ts");
const BUNDLED = resolve(ROOT, "scripts/vlmkit-bundled.mjs");

/**
 * The `runCli(...)` call and everything chained onto it, comments and whitespace removed.
 *
 * This is the line that decides what a user sees when anything fails, which is why it is the
 * thing compared. Chaining is captured to the statement's end so a `.catch()` swapped for a
 * `.then()`, or a second handler appended, both register.
 */
function dispatchExpression(file) {
  // Comments are stripped BEFORE the search, not after. Both entries describe themselves as
  // a "thin shim around `runCli()`" in their header comment, so searching the raw source finds
  // the prose first and compares two doc sentences — which is what the first version of this
  // test did, and it "failed" on files that were correct.
  const source = readFileSync(file, "utf8")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/\/\/[^\n]*/g, "");
  const start = source.indexOf("runCli(");
  assert.notEqual(start, -1, `${file} does not call runCli — did the entry point change shape?`);
  const end = source.indexOf(";", start);
  assert.notEqual(end, -1, `${file}: unterminated runCli statement`);
  return source.slice(start, end).replace(/\s+/g, "");
}

describe("CLI entry points dispatch identically", () => {
  it("the bundled entry runs the CLI exactly as the workspace entry does", () => {
    assert.equal(
      dispatchExpression(BUNDLED),
      dispatchExpression(WORKSPACE),
      "scripts/vlmkit-bundled.mjs (the published `bin`) and src/cli/vlmkit.ts must invoke and "
      + "guard runCli the same way. A difference here is invisible in the workspace and total "
      + "in the shipped CLI — it has happened three times. If the bundled entry genuinely needs "
      + "to differ, change both and say why in a comment.",
    );
  });

  it("both route failures through the shared prettifier", () => {
    // Stated separately from the equality above so the failure message names the stake rather
    // than printing two strings for the reader to diff. `handleCliError` turns a Playwright
    // stack or an ENOENT into one line; a bare console.error does not.
    for (const file of [WORKSPACE, BUNDLED]) {
      assert.match(
        dispatchExpression(file),
        /\.catch\(handleCliError\)/,
        `${file} must end in .catch(handleCliError) — a bare console.error ships raw stacks`,
      );
      assert.match(
        readFileSync(file, "utf8"),
        /import .*handleCliError.* from/,
        `${file} must import handleCliError`,
      );
    }
  });

  it("the bundled entry adds the bridge injection and nothing else", () => {
    // The one thing it is allowed to do differently. Asserted so "identical dispatch" cannot
    // be satisfied by deleting the injection, which would break the published CLI in the
    // other direction.
    const bundled = readFileSync(BUNDLED, "utf8");
    assert.match(bundled, /globalThis\.__MIZCHI_VLMKIT_MARKUP_CORE_API__ = /);
    assert.doesNotMatch(
      readFileSync(WORKSPACE, "utf8"),
      /__MIZCHI_VLMKIT_MARKUP_CORE_API__/,
      "the workspace entry resolves the bridge from disk; it must not need the global",
    );
  });
});
