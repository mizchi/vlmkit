/**
 * Thin TS wrapper over the MoonBit `quality-*` policy commands.
 */
import { runMarkupCore } from "./markup-core-runtime.ts";

export type QualityErrorStateKind = "error" | "warning" | "none";

export function computeQualityErrorStateKind(
  redRatio: number,
  yellowRatio: number,
): QualityErrorStateKind {
  const out = runMarkupCore([
    "quality-error-state-kind",
    doubleArg(redRatio),
    doubleArg(yellowRatio),
  ]);
  if (out === "error" || out === "warning" || out === "none") return out;
  throw new Error(`markup-core quality-error-state-kind unexpected: ${out}`);
}

export function computeQualityCoveragePassed(covered: number, total: number): boolean {
  const out = runMarkupCore([
    "quality-coverage-passed",
    intArg(covered),
    intArg(total),
  ]);
  if (out === "true") return true;
  if (out === "false") return false;
  throw new Error(`markup-core quality-coverage-passed unexpected: ${out}`);
}

export type QualityDiffSeverity = "large" | "small";

export function computeQualityDiffSeverity(diffRatio: number): QualityDiffSeverity {
  const out = runMarkupCore([
    "quality-diff-severity",
    doubleArg(diffRatio),
  ]);
  if (out === "large" || out === "small") return out;
  throw new Error(`markup-core quality-diff-severity unexpected: ${out}`);
}

function doubleArg(value: number): string {
  return String(Number.isFinite(value) ? value : 0);
}

function intArg(value: number): string {
  return String(Number.isFinite(value) ? Math.trunc(value) : 0);
}
