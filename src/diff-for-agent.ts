/**
 * Format a migration-compare report into a one-context-window Markdown
 * summary aimed at coding agents.
 *
 * The agent's natural workflow (see `docs/reports/2026-05-12-dogfood-shadcn-luna.md`)
 * is: read the worst-viewport heatmap, then read baseline + current PNGs
 * side-by-side, then write a CSS patch. This module collapses the work into
 * a single Markdown blob that:
 *
 *   - leads with diff %/viewport in a sortable table
 *   - calls out the worst N viewports with absolute paths to their
 *     baseline/current/heatmap PNGs (the agent's Read tool can fetch them)
 *   - aggregates fix candidates with viewport coverage counts
 *   - lists category counts per viewport
 *
 * No fs reads happen here — callers supply the parsed JSON. Image paths in
 * the output are absolute, so the Markdown stays portable.
 */
import { basename, dirname, resolve } from "node:path";

export interface DfaResult {
  variant: string;
  variantFile: string;
  viewport: string;
  diffRatio: number;
  diffPixels: number;
  totalPixels: number;
  dominantCategory?: string;
  categorySummary?: string;
  categoryCounts?: Record<string, number>;
  fixCandidates?: Array<{ selector?: string; property?: string }>;
}

export interface DfaReport {
  dir: string;
  baseline: string;
  variants: Array<string | { file?: string }>;
  viewports: Array<{ label: string; width: number; height?: number }>;
  results: DfaResult[];
  /** Absolute path of the report file (used to resolve sibling PNGs). */
  reportPath?: string;
}

export interface DfaOptions {
  /**
   * How many viewport heatmap triples to highlight (worst-first).
   * Default 1 — the worst viewport.
   */
  maxViewports?: number;
  /**
   * Optional override for the output dir holding the PNGs. Default: the
   * directory of `report.reportPath` if set, else `report.dir`.
   */
  outputDir?: string;
  /** Filter to a single variant by file name (useful when the report has multiple). */
  variant?: string;
}

interface FixCandidateAggregate {
  selector: string;
  property: string;
  viewports: Set<string>;
}

function aggregateFixCandidates(results: DfaResult[]): FixCandidateAggregate[] {
  const byKey = new Map<string, FixCandidateAggregate>();
  for (const r of results) {
    for (const fc of r.fixCandidates ?? []) {
      const selector = fc.selector ?? "?";
      const property = fc.property ?? "?";
      const key = `${selector}::${property}`;
      const agg = byKey.get(key) ?? { selector, property, viewports: new Set() };
      agg.viewports.add(r.viewport);
      byKey.set(key, agg);
    }
  }
  return [...byKey.values()].sort((a, b) =>
    b.viewports.size - a.viewports.size
    || a.selector.localeCompare(b.selector)
    || a.property.localeCompare(b.property),
  );
}

function aggregateCategoryCounts(results: DfaResult[]): Array<{ category: string; total: number; viewports: number }> {
  const byCategory = new Map<string, { total: number; viewports: number }>();
  for (const r of results) {
    for (const [category, count] of Object.entries(r.categoryCounts ?? {})) {
      if (count === 0) continue;
      const agg = byCategory.get(category) ?? { total: 0, viewports: 0 };
      agg.total += count;
      agg.viewports += 1;
      byCategory.set(category, agg);
    }
  }
  return [...byCategory.entries()]
    .map(([category, v]) => ({ category, total: v.total, viewports: v.viewports }))
    .sort((a, b) => b.total - a.total || a.category.localeCompare(b.category));
}

function viewportImagePaths(
  baselineFile: string,
  variantFile: string,
  viewport: string,
  outputDir: string,
): { baseline: string; current: string; heatmap: string } {
  const baselineName = basename(baselineFile, ".html");
  const variantName = basename(variantFile, ".html");
  return {
    baseline: resolve(outputDir, `${baselineName}-${viewport}.png`),
    current: resolve(outputDir, `${variantName}-${viewport}.png`),
    heatmap: resolve(outputDir, `${variantName}-${viewport}_heatmap.png`),
  };
}

function formatPct(ratio: number): string {
  return `${(ratio * 100).toFixed(2)}%`;
}

