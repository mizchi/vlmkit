import { describe, expect, it } from "vite-plus/test";
import {
  EASING_NAMES,
  easingAt,
  fitEasing,
  judgeMotionPath,
  type EasingName,
  type MotionSample,
} from "./motion-path.ts";

const box = (x: number, y = 100) => ({ x, y, width: 40, height: 40 });
/** 11 motion frames over 0..1000ms (the last at 999) plus a rest frame at 1300. */
const times = [...Array.from({ length: 10 }, (_, i) => i * 100), 999];
const run = (x: (t: number) => number, opts: { rest?: number | null; present?: (t: number) => number } = {}) => {
  const samples: MotionSample[] = times.map((t) => ({
    atMs: t,
    present: opts.present?.(t) ?? 1,
    box: box(x(Math.min(1, t / 1000))),
  }));
  if (opts.rest !== null) samples.push({ atMs: 1300, present: opts.present?.(1300) ?? 1, box: box(opts.rest ?? x(1)) });
  return samples;
};
const rules = (s: MotionSample[], expectEasing?: EasingName) =>
  judgeMotionPath(s, { startMs: 0, endMs: 1000, ...(expectEasing ? { expectEasing } : {}) }).findings.map(
    (f) => f.rule,
  );

describe("fitEasing", () => {
  it("names every candidate from 11 even samples", () => {
    for (const e of EASING_NAMES)
      expect(fitEasing(Array.from({ length: 11 }, (_, i) => 40 + 480 * easingAt(e, i / 10))).best).toBe(e);
  });
  it("matches CSS at known points", () => {
    expect(easingAt("ease", 0.5)).toBeCloseTo(0.8024, 3);
    expect(easingAt("steps", 0.3)).toBe(0.25);
  });
});

