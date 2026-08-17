import { describe, it } from "vitest";
import assert from "node:assert/strict";
import { detectBandShifts } from "./heatmap.ts";

/**
 * Build a synthetic baseline image with bright stripes at specific y rows,
 * plus a "current" version where each stripe has been shifted vertically
 * by a configurable amount. Lets us assert per-band shift detection in
 * isolation, with no Playwright dependency.
 */
function buildBandedImage(
  width: number,
  height: number,
  stripes: Array<{ y: number; gray: number }>,
): { data: Uint8Array; width: number; height: number } {
  const data = new Uint8Array(width * height * 4);
  // Light gray background so we have non-flat variance.
  for (let i = 0; i < data.length; i += 4) {
    data[i] = 230; data[i + 1] = 230; data[i + 2] = 230; data[i + 3] = 255;
  }
  for (const s of stripes) {
    if (s.y < 0 || s.y >= height) continue;
    for (let x = 0; x < width; x++) {
      const idx = (s.y * width + x) * 4;
      data[idx] = s.gray;
      data[idx + 1] = s.gray;
      data[idx + 2] = s.gray;
    }
  }
  return { data, width, height };
}

describe("detectBandShifts", () => {
  it("returns no regions when there is no shift", () => {
    const stripes = Array.from({ length: 6 }, (_, i) => ({ y: 50 + i * 100, gray: 20 }));
    const baseline = buildBandedImage(200, 800, stripes);
    const current = buildBandedImage(200, 800, stripes);

    const regions = detectBandShifts(baseline, current, { bandHeight: 200 });
    assert.equal(regions.length, 0);
  });

  it("detects a single band shift", () => {
    // Stripes inside the first band only; uniform second band has no
    // variance and is skipped.
    const baselineStripes = [
      { y: 30, gray: 0 },
      { y: 80, gray: 0 },
      { y: 130, gray: 0 },
      { y: 180, gray: 0 },
    ];
    const baseline = buildBandedImage(200, 600, baselineStripes);
    // Shift all stripes 10px down in the current image.
    const currentStripes = baselineStripes.map((s) => ({ ...s, y: s.y + 10 }));
    const current = buildBandedImage(200, 600, currentStripes);

    const regions = detectBandShifts(baseline, current, { bandHeight: 200 });
    assert.ok(regions.length >= 1);
    const first = regions[0]!;
    assert.equal(first.shift, 10);
    assert.ok((first.confidence ?? 0) > 0);
  });

  it("detects different shifts in different bands", () => {
    // Two distinct bands with stripes in each — first band shifts +5,
    // second band shifts +15.
    const baselineStripes = [
      // band 0
      { y: 30, gray: 0 }, { y: 80, gray: 0 }, { y: 130, gray: 0 }, { y: 180, gray: 0 },
      // band 1
      { y: 230, gray: 0 }, { y: 280, gray: 0 }, { y: 330, gray: 0 }, { y: 380, gray: 0 },
    ];
    const currentStripes = baselineStripes.map((s, i) =>
      i < 4 ? { ...s, y: s.y + 5 } : { ...s, y: s.y + 15 },
    );
    const baseline = buildBandedImage(200, 600, baselineStripes);
    const current = buildBandedImage(200, 600, currentStripes);

    const regions = detectBandShifts(baseline, current, { bandHeight: 200 });
    assert.equal(regions.length, 2);
    assert.equal(regions[0]!.shift, 5);
    assert.equal(regions[1]!.shift, 15);
    assert.notEqual(regions[0]!.yStart, regions[1]!.yStart);
  });

  it("skips bands with no luminance variance (flat background)", () => {
    // First band has stripes, rest is flat gray.
    const baselineStripes = [
      { y: 30, gray: 0 }, { y: 80, gray: 0 }, { y: 130, gray: 0 }, { y: 180, gray: 0 },
    ];
    const currentStripes = baselineStripes.map((s) => ({ ...s, y: s.y + 8 }));
    const baseline = buildBandedImage(200, 800, baselineStripes);
    const current = buildBandedImage(200, 800, currentStripes);

    const regions = detectBandShifts(baseline, current, { bandHeight: 200 });
    // Only the populated first band should be reported.
    assert.equal(regions.length, 1);
    assert.equal(regions[0]!.shift, 8);
  });

  it("returns empty array when image is too short for two bands", () => {
    const baseline = buildBandedImage(100, 100, [{ y: 30, gray: 0 }]);
    const current = buildBandedImage(100, 100, [{ y: 40, gray: 0 }]);
    const regions = detectBandShifts(baseline, current, { bandHeight: 200 });
    assert.equal(regions.length, 0);
  });
});
