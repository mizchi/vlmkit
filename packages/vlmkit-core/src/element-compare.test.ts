import { describe, it } from "vitest";
import assert from "node:assert/strict";
import { resolve } from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { runElementCompare, type ElementCompareOptions } from "./element-compare.ts";

const FIXTURE_DIR = resolve(import.meta.dirname!, "../../../fixtures/element-compare");

describe("element-compare", () => {
  it("isolates header change from cascading shift", async () => {
    const options: ElementCompareOptions = {
      selectors: ["header", "main", "footer"],
      baselineFile: resolve(FIXTURE_DIR, "before.html"),
      currentFile: resolve(FIXTURE_DIR, "after.html"),
      viewport: { width: 1280, height: 900 },
      outputDir: resolve(process.cwd(), "test-results", "element-compare-test"),
      threshold: 0.1,
    };

    const report = await runElementCompare(options);

    // All 3 elements should be found
    assert.equal(report.summary.total, 3);
    assert.equal(report.summary.matched, 3);
    assert.equal(report.summary.missing, 0);

    const header = report.elements.find((e) => e.selector === "header")!;
    const main = report.elements.find((e) => e.selector === "main")!;
    const footer = report.elements.find((e) => e.selector === "footer")!;

    // Header should have a diff (padding + subtitle added)
    assert.ok(header.diffRatio > 0, `header should have diff, got ${header.diffRatio}`);

    // Main and footer should have zero or near-zero diff
    // (they are identical content, just shifted in full-page view)
    assert.ok(main.diffRatio < 0.01, `main should have < 1% diff, got ${(main.diffRatio * 100).toFixed(2)}%`);
    assert.ok(footer.diffRatio < 0.01, `footer should have < 1% diff, got ${(footer.diffRatio * 100).toFixed(2)}%`);

    // Full-page diff should be significant (cascade shift inflates it)
    assert.ok(
      report.summary.fullPageDiffRatio! > 0.1,
      `full-page diff should be significant due to cascade, got ${report.summary.fullPageDiffRatio}`,
    );

    // The key value: element-level correctly isolates the change to header only.
    // main and footer are clean despite being shifted in the full-page view.
    assert.equal(report.summary.changed, 1, "only header should be marked as changed");
  });

  it("reports missing elements", async () => {
    const options: ElementCompareOptions = {
      selectors: ["header", ".nonexistent"],
      baselineFile: resolve(FIXTURE_DIR, "before.html"),
      currentFile: resolve(FIXTURE_DIR, "after.html"),
      viewport: { width: 1280, height: 900 },
      outputDir: resolve(process.cwd(), "test-results", "element-compare-missing"),
      threshold: 0.1,
    };

    const report = await runElementCompare(options);

    assert.equal(report.summary.total, 2);
    assert.equal(report.summary.matched, 1);
    assert.equal(report.summary.missing, 1);

    const nonexistent = report.elements.find((e) => e.selector === ".nonexistent")!;
    assert.equal(nonexistent.found.baseline, false);
    assert.equal(nonexistent.found.current, false);
  });
});

/**
 * A missing flag prints one sentence, not nine frames of this repo's dispatcher.
 *
 * The guard was `main().catch((e) => { console.error(e); process.exit(1); })`, so
 * `vlmkit diff elements a.html b.html --output-dir out` answered with the right sentence
 * ("--selectors is required") followed by eight stack frames through `parseArgs`, `main`,
 * `delegate`, `runGroupLeaf` and `runCli` — the one part of the output that cannot help
 * the reader. `diff-pr` and `baseline` were moved onto `handleCliError` earlier for exactly
 * this; this leaf was missed.
 *
 * Spawned rather than called: `handleCliError` ends in `process.exit`, which in a vitest
 * worker would end the file rather than the assertion.
 */
describe("diff elements usage errors", () => {
  const CLI = resolve(fileURLToPath(import.meta.url), "..", "..", "..", "..", "src", "cli", "vlmkit.ts");

  it("prints one line and no stack trace when --selectors is missing", () => {
    const r = spawnSync(
      process.execPath,
      ["--experimental-strip-types", CLI, "diff", "elements", "a.html", "b.html"],
      { encoding: "utf-8", env: { ...process.env, NO_COLOR: "1" }, timeout: 60_000 },
    );
    const output = `${r.stdout ?? ""}${r.stderr ?? ""}`;
    assert.equal(r.status, 1);
    assert.match(output, /error: --selectors is required/);
    assert.doesNotMatch(output, /\bat \w/, `a stack frame leaked into a usage error:\n${output}`);
    assert.doesNotMatch(output, /runCli|delegate|runGroupLeaf/, "the dispatcher is not the reader's problem");
    // One line of substance, so the fix is not "a shorter stack".
    assert.ok(output.trim().split("\n").length <= 2, `expected one line, got:\n${output}`);
  });
});
