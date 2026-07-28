import { test } from "node:test";
import assert from "node:assert/strict";
import { boxDownscale, inferScaleCandidates } from "./mock-scan.ts";

test("inferScaleCandidates: a 2x retina export resolves to its CSS width", () => {
  const candidates = inferScaleCandidates(2560);
  assert.equal(candidates[0]!.scale, 2);
  assert.equal(candidates[0]!.cssWidth, 1280);
});

test("inferScaleCandidates: a plain @1x width is recognized as-is", () => {
  const candidates = inferScaleCandidates(375);
  assert.equal(candidates[0]!.scale, 1);
  assert.equal(candidates[0]!.cssWidth, 375);
});

test("inferScaleCandidates: ambiguous widths return every hypothesis, larger scale first", () => {
  // 1536 = @1x 1536 (common laptop) AND @2x 768 (tablet) AND @... — both listed.
  const candidates = inferScaleCandidates(1536);
  const scales = candidates.map((c) => c.scale);
  assert.ok(scales.includes(2) && scales.includes(1));
  assert.equal(candidates[0]!.scale, 2, "defaults to the largest matching scale");
});

test("inferScaleCandidates: unknown widths fall back to @1x with a note", () => {
  const candidates = inferScaleCandidates(999);
  assert.equal(candidates.length, 1);
  assert.equal(candidates[0]!.scale, 1);
  assert.match(candidates[0]!.reason, /assuming @1x/);
});

test("boxDownscale averages each block and inverts a nearest 2x upscale exactly", () => {
  // 2x2 source image at @1x, nearest-upscaled to 4x4.
  const px = [
    [10, 20, 30, 255], [200, 210, 220, 255],
    [50, 60, 70, 255], [90, 100, 110, 255],
  ];
  const up = new Uint8Array(4 * 4 * 4);
  for (let y = 0; y < 4; y++) {
    for (let x = 0; x < 4; x++) {
      const s = px[(y >> 1) * 2 + (x >> 1)]!;
      up.set(s, (y * 4 + x) * 4);
    }
  }
  const down = boxDownscale({ data: up, width: 4, height: 4 }, 2);
  assert.equal(down.width, 2);
  assert.equal(down.height, 2);
  for (let i = 0; i < 4; i++) {
    assert.deepEqual(Array.from(down.data.subarray(i * 4, i * 4 + 4)), px[i]);
  }
});

test("boxDownscale scale 1 is identity; non-integer scale throws", () => {
  const src = { data: new Uint8Array([1, 2, 3, 4]), width: 1, height: 1 };
  assert.equal(boxDownscale(src, 1), src);
  assert.throws(() => boxDownscale(src, 1.5), /Integer scale/);
});
