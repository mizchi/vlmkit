/**
 * Thin TS wrapper over the MoonBit `visual-*` policy commands.
 */
import { runMarkupCore } from "./markup-core-runtime.ts";
import type { VisualChangeType } from "@mizchi/vlmkit-core/types.ts";

export interface VisualClassifyInput {
  regionType: "shift" | undefined;
  width: number;
  height: number;
  diffPixelCount: number;
  totalPixels: number;
  colorSample?: {
    baseline: { r: number; g: number; b: number };
    current: { r: number; g: number; b: number };
  };
}

export interface VisualClassifyResult {
  type: VisualChangeType;
  confidence: number;
}

export function classifyRegionPolicy(input: VisualClassifyInput): VisualClassifyResult {
  const baseline = input.colorSample?.baseline ?? { r: 0, g: 0, b: 0 };
  const current = input.colorSample?.current ?? { r: 0, g: 0, b: 0 };
  const out = runMarkupCore([
    "visual-classify-region",
    input.regionType === "shift" ? "shift" : "",
    intArg(input.width),
    intArg(input.height),
    intArg(input.diffPixelCount),
    intArg(input.totalPixels),
    boolArg(Boolean(input.colorSample)),
    intArg(baseline.r),
    intArg(baseline.g),
    intArg(baseline.b),
    intArg(current.r),
    intArg(current.g),
    intArg(current.b),
  ]);
  const [type, confidence] = out.split("|");
  const parsed = Number(confidence);
  if (!isVisualChangeType(type) || !Number.isFinite(parsed)) {
    throw new Error(`markup-core visual-classify-region unexpected: ${out}`);
  }
  return { type, confidence: parsed };
}

export function isLikelyPageSurface(color: { r: number; g: number; b: number }): boolean {
  const out = runMarkupCore([
    "visual-is-likely-page-surface",
    intArg(color.r),
    intArg(color.g),
    intArg(color.b),
  ]);
  if (out === "true") return true;
  if (out === "false") return false;
  throw new Error(`markup-core visual-is-likely-page-surface unexpected: ${out}`);
}

let cachedGroupThreshold: number | undefined;
export function layoutShiftGroupThreshold(): number {
  if (cachedGroupThreshold !== undefined) return cachedGroupThreshold;
  const out = runMarkupCore(["visual-layout-shift-group-threshold"]);
  const parsed = Number(out);
  if (!Number.isInteger(parsed) || parsed < 0) {
    throw new Error(`markup-core visual-layout-shift-group-threshold unexpected: ${out}`);
  }
  cachedGroupThreshold = parsed;
  return parsed;
}

function isVisualChangeType(value: string): value is VisualChangeType {
  return (
    value === "layout-shift" ||
    value === "icon-change" ||
    value === "text-change" ||
    value === "color-change" ||
    value === "element-added" ||
    value === "element-removed"
  );
}

function intArg(value: number): string {
  return String(Number.isFinite(value) ? Math.trunc(value) : 0);
}

function boolArg(value: boolean): string {
  return value ? "true" : "false";
}
