/**
 * Scoring for the Jev box bench. Pure: boxes in, numbers out.
 *
 * Every box here is in the screenshot's pixel space (the captures are DPR 1, so CSS px), half-open
 * `x1 <= x < x2`. Jev answers in fractions of the image; the caller converts with
 * `jevBoxToPixels` before scoring.
 */
export interface PxBox {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
}

export const area = (b: PxBox) => Math.max(0, b.x2 - b.x1) * Math.max(0, b.y2 - b.y1);

export function iou(a: PxBox, b: PxBox): number {
  const inter = area({
    x1: Math.max(a.x1, b.x1),
    y1: Math.max(a.y1, b.y1),
    x2: Math.min(a.x2, b.x2),
    y2: Math.min(a.y2, b.y2),
  });
  const union = area(a) + area(b) - inter;
  return union > 0 ? inter / union : 0;
}

export const centre = (b: PxBox) => ({ x: (b.x1 + b.x2) / 2, y: (b.y1 + b.y2) / 2 });
export const contains = (b: PxBox, p: { x: number; y: number }) =>
  p.x >= b.x1 && p.x < b.x2 && p.y >= b.y1 && p.y < b.y2;

/** Mean absolute error of the four edges, px. */
export const edgeError = (pred: PxBox, truth: PxBox) =>
  (Math.abs(pred.x1 - truth.x1) +
    Math.abs(pred.y1 - truth.y1) +
    Math.abs(pred.x2 - truth.x2) +
    Math.abs(pred.y2 - truth.y2)) /
  4;

export interface BoxScore {
  iou: number;
  /** The predicted box's centre is inside the truth: a click there would hit the element. */
  clickHit: boolean;
  /** The predicted box covers the whole truth (cropping to it would not cut the target). */
  covers: boolean;
  edgeErrorPx: number;
}

export function scoreBox(pred: PxBox, truth: PxBox): BoxScore {
  return {
    iou: iou(pred, truth),
    clickHit: contains(truth, centre(pred)),
    covers: pred.x1 <= truth.x1 && pred.y1 <= truth.y1 && pred.x2 >= truth.x2 && pred.y2 >= truth.y2,
    edgeErrorPx: edgeError(pred, truth),
  };
}

/** Grow a box by `frac` of its own size on each side (at least `minPx`), clamped to the image. */
export function padBox(b: PxBox, frac: number, minPx: number, width: number, height: number): PxBox {
  const px = Math.max(minPx, (b.x2 - b.x1) * frac);
  const py = Math.max(minPx, (b.y2 - b.y1) * frac);
  return {
    x1: Math.max(0, b.x1 - px),
    y1: Math.max(0, b.y1 - py),
    x2: Math.min(width, b.x2 + px),
    y2: Math.min(height, b.y2 + py),
  };
}

/**
 * The crop a refinement pass looks at: the padded box grown (about its centre) to at least
 * `minEdge` on each side, so the API's 280px floor holds before upscaling, then snapped to whole
 * pixels inside the image.
 */
export function refineWindow(b: PxBox, width: number, height: number, minEdge: number, pad = 1): PxBox {
  const p = padBox(b, pad, 16, width, height);
  const grow = (lo: number, hi: number, limit: number) => {
    const need = Math.max(0, minEdge - (hi - lo));
    let a = lo - need / 2;
    let z = hi + need / 2;
    if (a < 0) [a, z] = [0, z - a];
    if (z > limit) [a, z] = [Math.max(0, a - (z - limit)), limit];
    return [Math.floor(a), Math.ceil(z)] as const;
  };
  const [x1, x2] = grow(p.x1, p.x2, width);
  const [y1, y2] = grow(p.y1, p.y2, height);
  return { x1, y1, x2, y2 };
}

/** Area under the ROC curve: how well `score` ranks positives above negatives (ties count half). */
export function auroc(scores: { score: number; positive: boolean }[]): number | null {
  const pos = scores.filter((s) => s.positive).map((s) => s.score);
  const neg = scores.filter((s) => !s.positive).map((s) => s.score);
  if (pos.length === 0 || neg.length === 0) return null;
  let wins = 0;
  for (const p of pos) for (const n of neg) wins += p > n ? 1 : p === n ? 0.5 : 0;
  return wins / (pos.length * neg.length);
}

export const mean = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : NaN);

export function median(xs: number[]): number {
  if (xs.length === 0) return NaN;
  const s = [...xs].sort((a, b) => a - b);
  const m = s.length >> 1;
  return s.length % 2 ? s[m]! : (s[m - 1]! + s[m]!) / 2;
}

/** Size buckets by the truth's shorter edge — what makes a small target small on a screenshot. */
export type SizeBucket = "tiny" | "small" | "medium" | "large";
export function sizeBucket(b: PxBox): SizeBucket {
  const edge = Math.min(b.x2 - b.x1, b.y2 - b.y1);
  if (edge < 16) return "tiny";
  if (edge < 28) return "small";
  if (edge < 80) return "medium";
  return "large";
}

export interface BoxSummary {
  n: number;
  meanIou: number;
  medianIou: number;
  iou50: number;
  clickHit: number;
  covers: number;
  medianEdgePx: number;
}

export function summarizeBoxes(scores: BoxScore[]): BoxSummary {
  const n = scores.length;
  const frac = (f: (s: BoxScore) => boolean) => (n ? scores.filter(f).length / n : NaN);
  return {
    n,
    meanIou: mean(scores.map((s) => s.iou)),
    medianIou: median(scores.map((s) => s.iou)),
    iou50: frac((s) => s.iou >= 0.5),
    clickHit: frac((s) => s.clickHit),
    covers: frac((s) => s.covers),
    medianEdgePx: median(scores.map((s) => s.edgeErrorPx)),
  };
}

/**
 * The smallest step between distinct edge values Jev returned, as a fraction. Jev 1.14 answers
 * with two decimals; this measures that rather than assuming it.
 */
export function edgeResolution(values: number[]): number | null {
  const uniq = [...new Set(values.map((v) => Math.round(v * 1e6) / 1e6))].sort((a, b) => a - b);
  let best = Infinity;
  for (let i = 1; i < uniq.length; i++) best = Math.min(best, uniq[i]! - uniq[i - 1]!);
  return Number.isFinite(best) ? Math.round(best * 1e6) / 1e6 : null;
}
