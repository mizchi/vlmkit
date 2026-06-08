import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { cropRegion, type PngData } from "./png-utils.ts";

function gradientPng(width: number, height: number): PngData {
  // Each pixel's red channel encodes y*width+x, so crops are verifiable.
  const data = new Uint8Array(width * height * 4);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 4;
      data[i] = (y * width + x) % 256;
      data[i + 1] = x;
      data[i + 2] = y;
      data[i + 3] = 255;
    }
  }
  return { width, height, data };
}

describe("cropRegion", () => {
  it("crops an interior rectangle at an arbitrary offset", () => {
    const img = gradientPng(4, 4);
    const crop = cropRegion(img, 1, 1, 2, 2);
    assert.equal(crop.width, 2);
    assert.equal(crop.height, 2);
    // Top-left of the crop is source pixel (1,1).
    assert.equal(crop.data[1], 1); // green = x
    assert.equal(crop.data[2], 1); // blue = y
    // Bottom-right of the crop is source pixel (2,2).
    const br = (1 * 2 + 1) * 4;
    assert.equal(crop.data[br + 1], 2);
    assert.equal(crop.data[br + 2], 2);
  });

  it("clamps a region that overruns the image bounds", () => {
    const img = gradientPng(4, 4);
    const crop = cropRegion(img, 3, 3, 10, 10);
    assert.equal(crop.width, 1);
    assert.equal(crop.height, 1);
    assert.equal(crop.data[1], 3);
    assert.equal(crop.data[2], 3);
  });

  it("clamps a negative origin to zero", () => {
    const img = gradientPng(4, 4);
    const crop = cropRegion(img, -2, -2, 3, 3);
    assert.equal(crop.width, 1);
    assert.equal(crop.height, 1);
    assert.equal(crop.data[1], 0);
    assert.equal(crop.data[2], 0);
  });
});
