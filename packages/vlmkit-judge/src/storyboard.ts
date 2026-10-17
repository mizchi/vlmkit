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
/** …and at least this many frames: a codec smears over frames, and at 30fps 50ms is one. */
export const SMEAR_FRAMES = 3;
/** A keyframe read again moved no 16x16 block's mean by more than this (0-255): a fade does. */
export const KEYFRAME_REGION = 12;
/** A hold is confirmed this far after its first frame: no block of the page creeping away from it. */
export const HOLD_CONFIRM_MS = 1000;
/** …by more than this on a 16x16 block's mean (0-255), without a sharp step. */
export const HOLD_CREEP = 16;
/**
 * …and only when the block was already moving that way: by more than this (0-255) in the second
 * before the hold or inside it. What starts after the hold is a new event.
 */
export const HOLD_ONGOING = 4;
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
 * frames within `still` of each other everywhere show one picture (a hold), and a pixel differs
 * from the state when its mean moves by more than `floor` — so a frame is back in a state when no
 * mean is more than `floor` from the state's picture. Between the two is what the codec does to a
 * still picture.
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

/** The largest difference of any channel of any block of `a` and `b` (blocks one of them leaves out aside). */
export function signaturesApartBy(a: Float32Array, b: Float32Array): number {
  let max = 0;
  for (let i = 0; i < a.length; i++) {
    const d = Math.abs(a[i]! - b[i]!);
    if (d > max) max = d;
  }
  return max;
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
   * event's box were byte-identical to `from`'s picture (with a noise band, every mean within
   * `still` of it), when it is earlier than `before`. After it those pixels were no longer the
   * state's: moving below the floor (a fade that had not yet shown), or moved by an earlier event
   * of the visit that left them within the floor. Movement elsewhere does not count.
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
   * The frame the state was first settled in, and the anchor while the page is in the state —
   * until, with a keyframe band, the state's picture is read again (`Storyboard.reread`): from then
   * on that frame is compared against, and this one only when a later frame matches it instead.
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
   * than the picture it replaced (or, inside a run of keyframes, a frame of the run the page then
   * held in), and different from it only as a re-quantization. `as` says where: a keyframe the
   * still page departed at, a return after an event, or a change settling back.
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
 * Frame i begins a GOP. With GOP numbers (`scan video` writes them, counted in decode order on
 * every frame), where the number changes: a selection that skips a keyframe still has the boundary,
 * and an open GOP's leading B-frames, which carry the next GOP's re-quantization before its
 * keyframe is shown, are counted in it. Without them, a keyframe after a predicted frame. Either
 * way a run of keyframes is one GOP: MJPEG and ProRes decode a still picture byte-identically
 * (61 of 61 frames), so a run is not re-quantized as a whole — taken as GOPs, every MJPEG frame
 * was one and a scroll's first step read as the page re-quantized. (Inside a run a frame is read
 * again only when the page then holds: x264 re-quantizes an intra-only stream once.)
 */
export function beginsGop(entries: readonly Pick<FrameEntry, "key" | "gop">[], i: number): boolean {
  if (i <= 0) return false;
  const a = entries[i - 1]!.gop;
  const b = entries[i]!.gop;
  if (a !== undefined && b !== undefined) return b !== a;
  return entries[i]!.key === true && entries[i - 1]!.key !== true;
}

/**
 * Segment a sequence. `entries` are the manifest's frames in order (strictly increasing `atMs`),
 * `pixels` reads each one; the frames must all be `pixels.width x pixels.height`.
 */
