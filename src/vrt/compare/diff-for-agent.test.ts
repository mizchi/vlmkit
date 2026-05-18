import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { computeSectionDiffRows, formatMigrationReportForAgent, type DfaReport } from "./diff-for-agent.ts";

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

  it("renders per-section diffRatio when bbox + heatmap data are present", () => {
    const md = formatMigrationReportForAgent(sampleReport({
      componentBboxDiffs: [{
        variantFile: "working.html",
        perViewport: [{
          viewport: "mobile",
          matches: [
            // Large hero section: 200×100 = 20000 area, fully covered by region → 100%.
            {
              rank: 1,
              baseline: { top: 0, left: 0, width: 200, height: 100, area: 20000, fillColor: "#fff" },
              variant: { top: 0, left: 0, width: 200, height: 100, area: 20000, fillColor: "#fff" },
              deltaTop: 0, deltaLeft: 0, deltaWidth: 0, deltaHeight: 0, iou: 1,
            },
            // Smaller card: 50×50 = 2500 area, no heatmap intersection → 0%.
            {
              rank: 2,
              baseline: { top: 200, left: 0, width: 50, height: 50, area: 2500, fillColor: "#fff" },
              variant: { top: 200, left: 0, width: 50, height: 50, area: 2500, fillColor: "#fff" },
              deltaTop: 0, deltaLeft: 0, deltaWidth: 0, deltaHeight: 0, iou: 1,
            },
          ],
        }],
      }],
      heatmapRegions: [{
        variantFile: "working.html",
        perViewport: [{
          viewport: "mobile",
          regions: [{ top: 0, left: 0, width: 200, height: 100, area: 20000 }],
        }],
      }],
    }));
    assert.match(md, /Per-section diffRatio/);
    // Hero is fully covered (200×100 region intersects 200×100 section).
    assert.match(md, /\| 100\.00% \|/);
    // Worst row should carry the ⚠ marker — that's the hero, not the card.
    const heroLine = md.split("\n").find((l) => l.includes("200×100"));
    assert.ok(heroLine, "hero line present");
    assert.ok(heroLine!.includes("⚠"), "hero row marked worst");
  });

  it("computeSectionDiffRows: sorts by sectionRatio desc and skips zero-area sections", () => {
    const rows = computeSectionDiffRows(
      {
        matches: [
          { rank: 1, baseline: { top: 0, left: 0, width: 100, height: 100 } },
          { rank: 2, baseline: { top: 200, left: 0, width: 100, height: 100 } },
          // zero-area: ignored
          { rank: 3, baseline: { top: 0, left: 0, width: 0, height: 0 } },
        ],
      } as any,
      [
        { top: 0, left: 0, width: 50, height: 50 },  // 2500px inside rank 1's bbox (10000px) → 25%
        { top: 200, left: 0, width: 10, height: 10 }, // 100px inside rank 2's bbox (10000px) → 1%
      ],
      "mobile",
      1_000_000,
      5,
    );
    assert.equal(rows.length, 2);
    assert.equal(rows[0].rank, 1);
    assert.equal(rows[0].sectionRatio, 0.25);
    assert.equal(rows[1].rank, 2);
    assert.equal(rows[1].sectionRatio, 0.01);
  });
});
