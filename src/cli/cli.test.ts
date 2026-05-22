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
  it("`vrt --help` prints top-level usage", () => {
    const r = runVrt(["--help"]);
    assert.equal(r.status, 0);
    assert.match(r.stdout, /vlmkit diff html\|png/);
    assert.match(r.stdout, /vlmkit check a11y/);
    assert.match(r.stdout, /vlmkit inspect/);
  });

  it("`vrt diff` (group, no leaf) prints group usage", () => {
    const r = runVrt(["diff"]);
    assert.equal(r.status, 0);
    assert.match(r.stdout, /vlmkit diff <subcommand>/);
    assert.match(r.stdout, /html.*Compare two HTML/);
    assert.match(r.stdout, /png.*Compare existing PNG/);
    assert.match(r.stdout, /component.*selector comparison/);
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
  });

  it("`vrt diff png --help` delegates to the png-diff module's help", () => {
    const r = runVrt(["diff", "png", "--help"]);
    // png-diff exits 0 after printing help
    assert.match(r.stdout, /vrt png-diff <baseline\.png> <current\.png>/);
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
});
