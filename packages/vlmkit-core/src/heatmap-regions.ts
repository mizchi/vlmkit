/**
 * Heatmap region clustering.
 *
 * `detectBandShifts` (see `heatmap.ts`) reports per-band Y-shifts —
 * useful for global translations but loses horizontal localization.
 * Subagent F wished for "heatmap region clustering": group connected
 * hot pixels in `*_heatmap.png` into clusters with rectangular
 * bounding boxes, so "a text run at y=420 shifted up 4px" becomes
 * one row instead of being smeared across a tall band.
 *
 * Reuses the connected-component algorithm from `component-bbox.ts`
 * — the input is just a different mask (foreground = "hot pixel").
 *
 * Pixelmatch heatmaps use a fixed palette: bright red for "diff
 * pixel", original (resized) baseline tinted for context. We treat
 * any pixel whose red channel is strongly elevated relative to the
 * other two channels as a hot pixel.
 */
import { PNG } from "pngjs";
import { readFile } from "node:fs/promises";

export interface HeatmapRegion {
  top: number;
  left: number;
  width: number;
  height: number;
  /** Hot-pixel count inside the bbox. */
  area: number;
  /**
   * Dominant color of the region as sampled from a *source* image
   * (the baseline / target PNG that the heatmap was generated against).
   * Only populated when `findHeatmapRegionsFromFile` was called with a
   * `sourceImagePath`. Lets the agent close the loop between
   * "this region differs" and "fill it with this color".
   */
  dominantColor?: { r: number; g: number; b: number; hex: string };
  /**
   * Content classification of the region inside the source image —
   * `text` / `filled-rect` / `icon` / `image` / `unknown`. Helps the
   * agent decide whether to paint a flat background, write a text
   * run, or place an icon. Only populated when callers run an
   * explicit annotation pass (see `annotateHeatmapRegionKinds` in
   * `@mizchi/vlmkit-markup/heatmap-region-kinds.ts`); the bare
   * `findHeatmapRegionsFromFile` no longer fills it in to keep
   * vlmkit-core free of MoonBit policy.
   */
  kind?: "text" | "filled-rect" | "icon" | "image" | "unknown";
  /** Classifier confidence ∈ [0, 1]. */
  kindConfidence?: number;
}

export interface FindHeatmapRegionsOptions {
  /** Minimum hot-pixel count for a region to be kept. Default 80. */
  minArea?: number;
  /** Cap on returned regions, sorted by area desc. Default 8. */
  topN?: number;
  /** Hot-pixel threshold: red − max(green, blue) >= this. Default 60. */
  redOverGreenBlue?: number;
  /**
   * Skip regions whose bbox covers ≥ this fraction of the image. When
   * baseline and variant are almost entirely different (e.g. blank
   * page vs full target), the CC pass produces one giant region
   * spanning 0,0 → W,H. That region is uninformative ("the whole
   * page differs" is already obvious from diff %) and wastes
   * iteration. Default 0.8 — drop regions covering ≥80% of the image.
   * From subagent dogfood eval.
   */
  maxRegionFraction?: number;
}

const DEFAULT_MIN_AREA = 80;
const DEFAULT_TOP_N = 8;
const DEFAULT_RED_OVER = 60;
const DEFAULT_MAX_REGION_FRACTION = 0.8;

function buildHotMask(
  data: Uint8Array,
  width: number,
  height: number,
  redOver: number,
): Uint8Array {
  const mask = new Uint8Array(width * height);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = (y * width + x) * 4;
      const r = data[idx]!, g = data[idx + 1]!, b = data[idx + 2]!;
      if (r - Math.max(g, b) >= redOver) {
        mask[y * width + x] = 1;
      }
    }
  }
  return mask;
}

