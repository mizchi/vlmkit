/**
 * Cross-viewport geometry comparison.
 *
 * Addresses Subagent F's second wish: "no notion of 'card stretches
 * with viewport.'" When the baseline shrinks the dominant card 18px
 * between desktop and mobile but the variant keeps it fixed, the
 * agent should hear that fact instead of seeing two separate
 * per-viewport bbox rows.
 *
 * Pure module — works off the `MatchedBbox[]` per-viewport data the
 * component-bbox layer already produces.
 */

import type { MatchedBbox } from "./component-bbox.ts";

export interface PerRankGeometry {
  rank: number;
  /** Per-viewport baseline bbox dimensions (width / height / position). */
  baselineByViewport: Array<{ viewport: string; width: number; height: number; top: number; left: number }>;
  variantByViewport: Array<{ viewport: string; width: number; height: number; top: number; left: number }>;
  /** Spread of each axis across viewports = max − min. */
  baselineSpread: { width: number; height: number };
  variantSpread: { width: number; height: number };
  /**
   * "Responsive mismatch" flag: set when one side's spread is materially
   * bigger than the other's. Indicates one side adapts to viewport
   * width and the other doesn't (typical CSS bug: missing max-width or
   * missing media query).
   */
  responsiveMismatch?: {
    axis: "width" | "height";
    baselineSpread: number;
    variantSpread: number;
    interpretation: string;
  };
}

export interface FindGeometryMismatchesOptions {
  /** Minimum |baseline.spread − variant.spread| (px) to flag as a mismatch. */
  minSpreadDelta?: number;
}

const DEFAULT_MIN_SPREAD_DELTA = 30;

/**
 * Build per-rank geometry profiles by aligning matched bbox pairs by
 * rank across all captured viewports.
 */
export function buildGeometryProfiles(
  perViewport: Array<{ viewport: string; matches: MatchedBbox[] }>,
  options: FindGeometryMismatchesOptions = {},
): PerRankGeometry[] {
  if (perViewport.length === 0) return [];

  const minSpreadDelta = options.minSpreadDelta ?? DEFAULT_MIN_SPREAD_DELTA;
  // Aggregate by rank.
  const byRank = new Map<number, PerRankGeometry>();
  for (const vp of perViewport) {
    for (const m of vp.matches) {
      let entry = byRank.get(m.rank);
      if (!entry) {
        entry = {
          rank: m.rank,
          baselineByViewport: [],
          variantByViewport: [],
          baselineSpread: { width: 0, height: 0 },
          variantSpread: { width: 0, height: 0 },
        };
        byRank.set(m.rank, entry);
      }
      entry.baselineByViewport.push({
        viewport: vp.viewport,
        width: m.baseline.width,
        height: m.baseline.height,
        top: m.baseline.top,
        left: m.baseline.left,
      });
      entry.variantByViewport.push({
        viewport: vp.viewport,
        width: m.variant.width,
        height: m.variant.height,
        top: m.variant.top,
        left: m.variant.left,
      });
    }
  }

  for (const entry of byRank.values()) {
    const bw = entry.baselineByViewport.map((b) => b.width);
    const bh = entry.baselineByViewport.map((b) => b.height);
    const vw = entry.variantByViewport.map((v) => v.width);
    const vh = entry.variantByViewport.map((v) => v.height);
    entry.baselineSpread = {
      width: bw.length ? Math.max(...bw) - Math.min(...bw) : 0,
      height: bh.length ? Math.max(...bh) - Math.min(...bh) : 0,
    };
    entry.variantSpread = {
      width: vw.length ? Math.max(...vw) - Math.min(...vw) : 0,
      height: vh.length ? Math.max(...vh) - Math.min(...vh) : 0,
    };

    // Flag the larger of the two axis mismatches.
    const wDelta = Math.abs(entry.baselineSpread.width - entry.variantSpread.width);
    const hDelta = Math.abs(entry.baselineSpread.height - entry.variantSpread.height);
    if (Math.max(wDelta, hDelta) >= minSpreadDelta) {
      const axis: "width" | "height" = wDelta >= hDelta ? "width" : "height";
      const baselineS = axis === "width" ? entry.baselineSpread.width : entry.baselineSpread.height;
      const variantS = axis === "width" ? entry.variantSpread.width : entry.variantSpread.height;
      let interpretation: string;
      if (baselineS > variantS) {
        interpretation = `baseline component ${axis} varies by ${baselineS}px across viewports; variant only by ${variantS}px ` +
          `→ variant likely missing a responsive rule (max-width, fluid sizing, or @media-gated dimension)`;
      } else {
        interpretation = `variant component ${axis} varies by ${variantS}px across viewports; baseline only by ${baselineS}px ` +
          `→ variant is over-flexing (probably needs a fixed max-width or grid template)`;
      }
      entry.responsiveMismatch = {
        axis,
        baselineSpread: baselineS,
        variantSpread: variantS,
        interpretation,
      };
    }
  }

  return [...byRank.values()].sort((a, b) => a.rank - b.rank);
}
