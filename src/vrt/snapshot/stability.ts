/**
 * False-positive rate measurement helpers.
 *
 * Captures the same set of URLs across N iterations against a baseline
 * locked-in on iteration 0, then reports the fraction of comparisons that
 * showed a non-zero diff. Anything above ~0% indicates renderer noise,
 * dynamic content, or animations that should be masked.
 */

export interface StabilityIterationResult {
  iteration: number;
  url: string;
  label: string;
  viewport: string;
  diffRatio: number;
  compensatedDiffRatio?: number;
  globalShift?: number;
  shiftOnly?: boolean;
}

export interface StabilityEntry {
  url: string;
  label: string;
  viewport: string;
  comparisons: number;
  positives: number;
  falsePositiveRate: number;
  maxDiffRatio: number;
  meanDiffRatio: number;
  maxCompensatedDiffRatio: number;
}

export interface StabilityReport {
  timestamp: string;
  iterations: number;
  urls: string[];
  threshold: number;
  entries: StabilityEntry[];
  totalComparisons: number;
  totalPositives: number;
  overallFalsePositiveRate: number;
}

export interface StabilityHistoryInput {
  reportPath: string;
  report: StabilityReport;
}

export interface StabilityHistoryRun {
  reportPath: string;
  timestamp: string;
  iterations: number;
  urlCount: number;
  totalComparisons: number;
  totalPositives: number;
  overallFalsePositiveRate: number;
  deltaFalsePositiveRate?: number;
}

export interface StabilityHistory {
  runs: StabilityHistoryRun[];
  latest?: StabilityHistoryRun;
  best?: StabilityHistoryRun;
  worst?: StabilityHistoryRun;
}

function entryKey(r: { url: string; label: string; viewport: string }): string {
  return `${r.label}\u0000${r.viewport}\u0000${r.url}`;
}

export interface AggregateOptions {
  /** Diff ratio above which a comparison counts as a positive. Defaults to 0. */
  threshold?: number;
}

export function aggregateStability(
  iterations: StabilityIterationResult[],
  options: AggregateOptions = {},
): StabilityEntry[] {
  const threshold = options.threshold ?? 0;
  const comparisons = iterations.filter((r) => r.iteration > 0);
  const grouped = new Map<string, StabilityIterationResult[]>();

  for (const r of comparisons) {
    const key = entryKey(r);
    const list = grouped.get(key);
    if (list) list.push(r);
    else grouped.set(key, [r]);
  }

  const entries: StabilityEntry[] = [];
  for (const group of grouped.values()) {
    const head = group[0]!;
    const ratios = group.map((g) => g.diffRatio);
    const compensated = group.map((g) => g.compensatedDiffRatio ?? g.diffRatio);
    const positives = ratios.filter((r) => r > threshold).length;
    const sum = ratios.reduce((a, b) => a + b, 0);

    entries.push({
      url: head.url,
      label: head.label,
      viewport: head.viewport,
      comparisons: group.length,
      positives,
      falsePositiveRate: group.length === 0 ? 0 : positives / group.length,
      maxDiffRatio: Math.max(0, ...ratios),
      meanDiffRatio: group.length === 0 ? 0 : sum / group.length,
      maxCompensatedDiffRatio: Math.max(0, ...compensated),
    });
  }

  entries.sort(
    (a, b) =>
      b.falsePositiveRate - a.falsePositiveRate ||
      b.maxDiffRatio - a.maxDiffRatio ||
      a.label.localeCompare(b.label) ||
      a.viewport.localeCompare(b.viewport),
  );

  return entries;
}

export function buildStabilityReport(input: {
  iterations: number;
  urls: string[];
  threshold?: number;
  results: StabilityIterationResult[];
  timestamp?: string;
}): StabilityReport {
  const threshold = input.threshold ?? 0;
  const entries = aggregateStability(input.results, { threshold });
  const totalComparisons = entries.reduce((s, e) => s + e.comparisons, 0);
  const totalPositives = entries.reduce((s, e) => s + e.positives, 0);

  return {
    timestamp: input.timestamp ?? new Date().toISOString(),
    iterations: input.iterations,
    urls: input.urls,
    threshold,
    entries,
    totalComparisons,
    totalPositives,
    overallFalsePositiveRate: totalComparisons === 0 ? 0 : totalPositives / totalComparisons,
  };
}

