#!/usr/bin/env node
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { basename, dirname, resolve } from "node:path";
import { extractCss, replaceCss } from "../css-challenge/css-challenge-core.ts";
import {
  summarizeMigrationReportConvergence,
  type MigrationCompareReport,
  type MigrationConvergenceStatus,
} from "./migration-fix-loop-core.ts";
import {
  buildMigrationSubagentTask,
  formatMigrationSubagentEvaluationMarkdown,
  selectMigrationFixTargetsByVariant,
  summarizeMigrationSubagentEvaluation,
  type MigrationSubagentEvaluationSummary,
  type MigrationSubagentTask,
} from "./migration-subagent.ts";
import type { MigrationCompareOptions } from "./migration-compare.ts";

export interface MigrationBlindScenario {
  id: string;
  title: string;
  dir: string;
  baseline: string;
  blindTarget: string;
  reference: string;
  successCriteria: {
    maxDiffRatio: number;
    maxRounds: number;
  };
}

export interface MigrationBlindManifest {
  scenarios: MigrationBlindScenario[];
}

export interface MigrationBlindComparePlanOptions {
  outputDir?: string;
  enablePaintTree?: boolean;
  autoDiscover?: boolean;
  approvalPath?: string;
  strict?: boolean;
}

export interface MigrationBlindPreparation {
  scenario: MigrationBlindScenario;
  reportPath: string;
  outputDir: string;
  compareOptions: MigrationCompareOptions;
  tasks: MigrationSubagentTask[];
}

export interface MigrationBlindSuccessSummary {
  scenarioId: string;
  scenarioTitle: string;
  blindTarget: string;
  reference: string;
  roundsUsed: number;
  maxRounds: number;
  targetDiffRatio: number;
  beforeWorstDiffRatio: number;
  finalWorstDiffRatio: number;
  withinDiffThreshold: boolean;
  withinRoundBudget: boolean;
  passed: boolean;
  reasons: string[];
  convergenceStatus: MigrationConvergenceStatus;
  subagent: MigrationSubagentEvaluationSummary;
}

export interface MigrationBlindSoloResult {
  scenario: MigrationBlindScenario;
  outputPath: string;
  reportPath: string;
}

export function parseMigrationBlindManifest(raw: string): MigrationBlindManifest {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch (error) {
    throw new Error(`Invalid blind manifest JSON: ${String(error)}`);
  }

  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error("Blind manifest must be an object");
  }

  const record = parsed as Record<string, unknown>;
  if (!Array.isArray(record.scenarios)) {
    throw new Error("Blind manifest scenarios must be an array");
  }

  return {
    scenarios: record.scenarios.map((entry, index) => parseScenario(entry, index)),
  };
}

export function selectMigrationBlindScenario(
  manifest: MigrationBlindManifest,
  id: string,
): MigrationBlindScenario | undefined {
  return manifest.scenarios.find((scenario) => scenario.id === id);
}

export function summarizeMigrationBlindScenarios(manifest: MigrationBlindManifest): Array<{
  id: string;
  title: string;
  dir: string;
  baseline: string;
  blindTarget: string;
  reference: string;
}> {
  return manifest.scenarios.map((scenario) => ({
    id: scenario.id,
    title: scenario.title,
    dir: scenario.dir,
    baseline: scenario.baseline,
    blindTarget: scenario.blindTarget,
    reference: scenario.reference,
  }));
}

export function formatMigrationBlindScenarioMarkdown(
  scenario: MigrationBlindScenario,
): string {
  return [
    `## Blind Scenario: ${scenario.title}`,
    "",
    `- ID: \`${scenario.id}\``,
    `- Fixture dir: \`${scenario.dir}\``,
    `- Baseline: \`${scenario.baseline}\``,
    `- Blind target: \`${scenario.blindTarget}\``,
    `- Reference: \`${scenario.reference}\``,
    `- Success criteria: diff < ${(scenario.successCriteria.maxDiffRatio * 100).toFixed(1)}% within ${scenario.successCriteria.maxRounds} rounds`,
  ].join("\n");
}

