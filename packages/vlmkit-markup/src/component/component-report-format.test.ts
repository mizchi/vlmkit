/**
 * The pure half of a component-from-image run: how a report renders.
 *
 * These tests were in `component-from-image.test.ts`, importing the module that
 * statically imports Playwright — so exercising Markdown formatting cost 562ms of
 * module loading against 85ms for the formatter alone. Nothing here needs a
 * browser and now nothing here loads one.
 */
import test from "node:test";
import assert from "node:assert/strict";
import {
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
