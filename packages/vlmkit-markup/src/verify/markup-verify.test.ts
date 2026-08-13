import { test } from "vitest";
import assert from "node:assert/strict";
import { computeTrend, heightToleranceFor, pixelPresence } from "./markup-verify.ts";
import { kickbackForComposition } from "./markup-verify-report.ts";
import type { PageComposition, PageComponent, PageMatch } from "../component/page-compose.ts";

test("computeTrend: fewer passing targets is a regression", () => {
  assert.equal(
    computeTrend({ targetsPassed: 1, residuals: 4 }, { targetsPassed: 0, residuals: 4 }).direction,
    "regressed",
  );
});

test("computeTrend: same targets but more residuals is a regression", () => {
  assert.equal(
    computeTrend({ targetsPassed: 0, residuals: 4 }, { targetsPassed: 0, residuals: 8 }).direction,
    "regressed",
  );
});

test("computeTrend: more passing targets or fewer residuals is an improvement", () => {
  assert.equal(
    computeTrend({ targetsPassed: 0, residuals: 4 }, { targetsPassed: 1, residuals: 4 }).direction,
    "improved",
  );
  assert.equal(
    computeTrend({ targetsPassed: 0, residuals: 4 }, { targetsPassed: 0, residuals: 2 }).direction,
    "improved",
  );
});

test("computeTrend: unchanged numbers are flat", () => {
  assert.equal(
    computeTrend({ targetsPassed: 0, residuals: 4 }, { targetsPassed: 0, residuals: 4 }).direction,
    "flat",
  );
});

function component(index: number, left: number, top: number, w: number, h: number, hex = "#e2e8f0"): PageComponent {
  return { index, left, top, width: w, height: h, area: w * h, fillColor: "rgb(0,0,0)", hex };
}

function match(t: PageComponent, c: PageComponent, iou: number): PageMatch {
  return {
    target: t,
    current: c,
    deltaTop: c.top - t.top,
    deltaLeft: c.left - t.left,
    deltaWidth: c.width - t.width,
    deltaHeight: c.height - t.height,
    iou,
    fillDistance: 0,
  };
}

function composition(overrides: Partial<PageComposition> = {}): PageComposition {
  return {
    targetSize: { width: 1280, height: 1091 },
    currentSize: { width: 1280, height: 1091 },
    matches: [],
    missing: [],
    extra: [],
    orderViolations: [],
    gapDeltas: [],
    ...overrides,
  };
}

