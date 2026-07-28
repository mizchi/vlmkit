import { ok, strictEqual } from "node:assert";
import { describe, it } from "node:test";
import { classifyRegion, kindsCanPair, type ComponentKindInfo } from "./component-classify.ts";

/** Build an RGBA buffer via a per-pixel color function. */
function image(
  width: number,
  height: number,
  colorAt: (x: number, y: number) => [number, number, number],
): Uint8Array {
  const data = new Uint8Array(width * height * 4);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const [r, g, b] = colorAt(x, y);
      const o = (y * width + x) * 4;
      data[o] = r;
      data[o + 1] = g;
      data[o + 2] = b;
      data[o + 3] = 0xff;
    }
  }
  return data;
}

const full = (w: number, h: number) => ({ top: 0, left: 0, width: w, height: h });

describe("classifyRegion", () => {
  it("classifies a 1px rule as hairline", () => {
    const data = image(100, 1, () => [200, 200, 200]);
    strictEqual(classifyRegion(data, 100, full(100, 1)).kind, "hairline");
  });

  it("classifies a uniform block as confident solid", () => {
    const data = image(80, 40, () => [14, 165, 233]);
    const info = classifyRegion(data, 80, full(80, 40));
    strictEqual(info.kind, "solid");
    ok(info.confident);
  });

  it("classifies ink runs on a background as text", () => {
    // 4px-wide "glyph" strokes with 4px gaps on white — high transition
    // density, dominant white background.
    const data = image(200, 16, (x, y) =>
      y >= 3 && y <= 12 && x % 8 < 3 ? [40, 40, 40] : [255, 255, 255]);
    const info = classifyRegion(data, 200, full(200, 16));
    strictEqual(info.kind, "text");
    ok(info.confident);
  });

  it("classifies an ink-tight crop (no majority background) as text", () => {
    // Extractor bboxes hug the glyphs: ink can outweigh background.
    const data = image(98, 15, (x) => (x % 7 < 4 ? [60, 60, 60] : [255, 255, 255]));
    strictEqual(classifyRegion(data, 98, full(98, 15)).kind, "text");
  });

  it("classifies a many-color gradient as image", () => {
    const data = image(120, 120, (x, y) => [(x * 2) % 256, (y * 2) % 256, ((x + y) * 3) % 256]);
    const info = classifyRegion(data, 120, full(120, 120));
    strictEqual(info.kind, "image");
    ok(info.confident);
  });

  it("classifies a solid block with a small label as non-solid without confident-solid", () => {
    // CTA-like: 85%+ blue with a white word — must not be a CONFIDENT
    // solid (the gate must not fire against its text pairing).
    const data = image(120, 40, (x, y) =>
      y >= 16 && y <= 24 && x >= 20 && x <= 100 && x % 6 < 3 ? [255, 255, 255] : [14, 165, 233]);
    const info = classifyRegion(data, 120, full(120, 40));
    ok(!(info.kind === "solid" && info.confident));
  });

  it("respects the bbox (classifies only the region)", () => {
    // Noise everywhere, solid patch in the middle.
    const data = image(100, 100, (x, y) =>
      x >= 30 && x < 70 && y >= 30 && y < 70 ? [10, 10, 10] : [(x * 37) % 256, (y * 91) % 256, 128]);
    const info = classifyRegion(data, 100, { top: 30, left: 30, width: 40, height: 40 });
    strictEqual(info.kind, "solid");
  });
});

describe("kindsCanPair", () => {
  const conf = (kind: ComponentKindInfo["kind"]): ComponentKindInfo => ({ kind, confident: true });
  const unsure = (kind: ComponentKindInfo["kind"]): ComponentKindInfo => ({ kind, confident: false });

  it("blocks confident solid vs confident text", () => {
    strictEqual(kindsCanPair(conf("solid"), conf("text")), false);
    strictEqual(kindsCanPair(conf("image"), conf("solid")), false);
  });

  it("allows same kinds and text vs image", () => {
    strictEqual(kindsCanPair(conf("solid"), conf("solid")), true);
    strictEqual(kindsCanPair(conf("text"), conf("image")), true);
  });

  it("never gates unconfident or missing classifications", () => {
    strictEqual(kindsCanPair(unsure("solid"), conf("text")), true);
    strictEqual(kindsCanPair(undefined, conf("text")), true);
  });
});
