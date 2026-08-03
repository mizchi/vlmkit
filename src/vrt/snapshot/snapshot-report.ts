#!/usr/bin/env node
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname } from "node:path";

export interface SnapshotReportEntry {
  label: string;
  viewport: string;
  isNew: boolean;
  diffRatio?: number;
  shiftOnly?: boolean;
}

export interface SnapshotReportDocument {
  timestamp: string;
  urls: string[];
  labels: string[];
  options?: {
    threshold?: number;
    failOnDiff?: boolean;
    failOnNewBaseline?: boolean;
    maxDiffRatio?: number | null;
    configPath?: string | null;
  };
  results: SnapshotReportEntry[];
  exitStatus?: {
    exitCode: number;
    reasons: string[];
  };
}

export interface SnapshotReportMetrics {
  totalCount: number;
  comparedCount: number;
  newBaselineCount: number;
  diffCount: number;
  cleanCount: number;
  shiftOnlyCount: number;
  falsePositiveRate: number;
  maxDiffRatio: number;
  averageDiffRatio: number;
  labelsWithDiff: string[];
  worstDiff?: {
    label: string;
    viewport: string;
    diffRatio: number;
    shiftOnly: boolean;
  };
}

export type SnapshotStatusMatrixStatus =
  | "pass"
  | "diff"
  | "shift-only"
  | "new-baseline"
  | "missing";

export interface SnapshotStatusMatrixCell {
  component: string;
  viewport: string;
  status: SnapshotStatusMatrixStatus;
  isNew: boolean;
  diffRatio?: number;
  shiftOnly: boolean;
}

export interface SnapshotStatusMatrixRow {
  component: string;
  cells: SnapshotStatusMatrixCell[];
  worstStatus: SnapshotStatusMatrixStatus;
  maxDiffRatio: number;
}

export interface SnapshotStatusMatrixSummary {
  totalCells: number;
  passCount: number;
  diffCount: number;
  shiftOnlyCount: number;
  newBaselineCount: number;
  missingCount: number;
  maxDiffRatio: number;
}

export interface SnapshotStatusMatrix {
  timestamp: string;
  components: string[];
  viewports: string[];
  rows: SnapshotStatusMatrixRow[];
  summary: SnapshotStatusMatrixSummary;
}

export interface SnapshotStatusMatrixOptions {
  labels?: string[];
  viewports?: string[];
}

export interface SnapshotReportExitStatus {
  exitCode: number;
  reasons: string[];
}

export interface SnapshotReportThresholdOptions {
  maxFalsePositiveRate?: number;
  maxDiffRatio?: number;
}

export type SnapshotReportEvaluationResult =
  | "resolved"
  | "improved"
  | "unchanged"
  | "worsened"
  | "missing"
  | "new-baseline";

export interface SnapshotReportEvaluationTarget {
  label: string;
  viewport: string;
  beforeDiffRatio: number;
  beforeShiftOnly: boolean;
  afterDiffRatio?: number;
  afterShiftOnly?: boolean;
  resolved: boolean;
  improved: boolean;
  result: SnapshotReportEvaluationResult;
}

export interface SnapshotReportEvaluationSummary {
  targetCount: number;
  resolvedCount: number;
  improvedCount: number;
  worsenedCount: number;
  missingCount: number;
  successRate: number;
  improvementRate: number;
  targets: SnapshotReportEvaluationTarget[];
}

export interface SnapshotReportEvaluationThresholdOptions {
  minSuccessRate?: number;
  minImprovementRate?: number;
}

export interface ParsedSnapshotReportSummaryCliArgs extends SnapshotReportThresholdOptions {
  mode: "summary";
  reportPath: string;
  githubStepSummaryPath?: string;
  format: "markdown" | "json";
}

export interface ParsedSnapshotReportEvaluateCliArgs extends SnapshotReportEvaluationThresholdOptions {
  mode: "evaluate";
  beforeReportPath: string;
  afterReportPath: string;
  outputPath?: string;
  githubStepSummaryPath?: string;
  format: "markdown" | "json";
}

export type ParsedSnapshotReportCliArgs =
  | ParsedSnapshotReportSummaryCliArgs
  | ParsedSnapshotReportEvaluateCliArgs;

