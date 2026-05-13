/**
 * Palette diff: pair baseline colors with their nearest variant
 * neighbor (by squared Euclidean distance in RGB) and report colors
 * that are *only* on one side. The "approximate match" radius defaults
 * to 12 (RGB units) — tight enough to flag a #3B82F6 → #2563EB swap
 * (Δ≈30) but loose enough not to false-positive on the bucket-rounding
 * artifacts introduced by `extractPalette` quantization.
 */
import type { PaletteColor } from "./palette-extract.ts";

export interface PaletteMatch {
  baseline: PaletteColor;
  variant: PaletteColor;
  /** Euclidean RGB distance. */
  distance: number;
}

export interface UnmatchedPaletteColor extends PaletteColor {
  /**
   * Euclidean RGB distance to the closest color on the *other* side
   * (any side, no consumption). Helps the agent distinguish:
   *   - "real miss" (nearest > 50): no nearby variant color at all.
   *   - "near miss" (12 < nearest ≤ 30): plausibly an AA / subpixel
   *     artifact — the variant has a similar but not identical color.
   *     Subagent G v1 dogfood: at <2% diff, `#f4f4f4` kept appearing
   *     as "missing" because the rendered bg landed in a neighbor
   *     bucket — this annotation flags that case.
   */
  nearestNeighborDistance: number;
}

export interface PaletteDiff {
  matched: PaletteMatch[];
  /** Colors in baseline with no near-neighbor in variant. */
  onlyInBaseline: UnmatchedPaletteColor[];
  /** Colors in variant with no near-neighbor in baseline. */
  onlyInVariant: UnmatchedPaletteColor[];
  /** Total share of baseline colors that had a match in variant. */
  baselineMatchedShare: number;
  /** Total share of variant colors that had a match in baseline. */
  variantMatchedShare: number;
}

export interface DiffPaletteOptions {
  /** Maximum Euclidean RGB distance for "approximate match". Default 12. */
  maxDistance?: number;
  /** Drop "only-in-X" colors below this share. Default 0.005 (0.5%). */
  minReportShare?: number;
}

const DEFAULT_MAX_DISTANCE = 12;
const DEFAULT_MIN_REPORT_SHARE = 0.005;

function dist(a: PaletteColor, b: PaletteColor): number {
  const dr = a.r - b.r, dg = a.g - b.g, db = a.b - b.b;
  return Math.sqrt(dr * dr + dg * dg + db * db);
}

export function diffPalettes(
  baseline: PaletteColor[],
  variant: PaletteColor[],
  options: DiffPaletteOptions = {},
): PaletteDiff {
  const maxDist = options.maxDistance ?? DEFAULT_MAX_DISTANCE;
  const minReportShare = options.minReportShare ?? DEFAULT_MIN_REPORT_SHARE;

  // Greedy nearest-neighbor matching. Variant colors are "consumed" so
  // a single variant color can't satisfy two baseline colors.
  const variantUsed = new Set<number>();
  const matched: PaletteMatch[] = [];
  const onlyInBaseline: UnmatchedPaletteColor[] = [];
  let baselineMatchedShare = 0;

  for (const b of baseline) {
    let bestIdx = -1;
    let bestDist = Infinity;
    let bestUnconsumed = Infinity;
    for (let i = 0; i < variant.length; i++) {
      const d = dist(b, variant[i]!);
      if (d < bestUnconsumed) bestUnconsumed = d;
      if (variantUsed.has(i)) continue;
      if (d < bestDist) {
        bestDist = d;
        bestIdx = i;
      }
    }
    if (bestIdx >= 0 && bestDist <= maxDist) {
      variantUsed.add(bestIdx);
      matched.push({ baseline: b, variant: variant[bestIdx]!, distance: bestDist });
      baselineMatchedShare += b.share;
    } else if (b.share >= minReportShare) {
      onlyInBaseline.push({ ...b, nearestNeighborDistance: bestUnconsumed });
    }
  }

  const onlyInVariant: UnmatchedPaletteColor[] = [];
  let variantMatchedShare = 0;
  for (let i = 0; i < variant.length; i++) {
    if (variantUsed.has(i)) {
      variantMatchedShare += variant[i]!.share;
      continue;
    }
    if (variant[i]!.share >= minReportShare) {
      let nearest = Infinity;
      for (const b of baseline) {
        const d = dist(b, variant[i]!);
        if (d < nearest) nearest = d;
      }
      onlyInVariant.push({ ...variant[i]!, nearestNeighborDistance: nearest });
    }
  }

  return {
    matched,
    onlyInBaseline: onlyInBaseline.sort((a, b) => b.share - a.share),
    onlyInVariant: onlyInVariant.sort((a, b) => b.share - a.share),
    baselineMatchedShare,
    variantMatchedShare,
  };
}
