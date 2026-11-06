/**
 * Where a picture of a target is in each frame, from the pixels alone: `inspect motion --track`.
 *
 * For motion no element describes — a canvas, WebGL, a sprite a script draws, a recording — there
 * is no box to read from the page and nothing to ask without a model. The target is given as a
 * region of one frame (by default the rest frame, where it ends up); that patch, with a margin of
 * what surrounds it so its edges count, is the template, and every frame is searched for it:
 * a coarse pass over the whole frame shrunk so the template is about 8px on its short side, then
 * the full-resolution sum of absolute differences around the best coarse place, then a parabola
 * through the sums either side for the part of a pixel.
 *
 * Not the block matcher of `flash-motion.ts`: that one follows a 16x16 block's content between
 * two consecutive frames to explain a pixel's steps, and has no notion of one object. Here one
 * picture is sought in frames far apart in time (the rest frame against the first).
 *
 * What it gives is where the picture is and how well it matches. Not its size, its turn or its
 * opacity: a target that scales or turns matches less and less, and its `present` falls with it.
 * Positions only, said so wherever it is used.
 *
 * Pure: frames in, positions out. No DOM, no Node.
 */

/** Decoded frame pixels, rows packed: 3 (RGB) or 4 (RGBA) bytes a pixel. */
export interface TrackFrame {
  width: number;
  height: number;
  channels: 3 | 4;
  data: Uint8Array;
}

export interface TrackBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface TrackResult {
  /** The target's box in this frame (frame pixels), the template's offset taken back out. */
  box: TrackBox;
  /**
   * How well the picture matches here, 0-1: 1 at its own frame, about 0 where only what was around
   * it is left. The residual (mean absolute difference a channel) against the template's own
   * contrast (its mean absolute deviation from its mean colour).
   */
  present: number;
  /** Mean absolute difference a channel at the best place, 0-255. */
  residual: number;
}

export interface TrackOptions {
  /** The frame the region is read from (default: the last). */
  templateFrame?: number;
  /** Pixels of what surrounds the region kept in the template (default: 15% of its short side, 2-8). */
  margin?: number;
}

/** RGB as one byte array of 3 a pixel, whatever the frame stores. */
function rgb(frame: TrackFrame): Uint8Array {
  if (frame.channels === 3) return frame.data;
  const n = frame.width * frame.height;
  const out = new Uint8Array(n * 3);
  for (let i = 0, j = 0; i < n; i++, j += 4) {
    out[i * 3] = frame.data[j]!;
    out[i * 3 + 1] = frame.data[j + 1]!;
    out[i * 3 + 2] = frame.data[j + 2]!;
  }
  return out;
}

interface Plane {
  width: number;
  height: number;
  /** RGB, 3 a pixel. */
  px: Uint8Array;
}

/** Box-average shrink by an integer factor (the edge pixels that do not fill a block are dropped). */
function shrink(p: Plane, s: number): Plane {
  if (s === 1) return p;
  const w = Math.floor(p.width / s);
  const h = Math.floor(p.height / s);
  const out = new Uint8Array(w * h * 3);
  const area = s * s;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      let r = 0,
        g = 0,
        b = 0;
      for (let dy = 0; dy < s; dy++) {
        let i = ((y * s + dy) * p.width + x * s) * 3;
        for (let dx = 0; dx < s; dx++, i += 3) {
          r += p.px[i]!;
          g += p.px[i + 1]!;
          b += p.px[i + 2]!;
        }
      }
      const o = (y * w + x) * 3;
      out[o] = Math.round(r / area);
      out[o + 1] = Math.round(g / area);
      out[o + 2] = Math.round(b / area);
    }
  }
  return { width: w, height: h, px: out };
}

function crop(p: Plane, x: number, y: number, w: number, h: number): Plane {
  const out = new Uint8Array(w * h * 3);
  for (let r = 0; r < h; r++)
    out.set(p.px.subarray(((y + r) * p.width + x) * 3, ((y + r) * p.width + x + w) * 3), r * w * 3);
  return { width: w, height: h, px: out };
}

/** Sum of absolute differences of `t` placed at (x, y) in `p`; stops past `bound`. */
function sad(p: Plane, t: Plane, x: number, y: number, bound: number): number {
  let sum = 0;
  const row = t.width * 3;
  for (let r = 0; r < t.height; r++) {
    let i = ((y + r) * p.width + x) * 3;
    let j = r * row;
    const end = j + row;
    for (; j < end; i++, j++) {
      const d = p.px[i]! - t.px[j]!;
      sum += d < 0 ? -d : d;
    }
    if (sum >= bound) return sum;
  }
  return sum;
}

/** The best place of `t` in `p` over x in [x0, x1] and y in [y0, y1], trying `first` before the rest. */
function search(
  p: Plane,
  t: Plane,
  x0: number,
  x1: number,
  y0: number,
  y1: number,
  first?: { x: number; y: number },
): { x: number; y: number; sum: number } {
  let best = { x: x0, y: y0, sum: Infinity };
  const at = (x: number, y: number) => {
    const s = sad(p, t, x, y, best.sum);
    if (s < best.sum) best = { x, y, sum: s };
  };
  if (first && first.x >= x0 && first.x <= x1 && first.y >= y0 && first.y <= y1) at(first.x, first.y);
  for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) at(x, y);
  return best;
}

