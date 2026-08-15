/**
 * How much two boxes overlap, in one place.
 *
 * This arithmetic was written out six times across the repo, under five names: `overlapArea`
 * (`semantic-drilldown`), `intersectionArea` (`region-selector-match`), `rectIntersectionArea`
 * (`diff-for-agent`), and `iouOf` twice — once in `component-bbox` and once in `page-compose-diff`,
 * byte-identical apart from the local variable names. It is the shape of defect this repo keeps
 * finding: the same thing in several places, where fixing one leaves the others.
 *
 * Two sites deliberately keep their own copy and are worth naming, so a future sweep does not
 * "collapse" them by mistake:
 *
 *   - `copy-check.ts` computes it inside a browser script, which cannot import anything.
 *   - `integrity-check.ts` and `font-determinism-probe.ts` need the per-axis overlap (`ox`, `oy`)
 *     rather than the area, because they report which axis collided.
 */

/** Any box with a top-left origin. `x`/`y`-shaped callers pass `{ left: x, top: y, … }`. */
export interface OverlapBox {
  left: number;
  top: number;
  width: number;
  height: number;
}

/**
 * Area shared by two boxes, and 0 when they do not overlap at all.
 *
 * `Math.max(0, …)` on each axis rather than an early return: boxes that touch along one edge have a
 * zero-width intersection, and multiplying gives 0 without a special case.
 */
export function overlapArea(a: OverlapBox, b: OverlapBox): number {
  const left = Math.max(a.left, b.left);
  const top = Math.max(a.top, b.top);
  const right = Math.min(a.left + a.width, b.left + b.width);
  const bottom = Math.min(a.top + a.height, b.top + b.height);
  return Math.max(0, right - left) * Math.max(0, bottom - top);
}

/**
 * Intersection over union, the standard box-similarity ratio: 1 for identical boxes, 0 for disjoint.
 *
 * Returns 0 rather than `NaN` when both boxes are empty — the union is then 0, and a division would
 * hand every caller a value that fails every comparison it is put into. `NaN > threshold` is false,
 * so the case would read as "not similar" in some callers and be silently skipped in others.
 */
export function iou(a: OverlapBox, b: OverlapBox): number {
  const inter = overlapArea(a, b);
  const union = a.width * a.height + b.width * b.height - inter;
  return union > 0 ? inter / union : 0;
}
