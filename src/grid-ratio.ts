/**
 * Grid `fr`-ratio inference.
 *
 * Closes the dogfood/eval gap from Subagent C/D: when a grid container's
 * children have different widths between baseline and variant, the
 * agent currently has to compute the implied `fr` ratio by hand
 * (D: "393.172/298.812 = 1.3158 is a weird ratio. I guessed `1.316fr 1fr`
 * but the actual baseline could be `7fr 5fr`.").
 *
 * This module pairs baseline bboxes against variant bboxes, finds
 * parent elements whose direct children have a non-uniform width
 * distribution, computes the implied ratio, and suggests both a
 * decimal-fr representation and a low-integer fraction approximation.
 *
 * Pure module — bboxes are supplied by the caller.
 */

import type { BboxElement } from "./shift-origin.ts";

export interface GridSuggestion {
  /** Parent path (the grid container's DOM position). */
  parentPath: string;
  parentTag: string;
  baselineClasses: string;
  variantClasses: string;
  viewport: string;
  /** Direct child widths in baseline (document order). */
  baselineWidths: number[];
  /** Direct child widths in variant (document order). */
  variantWidths: number[];
  /** Decimal ratios for baseline relative to the smallest child. */
  baselineRatioDecimal: string;
  /** Decimal ratios for variant relative to the smallest child. */
  variantRatioDecimal: string;
  /** Best integer approximation of the baseline ratio (e.g. "7fr 5fr"). */
  baselineFrSuggestion: string;
}

export interface FindGridSuggestionsOptions {
  /** Minimum width tolerance (px) below which two children are considered equal-width. */
  equalityTolerance?: number;
  /** Only consider parents with at least this many direct children. */
  minChildren?: number;
  /** Cap on integer-approximation search (try denominators 1..maxFrDenominator). */
  maxFrDenominator?: number;
  /**
   * Minimum max/min ratio for baseline children to count as "non-uniform."
   * Below this, we treat the spread as flexbox subpixel rendering noise
   * (e.g. 3 equal-flex buttons that come out 130/140/143 due to gap rounding).
   * 1.15 ≈ require a 15% width gap before flagging as a grid-ratio candidate.
   */
  minRatioSpread?: number;
  /**
   * Maximum allowed sum(children-widths) / parent-width. A row-direction
   * grid/flex container should have sum ≈ parent width (the children tile
   * horizontally). When the sum is much larger, the children are
   * column-stacked (each fills 100%) and the per-child width is
   * content-driven, not a grid ratio. Default 1.3.
   */
  maxSumOverParent?: number;
}

const DEFAULT_TOLERANCE = 2;       // 2px subpixel slack
const DEFAULT_MIN_CHILDREN = 2;
const DEFAULT_MAX_FR_DENOM = 12;
const DEFAULT_MIN_RATIO_SPREAD = 1.15;
const DEFAULT_MAX_SUM_OVER_PARENT = 1.3;

/**
 * Heuristic: a parent is a "grid candidate" iff:
 *   - it has >= minChildren direct children with a bbox
 *   - in the baseline, children widths are NOT all equal (the ratio is
 *     informative; uniform widths are noise)
 *   - the baseline widths differ from the variant widths (else there's
 *     nothing to suggest)
 */
function pathOf(parent: string, _child: BboxElement): string {
  // `child.path` already encodes parent. Helper exists for clarity.
  return parent;
}

function findDirectChildren(parent: string, all: BboxElement[]): BboxElement[] {
  if (!parent) return [];
  const prefix = `${parent}>`;
  const out: BboxElement[] = [];
  for (const el of all) {
    if (!el.path.startsWith(prefix)) continue;
    const rest = el.path.slice(prefix.length);
    if (rest.includes(">")) continue; // not a direct child
    out.push(el);
  }
  // Sort by sibling index encoded in `tag[N]` so document order is preserved.
  out.sort((a, b) => {
    const ia = parseInt(a.path.match(/\[(\d+)\]$/)?.[1] ?? "0", 10);
    const ib = parseInt(b.path.match(/\[(\d+)\]$/)?.[1] ?? "0", 10);
    return ia - ib;
  });
  return out;
}

function allEqual(widths: number[], tol: number): boolean {
  if (widths.length < 2) return true;
  const min = Math.min(...widths);
  const max = Math.max(...widths);
  return max - min <= tol;
}

function arraysClose(a: number[], b: number[], tol: number): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    if (Math.abs(a[i]! - b[i]!) > tol) return false;
  }
  return true;
}

