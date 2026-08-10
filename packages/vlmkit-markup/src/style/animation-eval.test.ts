import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  computeOscillation,
  computeSettleMs,
  deriveAnimationIssues,
  formatAnimationEvalReport,
  frameDelta,
  restTimeForAnimation,
  runAnimationEval,
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
    playState: "running",
    currentTimeMs: 0,
    direction: "normal",
    palindromic: false,
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

test("restTimeForAnimation: running finite → past end, running infinite → 0, page-paused → author time", () => {
  assert.equal(
    restTimeForAnimation(timing({ durationMs: 500, delayMs: 100, iterations: 2 })),
    1100,
  );
  assert.equal(restTimeForAnimation(timing({ iterations: null })), 0);
  assert.equal(
    restTimeForAnimation(timing({ playState: "paused", currentTimeMs: 340, iterations: null })),
    340,
  );
  assert.equal(
    restTimeForAnimation(timing({ playState: "finished", currentTimeMs: 800 })),
    800,
  );
});

test("computeOscillation: alternate spends one iteration per leg", () => {
  assert.deepEqual(
    computeOscillation(timing({ durationMs: 1200, direction: "alternate" })),
    { oscillating: true, legMs: 1200 },
  );
  assert.deepEqual(
    computeOscillation(timing({ durationMs: 1200, direction: "alternate-reverse" })),
    { oscillating: true, legMs: 1200 },
  );
});

test("computeOscillation: palindromic keyframes sweep out and back within one iteration", () => {
  // The S5 blind spot: same 1200ms x∞ as the alternate implementation,
  // but each leg is half the duration — a 2x frequency difference.
  assert.deepEqual(
    computeOscillation(timing({ durationMs: 1200, direction: "normal", palindromic: true })),
    { oscillating: true, legMs: 600 },
  );
});

test("computeOscillation: normal non-palindromic animations do not oscillate", () => {
  assert.deepEqual(
    computeOscillation(timing({ durationMs: 800 })),
    { oscillating: false, legMs: 800 },
  );
});

