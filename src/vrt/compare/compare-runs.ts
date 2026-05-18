/**
 * Pairwise comparison of two migration-compare reports.
 *
 * Answers the dogfood question "did my patch do what I expected?" without
 * forcing the agent to eyeball two diff tables side-by-side. Surfaces
 * per-viewport improvement / regression deltas and category-count changes.
 *
 * Pure module. The CLI wrapper lives in `compare-runs-cli.ts`.
 */

export interface CrResult {
  variant: string;
  variantFile: string;
  viewport: string;
  diffRatio: number;
  diffPixels?: number;
  totalPixels?: number;
  dominantCategory?: string;
  categorySummary?: string;
  categoryCounts?: Record<string, number>;
}

export interface CrReport {
  baseline: string;
  variants?: Array<string | { file?: string }>;
  results: CrResult[];
}

export interface CrViewportDelta {
  variantFile: string;
  viewport: string;
  beforeRatio: number;
  afterRatio: number;
  delta: number; // afterRatio - beforeRatio
  status: "improved" | "regressed" | "unchanged" | "added" | "removed";
  categoryBefore?: string;
  categoryAfter?: string;
}

export interface CrCompareResult {
  /** Per-variant rows keyed by variantFile. */
  byVariant: Map<string, CrViewportDelta[]>;
  /** Sets of (variantFile, viewport) keys that appear only in one side. */
  onlyInA: string[];
  onlyInB: string[];
  /** Aggregated counts across all variants. */
  totals: {
    improved: number;
    regressed: number;
    unchanged: number;
    netRatioDelta: number; // sum of (after-before)
  };
}

const UNCHANGED_RATIO_THRESHOLD = 1e-6;

function key(r: CrResult): string {
  return `${r.variantFile}::${r.viewport}`;
}

export function compareRuns(a: CrReport, b: CrReport): CrCompareResult {
  const mapA = new Map<string, CrResult>();
  const mapB = new Map<string, CrResult>();
  for (const r of a.results) mapA.set(key(r), r);
  for (const r of b.results) mapB.set(key(r), r);

  const byVariant = new Map<string, CrViewportDelta[]>();
  const onlyInA: string[] = [];
  const onlyInB: string[] = [];
  let improved = 0, regressed = 0, unchanged = 0, netDelta = 0;

  const allKeys = new Set<string>([...mapA.keys(), ...mapB.keys()]);
  for (const k of allKeys) {
    const ra = mapA.get(k);
    const rb = mapB.get(k);

    if (ra && !rb) {
      onlyInA.push(k);
      const list = byVariant.get(ra.variantFile) ?? [];
      list.push({
        variantFile: ra.variantFile,
        viewport: ra.viewport,
        beforeRatio: ra.diffRatio,
        afterRatio: 0,
        delta: -ra.diffRatio,
        status: "removed",
        categoryBefore: ra.categorySummary,
      });
      byVariant.set(ra.variantFile, list);
      continue;
    }
    if (rb && !ra) {
      onlyInB.push(k);
      const list = byVariant.get(rb.variantFile) ?? [];
      list.push({
        variantFile: rb.variantFile,
        viewport: rb.viewport,
        beforeRatio: 0,
        afterRatio: rb.diffRatio,
        delta: rb.diffRatio,
        status: "added",
        categoryAfter: rb.categorySummary,
      });
      byVariant.set(rb.variantFile, list);
      continue;
    }

    const before = ra!.diffRatio;
    const after = rb!.diffRatio;
    const delta = after - before;
    let status: CrViewportDelta["status"];
    if (Math.abs(delta) < UNCHANGED_RATIO_THRESHOLD) {
      status = "unchanged";
      unchanged++;
    } else if (delta < 0) {
      status = "improved";
      improved++;
    } else {
      status = "regressed";
      regressed++;
    }
    netDelta += delta;

    const list = byVariant.get(ra!.variantFile) ?? [];
    list.push({
      variantFile: ra!.variantFile,
      viewport: ra!.viewport,
      beforeRatio: before,
      afterRatio: after,
      delta,
      status,
      categoryBefore: ra!.categorySummary,
      categoryAfter: rb!.categorySummary,
    });
    byVariant.set(ra!.variantFile, list);
  }

  // Sort each variant's rows by abs(delta) desc — biggest movers first.
  for (const rows of byVariant.values()) {
    rows.sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta) || a.viewport.localeCompare(b.viewport));
  }

  return {
    byVariant,
    onlyInA,
    onlyInB,
    totals: { improved, regressed, unchanged, netRatioDelta: netDelta },
  };
}

function formatPct(ratio: number, signed = false): string {
  const pct = (ratio * 100).toFixed(2);
  if (!signed) return `${pct}%`;
  return ratio >= 0 ? `+${pct}%` : `${pct}%`;
}

function labelStatus(status: CrViewportDelta["status"]): string {
  switch (status) {
    case "improved": return "IMPROVED";
    case "regressed": return "REGRESSED";
    case "unchanged": return "UNCHANGED";
    case "added": return "ADDED";
    case "removed": return "REMOVED";
  }
}

export interface CrFormatOptions {
  /** Labels for the two runs (defaults to "A" / "B"). */
  labelA?: string;
  labelB?: string;
}

export function formatCompareRunsMarkdown(
  a: CrReport,
  b: CrReport,
  options: CrFormatOptions = {},
): string {
  const cr = compareRuns(a, b);
  const labelA = options.labelA ?? "A";
  const labelB = options.labelB ?? "B";

  const lines: string[] = [];
  lines.push("# VRT compare-runs");
  lines.push("");
  lines.push(`- A (${labelA}): ${a.results.length} viewport row(s)`);
  lines.push(`- B (${labelB}): ${b.results.length} viewport row(s)`);
  lines.push("");

  for (const [variantFile, rows] of cr.byVariant) {
    lines.push(`## ${variantFile}`);
    lines.push("");
    lines.push(`| Viewport | ${labelA} | ${labelB} | Δ | Status | Category change |`);
    lines.push("|---|---|---|---|---|---|");
    for (const row of rows) {
      const catChange = row.categoryBefore || row.categoryAfter
        ? `${row.categoryBefore ?? "-"} → ${row.categoryAfter ?? "-"}`
        : "-";
      lines.push(
        `| \`${row.viewport}\` | ${formatPct(row.beforeRatio)} | ${formatPct(row.afterRatio)} ` +
        `| ${formatPct(row.delta, true)} | ${labelStatus(row.status)} | ${catChange} |`,
      );
    }
    lines.push("");
  }

  lines.push("## Summary");
  lines.push("");
  lines.push(`- Improved: ${cr.totals.improved}`);
  lines.push(`- Regressed: ${cr.totals.regressed}`);
  lines.push(`- Unchanged: ${cr.totals.unchanged}`);
  if (cr.onlyInA.length > 0) lines.push(`- Only in ${labelA}: ${cr.onlyInA.join(", ")}`);
  if (cr.onlyInB.length > 0) lines.push(`- Only in ${labelB}: ${cr.onlyInB.join(", ")}`);
  lines.push(`- Net diff-ratio Δ: ${formatPct(cr.totals.netRatioDelta, true)}`);
  lines.push("");

  return lines.join("\n");
}
