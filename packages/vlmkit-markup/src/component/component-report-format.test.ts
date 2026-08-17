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
import type { ComponentBbox } from "./component-bbox.ts";
import type { TextRow } from "@mizchi/vlmkit-core/text-rows.ts";
import {
  formatCanvasEvidence,
  formatExpressiveMenuEvidence,
  formatLandingEvidence,
  formatProbeState,
  formatScrollportEvidence,
  renderReportMarkdown,
  summarizeScrollportEvidence,
  type RenderInput,
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

/**
 * The rest of `renderReportMarkdown` — twelve conditional sections that only appear
 * when the run found something to put in them.
 *
 * A typed base fixture rather than the `as any` the tests above use. `as any` is how
 * a fixture ends up asserting a shape the types forbid: `LandscapeDiffResult` also
 * carries `width` and `height`, which every `as any` fixture in this file omits, and
 * nothing noticed. Built from the types, the compiler is the one checking.
 */
const BASE: RenderInput = {
  targetImage: "/tmp/target.png",
  currentHtml: "/tmp/current.html",
  viewport: { width: 800, height: 600 },
  diffPixels: 4_800,
  totalPixels: 480_000,
  diffRatio: 0.01,
  landscapeDiff: {
    width: 800, height: 600,
    score: 0.02, similarity: 0.98, changedCells: 1, totalCells: 16,
    grid: { cols: 4, rows: 4 },
    topCells: [],
  },
  goalEvaluation: {
    goal: "app", label: "Application", status: "review",
    summary: "Application review", primaryMetric: "landscape",
    // The thresholds the verdict was reached against. The `as any` fixtures above
    // omit these four and the compiler never got a chance to say so.
    pixelDiffRatio: 0.01, landscapeDiffRatio: 0.02,
    pass: { landscape: 0.03, pixel: 0.25 },
    review: { landscape: 0.05, pixel: 0.35 },
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
  paletteDiff: {
    matched: [], onlyInBaseline: [], onlyInVariant: [],
    baselineMatchedShare: 1, variantMatchedShare: 1,
  },
  stateResults: [],
  dpr: 1,
};

const cellStats = (hex: string, ink: number) => ({
  r: 0x22, g: 0x44, b: 0x88, luma: 90, ink, hex,
});

const bbox = (over: Partial<ComponentBbox> = {}): ComponentBbox => ({
  top: 10, left: 20, width: 200, height: 60, area: 9_000, fillColor: "rgb(34, 68, 136)", ...over,
});

const textRow = (yCenter: number): TextRow => ({
  yCenter, yStart: yCenter - 8, yEnd: yCenter + 8, meanLuma: 60, height: 16,
});

describe("renderReportMarkdown — the header", () => {
  it("states the pixel diff, the landscape diff and the goal verdict", () => {
    const md = renderReportMarkdown(BASE);
    assert.match(md, /Target:\s+`\/tmp\/target\.png` \(800×600\)/);
    assert.match(md, /\*\*Pixel diff\*\*: 1\.00% \(4800 of 480000 pixels\)/);
    assert.match(md, /2\.00% coarse/);
    assert.match(md, /98\.00% similarity, 1\/16 changed cells, 4×4 grid/);
    assert.match(md, /\*\*Goal\*\*: `app` \(Application\) — \*\*review\*\*/);
  });

  it("reports the CSS viewport only when the capture was scaled", () => {
    assert.doesNotMatch(renderReportMarkdown(BASE), /Capture: DPR/);
    // At DPR 2 the pixel viewport is twice the CSS one, and a reader comparing the
    // report against their stylesheet needs the CSS number.
    const md = renderReportMarkdown({ ...BASE, dpr: 2 });
    assert.match(md, /Capture: DPR 2 \(400×300 CSS px\)/);
  });

  it("passes a DPR suggestion through with the flag to reproduce it", () => {
    const md = renderReportMarkdown({
      ...BASE,
      dprSuggestion: {
        deviceScaleFactor: 2,
        cssViewport: { width: 400, height: 300 },
        reason: "target is exactly twice the rendered size",
      },
    });
    assert.match(md, /DPR hint: target is exactly twice the rendered size/);
    assert.match(md, /try `--dpr 2`/, "a hint without the flag is not actionable");
    assert.match(md, /400×300 CSS px/);
  });

  it("lists the three images only when a heatmap was produced", () => {
    assert.doesNotMatch(renderReportMarkdown(BASE), /Heatmap: /);
    const md = renderReportMarkdown({ ...BASE, heatmapPath: "/tmp/heat.png" });
    assert.match(md, /- Target:\s+`\/tmp\/target\.png`/);
    assert.match(md, /- Current:\s+`\/tmp\/current\.png`/);
    assert.match(md, /- Heatmap:\s+`\/tmp\/heat\.png`/);
  });
});

describe("renderReportMarkdown — the landscape cell table", () => {
  it("appears only when there are cells, and carries each cell's colour and ink", () => {
    assert.doesNotMatch(renderReportMarkdown(BASE), /## Landscape cell diff/);
    const md = renderReportMarkdown({
      ...BASE,
      landscapeDiff: {
        ...BASE.landscapeDiff,
        topCells: [{
          row: 1, col: 2, x: 400, y: 150, width: 200, height: 150, score: 0.42,
          baseline: cellStats("#224488", 0.31), current: cellStats("#ffffff", 0.02),
        }],
      },
    });
    assert.match(md, /## Landscape cell diff/);
    assert.match(md, /\| r1 c2 \| 400,150 200×150 \| 42\.0% \| `#224488` ink 0\.31 \| `#ffffff` ink 0\.02 \|/);
  });
});

describe("renderReportMarkdown — the bbox table", () => {
  it("drops matches whose every delta is within a pixel", () => {
    // A ±1px delta is measurement noise on an anti-aliased edge. Listing it would
    // bury the real shifts in rows nobody should act on.
    const md = renderReportMarkdown({
      ...BASE,
      bboxMatches: [{
        rank: 0, baseline: bbox(), variant: bbox({ top: 11, left: 21 }),
        deltaTop: 1, deltaLeft: 1, deltaWidth: 0, deltaHeight: 0, iou: 0.99,
      }],
    });
    assert.doesNotMatch(md, /## Component bbox diff/);
  });

  it("lists a real shift with signed deltas", () => {
    const md = renderReportMarkdown({
      ...BASE,
      bboxMatches: [{
        rank: 0,
        baseline: bbox(),
        variant: bbox({ top: 34, left: 20, width: 180 }),
        deltaTop: 24, deltaLeft: 0, deltaWidth: -20, deltaHeight: 0, iou: 0.71,
      }],
    });
    assert.match(md, /## Component bbox diff/);
    // Signed, because "24" and "-20" mean opposite corrections and an unsigned
    // magnitude cannot say which.
    assert.match(md, /\| #0 \| 20,10 200×60 \| 20,34 180×60 \| \+24 \/ 0 \/ -20 \/ 0 \| 0\.71 \|/);
  });

  it("caps the table at eight rows", () => {
    const many = Array.from({ length: 20 }, (_, i) => ({
      rank: i, baseline: bbox(), variant: bbox({ top: 100 }),
      deltaTop: 90, deltaLeft: 0, deltaWidth: 0, deltaHeight: 0, iou: 0.2,
    }));
    const md = renderReportMarkdown({ ...BASE, bboxMatches: many });
    const rows = md.split("\n").filter((l) => /^\| #\d+ \|/.test(l));
    assert.equal(rows.length, 8, "twenty near-identical rows is noise, not detail");
  });
});

describe("renderReportMarkdown — the heatmap cluster table", () => {
  it("marks a low-confidence kind guess with a question mark", () => {
    // The kind is a pixel-only heuristic. Presenting a 0.4-confidence guess with the
    // same authority as a 0.9 one is what makes an agent chase the wrong fix.
    const md = renderReportMarkdown({
      ...BASE,
      heatmapRegions: [
        { top: 0, left: 0, width: 100, height: 40, area: 2_000, dominantColor: { r: 34, g: 68, b: 136, hex: "#224488" }, kind: "text", kindConfidence: 0.9 },
        { top: 50, left: 0, width: 100, height: 40, area: 1_800, kind: "icon", kindConfidence: 0.4 },
        { top: 100, left: 0, width: 100, height: 40, area: 900 },
      ],
    });
    assert.match(md, /## Heatmap region clusters/);
    assert.match(md, /\| 0,0 \| 100×40 \| 2000 \| `#224488` \| `text` \|/);
    assert.match(md, /\| 0,50 \| 100×40 \| 1800 \| — \| `icon`\? \|/);
    // No colour and no kind: an em-dash, not an empty cell or the word undefined.
    assert.match(md, /\| 0,100 \| 100×40 \| 900 \| — \| — \|/);
  });
});

describe("renderReportMarkdown — the text-row section", () => {
  it("appears on a row-count mismatch even with nothing matched", () => {
    // Missing content is the finding. Saying nothing because no rows could be paired
    // would hide the most actionable case: the markup is short of elements.
    const md = renderReportMarkdown({ ...BASE, baselineRowCount: 7, variantRowCount: 4 });
    assert.match(md, /## Text-row Δy/);
    assert.match(md, /Target has 7 text rows; current has 4/);
    assert.match(md, /\*\*Count mismatch\*\*/);
    assert.match(md, /Add the missing elements before tweaking CSS/);
  });

  it("says nothing when the counts agree and nothing was matched", () => {
    assert.doesNotMatch(
      renderReportMarkdown({ ...BASE, baselineRowCount: 5, variantRowCount: 5 }),
      /## Text-row Δy/,
    );
  });

  it("lists signed Δy per matched row, without claiming a count mismatch", () => {
    const md = renderReportMarkdown({
      ...BASE,
      baselineRowCount: 2, variantRowCount: 2,
      textRowMatches: [
        { rank: 0, baseline: textRow(100), variant: textRow(112), deltaY: 12 },
        { rank: 1, baseline: textRow(200), variant: textRow(194), deltaY: -6 },
      ],
    });
    assert.match(md, /## Text-row Δy/);
    assert.doesNotMatch(md, /Count mismatch/);
    assert.match(md, /\| #0 \| 100 \| 112 \| \+12px \|/);
    assert.match(md, /\| #1 \| 200 \| 194 \| -6px \|/);
  });

  it("names a typography mismatch by what actually differs", () => {
    const md = renderReportMarkdown({
      ...BASE,
      baselineRowCount: 1, variantRowCount: 1,
      textRowMatches: [{ rank: 0, baseline: textRow(100), variant: textRow(100), deltaY: 0 }],
      typographyMismatches: [
        { rank: 0, kind: "both", baselineFontSize: 24, variantFontSize: 16, baselineWeight: "bold", variantWeight: "regular" },
      ],
    });
    assert.match(md, /\*\*Typography mismatches\*\*/);
    assert.match(md, /\| #0 \| 24px bold \| 16px regular \| both \|/);
    assert.match(md, /heuristic/, "an estimate presented as a measurement invites a wrong fix");
    // And it reaches the paste-ready patch, translating `bold` into the numeric
    // weight a stylesheet actually takes.
    assert.match(md, /font-size: 24px; font-weight: 700;/);
  });
});

describe("renderReportMarkdown — palette and backgrounds", () => {
  it("reports both backgrounds, and whether the page is one flat colour", () => {
    const md = renderReportMarkdown({
      ...BASE,
      targetBg: { outer: { r: 255, g: 255, b: 255, hex: "#ffffff" }, inner: { r: 244, g: 244, b: 244, hex: "#f4f4f4" }, same: false },
      currentBg: { outer: { r: 255, g: 255, b: 255, hex: "#ffffff" }, inner: { r: 255, g: 255, b: 255, hex: "#ffffff" }, same: true },
    });
    assert.match(md, /## Backgrounds/);
    // Both layers, side by side: the finding is that the target's content background
    // differs from the page's and the current render flattened them.
    assert.match(md, /\| outer \(page\) \| `#ffffff` \| `#ffffff` \|/);
    assert.match(md, /\| inner \(content\) \| `#f4f4f4` \| `#ffffff` \|/);
  });

  it("lists a colour the current render is missing, with how near it got", () => {
    // The distance is the point: a 6-away miss is an anti-aliasing artifact, a
    // 90-away miss is a colour nobody wrote. Same row shape, opposite action.
    const md = renderReportMarkdown({
      ...BASE,
      paletteDiff: {
        matched: [], baselineMatchedShare: 0.8, variantMatchedShare: 0.8,
        // `nearestNeighborDistance`, not `nearest` — my first guess at the field name,
        // which `as any` would have accepted and then rendered as `undefined`.
        onlyInBaseline: [{ r: 244, g: 244, b: 244, hex: "#f4f4f4", share: 0.12, count: 5_760, nearestNeighborDistance: 6 }],
        onlyInVariant: [{ r: 17, g: 17, b: 17, hex: "#111111", share: 0.04, count: 1_920, nearestNeighborDistance: 92 }],
      },
    });
    assert.match(md, /## Palette diff/);
    assert.match(md, /#f4f4f4/);
    assert.match(md, /#111111/);
  });
});

describe("renderReportMarkdown — the state table", () => {
  it("separates a state whose change is all on the perimeter from one that fills", () => {
    // `edgeFraction` near 1 is a focus ring; interior pixels are a background change.
    // Both are non-zero diffs, and the report has to say which so the reader knows
    // whether to look at `outline` or at `background`.
    const md = renderReportMarkdown({
      ...BASE,
      stateResults: [
        { state: "focus-visible", forcedCount: 1, inducedDiffRatio: 0.004, rawInducedDiffRatio: 0.005, edgeFraction: 0.96, interiorPixels: 12, lumaDelta: -2, lumaBefore: 240, lumaAfter: 238 },
        { state: "hover", forcedCount: 1, inducedDiffRatio: 0.02, rawInducedDiffRatio: 0.02, edgeFraction: 0.1, interiorPixels: 4_200, lumaDelta: -30, lumaBefore: 240, lumaAfter: 210 },
      ],
    });
    assert.match(md, /## State diff/);
    assert.match(md, /focus-visible/);
    assert.match(md, /hover/);
  });

  it("survives a state with no forced bboxes to measure luma over", () => {
    // `lumaDelta: null` means there was nothing to average, which is not the same as
    // a delta of zero. Rendering it as 0 would claim a measurement that never happened.
    const md = renderReportMarkdown({
      ...BASE,
      stateResults: [
        { state: "hover", forcedCount: 0, inducedDiffRatio: 0, rawInducedDiffRatio: 0, edgeFraction: 0, interiorPixels: 0, lumaDelta: null, lumaBefore: null, lumaAfter: null },
      ],
    });
    assert.match(md, /## State diff/);
    // An em-dash for both ΔLuma and Edge %, and the state named as a CSS selector.
    assert.match(md, /\| `:hover` \| 0\.00% \| 0\.00% \| — \| — \| 0 \|/);
    assert.doesNotMatch(md, /null/, "an absent measurement should not render as the word null");
  });
});

describe("renderReportMarkdown — always-present sections", () => {
  it("ends with a next step, so a report is never a dead end", () => {
    const md = renderReportMarkdown(BASE);
    assert.match(md, /## Suggested next step/);
    // And the very last thing in the file is not a bare table row or an empty table.
    assert.ok(md.trim().length > 0);
    assert.doesNotMatch(md, /undefined/, "an undefined reaching the markdown is a fixture or a formatter bug");
  });
});

describe("formatProbeState", () => {
  it("prefixes a pseudo-class with a colon and leaves `scrolled` bare", () => {
    // `scrolled` is not a CSS pseudo-class — it is a scroll position the probe forced —
    // so rendering it as `:scrolled` would name a selector that does not exist.
    assert.equal(formatProbeState("hover"), ":hover");
    assert.equal(formatProbeState("focus-visible"), ":focus-visible");
    assert.equal(formatProbeState("active"), ":active");
    assert.equal(formatProbeState("scrolled"), "scrolled");
  });
});
