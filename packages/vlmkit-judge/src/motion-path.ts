/**
 * What a sampled motion path says about an animation: where a target was at each instant, and
 * whether it was there at all, judged with no browser and no model.
 *
 * The samples come from anywhere: a model's `box` and presence per frame (`inspect motion`), the
 * DOM's rects, a tracker. The judge only reads centres, presence and times:
 *
 *   target-lost      absent in a frame between frames that show it (clipped, covered, faded out
 *                    and back), measured on presence, not on the box
 *   target-hidden    shown in no frame at all, rest included: clipped or covered from the start
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
  dom?: {
    box: MotionBox;
    opacity: number;
    scale: number;
    t?: number | null;
    /** What keeps it from being seen, when the page could tell: "clipped by …", "covered by …". */
    hiddenBy?: string;
    /** Turned in 3D (its box is the turned shape's bounds); within 15° of edge-on; facing away
     * with its back face drawn (so it shows mirrored). */
    rotated3d?: boolean;
    edgeOn?: boolean;
    facingAway?: boolean;
    /** How far it is turned (degrees): from its normal in 3D, or its 2D rotation. */
    turnDeg?: number;
    mirrored?: boolean;
    /**
     * How long its own animation has been in its active phase (ms; negative in its delay). The
     * frame's time less this is when that animation begins: what a stagger is made of.
     */
    elapsedMs?: number | null;
    /** Share of its box where it is the topmost thing painted, measured by the page (0-1). */
    visible?: number;
    /** One run of its own longest animation (ms), and how many runs (null: infinite). */
    durationMs?: number;
    iterations?: number | null;
    /** Each axis's scale, when it differs: a scaleY drop-down has scaleX 1. */
    scaleX?: number;
    scaleY?: number;
  };
  /** The box may be another element's (it coincides with another target's): left out of geometry. */
  unsure?: boolean;
}

/** Where a scale grows from: a corner, an edge's middle or the centre of the element's box. */
export const ORIGIN_NAMES = [
  "top-left",
  "top",
  "top-right",
  "left",
  "center",
  "right",
  "bottom-left",
  "bottom",
  "bottom-right",
] as const;
export type OriginName = (typeof ORIGIN_NAMES)[number];
const originAt = (name: OriginName) => ({
  fx: name.endsWith("left") ? 0 : name.endsWith("right") ? 1 : 0.5,
  fy: name.startsWith("top") ? 0 : name.startsWith("bottom") ? 1 : 0.5,
});
const originCss = (name: OriginName) => (name === "center" ? "center" : name.replace("-", " "));
/** The fixed point named when it is within this (a fraction of the box) of one. */
const ORIGIN_SNAP = 0.15;
/** Which way a segment moves, by the larger of its two components. */
export const MOTION_DIRECTIONS = ["left", "right", "up", "down"] as const;
export type MotionDirection = (typeof MOTION_DIRECTIONS)[number];
const directionOf = (dx: number, dy: number): MotionDirection =>
  Math.abs(dx) >= Math.abs(dy) ? (dx < 0 ? "left" : "right") : dy < 0 ? "up" : "down";
const towards = (d: MotionDirection) => `${d}wards`;

/** A start this far (ms) from the expected one is a mismatch: one 60fps frame. */
const START_TOLERANCE_MS = 17;

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
  /** The point a scale must grow from (or shrink to): measured, the point of its box that stays put. */
  expectOrigin?: OriginName;
  /** When its own animation must begin (page ms): measured from the element's animation time. */
  expectStartMs?: number;
  /** Which way the first segment's motion must go. */
  expectDirection?: MotionDirection;
  /** How long one run must take (ms), and how many runs (null: infinite). */
  expectDurationMs?: number;
  expectIterations?: number | null;
  /** Its centre must not move: only its size, opacity or colour change (a dialog that stays centred). */
  expectStill?: boolean;
}

export type MotionRule =
  | "target-lost"
  | "target-hidden"
  | "absent-at-rest"
  | "snap-back"
  | "jump"
  | "easing-mismatch"
  | "easing-unchecked"
  | "target-static"
  | "locate-unsure"
  | "origin-mismatch"
  | "origin-unchecked"
  | "start-mismatch"
  | "start-unchecked"
  | "duration-mismatch"
  | "iterations-mismatch"
  | "direction-mismatch"
  | "still-mismatch"
  | "mirrored";

