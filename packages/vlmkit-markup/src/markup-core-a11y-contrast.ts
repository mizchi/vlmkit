/**
 * Thin TS wrapper over the MoonBit `a11y-contrast-*` policy commands.
 */
import { runMarkupCore } from "./markup-core-runtime.ts";

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
  const out = runMarkupCore([
    "a11y-contrast-evaluate",
    intArg(input.foreground.r),
    intArg(input.foreground.g),
    intArg(input.foreground.b),
    intArg(input.background.r),
    intArg(input.background.g),
    intArg(input.background.b),
    doubleArg(input.fontSize),
    intArg(input.fontWeight),
  ]);
  const [ratioStr, requiredStr, level] = out.split("|");
  const ratio = Number(ratioStr);
  const requiredAA = Number(requiredStr);
  if (!Number.isFinite(ratio) || !Number.isFinite(requiredAA) || !isWcagLevel(level)) {
    throw new Error(`markup-core a11y-contrast-evaluate unexpected: ${out}`);
  }
  return { ratio, requiredAA, level };
}

function isWcagLevel(value: string): value is WcagContrastLevel {
  return value === "AAA" || value === "AA" || value === "AA-large" || value === "fail";
}

function intArg(value: number): string {
  return String(Number.isFinite(value) ? Math.trunc(value) : 0);
}

function doubleArg(value: number): string {
  return String(Number.isFinite(value) ? value : 0);
}