/**
 * Return a "Nfr Mfr" string approximating the ratio of `widths` using
 * small integers, or undefined if no clean integer ratio fits within
 * `maxDenom`. For widths [393, 298] → "7fr 5fr" (since 7/5 ≈ 1.4 vs
 * 393/298 ≈ 1.319 — actually no, 7/5 is too rough. Let's check: closest
 * within 12: 19/14 ≈ 1.357, 4/3 ≈ 1.333, 5/4 = 1.25. None within 2%.
 * Fall through to decimal in that case.
 */
function approximateAsIntegerFr(widths: number[], maxDenom: number): string | undefined {
  if (widths.length === 0) return undefined;
  const min = Math.min(...widths);
  if (min <= 0) return undefined;
  const ratios = widths.map((w) => w / min);

  let best: { denoms: number[]; err: number } | undefined;
  // Iterate over a common denominator: for each candidate denom D, round
  // each ratio*D to nearest integer, check overall error.
  for (let D = 1; D <= maxDenom; D++) {
    const ints = ratios.map((r) => Math.round(r * D));
    if (ints.some((n) => n <= 0)) continue;
    // Compute relative error per child.
    let err = 0;
    for (let i = 0; i < ratios.length; i++) {
      const approxRatio = ints[i]! / D;
      err += Math.abs(approxRatio - ratios[i]!) / ratios[i]!;
    }
    err /= ratios.length;
    if (err < 0.01 && (!best || err < best.err)) {
      // Reduce the gcd so we get the minimum integer form.
      const allInts = [...ints];
      const g = allInts.reduce((acc, n) => gcd(acc, n), allInts[0]!);
      const reduced = allInts.map((n) => n / g);
      best = { denoms: reduced, err };
    }
  }
  if (!best) return undefined;
  return best.denoms.map((n) => `${n}fr`).join(" ");
}

function gcd(a: number, b: number): number {
  return b === 0 ? a : gcd(b, a % b);
}

function ratiosToDecimal(widths: number[]): string {
  if (widths.length === 0) return "";
  const min = Math.min(...widths);
  if (min <= 0) return widths.join(" : ");
  return widths.map((w) => (w / min).toFixed(3)).join(" : ");
}

/**
 * Walk baseline bboxes and find every parent whose direct children have
 * a *non-uniform* width distribution that *differs* from the variant.
 * One suggestion per parent per viewport.
 */
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

  // Distinct parent paths derived from baseline (each child's path's
  // prefix-up-to-last-`>`).
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
    if (allEqual(baselineWidths, tol)) continue;
    // Reject flexbox subpixel-rendering noise: require a meaningful spread
    // before we believe the baseline truly has a `grid-template-columns`
    // (or similar) ratio worth suggesting.
    const minW = Math.min(...baselineWidths);
    const maxW = Math.max(...baselineWidths);
    if (minW <= 0 || maxW / minW < minSpread) continue;

    // Reject column-stacked containers (flex-direction: column or block
    // siblings). Their children fill 100% width and any per-child width
    // differences are content-sized, not from a grid-template-columns
    // rule. Heuristic: sum(children) ≫ parent.width.
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
    if (arraysClose(baselineWidths, variantWidths, tol)) continue;

    const parentBaseline = baseline.find((b) => b.path === parent);
    const parentVariant = variantByPath.get(parent);
    out.push({
      parentPath: pathOf(parent, baselineChildren[0]!),
      parentTag: parentBaseline?.tag ?? "",
      baselineClasses: parentBaseline?.classes ?? "",
      variantClasses: parentVariant?.classes ?? "",
      viewport,
      baselineWidths,
      variantWidths,
      baselineRatioDecimal: ratiosToDecimal(baselineWidths),
      variantRatioDecimal: ratiosToDecimal(variantWidths),
      baselineFrSuggestion: approximateAsIntegerFr(baselineWidths, maxDenom)
        ?? baselineWidths.map((w, i, arr) => `${(w / Math.min(...arr)).toFixed(3)}fr`).join(" "),
    });
  }

  // Sort by ratio mismatch magnitude (largest first).
  out.sort((a, b) => {
    const aGap = a.baselineWidths.reduce((s, w, i) => s + Math.abs(w - a.variantWidths[i]!), 0);
    const bGap = b.baselineWidths.reduce((s, w, i) => s + Math.abs(w - b.variantWidths[i]!), 0);
    return bGap - aGap;
  });

  return out;
}