export interface MotionFinding {
  rule: MotionRule;
  severity: "fail" | "warn";
  /** The frame it is seen in (for a jump, the frame it lands in). */
  atMs: number;
  message: string;
}

/** What an easing was fitted to: the path, or with the element measured, its opacity or scale. */
export type EasingChannel = "position" | "opacity" | "scale" | "turn";

export type ChannelFit = EasingFit & { channel: EasingChannel };

/** The first channel's fit (position, else opacity, else scale), with every channel fitted beside it. */
export type SegmentEasing =
  | (EasingFit & { expected?: EasingName; channel?: EasingChannel; channels?: ChannelFit[] })
  | { skipped: string; expected?: EasingName };

/** The point of the box a scale keeps in place, as fractions of the box at full size; named when near one. */
export interface ScaleOrigin {
  /** Null on an axis it does not scale along (a scaleY drop-down has no point across). */
  fx: number | null;
  fy: number | null;
  name: OriginName | null;
  /** The frame it is best seen in: the most opaque one scaled 2% or more from full size. */
  atMs: number;
}

/** "its top-right corner", "its centre", "the point 30% across and 80% down its box". */
export function describeOrigin(o: Pick<ScaleOrigin, "fx" | "fy" | "name">): string {
  // A point far outside the box is no transform-origin: the box moves as well as it scales (a
  // keyframe transform replacing a centring translate read "the point 1857% across", round 8).
  const outside = (v: number | null) => v !== null && (v < -0.5 || v > 1.5);
  if (outside(o.fx) || outside(o.fy)) return "no point of its box (it moves as well as it scales)";
  if (o.fx === null || o.fy === null) {
    // One axis: an edge (or the line through its middle) stays put, not a point.
    const across = o.fy === null;
    const v = (across ? o.fx : o.fy) ?? 0.5;
    const side =
      Math.abs(v) <= ORIGIN_SNAP
        ? across
          ? "left"
          : "top"
        : Math.abs(v - 1) <= ORIGIN_SNAP
          ? across
            ? "right"
            : "bottom"
          : Math.abs(v - 0.5) <= ORIGIN_SNAP
            ? "middle"
            : null;
    if (!side) return `the line ${Math.round(v * 100)}% ${across ? "across" : "down"} its box`;
    return side === "middle"
      ? `the line through its middle (it scales ${across ? "across" : "up and down"} only)`
      : `its ${side} edge`;
  }
  if (!o.name) return `the point ${Math.round(o.fx * 100)}% across and ${Math.round(o.fy * 100)}% down its box`;
  if (o.name === "center") return "its centre";
  return o.name.includes("-") ? `its ${o.name} corner` : `the middle of its ${o.name} edge`;
}

export interface MotionPathReport {
  findings: MotionFinding[];
  /** Positions of the frames the target is shown in, motion and rest; `edge` = put back from a clipped box. */
  path: { atMs: number; x: number; y: number; rest: boolean; edge: boolean }[];
  /** Per segment: its span, how far the target travels in it, the fit or why there is none. */
  segments: (MotionSegment & {
    travelPx: number;
    easing: SegmentEasing;
    origin?: ScaleOrigin;
    /** Which way it moves, and from where to where (centres), when it travels the floor or more. */
    direction?: { way: MotionDirection; from: { x: number; y: number }; to: { x: number; y: number } };
  })[];
  /** When its own animation begins (page ms), measured: absent without --selector or an animation. */
  startsAtMs?: number;
  /** One run of its own animation (ms) and how many runs (null: infinite), measured. */
  durationMs?: number;
  iterations?: number | null;
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
  // Measured, a 4px card lift is a real path: under 6px it read "too short to fit" and
  // "moves under 6px … its animation is not applying" (motion-repair round 8).
  const minTravel = options.minFitTravelPx ?? (exact ? 2 : 60);
  const still = exact ? 1 : floor;
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
      // Edge-on, a turning card has next to no area, and a face turned away is not meant to be
      // seen (if it is drawn, that is `mirrored`): neither seen nor lost (round 9).
      if (s.dom.edgeOn || s.dom.facingAway) return null;
      // A model's "not shown" on a frame the page measures as mid-fade and on screen is the
      // fade, not a loss: Jev read a panel at opacity 0.45 as 0.23 and a correct page failed
      // target-lost (round 7). Unknown, not evidence. (Without Jev, present is the page's own.)
      if (s.present < thr && s.dom.opacity < sure && (s.dom.visible ?? 0) >= thr && s.present !== s.dom.visible)
        return null;
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

