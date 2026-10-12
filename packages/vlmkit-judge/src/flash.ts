/**
 * WCAG 2.3.1 Three Flashes or Below Threshold, judged over a frame sequence — pure arithmetic over
 * pixels and time, no model.
 *
 * What is measured, as WCAG 2.2 defines it:
 *
 * - **General transition**: a change in relative luminance of 0.1 or more between adjacent peaks
 *   and valleys, where the darker state is below 0.80 (Note 2's "adjacent peaks and valleys").
 *   Each pixel's luminance runs through a zig-zag: a leg is a transition at the first frame where
 *   its extent reaches 0.1 with its darker end below 0.8, and a reversal is confirmed once the
 *   value moves 0.1 back from the leg's extreme.
 * - **Red transition** (Note 3): the colour moves more than 0.2 in CIE 1976 u′v′ and one of the two
 *   states is a saturated red, R/(R+G+B) ≥ 0.8. On top of WCAG's ratio, a state is saturated only
 *   when (R − G − B)·320 > 20 on linear channels (IRIS's red floor): without it, invisible
 *   near-black tints (#000000↔#010000) read as full-field red flashes, because a ratio has no
 *   magnitude.
 * - **Flash count**: a flash is two opposing transitions, so more than three flashes in any one
 *   second is 7 or more transitions inside some window (t − 1 s, t]. General and red are counted
 *   apart ("and/or").
 * - **Area**: the pixels with 7 or more transitions in the window, combined, inside any 341x256
 *   CSS-px rectangle (WCAG's 10° field at 1024x768), may not exceed 25% of it: 21,824 CSS px², the
 *   number G176 states ("smaller than a contiguous area of 21,824 sq pixels (any shape)"). The
 *   Understanding page's sentence "a flashing area of 87,296 CSS pixels" is the whole field; the
 *   criterion's 25% of it is the limit. The rectangle slides over every position.
 *
 * Frames are judged at CSS resolution: device pixels are averaged in linear light into the CSS
 * pixel they make up, which is what the eye integrates. The flashing set is closed with a 3x3
 * element before it is measured, so a dither (half its pixels never change, yet the area flashes
 * as a whole) counts as its region while a solid region's edge stays where it is. WCAG's 0.1°
 * exception for fine balanced patterns is not applied: every way of applying it found here dropped
 * real flash at low-contrast edges or in dithers, so a pattern finer than ~4 CSS px is reported
 * rather than excused.
 *
 * Motion is not decided here: per-pixel counting is literal, and every moving high-contrast detail
 * flickers at each pixel it crosses. `flash-motion.ts` re-counts a failing window with motion
 * compensated.
 */
import { srgbChannelToLinear } from "./color.ts";
import type { Box } from "./storyboard.ts";

export const FLASH_FORMAT = "vlmkit-flash/1";
/** A general transition: relative luminance moves this much between a peak and a valley. */
export const LUMINANCE_STEP = 0.1;
/** ... and the darker of the two is below this. */
export const DARKER_BELOW = 0.8;
/** More than this many transitions in one window is more than three flashes. */
export const MAX_TRANSITIONS = 6;
export const WINDOW_MS = 1000;
/** WCAG's 10° field: 341x256 px at 1024x768, in CSS px. */
export const FIELD_CSS = { width: 341, height: 256 } as const;
/** 25% of the field (G176). */
export const AREA_LIMIT_CSS2 = 21_824;
/** Note 3's saturated red: R/(R+G+B) at or above this. */
export const RED_RATIO = 0.8;
/** ... and the two states more than this apart in u′v′. */
export const RED_UV_STEP = 0.2;
/** A saturated red's magnitude floor: (R − G − B) on linear channels above 20/320. */
export const RED_FLOOR = 20 / 320;
/** Black has no chromaticity; it takes the D65 white point. */
export const WHITE_UV = [0.1978, 0.4683] as const;

/** Transition times kept per pixel: a window's count is reported up to this many (7 is all a verdict needs). */
export const TRANSITIONS_KEPT = 16;
const RING = TRANSITIONS_KEPT;
/** Times are differences of instants on a 60fps grid: within this of a bound is on it. */
const EPS = 1e-6;

export type FlashTrack = "general" | "red";

/** A frame at CSS resolution: relative luminance, chromaticity and saturated-red per pixel. */
export interface FlashFrame {
  width: number;
  height: number;
  lum: Float64Array;
  u: Float32Array;
  v: Float32Array;
  sat: Uint8Array;
  /** Linear-light sums per `BLOCK_SUM` block, when the frame was built from pixels (`flashFrame`). */
  blocks?: FrameBlocks;
}