export function synthesizeMigrationBlindReferenceFix(
  blindHtml: string,
  referenceHtml: string,
): string {
  const blindCss = extractCss(blindHtml);
  const referenceCss = extractCss(referenceHtml);
  if (!blindCss) {
    throw new Error("Blind target HTML is missing <style id=\"target-css\">");
  }
  if (!referenceCss) {
    throw new Error("Reference HTML is missing <style id=\"target-css\">");
  }
  return replaceCss(blindHtml, blindCss, referenceCss);
}

export function buildMigrationBlindCompareOptions(
  scenario: MigrationBlindScenario,
  options: MigrationBlindComparePlanOptions = {},
): MigrationCompareOptions {
  const autoDiscover = options.autoDiscover ?? true;
  return {
    dir: scenario.dir,
    baseline: scenario.baseline,
    variants: [scenario.blindTarget],
    outputDir: options.outputDir ?? resolve("test-results", "migration", "blind", scenario.id),
    autoDiscover,
    discoverBackend: "auto",
    maxViewports: 15,
    randomSamples: 0,
    approvalPath: options.approvalPath ?? "",
    strict: options.strict ?? false,
    paintTreeUrl: "ws://127.0.0.1:9222",
    enablePaintTree: options.enablePaintTree ?? false,
  };
}

export function evaluateMigrationBlindSuccess(input: {
  scenario: MigrationBlindScenario;
  beforeReport: MigrationCompareReport;
  afterReport: MigrationCompareReport;
  roundsUsed: number;
}): MigrationBlindSuccessSummary {
  const subagent = summarizeMigrationSubagentEvaluation(input.beforeReport, input.afterReport);
  const convergence = summarizeMigrationReportConvergence(input.afterReport);
  const beforeWorstDiffRatio = findWorstDiffRatio(input.beforeReport);
  const finalWorstDiffRatio = findWorstDiffRatio(input.afterReport);
  const withinDiffThreshold = finalWorstDiffRatio <= input.scenario.successCriteria.maxDiffRatio;
  const withinRoundBudget = input.roundsUsed <= input.scenario.successCriteria.maxRounds;
  const reasons: string[] = [];

  if (!withinDiffThreshold) {
    reasons.push(
      `Final worst diff ${(finalWorstDiffRatio * 100).toFixed(2)}% is above ${(input.scenario.successCriteria.maxDiffRatio * 100).toFixed(1)}%`,
    );
  }
  if (!withinRoundBudget) {
    reasons.push(`Rounds used ${input.roundsUsed} exceed ${input.scenario.successCriteria.maxRounds} rounds`);
  }

  return {
    scenarioId: input.scenario.id,
    scenarioTitle: input.scenario.title,
    blindTarget: input.scenario.blindTarget,
    reference: input.scenario.reference,
    roundsUsed: input.roundsUsed,
    maxRounds: input.scenario.successCriteria.maxRounds,
    targetDiffRatio: input.scenario.successCriteria.maxDiffRatio,
    beforeWorstDiffRatio,
    finalWorstDiffRatio,
    withinDiffThreshold,
    withinRoundBudget,
    passed: reasons.length === 0,
    reasons,
    convergenceStatus: convergence.status,
    subagent,
  };
}

export function formatMigrationBlindPreparationMarkdown(
  preparation: MigrationBlindPreparation,
): string {
  const lines = [
    `## Blind Scenario Preparation: ${preparation.scenario.title}`,
    "",
    `- ID: \`${preparation.scenario.id}\``,
    `- Report: \`${preparation.reportPath}\``,
    `- Output dir: \`${preparation.outputDir}\``,
    `- Blind target: \`${preparation.scenario.blindTarget}\``,
    `- Reference: \`${preparation.scenario.reference}\``,
    `- Success criteria: diff < ${(preparation.scenario.successCriteria.maxDiffRatio * 100).toFixed(1)}% within ${preparation.scenario.successCriteria.maxRounds} rounds`,
    "",
  ];

  if (preparation.tasks.length === 0) {
    lines.push("_No writable CSS task was extracted from the blind target._");
    return lines.join("\n");
  }

  preparation.tasks.forEach((task, index) => {
    lines.push(`# Task ${index + 1}: ${task.variant} @ ${task.viewport}`);
    lines.push("");
    lines.push(`- Variant file: \`${task.variantFile}\``);
    lines.push(`- Baseline file: \`${task.baselineFile}\``);
    lines.push(`- Diff: ${(task.diffRatio * 100).toFixed(2)}% (${task.diffPixels} px)`);
    lines.push(`- Category: ${task.categorySummary}`);
    lines.push(`- Paint tree: ${task.paintTreeSummary}`);
    lines.push("");
    lines.push("```text");
    lines.push(task.prompt);
    lines.push("```");
    if (index < preparation.tasks.length - 1) {
      lines.push("");
    }
  });

  return lines.join("\n");
}

