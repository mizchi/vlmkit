import assert from "node:assert/strict";
import { describe, it } from "vitest";
import { PNG } from "pngjs";
import {
  RESOLUTION_PRESETS,
  getImageDimensions,
  readPngDimensions,
  resizeBase64Png,
  resizePngBuffer,
  resolveResolutionForViewport,
} from "./image-resize.ts";

/** A solid PNG of a known size, so a resize is checkable by its dimensions. */
function png(width: number, height: number, rgb: [number, number, number] = [200, 40, 40]): Buffer {
  const image = new PNG({ width, height });
  for (let i = 0; i < width * height; i++) {
    image.data[i * 4] = rgb[0];
    image.data[i * 4 + 1] = rgb[1];
    image.data[i * 4 + 2] = rgb[2];
    image.data[i * 4 + 3] = 255;
  }
  return PNG.sync.write(image);
}

describe("resolveResolutionForViewport", () => {
  it("picks the smallest preset that carries at least half the viewport width", () => {
    // The rule the module states: a screenshot narrower than half the viewport
    // stops being legible to a model, so the preset floor is viewportWidth / 2.
    assert.equal(resolveResolutionForViewport(375), "low"); // 375 >= 187.5
    assert.equal(resolveResolutionForViewport(750), "low"); // 375 >= 375, exactly
    assert.equal(resolveResolutionForViewport(760), "medium"); // 375 < 380, 640 >= 380
    assert.equal(resolveResolutionForViewport(1280), "medium"); // 640 >= 640, exactly
    assert.equal(resolveResolutionForViewport(1300), "high");
  });

  it("never exceeds the caller's ceiling, even when no preset is sufficient", () => {
    // A 4000px-wide viewport wants 2000px and `high` gives 1280. Returning the
    // ceiling rather than escalating past it is the point of the argument.
    assert.equal(resolveResolutionForViewport(4000, "high"), "high");
    assert.equal(resolveResolutionForViewport(4000, "low"), "low");
    assert.equal(resolveResolutionForViewport(375, "low"), "low");
  });

  it("keeps the presets ordered, since the search relies on it", () => {
    const widths = (["low", "medium", "high", "full"] as const).map((p) => RESOLUTION_PRESETS[p].maxWidth);
    assert.deepEqual([...widths].sort((a, b) => a - b), widths);
  });
});

describe("resizePngBuffer", () => {
  it("returns the SAME buffer when the image already fits", () => {
    // Identity rather than a re-encode: a needless round-trip through pngjs would
    // change the bytes of an image nothing was wrong with, and these buffers are
    // compared for equality elsewhere.
    const small = png(100, 80);
    assert.equal(resizePngBuffer(small, { resolution: "medium" }), small);
  });

  it("scales down to fit and preserves the aspect ratio", () => {
    const wide = png(1600, 400);
    const out = PNG.sync.read(resizePngBuffer(wide, { resolution: "medium" }));
    assert.equal(out.width, 640, "constrained by width");
    assert.equal(out.height, 160, "1600x400 is 4:1, so 640 wide is 160 tall");
  });

  it("constrains by height when that is the binding dimension", () => {
    const tall = png(400, 1600);
    const out = PNG.sync.read(resizePngBuffer(tall, { resolution: "medium" }));
    assert.equal(out.height, 480);
    assert.equal(out.width, 120);
  });

  it("takes an explicit size as well as a preset name", () => {
    const out = PNG.sync.read(resizePngBuffer(png(800, 800), { resolution: { maxWidth: 200, maxHeight: 200 } }));
    assert.deepEqual([out.width, out.height], [200, 200]);
  });

  it("defaults to medium, which is the documented default", () => {
    // A square is bound by the SHORTER side of the preset — medium is 640x480, so
    // 2000x2000 comes back 480x480, not 640 wide. Asserting the width against
    // `maxWidth` looked right and was wrong.
    const out = PNG.sync.read(resizePngBuffer(png(2000, 2000)));
    assert.deepEqual([out.width, out.height], [480, 480]);
    // Whereas a wide image is bound by the width.
    const wide = PNG.sync.read(resizePngBuffer(png(2000, 500)));
    assert.equal(wide.width, RESOLUTION_PRESETS.medium.maxWidth);
  });

  it("carries the pixels through rather than emitting an empty image", () => {
    // A resize that produced the right dimensions and dropped the content would
    // pass every assertion above.
    const out = PNG.sync.read(resizePngBuffer(png(1200, 1200, [10, 220, 30]), { resolution: "low" }));
    const middle = ((out.height >> 1) * out.width + (out.width >> 1)) * 4;
    assert.deepEqual([out.data[middle], out.data[middle + 1], out.data[middle + 2]], [10, 220, 30]);
    assert.equal(out.data[middle + 3], 255);
  });
});

describe("readPngDimensions and getImageDimensions", () => {
  it("reads a size from the PNG header without decoding the pixels", () => {
    assert.deepEqual(readPngDimensions(png(321, 123)), { width: 321, height: 123 });
  });

  it("reads a size from a BASE64 string — the name says image, the parameter is base64", () => {
    // Worth stating in a test, because the name reads as "any image, probably a
    // path": it takes the same base64 the VLM clients pass around, and handing it
    // a path fails inside pngjs with "unrecognised content at end of stream"
    // rather than with anything about paths.
    assert.deepEqual(getImageDimensions(png(64, 48).toString("base64")), { width: 64, height: 48 });
  });

  it("falls back to a full decode when the header fast path does not apply", () => {
    // The fast path needs >= 24 bytes and a PNG signature; anything else goes
    // through pngjs, which throws on a non-image. Both branches matter — the fast
    // path is the one that runs, and the fallback is what makes a corrupt file a
    // clear error instead of nonsense dimensions.
    assert.throws(() => readPngDimensions(Buffer.from("not a png at all")), /./);
  });
});

describe("resizeBase64Png", () => {
  it("round-trips through base64 and comes back smaller", () => {
    // The VLM clients hand images over as base64, so the resize has to be
    // expressible without touching the filesystem.
    const original = png(1600, 1200).toString("base64");
    const resized = resizeBase64Png(original, { resolution: "low" });
    const out = PNG.sync.read(Buffer.from(resized, "base64"));
    assert.equal(out.width, 375);
    assert.ok(resized.length < original.length, "a downscale must cost fewer bytes");
  });

  it("leaves an already-small image untouched", () => {
    const original = png(100, 100).toString("base64");
    assert.equal(resizeBase64Png(original, { resolution: "medium" }), original);
  });
});
