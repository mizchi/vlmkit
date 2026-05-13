/**
 * Text-row y-position extraction.
 *
 * Subagent F's wish-list item: "I need 'the `$24` text row is at y=420
 * in the reference but y=380 in mine' as a first-class signal — without
 * needing DOM correspondence."
 *
 * Compute the per-row mean luminance of an RGBA image. Text rows are
 * darker than the surrounding whitespace (assuming light background;
 * the dark-bg case is handled by symmetry: we just look for *dips*
 * relative to the local average, regardless of polarity). Group
 * consecutive dark rows into "text bands" and report each band's
 * y-center.
 *
 * Pair baseline rows with variant rows by order (band #N in baseline ↔
 * band #N in variant) and emit Δy. When the agent's rendering has the
 * right *number* of text rows but wrong y-positions, this surfaces the
 * shift directly.
 */
import { PNG } from "pngjs";
import { readFile } from "node:fs/promises";

export interface TextRow {
  /** Y-coordinate of the row's vertical center. */
  yCenter: number;
  /** Top y of the run of dark rows (inclusive). */
  yStart: number;
  /** Bottom y of the run of dark rows (inclusive). */
  yEnd: number;
  /** Mean luminance across the band (0-255). */
  meanLuma: number;
  /** Approximate height in pixels. */
  height: number;
}

export interface MatchedTextRow {
  /** Position in the ordered list of detected rows (0 = topmost). */
  rank: number;
  baseline: TextRow;
  variant: TextRow;
  /** variant.yCenter − baseline.yCenter (px). */
  deltaY: number;
}

export interface ExtractTextRowsOptions {
  /**
   * Minimum dip in mean luminance (vs. the median row luminance) for a
   * row to be considered "text". Default 12 — picks up body text but
   * ignores subpixel-rendering noise.
   */
  minLumaDip?: number;
  /** Minimum band height in px. Default 4. */
  minBandHeight?: number;
  /** Maximum bands to return (top-N by yCenter, i.e. all of them). */
  maxBands?: number;
}

const DEFAULT_MIN_LUMA_DIP = 12;
const DEFAULT_MIN_BAND_HEIGHT = 4;
const DEFAULT_MAX_BANDS = 64;

interface RowStats {
  mean: Float32Array;
  range: Float32Array;  // max − min per row; high for text rows (dark on light bg).
}

function rowStats(data: Uint8Array, width: number, height: number): RowStats {
  const mean = new Float32Array(height);
  const range = new Float32Array(height);
  for (let y = 0; y < height; y++) {
    let sum = 0, mn = 255, mx = 0;
    const rowStart = y * width * 4;
    for (let x = 0; x < width; x++) {
      const idx = rowStart + x * 4;
      // Rec.601 luma.
      const L = 0.299 * data[idx]! + 0.587 * data[idx + 1]! + 0.114 * data[idx + 2]!;
      sum += L;
      if (L < mn) mn = L;
      if (L > mx) mx = L;
    }
    mean[y] = sum / width;
    range[y] = mx - mn;
  }
  return { mean, range };
}

function median(values: Float32Array): number {
  if (values.length === 0) return 0;
  const sorted = Float32Array.from(values).sort();
  const mid = sorted.length >> 1;
  return sorted.length % 2 ? sorted[mid]! : (sorted[mid - 1]! + sorted[mid]!) / 2;
}

export function extractTextRowsFromRgba(
  data: Uint8Array,
  width: number,
  height: number,
  options: ExtractTextRowsOptions = {},
): TextRow[] {
  if (width <= 0 || height <= 0) return [];

  const minDip = options.minLumaDip ?? DEFAULT_MIN_LUMA_DIP;
  const minBandH = options.minBandHeight ?? DEFAULT_MIN_BAND_HEIGHT;
  const maxBands = options.maxBands ?? DEFAULT_MAX_BANDS;
  // Minimum max-min range for a row to count as "ink-bearing". Text on
  // a light bg has a row range of ≥ ~150 even when the text covers a
  // small horizontal slice (the row contains both bg-luma ≈ 245 pixels
  // and text-luma ≈ 30 pixels). Solid backgrounds have near-zero range.
  // Set conservatively to skip subpixel AA noise (range < 30 happens
  // on bands with thin horizontal lines).
  const MIN_INK_RANGE = 80;

  const { mean: rowMeans, range: rowRanges } = rowStats(data, width, height);
  const med = median(rowMeans);
  // A row is content if EITHER:
  //   (a) the row mean drops at least `minDip` below the median row
  //       mean — catches solid-fill bands (buttons, banners) that span
  //       the full width and pull the average down.
  //   (b) the row's max-min range exceeds `MIN_INK_RANGE` — catches
  //       thin text-on-bg bands where bg luma dominates the mean but
  //       a few dark text pixels pull the row min way down.
  // Subagent G dogfood: prior version used (a) only and missed
  // heading / price / feature rows on pricing-card targets because
  // they don't pull the full-width mean below threshold.
  const bands: TextRow[] = [];
  let runStart = -1;
  let runSum = 0;
  for (let y = 0; y < height; y++) {
    const meanDip = med - rowMeans[y]! >= minDip;
    const hasInk = rowRanges[y]! >= MIN_INK_RANGE;
    const isContent = meanDip || hasInk;
    if (isContent) {
      if (runStart < 0) {
        runStart = y;
        runSum = 0;
      }
      runSum += rowMeans[y]!;
    } else if (runStart >= 0) {
      const bandH = y - runStart;
      if (bandH >= minBandH) {
        bands.push({
          yStart: runStart,
          yEnd: y - 1,
          yCenter: Math.round((runStart + y - 1) / 2),
          height: bandH,
          meanLuma: runSum / bandH,
        });
      }
      runStart = -1;
    }
  }
  if (runStart >= 0) {
    const bandH = height - runStart;
    if (bandH >= minBandH) {
      bands.push({
        yStart: runStart,
        yEnd: height - 1,
        yCenter: Math.round((runStart + height - 1) / 2),
        height: bandH,
        meanLuma: runSum / bandH,
      });
    }
  }
  return bands.slice(0, maxBands);
}

export async function extractTextRowsFromFile(
  path: string,
  options: ExtractTextRowsOptions = {},
): Promise<TextRow[]> {
  const buf = await readFile(path);
  const png = PNG.sync.read(buf);
  return extractTextRowsFromRgba(png.data, png.width, png.height, options);
}

/**
 * Pair text rows by ordered index. When baseline has 6 rows and variant
 * has 6 rows, this maps row #0 → row #0, #1 → #1, etc. When the counts
 * differ, only the prefix common to both is matched.
 *
 * Reports rows with |Δy| above `minDeltaY` to keep the table focused on
 * actionable shifts (small subpixel deltas are excluded by default).
 */
export function matchTextRows(
  baseline: TextRow[],
  variant: TextRow[],
  minDeltaY = 2,
): MatchedTextRow[] {
  const out: MatchedTextRow[] = [];
  const n = Math.min(baseline.length, variant.length);
  for (let i = 0; i < n; i++) {
    const dy = variant[i]!.yCenter - baseline[i]!.yCenter;
    if (Math.abs(dy) >= minDeltaY) {
      out.push({
        rank: i,
        baseline: baseline[i]!,
        variant: variant[i]!,
        deltaY: dy,
      });
    }
  }
  return out;
}