/** Side of the blocks a frame's light is summed over, in CSS px. */
export const BLOCK_SUM = 16;

/**
 * A frame's CIE XYZ summed over `BLOCK_SUM`-px blocks: a few KB that let a field's mean colour be
 * read without the frame, for every frame of a sweep at once.
 */
export interface FrameBlocks {
  cols: number;
  rows: number;
  X: Float32Array;
  Y: Float32Array;
  Z: Float32Array;
}

const LINEAR = Float64Array.from({ length: 256 }, (_, i) => srgbChannelToLinear(i));

// What a colour comes to, by its 24-bit RGB; shared by every frame (the values are a function of the key).
const COLOUR_SLOTS = 4096;
const colourKey = new Int32Array(COLOUR_SLOTS).fill(-1);
const colourL = new Float64Array(COLOUR_SLOTS);
const colourU = new Float32Array(COLOUR_SLOTS);
const colourV = new Float32Array(COLOUR_SLOTS);
const colourS = new Uint8Array(COLOUR_SLOTS);
const colourX = new Float64Array(COLOUR_SLOTS);
const colourZ = new Float64Array(COLOUR_SLOTS);

/**
 * An RGBA (or, with `channels` 3, RGB) frame of `width x height` device pixels as a `FlashFrame` at
 * CSS resolution: each CSS pixel is the mean, in linear light, of the device pixels it covers.
 */
export function flashFrame(
  rgba: Uint8Array,
  width: number,
  height: number,
  cssPerPx = 1,
  channels: 3 | 4 = 4,
): FlashFrame {
  if (rgba.length !== width * height * channels) {
    throw new Error(`flashFrame: expected ${width * height * channels} bytes, got ${rgba.length}`);
  }
  const C = channels;
  const s = cssPerPx > 0 ? cssPerPx : 1;
  const w = Math.max(1, Math.round(width / s));
  const h = Math.max(1, Math.round(height / s));
  const n = w * h;
  const cols = Math.ceil(w / BLOCK_SUM);
  const rows = Math.ceil(h / BLOCK_SUM);
  const out: FlashFrame = {
    width: w,
    height: h,
    lum: new Float64Array(n),
    u: new Float32Array(n),
    v: new Float32Array(n),
    sat: new Uint8Array(n),
    blocks: {
      cols,
      rows,
      X: new Float32Array(cols * rows),
      Y: new Float32Array(cols * rows),
      Z: new Float32Array(cols * rows),
    },
  };
  const bx = new Float64Array(cols * rows);
  const by = new Float64Array(cols * rows);
  const bz = new Float64Array(cols * rows);
  const sum = (p: number, cx: number, cy: number, r: number, g: number, b: number) => {
    const i = Math.floor(cy / BLOCK_SUM) * cols + Math.floor(cx / BLOCK_SUM);
    bx[i]! += 0.4124564 * r + 0.3575761 * g + 0.1804375 * b;
    by[i]! += out.lum[p]!;
    bz[i]! += 0.0193339 * r + 0.119192 * g + 0.9503041 * b;
  };
  if (s === 1 && w === width && h === height) {
    // One device pixel per CSS pixel, and a screenshot is mostly runs of one colour: a pixel the
    // same as the one before copies it.
    const { lum, u, v, sat } = out;
    for (let y = 0; y < h; y++) {
      const brow = (y >> 4) * cols;
      let last = -1;
      let L = 0;
      let U = 0;
      let V = 0;
      let S = 0;
      let X = 0;
      let Z = 0;
      for (let x = 0; x < w; x++) {
        const p = y * w + x;
        const i = p * C;
        const key = (rgba[i]! << 16) | (rgba[i + 1]! << 8) | rgba[i + 2]!;
        if (key !== last) {
          // Antialiased text repeats a few hundred colours: a direct-mapped cache of them.
          const slot = (key ^ (key >>> 12)) & (COLOUR_SLOTS - 1);
          if (colourKey[slot] === key) {
            L = colourL[slot]!;
            U = colourU[slot]!;
            V = colourV[slot]!;
            S = colourS[slot]!;
            X = colourX[slot]!;
            Z = colourZ[slot]!;
            lum[p] = L;
            u[p] = U;
            v[p] = V;
            sat[p] = S;
          } else {
            const r = LINEAR[rgba[i]!]!;
            const g = LINEAR[rgba[i + 1]!]!;
            const b = LINEAR[rgba[i + 2]!]!;
            writePixel(out, p, r, g, b);
            L = lum[p]!;
            U = u[p]!;
            V = v[p]!;
            S = sat[p]!;
            X = 0.4124564 * r + 0.3575761 * g + 0.1804375 * b;
            Z = 0.0193339 * r + 0.119192 * g + 0.9503041 * b;
            colourKey[slot] = key;
            colourL[slot] = L;
            colourU[slot] = U;
            colourV[slot] = V;
            colourS[slot] = S;
            colourX[slot] = X;
            colourZ[slot] = Z;
          }
          last = key;
        } else {
          lum[p] = L;
          u[p] = U;
          v[p] = V;
          sat[p] = S;
        }
        const bi = brow + (x >> 4);
        bx[bi]! += X;
        by[bi]! += L;
        bz[bi]! += Z;
      }
    }
  } else {
    for (let cy = 0; cy < h; cy++) {
      const y0 = Math.min(height - 1, Math.floor(cy * s));
      const y1 = Math.max(y0 + 1, Math.min(height, Math.floor((cy + 1) * s)));
      for (let cx = 0; cx < w; cx++) {
        const x0 = Math.min(width - 1, Math.floor(cx * s));
        const x1 = Math.max(x0 + 1, Math.min(width, Math.floor((cx + 1) * s)));
        let r = 0;
        let g = 0;
        let b = 0;
        for (let y = y0; y < y1; y++) {
          for (let x = x0; x < x1; x++) {
            const i = (y * width + x) * C;
            r += LINEAR[rgba[i]!]!;
            g += LINEAR[rgba[i + 1]!]!;
            b += LINEAR[rgba[i + 2]!]!;
          }
        }
        const count = (y1 - y0) * (x1 - x0);
        const p = cy * w + cx;
        writePixel(out, p, r / count, g / count, b / count);
        sum(p, cx, cy, r / count, g / count, b / count);
      }
    }
  }
  out.blocks!.X.set(bx);
  out.blocks!.Y.set(by);
  out.blocks!.Z.set(bz);
  return out;
}

