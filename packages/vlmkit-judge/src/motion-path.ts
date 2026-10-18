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
 * A page's motion is judged per segment — each span of page time some animation runs in (an
 * entrance, then after a hold an exit): an easing is fitted, and jumps looked for, inside one
 * segment, never across a hold. Easings are the CSS curves (`cubic-bezier` solved for x,
 * `steps(4, end)`), fitted to positions at each sample's time fraction of its segment.
 *
 * A box at the frame's edge is the visible part of a target entering or leaving the viewport: its
 * centre is put back from the far edge and the target's own size, and a faint answer on such a
 * frame is not "lost".
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
  /**
   * The element itself, measured by the page (its border box, the opacity it renders with, the
   * scale of its transform). When every sample has it, geometry comes from here — exact, never
   * another element's — and `present` only says whether a person can see it. `t` is the
   * element's own animation time (0-1, its delay and duration): with it the easing is fitted on
   * that, so staggered siblings in one segment each read their own curve.
   */
  dom?: { box: MotionBox; opacity: number; scale: number; t?: number | null };
  /** The box may be another element's (it coincides with another target's): left out of geometry. */
  unsure?: boolean;
}

export interface MotionSegment {
  startMs: number;
  endMs: number;
}

export interface MotionPathOptions {
  /** The motion runs over [startMs, endMs] of page time; samples past `endMs` are the rest. */
  startMs: number;
  endMs: number;
  /** Spans some animation runs in, in order (default: one, startMs..endMs). */
  segments?: readonly MotionSegment[];
  /** The frames' size: a box touching its edge is a target partly outside the viewport. */
  frame?: { width: number; height: number };
  presenceThreshold?: number;
  /**
   * Geometry (jumps, the easing, snap-back) is read only from frames shown at least this surely
   * (default 0.8): a faint frame of a fade gets a box 40px off, measured.
   */
  surePresence?: number;
  /**
   * The timing function the author meant — one for every segment, or one per segment in order.
   * Without it the fit is reported, never failed.
   */
  expectEasing?: EasingName | readonly EasingName[];
  /** A step this long (px) at least can be a jump (default 24: a single look's edge error is ~12px). */
  jumpFloorPx?: number;
  /** …and it must exceed its larger neighbour step by this factor (default 3). */
  jumpRatio?: number;
  /** The target is meant to leave (a dismissed toast): gone at rest is then its end state. */
  exits?: boolean;
  /** Below this travel (px) a segment is too short to fit an easing to (default 60). */
  minFitTravelPx?: number;
}

export type MotionRule =
  | "target-lost"
  | "absent-at-rest"
  | "snap-back"
  | "jump"
  | "easing-mismatch"
  | "easing-unchecked"
  | "target-static"
  | "locate-unsure";

export interface MotionFinding {
  rule: MotionRule;
  severity: "fail" | "warn";
  /** The frame it is seen in (for a jump, the frame it lands in). */
  atMs: number;
  message: string;
}

/** What an easing was fitted to: the path, or with the element measured, its opacity or scale. */
export type EasingChannel = "position" | "opacity" | "scale";

export type SegmentEasing =
  | (EasingFit & { expected?: EasingName; channel?: EasingChannel })
  | { skipped: string; expected?: EasingName };

export interface MotionPathReport {
  findings: MotionFinding[];
  /** Positions of the frames the target is shown in, motion and rest; `edge` = put back from a clipped box. */
  path: { atMs: number; x: number; y: number; rest: boolean; edge: boolean }[];
  /** Per segment: its span, how far the target travels in it, the fit or why there is none. */
  segments: (MotionSegment & { travelPx: number; easing: SegmentEasing })[];
  /** The first segment's travel and fit (the whole motion when there is one segment). */
  travelPx: number;
  easing: SegmentEasing;
}

const dist = (a: { x: number; y: number }, b: { x: number; y: number }) => Math.hypot(a.x - b.x, a.y - b.y);
const ms = (t: number) => `${Math.round(t)}ms`;
const median = (xs: number[]) => {
  const s = [...xs].sort((a, b) => a - b);
  return s.length === 0 ? NaN : s[s.length >> 1]!;
};

