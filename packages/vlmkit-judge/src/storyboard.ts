/**
 * A storyboard over a frame sequence (`vlmkit-frames/1`): where the frames hold still,
 * where they depart from what they held, how long for, over which pixels, and whether they come
 * back. Every time, count and box here is read from the pixels. Nothing here says what a change
 * *is* — that is left to whoever looks at the keyframes it picks (`storyboardBrief`).
 *
 * Segmentation is relative to an anchor: the frame of the state the page is in — frame 0 for the
 * first, the first frame of the hold a change settled in for each new one, and, when a change
 * lands within the floor of an earlier state's frame, the first such state's own frame again. A
 * deviation runs from the first frame that differs from the anchor to the first frame that
 * matches it again. (Within the floor is not transitive, so equal bytes can still carry two ids:
 * a picture reached with no event keeps the state it drifted from.)
 *
 * - **glitch**: the deviation lasts one frame and comes back.
 * - **transient**: it lasts more than one frame and comes back within `TRANSIENT_MS` of its first
 *   frame, whatever it held in between (a toast that slides in, stays and leaves is one).
 * - **change**: it does not come back within that window. It ends at the first hold of
 *   `SETTLE_MS` (frames byte-identical to each other): the next state, a new one or an earlier
 *   one it is within the floor of, whose frame is the anchor from then on.
 * - **drift**: a change no frame-to-frame step of which, inside its box, crosses the floor — a
 *   fade too slow to see from one frame to the next.
 *
 * So k blinks are k events, and the frames between them, back at the anchor, are none. A merge-
 * then-split segmentation was rejected in the design round: two 100ms blinks merged into one span
 * with no event, and the gaps between blinks were reported as transients.
 *
 * "Differs" is a channel moving by more than `CHANNEL_FLOOR` (8 of 255) in at least one pixel.
 * The held clock's captures (two shots that agree) and lossless recordings are byte-identical frame
 * to frame on a still page, so the floor only has to absorb a sub-floor fade, which the anchor (not
 * the previous frame) accumulates until it shows. Frames decoded from a lossy codec are compared
 * through a noise band instead (`NoiseFloor`, `LOSSY_NOISE`): as neighbourhood means, a hold within
 * `still` of its first frame, a keyframe that only re-quantizes the picture read again.
 */
import { formatInstant, frameTimeMs, type FrameEntry, type FramesSource } from "./frames.ts";
import { UsageError } from "./errors.ts";

export const STORYBOARD_FORMAT = "vlmkit-storyboard/1";
/** A pixel differs when one of its channels moves by more than this (0-255). */
export const CHANNEL_FLOOR = 8;
/** A departure that comes back within this many ms of its first frame is one event. */
export const TRANSIENT_MS = 5000;
/** A change ends at the first run of byte-identical frames lasting this long. */
export const SETTLE_MS = 100;
/** With a noise band, a step between two frames reaches back this far: a codec smears a change. */
export const SMEAR_MS = 50;
/**
 * The noise band `--lossy` compares through (`NoiseFloor`), measured on known answers: the planted
 * events captured lossless and encoded with H.264, HEVC, VP8, VP9, AV1 and MJPEG at several
 * qualities (docs/reports/2026-10-16-storyboard-noise-floor-v1.md).
 */
export const LOSSY_NOISE: NoiseFloor = {
  radius: 1,
  still: 24,
  floor: 32,
  holdMean: 3,
  keyframe: { block: 24, pixel: 96 },
};
/**
 * Durations are differences of instants, and instants on the 60fps grid are binary fractions:
 * frame 10 minus frame 4 is 99.99999999999999, so a 100ms hold of seven frames read as too short.
 * A comparison within this of its bound is on it, as `parseInstants` snaps.
 */
const EPSILON_MS = 1e-6;

export interface Box {
  x: number;
  y: number;
  width: number;
  height: number;
}

/** Frame `i`'s pixels, RGBA, `width * height * 4` bytes. Called more than once per frame. */
export interface FramePixels {
  width: number;
  height: number;
  pixels(i: number): Uint8Array;
}

export interface FrameDelta {
  /** No byte differs (outside the ignored boxes) — or, given `still`, no channel moves by more than it. */
  identical: boolean;
  /** Pixels one of whose channels moved by more than the floor. */
  over: number;
  /** Their bounding box; null when there are none. */
  box: Box | null;
  /** The bounding box of every pixel that differs at all (by more than `still`); null when identical. */
  changed: Box | null;
  /** The largest channel delta of any pixel, 0-255. */
  maxDelta: number;
}

/**
 * How frames decoded from a lossy codec are compared. A codec does not give back the picture it
 * was given: the same screen decodes a little differently frame to frame, most of all at sharp
 * edges, and very differently across a keyframe. So each frame is compared as the mean of every
 * pixel's neighbourhood — a codec's error is mostly high-frequency ringing, which the mean cancels,
 * and what a viewer sees change is not — with two thresholds where a lossless sequence has one:
 * frames within `still` of each other everywhere show one picture (a hold, a return), and a pixel
 * differs from the state when its mean moves by more than `floor`. Between the two is what the
 * codec does to a still picture.
 */
export interface NoiseFloor {
  /** Each frame is compared as the mean of every pixel's (2 * radius + 1)² neighbourhood. */
  radius: number;
  /** Frames whose means all stay within this of each other (0-255) show one picture. */
  still: number;
  /** A pixel differs when a channel of its mean moves by more than this (0-255). */
  floor: number;
  /**
   * A change's hold also keeps the mean over the change's own box within this of its first frame
   * (0-255, at most `still`). A codec's noise cancels over a region and a fade moves it: per pixel
   * alone, a fade slower than `still` per hold was a run of holds, and a change a codec smeared
   * over a few frames settled on its first. Absent: holds are judged per pixel only.
   */
  holdMean?: number;
  /**
   * Two frames of different GOPs are one picture re-quantized when no 8x8 block's mean moves by more
   * than `block` and no mean by more than `pixel` (above `floor`): a keyframe re-encodes the whole
   * picture, which moves pixels near edges far and a region's mean little. Then the state is read
   * again there (`Storyboard.reread`): at a keyframe a still picture departs at, at a return after
   * an event a keyframe fell in, and at a change that settles back into a state in a later GOP.
   * Absent: keyframes are frames.
   */
  keyframe?: { block: number; pixel: number };
}

/**
 * One byte per pixel, 1 inside any of `boxes`: pixels no comparison looks at. A box that does not
 * sit on whole pixels covers every pixel it touches; `grow` widens every box by that many pixels on
 * each side, for comparisons of neighbourhood means, which carry a box's content `grow` pixels out.
 */
export function ignoreMask(width: number, height: number, boxes: readonly Box[], grow = 0): Uint8Array | null {
  if (boxes.length === 0) return null;
  const mask = new Uint8Array(width * height);
  for (const b of boxes) {
    const x0 = Math.max(0, Math.floor(b.x) - grow);
    const y0 = Math.max(0, Math.floor(b.y) - grow);
    const x1 = Math.min(width, Math.ceil(b.x + b.width) + grow);
    const y1 = Math.min(height, Math.ceil(b.y + b.height) + grow);
    for (let y = y0; y < y1; y++) mask.fill(1, y * width + x0, y * width + Math.max(x0, x1));
  }
  return mask;
}

/**
 * Each channel of each pixel as the mean of its (2 * radius + 1)² neighbourhood, rounded; at the
 * frame's edge, of the part of it inside the frame. Two passes of running sums, both in memory
 * order: walking columns took about 200ms a 1920x910 frame, rows about 70ms.
 */
export function boxMean(rgba: Uint8Array, width: number, height: number, radius: number): Uint8Array {
  if (radius === 0) return rgba;
  const stride = width * 4;
  // Each row's horizontal window sums, channel by channel.
  const rows = new Uint32Array(stride * height);
  for (let y = 0; y < height; y++) {
    const base = y * stride;
    let s0 = 0;
    let s1 = 0;
    let s2 = 0;
    let s3 = 0;
    for (let x = 0; x < Math.min(radius, width); x++) {
      const i = base + x * 4;
      s0 += rgba[i]!;
      s1 += rgba[i + 1]!;
      s2 += rgba[i + 2]!;
      s3 += rgba[i + 3]!;
    }
    for (let x = 0; x < width; x++) {
      if (x + radius < width) {
        const i = base + (x + radius) * 4;
        s0 += rgba[i]!;
        s1 += rgba[i + 1]!;
        s2 += rgba[i + 2]!;
        s3 += rgba[i + 3]!;
      }
      if (x - radius - 1 >= 0) {
        const i = base + (x - radius - 1) * 4;
        s0 -= rgba[i]!;
        s1 -= rgba[i + 1]!;
        s2 -= rgba[i + 2]!;
        s3 -= rgba[i + 3]!;
      }
      const o = base + x * 4;
      rows[o] = s0;
      rows[o + 1] = s1;
      rows[o + 2] = s2;
      rows[o + 3] = s3;
    }
  }
  // How many columns each pixel's window holds.
  const across = new Uint32Array(width);
  for (let x = 0; x < width; x++) across[x] = Math.min(width - 1, x + radius) - Math.max(0, x - radius) + 1;
  // The vertical window, as a running sum of whole rows.
  const column = new Uint32Array(stride);
  for (let y = 0; y < Math.min(radius, height); y++) {
    for (let i = 0, b = y * stride; i < stride; i++) column[i] += rows[b + i]!;
  }
  const out = new Uint8Array(stride * height);
  for (let y = 0; y < height; y++) {
    if (y + radius < height) {
      for (let i = 0, b = (y + radius) * stride; i < stride; i++) column[i] += rows[b + i]!;
    }
    if (y - radius - 1 >= 0) {
      for (let i = 0, b = (y - radius - 1) * stride; i < stride; i++) column[i] -= rows[b + i]!;
    }
    const down = Math.min(height - 1, y + radius) - Math.max(0, y - radius) + 1;
    const base = y * stride;
    // Every pixel whose window is whole across divides by one count: by table when it is small.
    const x0 = Math.min(width, radius);
    const x1 = Math.max(x0, width - radius);
    const table = (2 * radius + 1) * down <= MEAN_TABLE_MAX ? meanTable((2 * radius + 1) * down) : null;
    if (table) {
      for (let i = x0 * 4, end = x1 * 4; i < end; i++) out[base + i] = table[column[i]!]!;
    } else {
      const n = (2 * radius + 1) * down;
      for (let i = x0 * 4, end = x1 * 4; i < end; i++) out[base + i] = Math.round(column[i]! / n);
    }
    // The columns at either edge, whose windows are cut by the frame.
    for (let x = 0; x < width; x++) {
      if (x === x0) x = x1;
      if (x >= width) break;
      const n = across[x]! * down;
      for (let i = x * 4, end = i + 4; i < end; i++) out[base + i] = Math.round(column[i]! / n);
    }
  }
  return out;
}