/** Luminance, u′v′ and saturated-red of one pixel from its linear r, g, b. */
function writePixel(out: FlashFrame, p: number, r: number, g: number, b: number): void {
  out.lum[p] = 0.2126 * r + 0.7152 * g + 0.0722 * b;
  const X = 0.4124564 * r + 0.3575761 * g + 0.1804375 * b;
  const Y = 0.2126729 * r + 0.7151522 * g + 0.072175 * b;
  const Z = 0.0193339 * r + 0.119192 * g + 0.9503041 * b;
  const d = X + 15 * Y + 3 * Z;
  if (d < 1e-12) {
    out.u[p] = WHITE_UV[0];
    out.v[p] = WHITE_UV[1];
  } else {
    out.u[p] = (4 * X) / d;
    out.v[p] = (9 * Y) / d;
  }
  const sum = r + g + b;
  out.sat[p] = sum > 0 && r / sum >= RED_RATIO && r - g - b > RED_FLOOR ? 1 : 0;
}

/**
 * `box` of `frame` averaged into one pixel, in linear light: the colour the box shows as a whole.
 * Each pixel's linear XYZ is recovered from its luminance and u′v′, so the mean is of light, not
 * of chromaticities.
 */
export function meanFlashFrame(frame: FlashFrame, box: Box): FlashFrame {
  let X = 0;
  let Y = 0;
  let Z = 0;
  for (let y = box.y; y < box.y + box.height; y++) {
    for (let x = box.x; x < box.x + box.width; x++) {
      const p = y * frame.width + x;
      const L = frame.lum[p]!;
      const u = frame.u[p]!;
      const v = frame.v[p]!;
      if (L <= 0 || v <= 0) continue;
      X += (L * 9 * u) / (4 * v);
      Y += L;
      Z += (L * (12 - 3 * u - 20 * v)) / (4 * v);
    }
  }
  const n = Math.max(1, box.width * box.height);
  return fromXyz(X / n, Y / n, Z / n);
}

/**
 * The mean colour of `box` from a frame's block sums alone: the blocks whose centre is inside the
 * box, so the box is read to the nearest 16px. What the motion re-count's field test reads, for
 * every frame of a run, without decoding one.
 */
export function meanFromBlocks(blocks: FrameBlocks, box: Box, width: number, height: number): FlashFrame {
  let X = 0;
  let Y = 0;
  let Z = 0;
  let n = 0;
  for (let r = 0; r < blocks.rows; r++) {
    const y0 = r * BLOCK_SUM;
    const bh = Math.min(BLOCK_SUM, height - y0);
    const cy = y0 + bh / 2;
    if (cy < box.y || cy >= box.y + box.height) continue;
    for (let c = 0; c < blocks.cols; c++) {
      const x0 = c * BLOCK_SUM;
      const bw = Math.min(BLOCK_SUM, width - x0);
      const cx = x0 + bw / 2;
      if (cx < box.x || cx >= box.x + box.width) continue;
      const i = r * blocks.cols + c;
      X += blocks.X[i]!;
      Y += blocks.Y[i]!;
      Z += blocks.Z[i]!;
      n += bw * bh;
    }
  }
  n = Math.max(1, n);
  return fromXyz(X / n, Y / n, Z / n);
}

