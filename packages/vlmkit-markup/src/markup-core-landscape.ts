/**
 * Thin TS wrapper over the MoonBit `landscape-*` commands exposed by
 * `markup-core-api` / `markup-core-cli`. Pixel sampling stays on the TS
 * side (Uint8Array iteration would be too slow over the string-based
 * MoonBit ABI); MoonBit owns the cell-score formula, default grid
 * geometry, threshold counting, and top-N ranking.
 */
import { runMarkupCore } from "./markup-core-runtime.ts";

export interface LandscapeGrid {
  cols: number;
  rows: number;
}

export interface LandscapeCellStat {
  r: number;
  g: number;
  b: number;
  luma: number;
  ink: number;
}

export interface LandscapeDiffSummaryInput {
  cols: number;
  rows: number;
  changedThreshold: number;
  topN: number;
  baseline: LandscapeCellStat[];
  current: LandscapeCellStat[];
}

export interface LandscapeDiffSummaryEntry {
  index: number;
  score: number;
}

export interface LandscapeDiffSummary {
  score: number;
  similarity: number;
  changedCells: number;
  totalCells: number;
  topIndices: LandscapeDiffSummaryEntry[];
}

const STAT_SEPARATOR = "|";
const FIELD_SEPARATOR = ",";

export function computeLandscapeDefaultGrid(width: number, height: number): LandscapeGrid {
  const out = runMarkupCore([
    "landscape-default-grid",
    intArg(width),
    intArg(height),
  ]);
  const [cols, rows] = out.split("|");
  const c = Number(cols);
  const r = Number(rows);
  if (!Number.isInteger(c) || !Number.isInteger(r)) {
    throw new Error(`markup-core landscape-default-grid returned unparseable output: ${out}`);
  }
  return { cols: c, rows: r };
}

export function computeLandscapeClampByte(value: number): number {
  const out = runMarkupCore([
    "landscape-clamp-byte",
    doubleArg(value),
  ]);
  const parsed = Number(out);
  if (!Number.isInteger(parsed)) {
    throw new Error(`markup-core landscape-clamp-byte returned non-integer: ${out}`);
  }
  return parsed;
}

export function computeLandscapeCellScore(baseline: LandscapeCellStat, current: LandscapeCellStat): number {
  const out = runMarkupCore([
    "landscape-cell-score",
    doubleArg(baseline.r),
    doubleArg(baseline.g),
    doubleArg(baseline.b),
    doubleArg(baseline.luma),
    doubleArg(baseline.ink),
    doubleArg(current.r),
    doubleArg(current.g),
    doubleArg(current.b),
    doubleArg(current.luma),
    doubleArg(current.ink),
  ]);
  const parsed = Number(out);
  if (!Number.isFinite(parsed)) {
    throw new Error(`markup-core landscape-cell-score returned non-finite: ${out}`);
  }
  return parsed;
}

export function computeLandscapeCellHex(r: number, g: number, b: number): string {
  return runMarkupCore([
    "landscape-cell-hex",
    doubleArg(r),
    doubleArg(g),
    doubleArg(b),
  ]);
}

export function computeLandscapeDiffSummary(input: LandscapeDiffSummaryInput): LandscapeDiffSummary {
  const total = input.rows * input.cols;
  if (total <= 0) {
    return { score: 1, similarity: 0, changedCells: 0, totalCells: 0, topIndices: [] };
  }
  if (input.baseline.length !== total || input.current.length !== total) {
    throw new Error(
      `markup-core landscape-diff-summary expected ${total} cells, got baseline=${input.baseline.length}, current=${input.current.length}`,
    );
  }
  const out = runMarkupCore(
    [
      "landscape-diff-summary",
      intArg(input.cols),
      intArg(input.rows),
      doubleArg(input.changedThreshold),
      intArg(input.topN),
      encodeStats(input.baseline),
      encodeStats(input.current),
    ],
    { cache: false },
  );
  return parseSummary(out, total);
}

function parseSummary(raw: string, expectedTotal: number): LandscapeDiffSummary {
  const parts = raw.split("|");
  if (parts[0] === "mismatch") {
    throw new Error(`markup-core landscape-diff-summary length mismatch: ${raw}`);
  }
  if (parts.length < 4) {
    throw new Error(`markup-core landscape-diff-summary malformed output: ${raw}`);
  }
  const [scoreStr, similarityStr, changedStr, totalStr, ...rest] = parts;
  const score = Number(scoreStr);
  const similarity = Number(similarityStr);
  const changedCells = Number(changedStr);
  const totalCells = Number(totalStr);
  if (![score, similarity, changedCells, totalCells].every(Number.isFinite)) {
    throw new Error(`markup-core landscape-diff-summary non-finite scalars: ${raw}`);
  }
  if (totalCells !== expectedTotal) {
    throw new Error(
      `markup-core landscape-diff-summary total mismatch: expected=${expectedTotal}, got=${totalCells}`,
    );
  }
  const topIndices: LandscapeDiffSummaryEntry[] = [];
  for (const entry of rest) {
    if (!entry) continue;
    const sep = entry.indexOf(":");
    if (sep < 0) {
      throw new Error(`markup-core landscape-diff-summary malformed top entry: ${entry}`);
    }
    const idx = Number(entry.slice(0, sep));
    const s = Number(entry.slice(sep + 1));
    if (!Number.isInteger(idx) || !Number.isFinite(s)) {
      throw new Error(`markup-core landscape-diff-summary unparseable top entry: ${entry}`);
    }
    topIndices.push({ index: idx, score: s });
  }
  return { score, similarity, changedCells, totalCells, topIndices };
}

function encodeStats(stats: LandscapeCellStat[]): string {
  const out: string[] = [];
  for (const cell of stats) {
    out.push(
      [
        doubleArg(cell.r),
        doubleArg(cell.g),
        doubleArg(cell.b),
        doubleArg(cell.luma),
        doubleArg(cell.ink),
      ].join(FIELD_SEPARATOR),
    );
  }
  return out.join(STAT_SEPARATOR);
}

function doubleArg(value: number): string {
  return String(Number.isFinite(value) ? value : 0);
}

function intArg(value: number | undefined): string {
  return typeof value === "number" && Number.isFinite(value)
    ? String(Math.trunc(value))
    : "0";
}