export function formatMigrationReportForAgent(
  report: DfaReport,
  options: DfaOptions = {},
): string {
  const outputDir = options.outputDir
    ?? (report.reportPath ? dirname(report.reportPath) : report.dir);
  const maxViewports = Math.max(1, options.maxViewports ?? 1);

  const filtered = options.variant
    ? report.results.filter((r) => r.variantFile === options.variant || r.variant === options.variant)
    : report.results;

  if (filtered.length === 0) {
    return options.variant
      ? `# VRT diff (for agent)\n\n_No results for variant "${options.variant}"._\n`
      : `# VRT diff (for agent)\n\n_Empty report._\n`;
  }

  // Group by variant for the diff table, but keep one variant focus.
  const byVariant = new Map<string, DfaResult[]>();
  for (const r of filtered) {
    const k = r.variantFile;
    const list = byVariant.get(k);
    if (list) list.push(r); else byVariant.set(k, [r]);
  }

  const lines: string[] = [];
  lines.push("# VRT diff (for agent)");
  lines.push("");
  lines.push(`Baseline: \`${report.baseline}\``);
  lines.push(`Variants: ${[...byVariant.keys()].map((v) => `\`${v}\``).join(", ")}`);
  lines.push("");

  for (const [variantFile, results] of byVariant) {
    const sorted = [...results].sort((a, b) => b.diffRatio - a.diffRatio);
    const allZero = sorted.every((r) => r.diffRatio === 0);

    lines.push(`## ${variantFile}`);
    lines.push("");

    if (allZero) {
      lines.push("**PASS** — 0.00% diff on every viewport. Nothing to fix.");
      lines.push("");
      continue;
    }

    lines.push("### Diff by viewport (worst first)");
    lines.push("");
    lines.push("| Viewport | Diff | Dominant category | Categories |");
    lines.push("|---|---|---|---|");
    for (const r of sorted) {
      const cat = r.dominantCategory ?? "-";
      const summary = r.categorySummary ?? "-";
      lines.push(`| \`${r.viewport}\` | ${formatPct(r.diffRatio)} | ${cat} | ${summary} |`);
    }
    lines.push("");

    const categoryAgg = aggregateCategoryCounts(results);
    if (categoryAgg.length > 0) {
      lines.push("### Category totals across viewports");
      lines.push("");
      for (const c of categoryAgg) {
        lines.push(`- **${c.category}** — ${c.total} change(s) across ${c.viewports} viewport(s)`);
      }
      lines.push("");
    }

    const fixCandidates = aggregateFixCandidates(results);
    if (fixCandidates.length > 0) {
      lines.push("### Fix candidates (collapsed across viewports)");
      lines.push("");
      lines.push("> The tool flags the most-mentioned `selector { property }` per " +
        "viewport. Treat these as *hints*, not authoritative diffs — verify against " +
        "the baseline/current PNGs below.");
      lines.push("");
      lines.push("| Selector | Property | Viewports |");
      lines.push("|---|---|---|");
      for (const fc of fixCandidates.slice(0, 12)) {
        lines.push(`| \`${fc.selector}\` | \`${fc.property}\` | ${fc.viewports.size} |`);
      }
      lines.push("");
    }

    lines.push(`### Worst-diff viewport${maxViewports === 1 ? "" : "s"} (open these PNGs side-by-side)`);
    lines.push("");
    const worst = sorted.slice(0, maxViewports);
    for (const r of worst) {
      const paths = viewportImagePaths(report.baseline, variantFile, r.viewport, outputDir);
      lines.push(`#### \`${r.viewport}\` — ${formatPct(r.diffRatio)}`);
      lines.push("");
      lines.push(`- Baseline: \`${paths.baseline}\``);
      lines.push(`- Current : \`${paths.current}\``);
      lines.push(`- Heatmap : \`${paths.heatmap}\``);
      lines.push("");
    }

    lines.push("### Suggested next step");
    lines.push("");
    lines.push("1. Read baseline + current PNGs side-by-side and enumerate visible deltas " +
      "(font / colors / spacing / radius / shadow / gradient / typography).");
    lines.push("2. Cross-check against the fix-candidate table — it identifies *which* " +
      "selectors differ but may name the wrong property; trust your eyes for the " +
      "actual property.");
    lines.push("3. Write one CSS patch covering the deltas, re-run `vrt compare`, " +
      "and check that the dominant category count drops to zero on every viewport.");
    lines.push("");
  }

  return lines.join("\n");
}
