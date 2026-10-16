/**
 * Flicker that motion explains, told apart from flashing, from the pixels alone.
 *
 * `flash.ts` counts at each pixel, which is literal: every moving high-contrast detail flickers at
 * each pixel it crosses, so scrolling text "flashes" 51 times a second over a whole field. An eye
 * that tracks the text sees no flicker at all. So every failing run is re-counted with motion
 * compensated, end to end, and only what is left decides. Two tests; a failure needs one:
 *
 * 1. **The field as a whole.** Each failing field's mean colour (in linear light, from per-frame
 *    block sums) is judged as one pixel. Nothing that only moves changes a field's mean 7 times a
 *    second; a strobe does, whatever moves in front of it.
 * 2. **The tracked residual.** Each pixel's state — its luminance (or u′v′), the zig-zag's leg and
 *    its last transitions — is carried along the motion of its 16x16 block from frame to frame,
 *    and only the part of a step the motion does not reproduce is added to it. For a whole-pixel
 *    displacement that is the step against the pixel the motion brings it from. Between pixels
 *    there are two predictions, the two the matcher tries: the previous frame resampled at the
 *    displacement (forward), and the source pixels resampled from this frame (backward: a layer
 *    at a half-pixel offset is rendered blurred and at a whole one sharp, and only the sharp frame,
 *    resampled, gives the blurred one), bilinear in encoded luminance, or for red in linear XYZ. A
 *    step either reproduces within 0.01 of luminance (0.02 of u′v′) is explained; the rest is
 *    counted as the prediction that fits better leaves it, since the forward residual of a frame
 *    that sharpens is mostly the sharpening. Never the range of the source pixels: beside ink, a
 *    strobe's step toward the darker level lands inside it, and a light strobe behind text moving
 *    2.5px a frame was explained. Each state also knows where in its pixel its content is, so
 *    content moving 2.5px a frame keeps its state rather than sliding half a pixel a frame along
 *    it. An eye tracking the content sees exactly that. Where no motion is trusted, the state
 *    stays put and takes the whole step, and moves on with the content when its motion is
 *    trusted again. The re-count is judged as the first one was (closing, field, limit).
 *
 * Two things a state does not take along: steps it took in place, before the last one (a stock
 * that card after card appears on is the stock's history, not the card's that leaves it), and a
 * history at all where content is replaced under motion — what was at a pixel moved on by trusted
 * motion and what is there now moves on by the next frame's, as at the frame's edge while a slide
 * enters. The steps taken in place stay with the place: beside the content state, each screen
 * pixel keeps a ring of its own that never moves, holding every step taken there in place when the
 * content that took it moves on, and a level step taken under content that travels on (a block
 * untrusted between two frames that are trusted). The content's flashing and the places' flashing
 * are two areas, each closed and measured in its best field, and either over the limit fails it —
 * a strobe box that text scrolls through, text that steps across a strobe now and then. (Measured
 * as one area, the deal's stock and its flying cards came within 3,688 px² of the limit.) Only
 * motion trusted at some point feeds the place: steps taken under motion untrusted
 * throughout (the translucent cards of a deal) already stay where they were taken. Content that
 * enters the view starts with no history, so a strobe behind content that crosses the view in under
 * about a second and three quarters is counted only on what has been in view a second, or on what
 * the place keeps.
 *
 * What may establish motion is narrow, because every excuse is a way to pass a strobe. A block's
 * displacement must reproduce it (texture, mean residual ≤ 0.04 in encoded luminance, under half
 * of not moving, on the part of it whose source is in the frame when that is at least half; a
 * plain block only by a moving neighbour's motion), and is then refused when:
 *
 * - **a level change explains it as well**: the block minus its mean step, unmoved, is as close as
 *   the motion's match;
 * - **it has no direction**: the opposite displacement reproduces it too — a pattern moved by half
 *   its period, seen to flicker (counterphase), not to move;
 * - **it jumps from rest**: more than 24px a frame further than the content was moving, judged
 *   against the block it came from and against this block a frame ago — a teleport, stripes
 *   inverting, a gradient strobing as it slides (its level step matches a shift);
 * - **it reverses** — turns a quarter turn or more from its own last motion, both displacements at
 *   least 2px — more than six times within a second: a shake (around a square path, every jump is
 *   a quarter turn), untrusted over the whole cluster (from the jump before its first reversal),
 *   not from the seventh on.
 *
 * DOM attribution plays no part: a `scale(0)` strobe and a teleport are transform animations.
 *
 * Known to read as flash although the eye would track it (the safe direction): two layers moving
 * differently inside one block (text over a patterned or photographic background, parallax, the
 * translucent cards of a deal), rotation of detailed content, fine detail moving at a speed off the
 * quarter- and third-pixel grid, and a grating whose bars are as wide as a block (16px bars moving
 * 4px a frame: a block inside a bar is flat, with no texture to match, so its flips stay counted;
 * measured while loading recordings, scan-video-v1). Known to read as motion: a grating of bars
 * narrower than a block moving less than half its period a frame (8px bars at 2px a frame), however
 * fast (it is seen to move; moving-pattern hazards are ISO 9241-391's, not measured here); a shake that turns by less than a quarter turn a frame, as a smooth orbit does;
 * a strobe behind content that hides each pixel at more than about one step in eight, which
 * flashes there fewer times than the strobe does (text at one mark per 240 px² over a 4 Hz box
 * read 16,522 of its 32,000 px²).
 */
import {
  AREA_LIMIT_CSS2,
  bestField,
  closeMask,
  createFlashJudge,
  DARKER_BELOW,
  FIELD_CSS,
  LUMINANCE_STEP,
  MAX_TRANSITIONS,
  RED_UV_STEP,
  meanFlashFrame,
  meanFromBlocks,
  WHITE_UV,
  WINDOW_MS,
  type FlashFrame,
  type FrameBlocks,
  type FlashRun,
  type FlashTrack,
} from "./flash.ts";
import { srgbChannelToLinear } from "./color.ts";
import type { Box } from "./storyboard.ts";

/** Block side, in CSS px. */
export const MOTION_BLOCK = 16;
/** Largest displacement searched per frame, in CSS px (a carousel slide moves ~90px a frame at its fastest). */
export const MOTION_SEARCH = 160;
/**
 * Frames before a run's first window that the re-count starts from, so a pixel's state is warm: as
 * long as a span's history beyond its first window (2s). 250ms started it cold, and a still field
 * that had stepped 0 → 0.06 → 0.12 before a strobe lost that step's transition, which a small object
 * moving elsewhere then let read as "motion flicker".
 */
export const MOTION_LEAD_MS = 2000;
/** Frames re-counted per track at most; a run past it is not excused. */
export const MOTION_MAX_FRAMES = 1200;
/** A displacement this much larger than its source's motion is a jump, not travel. */
export const MOTION_JERK_PX = 24;

// Block matching runs on gamma-encoded luminance (0..1), where a renderer's edge blending is linear.
const TEXTURE_STD = 0.03;
const MATCH_MEAN = 0.04;
const MATCH_GAIN = 0.5;
const FRACTIONS = [-0.5, -1 / 3, -0.25, 0, 0.25, 1 / 3, 0.5];
/** A reversal needs both displacements at least this long, in px. */
const REVERSAL_PX = 2;
/** A sub-pixel prediction reproduces a pixel within this much relative luminance... */
const PREDICT_L = 0.01;
/** ... or, on the red track, within this much u′v′. */
const PREDICT_UV = 0.02;
/** A block's own last motion counts for a reversal when it is at most this old. */
const REVERSAL_MS = 200;
/** Distinct failing fields whose mean is judged per span. */
const FIELDS_PER_SPAN = 8;
const RING = 8;
const COARSE = 4;
const EPS = 1e-6;

/** The frames a judge saw, by index: `frame(k)` is decoded on demand (a sweep does not fit in memory). */
export interface FlashSequence {
  readonly times: readonly number[];
  frame(k: number): FlashFrame;
  /** Frame k's block sums, kept from the first pass, so the field test decodes nothing. */
  blocks?(k: number): FrameBlocks | undefined;
}

export interface MotionSegment {
  /** What was re-counted: the windows ending from `fromMs` + 1000 to `toMs`. */
  fromMs: number;
  toMs: number;
  /** Where the re-count ran: every flashing pixel of the runs in it, and their fields. */
  region: Box;
  /** The most transitions of any failing field's mean colour in a window (7 or more is a flash). */
  fieldTransitions: number;
  /** Area left after motion compensation, in its best field; null when the field test decided. */
  residualArea: number | null;
  /** Changed pixel steps in the region that motion explained, 0..1; null when not re-counted. */
  explainedShare: number | null;
  /** The blocks' common displacement, in CSS px per second; null when they did not agree or none moved. */
  velocity: { x: number; y: number } | null;
  /** True when the frame budget ran out before this span: it is not excused. */
  skipped?: boolean;
}

