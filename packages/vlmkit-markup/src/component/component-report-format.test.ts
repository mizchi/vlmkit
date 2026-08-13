/**
 * The pure half of a component-from-image run: how a report renders.
 *
 * These tests were in `component-from-image.test.ts`, importing the module that
 * statically imports Playwright — so exercising Markdown formatting cost 562ms of
 * module loading against 85ms for the formatter alone. Nothing here needs a
 * browser and now nothing here loads one.
 */
import { describe, it, test } from "vitest";
import assert from "node:assert/strict";
import type { ScrollportRegion } from "./semantic-drilldown.ts";
import type { ComponentCanvasEvidence } from "./component-goal.ts";
import type { UiExpectedScrollportContract } from "../contract/ui-contract.ts";
import {
  formatCanvasEvidence,
  formatExpressiveMenuEvidence,
  formatLandingEvidence,
  formatScrollportEvidence,
  renderReportMarkdown,
  summarizeScrollportEvidence,
} from "./component-report-format.ts";

test("renderReportMarkdown includes explicit scrollport diagnostics", () => {
  const markdown = renderReportMarkdown({
    targetImage: "/tmp/target.png",
    currentHtml: "/tmp/current.html",
    viewport: { width: 320, height: 240 },
    diffPixels: 0,
    totalPixels: 76800,
    diffRatio: 0,
    landscapeDiff: {
      score: 0,
      similarity: 1,
      changedCells: 0,
      totalCells: 1,
      grid: { cols: 1, rows: 1 },
      topCells: [],
    },
    goalEvaluation: {
      goal: "layout",
      label: "Layout first",
      status: "pass",
      summary: "Layout first pass",
      primaryMetric: "landscape",
    },
    landmarkRegions: [],
    scrollportRegions: [
      {
        name: "messages",
        path: "main[0]>section[0]",
        bbox: { left: 0, top: 0, width: 320, height: 180 },
        order: 0,
        explicit: true,
        overflowX: "visible",
        overflowY: "visible",
        clientWidth: 320,
        clientHeight: 180,
        scrollWidth: 320,
        scrollHeight: 360,
      },
    ],
    semanticDrilldown: [],
    currentPath: "/tmp/current.png",
    bboxMatches: [],
    heatmapRegions: [],
    textRowMatches: [],
    rowGapDeltas: [],
    typographyMismatches: [],
    baselineRowCount: 0,
    variantRowCount: 0,
    paletteDiff: { onlyInBaseline: [], onlyInVariant: [] },
    stateResults: [],
    dpr: 1,
  } as any);

  assert.match(markdown, /## Scrollport inspector/);
  assert.match(markdown, /\| broken \| `messages` \|/);
  assert.match(markdown, /content overflows but overflow is not scrollable/);
});

test("renderReportMarkdown includes landing first-viewport diagnostics", () => {
  const markdown = renderReportMarkdown({
    targetImage: "/tmp/target.png",
    currentHtml: "/tmp/current.html",
    viewport: { width: 320, height: 240 },
    diffPixels: 0,
    totalPixels: 76800,
    diffRatio: 0,
    landscapeDiff: {
      score: 0,
      similarity: 1,
      changedCells: 0,
      totalCells: 1,
      grid: { cols: 1, rows: 1 },
      topCells: [],
    },
    goalEvaluation: {
      goal: "landing",
      label: "Landing page",
      status: "pass",
      summary: "Landing page pass",
      primaryMetric: "landscape",
    },
    landmarkRegions: [],
    scrollportRegions: [],
    landingEvidence: {
      heroVisible: true,
      primaryCtaVisible: true,
      nextSectionHintVisible: true,
      mediaSlotVisible: true,
    },
    semanticDrilldown: [],
    currentPath: "/tmp/current.png",
    bboxMatches: [],
    heatmapRegions: [],
    textRowMatches: [],
    rowGapDeltas: [],
    typographyMismatches: [],
    baselineRowCount: 0,
    variantRowCount: 0,
    paletteDiff: { onlyInBaseline: [], onlyInVariant: [] },
    stateResults: [],
    dpr: 1,
  } as any);

  assert.match(markdown, /## Landing inspector/);
  assert.match(markdown, /\| Primary CTA visible \| ok \|/);
  assert.match(markdown, /\| Next section hint visible \| ok \|/);
});

test("renderReportMarkdown includes canvas diagnostics", () => {
  const markdown = renderReportMarkdown({
    targetImage: "/tmp/target.png",
    currentHtml: "/tmp/current.html",
    viewport: { width: 320, height: 240 },
    diffPixels: 0,
    totalPixels: 76800,
    diffRatio: 0,
    landscapeDiff: {
      score: 0,
      similarity: 1,
      changedCells: 0,
      totalCells: 1,
      grid: { cols: 1, rows: 1 },
      topCells: [],
    },
    goalEvaluation: {
      goal: "canvas",
      label: "Canvas scene",
      status: "pass",
      summary: "Canvas scene pass",
      primaryMetric: "landscape",
    },
    landmarkRegions: [],
    scrollportRegions: [],
    canvasEvidence: {
      canvasCount: 1,
      nonblank: true,
      frameDelta: true,
      inputResponsive: true,
      stateHook: "window.__gameState",
      stateHookPresent: true,
      requiredStateFields: ["mode", "frame", "playerX", "playerY", "score", "assetsReady"],
      observedStateFields: ["mode", "frame", "playerX", "playerY", "score", "assetsReady"],
      missingStateFields: [],
    },
    semanticDrilldown: [],
    currentPath: "/tmp/current.png",
    bboxMatches: [],
    heatmapRegions: [],
    textRowMatches: [],
    rowGapDeltas: [],
    typographyMismatches: [],
    baselineRowCount: 0,
    variantRowCount: 0,
    paletteDiff: { onlyInBaseline: [], onlyInVariant: [] },
    stateResults: [],
    dpr: 1,
  } as any);

  assert.match(markdown, /## Canvas inspector/);
  assert.match(markdown, /\| Nonblank canvas \| ok \|/);
  assert.match(markdown, /\| Input response \| ok \|/);
  assert.match(markdown, /\| State hook \| ok: `window\.__gameState` \|/);
  assert.match(markdown, /\| Required state fields \| ok: `mode`, `frame`, `playerX`, `playerY`, `score`, `assetsReady` \|/);
});

test("renderReportMarkdown includes expressive menu diagnostics", () => {
  const markdown = renderReportMarkdown({
    targetImage: "/tmp/target.png",
    currentHtml: "/tmp/current.html",
    viewport: { width: 320, height: 240 },
    diffPixels: 0,
    totalPixels: 76800,
    diffRatio: 0,
    landscapeDiff: {
      score: 0,
      similarity: 1,
      changedCells: 0,
      totalCells: 1,
      grid: { cols: 1, rows: 1 },
      topCells: [],
    },
    goalEvaluation: {
      goal: "expressive-menu",
      label: "Expressive menu",
      status: "pass",
      summary: "Expressive menu pass",
      primaryMetric: "landscape",
    },
    landmarkRegions: [],
    scrollportRegions: [],
    expressiveMenuEvidence: {
      compositionLayers: 3,
      compositionShapes: 2,
      selectedVisible: true,
      focusableItemCount: 5,
      semanticMenuText: true,
      diagonalEvidence: true,
      highContrast: true,
      minMenuContrastRatio: 5.06,
      lowContrastItemCount: 0,
      contrastSource: "pixel",
      hoverChanged: true,
      focusVisibleChanged: true,
    },
    semanticDrilldown: [],
    currentPath: "/tmp/current.png",
    bboxMatches: [],
    heatmapRegions: [],
    textRowMatches: [],
    rowGapDeltas: [],
    typographyMismatches: [],
    baselineRowCount: 0,
    variantRowCount: 0,
    paletteDiff: { onlyInBaseline: [], onlyInVariant: [] },
    stateResults: [],
    dpr: 1,
  } as any);

  assert.match(markdown, /## Expressive menu inspector/);
  assert.match(markdown, /\| Selected state visible \| ok \|/);
  assert.match(markdown, /\| Composition layers \| 3 \|/);
  assert.match(markdown, /\| Minimum menu contrast \| 5\.06 \|/);
  assert.match(markdown, /\| Low-contrast menu items \| 0 \|/);
  assert.match(markdown, /\| Contrast source \| pixel \|/);
  assert.match(markdown, /\| Hover state changes \| ok \|/);
  assert.match(markdown, /\| Focus-visible state changes \| ok \|/);
});

test("renderReportMarkdown avoids wrong-direction hover warning for dark controls", () => {
  const markdown = renderReportMarkdown({
    targetImage: "/tmp/target.png",
    currentHtml: "/tmp/current.html",
    viewport: { width: 320, height: 240 },
    diffPixels: 0,
    totalPixels: 76800,
    diffRatio: 0,
    landscapeDiff: {
      score: 0,
      similarity: 1,
      changedCells: 0,
      totalCells: 1,
      grid: { cols: 1, rows: 1 },
      topCells: [],
    },
    goalEvaluation: {
      goal: "expressive-menu",
      label: "Expressive menu",
      status: "pass",
      summary: "Expressive menu pass",
      primaryMetric: "landscape",
    },
    landmarkRegions: [],
    scrollportRegions: [],
    semanticDrilldown: [],
    currentPath: "/tmp/current.png",
    bboxMatches: [],
    heatmapRegions: [],
    textRowMatches: [],
    rowGapDeltas: [],
    typographyMismatches: [],
    baselineRowCount: 0,
    variantRowCount: 0,
    paletteDiff: { onlyInBaseline: [], onlyInVariant: [] },
    stateResults: [
      {
        state: "hover",
        forcedCount: 1,
        inducedDiffRatio: 0.05,
        rawInducedDiffRatio: 0.06,
        edgeFraction: 0,
        interiorPixels: 1200,
        lumaBefore: 30,
        lumaAfter: 94,
        lumaDelta: 64,
      },
    ],
    dpr: 1,
  } as any);

  assert.doesNotMatch(markdown, /\*\*direction\?\*\*/);
});


test("summarizeScrollportEvidence checks expected scroll axis", () => {
  const evidence = summarizeScrollportEvidence([
    {
      name: "messages",
      path: "[data-scrollport][0]",
      bbox: { left: 0, top: 0, width: 320, height: 240 },
      order: 0,
      explicit: true,
      overflowX: "auto",
      overflowY: "visible",
      clientWidth: 320,
      clientHeight: 240,
      scrollWidth: 640,
      scrollHeight: 240,
    },
  ], [
    {
      id: "messages",
      name: "messages",
      selector: "[data-scrollport=\"messages\"]",
      axis: "y",
      required: true,
    },
  ]);

  assert.equal(evidence.ok, 1);
  assert.equal(evidence.expected?.ok, 0);
  assert.equal(evidence.expected?.broken, 1);
  assert.deepEqual(evidence.expected?.brokenNames, ["messages"]);
});

// ---------------------------------------------------------------------------
// The expected-scrollport matching logic, which is where this module does real
// work: a contract names a scrollport by `name`, `id`, or a `data-*` selector,
// and the report has to say which expected ones are missing, broken or empty.

const region = (over: Partial<ScrollportRegion> = {}): ScrollportRegion => ({
  name: "rail",
  path: "main>div.rail",
  // `Rect` is left/top, not x/y. Built through a helper so a shape that cannot
  // occur cannot be asserted on: these tests passed on `{x, y}` until `tsc`
  // pointed out the type has no such field.
  bbox: { left: 0, top: 0, width: 400, height: 200 },
  order: 0,
  explicit: true,
  overflowX: "auto",
  overflowY: "hidden",
  clientWidth: 400,
  clientHeight: 200,
  scrollWidth: 900,
  scrollHeight: 200,
  ...over,
});

describe("summarizeScrollportEvidence", () => {
  it("counts the regions it found, with no expectations to compare against", () => {
    const evidence = summarizeScrollportEvidence([region(), region({ name: "other" })]);
    assert.equal(evidence.total, 2);
    assert.equal(evidence.ok, 2);
    assert.equal(evidence.expected, undefined, "no contract means nothing to expect");
  });

  it("counts a scrollport with nothing to scroll as empty rather than ok", () => {
    // scrollWidth === clientWidth on an `overflow: auto` box is a rail that was
    // built and never filled — a different defect from one that cannot scroll.
    const evidence = summarizeScrollportEvidence([region({ scrollWidth: 400 })]);
    assert.equal(evidence.ok, 0);
    assert.equal(evidence.empty + evidence.broken, 1);
  });

  it("matches an expectation by name, by id, or by a data-* selector", () => {
    // Three spellings of the same intent, because a contract is written by hand and
    // the region's name comes from the DOM.
    for (const expected of [
      { id: "by-name", name: "rail" },
      { id: "rail" },
      { id: "by-selector", selector: '[data-vlmkit-scrollport="rail"]' },
      { id: "by-bare-selector", selector: "[data-scrollport=rail]" },
    ] satisfies UiExpectedScrollportContract[]) {
      const evidence = summarizeScrollportEvidence([region()], [expected]);
      assert.equal(evidence.expected?.ok, 1, `${JSON.stringify(expected)} should match the rail`);
      assert.equal(evidence.expected?.missing, 0);
    }
  });

  it("reports an expectation nothing matched as missing, and names it", () => {
    const evidence = summarizeScrollportEvidence([region()], [{ id: "carousel-x", name: "carousel" }]);
    assert.equal(evidence.expected?.missing, 1);
    assert.deepEqual(evidence.expected?.missingNames, ["carousel"]);
  });

  it("labels an unnamed expectation by its position, so the report can point at it", () => {
    // `id` is required by the type but may be empty, and a selector with no
    // `data-*` attribute yields no name either. The positional fallback was
    // unreachable until this test: `??` treats `""` as present, so the report said
    // `1 expected missing` and named nothing.
    const evidence = summarizeScrollportEvidence([], [{ id: "", selector: ".no-data-attribute" }]);
    assert.deepEqual(evidence.expected?.missingNames, ["expected-1"]);
    // Whitespace is not a name either.
    assert.deepEqual(
      summarizeScrollportEvidence([], [{ id: "  " }]).expected?.missingNames,
      ["expected-1"],
    );
  });

  it("holds an expectation to its axis — scrolling the wrong way is broken, not ok", () => {
    const horizontal = region({ overflowX: "auto", overflowY: "hidden", scrollWidth: 900, scrollHeight: 200 });
    assert.equal(summarizeScrollportEvidence([horizontal], [{ id: "rail", axis: "x" }]).expected?.ok, 1);

    const wrongAxis = summarizeScrollportEvidence([horizontal], [{ id: "rail", axis: "y" }]);
    assert.equal(wrongAxis.expected?.ok, 0);
    assert.equal(wrongAxis.expected?.broken, 1);
    assert.deepEqual(wrongAxis.expected?.brokenNames, ["rail"]);
  });

  it("accepts either axis when the expectation does not state one", () => {
    const vertical = region({ overflowX: "hidden", overflowY: "auto", scrollWidth: 400, scrollHeight: 900 });
    assert.equal(summarizeScrollportEvidence([vertical], [{ id: "rail" }]).expected?.ok, 1);
  });
});

describe("formatScrollportEvidence", () => {
  it("leads with the ratio and adds only the categories that are non-zero", () => {
    assert.equal(formatScrollportEvidence({ total: 3, ok: 3, broken: 0, empty: 0 }), "3/3 ok");
    const text = formatScrollportEvidence({ total: 3, ok: 1, broken: 1, empty: 1 });
    assert.match(text, /1\/3 ok/);
    assert.match(text, /1 broken/);
    assert.match(text, /1 empty/);
  });

  it("carries the expected counts when a contract was compared", () => {
    const text = formatScrollportEvidence({
      total: 2,
      ok: 2,
      broken: 0,
      empty: 0,
      expected: { total: 3, ok: 2, broken: 0, empty: 0, missing: 1, missingNames: ["carousel"], brokenNames: [], emptyNames: [] },
    });
    assert.match(text, /expected 2\/3 ok/);
    assert.match(text, /1 expected missing/);
  });
});

describe("the small evidence formatters", () => {
  it("names each missing part of a landing viewport rather than a single verdict", () => {
    // "hero missing" is actionable; "landing: fail" is not.
    const text = formatLandingEvidence({
      heroVisible: true,
      primaryCtaVisible: false,
      nextSectionHintVisible: false,
      mediaSlotVisible: true,
    });
    assert.match(text, /hero ok/);
    assert.match(text, /CTA missing/);
    assert.match(text, /next hint missing/);
    assert.match(text, /media slot ok/);
  });

  it("distinguishes canvas input `false` from `undefined`, which mean different things", () => {
    // `false` is "measured, and it does not respond"; `undefined` is "not measured".
    // Collapsing them would report an unmeasured page as a broken one.
    const canvas = (inputResponsive: boolean | null): ComponentCanvasEvidence => ({
      canvasCount: 1,
      nonblank: true,
      frameDelta: true,
      inputResponsive,
    });
    assert.match(formatCanvasEvidence(canvas(false)), /input missing/);
    assert.match(formatCanvasEvidence(canvas(true)), /input ok/);
    assert.match(formatCanvasEvidence(canvas(null)), /input unknown/);
  });

  it("puts the expressive-menu counts in the line, not just pass/fail", () => {
    // Every field, because `minMenuContrastRatio` is `number | null` and omitting
    // it crashed the formatter on `undefined.toFixed` — a shape the type forbids,
    // which is exactly why the fixture has to be built from the type.
    const text = formatExpressiveMenuEvidence({
      compositionLayers: 2,
      compositionShapes: 5,
      selectedVisible: true,
      focusableItemCount: 4,
      semanticMenuText: false,
      diagonalEvidence: true,
      highContrast: true,
      minMenuContrastRatio: 7.2,
      lowContrastItemCount: 0,
      hoverChanged: true,
      focusVisibleChanged: true,
    });
    assert.match(text, /selected ok/);
    assert.match(text, /menu text missing/);
    assert.match(text, /items 4/);
    assert.match(text, /composition 2\/5/);
  });
});
