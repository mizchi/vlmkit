/**
 * Palette extraction from rendered PNGs.
 *
 * Tier 1, item 3 of the markup-assistance scenario wish-list: extract
 * the dominant colors of a rendered page and compare baseline ↔ variant
 * palettes to surface "the agent used #3B82F6 where the design tokens
 * say #2563EB." Catches hard-coded literals slipping into a tokenized
 * design system — a class of bug the bbox / heatmap / text-row signals
 * miss because the affected area is small.
 *
 * Approach: stride-sample the image (every N-th pixel), quantize each
 * sample to a coarse 5-bit-per-channel bucket (32³ = 32 768 bins), then
 * report the top-K most populous bins as the dominant colors. Avoids
 * a full k-means pass — for VRT-scale images (≤1 MP), stride sampling +
 * histogram is ~50× faster and gives equivalent top-N output.
 */
import { PNG } from "pngjs";
import { readFile } from "node:fs/promises";

export interface PaletteColor {
  /** Quantized RGB at full 8-bit precision (bucket center). */
  r: number;
  g: number;
  b: number;
  /** "#RRGGBB". */
  hex: string;
  /** Fraction of sampled pixels in this bucket (0..1). */
  share: number;
  /** Raw sample count. */
  count: number;
}

export interface ExtractPaletteOptions {
  /** Sample every Nth pixel (raster order). Default 4. */
  stride?: number;
  /** Bits per channel for quantization. Default 5 (32 buckets/channel). */
  bitsPerChannel?: number;
  /** Top-K colors to return. Default 16. */
  topK?: number;
  /** Drop buckets with `share` below this. Default 0.002 (0.2%). */
  minShare?: number;
  /** Ignore fully-transparent pixels. Default true. */
  skipTransparent?: boolean;
}

const DEFAULT_STRIDE = 4;
const DEFAULT_BITS = 5;
const DEFAULT_TOP_K = 16;
const DEFAULT_MIN_SHARE = 0.002;

function toHex(r: number, g: number, b: number): string {
  const c = (n: number) => n.toString(16).padStart(2, "0");
  return `#${c(r)}${c(g)}${c(b)}`;
}

export function extractPaletteFromRgba(
  data: Uint8Array,
  width: number,
  height: number,
  options: ExtractPaletteOptions = {},
): PaletteColor[] {
  if (width <= 0 || height <= 0) return [];

  const stride = Math.max(1, options.stride ?? DEFAULT_STRIDE);
  const bits = Math.max(1, Math.min(8, options.bitsPerChannel ?? DEFAULT_BITS));
  const topK = options.topK ?? DEFAULT_TOP_K;
  const minShare = options.minShare ?? DEFAULT_MIN_SHARE;
  const skipTransparent = options.skipTransparent ?? true;

  const shift = 8 - bits;
  const bucketCount = 1 << bits;
  const histogram = new Map<number, number>();
  let sampled = 0;

  const totalPixels = width * height;
  for (let p = 0; p < totalPixels; p += stride) {
    const i = p * 4;
    if (skipTransparent && data[i + 3]! === 0) continue;
    const rq = data[i]! >> shift;
    const gq = data[i + 1]! >> shift;
    const bq = data[i + 2]! >> shift;
    const key = (rq * bucketCount + gq) * bucketCount + bq;
    histogram.set(key, (histogram.get(key) ?? 0) + 1);
    sampled++;
  }
  if (sampled === 0) return [];

  const entries: PaletteColor[] = [];
  // Map bucket center to a representative 8-bit value: shift back and
  // add half-bucket so we land in the bucket center instead of its low
  // corner.
  const halfBucket = 1 << (shift - 1);
  for (const [key, count] of histogram) {
    const share = count / sampled;
    if (share < minShare) continue;
    const bq = key % bucketCount;
    const gq = Math.floor(key / bucketCount) % bucketCount;
    const rq = Math.floor(key / (bucketCount * bucketCount));
    const r = Math.min(255, (rq << shift) + halfBucket);
    const g = Math.min(255, (gq << shift) + halfBucket);
    const b = Math.min(255, (bq << shift) + halfBucket);
    entries.push({ r, g, b, hex: toHex(r, g, b), share, count });
  }
  entries.sort((a, b) => b.share - a.share);
  return entries.slice(0, topK);
}

