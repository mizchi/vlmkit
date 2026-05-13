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

export interface PaletteDiff {
  matched: PaletteMatch[];
  /** Colors in baseline with no near-neighbor in variant. */
  onlyInBaseline: PaletteColor[];
  /** Colors in variant with no near-neighbor in baseline. */
  onlyInVariant: PaletteColor[];
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
  const onlyInBaseline: PaletteColor[] = [];
  let baselineMatchedShare = 0;

  for (const b of baseline) {
    let bestIdx = -1;
    let bestDist = Infinity;
    for (let i = 0; i < variant.length; i++) {
      if (variantUsed.has(i)) continue;
      const d = dist(b, variant[i]!);
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
      onlyInBaseline.push(b);
    }
  }

  const onlyInVariant: PaletteColor[] = [];
  let variantMatchedShare = 0;
  for (let i = 0; i < variant.length; i++) {
    if (variantUsed.has(i)) {
      variantMatchedShare += variant[i]!.share;
    } else if (variant[i]!.share >= minReportShare) {
      onlyInVariant.push(variant[i]!);
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
