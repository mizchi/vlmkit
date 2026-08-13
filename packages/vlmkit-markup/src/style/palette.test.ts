import assert from "node:assert/strict";
import { describe, it } from "vitest";
import { extractPaletteFromRgba } from "./palette-extract.ts";
import { diffPalettes } from "./palette-diff.ts";

function fillRgba(
  width: number,
  height: number,
  fills: Array<{ y0: number; y1: number; r: number; g: number; b: number }>,
): Uint8Array {
  const data = new Uint8Array(width * height * 4);
  for (let i = 0; i < data.length; i += 4) data[i + 3] = 255;
  for (const f of fills) {
    for (let y = f.y0; y < f.y1; y++) {
      for (let x = 0; x < width; x++) {
        const i = (y * width + x) * 4;
        data[i] = f.r; data[i + 1] = f.g; data[i + 2] = f.b;
      }
    }
  }
  return data;
}

describe("extractPaletteFromRgba", () => {
  it("returns top colors sorted by share", () => {
    const data = fillRgba(100, 100, [
      { y0: 0, y1: 80, r: 255, g: 255, b: 255 },
      { y0: 80, y1: 95, r: 0, g: 0, b: 0 },
      { y0: 95, y1: 100, r: 59, g: 130, b: 246 }, // tailwind blue-500
    ]);
    const palette = extractPaletteFromRgba(data, 100, 100, { stride: 1 });
    assert.ok(palette.length >= 3);
    // White dominates (80% area).
    assert.equal(palette[0]!.r > 240, true);
    assert.equal(palette[0]!.share > 0.7, true);
  });

  it("drops buckets below minShare", () => {
    const data = fillRgba(100, 100, [
      { y0: 0, y1: 99, r: 255, g: 255, b: 255 },
      { y0: 99, y1: 100, r: 255, g: 0, b: 0 }, // 1% red
    ]);
    const palette = extractPaletteFromRgba(data, 100, 100, { stride: 1, minShare: 0.05 });
    // Red is below the 5% floor — only white survives.
    assert.equal(palette.length, 1);
  });

  it("returns empty array for degenerate inputs", () => {
    assert.deepEqual(extractPaletteFromRgba(new Uint8Array(0), 0, 0), []);
  });
});

describe("diffPalettes", () => {
  it("matches near-identical colors within tolerance", () => {
    const baseline = [
      { r: 59, g: 130, b: 246, hex: "#3b82f6", share: 0.3, count: 30 },
      { r: 255, g: 255, b: 255, hex: "#ffffff", share: 0.7, count: 70 },
    ];
    const variant = [
      { r: 60, g: 131, b: 247, hex: "#3c83f7", share: 0.3, count: 30 }, // close to blue
      { r: 255, g: 255, b: 255, hex: "#ffffff", share: 0.7, count: 70 },
    ];
    const result = diffPalettes(baseline, variant);
    assert.equal(result.matched.length, 2);
    assert.equal(result.onlyInBaseline.length, 0);
    assert.equal(result.onlyInVariant.length, 0);
  });

  it("flags colors that diverge beyond tolerance", () => {
    const baseline = [
      { r: 59, g: 130, b: 246, hex: "#3b82f6", share: 0.3, count: 30 }, // blue-500
      { r: 255, g: 255, b: 255, hex: "#ffffff", share: 0.7, count: 70 },
    ];
    const variant = [
      { r: 37, g: 99, b: 235, hex: "#2563eb", share: 0.3, count: 30 }, // blue-600 (Δ≈40)
      { r: 255, g: 255, b: 255, hex: "#ffffff", share: 0.7, count: 70 },
    ];
    const result = diffPalettes(baseline, variant);
    assert.equal(result.matched.length, 1); // white only
    assert.equal(result.onlyInBaseline.length, 1);
    assert.equal(result.onlyInBaseline[0]!.hex, "#3b82f6");
    assert.equal(result.onlyInVariant.length, 1);
    assert.equal(result.onlyInVariant[0]!.hex, "#2563eb");
  });

  it("respects minReportShare", () => {
    const baseline = [
      { r: 200, g: 0, b: 0, hex: "#c80000", share: 0.001, count: 1 }, // tiny
    ];
    const variant = [
      { r: 255, g: 255, b: 255, hex: "#ffffff", share: 1.0, count: 100 },
    ];
    const result = diffPalettes(baseline, variant, { minReportShare: 0.01 });
    assert.equal(result.onlyInBaseline.length, 0); // dropped — below floor
  });
});