/** Windows of up to this many pixels divide by table: a division a channel was most of the cost. */
const MEAN_TABLE_MAX = 81;
const meanTables = new Map<number, Uint8Array>();
/** `Math.round(sum / n)` for every sum of `n` bytes. */
function meanTable(n: number): Uint8Array {
  let table = meanTables.get(n);
  if (!table) {
    table = new Uint8Array(255 * n + 1);
    for (let v = 0; v < table.length; v++) table[v] = Math.round(v / n);
    meanTables.set(n, table);
  }
  return table;
}

/**
 * Some pixel inside `box` (outside `mask`) whose `boxMean` differs between frames a and b by more
 * than `floor` in a channel, computed from the decoded pixels there, as `boxMean` rounds: the same
 * answer as comparing the two frames' means over the box, without the rest of either frame.
 */
export function meansApartIn(
  a: Uint8Array,
  b: Uint8Array,
  width: number,
  height: number,
  radius: number,
  box: Box,
  floor: number,
  mask: Uint8Array | null,
): boolean {
  for (let y = Math.max(0, box.y); y < Math.min(height, box.y + box.height); y++) {
    const y0 = Math.max(0, y - radius);
    const y1 = Math.min(height - 1, y + radius);
    for (let x = Math.max(0, box.x); x < Math.min(width, box.x + box.width); x++) {
      if (mask !== null && mask[y * width + x] === 1) continue;
      const x0 = Math.max(0, x - radius);
      const x1 = Math.min(width - 1, x + radius);
      const n = (x1 - x0 + 1) * (y1 - y0 + 1);
      for (let c = 0; c < 4; c++) {
        let sa = 0;
        let sb = 0;
        for (let yy = y0; yy <= y1; yy++) {
          for (let xx = x0, i = (yy * width + x0) * 4 + c; xx <= x1; xx++, i += 4) {
            sa += a[i]!;
            sb += b[i]!;
          }
        }
        if (Math.abs(Math.round(sa / n) - Math.round(sb / n)) > floor) return true;
      }
    }
  }
  return false;
}

/** `pixels` as neighbourhood means, the last `capacity` frames kept (by default, 256 MB of them, at least 4). */
export function meanFrames(
  pixels: FramePixels,
  radius: number,
  capacity = Math.max(4, Math.floor((256 * 1024 * 1024) / (pixels.width * pixels.height * 4))),
): FramePixels {
  const cache = new Map<number, Uint8Array>();
  return {
    width: pixels.width,
    height: pixels.height,
    pixels(i: number): Uint8Array {
      const hit = cache.get(i);
      if (hit) {
        cache.delete(i);
        cache.set(i, hit);
        return hit;
      }
      const mean = boxMean(pixels.pixels(i), pixels.width, pixels.height, radius);
      cache.set(i, mean);
      if (cache.size > capacity) cache.delete(cache.keys().next().value!);
      return mean;
    },
  };
}

/** Signature blocks are this many pixels a side. */
const SIGNATURE_BLOCK = 16;

/**
 * Each 16x16 block's mean per channel, over the pixels no comparison ignores (NaN: none). Two
 * frames whose signatures differ by more than t in some channel of some block differ by more than
 * t in some pixel of it — a mean of differences is never larger than the largest — so a
 * comparison that only has to learn whether they do is answered from a few thousand numbers.
 */
export function blockSignature(
  rgba: Uint8Array,
  width: number,
  height: number,
  mask: Uint8Array | null,
  block = SIGNATURE_BLOCK,
): Float32Array {
  const bw = Math.ceil(width / block);
  const bh = Math.ceil(height / block);
  const sums = new Float64Array(bw * bh * 4);
  const counts = new Uint32Array(bw * bh);
  for (let y = 0; y < height; y++) {
    const row = ((y / block) | 0) * bw;
    for (let x = 0; x < width; x++) {
      const p = y * width + x;
      if (mask !== null && mask[p] === 1) continue;
      const b = row + ((x / block) | 0);
      const i = p << 2;
      sums[b * 4] += rgba[i]!;
      sums[b * 4 + 1] += rgba[i + 1]!;
      sums[b * 4 + 2] += rgba[i + 2]!;
      sums[b * 4 + 3] += rgba[i + 3]!;
      counts[b]++;
    }
  }
  const out = new Float32Array(bw * bh * 4);
  for (let b = 0; b < bw * bh; b++) {
    for (let c = 0; c < 4; c++) out[b * 4 + c] = counts[b] === 0 ? Number.NaN : sums[b * 4 + c]! / counts[b]!;
  }
  return out;
}

/**
 * `blockSignature` at 8x8 and at 16x16 from one pass: each 16x16 block's sums and counts are its
 * four 8x8 blocks', added exactly, so both equal what `blockSignature` gives at either size.
 */
export function blockSignatures(
  rgba: Uint8Array,
  width: number,
  height: number,
  mask: Uint8Array | null,
): { coarse: Float32Array; fine: Float32Array } {
  const fw = Math.ceil(width / 8);
  const fh = Math.ceil(height / 8);
  const sums = new Float64Array(fw * fh * 4);
  const counts = new Uint32Array(fw * fh);
  for (let y = 0; y < height; y++) {
    const row = (y >> 3) * fw;
    for (let x = 0; x < width; x++) {
      const p = y * width + x;
      if (mask !== null && mask[p] === 1) continue;
      const b = row + (x >> 3);
      const i = p << 2;
      sums[b * 4] += rgba[i]!;
      sums[b * 4 + 1] += rgba[i + 1]!;
      sums[b * 4 + 2] += rgba[i + 2]!;
      sums[b * 4 + 3] += rgba[i + 3]!;
      counts[b]++;
    }
  }
  const cw = Math.ceil(width / SIGNATURE_BLOCK);
  const ch = Math.ceil(height / SIGNATURE_BLOCK);
  const cSums = new Float64Array(cw * ch * 4);
  const cCounts = new Uint32Array(cw * ch);
  const fine = new Float32Array(fw * fh * 4);
  for (let by = 0; by < fh; by++) {
    for (let bx = 0; bx < fw; bx++) {
      const b = by * fw + bx;
      const cb = (by >> 1) * cw + (bx >> 1);
      cCounts[cb] += counts[b]!;
      for (let c = 0; c < 4; c++) {
        cSums[cb * 4 + c] += sums[b * 4 + c]!;
        fine[b * 4 + c] = counts[b] === 0 ? Number.NaN : sums[b * 4 + c]! / counts[b]!;
      }
    }
  }
  const coarse = new Float32Array(cw * ch * 4);
  for (let b = 0; b < cw * ch; b++) {
    for (let c = 0; c < 4; c++) coarse[b * 4 + c] = cCounts[b] === 0 ? Number.NaN : cSums[b * 4 + c]! / cCounts[b]!;
  }
  return { coarse, fine };
}

/** Some channel of some block of `a` and `b` differs by more than `t`: so some pixel does. */
export function signaturesApart(a: Float32Array, b: Float32Array, t: number): boolean {
  for (let i = 0; i < a.length; i++) {
    // Float32 means of the same bytes round the same way; the margin covers the rounding of two.
    if (Math.abs(a[i]! - b[i]!) > t + 1e-3) return true;
  }
  return false;
}

/**
 * A 32-bit view for the equal-word fast path, over a copy when the bytes are not 4-aligned. The
 * copy is `new Uint8Array(bytes)`, never `bytes.slice()`: a Node Buffer is a Uint8Array whose
 * `slice` is a view, and a view of the whole pool from offset 0 compared every frame as the same.
 */
function words(bytes: Uint8Array): Uint32Array {
  if (bytes.byteOffset % 4 === 0) return new Uint32Array(bytes.buffer, bytes.byteOffset, bytes.byteLength >> 2);
  return new Uint32Array(new Uint8Array(bytes).buffer, 0, bytes.byteLength >> 2);
}

