/**
 * Flicker that motion explains, told apart from flashing, from the pixels alone.
 *
 * `flash.ts` counts at each pixel, which is literal: every moving high-contrast detail flickers at
 * each pixel it crosses, so scrolling text "flashes" 51 times a second over a whole field. An eye
 * that tracks the text sees no flicker at all. So a failing window is re-counted with motion
 * compensated, and only what is left decides.
 *
 * Three tests, and a failure needs only one of them:
 *
 * 1. **The field as a whole.** The failing field's mean colour (in linear light) is run through the
 *    same judge as one pixel. Nothing that only moves changes a field's mean at 7 transitions a
 *    second, and a uniform strobe does whatever moves in front of it: a ticker over a full-screen
 *    strobe is a flash because the field's mean strobes, not because of anything a motion estimate
 *    says about the ticker.
 * 2. **The residual.** Each step is compared with the previous frame moved by the motion of its
 *    16x16 block. A step that the moved frame reproduces (within the min/max of a 3x3 neighbourhood
 *    there, so a sub-pixel edge counts) is motion: it is not counted, and the pixel's state starts
 *    again from the new value. The re-count is judged exactly as the first one was (area, field,
 *    closing); a residual over the limit is a flash.
 * 3. **The region.** A strobing layer behind moving text reaches no one pixel whole — text crosses
 *    each pixel between the strobe's steps, and every crossing starts the pixel again — and its
 *    falling steps land between ink and background, which the neighbourhood test accepts as a
 *    blend. So each frame also collects, by direction, the steps of 0.1 or more that motion does not
 *    account for: unexplained ones, and in a block that moved AND shifted in level (its mean
 *    motion-compensated step one-signed, ≥ 0.03), every pixel stepping that way. More than the
 *    limit in a field is a region transition; more than six alternating ones in a second is a flash.
 *    Pure motion leaves edge errors of both signs, which cancel in a block's mean.
 *
 * What may establish motion is deliberately narrow, because every excuse is a way to pass a strobe:
 *
 * - a block that has texture (luminance spread ≥ 0.03), moved by a nonzero displacement, matching
 *   to a mean residual ≤ 0.04 and to less than half the residual of not moving at all (a level
 *   change adds to both alike, so it cannot pass the second; 0.04 rather than 0.03 because a card
 *   fading in as it flies changes ~0.025 a frame on top of its rotation, and the solitaire deal's
 *   residual was 16,807 px² of the 21,824 limit at 0.03 and 10,825 at 0.04);
 * - a block without texture only by borrowing a neighbour's motion that matches it as well (a
 *   glyph's trailing edge leaves a plain block behind it);
 * - never a block that returns to what it was 2-6 frames before: a box teleporting back and forth,
 *   stripes inverting, stripes scrolling by half their period per frame all look like motion to a
 *   block match and are flicker to the eye.
 *
 * A plain region appearing or disappearing therefore never counts as motion, however it is
 * animated (`transform: scale(0)` included), and DOM attribution plays no part: it can only name
 * what moved.
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
  WINDOW_MS,
  type FlashFrame,
  type FrameBlocks,
  type FlashRun,
  type FlashTrack,
} from "./flash.ts";
import type { Box } from "./storyboard.ts";

/** Block side, in CSS px. */
export const MOTION_BLOCK = 16;
/** Largest displacement searched per frame, in CSS px (a carousel slide moves ~90px a frame at its fastest). */
export const MOTION_SEARCH = 160;
/** Frames before a window that the re-count starts from, so a pixel's state is warm when the window opens. */
export const MOTION_LEAD_MS = 250;
/** At most this many failing runs are re-counted, the largest first. */
export const MOTION_SEGMENTS = 4;
/** Window ends re-counted per run. */
export const MOTION_RUN_MS = 2000;

/** A block content returning within this long is flicker: the period of a flash at the 3/s limit. */
export const MOTION_RETURN_MS = 1000 / 3;