/** One pixel of mean colour from linear XYZ. */
function fromXyz(X: number, Y: number, Z: number): FlashFrame {
  const out: FlashFrame = {
    width: 1,
    height: 1,
    lum: new Float64Array(1),
    u: new Float32Array(1),
    v: new Float32Array(1),
    sat: new Uint8Array(1),
  };
  const r = Math.max(0, 3.2404542 * X - 1.5371385 * Y - 0.4985314 * Z);
  const g = Math.max(0, -0.969266 * X + 1.8760108 * Y + 0.041556 * Z);
  const b = Math.max(0, 0.0556434 * X - 0.2040259 * Y + 1.0572252 * Z);
  writePixel(out, 0, r, g, b);
  out.lum[0] = Y;
  return out;
}

/** One window: where some field held the most flashing pixels at the frame the window ends on. */
export interface FlashEvaluation {
  /** The frame the window (atMs − 1000, atMs] ends on. */
  frame: number;
  atMs: number;
  /** Flashing CSS px² inside the field, after the 3x3 closing. */
  area: number;
  /** The field (341x256 CSS px, or the frame if smaller) holding the most. */
  field: Box;
  /** The flashing pixels inside that field, as one box. */
  bbox: Box;
  /** The most transitions one pixel of the field had in the window (capped at 16). */
  maxTransitions: number;
  /** That pixel, and the frames of its transitions in the window: what a still strip shows. */
  pixel: { x: number; y: number; frames: number[] };
  /** Every flashing pixel in the frame, as one box: where a motion re-count has to look. */
  maskBox: Box;
}

export interface FlashTrackResult {
  /**
   * Windows whose field held more than the limit, in frame order: the first, every one with a
   * larger area than all before it, and the first at least a window after the last kept one.
   * Consecutive transitions of one strobe each end a failing window; these are the ones that say
   * something different.
   */
  failing: FlashEvaluation[];
  /** How many windows failed in all. */
  failingWindows: number;
  /** The window with the largest area, over the limit or not; null when nothing flashed at all. */
  worst: FlashEvaluation | null;
  /** The largest area at or under the limit. */
  largestBelow: number;
  /** The most transitions any one pixel had in any window, wherever it was, and where. */
  peak: { transitions: number; frame: number; x: number; y: number };
  /** Failing windows that follow one another with no passing one between them, as runs. */
  runs: FlashRun[];
  /**
   * The largest area in any field of the flashing pixels together with the unknown ones, over the
   * windows the measured pixels alone did not fail (0 without `unknown`). Over the limit, a pass
   * cannot be had.
   */
  withUnknown: number;
}

/** Consecutive failing windows: what a motion re-count takes as one stretch. */
export interface FlashRun {
  /** The first and last frames a failing window ended on. */
  from: number;
  to: number;
  /** The largest area in the run, and its field. */
  area: number;
  field: Box;
  /** Every flashing pixel of every window in the run, with their fields, as one box. */
  region: Box;
  /** Each failing window of the run: where it ended, its area and its field. */
  windows: Array<{ frame: number; area: number; field: Box }>;
}

export interface FlashJudgeOptions {
  /** The frames' size in CSS px (a `FlashFrame`'s). */
  width: number;
  height: number;
  field?: { width: number; height: number };
  areaLimit?: number;
  /**
   * Pixels nothing measured (a video, an animated image): they may flash in step with whatever
   * does, so each window that flashes at all is also measured with them counted as flashing
   * (`withUnknown`). Frame-sized, 1 = unknown.
   */
  unknown?: Uint8Array;
}

/** The ring of a pixel's last transition frames, per track. */
class Transitions {
  readonly ring: Uint16Array;
  readonly head: Uint8Array;
  readonly count: Uint8Array;
  constructor(n: number) {
    this.ring = new Uint16Array(n * RING);
    this.head = new Uint8Array(n);
    this.count = new Uint8Array(n);
  }
  push(p: number, frame: number) {
    this.ring[p * RING + this.head[p]!] = frame;
    this.head[p] = (this.head[p]! + 1) % RING;
    if (this.count[p]! < RING) this.count[p]!++;
  }
  /** The frame of pixel p's `back`-th most recent transition (1 = the latest). */
  at(p: number, back: number): number {
    return this.ring[p * RING + ((this.head[p]! - back + RING * 2) % RING)]!;
  }
}

