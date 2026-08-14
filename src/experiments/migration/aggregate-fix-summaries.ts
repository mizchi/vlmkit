#!/usr/bin/env node
/**
 * Aggregate one or more `migration-fix-loop --summary-out` JSON files
 * into a Markdown table summarising before/after diff, applied/dropped
 * counts, and the net delta per pattern.
 *
 * Usage:
 *   node src/experiments/migration/aggregate-fix-summaries.ts \
 *     <summary.json>... [--out path] [--format markdown|tsv]
 */
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { isCliEntry } from "@mizchi/vlmkit-core/plugin/cli-entry.ts";
import { basename, dirname, resolve } from "node:path";
import { handleCliError } from "@mizchi/vlmkit-core/cli-error.ts";

interface FixSummary {
  target: {
    variantFile: string;
    viewport: string;
    viewportWidth: number;
    diffRatio: number;
  };
  counts: {
    proposed: number;
    corrected: number;
    dropped: number;
    applied: number;
    skipped: number;
  };
  outputPath: string | null;
  beforeByViewport?: Array<{ viewport: string; diffRatio: number }>;
  afterByViewport?: Array<{ viewport: string; diffRatio: number }> | null;
}

function loadSummary(path: string): Promise<FixSummary & { path: string }> {
  return readFile(path, "utf-8").then((content) => ({ ...JSON.parse(content) as FixSummary, path }));
}

function patternName(variantFile: string): string {
  // Heuristic: `<...>/<pattern>/current.html` → `<pattern>`.
  const parts = variantFile.split("/");
  if (parts.length >= 2) return parts[parts.length - 2];
  return basename(variantFile, ".html");
}

interface PerViewportRow {
  viewport: string;
  before: number | null;
  after: number | null;
  delta: number | null;
}

function buildRows(summary: FixSummary): PerViewportRow[] {
  const beforeMap = new Map((summary.beforeByViewport ?? []).map((b) => [b.viewport, b.diffRatio]));
  const afterMap = new Map((summary.afterByViewport ?? []).map((a) => [a.viewport, a.diffRatio]));
  const viewports = new Set<string>([...beforeMap.keys(), ...afterMap.keys()]);
  if (viewports.size === 0) viewports.add(summary.target.viewport);
  const rows: PerViewportRow[] = [];
  for (const vp of [...viewports].sort()) {
    const before = beforeMap.get(vp) ?? null;
    const after = afterMap.get(vp) ?? null;
    const delta = (before !== null && after !== null) ? after - before : null;
    rows.push({ viewport: vp, before, after, delta });
  }
  return rows;
}

function pct(value: number | null): string {
  if (value === null) return "—";
  return `${(value * 100).toFixed(2)}%`;
}

function deltaCell(delta: number | null): string {
  if (delta === null) return "—";
  const pctValue = delta * 100;
  const sign = pctValue >= 0 ? "+" : "";
  const symbol = pctValue < -0.3 ? " ✓" : pctValue > 0.3 ? " ⚠" : " ≈";
  return `${sign}${pctValue.toFixed(2)}%${symbol}`;
}

function renderMarkdown(summaries: Array<FixSummary & { path: string }>): string {
  const lines: string[] = [];
  lines.push("# Fix-loop aggregate summary");
  lines.push("");
  lines.push(`Inputs: ${summaries.length} summary file(s).`);
  lines.push("");
  lines.push("| Pattern | Viewport | Before | After | Δ | Applied / Proposed | Dropped |");
  lines.push("|---|---|---:|---:|---:|---:|---:|");
  let totalDelta = 0;
  let totalCount = 0;
  let totalApplied = 0;
  let totalProposed = 0;
  for (const summary of summaries) {
    const pattern = patternName(summary.target.variantFile);
    const rows = buildRows(summary);
    for (const row of rows) {
      lines.push(
        `| \`${pattern}\` | ${row.viewport} | ${pct(row.before)} | ${pct(row.after)} | ${deltaCell(row.delta)} | ${summary.counts.applied}/${summary.counts.proposed} | ${summary.counts.dropped} |`,
      );
      if (row.delta !== null) {
        totalDelta += row.delta;
        totalCount += 1;
      }
    }
    totalApplied += summary.counts.applied;
    totalProposed += summary.counts.proposed;
  }
  lines.push("");
  if (totalCount > 0) {
    const avgDelta = totalDelta / totalCount;
    lines.push(`**Aggregate**: avg Δ across ${totalCount} viewport(s) = ${(avgDelta * 100).toFixed(2)}%; total applied = ${totalApplied}/${totalProposed}.`);
  } else {
    lines.push(`**Aggregate**: no before/after deltas available (rerun was disabled or skipped).`);
  }
  return lines.join("\n") + "\n";
}

function renderTsv(summaries: Array<FixSummary & { path: string }>): string {
  const lines: string[] = ["pattern\tviewport\tbefore\tafter\tdelta\tapplied\tproposed\tdropped"];
  for (const summary of summaries) {
    const pattern = patternName(summary.target.variantFile);
    for (const row of buildRows(summary)) {
      lines.push([
        pattern,
        row.viewport,
        row.before === null ? "" : row.before.toFixed(6),
        row.after === null ? "" : row.after.toFixed(6),
        row.delta === null ? "" : row.delta.toFixed(6),
        summary.counts.applied,
        summary.counts.proposed,
        summary.counts.dropped,
      ].join("\t"));
    }
  }
  return lines.join("\n") + "\n";
}

async function main(argv = process.argv.slice(2)): Promise<void> {
  const inputs: string[] = [];
  let format: "markdown" | "tsv" = "markdown";
  let outPath: string | null = null;
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === "--out") outPath = argv[++i] ?? null;
    else if (arg === "--format") {
      const value = argv[++i];
      if (value !== "markdown" && value !== "tsv") {
        throw new Error(`--format must be markdown|tsv, got ${value}`);
      }
      format = value;
    } else if (arg === "--help" || arg === "-h") {
      console.log("Usage: aggregate-fix-summaries <summary.json>... [--out path] [--format markdown|tsv]");
      process.exit(0);
    } else inputs.push(arg);
  }
  if (inputs.length === 0) {
    console.error("Error: need at least one summary.json");
    process.exit(1);
  }
  const summaries = await Promise.all(inputs.map((path) => loadSummary(resolve(path))));
  const output = format === "tsv" ? renderTsv(summaries) : renderMarkdown(summaries);
  if (outPath) {
    const resolved = resolve(outPath);
    await mkdir(dirname(resolved), { recursive: true });
    await writeFile(resolved, output);
    console.log(`Wrote ${resolved}`);
  } else {
    process.stdout.write(output);
  }
}

if (isCliEntry(import.meta.url, "migration-aggregate")) {
  main().catch(handleCliError);
}

export { buildRows, renderMarkdown, renderTsv };
