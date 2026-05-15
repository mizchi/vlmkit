/**
 * Wireframe-mode fix candidates.
 *
 * When DOM correspondence between baseline and variant is missing
 * (class renames / from-screenshot reproduction / migration to a
 * different markup style), the existing `MigrationFixCandidate`
 * generator can't say much: it scores CSS declarations from the
 * variant's own stylesheet against a coarse `dominantCategory`. The
 * 2026-05-15 design-md scenario report flagged this as the single
 * biggest "Fix Candidates: no suggestions" complaint from agents.
 *
 * This module operates from image-only signals (`MatchedBbox`,
 * `MatchedTextRow`) that are available regardless of DOM
 * correspondence, and — when a `DesignTokens` source is provided —
 * snaps the suggested px deltas to the nearest declared spacing
 * token. Output is a list of human-readable hypotheses with a
 * confidence indicator so agents can rank them.
 *
 * Pure module; no Playwright or filesystem.
 */

import type { MatchedBbox } from "./component-bbox.ts";
import type { MatchedTextRow } from "./text-rows.ts";
import { snapSpacing, type DesignTokens } from "./design-md-tokens.ts";

export interface WireframeFixSuggestion {
  /** What we observed in the image diff. */
  evidence: string;
  /** What property family / direction is likely responsible. */
  hypothesis: string;
  /** Concrete next action — token name when snappable. */
  suggestion: string;
  /** Viewports where this delta was observed. */
  viewports: string[];
  /** Heuristic confidence: low (single viewport, small delta),
   * medium (multi-viewport or large delta), high (multi-viewport + token-snapped). */
  confidence: "low" | "medium" | "high";
  /** Magnitude in px (positive for the canonical direction described). */
  deltaPx: number;
}

export interface WireframeFixInput {
  bboxByViewport: Array<{ viewport: string; matches: MatchedBbox[] }>;
  textRowsByViewport: Array<{ viewport: string; matches: MatchedTextRow[] }>;
  tokens?: DesignTokens;
}

/** Threshold below which a delta is considered subpixel / not actionable. */
const NEGLIGIBLE_DELTA_PX = 2;