/**
 * Streaming judge: `push` each frame in order, then `result`. State is O(pixels): a zig-zag and a
 * ring of transition times per pixel and track. A pixel unchanged since the last frame costs one
 * compare; the area test runs only at frames where some pixel transitioned, which is where a
 * window's count can reach its maximum.
 */
export function createFlashJudge(options: FlashJudgeOptions) {
  const { width, height } = options;
  const n = width * height;
  const fw = Math.min(options.field?.width ?? FIELD_CSS.width, width);
  const fh = Math.min(options.field?.height ?? FIELD_CSS.height, height);
  const limit = options.areaLimit ?? AREA_LIMIT_CSS2;
  const times: number[] = [];

  // General track: leg start (A) and extreme (E), direction, whether the leg was counted.
  const A = new Float64Array(n);
  const E = new Float64Array(n);
  const dir = new Int8Array(n);
  const counted = new Uint8Array(n);
  // Red track: the anchor state the next red transition is measured from.
  const au = new Float32Array(n);
  const av = new Float32Array(n);
  const asat = new Uint8Array(n);
  // A move of more than 0.2 with no saturated end still moves the anchor, but the state it left is
  // kept: a fade toward red crosses from black to an unsaturated red first, and the saturated red
  // it reaches next is the transition, measured from where the fade began.
  const fu = new Float32Array(n);
  const fv = new Float32Array(n);
  const pend = new Uint8Array(n);
  const tracks = { general: new Transitions(n), red: new Transitions(n) };
  const empty = (): FlashTrackResult => ({
    failing: [],
    failingWindows: 0,
    worst: null,
    largestBelow: 0,
    peak: { transitions: 0, frame: 0, x: 0, y: 0 },
    runs: [],
    withUnknown: 0,
  });
  const results: Record<FlashTrack, FlashTrackResult> = { general: empty(), red: empty() };
  const unknown = options.unknown;
  if (unknown && unknown.length !== n) throw new Error(`flash judge: unknown mask of ${unknown.length}, expected ${n}`);
  let ux0 = width;
  let uy0 = height;
  let ux1 = -1;
  let uy1 = -1;
  if (unknown) {
    for (let p = 0; p < n; p++) {
      if (!unknown[p]) continue;
      const y = (p / width) | 0;
      const x = p - y * width;
      if (x < ux0) ux0 = x;
      if (x > ux1) ux1 = x;
      if (y < uy0) uy0 = y;
      if (y > uy1) uy1 = y;
    }
  }
  /** Whether a track's last evaluation failed, so the next failing one extends its run. */
  const inRun: Record<FlashTrack, boolean> = { general: false, red: false };
  let prev: FlashFrame | null = null;

  const stepGeneral = (p: number, L: number): boolean => {
    const d = dir[p]!;
    if (d === 0) {
      // No leg yet: A and E are the lowest and highest seen.
      if (L < A[p]!) A[p] = L;
      if (L > E[p]!) E[p] = L;
      if (E[p]! - A[p]! < LUMINANCE_STEP - EPS) return false;
      const rising = L === E[p];
      const start = rising ? A[p]! : E[p]!;
      A[p] = start;
      E[p] = L;
      dir[p] = rising ? 1 : -1;
      counted[p] = Math.min(start, L) < DARKER_BELOW ? 1 : 0;
      return counted[p] === 1;
    }
    if (d === 1) {
      if (L > E[p]!) {
        E[p] = L;
        if (!counted[p] && E[p]! - A[p]! >= LUMINANCE_STEP - EPS && A[p]! < DARKER_BELOW) {
          counted[p] = 1;
          return true;
        }
        return false;
      }
      if (E[p]! - L < LUMINANCE_STEP - EPS) return false;
      A[p] = E[p]!;
      E[p] = L;
      dir[p] = -1;
      counted[p] = L < DARKER_BELOW ? 1 : 0;
      return counted[p] === 1;
    }
    if (L < E[p]!) {
      E[p] = L;
      if (!counted[p] && A[p]! - E[p]! >= LUMINANCE_STEP - EPS && E[p]! < DARKER_BELOW) {
        counted[p] = 1;
        return true;
      }
      return false;
    }
    if (L - E[p]! < LUMINANCE_STEP - EPS) return false;
    A[p] = E[p]!;
    E[p] = L;
    dir[p] = 1;
    counted[p] = A[p]! < DARKER_BELOW ? 1 : 0;
    return counted[p] === 1;
  };

  const transitionsInWindow = (t: Transitions, p: number, k: number): number => {
    let c = 0;
    while (c < t.count[p]! && times[k]! - times[t.at(p, c + 1)]! < WINDOW_MS - EPS) c++;
    return c;
  };

  /** A transition of pixel p at frame k: raise the track's peak if p now has more in a window. */
  const transition = (track: FlashTrack, p: number, k: number) => {
    const t = tracks[track];
    t.push(p, k);
    const peak = results[track].peak;
    let raised = false;
    while (peak.transitions < t.count[p]! && times[k]! - times[t.at(p, peak.transitions + 1)]! < WINDOW_MS - EPS) {
      peak.transitions++;
      raised = true;
    }
    if (raised) {
      peak.frame = k;
      peak.x = p % width;
      peak.y = Math.floor(p / width);
    }
  };

  const evaluate = (track: FlashTrack, k: number) => {
    const t = tracks[track];
    const res = results[track];
    // The flashing pixels and their box.
    let x0 = width;
    let y0 = height;
    let x1 = -1;
    let y1 = -1;
    let count = 0;
    const mask = new Uint8Array(n);
    const back = MAX_TRANSITIONS + 1;
    const from = times[k]! - WINDOW_MS + EPS;
    for (let p = 0; p < n; p++) {
      if (t.count[p]! < back || times[t.at(p, back)]! <= from) continue;
      mask[p] = 1;
      count++;
      const y = (p / width) | 0;
      const x = p - y * width;
      if (x < x0) x0 = x;
      if (x > x1) x1 = x;
      if (y < y0) y0 = y;
      if (y > y1) y1 = y;
    }
    if (count === 0) {
      inRun[track] = false;
      return;
    }
    const maskBox: Box = { x: x0, y: y0, width: x1 - x0 + 1, height: y1 - y0 + 1 };
    // Closing stays inside the box, so a box no larger than an area already reported can change no
    // number: not the verdict (it is under the limit), not the largest area, not the worst window.
    if (maskBox.width * maskBox.height <= res.largestBelow && !unknown) {
      inRun[track] = false;
      return;
    }
    const closed = closeMask(mask, width, height, x0, y0, x1, y1);
    const best = bestField(closed, width, height, fw, fh, x0, y0, x1, y1);
    if (best.area > limit) {
      res.failingWindows++;
      const run = res.runs[res.runs.length - 1];
      const region = boxUnion(maskBox, best.field);
      if (inRun[track] && run) {
        run.to = k;
        run.region = boxUnion(run.region, region);
        if (best.area > run.area) {
          run.area = best.area;
          run.field = best.field;
        }
        run.windows.push({ frame: k, area: best.area, field: best.field });
      } else {
        res.runs.push({
          from: k,
          to: k,
          area: best.area,
          field: best.field,
          region,
          windows: [{ frame: k, area: best.area, field: best.field }],
        });
      }
      inRun[track] = true;
      const last = res.failing[res.failing.length - 1];
      const larger = !res.worst || best.area > res.worst.area;
      const tie = !!res.worst && best.area === res.worst.area;
      if (!last || larger || tie || times[k]! - last.atMs >= WINDOW_MS - EPS) {
        const ev = describe(t, k, closed, best.field, maskBox, best.area);
        // Of windows over the same area, the worst is the one with the most transitions in it.
        const more = tie && ev.maxTransitions > res.worst!.maxTransitions;
        if (!last || larger || more || times[k]! - last.atMs >= WINDOW_MS - EPS) res.failing.push(ev);
        if (larger || more) res.worst = ev;
      }
      return;
    }
    inRun[track] = false;
    res.largestBelow = Math.max(res.largestBelow, best.area);
    if (!res.worst || best.area > res.worst.area) res.worst = describe(t, k, closed, best.field, maskBox, best.area);
    if (unknown && ux1 >= 0) {
      // The flashing pixels with the unknown ones: could they together exceed the limit?
      const union = new Uint8Array(n);
      for (let p = 0; p < n; p++) union[p] = closed[p]! | unknown[p]!;
      const bx0 = Math.min(x0, ux0);
      const by0 = Math.min(y0, uy0);
      const bx1 = Math.max(x1, ux1);
      const by1 = Math.max(y1, uy1);
      res.withUnknown = Math.max(res.withUnknown, bestField(union, width, height, fw, fh, bx0, by0, bx1, by1).area);
    }
  };

  /** An evaluation's box and peak count inside its field. */
  const describe = (
    t: Transitions,
    k: number,
    mask: Uint8Array,
    f: Box,
    maskBox: Box,
    area: number,
  ): FlashEvaluation => {
    let bx0 = width;
    let by0 = height;
    let bx1 = -1;
    let by1 = -1;
    let maxTransitions = 0;
    let peak = -1;
    for (let y = f.y; y < f.y + f.height; y++) {
      for (let x = f.x; x < f.x + f.width; x++) {
        const p = y * width + x;
        if (!mask[p]) continue;
        if (x < bx0) bx0 = x;
        if (x > bx1) bx1 = x;
        if (y < by0) by0 = y;
        if (y > by1) by1 = y;
        const c = transitionsInWindow(t, p, k);
        if (c > maxTransitions) {
          maxTransitions = c;
          peak = p;
        }
      }
    }
    const frames: number[] = [];
    for (let back = maxTransitions; back >= 1; back--) frames.push(t.at(peak, back));
    return {
      frame: k,
      atMs: times[k]!,
      area,
      field: f,
      bbox:
        bx1 < 0 ? { x: 0, y: 0, width: 0, height: 0 } : { x: bx0, y: by0, width: bx1 - bx0 + 1, height: by1 - by0 + 1 },
      maxTransitions,
      pixel: peak < 0 ? { x: 0, y: 0, frames } : { x: peak % width, y: Math.floor(peak / width), frames },
      maskBox,
    };
  };

  return {
    /**
     * Frame `index` (0, 1, 2 … in order) at `atMs`, already at CSS resolution. `explained`, per
     * pixel: bit 1 = the general step into this frame is motion, bit 2 = the red one is. An
     * explained step is not counted; the pixel's state starts again from the new value.
     */
    push(index: number, atMs: number, frame: FlashFrame, explained?: Uint8Array): void {
      if (index !== times.length) throw new Error(`flash judge: frame ${index} pushed after ${times.length - 1}`);
      if (frame.width !== width || frame.height !== height) {
        throw new Error(`flash judge: frame ${index} is ${frame.width}x${frame.height}, expected ${width}x${height}`);
      }
      if (index > 65535) throw new Error("flash judge: more than 65536 frames");
      if (explained && explained.length !== n)
        throw new Error(`flash judge: explained mask of ${explained.length}, expected ${n}`);
      if (times.length > 0 && !(atMs > times[times.length - 1]!))
        throw new Error("flash judge: frames out of time order");
      times.push(atMs);
      if (prev === null) {
        A.set(frame.lum);
        E.set(frame.lum);
        au.set(frame.u);
        av.set(frame.v);
        asat.set(frame.sat);
        prev = frame;
        return;
      }
      let general = false;
      let red = false;
      const { lum, u, v, sat } = frame;
      for (let p = 0; p < n; p++) {
        if (lum[p] === prev.lum[p] && u[p] === prev.u[p] && v[p] === prev.v[p]) continue;
        const why = explained ? explained[p]! : 0;
        if (why & 1) {
          A[p] = lum[p]!;
          E[p] = lum[p]!;
          dir[p] = 0;
          counted[p] = 0;
        } else if (stepGeneral(p, lum[p]!)) {
          transition("general", p, index);
          general = true;
        }
        if (why & 2) {
          au[p] = u[p]!;
          av[p] = v[p]!;
          asat[p] = sat[p]!;
          pend[p] = 0;
          continue;
        }
        const du = u[p]! - au[p]!;
        const dv = v[p]! - av[p]!;
        if (du * du + dv * dv > RED_UV_STEP * RED_UV_STEP) {
          if (asat[p] || sat[p]) {
            transition("red", p, index);
            red = true;
            pend[p] = 0;
          } else {
            fu[p] = au[p]!;
            fv[p] = av[p]!;
            pend[p] = 1;
          }
          au[p] = u[p]!;
          av[p] = v[p]!;
          asat[p] = sat[p]!;
        } else if (sat[p]) {
          asat[p] = 1;
          if (pend[p]) {
            const eu = u[p]! - fu[p]!;
            const ev = v[p]! - fv[p]!;
            if (eu * eu + ev * ev > RED_UV_STEP * RED_UV_STEP) {
              transition("red", p, index);
              red = true;
              pend[p] = 0;
            }
          }
        }
      }
      prev = frame;
      if (general) evaluate("general", index);
      if (red) evaluate("red", index);
    },
    result(): Record<FlashTrack, FlashTrackResult> & {
      frames: number;
      field: { width: number; height: number };
      areaLimit: number;
    } {
      return { ...results, frames: times.length, field: { width: fw, height: fh }, areaLimit: limit };
    },
  };
}

