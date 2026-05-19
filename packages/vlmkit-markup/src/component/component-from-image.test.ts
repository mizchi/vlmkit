import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import test from "node:test";
import assert from "node:assert/strict";
import {
  inlineLocalStylesheets,
  renderReportMarkdown,
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