export function generateWireframeFixCandidates(
  input: WireframeFixInput,
): WireframeFixSuggestion[] {
  const out: WireframeFixSuggestion[] = [];

  // ---- Bbox vertical shifts ----
  // For each component rank, collect Δtop across viewports. If the
  // shift is consistent (same sign + similar magnitude) on 2+
  // viewports, it's a top-level spacing issue. If it's single-viewport,
  // it's likely media-query-gated.
  const bboxByRank = new Map<number, Array<{ viewport: string; m: MatchedBbox }>>();
  for (const v of input.bboxByViewport) {
    for (const m of v.matches) {
      if (Math.abs(m.deltaTop) <= NEGLIGIBLE_DELTA_PX) continue;
      const arr = bboxByRank.get(m.rank) ?? [];
      arr.push({ viewport: v.viewport, m });
      bboxByRank.set(m.rank, arr);
    }
  }

  for (const [rank, observations] of bboxByRank) {
    // Group by sign + rounded magnitude bucket so e.g. +24 and +25
    // collapse but +24 and -24 don't.
    const buckets = new Map<string, Array<{ viewport: string; m: MatchedBbox }>>();
    for (const obs of observations) {
      const bucket = `${Math.sign(obs.m.deltaTop)}:${Math.round(obs.m.deltaTop / 4) * 4}`;
      const arr = buckets.get(bucket) ?? [];
      arr.push(obs);
      buckets.set(bucket, arr);
    }
    for (const [, obs] of buckets) {
      const median = obs.map((o) => o.m.deltaTop).sort((a, b) => a - b)[Math.floor(obs.length / 2)];
      const deltaPx = median;
      const viewports = obs.map((o) => o.viewport);
      const example = obs[0].m;
      const direction = deltaPx > 0 ? "shifted down" : "shifted up";
      const snap = input.tokens ? snapSpacing(input.tokens, Math.abs(deltaPx)) : null;
      const tokenHint = snap
        ? `token: ${snap.token.name} (${snap.token.raw}${snap.delta > 0 ? `, ±${snap.delta.toFixed(1)}px` : ""})`
        : `≈ ${Math.abs(deltaPx)}px`;
      out.push({
        evidence: `component rank=${rank} (bbox ${example.baseline.width}×${example.baseline.height}): Δtop ${signed(deltaPx)} on ${viewports.join(", ")}`,
        hypothesis: deltaPx > 0
          ? "container above is taller than baseline (extra margin/padding/gap)"
          : "container above is shorter than baseline (missing margin/padding/gap)",
        suggestion: `try ${deltaPx > 0 ? "reducing" : "adding"} top spacing by ${Math.abs(deltaPx)}px (${tokenHint})`,
        viewports,
        confidence: confidenceFor({ viewportCount: viewports.length, deltaPx, snapped: !!snap }),
        deltaPx,
      });
    }
  }

  // ---- Text-row vertical shifts ----
  // Same approach but keyed by row rank (which pairs by text-content
  // order, so it survives small structural rewrites). Suppress rows
  // already covered by a bbox observation at the same Δy bucket.
  const seenBuckets = new Set(out.map((s) => `${Math.sign(s.deltaPx)}:${Math.round(s.deltaPx / 4) * 4}`));
  const rowByBucket = new Map<string, Array<{ viewport: string; m: MatchedTextRow }>>();
  for (const v of input.textRowsByViewport) {
    for (const m of v.matches) {
      if (Math.abs(m.deltaY) <= NEGLIGIBLE_DELTA_PX) continue;
      const bucket = `${Math.sign(m.deltaY)}:${Math.round(m.deltaY / 4) * 4}`;
      if (seenBuckets.has(bucket)) continue;
      const arr = rowByBucket.get(bucket) ?? [];
      arr.push({ viewport: v.viewport, m });
      rowByBucket.set(bucket, arr);
    }
  }
  for (const [bucket, obs] of rowByBucket) {
    // Only report buckets that appear on ≥2 rows (consistent shift) or
    // on ≥2 viewports — otherwise it's noise.
    const viewports = [...new Set(obs.map((o) => o.viewport))];
    if (obs.length < 2 && viewports.length < 2) continue;
    const median = obs.map((o) => o.m.deltaY).sort((a, b) => a - b)[Math.floor(obs.length / 2)];
    const sampleText = obs[0].m.baseline.text?.slice(0, 40) ?? "";
    const snap = input.tokens ? snapSpacing(input.tokens, Math.abs(median)) : null;
    const tokenHint = snap
      ? `token: ${snap.token.name} (${snap.token.raw})`
      : `≈ ${Math.abs(median)}px`;
    out.push({
      evidence: `${obs.length} text-row(s) shifted Δy ${signed(median)} on ${viewports.join(", ")} (e.g. "${sampleText}")`,
      hypothesis: median > 0
        ? "vertical rhythm above this row added space"
        : "vertical rhythm above this row removed space",
      suggestion: `try ${median > 0 ? "reducing" : "adding"} margin/padding by ${Math.abs(median)}px (${tokenHint})`,
      viewports,
      confidence: confidenceFor({ viewportCount: viewports.length, deltaPx: median, snapped: !!snap }),
      deltaPx: median,
    });
    void bucket;
  }

  // Sort: highest confidence first, then largest |Δ|, then more viewports.
  out.sort((a, b) => {
    const conf = (c: typeof a.confidence) => (c === "high" ? 2 : c === "medium" ? 1 : 0);
    if (conf(b.confidence) !== conf(a.confidence)) return conf(b.confidence) - conf(a.confidence);
    if (Math.abs(b.deltaPx) !== Math.abs(a.deltaPx)) return Math.abs(b.deltaPx) - Math.abs(a.deltaPx);
    return b.viewports.length - a.viewports.length;
  });
  return out;
}

function signed(n: number): string {
  return n >= 0 ? `+${n}px` : `${n}px`;
}

function confidenceFor(input: {
  viewportCount: number;
  deltaPx: number;
  snapped: boolean;
}): "low" | "medium" | "high" {
  const abs = Math.abs(input.deltaPx);
  if (input.snapped && (input.viewportCount >= 2 || abs >= 16)) return "high";
  if (input.viewportCount >= 2 || abs >= 16) return "medium";
  return "low";
}
