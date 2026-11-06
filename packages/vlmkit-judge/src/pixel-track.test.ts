import assert from "node:assert/strict";
import { describe, it } from "vite-plus/test";
import { parseTrackRegion, trackRegion, type TrackFrame } from "./pixel-track.ts";

const W = 240;
const H = 120;

/** A white frame with a 24x24 red square at (x, y); a fractional x blends its edge columns. */
function frame(x: number | null, y = 40, size = 24): TrackFrame {
  const data = new Uint8Array(W * H * 3).fill(255);
  if (x !== null) {
    const x0 = Math.floor(x);
    const f = x - x0;
    for (let r = y; r < y + size; r++)
      for (let c = x0; c <= x0 + size; c++) {
        // Coverage of pixel c by [x, x + size).
        const cover = c === x0 ? 1 - f : c === x0 + size ? f : 1;
        if (cover <= 0) continue;
        const i = (r * W + c) * 3;
        data[i + 1] = Math.round(255 * (1 - cover));
        data[i + 2] = Math.round(255 * (1 - cover));
      }
  }
  return { width: W, height: H, channels: 3, data };
}

describe("trackRegion: a picture found in every frame from its pixels", () => {
  it("follows a square across the frame, read from the rest frame", () => {
    const xs = [10, 40, 90, 150, 200];
    const frames = xs.map((x) => frame(x));
    const out = trackRegion(frames, { x: 200, y: 40, width: 24, height: 24 });
    assert.deepEqual(
      out.map((o) => Math.round(o.box.x * 100) / 100),
      xs,
    );
    for (const o of out) {
      assert.equal(o.box.y, 40);
      assert.equal(o.box.width, 24);
      assert.ok(o.present > 0.99, `present ${o.present}`);
    }
  });

  it("puts a square between pixels within a tenth of one", () => {
    const xs = [30, 30.5, 31.25, 60.75];
    const out = trackRegion(
      xs.map((x) => frame(x)),
      { x: 30, y: 40, width: 24, height: 24 },
      { templateFrame: 0 },
    );
    for (const [i, x] of xs.entries()) assert.ok(Math.abs(out[i]!.box.x - x) < 0.1, `at ${x}: ${out[i]!.box.x}`);
  });

  it("reads a frame without it as not present", () => {
    const out = trackRegion([frame(null), frame(100)], { x: 100, y: 40, width: 24, height: 24 });
    assert.ok(out[0]!.present < 0.2, `present ${out[0]!.present}`);
    assert.ok(out[1]!.present > 0.99);
  });

  it("refuses frames of different sizes and a region too small to hold", () => {
    assert.throws(
      () =>
        trackRegion([frame(10), { width: 10, height: 10, channels: 3, data: new Uint8Array(300) }], {
          x: 0,
          y: 0,
          width: 8,
          height: 8,
        }),
      /differ in size/,
    );
    assert.throws(() => trackRegion([frame(10)], { x: 238, y: 0, width: 20, height: 20 }), /needs 4x4/);
  });

  it("parses x,y,w,h", () => {
    assert.deepEqual(parseTrackRegion("10, 20,30,40"), { x: 10, y: 20, width: 30, height: 40 });
    assert.equal(parseTrackRegion("10,20,0,40"), null);
    assert.equal(parseTrackRegion("10,20,30"), null);
    assert.equal(parseTrackRegion("a,b,c,d"), null);
  });
});
