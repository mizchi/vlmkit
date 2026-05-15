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
import { snapSpacing, parseLengthToPx, type DesignTokens } from "./design-md-tokens.ts";
import type { DpEntryWithViewport } from "./dom-position-styles.ts";

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
  /**
   * Set when this suggestion's magnitude dominates the rest of the
   * suggestion set — i.e. closing this one delta would account for
   * most of the visual diff. Lets the renderer pull it above the
   * [DIVERGENT] / [SUBSET] noise so agents act on the biggest win
   * first.
   *
   * Heuristic: |deltaPx| ≥ 12 (large enough to matter) AND
   * ≥ 1.5× the next-largest |deltaPx| in the set. Computed in a
   * single pass after the per-rank generation completes; at most
   * one suggestion per run carries the flag.
   */
  isHighImpact?: boolean;
  /**
   * How this delta relates to the full viewport set:
   *   - "all"               : observation covers every viewport with the same
   *                           sign+magnitude. Suggestion is safe to apply
   *                           globally.
   *   - "subset"            : observation only covers a subset of viewports.
   *                           The agent should gate the change with a media
   *                           query so the uncovered viewports aren't
   *                           affected.
   *   - "divergent"         : the same component has observations with
   *                           opposite signs on different viewports. A global
   *                           edit cannot satisfy both — the underlying CSS
   *                           rule is responsive and the per-viewport values
   *                           need separate handling.
   *   - "magnitude-divergent": same-sign but materially different magnitudes
   *                           across viewports (e.g. -24px on mobile, -48px on
   *                           desktop). Surfaces "the baseline uses distinct
   *                           per-viewport values; the variant uses one
   *                           value everywhere" — a global edit will fix
   *                           one viewport while under- or over-correcting
   *                           the others.
   */
  scope: "all" | "subset" | "divergent" | "magnitude-divergent";
  /**
   * Per-viewport breakdown. Always populated; for non-divergent rows
   * every entry has the same sign.
   */
  perViewport?: Array<{ viewport: string; deltaPx: number }>;
  /**
   * Candidate CSS rule(s) whose computed-style delta matches this
   * suggestion's magnitude (within ±2px) on the affected viewports.
   * Sourced from `domPositionDiff.entries`. Empty when no DOM
   * correspondence is available or no entry matched — agents should
   * then fall back to their own structural search.
   *
   * The shape is deliberately action-oriented: `current` is what the
   * variant has now, `target` is what the baseline has. Reading
   * "current → target" matches the natural agent action ("change
   * from current to target"). An earlier version used
   * `{baselineValue, variantValue}` rendered as `B→V`, which agent-e
   * (v5 validation) misread as "go from B to V" and applied the
   * change in the wrong direction.
   */
  candidates?: Array<{
    selector: string;
    property: string;
    current: string;
    target: string;
    viewport: string;
  }>;
}

export interface WireframeFixInput {
  bboxByViewport: Array<{ viewport: string; matches: MatchedBbox[] }>;
  textRowsByViewport: Array<{ viewport: string; matches: MatchedTextRow[] }>;
  tokens?: DesignTokens;
  /**
   * Full viewport set the compare ran on (e.g. ["mobile", "desktop", "wide"]).
   * Required for correct scope detection: when a viewport had zero
   * meaningful bbox or text-row deltas it won't appear in
   * `bboxByViewport` / `textRowsByViewport`, so deriving the universe
   * from those alone produces false "scope: all" tags. Pass the
   * authoritative list here. Falls back to the input-derived set if
   * omitted (preserves test compatibility).
   */
  allViewports?: string[];
  /**
   * DOM-position-diff entries (one per (path, property, viewport)).
   * When provided, each generated suggestion is annotated with the
   * candidate CSS rule(s) whose computed-style delta matches its
   * magnitude — agent-c lost two rounds because the magnitude was
   * named but the *rule* wasn't. Empty / undefined for callers
   * without DOM correspondence; the generator degrades gracefully.
   */
  domPositionEntries?: DpEntryWithViewport[];
}

/**
 * CSS properties whose computed-style delta plausibly produces a
 * vertical bbox / text-row shift. Used to filter `domPositionDiff`
 * entries when annotating candidate selectors. Padding-bottom /
 * margin-bottom belong here because *predecessor* elements push the
 * element below them down; if their bottom-spacing changed it would
 * show up on the next sibling's bbox Δtop.
 */
