/**
 * Thin TS wrapper over the MoonBit `a11y-touch-*` policy commands.
 */
import { callMarkupCoreJson, finiteOr, runMarkupCore } from "./markup-core-runtime.ts";

export type WcagTouchLevel = "AAA" | "AA";

export function requiredTouchSide(level: WcagTouchLevel): number {
  const out = runMarkupCore(["a11y-touch-required-side", level]);
  const parsed = Number(out);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    throw new Error(`markup-core a11y-touch-required-side unexpected: ${out}`);
  }
  return parsed;
}

export function touchTargetBelowRequired(minSide: number, level: WcagTouchLevel): boolean {
  const out = runMarkupCore(["a11y-touch-below-required", doubleArg(minSide), level]);
  if (out === "true") return true;
  if (out === "false") return false;
  throw new Error(`markup-core a11y-touch-below-required unexpected: ${out}`);
}

export function touchTargetInCluster(a: { x: number; y: number }, b: { x: number; y: number }): boolean {
  // Two named points. `ax ay bx by` as four positional Doubles has 12 wrong
  // orderings that all parse and most of which still return a plausible answer.
  const out = callMarkupCoreJson<string>("touch-in-cluster", {
    a: { x: finiteOr(a.x), y: finiteOr(a.y) },
    b: { x: finiteOr(b.x), y: finiteOr(b.y) },
  });
  if (out === "true") return true;
  if (out === "false") return false;
  throw new Error(`markup-core touch-in-cluster unexpected: ${out}`);
}

function doubleArg(value: number): string {
  return String(Number.isFinite(value) ? value : 0);
}
