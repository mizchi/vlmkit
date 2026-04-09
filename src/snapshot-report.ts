#!/usr/bin/env node
import { readFile, writeFile } from "node:fs/promises";

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

export interface SnapshotReportExitStatus {
  exitCode: number;
  reasons: string[];
}

export interface SnapshotReportThresholdOptions {
  maxFalsePositiveRate?: number;
  maxDiffRatio?: number;
}

export interface ParsedSnapshotReportCliArgs extends SnapshotReportThresholdOptions {
  reportPath: string;
  githubStepSummaryPath?: string;
  format: "markdown" | "json";
}

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

export function parseSnapshotReportCliArgs(args: string[]): ParsedSnapshotReportCliArgs {
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
    reportPath,
    maxFalsePositiveRate,
    maxDiffRatio,
    githubStepSummaryPath,
    format,
  };
}

export function formatSnapshotReportUsage(exitCode = 1): string {
  const body = [
    "Usage:",
    "  node src/snapshot-report.ts <snapshot-report.json> [--format markdown|json] [--max-false-positive-rate n] [--max-diff-ratio n] [--github-step-summary path]",
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
    await writeFile(options.githubStepSummaryPath, `${output.trimEnd()}\n`, "utf-8");
  }

  if (exitStatus.exitCode !== 0) {
    process.exit(exitStatus.exitCode);
  }
}

function parseRatioLike(value: string | undefined, message: string): number {
  const parsed = Number(value);
  if (value == null || !Number.isFinite(parsed) || parsed < 0 || parsed > 1) {
    throw new Error(message);
  }
  return parsed;
}

if (process.argv[1]?.endsWith("snapshot-report.ts")) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  });
}
