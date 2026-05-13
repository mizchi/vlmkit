import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { findShiftOrigins, parseBboxes, type BboxElement } from "./shift-origin.ts";

function bbox(over: Partial<BboxElement> & { path: string }): BboxElement {
  const base: BboxElement = {
    path: over.path,
    tag: "div",
    classes: "",
    top: 0,
    left: 0,
    width: 100,
    height: 50,
  };
  return { ...base, ...over };
}

describe("findShiftOrigins", () => {
  it("names the first element whose Δy matches the band shift", () => {
    // Baseline: hero at top, then 3 cards stacked
    const baseline: BboxElement[] = [
      bbox({ path: "main[0]>section[0]", tag: "section", classes: "hero", top: 0, height: 100 }),
      bbox({ path: "main[0]>section[1]>article[0]", tag: "article", classes: "card", top: 120, height: 200 }),
      bbox({ path: "main[0]>section[1]>article[1]", tag: "article", classes: "card", top: 340, height: 200 }),
      bbox({ path: "main[0]>section[1]>article[2]", tag: "article", classes: "card", top: 560, height: 200 }),
    ];
    // Variant: hero gained 60px height; all cards shifted down 60px
    const variant: BboxElement[] = [
      bbox({ path: "main[0]>section[0]", tag: "section", classes: "luna-hero", top: 0, height: 160 }),
      bbox({ path: "main[0]>section[1]>article[0]", tag: "article", classes: "luna-panel", top: 180, height: 200 }),
      bbox({ path: "main[0]>section[1]>article[1]", tag: "article", classes: "luna-panel", top: 400, height: 200 }),
      bbox({ path: "main[0]>section[1]>article[2]", tag: "article", classes: "luna-panel", top: 620, height: 200 }),
    ];
    const bandShift = 60;
    const origins = findShiftOrigins(baseline, variant, [{ yStart: 120, yEnd: 760, shift: bandShift }]);
    assert.ok(origins.length > 0);
    assert.equal(origins[0]!.originPath, "main[0]>section[1]>article[0]");
    assert.equal(origins[0]!.originDeltaY, 60);
    assert.equal(origins[0]!.suspectedAxis, "margin/padding-above");
  });

  it("flags height-driven causes correctly", () => {
    const baseline = [bbox({ path: "p1", top: 100, height: 100 })];
    const variant = [bbox({ path: "p1", top: 100, height: 140 })];
    const origins = findShiftOrigins(baseline, variant, [{ yStart: 100, yEnd: 240, shift: 40 }]);
    // No Δtop here (Δtop = 0), so no origin found — the height-only delta is
    // visible at the NEXT element's top. This is a known limitation: at least
    // one element below must show the propagated Δtop.
    assert.equal(origins.length, 0);
  });

  it("does NOT require Δy direction to match band-shift sign", () => {
    // Pixelmatch's cross-correlation can report a sign opposite to bbox Δy
    // when the variant has differently-distributed content. We surface the
    // element regardless of sign so the agent can interpret it.
    const baseline = [bbox({ path: "p1", top: 100 })];
    const variant = [bbox({ path: "p1", top: 50 })];
    const origins = findShiftOrigins(baseline, variant, [{ yStart: 50, yEnd: 200, shift: 50 }]);
    assert.equal(origins.length, 1);
    assert.equal(origins[0]!.originDeltaY, -50);
  });

  it("ignores subpixel Δy below threshold", () => {
    const baseline = [bbox({ path: "p1", top: 100 })];
    const variant = [bbox({ path: "p1", top: 102 })];
    const origins = findShiftOrigins(baseline, variant, [{ yStart: 100, yEnd: 200, shift: 10 }]);
    assert.equal(origins.length, 0);
  });

  it("emits multiple candidate origins ranked by best match to band shift", () => {
    // 3 elements at increasing top, all shifted by varying amounts.
    const baseline: BboxElement[] = [
      bbox({ path: "p1", top: 0, height: 50 }),    // Δy = 30
      bbox({ path: "p2", top: 100, height: 50 }),  // Δy = 50 (best match for band 50)
      bbox({ path: "p3", top: 200, height: 50 }),  // Δy = 80
    ];
    const variant: BboxElement[] = [
      bbox({ path: "p1", top: 30 }),
      bbox({ path: "p2", top: 150 }),
      bbox({ path: "p3", top: 280 }),
    ];
    const origins = findShiftOrigins(baseline, variant, [{ yStart: 0, yEnd: 300, shift: 50 }], {
      perBandLimit: 3,
    });
    assert.equal(origins.length, 3);
    // p2 is the best match (|50 - 50| = 0)
    assert.equal(origins[0]!.originPath, "p2");
  });

  it("returns empty array when no bands are above threshold", () => {
    const baseline = [bbox({ path: "p1", top: 100 })];
    const variant = [bbox({ path: "p1", top: 200 })];
    const origins = findShiftOrigins(baseline, variant, [{ yStart: 50, yEnd: 200, shift: 1 }]);
    assert.equal(origins.length, 0);
  });

  it("returns empty array on empty inputs", () => {
    assert.equal(findShiftOrigins([], [], []).length, 0);
    assert.equal(findShiftOrigins([bbox({ path: "p1" })], [], [{ yStart: 0, yEnd: 10, shift: 10 }]).length, 0);
  });
});

describe("parseBboxes", () => {
  it("parses a JSON string", () => {
    const json = JSON.stringify([{ path: "p", tag: "div", classes: "", top: 0, left: 0, width: 10, height: 10 }]);
    const out = parseBboxes(json);
    assert.equal(out.length, 1);
    assert.equal(out[0]!.path, "p");
  });

  it("returns [] on garbage input", () => {
    assert.deepEqual(parseBboxes("not json"), []);
    assert.deepEqual(parseBboxes(123), []);
  });
});
