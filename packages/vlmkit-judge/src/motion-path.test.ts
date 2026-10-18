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
    expect(short.findings).toEqual([]);
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
});