const VERTICAL_SHIFT_PROPERTIES = new Set([
  "margin-top",
  "padding-top",
  "margin-bottom",
  "padding-bottom",
  "row-gap",
  "gap",
  "height",
  "min-height",
  "max-height",
  "top",
  "bottom",
]);

const CANDIDATE_PX_TOLERANCE = 2;

function selectorFromDpEntry(entry: DpEntryWithViewport): string {
  // Prefer the variant's class string (that's what the agent currently
  // has in their CSS); fall back to baseline if variant has none.
  const cls = entry.variantClasses || entry.baselineClasses;
  if (cls) return `.${cls.split(/\s+/).filter(Boolean).join(".")}`;
  // No class — name by tag + path.
  return `${entry.tag} (${entry.path})`;
}

function matchCandidatesForDelta(
  deltaPx: number,
  viewports: string[],
  entries: DpEntryWithViewport[],
): WireframeFixSuggestion["candidates"] {
  const viewportSet = new Set(viewports);
  const target = Math.abs(deltaPx);
  const out: NonNullable<WireframeFixSuggestion["candidates"]> = [];
  const seen = new Set<string>();
  for (const e of entries) {
    if (!viewportSet.has(e.viewport)) continue;
    if (!VERTICAL_SHIFT_PROPERTIES.has(e.property)) continue;
    const bPx = parseLengthToPx(e.baseline);
    const vPx = parseLengthToPx(e.variant);
    if (bPx === null || vPx === null) continue;
    const entryDelta = Math.abs(vPx - bPx);
    if (Math.abs(entryDelta - target) > CANDIDATE_PX_TOLERANCE) continue;
    const sel = selectorFromDpEntry(e);
    const dedupeKey = `${sel}|${e.property}|${e.viewport}`;
    if (seen.has(dedupeKey)) continue;
    seen.add(dedupeKey);
    out.push({
      selector: sel,
      property: e.property,
      // Variant = what the agent currently has; baseline = target.
      // Order matches "change FROM current TO target" semantics.
      current: e.variant,
      target: e.baseline,
      viewport: e.viewport,
    });
    if (out.length >= 4) break; // Cap per suggestion — too many candidates is noise.
  }
  return out.length > 0 ? out : undefined;
}

/** Threshold below which a delta is considered subpixel / not actionable. */
const NEGLIGIBLE_DELTA_PX = 2;