export interface MotionVerdict {
  classification: "flash" | "motion";
  /**
   * `field`: a failing field's mean strobes. `residual`: pixels still flash after compensation.
   * `budget`: a run was too long to re-count, so it is not excused. `explained`: none of these.
   */
  reason: "field" | "residual" | "budget" | "explained";
  segments: MotionSegment[];
}

interface Span {
  k0: number;
  k1: number;
  runs: FlashRun[];
}

/** Runs as spans of frames to re-count — each from a window and a lead before its first failing window — merged where they meet. */
export function runSpans(times: readonly number[], runs: readonly FlashRun[]): Span[] {
  const spans: Span[] = [];
  for (const run of [...runs].sort((a, b) => a.from - b.from)) {
    const startMs = times[run.from]! - WINDOW_MS - MOTION_LEAD_MS;
    let k0 = run.from;
    while (k0 > 0 && times[k0 - 1]! >= startMs - EPS) k0--;
    const last = spans[spans.length - 1];
    if (last && k0 <= last.k1 + 1) {
      last.k1 = Math.max(last.k1, run.to);
      last.runs.push(run);
    } else {
      spans.push({ k0, k1: run.to, runs: [run] });
    }
  }
  return spans;
}

/**
 * Classify a track's failing runs: `flash` when any of them still fails re-counted, or could not be
 * re-counted; `motion` when motion explains every one.
 */
export function classifyFlash(
  seq: FlashSequence,
  track: FlashTrack,
  runs: readonly FlashRun[],
  options: { field?: { width: number; height: number }; areaLimit?: number; judgeFromMs?: number } = {},
): MotionVerdict {
  const segments: MotionSegment[] = [];
  let budget = MOTION_MAX_FRAMES;
  for (const span of runSpans(seq.times, runs)) {
    const frames = span.k1 - span.k0 + 1;
    if (frames > budget) {
      segments.push({
        fromMs: seq.times[span.k0]!,
        toMs: seq.times[span.k1]!,
        region: unionBoxes(span.runs.map((r) => r.region)),
        fieldTransitions: 0,
        residualArea: null,
        explainedShare: null,
        velocity: null,
        skipped: true,
      });
      return { classification: "flash", reason: "budget", segments };
    }
    budget -= frames;
    const r = recountSpan(seq, track, span, options);
    segments.push(r.segment);
    // One span left flashing decides the track, so the re-count stops there.
    if (r.fieldFails) return { classification: "flash", reason: "field", segments };
    if (r.residualFails) return { classification: "flash", reason: "residual", segments };
    // A re-count that explained no step by motion re-counted the same steps from a colder start (it
    // begins MOTION_LEAD_MS before the run): fewer transitions there are its own lost history, not
    // motion. Measured: a still field stepping 0 → 0.06 → 0.12 before a strobe lost its first
    // transition and read "motion flicker" at 0% explained.
    if (r.segment.explainedShare === 0) return { classification: "flash", reason: "residual", segments };
  }
  return { classification: "motion", reason: "explained", segments };
}

function unionBoxes(boxes: readonly Box[]): Box {
  let x0 = Infinity;
  let y0 = Infinity;
  let x1 = -Infinity;
  let y1 = -Infinity;
  for (const b of boxes) {
    x0 = Math.min(x0, b.x);
    y0 = Math.min(y0, b.y);
    x1 = Math.max(x1, b.x + b.width);
    y1 = Math.max(y1, b.y + b.height);
  }
  return { x: x0, y: y0, width: x1 - x0, height: y1 - y0 };
}

/** The distinct fields the span's windows failed in, largest area first. */
function spanFields(span: Span): Box[] {
  const seen = new Map<string, { field: Box; area: number }>();
  for (const run of span.runs) {
    for (const w of run.windows) {
      const key = `${w.field.x},${w.field.y},${w.field.width},${w.field.height}`;
      const had = seen.get(key);
      if (!had || w.area > had.area) seen.set(key, { field: w.field, area: w.area });
    }
  }
  return [...seen.values()]
    .sort((a, b) => b.area - a.area)
    .slice(0, FIELDS_PER_SPAN)
    .map((f) => f.field);
}

function recountSpan(
  seq: FlashSequence,
  track: FlashTrack,
  span: Span,
  options: { field?: { width: number; height: number }; areaLimit?: number; judgeFromMs?: number },
): { segment: MotionSegment; fieldFails: boolean; residualFails: boolean } {
  const { times } = seq;
  const { k0, k1 } = span;
  const fromMs = times[span.runs[0]!.from]! - WINDOW_MS;
  const toMs = times[k1]!;
  const region = unionBoxes(span.runs.map((r) => r.region));
  const first = seq.frame(k0);
  const { width, height } = first;

  // 1. Each failing field's mean colour, as one pixel.
  let fieldTransitions = 0;
  for (const field of spanFields(span)) {
    // Only the windows the first pass judged: frames before a span's start are history here too.
    const mean = createFlashJudge({
      width: 1,
      height: 1,
      areaLimit: 0,
      ...(options.judgeFromMs !== undefined ? { judgeFromMs: options.judgeFromMs } : {}),
    });
    for (let k = k0; k <= k1; k++) {
      const blocks = seq.blocks?.(k);
      mean.push(
        k - k0,
        times[k]!,
        blocks ? meanFromBlocks(blocks, field, width, height) : meanFlashFrame(seq.frame(k), field),
      );
    }
    const r = mean.result()[track];
    fieldTransitions = Math.max(fieldTransitions, r.peak.transitions);
    if (r.failing.length > 0) {
      return {
        segment: { fromMs, toMs, region, fieldTransitions, residualArea: null, explainedShare: null, velocity: null },
        fieldFails: true,
        residualFails: true,
      };
    }
  }

  // 2. The residual, tracked along each block's motion.
  const limit = options.areaLimit ?? AREA_LIMIT_CSS2;
  const field = options.field ?? FIELD_CSS;
  const searchBox = grow(region, MOTION_SEARCH + 2, width, height);
  const encoded = encodedFrames(seq, searchBox);
  const history = createBlockHistory(region);
  // Each frame's block motion (the motion into k0 too, so the first re-counted frame knows what was
  // already moving), with the next frame's for the count (to tell content replaced under motion
  // from a step). The reversal gate needs reversals that come after a frame, so the count runs
  // again where it untrusts anything; frames are decoded a second time only then.
  const kEnd = Math.min(k1 + 1, times.length - 1);
  const motions: BlockMotion[] = [];
  const intoFirst: BlockMotion | null = k0 > 0 ? blockMotion(encoded, times, k0, region, null, history) : null;
  let previous = intoFirst;
  const motionAt = (k: number): BlockMotion | null => {
    if (k === k0) return intoFirst;
    if (k > kEnd) return null;
    while (motions.length < k - k0) {
      previous = blockMotion(encoded, times, k0 + 1 + motions.length, region, previous, history);
      motions.push(previous);
    }
    return motions[k - k0 - 1]!;
  };
  const count = () => {
    const tracker = createTracker(track, region, first, times, limit, field, searchBox, options.judgeFromMs);
    const vx: number[] = [];
    const vy: number[] = [];
    let moved = 0;
    for (let k = k0 + 1; k <= k1; k++) {
      const motion = motionAt(k)!;
      const next = motionAt(k + 1);
      const before = motionAt(k - 1);
      tracker.step(k, seq.frame(k - 1), seq.frame(k), encoded.at(k - 1).e, encoded.at(k).e, before, motion, next);
      moved += motion.moved;
      for (let b = 0; b < motion.trusted.length; b++) {
        if (!motion.trusted[b]) continue;
        vx.push(motion.dx[b]!);
        vy.push(motion.dy[b]!);
      }
    }
    return { out: tracker.result(), vx, vy, moved };
  };
  let counted = count();
  // Untrusting only adds steps, so a count that already fails stands.
  if (!counted.out.failing && untrustReversals(motions, k0 + 1, times, history)) counted = count();
  const { out, vx, vy, moved } = counted;
  return {
    segment: {
      fromMs,
      toMs,
      region,
      fieldTransitions,
      residualArea: out.worstArea,
      explainedShare: out.explainedShare,
      velocity: commonVelocity(vx, vy, moved, (toMs - times[k0]!) / Math.max(1, k1 - k0)),
    },
    fieldFails: false,
    residualFails: out.failing,
  };
}

