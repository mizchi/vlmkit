import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  adaptiveBgTolerance,
  extractComponentsFromRgba,
  matchComponents,
  type ComponentBbox,
} from "./component-bbox.ts";

/** Synthesize an RGBA buffer with a uniform background + drawn rectangles. */
function synth(
  width: number,
  height: number,
  bg: [number, number, number],
  rects: Array<{ left: number; top: number; w: number; h: number; color: [number, number, number] }>,
): Uint8Array {
  const data = new Uint8Array(width * height * 4);
  for (let i = 0; i < data.length; i += 4) {
    data[i] = bg[0]; data[i + 1] = bg[1]; data[i + 2] = bg[2]; data[i + 3] = 255;
  }
  for (const r of rects) {
    for (let y = r.top; y < r.top + r.h; y++) {
      for (let x = r.left; x < r.left + r.w; x++) {
        const i = (y * width + x) * 4;
        data[i] = r.color[0]; data[i + 1] = r.color[1]; data[i + 2] = r.color[2]; data[i + 3] = 255;
      }
    }
  }
  return data;
}

describe("extractComponentsFromRgba", () => {
  it("finds a single rectangle on a flat background", () => {
    const data = synth(200, 200, [240, 240, 240], [
      { left: 50, top: 60, w: 80, h: 40, color: [0, 0, 0] },
    ]);
    const comps = extractComponentsFromRgba(data, 200, 200);
    assert.equal(comps.length, 1);
    assert.equal(comps[0]!.left, 50);
    assert.equal(comps[0]!.top, 60);
    assert.equal(comps[0]!.width, 80);
    assert.equal(comps[0]!.height, 40);
    assert.equal(comps[0]!.area, 80 * 40);
  });

  it("sorts multiple components by area (largest first)", () => {
    const data = synth(300, 300, [255, 255, 255], [
      { left: 10, top: 10, w: 50, h: 50, color: [50, 50, 50] },        // small (2500)
      { left: 100, top: 100, w: 150, h: 100, color: [200, 0, 0] },     // big (15000)
      { left: 80, top: 240, w: 30, h: 30, color: [0, 200, 0] },        // tiny (900)
    ]);
    const comps = extractComponentsFromRgba(data, 300, 300, { minArea: 500 });
    assert.equal(comps.length, 3);
    assert.equal(comps[0]!.width, 150); // biggest first
    assert.equal(comps[1]!.width, 50);
    assert.equal(comps[2]!.width, 30);
  });

  it("filters components below minArea", () => {
    const data = synth(100, 100, [255, 255, 255], [
      { left: 10, top: 10, w: 20, h: 20, color: [0, 0, 0] },           // 400
      { left: 40, top: 40, w: 5, h: 5, color: [0, 0, 0] },             // 25
    ]);
    const comps = extractComponentsFromRgba(data, 100, 100, { minArea: 100 });
    assert.equal(comps.length, 1);
    assert.equal(comps[0]!.area, 400);
  });

  it("merges adjacent pixels (4-connectivity)", () => {
    const data = synth(50, 50, [255, 255, 255], [
      { left: 5, top: 5, w: 10, h: 10, color: [0, 0, 0] },
      { left: 15, top: 5, w: 10, h: 10, color: [0, 0, 0] }, // touches the first
    ]);
    const comps = extractComponentsFromRgba(data, 50, 50, { minArea: 50 });
    assert.equal(comps.length, 1);
    assert.equal(comps[0]!.width, 20);
  });

  it("detects backgrounds from a non-white image", () => {
    // Dark slate background; one bright rectangle.
    const data = synth(100, 100, [15, 23, 42], [
      { left: 20, top: 20, w: 60, h: 40, color: [255, 255, 255] },
    ]);
    const comps = extractComponentsFromRgba(data, 100, 100);
    assert.equal(comps.length, 1);
    assert.equal(comps[0]!.width, 60);
  });

  it("returns empty array on degenerate inputs", () => {
    assert.deepEqual(extractComponentsFromRgba(new Uint8Array(0), 0, 0), []);
  });

  it("sampled fillColor approximates the rectangle's color", () => {
    const data = synth(80, 80, [240, 240, 240], [
      { left: 10, top: 10, w: 60, h: 60, color: [200, 80, 80] },
    ]);
    const comps = extractComponentsFromRgba(data, 80, 80, { minArea: 100 });
    assert.match(comps[0]!.fillColor, /^rgb\(/);
    assert.match(comps[0]!.fillColor, /200/);
  });
});

describe("matchComponents", () => {
  function box(over: Partial<ComponentBbox>): ComponentBbox {
    return { top: 0, left: 0, width: 100, height: 50, area: 5000, fillColor: "rgb(0,0,0)", ...over };
  }

  it("pairs by rank-after-sort-by-area and reports per-axis deltas", () => {
    const baseline = [
      box({ top: 100, left: 50, width: 360, height: 500, area: 180000 }),
      box({ top: 620, left: 100, width: 200, height: 40, area: 8000 }),
    ];
    const variant = [
      box({ top: 110, left: 55, width: 342, height: 488, area: 166896 }),
      box({ top: 610, left: 105, width: 190, height: 40, area: 7600 }),
    ];
    const m = matchComponents(baseline, variant);
    assert.equal(m.length, 2);
    assert.equal(m[0]!.deltaTop, 10);
    assert.equal(m[0]!.deltaLeft, 5);
    assert.equal(m[0]!.deltaWidth, -18);
    assert.equal(m[0]!.deltaHeight, -12);
    assert.ok(m[0]!.iou > 0.8); // mostly overlapping
  });

  it("returns min(baseline, variant) pairs when counts differ", () => {
    const m = matchComponents([box({}), box({ area: 1000 })], [box({})]);
    assert.equal(m.length, 1);
  });

  it("returns empty on empty input", () => {
    assert.deepEqual(matchComponents([], []), []);
  });
});

// 2026-08-01 hard-target audit: a fixed tolerance of 12 classified
// #f4f4f4-on-white cards (per-channel distance 11) as BACKGROUND, so they
// were never extracted and `verify markup` scored their removal as a 0.01%
// diff. Most light-surface tokens sit under 12 (#fafafa 5, #f5f5f5 10).
describe("adaptive background tolerance", () => {
  const fill = (w: number, h: number, rgb: [number, number, number]) => {
    const data = new Uint8Array(w * h * 4);
    for (let i = 0; i < w * h; i++) {
      data[i * 4] = rgb[0]; data[i * 4 + 1] = rgb[1]; data[i * 4 + 2] = rgb[2]; data[i * 4 + 3] = 255;
    }
    return data;
  };

  it("a clean render gets a tight tolerance; a noisy one keeps the permissive default", () => {
    const clean = fill(80, 80, [255, 255, 255]);
    assert.equal(adaptiveBgTolerance(clean, 80, 80, [255, 255, 255]), 4);

    // Noise of +-4/channel around white: the estimate climbs back toward 12.
    const noisy = fill(80, 80, [255, 255, 255]);
    for (let i = 0; i < 80 * 80; i++) {
      const d = (i % 5) - 2 + ((i % 3) - 1); // small, varied deviations
      const v = 255 - Math.abs(d) * 2;
      noisy[i * 4] = v; noisy[i * 4 + 1] = v; noisy[i * 4 + 2] = v;
    }
    assert.ok(adaptiveBgTolerance(noisy, 80, 80, [255, 255, 255]) > 4);
  });

  it("extracts a pale #f4f4f4 card on white that the fixed tolerance of 12 missed", () => {
    const w = 120, h = 120;
    const data = fill(w, h, [255, 255, 255]);
    for (let y = 10; y < 60; y++) {
      for (let x = 10; x < 90; x++) {
        const i = (y * w + x) * 4;
        data[i] = 244; data[i + 1] = 244; data[i + 2] = 244;
      }
    }
    const found = extractComponentsFromRgba(data, w, h);
    assert.equal(found.length, 1, JSON.stringify(found));
    assert.equal(found[0]!.width, 80);
    assert.equal(found[0]!.height, 50);

    // Pinning the old tolerance reproduces the miss, documenting the cause.
    assert.equal(extractComponentsFromRgba(data, w, h, { bgTolerance: 12 }).length, 0);
  });
});