/** How `b` differs from `a`, pixel by pixel. */
export function frameDelta(
  a: Uint8Array,
  b: Uint8Array,
  width: number,
  height: number,
  options: { floor?: number; mask?: Uint8Array | null; still?: number } = {},
): FrameDelta {
  const size = width * height;
  if (a.length !== size * 4 || b.length !== size * 4) {
    throw new Error(`frameDelta: expected ${size * 4} bytes per frame, got ${a.length} and ${b.length}`);
  }
  const floor = options.floor ?? CHANNEL_FLOOR;
  const mask = options.mask ?? null;
  // Without `still`, any byte that differs is a difference: -1 is below every delta of a pixel
  // whose bytes differ.
  const still = options.still ?? -1;
  const wa = words(a);
  const wb = words(b);
  let identical = true;
  let over = 0;
  let maxDelta = 0;
  let x0 = width;
  let y0 = height;
  let x1 = -1;
  let y1 = -1;
  let cx0 = width;
  let cy0 = height;
  let cx1 = -1;
  let cy1 = -1;
  for (let p = 0; p < size; p++) {
    if (wa[p] === wb[p] || (mask !== null && mask[p] === 1)) continue;
    const i = p << 2;
    const d = Math.max(
      Math.abs(a[i]! - b[i]!),
      Math.abs(a[i + 1]! - b[i + 1]!),
      Math.abs(a[i + 2]! - b[i + 2]!),
      Math.abs(a[i + 3]! - b[i + 3]!),
    );
    if (d > maxDelta) maxDelta = d;
    if (d <= still) continue;
    identical = false;
    const py = (p / width) | 0;
    const px = p - py * width;
    if (px < cx0) cx0 = px;
    if (px > cx1) cx1 = px;
    if (py < cy0) cy0 = py;
    if (py > cy1) cy1 = py;
    if (d <= floor) continue;
    over++;
    if (px < x0) x0 = px;
    if (px > x1) x1 = px;
    if (py < y0) y0 = py;
    if (py > y1) y1 = py;
  }
  const box = over === 0 ? null : { x: x0, y: y0, width: x1 - x0 + 1, height: y1 - y0 + 1 };
  const changed = identical ? null : { x: cx0, y: cy0, width: cx1 - cx0 + 1, height: cy1 - cy0 + 1 };
  return { identical, over, box, changed, maxDelta };
}

/** The smallest box holding both; either may be null. */
export function unionBox(a: Box | null, b: Box | null): Box | null {
  if (a === null) return b;
  if (b === null) return a;
  const x = Math.min(a.x, b.x);
  const y = Math.min(a.y, b.y);
  return {
    x,
    y,
    width: Math.max(a.x + a.width, b.x + b.width) - x,
    height: Math.max(a.y + a.height, b.y + b.height) - y,
  };
}

export type StoryKind = "glitch" | "transient" | "change" | "drift";

/** A frame of the sequence: its position and the instant it shows. */
export interface FrameRef {
  n: number;
  atMs: number;
}

export interface StoryEvent {
  /** `E1`, `E2` … in sequence order. */
  id: string;
  kind: StoryKind;
  /** The state it departed from. */
  from: string;
  /** The state it ended in: `from` again for a glitch or transient; absent when it never settled. */
  to?: string;
  /** The last frame that still showed `from`: the event began after it. */
  before: FrameRef;
  /**
   * The last frame of this visit (from the frame the page entered `from`) whose pixels inside the
   * event's box were byte-identical to `from`'s frame, when it is earlier than `before`. After it
   * those pixels were no longer exactly the state's: moving below the floor (a fade that had not
   * yet shown), or moved by an earlier event of the visit that left them within the floor.
   * Movement elsewhere does not count.
   */
  movedAfter?: FrameRef;
  /** The first frame that differs from `from` by more than the floor. */
  first: FrameRef;
  /**
   * glitch / transient: the last frame that differed. A change that never reached a hold: the
   * sequence's last frame, which is all there is to see of where it was going.
   */
  last?: FrameRef;
  /** glitch / transient: the first frame within the floor of `from` again. */
  back?: FrameRef;
  /**
   * change / drift: the first frame of the hold the motion ended in — the next state. The motion
   * stopped after the frame before it.
   */
  settled?: FrameRef;
  /**
   * change / drift: no hold by the last frame — it differs from the frame before it. What came
   * after is not in the sequence: on a sparse one (a rest instant two seconds on) the page may well
   * have been still by then.
   */
  noHold?: true;
  /**
   * change / drift: how long after `first` the sequence went on, up to `TRANSIENT_MS`: a return
   * later than this is not in the sequence. Below `TRANSIENT_MS` only when the sequence ended first.
   */
  watchedMs?: number;
  /** Frames from `first` to `last` (returns) or to `settled` (changes; the last frame if none). */
  frames: number;
  /** The frame differing from `from` in the most pixels (the earliest of equals), and how many. */
  peak: FrameRef & { over: number };
  /** Every pixel any of its frames moved over the floor from `from`'s frame, as one box. */
  box: Box;
  /**
   * The largest channel delta between two consecutive frames, inside its box, over the steps from
   * `movedAfter` — or from the frame the visit's previous event came back at, when that is later —
   * or else from the step into it, to the first frame back (glitch, transient) or its last frame
   * (change, drift): how visible one frame's step of it was. Movement elsewhere on the page does
   * not count, so a sub-floor wiggle beside a fade cannot make it a change.
   */
  maxStepDelta: number;
  /** Its frames whose capture never agreed: motion the capture did not hold. */
  unstable: number;
}

export interface StoryState {
  /** `S0` is frame 0's; a change that lands within the floor of an earlier state's frame is that state. */
  id: string;
  /**
   * The frame the state was first settled in. Every comparison against the state uses it, on every
   * visit: it is the anchor while the page is in the state.
   */
  frame: FrameRef;
  /** How many times the sequence was in it: a change back to it is another visit. */
  visits: number;
}

export type TimelineSpan =
  | { state: string; from: FrameRef; to: FrameRef }
  | { event: string; from: FrameRef; to: FrameRef };

export interface Sampling {
  /** Smallest and largest gap between consecutive frames, ms; 0 for a single frame. */
  minGapMs: number;
  maxGapMs: number;
  /** Every gap is one 60fps frame: on the held clock, every frame the page rendered. */
  everyFrame: boolean;
}

export interface Storyboard {
  format: typeof STORYBOARD_FORMAT;
  frames: {
    count: number;
    width: number;
    height: number;
    fromMs: number;
    toMs: number;
    sampling: Sampling;
    /** Positions of frames whose capture never agreed. */
    unstable: number[];
  };
  rules: {
    channelFloor: number;
    transientMs: number;
    settleMs: number;
    ignore: Box[];
    /** Present when the frames were compared as neighbourhood means (a lossy recording). */
    noise?: { radius: number; still: number; holdMean?: number; keyframe?: { block: number; pixel: number } };
  };
  states: StoryState[];
  events: StoryEvent[];
  timeline: TimelineSpan[];
  /**
   * Frames at which a state's picture was read again (`NoiseFloor.keyframe`): each in a later GOP
   * than the picture it replaced, and different from it only as a re-quantization. `as` says where:
   * a keyframe the still page departed at, a return after an event, or a change settling back.
   */
  reread?: (FrameRef & { state: string; as: "keyframe" | "return" | "settle" })[];
}

export interface StoryboardOptions {
  floor?: number;
  transientMs?: number;
  settleMs?: number;
  /** Boxes, in the frames' pixels, no comparison looks at: a video, a clock the capture cannot hold. */
  ignore?: readonly Box[];
  /** Compare as neighbourhood means with a noise band (a lossy recording); its floor replaces `floor`. */
  noise?: NoiseFloor;
}

/** The gaps between consecutive instants. */
export function sampling(atMs: readonly number[]): Sampling {
  if (atMs.length < 2) return { minGapMs: 0, maxGapMs: 0, everyFrame: false };
  const gaps = atMs.slice(1).map((t, i) => t - atMs[i]!);
  return {
    minGapMs: Math.min(...gaps),
    maxGapMs: Math.max(...gaps),
    everyFrame: gaps.every((g) => Math.abs(g - frameTimeMs(1)) < 1e-6),
  };
}

/**
 * Frame i begins a GOP: a keyframe after a predicted frame. A run of keyframes (MJPEG, an intra-only
 * encode) codes each frame alone, and a still picture coded alone decodes the same while the
 * encoder's quality holds — 61 of 61 frames byte-identical through MJPEG; through x264 at one
 * keyframe a frame, all but the first. Taken as GOPs, every MJPEG frame was one and a scroll's first
 * step read as a keyframe re-quantizing the page.
 */
export function beginsGop(entries: readonly Pick<FrameEntry, "key">[], i: number): boolean {
  return i > 0 && entries[i]!.key === true && entries[i - 1]!.key !== true;
}

/**
 * Segment a sequence. `entries` are the manifest's frames in order (strictly increasing `atMs`),
 * `pixels` reads each one; the frames must all be `pixels.width x pixels.height`.
 */
