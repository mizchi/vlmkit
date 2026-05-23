import type {
  VrtDiff,
  DiffRegion,
  VisualSemanticChange,
  VisualSemanticDiff,
  VisualChangeType,
} from "@mizchi/vlmkit-core/types.ts";
import {
  classifyRegionPolicy,
  layoutShiftGroupThreshold,
} from "./markup-core-visual-semantic.ts";

/**
 * Convert VRT pixel diff into visual semantics.
 *
 * Analyzes each diff region to infer what changed:
 * - text-change: text area change (wide, small region)
 * - color-change: color-only change (same shape)
 * - layout-shift: element repositioning (large region, correlated diffs)
 * - element-added/removed: new/removed element
 * - icon-change: small square region
 */
export function classifyVisualDiff(diff: VrtDiff): VisualSemanticDiff {
  const changes: VisualSemanticChange[] = [];

  for (const region of diff.regions) {
    const classified = classifyRegion(region, diff);
    changes.push(classified);
  }

  const grouped = groupLayoutShifts(changes);

  return {
    testId: diff.snapshot.testId,
    changes: grouped,
    summary: summarizeChanges(grouped),
  };
}

function classifyRegion(region: DiffRegion, diff: VrtDiff): VisualSemanticChange {
  const policy = classifyRegionPolicy({
    regionType: region.regionType === "shift" ? "shift" : undefined,
    width: region.width,
    height: region.height,
    diffPixelCount: region.diffPixelCount,
    totalPixels: diff.totalPixels,
    colorSample: region.colorSample,
  });

  return {
    type: policy.type,
    region,
    confidence: policy.confidence,
    description: describeChange(policy.type, region, diff),
  };
}

function describeChange(
  type: VisualChangeType,
  region: DiffRegion,
  diff: VrtDiff,
): string {
  const area = region.width * region.height;
  const density = area > 0 ? region.diffPixelCount / area : 0;
  const globalRatio = region.diffPixelCount / diff.totalPixels;
  const where = `(${region.x}, ${region.y})`;
  const dims = `${region.width}x${region.height}`;
  switch (type) {
    case "layout-shift":
      if (region.regionType === "shift") {
        return `Layout shift region hint at ${where}, ${dims}`;
      }
      return `Layout shift at ${where}, ${dims}, ${(globalRatio * 100).toFixed(1)}% of total`;
    case "icon-change":
      return `Small square region changed at ${where}`;
    case "text-change":
      return `Text-like region changed at ${where}, ${dims}`;
    case "color-change":
      return `Color change in region ${where}, ${dims}, ${(density * 100).toFixed(0)}% density${formatColorSample(region)}`;
    case "element-added":
      if (region.colorSample) {
        return `Element appeared at ${where}, ${dims}${formatColorSample(region)}`;
      }
      if (density > 0.5 && area > 1024) {
        return `New element appeared at ${where}, ${dims}`;
      }
      return `Change at ${where}, ${dims}`;
    case "element-removed":
      return `Element disappeared at ${where}, ${dims}${formatColorSample(region)}`;
  }
}

function formatColorSample(region: DiffRegion): string {
  if (!region.colorSample) return "";
  return `, ${region.colorSample.baseline.hex} -> ${region.colorSample.current.hex}`;
}

/**
 * Group layout-shifts with close Y coordinates.
 * Multiple regions shifting on the same row = one layout shift.
 */
function groupLayoutShifts(
  changes: VisualSemanticChange[],
): VisualSemanticChange[] {
  const layoutShifts = changes.filter((c) => c.type === "layout-shift");
  const others = changes.filter((c) => c.type !== "layout-shift");

  if (layoutShifts.length <= 1) return changes;

  layoutShifts.sort((a, b) => a.region.y - b.region.y);

  const groupThreshold = layoutShiftGroupThreshold();
  const groups: VisualSemanticChange[][] = [];
  let currentGroup: VisualSemanticChange[] = [layoutShifts[0]];

  for (let i = 1; i < layoutShifts.length; i++) {
    const prev = currentGroup[currentGroup.length - 1];
    const curr = layoutShifts[i];
    if (Math.abs(curr.region.y - prev.region.y) < groupThreshold) {
      currentGroup.push(curr);
    } else {
      groups.push(currentGroup);
      currentGroup = [curr];
    }
  }
  groups.push(currentGroup);

  const merged = groups.map((group): VisualSemanticChange => {
    if (group.length === 1) return group[0];

    const minX = Math.min(...group.map((c) => c.region.x));
    const minY = Math.min(...group.map((c) => c.region.y));
    const maxX = Math.max(...group.map((c) => c.region.x + c.region.width));
    const maxY = Math.max(...group.map((c) => c.region.y + c.region.height));
    const totalDiff = group.reduce(
      (sum, c) => sum + c.region.diffPixelCount,
      0,
    );

    return {
      type: "layout-shift",
      region: {
        x: minX,
        y: minY,
        width: maxX - minX,
        height: maxY - minY,
        diffPixelCount: totalDiff,
      },
      confidence: Math.max(...group.map((c) => c.confidence)),
      description: `Layout shift spanning ${group.length} regions at y=${minY}-${maxY}`,
    };
  });

  return [...others, ...merged];
}

function summarizeChanges(changes: VisualSemanticChange[]): string {
  const byType = new Map<VisualChangeType, number>();
  for (const c of changes) {
    byType.set(c.type, (byType.get(c.type) ?? 0) + 1);
  }

  const parts: string[] = [];
  for (const [type, count] of byType) {
    parts.push(`${count} ${type}`);
  }
  return parts.join(", ") || "no changes";
}
