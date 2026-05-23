import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { findGridSuggestions } from "./grid-ratio.ts";
import type { BboxElement } from "@mizchi/vlmkit-core/shift-origin.ts";

function bbox(path: string, width: number, tag = "div", classes = ""): BboxElement {
  return { path, tag, classes, top: 0, left: 0, width, height: 100 };
}

describe("findGridSuggestions", () => {
  it("flags a 2-child grid whose ratio differs (1.32:1 vs 1:1)", () => {
    const baseline = [
      bbox("main[0]>section[0]", 700, "section", "workspace"),
      bbox("main[0]>section[0]>div[0]", 393),
      bbox("main[0]>section[0]>div[1]", 298),
    ];
    const variant = [
      bbox("main[0]>section[0]", 700, "section", "luna-layout"),
      bbox("main[0]>section[0]>div[0]", 343),
      bbox("main[0]>section[0]>div[1]", 343),
    ];
    const out = findGridSuggestions(baseline, variant, "desktop");
    assert.equal(out.length, 1);
    const s = out[0]!;
    assert.equal(s.parentPath, "main[0]>section[0]");
    assert.equal(s.baselineClasses, "workspace");
    assert.equal(s.variantClasses, "luna-layout");
    assert.deepEqual(s.baselineWidths, [393, 298]);
    assert.deepEqual(s.variantWidths, [343, 343]);
    assert.equal(s.baselineRatioDecimal, "1.319 : 1.000");
    assert.equal(s.variantRatioDecimal, "1.000 : 1.000");
  });

  it("suggests an integer-fr ratio when one fits", () => {
    const baseline = [
      bbox("main[0]", 1000),
      bbox("main[0]>div[0]", 800),
      bbox("main[0]>div[1]", 200),
    ];
    const variant = [
      bbox("main[0]", 1000),
      bbox("main[0]>div[0]", 500),
      bbox("main[0]>div[1]", 500),
    ];
    const out = findGridSuggestions(baseline, variant, "desktop");
    assert.equal(out[0]!.baselineFrSuggestion, "4fr 1fr");
  });

  it("falls back to decimal fr when no clean integer ratio fits", () => {
    const baseline = [
      bbox("main[0]", 700),
      bbox("main[0]>div[0]", 393),
      bbox("main[0]>div[1]", 298),
    ];
    const variant = [
      bbox("main[0]", 700),
      bbox("main[0]>div[0]", 350),
      bbox("main[0]>div[1]", 350),
    ];
    const out = findGridSuggestions(baseline, variant, "desktop");
    assert.match(out[0]!.baselineFrSuggestion, /fr/);
  });

  it("ignores flexbox subpixel-rendering noise (< minRatioSpread)", () => {
    const baseline = [
      bbox("main[0]", 500),
      bbox("main[0]>button[0]", 130),
      bbox("main[0]>button[1]", 140),
      bbox("main[0]>button[2]", 143),
    ];
    const variant = [
      bbox("main[0]", 500),
      bbox("main[0]>button[0]", 97),
      bbox("main[0]>button[1]", 104),
      bbox("main[0]>button[2]", 107),
    ];
    const out = findGridSuggestions(baseline, variant, "desktop");
    assert.equal(out.length, 0);
  });

  it("ignores column-stacked containers (sum of children ≫ parent width)", () => {
    const baseline = [
      bbox("main[0]", 400),
      bbox("main[0]>span[0]", 118),
      bbox("main[0]>h1[1]", 380),
      bbox("main[0]>p[2]", 380),
    ];
    const variant = [
      bbox("main[0]", 400),
      bbox("main[0]>span[0]", 76),
      bbox("main[0]>h1[1]", 343),
      bbox("main[0]>p[2]", 343),
    ];
    const out = findGridSuggestions(baseline, variant, "mobile");
    assert.equal(out.length, 0);
  });

  it("ignores parents whose children are all equal-width in baseline", () => {
    const baseline = [
      bbox("main[0]", 600),
      bbox("main[0]>div[0]", 200),
      bbox("main[0]>div[1]", 200),
      bbox("main[0]>div[2]", 200),
    ];
    const variant = [
      bbox("main[0]", 600),
      bbox("main[0]>div[0]", 150),
      bbox("main[0]>div[1]", 150),
      bbox("main[0]>div[2]", 300),
    ];
    const out = findGridSuggestions(baseline, variant, "desktop");
    assert.equal(out.length, 0);
  });

  it("ignores parents whose baseline + variant child widths are equal", () => {
    const baseline = [
      bbox("main[0]", 600),
      bbox("main[0]>div[0]", 400),
      bbox("main[0]>div[1]", 200),
    ];
    const variant = baseline.map((b) => ({ ...b }));
    const out = findGridSuggestions(baseline, variant, "desktop");
    assert.equal(out.length, 0);
  });

  it("respects minChildren threshold", () => {
    const baseline = [
      bbox("main[0]", 600),
      bbox("main[0]>div[0]", 400),
    ];
    const variant = [
      bbox("main[0]", 600),
      bbox("main[0]>div[0]", 600),
    ];
    const out = findGridSuggestions(baseline, variant, "desktop", { minChildren: 2 });
    assert.equal(out.length, 0);
  });

  it("returns empty result on empty inputs", () => {
    assert.equal(findGridSuggestions([], [], "desktop").length, 0);
  });

  it("preserves document-order siblings via tag[N] index", () => {
    const baseline = [
      bbox("main[0]", 1000),
      bbox("main[0]>div[1]", 200),
      bbox("main[0]>div[0]", 800),
    ];
    const variant = [
      bbox("main[0]", 1000),
      bbox("main[0]>div[0]", 500),
      bbox("main[0]>div[1]", 500),
    ];
    const out = findGridSuggestions(baseline, variant, "desktop");
    assert.equal(out.length, 1);
    assert.deepEqual(out[0]!.baselineWidths, [800, 200]);
  });
});