export function summarizeSnapshotReport(report: SnapshotReportDocument): SnapshotReportMetrics {
  const compared = report.results.filter((entry) => !entry.isNew);
  const changed = compared.filter((entry) => (entry.diffRatio ?? 0) > 0);
  const totalDiffRatio = changed.reduce((sum, entry) => sum + (entry.diffRatio ?? 0), 0);
  const worst = changed.reduce<SnapshotReportMetrics["worstDiff"]>((current, entry) => {
    const next = {
      label: entry.label,
      viewport: entry.viewport,
      diffRatio: entry.diffRatio ?? 0,
      shiftOnly: entry.shiftOnly ?? false,
    };
    if (!current || next.diffRatio > current.diffRatio) {
      return next;
    }
    return current;
  }, undefined);

  return {
    totalCount: report.results.length,
    comparedCount: compared.length,
    newBaselineCount: report.results.length - compared.length,
    diffCount: changed.length,
    cleanCount: compared.length - changed.length,
    shiftOnlyCount: changed.filter((entry) => entry.shiftOnly === true).length,
    falsePositiveRate: compared.length === 0 ? 0 : changed.length / compared.length,
    maxDiffRatio: changed.reduce((max, entry) => Math.max(max, entry.diffRatio ?? 0), 0),
    averageDiffRatio: changed.length === 0 ? 0 : totalDiffRatio / changed.length,
    labelsWithDiff: [...new Set(changed.map((entry) => entry.label))].sort((a, b) => a.localeCompare(b)),
    worstDiff: worst,
  };
}

function uniqueInOrder(values: string[]): string[] {
  return [...new Set(values.filter(Boolean))];
}

function snapshotMatrixCellStatus(entry: SnapshotReportEntry | undefined): SnapshotStatusMatrixStatus {
  if (!entry) return "missing";
  if (entry.isNew) return "new-baseline";
  if ((entry.diffRatio ?? 0) <= 0) return "pass";
  if (entry.shiftOnly) return "shift-only";
  return "diff";
}

const SNAPSHOT_MATRIX_STATUS_RANK: Record<SnapshotStatusMatrixStatus, number> = {
  pass: 0,
  "shift-only": 1,
  diff: 2,
  "new-baseline": 3,
  missing: 4,
};

function pickWorstSnapshotStatus(
  statuses: SnapshotStatusMatrixStatus[],
): SnapshotStatusMatrixStatus {
  return statuses.reduce<SnapshotStatusMatrixStatus>((worst, status) =>
    SNAPSHOT_MATRIX_STATUS_RANK[status] > SNAPSHOT_MATRIX_STATUS_RANK[worst] ? status : worst,
  "pass");
}

export function buildSnapshotStatusMatrix(
  report: SnapshotReportDocument,
  options: SnapshotStatusMatrixOptions = {},
): SnapshotStatusMatrix {
  const components = options.labels ?? uniqueInOrder([
    ...report.labels,
    ...report.results.map((entry) => entry.label),
  ]);
  const viewports = options.viewports ?? uniqueInOrder(report.results.map((entry) => entry.viewport));
  const byKey = new Map(report.results.map((entry) => [snapshotEntryKey(entry), entry]));
  const rows = components.map((component): SnapshotStatusMatrixRow => {
    const cells = viewports.map((viewport): SnapshotStatusMatrixCell => {
      const entry = byKey.get(snapshotEntryKey({ label: component, viewport }));
      return {
        component,
        viewport,
        status: snapshotMatrixCellStatus(entry),
        isNew: entry?.isNew ?? false,
        diffRatio: entry?.diffRatio,
        shiftOnly: entry?.shiftOnly ?? false,
      };
    });
    return {
      component,
      cells,
      worstStatus: pickWorstSnapshotStatus(cells.map((cell) => cell.status)),
      maxDiffRatio: cells.reduce((max, cell) => Math.max(max, cell.diffRatio ?? 0), 0),
    };
  });
  const cells = rows.flatMap((row) => row.cells);
  return {
    timestamp: report.timestamp,
    components,
    viewports,
    rows,
    summary: {
      totalCells: cells.length,
      passCount: cells.filter((cell) => cell.status === "pass").length,
      diffCount: cells.filter((cell) => cell.status === "diff").length,
      shiftOnlyCount: cells.filter((cell) => cell.status === "shift-only").length,
      newBaselineCount: cells.filter((cell) => cell.status === "new-baseline").length,
      missingCount: cells.filter((cell) => cell.status === "missing").length,
      maxDiffRatio: cells.reduce((max, cell) => Math.max(max, cell.diffRatio ?? 0), 0),
    },
  };
}