function boxUnion(a: Box, b: Box): Box {
  const x = Math.min(a.x, b.x);
  const y = Math.min(a.y, b.y);
  return {
    x,
    y,
    width: Math.max(a.x + a.width, b.x + b.width) - x,
    height: Math.max(a.y + a.height, b.y + b.height) - y,
  };
}

/**
 * `mask` closed with a 3x3 element (dilate, then erode) over its box [x0..x1] x [y0..y1]: gaps up to
 * 2 px wide are filled, and a solid region keeps its edge. Outside the frame counts as set for the
 * erosion, so a region at the frame's edge keeps its edge row.
 */
export function closeMask(
  mask: Uint8Array,
  width: number,
  height: number,
  x0: number,
  y0: number,
  x1: number,
  y1: number,
): Uint8Array {
  // Work on the box grown by 2 (the dilation reaches 1 out, the erosion reads 1 beyond that),
  // clipped to the frame; a 3x3 max or min is a row pass then a column pass.
  const gx0 = Math.max(0, x0 - 2);
  const gy0 = Math.max(0, y0 - 2);
  const gx1 = Math.min(width - 1, x1 + 2);
  const gy1 = Math.min(height - 1, y1 + 2);
  const w = gx1 - gx0 + 1;
  const h = gy1 - gy0 + 1;
  const local = new Uint8Array(w * h);
  for (let y = 0; y < h; y++) local.set(mask.subarray((gy0 + y) * width + gx0, (gy0 + y) * width + gx0 + w), y * w);
  const rows = new Uint8Array(w * h);
  // 3x3 max (dilation) or min (erosion), a row pass into `rows` then a column pass into `into`.
  const pass = (src: Uint8Array, into: Uint8Array, max: boolean, outside: number): Uint8Array => {
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const l = x > 0 ? src[y * w + x - 1]! : gx0 + x - 1 < 0 ? outside : src[y * w + x]!;
        const c = src[y * w + x]!;
        const r = x < w - 1 ? src[y * w + x + 1]! : gx0 + x + 1 >= width ? outside : c;
        rows[y * w + x] = max ? l | c | r : l & c & r;
      }
    }
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const c = rows[y * w + x]!;
        const u = y > 0 ? rows[(y - 1) * w + x]! : gy0 + y - 1 < 0 ? outside : c;
        const d = y < h - 1 ? rows[(y + 1) * w + x]! : gy0 + y + 1 >= height ? outside : c;
        into[y * w + x] = max ? u | c | d : u & c & d;
      }
    }
    return into;
  };
  // Outside the frame counts as set for the erosion, so a region at the frame's edge keeps its edge row.
  const dilated = pass(local, new Uint8Array(w * h), true, 0);
  const closed = pass(dilated, local, false, 1);
  const out = new Uint8Array(width * height);
  for (let y = y0; y <= y1; y++) {
    for (let x = x0; x <= x1; x++) out[y * width + x] = closed[(y - gy0) * w + x - gx0]!;
  }
  return out;
}

