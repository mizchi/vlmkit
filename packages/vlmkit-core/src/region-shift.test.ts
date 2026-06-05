import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { estimateRegionShift } from "./region-shift.ts";
import type { PngData } from "./png-utils.ts";

function blankImage(width: number, height: number): PngData {
  const data = new Uint8Array(width * height * 4);
  data.fill(255);
  return { width, height, data };
}

function drawRect(
  img: PngData,
  x: number,
  y: number,
  w: number,
  h: number,
  [r, g, b]: [number, number, number],
): void {
  for (let yy = y; yy < y + h; yy++) {
    for (let xx = x; xx < x + w; xx++) {
      const i = (yy * img.width + xx) * 4;
      img.data[i] = r;
      img.data[i + 1] = g;
      img.data[i + 2] = b;
      img.data[i + 3] = 255;
    }
  }
}

describe("estimateRegionShift", () => {
  it("detects a horizontal translation and reports the offset", () => {
    const baseline = blankImage(240, 120);
    const current = blankImage(240, 120);
    drawRect(baseline, 40, 40, 30, 20, [20, 40, 160]);
    drawRect(current, 76, 40, 30, 20, [20, 40, 160]);

    // Diff region covering the union of old + new positions.
    const region = { x: 40, y: 40, width: 66, height: 20 };
    const shift = estimateRegionShift(baseline, current, region);
    assert.ok(shift, "shift should be detected");
    assert.ok(Math.abs(shift.dx - 36) <= 2, `dx should be ~36, got ${shift.dx}`);
    assert.equal(shift.dy, 0);
    assert.ok(shift.confidence > 0.5);
  });

  it("detects a vertical translation", () => {
    const baseline = blankImage(120, 240);
    const current = blankImage(120, 240);
    drawRect(baseline, 40, 60, 30, 20, [200, 80, 40]);
    drawRect(current, 40, 92, 30, 20, [200, 80, 40]);

    const region = { x: 40, y: 60, width: 30, height: 52 };
    const shift = estimateRegionShift(baseline, current, region);
    assert.ok(shift, "shift should be detected");
    assert.equal(shift.dx, 0);
    assert.ok(Math.abs(shift.dy - 32) <= 2, `dy should be ~32, got ${shift.dy}`);
  });

  it("returns null for a pure recolor (no movement)", () => {
    const baseline = blankImage(240, 120);
    const current = blankImage(240, 120);
    drawRect(baseline, 40, 40, 30, 20, [20, 40, 160]);
    drawRect(current, 40, 40, 30, 20, [180, 40, 40]);

    const region = { x: 40, y: 40, width: 30, height: 20 };
    const shift = estimateRegionShift(baseline, current, region);
    assert.equal(shift, null);
  });

  it("returns null for featureless regions", () => {
    const baseline = blankImage(240, 120);
    const current = blankImage(240, 120);
    const region = { x: 40, y: 40, width: 60, height: 40 };
    assert.equal(estimateRegionShift(baseline, current, region), null);
  });
});
