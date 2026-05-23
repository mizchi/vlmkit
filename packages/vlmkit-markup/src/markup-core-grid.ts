/**
 * Thin TS wrapper over the MoonBit `grid-*` commands.
 * Used by `landscape-diff`'s neighbour `grid-ratio.ts`.
 */
import { runMarkupCore } from "./markup-core-runtime.ts";

export function computeGridGcd(a: number, b: number): number {
  const out = runMarkupCore(["grid-gcd", intArg(a), intArg(b)]);
  const parsed = Number(out);
  if (!Number.isInteger(parsed)) {
    throw new Error(`markup-core grid-gcd returned non-integer: ${out}`);
  }
  return parsed;
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
  const out = runMarkupCore([
    "grid-arrays-close",
    encodeWidths(a),
    encodeWidths(b),
    doubleArg(tolerance),
  ]);
  return parseBool("grid-arrays-close", out);
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
