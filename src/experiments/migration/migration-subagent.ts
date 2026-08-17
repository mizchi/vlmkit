#!/usr/bin/env node
import { readFile, writeFile } from "node:fs/promises";
import { isCliEntry } from "@mizchi/vlmkit-core/plugin/cli-entry.ts";
import { basename, dirname, resolve } from "node:path";
import { mkdir } from "node:fs/promises";
import { extractCss } from "../css-challenge/css-challenge-core.ts";
import {
  buildMigrationFixLoopPrompt,
  selectMigrationFixTarget,
  summarizeMigrationReportConvergence,
  type MigrationCompareReport,
  type MigrationConvergenceStatus,
  type SelectedMigrationFixTarget,
} from "./migration-fix-loop-core.ts";
import type { MigrationFixCandidate } from "./migration-fix-candidates.ts";

export interface MigrationSubagentTask {
  variant: string;
  variantFile: string;
  baselineFile: string;
  viewport: string;
  viewportWidth: number;
  diffRatio: number;
  diffPixels: number;
  categorySummary: string;
  paintTreeSummary: string;
  fixCandidates: MigrationFixCandidate[];
  currentCss: string;
  prompt: string;
}

export interface MigrationSubagentVariantEvaluation {
  variant: string;
  beforeStatus: MigrationConvergenceStatus;
  afterStatus: MigrationConvergenceStatus;
  beforeWorstDiffRatio: number;
  afterWorstDiffRatio: number;
  beforeRemainingResults: number;
  afterRemainingResults: number;
  improved: boolean;
  resolved: boolean;
}

export interface MigrationSubagentEvaluationSummary {
  variantCount: number;
  resolvedCount: number;
  improvedCount: number;
  successRate: number;
  improvementRate: number;
  variants: MigrationSubagentVariantEvaluation[];
}

export interface MigrationSubagentExitStatus {
  exitCode: number;
  reasons: string[];
}

export interface MigrationSubagentThresholdOptions {
  minSuccessRate?: number;
  minImprovementRate?: number;
}

export function selectMigrationFixTargetsByVariant(
  report: MigrationCompareReport,
): SelectedMigrationFixTarget[] {
  return [...new Set(report.results.map((result) => result.variant))]
    .map((variant) => selectMigrationFixTarget(report, { variant }))
    .filter((target): target is SelectedMigrationFixTarget => target !== null);
}

export function buildMigrationSubagentTask(input: {
  baselineFile: string;
  variantFile: string;
  currentCss: string;
  target: SelectedMigrationFixTarget;
}): MigrationSubagentTask {
  return {
    variant: input.target.variant,
    variantFile: input.variantFile,
    baselineFile: input.baselineFile,
    viewport: input.target.viewport,
    viewportWidth: input.target.viewportWidth,
    diffRatio: input.target.diffRatio,
    diffPixels: input.target.diffPixels,
    categorySummary: input.target.categorySummary,
    paintTreeSummary: input.target.paintTreeSummary,
    fixCandidates: input.target.fixCandidates,
    currentCss: input.currentCss,
    prompt: buildMigrationFixLoopPrompt({
      baselineFile: input.baselineFile,
      variantFile: input.variantFile,
      target: input.target,
      currentCss: input.currentCss,
    }),
  };
}

export function summarizeMigrationSubagentEvaluation(
  beforeReport: MigrationCompareReport,
  afterReport: MigrationCompareReport,
): MigrationSubagentEvaluationSummary {
  const beforeConvergence = summarizeMigrationReportConvergence(beforeReport);
  const afterConvergence = summarizeMigrationReportConvergence(afterReport);
  const beforeVariants = new Map(beforeConvergence.variants.map((variant) => [variant.variant, variant]));
  const afterVariants = new Map(afterConvergence.variants.map((variant) => [variant.variant, variant]));

  const variants = [...new Set([
    ...beforeReport.results.map((result) => result.variant),
    ...afterReport.results.map((result) => result.variant),
  ])]
    .sort((a, b) => a.localeCompare(b))
    .map((variant) => {
      const beforeVariant = beforeVariants.get(variant);
      const afterVariant = afterVariants.get(variant);
      const beforeWorstDiffRatio = findWorstDiffRatio(beforeReport, variant);
      const afterWorstDiffRatio = findWorstDiffRatio(afterReport, variant);
      const beforeRemainingResults = beforeVariant?.remainingResults ?? 0;
      const afterRemainingResults = afterVariant?.remainingResults ?? 0;
      const resolved = (afterVariant?.status ?? "remaining") !== "remaining";
      const improved = resolved
        || afterRemainingResults < beforeRemainingResults
        || afterWorstDiffRatio < beforeWorstDiffRatio;

      return {
        variant,
        beforeStatus: beforeVariant?.status ?? "remaining",
        afterStatus: afterVariant?.status ?? "remaining",
        beforeWorstDiffRatio,
        afterWorstDiffRatio,
        beforeRemainingResults,
        afterRemainingResults,
        improved,
        resolved,
      };
    });

  const resolvedCount = variants.filter((variant) => variant.resolved).length;
  const improvedCount = variants.filter((variant) => variant.improved).length;
  const variantCount = variants.length;

  return {
    variantCount,
    resolvedCount,
    improvedCount,
    successRate: variantCount === 0 ? 0 : resolvedCount / variantCount,
    improvementRate: variantCount === 0 ? 0 : improvedCount / variantCount,
    variants,
  };
}

