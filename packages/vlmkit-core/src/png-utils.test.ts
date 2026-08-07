import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { cropRegion, measureChangeMagnitude, type PngData } from "./png-utils.ts";

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

/** Solid fill, so a test states only the colour it is about. */
function solid(width: number, height: number, rgb: [number, number, number]): PngData {
  const data = new Uint8Array(width * height * 4);
  for (let i = 0; i < data.length; i += 4) {
    data[i] = rgb[0];
    data[i + 1] = rgb[1];
    data[i + 2] = rgb[2];
    data[i + 3] = 255;
  }
  return { width, height, data };
}

describe("measureChangeMagnitude", () => {
  it("reports nothing for identical images", () => {
    const m = measureChangeMagnitude(solid(4, 4, [10, 20, 30]), solid(4, 4, [10, 20, 30]));
    assert.deepEqual(m, {
      changedPixels: 0,
      totalPixels: 16,
      changedFraction: 0,
      maxChannelDelta: 0,
      meanChannelDelta: 0,
    });
  });

  it("sees a uniform low-amplitude shift that a perceptual comparator scores as zero", () => {
    // The measured case this exists for: a hero's gradient went from a blue tint
    // (#eef3fd) to a purple one (#f6ecff). pixelmatch reported 0.0% changed.
    const before = solid(10, 10, [0xee, 0xf3, 0xfd]);
    const after = solid(10, 10, [0xf6, 0xec, 0xff]);
    const m = measureChangeMagnitude(before, after);
    assert.equal(m.changedFraction, 1, "every pixel moved");
    assert.equal(m.maxChannelDelta, 8, "0xf6 - 0xee");
    assert.ok(m.meanChannelDelta > 7 && m.meanChannelDelta < 9);
  });

  it("takes the largest channel per pixel, not the sum", () => {
    // Summing would report 9 here and read as a bigger change than any channel
    // actually made.
    const m = measureChangeMagnitude(solid(2, 2, [0, 0, 0]), solid(2, 2, [1, 3, 5]));
    assert.equal(m.maxChannelDelta, 5);
  });

  it("separates coverage from magnitude", () => {
    // One pixel changed a lot: high magnitude, low coverage. The opposite of the
    // gradient case, and the reason the drift rule keys on coverage.
    const before = solid(10, 10, [255, 255, 255]);
    const after = solid(10, 10, [255, 255, 255]);
    after.data[0] = 0;
    const m = measureChangeMagnitude(before, after);
    assert.equal(m.changedPixels, 1);
    assert.equal(m.changedFraction, 0.01);
    assert.equal(m.maxChannelDelta, 255);
  });

  it("ignores alpha, so a transparent-to-opaque change is not read as colour drift", () => {
    const before = solid(2, 2, [7, 7, 7]);
    const after = solid(2, 2, [7, 7, 7]);
    for (let i = 3; i < after.data.length; i += 4) after.data[i] = 0;
    assert.equal(measureChangeMagnitude(before, after).changedPixels, 0);
  });

  it("compares the overlap when the component resized, instead of throwing", () => {
    // A reflow changing a component's height is a real case; a crash there would
    // turn a finding into a stack trace.
    const m = measureChangeMagnitude(solid(4, 4, [0, 0, 0]), solid(4, 2, [10, 0, 0]));
    assert.equal(m.totalPixels, 8);
    assert.equal(m.changedFraction, 1);
  });

  it("does not divide by zero on an empty overlap", () => {
    const m = measureChangeMagnitude(solid(4, 4, [0, 0, 0]), solid(0, 0, [0, 0, 0]));
    assert.equal(m.changedFraction, 0);
    assert.equal(m.meanChannelDelta, 0);
  });
});
