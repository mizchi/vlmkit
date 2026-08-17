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
import { iou } from "@mizchi/vlmkit-core/rect-overlap.ts";

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
  /**
   * Minimum filled-pixel count for a component to be kept. Default 200
   * (≈ 15×15). Only binds below roughly 640×360, and only once `topN` has been
   * raised — see `EXTRACT_PRESETS`.
   */
  minArea?: number;
  /**
   * How many components to return after sorting by area. Default 8.
   *
   * This is the binding constraint on element-dense frames at *every* size, not
   * a display nicety: a 16-element HUD reports 6 of them at 320×240 and 6 at
   * 1280×720 until it is raised. Because the list is sorted by area descending,
   * raising it can only append smaller components — it never displaces one that
   * the old cap already returned.
   */
  topN?: number;
  /**
   * Per-channel difference threshold for "foreground." Defaults to a value
   * derived from the image's own noise floor (4 on a clean render, up to 12
   * on a noisy export) — see `adaptiveBgTolerance`. Pin it only when you
   * need two extractions to use provably identical settings.
   */
  bgTolerance?: number;
  /**
   * Explicit background color. When set, edge-based detection is skipped.
   * Callers comparing two renders of the same page should compute the
   * background once and pass it to both extractions — edge sampling can
   * disagree between the two images (e.g. a full-bleed dark header
   * dominates one image's perimeter but not the other's), which makes
   * the component sets incomparable.
   */
  background?: [number, number, number];
}

export const DEFAULT_MIN_AREA = 200;
export const DEFAULT_TOP_N = 8;
const DEFAULT_BG_TOLERANCE = 12;

/**
 * Named threshold bundles for frames the defaults were not calibrated on.
 *
 * `game-ui` comes from vlmkit#118 §4: a canvas/WebGPU engine reported that a
 * 320x240 pixel-art HUD "makes elements hard to detect" and asked for a preset.
 * Measured on a 16-element synthetic HUD (`component-extract.test.ts` builds the
 * same one), counting an element as detected at bbox IoU >= 0.5:
 *
 *   320x240   defaults (minArea 200, topN 8)  ->  6/16
 *             minArea 24 alone                ->  6/16   (no change at all)
 *             topN 24 alone                   ->  9/16
 *             minArea 24 + topN 24            -> 14/16
 *   1280x720  defaults                        ->  6/16
 *             topN 24 alone                   -> 14/16   (minArea never binds)
 *
 * Two things that reading the issue would not predict. First, `minArea` — the
 * threshold the report names — is worth nothing by itself: `topN` is the binding
 * constraint, and it binds at *every* frame size, not just small ones. Second,
 * `minArea` only starts to matter once `topN` is lifted, and only below roughly
 * 640x360 (13/14 of the reachable ceiling at 640x360 on the historical 200,
 * 9/14 at 320x240).
 *
 * 14/16 is the ceiling, not a shortfall: the two misses are glyph-run labels,
 * and 4-connectivity cannot merge separated glyphs into one component at any
 * threshold. The same 2 are missed at minArea 1.
 *
 * This is a preset rather than a size-adaptive default. `adaptiveRegionCellSize`
 * (`@mizchi/vlmkit-core/heatmap.ts`) set the precedent for bucketing a default
 * by image size, and its reasoning — a continuous function shifts geometry on
 * nearly every existing image, and that geometry appears in baselines and
 * reports — applies here with more force, because component *rank* feeds
 * `page-compose-diff`'s top-N seats and the markup-verify calibrations keyed on
 * them. And the measured counter-example is concrete: on a real 480x240 card
 * render (`packages/vlmkit-heal/fixtures/.../dashboard-chromium-darwin.png`)
 * dropping minArea to 50 adds 4 components that are all glyph blobs of the word
 * "Dashboard" (areas 114-166 px) — indistinguishable by area from the 100-144 px
 * icons the HUD case needs found. Frame size alone cannot separate the two, so
 * the caller says which one they have.
 */
export const EXTRACT_PRESETS = {
  /** Low-resolution, high-contrast frames with many small elements. */
  "game-ui": { minArea: 24, topN: 24 },
} as const satisfies Record<string, Pick<ExtractComponentsOptions, "minArea"> & { topN: number }>;

export type ExtractPresetName = keyof typeof EXTRACT_PRESETS;

export function isExtractPresetName(name: string): name is ExtractPresetName {
  return Object.hasOwn(EXTRACT_PRESETS, name);
}

export const EXTRACT_PRESET_NAMES = Object.keys(EXTRACT_PRESETS) as ExtractPresetName[];

/** Floor for the adaptive tolerance — below this, antialiasing halos start
 * forming their own components on clean renders. */
const MIN_BG_TOLERANCE = 4;

export function detectBackground(data: Uint8Array, width: number, height: number): [number, number, number] {
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
  // Average the actual samples in the winning bin rather than returning
  // the bin floor: `(255,255,255) >> 3 << 3` = 248 would shift the
  // reference by up to 7/channel and let pale fills (e.g. #eef2ff on
  // white) fall inside the background tolerance.
  let sr = 0, sg = 0, sb = 0, sn = 0;
  for (const [r, g, b] of samples) {
    if (`${r >> 3},${g >> 3},${b >> 3}` === best) {
      sr += r; sg += g; sb += b; sn++;
    }
  }
  return [Math.round(sr / sn), Math.round(sg / sn), Math.round(sb / sn)];
}

