import assert from "node:assert/strict";
import { describe, it } from "vite-plus/test";
import { regionDelta } from "./heatmap.ts";

const W = 40;
const H = 20;
/** A white image with 1px vertical "glyph stems" at the given columns, each its own grey. */
const image = (stems: Record<number, number>) => {
  const data = new Uint8Array(W * H * 4).fill(255);
  for (let y = 0; y < H; y++) {
    for (const [x, v] of Object.entries(stems)) {
      const i = (y * W + Number(x)) * 4;
      data[i] = data[i + 1] = data[i + 2] = v;
    }
  }
  return { width: W, height: H, data };
};
const region = { x: 0, y: 0, width: W, height: H, diffPixelCount: 1 };

describe("regionDelta: edge rendering versus a change of content", () => {
  it("calls stems re-rendered half a pixel over edge-only (they lighten as much as they darken)", () => {
    const before = image({ 10: 0, 20: 0, 30: 0 });
    const after = image({ 10: 128, 11: 128, 20: 128, 21: 128, 30: 128, 31: 128 });
    const d = regionDelta(before, after, region);
    assert.equal(d.edgeOnly, true);
    assert.ok(d.max >= 127, String(d.max));
  });

  it("does not call a recoloured 1px border edge-only: it blurs away as much, but all one way", () => {
    const d = regionDelta(image({ 10: 0, 20: 0, 30: 0 }), image({ 10: 100, 20: 100, 30: 100 }), region);
    assert.equal(d.edgeOnly, false);
  });

  it("does not call a recoloured block edge-only", () => {
    const stems: Record<number, number> = {};
    for (let x = 5; x < 35; x++) stems[x] = 40;
    const recoloured: Record<number, number> = {};
    for (let x = 5; x < 35; x++) recoloured[x] = 80;
    assert.equal(regionDelta(image(stems), image(recoloured), region).edgeOnly, false);
  });
});
