import assert from "node:assert/strict";
import { test } from "vitest";
import { PNG } from "pngjs";
import {
  analyzePngDiff,
  attributeCssProperties,
  classifyDrift,
  diffSemanticSnapshots,
} from "./repair-context.mjs";

test("analyzePngDiff measures changed bbox and maps it to visual elements", () => {
  const baseline = makePng(4, 4, (x, y) => [20 + x, 40 + y, 60, 255]);
  const actual = makePng(4, 4, (x, y) => {
    if (x >= 1 && x <= 2 && y >= 1 && y <= 2) return [220, 80, 40, 255];
    return [20 + x, 40 + y, 60, 255];
  });
  const elements = [{
    path: "html/body/main/section[1]/article[2]",
    tag: "article",
    classes: "metric",
    top: 1,
    left: 1,
    width: 2,
    height: 2,
  }];

  const result = analyzePngDiff(PNG.sync.write(baseline), PNG.sync.write(actual), elements);

  assert.equal(result.width, 4);
  assert.equal(result.height, 4);
  assert.equal(result.changedPixels, 4);
  assert.equal(result.diffRatio, 0.25);
  assert.deepEqual(result.bbox, { left: 1, top: 1, width: 2, height: 2 });
  assert.equal(result.selectorMatches[0]?.selector, ".metric");
  assert.equal(result.edgeCandidates[0]?.selector, ".metric");
  assert.equal(result.hints.some((hint) => hint.includes(".metric")), true);
});

test("attributeCssProperties ranks changed layout and paint properties near the diff", () => {
  const imageDiff = {
    bbox: { left: 0, top: 10, width: 300, height: 220 },
    width: 300,
    height: 260,
    averageBaselineColor: "rgba(250, 250, 250, 1)",
    averageActualColor: "rgba(245, 248, 248, 1)",
    selectorMatches: [],
    edgeCandidates: [{
      selector: ".metric",
      path: "metric-blocked",
      bbox: { left: 0, top: 0, width: 100, height: 116 },
      reason: "10px from diff top",
      score: 1,
    }],
  };
  const baseline = [{
    key: "metric-blocked",
    path: "metric-blocked",
    selector: ".metric",
    tag: "article",
    top: 0,
    left: 0,
    width: 100,
    height: 116,
    styles: {
      "min-height": "116px",
      "background-color": "rgb(255, 255, 255)",
      "border-color": "rgb(216, 222, 229)",
    },
  }];
  const actual = [{
    ...baseline[0],
    height: 148,
    styles: {
      "min-height": "148px",
      "background-color": "rgb(232, 243, 242)",
      "border-color": "rgb(154, 167, 178)",
    },
  }];

  const attribution = attributeCssProperties(imageDiff, baseline, actual);

  assert.equal(attribution.changedProperties[0]?.selector, ".metric");
  assert.equal(attribution.changedProperties[0]?.property, "min-height");
  assert.equal(attribution.changedProperties.some((row) => row.property === "border-color"), true);
  assert.equal(attribution.rectDeltas[0]?.heightDelta, 32);
  assert.equal(attribution.hints.some((hint) => hint.includes("min-height")), true);
});

test("diffSemanticSnapshots classifies visual-only drift when semantics are unchanged", () => {
  const baseline = {
    headings: ["Release Queue", "Candidate releases"],
    buttons: ["All", "Blocked"],
    testIds: { "blocked-count": "2" },
  };
  const actual = structuredClone(baseline);

  const semantic = diffSemanticSnapshots(baseline, actual);
  const drift = classifyDrift({
    imageDiff: { changedPixels: 10 },
    semanticDiff: semantic,
    styleAttribution: { changedProperties: [{ property: "min-height", category: "layout" }] },
  });

  assert.equal(semantic.changed, false);
  assert.equal(drift.kind, "visual-only");
  assert.equal(drift.primaryCause, "layout");
});

function makePng(width, height, pixel) {
  const png = new PNG({ width, height });
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 4;
      const [r, g, b, a] = pixel(x, y);
      png.data[i] = r;
      png.data[i + 1] = g;
      png.data[i + 2] = b;
      png.data[i + 3] = a;
    }
  }
  return png;
}
