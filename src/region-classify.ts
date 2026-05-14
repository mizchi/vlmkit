/**
 * Region content-type classifier.
 *
 * Given a rectangular region of an image (e.g. a heatmap cluster or
 * a component bbox), classify what it most likely represents:
 *   - `text`           — horizontal text rows (high horizontal entropy,
 *                        consistent row stripe pattern)
 *   - `filled-rect`    — solid color block (button, badge, banner)
 *   - `icon`           — small compact graphic (2-4 colors, square-ish)
 *   - `image`          — high color variance, no stripe pattern
 *   - `unknown`        — region too small or empty
 *
 * Pure pixel heuristic — no DOM access. Closes the "is this region
 * text or a filled rectangle?" question called out by subagent G v2
 * dogfood: "the heatmap gives (x, y, W×H) but no clue what the
 * region is."
 */
export type RegionKind = "text" | "filled-rect" | "icon" | "image" | "unknown";

export interface RegionClassification {
  kind: RegionKind;
  /** Confidence ∈ [0, 1]. */
  confidence: number;
  /** Diagnostics used to make the decision. */
  features: {
    colorCount: number;
    /** Standard deviation of luminance across the region. Low = uniform fill. */
    lumaStd: number;
    /** Number of distinct horizontal "stripes" — dark-row clusters. */
    stripeRows: number;
    /** Aspect ratio width/height. */
    aspect: number;
    /** Width × height. */
    area: number;
  };
}

export interface ClassifyOptions {
  /** Quantization bits per channel for color counting. Default 4. */
  bitsPerChannel?: number;
  /** Stride for stripe-row scanning. Default 1. */
  stripeStride?: number;
}

/**
 * Classify a region of an RGBA image. The region is given by
 * `top, left, width, height` (clamped to image bounds).
 */
export function classifyRegion(
  data: Uint8Array,
  imageWidth: number,
  imageHeight: number,
  region: { top: number; left: number; width: number; height: number },
  options: ClassifyOptions = {},
): RegionClassification {
  const bits = options.bitsPerChannel ?? 4;
  const stripeStride = options.stripeStride ?? 1;
  const shift = 8 - bits;
  const bucketCount = 1 << bits;

  const x0 = Math.max(0, region.left);
  const y0 = Math.max(0, region.top);
  const x1 = Math.min(imageWidth, region.left + region.width);
  const y1 = Math.min(imageHeight, region.top + region.height);
  const W = x1 - x0;
  const H = y1 - y0;
  if (W <= 1 || H <= 1) {
    return {
      kind: "unknown",
      confidence: 1,
      features: { colorCount: 0, lumaStd: 0, stripeRows: 0, aspect: 0, area: 0 },
    };
  }

  // Single-pass aggregation:
  //   - color histogram (quantized) for colorCount
  //   - per-pixel luma → row-mean & total mean/std
  //   - per-row luma → stripe detection
  const histogram = new Set<number>();
  const rowMeanLuma = new Float32Array(H);
  let totalSum = 0, totalSumSq = 0;
  let n = 0;
  for (let yy = 0; yy < H; yy++) {
    const y = y0 + yy;
    let rowSum = 0;
    for (let xx = 0; xx < W; xx++) {
      const x = x0 + xx;
      const i = (y * imageWidth + x) * 4;
      if (data[i + 3]! === 0) continue;
      const r = data[i]!, g = data[i + 1]!, b = data[i + 2]!;
      const key = ((r >> shift) << (2 * bits)) | ((g >> shift) << bits) | (b >> shift);
      histogram.add(key);
      const L = 0.299 * r + 0.587 * g + 0.114 * b;
      rowSum += L;
      totalSum += L;
      totalSumSq += L * L;
      n++;
    }
    rowMeanLuma[yy] = W > 0 ? rowSum / W : 0;
  }

  if (n === 0) {
    return {
      kind: "unknown",
      confidence: 1,
      features: { colorCount: 0, lumaStd: 0, stripeRows: 0, aspect: W / H, area: W * H },
    };
  }

  const colorCount = histogram.size;
  const mean = totalSum / n;
  const variance = totalSumSq / n - mean * mean;
  const lumaStd = Math.sqrt(Math.max(0, variance));

  // Stripe detection: count alternating dark/light row transitions.
  // A row is "dark" if rowMeanLuma is meaningfully below the region's
  // mean luma. Multiple distinct dark stripes → likely text.
  const stripeDip = 12;
  let stripeRows = 0;
  let inDarkRun = false;
  for (let yy = 0; yy < H; yy += stripeStride) {
    const isDark = mean - rowMeanLuma[yy]! >= stripeDip;
    if (isDark && !inDarkRun) {
      stripeRows++;
      inDarkRun = true;
    } else if (!isDark && inDarkRun) {
      inDarkRun = false;
    }
  }

  const aspect = W / H;
  const area = W * H;

  // Heuristic classification:
  //   text         — multiple stripes (≥ 2 alternating dark-row runs)
  //                  AND aspect ratio not tiny (text bands tend to be
  //                  wider than tall, but a single short word can be
  //                  ~square)
  //   filled-rect  — colorCount ≤ 4 AND lumaStd < 20 (essentially
  //                  uniform fill)
  //   icon         — small region (area < 4000), colorCount ≤ 16,
  //                  aspect 0.5-2 (square-ish)
  //   image        — colorCount > 16 AND not striped → textured
  //   unknown      — none of the above hold confidently
  let kind: RegionKind = "unknown";
  let confidence = 0.5;
  // Thresholds tuned against real anti-aliased rendering — a "uniform"
  // button has ~30-80 quantized colors from AA on text + corners, not
  // the ~4 a naive view would suggest. Buckets calibrated against
  // system-ui at 14-40 px on light bg.

  // Tiny region — likely icon or single character.
  if (area < 2000 && aspect > 0.4 && aspect < 2.5) {
    kind = "icon";
    confidence = 0.65;
  }
  // Multiple distinct dark stripes → text.
  else if (stripeRows >= 2) {
    kind = "text";
    confidence = Math.min(1, 0.55 + stripeRows * 0.08);
  }
  // Truly uniform fill (single color block, no text overlay).
  else if (colorCount <= 8 && lumaStd < 12) {
    kind = "filled-rect";
    confidence = 0.9;
  }
  // Button-/badge-like: bounded color count, narrow luma std (AA on
  // text inside a solid fill is the main source of variation).
  else if (colorCount <= 120 && lumaStd < 45) {
    kind = "filled-rect";
    confidence = 0.65;
  }
  // Single-stripe text band — common short labels / single-line text.
  else if (stripeRows === 1) {
    kind = "text";
    confidence = 0.55;
  }
  // Many colors + no stripe structure → textured / image content.
  else if (colorCount > 200) {
    kind = "image";
    confidence = 0.6;
  }

  return {
    kind,
    confidence,
    features: { colorCount, lumaStd: Number(lumaStd.toFixed(1)), stripeRows, aspect: Number(aspect.toFixed(2)), area },
  };
}