test("kickback puts collapsed matched components first as root-cause candidates", () => {
  // S5-r5 shape: hero matched at IoU 0.04 with -280px height, plus a
  // missing footer — the hero line must come before the footer line.
  const hero = match(component(0, 0, 51, 1280, 347, "#121b2f"), component(0, 0, 0, 1280, 67, "#121b2f"), 0.04);
  const c = composition({
    matches: [hero],
    missing: [component(1, 0, 1032, 1280, 59, "#e1e7ef")],
  });
  const lines = kickbackForComposition("desktop", c);
  assert.match(lines[0]!, /ROOT-CAUSE CANDIDATE/);
  assert.match(lines[0]!, /IoU 0.04/);
  assert.match(lines[1]!, /missing #1/);
});

test("kickback pairs a missing with a same-fill extra as a displaced element", () => {
  const c = composition({
    missing: [component(1, 0, 1032, 1280, 59, "#e1e7ef")],
    extra: [component(2, 0, 1084, 1280, 52, "#e3e9f1")],
  });
  const lines = kickbackForComposition("desktop", c);
  assert.equal(lines.length, 1);
  assert.match(lines[0]!, /DISPLACED/);
  assert.match(lines[0]!, /do not add a new element/);
});

test("kickback reports mid-range IoU matches once, not as root causes", () => {
  const m = match(component(0, 0, 51, 1280, 347), component(0, 0, 60, 1280, 330), 0.85);
  const lines = kickbackForComposition("desktop", composition({ matches: [m] }));
  assert.equal(lines.length, 1);
  assert.doesNotMatch(lines[0]!, /ROOT-CAUSE/);
  assert.match(lines[0]!, /IoU 0.85/);
});

test("heightToleranceFor: floor of 8px, then 1% of the target height", () => {
  assert.equal(heightToleranceFor(400), 8);   // 1% = 4 → floor wins
  assert.equal(heightToleranceFor(1335), 13); // r5 mobile: +8px passes
  assert.equal(heightToleranceFor(2905), 29); // S6 tablet: -615px fails by far
});

test("pixelPresence: full presence when the bbox holds the fill; zero when it doesn't", () => {
  // 10x10 white image with a 4x1 gray line at (2,5).
  const img = { data: new Uint8Array(10 * 10 * 4).fill(255), width: 10, height: 10 };
  for (let x = 2; x < 6; x++) {
    const i = (5 * 10 + x) * 4;
    img.data[i] = 226; img.data[i + 1] = 232; img.data[i + 2] = 240;
  }
  const line = { left: 2, top: 5, width: 4, height: 1, hex: "#e2e8f0" };
  assert.equal(pixelPresence(img, line), 1);
  assert.equal(pixelPresence(img, { ...line, top: 8 }), 0, "same line 3px away must not count");
  assert.equal(pixelPresence(img, { ...line, left: -20, top: -20 }), 0, "out-of-bounds bbox is absent");
});

// 2026-08-01 hard-target audit: a #f1f1f1 card was "pixel-confirmed
// present" in a render where that area was plain white, because white is
// only 14 units from the fill and the tolerance was 25. A presence test
// that cannot separate the fill from the background is vacuous.
test("pixelPresence: a low-contrast fill is not 'present' on a bare background", () => {
  const white = { data: new Uint8Array(20 * 20 * 4).fill(255), width: 20, height: 20 };
  const card = { left: 2, top: 2, width: 10, height: 10, hex: "#f1f1f1" };

  // Without the background reference, plain white passes for the fill.
  assert.equal(pixelPresence(white, card), 1, "documents the old, vacuous behavior");

  // With it, the tolerance is clamped below the fill/background distance.
  assert.equal(pixelPresence(white, card, 25, [255, 255, 255]), 0);

  // And the fill itself is still detected where it genuinely is.
  const withCard = { data: new Uint8Array(white.data), width: 20, height: 20 };
  for (let y = 2; y < 12; y++) {
    for (let x = 2; x < 12; x++) {
      const i = (y * 20 + x) * 4;
      withCard.data[i] = 241; withCard.data[i + 1] = 241; withCard.data[i + 2] = 241;
    }
  }
  assert.equal(pixelPresence(withCard, card, 25, [255, 255, 255]), 1);
});

test("kickback near-miss: an extra whose fill sits 12px away in the target reads as displacement", () => {
  const hairline = component(3, 0, 645, 1280, 1, "#e7e5e4");
  const c = composition({ extra: [hairline] });
  // Fake probe: current has the fill at its own box; target has it 12px higher.
  const presence = (side: "target" | "current", box: { top: number }): number => {
    if (side === "current") return box.top === 645 ? 1 : 0;
    return box.top === 633 ? 1 : 0;
  };
  const lines = kickbackForComposition("desktop", c, { presence });
  assert.equal(lines.length, 1);
  assert.match(lines[0]!, /near-miss/);
  assert.match(lines[0]!, /12px higher/);
  assert.match(lines[0]!, /move it instead/);
});

test("kickback near-miss: a missing whose fill exists nearby in the render reads as displacement", () => {
  const divider = component(7, 0, 243, 1280, 1, "#e7e5e4");
  const c = composition({ missing: [divider] });
  const presence = (side: "target" | "current", box: { top: number }): number => {
    if (side === "target") return box.top === 243 ? 1 : 0;
    return box.top === 251 ? 1 : 0; // render has it 8px lower
  };
  const lines = kickbackForComposition("desktop", c, { presence });
  assert.match(lines[0]!, /near-miss/);
  assert.match(lines[0]!, /8px lower/);
});

test("kickback near-miss stays silent when the fill is genuinely absent", () => {
  const sliver = component(5, 1244, 324, 36, 242, "#a31c41");
  const c = composition({ missing: [sliver] });
  const presence = (side: "target" | "current", box: { top: number }): number =>
    side === "target" && box.top === 324 ? 1 : 0;
  const lines = kickbackForComposition("desktop", c, { presence });
  assert.doesNotMatch(lines[0]!, /near-miss/);
  assert.match(lines[0]!, /genuinely absent/);
});

test("kickback grouping caveat: big size delta with target fill present across the full target box", () => {
  // S9-replay shape: whole-card target component (242px) matched against
  // an image-only current component (150px) — dSize reads "-92" but the
  // render already shows the fill over the full target box.
  const card = match(
    component(2, 44, 324, 380, 242, "#b45309"),
    component(2, 44, 324, 380, 150, "#b45309"),
    0.55,
  );
  const presence = (): number => 1; // both sides fully present
  const lines = kickbackForComposition("desktop", composition({ matches: [card] }), { presence });
  assert.match(lines[0]!, /size-delta caveat/);
  assert.match(lines[0]!, /segmentation grouping/);
});

test("kickback grouping caveat stays silent for small deltas and for real size bugs", () => {
  const small = match(component(0, 0, 51, 1280, 347), component(0, 0, 60, 1280, 330), 0.85);
  const linesSmall = kickbackForComposition("desktop", composition({ matches: [small] }), { presence: () => 1 });
  assert.doesNotMatch(linesSmall[0]!, /size-delta caveat/);

  const collapsed = match(component(0, 0, 51, 1280, 347, "#121b2f"), component(0, 0, 0, 1280, 67, "#121b2f"), 0.04);
  const presence = (side: "target" | "current"): number => (side === "target" ? 1 : 0.1); // render lacks the fill
  const linesReal = kickbackForComposition("desktop", composition({ matches: [collapsed] }), { presence });
  assert.doesNotMatch(linesReal[0]!, /size-delta caveat/);
  assert.match(linesReal[0]!, /ROOT-CAUSE/);
});