/**
 * A block moving back and forth is shaking, not travelling: wherever more than six of its reversals
 * fall within a second, its motion is untrusted from the jump before the first of them to the last.
 * Decided over the whole span, so a shake is untrusted from its start rather than once seven
 * reversals have gone by excused.
 */
function untrustReversals(
  motions: readonly BlockMotion[],
  firstK: number,
  times: readonly number[],
  history: ReturnType<typeof createBlockHistory>,
): boolean {
  const need = MAX_TRANSITIONS + 1;
  let any = false;
  for (let b = 0; b < history.reversals.length; b++) {
    const r = history.reversals[b]!;
    for (let j = 0; j + need - 1 < r.length; j++) {
      if (r[j + need - 1]! - r[j]! >= WINDOW_MS - EPS) continue;
      const from = r[j]! - REVERSAL_MS - EPS;
      const to = r[j + need - 1]! + EPS;
      for (let i = 0; i < motions.length; i++) {
        const t = times[firstK + i]!;
        if (t >= from && t <= to && motions[i]!.trusted[b]) {
          motions[i]!.trusted[b] = 0;
          any = true;
        }
      }
    }
  }
  return any;
}

/**
 * The trusted blocks' median displacement, per second, when at least half of every block that
 * moved (trusted or not, frame by frame) is within 1.5px a frame of it.
 */
function commonVelocity(vx: number[], vy: number[], moved: number, frameMs: number): { x: number; y: number } | null {
  if (vx.length === 0) return null;
  const mid = (d: number[]) => [...d].sort((a, b) => a - b)[d.length >> 1]!;
  const mx = mid(vx);
  const my = mid(vy);
  let near = 0;
  for (let i = 0; i < vx.length; i++) if (Math.hypot(vx[i]! - mx, vy[i]! - my) <= 1.5) near++;
  if (near * 2 < moved || (mx === 0 && my === 0)) return null;
  return { x: Math.round((mx * 1000) / frameMs), y: Math.round((my * 1000) / frameMs) };
}

/**
 * The per-pixel judge of `flash.ts`, with each pixel's state carried along its block's motion:
 * gathered from the pixel the motion brings it from, then stepped by what the motion does not
 * explain. Where no motion is trusted the state stays put and steps by the whole change, as the
 * first count did — and moves on with the content when its motion is trusted again, so a texture
 * that jumps back and forth while it drifts returns to its own state, not to a neighbour's.
 * Content replaced under motion (what was here moved on by trusted motion, and what is here now
 * moves on by the next frame's) starts a history of its own instead: a frame's edge as a slide
 * enters, the band uncovered behind an object.
 */