// Block matching runs on gamma-encoded luminance (0..1), where a renderer's edge blending is linear.
const TEXTURE_STD = 0.03;
const MATCH_MEAN = 0.04;
const MATCH_GAIN = 0.5;
const RETURN_MEAN = 0.01;
const FRACTIONS = [-0.5, -0.25, 0, 0.25, 0.5];
// The explanation test runs on relative luminance and u′v′, which the judge counts in.
const ENVELOPE = 0.05;
const UV_ENVELOPE = 0.05;
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
  /** Where the re-count ran: every flashing pixel of the run, and its fields. */
  region: Box;
  /** Transitions of the field's mean colour in the window (7 or more is a flash). */
  fieldTransitions: number;
  /** Area left after motion compensation, in its best field (the run's own area when the field's mean decided it). */
  residualArea: number;
  /**
   * The most frames in a second whose unexplained transitions, one way, cover more than the limit
   * in a field: a layer strobing behind what moves in front of it, which no one pixel sees whole.
   */
  regionTransitions: number;
  /** Changed pixel steps in the region that motion explained, 0..1. */
  explainedShare: number;
  /** The median displacement of the blocks that moved, in CSS px per second; null when none did. */
  velocity: { x: number; y: number } | null;
}

export interface MotionVerdict {
  classification: "flash" | "motion";
  /**
   * `field`: the field's mean strobes. `residual`: pixels still flash after compensation.
   * `region`: unexplained transitions over the limit alternate more than six times a second.
   * `explained`: none of these.
   */
  reason: "field" | "residual" | "region" | "explained";
  segments: MotionSegment[];
}

/**
 * The runs to re-count, at most `MOTION_SEGMENTS`: largest area first, in frame order. Each is
 * re-counted from a window and a lead before its first failing window, for at most
 * `MOTION_RUN_MS` of window ends: a strobe that runs for ten seconds is the same strobe after two.
 */
export function pickRuns(runs: readonly FlashRun[]): FlashRun[] {
  return [...runs]
    .sort((a, b) => b.area - a.area || a.from - b.from)
    .slice(0, MOTION_SEGMENTS)
    .sort((a, b) => a.from - b.from);
}

/**
 * Classify a track's failing runs: `flash` when any re-counted run still fails, by either test;
 * `motion` when motion explains every one of them.
 */
export function classifyFlash(
  seq: FlashSequence,
  track: FlashTrack,
  runs: readonly FlashRun[],
  options: { field?: { width: number; height: number }; areaLimit?: number } = {},
): MotionVerdict {
  const segments: MotionSegment[] = [];
  let reason: MotionVerdict["reason"] = "explained";
  // One run left flashing decides the track, so the re-count stops there.
  for (const run of pickRuns(runs)) {
    const segment = recount(seq, track, run, options);
    segments.push(segment.result);
    if (segment.fieldFails) reason = "field";
    else if (segment.residualFails) reason = "residual";
    else if (segment.regionFails) reason = "region";
    if (reason !== "explained") break;
  }
  return { classification: reason === "explained" ? "motion" : "flash", reason, segments };
}

