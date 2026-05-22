/**
 * Vertical-shift origin diagnostic.
 *
 * Closes the residual gap from `docs/reports/2026-05-12-subagent-eval.md`:
 * after per-viewport DOM-position diff lands, layout-shift bands can
 * still appear with no DOM-position delta attributing them. Subagent D
 * plateaued at 4 viewports × ~3% diff because of one such band
 * (`[0..1047]: +152px`) at viewports ≥ 1024.
 *
 * This module captures per-element bounding boxes on each page and,
 * given the existing per-band shift report, names the *first* element
 * whose y-coordinate diverges between baseline and variant. The agent
 * gets a "shift origin" pointer instead of just "everything below row
 * N moved +152px."
 *
 * Pure module. Browser-side capture script is a string for
 * `page.evaluate()`; matching algorithm runs in Node.
 */

import type { ShiftRegion } from "./types.ts";

export interface BboxElement {
  /** DOM path: `tag[childIndex]>...` rooted at body (same scheme as dom-position-styles). */
  path: string;
  tag: string;
  classes: string;
  top: number;
  left: number;
  width: number;
  height: number;
}

export interface ShiftOrigin {
  /** Band y-range this origin explains. */
  bandStart: number;
  bandEnd: number;
  bandShift: number;
  originPath: string;
  originTag: string;
  originBaselineTop: number;
  originVariantTop: number;
  originDeltaY: number;
  originBaselineClasses: string;
  originVariantClasses: string;
  /** Heuristic guess at the responsible CSS axis based on bbox deltas. */
  suspectedAxis?: "height" | "margin/padding-above" | "y-position" | "unknown";
}

export interface ShiftAccumulationContribution {
  tag: string;
  baselineClasses: string;
  variantClasses: string;
  count: number;
  averageDeltaHeight: number;
  totalDeltaHeight: number;
  samplePaths: string[];
}

export interface ShiftAccumulationBreakdown {
  bandStart: number;
  bandEnd: number;
  bandShift: number;
  accumulatedDeltaHeight: number;
  contributions: ShiftAccumulationContribution[];
}

export interface FindShiftOriginsOptions {
  /**
   * Δy magnitude (px) above which an element is considered "shifted." Defaults
   * to 5 — below this is usually subpixel rounding from font metrics.
   */
  minDeltaPx?: number;
  /**
   * Number of candidate origin elements to emit per band (most useful is the
   * first; subsequent ones can be downstream propagation, but giving the
   * agent 2–3 helps when the first guess is wrong).
   */
  perBandLimit?: number;
}

const DEFAULT_MIN_DELTA = 5;
const DEFAULT_PER_BAND_LIMIT = 3;

function roundDelta(value: number): number {
  return Math.round(value * 100) / 100;
}

function classifySuspect(
  baseline: BboxElement,
  variant: BboxElement,
): ShiftOrigin["suspectedAxis"] {
  // Element itself has different height → its `height`/`padding`/`line-height` is the cause.
  const heightDelta = Math.abs(baseline.height - variant.height);
  // Element's top moved but its left didn't → vertical-axis cause.
  const topDelta = Math.abs(baseline.top - variant.top);
  if (heightDelta >= 5) return "height";
  if (topDelta >= 5) return "margin/padding-above";
  return "y-position";
}

/**
 * For each shift band, walk baseline elements in document order (sorted by
 * baseline.top) and find the first one whose matching-by-path variant
 * counterpart has a Δy comparable to the band's shift magnitude.
 *
 * The "first such element" is the most actionable origin — everything below
 * it just inherits the shift. We emit up to `perBandLimit` candidates so
 * the agent gets fallback options.
 */
export function findShiftOrigins(
  baseline: BboxElement[],
  variant: BboxElement[],
  shiftRegions: ShiftRegion[],
  options: FindShiftOriginsOptions = {},
): ShiftOrigin[] {
  const minDelta = options.minDeltaPx ?? DEFAULT_MIN_DELTA;
  const perBandLimit = options.perBandLimit ?? DEFAULT_PER_BAND_LIMIT;
  if (baseline.length === 0 || variant.length === 0 || shiftRegions.length === 0) return [];

  const variantByPath = new Map<string, BboxElement>();
  for (const v of variant) variantByPath.set(v.path, v);

  const sorted = [...baseline].sort((a, b) => a.top - b.top || a.left - b.left);
  const origins: ShiftOrigin[] = [];

  for (const band of shiftRegions) {
    const bandShift = band.shift;
    if (Math.abs(bandShift) < minDelta) continue;

    // Look at elements whose baseline.top is at or just above the band's
    // start — typical origin is the element just before the visible shift
    // boundary (extra height/padding pushes everything below).
    const candidates: ShiftOrigin[] = [];
    for (const b of sorted) {
      // Skip elements far above the band (they wouldn't be the local cause).
      if (b.top < band.yStart - 200) continue;
      // Stop scanning well past the band end — origin is always at or above.
      if (b.top > band.yEnd) break;

      const v = variantByPath.get(b.path);
      if (!v) continue;
      const deltaY = v.top - b.top;
      if (Math.abs(deltaY) < minDelta) continue;
      // Note: do NOT require Math.sign(deltaY) === Math.sign(bandShift).
      // The pixelmatch-derived band shift uses cross-correlation which can
      // report a sign opposite to the bbox Δy when the variant has *less*
      // content than the baseline (or vice versa). We still want to flag
      // the element so the agent can interpret the direction itself.

      candidates.push({
        bandStart: band.yStart,
        bandEnd: band.yEnd,
        bandShift,
        originPath: b.path,
        originTag: b.tag,
        originBaselineTop: b.top,
        originVariantTop: v.top,
        originDeltaY: deltaY,
        originBaselineClasses: b.classes,
        originVariantClasses: v.classes,
        suspectedAxis: classifySuspect(b, v),
      });
    }

    // Rank: closer to |bandShift| first (best explanatory match), then
    // smallest baseline.top (earliest divergence wins ties).
    candidates.sort((a, b) =>
      Math.abs(Math.abs(a.originDeltaY) - Math.abs(bandShift)) -
      Math.abs(Math.abs(b.originDeltaY) - Math.abs(bandShift))
      || a.originBaselineTop - b.originBaselineTop,
    );
    origins.push(...candidates.slice(0, perBandLimit));
  }

  return origins;
}

