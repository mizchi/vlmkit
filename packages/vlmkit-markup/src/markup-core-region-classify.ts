/**
 * Thin TS wrapper over the MoonBit `region-classify-*` policy commands.
 */
import { callMarkupCoreJson, finiteOr, intOr } from "./markup-core-runtime.ts";

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
  const out = callMarkupCoreJson<string>("region-classify-kind", {
    area: intOr(input.area),
    aspect: finiteOr(input.aspect),
    luma_std: finiteOr(input.lumaStd),
    color_count: intOr(input.colorCount),
    stripe_rows: intOr(input.stripeRows),
  });
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