function snapshotEntryKey(entry: { label: string; viewport: string }): string {
  return `${entry.label}\u0000${entry.viewport}`;
}

function snapshotEntryDiffRatio(entry: SnapshotReportEntry | undefined): number | undefined {
  if (!entry || entry.isNew) return undefined;
  return entry.diffRatio ?? 0;
}

function classifySnapshotEvaluationTarget(
  before: SnapshotReportEntry,
  after: SnapshotReportEntry | undefined,
): SnapshotReportEvaluationTarget {
  const beforeDiffRatio = before.diffRatio ?? 0;
  const afterDiffRatio = snapshotEntryDiffRatio(after);
  let result: SnapshotReportEvaluationResult;

  if (!after) {
    result = "missing";
  } else if (after.isNew) {
    result = "new-baseline";
  } else if ((afterDiffRatio ?? 0) <= 0) {
    result = "resolved";
  } else if ((afterDiffRatio ?? 0) < beforeDiffRatio) {
    result = "improved";
  } else if ((afterDiffRatio ?? 0) > beforeDiffRatio) {
    result = "worsened";
  } else {
    result = "unchanged";
  }

  return {
    label: before.label,
    viewport: before.viewport,
    beforeDiffRatio,
    beforeShiftOnly: before.shiftOnly ?? false,
    afterDiffRatio,
    afterShiftOnly: after?.shiftOnly,
    resolved: result === "resolved",
    improved: result === "resolved" || result === "improved",
    result,
  };
}

export function summarizeSnapshotReportEvaluation(
  beforeReport: SnapshotReportDocument,
  afterReport: SnapshotReportDocument,
): SnapshotReportEvaluationSummary {
  const afterByKey = new Map(afterReport.results.map((entry) => [snapshotEntryKey(entry), entry]));
  const targets = beforeReport.results
    .filter((entry) => !entry.isNew && (entry.diffRatio ?? 0) > 0)
    .map((entry) => classifySnapshotEvaluationTarget(entry, afterByKey.get(snapshotEntryKey(entry))))
    .sort((a, b) => a.label.localeCompare(b.label) || a.viewport.localeCompare(b.viewport));

  const targetCount = targets.length;
  const resolvedCount = targets.filter((target) => target.resolved).length;
  const improvedCount = targets.filter((target) => target.improved).length;

  return {
    targetCount,
    resolvedCount,
    improvedCount,
    worsenedCount: targets.filter((target) => target.result === "worsened").length,
    missingCount: targets.filter((target) => target.result === "missing" || target.result === "new-baseline").length,
    successRate: targetCount === 0 ? 1 : resolvedCount / targetCount,
    improvementRate: targetCount === 0 ? 1 : improvedCount / targetCount,
    targets,
  };
}

export function determineSnapshotReportExitStatus(
  metrics: SnapshotReportMetrics,
  options: SnapshotReportThresholdOptions,
): SnapshotReportExitStatus {
  const reasons: string[] = [];

  if (options.maxFalsePositiveRate !== undefined && metrics.falsePositiveRate > options.maxFalsePositiveRate) {
    reasons.push(
      `False positive rate ${(metrics.falsePositiveRate * 100).toFixed(1)}% exceeds ${(options.maxFalsePositiveRate * 100).toFixed(1)}%`,
    );
  }

  if (options.maxDiffRatio !== undefined && metrics.maxDiffRatio > options.maxDiffRatio) {
    reasons.push(
      `Max diff ratio ${(metrics.maxDiffRatio * 100).toFixed(2)}% exceeds ${(options.maxDiffRatio * 100).toFixed(2)}%`,
    );
  }

  return {
    exitCode: reasons.length > 0 ? 1 : 0,
    reasons,
  };
}