/** Offset of a parabola's vertex through three sums (left, centre, right), within half a pixel. */
function vertex(l: number, c: number, r: number): number {
  const den = l - 2 * c + r;
  if (!(den > 0)) return 0;
  return Math.max(-0.5, Math.min(0.5, (l - r) / (2 * den)));
}

/**
 * Track the picture in `region` of the template frame across every frame. Frames must share one
 * size; the region is clipped to the frame and must keep at least 4x4 pixels.
 */
export function trackRegion(
  frames: readonly TrackFrame[],
  region: TrackBox,
  options: TrackOptions = {},
): TrackResult[] {
  if (frames.length === 0) return [];
  const { width: W, height: H } = frames[0]!;
  for (const f of frames)
    if (f.width !== W || f.height !== H)
      throw new Error(`trackRegion: frames differ in size (${f.width}x${f.height} against ${W}x${H})`);
  const k = options.templateFrame ?? frames.length - 1;
  if (k < 0 || k >= frames.length) throw new Error(`trackRegion: no frame ${k} to read the region from`);
  const rx = Math.max(0, Math.round(region.x));
  const ry = Math.max(0, Math.round(region.y));
  const rw = Math.min(W, Math.round(region.x + region.width)) - rx;
  const rh = Math.min(H, Math.round(region.y + region.height)) - ry;
  if (rw < 4 || rh < 4)
    throw new Error(
      `trackRegion: the region ${region.x},${region.y} ${region.width}x${region.height} keeps ${Math.max(0, rw)}x${Math.max(0, rh)} pixels of a ${W}x${H} frame; it needs 4x4 or more`,
    );
  const m = options.margin ?? Math.max(2, Math.min(8, Math.round(Math.min(rw, rh) * 0.15)));
  // The template: the region and what surrounds it, so a flat target on a flat ground has edges.
  const tx = Math.max(0, rx - m);
  const ty = Math.max(0, ry - m);
  const tw = Math.min(W, rx + rw + m) - tx;
  const th = Math.min(H, ry + rh + m) - ty;
  const offX = rx - tx;
  const offY = ry - ty;

  const planes: Plane[] = frames.map((f) => ({ width: W, height: H, px: rgb(f) }));
  const template = crop(planes[k]!, tx, ty, tw, th);
  // Its own contrast: what a match against a flat patch of its mean colour would leave.
  const mean = [0, 0, 0];
  for (let i = 0; i < template.px.length; i++) mean[i % 3]! += template.px[i]!;
  for (let c = 0; c < 3; c++) mean[c]! /= tw * th;
  let dev = 0;
  for (let i = 0; i < template.px.length; i++) dev += Math.abs(template.px[i]! - mean[i % 3]!);
  const contrast = Math.max(1, dev / template.px.length);

  // Shrunk so the template is about 8px on its short side.
  const s = Math.max(1, Math.min(4, Math.floor(Math.min(tw, th) / 8)));
  const smallTemplate = shrink(crop(planes[k]!, tx, ty, Math.floor(tw / s) * s, Math.floor(th / s) * s), s);
  const n = template.px.length;
  let previous: { x: number; y: number } | undefined;
  return planes.map((plane) => {
    const small = shrink(plane, s);
    const coarse = search(
      small,
      smallTemplate,
      0,
      small.width - smallTemplate.width,
      0,
      small.height - smallTemplate.height,
      previous && { x: Math.round(previous.x / s), y: Math.round(previous.y / s) },
    );
    const reach = s + 1;
    const fine = search(
      plane,
      template,
      Math.max(0, coarse.x * s - reach),
      Math.min(W - tw, coarse.x * s + reach),
      Math.max(0, coarse.y * s - reach),
      Math.min(H - th, coarse.y * s + reach),
    );
    previous = { x: fine.x, y: fine.y };
    const side = (x: number, y: number) =>
      x < 0 || y < 0 || x > W - tw || y > H - th ? Infinity : sad(plane, template, x, y, Infinity);
    const l = side(fine.x - 1, fine.y);
    const r = side(fine.x + 1, fine.y);
    const u = side(fine.x, fine.y - 1);
    const d = side(fine.x, fine.y + 1);
    const fx = Number.isFinite(l) && Number.isFinite(r) ? vertex(l, fine.sum, r) : 0;
    const fy = Number.isFinite(u) && Number.isFinite(d) ? vertex(u, fine.sum, d) : 0;
    const residual = fine.sum / n;
    return {
      box: { x: fine.x + fx + offX, y: fine.y + fy + offY, width: rw, height: rh },
      present: Math.max(0, Math.min(1, 1 - residual / contrast)),
      residual,
    };
  });
}

/** `x,y,w,h` (CSS px), as `--track` takes it; null when it is not four numbers with w and h positive. */
export function parseTrackRegion(text: string): TrackBox | null {
  const parts = text.split(",").map((v) => v.trim());
  if (parts.length !== 4 || parts.some((v) => !/^-?\d+(\.\d+)?$/.test(v))) return null;
  const [x, y, width, height] = parts.map(Number) as [number, number, number, number];
  return width > 0 && height > 0 ? { x, y, width, height } : null;
}
