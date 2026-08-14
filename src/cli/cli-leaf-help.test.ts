/**
 * Every legacy leaf command runs, says something, and treats `--help` as a success.
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
 * ## The exit code used to be excluded, and the exclusion was the bug
 *
 * This file used to say, twice: "Not the exit code, because several leaves print usage
 * and exit 1 when `--help` arrives without their positionals, which is fine and not what
 * this test is about."
 *
 * That is a description of a defect, written down as a fact of life. Seven leaves —
 * `diff html`, `diff browsers`, `inspect smoke`, `scan component`, `scan breakpoints`,
 * `watch`, `skill` — exited 1 for `--help`, while every gate command exits 0 through the
 * plugin runner (`GATE_EXIT_HELP` documents that contract). One CLI, two answers to
 * "did this invocation succeed", and a `set -e` script or a CI smoke step that runs
 * `vlmkit <cmd> --help` fails on half the commands.
 *
 * Three mechanisms produced it, and two of them were *trying* to get it right:
 *
 *   - `if (argv[0] === "--help") argv = []` — the line that routes help to the usage
 *     branch is also the line that destroys the evidence that help was asked for, so
 *     the branch exits 1 either way. `skill.ts` then wrote `process.exit(sub ? 0 : 1)`,
 *     which could never fire, because `sub` had already been erased.
 *   - no help branch at all (`diff html`, `inspect smoke`, `watch`): `--help` is not a
 *     file or a URL, so it fell into "no input" and took that branch's exit 1.
 *   - `if (!file) process.exit(1)` in `runDiscover`, which split on whether a file came
 *     *with* the help rather than on whether help was asked for.
 *
 * So the exit code is asserted now. Weak assertions elsewhere are still deliberate:
 * non-empty output rather than wording, because coupling this to copy edits is how a
 * test gets switched off.
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
import { legacyGroupLeaves, legacySpecLeaves } from "./cli.ts";

const VLMKIT_TS = resolve(fileURLToPath(import.meta.url), "..", "vlmkit.ts");

/**
 * Top-level delegated commands, which `legacySpecLeaves()` does not return — it walks
 * `GROUPS`, and these are their own `cli.command(...)` entries. Two of the seven
 * exit-1 leaves (`watch`, `skill`) lived here, invisible to this file entirely.
 *
 * Restated rather than derived because the router registers them one by one with
 * bespoke argument handling; `cli.test.ts` is what fails if this list goes stale
 * against the command table.
 */
const TOP_LEVEL = ["snapshot", "baseline", "watch", "diff-pr", "batch", "gates", "rules",
  "manifest", "markup-loop", "skill", "bench", "report", "migration", "workflow"] as const;

function runHelp(argv: string[]): { output: string; status: number | null } {
  const r = spawnSync(
    process.execPath,
    ["--experimental-strip-types", VLMKIT_TS, ...argv, "--help"],
    { encoding: "utf-8", env: { ...process.env, NO_COLOR: "1" }, timeout: 60_000 },
  );
  return { output: `${r.stdout ?? ""}${r.stderr ?? ""}`.trim(), status: r.status };
}

function assertHelpIsSuccessful(argv: string[], output: string, status: number | null): void {
  const name = `vlmkit ${argv.join(" ")}`;
  assert.notEqual(
    output,
    "",
    `\`${name} --help\` printed nothing. Its module's CLI guard did not fire — `
    + "most likely something imports it statically before `delegate` sets "
    + "__VLMKIT_DISPATCHER_LEAF__ (a gate module is the usual culprit). See page-render.ts.",
  );
  assert.doesNotMatch(
    output,
    /node:internal\/modules|Cannot find module|ERR_MODULE_NOT_FOUND/,
    `\`${name}\` failed to load its module: ${output.slice(0, 400)}`,
  );
  assert.equal(
    status,
    0,
    `\`${name} --help\` exited ${status}. Asking for help is a request that succeeded; `
    + "every gate command exits 0 through the plugin runner and these must match. If the "
    + "usage text is shared with the missing-arguments branch, keep an `askedForHelp` flag "
    + "before blanking argv and exit `askedForHelp ? 0 : 1`.\n\n"
    + output.slice(0, 400),
  );
}

describe("delegated leaf commands are reachable", { timeout: 300_000 }, () => {
  // `legacyGroupLeaves`, not `legacySpecLeaves`: the latter filters to delegated leaves,
  // which silently excluded the one `run:`-based leaf — `scan breakpoints`, which exited 1
  // for `--help`. The module-load assertions are harmless for a `run:` leaf and the
  // exit-code one is the point.
  const specLeaves = new Set(legacySpecLeaves().map(([g, l]) => `${g} ${l}`));
  for (const [group, leaf] of legacyGroupLeaves()) {
    const kind = specLeaves.has(`${group} ${leaf}`) ? "delegated" : "in-router";
    it(`\`vlmkit ${group} ${leaf} --help\` succeeds and produces output (${kind})`, () => {
      const { output, status } = runHelp([group, leaf]);
      assertHelpIsSuccessful([group, leaf], output, status);
    });
  }

  for (const command of TOP_LEVEL) {
    it(`\`vlmkit ${command} --help\` succeeds and produces output`, () => {
      const { output, status } = runHelp([command]);
      assertHelpIsSuccessful([command], output, status);
    });
  }
});