export function determineSnapshotReportEvaluationExitStatus(
  summary: SnapshotReportEvaluationSummary,
  options: SnapshotReportEvaluationThresholdOptions,
): SnapshotReportExitStatus {
  const reasons: string[] = [];

  if (options.minSuccessRate !== undefined && summary.successRate < options.minSuccessRate) {
    reasons.push(
      `Success rate ${(summary.successRate * 100).toFixed(1)}% is below ${(options.minSuccessRate * 100).toFixed(1)}%`,
    );
  }

  if (options.minImprovementRate !== undefined && summary.improvementRate < options.minImprovementRate) {
    reasons.push(
      `Improvement rate ${(summary.improvementRate * 100).toFixed(1)}% is below ${(options.minImprovementRate * 100).toFixed(1)}%`,
    );
  }

  return {
    exitCode: reasons.length > 0 ? 1 : 0,
    reasons,
  };
}

export function formatSnapshotSummaryMarkdown(
  metrics: SnapshotReportMetrics,
  options: { reportPath?: string } = {},
): string {
  const lines = [
    "## VRT Snapshot False Positive Report",
    "",
    `- Compared screenshots: ${metrics.comparedCount}`,
    `- New baselines: ${metrics.newBaselineCount}`,
    `- Diff > 0: ${metrics.diffCount}`,
    `- False positive rate: ${(metrics.falsePositiveRate * 100).toFixed(1)}%`,
    `- Max diff ratio: ${(metrics.maxDiffRatio * 100).toFixed(2)}%`,
    `- Shift-only diffs: ${metrics.shiftOnlyCount}`,
  ];

  if (metrics.worstDiff) {
    lines.push(`- Worst diff: ${metrics.worstDiff.label} / ${metrics.worstDiff.viewport} (${(metrics.worstDiff.diffRatio * 100).toFixed(2)}%)`);
  }

  if (metrics.labelsWithDiff.length > 0) {
    lines.push(`- Labels with diff: ${metrics.labelsWithDiff.join(", ")}`);
  }

  if (options.reportPath) {
    lines.push(`- Report: \`${options.reportPath}\``);
  }

  return lines.join("\n");
}

function formatPct(ratio: number): string {
  return `${(ratio * 100).toFixed(1)}%`;
}

function formatDiffPct(ratio: number | undefined): string {
  return ratio === undefined ? "-" : `${(ratio * 100).toFixed(2)}%`;
}

export function formatSnapshotReportEvaluationMarkdown(
  summary: SnapshotReportEvaluationSummary,
  options: { beforeReportPath?: string; afterReportPath?: string } = {},
): string {
  const lines = [
    "## VRT Snapshot Fix Evaluation",
    "",
    `- Targets: ${summary.targetCount}`,
    `- Resolved: ${summary.resolvedCount} (${formatPct(summary.successRate)})`,
    `- Improved: ${summary.improvedCount} (${formatPct(summary.improvementRate)})`,
    `- Worsened: ${summary.worsenedCount}`,
    `- Missing/new-baseline after entries: ${summary.missingCount}`,
    `- Success rate: ${formatPct(summary.successRate)}`,
    `- Improvement rate: ${formatPct(summary.improvementRate)}`,
  ];

  if (options.beforeReportPath) {
    lines.push(`- Before report: \`${options.beforeReportPath}\``);
  }
  if (options.afterReportPath) {
    lines.push(`- After report: \`${options.afterReportPath}\``);
  }

  lines.push("");
  lines.push("| Target | Before diff | After diff | Result |");
  lines.push("|---|---:|---:|---|");
  for (const target of summary.targets) {
    lines.push(
      `| ${target.label} / ${target.viewport} | ${formatDiffPct(target.beforeDiffRatio)} | ` +
      `${formatDiffPct(target.afterDiffRatio)} | ${target.result} |`,
    );
  }

  return lines.join("\n");
}

export function parseSnapshotReportCliArgs(args: string[]): ParsedSnapshotReportCliArgs {
  if (args[0] === "evaluate") {
    return parseSnapshotReportEvaluateCliArgs(args.slice(1));
  }
  return parseSnapshotReportSummaryCliArgs(args);
}

