import { describe, it } from "vitest";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { resolve } from "node:path";

const VLMKIT_TS = resolve(
  fileURLToPath(import.meta.url),
  "..",
  "vlmkit.ts",
);
const PACKAGE_VERSION = JSON.parse(
  readFileSync(resolve(import.meta.dirname!, "..", "..", "package.json"), "utf8"),
).version as string;

function runVrt(args: string[]): { stdout: string; stderr: string; status: number } {
  const r = spawnSync(
    process.execPath,
    ["--experimental-strip-types", VLMKIT_TS, ...args],
    // 30s, not 5s. Every case here spawns a real `node` that loads the CLI, and a help
    // path measures ~900ms on an idle machine — a 5x margin, which sounds ample and is not.
    // `node --test` runs this file alongside ~540 other suites, so the spawn competes with
    // dozens of processes: adding 62 tests to the suite was enough to start breaching it,
    // with a DIFFERENT subtest timing out each run and all 29 passing in isolation.
    //
    // The failure mode is what makes the low number wrong rather than merely tight: a
    // timeout here reports as an ordinary assertion failure on a help command, which reads
    // like a broken CLI verb. That sends the next person hunting a defect that is not there.
    // These cases assert command *wiring*, so they have no business being sensitive to how
    // busy the machine is.
    { encoding: "utf-8", env: { ...process.env, NO_COLOR: "1" }, timeout: 30_000 },
  );
  return {
    stdout: r.stdout ?? "",
    stderr: r.stderr ?? "",
    status: r.status ?? 1,
  };
}

