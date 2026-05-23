/**
 * Authored-style diff. Same shape as `computed-style-diff` (a snapshot is
 * `Record<scopedSelector, Record<property, value>>` in both cases), so the
 * heavy lifting reuses `diffComputedStyles` — only the snapshot type
 * label differs.
 */
import { diffComputedStyles, aggregateCsdByViewport } from "./computed-style-diff.ts";
import type {
  CsdEntry,
  CsdResult,
  CsdPerViewportResult,
  CsdPerViewportEntry,
} from "./computed-style-diff.ts";
import type { AuthoredStyleSnapshot } from "./authored-style-capture.ts";

export type AuthoredStyleEntry = CsdEntry;
export type AuthoredStyleDiffResult = CsdResult;
export type AuthoredStylePerViewportEntry = CsdPerViewportEntry;
export type AuthoredStylePerViewportResult = CsdPerViewportResult;

export function diffAuthoredStyles(
  baseline: AuthoredStyleSnapshot,
  variant: AuthoredStyleSnapshot,
): AuthoredStyleDiffResult {
  return diffComputedStyles(baseline, variant);
}

export function aggregateAuthoredStyleByViewport(
  perViewport: ReadonlyArray<{ viewport: string; result: AuthoredStyleDiffResult }>,
): AuthoredStylePerViewportResult {
  return aggregateCsdByViewport(perViewport);
}
