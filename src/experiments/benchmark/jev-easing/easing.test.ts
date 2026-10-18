import { describe, expect, it } from "vite-plus/test";
import { EASING_NAMES, easingAt, fitEasing } from "./easing.ts";

const sample = (f: (t: number) => number) => Array.from({ length: 11 }, (_, i) => 40 + 480 * f(i / 10));

describe("easing fit", () => {
  it("names every candidate from its own 11 samples", () => {
    for (const e of EASING_NAMES) expect(fitEasing(sample((t) => easingAt(e, t))).best).toBe(e);
  });

  it("matches CSS at known points", () => {
    expect(easingAt("linear", 0.3)).toBeCloseTo(0.3, 6);
    expect(easingAt("ease-in-out", 0.5)).toBeCloseTo(0.5, 6);
    expect(easingAt("ease", 0.5)).toBeCloseTo(0.8024, 3);
    expect(easingAt("steps", 0.3)).toBe(0.25);
    expect(Math.max(...sample((t) => easingAt("overshoot", t)))).toBeGreaterThan(520);
  });

  it("survives a few pixels of noise on a 480px travel", () => {
    let s = 1;
    const noise = () => ((s = (s * 16807) % 2147483647) / 2147483647 - 0.5) * 6;
    for (const e of EASING_NAMES) expect(fitEasing(sample((t) => easingAt(e, t)).map((v) => v + noise())).best).toBe(e);
  });
});
