#!/usr/bin/env node
import { readFile, writeFile } from "node:fs/promises";
import { dirname, join, relative, resolve } from "node:path";

const repoRoot = resolve(new URL("../../..", import.meta.url).pathname);
const scriptPath = "design-runs/game-assets-20260520/tools/run-external-vrma-smoke.mjs";
const compareScriptPath = "design-runs/game-assets-20260520/tools/compare-motion-quality-reports.mjs";

function parseArgs(argv) {
  const args = {
    report: "",
    out: "",
  };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === "--report") args.report = resolve(required(argv, ++i, arg));
    else if (arg === "--out") args.out = resolve(required(argv, ++i, arg));
    else if (arg === "--help" || arg === "-h") {
      console.log(`Usage:
  node design-runs/game-assets-20260520/tools/plan-motion-normalization-candidates.mjs --report <smoke-report.json> [options]

Options:
  --report <path>       Smoke report from run-external-vrma-smoke.mjs
  --out <path>          Candidate plan JSON
`);
      process.exit(0);
    } else {
      throw new Error(`Unknown argument: ${arg}`);
    }
  }
  if (!args.report) throw new Error("--report is required");
  if (!args.out) args.out = join(dirname(args.report), "normalization-candidate-plan.json");
  return args;
}

function required(argv, index, flag) {
  const value = argv[index];
  if (!value || value.startsWith("--")) throw new Error(`${flag} requires a value`);
  return value;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const report = JSON.parse(await readFile(args.report, "utf8"));
  const candidates = [];
  const blocked = [];
  for (const sample of report.samples ?? []) {
    for (const candidate of sample.normalization?.normalizationCandidates ?? []) {
      if (candidate.status === "runnable" && candidate.kind === "root-translation-mode") {
        candidates.push(rootTranslationCandidate(args.report, report, sample, candidate));
      } else if (candidate.status === "runnable" && candidate.kind === "pose-pre-normalization") {
        candidates.push(poseNormalizationCandidate(args.report, report, sample, candidate));
      } else {
        blocked.push(blockedCandidate(sample, candidate));
      }
    }
  }
  const plan = {
    version: 1,
    kind: "motion-normalization-candidate-plan",
    generatedAt: new Date().toISOString(),
    input: relative(repoRoot, args.report),
    summary: {
      runnable: candidates.length,
      blocked: blocked.length,
      sampleCount: report.samples?.length ?? 0,
    },
    runnable: candidates,
    blocked,
  };
  await writeFile(args.out, `${JSON.stringify(plan, null, 2)}\n`);
  console.log(`OK ${relative(repoRoot, args.out)} (${candidates.length} runnable, ${blocked.length} blocked)`);
}

function rootTranslationCandidate(reportPath, report, sample, candidate) {
  const out = candidateReportPath(report, sample, candidate);
  return {
    sample: sample.sample,
    id: candidate.id,
    kind: candidate.kind,
    status: candidate.status,
    automatic: candidate.automatic === true,
    rootTranslationMode: candidate.rootTranslationMode,
    reason: candidate.reason,
    outputReport: out,
    run: [
      "node",
      scriptPath,
      "--samples",
      sample.sample,
      "--root-translation-mode",
      candidate.rootTranslationMode,
      "--retarget-profile",
      report.retargetProfile ?? "robot-voxel",
      "--min-quality",
      report.minQuality ?? "pass",
      "--review-vlm",
      "--review-dry-run",
      "--out",
      out,
    ],
    compare: [
      "node",
      compareScriptPath,
      "--baseline",
      relative(repoRoot, reportPath),
      "--candidate",
      out,
      "--samples",
      sample.sample,
      "--fail-on-regression",
      "--fail-on-tradeoff",
      "--out",
      out.replace(/\.json$/, ".compare.json"),
    ],
  };
}

function poseNormalizationCandidate(reportPath, report, sample, candidate) {
  const out = candidateReportPath(report, sample, candidate);
  return {
    sample: sample.sample,
    id: candidate.id,
    kind: candidate.kind,
    status: candidate.status,
    automatic: candidate.automatic === true,
    poseNormalization: candidate.poseNormalization,
    reason: candidate.reason,
    outputReport: out,
    run: [
      "node",
      scriptPath,
      "--samples",
      sample.sample,
      "--root-translation-mode",
      report.rootTranslationMode ?? "relative",
      "--pose-normalization",
      candidate.poseNormalization,
      "--retarget-profile",
      report.retargetProfile ?? "robot-voxel",
      "--min-quality",
      report.minQuality ?? "pass",
      "--review-vlm",
      "--review-dry-run",
      "--out",
      out,
    ],
    compare: [
      "node",
      compareScriptPath,
      "--baseline",
      relative(repoRoot, reportPath),
      "--candidate",
      out,
      "--samples",
      sample.sample,
      "--fail-on-regression",
      "--fail-on-tradeoff",
      "--out",
      out.replace(/\.json$/, ".compare.json"),
    ],
  };
}

function candidateReportPath(report, sample, candidate) {
  const dir = report.externalDir ?? dirname(report.model ?? "external");
  return `${dir}/smoke-report.${sample.sample}.${candidate.id}.json`;
}

function blockedCandidate(sample, candidate) {
  return {
    sample: sample.sample,
    id: candidate.id,
    kind: candidate.kind,
    status: candidate.status,
    automatic: candidate.automatic === true,
    triggerWarnings: candidate.triggerWarnings ?? [],
    reason: candidate.reason,
  };
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
