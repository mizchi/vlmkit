import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { formatMigrationReportForAgent, type DfaReport } from "./diff-for-agent.ts";

function sampleReport(over: Partial<DfaReport> = {}): DfaReport {
  return {
    dir: "/work/fix",
    baseline: "before.html",
    variants: ["working.html"],
    viewports: [
      { label: "mobile", width: 375 },
      { label: "desktop", width: 1280 },
    ],
    reportPath: "/work/fix/out/migration-report.json",
    results: [
      {
        variant: "working", variantFile: "working.html",
        viewport: "mobile", diffRatio: 0.4113, diffPixels: 100, totalPixels: 244,
        dominantCategory: "layout-shift",
        categorySummary: "3 layout-shift, 1 color-change",
        categoryCounts: { "layout-shift": 3, "color-change": 1 },
        fixCandidates: [
          { selector: ".luna-actions", property: "display" },
          { selector: ".luna-actions", property: "gap" },
          { selector: ".luna-field", property: "display" },
        ],
      },
      {
        variant: "working", variantFile: "working.html",
        viewport: "desktop", diffRatio: 0.2398, diffPixels: 30, totalPixels: 125,
        dominantCategory: "layout-shift",
        categorySummary: "2 layout-shift",
        categoryCounts: { "layout-shift": 2 },
        fixCandidates: [
          { selector: ".luna-actions", property: "display" },
          { selector: ".luna-field", property: "display" },
        ],
      },
    ],
    ...over,
  };
}

describe("formatMigrationReportForAgent", () => {
  it("sorts the diff table worst-first and shows category summaries", () => {
    const md = formatMigrationReportForAgent(sampleReport());
    const tableStart = md.indexOf("| Viewport |");
    assert.ok(tableStart > 0, "table header present");
    // mobile (41.13%) should appear before desktop (23.98%)
    const mobileIdx = md.indexOf("`mobile`", tableStart);
    const desktopIdx = md.indexOf("`desktop`", tableStart);
    assert.ok(mobileIdx > 0 && desktopIdx > mobileIdx, "mobile is listed before desktop");
    assert.match(md, /41\.13%/);
    assert.match(md, /23\.98%/);
    assert.match(md, /layout-shift/);
  });

  it("aggregates fix candidates by (selector, property) with viewport coverage", () => {
    const md = formatMigrationReportForAgent(sampleReport());
    // `.luna-actions { display }` appears on both viewports → 2
    // `.luna-actions { gap }`     appears on mobile only       → 1
    // `.luna-field { display }`   appears on both              → 2
    const actionsDisplay = md.match(/`\.luna-actions` \| `display` \| 2/);
    const actionsGap = md.match(/`\.luna-actions` \| `gap` \| 1/);
    const fieldDisplay = md.match(/`\.luna-field` \| `display` \| 2/);
    assert.ok(actionsDisplay, "actions display has 2 viewports");
    assert.ok(actionsGap, "actions gap has 1 viewport");
    assert.ok(fieldDisplay, "field display has 2 viewports");
  });

  it("emits absolute paths to baseline/current/heatmap PNGs for the worst viewport", () => {
    const md = formatMigrationReportForAgent(sampleReport(), { outputDir: "/abs/out" });
    assert.match(md, /Baseline: `\/abs\/out\/before-mobile\.png`/);
    assert.match(md, /Current : `\/abs\/out\/working-mobile\.png`/);
    assert.match(md, /Heatmap : `\/abs\/out\/working-mobile_heatmap\.png`/);
  });

  it("respects maxViewports", () => {
    const md = formatMigrationReportForAgent(sampleReport(), { maxViewports: 2, outputDir: "/abs/out" });
    assert.match(md, /\/abs\/out\/working-mobile_heatmap\.png/);
    assert.match(md, /\/abs\/out\/working-desktop_heatmap\.png/);
  });

  it("emits PASS message when every diff is zero", () => {
    const md = formatMigrationReportForAgent(sampleReport({
      results: [
        {
          variant: "working", variantFile: "working.html",
          viewport: "mobile", diffRatio: 0, diffPixels: 0, totalPixels: 100,
        },
      ],
    }));
    assert.match(md, /\*\*PASS\*\*/);
    assert.match(md, /Nothing to fix/);
  });

  it("filters by variant when --variant is supplied", () => {
    const r = sampleReport({
      results: [
        { variant: "a", variantFile: "a.html", viewport: "mobile", diffRatio: 0.5, diffPixels: 1, totalPixels: 2 },
        { variant: "b", variantFile: "b.html", viewport: "mobile", diffRatio: 0.1, diffPixels: 1, totalPixels: 10 },
      ],
    });
    const md = formatMigrationReportForAgent(r, { variant: "a.html" });
    assert.match(md, /50\.00%/);
    assert.doesNotMatch(md, /10\.00%/);
  });

  it("handles empty reports gracefully", () => {
    const md = formatMigrationReportForAgent(sampleReport({ results: [] }));
    assert.match(md, /Empty report/);
  });
});