describe("judgeMotionPath", () => {
  it("passes every intact easing, and names it", () => {
    for (const e of EASING_NAMES) {
      const s = run((t) => 40 + 480 * easingAt(e, t));
      expect(rules(s, e)).toEqual([]);
      const r = judgeMotionPath(s, { startMs: 0, endMs: 1000 });
      expect("best" in r.easing && r.easing.best).toBe(e);
    }
  });

  it("calls an unheld final keyframe a snap-back", () => {
    expect(rules(run((t) => 40 + 480 * t, { rest: 40 }))).toEqual(["snap-back"]);
  });

  it("finds a keyframe discontinuity, and not on steps()", () => {
    const broken = (t: number) => 40 + (t < 0.5 ? 100 * t : 380 + 100 * (t - 0.5));
    expect(rules(run(broken))).toEqual(["jump"]);
    expect(rules(run((t) => 40 + 480 * easingAt("steps", t)))).toEqual([]);
  });

  it("finds a target lost mid-motion and one gone at rest", () => {
    expect(rules(run((t) => 40 + 480 * t, { present: (t) => (t >= 400 && t <= 600 ? 0.1 : 0.9) }))).toEqual([
      "target-lost",
      "target-lost",
      "target-lost",
    ]);
    const exit = run((t) => 40 + 480 * t, { present: (t) => (t > 1000 ? 0.05 : 0.9) });
    expect(rules(exit)).toEqual(["absent-at-rest"]);
    expect(judgeMotionPath(exit, { startMs: 0, endMs: 1000, exits: true }).findings).toEqual([]);
  });

  it("fails an easing other than the expected one, and skips a short travel", () => {
    expect(
      rules(
        run((t) => 40 + 480 * easingAt("ease-in", t)),
        "ease-out",
      ),
    ).toEqual(["easing-mismatch"]);
    const short = judgeMotionPath(
      run((t) => 40 + 40 * t),
      { startMs: 0, endMs: 1000, expectEasing: "ease-out" },
    );
    expect(short.findings.map((f) => [f.rule, f.severity])).toEqual([["easing-unchecked", "warn"]]);
    expect("skipped" in short.easing).toBe(true);
  });

  it("reads geometry from sure frames only: a fade's faint first frames neither jump nor skew the fit", () => {
    const fade = run((t) => 40 + 480 * easingAt("ease-out", t), { present: (t) => (t < 200 ? 0.6 : 0.95) });
    // The faint frames' boxes are 60px off, as a faint element's box was measured to be.
    fade[0]!.box = box(100);
    fade[1]!.box = box(260);
    expect(rules(fade, "ease-out")).toEqual([]);
  });

  it("warns when the target is fully shown and still from the first frame", () => {
    expect(rules(run(() => 300))).toEqual(["target-static"]);
    // A fade-in from nothing is not static, though it does not move.
    expect(rules(run(() => 300, { present: (t) => (t === 0 ? 0.02 : 0.95) }))).toEqual([]);
  });

  it("calls a rest that lands elsewhere a jump, not a snap-back", () => {
    expect(rules(run((t) => 40 + 480 * t, { rest: 300 }))).toEqual(["jump"]);
  });

  it("judges an entrance from off-screen, a hold and an exit as segments, edge boxes put back whole", () => {
    // A 300x60 toast slides in from past the right edge of a 1280 frame (ease-out, 0..600),
    // holds, then fades out and rises 16px (2100..2400). Boxes are cut at the frame's edge.
    const W = 1280;
    const left = (t: number) => {
      if (t <= 600) return 956 + 324 * (1 - easingAt("ease-out", t / 600));
      return 956;
    };
    const seg = (a: number, b: number) => [...Array.from({ length: 10 }, (_, i) => a + ((b - a) * i) / 10), b - 1];
    const times = [...seg(0, 600), ...seg(2100, 2400), 2700];
    const samples: MotionSample[] = times.map((t) => {
      const x = left(t);
      const visible = Math.max(0, Math.min(W, x + 300) - x);
      const fading = t > 2100 ? Math.max(0, 1 - (t - 2100) / 300) : 1;
      const y = 24 - (t > 2100 ? 16 * Math.min(1, (t - 2100) / 300) : 0);
      return {
        atMs: t,
        present: visible === 0 || t > 2400 ? 0.02 : visible < 80 ? 0.42 : fading > 0.5 ? 0.95 : 0.6,
        box: { x: Math.min(x, W), y, width: visible, height: 60 },
      };
    });
    const r = judgeMotionPath(samples, {
      startMs: 0,
      endMs: 2400,
      segments: [
        { startMs: 0, endMs: 600 },
        { startMs: 2100, endMs: 2400 },
      ],
      frame: { width: W, height: 800 },
      expectEasing: ["ease-out"],
      exits: true,
    });
    expect(r.findings).toEqual([]);
    expect("best" in r.segments[0]!.easing && r.segments[0]!.easing.best).toBe("ease-out");
    // Without the edge put back, the clipped boxes' centres move at half speed and read linear.
    const naive = judgeMotionPath(samples, { startMs: 0, endMs: 2400, expectEasing: "ease-out", exits: true });
    expect(naive.findings.map((f) => f.rule)).not.toEqual([]);
  });

  it("reads a box that lands on another element and comes back as unsure, not as a jump", () => {
    const s = run((t) => 40 + 480 * easingAt("ease-out", t));
    s[5]!.box = box(1100); // another card, one frame
    const r = judgeMotionPath(s, { startMs: 0, endMs: 1000, expectEasing: "ease-out" });
    expect(r.findings.map((f) => f.rule)).toEqual(["locate-unsure"]);
  });

  it("measures the element itself when the page gives it: a 24px rise and a fade have easings", () => {
    const seg = [...Array.from({ length: 10 }, (_, i) => i * 40), 399, 700];
    const rise = seg.map((t) => {
      const e = easingAt("ease-out", Math.min(1, t / 400));
      const y = 200 + 24 * (1 - e);
      return {
        atMs: t,
        present: t === 0 ? 0.1 : 0.9,
        box: box(300, y),
        dom: { box: box(300, y), opacity: e, scale: 1 },
      };
    });
    const r = judgeMotionPath(rise, { startMs: 0, endMs: 400, expectEasing: "ease-out" });
    expect(r.findings).toEqual([]);
    expect("best" in r.easing && [r.easing.best, r.easing.channel]).toEqual(["ease-out", "position"]);
    // A fade in place: the opacity is what eases.
    const fade = seg.map((t) => {
      const e = easingAt("ease-in", Math.min(1, t / 400));
      return {
        atMs: t,
        present: e > 0.3 ? 0.9 : 0.2,
        box: box(300),
        dom: { box: box(300), opacity: e, scale: 0.92 + 0.08 * e },
      };
    });
    const f = judgeMotionPath(fade, { startMs: 0, endMs: 400, expectEasing: "ease-out" });
    expect(f.findings.map((x) => x.rule)).toEqual(["easing-mismatch"]);
    expect("best" in f.easing && [f.easing.best, f.easing.channel]).toEqual(["ease-in", "opacity"]);
  });

  it("fits each staggered sibling on its own animation time when the page gives it", () => {
    // One segment 0..640ms; this card's own animation is 240..640ms (a 240ms delay).
    const times = [...Array.from({ length: 10 }, (_, i) => i * 64), 639, 940];
    const s = times.map((at) => {
      const t = Math.min(1, Math.max(0, (at - 240) / 400));
      const y = 200 + 24 * (1 - easingAt("ease-out", t));
      return {
        atMs: at,
        present: t > 0.2 ? 0.9 : 0.3,
        box: box(900, y),
        dom: { box: box(900, y), opacity: t, scale: 1, t },
      };
    });
    const r = judgeMotionPath(s, { startMs: 0, endMs: 640, expectEasing: "ease-out" });
    expect(r.findings).toEqual([]);
  });
});
