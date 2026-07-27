import { test } from "node:test";
import assert from "node:assert/strict";
import {
  computeSettleMs,
  deriveAnimationIssues,
  formatAnimationEvalReport,
  frameDelta,
  unionBbox,
  type AnimationEvalReport,
  type AnimationTimingSample,
  type EvaluatedAnimation,
} from "./animation-eval.ts";

function frame(width: number, height: number, fill: [number, number, number] = [255, 255, 255]) {
  const data = new Uint8Array(width * height * 4);
  for (let i = 0; i < data.length; i += 4) {
    data[i] = fill[0];
    data[i + 1] = fill[1];
    data[i + 2] = fill[2];
    data[i + 3] = 255;
  }
  return { width, height, data };
}

function paint(
  f: { width: number; height: number; data: Uint8Array },
  x: number,
  y: number,
  w: number,
  h: number,
  rgb: [number, number, number],
) {
  for (let yy = y; yy < y + h; yy++) {
    for (let xx = x; xx < x + w; xx++) {
      const i = (yy * f.width + xx) * 4;
      f.data[i] = rgb[0];
      f.data[i + 1] = rgb[1];
      f.data[i + 2] = rgb[2];
    }
  }
}

function timing(overrides: Partial<AnimationTimingSample> = {}): AnimationTimingSample {
  return {
    index: 0,
    selector: ".spinner",
    type: "css-animation",
    name: "spin",
    durationMs: 800,
    delayMs: 0,
    iterations: 1,
    playState: "paused",
    ...overrides,
  };
}

function evaluated(overrides: Partial<EvaluatedAnimation> = {}): EvaluatedAnimation {
  return {
    ...timing(),
    frames: [{ fraction: 0.5, changedPixels: 500, ratio: 0.05, bbox: { x: 10, y: 10, width: 40, height: 40 } }],
    visible: true,
    motionBbox: { x: 10, y: 10, width: 40, height: 40 },
    totalChangedPixels: 500,
    maxFrameRatio: 0.05,
    ...overrides,
  };
}

test("frameDelta reports zero for identical frames", () => {
  const a = frame(40, 30);
  const b = frame(40, 30);
  const delta = frameDelta(a, b);
  assert.equal(delta.changedPixels, 0);
  assert.equal(delta.ratio, 0);
  assert.equal(delta.bbox, null);
});

test("frameDelta counts changed pixels and bounds them", () => {
  const a = frame(40, 30);
  const b = frame(40, 30);
  paint(b, 5, 8, 10, 4, [0, 0, 0]);
  const delta = frameDelta(a, b);
  assert.equal(delta.changedPixels, 40);
  assert.deepEqual(delta.bbox, { x: 5, y: 8, width: 10, height: 4 });
  assert.ok(Math.abs(delta.ratio - 40 / 1200) < 1e-9);
});

test("frameDelta respects the per-channel tolerance", () => {
  const a = frame(10, 10, [100, 100, 100]);
  const b = frame(10, 10, [106, 100, 100]); // within default tolerance 8
  assert.equal(frameDelta(a, b).changedPixels, 0);
  assert.equal(frameDelta(a, b, 3).changedPixels, 100);
});

test("frameDelta rejects mismatched sizes", () => {
  assert.throws(() => frameDelta(frame(10, 10), frame(12, 10)), /size mismatch/);
});

test("unionBbox merges rectangles and passes through nulls", () => {
  assert.equal(unionBbox(null, null), null);
  const a = { x: 0, y: 0, width: 10, height: 10 };
  const b = { x: 20, y: 5, width: 10, height: 20 };
  assert.deepEqual(unionBbox(a, null), a);
  assert.deepEqual(unionBbox(null, b), b);
  assert.deepEqual(unionBbox(a, b), { x: 0, y: 0, width: 30, height: 25 });
});

test("computeSettleMs takes the max of delay + duration x iterations", () => {
  const settle = computeSettleMs([
    timing({ durationMs: 500, delayMs: 100, iterations: 2 }), // 1100
    timing({ durationMs: 300, delayMs: 0, iterations: 3 }), // 900
  ]);
  assert.equal(settle, 1100);
});

test("computeSettleMs returns null when any animation is infinite", () => {
  const settle = computeSettleMs([
    timing({ durationMs: 500, iterations: 1 }),
    timing({ durationMs: 1000, iterations: null }),
  ]);
  assert.equal(settle, null);
});

test("a visually dead animation raises no-visible-effect", () => {
  const issues = deriveAnimationIssues({
    evaluated: [evaluated({ visible: false, motionBbox: null, totalChangedPixels: 0, maxFrameRatio: 0 })],
    settleMs: 800,
    infinite: [],
  });
  assert.equal(issues.length, 1);
  assert.equal(issues[0]!.kind, "no-visible-effect");
  assert.equal(issues[0]!.severity, "suspect");
  assert.equal(issues[0]!.selector, ".spinner");
});