function recount(
  seq: FlashSequence,
  track: FlashTrack,
  run: FlashRun,
  options: { field?: { width: number; height: number }; areaLimit?: number },
): { result: MotionSegment; fieldFails: boolean; residualFails: boolean; regionFails?: boolean } {
  const { times } = seq;
  const startMs = times[run.from]! - WINDOW_MS - MOTION_LEAD_MS;
  let k0 = run.from;
  while (k0 > 0 && times[k0 - 1]! >= startMs - EPS) k0--;
  let k1 = run.from;
  while (k1 < run.to && times[k1 + 1]! <= times[run.from]! + MOTION_RUN_MS + EPS) k1++;
  const fromMs = times[run.from]! - WINDOW_MS;
  const toMs = times[k1]!;
  const region = run.region;

  // 1. The field's mean colour, as one pixel.
  const mean = createFlashJudge({ width: 1, height: 1, areaLimit: 0 });
  const size = seq.frame(k0);
  for (let k = k0; k <= k1; k++) {
    const blocks = seq.blocks?.(k);
    const one = blocks
      ? meanFromBlocks(blocks, run.field, size.width, size.height)
      : meanFlashFrame(seq.frame(k), run.field);
    mean.push(k - k0, times[k]!, one);
  }
  const meanTrack = mean.result()[track];
  const fieldTransitions = meanTrack.peak.transitions;
  const fieldFails = meanTrack.failing.length > 0;
  if (fieldFails) {
    return {
      result: {
        fromMs,
        toMs,
        region,
        fieldTransitions,
        residualArea: run.area,
        regionTransitions: 0,
        explainedShare: 0,
        velocity: null,
      },
      fieldFails,
      residualFails: true,
    };
  }

  // 2. The residual, re-counted over the region with each block's motion compensated.
  const first = seq.frame(k0);
  const { width, height } = first;
  const residual = createFlashJudge({
    width: region.width,
    height: region.height,
    field: options.field ?? FIELD_CSS,
    areaLimit: options.areaLimit ?? AREA_LIMIT_CSS2,
  });
  residual.push(0, times[k0]!, cropFlashFrame(first, region));
  const searchBox = grow(region, MOTION_SEARCH + 2, width, height);
  const encoded = encodedFrames(seq, searchBox);
  let changed = 0;
  let explainedSteps = 0;
  const limit = options.areaLimit ?? AREA_LIMIT_CSS2;
  const fieldSize = options.field ?? FIELD_CSS;
  const events: Array<{ k: number; dirs: number }> = [];
  const vx: number[] = [];
  const vy: number[] = [];
  let prevMotion: BlockMotion | null = null;
  for (let k = k0 + 1; k <= k1; k++) {
    const prev = seq.frame(k - 1);
    const cur = seq.frame(k);
    const motion = blockMotion(encoded, times, k, region, prevMotion);
    prevMotion = motion;
    const explained = new Uint8Array(region.width * region.height);
    // Unexplained steps that are a transition in one frame, by direction (toward / away from red).
    const up = new Uint8Array(region.width * region.height);
    const down = new Uint8Array(region.width * region.height);
    let ups = 0;
    let downs = 0;
    const bit = track === "general" ? 1 : 2;
    // A block that moved AND shifted in level: the mean of its motion-compensated steps is
    // one-signed. A strobe behind moving text is this; the edge errors of pure motion cancel.
    const shift = track === "general" ? levelShift(prev, cur, region, motion) : null;
    for (let y = 0; y < region.height; y++) {
      for (let x = 0; x < region.width; x++) {
        const gx = region.x + x;
        const gy = region.y + y;
        const p = gy * width + gx;
        if (cur.lum[p] === prev.lum[p] && cur.u[p] === prev.u[p] && cur.v[p] === prev.v[p]) continue;
        changed++;
        const b = Math.floor(y / MOTION_BLOCK) * motion.cols + Math.floor(x / MOTION_BLOCK);
        const why = motion.trusted[b] ? envelope(prev, cur, gx, gy, motion.dx[b]!, motion.dy[b]!) : 0;
        explained[y * region.width + x] = why;
        const q = y * region.width + x;
        if (shift && shift[b] !== 0) {
          // The step the motion does not account for, at this pixel.
          const before = sampleLum(prev, gx - motion.dx[b]!, gy - motion.dy[b]!);
          const c = cur.lum[p]!;
          if (shift[b]! > 0 && c - before >= LUMINANCE_STEP - EPS && before < DARKER_BELOW) ((up[q] = 1), ups++);
          else if (shift[b]! < 0 && before - c >= LUMINANCE_STEP - EPS && c < DARKER_BELOW) ((down[q] = 1), downs++);
        }
        if (why & bit) {
          explainedSteps++;
          continue;
        }
        if (up[q] || down[q]) continue;
        if (track === "general") {
          const a = prev.lum[p]!;
          const c = cur.lum[p]!;
          if (c - a >= LUMINANCE_STEP - EPS && a < DARKER_BELOW) ((up[q] = 1), ups++);
          else if (a - c >= LUMINANCE_STEP - EPS && c < DARKER_BELOW) ((down[q] = 1), downs++);
        } else {
          const du = cur.u[p]! - prev.u[p]!;
          const dv = cur.v[p]! - prev.v[p]!;
          if (du * du + dv * dv > RED_UV_STEP * RED_UV_STEP && (cur.sat[p] || prev.sat[p])) {
            if (cur.sat[p]) ((up[q] = 1), ups++);
            else ((down[q] = 1), downs++);
          }
        }
      }
    }
    const dirs =
      (regionEvent(up, ups, region, limit, fieldSize) ? 1 : 0) |
      (regionEvent(down, downs, region, limit, fieldSize) ? 2 : 0);
    if (dirs) events.push({ k, dirs });
    for (let b = 0; b < motion.trusted.length; b++) {
      if (!motion.trusted[b]) continue;
      vx.push(motion.dx[b]!);
      vy.push(motion.dy[b]!);
    }
    residual.push(k - k0, times[k]!, cropFlashFrame(cur, region), explained);
  }
  const res = residual.result()[track];
  const residualArea = res.worst ? res.worst.area : 0;
  const regionTransitions = countRegionTransitions(events, times);
  const perSecond = (d: number[]) => {
    const sorted = [...d].sort((a, b) => a - b);
    const frameMs = (toMs - times[k0]!) / Math.max(1, k1 - k0);
    return Math.round((sorted[sorted.length >> 1]! * 1000) / frameMs);
  };
  return {
    result: {
      fromMs,
      toMs,
      region,
      fieldTransitions,
      residualArea,
      regionTransitions,
      explainedShare: changed === 0 ? 0 : explainedSteps / changed,
      velocity: vx.length === 0 ? null : { x: perSecond(vx), y: perSecond(vy) },
    },
    fieldFails,
    residualFails: res.failing.length > 0,
    regionFails: regionTransitions > MAX_TRANSITIONS,
  };
}