export function buildStoryboard(
  entries: readonly Pick<FrameEntry, "n" | "atMs" | "stable" | "key">[],
  pixels: FramePixels,
  options: StoryboardOptions = {},
): Storyboard {
  const noise = options.noise ?? null;
  const floor = noise ? noise.floor : (options.floor ?? CHANNEL_FLOOR);
  const still = noise?.still;
  const transientMs = options.transientMs ?? TRANSIENT_MS;
  const settleMs = options.settleMs ?? SETTLE_MS;
  const ignore = [...(options.ignore ?? [])];
  const count = entries.length;
  if (count === 0) throw new UsageError("a storyboard needs at least one frame");
  entries.forEach((e, i) => {
    if (i > 0 && !(e.atMs > entries[i - 1]!.atMs)) {
      throw new UsageError(
        `frames must be in time order: frame ${i} is at ${formatInstant(e.atMs)}ms, after ${formatInstant(entries[i - 1]!.atMs)}ms`,
      );
    }
  });
  const { width, height } = pixels;
  if (noise) {
    for (const [name, v] of [
      ["radius", noise.radius],
      ["still", noise.still],
      ["floor", noise.floor],
    ] as const) {
      if (!Number.isInteger(v) || v < 0 || v > 255)
        throw new UsageError(`noise ${name} must be a whole number 0-255, got ${v}`);
    }
    if (noise.still >= noise.floor) {
      throw new UsageError(`noise still (${noise.still}) must be below its floor (${noise.floor})`);
    }
    if (noise.holdMean !== undefined) {
      if (!Number.isInteger(noise.holdMean) || noise.holdMean < 0 || noise.holdMean > noise.still) {
        throw new UsageError(
          `noise holdMean must be a whole number 0 to still (${noise.still}), got ${noise.holdMean}`,
        );
      }
    }
    if (noise.keyframe !== undefined) {
      const { block, pixel } = noise.keyframe;
      if (!Number.isInteger(block) || block < 0 || block > 255) {
        throw new UsageError(`noise keyframe block band must be a whole number 0-255, got ${block}`);
      }
      if (!Number.isInteger(pixel) || pixel <= noise.floor || pixel > 255) {
        throw new UsageError(
          `noise keyframe pixel band must be a whole number above the floor (${noise.floor}) and at most 255, got ${pixel}`,
        );
      }
    }
  }
  // Every comparison reads the same frames: as decoded, or as their neighbourhood means.
  const frames = noise ? meanFrames(pixels, noise.radius) : pixels;
  const mask = ignoreMask(width, height, ignore, noise?.radius ?? 0);
  const givenMask = noise && noise.radius > 0 ? ignoreMask(width, height, ignore) : mask;
  const delta = (i: number, j: number) =>
    frameDelta(frames.pixels(i), frames.pixels(j), width, height, { floor, mask, still });
  // With a noise band most comparisons only have to learn that two frames are apart — a window
  // scanned for a return, a hold that does not form, a state a frame is not — and on a 1080p
  // recording each read of a frame's means was a decode and 75ms of arithmetic. Each frame's
  // signature is kept (130 KB at 1080p, 128 MB of them: every frame of a 5s window at 60fps up
  // to 4K), so a frame seen once is apart from another without being read again. Its 8x8 block
  // means, for the re-quantization test, come from the same pass and are kept too (520 KB at
  // 1080p, 128 MB of them): the 5s window after an event asks for them frame by frame, and kept
  // for 32 frames they recomputed every frame's means for every event (73 of 108 s on a 146-frame
  // 1080p recording).
  const signatures = new Map<number, Float32Array>();
  const fine = new Map<number, Float32Array>();
  const signatureBytes = Math.ceil(width / SIGNATURE_BLOCK) * Math.ceil(height / SIGNATURE_BLOCK) * 16;
  const keptSignatures = Math.max(64, Math.floor((128 * 1024 * 1024) / signatureBytes));
  const keptFine = Math.max(32, Math.floor((128 * 1024 * 1024) / (signatureBytes * 4)));
  const touch = <T>(cache: Map<number, T>, i: number): T | undefined => {
    const v = cache.get(i);
    if (v !== undefined) {
      cache.delete(i);
      cache.set(i, v);
    }
    return v;
  };
  const keep = <T>(cache: Map<number, T>, i: number, v: T, kept: number) => {
    cache.delete(i);
    cache.set(i, v);
    if (cache.size > kept) cache.delete(cache.keys().next().value!);
  };
  const sign = (i: number) => {
    const both = blockSignatures(frames.pixels(i), width, height, mask);
    keep(signatures, i, both.coarse, keptSignatures);
    keep(fine, i, both.fine, keptFine);
    return both;
  };
  const signature = (i: number) => touch(signatures, i) ?? sign(i).coarse;
  /** Frames i and j differ by more than t somewhere, proved from their signatures (false: maybe not). */
  const apart = (i: number, j: number, t: number) => noise !== null && signaturesApart(signature(i), signature(j), t);
  const ref = (i: number): FrameRef => ({ n: i, atMs: entries[i]!.atMs });

  // Each frame's GOP: how many frames after frame 0 that begin one are at or before it.
  const gop: number[] = [];
  entries.forEach((_, i) => gop.push(i === 0 ? 0 : gop[i - 1]! + (beginsGop(entries, i) ? 1 : 0)));
  const fineOf = (i: number) => touch(fine, i) ?? sign(i).fine;
  /**
   * Frame b is frame a's picture as another GOP encoded it: they are in different GOPs, no 8x8
   * block's mean moved by more than the keyframe band's block and no mean by more than its pixel.
   */
  const requantized = (a: number, b: number): boolean => gop[a] !== gop[b] && requantizedPicture(a, b);
  /** The same test without the GOPs: b is within the keyframe band of a. */
  const requantizedPicture = (a: number, b: number): boolean => requantBlocks(a, b) && requantMeans(a, b);
  /**
   * Its block half, from the signatures alone. A 16x16 block's mean is its 8x8 blocks' weighted
   * mean, so one past the block band proves an 8x8 block past it (and one past the pixel band, a mean).
   */
  const requantBlocks = (a: number, b: number): boolean => {
    const band = noise?.keyframe;
    if (!band) return false;
    return !apart(a, b, Math.min(band.block, band.pixel)) && !signaturesApart(fineOf(a), fineOf(b), band.block);
  };
  /** Its pixel half: no mean moved past the pixel band. Needs both frames' means. */
  const requantMeans = (a: number, b: number): boolean =>
    frameDelta(frames.pixels(a), frames.pixels(b), width, height, { floor: noise!.keyframe!.pixel, mask, still })
      .over === 0;
  /**
   * Inside `box`, frame m's 8x8 block means are nearer frame a's than frame b's: the largest block
   * difference to a is smaller. A re-quantized picture is only a re-quantization of the state when
   * it is nearer the state than the event's own picture: a 1px caret or a changed digit is within
   * any re-quantization band of the state, but not nearer it than to itself.
   */
  const nearer = (m: number, a: number, b: number, box: Box): boolean => {
    const bw = Math.ceil(width / 8);
    const fm = fineOf(m);
    const fa = fineOf(a);
    const fb = fineOf(b);
    let da = 0;
    let db = 0;
    for (let by = Math.floor(box.y / 8); by <= Math.floor((box.y + box.height - 1) / 8); by++) {
      for (let bx = Math.floor(box.x / 8); bx <= Math.floor((box.x + box.width - 1) / 8); bx++) {
        for (let c = 0; c < 4; c++) {
          const i = (by * bw + bx) * 4 + c;
          if (Number.isNaN(fm[i]!)) continue;
          da = Math.max(da, Math.abs(fm[i]! - fa[i]!));
          db = Math.max(db, Math.abs(fm[i]! - fb[i]!));
        }
      }
    }
    return da < db;
  };
  /**
   * Frame b moved past `still` from frame a over at least a quarter of the frame's width and of its
   * height: a keyframe re-encodes the whole picture, so its noise is everywhere there is an edge. A
   * digit or a caret that changes on a keyframe moves past the band only where it is.
   */
  const spread = (a: number, b: number): boolean => {
    const d = frameDelta(frames.pixels(a), frames.pixels(b), width, height, { floor, mask, still });
    return d.changed !== null && d.changed.width * 4 >= width && d.changed.height * 4 >= height;
  };
  /**
   * No mean moved from frame a to frame b past the floor by more than the band's own width (floor
   * minus still): a re-encoding that leaves most of the picture alone can still push a mean or two
   * just over. Measured at 430 GOP starts of the known answers, such noise crossed the floor at two,
   * one mean at 34 each (and at 35 against a state read again); the smallest change a codec passed
   * through, a 12px digit, moved its means by 53.
   */
  const marginal = (a: number, b: number): boolean =>
    frameDelta(frames.pixels(a), frames.pixels(b), width, height, { floor: 2 * floor - still!, mask, still }).over ===
    0;
  /**
   * Some mean inside `box` moved past the floor between frames a and b, computed there from the
   * decoded pixels (as `boxMean` rounds) — so b is not back to a, without reading b's means
   * everywhere. A window scanned for a return reads every frame after a small change, and the
   * full comparison made each one a frame of means: 1042 of 1321 on a 720p recording.
   */
  const regionApart = (a: number, b: number, box: Box): boolean =>
    noise !== null && meansApartIn(pixels.pixels(a), pixels.pixels(b), width, height, noise.radius, box, floor, mask);
  /** Frames i and j are one picture by the band: every mean within `still` of the other's. */
  const holds = (i: number, j: number): boolean => !apart(i, j, still!) && delta(i, j).identical;
  /** Frame m's mean over `box` per channel (ignored pixels aside). */
  const regionMean = (m: number, box: Box): [number, number, number, number] => {
    const f = frames.pixels(m);
    const sum = [0, 0, 0, 0];
    let n = 0;
    for (let y = box.y; y < box.y + box.height; y++) {
      for (let p = y * width + box.x, end = p + box.width; p < end; p++) {
        if (mask !== null && mask[p] === 1) continue;
        const i = p << 2;
        sum[0] += f[i]!;
        sum[1] += f[i + 1]!;
        sum[2] += f[i + 2]!;
        sum[3] += f[i + 3]!;
        n++;
      }
    }
    return n === 0 ? [0, 0, 0, 0] : [sum[0]! / n, sum[1]! / n, sum[2]! / n, sum[3]! / n];
  };
  /** The frames after j, as far as `settleMs` reaches (or the sequence's end), are one picture with j. */
  const stillAfter = (j: number): boolean => {
    for (let m = j + 1; m < count && entries[m]!.atMs - entries[j]!.atMs <= settleMs + EPSILON_MS; m++) {
      if (!holds(j, m)) return false;
    }
    return true;
  };

  // Frame j against frame j-1: independent of the anchor, so computed once.
  const steps: (FrameDelta | undefined)[] = [];
  const step = (j: number): FrameDelta => (steps[j] ??= delta(j - 1, j));
  // Frame j against the anchor, recomputed only when the anchor moves. A frame identical to the
  // one before it differs from the anchor exactly as that one did — byte for byte only: within the
  // noise of the frame before is not within the same distance of the anchor.
  let anchor = 0;
  let vs: (FrameDelta | undefined)[] = [];
  const vsAnchor = (j: number): FrameDelta => {
    const known = vs[j];
    if (known) return known;
    const prior = vs[j - 1];
    const d =
      j === anchor
        ? { identical: true, over: 0, box: null, changed: null, maxDelta: 0 }
        : !noise && prior && steps[j]?.identical
          ? prior
          : delta(anchor, j);
    vs[j] = d;
    return d;
  };
  const reanchor = (k: number) => {
    anchor = k;
    vs = [];
  };

  const states: StoryState[] = [{ id: "S0", frame: ref(0), visits: 1 }];
  const events: StoryEvent[] = [];
  const timeline: TimelineSpan[] = [];
  let state = "S0";
  let spanStart = 0;

  /**
   * The first k >= s whose frames stay byte-identical for `settleMs`, or to the last frame. With a
   * noise band, one picture with frame k by `holds` — each against the hold's first frame, never
   * only the one before — and, with `holdMean`, the mean over the change's box so far as still:
   * otherwise a fade slower than the band was a run of holds.
   */
  const settleFrom = (s: number): number => {
    if (noise) {
      let region: Box | null = null;
      let regionTo = s - 1;
      for (let k = s; k < count - 1; k++) {
        while (regionTo < k) region = unionBox(region, vsAnchor(++regionTo).box);
        const box = region;
        const at = noise.holdMean !== undefined && box ? regionMean(k, box) : null;
        const steady = (m: number) => {
          if (at === null) return true;
          const now = regionMean(m, box!);
          return now.every((v, c) => Math.abs(v - at[c]!) <= noise.holdMean! + 1e-9);
        };
        let m = k;
        while (m + 1 < count && holds(k, m + 1) && steady(m + 1)) {
          m++;
          if (entries[m]!.atMs - entries[k]!.atMs >= settleMs - EPSILON_MS) return k;
        }
        if (m === count - 1 && m > k) return k;
      }
      return -1;
    }
    for (let k = s; k < count - 1; k++) {
      let m = k;
      while (m + 1 < count && step(m + 1).identical) {
        m++;
        if (entries[m]!.atMs - entries[k]!.atMs >= settleMs - EPSILON_MS) return k;
      }
      if (m === count - 1 && m > k) return k;
      k = m;
    }
    return -1;
  };

  // The frame each state is compared against: its first, or where it was last read again.
  const pictureOf = new Map<string, number>();
  const picture = (st: StoryState) => pictureOf.get(st.id) ?? st.frame.n;
  /**
   * Which state frame k is: an earlier one it is within the floor of — its first frame or the one
   * it was last read again at — or, with a keyframe band, one whose picture k is re-quantized
   * (read again at k), or a new one. Within the floor first, across every state.
   */
  const stateOf = (k: number, s: number, box: Box): string => {
    const pictures = (st: StoryState) => [...new Set([picture(st), st.frame.n])];
    for (const st of states) {
      const c = pictures(st).find((c) => !apart(c, k, floor) && delta(c, k).over === 0);
      if (c !== undefined) {
        st.visits++;
        // Compared against the picture it matched from here on: the state's other one can be a
        // GOP that re-quantized it past the floor of this one.
        if (c !== picture(st)) pictureOf.set(st.id, c);
        return st.id;
      }
    }
    // Across GOPs, nearer the state's picture than the change's own: the state it departed from
    // against its first moving frame (an instant change is never back where it began), any other
    // against the frame before the change.
    for (const st of states) {
      const own = st.id === state ? s : s - 1;
      const again = (c: number) =>
        gop[c] !== gop[k] && requantBlocks(c, k) && nearer(k, c, own, box) && requantMeans(c, k);
      if (pictures(st).some(again)) {
        st.visits++;
        reread.push({ ...ref(k), state: st.id, as: "settle" });
        pictureOf.set(st.id, k);
        return st.id;
      }
    }
    const id = `S${states.length}`;
    states.push({ id, frame: ref(k), visits: 1 });
    return id;
  };

  /** Box, peak and unstable count over frames [from, to] against the anchor. */
  /**
   * With a noise band, a frame's box as the decoded pixels draw it. The means find a change but
   * draw its box wrong both ways: a 1px caret's mean moves past the floor 1px either side of it,
   * and of a glyph's thin strokes only the core does. So inside the means' box grown by twice the
   * radius, the decoded pixels that moved past the floor against the anchor's — or the means' box
   * when none did (a broad, faint change) — and how many they are. Decoded pixels carry nothing
   * of an ignored box, so they are skipped by the boxes as given, not as grown for the means.
   */
  const drawn = (
    m: number,
    box: Box | null,
    over: number,
    base = anchor,
    beyondRequantization = false,
  ): { box: Box | null; over: number } => {
    if (!noise || box === null) return { box, over };
    // Only near 8x8 blocks whose mean moved past the keyframe band's block — what a re-quantization
    // cannot do — for a frame in a GOP that has no picture of the state to be measured against.
    // Near: the block or one of its eight neighbours, since an event's edge can sit in a block that
    // moved less (a caret across two block rows moved one past the band).
    const band = beyondRequantization ? noise.keyframe : undefined;
    const bw = Math.ceil(width / 8);
    const bh = Math.ceil(height / 8);
    let near: Uint8Array | null = null;
    if (band) {
      const fa = fineOf(base);
      const fb = fineOf(m);
      near = new Uint8Array(bw * bh);
      for (let by = 0; by < bh; by++) {
        for (let bx = 0; bx < bw; bx++) {
          const k = (by * bw + bx) * 4;
          let moved = false;
          for (let c = 0; c < 4 && !moved; c++) moved = Math.abs(fa[k + c]! - fb[k + c]!) > band.block;
          if (!moved) continue;
          for (let y = Math.max(0, by - 1); y <= Math.min(bh - 1, by + 1); y++) {
            near.fill(1, y * bw + Math.max(0, bx - 1), y * bw + Math.min(bw - 1, bx + 1) + 1);
          }
        }
      }
    }
    const grow = 2 * noise.radius;
    const x0 = Math.max(0, box.x - grow);
    const y0 = Math.max(0, box.y - grow);
    const x1 = Math.min(width, box.x + box.width + grow);
    const y1 = Math.min(height, box.y + box.height + grow);
    const a = pixels.pixels(base);
    const b = pixels.pixels(m);
    let bx0 = width;
    let by0 = height;
    let bx1 = -1;
    let by1 = -1;
    let count = 0;
    for (let y = y0; y < y1; y++) {
      for (let x = x0; x < x1; x++) {
        const p = y * width + x;
        if (givenMask !== null && givenMask[p] === 1) continue;
        const i = p << 2;
        const d = Math.max(
          Math.abs(a[i]! - b[i]!),
          Math.abs(a[i + 1]! - b[i + 1]!),
          Math.abs(a[i + 2]! - b[i + 2]!),
          Math.abs(a[i + 3]! - b[i + 3]!),
        );
        if (d <= floor || (near !== null && near[(y >> 3) * bw + (x >> 3)] !== 1)) continue;
        count++;
        if (x < bx0) bx0 = x;
        if (x > bx1) bx1 = x;
        if (y < by0) by0 = y;
        if (y > by1) by1 = y;
      }
    }
    if (bx1 < 0) return near !== null ? { box: null, over: 0 } : { box, over };
    return { box: { x: bx0, y: by0, width: bx1 - bx0 + 1, height: by1 - by0 + 1 }, over: count };
  };
  const measure = (from: number, to: number, reread = -1) => {
    // Each frame against the state's picture as its GOP encodes it. A return read again in another
    // GOP is that picture there: against the anchor, what its keyframe re-quantized across the page
    // was part of a toast's box. A frame of a GOP with no such picture is drawn only where its
    // blocks moved past re-quantization: a spinner's box gathered every spot a keyframe pushed past
    // the floor. (Rebased on a return the band never had to read again, a caret's box took the
    // codec's ghost of it in the return's own frame: 4px wide.)
    const draw = (m: number, beyond: boolean) => {
      const base = reread !== -1 && gop[m] === gop[reread] ? reread : anchor;
      const d = base === anchor ? vsAnchor(m) : delta(base, m);
      const restrict = beyond && base === anchor && gop[m] !== gop[anchor] && noise?.keyframe !== undefined;
      return drawn(m, d.box, d.over, base, restrict);
    };
    const over = (beyond: boolean) => {
      let box: Box | null = null;
      let peak = from;
      let peakOver = -1;
      for (let m = from; m <= to; m++) {
        const d = draw(m, beyond);
        box = unionBox(box, d.box);
        // The peak is the frame that moved most, counted as its box is drawn.
        if (d.over > peakOver) {
          peak = m;
          peakOver = d.over;
        }
      }
      return { box, peak, peakOver };
    };
    // Nothing past re-quantization in any frame (a digit changing in a later GOP, its blocks moved
    // by 4-5): every frame as drawn.
    let drawnOver = over(true);
    if (drawnOver.box === null) drawnOver = over(false);
    let unstable = 0;
    for (let m = from; m <= to; m++) if (entries[m]!.stable === false) unstable++;
    return { box: drawnOver.box!, peak: { ...ref(drawnOver.peak), over: drawnOver.peakOver }, unstable };
  };
  const meets = (a: Box, b: Box) =>
    a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height;
  /**
   * The largest channel delta inside `box` between consecutive frames over the steps (from, to].
   * With a noise band, a step reaches back as far as `SMEAR_MS` (a codec smears one change over the
   * few frames after it, each step inside the band), and a step inside the band is none.
   */
  const stepMax = (from: number, to: number, box: Box): number => {
    if (noise) return smearedStepMax(from, to, box);
    let max = 0;
    for (let m = from + 1; m <= to; m++) {
      const st = step(m);
      // Inside the box a step is never larger than across the frame, and one whose changed pixels
      // miss the box is nothing inside it.
      if (st.identical || st.maxDelta <= max || !meets(st.changed!, box)) continue;
      const a = frames.pixels(m - 1);
      const b = frames.pixels(m);
      for (let y = box.y; y < box.y + box.height; y++) {
        for (let p = y * width + box.x, end = p + box.width; p < end; p++) {
          if (mask !== null && mask[p] === 1) continue;
          const i = p << 2;
          const d = Math.max(
            Math.abs(a[i]! - b[i]!),
            Math.abs(a[i + 1]! - b[i + 1]!),
            Math.abs(a[i + 2]! - b[i + 2]!),
            Math.abs(a[i + 3]! - b[i + 3]!),
          );
          if (d > max) max = d;
        }
      }
    }
    return max;
  };
  const smearedStepMax = (from: number, to: number, box: Box): number => {
    let max = 0;
    for (let m = from + 1; m <= to; m++) {
      let w = 1;
      while (m - w - 1 >= from && entries[m]!.atMs - entries[m - w - 1]!.atMs <= SMEAR_MS + EPSILON_MS) w++;
      const a = frames.pixels(m - w);
      const b = frames.pixels(m);
      for (let y = box.y; y < box.y + box.height; y++) {
        for (let p = y * width + box.x, end = p + box.width; p < end; p++) {
          if (mask !== null && mask[p] === 1) continue;
          const i = p << 2;
          const d = Math.max(
            Math.abs(a[i]! - b[i]!),
            Math.abs(a[i + 1]! - b[i + 1]!),
            Math.abs(a[i + 2]! - b[i + 2]!),
            Math.abs(a[i + 3]! - b[i + 3]!),
          );
          // Within the noise band a step is no step: what the codec does to a still picture.
          if (d > max && d > still!) max = d;
        }
      }
    }
    return max;
  };

  /**
   * Frame m's pixels inside `box` (ignored ones aside) are the anchor's, byte for byte. Answered
   * from the comparison already made when what differed misses the box; decoded only when it meets it.
   */
  const sameInBox = (m: number, box: Box): boolean => {
    if (m === anchor) return true;
    const changed = vsAnchor(m).changed;
    if (changed === null || !meets(changed, box)) return true;
    if (still !== undefined) {
      // Within the noise band of the anchor, as `changed` is.
      const a = frames.pixels(anchor);
      const b = frames.pixels(m);
      for (let y = box.y; y < box.y + box.height; y++) {
        for (let p = y * width + box.x, end = p + box.width; p < end; p++) {
          if (mask !== null && mask[p] === 1) continue;
          const i = p << 2;
          const d = Math.max(
            Math.abs(a[i]! - b[i]!),
            Math.abs(a[i + 1]! - b[i + 1]!),
            Math.abs(a[i + 2]! - b[i + 2]!),
            Math.abs(a[i + 3]! - b[i + 3]!),
          );
          if (d > still) return false;
        }
      }
      return true;
    }
    const a = words(frames.pixels(anchor));
    const b = words(frames.pixels(m));
    for (let y = box.y; y < box.y + box.height; y++) {
      for (let p = y * width + box.x, end = p + box.width; p < end; p++) {
        if (a[p] !== b[p] && (mask === null || mask[p] !== 1)) return false;
      }
    }
    return true;
  };
  /**
   * Where an event's own pixels last showed the state exactly: the last frame of this visit before
   * `s` that is byte-identical to the anchor inside `box`, or -1. Inside the box, not across the
   * frame: a fade elsewhere, or a residue another event left within the floor, is not this event's.
   */
  const lastSameInBox = (s: number, box: Box): number => {
    // Events of a visit come in order, so a box searched before resumes where that search began:
    // frames below it are answered. Without this, a blink repeating over a pixel held a level off
    // the anchor re-decoded the whole visit for every blink (49927 decodes for 3000 frames).
    const key = `${box.x},${box.y},${box.width},${box.height}`;
    const known = searched.get(key);
    let result = -1;
    // A frame byte-identical to the one after it has that one's answer: no decode for a hold.
    // Within the noise of it is not: the two can sit on either side of the band.
    let next: boolean | undefined;
    for (let m = s - 1; m >= (known ? known.upTo : visitStart); m--) {
      const same = !noise && next !== undefined && steps[m + 1]?.identical ? next : sameInBox(m, box);
      if (same) {
        result = m;
        break;
      }
      next = same;
    }
    if (result === -1 && known) result = known.result;
    searched.set(key, { upTo: s, result });
    return result;
  };
  /** `movedAfter` when its pixels moved below the floor first, and where the steps are counted from. */
  const leadIn = (s: number, box: Box) => {
    const same = lastSameInBox(s, box);
    return {
      movedAfter: same >= 0 && same < s - 1 ? ref(same) : undefined,
      // From there, but never from inside an earlier event of the visit; the step into it always.
      stepFrom: same >= 0 ? Math.max(same, spanStart) : s - 1,
    };
  };

  let visitStart = 0;
  let searched = new Map<string, { upTo: number; result: number }>();
  const reread: NonNullable<Storyboard["reread"]> = [];
  let j = 1;
  while (j < count) {
    // The step too, while both frames are fresh: a later search back over a hold reads it (a
    // byte-identical one only, so not with a noise band).
    if (!noise) step(j);
    if (!apart(anchor, j, floor) && vsAnchor(j).over === 0) {
      j++;
      continue;
    }
    // A keyframe re-quantizes the whole picture: on a still one its step can cross the floor
    // without anything on screen changing. When the keyframe is the state's picture re-quantized
    // — against the state's picture, not the frame before (a fade moving below the floor reached a
    // keyframe as a small step and was lost), and by its 8x8 block means (the first frame of a
    // slide or a fade-in moves them), and the noise is spread over the picture as a re-encoding's
    // is (a digit changing on a quiet keyframe moved past the band only where it is), or it moved
    // no mean much past the floor — the state is read again there and nothing happened. A change
    // that begins with the keyframe is then measured from it. Inside a run of keyframes (an
    // intra-only stream) each frame is coded alone like the one before it, so a still picture codes
    // the same unless the encoder's quality moved (x264's rate control, between an intra-only
    // stream's first two frames): there it is read again only when the page then holds, since a
    // scroll's first step is within the band too and keeps moving.
    const reencoded =
      entries[j]!.key === true &&
      (gop[j] !== gop[j - 1] ? requantized(anchor, j) : requantizedPicture(anchor, j) && stillAfter(j)) &&
      (spread(anchor, j) || marginal(anchor, j));
    if (reencoded) {
      reread.push({ ...ref(j), state, as: "keyframe" });
      pictureOf.set(state, j);
      reanchor(j);
      visitStart = j;
      searched = new Map();
      j++;
      continue;
    }
    const s = j;
    timeline.push({ state, from: ref(spanStart), to: ref(s - 1) });
    const id = `E${events.length + 1}`;

    let back = -1;
    const departed = noise ? vsAnchor(s).box : null;
    for (let m = s + 1; m < count && entries[m]!.atMs - entries[s]!.atMs <= transientMs + EPSILON_MS; m++) {
      // The step first: it does not depend on the anchor, so when this window is scanned again
      // after a change re-anchors, a frame identical to the one before it is answered without
      // decoding either — the cache holds a few dozen frames and the window is 300 at 60fps.
      // With a noise band that answer is never taken (within the band of the frame before is not
      // within it of the anchor); the signatures answer instead.
      if (noise) {
        if (apart(anchor, m, floor)) continue;
        // Still departed where it first departed: not back, read in that box only.
        if (departed && regionApart(anchor, m, departed)) continue;
      } else step(m);
      if (vsAnchor(m).over === 0) {
        back = m;
        break;
      }
    }
    if (back === -1 && noise?.keyframe) {
      // No frame came back within the floor. A keyframe inside the event can be why: the page
      // after it is the state's picture re-quantized, never within the floor of the one before.
      // Such a frame is a return when it is nearer the state than the event's first frame inside
      // the event's box — a caret still on after the keyframe is within any re-quantization band
      // of the state, but nearer itself — and the page holds after it (a spinner that has nearly
      // come round is within the band and nearer the state too, and never holds). The page can
      // have come back earlier in that GOP, for as little as a frame (a blink after a blink): the
      // return is the first frame of the GOP, after the event began, within the floor of the hold.
      const box = vsAnchor(s).box!;
      for (let m = s + 1; m < count && entries[m]!.atMs - entries[s]!.atMs <= transientMs + EPSILON_MS; m++) {
        // Cheapest first: the block tests read kept signatures; the pixel band and the hold, means.
        if (
          gop[m] !== gop[anchor] &&
          requantBlocks(anchor, m) &&
          nearer(m, anchor, s, box) &&
          requantMeans(anchor, m) &&
          stillAfter(m)
        ) {
          back = m;
          for (let k = m - 1; k > s && gop[k] === gop[m]; k--) {
            if (!apart(m, k, floor) && delta(m, k).over === 0) back = k;
          }
          break;
        }
      }
    }
    if (back !== -1) {
      const frames = back - s;
      // Back as the same picture re-quantized: compared against from here on.
      const readAgain = gop[back] !== gop[anchor] && vsAnchor(back).over > 0;
      const m = measure(s, back - 1, readAgain ? back : -1);
      const { movedAfter, stepFrom } = leadIn(s, m.box);
      events.push({
        id,
        kind: frames === 1 ? "glitch" : "transient",
        from: state,
        to: state,
        before: ref(s - 1),
        ...(movedAfter ? { movedAfter } : {}),
        first: ref(s),
        last: ref(back - 1),
        back: ref(back),
        frames,
        ...m,
        maxStepDelta: stepMax(stepFrom, back, m.box),
      });
      timeline.push({ event: id, from: ref(s), to: ref(back - 1) });
      if (readAgain) {
        reread.push({ ...ref(back), state, as: "return" });
        pictureOf.set(state, back);
        reanchor(back);
        visitStart = back;
        searched = new Map();
      }
      spanStart = back;
      j = back + 1;
      continue;
    }

    const settled = settleFrom(s);
    const end = settled === -1 ? count - 1 : settled;
    const m = measure(s, end);
    const { movedAfter, stepFrom } = leadIn(s, m.box);
    const maxStepDelta = stepMax(stepFrom, end, m.box);
    const watchedMs = Math.min(transientMs, entries[count - 1]!.atMs - entries[s]!.atMs);
    const event: StoryEvent = {
      id,
      kind: maxStepDelta <= floor ? "drift" : "change",
      from: state,
      before: ref(s - 1),
      ...(movedAfter ? { movedAfter } : {}),
      first: ref(s),
      frames: end - s + 1,
      watchedMs,
      ...m,
      maxStepDelta,
    };
    if (settled === -1) {
      events.push({ ...event, last: ref(count - 1), noHold: true });
      timeline.push({ event: id, from: ref(s), to: ref(count - 1) });
      spanStart = -1;
      break;
    }
    const to = stateOf(settled, s, m.box);
    events.push({ ...event, to, settled: ref(settled) });
    timeline.push({ event: id, from: ref(s), to: ref(settled) });
    state = to;
    // The anchor is the state's own frame, on a return to an earlier state too: anchored on the
    // hold instead, a hold within the floor of S0's frame was S0 once and a new state the next
    // time, and a fade measured from the hold called "identical to S0" a frame that was not.
    reanchor(picture(states.find((st) => st.id === to)!));
    spanStart = settled;
    visitStart = settled;
    searched = new Map();
    j = settled + 1;
  }
  if (spanStart !== -1) timeline.push({ state, from: ref(spanStart), to: ref(count - 1) });

  return {
    format: STORYBOARD_FORMAT,
    frames: {
      count,
      width,
      height,
      fromMs: entries[0]!.atMs,
      toMs: entries[count - 1]!.atMs,
      sampling: sampling(entries.map((e) => e.atMs)),
      unstable: entries.flatMap((e, i) => (e.stable === false ? [i] : [])),
    },
    rules: {
      channelFloor: floor,
      transientMs,
      settleMs,
      ignore,
      ...(noise
        ? {
            noise: {
              radius: noise.radius,
              still: noise.still,
              ...(noise.holdMean !== undefined ? { holdMean: noise.holdMean } : {}),
              ...(noise.keyframe !== undefined ? { keyframe: { ...noise.keyframe } } : {}),
            },
          }
        : {}),
    },
    states,
    events,
    timeline,
    ...(noise?.keyframe !== undefined ? { reread } : {}),
  };
}