function inBackground(
  r: number, g: number, b: number,
  bgR: number, bgG: number, bgB: number,
  tol: number,
): boolean {
  return Math.abs(r - bgR) <= tol && Math.abs(g - bgG) <= tol && Math.abs(b - bgB) <= tol;
}

/**
 * Pick the foreground tolerance from the image's own noise floor.
 *
 * A fixed tolerance of 12 was hiding a very ordinary UI surface: the
 * 2026-08-01 hard-target audit removed two `#f4f4f4` cards from a
 * `#ffffff` page — 2.12% of pixels genuinely different — and `verify
 * markup` reported `pixel diff 0.01%` / DONE, because 255-244 = 11 falls
 * *inside* 12, so the cards were never foreground to begin with. Most
 * light-surface tokens land there (#fafafa 5, #f5f5f5 10, #f4f4f4 11).
 *
 * The tolerance exists for real reasons — JPEG ringing and antialiasing
 * around a flat fill — so rather than lowering it blindly, measure how
 * noisy this image actually is. Deviations are sampled only from pixels
 * within a narrow band of the background: sensor/codec noise lives there,
 * while a flat pale fill (deviation ~11) sits outside the band and so
 * cannot inflate the estimate of itself.
 *
 * Clean PNG render -> median deviation 0 -> tolerance 4 (pale cards are
 * found). Noisy JPEG export -> higher median -> tolerance climbs back
 * toward the historical 12, which is also the cap: this can only make
 * extraction more sensitive than before, never less.
 */
export function adaptiveBgTolerance(
  data: Uint8Array,
  width: number,
  height: number,
  bg: [number, number, number],
): number {
  const [bgR, bgG, bgB] = bg;
  const BAND = 6; // above the noise we expect, below any real pale fill
  const devs: number[] = [];
  const step = Math.max(1, Math.floor(Math.sqrt((width * height) / 4000)));
  for (let y = 0; y < height; y += step) {
    for (let x = 0; x < width; x += step) {
      const i = (y * width + x) * 4;
      const dr = Math.abs(data[i]! - bgR);
      const dg = Math.abs(data[i + 1]! - bgG);
      const db = Math.abs(data[i + 2]! - bgB);
      const dev = Math.max(dr, dg, db);
      if (dev <= BAND) devs.push(dev);
    }
  }
  if (devs.length === 0) return DEFAULT_BG_TOLERANCE;
  devs.sort((a, b) => a - b);
  const median = devs[Math.floor(devs.length / 2)]!;
  return Math.min(DEFAULT_BG_TOLERANCE, Math.max(MIN_BG_TOLERANCE, MIN_BG_TOLERANCE + 3 * median));
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

  if (width <= 0 || height <= 0) return [];

  const [bgR, bgG, bgB] = options.background ?? detectBackground(data, width, height);
  // Derived from this image's noise unless the caller pins it (see
  // adaptiveBgTolerance: pale flat surfaces used to read as background).
  const tol = options.bgTolerance ?? adaptiveBgTolerance(data, width, height, [bgR, bgG, bgB]);

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

/**
 * Pair components by rank-after-sort-by-area. Returns matched pairs +
 * per-axis deltas. Designed for visual hierarchies that survive a
 * DOM rewrite: the largest component is "the card", the second
 * largest is "the button row", etc.
 */
export interface MatchComponentsOptions {
  /**
   * Maximum allowed area ratio for a same-rank pairing to be emitted.
   * If `max(b.area, v.area) / min(b.area, v.area)` exceeds this, the
   * pair is skipped — both rank positions are likely measuring
   * different things (e.g. the variant is missing the big card so its
   * rank-0 is just a button, paired against the target's rank-0 card).
   * Default 4 — accepts components that differ by up to 4× in area,
   * rejects wildly mismatched pairs. From Subagent G v2 dogfood:
   * "variant has only the button, target has the whole card → matcher
   * pairs them and reports nonsensical `Δ -329px` height".
   */
  maxAreaRatio?: number;
}

const DEFAULT_MAX_AREA_RATIO = 4;

export function matchComponents(
  baseline: ComponentBbox[],
  variant: ComponentBbox[],
  options: MatchComponentsOptions = {},
): MatchedBbox[] {
  const maxAreaRatio = options.maxAreaRatio ?? DEFAULT_MAX_AREA_RATIO;
  const n = Math.min(baseline.length, variant.length);
  const out: MatchedBbox[] = [];
  for (let i = 0; i < n; i++) {
    const b = baseline[i]!;
    const v = variant[i]!;
    // Skip the pairing if the area ratio is extreme. This avoids the
    // false-pair "variant has only the button, target has the whole
    // card" failure mode surfaced by subagent dogfood eval — the
    // resulting Δ values would mislead the agent more than help.
    const ratio = Math.max(b.area, v.area) / Math.max(1, Math.min(b.area, v.area));
    if (ratio > maxAreaRatio) continue;
    out.push({
      rank: i,
      baseline: b,
      variant: v,
      deltaTop: v.top - b.top,
      deltaLeft: v.left - b.left,
      deltaWidth: v.width - b.width,
      deltaHeight: v.height - b.height,
      iou: Number(iou(b, v).toFixed(3)),
    });
  }
  return out;
}
