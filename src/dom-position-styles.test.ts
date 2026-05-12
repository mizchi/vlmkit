import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  diffDomPositionStyles,
  parseDomPositionStyles,
  type PositionedElement,
} from "./dom-position-styles.ts";

function el(over: Partial<PositionedElement>): PositionedElement {
  return {
    path: "",
    tag: "div",
    classes: "",
    styles: {},
    ...over,
  };
}

describe("diffDomPositionStyles", () => {
  it("aligns elements by DOM path even when class names differ (the migration case)", () => {
    const baseline = [
      el({
        path: "main[0]>section[0]>article[0]",
        tag: "article",
        classes: "card",
        styles: { "border-radius": "18px", "padding-top": "20px" },
      }),
    ];
    const variant = [
      el({
        path: "main[0]>section[0]>article[0]",
        tag: "article",
        classes: "luna-panel",
        styles: { "border-radius": "8px", "padding-top": "16px" },
      }),
    ];

    const r = diffDomPositionStyles(baseline, variant);
    assert.equal(r.totalDiffs, 2);
    const radius = r.entries.find((e) => e.property === "border-radius")!;
    assert.equal(radius.baselineClasses, "card");
    assert.equal(radius.variantClasses, "luna-panel");
    assert.equal(radius.baseline, "18px");
    assert.equal(radius.variant, "8px");
  });

  it("skips paths present in only one side and records them", () => {
    const baseline = [
      el({ path: "main[0]>section[0]", tag: "section", classes: "hero" }),
      el({ path: "main[0]>section[1]", tag: "section", classes: "workspace" }),
    ];
    const variant = [
      el({ path: "main[0]>section[0]", tag: "section", classes: "luna-hero" }),
    ];
    const r = diffDomPositionStyles(baseline, variant);
    assert.deepEqual(r.pathsOnlyInBaseline, ["main[0]>section[1]"]);
    assert.deepEqual(r.pathsOnlyInVariant, []);
  });

  it("skips entries where tags differ at the same path (DOM rewrite, not a rename)", () => {
    const baseline = [el({ path: "main[0]>div[0]", tag: "div" })];
    const variant = [el({ path: "main[0]>div[0]", tag: "span" })];
    const r = diffDomPositionStyles(baseline, variant);
    assert.equal(r.totalDiffs, 0);
  });

  it("aggregates by property and by path, descending", () => {
    const baseline = [
      el({ path: "p1", tag: "div", classes: "a", styles: { padding: "10px", margin: "10px" } }),
      el({ path: "p2", tag: "div", classes: "a", styles: { padding: "10px" } }),
    ];
    const variant = [
      el({ path: "p1", tag: "div", classes: "b", styles: { padding: "20px", margin: "20px" } }),
      el({ path: "p2", tag: "div", classes: "b", styles: { padding: "30px" } }),
    ];
    const r = diffDomPositionStyles(baseline, variant);
    assert.equal(r.totalDiffs, 3);
    // padding appears twice (across both paths), margin appears once
    assert.equal(r.byProperty[0]!.property, "padding");
    assert.equal(r.byProperty[0]!.count, 2);
    // p1 has 2 diffs, p2 has 1
    assert.equal(r.byPath[0]!.path, "p1");
    assert.equal(r.byPath[0]!.count, 2);
    assert.equal(r.byPath[0]!.baselineClasses, "a");
    assert.equal(r.byPath[0]!.variantClasses, "b");
  });

  it("returns empty result on empty inputs", () => {
    assert.deepEqual(diffDomPositionStyles([], []).totalDiffs, 0);
  });

  it("ignores style values that are equal even across renames", () => {
    const baseline = [el({ path: "p", tag: "div", classes: "a", styles: { color: "red" } })];
    const variant = [el({ path: "p", tag: "div", classes: "b", styles: { color: "red" } })];
    const r = diffDomPositionStyles(baseline, variant);
    assert.equal(r.totalDiffs, 0);
  });
});

describe("parseDomPositionStyles", () => {
  it("parses a JSON string", () => {
    const json = JSON.stringify([{ path: "p", tag: "div", classes: "", styles: {} }]);
    const out = parseDomPositionStyles(json);
    assert.equal(out.length, 1);
    assert.equal(out[0]!.path, "p");
  });

  it("returns [] on garbage input", () => {
    assert.deepEqual(parseDomPositionStyles("not json"), []);
    assert.deepEqual(parseDomPositionStyles(123), []);
  });
});
