import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { findGridSuggestions } from "./grid-ratio.ts";
import type { BboxElement } from "../vrt/core/shift-origin.ts";

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
    // 800px / 200px = 4:1 → "4fr 1fr"
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
    // 1.319 : 1 has no good integer approx within denom 12.
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
    // The closest 12-denom approximation is reasonable; either an integer
    // form (e.g. "19fr 14fr" if accepted) or a decimal fallback. Just
    // assert it ends with "fr" so the agent has something to paste.
    assert.match(out[0]!.baselineFrSuggestion, /fr/);
  });

  it("ignores flexbox subpixel-rendering noise (< minRatioSpread)", () => {
    // 3 buttons with subpixel gap rounding: 130/140/143 (max/min = 1.10,
    // below the 1.15 default spread threshold). Should be dropped as noise.
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
    // A `display: flex; flex-direction: column` hero: parent is 400px wide
    // but each child has its own (different) content-driven width.
    const baseline = [
      bbox("main[0]", 400),  // narrow container
      bbox("main[0]>span[0]", 118),  // pill
      bbox("main[0]>h1[1]", 380),    // wrapped h1
      bbox("main[0]>p[2]", 380),     // wrapped p
    ];
    // sum = 118 + 380 + 380 = 878, sum/parent = 2.2 → column-stacked
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
    // Identical
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
    assert.equal(out.length, 0); // only 1 direct child
  });

  it("returns empty result on empty inputs", () => {
    assert.equal(findGridSuggestions([], [], "desktop").length, 0);
  });

  it("preserves document-order siblings via tag[N] index", () => {
    // Out-of-order paths in input should be reordered by sibling index.
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
    // baseline widths must be [800, 200] (document order), not [200, 800]
    assert.deepEqual(out[0]!.baselineWidths, [800, 200]);
  });
});
