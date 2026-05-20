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
  /** Optional OCR/debug text when a caller can supply it. Pixel extraction does not infer this. */
  text?: string;
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
  /**
   * Estimated font-size in px, derived from band height. Typical UI
   * fonts have a band height ≈ 0.75 × fontSize (the band spans
   * baseline to ascender; descenders push it a bit further). Rounded
   * to the nearest common UI size (12, 14, 16, 18, 20, 24, …, 72).
   */
  estimatedFontSize?: number;
  /**
   * Ink density inside the text's horizontal bounding box. Computed
   * as (dark pixels with luma < 100) / (pixels in text-bbox). Larger
   * values = thicker strokes = bolder weight. Empirical buckets:
   *   - < 0.10  → regular / light
   *   - 0.10-0.16 → medium / semibold
   *   - > 0.16  → bold / heavy
   * Noisy on short text — compare same-content baseline vs variant
   * for high-confidence weight-mismatch detection.
   */
  inkDensity?: number;
  /** Bucketed weight class — heuristic, see `inkDensity` doc. */
  weightBucket?: "light" | "regular" | "medium" | "bold";
  /** Horizontal extent of ink within the band (px from left edge of image). */
  inkLeft?: number;
  inkRight?: number;
}

export interface MatchedTextRow {
  /** Position in the ordered list of detected rows (0 = topmost). */
  rank: number;
  baseline: TextRow;
  variant: TextRow;
  /** variant.yCenter − baseline.yCenter (px). */
  deltaY: number;
}

export interface RowGapDelta {
  /** Rank of the row above the gap. */
  aboveRank: number;
  /** Rank of the row below the gap. */
  belowRank: number;
  /** Baseline gap (yCenter[below] − yCenter[above]). */
  baselineGap: number;
  /** Variant gap. */
  variantGap: number;
  /** variantGap − baselineGap; positive means the gap grew. */
  delta: number;
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

/** Snap a raw px height to the nearest common UI font-size bucket. */
function snapFontSize(rawPx: number): number {
  const buckets = [10, 11, 12, 13, 14, 16, 18, 20, 22, 24, 28, 32, 36, 40, 48, 56, 64, 72];
  let best = buckets[0]!;
  let bestDist = Math.abs(rawPx - best);
  for (const b of buckets) {
    const d = Math.abs(rawPx - b);
    if (d < bestDist) { best = b; bestDist = d; }
  }
  return best;
}

function bucketWeight(density: number): TextRow["weightBucket"] {
  // Empirical calibration against system-ui at 12-48 px:
  //   regular text: density 0.15-0.25
  //   medium (500-600): 0.25-0.35
  //   bold (700+): > 0.35
  // Small text has slightly elevated density due to proportional AA
  // blur — the buckets accept that noise.
  if (density < 0.15) return "light";
  if (density < 0.27) return "regular";
  if (density < 0.36) return "medium";
  return "bold";
}

/**
 * Compute typography hints (font-size estimate, ink density, weight
 * bucket) for a band by sampling its pixels. Mutates the band in
 * place. From subagent G v3 dogfood: "next blocker is sub-pixel
 * vertical spacing tuning — and a font-size / weight estimate per
 * heatmap region would push this to < 1% in one more round."
 */
function annotateTypography(
  band: TextRow,
  data: Uint8Array,
  width: number,
  height: number,
): void {
  // 1. Find the horizontal extent of ink within the band. Use an
  //    *adaptive* threshold so muted-gray text (e.g. #9ca3af on white,
  //    luma ≈ 165) is still detected. A pixel is "ink" if its luma is
  //    at least 50 below the band's background luma — `meanLuma` is a
  //    good proxy for the band's background since text occupies a
  //    small fraction of the band's area.
  const inkThreshold = Math.max(40, band.meanLuma - 50);
  let inkLeft = width, inkRight = -1;
  let inkPixels = 0;
  for (let y = band.yStart; y <= band.yEnd && y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 4;
      const L = 0.299 * data[i]! + 0.587 * data[i + 1]! + 0.114 * data[i + 2]!;
      if (L < inkThreshold) {
        if (x < inkLeft) inkLeft = x;
        if (x > inkRight) inkRight = x;
        inkPixels++;
      }
    }
  }
  if (inkRight < inkLeft) return;

  // 2. Ink density = ink pixels / area of the text bbox.
  const inkWidth = inkRight - inkLeft + 1;
  const inkArea = inkWidth * (band.yEnd - band.yStart + 1);
  const density = inkArea > 0 ? inkPixels / inkArea : 0;