test("infinite animations raise a warn with a mask suggestion", () => {
  const issues = deriveAnimationIssues({
    evaluated: [],
    settleMs: null,
    infinite: [{ selector: ".marquee", name: "scroll-left" }],
  });
  assert.equal(issues.length, 1);
  assert.equal(issues[0]!.kind, "infinite-animation");
  assert.equal(issues[0]!.severity, "warn");
  assert.match(issues[0]!.message, /--mask "\.marquee"/);
});

test("long settle raises a warn above the threshold only", () => {
  const base = { evaluated: [evaluated()], infinite: [] };
  assert.equal(deriveAnimationIssues({ ...base, settleMs: 2500 }).length, 0);
  const issues = deriveAnimationIssues({ ...base, settleMs: 4200 });
  assert.equal(issues.length, 1);
  assert.equal(issues[0]!.kind, "long-settle");
  const custom = deriveAnimationIssues({ ...base, settleMs: 2500 }, { settleThresholdMs: 2000 });
  assert.equal(custom.length, 1);
});

test("animations surviving reduced-motion emulation raise a suspect", () => {
  const issues = deriveAnimationIssues({
    evaluated: [evaluated()],
    settleMs: 800,
    infinite: [],
    reducedMotion: {
      remainingCount: 2,
      remaining: [{ selector: ".hero", name: "float", durationMs: 2000 }],
    },
  });
  assert.equal(issues.length, 1);
  assert.equal(issues[0]!.kind, "reduced-motion-ignored");
  assert.equal(issues[0]!.severity, "suspect");
  assert.match(issues[0]!.message, /\.hero/);
});

test("uncontrolled motion between rest captures raises a warn", () => {
  const issues = deriveAnimationIssues({
    evaluated: [evaluated()],
    settleMs: 800,
    infinite: [],
    uncontrolledMotion: {
      changedPixels: 900,
      ratio: 0.01,
      bbox: { x: 40, y: 200, width: 360, height: 60 },
    },
  });
  assert.equal(issues.length, 1);
  assert.equal(issues[0]!.kind, "uncontrolled-motion");
  assert.equal(issues[0]!.severity, "warn");
  assert.match(issues[0]!.message, /rAF/);
  assert.match(issues[0]!.message, /\(40,200\) 360x60/);
  assert.match(issues[0]!.message, /contaminated/);
});

test("a healthy finite visible animation raises no issues", () => {
  const issues = deriveAnimationIssues({
    evaluated: [evaluated()],
    settleMs: 800,
    infinite: [],
    reducedMotion: { remainingCount: 0, remaining: [] },
  });
  assert.deepEqual(issues, []);
});

test("formatAnimationEvalReport renders counts, settle, and issues", () => {
  const report: AnimationEvalReport = {
    source: "fixture.html",
    viewport: { width: 1280, height: 720 },
    animationCount: 2,
    evaluated: [evaluated()],
    settleMs: null,
    infinite: [{ selector: ".marquee", name: "scroll-left" }],
    reducedMotion: { remainingCount: 0, remaining: [] },
    issues: deriveAnimationIssues({
      evaluated: [evaluated()],
      settleMs: null,
      infinite: [{ selector: ".marquee", name: "scroll-left" }],
      reducedMotion: { remainingCount: 0, remaining: [] },
    }),
  };
  const text = formatAnimationEvalReport(report);
  assert.match(text, /animations: 2 \(evaluated 1, infinite 1\)/);
  assert.match(text, /settle: never \(infinite animation\)/);
  assert.match(text, /reduced-motion: honored/);
  assert.match(text, /infinite-animation/);
  assert.match(text, /motion region \(10,10\) 40x40/);
});

test("formatAnimationEvalReport surfaces uncontrolled motion", () => {
  const report: AnimationEvalReport = {
    source: "fixture.html",
    viewport: { width: 1280, height: 720 },
    animationCount: 0,
    evaluated: [],
    settleMs: 0,
    infinite: [],
    uncontrolledMotion: { changedPixels: 900, ratio: 0.01, bbox: { x: 40, y: 200, width: 360, height: 60 } },
    issues: deriveAnimationIssues({
      evaluated: [],
      settleMs: 0,
      infinite: [],
      uncontrolledMotion: { changedPixels: 900, ratio: 0.01, bbox: { x: 40, y: 200, width: 360, height: 60 } },
    }),
  };
  const text = formatAnimationEvalReport(report);
  assert.match(text, /uncontrolled motion: 900px at \(40,200\) 360x60/);
  assert.match(text, /uncontrolled-motion/);
});