function createTracker(
  track: FlashTrack,
  region: Box,
  first: FlashFrame,
  times: readonly number[],
  limit: number,
  field: { width: number; height: number },
  sb: Box,
  judgeFrom?: number,
) {
  const W = region.width;
  const H = region.height;
  const n = W * H;
  const SW = sb.width;
  const fw = Math.min(field.width, W);
  const fh = Math.min(field.height, H);
  const general = track === "general";
  // Only the track's own fields have pixels: every one is copied every frame.
  const make = (g = general ? n : 0, r = general ? 0 : n) => ({
    // General: tracked luminance, leg start and extreme, direction, whether the leg counted.
    V: new Float64Array(g),
    A: new Float64Array(g),
    E: new Float64Array(g),
    dir: new Int8Array(g),
    counted: new Uint8Array(g),
    // Red: tracked u′v′, the anchor, saturated anchor, the state an uncounted move left.
    U: new Float32Array(r),
    Q: new Float32Array(r),
    au: new Float32Array(r),
    av: new Float32Array(r),
    asat: new Uint8Array(r),
    fu: new Float32Array(r),
    fv: new Float32Array(r),
    pend: new Uint8Array(r),
    // The last RING transition frames, and how many of the newest were stepped where the state is now.
    ring: new Uint16Array(n * RING),
    head: new Uint8Array(n),
    count: new Uint8Array(n),
    dwell: new Uint8Array(n),
    // Where the content the state tracks is, relative to its pixel, in px (about ±0.5).
    ox: new Float32Array(n),
    oy: new Float32Array(n),
  });
  type State = ReturnType<typeof make>;
  const columns = (s: State) =>
    general
      ? [s.V, s.A, s.E, s.dir, s.counted, s.head, s.count, s.dwell, s.ox, s.oy]
      : [s.U, s.Q, s.au, s.av, s.asat, s.fu, s.fv, s.pend, s.head, s.count, s.dwell, s.ox, s.oy];
  let st = make();
  let nx = make();
  let stCols = columns(st);
  let nxCols = columns(nx);
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const p = y * W + x;
      const g = (region.y + y) * first.width + region.x + x;
      if (general) {
        st.V[p] = st.A[p] = st.E[p] = first.lum[g]!;
      } else {
        st.U[p] = st.au[p] = first.u[g]!;
        st.Q[p] = st.av[p] = first.v[g]!;
        st.asat[p] = first.sat[g]!;
      }
    }
  }
  let failing = false;
  let worstArea = 0;
  let changed = 0;
  let explained = 0;
  /** The pixels trusted motion takes content from: of frame k − 1 by `motion` into k. */
  const carried = (motion: BlockMotion): Uint8Array => {
    const out = new Uint8Array(n);
    for (let b = 0; b < motion.trusted.length; b++) {
      if (!motion.trusted[b]) continue;
      const bx = (b % motion.cols) * MOTION_BLOCK;
      const by = Math.floor(b / motion.cols) * MOTION_BLOCK;
      const ox = Math.round(-motion.dx[b]!);
      const oy = Math.round(-motion.dy[b]!);
      for (let y = by; y < Math.min(H, by + MOTION_BLOCK); y++) {
        const ty = y + oy;
        if (ty < 0 || ty >= H) continue;
        const xa = Math.max(bx, -ox);
        const xb = Math.min(Math.min(W, bx + MOTION_BLOCK), W - ox);
        if (xb > xa) out.fill(1, ty * W + xa + ox, ty * W + xb + ox);
      }
    }
    return out;
  };
  let carriedNext: { of: BlockMotion; mask: Uint8Array } | null = null;
  /**
   * The place ring, beside the content state and never moved: the last RING transition frames
   * each screen pixel took in place, kept there when the content that took them moves on — every
   * in-place step a gather carries off (below), and a level step taken under content that
   * travels on (`step`). A pixel flashes when its content's ring does, or when its place does
   * (`placeFlashes`: the ring and the steps the state there now took in place). A place layer
   * that replaced the content state lost a teleport while drifting; this one only adds to it.
   */
  const placeRing = new Uint16Array(n * RING);
  const placeHead = new Uint8Array(n);
  const placeCount = new Uint8Array(n);
  let placed = false;
  /** Frame k onto p's place ring, in time order and once: a trimmed step is older than the frame. */
  const place = (p: number, k: number) => {
    const o = p * RING;
    const c = placeCount[p]!;
    const h = placeHead[p]!;
    placed = true;
    if (c === 0 || placeRing[o + ((h - 1 + RING) % RING)]! < k) {
      placeRing[o + h] = k;
      placeHead[p] = (h + 1) % RING;
      if (c < RING) placeCount[p] = c + 1;
      return;
    }
    const all: number[] = [];
    for (let i = 0; i < c; i++) {
      const f = placeRing[o + ((h - c + i + RING * 2) % RING)]!;
      if (f === k) return;
      all.push(f);
    }
    all.push(k);
    all.sort((a, b) => a - b);
    const keep = all.slice(-RING);
    for (let i = 0; i < keep.length; i++) placeRing[o + i] = keep[i]!;
    placeCount[p] = keep.length;
    placeHead[p] = keep.length % RING;
  };

  /** `len` pixels of state from `from` (in `st`) to `to` (in `nx`). */
  const copyRun = (to: number, from: number, len: number) => {
    for (let i = 0; i < stCols.length; i++) nxCols[i]!.set(stCols[i]!.subarray(from, from + len), to);
    nx.ring.set(st.ring.subarray(from * RING, (from + len) * RING), to * RING);
  };
  /**
   * `copyRun` for content trusted motion takes on. Steps made in place belong to the place: a
   * stock sees card after card appear on it, and the card that leaves takes only the step that
   * showed it, not those of the cards before it. Every one of them goes onto the place ring of the
   * pixel it was taken at, the one the content takes included. Lost, text stepping 4px every 15
   * frames over a 6 Hz strobe read as motion with residual 0; with only the steps the content
   * leaves (two of every three), 5,313; with all of them, and those of the state now there, the
   * screen pixels that showed background through three of the four dwells in a second flash
   * (27,232).
   */
  const gatherRun = (to: number, from: number, len: number) => {
    copyRun(to, from, len);
    for (let p = to; p < to + len; p++) {
      const d = nx.dwell[p]!;
      if (d === 0) continue;
      nx.dwell[p] = 0;
      const c = nx.count[p]!;
      const o = p * RING;
      const h = nx.head[p]!;
      const src = from + (p - to);
      for (let i = c - d; i < c; i++) {
        place(src, nx.ring[o + ((h - c + i + RING * 2) % RING)]!);
      }
      if (d === 1) continue;
      const newest = nx.ring[o + ((h - 1 + RING) % RING)]!;
      const kept = c - d + 1;
      // The oldest c − d stay, in order, then the newest.
      const old: number[] = [];
      for (let i = 0; i < c - d; i++) old.push(nx.ring[o + ((h - c + i + RING * 2) % RING)]!);
      for (let i = 0; i < c - d; i++) nx.ring[o + i] = old[i]!;
      nx.ring[o + kept - 1] = newest;
      nx.count[p] = kept;
      nx.head[p] = kept % RING;
    }
  };
  const fresh = (to: number, L: number, u: number, v: number, sat: number) => {
    if (general) {
      nx.V[to] = nx.A[to] = nx.E[to] = L;
      nx.dir[to] = 0;
      nx.counted[to] = 0;
    } else {
      nx.U[to] = nx.au[to] = u;
      nx.Q[to] = nx.av[to] = v;
      nx.asat[to] = sat;
      nx.pend[to] = 0;
    }
    nx.head[to] = 0;
    nx.count[to] = 0;
    nx.dwell[to] = 0;
    nx.ox[to] = 0;
    nx.oy[to] = 0;
  };
  const push = (p: number, k: number) => {
    nx.ring[p * RING + nx.head[p]!] = k;
    nx.head[p] = (nx.head[p]! + 1) % RING;
    if (nx.count[p]! < RING) nx.count[p]!++;
  };
  /** flash.ts's zig-zag, on the tracked value. */
  const stepGeneral = (p: number, L: number): boolean => {
    const s = nx;
    const d = s.dir[p]!;
    if (d === 0) {
      if (L < s.A[p]!) s.A[p] = L;
      if (L > s.E[p]!) s.E[p] = L;
      if (s.E[p]! - s.A[p]! < LUMINANCE_STEP - EPS) return false;
      const rising = L === s.E[p];
      const start = rising ? s.A[p]! : s.E[p]!;
      s.A[p] = start;
      s.E[p] = L;
      s.dir[p] = rising ? 1 : -1;
      s.counted[p] = Math.min(start, L) < DARKER_BELOW ? 1 : 0;
      return s.counted[p] === 1;
    }
    if (d === 1) {
      if (L > s.E[p]!) {
        s.E[p] = L;
        if (!s.counted[p] && s.E[p]! - s.A[p]! >= LUMINANCE_STEP - EPS && s.A[p]! < DARKER_BELOW) {
          s.counted[p] = 1;
          return true;
        }
        return false;
      }
      if (s.E[p]! - L < LUMINANCE_STEP - EPS) return false;
      s.A[p] = s.E[p]!;
      s.E[p] = L;
      s.dir[p] = -1;
      s.counted[p] = L < DARKER_BELOW ? 1 : 0;
      return s.counted[p] === 1;
    }
    if (L < s.E[p]!) {
      s.E[p] = L;
      if (!s.counted[p] && s.A[p]! - s.E[p]! >= LUMINANCE_STEP - EPS && s.E[p]! < DARKER_BELOW) {
        s.counted[p] = 1;
        return true;
      }
      return false;
    }
    if (L - s.E[p]! < LUMINANCE_STEP - EPS) return false;
    s.A[p] = s.E[p]!;
    s.E[p] = L;
    s.dir[p] = 1;
    s.counted[p] = s.A[p]! < DARKER_BELOW ? 1 : 0;
    return s.counted[p] === 1;
  };
  /** flash.ts's red rule, on the tracked u′v′ (sat from the pixel as drawn). */
  const stepRed = (p: number, u: number, v: number, sat: number): boolean => {
    const s = nx;
    const du = u - s.au[p]!;
    const dv = v - s.av[p]!;
    let hit = false;
    if (du * du + dv * dv > RED_UV_STEP * RED_UV_STEP) {
      if (s.asat[p] || sat) {
        hit = true;
        s.pend[p] = 0;
      } else {
        s.fu[p] = s.au[p]!;
        s.fv[p] = s.av[p]!;
        s.pend[p] = 1;
      }
      s.au[p] = u;
      s.av[p] = v;
      s.asat[p] = sat;
    } else if (sat) {
      s.asat[p] = 1;
      if (s.pend[p]) {
        const eu = u - s.fu[p]!;
        const ev = v - s.fv[p]!;
        if (eu * eu + ev * ev > RED_UV_STEP * RED_UV_STEP) {
          hit = true;
          s.pend[p] = 0;
        }
      }
    }
    return hit;
  };
  /** Step the state at p by a residual: (rl) in luminance, or (ru, rv) in u′v′. */
  const stepBy = (p: number, rl: number, ru: number, rv: number, sat: number): boolean => {
    if (general) {
      nx.V[p] = Math.min(1, Math.max(0, nx.V[p]! + rl));
      return stepGeneral(p, nx.V[p]!);
    }
    nx.U[p] = nx.U[p]! + ru;
    nx.Q[p] = nx.Q[p]! + rv;
    return stepRed(p, nx.U[p]!, nx.Q[p]!, sat);
  };
  // A sub-pixel prediction, bilinear at a position in frame coordinates, clamped to the search box
  // (which holds every source the search can name, and every pixel beside the region).
  const sx0 = sb.x;
  const sy0 = sb.y;
  const sx1 = sb.x + sb.width - 1;
  const sy1 = sb.y + sb.height - 1;
  /** Encoded luminance `e` (over the search box), bilinear at (px, py). */
  const sampleE = (e: Float32Array, px: number, py: number): number => {
    const ix = Math.floor(px);
    const iy = Math.floor(py);
    const ax = px - ix;
    const ay = py - iy;
    const xa = Math.min(sx1, Math.max(sx0, ix)) - sx0;
    const xb = Math.min(sx1, Math.max(sx0, ix + 1)) - sx0;
    const ya = (Math.min(sy1, Math.max(sy0, iy)) - sy0) * SW;
    const yb = (Math.min(sy1, Math.max(sy0, iy + 1)) - sy0) * SW;
    return (1 - ay) * ((1 - ax) * e[ya + xa]! + ax * e[ya + xb]!) + ay * ((1 - ax) * e[yb + xa]! + ax * e[yb + xb]!);
  };
  // The red track's prediction is of light: linear XYZ, bilinear, back to u′v′.
  let pX = 0;
  let pY = 0;
  let pZ = 0;
  const addXyz = (f: FlashFrame, q: number, w: number) => {
    const L = f.lum[q]!;
    const v = f.v[q]!;
    if (w === 0 || L <= 0 || v <= 0) return;
    const u = f.u[q]!;
    pX += (w * L * 9 * u) / (4 * v);
    pY += w * L;
    pZ += (w * L * (12 - 3 * u - 20 * v)) / (4 * v);
  };
  /** `f` bilinear in linear XYZ at (px, py), as u′v′ in pu, pv. */
  let pu = 0;
  let pv = 0;
  // The backward prediction's step (`step`'s `backward`).
  let backL = 0;
  let backU = 0;
  let backV = 0;
  let backErr = 0;
  const tolerance = general ? PREDICT_L : PREDICT_UV;
  const sampleUv = (f: FlashFrame, px: number, py: number) => {
    const ix = Math.floor(px);
    const iy = Math.floor(py);
    const ax = px - ix;
    const ay = py - iy;
    const xa = Math.min(sx1, Math.max(sx0, ix));
    const xb = Math.min(sx1, Math.max(sx0, ix + 1));
    const ya = Math.min(sy1, Math.max(sy0, iy)) * f.width;
    const yb = Math.min(sy1, Math.max(sy0, iy + 1)) * f.width;
    pX = pY = pZ = 0;
    addXyz(f, ya + xa, (1 - ax) * (1 - ay));
    addXyz(f, ya + xb, ax * (1 - ay));
    addXyz(f, yb + xa, (1 - ax) * ay);
    addXyz(f, yb + xb, ax * ay);
    const d = pX + 15 * pY + 3 * pZ;
    if (d < 1e-12) {
      pu = WHITE_UV[0];
      pv = WHITE_UV[1];
    } else {
      pu = (4 * pX) / d;
      pv = (9 * pY) / d;
    }
  };

  return {
    step(
      k: number,
      prev: FlashFrame,
      cur: FlashFrame,
      ePrev: Float32Array,
      eCur: Float32Array,
      before: BlockMotion | null,
      motion: BlockMotion,
      next: BlockMotion | null,
    ): void {
      let any = false;
      placed = false;
      const FW = cur.width;
      const FH = cur.height;
      /**
       * The backward prediction (prev from cur, as the matcher also tries) at the source pixels of
       * frame pixel g, whose source is (sx, sy): a layer at a half-pixel offset is rendered blurred
       * and at a whole one sharp, and only the sharp frame, resampled, gives the blurred one.
       * Whether it reproduces every source pixel; and in `backL` (or `backU`, `backV`) the step at
       * g that would make it, by least squares over their weights: the step as the sharper frame
       * shows it, where the forward residual carries the sharpening as well.
       */
      const backward = (g: number, sx: number, sy: number, ddx: number, ddy: number): boolean => {
        const ix = Math.floor(sx);
        const iy = Math.floor(sy);
        const ax = sx - ix;
        const ay = sy - iy;
        let fits = true;
        backErr = 0;
        let num = 0;
        let numV = 0;
        let den = 0;
        for (let j = 0; j <= 1; j++) {
          const wy = j === 0 ? 1 - ay : ay;
          if (wy === 0) continue;
          const qy = Math.min(FH - 1, Math.max(0, iy + j));
          for (let i = 0; i <= 1; i++) {
            const wx = i === 0 ? 1 - ax : ax;
            if (wx === 0) continue;
            const w = wx * wy;
            const qx = Math.min(FW - 1, Math.max(0, ix + i));
            const q = qy * FW + qx;
            let e: number;
            if (general) {
              const pb = sampleE(eCur, qx + ddx, qy + ddy);
              e = Math.abs(prev.lum[q]! - decode(pb));
              num += w * (ePrev[(qy - sy0) * SW + qx - sx0]! - pb);
            } else {
              sampleUv(cur, qx + ddx, qy + ddy);
              const eu = prev.u[q]! - pu;
              const ev = prev.v[q]! - pv;
              e = Math.hypot(eu, ev);
              num += w * eu;
              numV += w * ev;
            }
            if (e > tolerance) fits = false;
            if (e > backErr) backErr = e;
            den += w * w;
          }
        }
        if (general) {
          const gy = Math.floor(g / FW);
          backL = cur.lum[g]! - decode(eCur[(gy - sy0) * SW + g - gy * FW - sx0]! + num / den);
        } else {
          backU = -num / den;
          backV = -numV / den;
        }
        return fits;
      };
      // Content that left a pixel by trusted motion, and content that leaves it by the next frame's.
      const leaving = carriedNext?.of === motion ? carriedNext.mask : carried(motion);
      const arriving = next ? carried(next) : null;
      carriedNext = next && arriving ? { of: next, mask: arriving } : null;
      /** Whether frame k's pixel g differs from k − 1's, as this track sees it. */
      const differs = general
        ? (g: number) => cur.lum[g] !== prev.lum[g]
        : (g: number) => cur.u[g] !== prev.u[g] || cur.v[g] !== prev.v[g] || cur.sat[g] !== prev.sat[g];
      for (let by = 0; by < motion.rows; by++) {
        const y0 = by * MOTION_BLOCK;
        const y1 = Math.min(H, y0 + MOTION_BLOCK);
        // Blocks side by side with the same motion are one run of pixels per row.
        for (let bx = 0; bx < motion.cols;) {
          const b = by * motion.cols + bx;
          const trusted = motion.trusted[b] === 1;
          const ddx = motion.dx[b]!;
          const ddy = motion.dy[b]!;
          let ex = bx + 1;
          while (ex < motion.cols) {
            const e = by * motion.cols + ex;
            if ((motion.trusted[e] === 1) !== trusted) break;
            if (trusted && (motion.dx[e] !== ddx || motion.dy[e] !== ddy)) break;
            ex++;
          }
          const x0 = bx * MOTION_BLOCK;
          const x1 = Math.min(W, ex * MOTION_BLOCK);
          bx = ex;
          if (!trusted) {
            for (let y = y0; y < y1; y++) {
              copyRun(y * W + x0, y * W + x0, x1 - x0);
              const row = (region.y + y) * FW + region.x;
              for (let x = x0; x < x1; x++) {
                const g = row + x;
                if (!differs(g)) continue;
                const p = y * W + x;
                changed++;
                if (leaving[p] && arriving?.[p]) {
                  fresh(p, cur.lum[g]!, cur.u[g]!, cur.v[g]!, cur.sat[g]!);
                  explained++;
                  continue;
                }
                const hit = general
                  ? stepBy(p, cur.lum[g]! - prev.lum[g]!, 0, 0, 0)
                  : stepBy(p, 0, cur.u[g]! - prev.u[g]!, cur.v[g]! - prev.v[g]!, cur.sat[g]!);
                if (hit) {
                  push(p, k);
                  if (nx.dwell[p]! < RING) nx.dwell[p]!++;
                  any = true;
                  // A level step under content that travels on, trusted the frame before and the
                  // frame after: the content takes the step out of a strobing box it crosses in
                  // under a second, so the place keeps it too. Never every step taken in place:
                  // the deal's translucent flights, untrusted throughout, then read as a flash
                  // (26,390).
                  const b2 = by * motion.cols + ((x / MOTION_BLOCK) | 0);
                  if (before?.trusted[b2] && next?.trusted[b2]) place(p, k);
                }
              }
            }
            continue;
          }
          const nox = Math.round(-ddx);
          const noy = Math.round(-ddy);
          const whole = Number.isInteger(ddx) && Number.isInteger(ddy);
          for (let y = y0; y < y1; y++) {
            const row = (region.y + y) * FW + region.x;
            const sy = region.y + y - ddy;
            const ya = Math.max(0, Math.floor(sy));
            /** Each pixel of [xs, xe) after it took its state: step it by what the motion does not explain. */
            const settle = (xs: number, xe: number) => {
              for (let x = xs; x < xe; x++) {
                const g = row + x;
                const p = y * W + x;
                const moved = differs(g);
                if (moved) changed++;
                let rl = 0;
                let ru = 0;
                let rv = 0;
                if (whole) {
                  const q = ya * FW + region.x + x - ddx;
                  if (general) rl = cur.lum[g]! - prev.lum[q]!;
                  else {
                    ru = cur.u[g]! - prev.u[q]!;
                    rv = cur.v[g]! - prev.v[q]!;
                  }
                } else {
                  // Between pixels, the step is what neither prediction reproduces: the source
                  // resampled (forward), or the source pixels resampled from this frame (backward).
                  // Not the range of the source pixels: beside ink, a strobe's step toward the
                  // darker level lands inside it, and a light strobe behind text moving 2.5px a
                  // frame was explained.
                  // What neither reproduces is the smaller of the two residuals.
                  const sx = region.x + x - ddx;
                  if (general) {
                    rl = cur.lum[g]! - decode(sampleE(ePrev, sx, sy));
                    if (Math.abs(rl) <= PREDICT_L || backward(g, sx, sy, ddx, ddy)) rl = 0;
                    else if (backErr + PREDICT_L < Math.abs(rl)) rl = backL;
                  } else {
                    sampleUv(prev, sx, sy);
                    ru = cur.u[g]! - pu;
                    rv = cur.v[g]! - pv;
                    if (Math.hypot(ru, rv) <= PREDICT_UV || backward(g, sx, sy, ddx, ddy)) ru = rv = 0;
                    else if (backErr + PREDICT_UV < Math.hypot(ru, rv)) {
                      ru = backU;
                      rv = backV;
                    }
                  }
                }
                if (general ? rl === 0 : ru === 0 && rv === 0) {
                  if (moved) explained++;
                  if (!general && cur.sat[g] && !nx.asat[p]) nx.asat[p] = 1;
                  continue;
                }
                if (stepBy(p, rl, ru, rv, cur.sat[g]!)) {
                  push(p, k);
                  any = true;
                }
              }
            };
            // Each pixel takes the state whose content the motion brings to it: the source pixel
            // nearest the displacement, moved by where in that pixel its content sits. Rounding
            // the displacement alone slid every state half a pixel a frame along content moving
            // 2.5px a frame (Math.round rounds every .5 up), off the content it was counting.
            // Pixels whose source lies outside the region arrive from outside it and are new.
            let start = -1;
            let rox = 0;
            let roy = 0;
            for (let x = x0; x <= x1; x++) {
              let ox = 0;
              let oy = 0;
              let inside = false;
              if (x < x1) {
                const nsx = x + nox;
                const nsy = y + noy;
                if (nsx >= 0 && nsx < W && nsy >= 0 && nsy < H) {
                  const ns = nsy * W + nsx;
                  ox = Math.round(-ddx - st.ox[ns]!);
                  oy = Math.round(-ddy - st.oy[ns]!);
                  inside = x + ox >= 0 && x + ox < W && y + oy >= 0 && y + oy < H;
                }
              }
              if (start >= 0 && (!inside || ox !== rox || oy !== roy)) {
                gatherRun(y * W + start, (y + roy) * W + start + rox, x - start);
                for (let p = y * W + start; p < y * W + x; p++) {
                  nx.ox[p] = nx.ox[p]! + rox + ddx;
                  nx.oy[p] = nx.oy[p]! + roy + ddy;
                }
                settle(start, x);
                start = -1;
              }
              if (x === x1) break;
              if (!inside) {
                const g = row + x;
                fresh(y * W + x, cur.lum[g]!, cur.u[g]!, cur.v[g]!, cur.sat[g]!);
                continue;
              }
              if (start < 0) {
                start = x;
                rox = ox;
                roy = oy;
              }
            }
          }
        }
      }
      const swap = st;
      st = nx;
      nx = swap;
      const swapCols = stCols;
      stCols = nxCols;
      nxCols = swapCols;
      if (judgeFrom === undefined || times[k]! >= judgeFrom - EPS) {
        // The first frame on the judged start is judged whatever stepped there; after it, as usual.
        const first = judgeFrom !== undefined && (k === 0 || times[k - 1]! < judgeFrom - EPS);
        if (any || placed || first) evaluate(k);
      } else if (k + 1 >= times.length || times[k + 1]! > judgeFrom + EPS) {
        // The judged start falls after this frame, before the next: its window holds what this frame's state does.
        evaluate(k, judgeFrom);
      }
    },
    result() {
      return { failing, worstArea, explainedShare: changed === 0 ? 0 : explained / changed };
    },
  };

  /**
   * Whether the steps taken at screen pixel p hold `back` after `from`: its place ring, and the
   * steps the state there now took in place, which reach the ring only when it leaves.
   */
  function placeFlashes(p: number, from: number, back: number): boolean {
    const c = placeCount[p]!;
    const d = st.dwell[p]!;
    if (c + d < back) return false;
    const o = p * RING;
    let i = 0;
    let j = 0;
    let m = 0;
    while (i < c || j < d) {
      const a = i < c ? placeRing[o + ((placeHead[p]! - 1 - i + RING * 2) % RING)]! : -1;
      const b = j < d ? st.ring[o + ((st.head[p]! - 1 - j + RING * 2) % RING)]! : -1;
      let f: number;
      if (a >= b) {
        f = a;
        i++;
        if (a === b) j++;
      } else {
        f = b;
        j++;
      }
      if (times[f]! <= from) return false;
      if (++m >= back) return true;
    }
    return false;
  }

  function evaluate(k: number, end = times[k]!) {
    const from = end - WINDOW_MS + EPS;
    const back = MAX_TRANSITIONS + 1;
    // Two frames of reference, two areas: what flashes on the content as it moves, and what
    // flashes at a place on the screen. Measured together, the solitaire deal's stock (a place)
    // and its cards (content) made one area a newer renderer could tip over the limit.
    const content = new Uint8Array(n);
    const place = new Uint8Array(n);
    const cb = [W, H, -1, -1];
    const pb = [W, H, -1, -1];
    const grow = (b: number[], x: number, y: number) => {
      if (x < b[0]!) b[0] = x;
      if (y < b[1]!) b[1] = y;
      if (x > b[2]!) b[2] = x;
      if (y > b[3]!) b[3] = y;
    };
    for (let p = 0; p < n; p++) {
      const y = (p / W) | 0;
      const x = p - y * W;
      if (st.count[p]! >= back && times[st.ring[p * RING + ((st.head[p]! - back + RING * 2) % RING)]!]! > from) {
        content[p] = 1;
        grow(cb, x, y);
      }
      if (placeFlashes(p, from, back)) {
        place[p] = 1;
        grow(pb, x, y);
      }
    }
    for (const [mask, b] of [
      [content, cb],
      [place, pb],
    ] as const) {
      const [x0, y0, x1, y1] = b as number[];
      if (x1! < 0) continue;
      if ((x1! - x0! + 1) * (y1! - y0! + 1) <= worstArea) continue;
      const closed = closeMask(mask, W, H, x0!, y0!, x1!, y1!);
      const area = bestField(closed, W, H, fw, fh, x0!, y0!, x1!, y1!).area;
      worstArea = Math.max(worstArea, area);
      if (area > limit) failing = true;
    }
  }
}