export function determineMigrationSubagentExitStatus(
  summary: MigrationSubagentEvaluationSummary,
  options: MigrationSubagentThresholdOptions,
): MigrationSubagentExitStatus {
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

export function formatMigrationSubagentEvaluationMarkdown(
  summary: MigrationSubagentEvaluationSummary,
  options: { beforeReportPath?: string; afterReportPath?: string } = {},
): string {
  const lines = [
    "## VRT Migration Subagent Evaluation",
    "",
    `- Variants: ${summary.variantCount}`,
    `- Resolved: ${summary.resolvedCount} (${(summary.successRate * 100).toFixed(1)}%)`,
    `- Improved: ${summary.improvedCount} (${(summary.improvementRate * 100).toFixed(1)}%)`,
    `- Success rate: ${(summary.successRate * 100).toFixed(1)}%`,
    `- Improvement rate: ${(summary.improvementRate * 100).toFixed(1)}%`,
  ];

  if (options.beforeReportPath) {
    lines.push(`- Before report: \`${options.beforeReportPath}\``);
  }
  if (options.afterReportPath) {
    lines.push(`- After report: \`${options.afterReportPath}\``);
  }

  lines.push("");
  lines.push("| Variant | Before | After | Worst diff | Result |");
  lines.push("|---|---|---|---|---|");
  for (const variant of summary.variants) {
    const beforePct = `${(variant.beforeWorstDiffRatio * 100).toFixed(2)}%`;
    const afterPct = `${(variant.afterWorstDiffRatio * 100).toFixed(2)}%`;
    const result = variant.resolved ? "resolved" : variant.improved ? "improved" : "unchanged";
    lines.push(`| ${variant.variant} | ${variant.beforeStatus} | ${variant.afterStatus} | ${beforePct} → ${afterPct} | ${result} |`);
  }

  return lines.join("\n");
}

async function main() {
  const [command, ...rest] = process.argv.slice(2);
  if (!command || command === "--help" || command === "-h" || command === "help") {
    console.log(formatMigrationSubagentUsage());
    return;
  }

  if (command === "prepare") {
    await runPrepare(rest);
    return;
  }

  if (command === "evaluate") {
    await runEvaluate(rest);
    return;
  }

  throw new Error(`Unknown command: ${command}`);
}

function formatMigrationSubagentUsage(): string {
  return [
    "Usage:",
    "  vlmkit migration subagent prepare --report path/to/diff-report.json [--variant variant] [--output path] [--format markdown|json]",
    "  vlmkit migration subagent evaluate --before-report before.json --after-report after.json [--output path] [--format markdown|json] [--min-success-rate n] [--min-improvement-rate n]",
  ].join("\n");
}

async function runPrepare(args: string[]) {
  const reportPath = requireValue(args, "--report");
  const variantFilter = optionalValue(args, "--variant");
  const outputPath = optionalValue(args, "--output");
  const format = (optionalValue(args, "--format") ?? "markdown") as "markdown" | "json";
  if (format !== "markdown" && format !== "json") {
    throw new Error("Invalid --format value. Expected 'markdown' or 'json'");
  }

  const report = JSON.parse(await readFile(resolve(reportPath), "utf-8")) as MigrationCompareReport;
  const targets = variantFilter
    ? (() => {
        const target = selectMigrationFixTarget(report, { variant: variantFilter });
        return target ? [target] : [];
      })()
    : selectMigrationFixTargetsByVariant(report);

  const baselinePath = resolveSourcePath(report.dir, report.baseline);
  const baselineFile = basename(baselinePath);
  const tasks: MigrationSubagentTask[] = [];
  for (const target of targets) {
    const variantPath = resolveSourcePath(report.dir, target.variantFile);
    const variantHtml = await readFile(variantPath, "utf-8");
    const currentCss = extractCss(variantHtml);
    if (!currentCss) continue;
    tasks.push(buildMigrationSubagentTask({
      baselineFile,
      variantFile: basename(variantPath),
      currentCss,
      target,
    }));
  }

  const output = format === "json"
    ? JSON.stringify({ tasks }, null, 2)
    : tasks.map((task, index) => [
        `# Task ${index + 1}: ${task.variant} @ ${task.viewport}`,
        "",
        `- Variant file: \`${task.variantFile}\``,
        `- Baseline file: \`${task.baselineFile}\``,
        `- Diff: ${(task.diffRatio * 100).toFixed(2)}% (${task.diffPixels} px)`,
        `- Category: ${task.categorySummary}`,
        `- Paint tree: ${task.paintTreeSummary}`,
        "",
        "```text",
        task.prompt,
        "```",
      ].join("\n")).join("\n\n");

  if (outputPath) {
    const resolvedOutput = resolve(outputPath);
    await mkdir(dirname(resolvedOutput), { recursive: true });
    await writeFile(resolvedOutput, `${output}\n`, "utf-8");
  } else {
    console.log(output);
  }
}

async function runEvaluate(args: string[]) {
  const beforeReportPath = requireValue(args, "--before-report");
  const afterReportPath = requireValue(args, "--after-report");
  const outputPath = optionalValue(args, "--output");
  const format = (optionalValue(args, "--format") ?? "markdown") as "markdown" | "json";
  if (format !== "markdown" && format !== "json") {
    throw new Error("Invalid --format value. Expected 'markdown' or 'json'");
  }

  const minSuccessRate = optionalNumber(args, "--min-success-rate");
  const minImprovementRate = optionalNumber(args, "--min-improvement-rate");
  const beforeReport = JSON.parse(await readFile(resolve(beforeReportPath), "utf-8")) as MigrationCompareReport;
  const afterReport = JSON.parse(await readFile(resolve(afterReportPath), "utf-8")) as MigrationCompareReport;
  const summary = summarizeMigrationSubagentEvaluation(beforeReport, afterReport);
  const exitStatus = determineMigrationSubagentExitStatus(summary, {
    minSuccessRate,
    minImprovementRate,
  });

  const output = format === "json"
    ? JSON.stringify({ summary, exitStatus }, null, 2)
    : [
        formatMigrationSubagentEvaluationMarkdown(summary, { beforeReportPath, afterReportPath }),
        exitStatus.reasons.length > 0
          ? `\n### Threshold Failures\n\n${exitStatus.reasons.map((reason) => `- ${reason}`).join("\n")}`
          : "",
      ].join("\n");

  if (outputPath) {
    const resolvedOutput = resolve(outputPath);
    await mkdir(dirname(resolvedOutput), { recursive: true });
    await writeFile(resolvedOutput, `${output.trimEnd()}\n`, "utf-8");
  } else {
    console.log(output.trimEnd());
  }

  if (exitStatus.exitCode !== 0) {
    process.exit(exitStatus.exitCode);
  }
}

function findWorstDiffRatio(report: MigrationCompareReport, variant: string): number {
  return report.results
    .filter((result) => result.variant === variant)
    .reduce((max, result) => Math.max(max, result.diffRatio), 0);
}

function resolveSourcePath(dir: string | undefined, file: string): string {
  if (file.startsWith("/")) return file;
  return resolve(dir ?? ".", file);
}

function optionalValue(args: string[], flag: string): string | undefined {
  const index = args.indexOf(flag);
  if (index < 0) return undefined;
  return args[index + 1];
}

function requireValue(args: string[], flag: string): string {
  const value = optionalValue(args, flag);
  if (!value) {
    throw new Error(`Missing value for ${flag}`);
  }
  return value;
}

function optionalNumber(args: string[], flag: string): number | undefined {
  const value = optionalValue(args, flag);
  if (value == null) return undefined;
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 0 || parsed > 1) {
    throw new Error(`Invalid ${flag} value`);
  }
  return parsed;
}

if (isCliEntry(import.meta.url, "migration-subagent")) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  });
}