export type KeyframeRole = "before" | "first" | "peak" | "last" | "back" | "settled";

/**
 * The frames that show an event, in order, each once: the state before it, its first frame, its
 * peak, and its last frame and the one back (a return) or the hold it settled in (a change).
 * Frames that coincide are one keyframe with both roles.
 */
export function eventKeyframes(event: StoryEvent): { roles: KeyframeRole[]; frame: FrameRef }[] {
  const named: [KeyframeRole, FrameRef | undefined][] = [
    ["before", event.before],
    ["first", event.first],
    ["peak", event.peak],
    ["last", event.last],
    ["back", event.back],
    ["settled", event.settled],
  ];
  const out: { roles: KeyframeRole[]; frame: FrameRef }[] = [];
  for (const [role, frame] of named) {
    if (!frame) continue;
    const same = out.find((k) => k.frame.n === frame.n);
    if (same) same.roles.push(role);
    else out.push({ roles: [role], frame: { n: frame.n, atMs: frame.atMs } });
  }
  return out.sort((a, b) => a.frame.n - b.frame.n);
}

const ms = (t: number): string => `${formatInstant(t)}`;
export const boxText = (b: Box): string => `${b.x},${b.y} ${b.width}x${b.height}`;

/** When it began: between the last frame that showed the state and the first that did not. */
export function beganText(e: StoryEvent): string {
  return `${ms(e.before.atMs)} – ${ms(e.first.atMs)}`;
}

