/**
 * Thin TS wrapper over the MoonBit `focus-order-*` policy commands.
 */
import { callMarkupCoreJson, finiteOr, flag } from "./markup-core-runtime.ts";

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
  const out = callMarkupCoreJson<string>("focus-order-classify", {
    same_path: flag(input.samePath),
    previous: { x: finiteOr(input.prev.x), y: finiteOr(input.prev.y) },
    current: { x: finiteOr(input.cur.x), y: finiteOr(input.cur.y) },
  });
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

