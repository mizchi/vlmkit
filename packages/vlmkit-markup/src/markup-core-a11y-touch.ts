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

/** One target as the policy reads it. `display` and `inSentence` feed the Inline exception. */
export interface TouchPolicyTarget {
  rect: { x: number; y: number; width: number; height: number };
  display: string;
  inSentence: boolean;
}

export interface TouchPolicyVerdict {
  targetPosition: number;
  minSide: number;
  undersized: boolean;
  /** `""`, `"inline"` or `"spacing"` — the criterion's own exception, when one applies. */
  exception: string;
  clustered: boolean;
}

export interface TouchPolicyResult {
  required: number;
  verdicts: TouchPolicyVerdict[];
}

/**
 * The whole page's touch verdicts in ONE boundary crossing.
 *
 * Replaces a per-pair `touchTargetInCluster` loop, which was O(n²) crossings and memoized
 * O(n²) cache entries for a page of n targets — 400 targets is the sampler's cap, so
 * 160,000 of each. The spacing exception needs every target's geometry anyway, so passing
 * the page once is both faster and the only shape in which the exception is expressible.
 */
export function touchPolicy(
  level: WcagTouchLevel,
  targets: readonly TouchPolicyTarget[],
): TouchPolicyResult {
  // `cache: false` equivalent — this payload is the whole page and memoizing it would
  // retain every page ever measured in a long-lived process.
  const out = callMarkupCoreJson<{
    required: number;
    verdicts: { target_position: number; min_side: number; undersized: boolean; exception: string; clustered: boolean }[];
  }>("touch-policy", {
    level,
    targets: targets.map((t) => ({
      rect: {
        x: finiteOr(t.rect.x),
        y: finiteOr(t.rect.y),
        width: finiteOr(t.rect.width),
        height: finiteOr(t.rect.height),
      },
      display: t.display,
      in_sentence: t.inSentence,
    })),
  });
  return {
    required: out.required,
    verdicts: out.verdicts.map((v) => ({
      targetPosition: v.target_position,
      minSide: v.min_side,
      undersized: v.undersized,
      exception: v.exception,
      clustered: v.clustered,
    })),
  };
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
