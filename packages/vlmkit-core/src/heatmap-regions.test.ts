import assert from "node:assert/strict";
import { describe, it } from "vitest";
import { findHeatmapRegionsFromRgba } from "./heatmap-regions.ts";

/** Synthesize an RGBA buffer with non-hot background + drawn hot rectangles. */
function synth(
  width: number,
  height: number,
  hotRects: Array<{ left: number; top: number; w: number; h: number }>,
): Uint8Array {
  const data = new Uint8Array(width * height * 4);
  // Background: tinted gray (resized baseline, low alpha) — not "hot".
  for (let i = 0; i < data.length; i += 4) {
    data[i] = 180; data[i + 1] = 180; data[i + 2] = 180; data[i + 3] = 255;
  }
  // Hot rectangles: pixelmatch's bright red.
  for (const r of hotRects) {
    for (let y = r.top; y < r.top + r.h; y++) {
      for (let x = r.left; x < r.left + r.w; x++) {
        const i = (y * width + x) * 4;
        data[i] = 255; data[i + 1] = 60; data[i + 2] = 60;
      }
    }
  }
  return data;
}

describe("findHeatmapRegionsFromRgba", () => {
  it("finds a single hot rectangle", () => {
    const data = synth(200, 200, [{ left: 30, top: 40, w: 80, h: 20 }]);
    const regions = findHeatmapRegionsFromRgba(data, 200, 200);
    assert.equal(regions.length, 1);
    assert.equal(regions[0]!.left, 30);
    assert.equal(regions[0]!.top, 40);
    assert.equal(regions[0]!.width, 80);
    assert.equal(regions[0]!.height, 20);
  });

  it("separates two disjoint hot regions", () => {
    const data = synth(200, 200, [
      { left: 10, top: 10, w: 30, h: 30 },
      { left: 120, top: 80, w: 50, h: 20 },
    ]);
    const regions = findHeatmapRegionsFromRgba(data, 200, 200);
    assert.equal(regions.length, 2);
    // Sorted by area descending: 50*20=1000 vs 30*30=900
    assert.equal(regions[0]!.width, 50);
    assert.equal(regions[1]!.width, 30);
  });

  it("filters below minArea", () => {
    const data = synth(200, 200, [
      { left: 10, top: 10, w: 30, h: 30 },     // 900
      { left: 120, top: 120, w: 5, h: 5 },     // 25 — below default 80
    ]);
    const regions = findHeatmapRegionsFromRgba(data, 200, 200);
    assert.equal(regions.length, 1);
    assert.equal(regions[0]!.area, 900);
  });

  it("ignores non-hot bg", () => {
    const data = synth(100, 100, []);
    const regions = findHeatmapRegionsFromRgba(data, 100, 100);
    assert.equal(regions.length, 0);
  });

  it("returns empty array for degenerate inputs", () => {
    assert.deepEqual(findHeatmapRegionsFromRgba(new Uint8Array(0), 0, 0), []);
  });
});