test("formatAnimationEvalReport annotates oscillating animations with the leg time", () => {
  const report: AnimationEvalReport = {
    source: "fixture.html",
    viewport: { width: 1280, height: 720 },
    animationCount: 2,
    evaluated: [
      evaluated({ name: "pulse", durationMs: 1200, iterations: null, direction: "alternate" }),
      evaluated({ name: "blink", durationMs: 1200, iterations: null, direction: "normal", palindromic: true }),
    ],
    settleMs: null,
    infinite: [{ selector: ".spinner", name: "pulse" }],
    issues: [],
  };
  const text = formatAnimationEvalReport(report);
  assert.match(text, /`pulse` 1200ms x∞ \(alternate, leg 1200ms\)/);
  assert.match(text, /`blink` 1200ms x∞ \(palindromic keyframes, leg 600ms\)/);
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

/**
 * `runAnimationEval` itself — the orchestrator, which had no test at all while
 * every pure helper above did. That gap is not incidental: the two defects these
 * tests pin were invisible to unit tests precisely because the helpers were fed
 * hand-written samples and the code that *builds* those samples never ran.
 *
 * Both defects came from one line of reasoning: `playState` was read once, at
 * whatever instant the collector happened to run, and animations reading
 * `finished` were dropped as "visually static". Measured on a bare local file,
 * `goto` returns at ~509ms and the settle finishes at ~765ms, so every animation
 * shorter than that was already finished before anything was read.
 *
 * Ground truth in these tests is the CSS, not a previous run's output: a
 * `200ms` animation with one iteration and no delay settles at exactly 200.
 */

async function animPage(css: string, body = '<div id="a"></div>'): Promise<string> {
  const dir = await mkdtemp(join(tmpdir(), "vlmkit-anim-"));
  const path = join(dir, "page.html");
  await writeFile(path, `<!doctype html><html><head><meta charset="utf-8"><style>
    body { margin: 0; padding: 20px; background: #fff; }
    @keyframes slide { from { transform: translateX(0); } to { transform: translateX(300px); } }
    #a { width: 120px; height: 60px; background: #2255cc; }
    ${css}
  </style></head><body>${body}</body></html>`);
  return path;
}

async function evaluate(css: string, body?: string) {
  return runAnimationEval({ source: await animPage(css, body) });
}

test("runAnimationEval: settleMs is the declared duration, not zero for a finished animation", { timeout: 120_000 }, async () => {
  // Reported 0 before the fix, for the same page, because a 200ms animation has
  // finished by the ~765ms the collector runs. `computeSettleMs` computes
  // `delay + duration x iterations` — a from-load number — so filtering its input
  // by "still moving right now" mixed two clocks.
  const report = await evaluate("#a { animation: slide 200ms linear 1 forwards; }");
  assert.equal(report.settleMs, 200);
});

test("runAnimationEval: settleMs takes the delay and iteration count from the CSS", { timeout: 120_000 }, async () => {
  // 300ms delay + 400ms x 2 iterations = 1100.
  const report = await evaluate("#a { animation: slide 400ms linear 300ms 2 forwards; }");
  assert.equal(report.settleMs, 1100);
});

test("runAnimationEval: an infinite animation makes settleMs null and is listed", { timeout: 120_000 }, async () => {
  const report = await evaluate("#a { animation: slide 500ms linear infinite; }");
  assert.equal(report.settleMs, null);
  assert.deepEqual(report.infinite.map((i) => i.name), ["slide"]);
});

test("runAnimationEval: a page-paused animation counts as neither motion nor never-settling", { timeout: 120_000 }, async () => {
  // The one exclusion that is about the page's own choice rather than about when
  // we looked: `animation-play-state: paused` is visually static by construction.
  const report = await evaluate("#a { animation: slide 500ms linear infinite; animation-play-state: paused; }");
  assert.equal(report.settleMs, 0, "a paused animation must not contribute to settle");
  assert.deepEqual(report.infinite, [], "a paused infinite animation never runs, so it is not a never-settles");
  assert.equal(report.animationCount, 1, "it is still reported as an animation on the page");
});

test("runAnimationEval: a short animation with no reduced-motion rule is still reported", { timeout: 120_000 }, async () => {
  // The severe one. Before the fix this page — which honours the preference
  // nowhere — came back "No animation issues detected" with exit 0 at 150ms,
  // 200ms and 400ms, and only started reporting at 800ms. The cutoff was not a
  // threshold anyone chose; it was the instant the collector ran.
  const report = await evaluate("#a { animation: slide 200ms linear 1 forwards; }");
  assert.equal(report.reducedMotion?.remainingCount, 1);
  assert.equal(report.reducedMotion?.remaining[0]?.durationMs, 200);
  assert.ok(
    report.issues.some((i) => i.kind === "reduced-motion-ignored"),
    `expected reduced-motion-ignored, got ${JSON.stringify(report.issues.map((i) => i.kind))}`,
  );
});

test("runAnimationEval: honouring reduced-motion keeps the gate silent", { timeout: 120_000 }, async () => {
  // The inverse, without which the fix above would just be a stuck alarm. Both
  // spellings a page actually uses: removing the animation, and the
  // duration-zero trick the reduced-motion floor is there to accept.
  const removed = await evaluate(`
    #a { animation: slide 200ms linear 1 forwards; }
    @media (prefers-reduced-motion: reduce) { #a { animation: none; } }
  `);
  assert.equal(removed.reducedMotion?.remainingCount, 0);
  assert.ok(!removed.issues.some((i) => i.kind === "reduced-motion-ignored"));

  const shortened = await evaluate(`
    #a { animation: slide 200ms linear 1 forwards; }
    @media (prefers-reduced-motion: reduce) { #a { animation-duration: 0.01ms !important; } }
  `);
  assert.equal(shortened.reducedMotion?.remainingCount, 0);
  assert.ok(!shortened.issues.some((i) => i.kind === "reduced-motion-ignored"));
});

/**
 * Every animation gets frame-sampled, not only the ones still running when the
 * evaluator happens to look.
 *
 * Two dogfood agents hit the same wall independently. One was asked to show a
 * reviewer how the cards animate and reported: "the silent drop is the real bug.
 * `evaluated 1` of 5 with no finding, no warning, no hint" — and the one row it did
 * keep was a 28px spinner rather than the cards under review. The other, repairing
 * the page, noted "the dead `z-index` keyframe I removed was never flagged, because
 * short entrance animations finish before sampling."
 *
 * Fixed by holding every animation at `animationstart` instead of merely recording
 * it, with the author's own play state read before the pause — which is what keeps
 * the `page-paused` case above working.
 */
test("runAnimationEval: frame-samples short fill:none animations, not just the survivors", { timeout: 120_000 }, async () => {
  // No `forwards`: the animation is removed from `getAnimations()` the moment it
  // finishes, which is well before the ~765ms the evaluator reads at.
  const report = await evaluate(
    `#a { animation: slide 200ms linear 1; }
     #b { width: 60px; height: 30px; background: #c52; animation: slide 220ms linear 1; }`,
    '<div id="a"></div><div id="b"></div>',
  );
  assert.equal(report.animationCount, 2);
  assert.equal(report.evaluated.length, 2, "both must be sampled, not only a survivor");
  assert.ok(report.evaluated.every((a) => a.visible), "both move 300px; both must read as visible");
});

test("runAnimationEval: the sampled set is the same on two consecutive runs", { timeout: 180_000 }, async () => {
  const css = "#a { animation: slide 200ms linear 1; }";
  const [first, second] = [await evaluate(css), await evaluate(css)];
  assert.deepEqual(
    first.evaluated.map((a) => a.name),
    second.evaluated.map((a) => a.name),
    "which animations get sampled must not depend on load timing",
  );
});

test("runAnimationEval: the strip leaves out animations that moved nothing, and says how many", { timeout: 120_000 }, async () => {
  // An animation with no motion bbox used to get a row cropped to the whole
  // viewport, which then sized the uniform cell for every other row: one dead
  // keyframe turned a tight sheet into 1592x768 of mostly grey.
  const { mkdtemp } = await import("node:fs/promises");
  const { tmpdir } = await import("node:os");
  const { join } = await import("node:path");
  const source = await animPage(
    `@keyframes dead { from { z-index: 1; } to { z-index: 9; } }
     #a { animation: slide 300ms linear 1 forwards; }
     #b { animation: dead 300ms linear 1 forwards; }`,
    '<div id="a"></div><div id="b">b</div>',
  );
  const dir = await mkdtemp(join(tmpdir(), "vlmkit-strip-"));
  const stripPath = join(dir, "strip.png");
  const report = await runAnimationEval({ source, stripPath });

  assert.equal(report.evaluated.length, 2, "both are still evaluated and reported");
  assert.ok(report.strip, "a strip was requested");
  assert.equal(report.strip.omitted, 1, "the dead one contributes no row");
  assert.equal(report.strip.rows, 1);
  const formatted = formatAnimationEvalReport(report);
  assert.match(formatted, /1 omitted as no-visible-effect/, "the omission must be named, never silent");
});

/**
 * The strip is sampled on ONE shared clock, so a stagger is visible.
 *
 * A dogfood agent asked to show a reviewer the card entrance: "each row is sampled
 * over its *own* 0→1 progress and cropped to its own element, so the 0/60/120ms
 * stagger is invisible and the image reads as 'all three cards animate
 * simultaneously' — wrong on exactly the property under review."
 */
test("runAnimationEval: strip columns are shared instants on the page timeline", { timeout: 120_000 }, async () => {
  const { mkdtemp } = await import("node:fs/promises");
  const { tmpdir } = await import("node:os");
  const { join } = await import("node:path");
  const source = await animPage(
    `#a { animation: slide 200ms linear 1 forwards; }
     #b { width: 120px; height: 60px; background: #2255cc; animation: slide 200ms linear 200ms 1 forwards; }`,
    '<div id="a"></div><div id="b"></div>',
  );
  const dir = await mkdtemp(join(tmpdir(), "vlmkit-shared-"));
  const report = await runAnimationEval({
    source,
    samples: 4,
    stripWindowMs: 400,
    stripPath: join(dir, "strip.png"),
  });
  assert.ok(report.strip);
  // One clock: the instants are a property of the page, not of a row.
  assert.deepEqual(report.strip.times, [100, 200, 300, 400]);
  assert.equal(report.strip.windowMs, 400);
  assert.equal(report.strip.rows, 2);
  // And the caption carries what the image cannot.
  const formatted = formatAnimationEvalReport(report);
  assert.match(formatted, /columns are 100ms \/ 200ms \/ 300ms \/ 400ms/);
  assert.match(formatted, /one shared clock/);
  assert.match(formatted, /rows top to bottom are #a, #b/);
});

test("runAnimationEval: the strip window defaults to one iteration of the slowest animation", { timeout: 120_000 }, async () => {
  const { mkdtemp } = await import("node:fs/promises");
  const { tmpdir } = await import("node:os");
  const { join } = await import("node:path");
  const source = await animPage(
    `#a { animation: slide 200ms linear 1 forwards; }
     #b { width: 120px; height: 60px; background: #2255cc; animation: slide 500ms linear 300ms 1 forwards; }`,
    '<div id="a"></div><div id="b"></div>',
  );
  const report = await runAnimationEval({
    source,
    samples: 2,
    stripPath: join(await mkdtemp(join(tmpdir(), "vlmkit-shared-")), "strip.png"),
  });
  // 300ms delay + 500ms duration is the last thing to finish.
  assert.equal(report.strip?.windowMs, 800);
  assert.deepEqual(report.strip?.times, [400, 800]);
});

test("runAnimationEval: a delayed animation has not started at an instant inside its delay", { timeout: 120_000 }, async () => {
  // The behavioural half. At t=100ms the undelayed element is mid-fade and the one
  // with a 200ms delay has not moved at all — which is the difference the sheet has
  // to be able to show, and could not when each row ran on its own clock.
  const { mkdtemp, readFile } = await import("node:fs/promises");
  const { tmpdir } = await import("node:os");
  const { join } = await import("node:path");
  const { cropRegion, measureChangeMagnitude } = await import("@mizchi/vlmkit-core/png-utils.ts");
  const { PNG } = await import("pngjs");

  const source = await animPage(
    `#a { animation: slide 200ms linear 1 forwards; }
     #b { width: 120px; height: 60px; background: #2255cc; animation: slide 200ms linear 200ms 1 forwards; }`,
    '<div id="a"></div><div id="b"></div>',
  );
  const dir = await mkdtemp(join(tmpdir(), "vlmkit-stagger-"));
  const report = await runAnimationEval({
    source,
    samples: 4,
    stripWindowMs: 400,
    stripPath: join(dir, "strip.png"),
    framesDir: dir,
  });

  const decode = async (name: string) => {
    const png = PNG.sync.read(await readFile(join(dir, name)));
    return { width: png.width, height: png.height, data: new Uint8Array(png.data) };
  };
  const early = await decode("t-100ms.png");
  const late = await decode("t-400ms.png");
  const delayed = report.evaluated.find((a) => a.selector === "#b");
  assert.ok(delayed?.motionBbox, "the delayed animation must still be evaluated");
  const box = delayed.motionBbox;
  const region = (frame: Awaited<ReturnType<typeof decode>>) =>
    cropRegion(frame, box.x, box.y, box.width, box.height);
  const moved = measureChangeMagnitude(region(early), region(late));
  assert.ok(
    moved.changedFraction > 0.05,
    `the delayed element must look different at 100ms and 400ms, got ${moved.changedFraction}`,
  );
});

/**
 * The strip's default window follows the finite animations, and its rows can be
 * scoped. Both from the v2 dogfood run, which reached a good artifact and then said
 * what it had to work around to get there.
 */
test("runAnimationEval: an infinite animation does not set the strip's timebase", { timeout: 120_000 }, async () => {
  // "the default `--strip-window` is actively misleading here. 'One iteration of the
  // slowest animation' picks the *infinite spinner*, so the default sheet spends 75%
  // of its columns on a settled page." Measured on the dogfood fixture: spinner 900ms,
  // every finite animation done by 400ms.
  const { mkdtemp } = await import("node:fs/promises");
  const { tmpdir } = await import("node:os");
  const { join } = await import("node:path");
  const source = await animPage(
    `#a { animation: slide 200ms linear 1 forwards; }
     #spin { width: 20px; height: 20px; background: #333; animation: slide 3000ms linear infinite; }`,
    '<div id="a"></div><div id="spin"></div>',
  );
  const report = await runAnimationEval({
    source,
    samples: 4,
    stripPath: join(await mkdtemp(join(tmpdir(), "vlmkit-win-")), "strip.png"),
  });
  // The finite animation ends at 200ms; the infinite one runs for 3s and must not win.
  assert.equal(report.strip?.windowMs, 200);
  assert.deepEqual(report.strip?.times, [50, 100, 150, 200]);
});

test("runAnimationEval: with everything infinite, one iteration of the longest is the window", { timeout: 120_000 }, async () => {
  const { mkdtemp } = await import("node:fs/promises");
  const { tmpdir } = await import("node:os");
  const { join } = await import("node:path");
  const source = await animPage(
    `#a { animation: slide 500ms linear infinite; }
     #b { width: 40px; height: 40px; background: #333; animation: slide 800ms linear infinite; }`,
    '<div id="a"></div><div id="b"></div>',
  );
  const report = await runAnimationEval({
    source,
    samples: 2,
    stripPath: join(await mkdtemp(join(tmpdir(), "vlmkit-win-")), "strip.png"),
  });
  assert.equal(report.strip?.windowMs, 800, "nothing finite to go on, so the longest period");
});

test("runAnimationEval: --strip-selector scopes the rows and the counts say why", { timeout: 120_000 }, async () => {
  // "No flag to scope the strip to one animation or selector. I expected
  // `--selector .card` or `--only`; neither exists. So row 4 is six 34px spinners plus
  // a ~90px dead grey band [...] ~20% of the sheet is noise."
  const { mkdtemp } = await import("node:fs/promises");
  const { tmpdir } = await import("node:os");
  const { join } = await import("node:path");
  const source = await animPage(
    `@keyframes dead { from { z-index: 1; } to { z-index: 9; } }
     .card { width: 80px; height: 30px; background: #248; animation: slide 300ms linear 1 forwards; }
     #noise { width: 20px; height: 20px; background: #a22; animation: slide 300ms linear 1 forwards; }
     #a { animation: dead 300ms linear 1 forwards; }`,
    '<div id="a"></div><div class="card"></div><div class="card"></div><div id="noise"></div>',
  );
  const report = await runAnimationEval({
    source,
    samples: 3,
    stripSelector: ".card",
    stripPath: join(await mkdtemp(join(tmpdir(), "vlmkit-scope-")), "strip.png"),
  });
  assert.equal(report.evaluated.length, 4, "every animation is still evaluated and reported");
  assert.equal(report.strip?.rows, 2, "only the two cards get rows");
  // Counted by reason: calling a selector-excluded row a no-visible-effect would be a
  // false statement of exactly the kind these lines exist to avoid.
  assert.equal(report.strip?.outOfScope, 2, "#a and #noise are out of scope");
  assert.equal(report.strip?.omitted, 0, "and neither of the in-scope rows is dead");
  assert.match(formatAnimationEvalReport(report), /2 outside --strip-selector/);
});

test("runAnimationEval: a --strip-selector matching nothing animated says what is animated", { timeout: 120_000 }, async () => {
  const { mkdtemp } = await import("node:fs/promises");
  const { tmpdir } = await import("node:os");
  const { join } = await import("node:path");
  const source = await animPage("#a { animation: slide 200ms linear 1 forwards; }");
  const stripPath = join(await mkdtemp(join(tmpdir(), "vlmkit-scope-")), "strip.png");
  await assert.rejects(
    () => runAnimationEval({ source, stripSelector: ".nope", stripPath }),
    (error: Error) => {
      assert.match(error.message, /--strip-selector `\.nope` matched no animated element/);
      // The way out is in the message, not in a second command.
      assert.match(error.message, /Animated elements on this page: #a/);
      return true;
    },
  );
});