function labelComponents(mask: Uint8Array, width: number, height: number): HeatmapRegion[] {
  const labels = new Int32Array(width * height);
  const parent: number[] = [0];
  const find = (x: number): number => {
    while (parent[x] !== x) {
      parent[x] = parent[parent[x]!]!;
      x = parent[x]!;
    }
    return x;
  };
  const union = (a: number, b: number): void => {
    const ra = find(a), rb = find(b);
    if (ra !== rb) parent[Math.max(ra, rb)] = Math.min(ra, rb);
  };
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
  type Stat = { minX: number; minY: number; maxX: number; maxY: number; area: number };
  const byRoot = new Map<number, Stat>();
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const l = labels[y * width + x];
      if (!l) continue;
      const root = find(l);
      let s = byRoot.get(root);
      if (!s) {
        s = { minX: x, minY: y, maxX: x, maxY: y, area: 0 };
        byRoot.set(root, s);
      }
      if (x < s.minX) s.minX = x;
      if (x > s.maxX) s.maxX = x;
      if (y < s.minY) s.minY = y;
      if (y > s.maxY) s.maxY = y;
      s.area++;
    }
  }
  const out: HeatmapRegion[] = [];
  for (const s of byRoot.values()) {
    out.push({
      top: s.minY,
      left: s.minX,
      width: s.maxX - s.minX + 1,
      height: s.maxY - s.minY + 1,
      area: s.area,
    });
  }
  return out;
}

export function findHeatmapRegionsFromRgba(
  data: Uint8Array,
  width: number,
  height: number,
  options: FindHeatmapRegionsOptions = {},
): HeatmapRegion[] {
  const minArea = options.minArea ?? DEFAULT_MIN_AREA;
  const topN = options.topN ?? DEFAULT_TOP_N;
  const redOver = options.redOverGreenBlue ?? DEFAULT_RED_OVER;
  const maxFraction = options.maxRegionFraction ?? DEFAULT_MAX_REGION_FRACTION;

  if (width <= 0 || height <= 0) return [];
  const mask = buildHotMask(data, width, height, redOver);
  const imageArea = width * height;
  return labelComponents(mask, width, height)
    .filter((r) => r.area >= minArea)
    .filter((r) => (r.width * r.height) / imageArea < maxFraction)
    .sort((a, b) => b.area - a.area)
    .slice(0, topN);
}

function toHex(r: number, g: number, b: number): string {
  const c = (n: number) => n.toString(16).padStart(2, "0");
  return `#${c(r)}${c(g)}${c(b)}`;
}

/** Sample the dominant color inside `region` from the source image data. */
function sampleRegionColor(
  sourceData: Uint8Array,
  sourceWidth: number,
  sourceHeight: number,
  region: HeatmapRegion,
): { r: number; g: number; b: number; hex: string } | undefined {
  // Sample on a 5×5 grid inside the region. Skip transparent pixels.
  // Use the median per-channel rather than mean — robust against
  // boundary pixels that might pick up surrounding bg color.
  const inset = 2;
  const x0 = Math.max(0, region.left + inset);
  const x1 = Math.min(sourceWidth, region.left + region.width - inset);
  const y0 = Math.max(0, region.top + inset);
  const y1 = Math.min(sourceHeight, region.top + region.height - inset);
  if (x1 <= x0 || y1 <= y0) return undefined;
  const stepX = Math.max(1, Math.floor((x1 - x0) / 5));
  const stepY = Math.max(1, Math.floor((y1 - y0) / 5));
  const rs: number[] = [], gs: number[] = [], bs: number[] = [];
  for (let y = y0; y < y1; y += stepY) {
    for (let x = x0; x < x1; x += stepX) {
      const i = (y * sourceWidth + x) * 4;
      if (sourceData[i + 3]! === 0) continue;
      rs.push(sourceData[i]!);
      gs.push(sourceData[i + 1]!);
      bs.push(sourceData[i + 2]!);
    }
  }
  if (rs.length === 0) return undefined;
  rs.sort((a, b) => a - b); gs.sort((a, b) => a - b); bs.sort((a, b) => a - b);
  const mid = rs.length >> 1;
  const r = rs[mid]!, g = gs[mid]!, b = bs[mid]!;
  return { r, g, b, hex: toHex(r, g, b) };
}

export async function findHeatmapRegionsFromFile(
  path: string,
  options: FindHeatmapRegionsOptions = {},
  sourceImagePath?: string,
): Promise<HeatmapRegion[]> {
  const buf = await readFile(path);
  const png = PNG.sync.read(buf);
  const regions = findHeatmapRegionsFromRgba(png.data, png.width, png.height, options);
  if (sourceImagePath) {
    try {
      const sourceBuf = await readFile(sourceImagePath);
      const sourcePng = PNG.sync.read(sourceBuf);
      for (const region of regions) {
        const color = sampleRegionColor(sourcePng.data, sourcePng.width, sourcePng.height, region);
        if (color) region.dominantColor = color;
      }
    } catch {
      // Source image unavailable — leave regions without annotations.
    }
  }
  return regions;
}
