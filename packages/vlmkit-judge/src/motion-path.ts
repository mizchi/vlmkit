/**
 * What a sampled motion path says about an animation: where a target was at each instant, and
 * whether it was there at all, judged with no browser and no model.
 *
 * The samples come from anywhere: a model's `box` and presence per frame (`inspect motion`), the
 * DOM's rects, a tracker. The judge only reads centres, presence and times:
 *
 *   target-lost      absent in a frame between frames that show it (clipped, covered, faded out
 *                    and back), measured on presence, not on the box
 *   absent-at-rest   shown during the motion, gone once it stops: clipped, covered or faded out
 *                    for good (an exit the author meant is declared with `exits`)
 *   snap-back        once it stops, back near where it started after travelling: the final
 *                    keyframe is not held (`animation-fill-mode` missing)
 *   jump             one step between consecutive frames far larger than its neighbours: a
 *                    keyframe discontinuity; suppressed when the path fits `steps()`
 *   easing-mismatch  the path fits another timing function than the one expected
 *
 * Easings are the CSS curves (`cubic-bezier` solved for x, `steps(4, end)`), fitted on progress
 * along the start → end line at each sample's time fraction.
 */

export const EASINGS = {
  linear: "linear",
  ease: "ease",
  "ease-in": "ease-in",
  "ease-out": "ease-out",
  "ease-in-out": "ease-in-out",
  steps: "steps(4, end)",
  overshoot: "cubic-bezier(0.34, 1.56, 0.64, 1)",
} as const;
export type EasingName = keyof typeof EASINGS;
export const EASING_NAMES = Object.keys(EASINGS) as EasingName[];

const BEZIER: Partial<Record<EasingName, [number, number, number, number]>> = {
  linear: [0, 0, 1, 1],
  ease: [0.25, 0.1, 0.25, 1],
  "ease-in": [0.42, 0, 1, 1],
  "ease-out": [0, 0, 0.58, 1],
  "ease-in-out": [0.42, 0, 0.58, 1],
  overshoot: [0.34, 1.56, 0.64, 1],
};

/** y at x on the cubic Bézier through (0,0), (x1,y1), (x2,y2), (1,1), x solved by bisection. */
export function cubicBezier(x1: number, y1: number, x2: number, y2: number, x: number): number {
  const at = (a: number, b: number, t: number) => 3 * a * t * (1 - t) ** 2 + 3 * b * t * t * (1 - t) + t ** 3;
  let lo = 0;
  let hi = 1;
  for (let i = 0; i < 60; i++) {
    const mid = (lo + hi) / 2;
    if (at(x1, x2, mid) < x) lo = mid;
    else hi = mid;
  }
  return at(y1, y2, (lo + hi) / 2);
}

/** Progress (0 at the start, 1 at the end) of a named easing at time fraction t. */
export function easingAt(name: EasingName, t: number): number {
  if (name === "steps") return t >= 1 ? 1 : Math.floor(t * 4 + 1e-9) / 4;
  const b = BEZIER[name]!;
  return cubicBezier(b[0], b[1], b[2], b[3], t);
}

export interface EasingFit {
  best: EasingName;
  /** Sum of squared progress errors per candidate. */
  errors: Record<EasingName, number>;
  /** Runner-up's error over the best's: how far ahead the best is (≥ 1). */
  margin: number;
}

/** The easing a progress curve follows: `{t, p}` with t the time fraction and p the progress, both 0-1. */
export function fitEasingCurve(points: readonly { t: number; p: number }[]): EasingFit {
  const errors = Object.fromEntries(
    EASING_NAMES.map((e) => [e, points.reduce((s, { t, p }) => s + (p - easingAt(e, t)) ** 2, 0)]),
  ) as Record<EasingName, number>;
  const ranked = [...EASING_NAMES].sort((a, b) => errors[a] - errors[b]);
  const best = ranked[0]!;
  return { best, errors, margin: errors[ranked[1]!] / Math.max(errors[best], 1e-9) };
}

/** `fitEasingCurve` over positions at evenly spaced times, normalised by the first and last. */
export function fitEasing(positions: readonly number[]): EasingFit {
  const n = positions.length - 1;
  const span = positions[n]! - positions[0]!;
  return fitEasingCurve(positions.map((v, i) => ({ t: i / n, p: span === 0 ? 0 : (v - positions[0]!) / span })));
}

/**
 * The easing positions follow when neither the start nor the travel is known: for each candidate,
 * `s = a + b · easing(t)` by least squares, its residual measured in progress (divided by b²).
 * Frames left out at either end (a fade's faint first frames) do not shift it, as normalising by
 * the first and last frame would.
 */
