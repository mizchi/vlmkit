import { test } from "vitest";
import assert from "node:assert/strict";
import { compareLandscapeFromRgba } from "./landscape-diff.ts";
import type { PngData } from "@mizchi/vlmkit-core/png-utils.ts";

function image(
  width: number,
  height: number,
  rects: Array<{ x: number; y: number; w: number; h: number; r: number; g: number; b: number }> = [],
  bg = { r: 250, g: 250, b: 247 },
): PngData {
  const data = new Uint8Array(width * height * 4);
  for (let i = 0; i < width * height; i++) {
    data[i * 4] = bg.r;
    data[i * 4 + 1] = bg.g;
    data[i * 4 + 2] = bg.b;
    data[i * 4 + 3] = 255;
  }
  for (const rect of rects) {
    for (let y = rect.y; y < Math.min(height, rect.y + rect.h); y++) {
      for (let x = rect.x; x < Math.min(width, rect.x + rect.w); x++) {
        const i = (y * width + x) * 4;
        data[i] = rect.r;
        data[i + 1] = rect.g;
        data[i + 2] = rect.b;
        data[i + 3] = 255;
      }
    }
  }
  return { width, height, data };
}

test("compareLandscapeFromRgba returns perfect similarity for identical images", () => {
  const a = image(320, 200, [
    { x: 32, y: 32, w: 180, h: 80, r: 30, g: 80, b: 70 },
  ]);
  const r = compareLandscapeFromRgba(a, a, { cols: 8, rows: 5 });
  assert.equal(r.score, 0);
  assert.equal(r.similarity, 1);
  assert.equal(r.changedCells, 0);
});

test("compareLandscapeFromRgba detects large layout moves", () => {
  const baseline = image(320, 200, [
    { x: 32, y: 40, w: 180, h: 72, r: 30, g: 80, b: 70 },
  ]);
  const current = image(320, 200, [
    { x: 112, y: 108, w: 180, h: 72, r: 30, g: 80, b: 70 },
  ]);
  const r = compareLandscapeFromRgba(baseline, current, { cols: 8, rows: 5 });
  assert.ok(r.score > 0.05, `score=${r.score}`);
  assert.ok(r.changedCells > 0);
  assert.ok(r.topCells[0]!.score > 0.1);
});

test("compareLandscapeFromRgba is less sensitive to tiny text-like pixel changes", () => {
  const baseline = image(400, 240, [
    { x: 40, y: 80, w: 260, h: 4, r: 20, g: 20, b: 20 },
  ]);
  const current = image(400, 240, [
    { x: 40, y: 80, w: 220, h: 4, r: 20, g: 20, b: 20 },
  ]);
  const r = compareLandscapeFromRgba(baseline, current, { cols: 10, rows: 6 });
  assert.ok(r.score < 0.01, `score=${r.score}`);
  assert.equal(r.changedCells, 0);
});

test("default grid follows MoonBit policy for wide canvases", () => {
  const baseline = image(320, 200);
  const current = image(320, 200);
  const r = compareLandscapeFromRgba(baseline, current);
  assert.equal(r.grid.cols, 16);
  assert.equal(r.grid.rows, 10);
});
