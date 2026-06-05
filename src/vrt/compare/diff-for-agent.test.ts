import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  buildPreviousRunSummary,
  computeSectionDiffRows,
  detectRegression,
  formatMigrationReportForAgent,
  type DfaReport,
  type PreviousRunSummary,
} from "./diff-for-agent.ts";

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

  it("annotates display deltas that may be flex item coercion", () => {
    const md = formatMigrationReportForAgent(sampleReport({
      domPositionDiff: [{
        variantFile: "working.html",
        result: {
          totalDiffs: 1,
          pathsOnlyInBaseline: [],
          pathsOnlyInVariant: [],
          byProperty: [{ property: "display", count: 1 }],
          byPath: [{
            path: "main[0]>span[0]",
            baselineClasses: "pill",
            variantClasses: "luna-pill",
            count: 1,
          }],
          entries: [{
            path: "main[0]>span[0]",
            tag: "span",
            baselineClasses: "pill",
            variantClasses: "luna-pill",
            property: "display",
            baseline: "inline-flex",
            variant: "flex",
            parentDisplayContext: {
              baselineParent: "flex",
              variantParent: "flex",
              isFlexOrGridItem: true,
            },
          }],
        },
      }],
    }));

    assert.match(md, /flex\/grid item/);
    assert.match(md, /parent is flex/);
  });

  it("surfaces missing CSS rule hints across class-renamed selectors", () => {
    const md = formatMigrationReportForAgent(sampleReport({
      computedStyleDiff: [{
        variantFile: "working.html",
        result: {
          totalDiffs: 0,
          byProperty: [],
          bySelector: [],
          entries: [],
          selectorsOnlyInBaseline: [".eyebrow"],
          selectorsOnlyInVariant: [".luna-pill"],
        },
      }],
      domPositionDiffPerViewport: [{
        variantFile: "working.html",
        result: {
          totalDiffs: 2,
          verifiedPairs: [".luna-pill::text-transform"],
          byViewport: [
            { viewport: "mobile", count: 1 },
            { viewport: "desktop", count: 1 },
          ],
          byPathProperty: [{
            path: "main[0]>section[0]>span[0]",
            property: "text-transform",
            baselineClasses: "eyebrow",
            variantClasses: "luna-pill",
            viewports: ["mobile", "desktop"],
            samples: [
              { viewport: "mobile", baseline: "uppercase", variant: "none" },
              { viewport: "desktop", baseline: "uppercase", variant: "none" },
            ],
          }],
        },
      }],
    }));

    assert.match(md, /Missing CSS rule hints/);
    assert.match(md, /`\.eyebrow`/);
    assert.match(md, /`\.luna-pill`/);
    assert.match(md, /`text-transform`/);
    assert.match(md, /`uppercase` → `none`/);
  });

  it("surfaces color-change sampled color pairs", () => {
    const md = formatMigrationReportForAgent(sampleReport({
      results: [{
        variant: "working",
        variantFile: "working.html",
        viewport: "mobile",
        diffRatio: 0.1,
        diffPixels: 10,
        totalPixels: 100,
        dominantCategory: "color-change",
        categorySummary: "1 color-change",
        categoryCounts: { "color-change": 1 },
        colorSamples: [{
          x: 80,
          y: 1040,
          width: 64,
          height: 32,
          baseline: "#6b7280",
          variant: "#8c9099",
          distance: 54,
        }],
      }],
    }));

    assert.match(md, /Color-change samples/);
    assert.match(md, /#6b7280/);
    assert.match(md, /#8c9099/);
  });

  it("surfaces VLM region-diff handoff summaries with artifact paths", () => {
    const md = formatMigrationReportForAgent(sampleReport({
      regionDiffs: [{
        variantFile: "working.html",
        perViewport: [{
          viewport: "mobile",
          jsonPath: "/work/fix/out/working-mobile-region-diff.json",
          markdownPath: "/work/fix/out/working-mobile-region-diff.md",
          verdict: "diff",
          summary: "Primary CTA background changed from blue to red.",
          changeCount: 1,
          changes: [{
            selector: ".cta",
            selectorHint: "primary CTA",
            selectorConfidence: "high",
            property: "background-color",
            from: "#2d69ec",
            to: "#f04b4b",
            averageChannelDelta: 128.67,
            bbox: { left: 170, top: 338, width: 156, height: 50 },
            confidence: "high",
          }],
        }],
      }],
    }));

    assert.match(md, /VLM region diff/);
    assert.match(md, /Primary CTA background changed/);
    assert.match(md, /`\.cta`/);
    assert.match(md, /`background-color`/);
    assert.match(md, /`#2d69ec` → `#f04b4b`/);
    assert.match(md, /working-mobile-region-diff\.json/);
    assert.match(md, /working-mobile-region-diff\.md/);
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

  it("labels component bbox diffs with likely CSS axis candidates", () => {
    const md = formatMigrationReportForAgent(sampleReport({
      componentBboxDiffs: [{
        variantFile: "working.html",
        perViewport: [{
          viewport: "mobile",
          matches: [{
            rank: 1,
            baseline: { top: 100, left: 20, width: 320, height: 120, area: 38400, fillColor: "#fff" },
            variant: { top: 100, left: 20, width: 320, height: 170, area: 54400, fillColor: "#fff" },
            deltaTop: 0,
            deltaLeft: 0,
            deltaWidth: 0,
            deltaHeight: 50,
            iou: 0.71,
          }],
        }],
      }],
    }));

    assert.match(md, /Component bbox diff/);
    assert.match(md, /height \(\+50px\)/);
    assert.match(md, /padding-block/);
    assert.match(md, /line-height/);
    assert.match(md, /font-size/);
  });

  it("renders vertical accumulation breakdowns for shift bands", () => {
    const md = formatMigrationReportForAgent(sampleReport({
      shiftAccumulations: [{
        variantFile: "working.html",
        perViewport: [{
          viewport: "desktop",
          breakdowns: [{
            bandStart: 720,
            bandEnd: 1047,
            bandShift: 99,
            accumulatedDeltaHeight: 94.5,
            contributions: [
              {
                tag: "article",
                baselineClasses: "metric",
                variantClasses: "luna-metric",
                count: 4,
                averageDeltaHeight: -9,
                totalDeltaHeight: -36,
                samplePaths: ["metric[0]", "metric[1]"],
              },
              {
                tag: "h3",
                baselineClasses: "panel-title",
                variantClasses: "luna-panel-title",
                count: 3,
                averageDeltaHeight: -1.5,
                totalDeltaHeight: -4.5,
                samplePaths: ["title[0]"],
              },
            ],
          }],
        }],
      }],
    }));

    assert.match(md, /Vertical accumulation breakdown/);
    assert.match(md, /`metric` → `luna-metric`/);
    assert.match(md, /-9px × 4 = -36px/);
    assert.match(md, /`panel-title` → `luna-panel-title`/);
    assert.match(md, /-1\.5px × 3 = -4\.5px/);
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

  it("fires the regression banner when the majority of viewports got worse", () => {
    const previous: PreviousRunSummary = {
      timestamp: "2026-05-18T00:00:00Z",
      reportPath: "/work/fix/out/migration-report.prev.json",
      byVariant: { "working.html": { mobile: 0.2, desktop: 0.1 } },
    };
    // Both viewports got worse: mobile 0.20 → 0.41, desktop 0.10 → 0.24
    const md = formatMigrationReportForAgent(sampleReport(), { previous });
    assert.match(md, /⚠ REGRESSION/);
    assert.match(md, /2 of 2 viewports got worse/);
    assert.match(md, /Auto-revert offer/);
    assert.match(md, /Previous report.*migration-report\.prev\.json/);
  });

  it("suppresses the regression banner when only a single viewport got worse (noise floor)", () => {
    const previous: PreviousRunSummary = {
      byVariant: { "working.html": { mobile: 0.2, desktop: 0.30 } },
    };
    // Only mobile got worse (desktop went from 0.30 → 0.24, an
    // improvement). With totalViewports=2 the default threshold is 2,
    // so the alarm should not fire on 1/2.
    const md = formatMigrationReportForAgent(sampleReport(), { previous });
    assert.doesNotMatch(md, /⚠ REGRESSION/);
  });

  it("ignores subpixel jitter under the epsilon threshold", () => {
    const previous: PreviousRunSummary = {
      // Just barely below current values — within the 0.005 epsilon.
      byVariant: { "working.html": { mobile: 0.408, desktop: 0.237 } },
    };
    const md = formatMigrationReportForAgent(sampleReport(), { previous });
    assert.doesNotMatch(md, /⚠ REGRESSION/);
  });

  it("does nothing when there's no comparable previous data for the variant", () => {
    const previous: PreviousRunSummary = {
      byVariant: { "other-variant.html": { mobile: 0.1 } },
    };
    const md = formatMigrationReportForAgent(sampleReport(), { previous });
    assert.doesNotMatch(md, /⚠ REGRESSION/);
  });
});

describe("detectRegression", () => {
  const previous: PreviousRunSummary = {
    timestamp: "2026-05-18T00:00:00Z",
    byVariant: {
      "v.html": { vp1: 0.1, vp2: 0.2, vp3: 0.3, vp4: 0.4, vp5: 0.5 },
    },
  };

  it("threshold default is max(2, ceil(n/2)); 3 of 5 worsened fires the alarm", () => {
    const finding = detectRegression(
      [
        { viewport: "vp1", diffRatio: 0.15 },  // +0.05  worse
        { viewport: "vp2", diffRatio: 0.25 },  // +0.05  worse
        { viewport: "vp3", diffRatio: 0.35 },  // +0.05  worse
        { viewport: "vp4", diffRatio: 0.40 },  // ±0     unchanged
        { viewport: "vp5", diffRatio: 0.50 },  // ±0     unchanged
      ],
      previous,
      "v.html",
    );
    assert.ok(finding);
    assert.equal(finding!.regressed, true);
    assert.equal(finding!.worsenedViewports.length, 3);
    assert.equal(finding!.threshold, 3);
  });

  it("2 of 5 worsened does NOT fire (below threshold)", () => {
    const finding = detectRegression(
      [
        { viewport: "vp1", diffRatio: 0.15 },
        { viewport: "vp2", diffRatio: 0.25 },
        { viewport: "vp3", diffRatio: 0.30 },
        { viewport: "vp4", diffRatio: 0.40 },
        { viewport: "vp5", diffRatio: 0.50 },
      ],
      previous,
      "v.html",
    );
    assert.ok(finding);
    assert.equal(finding!.regressed, false);
  });

  it("1 worsened viewport never fires even when n=1 (floor of 2)", () => {
    const prevOne: PreviousRunSummary = {
      byVariant: { "v.html": { only: 0.1 } },
    };
    const finding = detectRegression(
      [{ viewport: "only", diffRatio: 0.99 }],
      prevOne,
      "v.html",
    );
    assert.ok(finding);
    assert.equal(finding!.regressed, false);
    assert.equal(finding!.threshold, 2);
  });

  it("buildPreviousRunSummary round-trips per-variant per-viewport diff", () => {
    const summary = buildPreviousRunSummary(sampleReport(), { timestamp: "fixed" });
    assert.equal(summary.timestamp, "fixed");
    assert.equal(summary.byVariant["working.html"]?.mobile, 0.4113);
    assert.equal(summary.byVariant["working.html"]?.desktop, 0.2398);
  });
});

describe("formatMigrationReportForAgent — per-viewport CSD", () => {
  it("emits universal and breakpoint-gated tables with sample values per viewport", () => {
    const md = formatMigrationReportForAgent(sampleReport({
      computedStyleDiffPerViewport: [{
        variantFile: "working.html",
        result: {
          totalDiffs: 3,
          byViewport: [
            { viewport: "mobile", count: 1 },
            { viewport: "desktop", count: 2 },
          ],
          universalPairs: [".btn|padding"],
          breakpointGatedPairs: [".card|gap"],
          bySelectorProperty: [
            {
              selector: ".btn", property: "padding",
              viewports: ["mobile", "desktop"],
              samples: [
                { viewport: "mobile", baseline: "10px", variant: "6px" },
                { viewport: "desktop", baseline: "10px", variant: "6px" },
              ],
            },
            {
              selector: ".card", property: "gap",
              viewports: ["desktop"],
              samples: [
                { viewport: "desktop", baseline: "12px", variant: "0px" },
              ],
            },
          ],
        },
      }],
    }));
    assert.match(md, /Verified deltas \(computed-style\) × viewport/);
    assert.match(md, /Universal pairs/);
    assert.match(md, /Breakpoint-gated pairs/);
    // Universal row shows the simple baseline → variant pair (no viewport column).
    assert.match(md, /\| `\.btn` \| `padding` \| `10px` \| `6px` \|/);
    // Breakpoint-gated row shows which viewports + sample with viewport label.
    assert.match(md, /\| `\.card` \| `gap` \| desktop \| `desktop`: `12px` → `0px`/);
  });

  it("skips the per-viewport CSD section entirely when totalDiffs is 0", () => {
    const md = formatMigrationReportForAgent(sampleReport({
      computedStyleDiffPerViewport: [{
        variantFile: "working.html",
        result: {
          totalDiffs: 0,
          byViewport: [],
          universalPairs: [],
          breakpointGatedPairs: [],
          bySelectorProperty: [],
        },
      }],
    }));
    assert.doesNotMatch(md, /Verified deltas \(computed-style\) × viewport/);
  });
});
