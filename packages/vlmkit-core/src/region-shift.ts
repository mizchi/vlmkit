/**
 * Per-region translation detection.
 *
 * Both A/B validation runs (2026-06-05 / 06-06) showed agents
 * misreading position shifts as color changes: the diff region for a
 * moved element samples near-identical colors on both sides
 * ("#ffffff -> #ffffff") and the semantic classifier falls back to
 * `element-added`. This module estimates whether a diff region is
 * better explained by a translation, using mean-subtracted normalized
 * cross-correlation of luminance profiles per axis — the same idea as
 * `detectBandShifts`, applied to a single region.
 */
import type { PngData } from "./png-utils.ts";

export interface RegionShiftEstimate {
  /** Content moved by +dx px horizontally in current (vs baseline). */
  dx: number;
  /** Content moved by +dy px vertically in current (vs baseline). */
  dy: number;
  /** 0..1; correlation peak strength of the dominant axis. */
  confidence: number;
}

interface RegionRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

const MIN_REGION_EDGE = 8;
const MIN_PEAK = 0.6;
/** The shifted-lag peak must beat the zero-lag correlation by this much. */
const MIN_PEAK_ADVANTAGE = 0.15;

export function estimateRegionShift(
  baseline: PngData,
  current: PngData,
  region: RegionRect,
  maxOffset = 64,
): RegionShiftEstimate | null {
  if (region.width < MIN_REGION_EDGE || region.height < MIN_REGION_EDGE) return null;
  const width = Math.min(baseline.width, current.width);
  const height = Math.min(baseline.height, current.height);

  const x0 = clamp(region.x - maxOffset, 0, width);
  const x1 = clamp(region.x + region.width + maxOffset, 0, width);
  const y0 = clamp(region.y, 0, height);
  const y1 = clamp(region.y + region.height, 0, height);
  const yw0 = clamp(region.y - maxOffset, 0, height);
  const yw1 = clamp(region.y + region.height + maxOffset, 0, height);
  const xr0 = clamp(region.x, 0, width);
  const xr1 = clamp(region.x + region.width, 0, width);
  if (x1 <= x0 || y1 <= y0 || yw1 <= yw0 || xr1 <= xr0) return null;

  const horizontal = bestLag(
    columnProfile(baseline, x0, x1, y0, y1),
    columnProfile(current, x0, x1, y0, y1),
    maxOffset,
  );
  const vertical = bestLag(
    rowProfile(baseline, xr0, xr1, yw0, yw1),
    rowProfile(current, xr0, xr1, yw0, yw1),
    maxOffset,
  );

  const dx = acceptAxis(horizontal) ? horizontal.lag : 0;
  const dy = acceptAxis(vertical) ? vertical.lag : 0;
  if (dx === 0 && dy === 0) return null;

  const confidences: number[] = [];
  if (dx !== 0) confidences.push(horizontal.peak);
  if (dy !== 0) confidences.push(vertical.peak);
  return {
    dx,
    dy,
    confidence: Number(Math.max(...confidences).toFixed(3)),
  };
}

interface LagResult {
  lag: number;
  peak: number;
  zeroLag: number;
  flat: boolean;
}

function acceptAxis(result: LagResult): boolean {
  return !result.flat
    && result.lag !== 0
    && result.peak >= MIN_PEAK
    && result.peak - result.zeroLag >= MIN_PEAK_ADVANTAGE;
}

/**
 * Find the lag maximizing normalized cross-correlation between two
 * mean-subtracted profiles. Positive lag = current content sits at a
 * higher coordinate than baseline (moved right / down).
 */
function bestLag(base: Float64Array, curr: Float64Array, maxOffset: number): LagResult {
  const a = meanSubtract(base);
  const b = meanSubtract(curr);
  if (a.flat || b.flat) return { lag: 0, peak: 0, zeroLag: 0, flat: true };

  let bestLag = 0;
  let bestVal = -Infinity;
  let zeroVal = 0;
  const n = Math.min(a.values.length, b.values.length);
  const limit = Math.min(maxOffset, n - 1);
  for (let lag = -limit; lag <= limit; lag++) {
    let dot = 0;
    let normA = 0;
    let normB = 0;
    for (let i = 0; i < n; i++) {
      const j = i + lag;
      if (j < 0 || j >= n) continue;
      dot += a.values[i]! * b.values[j]!;
      normA += a.values[i]! * a.values[i]!;
      normB += b.values[j]! * b.values[j]!;
    }
    if (normA === 0 || normB === 0) continue;
    const val = dot / Math.sqrt(normA * normB);
    if (lag === 0) zeroVal = val;
    if (val > bestVal) {
      bestVal = val;
      bestLag = lag;
    }
  }
  if (!Number.isFinite(bestVal)) return { lag: 0, peak: 0, zeroLag: 0, flat: true };
  return { lag: bestLag, peak: bestVal, zeroLag: zeroVal, flat: false };
}

function meanSubtract(profile: Float64Array): { values: Float64Array; flat: boolean } {
  let sum = 0;
  for (const v of profile) sum += v;
  const mean = sum / profile.length;
  const values = new Float64Array(profile.length);
  let variance = 0;
  for (let i = 0; i < profile.length; i++) {
    values[i] = profile[i]! - mean;
    variance += values[i]! * values[i]!;
  }
  return { values, flat: variance / profile.length < 1 };
}

function columnProfile(img: PngData, x0: number, x1: number, y0: number, y1: number): Float64Array {
  const profile = new Float64Array(x1 - x0);
  for (let x = x0; x < x1; x++) {
    let sum = 0;
    for (let y = y0; y < y1; y++) sum += lumaAt(img, x, y);
    profile[x - x0] = sum / (y1 - y0);
  }
  return profile;
}

function rowProfile(img: PngData, x0: number, x1: number, y0: number, y1: number): Float64Array {
  const profile = new Float64Array(y1 - y0);
  for (let y = y0; y < y1; y++) {
    let sum = 0;
    for (let x = x0; x < x1; x++) sum += lumaAt(img, x, y);
    profile[y - y0] = sum / (x1 - x0);
  }
  return profile;
}

function lumaAt(img: PngData, x: number, y: number): number {
  const i = (y * img.width + x) * 4;
  return 0.299 * img.data[i]! + 0.587 * img.data[i + 1]! + 0.114 * img.data[i + 2]!;
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}