/** The fw x fh rectangle, anywhere in the frame, holding the most set pixels of `mask` (set only within the box). */
export function bestField(
  mask: Uint8Array,
  width: number,
  height: number,
  fw: number,
  fh: number,
  x0: number,
  y0: number,
  x1: number,
  y1: number,
): { area: number; field: Box } {
  const bw = x1 - x0 + 1;
  const bh = y1 - y0 + 1;
  // Summed-area table over the box, one row and column of zeros in front.
  const sat = new Int32Array((bw + 1) * (bh + 1));
  for (let y = 0; y < bh; y++) {
    let row = 0;
    for (let x = 0; x < bw; x++) {
      row += mask[(y0 + y) * width + x0 + x]!;
      sat[(y + 1) * (bw + 1) + x + 1] = sat[y * (bw + 1) + x + 1]! + row;
    }
  }
  const sum = (ax: number, ay: number, bx: number, by: number) => {
    // [ax, bx) x [ay, by) in box coordinates, clipped.
    ax = Math.max(0, ax);
    ay = Math.max(0, ay);
    bx = Math.min(bw, bx);
    by = Math.min(bh, by);
    if (bx <= ax || by <= ay) return 0;
    return sat[by * (bw + 1) + bx]! - sat[ay * (bw + 1) + bx]! - sat[by * (bw + 1) + ax]! + sat[ay * (bw + 1) + ax]!;
  };
  let best = -1;
  let field: Box = { x: 0, y: 0, width: fw, height: fh };
  const fxFrom = Math.max(0, x0 - fw + 1);
  const fxTo = Math.min(width - fw, x1);
  const fyFrom = Math.max(0, y0 - fh + 1);
  const fyTo = Math.min(height - fh, y1);
  for (let fy = fyFrom; fy <= fyTo; fy++) {
    for (let fx = fxFrom; fx <= fxTo; fx++) {
      const s = sum(fx - x0, fy - y0, fx + fw - x0, fy + fh - y0);
      if (s > best) {
        best = s;
        field = { x: fx, y: fy, width: fw, height: fh };
      }
    }
  }
  return { area: Math.max(0, best), field };
}