export function buildStoryboard(
  entries: readonly Pick<FrameEntry, "n" | "atMs" | "stable" | "key" | "gop">[],
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
  // recording each read of a frame's means was a decode and 75ms of arithmetic. Each frame's 16x16
  // signature is kept (130 KB at 1080p), and its 8x8 block means from the same pass (520 KB), so a
  // frame seen once is apart from another without being read again. Both are kept for every frame
  // of the 5s window and 64 more (anchors, state pictures): sized by bytes alone (128 MB) the 8x8
  // means held 257 frames at 1080p, under a 60fps window's 301, and each change's scan recomputed
  // them (8 means a frame against 2). The 8x8 means stop at 512 MB, 258 frames at 4K (under a 60fps window there).
  const signatures = new Map<number, Float32Array>();
  const fine = new Map<number, Float32Array>();
  const signatureBytes = Math.ceil(width / SIGNATURE_BLOCK) * Math.ceil(height / SIGNATURE_BLOCK) * 16;
  let windowFrames = 1;
  for (let i = 0, k = 0; i < count; i++) {
    while (k + 1 < count && entries[k + 1]!.atMs - entries[i]!.atMs <= transientMs + EPSILON_MS) k++;
    windowFrames = Math.max(windowFrames, k - i + 1);
  }
  const keptSignatures = Math.max(64, windowFrames + 64, Math.floor((128 * 1024 * 1024) / signatureBytes));
  const keptFine = Math.max(
    32,
    Math.min(
      Math.max(windowFrames + 64, Math.floor((128 * 1024 * 1024) / (signatureBytes * 4))),
      Math.floor((512 * 1024 * 1024) / (signatureBytes * 4)),
    ),
  );
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
  // A state's picture is compared against on every later settle, so its signatures are pinned out
  // of the window's LRU: evicted, each new state recomputed every earlier picture's means (a
  // counter ticking on a still page, 4665 means for 80 states at 1080p against 0 with them kept).
  // Up to 256 MB of them; past that, states are read through the LRU like any frame.
  const pinnedCoarse = new Map<number, Float32Array>();
  const pinnedFine = new Map<number, Float32Array>();
  const keptPinned = Math.max(16, Math.floor((256 * 1024 * 1024) / (signatureBytes * 5)));
  const sign = (i: number) => {
    const both = blockSignatures(frames.pixels(i), width, height, mask);
    keep(signatures, i, both.coarse, keptSignatures);
    keep(fine, i, both.fine, keptFine);
    return both;
  };
  const pin = (i: number) => {
    if (noise === null || pinnedCoarse.has(i) || pinnedCoarse.size >= keptPinned) return;
    const coarse = touch(signatures, i);
    const eights = touch(fine, i);
    const both = coarse && eights ? { coarse, fine: eights } : sign(i);
    pinnedCoarse.set(i, both.coarse);
    pinnedFine.set(i, both.fine);
  };
  const signature = (i: number) => pinnedCoarse.get(i) ?? touch(signatures, i) ?? sign(i).coarse;
  /** Frames i and j differ by more than t somewhere, proved from their signatures (false: maybe not). */
  const apart = (i: number, j: number, t: number) => noise !== null && signaturesApart(signature(i), signature(j), t);
  const ref = (i: number): FrameRef => ({ n: i, atMs: entries[i]!.atMs });

  // Each frame's GOP: how many frames after frame 0 that begin one are at or before it.
  const gop: number[] = [];
  entries.forEach((_, i) => gop.push(i === 0 ? 0 : gop[i - 1]! + (beginsGop(entries, i) ? 1 : 0)));
  const fineOf = (i: number) => pinnedFine.get(i) ?? touch(fine, i) ?? sign(i).fine;
  /**
   * Frames i and j differ by more than t somewhere, proved from 8x8 means already computed — never
   * computing them (false: not known). A mean of differences is never larger than the largest.
   */
  const fineApart = (i: number, j: number, t: number): boolean => {
    if (noise === null) return false;
    const a = pinnedFine.get(i) ?? touch(fine, i);
    const b = pinnedFine.get(j) ?? touch(fine, j);
    return a !== undefined && b !== undefined && signaturesApart(a, b, t);
  };
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
   * The step from frame a to frame b is what a keyframe does to a still picture and no more: no
   * mean past the floor by more than the default band's width (8), and no 16x16 block's mean
   * moved by more than `KEYFRAME_REGION`. Measured with changes planted exactly on a forced
   * keyframe through x264, x265, VP9 and AV1 at five qualities, a still page's keyframe moved
   * its means by 36 at most up to crf 28 (54 at crf 35), and the smallest change, a 12px digit, by
   * 64 or more (54 at crf 35, where nothing tells the two apart). Spread over the picture, the
   * test this replaces, let 24 counters, a 1px scroll and a 1px text shift be read as the page
   * re-encoded at every quality. A region's mean is what a fade moves and a re-encoding does not:
   * a 16-level tint moved 16x16 blocks by 16-20, a crf 28 keyframe by 8 at most. A re-encoding has
   * a tail where a change has a core (`tailFits`): x264's last keyframe in a stream, coded coarser,
   * moved 15-17 means past the floor and 1-3 of them past 40, to 46; the digit moved 5, 4 of them
   * past 40, to 62.
   */
  const reencodes = (a: number, b: number): boolean => {
    if (signaturesApartBy(signature(a), signature(b)) > KEYFRAME_REGION) return false;
    return tailFits(a, b, mask);
  };
  /**
   * Of the means of b past the floor of a's (outside `m`), none is past it by more than twice the
   * default band's width (16), and no more than a quarter of them by more than its width (8).
   */
  const tailFits = (a: number, b: number, m: Uint8Array | null): boolean => {
    const w = LOSSY_NOISE.floor - LOSSY_NOISE.still;
    const fa = frames.pixels(a);
    const fb = frames.pixels(b);
    let past = 0;
    let wide = 0;
    for (let p = 0, n = width * height; p < n; p++) {
      if (m !== null && m[p] === 1) continue;
      const i = p << 2;
      const d = Math.max(
        Math.abs(fa[i]! - fb[i]!),
        Math.abs(fa[i + 1]! - fb[i + 1]!),
        Math.abs(fa[i + 2]! - fb[i + 2]!),
        Math.abs(fa[i + 3]! - fb[i + 3]!),
      );
      if (d <= floor) continue;
      if (d > floor + 2 * w) return false;
      past++;
      if (d > floor + w) wide++;
    }
    return wide * 4 <= past;
  };
  /**
   * Some mean inside `box` moved past the floor between frames a and b, computed there from the
   * decoded pixels (as `boxMean` rounds) — so b is not back to a, without reading b's means
   * everywhere. A window scanned for a return reads every frame after a small change, and the
   * full comparison made each one a frame of means: 1042 of 1321 on a 720p recording.
   */
  const regionApart = (a: number, b: number, box: Box): boolean =>
    noise !== null &&
    // Over most of the frame the full comparison is cheaper: a box that was the union of two marks
    // far apart, scanned to the one still changed, took 259ms at 1080p against 109ms for it.
    box.width * box.height * 2 <= width * height &&
    meansApartIn(pixels.pixels(a), pixels.pixels(b), width, height, noise.radius, box, floor, mask);
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
  /**
   * The page holds from frame j for `settleMs`, as a change's hold does (`holdsFrom`). Never at the
   * sequence's end: with fewer frames after j than that, nothing shows it holds (a spinner whose
   * last frame was nearly round read as back).
   */
  const heldAfter = (j: number, region: Box | null): boolean =>
    entries[count - 1]!.atMs - entries[j]!.atMs >= settleMs - EPSILON_MS && holdsFrom(j, region) === "held";
  // Where each GOP begins.
  const gopStart: number[] = [];
  entries.forEach((_, i) => {
    if (gopStart[gop[i]!] === undefined) gopStart[gop[i]!] = i;
  });
  /**
   * Frame m no longer shows the event inside `box`: no 8x8 block there that moved past the floor
   * from the state's picture a is, over its means, less than half as far from the event's first
   * frame s. Nearer by the largest 8x8 mean (`nearer`) is not enough: a digit that changed with a
   * toast moves those by 4-5, and the frame after the toast, with the new digit, read as the state
   * come back (a counter lost). Per mean it is too much: re-quantization can move one toward the
   * event's own value, so a block's sum decides.
   */
  const leftEvent = (m: number, a: number, s: number, box: Box): boolean => {
    const fm = frames.pixels(m);
    const fa = frames.pixels(a);
    const fs = frames.pixels(s);
    const r = noise!.radius;
    const x0 = Math.max(0, box.x - r);
    const y0 = Math.max(0, box.y - r);
    const x1 = Math.min(width, box.x + box.width + r);
    const y1 = Math.min(height, box.y + box.height + r);
    for (let by = y0 >> 3; by <= (y1 - 1) >> 3; by++) {
      for (let bx = x0 >> 3; bx <= (x1 - 1) >> 3; bx++) {
        let la = 0;
        let ls = 0;
        let past = false;
        for (let y = Math.max(y0, by * 8); y < Math.min(y1, by * 8 + 8); y++) {
          for (let x = Math.max(x0, bx * 8); x < Math.min(x1, bx * 8 + 8); x++) {
            const p = y * width + x;
            if (mask !== null && mask[p] === 1) continue;
            const i = p << 2;
            let da = 0;
            let ds = 0;
            for (let c = 0; c < 4; c++) {
              da = Math.max(da, Math.abs(fm[i + c]! - fa[i + c]!));
              ds = Math.max(ds, Math.abs(fm[i + c]! - fs[i + c]!));
            }
            la += da;
            ls += ds;
            if (da > floor) past = true;
          }
        }
        if (past && ls * 2 < la) return false;
      }
    }
    return true;
  };
  /**
   * Outside `around` (grown by 2·radius + 8px), frames k and m of one GOP are one picture within the
   * floor. The GOP's first frame k shows the state there, as that GOP codes it, when nothing but the
   * event changed: a change made elsewhere while the event was up stays a change.
   */
  const agreesOutside = (k: number, m: number, around: Box): boolean => {
    if (k === m) return true;
    const g = 2 * noise!.radius + 8;
    const outside = ignoreMask(
      width,
      height,
      [...ignore, { x: around.x - g, y: around.y - g, width: around.width + 2 * g, height: around.height + 2 * g }],
      noise!.radius,
    );
    return frameDelta(frames.pixels(k), frames.pixels(m), width, height, { floor, mask: outside, still }).over === 0;
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
  // The GOPs the anchor's picture is known to hold in: its own, and every GOP a frame of the state
  // was within its floor in. A frame of any other GOP began during an event, so the state's
  // picture as that GOP codes it is not known — only there can a codec's re-quantization pass for
  // the state come back. Taken anywhere, a frame after the toast with a new count in it read as
  // the state re-quantized (a counter lost behind every toast).
  let valid = new Set<number>([gop[0]!]);
  const reanchor = (k: number) => {
    anchor = k;
    vs = [];
    valid = new Set([gop[k]!]);
  };

  const states: StoryState[] = [{ id: "S0", frame: ref(0), visits: 1 }];
  pin(0);
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
        if (holdsFrom(k, region) === "held") return k;
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
  /**
   * With a noise band, whether frame k begins a hold: every frame after it for `settleMs` one
   * picture with it by `holds`, with `holdMean` the mean over `region` (the change so far) as
   * still, and no part of the page creeping away from it after (`creeps`). "end" when the frames
   * run out first: under a band that is no hold, since a fade 2 levels a frame passes the band
   * for the last few frames there are.
   */
  const holdsFrom = (k: number, region: Box | null): "held" | "moving" | "end" => {
    const at = noise!.holdMean !== undefined && region ? regionMean(k, region) : null;
    const steady = (m: number) => {
      if (at === null) return true;
      const now = regionMean(m, region!);
      return now.every((v, c) => Math.abs(v - at[c]!) <= noise!.holdMean! + 1e-9);
    };
    for (let m = k + 1; m < count; m++) {
      if (!holds(k, m) || !steady(m)) return "moving";
      if (entries[m]!.atMs - entries[k]!.atMs >= settleMs - EPSILON_MS) return creeps(k) ? "moving" : "held";
    }
    return "end";
  };
  /**
   * Some 16x16 block of the page drifts from frame k by more than `HOLD_CREEP` within
   * `HOLD_CONFIRM_MS` after it with no sharp step on the way: a fade or a dim still running, which
   * a hold's 100ms within the band cannot see — a 1s dim moves a block 10 levels per 100ms, a
   * slow fade 3. A block that gets there by a step some 3x3 mean takes past `still` within
   * `SMEAR_FRAMES` is a new event there (the next typed character), and the hold stands. Measured
   * on whole blocks, not on the change's box: a dialog that appeared at once settled on its first
   * frame while the page behind it dimmed for 700ms outside that box. And only a drift that was
   * already under way (`HOLD_ONGOING`, the same way, in the second before the hold or inside it):
   * a tooltip that began fading in 250ms after a change had settled kept that change from
   * settling, and four changes of an office app ran together into one.
   */
  const creeps = (k: number): boolean => {
    const sk = signature(k);
    let p = k;
    while (p > 0 && entries[k]!.atMs - entries[p - 1]!.atMs <= HOLD_CONFIRM_MS + EPSILON_MS) p--;
    let q = k;
    while (q + 1 < count && entries[q + 1]!.atMs - entries[k]!.atMs <= settleMs + EPSILON_MS) q++;
    const sp = signature(p);
    const sq = signature(q);
    const ongoing = (i: number, later: number) => {
      const before = sk[i]! - sp[i]!;
      const inside = sq[i]! - sk[i]!;
      return (
        (Math.abs(before) > HOLD_ONGOING && Math.sign(before) === Math.sign(later)) ||
        (Math.abs(inside) > HOLD_ONGOING && Math.sign(inside) === Math.sign(later))
      );
    };
    const settled = new Set<number>();
    for (let m = k + 1; m < count && entries[m]!.atMs - entries[k]!.atMs <= HOLD_CONFIRM_MS + EPSILON_MS; m++) {
      const sm = signature(m);
      for (let i = 0; i < sk.length; i++) {
        if (i % 4 === 3) continue;
        const b = i >> 2;
        const later = sm[i]! - sk[i]!;
        if (settled.has(b) || !(Math.abs(later) > HOLD_CREEP)) continue;
        if (!ongoing(i, later) || stepsSharply(b, k, m)) settled.add(b);
        else return true;
      }
    }
    return false;
  };
  /** Some 3x3 mean of 16x16 block b steps past `still` within `SMEAR_FRAMES` somewhere in (k, m]. */
  const stepsSharply = (b: number, k: number, m: number): boolean => {
    const bw = Math.ceil(width / SIGNATURE_BLOCK);
    const box: Box = {
      x: (b % bw) * SIGNATURE_BLOCK,
      y: Math.floor(b / bw) * SIGNATURE_BLOCK,
      width: Math.min(SIGNATURE_BLOCK, width - (b % bw) * SIGNATURE_BLOCK),
      height: Math.min(SIGNATURE_BLOCK, height - Math.floor(b / bw) * SIGNATURE_BLOCK),
    };
    for (let f = k + 1; f <= m; f++) {
      if (
        meansApartIn(
          pixels.pixels(Math.max(k, f - SMEAR_FRAMES)),
          pixels.pixels(f),
          width,
          height,
          noise!.radius,
          box,
          still!,
          mask,
        )
      ) {
        return true;
      }
    }
    return false;
  };

  /**
   * Away from `box` (grown by 2·radius + 8px), frame b is frame a's picture as a keyframe re-encodes
   * it (`reencodes`): its means past the floor a re-encoding's tail, no 16x16 block's mean by more than
   * `KEYFRAME_REGION`. The re-quantization bands alone let a counter that ticked while a toast was
   * up (its 8x8 means move by 5) read as the page come back, and the count was lost — and where m
   * was the first frame of its GOP, nothing else looked outside the event.
   */
  const reencodedOutside = (a: number, b: number, box: Box): boolean => {
    const g = 2 * noise!.radius + 8;
    const grown: Box = { x: box.x - g, y: box.y - g, width: box.width + 2 * g, height: box.height + 2 * g };
    const sa = signature(a);
    const sb = signature(b);
    const bw = Math.ceil(width / SIGNATURE_BLOCK);
    for (let i = 0; i < sa.length; i += 4) {
      const block = i >> 2;
      const at: Box = {
        x: (block % bw) * SIGNATURE_BLOCK,
        y: Math.floor(block / bw) * SIGNATURE_BLOCK,
        width: SIGNATURE_BLOCK,
        height: SIGNATURE_BLOCK,
      };
      if (meets(at, grown)) continue;
      for (let c = 0; c < 3; c++) if (Math.abs(sa[i + c]! - sb[i + c]!) > KEYFRAME_REGION) return false;
    }
    return tailFits(a, b, ignoreMask(width, height, [...ignore, grown], noise!.radius));
  };
  /**
   * Frame m, in a GOP that began during the event that departed at s (its first box `box`), is the
   * state's picture as that GOP codes it: within the re-quantization bands of the anchor, nearer
   * it than the event's first frame inside the box by 8x8 means and nowhere in the box still the
   * event (`leftEvent`), outside the event one picture with the first frame of its GOP
   * (`agreesOutside`), and, for a return, the page holds after it. A spinner nearly round is
   * within the bands and nearer the state, and never holds; a toast fading out passes the per-mean
   * hold and not the region's.
   */
  const backAcross = (m: number, s: number, box: Box, hold: boolean): boolean => {
    if (!requantBlocks(anchor, m) || !nearer(m, anchor, s, box) || !leftEvent(m, anchor, s, box)) return false;
    if (!requantMeans(anchor, m)) return false;
    if (!reencodedOutside(anchor, m, box)) return false;
    // The event where the state's picture is known: its frames in GOPs the anchor holds in.
    let extent: Box = box;
    for (let f = s + 1; f < m && f < gopStart[gop[m]!]!; f++) {
      if (valid.has(gop[f]!)) extent = unionBox(extent, vsAnchor(f).box)!;
    }
    if (!agreesOutside(gopStart[gop[m]!]!, m, extent)) return false;
    return !hold || heldAfter(m, extent);
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
      // Apart by the signatures, the 8x8 means or the change's own box before the full comparison:
      // a counter's digits differ by 4-5 per 8x8 block and by 60 inside the box.
      const c = pictures(st).find(
        (c) => !apart(c, k, floor) && !fineApart(c, k, floor) && !regionApart(c, k, box) && delta(c, k).over === 0,
      );
      if (c !== undefined) {
        st.visits++;
        // Compared against the picture it matched from here on: the state's other one can be a
        // GOP that re-quantized it past the floor of this one.
        if (c !== picture(st)) {
          pictureOf.set(st.id, c);
          pin(c);
        }
        return st.id;
      }
    }
    // The state it departed from, as a GOP that began during the change codes it: as a return
    // across a GOP is judged (`backAcross`), the hold already found. Never another state: whether
    // its picture holds in this GOP is not known, and a change landing near an older state is a
    // new state at worst — a duplicate, which loses nothing.
    if (noise?.keyframe && !valid.has(gop[k]!) && backAcross(k, s, box, false)) {
      const st = states.find((x) => x.id === state)!;
      st.visits++;
      reread.push({ ...ref(k), state: st.id, as: "settle" });
      pictureOf.set(st.id, k);
      pin(k);
      return st.id;
    }
    const id = `S${states.length}`;
    states.push({ id, frame: ref(k), visits: 1 });
    pin(k);
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
  /**
   * GOP g codes the state's picture past the floor of the anchor's away from the event: its
   * keyframe against the anchor, outside `region` (the event as drawn before the GOP began, grown
   * by 2·radius + 8px) — or, for an event that begins on the keyframe, a cluster of means past the
   * floor apart from the event's own (`noiseBesideEvent`). Only then are frames of g drawn near
   * the blocks that moved past re-quantization; where it re-quantized nothing past the floor they
   * are drawn whole, and a 1px diagonal shift kept its box (cut to a 24x19 sliver otherwise).
   * Asked of the step from the frame before instead, outside that frame's departure, a toast's box
   * took in the spot the previous keyframe had pushed past the floor (in that departure, so never
   * outside it): 452x297 for 150x32.
   */
  const noisy = (g: number, from: number, region: Box | null): boolean => {
    const k = gopStart[g]!;
    if (k === 0) return false;
    const ev = k - 1 >= from ? (region ?? vsAnchor(from).box) : null;
    const key = `${g},${from},${anchor},${ev ? boxText(ev) : ""}`;
    const known = noisyGops.get(key);
    if (known !== undefined) return known;
    let result: boolean;
    if (k - 1 >= from) {
      const pad = 2 * noise!.radius + 8;
      const outside = ev
        ? ignoreMask(
            width,
            height,
            [...ignore, { x: ev.x - pad, y: ev.y - pad, width: ev.width + 2 * pad, height: ev.height + 2 * pad }],
            noise!.radius,
          )
        : mask;
      result =
        frameDelta(frames.pixels(anchor), frames.pixels(k), width, height, { floor, mask: outside, still }).over > 0;
    } else {
      result = noiseBesideEvent(k);
    }
    noisyGops.set(key, result);
    return result;
  };
  const noisyGops = new Map<string, boolean>();
  /**
   * For an event that begins on keyframe k: the 8x8 blocks where a mean of k is past the floor of
   * the anchor's, gathered into clusters (gaps of up to two blocks bridged). The event is every
   * cluster holding a block whose mean moved past the keyframe band; any other cluster is the
   * keyframe's own re-quantization. Asked as "the step into k spans a quarter of the frame", a
   * badge with a spot of text re-quantized 240px away was drawn whole (103x273 for 100x30), and a
   * 1px shift of a 240x75 block, its own pixels the quarter, was cut to a 24x19 sliver.
   */
  const noiseBesideEvent = (k: number): boolean => {
    const band = noise!.keyframe!.block;
    const fa = fineOf(anchor);
    const fk = fineOf(k);
    const bw = Math.ceil(width / 8);
    const bh = Math.ceil(height / 8);
    const past = new Uint8Array(bw * bh);
    const ma = frames.pixels(anchor);
    const mk = frames.pixels(k);
    for (let p = 0, n = width * height; p < n; p++) {
      if (mask !== null && mask[p] === 1) continue;
      const i = p << 2;
      const d = Math.max(
        Math.abs(ma[i]! - mk[i]!),
        Math.abs(ma[i + 1]! - mk[i + 1]!),
        Math.abs(ma[i + 2]! - mk[i + 2]!),
        Math.abs(ma[i + 3]! - mk[i + 3]!),
      );
      if (d > floor) {
        const y = (p / width) | 0;
        past[(y >> 3) * bw + ((p - y * width) >> 3)] = 1;
      }
    }
    const seen = new Uint8Array(bw * bh);
    const stack: number[] = [];
    for (let b = 0; b < bw * bh; b++) {
      if (past[b] !== 1) continue;
      let moved = false;
      for (let c = 0; c < 4 && !moved; c++) moved = Math.abs(fa[b * 4 + c]! - fk[b * 4 + c]!) > band;
      if (moved) {
        seen[b] = 1;
        stack.push(b);
      }
    }
    while (stack.length > 0) {
      const b = stack.pop()!;
      const bx = b % bw;
      const by = (b / bw) | 0;
      for (let y = Math.max(0, by - 2); y <= Math.min(bh - 1, by + 2); y++) {
        for (let x = Math.max(0, bx - 2); x <= Math.min(bw - 1, bx + 2); x++) {
          const q = y * bw + x;
          if (past[q] === 1 && seen[q] === 0) {
            seen[q] = 1;
            stack.push(q);
          }
        }
      }
    }
    for (let b = 0; b < bw * bh; b++) if (past[b] === 1 && seen[b] === 0) return true;
    return false;
  };
  const measure = (from: number, to: number, reread = -1) => {
    // Each frame against the state's picture as its GOP encodes it. A return read again in another
    // GOP is that picture there: against the anchor, what its keyframe re-quantized across the page
    // was part of a toast's box. A frame of a GOP with no such picture is drawn only where its
    // blocks moved past re-quantization: a spinner's box gathered every spot a keyframe pushed past
    // the floor. (Rebased on a return the band never had to read again, a caret's box took the
    // codec's ghost of it in the return's own frame: 4px wide.)
    const draw = (m: number, beyond: boolean, before: Box | null) => {
      const base = reread !== -1 && gop[m] === gop[reread] ? reread : anchor;
      const d = base === anchor ? vsAnchor(m) : delta(base, m);
      const restrict =
        beyond &&
        base === anchor &&
        !valid.has(gop[m]!) &&
        noise?.keyframe !== undefined &&
        noisy(gop[m]!, from, before);
      return drawn(m, d.box, d.over, base, restrict);
    };
    const over = (beyond: boolean) => {
      let box: Box | null = null;
      let peak = from;
      let peakOver = -1;
      // The event as drawn before each GOP began: where a GOP's own re-quantization is not.
      let before: Box | null = null;
      for (let m = from; m <= to; m++) {
        if (m > from && gop[m] !== gop[m - 1]) before = box;
        const d = draw(m, beyond, before);
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
    // Never no box: an event's first frame departed from the anchor past the floor, so its means
    // say where. (Drawn against a return read again, every frame of an event can be within the
    // floor of it: `snapshot storyboard` threw on a one-frame flash before a new count.)
    const box = drawnOver.box ?? vsAnchor(from).box ?? vsAnchor(from).changed ?? { x: 0, y: 0, width, height };
    return { box, peak: { ...ref(drawnOver.peak), over: Math.max(0, drawnOver.peakOver) }, unstable };
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
      while (
        m - w - 1 >= from &&
        (w < SMEAR_FRAMES || entries[m]!.atMs - entries[m - w - 1]!.atMs <= SMEAR_MS + EPSILON_MS)
      )
        w++;
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
   * Frame m's pixels inside `box` (ignored ones aside) are the anchor's, byte for byte — with a
   * noise band, every mean within `still` of it. Answered from the comparison already made when
   * what differed misses the box; decoded only when it meets it.
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
   * Where an event's own pixels last showed the state: the last frame of this visit before `s`
   * that is the anchor inside `box` (`sameInBox`), or -1. Inside the box, not across the
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
      valid.add(gop[j]!);
      j++;
      continue;
    }
    // A keyframe re-quantizes the whole picture: on a still one its step can cross the floor
    // without anything on screen changing. When the step from the state's picture is no more than
    // that (`reencodes`: just past the floor, no region moved — against the state's picture, not
    // the frame before, or a fade moving below the floor reached a keyframe as a small step and
    // was lost) the state is read again there and nothing happened. Anything more is an event,
    // keyframe or not, and SUMMARY.md says it begins on one: a codec that re-encodes a still page
    // past that (x264 crf 35 with a 1s GOP moved means by 90) shows its keyframes as events, rather
    // than a real change landing on one being lost. Where a GOP begins, or inside a run of
    // keyframes (MJPEG, ProRes, an intra-only encode) only when the page then holds: there each
    // frame is coded alone like the one before it, and MJPEG and ProRes decode a still page byte
    // for byte, but x264's rate control re-quantizes an intra-only stream once, between its first
    // two frames, and without a re-read every such recording of a still page began with a
    // page-wide change. Taken without the hold, a fade a level or two a frame was read again at
    // every frame and lost.
    const reencoded =
      (gop[j] !== gop[j - 1]
        ? requantized(anchor, j)
        : entries[j]!.key === true && entries[j - 1]!.key === true && requantizedPicture(anchor, j)) &&
      reencodes(anchor, j) &&
      (gop[j] !== gop[j - 1] || heldAfter(j, null));
    if (reencoded) {
      reread.push({ ...ref(j), state, as: "keyframe" });
      pictureOf.set(state, j);
      pin(j);
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
    // A return across a GOP is read again at the frame found holding, never at an earlier one it
    // was dated back to: there a fade-out can still be on its way to it.
    let held = -1;
    // Where the event departed. In a GOP the state's picture is not known in (the event began on
    // its keyframe), the means past the floor are the event and whatever that keyframe
    // re-quantized anywhere on the page: a spot of text 240px above a toast was "still the event"
    // in every later frame, so the toast never came back (two changes, three states). So there,
    // the event as drawn past re-quantization; the rest of the frame is held to a keyframe's
    // re-encoding by `reencodedOutside`, which is what still catches a counter changed under it.
    const departed = noise
      ? noise.keyframe && !valid.has(gop[s]!)
        ? (drawn(s, vsAnchor(s).box, vsAnchor(s).over, anchor, true).box ?? vsAnchor(s).box)
        : vsAnchor(s).box
      : null;
    for (let m = s + 1; m < count && entries[m]!.atMs - entries[s]!.atMs <= transientMs + EPSILON_MS; m++) {
      // The step first: it does not depend on the anchor, so when this window is scanned again
      // after a change re-anchors, a frame identical to the one before it is answered without
      // decoding either — the cache holds a few dozen frames and the window is 300 at 60fps.
      // With a noise band that answer is never taken (within the band of the frame before is not
      // within it of the anchor); the signatures answer instead.
      let exact: boolean;
      if (noise) {
        // Still departed where it first departed: not back, read in that box only.
        exact =
          !apart(anchor, m, floor) &&
          !fineApart(anchor, m, floor) &&
          !(departed && regionApart(anchor, m, departed)) &&
          vsAnchor(m).over === 0;
      } else {
        step(m);
        exact = vsAnchor(m).over === 0;
      }
      if (exact) {
        back = m;
        valid.add(gop[m]!);
        break;
      }
      // In a GOP that began during the event, the state's picture as that GOP codes it is not
      // known, and never within the floor of the one before: a frame there that is the state's
      // picture re-quantized is a return (`backAcross`), whichever comes first. Then dated back
      // over the frames before it in that GOP that are one picture with it and within the bands.
      if (noise?.keyframe && !valid.has(gop[m]!) && backAcross(m, s, departed!, true)) {
        // The page can have come back earlier in m's GOP, for as little as a frame (a blink after
        // a blink): the first frame of it, after the event began, that is one picture with m by
        // the band's `still` (as a hold is) and is itself within the bands of the state and clear
        // of the event. Within the floor of m, a toast fading out 3 levels a frame was dated back
        // to a frame still 33 levels off the page, and the rest of the fade read as a drift.
        back = m;
        held = m;
        for (let k = Math.max(s + 1, gopStart[gop[m]!]!); k < m; k++) {
          if (holds(m, k) && requantBlocks(anchor, k) && leftEvent(k, anchor, s, departed!)) {
            back = k;
            break;
          }
        }
        break;
      }
    }
    if (back !== -1) {
      const frames = back - s;
      // Back as the same picture re-quantized: compared against from here on, as the frame found
      // holding codes it.
      const again = held === -1 ? back : held;
      const readAgain = gop[again] !== gop[anchor] && (vsAnchor(back).over > 0 || vsAnchor(again).over > 0);
      const m = measure(s, back - 1, readAgain ? again : -1);
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
        reread.push({ ...ref(again), state, as: "return" });
        pictureOf.set(state, again);
        pin(again);
        reanchor(again);
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
  return `${how}, through a noise band: a pixel differs when ${channel} moves by more than ${r.channelFloor} of 255, and frames show one picture while every ${mean} stays within ${n.still} of the first of them${n.holdMean !== undefined ? ` and the mean over a change's box within ${n.holdMean}` : ""}. A departure from the state that comes back within ${ms(r.transientMs)} ms is one event (a glitch when it lasts one frame, a transient otherwise); one that does not is a change, which ends at the first ${ms(r.settleMs)} ms of one picture (a drift when no step between frames up to ${ms(SMEAR_MS)} ms or ${SMEAR_FRAMES} frames apart, inside its box, crosses the floor; under a band, which of the two a change is follows the codec's noise and the frame rate as much as the change).`;
}

/**
 * `SUMMARY.md`. Every value in it is read from the storyboard, which is read from the frames, so
 * the same frames give the same bytes — no output path, no wall time, no host name.
 */
export function storyboardSummary(
  story: Storyboard,
  source: FramesSource,
  entries: readonly Pick<FrameEntry, "atMs" | "index" | "key" | "gop">[],
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
    const as = new Set(reread.map((k) => k.as));
    const how: string[] = [];
    if (as.has("keyframe")) {
      how.push(
        `at a keyframe, no 8x8 block's mean moved by more than ${band.block}, no 16x16 block's by more than ${KEYFRAME_REGION}, no ${mean} past ${r.channelFloor + 2 * (LOSSY_NOISE.floor - LOSSY_NOISE.still)} and no more than a quarter of those past the floor past ${r.channelFloor + (LOSSY_NOISE.floor - LOSSY_NOISE.still)}`,
      );
    }
    if (as.has("return") || as.has("settle")) {
      how.push(
        `on a return or a settle in a GOP that began during the event, no 8x8 block's mean moved by more than ${band.block} and no ${mean} by more than ${band.pixel}, the event's box was nearer the state than the event, and the rest of the frame was one picture with its GOP's first frame${as.has("return") ? " (and, for a return, the page then held)" : ""}`,
      );
    }
    notes.push(
      `Read again at ${listed.join(", ")}${reread.length > 12 ? ` and ${reread.length - 12} more (story.json's \`reread\` lists them all)` : ""}: the picture there differed from the state's only as a codec re-quantizes one — ${how.join("; ")} — so the state was compared against it from then on. A change that small, landing on a frame read again, is not seen.`,
    );
  }
  if (r.noise) {
    for (const e of story.events) {
      if (!e.noHold) continue;
      const inside = entries.filter((_, n) => n > e.first.n && beginsGop(entries, n)).length;
      if (inside > 0) {
        notes.push(
          `${e.id} reached no hold and ${inside} keyframe${inside === 1 ? "" : "s"} fell inside it: from ${inside === 1 ? "that GOP" : "those GOPs"} its box takes only the 8x8 blocks that moved past what re-quantization moves, so a keyframe that moved a block further is in it, and when no block did, every frame is drawn as it is (\`--ignore\` what never settles).`,
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
  if (r.noise?.keyframe && f.count > 1) {
    // Where the GOPs are is what lets a keyframe be read again; said when it is not known.
    const flagged = entries.some((e) => e.key !== undefined || e.gop !== undefined);
    const numbered = entries.every((e) => e.gop !== undefined);
    const thinned = !entries.every(
      (e, i) => i === 0 || e.index === undefined || e.index === entries[i - 1]!.index! + 1,
    );
    if (!flagged) {
      notes.push(
        "No frame says whether it is a keyframe (an import whose timestamp file has no key_frame column, or frames not from `scan video`): every frame is compared as one GOP, so a keyframe that re-quantizes a still page can read as a change.",
      );
    } else if (thinned && !numbered) {
      notes.push(
        "The frames are a selection without GOP numbers: a GOP that begins on a frame left out is not seen, so the frame after it can read as a change.",
      );
    } else if (!entries.some((e, i) => i > 0 && beginsGop(entries, i))) {
      notes.push(
        "No GOP begins after the first frame: a codec that refreshes its picture a band at a time (intra refresh) re-quantizes it without a keyframe, and that reads as events.",
      );
    }
    if (story.states.length > 2) {
      notes.push(
        "A state is matched against earlier ones within the floor (and against the state a change left as a GOP that began during it codes it): an earlier state that another GOP re-quantized past the floor is listed as a new one.",
      );
    }
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
  if (story.events.length === 0) {
    const again = story.reread?.length ?? 0;
    lines.push(
      "",
      again > 0
        ? `There are no events: every frame is within the floor of ${story.states[0]!.id}'s picture, read again at ${again} frame${again === 1 ? "" : "s"} (see SUMMARY.md).`
        : "There are no events: every frame is within the floor of frame 0.",
    );
  }
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
