import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { extractTextRowsFromRgba, matchTextRows, type TextRow } from "./text-rows.ts";

/** Synthesize an RGBA buffer: white background with dark horizontal text bands. */
function synth(
  width: number,
  height: number,
  bands: Array<{ y: number; h: number; luma?: number }>,
): Uint8Array {
  const data = new Uint8Array(width * height * 4);
  data.fill(255); // white background, alpha included
  // Reset alpha (fill(255) already sets it to 255, fine)
  for (const b of bands) {
    const v = b.luma ?? 40;
    for (let y = b.y; y < b.y + b.h; y++) {
      for (let x = 0; x < width; x++) {
        const idx = (y * width + x) * 4;
        data[idx] = v; data[idx + 1] = v; data[idx + 2] = v; data[idx + 3] = 255;
      }
    }
  }
  return data;
}

describe("extractTextRowsFromRgba", () => {
  it("finds a single dark band", () => {
    const data = synth(200, 200, [{ y: 50, h: 12 }]);
    const rows = extractTextRowsFromRgba(data, 200, 200);
    assert.equal(rows.length, 1);
    assert.equal(rows[0]!.yStart, 50);
    assert.equal(rows[0]!.yEnd, 61);
    assert.equal(rows[0]!.height, 12);
    assert.equal(rows[0]!.yCenter, 56); // round((50 + 61) / 2) = round(55.5) = 56
  });

  it("separates multiple bands", () => {
    const data = synth(200, 200, [
      { y: 30, h: 10 },
      { y: 80, h: 14 },
      { y: 150, h: 8 },
    ]);
    const rows = extractTextRowsFromRgba(data, 200, 200);
    assert.equal(rows.length, 3);
    assert.equal(rows[0]!.yStart, 30);
    assert.equal(rows[1]!.yStart, 80);
    assert.equal(rows[2]!.yStart, 150);
  });

  it("filters bands smaller than minBandHeight", () => {
    const data = synth(200, 200, [
      { y: 30, h: 12 },
      { y: 80, h: 2 }, // too thin
    ]);
    const rows = extractTextRowsFromRgba(data, 200, 200);
    assert.equal(rows.length, 1);
    assert.equal(rows[0]!.yStart, 30);
  });

  it("ignores bands above minLumaDip threshold (not dark enough)", () => {
    const data = synth(200, 200, [
      { y: 30, h: 12, luma: 250 }, // barely below white
    ]);
    const rows = extractTextRowsFromRgba(data, 200, 200);
    assert.equal(rows.length, 0);
  });

  it("returns empty array for degenerate inputs", () => {
    assert.deepEqual(extractTextRowsFromRgba(new Uint8Array(0), 0, 0), []);
  });
});

describe("matchTextRows", () => {
  function row(yCenter: number): TextRow {
    return { yStart: yCenter - 5, yEnd: yCenter + 5, yCenter, height: 11, meanLuma: 40 };
  }

  it("pairs rows by ordered index and emits Δy", () => {
    const matches = matchTextRows(
      [row(50), row(100), row(200)],
      [row(50), row(110), row(204)],
    );
    assert.equal(matches.length, 2); // row 0 has Δ=0 (below default minDeltaY=2)
    assert.equal(matches[0]!.rank, 1);
    assert.equal(matches[0]!.deltaY, 10);
    assert.equal(matches[1]!.rank, 2);
    assert.equal(matches[1]!.deltaY, 4);
  });

  it("clips to the shorter of the two lists", () => {
    const matches = matchTextRows([row(50), row(100), row(200)], [row(80)]);
    assert.equal(matches.length, 1);
    assert.equal(matches[0]!.rank, 0);
    assert.equal(matches[0]!.deltaY, 30);
  });

  it("returns empty array when both inputs are empty", () => {
    assert.deepEqual(matchTextRows([], []), []);
  });
});
