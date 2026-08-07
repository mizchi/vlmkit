/**
 * Thin TS wrapper over the MoonBit `landscape-*` commands exposed by
 * `markup-core-api` / `markup-core-cli`. Pixel sampling stays on the TS
 * side (Uint8Array iteration would be too slow over the string-based
 * MoonBit ABI); MoonBit owns the cell-score formula, default grid
 * geometry, threshold counting, and top-N ranking.
 */
import { callMarkupCoreJson, finiteOr, intOr, runMarkupCore } from "./markup-core-runtime.ts";

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

/**
 * One cell, as a record.
 *
 * This replaced `"r,g,b,luma,ink"` joined by "," inside a list joined by "|" inside a
 * tab-delimited argument — five positional fields, two nested delimiters, and a
 * hand-written `idx == 0 / 1 / 2 / 3 / 4` parser on the MoonBit side. No cell value
 * could contain a comma or a pipe, and nothing enforced that at any level.
 */
function cellPayload(cell: LandscapeCellStat): { r: number; g: number; b: number; l: number; ink: number } {
  return {
    r: finiteOr(cell.r),
    g: finiteOr(cell.g),
    b: finiteOr(cell.b),
    // `luma` here, `l` across the boundary — the MoonBit rule's field name. Spelled out
    // once, in the one place that knows both.
    l: finiteOr(cell.luma),
    ink: finiteOr(cell.ink),
  };
}

export function computeLandscapeDefaultGrid(width: number, height: number): LandscapeGrid {
  // `"cols|rows"` was two integers in a string. MoonBit types them, so the split and
  // the two `Number.isInteger` re-checks are gone.
  return callMarkupCoreJson<LandscapeGrid>("landscape-default-grid", {
    width: intOr(width),
    height: intOr(height),
  });
}

export function computeLandscapeClampByte(value: number): number {
  // Still positional, deliberately: one argument of one type, so there is no wiring
  // bug available to make and a struct would buy nothing.
  const out = runMarkupCore([
    "landscape-clamp-byte",
    String(finiteOr(value)),
  ]);
  const parsed = Number(out);
  if (!Number.isInteger(parsed)) {
    throw new Error(`markup-core landscape-clamp-byte returned non-integer: ${out}`);
  }
  return parsed;
}

export function computeLandscapeCellScore(baseline: LandscapeCellStat, current: LandscapeCellStat): number {
  // Ten mutually swappable Doubles were two five-field samples. Nesting removes the
  // entire class of mistake — this was the worst case in the batch by that measure.
  return callMarkupCoreJson<number>("landscape-cell-score", {
    baseline: cellPayload(baseline),
    current: cellPayload(current),
  });
}

export function computeLandscapeCellHex(r: number, g: number, b: number): string {
  return callMarkupCoreJson<string>("landscape-cell-hex", {
    r: finiteOr(r),
    g: finiteOr(g),
    b: finiteOr(b),
  });
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
  const summary = callMarkupCoreJson<{
    mean: number;
    similarity: number;
    changed: number;
    total: number;
    top: { index: number; score: number }[];
  }>("landscape-diff-summary", {
    cols: intOr(input.cols),
    rows: intOr(input.rows),
    changed_threshold: finiteOr(input.changedThreshold),
    top_n: intOr(input.topN),
    baseline: input.baseline.map(cellPayload),
    current: input.current.map(cellPayload),
  });
  // `parseSummary` was 36 lines and six distinct throw sites — a `|` split, four
  // `Number()` coercions, a total-count cross-check, then a second split on ":" per top
  // entry with two more validity checks. MoonBit typed all of it; none of it survives.
  // A cell-count mismatch now raises from the handler and names the counts, instead of
  // arriving as a `"mismatch|…"` string in the same shape as a successful result.
  return {
    score: summary.mean,
    similarity: summary.similarity,
    changedCells: summary.changed,
    totalCells: summary.total,
    topIndices: summary.top,
  };
}

