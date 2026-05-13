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
}

export interface FindHeatmapRegionsOptions {
  /** Minimum hot-pixel count for a region to be kept. Default 80. */
  minArea?: number;
  /** Cap on returned regions, sorted by area desc. Default 8. */
  topN?: number;
  /** Hot-pixel threshold: red − max(green, blue) >= this. Default 60. */
  redOverGreenBlue?: number;
}

const DEFAULT_MIN_AREA = 80;
const DEFAULT_TOP_N = 8;
const DEFAULT_RED_OVER = 60;

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

  if (width <= 0 || height <= 0) return [];
  const mask = buildHotMask(data, width, height, redOver);
  return labelComponents(mask, width, height)
    .filter((r) => r.area >= minArea)
    .sort((a, b) => b.area - a.area)
    .slice(0, topN);
}

export async function findHeatmapRegionsFromFile(
  path: string,
  options: FindHeatmapRegionsOptions = {},
): Promise<HeatmapRegion[]> {
  const buf = await readFile(path);
  const png = PNG.sync.read(buf);
  return findHeatmapRegionsFromRgba(png.data, png.width, png.height, options);
}