export function formatMigrationBlindSuccessMarkdown(
  summary: MigrationBlindSuccessSummary,
  options: { beforeReportPath?: string; afterReportPath?: string } = {},
): string {
  const lines = [
    "## Blind Scenario Evaluation",
    "",
    `- Scenario: ${summary.scenarioTitle} (\`${summary.scenarioId}\`)`,
    `- Result: ${summary.passed ? "PASS" : "FAIL"}`,
    `- Blind target: \`${summary.blindTarget}\``,
    `- Reference: \`${summary.reference}\``,
    `- Initial worst diff: ${(summary.beforeWorstDiffRatio * 100).toFixed(2)}%`,
    `- Final worst diff: ${(summary.finalWorstDiffRatio * 100).toFixed(2)}%`,
    `- Threshold: ${(summary.targetDiffRatio * 100).toFixed(1)}%`,
    `- Rounds used: ${summary.roundsUsed} / ${summary.maxRounds}`,
    `- Convergence: ${summary.convergenceStatus}`,
    `- Variant success rate: ${(summary.subagent.successRate * 100).toFixed(1)}%`,
    `- Variant improvement rate: ${(summary.subagent.improvementRate * 100).toFixed(1)}%`,
  ];

  if (options.beforeReportPath) {
    lines.push(`- Before report: \`${options.beforeReportPath}\``);
  }
  if (options.afterReportPath) {
    lines.push(`- After report: \`${options.afterReportPath}\``);
  }
  if (summary.reasons.length > 0) {
    lines.push("");
    lines.push("### Threshold Failures");
    lines.push("");
    for (const reason of summary.reasons) {
      lines.push(`- ${reason}`);
    }
  }

  lines.push("");
  lines.push(formatMigrationSubagentEvaluationMarkdown(summary.subagent, options));
  return lines.join("\n");
}

function parseScenario(value: unknown, index: number): MigrationBlindScenario {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(`Blind scenario at index ${index} must be an object`);
  }

  const record = value as Record<string, unknown>;
  const successCriteria = parseSuccessCriteria(record.successCriteria, index);

  return {
    id: parseString(record.id, `Blind scenario at index ${index} must have an id`),
    title: parseString(record.title, `Blind scenario at index ${index} must have a title`),
    dir: parseString(record.dir, `Blind scenario at index ${index} must have a dir`),
    baseline: parseString(record.baseline, `Blind scenario at index ${index} must have a baseline`),
    blindTarget: parseString(record.blindTarget, `Blind scenario at index ${index} must have a blindTarget`),
    reference: parseString(record.reference, `Blind scenario at index ${index} must have a reference`),
    successCriteria,
  };
}

function parseSuccessCriteria(value: unknown, index: number): MigrationBlindScenario["successCriteria"] {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(`Blind scenario at index ${index} must define successCriteria`);
  }
  const record = value as Record<string, unknown>;
  const maxDiffRatio = parseRatio(record.maxDiffRatio, `Blind scenario at index ${index} has an invalid successCriteria.maxDiffRatio`);
  const maxRounds = parsePositiveInteger(record.maxRounds, `Blind scenario at index ${index} has an invalid successCriteria.maxRounds`);
  return { maxDiffRatio, maxRounds };
}

function parseString(value: unknown, message: string): string {
  if (typeof value !== "string" || value.trim() === "") {
    throw new Error(message);
  }
  return value;
}

function parseRatio(value: unknown, message: string): number {
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0 || value > 1) {
    throw new Error(message);
  }
  return value;
}

function parsePositiveInteger(value: unknown, message: string): number {
  if (typeof value !== "number" || !Number.isInteger(value) || value <= 0) {
    throw new Error(message);
  }
  return value;
}