export function fitEasingAffine(points: readonly { t: number; s: number }[]): EasingFit {
  const errors = Object.fromEntries(
    EASING_NAMES.map((e) => {
      const xs = points.map((p) => easingAt(e, p.t));
      const n = points.length;
      const mx = xs.reduce((a, b) => a + b, 0) / n;
      const ms = points.reduce((a, p) => a + p.s, 0) / n;
      const sxx = xs.reduce((a, x) => a + (x - mx) ** 2, 0);
      const sxy = xs.reduce((a, x, i) => a + (x - mx) * (points[i]!.s - ms), 0);
      if (sxx < 1e-12) return [e, Infinity];
      const b = sxy / sxx;
      if (b <= 0) return [e, Infinity];
      const a = ms - b * mx;
      const sse = points.reduce((acc, p, i) => acc + (p.s - (a + b * xs[i]!)) ** 2, 0);
      return [e, sse / (b * b)];
    }),
  ) as Record<EasingName, number>;
  const ranked = [...EASING_NAMES].sort((a, b) => errors[a] - errors[b]);
  const best = ranked[0]!;
  return { best, errors, margin: errors[ranked[1]!] / Math.max(errors[best], 1e-9) };
}

export interface MotionBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface MotionSample {
  /** Page time of the frame. */
  atMs: number;
  /** Probability the target is shown (0-1), or 1/0 from a source that knows. */
  present: number;
  /** Where the target is, in the frame's pixels; ignored when it is not present. */
  box: MotionBox | null;
}

export interface MotionPathOptions {
  /** The motion runs over [startMs, endMs] of page time; samples past `endMs` are the rest. */
  startMs: number;
  endMs: number;
  presenceThreshold?: number;
  /**
   * Geometry (jumps, the easing, snap-back) is read only from frames shown at least this surely
   * (default 0.8): a faint frame of a fade gets a box 40px off, measured.
   */
  surePresence?: number;
  /** The timing function the author meant. Without it the fit is reported, never failed. */
  expectEasing?: EasingName;
  /** A step this long (px) at least can be a jump (default 24: a single look's edge error is ~12px). */
  jumpFloorPx?: number;
  /** …and it must exceed its larger neighbour step by this factor (default 3). */
  jumpRatio?: number;
  /** The target is meant to leave (a dismissed toast): gone at rest is then its end state. */
  exits?: boolean;
  /** Below this travel (px) the path is too short to fit an easing to (default 60). */
  minFitTravelPx?: number;
}

export type MotionRule = "target-lost" | "absent-at-rest" | "snap-back" | "jump" | "easing-mismatch";

export interface MotionFinding {
  rule: MotionRule;
  severity: "fail" | "warn";
  /** The frame it is seen in (for a jump, the frame it lands in). */
  atMs: number;
  message: string;
}

export interface MotionPathReport {
  findings: MotionFinding[];
  /** Centres of the frames the target is present in, motion and rest. */
  path: { atMs: number; x: number; y: number; rest: boolean }[];
  /** Distance from the first present motion frame to the last, px. */
  travelPx: number;
  /** The fit, or why there is none. */
  easing: (EasingFit & { expected?: EasingName }) | { skipped: string };
}

const centre = (b: MotionBox) => ({ x: b.x + b.width / 2, y: b.y + b.height / 2 });
const dist = (a: { x: number; y: number }, b: { x: number; y: number }) => Math.hypot(a.x - b.x, a.y - b.y);
const ms = (t: number) => `${Math.round(t)}ms`;

