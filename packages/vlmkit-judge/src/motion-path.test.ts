import assert from "node:assert/strict";
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
  it("names the point a measured scale grows from, and when its own animation begins", () => {
    // A 200x100 box at (100,100) at full size, scaled about its top-right corner (300,100).
    const at = (atMs: number, k: number, elapsedMs: number, t: number) => {
      const box = { x: 300 - 200 * k, y: 100, width: 200 * k, height: 100 * k };
      return { atMs, present: 1, box, dom: { box, opacity: 1, scale: k, elapsedMs, t } };
    };
    const samples = [
      at(300, 0.6, 0, 0),
      at(330, 0.75, 30, 0.3),
      at(360, 0.9, 60, 0.6),
      at(390, 1, 90, 0.99),
      at(700, 1, 400, 1),
    ];
    const r = judgeMotionPath(samples, { startMs: 300, endMs: 400, expectOrigin: "bottom-left", expectStartMs: 280 });
    expect(r.segments[0]!.origin).toMatchObject({ name: "top-right" });
    expect(r.startsAtMs).toBe(300);
    expect(r.findings.map((f) => f.rule).sort()).toEqual(["origin-mismatch", "start-mismatch"]);
    const ok = judgeMotionPath(samples, { startMs: 300, endMs: 400, expectOrigin: "top-right", expectStartMs: 300 });
    expect(ok.findings).toEqual([]);
  });

  // Round 8 of motion-repair.
  it("solves the point of a 96% → 100% scale, and fits a 4px lift instead of calling it static", () => {
    // A 400x200 dialog centred on (640,400), growing about its centre.
    const dlg = (atMs: number, k: number) => {
      const box = { x: 640 - 200 * k, y: 400 - 100 * k, width: 400 * k, height: 200 * k };
      return { atMs, present: 1, box, dom: { box, opacity: 1, scale: k } };
    };
    const grow = [0, 0.25, 0.5, 0.75, 1].map((t, i) => dlg(i * 50, 0.96 + 0.04 * easingAt("ease-out", t)));
    const g = judgeMotionPath([...grow, dlg(500, 1)], {
      startMs: 0,
      endMs: 200,
      expectOrigin: "center",
      expectStill: true,
    });
    expect(g.segments[0]!.origin).toMatchObject({ name: "center" });
    expect(g.findings).toEqual([]);
    // A card lifting 4px with ease-out: a path, not "moves under 6px … not applying".
    const lift = Array.from({ length: 11 }, (_, i) => {
      const b = box(300, 105 - 4 * easingAt("ease-out", i / 10));
      return { atMs: i * 15, present: 1, box: b, dom: { box: b, opacity: 1, scale: 1 } };
    });
    const rest = { ...lift[10]!, atMs: 450 };
    const l = judgeMotionPath([...lift, rest], { startMs: 0, endMs: 150, expectEasing: "ease-out" });
    expect(l.findings).toEqual([]);
    expect(l.segments[0]!.direction?.way).toBe("up");
  });

  it("names a keyframe transform that replaces the element's placement", () => {
    // Off by (200,98) through the whole opening, at its place only once it stops.
    const at = (atMs: number, dx: number, op: number) => {
      const b = { x: 440 + dx, y: 300 + 98 * Math.sign(dx), width: 400, height: 200 };
      return { atMs, present: 1, box: b, dom: { box: b, opacity: op, scale: 1 } };
    };
    const samples = [
      at(0, 200, 0.2),
      at(50, 200, 0.5),
      at(100, 200, 0.7),
      at(150, 200, 0.9),
      at(199, 200, 1),
      at(500, 0, 1),
    ];
    const r = judgeMotionPath(samples, { startMs: 0, endMs: 200, expectStill: true });
    expect(r.findings.map((f) => f.rule).sort()).toEqual(["jump", "still-mismatch"]);
    expect(r.findings.find((f) => f.rule === "jump")!.message).toMatch(
      /sits 223px off where it rests .*translate\(-50%, -50%\)/,
    );
    expect(r.segments[0]!.direction).toBeUndefined();
  });

  it("names the edge a one-axis scale keeps, and checks only that axis", () => {
    // A 300x60 box hanging from y = 100: scaleY about its bottom edge (y = 160).
    const at = (atMs: number, k: number) => {
      const box = { x: 100, y: 160 - 60 * k, width: 300, height: 60 * k };
      return { atMs, present: 1, box, dom: { box, opacity: 1, scale: k, scaleX: 1, scaleY: k } };
    };
    const samples = [at(300, 0.2), at(330, 0.5), at(360, 0.8), at(390, 1), at(700, 1)];
    const r = judgeMotionPath(samples, { startMs: 300, endMs: 400, expectOrigin: "top" });
    expect(r.segments[0]!.origin).toMatchObject({ fx: null, name: "bottom" });
    expect(r.findings.map((f) => f.message)).toEqual([
      expect.stringMatching(/grows from its bottom edge .*not its top edge/),
    ]);
    // "bottom-left" asks the bottom edge along y; across, it does not scale, so nothing to check.
    expect(judgeMotionPath(samples, { startMs: 300, endMs: 400, expectOrigin: "bottom-left" }).findings).toEqual([]);
  });
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
    // Opacity and scale ride the same keyframes: both read ease-in, both fail ease-out.
    expect(f.findings.map((x) => x.rule)).toEqual(["easing-mismatch", "easing-mismatch"]);
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
        dom: { box: box(900, y), opacity: easingAt("ease-out", t), scale: 1, t },
      };
    });
    const r = judgeMotionPath(s, { startMs: 0, endMs: 640, expectEasing: "ease-out" });
    expect(r.findings).toEqual([]);
    // Measured, the travel is the whole 24px, including the frames before it can be seen.
    expect(Math.round(r.travelPx)).toBe(24);
  });

  it("with the element measured, a 'shown' boxed on another element is unknown, and not rendered is not shown", () => {
    // The third card starts at 240ms; at 128ms the model says shown but boxes the first card.
    const times = [0, 64, 128, 192, 256, 320, 384, 448, 512, 576, 639, 940];
    const s = times.map((at) => {
      const t = Math.min(1, Math.max(0, (at - 240) / 400));
      const y = 200 + 24 * (1 - easingAt("ease-out", t));
      const elsewhere = at === 128 || at === 448;
      return {
        atMs: at,
        present: elsewhere ? 0.7 : t > 0.2 ? 0.9 : 0.02,
        box: elsewhere ? box(100, 200) : box(900, y),
        dom: { box: box(900, y), opacity: easingAt("ease-out", t), scale: 1, t },
      };
    });
    // 128ms: not rendered yet (opacity 0), so not shown, and no "lost" in its delay. 448ms:
    // rendered, but the box is elsewhere — unknown, a warn, never a target-lost.
    const r = judgeMotionPath(s, { startMs: 0, endMs: 640, expectEasing: "ease-out" });
    expect(r.findings.map((f) => [f.rule, f.atMs])).toEqual([["locate-unsure", 448]]);
  });

  it("fits a segment that is part of one animation on the animation's own time, rescaled", () => {
    // One 3300ms animation; the entrance is 0-15% of its own time, eased ease-out within it.
    const times = [...Array.from({ length: 10 }, (_, i) => i * 49.5), 494];
    const s = times.map((at) => {
      const own = at / 3300;
      const x = 600 - 360 * easingAt("ease-out", Math.min(1, own / 0.15));
      return { atMs: at, present: 0.9, box: box(x), dom: { box: box(x), opacity: 1, scale: 1, t: own } };
    });
    const r = judgeMotionPath(s, { startMs: 0, endMs: 495, expectEasing: "ease-out" });
    expect(r.findings).toEqual([]);
  });
});