async function main() {
  const [manifestPath, command = "list", scenarioId, ...rest] = process.argv.slice(2);
  if (
    !manifestPath
    || manifestPath === "--help"
    || manifestPath === "-h"
    || command === "--help"
    || command === "-h"
    || command === "help"
  ) {
    console.log(formatUsage());
    return;
  }

  const manifest = parseMigrationBlindManifest(await readFile(resolve(manifestPath), "utf-8"));
  if (command === "list") {
    console.log(JSON.stringify({ scenarios: summarizeMigrationBlindScenarios(manifest) }, null, 2));
    return;
  }

  if (command === "show") {
    if (!scenarioId) {
      throw new Error("Missing scenario id for show");
    }
    const scenario = requireScenario(manifest, scenarioId);
    console.log(formatMigrationBlindScenarioMarkdown(scenario));
    return;
  }

  if (command === "prepare") {
    if (!scenarioId) {
      throw new Error("Missing scenario id for prepare");
    }
    await runPrepare(requireScenario(manifest, scenarioId), rest);
    return;
  }

  if (command === "evaluate") {
    if (!scenarioId) {
      throw new Error("Missing scenario id for evaluate");
    }
    await runEvaluate(requireScenario(manifest, scenarioId), rest);
    return;
  }

  if (command === "solo") {
    if (!scenarioId) {
      throw new Error("Missing scenario id for solo");
    }
    await runSolo(requireScenario(manifest, scenarioId), rest);
    return;
  }

  throw new Error(`Unknown command: ${command}`);
}

function formatUsage(): string {
  return [
    "Usage:",
    "  vrt migration blind <manifest.json> list",
    "  vrt migration blind <manifest.json> show <scenario-id>",
    "  vrt migration blind <manifest.json> prepare <scenario-id> [--output-dir path] [--packet path] [--format markdown|json] [--paint-tree]",
    "  vrt migration blind <manifest.json> evaluate <scenario-id> --before-report before.json --after-report after.json --rounds n [--output path] [--format markdown|json]",
    "  vrt migration blind <manifest.json> solo <scenario-id> [--output path] [--report-output-dir path] [--format markdown|json] [--paint-tree]",
  ].join("\n");
}

async function runPrepare(scenario: MigrationBlindScenario, args: string[]) {
  const outputDir = optionalValue(args, "--output-dir") ?? resolve("test-results", "migration", "blind", scenario.id);
  const packetPath = optionalValue(args, "--packet");
  const format = parseFormat(optionalValue(args, "--format"));
  const enablePaintTree = hasFlag(args, "--paint-tree");
  const autoDiscover = !hasFlag(args, "--no-discover");
  const compareOptions = buildMigrationBlindCompareOptions(scenario, {
    outputDir,
    enablePaintTree,
    autoDiscover,
  });
  const { runMigrationCompare } = await import("./migration-compare.ts");
  const report = await runMigrationCompare(compareOptions);
  const preparation = await buildPreparationFromReport(scenario, compareOptions, report);
  const output = format === "json"
    ? JSON.stringify(preparation, null, 2)
    : formatMigrationBlindPreparationMarkdown(preparation);

  if (packetPath) {
    const resolvedOutput = resolve(packetPath);
    await mkdir(dirname(resolvedOutput), { recursive: true });
    await writeFile(resolvedOutput, `${output.trimEnd()}\n`, "utf-8");
  } else {
    console.log(output.trimEnd());
  }
}

async function runEvaluate(scenario: MigrationBlindScenario, args: string[]) {
  const beforeReportPath = requireValue(args, "--before-report");
  const afterReportPath = requireValue(args, "--after-report");
  const roundsUsed = requirePositiveIntegerValue(args, "--rounds");
  const outputPath = optionalValue(args, "--output");
  const format = parseFormat(optionalValue(args, "--format"));
  const beforeReport = JSON.parse(await readFile(resolve(beforeReportPath), "utf-8")) as MigrationCompareReport;
  const afterReport = JSON.parse(await readFile(resolve(afterReportPath), "utf-8")) as MigrationCompareReport;
  const summary = evaluateMigrationBlindSuccess({
    scenario,
    beforeReport,
    afterReport,
    roundsUsed,
  });
  const output = format === "json"
    ? JSON.stringify({ summary }, null, 2)
    : formatMigrationBlindSuccessMarkdown(summary, { beforeReportPath, afterReportPath });

  if (outputPath) {
    const resolvedOutput = resolve(outputPath);
    await mkdir(dirname(resolvedOutput), { recursive: true });
    await writeFile(resolvedOutput, `${output.trimEnd()}\n`, "utf-8");
  } else {
    console.log(output.trimEnd());
  }

  if (!summary.passed) {
    process.exit(1);
  }
}