export function judgeMotionPath(samples: readonly MotionSample[], options: MotionPathOptions): MotionPathReport {
  const thr = options.presenceThreshold ?? 0.5;
  const floor = options.jumpFloorPx ?? 24;
  const ratio = options.jumpRatio ?? 3;
  const minTravel = options.minFitTravelPx ?? 60;
  const sorted = [...samples].sort((a, b) => a.atMs - b.atMs);
  const isRest = (s: MotionSample) => s.atMs > options.endMs;
  const shown = (s: MotionSample) => s.present >= thr && s.box !== null;
  const findings: MotionFinding[] = [];

  const path = sorted.filter(shown).map((s) => ({ atMs: s.atMs, ...centre(s.box!), rest: isRest(s) }));
  const motion = path.filter((p) => !p.rest);
  const rest = path.filter((p) => p.rest);

  // Presence: absent between two frames that show it, or gone once it stops.
  const firstShown = sorted.findIndex(shown);
  const lastShown = sorted.length - 1 - [...sorted].reverse().findIndex(shown);
  if (firstShown >= 0) {
    for (let i = firstShown + 1; i < lastShown; i++) {
      const s = sorted[i]!;
      if (!shown(s)) {
        findings.push({
          rule: "target-lost",
          severity: "fail",
          atMs: s.atMs,
          message: `not shown at ${ms(s.atMs)} (presence ${s.present.toFixed(2)}) between frames that show it: clipped, covered or hidden mid-motion`,
        });
      }
    }
    const restSamples = sorted.filter(isRest);
    const goneAtRest = restSamples.length > 0 && restSamples.every((s) => !shown(s));
    if (goneAtRest && motion.length > 0 && !options.exits) {
      findings.push({
        rule: "absent-at-rest",
        severity: "fail",
        atMs: restSamples[0]!.atMs,
        message: `shown during the motion, not once it stops (presence ${restSamples[0]!.present.toFixed(2)} at ${ms(restSamples[0]!.atMs)}): clipped, covered or hidden in its end state (an exit is declared with exits)`,
      });
    }
  }

  // Geometry from the frames the target is surely shown in.
  const sure = options.surePresence ?? Math.max(thr, 0.8);
  const surely = new Set(sorted.filter((s) => s.present >= sure && s.box !== null).map((s) => s.atMs));
  const geo = motion.filter((p) => surely.has(p.atMs));
  const geoRest = rest.filter((p) => surely.has(p.atMs));

  const travelPx = geo.length >= 2 ? dist(geo[0]!, geo[geo.length - 1]!) : 0;
  let easing: MotionPathReport["easing"] = { skipped: "fewer than 4 motion frames surely show the target" };
  if (geo.length >= 4 && travelPx < minTravel) {
    easing = { skipped: `travel ${Math.round(travelPx)}px is under ${minTravel}px: too short to fit` };
  } else if (geo.length >= 4) {
    const a = geo[0]!;
    const lastMotion = geo[geo.length - 1]!;
    // Where it rests is the held final keyframe, progress 1 — unless it rests back near the start
    // (a snap-back, judged below).
    const r = geoRest[0];
    const restHeld = r !== undefined && dist(r, a) > Math.max(floor, travelPx * 0.25);
    const z = restHeld ? r! : lastMotion;
    const d = { x: z.x - a.x, y: z.y - a.y };
    const len = Math.max(Math.hypot(d.x, d.y), 1e-9);
    const span = options.endMs - options.startMs;
    const points = geo.map((p) => ({
      t: Math.min(1, Math.max(0, (p.atMs - options.startMs) / span)),
      s: ((p.x - a.x) * d.x + (p.y - a.y) * d.y) / len,
    }));
    if (restHeld) points.push({ t: 1, s: ((r!.x - a.x) * d.x + (r!.y - a.y) * d.y) / len });
    const fit = fitEasingAffine(points);
    easing = { ...fit, ...(options.expectEasing ? { expected: options.expectEasing } : {}) };
    if (options.expectEasing && fit.best !== options.expectEasing) {
      findings.push({
        rule: "easing-mismatch",
        severity: "fail",
        atMs: options.startMs,
        message: `the path follows ${fit.best} (${fit.margin.toFixed(1)}x ahead of the next), not ${options.expectEasing}`,
      });
    }
  }

  // Jumps inside the motion, unless it is meant to step.
  const stepping = "best" in easing && (easing.best === "steps" || options.expectEasing === "steps");
  if (!stepping) {
    // Compared as speeds, so frames the target was missing from do not read as a jump.
    const steps = geo.slice(1).map((p, i) => ({
      px: dist(p, geo[i]!),
      speed: dist(p, geo[i]!) / Math.max(p.atMs - geo[i]!.atMs, 1),
    }));
    steps.forEach((s, i) => {
      const neighbours = [steps[i - 1], steps[i + 1]].filter((x) => x !== undefined);
      if (neighbours.length === 0) return;
      const local = Math.max(...neighbours.map((n) => n.speed));
      const times = s.speed / Math.max(local, 1e-3);
      if (s.px >= floor && times > ratio) {
        findings.push({
          rule: "jump",
          severity: "fail",
          atMs: geo[i + 1]!.atMs,
          message: `moves ${Math.round(s.px)}px between ${ms(geo[i]!.atMs)} and ${ms(geo[i + 1]!.atMs)}, ${times.toFixed(1)}x as fast as the steps around it: a discontinuity in the keyframes`,
        });
      }
    });
  }

  // Once it stops: back where it began, or a jump off the last motion frame.
  if (geoRest.length > 0 && geo.length >= 2) {
    const last = geo[geo.length - 1]!;
    const r = geoRest[0]!;
    const off = dist(r, last);
    // steps(…, end) takes its last step at the end itself.
    if (off >= floor && !stepping) {
      const backHome = travelPx >= floor && dist(r, geo[0]!) <= Math.max(floor, travelPx * 0.25);
      findings.push(
        backHome
          ? {
              rule: "snap-back",
              severity: "fail",
              atMs: r.atMs,
              message: `ends near where it started (${Math.round(dist(r, geo[0]!))}px from it, ${Math.round(off)}px from the last motion frame): the final keyframe is not held — add animation-fill-mode: forwards (or both), or give the element its end state`,
            }
          : {
              rule: "jump",
              severity: "fail",
              atMs: r.atMs,
              message: `jumps ${Math.round(off)}px when the motion ends (${ms(last.atMs)} → ${ms(r.atMs)}): the end state differs from the last keyframe`,
            },
      );
    }
  }

  findings.sort((a, b) => a.atMs - b.atMs);
  return { findings, path, travelPx, easing };
}
