import { describe, it } from "vitest";
import assert from "node:assert/strict";
import { sampleRegionColorSample } from "./heatmap.ts";
import type { PngData } from "./png-utils.ts";

function blankPng(width: number, height: number, fill: [number, number, number]): PngData {
  const data = new Uint8Array(width * height * 4);
  for (let i = 0; i < width * height; i++) {
    data[i * 4] = fill[0];
    data[i * 4 + 1] = fill[1];
    data[i * 4 + 2] = fill[2];
    data[i * 4 + 3] = 255;
  }
  return { width, height, data };
}

function paintRows(
  png: PngData,
  y0: number,
  y1: number,
  color: [number, number, number],
): void {
  for (let y = y0; y < y1; y++) {
    for (let x = 0; x < png.width; x++) {
      const i = (y * png.width + x) * 4;
      png.data[i] = color[0];
      png.data[i + 1] = color[1];
      png.data[i + 2] = color[2];
    }
  }
}

describe("sampleRegionColorSample", () => {
  it("samples the differing minority, not the unchanged majority (draft 10)", () => {
    // Region is mostly white form inputs (unchanged); only the top 2 of 10
    // rows are a dark background that recolors #212529 -> #090353. A
    // region-wide median would land on white on both sides and report
    // "no change" on exactly the region that changed.
    const baseline = blankPng(10, 10, [255, 255, 255]);
    const current = blankPng(10, 10, [255, 255, 255]);
    paintRows(baseline, 0, 2, [33, 37, 41]); // #212529
    paintRows(current, 0, 2, [9, 3, 83]); // #090353

    const region = { x: 0, y: 0, width: 10, height: 10 };
    const sample = sampleRegionColorSample(baseline, current, region);

    assert.ok(sample, "expected a color sample");
    assert.equal(sample!.baseline.hex, "#212529");
    assert.equal(sample!.current.hex, "#090353");
    assert.ok(sample!.distance > 50);
  });

  it("returns identical colors when nothing differs", () => {
    const baseline = blankPng(10, 10, [255, 255, 255]);
    const current = blankPng(10, 10, [255, 255, 255]);
    const sample = sampleRegionColorSample(baseline, current, {
      x: 0,
      y: 0,
      width: 10,
      height: 10,
    });
    assert.ok(sample);
    assert.equal(sample!.baseline.hex, sample!.current.hex);
    assert.equal(sample!.distance, 0);
  });

  it("surfaces a peak pixel pair for a sparse text-color change (draft 11)", () => {
    // A thin glyph: one antialiased blend row plus one core row. The mean
    // over differing pixels is muddied by the blend; the peak pixel pair
    // recovers the glyph core color (#333333 -> #cc0000).
    const baseline = blankPng(40, 12, [255, 255, 255]);
    const current = blankPng(40, 12, [255, 255, 255]);
    // antialiased blend row (small delta)
    paintRows(baseline, 5, 6, [200, 200, 200]);
    paintRows(current, 5, 6, [210, 190, 190]);
    // glyph core: a single pixel with a strong, unambiguous delta
    const setPixel = (png: PngData, x: number, y: number, c: [number, number, number]) => {
      const i = (y * png.width + x) * 4;
      png.data[i] = c[0];
      png.data[i + 1] = c[1];
      png.data[i + 2] = c[2];
    };
    setPixel(baseline, 20, 6, [51, 51, 51]); // #333333
    setPixel(current, 20, 6, [204, 0, 0]); // #cc0000

    const sample = sampleRegionColorSample(baseline, current, {
      x: 0,
      y: 0,
      width: 40,
      height: 12,
    });

    assert.ok(sample);
    assert.ok(sample!.peak, "expected a peak pixel pair on a sparse region");
    assert.equal(sample!.peak!.baseline.hex, "#333333");
    assert.equal(sample!.peak!.current.hex, "#cc0000");
  });

  it("omits the peak when the change fills the region densely", () => {
    const baseline = blankPng(10, 10, [240, 240, 240]);
    const current = blankPng(10, 10, [10, 20, 200]);
    const sample = sampleRegionColorSample(baseline, current, {
      x: 0,
      y: 0,
      width: 10,
      height: 10,
    });
    assert.ok(sample);
    assert.equal(sample!.peak, undefined);
  });

  it("returns undefined for a degenerate region", () => {
    const baseline = blankPng(10, 10, [255, 255, 255]);
    const current = blankPng(10, 10, [255, 255, 255]);
    const sample = sampleRegionColorSample(baseline, current, {
      x: 20,
      y: 20,
      width: 4,
      height: 4,
    });
    assert.equal(sample, undefined);
  });
});
