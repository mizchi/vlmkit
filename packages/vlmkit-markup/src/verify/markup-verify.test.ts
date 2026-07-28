import { test } from "node:test";
import assert from "node:assert/strict";
import { computeTrend, kickbackForComposition } from "./markup-verify.ts";
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