export function explainShiftAccumulations(
  baseline: BboxElement[],
  variant: BboxElement[],
  shiftRegions: ShiftRegion[],
  options: { minDeltaPx?: number; maxGroups?: number } = {},
): ShiftAccumulationBreakdown[] {
  const minDelta = options.minDeltaPx ?? 1;
  const maxGroups = options.maxGroups ?? 8;
  if (baseline.length === 0 || variant.length === 0 || shiftRegions.length === 0) return [];

  const variantByPath = new Map<string, BboxElement>();
  for (const v of variant) variantByPath.set(v.path, v);

  const out: ShiftAccumulationBreakdown[] = [];
  for (const band of shiftRegions) {
    const groups = new Map<string, {
      tag: string;
      baselineClasses: string;
      variantClasses: string;
      deltas: number[];
      samplePaths: string[];
    }>();

    for (const b of baseline) {
      if (b.top >= band.yStart) continue;
      const v = variantByPath.get(b.path);
      if (!v) continue;
      const deltaHeight = roundDelta(v.height - b.height);
      if (Math.abs(deltaHeight) < minDelta) continue;

      const key = `${b.tag}\u0000${b.classes}\u0000${v.classes}`;
      const group = groups.get(key) ?? {
        tag: b.tag,
        baselineClasses: b.classes,
        variantClasses: v.classes,
        deltas: [],
        samplePaths: [],
      };
      group.deltas.push(deltaHeight);
      if (group.samplePaths.length < 3) group.samplePaths.push(b.path);
      groups.set(key, group);
    }

    const contributions = [...groups.values()]
      .map((g) => {
        const totalDeltaHeight = roundDelta(g.deltas.reduce((sum, d) => sum + d, 0));
        return {
          tag: g.tag,
          baselineClasses: g.baselineClasses,
          variantClasses: g.variantClasses,
          count: g.deltas.length,
          averageDeltaHeight: roundDelta(totalDeltaHeight / g.deltas.length),
          totalDeltaHeight,
          samplePaths: g.samplePaths,
        };
      })
      .sort((a, b) =>
        Math.abs(b.totalDeltaHeight) - Math.abs(a.totalDeltaHeight) ||
        a.baselineClasses.localeCompare(b.baselineClasses),
      )
      .slice(0, maxGroups);

    if (contributions.length === 0) continue;
    out.push({
      bandStart: band.yStart,
      bandEnd: band.yEnd,
      bandShift: band.shift,
      accumulatedDeltaHeight: roundDelta(contributions.reduce((sum, c) => sum + c.totalDeltaHeight, 0)),
      contributions,
    });
  }

  return out;
}

/**
 * Browser-side capture: same path scheme as
 * `dom-position-styles.DOM_POSITION_STYLES_BROWSER_SCRIPT`, returns bbox
 * (top/left/width/height in document-coords) instead of computed styles.
 */
export const DOM_BBOX_BROWSER_SCRIPT = `JSON.stringify((function(){
  var SEMANTIC = new Set([
    "main","header","nav","footer","aside","article","section",
    "h1","h2","h3","h4","h5","h6","p","a","button","input","select","textarea",
    "label","blockquote","pre","code","table","thead","tbody","tr","th","td",
    "ul","ol","li","img","span"
  ]);
  var out = [];
  function walk(el, parentPath, indexAmongChildren) {
    var tag = el.tagName.toLowerCase();
    var path = parentPath === "" ? tag + "[0]" : parentPath + ">" + tag + "[" + indexAmongChildren + "]";
    var hasClass = el.hasAttribute && el.hasAttribute("class");
    var interesting = hasClass || SEMANTIC.has(tag);
    if (interesting) {
      var r = el.getBoundingClientRect();
      out.push({
        path: path,
        tag: tag,
        classes: (el.getAttribute("class") || "").trim(),
        top: r.top + window.scrollY,
        left: r.left + window.scrollX,
        width: r.width,
        height: r.height
      });
    }
    var children = el.children;
    for (var j = 0; j < children.length; j++) {
      walk(children[j], path, j);
    }
  }
  if (document.body) walk(document.body, "", 0);
  return out;
})())`;

export function parseBboxes(value: unknown): BboxElement[] {
  if (Array.isArray(value)) return value as BboxElement[];
  if (typeof value !== "string") return [];
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed as BboxElement[] : [];
  } catch {
    return [];
  }
}
