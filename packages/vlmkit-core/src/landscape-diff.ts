import { decodePng, type PngData } from "./png-utils.ts";

export interface LandscapeDiffOptions {
  cols?: number;
  rows?: number;
  changedThreshold?: number;
  topN?: number;
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

export interface LandscapeCellStats {
  r: number;
  g: number;
  b: number;
  luma: number;
  ink: number;
  hex: string;
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

function defaultGrid(width: number, height: number): { cols: number; rows: number } {
  const longSide = 16;
  if (width >= height) {
    return {
      cols: longSide,
      rows: Math.max(8, Math.round(longSide * height / width)),
    };
  }
  return {
    cols: Math.max(8, Math.round(longSide * width / height)),
    rows: longSide,
  };
}

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
      // A soft "ink density" channel: near-white backgrounds contribute
      // almost nothing; dark text and large dark blocks contribute more.
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

function cellScore(a: LandscapeCellStats, b: LandscapeCellStats): number {
  const dr = (a.r - b.r) / 255;
  const dg = (a.g - b.g) / 255;
  const db = (a.b - b.b) / 255;
  const dl = (a.luma - b.luma) / 255;
  const di = a.ink - b.ink;
  return Math.min(1, Math.sqrt((dr * dr + dg * dg + db * db + dl * dl + di * di) / 5));
}

export function compareLandscapeFromRgba(
  baseline: PngData,
  current: PngData,
  options: LandscapeDiffOptions = {},
): LandscapeDiffResult {
  const width = Math.min(baseline.width, current.width);
  const height = Math.min(baseline.height, current.height);
  const fallback = defaultGrid(width, height);
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

  const cells: LandscapeCellDiff[] = [];
  let sum = 0;
  let changedCells = 0;

  for (let row = 0; row < rows; row++) {
    const y0 = Math.floor(row * height / rows);
    const y1 = Math.floor((row + 1) * height / rows);
    for (let col = 0; col < cols; col++) {
      const x0 = Math.floor(col * width / cols);
      const x1 = Math.floor((col + 1) * width / cols);
      const base = sampleCell(baseline, x0, y0, x1, y1);
      const curr = sampleCell(current, x0, y0, x1, y1);
      const score = cellScore(base, curr);
      sum += score;
      if (score >= changedThreshold) changedCells++;
      cells.push({
        row,
        col,
        x: x0,
        y: y0,
        width: Math.max(0, x1 - x0),
        height: Math.max(0, y1 - y0),
        score,
        baseline: base,
        current: curr,
      });
    }
  }

  const totalCells = rows * cols;
  const score = totalCells === 0 ? 1 : sum / totalCells;
  return {
    width,
    height,
    grid: { cols, rows },
    score,
    similarity: Math.max(0, 1 - score),
    changedCells,
    totalCells,
    topCells: cells.sort((a, b) => b.score - a.score).slice(0, topN),
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
