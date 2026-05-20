import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import test from "node:test";
import assert from "node:assert/strict";
import { PNG } from "pngjs";
import {
  deriveComponentContractRuntime,
  inlineLocalStylesheets,
  renderReportMarkdown,
  sampleContrastFromImage,
  summarizeScrollportEvidence,
  suggestDeviceScaleFactorForTarget,
} from "./component-from-image.ts";

test("inlineLocalStylesheets inlines relative stylesheet links", async () => {
  const dir = await mkdtemp(join(tmpdir(), "vlmkit-component-inline-"));
  try {
    const htmlPath = join(dir, "page.html");
    const cssPath = join(dir, "style.css");
    await writeFile(cssPath, "body { background: rgb(1, 2, 3); }\n");
    await writeFile(htmlPath, [
      "<!doctype html>",
      "<html>",
      "<head>",
      '<link rel="stylesheet" href="./style.css">',
      '<link rel="preconnect" href="https://example.com">',
      "</head>",
      "<body>hello</body>",
      "</html>",
    ].join("\n"));

    const html = await inlineLocalStylesheets(await readFile(htmlPath, "utf-8"), htmlPath);

    assert.match(html, /<style data-vlmkit-inline-stylesheet="\.\/style\.css">/);
    assert.match(html, /body \{ background: rgb\(1, 2, 3\); \}/);
    assert.match(html, /<link rel="preconnect" href="https:\/\/example\.com">/);
    assert.doesNotMatch(html, /rel="stylesheet"/);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("inlineLocalStylesheets leaves remote stylesheet links untouched", async () => {
  const dir = await mkdtemp(join(tmpdir(), "vlmkit-component-inline-"));
  try {
    const htmlPath = join(dir, "page.html");
    const html = [
      "<!doctype html>",
      "<html>",
      "<head>",
      '<link rel="stylesheet" href="https://cdn.example.com/style.css">',
      "</head>",
      "<body>hello</body>",
      "</html>",
    ].join("\n");

    const inlined = await inlineLocalStylesheets(html, htmlPath);
    assert.equal(inlined, html);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("suggestDeviceScaleFactorForTarget detects high-resolution mobile portrait targets", () => {
  assert.deepEqual(suggestDeviceScaleFactorForTarget({ width: 864, height: 1821 }), {
    deviceScaleFactor: 2,
    cssViewport: { width: 432, height: 911 },
    reason: "portrait target 864×1821 looks like a 2x mobile mock",
  });
});

test("suggestDeviceScaleFactorForTarget ignores normal desktop landscape targets", () => {
  assert.equal(suggestDeviceScaleFactorForTarget({ width: 1536, height: 1024 }), undefined);
});

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

test("sampleContrastFromImage estimates backdrop behind transparent menu text", () => {
  const png = new PNG({ width: 96, height: 48 });
  for (let y = 0; y < png.height; y++) {
    for (let x = 0; x < png.width; x++) {
      const i = (y * png.width + x) * 4;
      png.data[i] = 230;
      png.data[i + 1] = 0;
      png.data[i + 2] = 18;
      png.data[i + 3] = 255;
    }
  }
  for (let y = 15; y < 33; y++) {
    for (let x = 24; x < 72; x++) {
      const i = (y * png.width + x) * 4;
      png.data[i] = 255;
      png.data[i + 1] = 255;
      png.data[i + 2] = 255;
      png.data[i + 3] = 255;
    }
  }

  const result = sampleContrastFromImage(png, {
    bbox: { x: 0, y: 0, width: 96, height: 48 },
    color: [255, 255, 255],
  });

  assert.deepEqual(result.background, [232, 0, 16]);
  assert.ok((result.contrastRatio ?? 0) >= 4.5);
});

test("deriveComponentContractRuntime injects goal states and expected scrollports", () => {
  const runtime = deriveComponentContractRuntime({
    version: 1,
    screens: [
      {
        id: "shell",
        pattern: "app-shell",
        goal: "app-shell",
        viewports: [{ label: "desktop", width: 1440, height: 900 }],
        markers: [
          { kind: "scrollport", name: "messages", selector: "[data-scrollport=\"messages\"]", required: true },
        ],
        requiredStates: [
          { id: "selected", kind: "selected", selector: "[aria-current=\"page\"]", required: true },
          { id: "hover", kind: "hover", selector: "button", required: true },
          { id: "focus", kind: "focus-visible", selector: "button", required: true },
          { id: "scrolled", kind: "scrolled", selector: "[data-scrollport=\"messages\"]", required: true },
        ],
        expectedScrollports: [
          { id: "messages", name: "messages", selector: "[data-scrollport=\"messages\"]", axis: "y", required: true },
        ],
        landmarks: [
          {
            id: "main",
            role: "main",
            name: "",
            layout: {
              width: { kind: "fluid", max: 960 },
              height: { kind: "content" },
              display: { kind: "block" },
              scroll: { x: false, y: false },
            },
          },
        ],
      },
    ],
  });

  assert.equal(runtime.goal, "app-shell");
  assert.deepEqual(runtime.states, ["hover", "focus-visible"]);
  assert.equal(runtime.expectedScrollports[0]?.name, "messages");
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