/** When it ended, as an interval between two frames, or why it has none. */
export function endedText(e: StoryEvent, entries: readonly Pick<FrameEntry, "atMs">[]): string {
  if (e.back && e.last) return `${ms(e.last.atMs)} – ${ms(e.back.atMs)}`;
  if (e.settled) {
    const stillAfter = e.settled.n > 0 ? entries[e.settled.n - 1]!.atMs : e.settled.atMs;
    return `${ms(stillAfter)} – ${ms(e.settled.atMs)}`;
  }
  return "no hold by the last frame";
}

function samplingText(story: Storyboard, source: FramesSource): string {
  const s = story.frames.sampling;
  if (story.frames.count === 1) return "1 frame";
  // On the stream clock 16.67ms gaps are the recording's rate (or a thinning of it), not the held clock.
  if (s.everyFrame && source.clock !== "stream") return "every 60 fps frame";
  return s.minGapMs === s.maxGapMs ? `every ${ms(s.minGapMs)} ms` : `${ms(s.minGapMs)} to ${ms(s.maxGapMs)} ms apart`;
}

function sourceLine(source: FramesSource): string {
  return [
    source.tool + (source.step ? ` (step ${source.step})` : ""),
    source.url,
    `${source.viewport.width}x${source.viewport.height} viewport at ${source.deviceScaleFactor}x`,
    ...(source.browser ? [source.browser] : []),
    `${source.clock} clock`,
  ].join(" · ");
}

