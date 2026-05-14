import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { compareRuns, formatCompareRunsMarkdown, type CrReport } from "./compare-runs.ts";

function report(rows: Array<[viewport: string, ratio: number, cats?: string]>): CrReport {
  return {
    baseline: "before.html",
    variants: ["working.html"],
    results: rows.map(([viewport, ratio, cats]) => ({
      variant: "working", variantFile: "working.html",
      viewport, diffRatio: ratio,
      categorySummary: cats,
    })),
  };
}

describe("compareRuns", () => {
  it("classifies improved / regressed / unchanged", () => {
    const a = report([["mobile", 0.41], ["desktop", 0.10], ["wide", 0.05]]);
    const b = report([["mobile", 0.00], ["desktop", 0.15], ["wide", 0.05]]);
    const r = compareRuns(a, b);
    const rows = r.byVariant.get("working.html")!;
    assert.equal(rows.find((x) => x.viewport === "mobile")!.status, "improved");
    assert.equal(rows.find((x) => x.viewport === "desktop")!.status, "regressed");
    assert.equal(rows.find((x) => x.viewport === "wide")!.status, "unchanged");
    assert.equal(r.totals.improved, 1);
    assert.equal(r.totals.regressed, 1);
    assert.equal(r.totals.unchanged, 1);
  });

  it("sorts rows by abs(delta) desc", () => {
    const a = report([["a", 0.10], ["b", 0.50]]);
    const b = report([["a", 0.05], ["b", 0.00]]);
    const r = compareRuns(a, b);
    const rows = r.byVariant.get("working.html")!;
    assert.equal(rows[0]!.viewport, "b"); // bigger movement
    assert.equal(rows[1]!.viewport, "a");
  });

  it("flags viewports only present in one run", () => {
    const a = report([["mobile", 0.10], ["desktop", 0.20]]);
    const b = report([["mobile", 0.05], ["wide", 0.30]]);
    const r = compareRuns(a, b);
    assert.deepEqual(r.onlyInA, ["working.html::desktop"]);
    assert.deepEqual(r.onlyInB, ["working.html::wide"]);
    const rows = r.byVariant.get("working.html")!;
    assert.equal(rows.find((x) => x.viewport === "desktop")!.status, "removed");
    assert.equal(rows.find((x) => x.viewport === "wide")!.status, "added");
  });

  it("computes net ratio delta", () => {
    const a = report([["a", 0.20], ["b", 0.10]]);
    const b = report([["a", 0.05], ["b", 0.05]]);
    const r = compareRuns(a, b);
    // delta = -0.15 + -0.05 = -0.20
    assert.ok(Math.abs(r.totals.netRatioDelta - -0.20) < 1e-9);
  });
});

describe("formatCompareRunsMarkdown", () => {
  it("renders a Markdown summary with the labels", () => {
    const a = report([["mobile", 0.41, "1 layout-shift"]]);
    const b = report([["mobile", 0.00, undefined]]);
    const md = formatCompareRunsMarkdown(a, b, { labelA: "iter1", labelB: "iter2" });
    assert.match(md, /# VRT compare-runs/);
    assert.match(md, /A \(iter1\)/);
    assert.match(md, /B \(iter2\)/);
    assert.match(md, /41\.00%/);
    assert.match(md, /-41\.00%/);
    assert.match(md, /IMPROVED/);
    assert.match(md, /Improved: 1/);
  });
});