/** Per block, what it last did: its last estimated motion and when, and its recent reversals. */
function createBlockHistory(region: Box) {
  const cols = Math.ceil(region.width / MOTION_BLOCK);
  const rows = Math.ceil(region.height / MOTION_BLOCK);
  const n = cols * rows;
  return {
    lastDx: new Float32Array(n),
    lastDy: new Float32Array(n),
    lastK: new Int32Array(n).fill(-1),
    reversals: Array.from({ length: n }, () => [] as number[]),
  };
}

function grow(box: Box, by: number, width: number, height: number): Box {
  const x = Math.max(0, box.x - by);
  const y = Math.max(0, box.y - by);
  return {
    x,
    y,
    width: Math.min(width, box.x + box.width + by) - x,
    height: Math.min(height, box.y + box.height + by) - y,
  };
}

/** `box` of `frame` as a frame of its own. */
export function cropFlashFrame(frame: FlashFrame, box: Box): FlashFrame {
  const n = box.width * box.height;
  const out: FlashFrame = {
    width: box.width,
    height: box.height,
    lum: new Float64Array(n),
    u: new Float32Array(n),
    v: new Float32Array(n),
    sat: new Uint8Array(n),
  };
  for (let y = 0; y < box.height; y++) {
    const from = (box.y + y) * frame.width + box.x;
    out.lum.set(frame.lum.subarray(from, from + box.width), y * box.width);
    out.u.set(frame.u.subarray(from, from + box.width), y * box.width);
    out.v.set(frame.v.subarray(from, from + box.width), y * box.width);
    out.sat.set(frame.sat.subarray(from, from + box.width), y * box.width);
  }
  return out;
}