function exactRules(r: Storyboard["rules"]): string {
  return `A pixel differs when one of its channels moves by more than ${r.channelFloor} of 255. A departure from the state that comes back within ${ms(r.transientMs)} ms is one event (a glitch when it lasts one frame, a transient otherwise); one that does not is a change, which ends at the first ${ms(r.settleMs)} ms of identical frames (a drift when no step between two frames, inside its box, crosses the floor).`;
}

function noiseRules(r: Storyboard["rules"]): string {
  const n = r.noise!;
  const how =
    n.radius > 0
      ? `Compared as the mean of each pixel's ${2 * n.radius + 1}x${2 * n.radius + 1} neighbourhood`
      : "Compared pixel by pixel as decoded";
  const channel = n.radius > 0 ? "a channel of its mean" : "one of its channels";
  const mean = n.radius > 0 ? "mean" : "pixel";
  return `${how}, through a noise band: a pixel differs when ${channel} moves by more than ${r.channelFloor} of 255, and frames show one picture while every ${mean} stays within ${n.still} of the first of them${n.holdMean !== undefined ? ` and the mean over a change's box within ${n.holdMean}` : ""}. A departure from the state that comes back within ${ms(r.transientMs)} ms is one event (a glitch when it lasts one frame, a transient otherwise); one that does not is a change, which ends at the first ${ms(r.settleMs)} ms of one picture (a drift when no step between frames up to ${ms(SMEAR_MS)} ms apart, inside its box, crosses the floor).`;
}

/**
 * `SUMMARY.md`. Every value in it is read from the storyboard, which is read from the frames, so
 * the same frames give the same bytes — no output path, no wall time, no host name.
 */
