import assert from "node:assert/strict";
import { describe, it } from "vitest";
import { classifyRegion } from "./region-classify.ts";

function fillRect(data: Uint8Array, width: number, x0: number, y0: number, w: number, h: number, r: number, g: number, b: number) {
  for (let y = y0; y < y0 + h; y++) {
    for (let x = x0; x < x0 + w; x++) {
      const i = (y * width + x) * 4;
      data[i] = r; data[i + 1] = g; data[i + 2] = b; data[i + 3] = 255;
    }
  }
}

function blankRgba(width: number, height: number, r = 255, g = 255, b = 255): Uint8Array {
  const data = new Uint8Array(width * height * 4);
  for (let i = 0; i < data.length; i += 4) { data[i] = r; data[i + 1] = g; data[i + 2] = b; data[i + 3] = 255; }
  return data;
}

describe("classifyRegion", () => {
  it("classifies a solid color rectangle as filled-rect", () => {
    const data = blankRgba(200, 200);
    fillRect(data, 200, 40, 40, 80, 30, 37, 99, 235);  // solid blue
    const c = classifyRegion(data, 200, 200, { top: 40, left: 40, width: 80, height: 30 });
    assert.equal(c.kind, "filled-rect");
    assert.ok(c.features.colorCount <= 4);
    assert.ok(c.features.lumaStd < 20);
  });

  it("classifies multiple dark text bands as text", () => {
    const data = blankRgba(300, 200);
    // Three horizontal dark bands at varying y (simulating 3 text rows)
    fillRect(data, 300, 20, 30, 200, 8, 20, 20, 20);
    fillRect(data, 300, 20, 60, 200, 8, 20, 20, 20);
    fillRect(data, 300, 20, 90, 200, 8, 20, 20, 20);
    const c = classifyRegion(data, 300, 200, { top: 20, left: 10, width: 220, height: 100 });
    assert.equal(c.kind, "text");
    assert.ok(c.features.stripeRows >= 3);
  });

  it("classifies a small multi-color square as icon", () => {
    const data = blankRgba(200, 200);
    // 24×24 icon with a few colors
    fillRect(data, 200, 80, 80, 24, 24, 30, 30, 30);
    fillRect(data, 200, 84, 84, 6, 6, 200, 50, 50);
    fillRect(data, 200, 92, 92, 6, 6, 50, 200, 50);
    fillRect(data, 200, 84, 92, 6, 6, 50, 50, 200);
    const c = classifyRegion(data, 200, 200, { top: 80, left: 80, width: 24, height: 24 });
    assert.equal(c.kind, "icon");
  });

  it("returns unknown for degenerate (zero-size) region", () => {
    const data = blankRgba(50, 50);
    const c = classifyRegion(data, 50, 50, { top: 0, left: 0, width: 0, height: 0 });
    assert.equal(c.kind, "unknown");
  });
});
