/**
 * Thin TS wrapper over the MoonBit `quality-*` policy commands.
 */
import { callMarkupCoreJson, finiteOr, intOr, runMarkupCore } from "./markup-core-runtime.ts";

export type QualityErrorStateKind = "error" | "warning" | "none";

export function computeQualityErrorStateKind(
  redRatio: number,
  yellowRatio: number,
): QualityErrorStateKind {
  const out = callMarkupCoreJson<string>("quality-error-state-kind", {
    red_ratio: finiteOr(redRatio),
    yellow_ratio: finiteOr(yellowRatio),
  });
  if (out === "error" || out === "warning" || out === "none") return out;
  throw new Error(`markup-core quality-error-state-kind unexpected: ${out}`);
}

export function computeQualityCoveragePassed(covered: number, total: number): boolean {
  return callMarkupCoreJson<boolean>("quality-coverage-passed", {
    covered: intOr(covered),
    total: intOr(total),
  });
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

