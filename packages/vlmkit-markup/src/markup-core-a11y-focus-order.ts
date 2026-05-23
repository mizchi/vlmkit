/**
 * Thin TS wrapper over the MoonBit `focus-order-*` policy commands.
 */
import { runMarkupCore } from "./markup-core-runtime.ts";

export type FocusOrderTransition =
  | "trap"
  | "reverse-left"
  | "reverse-up"
  | "skip-row"
  | "ok";

export function classifyFocusOrderStep(input: {
  samePath: boolean;
  prev: { x: number; y: number };
  cur: { x: number; y: number };
}): FocusOrderTransition {
  const out = runMarkupCore([
    "focus-order-classify",
    input.samePath ? "true" : "false",
    doubleArg(input.prev.x),
    doubleArg(input.prev.y),
    doubleArg(input.cur.x),
    doubleArg(input.cur.y),
  ]);
  if (isFocusOrderTransition(out)) return out;
  throw new Error(`markup-core focus-order-classify unexpected: ${out}`);
}

function isFocusOrderTransition(value: string): value is FocusOrderTransition {
  return (
    value === "trap" ||
    value === "reverse-left" ||
    value === "reverse-up" ||
    value === "skip-row" ||
    value === "ok"
  );
}

function doubleArg(value: number): string {
  return String(Number.isFinite(value) ? value : 0);
}
