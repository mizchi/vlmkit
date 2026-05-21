#!/usr/bin/env node
import { readFile, writeFile } from "node:fs/promises";
import { dirname, join, relative, resolve } from "node:path";
import {
  DEFAULT_NORMALIZATION_PROMOTION_POLICY,
  attachNormalizationReadiness,
  groupCandidates,
  summarizeNormalizationSelection,
} from "./motion-normalization-selection-utils.mjs";

const repoRoot = resolve(new URL("../../..", import.meta.url).pathname);

function parseArgs(argv) {
  const args = {
    plan: "",
    out: "",
    failOnRejected: false,
    failOnMissing: false,
  };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === "--plan") args.plan = resolve(required(argv, ++i, arg));
    else if (arg === "--out") args.out = resolve(required(argv, ++i, arg));
    else if (arg === "--fail-on-rejected") args.failOnRejected = true;
    else if (arg === "--fail-on-missing") args.failOnMissing = true;
    else if (arg === "--help" || arg === "-h") {
      console.log(`Usage:
  node design-runs/game-assets-20260520/tools/select-motion-normalization-candidates.mjs --plan <normalization-candidate-plan.json> [options]

Options:
  --plan <path>          Candidate plan from plan-motion-normalization-candidates.mjs
  --out <path>           Selection report JSON
  --fail-on-rejected     Exit non-zero if any candidate group is rejected
  --fail-on-missing      Exit non-zero if any runnable candidate lacks a comparison report
`);
      process.exit(0);
    } else {
      throw new Error(`Unknown argument: ${arg}`);
    }
  }
  if (!args.plan) throw new Error("--plan is required");
  if (!args.out) args.out = join(dirname(args.plan), "normalization-candidate-selection.json");
  return args;
}

function required(argv, index, flag) {
  const value = argv[index];
  if (!value || value.startsWith("--")) throw new Error(`${flag} requires a value`);
  return value;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const plan = JSON.parse(await readFile(args.plan, "utf8"));
  const runnable = plan.runnable ?? [];
  const groups = attachNormalizationReadiness(groupCandidates(await Promise.all(runnable.map((candidate) => candidateResult(candidate)))));
  const summary = summarizeNormalizationSelection(groups, plan);
  const ok = (!args.failOnRejected || summary.rejected === 0) &&
    (!args.failOnMissing || summary.missingComparison === 0);
  const report = {
    version: 1,
    kind: "motion-normalization-candidate-selection",
    ok,
    generatedAt: new Date().toISOString(),
    input: relative(repoRoot, args.plan),
    policy: {
      failOnRejected: args.failOnRejected,
      failOnMissing: args.failOnMissing,
      promotion: DEFAULT_NORMALIZATION_PROMOTION_POLICY,
    },
    summary,
    groups,
    blocked: (plan.blocked ?? []).map((candidate) => ({
      sample: candidate.sample,
      id: candidate.id,
      kind: candidate.kind,
      status: candidate.status,
      automatic: candidate.automatic === true,
      reason: candidate.reason,
    })),
  };
  await writeFile(args.out, `${JSON.stringify(report, null, 2)}\n`);
  console.log(`${ok ? "OK" : "FAIL"} ${relative(repoRoot, args.out)} (${groups.length} group(s))`);
  if (!ok) process.exit(1);
}

async function candidateResult(candidate) {
  const compareReportPath = compareOutPath(candidate);
  const compare = compareReportPath ? await readJsonOptional(compareReportPath) : null;
  const sample = compare?.samples?.find((item) => item.sample === candidate.sample) ?? null;
  return {
    id: candidate.id,
    kind: candidate.kind,
    status: candidate.status,
    automatic: candidate.automatic === true,
    rootTranslationMode: candidate.rootTranslationMode ?? null,
    poseNormalization: candidate.poseNormalization ?? null,
    sample: candidate.sample,
    outputReport: candidate.outputReport,
    compareReport: compareReportPath ? relative(repoRoot, compareReportPath) : null,
    comparisonFound: Boolean(compare),
    decision: sample?.decision ?? (compare ? "missing-sample-comparison" : "missing-comparison"),
    reasons: sample?.reasons ?? [],
  };
}

function compareOutPath(candidate) {
  const compare = candidate.compare ?? [];
  const outIndex = compare.indexOf("--out");
  if (outIndex >= 0 && compare[outIndex + 1]) return resolve(repoRoot, compare[outIndex + 1]);
  if (candidate.outputReport) return resolve(repoRoot, candidate.outputReport.replace(/\.json$/, ".compare.json"));
  return null;
}

async function readJsonOptional(path) {
  try {
    return JSON.parse(await readFile(path, "utf8"));
  } catch (error) {
    if (error?.code === "ENOENT") return null;
    throw error;
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
