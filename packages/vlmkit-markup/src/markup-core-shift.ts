/**
 * Thin TS wrapper over the MoonBit `shift-*` policy commands.
 */
import { runMarkupCore } from "./markup-core-runtime.ts";

export function computeShiftRoundDelta(value: number): number {
  const out = runMarkupCore(["shift-round-delta", doubleArg(value)]);
  const parsed = Number(out);
  if (!Number.isFinite(parsed)) {
    throw new Error(`markup-core shift-round-delta returned non-finite: ${out}`);
  }
  return parsed;
}

export type ShiftSuspectedAxis = "height" | "margin/padding-above" | "y-position";

export function computeShiftClassifySuspect(
  absHeightDelta: number,
  absTopDelta: number,
): ShiftSuspectedAxis {
  const out = runMarkupCore([
    "shift-classify-suspect",
    doubleArg(absHeightDelta),
    doubleArg(absTopDelta),
  ]);
  if (out === "height" || out === "margin/padding-above" || out === "y-position") {
    return out;
  }
  throw new Error(`markup-core shift-classify-suspect returned unknown axis: ${out}`);
}

function doubleArg(value: number): string {
  return String(Number.isFinite(value) ? value : 0);
}