  // 3. Estimate font-size from band height. Calibrated empirically
  //    against system-ui at 12-48px: band height ≈ 0.92× fontSize
  //    (includes ascender + descender + AA blur). Divide to recover.
  const bandH = band.height;
  const rawFontSize = bandH / 0.92;
  band.estimatedFontSize = snapFontSize(rawFontSize);
  band.inkDensity = density;
  band.weightBucket = bucketWeight(density);
  band.inkLeft = inkLeft;
  band.inkRight = inkRight;
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
  const capped = bands.slice(0, maxBands);
  for (const band of capped) annotateTypography(band, data, width, height);
  return capped;
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

/**
 * Compute per-pair gap deltas from baseline ↔ variant row matches.
 * The gap above row N+1 = `row[N+1].yCenter − row[N].yCenter` — the
 * vertical distance between consecutive text bands. If the gap
 * differs between baseline and variant, the spacing between those
 * two pieces of content is wrong, and the fix is on the preceding
 * element's `margin-bottom` / `padding-bottom`.
 *
 * Subagent G v3 dogfood: "once IoU > 0.98, the remaining ~1.7%
 * diff is text baseline Δy in the 2-19px range, and the report
 * doesn't yet suggest which CSS knob to turn." Gap deltas tell
 * the agent exactly which margin to adjust.
 */
export interface TypographyMismatch {
  rank: number;
  baselineFontSize?: number;
  variantFontSize?: number;
  baselineWeight?: TextRow["weightBucket"];
  variantWeight?: TextRow["weightBucket"];
  baselineDensity?: number;
  variantDensity?: number;
  /** "size" | "weight" | "both" */
  kind: "size" | "weight" | "both";
}

/**
 * Compare typography hints across ordered baseline ↔ variant pairs.
 * Reports rows where:
 *   - estimated font-size buckets differ (different snapped px), OR
 *   - weight buckets differ ("regular" vs "bold").
 *
 * Same-content assumption: when baseline and variant render the same
 * text content, ink density is directly comparable. When content
 * differs, density can vary by character makeup ("iii" vs "WWW")
 * and the comparison is noisier — only large bucket jumps are
 * surfaced.
 */
export function compareRowTypography(
  baseline: TextRow[],
  variant: TextRow[],
  minDensityDelta = 0.04,
): TypographyMismatch[] {
  const n = Math.min(baseline.length, variant.length);
  const out: TypographyMismatch[] = [];
  for (let i = 0; i < n; i++) {
    const b = baseline[i]!, v = variant[i]!;
    if (b.estimatedFontSize === undefined || v.estimatedFontSize === undefined) continue;
    const sizeDiffers = b.estimatedFontSize !== v.estimatedFontSize;
    // Weight differs if buckets differ AND the underlying density
    // delta is larger than the threshold (avoids flagging
    // "regular vs medium" on a marginal-density pair).
    const densityDelta = Math.abs((b.inkDensity ?? 0) - (v.inkDensity ?? 0));
    const weightDiffers = b.weightBucket !== v.weightBucket && densityDelta >= minDensityDelta;
    if (!sizeDiffers && !weightDiffers) continue;
    out.push({
      rank: i,
      baselineFontSize: b.estimatedFontSize,
      variantFontSize: v.estimatedFontSize,
      baselineWeight: b.weightBucket,
      variantWeight: v.weightBucket,
      baselineDensity: b.inkDensity,
      variantDensity: v.inkDensity,
      kind: sizeDiffers && weightDiffers ? "both" : sizeDiffers ? "size" : "weight",
    });
  }
  return out;
}

export function computeRowGapDeltas(
  baseline: TextRow[],
  variant: TextRow[],
  minAbsoluteDelta = 2,
): RowGapDelta[] {
  const n = Math.min(baseline.length, variant.length);
  const out: RowGapDelta[] = [];
  for (let i = 0; i < n - 1; i++) {
    const baseGap = baseline[i + 1]!.yCenter - baseline[i]!.yCenter;
    const varGap = variant[i + 1]!.yCenter - variant[i]!.yCenter;
    const delta = varGap - baseGap;
    if (Math.abs(delta) >= minAbsoluteDelta) {
      out.push({
        aboveRank: i,
        belowRank: i + 1,
        baselineGap: baseGap,
        variantGap: varGap,
        delta,
      });
    }
  }
  return out;
}