export function judgeMotionPath(samples: readonly MotionSample[], options: MotionPathOptions): MotionPathReport {
  const thr = options.presenceThreshold ?? 0.5;
  const sure = options.surePresence ?? Math.max(thr, 0.8);
  // Measured by the page, positions are exact: the floors are a model's error otherwise.
  const exact = samples.length > 0 && samples.every((x) => x.dom !== undefined);
  const floor = options.jumpFloorPx ?? (exact ? 6 : 24);
  const ratio = options.jumpRatio ?? 3;
  const minTravel = options.minFitTravelPx ?? (exact ? 6 : 60);
  const segments = options.segments?.length
    ? [...options.segments]
    : [{ startMs: options.startMs, endMs: options.endMs }];
  const expectFor = (k: number): EasingName | undefined =>
    typeof options.expectEasing === "string" ? options.expectEasing : options.expectEasing?.[k];
  const sorted = [...samples].sort((a, b) => a.atMs - b.atMs);
  const isRest = (s: MotionSample) => s.atMs > options.endMs;
  // What a frame says about being seen. Measured by the page, a target that is not rendered
  // (opacity under 0.05) is not seen whatever the model says, and a "shown" whose box misses the
  // element was about another element: unknown (null), not evidence either way. A model's box
  // another target shares is unknown too.
  const overlaps = (a: MotionBox, b: MotionBox) =>
    a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height;
  const seen = (s: MotionSample): number | null => {
    if (s.dom) {
      if (s.dom.opacity < 0.05) return 0;
      if (s.box && s.present >= thr && !overlaps(s.box, s.dom.box)) return null;
      return s.present;
    }
    return s.unsure ? null : s.present;
  };
  const shown = (s: MotionSample) => (seen(s) ?? 0) >= thr && s.box !== null;
  const findings: MotionFinding[] = [];

  // Which sides of the frame a box touches: the target is partly outside the viewport there.
  // Within 1.25% of an edge: a model's box edges come in 1% steps, so a box cut at x = 1280 can
  // come back at 1267.
  const sides = (b: MotionBox | null) => {
    const f = options.frame;
    if (!b || !f) return { l: false, r: false, t: false, b: false };
    const ex = Math.max(2, f.width * 0.0125);
    const ey = Math.max(2, f.height * 0.0125);
    return { l: b.x <= ex, r: b.x + b.width >= f.width - ex, t: b.y <= ey, b: b.y + b.height >= f.height - ey };
  };
  const atEdge = (s: MotionSample) => {
    const e = sides(s.box);
    return e.l || e.r || e.t || e.b;
  };
  // The target's own size, from frames that surely show all of it.
  const whole = sorted.filter((s) => s.present >= sure && s.box && !atEdge(s));
  const fullW = median(whole.map((s) => s.box!.width));
  const fullH = median(whole.map((s) => s.box!.height));
  const position = (s: MotionSample) => {
    if (s.dom) return { x: s.dom.box.x + s.dom.box.width / 2, y: s.dom.box.y + s.dom.box.height / 2 };
    const b = s.box!;
    const e = sides(b);
    let x = b.x + b.width / 2;
    let y = b.y + b.height / 2;
    if (Number.isFinite(fullW) && e.l !== e.r) x = e.r ? b.x + fullW / 2 : b.x + b.width - fullW / 2;
    if (Number.isFinite(fullH) && e.t !== e.b) y = e.b ? b.y + fullH / 2 : b.y + b.height - fullH / 2;
    return { x, y };
  };

  const path = sorted.filter(shown).map((s) => ({ atMs: s.atMs, ...position(s), rest: isRest(s), edge: atEdge(s) }));
  const motion = path.filter((p) => !p.rest);

  // Presence: absent between two frames that show it, or gone once it stops. A faint frame whose
  // box is at the viewport's edge is the target coming in or going out, not lost.
  const judged = sorted.filter((s) => seen(s) !== null);
  const firstShown = judged.findIndex(shown);
  const lastShown = judged.length - 1 - [...judged].reverse().findIndex(shown);
  if (firstShown >= 0) {
    for (let i = firstShown + 1; i < lastShown; i++) {
      const s = judged[i]!;
      if (!shown(s) && !atEdge(s)) {
        const before = [...judged.slice(0, i)].reverse().find(shown)!;
        const after = judged.slice(i + 1).find(shown)!;
        findings.push({
          rule: "target-lost",
          severity: "fail",
          atMs: s.atMs,
          message: `not shown at ${ms(s.atMs)} (presence ${s.present.toFixed(2)}) though ${ms(before.atMs)} and ${ms(after.atMs)} show it: clipped, covered or hidden mid-motion — if it is not on screen yet at ${ms(before.atMs)}, that frame's reading is the wrong one; look at both`,
        });
      }
    }
    const restSamples = judged.filter(isRest);
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

  // Geometry: measured, every frame it is rendered in; from a model, the frames that surely show
  // it, edge frames put back whole, and never a box that may be another element's.
  const surely = new Set(
    sorted
      .filter((s) =>
        s.dom
          ? s.dom.opacity >= 0.05
          : s.box !== null &&
            !s.unsure &&
            (s.present >= sure || (atEdge(s) && s.present >= thr && Number.isFinite(fullW))),
      )
      .map((s) => s.atMs),
  );
  const point = (s: MotionSample) => ({ atMs: s.atMs, ...position(s), rest: isRest(s), edge: !s.dom && atEdge(s) });
  const all = sorted.filter((s) => surely.has(s.atMs)).map(point);
  let geo = all.filter((p) => !p.rest);
  const geoRest = all.filter((p) => p.rest);

  // A model's box that lands far off and is back the next frame is another element's, not a jump.
  const unsureAt = sorted.filter((s) => seen(s) === null).map((s) => s.atMs);
  if (!exact) {
    const out = new Set<number>();
    for (let k = 1; k < geo.length - 1; k++) {
      const [a, b, c] = [geo[k - 1]!, geo[k]!, geo[k + 1]!];
      const away = Math.min(dist(a, b), dist(b, c));
      if (away >= 3 * floor && dist(a, c) < Math.max(floor, away / 3)) out.add(b.atMs);
    }
    if (out.size > 0) {
      geo = geo.filter((p) => !out.has(p.atMs));
      unsureAt.push(...out);
    }
  }
  if (unsureAt.length > 0) {
    findings.push({
      rule: "locate-unsure",
      severity: "warn",
      atMs: Math.min(...unsureAt),
      message: exact
        ? `at ${[...new Set(unsureAt)]
            .sort((a, b) => a - b)
            .map(ms)
            .join(
              ", ",
            )} the model's "shown" was boxed off the element, so whether it can be seen there is unknown (its position is still measured): describe it by what only it shows (its label and value)`
        : `at ${[...new Set(unsureAt)]
            .sort((a, b) => a - b)
            .map(ms)
            .join(
              ", ",
            )} the box is likely another element's (far off and back, or on another target), so those frames are not measured: describe the target by what only it shows, or pass --selector`,
    });
  }

  // A sample's time fraction: the element's own animation time when measured, else its segment's.
  const timeOf = (atMs: number, seg: MotionSegment) => {
    const own = sorted.find((x) => x.atMs === atMs)?.dom?.t;
    if (typeof own === "number") return own;
    return Math.min(1, Math.max(0, (atMs - seg.startMs) / Math.max(seg.endMs - seg.startMs, 1)));
  };

  const reports: MotionPathReport["segments"] = segments.map((seg, k) => {
    const expected = expectFor(k);
    const last = k === segments.length - 1;
    const frames = geo.filter((p) => p.atMs >= seg.startMs && p.atMs <= seg.endMs);
    const travelPx = frames.length >= 2 ? dist(frames[0]!, frames[frames.length - 1]!) : 0;
    const tag = segments.length > 1 ? ` in ${ms(seg.startMs)}..${ms(seg.endMs)}` : "";
    let easing: SegmentEasing;
    // Measured, a fade or a scale has an easing too: fit the channel that changes.
    const channel = (key: "opacity" | "scale", least: number) => {
      const xs = sorted.filter((x) => x.dom && x.atMs >= seg.startMs && x.atMs <= seg.endMs);
      if (xs.length < 4) return null;
      const v = xs.map((x) => x.dom![key]);
      const delta = v[v.length - 1]! - v[0]!;
      if (Math.abs(delta) < least) return null;
      return xs.map((x, i) => ({ t: timeOf(x.atMs, seg), s: Math.sign(delta) * v[i]! }));
    };
    const opacityPoints = exact && travelPx < minTravel ? channel("opacity", 0.2) : null;
    const fade = opacityPoints ?? (exact && travelPx < minTravel ? channel("scale", 0.02) : null);
    const fadeName: EasingChannel = opacityPoints ? "opacity" : "scale";
    if (fade) {
      const fit = fitEasingAffine(fade);
      easing = { ...fit, channel: fadeName };
      if (expected && fit.best !== expected) {
        findings.push({
          rule: "easing-mismatch",
          severity: "fail",
          atMs: seg.startMs,
          message: `the ${fadeName}${tag} follows ${fit.best} (it fits ${fit.margin.toFixed(1)}x better than the next-best curve), not ${expected}`,
        });
      }
    } else if (frames.length < 4) easing = { skipped: "fewer than 4 frames surely show the target" };
    else if (travelPx < minTravel)
      easing = { skipped: `travel ${Math.round(travelPx)}px is under ${minTravel}px: too short to fit` };
    else {
      const a = frames[0]!;
      // Where it rests is the held final keyframe — unless it rests back near the start (a
      // snap-back, judged below).
      const r = last ? geoRest[0] : undefined;
      const restHeld = r !== undefined && dist(r, a) > Math.max(floor, travelPx * 0.25);
      const z = restHeld ? r! : frames[frames.length - 1]!;
      const d = { x: z.x - a.x, y: z.y - a.y };
      const len = Math.max(Math.hypot(d.x, d.y), 1e-9);
      const points = frames.map((p) => ({
        t: timeOf(p.atMs, seg),
        s: ((p.x - a.x) * d.x + (p.y - a.y) * d.y) / len,
      }));
      if (restHeld) points.push({ t: 1, s: ((r!.x - a.x) * d.x + (r!.y - a.y) * d.y) / len });
      const fit = fitEasingAffine(points);
      easing = { ...fit, channel: "position" };
      if (expected && fit.best !== expected) {
        // A box around the part that is not covered moves differently from the element: when
        // frames inside the segment show it not at all, say so beside the mismatch.
        const hidden = exact
          ? 0
          : sorted.filter(
              (x) => x.atMs >= seg.startMs && x.atMs <= seg.endMs && x.present < thr && x.atMs > (frames[0]?.atMs ?? 0),
            ).length;
        findings.push({
          rule: "easing-mismatch",
          severity: "fail",
          atMs: seg.startMs,
          message: `the path${tag} follows ${fit.best} (it fits ${fit.margin.toFixed(1)}x better than the next-best curve), not ${expected}${hidden > 0 ? `; in ${hidden} frame(s) there it is not seen at all — if something covers it, fix that first and re-check` : ""}`,
        });
      }
    }
    if (expected) easing = { ...easing, expected };
    if (expected && "skipped" in easing && motion.length > 0) {
      findings.push({
        rule: "easing-unchecked",
        severity: "warn",
        atMs: seg.startMs,
        message: `${expected} was expected${tag} but not checked: ${easing.skipped}${exact ? "" : ` (only frames shown at ${sure} or more, or put back from the viewport's edge, are measured; --selector measures the element itself)`}`,
      });
    }

    // Jumps inside the segment, unless it is meant to step. Compared as speeds, so frames the
    // target was missing from do not read as a jump.
    const stepping = ("best" in easing && easing.best === "steps") || expected === "steps";
    if (!stepping) {
      const steps = frames.slice(1).map((p, i) => ({
        px: dist(p, frames[i]!),
        speed: dist(p, frames[i]!) / Math.max(p.atMs - frames[i]!.atMs, 1),
      }));
      steps.forEach((st, i) => {
        const neighbours = [steps[i - 1], steps[i + 1]].filter((x) => x !== undefined);
        if (neighbours.length === 0) return;
        const local = Math.max(...neighbours.map((n) => n.speed));
        const times = st.speed / Math.max(local, 1e-3);
        if (st.px >= floor && times > ratio) {
          findings.push({
            rule: "jump",
            severity: "fail",
            atMs: frames[i + 1]!.atMs,
            message: `moves ${Math.round(st.px)}px between ${ms(frames[i]!.atMs)} and ${ms(frames[i + 1]!.atMs)}, ${times.toFixed(1)}x as fast as the steps around it: a discontinuity in the keyframes`,
          });
        }
      });
    }
    return { ...seg, travelPx, easing };
  });

  // Once it stops: back where it began, or a jump off the last motion frame.
  const lastExpected = expectFor(segments.length - 1);
  const lastEasing = reports[reports.length - 1]!.easing;
  const lastSteps = ("best" in lastEasing && lastEasing.best === "steps") || lastExpected === "steps";
  if (geoRest.length > 0 && geo.length >= 2) {
    const last = geo[geo.length - 1]!;
    const r = geoRest[0]!;
    const off = dist(r, last);
    const travel = Math.max(...reports.map((x) => x.travelPx), dist(geo[0]!, last));
    // steps(…, end) takes its last step at the end itself.
    if (off >= floor && !lastSteps) {
      const backHome = travel >= floor && dist(r, geo[0]!) <= Math.max(floor, travel * 0.25);
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

  // Shown surely from the first frame, never hidden, never moving: nothing about it animates.
  const firstMotion = sorted.find((s) => !isRest(s));
  if (
    firstMotion &&
    firstMotion.present >= sure &&
    sorted.every((s) => shown(s)) &&
    geo.length >= 2 &&
    Math.max(...geo.map((p) => dist(p, geo[0]!))) < floor &&
    !(
      exact &&
      sorted.some(
        (x) =>
          Math.abs(x.dom!.opacity - sorted[0]!.dom!.opacity) > 0.05 ||
          Math.abs(x.dom!.scale - sorted[0]!.dom!.scale) > 0.01,
      )
    )
  ) {
    findings.push({
      rule: "target-static",
      severity: "warn",
      atMs: firstMotion.atMs,
      message: `fully shown from ${ms(firstMotion.atMs)} and moves under ${floor}px in every frame: if it is meant to animate, its animation is not applying (a dropped rule, a misspelt animation-name)`,
    });
  }

  findings.sort((a, b) => a.atMs - b.atMs);
  const first = reports.find((x) => "best" in x.easing) ?? reports[0]!;
  return { findings, path, segments: reports, travelPx: first.travelPx, easing: first.easing };
}