/** sRGB-encoded relative luminance: a grey's channel value / 255. */
function encode(L: number): number {
  return L <= 0.0031308 ? 12.92 * L : 1.055 * Math.pow(L, 1 / 2.4) - 0.055;
}

const DECODE_STEPS = 4096;
// color.ts's linearisation, the one definition of it (tests/contrast-single-definition.test.mjs).
const DECODE = Float64Array.from({ length: DECODE_STEPS + 2 }, (_, i) =>
  srgbChannelToLinear(Math.min(1, i / DECODE_STEPS) * 255),
);
/** `encode` undone, from a table: it runs for every pixel that moves by part of a pixel. */
function decode(e: number): number {
  const t = Math.min(1, Math.max(0, e)) * DECODE_STEPS;
  const i = Math.floor(t);
  return DECODE[i]! + (DECODE[i + 1]! - DECODE[i]!) * (t - i);
}

interface Encoded {
  /** Values over `box` (frame coordinates), row-major. */
  e: Float32Array;
  coarse?: { w: number; h: number; e: Float32Array };
}

/** Each frame's encoded luminance over `box`, the last few kept. */
function encodedFrames(seq: FlashSequence, box: Box) {
  const cache = new Map<number, Encoded>();
  const keep = 4;
  const at = (k: number): Encoded => {
    let hit = cache.get(k);
    if (hit) return hit;
    const f = seq.frame(k);
    const e = new Float32Array(box.width * box.height);
    for (let y = 0; y < box.height; y++) {
      const row = (box.y + y) * f.width + box.x;
      for (let x = 0; x < box.width; x++) e[y * box.width + x] = encode(f.lum[row + x]!);
    }
    hit = { e };
    cache.set(k, hit);
    if (cache.size > keep) {
      let oldest = Infinity;
      for (const key of cache.keys()) oldest = Math.min(oldest, key);
      cache.delete(oldest);
    }
    return hit;
  };
  const coarseOf = (enc: Encoded) => {
    if (enc.coarse) return enc.coarse;
    const w = Math.floor(box.width / COARSE);
    const h = Math.floor(box.height / COARSE);
    const e = new Float32Array(w * h);
    for (let cy = 0; cy < h; cy++) {
      for (let cx = 0; cx < w; cx++) {
        let s = 0;
        for (let y = cy * COARSE; y < (cy + 1) * COARSE; y++) {
          for (let x = cx * COARSE; x < (cx + 1) * COARSE; x++) s += enc.e[y * box.width + x]!;
        }
        e[cy * w + cx] = s / (COARSE * COARSE);
      }
    }
    enc.coarse = { w, h, e };
    return enc.coarse;
  };
  return { box, at, coarseOf };
}