  const path = sorted
    .filter(shown)
    .map((s) => ({ atMs: s.atMs, ...position(s), rest: isRest(s), edge: !s.dom && atEdge(s) }));
  const motion = path.filter((p) => !p.rest);

  // Presence: absent between two frames that show it, or gone once it stops. A faint frame whose
  // box is at the viewport's edge is the target coming in or going out, not lost.
  const judged = sorted.filter((s) => seen(s) !== null);
  // Why a frame does not show it, when the page measured that (clip, cover, stacking context).
  const why = (s: MotionSample) => (s.dom?.hiddenBy ? ` — ${s.dom.hiddenBy}` : "");
  const firstShown = judged.findIndex(shown);
  // Never shown in any frame, rest included. Every rule below compares frames that show it, so
  // without this a card clipped from its first frame to its last passed, with an easing fitted to
  // an element nobody could see (motion-repair round 1: a clipped notification, a menu under a
  // banner — both "no fail").
  if (firstShown < 0 && judged.length > 0) {
    const rendered = judged.filter((s) => !s.dom || s.dom.opacity >= 0.05);
    const r = rendered.find(isRest) ?? rendered[rendered.length - 1] ?? judged[judged.length - 1]!;
    findings.push({
      rule: "target-hidden",
      severity: "fail",
      atMs: r.atMs,
      message: r.dom
        ? `never seen in any frame, at rest included: at most ${Math.round(Math.max(...judged.map((s) => s.present)) * 100)}% of it visible in any frame (${Math.round(r.present * 100)}% at ${ms(r.atMs)}, rendered at opacity ${r.dom.opacity.toFixed(2)})${why(r) || ": clipped by an ancestor, covered, transparent, or off-screen"}`
        : `not found in any frame, at rest included (presence ${r.present.toFixed(2)} at ${ms(r.atMs)}): hidden, or the description names something not on the page`,
    });
    const skipped = { skipped: "not seen in any frame: nothing about its motion is judged" } as SegmentEasing;
    return {
      findings,
      path: [],
      segments: segments.map((seg) => ({ ...seg, travelPx: 0, easing: skipped })),
      travelPx: 0,
      easing: skipped,
    };
  }
  const lastShown = judged.length - 1 - [...judged].reverse().findIndex(shown);
  if (firstShown >= 0) {
    for (let i = firstShown + 1; i < lastShown; i++) {
      const s = judged[i]!;
      // Measured, the visible share already leaves out what is off-screen, so a box at the edge is
      // no excuse: a toast that snaps back off-screen between two frames that show it is lost.
      // Meant to leave: not shown from the last segment on is the exit working, even when a
      // later frame shows it back (that return is the snap-back, judged below). A banner that
      // slid away and snapped back read as lost too, beside the snap-back (round 6).
      const leaving = options.exits && s.atMs >= segments[segments.length - 1]!.startMs;
      if (!shown(s) && !leaving && (s.dom !== undefined || !atEdge(s))) {
        const before = [...judged.slice(0, i)].reverse().find(shown)!;
        const after = judged.slice(i + 1).find(shown)!;
        findings.push({
          rule: "target-lost",
          severity: "fail",
          atMs: s.atMs,
          message: `not shown at ${ms(s.atMs)} (presence ${s.present.toFixed(2)}) though ${ms(before.atMs)} and ${ms(after.atMs)} show it${why(s) || ": clipped, covered or hidden mid-motion"}${s.dom ? "" : ` — if it is not on screen yet at ${ms(before.atMs)}, that frame's reading is the wrong one; look at both`}`,
        });
      }
    }
    const restSamples = judged.filter(isRest);
    // A face turned away at rest is the far side of what turned, not a loss.
    const goneAtRest =
      restSamples.length > 0 && restSamples.every((s) => !shown(s)) && !restSamples.some((s) => s.dom?.facingAway);
    if (goneAtRest && motion.length > 0 && !options.exits) {
      findings.push({
        rule: "absent-at-rest",
        severity: "fail",
        atMs: restSamples[0]!.atMs,
        message: `shown during the motion, not once it stops (presence ${restSamples[0]!.present.toFixed(2)} at ${ms(restSamples[0]!.atMs)})${why(restSamples[0]!) || ": clipped, covered or hidden in its end state"} — if it is meant to leave (a toast, a dismissed banner), that is its end: declare it with --exits`,
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
  // Measured, every motion frame is geometry, rendered or not: a rise that starts at opacity 0 is
  // 24px from its first frame, not from the first frame it can be seen in (which read 17px).
  let geo = exact ? sorted.filter((s) => !isRest(s)).map(point) : all.filter((p) => !p.rest);
  const geoRest = all.filter((p) => p.rest);

  // A model's box that lands far off and is back the next frame is another element's, not a jump.
  const unsureAt = sorted.filter((s) => seen(s) === null && !s.dom?.edgeOn && !s.dom?.facingAway).map((s) => s.atMs);
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

  // A sample's time fraction: the element's own animation time when measured and it runs in the
  // segment, else the segment's. An element whose own animation is the exit reads t = 0 all
  // through the entrance (moved by its parent's animation): every point at one t, nothing fits.
  // Normalised to its range inside the segment: one animation that enters, holds and exits
  // spends 0-0.15 of its own time on the entrance, which is the whole of that segment.
  const ownRange = (seg: MotionSegment) => {
    const ts = sorted
      .filter((x) => x.atMs >= seg.startMs && x.atMs <= seg.endMs)
      .map((x) => x.dom?.t)
      .filter((t): t is number => typeof t === "number");
    if (ts.length < 2) return null;
    const lo = Math.min(...ts);
    const hi = Math.max(...ts);
    return hi - lo >= 0.05 ? { lo, hi } : null;
  };
  const timeOf = (atMs: number, seg: MotionSegment) => {
    const own = sorted.find((x) => x.atMs === atMs)?.dom?.t;
    const range = ownRange(seg);
    if (typeof own === "number" && range) return (own - range.lo) / (range.hi - range.lo);
    return Math.min(1, Math.max(0, (atMs - seg.startMs) / Math.max(seg.endMs - seg.startMs, 1)));
  };

  const reports: MotionPathReport["segments"] = segments.map((seg, k) => {
    const expected = expectFor(k);
    const last = k === segments.length - 1;
    const frames = geo.filter((p) => p.atMs >= seg.startMs && p.atMs <= seg.endMs);
    const travelPx = frames.length >= 2 ? dist(frames[0]!, frames[frames.length - 1]!) : 0;
    const tag = segments.length > 1 ? ` in ${ms(seg.startMs)}..${ms(seg.endMs)}` : "";
    let easing: SegmentEasing;
    // Measured, a fade or a scale has an easing too: fit every channel that changes.
    const channel = (key: "opacity" | "scale" | "turnDeg", least: number) => {
      const xs = sorted.filter(
        (x) => x.dom && x.atMs >= seg.startMs && x.atMs <= seg.endMs && Number.isFinite(x.dom[key] ?? NaN),
      );
      if (xs.length < 4) return null;
      const v = xs.map((x) => x.dom![key]!);
      // A 2D turn reads -180..180: unwrapped, so a spinner past 180° is not a step back of 350°.
      if (key === "turnDeg")
        for (let k = 1; k < v.length; k++) v[k] = v[k]! - 360 * Math.round((v[k]! - v[k - 1]!) / 360);
      const delta = v[v.length - 1]! - v[0]!;
      if (Math.abs(delta) < least) return null;
      return xs.map((x, i) => ({ t: timeOf(x.atMs, seg), s: Math.sign(delta) * v[i]! }));
    };
    const fits: ChannelFit[] = [];
    let skipped: string | undefined;
    if (frames.length < 4) skipped = "fewer than 4 frames surely show the target";
    else if (travelPx < minTravel)
      skipped = `travel ${Math.round(travelPx)}px is under ${minTravel}px: too short to fit`;
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
      if (Number.isFinite(fit.errors[fit.best])) fits.push({ ...fit, channel: "position" });
      else skipped = "the frames' times do not spread across the segment: nothing to fit";
    }
    if (exact) {
      // A card turning over moves no centre: its turn is the channel (round 9 fitted nothing).
      for (const [key, least] of [
        ["opacity", 0.2],
        ["scale", 0.02],
        ["turnDeg", 10],
      ] as const) {
        const pts = channel(key, least);
        const fit = pts ? fitEasingAffine(pts) : null;
        if (fit && Number.isFinite(fit.errors[fit.best]))
          fits.push({ ...fit, channel: key === "turnDeg" ? "turn" : key });
      }
    }
    easing = fits[0] ? { ...fits[0], channels: fits } : { skipped: skipped ?? "nothing about it changes" };
    if (expected) {
      for (const fit of fits) {
        if (fit.best === expected) continue;
        // A box around the part that is not covered moves differently from the element: when
        // frames inside the segment show it not at all, say so beside the mismatch.
        const hidden =
          exact || fit.channel !== "position"
            ? 0
            : sorted.filter(
                (x) =>
                  x.atMs >= seg.startMs && x.atMs <= seg.endMs && x.present < thr && x.atMs > (frames[0]?.atMs ?? 0),
              ).length;
        const what = fit.channel === "position" ? "the path" : `the ${fit.channel}`;
        findings.push({
          rule: "easing-mismatch",
          severity: "fail",
          atMs: seg.startMs,
          message: `${what}${tag} follows ${fit.best} (it fits ${fit.margin.toFixed(1)}x better than the next-best curve), not ${expected}${hidden > 0 ? `; in ${hidden} frame(s) there it is not seen at all — if something covers it, fix that first and re-check` : ""}`,
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
        // Out of its delay, unseen, into its first keyframe: the base style and the keyframe differ
        // where nobody can see it (a tile at opacity 0 "jumped" 10px into its rise, round 9).
        const from = sorted.find((x) => x.atMs === frames[i]!.atMs)?.dom;
        const unseenDelay = from !== undefined && (from.elapsedMs ?? 0) < 0 && from.opacity < 0.05;
        if (st.px >= floor && times > ratio && !unseenDelay) {
          findings.push({
            rule: "jump",
            severity: "fail",
            atMs: frames[i + 1]!.atMs,
            message: `moves ${Math.round(st.px)}px between ${ms(frames[i]!.atMs)} and ${ms(frames[i + 1]!.atMs)}, ${times.toFixed(1)}x as fast as the steps around it: a discontinuity — a gap between keyframes, or a property changed with no transition or animation for it`,
          });
        }
      });
    }
    const origin = exact ? scaleOrigin(sorted, seg, last ? sorted.filter(isRest) : []) : null;
    if (options.expectOrigin && origin) {
      const want = originAt(options.expectOrigin);
      // Only the axes it scales along: "top-left" is met by a scaleY whose top edge stays put.
      const off = (got: number | null, w: number) => got !== null && Math.abs(got - w) > ORIGIN_SNAP;
      if (off(origin.fx, want.fx) || off(origin.fy, want.fy)) {
        findings.push({
          rule: "origin-mismatch",
          severity: "fail",
          atMs: origin.atMs,
          message: `the scale${tag} grows from ${describeOrigin(origin)}${describeOrigin(origin).startsWith("no point") ? "" : ` (that ${origin.fx === null || origin.fy === null ? "edge" : "point"} of its box stays put)`}, not ${describeOrigin({ fx: origin.fx === null ? null : want.fx, fy: origin.fy === null ? null : want.fy, name: options.expectOrigin })}: transform-origin: ${originCss(options.expectOrigin)}`,
        });
      }
    }
    // Which way: from the segment's first frame to where it ends (its last frame, or the held rest
    // for the last segment). A panel meant to come in from the right edge came from mid-page,
    // moving rightwards, and "travels 360px" read the same for both (round 7).
    let direction: MotionPathReport["segments"][number]["direction"];
    if (frames.length >= 2) {
      const a = frames[0]!;
      const restHere = last ? geoRest[0] : undefined;
      const z = restHere && dist(restHere, a) > floor ? restHere : frames[frames.length - 1]!;
      // Not from a target that holds still and jumps at the end: "travels 0px leftwards" (round 8).
      if (travelPx >= Math.min(floor, minTravel) && dist(a, z) >= Math.min(floor, minTravel)) {
        direction = { way: directionOf(z.x - a.x, z.y - a.y), from: { x: a.x, y: a.y }, to: { x: z.x, y: z.y } };
      }
    }
    if (k === 0 && options.expectDirection && direction && direction.way !== options.expectDirection) {
      findings.push({
        rule: "direction-mismatch",
        severity: "fail",
        atMs: seg.startMs,
        message: `it moves ${towards(direction.way)} (centre ${Math.round(direction.from.x)},${Math.round(direction.from.y)} → ${Math.round(direction.to.x)},${Math.round(direction.to.y)}), not ${towards(options.expectDirection)}: where it starts is its first keyframe's (a translate with the wrong sign is the usual cause)`,
      });
    }
    return { ...seg, travelPx, easing, ...(origin ? { origin } : {}), ...(direction ? { direction } : {}) };
  });
  if (options.expectOrigin && !reports.some((x) => x.origin)) {
    findings.push({
      rule: "origin-unchecked",
      severity: "warn",
      atMs: segments[0]!.startMs,
      message: `${options.expectOrigin} was expected but not checked: ${exact ? "its scale changes by less than 2% in every segment" : "only an element measured from the page (--selector) has a scale to read"}`,
    });
  }

  // When its own animation begins: the frame's time less how long it has been active, over the
  // frames inside its active phase. Four entries that "cascade" all at 200ms passed every rule
  // above: each one's own curve was right (motion-repair round 3).
  const starts = sorted
    .filter((x) => !isRest(x) && typeof x.dom?.elapsedMs === "number" && typeof x.dom.t === "number")
    .filter((x) => x.dom!.t! > 0 && x.dom!.t! < 1)
    .map((x) => x.atMs - x.dom!.elapsedMs!);
  const startsAtMs = starts.length > 0 ? median(starts) : undefined;
  if (options.expectStartMs !== undefined) {
    if (startsAtMs === undefined) {
      findings.push({
        rule: "start-unchecked",
        severity: "warn",
        atMs: segments[0]!.startMs,
        message: `a start at ${ms(options.expectStartMs)} was expected but not checked: ${exact ? "no frame falls inside its own animation" : "only an element measured from the page (--selector) has an animation time to read"}`,
      });
    } else if (Math.abs(startsAtMs - options.expectStartMs) > START_TOLERANCE_MS) {
      findings.push({
        rule: "start-mismatch",
        severity: "fail",
        atMs: startsAtMs,
        message: `its animation begins at ${ms(startsAtMs)}, not ${ms(options.expectStartMs)}: ${startsAtMs < options.expectStartMs ? "early" : "late"} by ${ms(Math.abs(startsAtMs - options.expectStartMs))} — its animation-delay (or when the animation is added) decides it`,
      });
    }
  }

  // In a hold between two segments it stays where the first left it: a frame there far from the
  // segment's last one is the end keyframe not held (an entrance without fill-mode, whose next
  // animation brings it back).
  for (let k = 0; k + 1 < segments.length; k++) {
    const seg = segments[k]!;
    const next = segments[k + 1]!;
    const inSeg = geo.filter((p) => p.atMs >= seg.startMs && p.atMs <= seg.endMs);
    const ended = inSeg[inSeg.length - 1];
    const held = geo.filter((p) => p.atMs > seg.endMs && p.atMs < next.startMs);
    const off = ended ? held.find((p) => dist(p, ended) >= floor) : undefined;
    if (ended && off) {
      const started = inSeg[0]!;
      const backHome = dist(off, started) <= Math.max(floor, dist(started, ended) * 0.25);
      findings.push({
        rule: backHome ? "snap-back" : "jump",
        severity: "fail",
        atMs: off.atMs,
        message: backHome
          ? `back near where it started at ${ms(off.atMs)}, in the hold after ${ms(seg.endMs)} (${Math.round(dist(off, ended))}px from where the motion ended): that animation's final keyframe is not held — add animation-fill-mode: forwards (or both)`
          : `${Math.round(dist(off, ended))}px from where the motion ended (${ms(ended.atMs)}) at ${ms(off.atMs)}, in the hold before ${ms(next.startMs)}: the state between the animations is not the end keyframe`,
      });
    }
  }

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
          : travel < floor
            ? {
                // Held still off its place the whole time, then put there: the animation sets what
                // places the element. The dialog of round 8 read "the end state differs from the
                // last keyframe", and both agents found the overridden translate in the CSS.
                rule: "jump",
                severity: "fail",
                atMs: r.atMs,
                message: `sits ${Math.round(off)}px off where it rests (${Math.round(r.x - last.x)},${Math.round(r.y - last.y)}) through the whole motion, and jumps there when it ends: the animation overrides what places the element — most often a keyframe \`transform\` that replaces the element's own (a \`translate(-50%, -50%)\` centring): repeat that translate in every keyframe, or animate \`scale\` / \`translate\` (the separate properties) instead`,
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

  // A face turned past edge-on with its back face drawn is seen backwards: the question side of
  // a flip card, mirrored over its answer, read "shown 1.00" (round 9).
  const backwards = sorted.find((s) => s.dom?.mirrored && !s.dom.edgeOn && s.present >= thr);
  if (backwards) {
    findings.push({
      rule: "mirrored",
      severity: "fail",
      atMs: backwards.atMs,
      message: `seen mirrored at ${ms(backwards.atMs)}: it faces away from you (turned past edge-on) and its back face is drawn — give it backface-visibility: hidden (on each face of a flip card)`,
    });
  }

  // Turned in 3D, a box's centre is the bounds of a turned shape under perspective, not a place.
  const turnedAt = new Set(sorted.filter((s) => s.dom?.rotated3d).map((s) => s.atMs));
  if (options.expectStill && geo.length > 0) {
    const anchor = geoRest[0] ?? geo[geo.length - 1]!;
    const far = [...geo, ...geoRest]
      .filter((p) => !turnedAt.has(p.atMs))
      .concat(anchor)
      .reduce((a, b) => (dist(b, anchor) > dist(a, anchor) ? b : a));
    if (dist(far, anchor) >= Math.max(2, still)) {
      findings.push({
        rule: "still-mismatch",
        severity: "fail",
        atMs: far.atMs,
        message: `its centre is at ${Math.round(far.x)},${Math.round(far.y)} at ${ms(far.atMs)}, ${Math.round(dist(far, anchor))}px from ${Math.round(anchor.x)},${Math.round(anchor.y)} where it rests, though only its size and opacity may change: a keyframe \`transform\` that replaces the element's own placement, or a scale whose transform-origin is not its centre`,
      });
    }
  }

  // Shown surely from the first frame, never hidden, never moving: nothing about it animates.
  const firstMotion = sorted.find((s) => !isRest(s));
  if (
    firstMotion &&
    firstMotion.present >= sure &&
    sorted.every((s) => shown(s)) &&
    geo.length >= 2 &&
    Math.max(...geo.map((p) => dist(p, geo[0]!))) < still &&
    !(
      exact &&
      sorted.some(
        (x) =>
          Math.abs(x.dom!.opacity - sorted[0]!.dom!.opacity) > 0.05 ||
          Math.abs(x.dom!.scale - sorted[0]!.dom!.scale) > 0.01 ||
          // A spinner turns in place: static by its centre, not by its turn.
          Math.abs((x.dom!.turnDeg ?? 0) - (sorted[0]!.dom!.turnDeg ?? 0)) > 2,
      )
    )
  ) {
    findings.push({
      rule: "target-static",
      severity: "warn",
      atMs: firstMotion.atMs,
      message: `fully shown from ${ms(firstMotion.atMs)} and moves under ${still}px in every frame: if it is meant to animate, its animation is not applying (a dropped rule, a misspelt animation-name)`,
    });
  }

  const first = reports.find((x) => "best" in x.easing) ?? reports[0]!;
  // How long a run takes and how many there are, from the element's own timing.
  const timed = sorted.filter((x) => typeof x.dom?.durationMs === "number");
  const durationMs = timed.length > 0 ? median(timed.map((x) => x.dom!.durationMs!)) : undefined;
  const iterations = timed.find((x) => x.dom!.iterations !== undefined)?.dom!.iterations;
  if (options.expectDurationMs !== undefined && durationMs !== undefined) {
    const off = Math.abs(durationMs - options.expectDurationMs);
    if (off > Math.max(START_TOLERANCE_MS, options.expectDurationMs * 0.05)) {
      findings.push({
        rule: "duration-mismatch",
        severity: "fail",
        atMs: segments[0]!.startMs,
        message: `one run takes ${ms(durationMs)}, not ${ms(options.expectDurationMs)} (${(durationMs / options.expectDurationMs).toFixed(1)}x): its animation-duration decides it`,
      });
    }
  }
  if (options.expectIterations !== undefined && iterations !== undefined && iterations !== options.expectIterations) {
    const say = (n: number | null) => (n === null ? "forever" : `${n} time${n === 1 ? "" : "s"}`);
    findings.push({
      rule: "iterations-mismatch",
      severity: "fail",
      atMs: segments[0]!.startMs,
      message: `it runs ${say(iterations)}, not ${say(options.expectIterations)}: animation-iteration-count: ${options.expectIterations === null ? "infinite" : options.expectIterations}`,
    });
  }
  findings.sort((a, b) => a.atMs - b.atMs);

  return {
    findings,
    path,
    segments: reports,
    travelPx: first.travelPx,
    easing: first.easing,
    ...(startsAtMs !== undefined ? { startsAtMs } : {}),
    ...(durationMs !== undefined ? { durationMs } : {}),
    ...(iterations !== undefined ? { iterations } : {}),
  };
}

/**
 * The point of the box a scale keeps in place. Box = o + k (B - o) for the full-size box B and
 * relative scale k, so o = (box - k B) / (1 - k) on each axis; the median over every frame scaled
 * 2% or more from the largest. Full size is the largest scale in the segment (and its rest, for
 * the last): an entrance grows to it, an exit shrinks from it. A translate in the same keyframes
 * moves the point with it — it is then what the motion reads as, not the CSS property.
 */
function scaleOrigin(
  sorted: readonly MotionSample[],
  seg: MotionSegment,
  rest: readonly MotionSample[],
): ScaleOrigin | null {
  const xs = [...sorted.filter((x) => x.dom && x.atMs >= seg.startMs && x.atMs <= seg.endMs), ...rest].filter(
    (x) => x.dom && x.dom.scale > 0 && x.dom.box.width > 0 && x.dom.box.height > 0,
  );
  if (xs.length < 2) return null;
  // Each axis on its own: a scaleY(0.2) drop-down read scale 1 from the matrix's first column,
  // and no origin at all (motion-repair round 5).
  const sx = (x: MotionSample) => x.dom!.scaleX ?? x.dom!.scale;
  const sy = (x: MotionSample) => x.dom!.scaleY ?? x.dom!.scale;
  const axis = (k: (x: MotionSample) => number, pos: "x" | "y", size: "width" | "height") => {
    const ref = xs.reduce((a, b) => (k(b) > k(a) ? b : a));
    const R = ref.dom!.box;
    const out: number[] = [];
    const used: MotionSample[] = [];
    for (const x of xs) {
      const r = k(x) / k(ref);
      // 2% is the floor: a dialog growing 96% → 100% is the common case and read "less than 10%,
      // not checked" (round 8). Measured boxes are exact enough to solve it.
      if (r > 0.98) continue;
      const b = x.dom!.box;
      out.push(((b[pos] - r * R[pos]) / (1 - r) - R[pos]) / R[size]);
      used.push(x);
    }
    return { f: out.length > 0 ? median(out) : null, used };
  };
  const ax = axis(sx, "x", "width");
  const ay = axis(sy, "y", "height");
  if (ax.f === null && ay.f === null) return null;
  // The frame to look at: the most opaque of the scaled ones (at the segment's start a fade-in is
  // at opacity 0, and "the first fail's own frame" showed nothing, round 4).
  const shownAt = [...ax.used, ...ay.used].reduce((a, b) => (b.dom!.opacity > a.dom!.opacity ? b : a)).atMs;
  const near = (got: number | null, w: number) => got === null || Math.abs(got - w) <= ORIGIN_SNAP;
  // On one axis the name is its edge's ("top"), the other axis taken as the middle.
  const name =
    ORIGIN_NAMES.find(
      (n) =>
        near(ax.f, originAt(n).fx) &&
        near(ay.f, originAt(n).fy) &&
        (ax.f !== null || originAt(n).fx === 0.5) &&
        (ay.f !== null || originAt(n).fy === 0.5),
    ) ?? null;
  return { fx: ax.f, fy: ay.f, atMs: shownAt, name };
}
