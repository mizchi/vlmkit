/**
 * Landscape diff — coarse-grid baseline vs current comparison.
 *
 * Pixel sampling and hex formatting stay in TS (hot inner loop, no
 * benefit from crossing the FFI boundary for every channel). The
 * scoring formula, default grid geometry, threshold count, and top-N
 * ranking live in `markup-core` MoonBit. See
 * `markup-core/landscape_diff.mbt`.
 */
import { decodePng, type PngData } from "@mizchi/vlmkit-core/png-utils.ts";
import {
  computeLandscapeDefaultGrid,
  computeLandscapeDiffSummary,
  type LandscapeCellStat,
} from "./markup-core-landscape.ts";

export interface LandscapeDiffOptions {
  cols?: number;
  rows?: number;
  changedThreshold?: number;
  topN?: number;
}

export interface LandscapeCellStats {
  r: number;
  g: number;
  b: number;
  luma: number;
  ink: number;
  hex: string;
}

export interface LandscapeCellDiff {
  row: number;
  col: number;
  x: number;
  y: number;
  width: number;
  height: number;
  score: number;
  baseline: LandscapeCellStats;
  current: LandscapeCellStats;
}

export interface LandscapeDiffResult {
  width: number;
  height: number;
  grid: { cols: number; rows: number };
  score: number;
  similarity: number;
  changedCells: number;
  totalCells: number;
  topCells: LandscapeCellDiff[];
}

const DEFAULT_CHANGED_THRESHOLD = 0.08;
const DEFAULT_TOP_N = 8;

function clampByte(value: number): number {
  return Math.max(0, Math.min(255, Math.round(value)));
}

function toHex(r: number, g: number, b: number): string {
  const part = (n: number) => clampByte(n).toString(16).padStart(2, "0");
  return `#${part(r)}${part(g)}${part(b)}`;
}

function sampleCell(
  img: PngData,
  x0: number,
  y0: number,
  x1: number,
  y1: number,
): LandscapeCellStats {
  let r = 0;
  let g = 0;
  let b = 0;
  let luma = 0;
  let ink = 0;
  let count = 0;

  for (let y = y0; y < y1; y++) {
    for (let x = x0; x < x1; x++) {
      const i = (y * img.width + x) * 4;
      const pr = img.data[i]!;
      const pg = img.data[i + 1]!;
      const pb = img.data[i + 2]!;
      const pl = 0.299 * pr + 0.587 * pg + 0.114 * pb;
      r += pr;
      g += pg;
      b += pb;
      luma += pl;
      ink += Math.max(0, (245 - pl) / 245);
      count++;
    }
  }

  if (count === 0) {
    return { r: 0, g: 0, b: 0, luma: 0, ink: 0, hex: "#000000" };
  }

  const avgR = r / count;
  const avgG = g / count;
  const avgB = b / count;
  return {
    r: avgR,
    g: avgG,
    b: avgB,
    luma: luma / count,
    ink: ink / count,
    hex: toHex(avgR, avgG, avgB),
  };
}

export function compareLandscapeFromRgba(
  baseline: PngData,
  current: PngData,
  options: LandscapeDiffOptions = {},
): LandscapeDiffResult {
  const width = Math.min(baseline.width, current.width);
  const height = Math.min(baseline.height, current.height);
  const fallback = options.cols !== undefined && options.rows !== undefined
    ? { cols: options.cols, rows: options.rows }
    : computeLandscapeDefaultGrid(width, height);
  const cols = options.cols ?? fallback.cols;
  const rows = options.rows ?? fallback.rows;
  const changedThreshold = options.changedThreshold ?? DEFAULT_CHANGED_THRESHOLD;
  const topN = options.topN ?? DEFAULT_TOP_N;

  if (width <= 0 || height <= 0 || cols <= 0 || rows <= 0) {
    return {
      width: 0,
      height: 0,
      grid: { cols: 0, rows: 0 },
      score: 1,
      similarity: 0,
      changedCells: 0,
      totalCells: 0,
      topCells: [],
    };
  }

  const totalCells = rows * cols;
  const geometries: Array<{ x: number; y: number; w: number; h: number; row: number; col: number }> = new Array(totalCells);
  const baselineStats: LandscapeCellStats[] = new Array(totalCells);
  const currentStats: LandscapeCellStats[] = new Array(totalCells);
  const baselineBulk: LandscapeCellStat[] = new Array(totalCells);
  const currentBulk: LandscapeCellStat[] = new Array(totalCells);

  for (let row = 0; row < rows; row++) {
    const y0 = Math.floor(row * height / rows);
    const y1 = Math.floor((row + 1) * height / rows);
    for (let col = 0; col < cols; col++) {
      const x0 = Math.floor(col * width / cols);
      const x1 = Math.floor((col + 1) * width / cols);
      const idx = row * cols + col;
      const base = sampleCell(baseline, x0, y0, x1, y1);
      const curr = sampleCell(current, x0, y0, x1, y1);
      baselineStats[idx] = base;
      currentStats[idx] = curr;
      baselineBulk[idx] = { r: base.r, g: base.g, b: base.b, luma: base.luma, ink: base.ink };
      currentBulk[idx] = { r: curr.r, g: curr.g, b: curr.b, luma: curr.luma, ink: curr.ink };
      geometries[idx] = {
        x: x0,
        y: y0,
        w: Math.max(0, x1 - x0),
        h: Math.max(0, y1 - y0),
        row,
        col,
      };
    }
  }

  const summary = computeLandscapeDiffSummary({
    cols,
    rows,
    changedThreshold,
    topN,
    baseline: baselineBulk,
    current: currentBulk,
  });

  const topCells: LandscapeCellDiff[] = summary.topIndices.map(({ index, score }) => {
    const g = geometries[index]!;
    return {
      row: g.row,
      col: g.col,
      x: g.x,
      y: g.y,
      width: g.w,
      height: g.h,
      score,
      baseline: baselineStats[index]!,
      current: currentStats[index]!,
    };
  });

  return {
    width,
    height,
    grid: { cols, rows },
    score: summary.score,
    similarity: summary.similarity,
    changedCells: summary.changedCells,
    totalCells: summary.totalCells,
    topCells,
  };
}

export async function compareLandscapeFromPngFiles(
  baselinePath: string,
  currentPath: string,
  options: LandscapeDiffOptions = {},
): Promise<LandscapeDiffResult> {
  const [baseline, current] = await Promise.all([
    decodePng(baselinePath),
    decodePng(currentPath),
  ]);
  return compareLandscapeFromRgba(baseline, current, options);
}