interface BlockMotion {
  cols: number;
  rows: number;
  /** How many blocks changed at all. */
  moved: number;
  /** The displacement that reproduces each block, when one was found (`est`). */
  dx: Float32Array;
  dy: Float32Array;
  est: Uint8Array;
  /** Whether that displacement may excuse the block's steps (it passed every gate). */
  trusted: Uint8Array;
}

/**
 * Each 16x16 block of `region` at frame k: the displacement from frame k − 1 that reproduces it,
 * to a quarter or third of a pixel, and whether it may excuse the block's steps (the module comment's
 * gates, against `previous`, the motion into frame k − 1, and `history`).
 */
function blockMotion(
  encoded: ReturnType<typeof encodedFrames>,
  times: readonly number[],
  k: number,
  region: Box,
  previous: BlockMotion | null,
  history: ReturnType<typeof createBlockHistory>,
): BlockMotion {
  const cols = Math.ceil(region.width / MOTION_BLOCK);
  const rows = Math.ceil(region.height / MOTION_BLOCK);
  const dx = new Float32Array(cols * rows);
  const dy = new Float32Array(cols * rows);
  const est = new Uint8Array(cols * rows);
  const trusted = new Uint8Array(cols * rows);
  const sb = encoded.box;
  const SW = sb.width;
  const curEnc = encoded.at(k);
  const prevEnc = encoded.at(k - 1);
  const cur = curEnc.e;
  const prev = prevEnc.e;

  interface Bounds {
    x0: number;
    y0: number;
    x1: number;
    y1: number;
    n: number;
  }
  // Block bounds in search-box coordinates.
  const bounds = (b: number): Bounds => {
    const bx = b % cols;
    const by = Math.floor(b / cols);
    const x0 = region.x - sb.x + bx * MOTION_BLOCK;
    const y0 = region.y - sb.y + by * MOTION_BLOCK;
    const x1 = Math.min(region.x - sb.x + region.width, x0 + MOTION_BLOCK);
    const y1 = Math.min(region.y - sb.y + region.height, y0 + MOTION_BLOCK);
    return { x0, y0, x1, y1, n: (x1 - x0) * (y1 - y0) };
  };
  /**
   * Sum of |cur(x) − prev(x − d)| over the block (bilinear for a fractional d), scaled to the whole
   * block from the part whose source lies in the box: content arriving at the frame's edge has no
   * source there, and the block is matched on the rest of it. Infinity when less than half is left.
   */
  const sad = (bb: Bounds, ddx: number, ddy: number, limit = Infinity): number => {
    const ix = Math.floor(ddx);
    const iy = Math.floor(ddy);
    const fx = ddx - ix;
    const fy = ddy - iy;
    // prev(x − d) reads columns x − ix − 1 .. x − ix when fractional.
    const needX = fx > 0 ? 1 : 0;
    const needY = fy > 0 ? 1 : 0;
    const x0 = Math.max(bb.x0, ix + needX);
    const y0 = Math.max(bb.y0, iy + needY);
    const x1 = Math.min(bb.x1, SW + ix);
    const y1 = Math.min(bb.y1, sb.height + iy);
    const n = Math.max(0, x1 - x0) * Math.max(0, y1 - y0);
    if (n * 2 < bb.n) return Infinity;
    const scale = bb.n / n;
    let s = 0;
    if (needX === 0 && needY === 0) {
      const stop = limit / scale;
      for (let y = y0; y < y1; y++) {
        const row = y * SW;
        const src = (y - iy) * SW - ix;
        for (let x = x0; x < x1; x++) s += Math.abs(cur[row + x]! - prev[src + x]!);
        if (s >= stop) return s * scale;
      }
      return s * scale;
    }
    // x − d = x − ix − fx: between column (x − ix − 1) at weight fx and (x − ix) at 1 − fx.
    const w00 = (1 - fx) * (1 - fy);
    const w10 = fx * (1 - fy);
    const w01 = (1 - fx) * fy;
    const w11 = fx * fy;
    for (let y = y0; y < y1; y++) {
      const row = y * SW;
      const a = (y - iy) * SW - ix;
      const c = (y - iy - needY) * SW - ix;
      for (let x = x0; x < x1; x++) {
        const v = w00 * prev[a + x]! + w10 * prev[a + x - needX]! + w01 * prev[c + x]! + w11 * prev[c + x - needX]!;
        s += Math.abs(cur[row + x]! - v);
      }
      if (s * scale >= limit) break;
    }
    s *= scale;
    if (s < limit) limit = s;
    // The other way round: prev(y) = cur(y + d). A layer moved by part of a pixel is rendered
    // blurred and by a whole one sharp, and only the sharp frame, resampled, gives the blurred one.
    // It reads cur at y + j and, with weight, one column or row before: both inside the block, or
    // the one before it, which must be in the box.
    const jx = ix + needX;
    const jy = iy + needY;
    const px0 = Math.max(bb.x0 - jx, 0, needX - jx);
    const py0 = Math.max(bb.y0 - jy, 0, needY - jy);
    const px1 = Math.min(bb.x1 - jx, SW);
    const py1 = Math.min(bb.y1 - jy, sb.height);
    const m = Math.max(0, px1 - px0) * Math.max(0, py1 - py0);
    if (m * 2 < bb.n) return s;
    const tscale = bb.n / m;
    let t = 0;
    // y + d = y + jx − (1 − fx): between column (y + jx − 1) at weight 1 − fx and (y + jx) at fx.
    for (let y = py0; y < py1; y++) {
      const row = y * SW;
      const a = (y + jy) * SW + jx;
      const c = (y + jy - needY) * SW + jx;
      for (let x = px0; x < px1; x++) {
        let v: number;
        if (needX && needY) {
          v =
            fx * fy * cur[a + x]! +
            (1 - fx) * fy * cur[a + x - 1]! +
            fx * (1 - fy) * cur[c + x]! +
            (1 - fx) * (1 - fy) * cur[c + x - 1]!;
        } else if (needX) {
          v = fx * cur[a + x]! + (1 - fx) * cur[a + x - 1]!;
        } else {
          v = fy * cur[a + x]! + (1 - fy) * cur[c + x]!;
        }
        t += Math.abs(prev[row + x]! - v);
      }
      if (t * tscale >= limit) return s;
    }
    return Math.min(s, t * tscale);
  };

  const sad0 = new Float64Array(cols * rows);
  const textured = new Uint8Array(cols * rows);
  const moved = new Uint8Array(cols * rows);
  // The block's own change with its mean taken out: what a level change in place leaves.
  const level = new Float64Array(cols * rows);
  for (let b = 0; b < cols * rows; b++) {
    const bb = bounds(b);
    let s0 = 0;
    let sum = 0;
    let sum2 = 0;
    let dsum = 0;
    for (let y = bb.y0; y < bb.y1; y++) {
      for (let x = bb.x0; x < bb.x1; x++) {
        const v = cur[y * SW + x]!;
        const d = v - prev[y * SW + x]!;
        s0 += Math.abs(d);
        dsum += d;
        sum += v;
        sum2 += v * v;
      }
    }
    sad0[b] = s0;
    moved[b] = s0 > 0 ? 1 : 0;
    const m = sum / bb.n;
    textured[b] = Math.sqrt(Math.max(0, sum2 / bb.n - m * m)) >= TEXTURE_STD ? 1 : 0;
    const dm = dsum / bb.n;
    let l = 0;
    for (let y = bb.y0; y < bb.y1; y++) {
      for (let x = bb.x0; x < bb.x1; x++) l += Math.abs(cur[y * SW + x]! - prev[y * SW + x]! - dm);
    }
    level[b] = l;
  }

  const matches = (b: number, bb: Bounds, ddx: number, ddy: number, s: number): boolean =>
    (ddx !== 0 || ddy !== 0) && s / bb.n <= MATCH_MEAN && s < MATCH_GAIN * sad0[b]!;

  /** The gates past the match (module comment) but reversals, which `untrustReversals` applies over the span. */
  const coherent = (b: number, bb: Bounds, ddx: number, ddy: number, s: number): boolean => {
    if (level[b]! <= s) return false;
    // A pattern moved by half its period matches the other way as well: it has no direction, and
    // is seen to flicker (counterphase), not to move.
    if (Math.hypot(ddx, ddy) >= REVERSAL_PX && matches(b, bb, -ddx, -ddy, sad(bb, -ddx, -ddy))) return false;
    const bx = b % cols;
    const by = Math.floor(b / cols);
    // Where this block's content was, and whether it was moving there at about this speed.
    const cx = (bx + 0.5) * MOTION_BLOCK - ddx;
    const cy = (by + 0.5) * MOTION_BLOCK - ddy;
    const sx = Math.floor(cx / MOTION_BLOCK);
    const sy = Math.floor(cy / MOTION_BLOCK);
    // Against the motion of the block the content came from, and of this block a frame ago (the
    // same part of the screen moving on): content arriving from where motion was not estimated —
    // beyond the frame's edge — has only the second.
    let jump = Math.hypot(ddx, ddy);
    if (previous && sx >= 0 && sy >= 0 && sx < cols && sy < rows && previous.est[sy * cols + sx]) {
      jump = Math.min(jump, Math.hypot(ddx - previous.dx[sy * cols + sx]!, ddy - previous.dy[sy * cols + sx]!));
    }
    if (previous && previous.est[b]) jump = Math.min(jump, Math.hypot(ddx - previous.dx[b]!, ddy - previous.dy[b]!));
    return jump <= MOTION_JERK_PX;
  };

  /** Record a block's estimated motion: a reversal of its own last one counts against it. */
  const remember = (b: number, ddx: number, ddy: number) => {
    const lk = history.lastK[b]!;
    if (lk >= 0 && times[k]! - times[lk]! <= REVERSAL_MS + EPS) {
      const lx = history.lastDx[b]!;
      const ly = history.lastDy[b]!;
      // A quarter turn or more: a shake around a square path turns 90° at every jump.
      if (ddx * lx + ddy * ly <= 0 && Math.hypot(ddx, ddy) >= REVERSAL_PX && Math.hypot(lx, ly) >= REVERSAL_PX) {
        history.reversals[b]!.push(times[k]!);
      }
    }
    history.lastDx[b] = ddx;
    history.lastDy[b] = ddy;
    history.lastK[b] = k;
  };

  // Textured blocks: candidates first (the block's own motion a frame ago, its decided
  // neighbours'), each refined by ±2 px; a coarse search over the whole range only when none
  // matches; then a quarter- and third-pixel refinement.
  for (let b = 0; b < cols * rows; b++) {
    if (!moved[b] || !textured[b]) continue;
    const bb = bounds(b);
    let best = sad0[b]!;
    let bdx = 0;
    let bdy = 0;
    // Ties go to the shorter displacement: content uniform along one axis matches every offset
    // along it, and the shortest is the motion an eye would see.
    const tryAt = (ddx: number, ddy: number) => {
      if (Math.abs(ddx) > MOTION_SEARCH || Math.abs(ddy) > MOTION_SEARCH) return;
      const s = sad(bb, ddx, ddy, best + 1e-9);
      if (s < best - 1e-9 || (s <= best + 1e-9 && Math.hypot(ddx, ddy) < Math.hypot(bdx, bdy))) {
        best = s;
        bdx = ddx;
        bdy = ddy;
      }
    };
    const refine = (cx: number, cy: number, r: number) => {
      for (let oy = -r; oy <= r; oy++) for (let ox = -r; ox <= r; ox++) tryAt(cx + ox, cy + oy);
    };
    const fractional = () => {
      const ix = Math.round(bdx);
      const iy = Math.round(bdy);
      for (const fy of FRACTIONS) for (const fx of FRACTIONS) tryAt(ix + fx, iy + fy);
    };
    const seeds: Array<[number, number]> = [];
    if (previous && previous.est[b]) seeds.push([previous.dx[b]!, previous.dy[b]!]);
    const bx = b % cols;
    const by = Math.floor(b / cols);
    for (const [ox, oy] of [
      [-1, 0],
      [-1, -1],
      [0, -1],
      [1, -1],
    ] as const) {
      if (bx + ox < 0 || bx + ox >= cols || by + oy < 0) continue;
      const nb = (by + oy) * cols + bx + ox;
      if (est[nb]) seeds.push([dx[nb]!, dy[nb]!]);
    }
    // Coherent motion: a seed taken as it is usually matches outright.
    for (const [cx, cy] of seeds) tryAt(cx, cy);
    const seeded = best < sad0[b]!;
    if (!seeded || best / bb.n > MATCH_MEAN / 2) {
      for (const [cx, cy] of seeds) refine(Math.round(cx), Math.round(cy), 2);
      refine(0, 0, 2);
      fractional();
    }
    if (best / bb.n > MATCH_MEAN) {
      const pc = encoded.coarseOf(prevEnc);
      const cc = encoded.coarseOf(curEnc);
      const cx0 = Math.floor(bb.x0 / COARSE);
      const cy0 = Math.floor(bb.y0 / COARSE);
      const cx1 = Math.min(cc.w, Math.max(cx0 + 1, Math.floor(bb.x1 / COARSE)));
      const cy1 = Math.min(cc.h, Math.max(cy0 + 1, Math.floor(bb.y1 / COARSE)));
      const R = MOTION_SEARCH / COARSE;
      let cbest = Infinity;
      let cdx = 0;
      let cdy = 0;
      for (let oy = -R; oy <= R; oy++) {
        if (cy0 - oy < 0 || cy1 - oy > pc.h) continue;
        for (let ox = -R; ox <= R; ox++) {
          if (cx0 - ox < 0 || cx1 - ox > pc.w) continue;
          // Summed until past the best, never stopped at it: a sum left at an exact match's 0 would tie.
          let s = 0;
          for (let y = cy0; y < cy1 && s <= cbest; y++) {
            for (let x = cx0; x < cx1; x++) s += Math.abs(cc.e[y * cc.w + x]! - pc.e[(y - oy) * pc.w + x - ox]!);
          }
          if (s < cbest || (s === cbest && Math.hypot(ox, oy) < Math.hypot(cdx, cdy))) {
            cbest = s;
            cdx = ox;
            cdy = oy;
          }
        }
      }
      refine(cdx * COARSE, cdy * COARSE, COARSE);
      fractional();
    }
    if (!matches(b, bb, bdx, bdy, best)) continue;
    dx[b] = bdx;
    dy[b] = bdy;
    est[b] = 1;
    if (coherent(b, bb, bdx, bdy, best)) trusted[b] = 1;
  }

  // Blocks without texture borrow a neighbour's motion when it reproduces them as well.
  for (let pass = 0; pass < 2; pass++) {
    for (let b = 0; b < cols * rows; b++) {
      if (!moved[b] || est[b]) continue;
      const bb = bounds(b);
      const bx = b % cols;
      const by = Math.floor(b / cols);
      let best = Infinity;
      let bdx = 0;
      let bdy = 0;
      for (let oy = -1; oy <= 1; oy++) {
        for (let ox = -1; ox <= 1; ox++) {
          if (ox === 0 && oy === 0) continue;
          if (bx + ox < 0 || bx + ox >= cols || by + oy < 0 || by + oy >= rows) continue;
          const nb = (by + oy) * cols + bx + ox;
          if (!trusted[nb]) continue;
          const s = sad(bb, dx[nb]!, dy[nb]!, best);
          if (s < best) {
            best = s;
            bdx = dx[nb]!;
            bdy = dy[nb]!;
          }
        }
      }
      if (best === Infinity || !matches(b, bb, bdx, bdy, best)) continue;
      dx[b] = bdx;
      dy[b] = bdy;
      est[b] = 1;
      if (coherent(b, bb, bdx, bdy, best)) trusted[b] = 1;
    }
  }
  for (let b = 0; b < cols * rows; b++) if (est[b]) remember(b, dx[b]!, dy[b]!);
  let movedCount = 0;
  for (let b = 0; b < cols * rows; b++) movedCount += moved[b]!;
  return { cols, rows, moved: movedCount, dx, dy, est, trusted };
}
