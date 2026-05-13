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

import { diffDomPositionStyles as diffSingle } from "./dom-position-styles.ts";

describe("em normalization in diffDomPositionStyles", () => {
  it("emits baselineEm / variantEm for letter-spacing using element's font-size", () => {
    const baseline = [
      el({
        path: "h2[0]",
        tag: "h2",
        classes: "card-title",
        styles: { "font-size": "19px", "letter-spacing": "-0.57px" },
      }),
    ];
    const variant = [
      el({
        path: "h2[0]",
        tag: "h2",
        classes: "luna-panel-title",
        styles: { "font-size": "19px", "letter-spacing": "0px" },
      }),
    ];
    const r = diffSingle(baseline, variant);
    const ls = r.entries.find((e) => e.property === "letter-spacing")!;
    assert.ok(ls);
    // -0.57 / 19 = -0.03 em
    assert.equal(ls.baselineEm, -0.03);
    assert.equal(ls.variantEm, 0);
  });

  it("emits em for line-height in px form", () => {
    const baseline = [
      el({ path: "p[0]", tag: "p", styles: { "font-size": "16px", "line-height": "24px" } }),
    ];
    const variant = [
      el({ path: "p[0]", tag: "p", styles: { "font-size": "16px", "line-height": "20px" } }),
    ];
    const r = diffSingle(baseline, variant);
    const lh = r.entries.find((e) => e.property === "line-height")!;
    // 24/16 = 1.5, 20/16 = 1.25
    assert.equal(lh.baselineEm, 1.5);
    assert.equal(lh.variantEm, 1.25);
  });

  it("does not emit em for non-em-relative properties (padding etc.)", () => {
    const baseline = [el({ path: "p", styles: { "font-size": "16px", padding: "10px" } })];
    const variant = [el({ path: "p", styles: { "font-size": "16px", padding: "20px" } })];
    const r = diffSingle(baseline, variant);
    const pad = r.entries.find((e) => e.property === "padding")!;
    assert.equal(pad.baselineEm, undefined);
    assert.equal(pad.variantEm, undefined);
  });

  it("skips em for `normal` / `auto` values gracefully", () => {
    const baseline = [el({ path: "p", styles: { "font-size": "16px", "line-height": "normal" } })];
    const variant = [el({ path: "p", styles: { "font-size": "16px", "line-height": "24px" } })];
    const r = diffSingle(baseline, variant);
    const lh = r.entries.find((e) => e.property === "line-height")!;
    assert.equal(lh.baselineEm, undefined);
    assert.equal(lh.variantEm, 1.5);
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

import { diffPositionStylesAcrossViewports } from "./dom-position-styles.ts";

describe("diffPositionStylesAcrossViewports", () => {
  it("merges per-viewport diffs and tags each entry with its viewport", () => {
    const baseline = new Map([
      ["mobile", [el({ path: "p1", tag: "div", classes: "a", styles: { padding: "10px" } })]],
      ["desktop", [el({ path: "p1", tag: "div", classes: "a", styles: { padding: "20px" } })]],
    ]);
    const variant = new Map([
      ["mobile", [el({ path: "p1", tag: "div", classes: "b", styles: { padding: "5px" } })]],
      ["desktop", [el({ path: "p1", tag: "div", classes: "b", styles: { padding: "5px" } })]],
    ]);
    const r = diffPositionStylesAcrossViewports(baseline, variant);
    assert.equal(r.totalDiffs, 2);
    const viewports = r.entries.map((e) => e.viewport).sort();
    assert.deepEqual(viewports, ["desktop", "mobile"]);
  });

  it("aggregates (path, property) across viewports — picks up media-query-gated deltas", () => {
    const baseline = new Map([
      ["mobile", [el({ path: "p1", tag: "div", classes: "a", styles: { "max-width": "100%" } })]],
      ["desktop", [el({ path: "p1", tag: "div", classes: "a", styles: { "max-width": "1180px" } })]],
    ]);
    const variant = new Map([
      // mobile matches the baseline → no delta
      ["mobile", [el({ path: "p1", tag: "div", classes: "b", styles: { "max-width": "100%" } })]],
      // desktop differs → 1 delta only at desktop
      ["desktop", [el({ path: "p1", tag: "div", classes: "b", styles: { "max-width": "1200px" } })]],
    ]);
    const r = diffPositionStylesAcrossViewports(baseline, variant);
    assert.equal(r.totalDiffs, 1);
    assert.equal(r.byPathProperty.length, 1);
    assert.deepEqual(r.byPathProperty[0]!.viewports, ["desktop"]);
    assert.equal(r.byPathProperty[0]!.samples[0]!.variant, "1200px");
  });

  it("ranks (path, property) entries by number of viewports they appear in", () => {
    const baseline = new Map([
      ["a", [el({ path: "p", tag: "div", styles: { color: "red", padding: "5px" } })]],
      ["b", [el({ path: "p", tag: "div", styles: { color: "red", padding: "5px" } })]],
      ["c", [el({ path: "p", tag: "div", styles: { color: "red", padding: "5px" } })]],
    ]);
    const variant = new Map([
      // color differs on all three viewports
      ["a", [el({ path: "p", tag: "div", styles: { color: "blue", padding: "5px" } })]],
      ["b", [el({ path: "p", tag: "div", styles: { color: "blue", padding: "5px" } })]],
      // padding differs only on viewport "c"
      ["c", [el({ path: "p", tag: "div", styles: { color: "blue", padding: "10px" } })]],
    ]);
    const r = diffPositionStylesAcrossViewports(baseline, variant);
    assert.equal(r.byPathProperty[0]!.property, "color");
    assert.equal(r.byPathProperty[0]!.viewports.length, 3);
    assert.equal(r.byPathProperty[1]!.property, "padding");
    assert.equal(r.byPathProperty[1]!.viewports.length, 1);
  });

  it("returns empty result when either input is empty", () => {
    assert.equal(diffPositionStylesAcrossViewports(new Map(), new Map()).totalDiffs, 0);
    assert.equal(
      diffPositionStylesAcrossViewports({ mobile: [] }, { mobile: [] }).totalDiffs,
      0,
    );
  });

  it("ignores viewports present in only one capture", () => {
    const baseline = new Map([
      ["mobile", [el({ path: "p", tag: "div", styles: { color: "red" } })]],
      ["wide", [el({ path: "p", tag: "div", styles: { color: "red" } })]],
    ]);
    const variant = new Map([
      ["mobile", [el({ path: "p", tag: "div", styles: { color: "blue" } })]],
    ]);
    const r = diffPositionStylesAcrossViewports(baseline, variant);
    assert.equal(r.totalDiffs, 1);
    assert.deepEqual(r.byViewport.map((v) => v.viewport), ["mobile"]);
  });
});
