import assert from "node:assert/strict";
import { describe, it } from "vitest";
import {
  aggregateCsdByViewport,
  diffComputedStyles,
  type ComputedStyleSnapshot,
} from "./computed-style-diff.ts";

const A: ComputedStyleSnapshot = {
  ".luna-page": { "padding-left": "20px", "padding-right": "20px", "max-width": "1180px" },
  ".luna-stack": { "display": "flex", "flex-direction": "column", "gap": "20px" },
  ".luna-action": { "padding": "11px 16px", "border-radius": "12px" },
};
const B: ComputedStyleSnapshot = {
  ".luna-page": { "padding-left": "16px", "padding-right": "16px", "max-width": "1180px" },
  // .luna-stack uses margin instead of gap → "margin between siblings" rewrite
  ".luna-stack": { "display": "flex", "flex-direction": "column", "gap": "0px" },
  ".luna-action": { "padding": "8px 12px", "border-radius": "6px" },
  ".luna-extra": { "color": "red" }, // new selector
};

describe("diffComputedStyles", () => {
  it("lists differing (selector, property) tuples", () => {
    const r = diffComputedStyles(A, B);
    assert.equal(r.totalDiffs, 5);
    const k = r.entries.find((e) => e.selector === ".luna-page" && e.property === "padding-left")!;
    assert.equal(k.baseline, "20px");
    assert.equal(k.variant, "16px");
  });

  it("aggregates by property, descending", () => {
    const r = diffComputedStyles(A, B);
    // 5 properties differ across the snapshots: padding-left,
    // padding-right, gap, padding, border-radius. All counts are 1
    // here, so order falls back to alphabetical.
    assert.equal(r.byProperty.length, 5);
    const properties = r.byProperty.map((p) => p.property).sort();
    assert.deepEqual(properties, ["border-radius", "gap", "padding", "padding-left", "padding-right"]);
  });

  it("aggregates by selector, descending", () => {
    const r = diffComputedStyles(A, B);
    // .luna-page: 2 diffs, .luna-action: 2 diffs, .luna-stack: 1 diff
    assert.equal(r.bySelector[0]!.count, 2);
    const stack = r.bySelector.find((s) => s.selector === ".luna-stack")!;
    assert.equal(stack.count, 1);
  });

  it("tracks selectors only in one side", () => {
    const r = diffComputedStyles(A, B);
    assert.deepEqual(r.selectorsOnlyInBaseline, []);
    assert.deepEqual(r.selectorsOnlyInVariant, [".luna-extra"]);
  });

  it("returns empty result on null/empty input", () => {
    const r = diffComputedStyles({} as ComputedStyleSnapshot, {} as ComputedStyleSnapshot);
    assert.equal(r.totalDiffs, 0);
    assert.equal(r.entries.length, 0);
  });

  it("treats missing property as empty string", () => {
    const r = diffComputedStyles(
      { ".x": { "color": "red" } },
      { ".x": {} },
    );
    assert.equal(r.totalDiffs, 1);
    assert.equal(r.entries[0]!.baseline, "red");
    assert.equal(r.entries[0]!.variant, "");
  });
});

describe("aggregateCsdByViewport", () => {
  // Mobile: `.btn padding` 10px → 6px. Desktop: same `.btn padding` differs
  // PLUS `.card gap` 12px → 0px appears only on desktop (= media-gated).
  const mobileBaseline: ComputedStyleSnapshot = {
    ".btn": { padding: "10px", "border-radius": "8px" },
    ".card": { gap: "12px" },
  };
  const mobileVariant: ComputedStyleSnapshot = {
    ".btn": { padding: "6px", "border-radius": "8px" },
    ".card": { gap: "12px" },
  };
  const desktopBaseline: ComputedStyleSnapshot = {
    ".btn": { padding: "10px", "border-radius": "8px" },
    ".card": { gap: "12px" },
  };
  const desktopVariant: ComputedStyleSnapshot = {
    ".btn": { padding: "6px", "border-radius": "8px" },
    ".card": { gap: "0px" }, // only desktop differs
  };

  it("classifies universal vs. breakpoint-gated (selector, property) pairs", () => {
    const r = aggregateCsdByViewport([
      { viewport: "mobile", result: diffComputedStyles(mobileBaseline, mobileVariant) },
      { viewport: "desktop", result: diffComputedStyles(desktopBaseline, desktopVariant) },
    ]);
    // .btn padding differs on both → universal
    // .card gap differs only on desktop → breakpoint-gated
    assert.deepEqual(r.universalPairs.sort(), [".btn|padding"]);
    assert.deepEqual(r.breakpointGatedPairs.sort(), [".card|gap"]);
    assert.equal(r.totalDiffs, 3); // mobile (.btn) + desktop (.btn + .card)
    assert.equal(r.byViewport.length, 2);
  });

  it("samples carry per-viewport baseline + variant values for breakpoint-gated rows", () => {
    const r = aggregateCsdByViewport([
      { viewport: "mobile", result: diffComputedStyles(mobileBaseline, mobileVariant) },
      { viewport: "desktop", result: diffComputedStyles(desktopBaseline, desktopVariant) },
    ]);
    const gated = r.bySelectorProperty.find((e) => e.selector === ".card" && e.property === "gap");
    assert.ok(gated);
    assert.deepEqual(gated!.viewports, ["desktop"]);
    assert.equal(gated!.samples.length, 1);
    assert.equal(gated!.samples[0]!.baseline, "12px");
    assert.equal(gated!.samples[0]!.variant, "0px");
  });

  it("sorts bySelectorProperty by viewport-coverage desc (universal first)", () => {
    const r = aggregateCsdByViewport([
      { viewport: "mobile", result: diffComputedStyles(mobileBaseline, mobileVariant) },
      { viewport: "desktop", result: diffComputedStyles(desktopBaseline, desktopVariant) },
    ]);
    // Universal (.btn padding, viewports=2) should sort before
    // breakpoint-gated (.card gap, viewports=1).
    assert.equal(r.bySelectorProperty[0]!.viewports.length, 2);
    assert.ok(r.bySelectorProperty[r.bySelectorProperty.length - 1]!.viewports.length < 2);
  });

  it("returns empty result when given no viewports", () => {
    const r = aggregateCsdByViewport([]);
    assert.equal(r.totalDiffs, 0);
    assert.deepEqual(r.byViewport, []);
    assert.deepEqual(r.universalPairs, []);
    assert.deepEqual(r.breakpointGatedPairs, []);
  });
});