/**
 * Whether the unexplained transitions of one frame in one direction cover more than the limit
 * inside some field (closed first, as the judge closes its flashing pixels).
 */
function regionEvent(
  mask: Uint8Array,
  count: number,
  region: Box,
  limit: number,
  field: { width: number; height: number },
): boolean {
  if (count === 0) return false;
  let x0 = region.width;
  let y0 = region.height;
  let x1 = -1;
  let y1 = -1;
  for (let q = 0; q < mask.length; q++) {
    if (!mask[q]) continue;
    const y = Math.floor(q / region.width);
    const x = q - y * region.width;
    if (x < x0) x0 = x;
    if (x > x1) x1 = x;
    if (y < y0) y0 = y;
    if (y > y1) y1 = y;
  }
  if ((x1 - x0 + 1) * (y1 - y0 + 1) <= limit) return false;
  const closed = closeMask(mask, region.width, region.height, x0, y0, x1, y1);
  const fw = Math.min(field.width, region.width);
  const fh = Math.min(field.height, region.height);
  return bestField(closed, region.width, region.height, fw, fh, x0, y0, x1, y1).area > limit;
}

/**
 * The most region transitions in any window (t − 1s, t]. A frame whose unexplained steps go both
 * ways over the limit (a cut) is always one; one that goes the same single way as the event before
 * it continues that leg and is not.
 */
