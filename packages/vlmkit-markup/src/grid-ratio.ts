/**
 * Grid `fr`-ratio inference.
 *
 * Bbox walking and parent-child grouping stay in TS; the pure number
 * policy (gcd, equality, decimal ratio, integer-fr approximation) lives
 * in MoonBit (`markup-core/grid_ratio.mbt`).
 */
import type { BboxElement } from "./shift-origin.ts";
import {
  computeGridAllEqual,
  computeGridApproximateIntegerFr,
  computeGridArraysClose,
  computeGridRatiosToDecimal,
} from "./markup-core-grid.ts";

export interface GridSuggestion {
  parentPath: string;
  parentTag: string;
  baselineClasses: string;
  variantClasses: string;
  viewport: string;
  baselineWidths: number[];
  variantWidths: number[];
  baselineRatioDecimal: string;
  variantRatioDecimal: string;
  baselineFrSuggestion: string;
}

export interface FindGridSuggestionsOptions {
  equalityTolerance?: number;
  minChildren?: number;
  maxFrDenominator?: number;
  minRatioSpread?: number;
  maxSumOverParent?: number;
}

const DEFAULT_TOLERANCE = 2;
const DEFAULT_MIN_CHILDREN = 2;
const DEFAULT_MAX_FR_DENOM = 12;
const DEFAULT_MIN_RATIO_SPREAD = 1.15;
const DEFAULT_MAX_SUM_OVER_PARENT = 1.3;

function findDirectChildren(parent: string, all: BboxElement[]): BboxElement[] {
  if (!parent) return [];
  const prefix = `${parent}>`;
  const out: BboxElement[] = [];
  for (const el of all) {
    if (!el.path.startsWith(prefix)) continue;
    const rest = el.path.slice(prefix.length);
    if (rest.includes(">")) continue;
    out.push(el);
  }
  out.sort((a, b) => {
    const ia = parseInt(a.path.match(/\[(\d+)\]$/)?.[1] ?? "0", 10);
    const ib = parseInt(b.path.match(/\[(\d+)\]$/)?.[1] ?? "0", 10);
    return ia - ib;
  });
  return out;
}

function fallbackDecimalFr(widths: number[]): string {
  if (widths.length === 0) return "";
  const min = Math.min(...widths);
  if (min <= 0) {
    return widths.map((w) => `${w}fr`).join(" ");
  }
  return widths.map((w) => `${(w / min).toFixed(3)}fr`).join(" ");
}

export function findGridSuggestions(
  baseline: BboxElement[],
  variant: BboxElement[],
  viewport: string,
  options: FindGridSuggestionsOptions = {},
): GridSuggestion[] {
  const tol = options.equalityTolerance ?? DEFAULT_TOLERANCE;
  const minChildren = options.minChildren ?? DEFAULT_MIN_CHILDREN;
  const maxDenom = options.maxFrDenominator ?? DEFAULT_MAX_FR_DENOM;
  const minSpread = options.minRatioSpread ?? DEFAULT_MIN_RATIO_SPREAD;
  const maxSumOverParent = options.maxSumOverParent ?? DEFAULT_MAX_SUM_OVER_PARENT;

  if (baseline.length === 0 || variant.length === 0) return [];

  const variantByPath = new Map<string, BboxElement>();
  for (const v of variant) variantByPath.set(v.path, v);

  const parentPaths = new Set<string>();
  for (const b of baseline) {
    const lastGt = b.path.lastIndexOf(">");
    if (lastGt > 0) parentPaths.add(b.path.slice(0, lastGt));
  }

  const out: GridSuggestion[] = [];
  for (const parent of parentPaths) {
    const baselineChildren = findDirectChildren(parent, baseline);
    if (baselineChildren.length < minChildren) continue;
    const baselineWidths = baselineChildren.map((c) => Math.round(c.width * 100) / 100);
    if (computeGridAllEqual(baselineWidths, tol)) continue;
    const minW = Math.min(...baselineWidths);
    const maxW = Math.max(...baselineWidths);
    if (minW <= 0 || maxW / minW < minSpread) continue;

    const parentBboxForCheck = baseline.find((b) => b.path === parent);
    if (parentBboxForCheck && parentBboxForCheck.width > 0) {
      const sum = baselineWidths.reduce((a, b) => a + b, 0);
      if (sum / parentBboxForCheck.width > maxSumOverParent) continue;
    }

    const variantChildren = baselineChildren
      .map((bc) => variantByPath.get(bc.path))
      .filter((v): v is BboxElement => v !== undefined);
    if (variantChildren.length !== baselineChildren.length) continue;
    const variantWidths = variantChildren.map((c) => Math.round(c.width * 100) / 100);
    if (computeGridArraysClose(baselineWidths, variantWidths, tol)) continue;

    const parentBaseline = baseline.find((b) => b.path === parent);
    const parentVariant = variantByPath.get(parent);
    const frSuggestion = computeGridApproximateIntegerFr(baselineWidths, maxDenom)
      || fallbackDecimalFr(baselineWidths);
    out.push({
      parentPath: parent,
      parentTag: parentBaseline?.tag ?? "",
      baselineClasses: parentBaseline?.classes ?? "",
      variantClasses: parentVariant?.classes ?? "",
      viewport,
      baselineWidths,
      variantWidths,
      baselineRatioDecimal: computeGridRatiosToDecimal(baselineWidths),
      variantRatioDecimal: computeGridRatiosToDecimal(variantWidths),
      baselineFrSuggestion: frSuggestion,
    });
  }

  out.sort((a, b) => {
    const aGap = a.baselineWidths.reduce((s, w, i) => s + Math.abs(w - a.variantWidths[i]!), 0);
    const bGap = b.baselineWidths.reduce((s, w, i) => s + Math.abs(w - b.variantWidths[i]!), 0);
    return bGap - aGap;
  });

  return out;
}