describe("what motion-repair round 1 passed", () => {
  // Measured samples: the page says where it is and how much of it is topmost (`present`).
  const measured = (atMs: number, x: number, visible: number, hiddenBy?: string): MotionSample => ({
    atMs,
    present: visible,
    box: box(x),
    dom: { box: box(x), opacity: 1, scale: 1, ...(hiddenBy ? { hiddenBy } : {}) },
  });

  it("fails a target never seen in any frame, says why, and fits nothing to it", () => {
    const why = "clipped by header.topbar (overflow: hidden), which it lies outside of";
    const r = judgeMotionPath(
      times.map((t) => measured(t, 100 + t / 10, 0, why)),
      { startMs: 0, endMs: 900 },
    );
    assert.deepEqual(
      r.findings.map((f) => f.rule),
      ["target-hidden"],
    );
    assert.match(r.findings[0]!.message, /clipped by header\.topbar/);
    assert.ok("skipped" in r.easing, "no easing for an element nobody saw");
  });

  it("counts a measured target off-screen between frames that show it as lost, not as leaving", () => {
    // A toast in over 0-300ms, snapped back off-screen during the hold, brought back at 2000ms.
    const at = [0, 100, 200, 299, 800, 1300, 1800, 2000, 2100, 2299, 2600];
    const x = (t: number) => (t < 300 ? 1300 - t * 1.3 : t < 2000 ? 1300 : 910);
    const samples = at.map((t) =>
      measured(t, x(t), x(t) >= 1280 ? 0 : 1, x(t) >= 1280 ? "its box is outside the viewport" : undefined),
    );
    const r = judgeMotionPath(samples, {
      startMs: 0,
      endMs: 2300,
      segments: [
        { startMs: 0, endMs: 300 },
        { startMs: 2000, endMs: 2300 },
      ],
      frame: { width: 1280, height: 800 },
      exits: true,
    });
    const found = new Set(r.findings.map((f) => f.rule));
    assert.ok(found.has("target-lost"), JSON.stringify(r.findings));
    assert.ok(found.has("snap-back"), "the hold frames are back where the entrance began");
  });
});
