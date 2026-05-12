import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { diffComputedStyles, type ComputedStyleSnapshot } from "./computed-style-diff.ts";

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
