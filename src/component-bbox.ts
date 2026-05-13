/**
 * Component bounding-box extraction from rendered screenshots.
 *
 * Closes the gap Subagent F flagged for the wireframe scenario
 * (`docs/reports/2026-05-12-subagent-eval.md` § F addendum): when
 * baseline and variant don't share a DOM tree, the agent has no way
 * to see "your card is 18px narrower than the baseline's." F had to
 * write ad-hoc `pngjs` probes by hand.
 *
 * Algorithm (pure, runs on the raw RGBA buffer):
 *   1. Detect background color by sampling image-edge pixels.
 *   2. Build a foreground mask (any channel differs from bg by > tolerance).
 *   3. Label connected foreground pixels into components via two-pass
 *      union-find (4-connectivity, row-major scan).
 *   4. Compute axis-aligned bbox + pixel area per component.
 *   5. Filter components below `minArea`, sort by area desc, return
 *      the top N.
 *
 * The matcher (`matchComponents`) pairs baseline ↔ variant by rank-
 * after-sort-by-area: the largest component in each is assumed to be
 * "the card" (or the dominant visual element), the next largest
 * "the button row," etc. Works when the visual hierarchy is preserved
 * even though the DOM diverges.
 */
import { PNG } from "pngjs";
import { readFile } from "node:fs/promises";

export interface ComponentBbox {
  top: number;
  left: number;
  width: number;
  height: number;
  /** Pixel count actually filled (not bbox area). */
  area: number;
  /** Sampled fill color at the bbox center, "rgb(r, g, b)". */
  fillColor: string;
}

export interface MatchedBbox {
  rank: number;
  baseline: ComponentBbox;
  variant: ComponentBbox;
  deltaTop: number;
  deltaLeft: number;
  deltaWidth: number;
  deltaHeight: number;
  /** Intersection-over-union of the two bboxes — quick sanity score. */
  iou: number;
}

export interface ExtractComponentsOptions {
  /** Minimum filled-pixel count for a component to be kept. Default 200 (≈ 15×15). */
  minArea?: number;
  /** How many components to return after sorting by area. Default 8. */
  topN?: number;
  /** Per-channel difference threshold for "foreground." Default 12. */
  bgTolerance?: number;
}

const DEFAULT_MIN_AREA = 200;
const DEFAULT_TOP_N = 8;
const DEFAULT_BG_TOLERANCE = 12;

function detectBackground(data: Uint8Array, width: number, height: number): [number, number, number] {
  // Sample the corners + the middle of each edge. Most-frequent triple wins.
  const samples: Array<[number, number, number]> = [];
  const points = [
    [0, 0], [width - 1, 0], [0, height - 1], [width - 1, height - 1],
    [Math.floor(width / 2), 0],
    [Math.floor(width / 2), height - 1],
    [0, Math.floor(height / 2)],
    [width - 1, Math.floor(height / 2)],
  ] as Array<[number, number]>;
  for (const [x, y] of points) {
    const i = (y * width + x) * 4;
    samples.push([data[i]!, data[i + 1]!, data[i + 2]!]);
  }
  // Mode via histogram (quantize to /8 bins to merge near-identical samples).
  const counts = new Map<string, number>();
  for (const [r, g, b] of samples) {
    const k = `${r >> 3},${g >> 3},${b >> 3}`;
    counts.set(k, (counts.get(k) ?? 0) + 1);
  }
  let best = "";
  let bestN = -1;
  for (const [k, n] of counts) {
    if (n > bestN) {
      bestN = n;
      best = k;
    }
  }
  const [rq, gq, bq] = best.split(",").map((s) => Number(s));
  return [rq! << 3, gq! << 3, bq! << 3];
}

function inBackground(
  r: number, g: number, b: number,
  bgR: number, bgG: number, bgB: number,
  tol: number,
): boolean {
  return Math.abs(r - bgR) <= tol && Math.abs(g - bgG) <= tol && Math.abs(b - bgB) <= tol;
}

/**
 * Two-pass union-find connected components on a foreground mask.
 * Returns the per-label bbox + area. 4-connectivity.
 */
