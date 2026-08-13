/**
 * Every legacy leaf command runs and says something.
 *
 * These leaves have no handler the router calls. `delegate` sets
 * `__VLMKIT_DISPATCHER_LEAF__` and imports the leaf's module, whose top-level
 * `isCliEntry` guard invokes `main()`. The command *is* the module's evaluation, so
 * anything that breaks the evaluation — a moved file, a throwing top-level, a bad
 * specifier, a leaf added to `GROUPS` with a `spec` that does not resolve — deletes
 * the command rather than failing it. Nothing else in the repo exercises that path;
 * these commands have no unit tests because their logic is tested through their
 * modules' exports, which is exactly the coverage shape that lets the *command*
 * disappear while every test stays green.
 *
 * The assertion is deliberately weak — output is non-empty, and it is not a Node
 * module-resolution trace. Not the exit code, because several leaves print usage and
 * exit 1 when `--help` arrives without their positionals. Not the wording, because
 * that would couple this to copy edits and get switched off.
 *
 * **What this does NOT catch**, and the reason `gate-entry-isolation.test.ts` exists:
 * the ESM-cache collision that killed `vlmkit build page`. Run from source, a leaf's
 * relative import and `delegate`'s package specifier resolve to different URLs, so
 * Node holds two module instances and the guard fires on the second. The collision
 * appears only once the bundler merges them into one chunk. Spawning from source
 * therefore passes with the bug present — verified — so that invariant is checked
 * structurally instead.
 */
import { describe, it } from "vitest";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { resolve } from "node:path";
import { legacySpecLeaves } from "./cli.ts";

const VLMKIT_TS = resolve(fileURLToPath(import.meta.url), "..", "vlmkit.ts");

describe("delegated leaf commands are reachable", { timeout: 180_000 }, () => {
  for (const [group, leaf] of legacySpecLeaves()) {
    it(`\`vlmkit ${group} ${leaf} --help\` produces output`, () => {
      const r = spawnSync(
        process.execPath,
        ["--experimental-strip-types", VLMKIT_TS, group, leaf, "--help"],
        { encoding: "utf-8", env: { ...process.env, NO_COLOR: "1" }, timeout: 60_000 },
      );
      const output = `${r.stdout ?? ""}${r.stderr ?? ""}`.trim();
      assert.notEqual(
        output,
        "",
        `\`vlmkit ${group} ${leaf}\` printed nothing. Its module's CLI guard did not fire — `
        + "most likely something imports it statically before `delegate` sets "
        + "__VLMKIT_DISPATCHER_LEAF__ (a gate module is the usual culprit). See page-render.ts.",
      );
      // Not the exit code: several leaves print usage and exit 1 when `--help`
      // arrives without the positionals they require, which is fine and not what
      // this test is about. What must not happen is the module failing to load.
      assert.doesNotMatch(
        output,
        /node:internal\/modules|Cannot find module|ERR_MODULE_NOT_FOUND/,
        `\`vlmkit ${group} ${leaf}\` failed to load its module: ${output.slice(0, 400)}`,
      );
    });
  }
});
