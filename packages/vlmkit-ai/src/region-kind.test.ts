import assert from "node:assert/strict";
import { describe, it } from "vite-plus/test";
import { PNG } from "pngjs";
import { labelRegionKinds, regionKindScale, regionKindView, regionKindWindow, type RegionKind } from "./region-kind.ts";
import type { RgbaImage } from "./zoom-image.ts";

const blank = (width: number, height: number): RgbaImage => ({
  width,
  height,
  data: new Uint8Array(width * height * 4).fill(255),
});
const answer: RegionKind = { label: "text", confidence: 0.9, uncertain: false, probabilities: {}, model: "fake" };

describe("region-kind", () => {
  it("pads the region, grows it to 280px where the image allows, and stays inside the image", () => {
    const w = regionKindWindow({ x: 1250, y: 10, width: 20, height: 12 }, { width: 1280, height: 800 });
    assert.ok(w.x2 - w.x1 >= 280 && w.y2 - w.y1 >= 280);
    assert.ok(w.x1 <= 1250 && w.x2 === 1280 && w.y1 === 0);
    const big = regionKindWindow({ x: 100, y: 100, width: 600, height: 300 }, { width: 1280, height: 800 });
    // Padding past an edge shifts the window inward rather than shrinking it.
    assert.deepEqual(big, { x1: 0, y1: 0, x2: 1200, y2: 600 });
    // An image under 280px is used whole; the scale lifts it.
    assert.deepEqual(regionKindWindow({ x: 10, y: 10, width: 5, height: 5 }, { width: 160, height: 120 }), {
      x1: 0,
      y1: 0,
      x2: 160,
      y2: 120,
    });
  });

  it("magnifies up to 4x within Jev's limits, lifts small windows to 280px, and refuses a strip no scale fits", () => {
    assert.equal(regionKindScale(300, 300), 4);
    assert.ok(Math.abs(regionKindScale(1000, 550)! - 1.568) < 1e-9);
    assert.equal(regionKindScale(160, 120), 4);
    assert.ok(Math.abs(regionKindScale(60, 60)! - 280 / 60) < 1e-9);
    assert.equal(regionKindScale(1280, 100), null);
    const view = regionKindView(blank(160, 120), { x1: 0, y1: 0, x2: 160, y2: 120 }, regionKindScale(160, 120)!);
    assert.deepEqual([view.width, view.height], [640, 480]);
  });

  it("asks once per region with both views, keeps input order, and reports a failure per region", async () => {
    const sizes: string[] = [];
    let n = 0;
    const out = await labelRegionKinds(
      blank(400, 300),
      blank(400, 300),
      [
        { x: 0, y: 0, width: 10, height: 10 },
        { x: 200, y: 100, width: 10, height: 10 },
      ],
      async (b, c) => {
        for (const p of [b, c]) {
          const img = PNG.sync.read(Buffer.from(p));
          sizes.push(`${img.width}x${img.height}`);
        }
        if (n++ === 1) throw new Error("Jev API 500: boom");
        return answer;
      },
      1,
    );
    assert.deepEqual(out[0], { kind: answer });
    assert.match((out[1] as { skipped: string }).skipped, /boom/);
    assert.equal(sizes.length, 4);
    for (const s of sizes)
      assert.ok(
        s.split("x").every((v) => Number(v) >= 280),
        s,
      );
  });

  it("skips every region when the captures differ in size", async () => {
    const out = await labelRegionKinds(
      blank(400, 300),
      blank(400, 310),
      [{ x: 0, y: 0, width: 5, height: 5 }],
      async () => answer,
    );
    assert.match((out[0] as { skipped: string }).skipped, /sizes differ/);
  });
});
