/**
 * Thin TS wrapper over the MoonBit `grid-*` commands.
 * Used by `landscape-diff`'s neighbour `grid-ratio.ts`.
 */
import { callMarkupCoreJson, finiteOr, intOr, runMarkupCore } from "./markup-core-runtime.ts";

export function computeGridGcd(a: number, b: number): number {
  // MoonBit returns an `Int`, so there is nothing to parse or re-check.
  return callMarkupCoreJson<number>("grid-gcd", { a: intOr(a), b: intOr(b) });
}

export function computeGridAllEqual(widths: number[], tolerance: number): boolean {
  const out = runMarkupCore([
    "grid-all-equal",
    encodeWidths(widths),
    doubleArg(tolerance),
  ]);
  return parseBool("grid-all-equal", out);
}

export function computeGridArraysClose(a: number[], b: number[], tolerance: number): boolean {
  // Numbers, not CSV. The comma-joined form could not carry a value containing a
  // comma, needed a parser on the MoonBit side, and made "different lengths" —
  // which the rule treats as not-close — look like a malformed string.
  return callMarkupCoreJson<boolean>("grid-arrays-close", {
    a: a.map((value) => finiteOr(value)),
    b: b.map((value) => finiteOr(value)),
    tolerance: finiteOr(tolerance),
  });
}

export function computeGridRatiosToDecimal(widths: number[]): string {
  return runMarkupCore([
    "grid-ratios-to-decimal",
    encodeWidths(widths),
  ]);
}

export function computeGridApproximateIntegerFr(widths: number[], maxDenom: number): string {
  return runMarkupCore([
    "grid-approximate-integer-fr",
    encodeWidths(widths),
    intArg(maxDenom),
  ]);
}

function encodeWidths(widths: number[]): string {
  return widths.map(doubleArg).join(",");
}

function doubleArg(value: number): string {
  return String(Number.isFinite(value) ? value : 0);
}

function intArg(value: number): string {
  return String(Number.isFinite(value) ? Math.trunc(value) : 0);
}

function parseBool(command: string, raw: string): boolean {
  if (raw === "true") return true;
  if (raw === "false") return false;
  throw new Error(`markup-core ${command} returned non-bool: ${raw}`);
}