export function storyboardSummary(
  story: Storyboard,
  source: FramesSource,
  entries: readonly Pick<FrameEntry, "atMs" | "index" | "key">[],
): string {
  const f = story.frames;
  const r = story.rules;
  const lines: string[] = [
    "# Storyboard",
    "",
    sourceLine(source),
    "",
    `${f.count} frame${f.count === 1 ? "" : "s"} of ${f.width}x${f.height} px from ${ms(f.fromMs)} to ${ms(f.toMs)} ms, ${samplingText(story, source)}.`,
    r.noise ? noiseRules(r) : exactRules(r),
    ...(r.ignore.length > 0 ? [`Not compared: ${r.ignore.map(boxText).join("; ")} px.`] : []),
    "",
    "## Events",
    "",
  ];
  if (story.events.length === 0) {
    const again = story.reread?.length ?? 0;
    lines.push(
      again > 0
        ? `None: every frame is within the floor of ${story.states[0]!.id}'s picture, read again at ${again} frame${again === 1 ? "" : "s"}.`
        : `None: every frame is within the floor of frame 0 (${story.states[0]!.id}).`,
    );
  } else {
    lines.push(
      "| Event | Kind | Began (ms) | Ended (ms) | Frames | Box (px) | Peak | States |",
      "|---|---|---|---|---|---|---|---|",
    );
    for (const e of story.events) {
      lines.push(
        `| ${e.id} | ${e.kind} | ${beganText(e)} | ${endedText(e, entries)} | ${e.frames} | ${boxText(e.box)} | ${e.peak.over} px at ${ms(e.peak.atMs)} | ${e.from} → ${e.to ?? "?"} |`,
      );
    }
    lines.push(
      "",
      "Began: between the last frame that showed the state and the first that did not. Ended: between the last frame that differed and the first back (glitch, transient), or between the last frame that moved and the first of the hold (change, drift). Box: every pixel the event moved over the floor, in the frames' pixels.",
    );
  }
  lines.push("", "## States", "", "| State | Frame | Visits |", "|---|---|---|");
  for (const s of story.states) lines.push(`| ${s.id} | ${ms(s.frame.atMs)} ms (n ${s.frame.n}) | ${s.visits} |`);
  lines.push(
    "",
    "## Timeline",
    "",
    story.timeline
      .map((span) => {
        const when = span.from.n === span.to.n ? ms(span.from.atMs) : `${ms(span.from.atMs)}–${ms(span.to.atMs)}`;
        return `${"state" in span ? span.state : span.event} ${when}`;
      })
      .join(" · "),
  );

  const notes: string[] = [];
  const exactly = r.noise ? "within the noise band of" : "exactly";
  const mean = r.noise && r.noise.radius > 0 ? `${2 * r.noise.radius + 1}x${2 * r.noise.radius + 1} mean` : "pixel";
  if (f.unstable.length > 0) {
    notes.push(
      `Frame${f.unstable.length === 1 ? "" : "s"} n ${f.unstable.join(", ")}: captured three times without two agreeing — motion the capture did not hold (a video, an animated image, a worker${source.clock === "wall" ? ", a script on the real clock" : ""}).`,
    );
  }
  for (const e of story.events) {
    if (e.movedAfter) {
      // What happened to them after is either a sub-floor motion or an earlier event on them.
      const after = e.movedAfter.n;
      const by = story.events.filter(
        (x) =>
          x.first.n > after &&
          x.first.n < e.first.n &&
          x.box.x < e.box.x + e.box.width &&
          e.box.x < x.box.x + x.box.width &&
          x.box.y < e.box.y + e.box.height &&
          e.box.y < x.box.y + x.box.height,
      );
      notes.push(
        by.length > 0
          ? `${e.id}: its pixels were last ${exactly} ${e.from}'s at ${ms(e.movedAfter.atMs)} ms, before ${by.map((x) => x.id).join(", ")} moved them.`
          : `${e.id}: its pixels were last ${exactly} ${e.from}'s at ${ms(e.movedAfter.atMs)} ms, and moved below the floor until it showed.`,
      );
    }
    if (e.noHold) {
      notes.push(
        `${e.id} reached no hold: the last frame (${ms(f.toMs)} ms) differs from the one before it, and what came after is not in the sequence.`,
      );
    }
    if (e.settled && f.toMs - e.settled.atMs < r.settleMs - EPSILON_MS) {
      notes.push(
        `${e.id}: the hold it settled in is the sequence's last ${ms(f.toMs - e.settled.atMs)} ms, shorter than ${ms(r.settleMs)} ms; it may still have been moving.`,
      );
    }
    if (!e.noHold && e.watchedMs !== undefined && e.watchedMs < r.transientMs - EPSILON_MS) {
      notes.push(
        `${e.id}: only ${ms(e.watchedMs)} ms followed its first frame; a return later than that is not in the sequence.`,
      );
    }
    if (e.unstable > 0) notes.push(`${e.id}: ${e.unstable} of its frames never captured the same twice.`);
  }
  const reread = story.reread ?? [];
  if (reread.length > 0) {
    const where = {
      keyframe: "a keyframe",
      return: "a return after a keyframe",
      settle: "a settle in a later GOP",
    } as const;
    const listed = reread.slice(0, 12).map((k) => `${ms(k.atMs)} ms (n ${k.n}, ${k.state}, ${where[k.as]})`);
    const band = r.noise!.keyframe!;
    notes.push(
      `Read again at ${listed.join(", ")}${reread.length > 12 ? ` and ${reread.length - 12} more` : ""}: the picture there differed from the state's only as a codec re-quantizes one — no 8x8 block's mean moved by more than ${band.block}, no ${mean} by more than ${band.pixel} — so the state was compared against it from then on. A change that small, landing on a frame read again, is not seen.`,
    );
  }
  if (r.noise) {
    for (const e of story.events) {
      if (!e.noHold) continue;
      const inside = entries.filter((_, n) => n > e.first.n && beginsGop(entries, n)).length;
      if (inside > 0) {
        notes.push(
          `${e.id} reached no hold and ${inside} keyframe${inside === 1 ? "" : "s"} fell inside it: what ${inside === 1 ? "it" : "each"} re-quantized is part of its box (\`--ignore\` what never settles).`,
        );
      }
    }
  }
  const video = source.video;
  // On the stream clock, consecutive indices are every frame the recording holds between them.
  const wholeStream =
    source.clock === "stream" &&
    !(video?.decoder === "import" && video.streamFrames === undefined) &&
    entries.every((e, i) => i === 0 || e.index === entries[i - 1]!.index! + 1);
  if (video && !video.lossless) {
    const onKey = story.events.filter((e) => beginsGop(entries, e.first.n)).map((e) => e.id);
    const keyText =
      onKey.length > 0
        ? `; ${onKey.join(", ")} ${onKey.length === 1 ? "begins" : "begin"} on a keyframe, where the codec re-quantizes the whole picture`
        : "";
    const what = video.decoder === "import" ? "frames not marked lossless" : `${video.codec}, a lossy codec`;
    notes.push(
      r.noise
        ? `Decoded from ${what}, compared through the noise band: what the codec does to a still picture stays inside it, so a change on screen smaller than the floor, over a ${mean}, is not seen, and a codec that blurs a change in or out over several frames moves where it begins and ends${keyText}.`
        : `Decoded from ${what}, compared exactly: an event can be codec noise rather than a change on screen${keyText}.`,
    );
  } else if (r.noise) {
    notes.push(
      `Compared through a noise band, though the frames are not from a lossy recording: a change smaller than the floor, over a ${mean}, is not seen.`,
    );
  }
  if (wholeStream && f.count > 1) {
    notes.push(
      `Every frame the recording holds from its frame ${entries[0]!.index} to its frame ${entries[entries.length - 1]!.index} (frames.json \`index\`), up to ${ms(f.sampling.maxGapMs)} ms apart: a glitch is one recorded frame, and what the recorder did not capture is not here.`,
    );
  } else if (f.count > 1 && (source.clock === "stream" || !f.sampling.everyFrame)) {
    notes.push(
      `Frames up to ${ms(f.sampling.maxGapMs)} ms apart: something shorter than a gap can fall between two frames and not appear, and a glitch is one frame of the sequence, not one rendered frame.`,
    );
  } else if (f.sampling.everyFrame && source.clock === "wall") {
    notes.push(
      "Frames are 60 fps apart on the real clock: a script's frames are where it was when each was shot, not every frame it rendered.",
    );
  }
  if (notes.length > 0) lines.push("", "## Notes", "", ...notes.map((n) => `- ${n}`));
  return lines.join("\n") + "\n";
}

/** A keyframe as the brief lists it: the file it was written to, its roles, its instant. */
export interface BriefImage {
  file: string;
  roles: KeyframeRole[];
  atMs: number;
  /** A crop of the event's box, magnified `zoom` times. */
  crop?: { file: string; zoom: number; box: Box };
}

/**
 * `narrate/BRIEF.md`: the events, their measured facts, and the pictures of each, for the agent's
 * own vision to say what changed. It asks for words, not a verdict, and nothing reads the answer
 * back — a narrative gate stays off until a bench shows narration adds something the table does not.
 */
export function storyboardBrief(
  story: Storyboard,
  images: ReadonlyMap<string, readonly BriefImage[]>,
  shown: number,
): string {
  const lines = [
    "# Narrate this storyboard",
    "",
    "The events below were measured from the pixels: their times, frame counts and boxes are measurements.",
    "Do not change them or estimate others. What they cannot say is what each change *is*, which is your part.",
    "",
    "For each event, open its pictures with your image-reading tool. A `crop` file is the event's box cut from",
    "that frame at full resolution and magnified; the full frames show where it sits.",
    "",
    "Write `NARRATION.md` in this directory, one line per event starting with its id, saying what the page",
    'shows changing — `E2: a toast reading "Saved" appears at the bottom right and leaves`. When you cannot',
    "tell, write `E2: unclear` and why. Describe only what the pictures show.",
  ];
  if (story.events.length === 0) lines.push("", "There are no events: every frame is within the floor of frame 0.");
  if (shown < story.events.length) {
    lines.push("", `This brief has the first ${shown} of ${story.events.length} events; SUMMARY.md lists them all.`);
  }
  for (const e of story.events.slice(0, shown)) {
    const span = e.back ? `${e.frames} frame${e.frames === 1 ? "" : "s"}` : `${e.frames} frames to a hold`;
    lines.push(
      "",
      `## ${e.id} — ${e.kind}, ${e.from} → ${e.to ?? "?"}, first at ${ms(e.first.atMs)} ms, ${e.noHold ? "no hold by the last frame" : span}, box ${boxText(e.box)} px`,
      "",
    );
    for (const img of images.get(e.id) ?? []) {
      lines.push(`- \`${img.file}\` — ${img.roles.join(" + ")}, ${ms(img.atMs)} ms`);
      if (img.crop) lines.push(`  - \`${img.crop.file}\` — the box with a margin, magnified ${img.crop.zoom}x`);
    }
  }
  return lines.join("\n") + "\n";
}
