/**
 * Thin TS wrapper over the MoonBit `focus-order-*` policy commands.
 */
import { callMarkupCoreJson, finiteOr, flag } from "./markup-core-runtime.ts";

export type FocusOrderTransition =
  | "trap"
  | "reverse-left"
  | "reverse-up"
  | "skip-row"
  /**
   * Focus jumped up, into a column to the right of where it came from — a multi-column footer
   * or nav tabbing down one column and on to the top of the next. Not a finding.
   *
   * Only distinguishable with the previous element's WIDTH, which is why it is a separate
   * transition rather than folded into `ok`: the report says how many steps were read this way,
   * so a reader can tell "no reverse findings" from "the reverses were column advances".
   */
  | "column-advance"
  | "ok";

export function classifyFocusOrderStep(input: {
  samePath: boolean;
  prev: { x: number; y: number; width?: number };
  cur: { x: number; y: number };
}): FocusOrderTransition {
  const out = callMarkupCoreJson<string>("focus-order-classify", {
    same_path: flag(input.samePath),
    previous: { x: finiteOr(input.prev.x), y: finiteOr(input.prev.y) },
    current: { x: finiteOr(input.cur.x), y: finiteOr(input.cur.y) },
    // Omitted rather than sent as 0 when the caller has no width: the MoonBit side treats
    // absent as "not measured" and keeps the pre-column verdict, so a caller that cannot
    // measure width is never silently given the new behavior.
    ...(input.prev.width !== undefined ? { previous_width: finiteOr(input.prev.width) } : {}),
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
    value === "column-advance" ||
    value === "ok"
  );
}