async function runSolo(scenario: MigrationBlindScenario, args: string[]) {
  const outputPath = resolve(optionalValue(args, "--output")
    ?? resolve("test-results", "migration", "blind", scenario.id, "solo", basename(scenario.blindTarget)));
  const reportOutputDir = resolve(optionalValue(args, "--report-output-dir")
    ?? resolve("test-results", "migration", "blind", scenario.id, "solo-report"));
  const format = parseFormat(optionalValue(args, "--format"));
  const enablePaintTree = hasFlag(args, "--paint-tree");

  const blindPath = resolve(scenario.dir, scenario.blindTarget);
  const referencePath = resolve(scenario.dir, scenario.reference);
  const [blindHtml, referenceHtml] = await Promise.all([
    readFile(blindPath, "utf-8"),
    readFile(referencePath, "utf-8"),
  ]);
  const repairedHtml = synthesizeMigrationBlindReferenceFix(blindHtml, referenceHtml);

  await mkdir(dirname(outputPath), { recursive: true });
  await writeFile(outputPath, repairedHtml, "utf-8");

  const compareOptions: MigrationCompareOptions = {
    ...buildMigrationBlindCompareOptions(scenario, {
      outputDir: reportOutputDir,
      enablePaintTree,
      autoDiscover: true,
    }),
    dir: ".",
    baseline: resolve(scenario.dir, scenario.baseline),
    variants: [outputPath],
  };

  const { runMigrationCompare } = await import("./migration-compare.ts");
  const report = await runMigrationCompare(compareOptions);
  const result: MigrationBlindSoloResult = {
    scenario,
    outputPath,
    reportPath: report.reportPath,
  };
  const output = format === "json"
    ? JSON.stringify(result, null, 2)
    : [
        `## Blind Scenario Solo Repair: ${scenario.title}`,
        "",
        `- Output: \`${result.outputPath}\``,
        `- Report: \`${result.reportPath}\``,
        `- Reference: \`${scenario.reference}\``,
      ].join("\n");

  console.log(output);
}

async function buildPreparationFromReport(
  scenario: MigrationBlindScenario,
  compareOptions: MigrationCompareOptions,
  report: Awaited<ReturnType<(typeof import("./migration-compare.ts"))["runMigrationCompare"]>>,
): Promise<MigrationBlindPreparation> {
  const baselinePath = resolveSourcePath(report.dir, report.baseline);
  const baselineFile = basename(baselinePath);
  const tasks: MigrationSubagentTask[] = [];

  for (const target of selectMigrationFixTargetsByVariant(report)) {
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

  return {
    scenario,
    reportPath: report.reportPath,
    outputDir: compareOptions.outputDir,
    compareOptions,
    tasks,
  };
}

function requireScenario(
  manifest: MigrationBlindManifest,
  scenarioId: string,
): MigrationBlindScenario {
  const scenario = selectMigrationBlindScenario(manifest, scenarioId);
  if (!scenario) {
    throw new Error(`Unknown scenario: ${scenarioId}`);
  }
  return scenario;
}

function findWorstDiffRatio(report: MigrationCompareReport): number {
  return report.results.reduce((max, result) => Math.max(max, result.diffRatio), 0);
}

function resolveSourcePath(dir: string | undefined, file: string): string {
  if (file.startsWith("/")) return file;
  return resolve(dir ?? ".", file);
}

function hasFlag(args: string[], flag: string): boolean {
  return args.includes(flag);
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

function requirePositiveIntegerValue(args: string[], flag: string): number {
  const value = Number(requireValue(args, flag));
  if (!Number.isInteger(value) || value <= 0) {
    throw new Error(`Invalid ${flag} value`);
  }
  return value;
}

function parseFormat(value: string | undefined): "markdown" | "json" {
  const format = value ?? "markdown";
  if (format !== "markdown" && format !== "json") {
    throw new Error("Invalid --format value. Expected 'markdown' or 'json'");
  }
  return format;
}

if (process.env.__VRT_DISPATCHER_LEAF__ === "migration-blind" || process.argv[1]?.endsWith("migration-blind.ts")) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  });
}
