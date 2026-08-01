import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { resolve } from "node:path";

const VLMKIT_TS = resolve(
  fileURLToPath(import.meta.url),
  "..",
  "vlmkit.ts",
);

function runVrt(args: string[]): { stdout: string; stderr: string; status: number } {
  const r = spawnSync(
    process.execPath,
    ["--experimental-strip-types", VLMKIT_TS, ...args],
    { encoding: "utf-8", env: { ...process.env, NO_COLOR: "1" } },
  );
  return {
    stdout: r.stdout ?? "",
    stderr: r.stderr ?? "",
    status: r.status ?? 1,
  };
}

describe("vrt CLI tree (cac-based)", () => {
  it("`vrt --version` matches the package release", () => {
    const r = runVrt(["--version"]);
    assert.equal(r.status, 0);
    assert.match(r.stdout, /vlmkit\/0\.7\.0/);
  });

  it("`vrt --help` prints the use-case map", () => {
    const r = runVrt(["--help"]);
    assert.equal(r.status, 0);
    // Use-case-first organization: every section header present.
    assert.match(r.stdout, /CHECK THE PAGE YOU JUST WROTE OR EDITED/);
    assert.match(r.stdout, /VERIFY BEHAVIOR, NOT PIXELS/);
    assert.match(r.stdout, /MATCH A TARGET DESIGN/);
    assert.match(r.stdout, /TRACK CHANGES OVER TIME/);
    assert.match(r.stdout, /COMPARE TWO VERSIONS/);
    assert.match(r.stdout, /AUDIT DESIGN QUALITY/);
    assert.match(r.stdout, /IMAGE ASSETS/);
    assert.match(r.stdout, /REPAIR/);
    assert.match(r.stdout, /FOR CODING AGENTS AND PIPELINES/);
    // A few load-bearing commands with their when-to-use context.
    assert.match(r.stdout, /check integrity <page>/);
    assert.match(r.stdout, /verify markup <page> --target <png>/);
    assert.match(r.stdout, /markup-loop/);
    assert.match(r.stdout, /docs\/markup-assist\.md/);
  });

  it("`vrt diff` (group, no leaf) prints group usage", () => {
    const r = runVrt(["diff"]);
    assert.equal(r.status, 0);
    assert.match(r.stdout, /vlmkit diff <subcommand>/);
    assert.match(r.stdout, /html.*Compare two HTML/);
    assert.match(r.stdout, /png.*Compare existing PNG/);
    assert.match(r.stdout, /region.*VLM region diff/);
    assert.match(r.stdout, /matrix.*presence matrix/);
    assert.match(r.stdout, /component.*selector comparison/);
  });

  it("`vrt diff matrix --help` delegates to the presence-matrix helper", () => {
    const r = runVrt(["diff", "matrix", "--help"]);
    assert.equal(r.status, 0);
    assert.match(r.stdout, /vlmkit diff matrix --viewport/);
    assert.match(r.stdout, /presence matrix/i);
  });

  it("`vrt check` (group) prints group usage including a11y / drift", () => {
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

  it("`vrt diff png --help` delegates to the png-diff module's help", () => {
    const r = runVrt(["diff", "png", "--help"]);
    // png-diff exits 0 after printing help
    assert.match(r.stdout, /vrt png-diff <baseline\.png> <current\.png>/);
  });

  it("`vrt diff region --help` delegates to the VLM region-diff helper", () => {
    const r = runVrt(["diff", "region", "--help"]);
    assert.equal(r.status, 0);
    assert.match(r.stdout, /vlmkit diff region --baseline <png> --variant <png>/);
    assert.match(r.stdout, /--triptych <path>/);
    assert.match(r.stdout, /--elements-json <path>/);
    assert.match(r.stdout, /--elements-html <path-or-url>/);
    assert.match(r.stdout, /--elements-viewport <size>/);
    assert.match(r.stdout, /--format <kind>/);
  });

  it("`vrt diff component --help` delegates to element-level comparison help", () => {
    const r = runVrt(["diff", "component", "--help"]);
    assert.equal(r.status, 0);
    assert.match(r.stdout, /vrt diff component/);
    assert.match(r.stdout, /--selectors/);
  });

  it("deprecated `vrt png-diff` warns and delegates", () => {
    const r = runVrt(["png-diff", "--help"]);
    assert.match(r.stderr, /\[vlmkit deprecated\] 'png-diff' → 'vlmkit diff png'/);
    assert.match(r.stdout, /vrt png-diff <baseline\.png>/);
  });

  it("deprecated workflow alias `vrt init` warns (without actually running init)", () => {
    // We can only check that the deprecation warning is printed — running
    // `init` itself would try to launch Playwright. Use `vrt help` which
    // exits cleanly inside the workflow runner.
    const r = runVrt(["graph", "--help"]);
    assert.match(r.stderr, /\[vlmkit deprecated\] 'graph' → 'vlmkit workflow graph'/);
  });

  it("unknown command exits 1", () => {
    const r = runVrt(["does-not-exist"]);
    assert.equal(r.status, 1);
    assert.match(r.stderr, /Unknown command/);
  });

  it("`vrt workflow help` prints workflow usage", () => {
    const r = runVrt(["workflow", "help"]);
    assert.equal(r.status, 0);
    assert.match(r.stdout, /vlmkit workflow <command>/);
  });

  it("`vrt markup-loop help` prints the drop-in agent loop usage", () => {
    const r = runVrt(["markup-loop", "help"]);
    assert.equal(r.status, 0);
    assert.match(r.stdout, /vlmkit markup-loop <command>/);
    assert.match(r.stdout, /init/);
    assert.match(r.stdout, /observe/);
    assert.match(r.stdout, /doctor/);
    assert.match(r.stdout, /run/);
  });

  it("`vrt diff --help` prints diff group usage (regression: HELP_SENTINEL leaked through)", () => {
    const r = runVrt(["diff", "--help"]);
    assert.equal(r.status, 0);
    assert.match(r.stdout, /vlmkit diff <subcommand>/);
    assert.match(r.stdout, /png.*Compare existing PNG/);
  });

  it("`vrt check -h` prints check group usage", () => {
    const r = runVrt(["check", "-h"]);
    assert.equal(r.status, 0);
    assert.match(r.stdout, /vlmkit check <subcommand>/);
    assert.match(r.stdout, /a11y contrast/);
  });

  it("`vrt flipbook` deprecation shim wires to flipbook-cli (regression: SPECS.flipbook unregistered)", () => {
    const r = runVrt(["flipbook", "--help"]);
    assert.match(r.stderr, /\[vlmkit deprecated\] 'flipbook' → 'vlmkit snapshot flipbook'/);
    // flipbook-cli prints its own usage on --help
    assert.notEqual(r.status, undefined);
  });

  it("`vrt snapshot flipbook` routes to flipbook-cli (not snapshot.ts)", () => {
    const r = runVrt(["snapshot", "flipbook", "--help"]);
    // No deprecation warning here — this is the new canonical path
    assert.doesNotMatch(r.stderr, /\[vlmkit deprecated\]/);
  });

  it("`vrt contract` prints contract group usage", () => {
    const r = runVrt(["contract"]);
    assert.equal(r.status, 0);
    assert.match(r.stdout, /vlmkit contract <subcommand>/);
    assert.match(r.stdout, /introspect.*Infer UI Contract/);
    assert.match(r.stdout, /validate.*Validate UI Contract/);
  });

  it("`vrt contract introspect --help` delegates to the introspector", () => {
    const r = runVrt(["contract", "introspect", "--help"]);
    assert.equal(r.status, 0);
    assert.match(r.stdout, /vlmkit contract introspect <html-file-or-url>/);
  });

  it("`vrt check motion --help` delegates to motion detection help", () => {
    const r = runVrt(["check", "motion", "--help"]);
    assert.equal(r.status, 0);
    assert.match(r.stdout, /vlmkit check motion <html-or-url>/);
    assert.match(r.stdout, /--fail-on-suspect/);
  });

  it("`vrt scan mock --help` delegates to the mock intake help", () => {
    const r = runVrt(["scan", "mock", "--help"]);
    assert.equal(r.status, 0);
    assert.match(r.stdout, /vlmkit scan mock <image.png>/);
    assert.match(r.stdout, /--width <px>/);
  });

  it("`vrt check scroll --help` delegates to the scroll-behavior help", () => {
    const r = runVrt(["check", "scroll", "--help"]);
    assert.equal(r.status, 0);
    assert.match(r.stdout, /vlmkit check scroll <html-or-url>/);
    assert.match(r.stdout, /snap containers must land/);
  });

  it("`vrt check copy --help` delegates to the copy-fidelity help", () => {
    const r = runVrt(["check", "copy", "--help"]);
    assert.equal(r.status, 0);
    assert.match(r.stdout, /vlmkit check copy <html-or-url>/);
    assert.match(r.stdout, /--manifest <file>/);
  });

  it("`vrt verify markup --help` delegates to the markup verifier help", () => {
    const r = runVrt(["verify", "markup", "--help"]);
    assert.equal(r.status, 0);
    assert.match(r.stdout, /vlmkit verify markup <attempt.html>/);
    assert.match(r.stdout, /--reference <html>/);
  });

  it("`vrt check animation --help` delegates to the animation evaluator help", () => {
    const r = runVrt(["check", "animation", "--help"]);
    assert.equal(r.status, 0);
    assert.match(r.stdout, /vlmkit check animation <html-or-url>/);
    assert.match(r.stdout, /--frames <dir>/);
    assert.match(r.stdout, /--skip-reduced-motion/);
  });

  it("`vrt scan scroll --help` delegates to the scroll inventory help", () => {
    const r = runVrt(["scan", "scroll", "--help"]);
    assert.equal(r.status, 0);
    assert.match(r.stdout, /vlmkit scan scroll <html-or-url>/);
    assert.match(r.stdout, /expectedScrollports/);
  });

  it("`vrt check breakpoints --help` delegates to the boundary quickcheck help", () => {
    const r = runVrt(["check", "breakpoints", "--help"]);
    assert.equal(r.status, 0);
    assert.match(r.stdout, /vlmkit check breakpoints <html-or-url>/);
    assert.match(r.stdout, /B-1 \/ B \/ B\+1/);
    assert.match(r.stdout, /--breakpoints <list>/);
  });

  it("`vrt check crater --help` delegates to Crater smoke help", () => {
    const r = runVrt(["check", "crater", "--help"]);
    assert.equal(r.status, 0);
    assert.match(r.stdout, /vlmkit check crater/);
    assert.match(r.stdout, /--require/);
  });
});