function parseSnapshotReportSummaryCliArgs(args: string[]): ParsedSnapshotReportSummaryCliArgs {
  const positional: string[] = [];
  let maxFalsePositiveRate: number | undefined;
  let maxDiffRatio: number | undefined;
  let githubStepSummaryPath: string | undefined;
  let format: "markdown" | "json" = "markdown";

  for (let i = 0; i < args.length; i++) {
    const arg = args[i]!;
    switch (arg) {
      case "--max-false-positive-rate": {
        const value = args[++i];
        maxFalsePositiveRate = parseRatioLike(value, "Invalid --max-false-positive-rate value");
        break;
      }
      case "--max-diff-ratio": {
        const value = args[++i];
        maxDiffRatio = parseRatioLike(value, "Invalid --max-diff-ratio value");
        break;
      }
      case "--github-step-summary": {
        const value = args[++i];
        if (!value) throw new Error("Missing value for --github-step-summary");
        githubStepSummaryPath = value;
        break;
      }
      case "--format": {
        const value = args[++i];
        if (value !== "markdown" && value !== "json") {
          throw new Error("Invalid --format value. Expected 'markdown' or 'json'");
        }
        format = value;
        break;
      }
      case "--help":
      case "-h":
        throw new Error(formatSnapshotReportUsage(0));
      default:
        if (arg.startsWith("--")) {
          throw new Error(`Unknown option: ${arg}`);
        }
        positional.push(arg);
        break;
    }
  }

  const reportPath = positional[0];
  if (!reportPath) {
    throw new Error("Missing snapshot report path");
  }
  if (positional.length > 1) {
    throw new Error("Too many positional arguments");
  }

  return {
    mode: "summary",
    reportPath,
    maxFalsePositiveRate,
    maxDiffRatio,
    githubStepSummaryPath,
    format,
  };
}

function parseSnapshotReportEvaluateCliArgs(args: string[]): ParsedSnapshotReportEvaluateCliArgs {
  let beforeReportPath: string | undefined;
  let afterReportPath: string | undefined;
  let minSuccessRate: number | undefined;
  let minImprovementRate: number | undefined;
  let outputPath: string | undefined;
  let githubStepSummaryPath: string | undefined;
  let format: "markdown" | "json" = "markdown";

  for (let i = 0; i < args.length; i++) {
    const arg = args[i]!;
    switch (arg) {
      case "--before-report": {
        beforeReportPath = requireOptionValue(args[++i], "--before-report");
        break;
      }
      case "--after-report": {
        afterReportPath = requireOptionValue(args[++i], "--after-report");
        break;
      }
      case "--min-success-rate": {
        minSuccessRate = parseRatioLike(args[++i], "Invalid --min-success-rate value");
        break;
      }
      case "--min-improvement-rate": {
        minImprovementRate = parseRatioLike(args[++i], "Invalid --min-improvement-rate value");
        break;
      }
      case "--output": {
        outputPath = requireOptionValue(args[++i], "--output");
        break;
      }
      case "--github-step-summary": {
        githubStepSummaryPath = requireOptionValue(args[++i], "--github-step-summary");
        break;
      }
      case "--format": {
        const value = args[++i];
        if (value !== "markdown" && value !== "json") {
          throw new Error("Invalid --format value. Expected 'markdown' or 'json'");
        }
        format = value;
        break;
      }
      case "--help":
      case "-h":
        throw new Error(formatSnapshotReportUsage(0));
      default:
        if (arg.startsWith("--")) {
          throw new Error(`Unknown option: ${arg}`);
        }
        throw new Error(`Unexpected positional argument for evaluate: ${arg}`);
    }
  }

  if (!beforeReportPath) throw new Error("Missing value for --before-report");
  if (!afterReportPath) throw new Error("Missing value for --after-report");

  return {
    mode: "evaluate",
    beforeReportPath,
    afterReportPath,
    minSuccessRate,
    minImprovementRate,
    outputPath,
    githubStepSummaryPath,
    format,
  };
}