export async function extractPaletteFromFile(
  path: string,
  options: ExtractPaletteOptions = {},
): Promise<PaletteColor[]> {
  const buf = await readFile(path);
  const png = PNG.sync.read(buf);
  return extractPaletteFromRgba(png.data, png.width, png.height, options);
}

export interface DominantBackgrounds {
  /** Color sampled from the image perimeter — the "page" background. */
  outer: { r: number; g: number; b: number; hex: string };
  /** Color sampled from a central rectangle — the "content" background. */
  inner: { r: number; g: number; b: number; hex: string };
  /** True when outer and inner are within `mergeDistance` — page is a single solid color. */
  same: boolean;
}

function toHex2(r: number, g: number, b: number): string {
  const c = (n: number) => n.toString(16).padStart(2, "0");
  return `#${c(r)}${c(g)}${c(b)}`;
}

function medianColor(data: Uint8Array, samples: number[][]): { r: number; g: number; b: number; hex: string } {
  // Per-channel median across sampled pixels. Median is robust against
  // sparse outliers (a text pixel doesn't shift the result) and avoids
  // the quantization-bucket collisions of mode-finding (e.g. #ffffff
  // and #f6f7fb both land in the same coarse bucket).
  const rs: number[] = [], gs: number[] = [], bs: number[] = [];
  for (const [x, y, width] of samples) {
    const i = (y * width + x) * 4;
    if (data[i + 3]! === 0) continue;
    rs.push(data[i]!); gs.push(data[i + 1]!); bs.push(data[i + 2]!);
  }
  if (rs.length === 0) return { r: 255, g: 255, b: 255, hex: "#ffffff" };
  rs.sort((a, b) => a - b); gs.sort((a, b) => a - b); bs.sort((a, b) => a - b);
  const mid = rs.length >> 1;
  const r = rs[mid]!, g = gs[mid]!, b = bs[mid]!;
  return { r, g, b, hex: toHex2(r, g, b) };
}

/**
 * Sample the dominant outer (perimeter) and inner (center) background
 * colors. Surfaces "page bg = #f4f4f4 / card bg = #ffffff" as a
 * first-class signal — historically the agent had to deduce this
 * from the palette "missing" rows. From dogfood eval.
 */
export function findDominantBackgrounds(
  data: Uint8Array,
  width: number,
  height: number,
): DominantBackgrounds {
  // Outer = pixels along a 4-px-thick frame around the edge.
  // Stride-sampled so the cost is independent of image size.
  const outerSamples: number[][] = [];
  const stride = Math.max(2, Math.floor(Math.min(width, height) / 80));
  const edge = 3;
  for (let x = 0; x < width; x += stride) {
    for (let dy = 0; dy < edge; dy++) {
      if (dy < height) outerSamples.push([x, dy, width]);
      if (height - 1 - dy >= 0) outerSamples.push([x, height - 1 - dy, width]);
    }
  }
  for (let y = 0; y < height; y += stride) {
    for (let dx = 0; dx < edge; dx++) {
      if (dx < width) outerSamples.push([dx, y, width]);
      if (width - 1 - dx >= 0) outerSamples.push([width - 1 - dx, y, width]);
    }
  }
  const outer = medianColor(data, outerSamples);

  // Inner = pixels in the central 30% × 30% rectangle.
  const innerSamples: number[][] = [];
  const cx0 = Math.floor(width * 0.35), cx1 = Math.floor(width * 0.65);
  const cy0 = Math.floor(height * 0.35), cy1 = Math.floor(height * 0.65);
  for (let y = cy0; y < cy1; y += stride) {
    for (let x = cx0; x < cx1; x += stride) {
      innerSamples.push([x, y, width]);
    }
  }
  const inner = innerSamples.length > 0 ? medianColor(data, innerSamples) : outer;

  const dr = outer.r - inner.r, dg = outer.g - inner.g, db = outer.b - inner.b;
  // Distance < 6 means visually indistinguishable backgrounds (page
  // is one solid color). 6-15 means subtle layering (e.g. card on
  // light gray bg with white card center) — we still report both.
  const same = Math.sqrt(dr * dr + dg * dg + db * db) < 6;
  return { outer, inner, same };
}

export async function findDominantBackgroundsFromFile(path: string): Promise<DominantBackgrounds> {
  const buf = await readFile(path);
  const png = PNG.sync.read(buf);
  return findDominantBackgrounds(png.data, png.width, png.height);
}
