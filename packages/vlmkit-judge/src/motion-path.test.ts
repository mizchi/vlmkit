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
      run((t) => 40 + 20 * t),
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
});
