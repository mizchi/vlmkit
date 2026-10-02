/**
 * Vertical-shift origin diagnostic.
 *
 * BboxElement walking and band grouping stay in TS (hot paths over
 * potentially hundreds of bboxes). The per-element axis classifier
 * and the delta-rounding rule live in MoonBit (`markup-core/shift_origin.mbt`).
 */
import type { ShiftRegion } from "@mizchi/vlmkit-core/types.ts";
import { computeShiftClassifySuspect, computeShiftRoundDelta, type ShiftSuspectedAxis } from "./markup-core-shift.ts";

export interface BboxElement {
  path: string;
  tag: string;
  id?: string;
  classes: string;
  top: number;
  left: number;
  width: number;
  height: number;
}

export interface ShiftOrigin {
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
  suspectedAxis?: ShiftSuspectedAxis;
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
  minDeltaPx?: number;
  perBandLimit?: number;
}

const DEFAULT_MIN_DELTA = 5;
const DEFAULT_PER_BAND_LIMIT = 3;

function classifySuspect(baseline: BboxElement, variant: BboxElement): ShiftSuspectedAxis {
  return computeShiftClassifySuspect(Math.abs(baseline.height - variant.height), Math.abs(baseline.top - variant.top));
}

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

    const candidates: ShiftOrigin[] = [];
    for (const b of sorted) {
      if (b.top < band.yStart - 200) continue;
      if (b.top > band.yEnd) break;

      const v = variantByPath.get(b.path);
      if (!v) continue;
      const deltaY = v.top - b.top;
      if (Math.abs(deltaY) < minDelta) continue;

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

    candidates.sort(
      (a, b) =>
        Math.abs(Math.abs(a.originDeltaY) - Math.abs(bandShift)) -
          Math.abs(Math.abs(b.originDeltaY) - Math.abs(bandShift)) || a.originBaselineTop - b.originBaselineTop,
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
    const groups = new Map<
      string,
      {
        tag: string;
        baselineClasses: string;
        variantClasses: string;
        deltas: number[];
        samplePaths: string[];
      }
    >();

    for (const b of baseline) {
      if (b.top >= band.yStart) continue;
      const v = variantByPath.get(b.path);
      if (!v) continue;
      const deltaHeight = computeShiftRoundDelta(v.height - b.height);
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
        const totalDeltaHeight = computeShiftRoundDelta(g.deltas.reduce((sum, d) => sum + d, 0));
        return {
          tag: g.tag,
          baselineClasses: g.baselineClasses,
          variantClasses: g.variantClasses,
          count: g.deltas.length,
          averageDeltaHeight: computeShiftRoundDelta(totalDeltaHeight / g.deltas.length),
          totalDeltaHeight,
          samplePaths: g.samplePaths,
        };
      })
      .sort(
        (a, b) =>
          Math.abs(b.totalDeltaHeight) - Math.abs(a.totalDeltaHeight) ||
          a.baselineClasses.localeCompare(b.baselineClasses),
      )
      .slice(0, maxGroups);

    if (contributions.length === 0) continue;
    out.push({
      bandStart: band.yStart,
      bandEnd: band.yEnd,
      bandShift: band.shift,
      accumulatedDeltaHeight: computeShiftRoundDelta(contributions.reduce((sum, c) => sum + c.totalDeltaHeight, 0)),
      contributions,
    });
  }

  return out;
}

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
        id: (el.getAttribute("id") || "").trim(),
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
    return Array.isArray(parsed) ? (parsed as BboxElement[]) : [];
  } catch {
    return [];
  }
}
