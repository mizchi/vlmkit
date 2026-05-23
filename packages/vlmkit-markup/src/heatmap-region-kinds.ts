/**
 * Annotate heatmap regions with content kinds.
 *
 * `findHeatmapRegionsFromFile` (vlmkit-core) populates dominantColor but
 * intentionally does NOT classify region kinds — that decision tree lives
 * in MoonBit (`region_classify.mbt`), reachable only from vlmkit-markup.
 *
 * Callers that need `region.kind` / `region.kindConfidence` invoke
 * `annotateHeatmapRegionKinds(regions, sourceImagePath)` after fetching
 * regions. Annotation mutates the regions in place (matching the pre-split
 * behavior) and returns them for chaining convenience.
 */
import { readFile } from "node:fs/promises";
import { PNG } from "pngjs";
import { classifyRegion } from "./region-classify.ts";
import type { HeatmapRegion } from "@mizchi/vlmkit-core/heatmap-regions.ts";

export async function annotateHeatmapRegionKinds(
  regions: HeatmapRegion[],
  sourceImagePath: string,
): Promise<HeatmapRegion[]> {
  if (regions.length === 0) return regions;
  try {
    const buf = await readFile(sourceImagePath);
    const png = PNG.sync.read(buf);
    for (const region of regions) {
      const cls = classifyRegion(png.data, png.width, png.height, region);
      region.kind = cls.kind;
      region.kindConfidence = Number(cls.confidence.toFixed(2));
    }
  } catch {
    // Source image unavailable — leave regions un-annotated.
  }
  return regions;
}