function labelAndMeasure(
  mask: Uint8Array,
  width: number,
  height: number,
  data: Uint8Array,
): ComponentBbox[] {
  const labels = new Int32Array(width * height);
  // Union-find parent map; index 0 = "no label."
  const parent: number[] = [0];
  function find(x: number): number {
    while (parent[x] !== x) {
      parent[x] = parent[parent[x]!]!; // path compression halving
      x = parent[x]!;
    }
    return x;
  }
  function union(a: number, b: number): void {
    const ra = find(a), rb = find(b);
    if (ra !== rb) parent[Math.max(ra, rb)] = Math.min(ra, rb);
  }
  let next = 1;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = y * width + x;
      if (!mask[idx]) continue;
      const up = y > 0 ? labels[idx - width]! : 0;
      const left = x > 0 ? labels[idx - 1]! : 0;
      if (up && left) {
        const a = Math.min(up, left);
        labels[idx] = a;
        if (up !== left) union(up, left);
      } else if (up) {
        labels[idx] = up;
      } else if (left) {
        labels[idx] = left;
      } else {
        labels[idx] = next;
        parent[next] = next;
        next++;
      }
    }
  }

  // Second pass: resolve labels + accumulate per-root stats.
  type Stat = { minX: number; minY: number; maxX: number; maxY: number; area: number; sumR: number; sumG: number; sumB: number };
  const byRoot = new Map<number, Stat>();
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = y * width + x;
      const l = labels[idx];
      if (!l) continue;
      const root = find(l);
      let s = byRoot.get(root);
      if (!s) {
        s = { minX: x, minY: y, maxX: x, maxY: y, area: 0, sumR: 0, sumG: 0, sumB: 0 };
        byRoot.set(root, s);
      }
      if (x < s.minX) s.minX = x;
      if (x > s.maxX) s.maxX = x;
      if (y < s.minY) s.minY = y;
      if (y > s.maxY) s.maxY = y;
      s.area += 1;
      const di = idx * 4;
      s.sumR += data[di]!;
      s.sumG += data[di + 1]!;
      s.sumB += data[di + 2]!;
    }
  }

  const out: ComponentBbox[] = [];
  for (const s of byRoot.values()) {
    const r = Math.round(s.sumR / s.area);
    const g = Math.round(s.sumG / s.area);
    const b = Math.round(s.sumB / s.area);
    out.push({
      top: s.minY,
      left: s.minX,
      width: s.maxX - s.minX + 1,
      height: s.maxY - s.minY + 1,
      area: s.area,
      fillColor: `rgb(${r}, ${g}, ${b})`,
    });
  }
  return out;
}

export function extractComponentsFromRgba(
  data: Uint8Array,
  width: number,
  height: number,
  options: ExtractComponentsOptions = {},
): ComponentBbox[] {
  const minArea = options.minArea ?? DEFAULT_MIN_AREA;
  const topN = options.topN ?? DEFAULT_TOP_N;
  const tol = options.bgTolerance ?? DEFAULT_BG_TOLERANCE;

  if (width <= 0 || height <= 0) return [];

  const [bgR, bgG, bgB] = detectBackground(data, width, height);

  const mask = new Uint8Array(width * height);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = (y * width + x) * 4;
      const r = data[idx]!, g = data[idx + 1]!, b = data[idx + 2]!;
      if (!inBackground(r, g, b, bgR, bgG, bgB, tol)) {
        mask[y * width + x] = 1;
      }
    }
  }

  const components = labelAndMeasure(mask, width, height, data);
  return components
    .filter((c) => c.area >= minArea)
    .sort((a, b) => b.area - a.area)
    .slice(0, topN);
}

export async function extractComponentsFromFile(
  path: string,
  options: ExtractComponentsOptions = {},
): Promise<ComponentBbox[]> {
  const buf = await readFile(path);
  const png = PNG.sync.read(buf);
  return extractComponentsFromRgba(png.data, png.width, png.height, options);
}

function iouOf(a: ComponentBbox, b: ComponentBbox): number {
  const ix = Math.max(a.left, b.left);
  const iy = Math.max(a.top, b.top);
  const ax = Math.min(a.left + a.width, b.left + b.width);
  const ay = Math.min(a.top + a.height, b.top + b.height);
  const interW = Math.max(0, ax - ix);
  const interH = Math.max(0, ay - iy);
  const inter = interW * interH;
  const union = a.width * a.height + b.width * b.height - inter;
  return union > 0 ? inter / union : 0;
}

/**
 * Pair components by rank-after-sort-by-area. Returns matched pairs +
 * per-axis deltas. Designed for visual hierarchies that survive a
 * DOM rewrite: the largest component is "the card", the second
 * largest is "the button row", etc.
 */
export function matchComponents(
  baseline: ComponentBbox[],
  variant: ComponentBbox[],
): MatchedBbox[] {
  const n = Math.min(baseline.length, variant.length);
  const out: MatchedBbox[] = [];
  for (let i = 0; i < n; i++) {
    const b = baseline[i]!;
    const v = variant[i]!;
    out.push({
      rank: i,
      baseline: b,
      variant: v,
      deltaTop: v.top - b.top,
      deltaLeft: v.left - b.left,
      deltaWidth: v.width - b.width,
      deltaHeight: v.height - b.height,
      iou: Number(iouOf(b, v).toFixed(3)),
    });
  }
  return out;
}
