/**
 * Thin TS wrapper over the MoonBit `a11y-contrast-*` policy commands.
 */
import { callMarkupCoreJson, finiteOr, intOr } from "./markup-core-runtime.ts";

export type WcagContrastLevel = "AAA" | "AA" | "AA-large" | "fail";

export interface A11yContrastEvaluation {
  ratio: number;
  requiredAA: number;
  level: WcagContrastLevel;
}

export function evaluateA11yContrast(input: {
  foreground: { r: number; g: number; b: number };
  background: { r: number; g: number; b: number };
  fontSize: number;
  fontWeight: number;
}): A11yContrastEvaluation {
  // Two named colours, not six positional Ints. `fr fg fb br bg bb` could be
  // exchanged in either direction and still parse, and contrast is symmetric enough
  // that many swapped cases return the same answer while the ones that matter do not.
  const out = callMarkupCoreJson<{ ratio: number; required_aa: number; level: string }>(
    "contrast-evaluate",
    {
      foreground: { r: intOr(input.foreground.r), g: intOr(input.foreground.g), b: intOr(input.foreground.b) },
      background: { r: intOr(input.background.r), g: intOr(input.background.g), b: intOr(input.background.b) },
      font_size: finiteOr(input.fontSize),
      font_weight: intOr(input.fontWeight),
    },
  );
  // `level` is still checked: MoonBit types it `String`, so the literal union is a
  // TypeScript-side claim either way. The two numbers are no longer parsed from text.
  if (!isWcagLevel(out.level)) {
    throw new Error(`markup-core contrast-evaluate unexpected level: ${JSON.stringify(out)}`);
  }
  return { ratio: out.ratio, requiredAA: out.required_aa, level: out.level };
}

function isWcagLevel(value: string): value is WcagContrastLevel {
  return value === "AAA" || value === "AA" || value === "AA-large" || value === "fail";
}

