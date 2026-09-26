import assert from "node:assert/strict";
import { readdirSync } from "node:fs";
import { join, resolve } from "node:path";
import { describe, it } from "vitest";
import { runResponsiveCheck } from "./responsive-pbt.ts";

/**
 * The silent half of the paired-mutant contract: each intact responsive pattern in
 * `fixtures/responsive-patterns/patterns/` passes `check responsive` at every generated
 * viewport. A new property, or a loosened threshold, that fires here is a false positive
 * on a page built the way the pattern is meant to be built. Split from the mutant file so
 * the two halves run in parallel workers.
 */
const ROOT = resolve(import.meta.dirname, "../../../..");
const PATTERNS = join(ROOT, "fixtures/responsive-patterns/patterns");

describe("fixtures/responsive-patterns: intact patterns", () => {
  const files = readdirSync(PATTERNS).filter((f) => f.endsWith(".html")).sort();

  it("has the eleven patterns the catalog lists", () => {
    assert.equal(files.length, 11, files.join(", "));
  });

  for (const file of files) {
    it(`${file} passes every property at every generated viewport`, async () => {
      const report = await runResponsiveCheck({
        source: join(PATTERNS, file),
        runs: 40,
        noCause: true,
        // The toolbar is the text-scale pattern: its intact form must hold at 2x text.
        ...(file === "toolbar.html" ? { textScale: 2 } : {}),
      });
      assert.deepEqual(
        report.failures.map((f) => `${f.kind} ${f.selectors[0]} @${f.firstCase.width}: ${f.message}`),
        [],
      );
      assert.ok(report.regimes.every((r) => r.cases > 0), "every regime was visited");
    });
  }
});