export function formatSnapshotReportUsage(exitCode = 1): string {
  const body = [
    "Usage:",
    "  vlmkit snapshot report <snapshot-report.json> [--format markdown|json] [--max-false-positive-rate n] [--max-diff-ratio n] [--github-step-summary path]",
    "  vlmkit snapshot report evaluate --before-report before.json --after-report after.json [--format markdown|json] [--output path] [--min-success-rate n] [--min-improvement-rate n]",
  ].join("\n");
  return exitCode === 0 ? body : `${body}\n`;
}

export function parseSnapshotReport(raw: string): SnapshotReportDocument {
  const parsed = JSON.parse(raw) as SnapshotReportDocument;
  if (!parsed || typeof parsed !== "object" || !Array.isArray(parsed.results)) {
    throw new Error("Invalid snapshot report JSON");
  }
  return parsed;
}

async function main() {
  const argv = process.argv.slice(2);
  if (argv.length === 0) {
    console.error(formatSnapshotReportUsage());
    process.exit(1);
  }
  if (argv.includes("--help") || argv.includes("-h")) {
    console.log(formatSnapshotReportUsage(0));
    return;
  }

  const options = parseSnapshotReportCliArgs(argv);
  if (options.mode === "evaluate") {
    await runEvaluate(options);
    return;
  }

  await runSummary(options);
}

async function runSummary(options: ParsedSnapshotReportSummaryCliArgs) {
  const raw = await readFile(options.reportPath, "utf-8");
  const report = parseSnapshotReport(raw);
  const metrics = summarizeSnapshotReport(report);
  const exitStatus = determineSnapshotReportExitStatus(metrics, options);

  const output = options.format === "json"
    ? JSON.stringify({ metrics, exitStatus }, null, 2)
    : [
        formatSnapshotSummaryMarkdown(metrics, { reportPath: options.reportPath }),
        exitStatus.reasons.length > 0
          ? `\n### Threshold Failures\n\n${exitStatus.reasons.map((reason) => `- ${reason}`).join("\n")}`
          : "",
      ].join("\n");

  console.log(output.trimEnd());

  if (options.githubStepSummaryPath) {
    await writeOutput(options.githubStepSummaryPath, output);
  }

  if (exitStatus.exitCode !== 0) {
    process.exit(exitStatus.exitCode);
  }
}

async function runEvaluate(options: ParsedSnapshotReportEvaluateCliArgs) {
  const beforeReport = parseSnapshotReport(await readFile(options.beforeReportPath, "utf-8"));
  const afterReport = parseSnapshotReport(await readFile(options.afterReportPath, "utf-8"));
  const summary = summarizeSnapshotReportEvaluation(beforeReport, afterReport);
  const exitStatus = determineSnapshotReportEvaluationExitStatus(summary, {
    minSuccessRate: options.minSuccessRate,
    minImprovementRate: options.minImprovementRate,
  });

  const output = options.format === "json"
    ? JSON.stringify({ summary, exitStatus }, null, 2)
    : [
        formatSnapshotReportEvaluationMarkdown(summary, {
          beforeReportPath: options.beforeReportPath,
          afterReportPath: options.afterReportPath,
        }),
        exitStatus.reasons.length > 0
          ? `\n### Threshold Failures\n\n${exitStatus.reasons.map((reason) => `- ${reason}`).join("\n")}`
          : "",
      ].join("\n");

  if (options.outputPath) {
    await writeOutput(options.outputPath, output);
  } else {
    console.log(output.trimEnd());
  }

  if (options.githubStepSummaryPath) {
    await writeOutput(options.githubStepSummaryPath, output);
  }

  if (exitStatus.exitCode !== 0) {
    process.exit(exitStatus.exitCode);
  }
}

async function writeOutput(path: string, output: string) {
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, `${output.trimEnd()}\n`, "utf-8");
}

function parseRatioLike(value: string | undefined, message: string): number {
  const parsed = Number(value);
  if (value == null || !Number.isFinite(parsed) || parsed < 0 || parsed > 1) {
    throw new Error(message);
  }
  return parsed;
}

function requireOptionValue(value: string | undefined, flag: string): string {
  if (!value) {
    throw new Error(`Missing value for ${flag}`);
  }
  return value;
}

if (process.env.__VRT_DISPATCHER_LEAF__ === "snapshot-report" || process.argv[1]?.endsWith("snapshot-report.ts")) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  });
}