describe("vlmkit CLI tree (cac-based)", () => {
  it("`vlmkit --version` matches the package release", () => {
    const r = runVrt(["--version"]);
    assert.equal(r.status, 0);
    assert.match(r.stdout, new RegExp(`vlmkit/${PACKAGE_VERSION.replaceAll(".", "\\.")}`));
  });

  it("`vlmkit --help` stays a compact command index", () => {
    const r = runVrt(["--help"]);
    assert.equal(r.status, 0);
    assert.ok(r.stdout.split("\n").length <= 60, "root help should fit in one terminal screen");
    assert.doesNotMatch(r.stdout, /CHECK THE PAGE YOU JUST WROTE OR EDITED/);
    assert.match(r.stdout, /Run `vlmkit <command> --help`/);
    assert.match(r.stdout, /check/);
    assert.match(r.stdout, /snapshot/);
  });

  it("`vlmkit diff` (group, no leaf) prints group usage", () => {
    const r = runVrt(["diff"]);
    assert.equal(r.status, 0);
    assert.match(r.stdout, /vlmkit diff <subcommand>/);
    assert.match(r.stdout, /html.*Compare two HTML/);
    assert.match(r.stdout, /png.*Compare existing PNG/);
    assert.doesNotMatch(r.stdout, /region.*VLM region diff/);
    assert.match(r.stdout, /matrix.*presence matrix/);
    assert.match(r.stdout, /component.*selector comparison/);
  });

  it("`vlmkit diff matrix --help` delegates to the presence-matrix helper", () => {
    const r = runVrt(["diff", "matrix", "--help"]);
    assert.equal(r.status, 0);
    assert.match(r.stdout, /vlmkit diff matrix --viewport/);
    assert.match(r.stdout, /presence matrix/i);
  });

  it("`vlmkit check` (group) prints group usage including a11y / drift", () => {
    const r = runVrt(["check"]);
    assert.equal(r.status, 0);
    assert.match(r.stdout, /a11y contrast/);
    assert.match(r.stdout, /a11y touch/);
    assert.match(r.stdout, /drift component/);
    assert.match(r.stdout, /drift pages/);
    assert.match(r.stdout, /tokens/);
    assert.match(r.stdout, /theme/);
    assert.match(r.stdout, /motion/);
    assert.match(r.stdout, /crater/);
  });

  it("single-token command help lists its own subcommands", () => {
    const api = runVrt(["api", "--help"]);
    assert.equal(api.status, 0);
    assert.match(api.stdout, /serve/);
    assert.match(api.stdout, /status/);

    const migration = runVrt(["migration", "--help"]);
    assert.equal(migration.status, 0);
    assert.match(migration.stdout, /compare/);
    assert.match(migration.stdout, /blind/);
    assert.match(migration.stdout, /subagent/);
  });

  it("standalone command help exits before doing command work", () => {
    const bench = runVrt(["bench", "--help"]);
    assert.equal(bench.status, 0);
    assert.match(bench.stdout, /vlmkit bench/);
    assert.match(bench.stdout, /--trials/);
  });

  it("`vlmkit diff png --help` delegates to the png-diff module's help", () => {
    const r = runVrt(["diff", "png", "--help"]);
    // png-diff exits 0 after printing help
    assert.match(r.stdout, /vlmkit diff png <baseline\.png> <current\.png>/);
  });

  it("removed `diff region` is rejected", () => {
    const r = runVrt(["diff", "region", "--help"]);
    assert.equal(r.status, 1);
    assert.match(r.stderr, /Unknown diff subcommand: region/);
  });

  it("`vlmkit diff component --help` delegates to element-level comparison help", () => {
    const r = runVrt(["diff", "component", "--help"]);
    assert.equal(r.status, 0);
    assert.match(r.stdout, /vlmkit diff component/);
    assert.match(r.stdout, /--selectors/);
  });

  it("removed top-level aliases are rejected", () => {
    for (const alias of ["png-diff", "graph", "flipbook", "serve", "status", "discover"]) {
      const r = runVrt([alias, "--help"]);
      assert.equal(r.status, 1, alias);
      assert.match(r.stderr, /Unknown command/, alias);
      assert.doesNotMatch(r.stderr, /deprecated/, alias);
    }
  });

  it("unknown command exits 1", () => {
    const r = runVrt(["does-not-exist"]);
    assert.equal(r.status, 1);
    assert.match(r.stderr, /Unknown command/);
  });

  it("`vlmkit workflow help` prints workflow usage", () => {
    const r = runVrt(["workflow", "help"]);
    assert.equal(r.status, 0);
    assert.match(r.stdout, /vlmkit workflow <command>/);
  });

  it("`vlmkit markup-loop help` prints the drop-in agent loop usage", () => {
    const r = runVrt(["markup-loop", "help"]);
    assert.equal(r.status, 0);
    assert.match(r.stdout, /vlmkit markup-loop <command>/);
    assert.match(r.stdout, /init/);
    assert.match(r.stdout, /observe/);
    assert.match(r.stdout, /doctor/);
    assert.match(r.stdout, /run/);
  });

  it("`vlmkit diff --help` prints diff group usage (regression: HELP_SENTINEL leaked through)", () => {
    const r = runVrt(["diff", "--help"]);
    assert.equal(r.status, 0);
    assert.match(r.stdout, /vlmkit diff <subcommand>/);
    assert.match(r.stdout, /png.*Compare existing PNG/);
  });

  it("`vlmkit check -h` prints check group usage", () => {
    const r = runVrt(["check", "-h"]);
    assert.equal(r.status, 0);
    assert.match(r.stdout, /vlmkit check <subcommand>/);
    assert.match(r.stdout, /a11y contrast/);
  });

  it("`vlmkit snapshot flipbook` routes to flipbook-cli (not snapshot.ts)", () => {
    const r = runVrt(["snapshot", "flipbook", "--help"]);
    assert.doesNotMatch(r.stderr, /\[vlmkit deprecated\]/);
  });

  it("`vlmkit snapshot strip` routes to strip-cli", () => {
    // The still-image sibling of `flipbook`; both are special-cased under
    // `snapshot` because snapshot.ts has no such mode.
    const r = runVrt(["snapshot", "strip", "--help"]);
    assert.equal(r.status, 0);
    assert.match(r.stdout, /vlmkit snapshot strip <frame1\.png>/);
    assert.doesNotMatch(r.stderr, /\[vlmkit deprecated\]/);
  });

  it("`vlmkit snapshot record-har` routes to record-har-cli", () => {
    // `--har` was the documented reproducibility answer with no way to produce one;
    // v5's CI agent wrote its own recorder to finish the task it was given.
    const r = runVrt(["snapshot", "record-har", "--help"]);
    assert.equal(r.status, 0);
    assert.match(r.stdout, /vlmkit snapshot record-har <url>/);
    assert.doesNotMatch(r.stderr, /\[vlmkit deprecated\]/);
  });

  it("`vlmkit contract` prints contract group usage", () => {
    const r = runVrt(["contract"]);
    assert.equal(r.status, 0);
    assert.match(r.stdout, /vlmkit contract <subcommand>/);
    assert.match(r.stdout, /introspect.*Infer UI Contract/);
    assert.match(r.stdout, /validate.*Validate UI Contract/);
  });

  it("`vlmkit contract introspect --help` delegates to the introspector", () => {
    const r = runVrt(["contract", "introspect", "--help"]);
    assert.equal(r.status, 0);
    assert.match(r.stdout, /vlmkit contract introspect <html-file-or-url>/);
  });

  it("`vlmkit build gallery --help` delegates to the story-gallery scaffolder", () => {
    const r = runVrt(["build", "gallery", "--help"]);
    assert.equal(r.status, 0);
    assert.match(r.stdout, /vlmkit build gallery <html-file-or-url>/);
    // The two flags that make the output reviewable rather than magic.
    assert.match(r.stdout, /--selector/);
    assert.match(r.stdout, /--noise-pixels/);
  });

  it("`vlmkit check motion --help` delegates to motion detection help", () => {
    const r = runVrt(["check", "motion", "--help"]);
    assert.equal(r.status, 0);
    assert.match(r.stdout, /vlmkit check motion <html-or-url>/);
    assert.match(r.stdout, /--fail-on-suspect/);
  });

  it("`vlmkit scan mock --help` delegates to the mock intake help", () => {
    const r = runVrt(["scan", "mock", "--help"]);
    assert.equal(r.status, 0);
    assert.match(r.stdout, /vlmkit scan mock <image.png>/);
    assert.match(r.stdout, /--width <px>/);
  });

  it("`vlmkit check scroll --help` delegates to the scroll-behavior help", () => {
    const r = runVrt(["check", "scroll", "--help"]);
    assert.equal(r.status, 0);
    assert.match(r.stdout, /vlmkit check scroll <html-or-url>/);
    assert.match(r.stdout, /snap containers must land/);
  });

  it("`vlmkit check copy --help` delegates to the copy-fidelity help", () => {
    const r = runVrt(["check", "copy", "--help"]);
    assert.equal(r.status, 0);
    assert.match(r.stdout, /vlmkit check copy <html-or-url>/);
    assert.match(r.stdout, /--manifest <file>/);
  });

  it("`vlmkit verify markup --help` delegates to the markup verifier help", () => {
    const r = runVrt(["verify", "markup", "--help"]);
    assert.equal(r.status, 0);
    assert.match(r.stdout, /vlmkit verify markup <attempt.html>/);
    assert.match(r.stdout, /--reference <html>/);
  });

  it("`vlmkit check animation --help` delegates to the animation evaluator help", () => {
    const r = runVrt(["check", "animation", "--help"]);
    assert.equal(r.status, 0);
    assert.match(r.stdout, /vlmkit check animation <html-or-url>/);
    assert.match(r.stdout, /--frames <dir>/);
    assert.match(r.stdout, /--skip-reduced-motion/);
  });

  it("`vlmkit scan scroll --help` delegates to the scroll inventory help", () => {
    const r = runVrt(["scan", "scroll", "--help"]);
    assert.equal(r.status, 0);
    assert.match(r.stdout, /vlmkit scan scroll <html-or-url>/);
    assert.match(r.stdout, /expectedScrollports/);
  });

  it("`vlmkit check breakpoints --help` delegates to the boundary quickcheck help", () => {
    const r = runVrt(["check", "breakpoints", "--help"]);
    assert.equal(r.status, 0);
    assert.match(r.stdout, /vlmkit check breakpoints <html-or-url>/);
    assert.match(r.stdout, /B-1 \/ B \/ B\+1/);
    assert.match(r.stdout, /--breakpoints <list>/);
  });

  it("`vlmkit check crater --help` delegates to Crater smoke help", () => {
    const r = runVrt(["check", "crater", "--help"]);
    assert.equal(r.status, 0);
    assert.match(r.stdout, /vlmkit check crater/);
    assert.match(r.stdout, /--require/);
  });
});