function formatPct(ratio: number): string {
  return `${(ratio * 100).toFixed(2)}%`;
}

export function formatStabilitySummary(report: StabilityReport): string {
  const lines: string[] = [];
  lines.push(`Stability run: ${report.iterations} iterations over ${report.urls.length} URL(s)`);
  lines.push(
    `Overall FP rate: ${formatPct(report.overallFalsePositiveRate)} ` +
      `(${report.totalPositives}/${report.totalComparisons} comparisons above ` +
      `${formatPct(report.threshold)})`,
  );
  lines.push("");
  if (report.entries.length === 0) {
    lines.push("No comparisons recorded.");
    return lines.join("\n");
  }
  lines.push("Per-entry breakdown:");
  for (const e of report.entries) {
    const marker = e.positives === 0 ? "✓" : "✗";
    lines.push(
      `  ${marker} ${e.label} ${e.viewport}: ` +
        `FP ${formatPct(e.falsePositiveRate)} ` +
        `(${e.positives}/${e.comparisons}), ` +
        `max ${formatPct(e.maxDiffRatio)}, ` +
        `mean ${formatPct(e.meanDiffRatio)}`,
    );
  }
  return lines.join("\n");
}

export function buildStabilityHistory(inputs: StabilityHistoryInput[]): StabilityHistory {
  const runs = inputs
    .map((input) => ({
      reportPath: input.reportPath,
      timestamp: input.report.timestamp,
      iterations: input.report.iterations,
      urlCount: input.report.urls.length,
      totalComparisons: input.report.totalComparisons,
      totalPositives: input.report.totalPositives,
      overallFalsePositiveRate: input.report.overallFalsePositiveRate,
    }))
    .sort((a, b) => a.timestamp.localeCompare(b.timestamp) || a.reportPath.localeCompare(b.reportPath))
    .map<StabilityHistoryRun>((run, index, sorted) => {
      const previous = index > 0 ? sorted[index - 1] : undefined;
      return {
        ...run,
        deltaFalsePositiveRate: previous ? run.overallFalsePositiveRate - previous.overallFalsePositiveRate : undefined,
      };
    });

  const best = runs.reduce<StabilityHistoryRun | undefined>(
    (current, run) => (!current || run.overallFalsePositiveRate < current.overallFalsePositiveRate ? run : current),
    undefined,
  );
  const worst = runs.reduce<StabilityHistoryRun | undefined>(
    (current, run) => (!current || run.overallFalsePositiveRate > current.overallFalsePositiveRate ? run : current),
    undefined,
  );

  return {
    runs,
    latest: runs.at(-1),
    best,
    worst,
  };
}

function formatSignedPct(ratio: number | undefined): string {
  if (ratio === undefined) return "-";
  const sign = ratio > 0 ? "+" : "";
  return `${sign}${formatPct(ratio)}`;
}

export function formatStabilityHistorySummary(history: StabilityHistory): string {
  const lines: string[] = [];
  lines.push(`Stability history: ${history.runs.length} run(s)`);
  if (history.runs.length === 0) {
    lines.push("No stability reports provided.");
    return lines.join("\n");
  }

  lines.push(
    `Latest: ${formatPct(history.latest!.overallFalsePositiveRate)} ` +
      `(${history.latest!.totalPositives}/${history.latest!.totalComparisons})`,
  );
  lines.push(`Best: ${formatPct(history.best!.overallFalsePositiveRate)} (${history.best!.reportPath})`);
  lines.push(`Worst: ${formatPct(history.worst!.overallFalsePositiveRate)} (${history.worst!.reportPath})`);
  lines.push("");
  lines.push("| Timestamp | FP rate | Δ vs previous | Positives / Comparisons | URLs | Iterations | Report |");
  lines.push("|---|---:|---:|---:|---:|---:|---|");
  for (const run of history.runs) {
    lines.push(
      `| ${run.timestamp} | ${formatPct(run.overallFalsePositiveRate)} | ` +
        `${formatSignedPct(run.deltaFalsePositiveRate)} | ${run.totalPositives}/${run.totalComparisons} | ` +
        `${run.urlCount} | ${run.iterations} | \`${run.reportPath}\` |`,
    );
  }
  return lines.join("\n");
}
