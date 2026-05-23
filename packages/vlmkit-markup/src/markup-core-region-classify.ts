/**
 * Thin TS wrapper over the MoonBit `region-classify-*` policy commands.
 */
import { runMarkupCore } from "./markup-core-runtime.ts";

export type RegionKind = "text" | "filled-rect" | "icon" | "image" | "unknown";

export interface RegionKindResult {
  kind: RegionKind;
  confidence: number;
}

export function regionClassifyKind(input: {
  area: number;
  aspect: number;
  lumaStd: number;
  colorCount: number;
  stripeRows: number;
}): RegionKindResult {
  const out = runMarkupCore([
    "region-classify-kind",
    intArg(input.area),
    doubleArg(input.aspect),
    doubleArg(input.lumaStd),
    intArg(input.colorCount),
    intArg(input.stripeRows),
  ]);
  const [kind, confidence] = out.split("|");
  const parsed = Number(confidence);
  if (!isRegionKind(kind) || !Number.isFinite(parsed)) {
    throw new Error(`markup-core region-classify-kind unexpected: ${out}`);
  }
  return { kind, confidence: parsed };
}

function isRegionKind(value: string): value is RegionKind {
  return (
    value === "text" ||
    value === "filled-rect" ||
    value === "icon" ||
    value === "image" ||
    value === "unknown"
  );
}

function intArg(value: number): string {
  return String(Number.isFinite(value) ? Math.trunc(value) : 0);
}

function doubleArg(value: number): string {
  return String(Number.isFinite(value) ? value : 0);
}
