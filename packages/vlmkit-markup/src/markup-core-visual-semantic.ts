/**
 * Thin TS wrapper over the MoonBit `visual-*` policy commands.
 */
import { callMarkupCoreJson, intOr, runMarkupCore } from "./markup-core-runtime.ts";
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
  // `colorSample` is already optional in this interface, and the positional wire
  // flattened it into `has_color_sample` plus six numbers that meant nothing when the
  // flag was false. `Rgb?` carries the same thing the TypeScript type always said.
  const rgb = (c: { r: number; g: number; b: number }) => ({ r: intOr(c.r), g: intOr(c.g), b: intOr(c.b) });
  const out = callMarkupCoreJson<string>("visual-classify-region", {
    region_type: input.regionType === "shift" ? "shift" : "",
    width: intOr(input.width),
    height: intOr(input.height),
    diff_pixel_count: intOr(input.diffPixelCount),
    total_pixels: intOr(input.totalPixels),
    ...(input.colorSample
      ? {
        baseline_color: rgb(input.colorSample.baseline),
        current_color: rgb(input.colorSample.current),
      }
      : {}),
  });
  const [type, confidence] = out.split("|");
  const parsed = Number(confidence);
  if (!isVisualChangeType(type) || !Number.isFinite(parsed)) {
    throw new Error(`markup-core visual-classify-region unexpected: ${out}`);
  }
  return { type, confidence: parsed };
}

export function isLikelyPageSurface(color: { r: number; g: number; b: number }): boolean {
  const out = callMarkupCoreJson<string>("visual-is-likely-page-surface", {
    r: intOr(color.r),
    g: intOr(color.g),
    b: intOr(color.b),
  });
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
    value === "reflow" ||
    value === "icon-change" ||
    value === "text-change" ||
    value === "color-change" ||
    value === "element-added" ||
    value === "element-removed"
  );
}


