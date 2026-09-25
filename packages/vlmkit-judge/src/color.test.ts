import assert from "node:assert/strict";
import { describe, it } from "vitest";
import {
  blendColor,
  compositeBackground,
  contrastRatio,
  formatRgb,
  luminanceContrast,
  measureTextContrast,
  parseColor,
  relativeLuminance,
  textContrastFloor,
} from "./color.ts";

const close = (actual: number, expected: number, digits = 2) =>
  assert.equal(Number(actual.toFixed(digits)), expected, `${actual} ≈ ${expected}`);

describe("parseColor", () => {
  it("reads the rgb()/rgba() forms a browser serialises, in every separator style", () => {
    assert.deepEqual(parseColor("rgb(1, 2, 3)"), [1, 2, 3, 1]);
    assert.deepEqual(parseColor("rgba(1, 2, 3, 0.5)"), [1, 2, 3, 0.5]);
    assert.deepEqual(parseColor("rgb(1 2 3 / 0.25)"), [1, 2, 3, 0.25]);
  });

  it("reads every hex length an engine might write", () => {
    assert.deepEqual(parseColor("#fff"), [255, 255, 255, 1]);
    assert.deepEqual(parseColor("#0008"), [0, 0, 0, 136 / 255]);
    assert.deepEqual(parseColor("#1a73e8"), [26, 115, 232, 1]);
    assert.deepEqual(parseColor("#1a73e880"), [26, 115, 232, 128 / 255]);
  });

  it("refuses colours only a renderer can resolve, instead of guessing", () => {
    for (const s of ["oklch(0.7 0.1 250)", "lab(50 10 10)", "red", "color-mix(in srgb, red, blue)", ""]) {
      assert.equal(parseColor(s), null, s);
    }
  });
});

describe("contrastRatio", () => {
  it("matches WCAG's own reference values", () => {
    close(contrastRatio([0, 0, 0], [255, 255, 255]), 21);
    close(contrastRatio([255, 255, 255], [255, 255, 255]), 1);
    // #777 on white is the textbook near-miss: just under 4.5.
    close(contrastRatio([0x77, 0x77, 0x77], [255, 255, 255]), 4.48);
  });

  it("does not depend on argument order", () => {
    assert.equal(contrastRatio([10, 20, 30], [200, 210, 220]), contrastRatio([200, 210, 220], [10, 20, 30]));
  });
  it("is luminanceContrast over the two relative luminances", () => {
    const a = [30, 90, 200] as const;
    const b = [250, 240, 180] as const;
    assert.equal(contrastRatio(a, b), luminanceContrast(relativeLuminance(a), relativeLuminance(b)));
    assert.equal(luminanceContrast(0.2, 0.7), luminanceContrast(0.7, 0.2));
  });
});

describe("relativeLuminance", () => {
  it("gives the same answer with IEC's 0.04045 threshold as with WCAG's 0.03928, on every 8-bit channel", () => {
    // Why the copies that used IEC's threshold could be replaced exactly: the two linearisations
    // only disagree for a channel in (0.03928, 0.04045] of 255, i.e. 10.02-10.31, and no 8-bit
    // value lies there. asset-check.ts (IEC) and the WCAG copies were one formula all along.
    const lin = (v: number, threshold: number) => {
      const c = v / 255;
      return c <= threshold ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
    };
    for (let v = 0; v <= 255; v++) {
      assert.equal(lin(v, 0.04045), lin(v, 0.03928), `channel ${v}`);
      assert.equal(relativeLuminance([v, v, v]), 0.2126 * lin(v, 0.04045) + 0.7152 * lin(v, 0.04045) + 0.0722 * lin(v, 0.04045), `grey ${v}`);
    }
  });
});

describe("compositeBackground", () => {
  it("stops at the first opaque layer, as the page's own walk does", () => {
    assert.deepEqual(compositeBackground([[0, 0, 0, 0.5], [0, 0, 255, 1], [255, 0, 0, 1]]), [0, 0, 127.5]);
  });

  it("paints what is left over white", () => {
    assert.deepEqual(compositeBackground([[0, 0, 0, 0.5]]), [127.5, 127.5, 127.5]);
    assert.deepEqual(compositeBackground([]), [255, 255, 255]);
  });
});

describe("textContrastFloor", () => {
  it("is 3 for large text and 4.5 otherwise", () => {
    assert.deepEqual(textContrastFloor(24, 400), { large: true, floor: 3 });
    assert.deepEqual(textContrastFloor(18.66, 700), { large: true, floor: 3 });
    assert.deepEqual(textContrastFloor(18.66, 400), { large: false, floor: 4.5 });
    assert.deepEqual(textContrastFloor(13, 900), { large: false, floor: 4.5 });
  });
});

describe("measureTextContrast", () => {
  it("fades the text by its inherited opacity before measuring", () => {
    const opaque = measureTextContrast({ color: [0, 0, 0, 1], backgrounds: [[255, 255, 255, 1]] });
    const faded = measureTextContrast({ color: [0, 0, 0, 1], backgrounds: [[255, 255, 255, 1]], opacity: 0.3 });
    close(opaque.ratio, 21);
    assert.ok(faded.ratio < 4.5, String(faded.ratio));
    assert.equal(formatRgb(faded.fg), "rgb(179, 179, 179)");
  });

  it("blends the same way as the page's blendColor", () => {
    assert.deepEqual(blendColor([255, 255, 255], [0, 0, 0, 0.25]), [191.25, 191.25, 191.25]);
  });
});
