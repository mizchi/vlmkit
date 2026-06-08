import type { DiffRegion } from "@mizchi/vlmkit-core/types.ts";

/**
 * Cross-viewport presence matrix.
 *
 * Both A/B v1 and v2 agents localized regressions by manually comparing which
 * viewports showed a diff ("375-only ⇒ mobile base rule deleted"; "1280-only ⇒
 * min-width:1200px block"). That inference is mechanical: cluster the diff
 * regions of N viewport captures by spatial overlap, then for any cluster that
 * appears in a strict subset of viewports, surface the media-query breakpoints
 * that cleanly separate the present widths from the absent ones (A/B v2 draft 08).
 */

export interface PresenceMatrixViewportInput {
  label: string;
  width: number;
  regions: DiffRegion[];
}

export interface PresenceMatrixBreakpoint {
  value: number;
  type: "min-width" | "max-width";
  raw?: string;
}

export interface PresenceMatrixViewport {
  label: string;
  width: number;
}

export interface PresenceMatrixRow {
  bbox: { x: number; y: number; width: number; height: number };
  present: string[];
  absent: string[];
  exclusive: boolean;
  mediaHints: string[];
}

export interface PresenceMatrix {
  viewports: PresenceMatrixViewport[];
  rows: PresenceMatrixRow[];
}

interface TaggedRegion {
  viewport: number;
  width: number;
  region: DiffRegion;
}

function intersects(a: DiffRegion, b: DiffRegion): boolean {
  return (
    a.x < b.x + b.width &&
    b.x < a.x + a.width &&
    a.y < b.y + b.height &&
    b.y < a.y + a.height
  );
}

export function buildPresenceMatrix(
  inputs: PresenceMatrixViewportInput[],
  breakpoints: PresenceMatrixBreakpoint[] = [],
): PresenceMatrix {
  const viewports: PresenceMatrixViewport[] = inputs.map((v) => ({
    label: v.label,
    width: v.width,
  }));

  // Pool every region, tagged with its source viewport, then union by overlap.
  const pool: TaggedRegion[] = [];
  inputs.forEach((input, vi) => {
    for (const region of input.regions) {
      pool.push({ viewport: vi, width: input.width, region });
    }
  });

  const parent = pool.map((_, i) => i);
  const find = (i: number): number => {
    while (parent[i] !== i) {
      parent[i] = parent[parent[i]!]!;
      i = parent[i]!;
    }
    return i;
  };
  const union = (a: number, b: number) => {
    const ra = find(a);
    const rb = find(b);
    if (ra !== rb) parent[ra] = rb;
  };

  for (let i = 0; i < pool.length; i++) {
    for (let j = i + 1; j < pool.length; j++) {
      if (pool[i]!.viewport === pool[j]!.viewport) continue;
      if (intersects(pool[i]!.region, pool[j]!.region)) union(i, j);
    }
  }

  const clusters = new Map<number, TaggedRegion[]>();
  for (let i = 0; i < pool.length; i++) {
    const root = find(i);
    const list = clusters.get(root) ?? [];
    list.push(pool[i]!);
    clusters.set(root, list);
  }

  const allLabels = inputs.map((v) => v.label);
  const rows: PresenceMatrixRow[] = [];
  for (const members of clusters.values()) {
    const presentIdx = new Set(members.map((m) => m.viewport));
    const present = inputs
      .map((v, i) => ({ label: v.label, i }))
      .filter((v) => presentIdx.has(v.i))
      .map((v) => v.label);
    const absent = allLabels.filter((l) => !present.includes(l));
    const exclusive = absent.length > 0;

    // Representative bbox: take the region from the widest present viewport
    // (most likely the full desktop layout the agent is reasoning about).
    const widest = members.reduce((a, b) => (b.width > a.width ? b : a));
    const r = widest.region;

    const presentWidths = members.map((m) => m.width);
    const absentWidths = inputs
      .filter((v) => !presentIdx.has(inputs.indexOf(v)))
      .map((v) => v.width);

    rows.push({
      bbox: { x: r.x, y: r.y, width: r.width, height: r.height },
      present,
      absent,
      exclusive,
      mediaHints: exclusive
        ? discriminatingBreakpoints(presentWidths, absentWidths, breakpoints)
        : [],
    });
  }

  // Stable order: top-to-bottom, then left-to-right.
  rows.sort((a, b) => a.bbox.y - b.bbox.y || a.bbox.x - b.bbox.x);
  return { viewports, rows };
}

function satisfies(width: number, bp: PresenceMatrixBreakpoint): boolean {
  return bp.type === "min-width" ? width >= bp.value : width <= bp.value;
}

/**
 * A breakpoint explains a viewport-exclusive region when its media condition is
 * active at exactly the widths where the region appears: every present width
 * satisfies the condition and every absent width does not. The convention is
 * directional — a desktop-only region maps to a `min-width` block, a mobile-only
 * region to a `max-width` block — which keeps the hint aligned with the agent's
 * mental model ("1280-only ⇒ check min-width:1200px") and drops the noisier
 * inverse hypothesis (a rule that hides the region at the other widths).
 */
function discriminatingBreakpoints(
  presentWidths: number[],
  absentWidths: number[],
  breakpoints: PresenceMatrixBreakpoint[],
): string[] {
  if (presentWidths.length === 0 || absentWidths.length === 0) return [];
  const hints: string[] = [];
  for (const bp of breakpoints) {
    const presentAll = presentWidths.every((w) => satisfies(w, bp));
    const absentNone = absentWidths.every((w) => !satisfies(w, bp));
    if (presentAll && absentNone) {
      hints.push(`@media (${bp.type}: ${bp.value}px)`);
    }
  }
  return [...new Set(hints)];
}

export function formatPresenceMatrix(matrix: PresenceMatrix): string {
  if (matrix.rows.length === 0) {
    return "Presence matrix: no diff regions across the supplied viewports.\n";
  }

  const labels = matrix.viewports.map((v) => v.label);
  const lines: string[] = [];
  lines.push("Region × viewport presence matrix");
  lines.push("");
  lines.push(`| Region (bbox) | ${labels.join(" | ")} | Media hint |`);
  lines.push(`|---|${labels.map(() => "---").join("|")}|---|`);
  for (const row of matrix.rows) {
    const bbox = `${row.bbox.x},${row.bbox.y} ${row.bbox.width}x${row.bbox.height}`;
    const cells = matrix.viewports.map((v) => (row.present.includes(v.label) ? "✓" : "—"));
    const hint = row.mediaHints.length > 0 ? row.mediaHints.join(", ") : "";
    lines.push(`| \`${bbox}\` | ${cells.join(" | ")} | ${hint} |`);
  }

  const exclusiveWithHints = matrix.rows.filter((r) => r.exclusive && r.mediaHints.length > 0);
  if (exclusiveWithHints.length > 0) {
    lines.push("");
    for (const row of exclusiveWithHints) {
      lines.push(
        `- region \`${row.bbox.x},${row.bbox.y} ${row.bbox.width}x${row.bbox.height}\` present at `
          + `${row.present.join(", ")} only → check ${row.mediaHints.join(" / ")} blocks`,
      );
    }
  }
  return lines.join("\n") + "\n";
}
