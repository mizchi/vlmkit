import assert from "node:assert/strict";
import { describe, it } from "vitest";
import { buildRows, renderMarkdown, renderTsv } from "./aggregate-fix-summaries.ts";

function makeSummary(overrides: Partial<Parameters<typeof renderMarkdown>[0][number]> = {}): Parameters<typeof renderMarkdown>[0][number] {
  return {
    path: "/tmp/summary.json",
    target: {
      variantFile: "design-runs/patterns/app-shell/current.html",
      viewport: "mobile",
      viewportWidth: 375,
      diffRatio: 0.0216,
    },
    counts: { proposed: 5, corrected: 0, dropped: 0, applied: 5, skipped: 0 },
    outputPath: "/tmp/fixed.html",
    beforeByViewport: [
      { viewport: "mobile", diffRatio: 0.0216 },
      { viewport: "desktop", diffRatio: 0.0200 },
    ],
    afterByViewport: [
      { viewport: "mobile", diffRatio: 0.0100 },
      { viewport: "desktop", diffRatio: 0.0050 },
    ],
    ...overrides,
  };
}

describe("buildRows", () => {
  it("emits one row per viewport with computed delta", () => {
    const rows = buildRows(makeSummary());
    assert.equal(rows.length, 2);
    const mobile = rows.find((r) => r.viewport === "mobile")!;
    assert.equal(mobile.before, 0.0216);
    assert.equal(mobile.after, 0.0100);
    assert.ok(mobile.delta !== null && Math.abs(mobile.delta - (-0.0116)) < 1e-9);
  });

  it("returns null delta when afterByViewport is missing", () => {
    const rows = buildRows(makeSummary({ afterByViewport: null }));
    for (const r of rows) assert.equal(r.delta, null);
  });
});

describe("renderMarkdown", () => {
  it("includes a header, per-row data, and an aggregate footer", () => {
    const md = renderMarkdown([makeSummary()]);
    assert.match(md, /# Fix-loop aggregate summary/);
    assert.match(md, /\| `app-shell` \| mobile \| 2\.16% \| 1\.00% \| -1\.16%/);
    assert.match(md, /Aggregate.*avg Δ across 2 viewport/);
  });

  it("renders absent before/after data gracefully", () => {
    const md = renderMarkdown([makeSummary({ beforeByViewport: undefined, afterByViewport: null })]);
    assert.match(md, /no before\/after deltas/);
  });
});

describe("renderTsv", () => {
  it("emits a tab-separated header + data rows", () => {
    const tsv = renderTsv([makeSummary()]);
    const lines = tsv.split("\n").filter(Boolean);
    assert.equal(lines.length, 3);
    assert.equal(lines[0], "pattern\tviewport\tbefore\tafter\tdelta\tapplied\tproposed\tdropped");
    assert.match(lines[1]!, /^app-shell\t/);
  });
});