function countRegionTransitions(events: ReadonlyArray<{ k: number; dirs: number }>, times: readonly number[]): number {
  const counted: number[] = [];
  let last = 0;
  for (const e of events) {
    if (e.dirs === 3 || e.dirs !== last) counted.push(times[e.k]!);
    last = e.dirs;
  }
  let most = 0;
  for (let i = 0, j = 0; i < counted.length; i++) {
    while (counted[i]! - counted[j]! >= WINDOW_MS - EPS) j++;
    most = Math.max(most, i - j + 1);
  }
  return most;
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

/**
 * Whether `cur` at (x, y) is `prev` moved by (dx, dy): its luminance (bit 1), and also its u′v′
 * (bit 2), inside the min/max of the neighbourhood the motion brings it from, widened a little.
 * The neighbourhood (3x3, or 4 wide where the source falls between pixels) is what makes a
 * sub-pixel move of an antialiased edge count: its new value is a mixture of neighbours, and a
 * mixture lies between its parts, in luminance and in u′v′ alike.
 */
function envelope(prev: FlashFrame, cur: FlashFrame, x: number, y: number, dx: number, dy: number): number {
  const sx = x - dx;
  const sy = y - dy;
  let lmin = Infinity;
  let lmax = -Infinity;
  let umin = Infinity;
  let umax = -Infinity;
  let wmin = Infinity;
  let wmax = -Infinity;
  const xa = Math.max(0, Math.floor(sx) - 1);
  const xb = Math.min(prev.width - 1, Math.ceil(sx) + 1);
  const ya = Math.max(0, Math.floor(sy) - 1);
  const yb = Math.min(prev.height - 1, Math.ceil(sy) + 1);
  for (let yy = ya; yy <= yb; yy++) {
    for (let xx = xa; xx <= xb; xx++) {
      const q = yy * prev.width + xx;
      const L = prev.lum[q]!;
      const u = prev.u[q]!;
      const v = prev.v[q]!;
      if (L < lmin) lmin = L;
      if (L > lmax) lmax = L;
      if (u < umin) umin = u;
      if (u > umax) umax = u;
      if (v < wmin) wmin = v;
      if (v > wmax) wmax = v;
    }
  }
  if (lmin === Infinity) return 0;
  const p = y * cur.width + x;
  const L = cur.lum[p]!;
  if (L < lmin - ENVELOPE || L > lmax + ENVELOPE) return 0;
  const u = cur.u[p]!;
  const v = cur.v[p]!;
  const chroma =
    u >= umin - UV_ENVELOPE && u <= umax + UV_ENVELOPE && v >= wmin - UV_ENVELOPE && v <= wmax + UV_ENVELOPE;
  return chroma ? 3 : 1;
}

/** A block's mean motion-compensated step must be this far from 0, one way, to count as a level shift. */
const LEVEL_SHIFT = 0.03;

/** `frame`'s luminance at (x, y), bilinear between pixels, clamped to the frame. */
function sampleLum(frame: FlashFrame, x: number, y: number): number {
  const cx = Math.max(0, Math.min(frame.width - 1, x));
  const cy = Math.max(0, Math.min(frame.height - 1, y));
  const x0 = Math.floor(cx);
  const y0 = Math.floor(cy);
  const x1 = Math.min(frame.width - 1, x0 + 1);
  const y1 = Math.min(frame.height - 1, y0 + 1);
  const fx = cx - x0;
  const fy = cy - y0;
  const w = frame.width;
  const L = frame.lum;
  return (
    (1 - fx) * (1 - fy) * L[y0 * w + x0]! +
    fx * (1 - fy) * L[y0 * w + x1]! +
    (1 - fx) * fy * L[y1 * w + x0]! +
    fx * fy * L[y1 * w + x1]!
  );
}

/** Per block: +1 / −1 when its trusted motion leaves a one-signed mean step of LEVEL_SHIFT or more, else 0. */
function levelShift(prev: FlashFrame, cur: FlashFrame, region: Box, motion: BlockMotion): Int8Array {
  const out = new Int8Array(motion.cols * motion.rows);
  for (let b = 0; b < out.length; b++) {
    if (!motion.trusted[b]) continue;
    const bx = (b % motion.cols) * MOTION_BLOCK;
    const by = Math.floor(b / motion.cols) * MOTION_BLOCK;
    let sum = 0;
    let n = 0;
    for (let y = by; y < Math.min(region.height, by + MOTION_BLOCK); y++) {
      for (let x = bx; x < Math.min(region.width, bx + MOTION_BLOCK); x++) {
        const gx = region.x + x;
        const gy = region.y + y;
        sum += cur.lum[gy * cur.width + gx]! - sampleLum(prev, gx - motion.dx[b]!, gy - motion.dy[b]!);
        n++;
      }
    }
    const mean = sum / Math.max(1, n);
    out[b] = mean >= LEVEL_SHIFT ? 1 : mean <= -LEVEL_SHIFT ? -1 : 0;
  }
  return out;
}

/** sRGB-encoded relative luminance: a grey's channel value / 255. */
function encode(L: number): number {
  return L <= 0.0031308 ? 12.92 * L : 1.055 * Math.pow(L, 1 / 2.4) - 0.055;
}

interface Encoded {
  /** Values over `box` (frame coordinates), row-major. */
  e: Float32Array;
  coarse?: { w: number; h: number; e: Float32Array };
}

/** Each frame's encoded luminance over `box`, kept for the frames a return test looks back over. */
function encodedFrames(seq: FlashSequence, box: Box) {
  const cache = new Map<number, Encoded>();
  const keep = Math.ceil((MOTION_RETURN_MS * 60) / 1000) + 4;
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
  dx: Float32Array;
  dy: Float32Array;
  trusted: Uint8Array;
}

/**
 * Each 16x16 block of `region` at frame k: the displacement from frame k − 1 that reproduces it,
 * to a quarter pixel, and whether that displacement may excuse its pixels' steps (see the module
 * comment).
 */
function blockMotion(
  encoded: ReturnType<typeof encodedFrames>,
  times: readonly number[],
  k: number,
  region: Box,
  before: BlockMotion | null,
): BlockMotion {
  const cols = Math.ceil(region.width / MOTION_BLOCK);
  const rows = Math.ceil(region.height / MOTION_BLOCK);
  const dx = new Float32Array(cols * rows);
  const dy = new Float32Array(cols * rows);
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
  /** Sum of |cur(x) − prev(x − d)| over the block (bilinear for a fractional d), Infinity off the box. */
  const sad = (bb: Bounds, ddx: number, ddy: number, limit = Infinity): number => {
    const ix = Math.floor(ddx);
    const iy = Math.floor(ddy);
    const fx = ddx - ix;
    const fy = ddy - iy;
    // prev(x − d) reads columns x − ix − 1 .. x − ix when fractional.
    const needX = fx > 0 ? 1 : 0;
    const needY = fy > 0 ? 1 : 0;
    if (bb.x0 - ix - needX < 0 || bb.y0 - iy - needY < 0 || bb.x1 - ix > SW || bb.y1 - iy > sb.height) return Infinity;
    let s = 0;
    if (needX === 0 && needY === 0) {
      for (let y = bb.y0; y < bb.y1; y++) {
        const row = y * SW;
        const src = (y - iy) * SW - ix;
        for (let x = bb.x0; x < bb.x1; x++) s += Math.abs(cur[row + x]! - prev[src + x]!);
        if (s >= limit) return s;
      }
      return s;
    }
    // x − d = x − ix − fx: between column (x − ix − 1) at weight fx and (x − ix) at 1 − fx.
    const w00 = (1 - fx) * (1 - fy);
    const w10 = fx * (1 - fy);
    const w01 = (1 - fx) * fy;
    const w11 = fx * fy;
    for (let y = bb.y0; y < bb.y1; y++) {
      const row = y * SW;
      const a = (y - iy) * SW - ix;
      const c = (y - iy - needY) * SW - ix;
      for (let x = bb.x0; x < bb.x1; x++) {
        const v = w00 * prev[a + x]! + w10 * prev[a + x - needX]! + w01 * prev[c + x]! + w11 * prev[c + x - needX]!;
        s += Math.abs(cur[row + x]! - v);
      }
      if (s >= limit) break;
    }
    if (s < limit) limit = s;
    // The other way round: prev(y) = cur(y + d). A layer moved by part of a pixel is rendered
    // blurred and by a whole one sharp, and only the sharp frame, resampled, gives the blurred one.
    const jx = ix + needX;
    const jy = iy + needY;
    if (bb.x0 - jx < 0 || bb.y0 - jy < 0 || bb.x1 - jx > SW || bb.y1 - jy > sb.height) return s;
    if (bb.x0 - needX < 0 || bb.y0 - needY < 0) return s;
    let t = 0;
    // y + d = y + jx − (1 − fx): between column (y + jx − 1) at weight 1 − fx and (y + jx) at fx.
    for (let y = bb.y0 - jy; y < bb.y1 - jy; y++) {
      const row = y * SW;
      const a = (y + jy) * SW + jx;
      const c = (y + jy - needY) * SW + jx;
      for (let x = bb.x0 - jx; x < bb.x1 - jx; x++) {
        const v =
          (needX ? fx : 1) * (needY ? fy : 1) * cur[a + x]! +
          (needX ? 1 - fx : 0) * (needY ? fy : 1) * cur[a + x - 1]! +
          (needX ? fx : 1) * (needY ? 1 - fy : 0) * cur[c + x]! +
          (needX ? 1 - fx : 0) * (needY ? 1 - fy : 0) * cur[c + x - 1]!;
        t += Math.abs(prev[row + x]! - v);
      }
      if (t >= limit) return s;
    }
    return Math.min(s, t);
  };
  const sameAs = (bb: Bounds, other: Float32Array): boolean => {
    let s = 0;
    const limit = RETURN_MEAN * bb.n;
    for (let y = bb.y0; y < bb.y1; y++) {
      for (let x = bb.x0; x < bb.x1; x++) s += Math.abs(cur[y * SW + x]! - other[y * SW + x]!);
      if (s > limit) return false;
    }
    return true;
  };

  const sad0 = new Float64Array(cols * rows);
  const textured = new Uint8Array(cols * rows);
  const moved = new Uint8Array(cols * rows);
  for (let b = 0; b < cols * rows; b++) {
    const bb = bounds(b);
    let s0 = 0;
    let sum = 0;
    let sum2 = 0;
    for (let y = bb.y0; y < bb.y1; y++) {
      for (let x = bb.x0; x < bb.x1; x++) {
        const v = cur[y * SW + x]!;
        s0 += Math.abs(v - prev[y * SW + x]!);
        sum += v;
        sum2 += v * v;
      }
    }
    sad0[b] = s0;
    moved[b] = s0 > 0 ? 1 : 0;
    const m = sum / bb.n;
    textured[b] = Math.sqrt(Math.max(0, sum2 / bb.n - m * m)) >= TEXTURE_STD ? 1 : 0;
  }

  const accept = (b: number, bb: Bounds, ddx: number, ddy: number, s: number): boolean =>
    (ddx !== 0 || ddy !== 0) && s / bb.n <= MATCH_MEAN && s < MATCH_GAIN * sad0[b]!;

  // A block back to what it was a moment ago is flicker, not travel.
  const returns = (bb: Bounds): boolean => {
    for (let back = 2; k - back >= 0 && times[k]! - times[k - back]! <= MOTION_RETURN_MS + EPS; back++) {
      if (sameAs(bb, encoded.at(k - back).e)) return true;
    }
    return false;
  };

  // Textured blocks: candidates first (the block's own motion a frame ago, its decided
  // neighbours'), each refined by ±2 px; a coarse search over the whole range only when none
  // matches; then a quarter-pixel refinement.
  for (let b = 0; b < cols * rows; b++) {
    if (!moved[b] || !textured[b]) continue;
    const bb = bounds(b);
    let best = sad0[b]!;
    let bdx = 0;
    let bdy = 0;
    const tryAt = (ddx: number, ddy: number) => {
      if (Math.abs(ddx) > MOTION_SEARCH || Math.abs(ddy) > MOTION_SEARCH) return;
      const s = sad(bb, ddx, ddy, best);
      if (s < best) {
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
    if (before && before.trusted[b]) seeds.push([before.dx[b]!, before.dy[b]!]);
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
      if (trusted[nb]) seeds.push([dx[nb]!, dy[nb]!]);
    }
    // Coherent motion: a seed taken as it is usually matches outright.
    for (const [cx, cy] of seeds) tryAt(cx, cy);
    if (best / bb.n > MATCH_MEAN / 2) {
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
          let s = 0;
          for (let y = cy0; y < cy1 && s < cbest; y++) {
            for (let x = cx0; x < cx1; x++) s += Math.abs(cc.e[y * cc.w + x]! - pc.e[(y - oy) * pc.w + x - ox]!);
          }
          if (s < cbest) {
            cbest = s;
            cdx = ox;
            cdy = oy;
          }
        }
      }
      refine(cdx * COARSE, cdy * COARSE, COARSE);
      fractional();
    }
    if (!accept(b, bb, bdx, bdy, best) || returns(bb)) continue;
    dx[b] = bdx;
    dy[b] = bdy;
    trusted[b] = 1;
  }

  // Blocks without texture borrow a trusted neighbour's motion when it reproduces them as well.
  for (let pass = 0; pass < 2; pass++) {
    for (let b = 0; b < cols * rows; b++) {
      if (!moved[b] || trusted[b]) continue;
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
      if (best === Infinity || !accept(b, bb, bdx, bdy, best)) continue;
      dx[b] = bdx;
      dy[b] = bdy;
      trusted[b] = 1;
    }
  }
  return { cols, rows, dx, dy, trusted };
}