export function generateWireframeFixCandidates(
  input: WireframeFixInput,
): WireframeFixSuggestion[] {
  const out: WireframeFixSuggestion[] = [];

  // ---- Bbox vertical shifts ----
  // For each component rank, collect Δtop across viewports. The
  // generator emits one of three shapes per rank:
  //   - divergent: opposite signs across viewports → one row that
  //     names the responsive divergence and tells the agent to gate
  //     with a media query. (Closes #29: agent-c saw +12 mobile / -12
  //     desktop as two separate global suggestions and broke desktop
  //     trying to satisfy both.)
  //   - subset: same sign everywhere but only covers some viewports
  //     → the suggestion explicitly says "mobile only" / "desktop,
  //     wide only" so the agent knows it isn't global.
  //   - all: every viewport in the input agrees on sign + magnitude
  //     → safe to apply globally.
  const allViewports = new Set(
    input.allViewports && input.allViewports.length > 0
      ? input.allViewports
      : input.bboxByViewport.map((v) => v.viewport),
  );
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
    // Per-viewport median deltaTop for this rank.
    const byVp = new Map<string, MatchedBbox[]>();
    for (const obs of observations) {
      const arr = byVp.get(obs.viewport) ?? [];
      arr.push(obs.m);
      byVp.set(obs.viewport, arr);
    }
    const perVpDeltas: Array<{ viewport: string; deltaPx: number; m: MatchedBbox }> = [];
    for (const [viewport, ms] of byVp) {
      const sorted = ms.map((m) => m.deltaTop).sort((a, b) => a - b);
      const median = sorted[Math.floor(sorted.length / 2)];
      perVpDeltas.push({ viewport, deltaPx: median, m: ms[0] });
    }
    const signs = new Set(perVpDeltas.map((p) => Math.sign(p.deltaPx)).filter((s) => s !== 0));
    const example = perVpDeltas[0].m;
    const dims = `${example.baseline.width}×${example.baseline.height}`;

    // Magnitudes per viewport for this rank.
    const magnitudes = perVpDeltas.map((p) => Math.abs(p.deltaPx));
    const maxMag = Math.max(...magnitudes);
    const minMag = Math.min(...magnitudes);
    // Magnitude-divergent: same sign across all viewports, but the
    // smallest and largest deltas are clearly distinct (>= 8px apart).
    // Distinct enough that one global value can't satisfy both ends.
    const MIN_MAGNITUDE_SPREAD = 8;
    if (signs.size === 1 && maxMag - minMag >= MIN_MAGNITUDE_SPREAD) {
      const summary = perVpDeltas
        .map((p) => `${p.viewport}: ${signed(p.deltaPx)}`)
        .join(", ");
      const direction = perVpDeltas[0].deltaPx > 0 ? "reducing" : "adding";
      const viewportList = perVpDeltas.map((p) => p.viewport);
      // Per-viewport token snapping for each magnitude.
      const perVpSnap = perVpDeltas.map((p) => {
        const snap = input.tokens ? snapSpacing(input.tokens, Math.abs(p.deltaPx)) : null;
        return {
          viewport: p.viewport,
          deltaPx: p.deltaPx,
          tokenHint: snap ? `${snap.token.name} (${snap.token.raw})` : `${Math.abs(p.deltaPx)}px`,
        };
      });
      const candidates = input.domPositionEntries
        ? matchCandidatesForDelta(maxMag, viewportList, input.domPositionEntries)
        : undefined;
      out.push({
        evidence: `component rank=${rank} (bbox ${dims}): magnitude-divergent Δtop across viewports (${summary})`,
        hypothesis: "baseline uses distinct per-viewport spacing values; variant uses one value everywhere — a global edit will over- or under-correct depending on viewport",
        suggestion: `use distinct per-viewport spacing values: ${perVpSnap
          .map((p) => `${direction} ${Math.abs(p.deltaPx)}px on ${p.viewport} (token: ${p.tokenHint})`).join("; ")}`,
        viewports: viewportList,
        confidence: "high",
        deltaPx: maxMag,
        scope: "magnitude-divergent",
        perViewport: perVpDeltas.map((p) => ({ viewport: p.viewport, deltaPx: p.deltaPx })),
        candidates,
      });
      continue;
    }
    if (signs.size > 1) {
      // Divergent: this component has opposite-sign deltas across
      // viewports. A single global edit cannot satisfy both — the
      // agent needs a media-query-gated change.
      const summary = perVpDeltas
        .map((p) => `${p.viewport}: ${signed(p.deltaPx)}`)
        .join(", ");
      const maxAbs = Math.max(...perVpDeltas.map((p) => Math.abs(p.deltaPx)));
      const positiveSide = perVpDeltas.filter((p) => p.deltaPx > 0).map((p) => p.viewport);
      const negativeSide = perVpDeltas.filter((p) => p.deltaPx < 0).map((p) => p.viewport);
      const snap = input.tokens ? snapSpacing(input.tokens, maxAbs) : null;
      const tokenHint = snap ? `nearest token: ${snap.token.name} (${snap.token.raw})` : `magnitude ≈ ${maxAbs}px`;
      const viewportList = perVpDeltas.map((p) => p.viewport);
      const candidates = input.domPositionEntries
        ? matchCandidatesForDelta(maxAbs, viewportList, input.domPositionEntries)
        : undefined;
      out.push({
        evidence: `component rank=${rank} (bbox ${dims}): divergent Δtop across viewports (${summary})`,
        hypothesis: "the same component has opposite-sign deltas on different viewports — a global edit will fix one side while breaking the other",
        suggestion: `gate the spacing change with a media query: ${positiveSide.length > 0 ? `add ${maxAbs}px on ${positiveSide.join(", ")}` : ""}${positiveSide.length > 0 && negativeSide.length > 0 ? "; " : ""}${negativeSide.length > 0 ? `remove ${maxAbs}px on ${negativeSide.join(", ")}` : ""} (${tokenHint})`,
        viewports: viewportList,
        confidence: "high",
        deltaPx: maxAbs,
        scope: "divergent",
        perViewport: perVpDeltas.map((p) => ({ viewport: p.viewport, deltaPx: p.deltaPx })),
        candidates,
      });
      continue;
    }

    // Same-sign across all covered viewports. Bucket by magnitude so
    // +24 and +25 collapse but +24 and +48 stay separate.
    const buckets = new Map<string, Array<{ viewport: string; deltaPx: number; m: MatchedBbox }>>();
    for (const p of perVpDeltas) {
      const key = `${Math.round(p.deltaPx / 4) * 4}`;
      const arr = buckets.get(key) ?? [];
      arr.push(p);
      buckets.set(key, arr);
    }
    for (const obs of buckets.values()) {
      const sorted = obs.map((o) => o.deltaPx).sort((a, b) => a - b);
      const median = sorted[Math.floor(sorted.length / 2)];
      const deltaPx = median;
      const viewports = obs.map((o) => o.viewport);
      const covered = new Set(viewports);
      const scope: "all" | "subset" = covered.size === allViewports.size && [...allViewports].every((v) => covered.has(v))
        ? "all"
        : "subset";
      const uncovered = [...allViewports].filter((v) => !covered.has(v));
      const snap = input.tokens ? snapSpacing(input.tokens, Math.abs(deltaPx)) : null;
      const tokenHint = snap
        ? `token: ${snap.token.name} (${snap.token.raw}${snap.delta > 0 ? `, ±${snap.delta.toFixed(1)}px` : ""})`
        : `≈ ${Math.abs(deltaPx)}px`;
      const scopeNote = scope === "subset"
        ? ` (subset — gate with media query; not seen on ${uncovered.join(", ")})`
        : "";
      const candidates = input.domPositionEntries
        ? matchCandidatesForDelta(Math.abs(deltaPx), viewports, input.domPositionEntries)
        : undefined;
      out.push({
        evidence: `component rank=${rank} (bbox ${dims}): Δtop ${signed(deltaPx)} on ${viewports.join(", ")}${scopeNote}`,
        hypothesis: deltaPx > 0
          ? "container above is taller than baseline (extra margin/padding/gap)"
          : "container above is shorter than baseline (missing margin/padding/gap)",
        suggestion: `try ${deltaPx > 0 ? "reducing" : "adding"} top spacing by ${Math.abs(deltaPx)}px (${tokenHint})`,
        viewports,
        confidence: confidenceFor({ viewportCount: viewports.length, deltaPx, snapped: !!snap }),
        deltaPx,
        scope,
        perViewport: obs.map((o) => ({ viewport: o.viewport, deltaPx: o.deltaPx })),
        candidates,
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
  const allTextViewports = new Set(
    input.allViewports && input.allViewports.length > 0
      ? input.allViewports
      : input.textRowsByViewport.map((v) => v.viewport),
  );
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
    const covered = new Set(viewports);
    const scope: "all" | "subset" = covered.size === allTextViewports.size
      && [...allTextViewports].every((v) => covered.has(v))
      ? "all"
      : "subset";
    const uncovered = [...allTextViewports].filter((v) => !covered.has(v));
    const scopeNote = scope === "subset"
      ? ` (subset — gate with media query; not seen on ${uncovered.join(", ")})`
      : "";
    const candidates = input.domPositionEntries
      ? matchCandidatesForDelta(Math.abs(median), viewports, input.domPositionEntries)
      : undefined;
    out.push({
      evidence: `${obs.length} text-row(s) shifted Δy ${signed(median)} on ${viewports.join(", ")}${scopeNote} (e.g. "${sampleText}")`,
      hypothesis: median > 0
        ? "vertical rhythm above this row added space"
        : "vertical rhythm above this row removed space",
      suggestion: `try ${median > 0 ? "reducing" : "adding"} margin/padding by ${Math.abs(median)}px (${tokenHint})`,
      viewports,
      confidence: confidenceFor({ viewportCount: viewports.length, deltaPx: median, snapped: !!snap }),
      deltaPx: median,
      scope,
      perViewport: viewports.map((vp) => ({
        viewport: vp,
        deltaPx: obs.filter((o) => o.viewport === vp)
          .map((o) => o.m.deltaY)
          .sort((a, b) => a - b)[0] ?? median,
      })),
      candidates,
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

  // High-impact detection (closes G2 / agent-e v5 attention-bias):
  // when one suggestion's magnitude dominates the rest, flag it so
  // the renderer can pull it above the [DIVERGENT] / [SUBSET] noise.
  // Only one row carries the flag — at-most-one keeps the badge
  // meaningful (everything-highlighted = nothing-highlighted).
  if (out.length >= 2) {
    const sortedByMag = [...out].sort((a, b) => Math.abs(b.deltaPx) - Math.abs(a.deltaPx));
    const top = sortedByMag[0];
    const next = sortedByMag[1];
    const topAbs = Math.abs(top.deltaPx);
    const nextAbs = Math.abs(next.deltaPx);
    if (topAbs >= 12 && topAbs >= nextAbs * 1.5) {
      top.isHighImpact = true;
    }
  }

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
