#!/usr/bin/env node
import { readFile, writeFile } from "node:fs/promises";
import { dirname, join, relative, resolve } from "node:path";

const repoRoot = resolve(new URL("../../..", import.meta.url).pathname);

function parseArgs(argv) {
  const args = {
    baseline: "",
    candidate: "",
    out: "",
    samples: [],
    failOnRegression: false,
  };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === "--baseline") args.baseline = resolve(required(argv, ++i, arg));
    else if (arg === "--candidate") args.candidate = resolve(required(argv, ++i, arg));
    else if (arg === "--out") args.out = resolve(required(argv, ++i, arg));
    else if (arg === "--samples") args.samples = csv(required(argv, ++i, arg));
    else if (arg === "--fail-on-regression") args.failOnRegression = true;
    else if (arg === "--help" || arg === "-h") {
      console.log(`Usage:
  node design-runs/game-assets-20260520/tools/compare-motion-quality-reports.mjs --baseline <smoke-report.json> --candidate <smoke-report.json> [options]

Options:
  --baseline <path>       Baseline smoke report
  --candidate <path>      Candidate smoke report
  --out <path>            Comparison report JSON
  --samples <csv>         Restrict comparison to selected sample names
  --fail-on-regression    Exit non-zero if any sample is a hard regression or missing
`);
      process.exit(0);
    } else {
      throw new Error(`Unknown argument: ${arg}`);
    }
  }
  if (!args.baseline) throw new Error("--baseline is required");
  if (!args.candidate) throw new Error("--candidate is required");
  if (!args.out) args.out = join(dirname(args.candidate), "motion-quality-compare.json");
  return args;
}

function required(argv, index, flag) {
  const value = argv[index];
  if (!value || value.startsWith("--")) throw new Error(`${flag} requires a value`);
  return value;
}

function csv(value) {
  return value.split(",").map((item) => item.trim()).filter(Boolean);
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const baseline = JSON.parse(await readFile(args.baseline, "utf8"));
  const candidate = JSON.parse(await readFile(args.candidate, "utf8"));
  const candidateSamples = new Map((candidate.samples ?? []).map((sample) => [sample.sample, sample]));
  const requestedSamples = new Set(args.samples);
  const baselineSamples = (baseline.samples ?? []).filter((sample) => requestedSamples.size === 0 || requestedSamples.has(sample.sample));
  const samples = baselineSamples.map((baselineSample) => {
    const candidateSample = candidateSamples.get(baselineSample.sample);
    return candidateSample
      ? compareSample(baselineSample, candidateSample)
      : missingSample(baselineSample.sample);
  });
  for (const sampleName of requestedSamples) {
    if (!baselineSamples.some((sample) => sample.sample === sampleName)) samples.push(missingSample(sampleName, "baseline report does not include this requested sample"));
  }
  const summary = summarize(samples);
  const ok = samples.length > 0 && summary.missing === 0 && (!args.failOnRegression || summary.candidateRegressed === 0);
  const report = {
    version: 1,
    kind: "motion-quality-report-comparison",
    ok,
    generatedAt: new Date().toISOString(),
    baseline: summarizeReport(args.baseline, baseline),
    candidate: summarizeReport(args.candidate, candidate),
    requestedSamples: args.samples,
    summary,
    samples,
  };
  await writeFile(args.out, `${JSON.stringify(report, null, 2)}\n`);
  console.log(`${ok ? "OK" : "FAIL"} ${relative(repoRoot, args.out)} (${samples.length} sample(s))`);
  if (!ok) process.exit(1);
}

function summarizeReport(path, report) {
  return {
    path: relative(repoRoot, path),
    ok: report.ok ?? null,
    rootTranslationMode: report.rootTranslationMode ?? null,
    retargetProfile: report.retargetProfile ?? null,
    minQuality: report.minQuality ?? null,
  };
}

function compareSample(baseline, candidate) {
  const metrics = {
    verdictScore: higherBetter("verdictScore", verdictScore(baseline.quality?.verdict), verdictScore(candidate.quality?.verdict), 0),
    groundDeltaYError: lowerBetter("groundDeltaYError", maxAbsRange(baseline.quality?.metrics?.groundDeltaY), maxAbsRange(candidate.quality?.metrics?.groundDeltaY), 0.01),
    footContactError: lowerBetter("footContactError", maxAbsRange(baseline.quality?.metrics?.footContact?.minDeltaY), maxAbsRange(candidate.quality?.metrics?.footContact?.minDeltaY), 0.01),
    pelvisDisplacement: lowerBetter("pelvisDisplacement", baseline.quality?.metrics?.trackedNodeDisplacement?.pelvis?.max, candidate.quality?.metrics?.trackedNodeDisplacement?.pelvis?.max, 0.01),
    maxTrackedNodeDisplacement: lowerBetter("maxTrackedNodeDisplacement", maxTrackedNodeDisplacement(baseline), maxTrackedNodeDisplacement(candidate), 0.01),
    retargetScore: higherBetter("retargetScore", baseline.quality?.retarget?.score, candidate.quality?.retarget?.score, 0.001),
    retargetPenalty: lowerBetter("retargetPenalty", baseline.quality?.retarget?.weightedPenalty, candidate.quality?.retarget?.weightedPenalty, 0.001),
  };
  const decision = decide(metrics);
  return {
    sample: baseline.sample,
    ok: true,
    decision,
    baseline: summarizeSample(baseline),
    candidate: summarizeSample(candidate),
    metrics,
    reasons: metricReasons(metrics),
  };
}

function missingSample(sample, reason = "candidate report does not include this baseline sample") {
  return {
    sample,
    ok: false,
    decision: "missing-candidate",
    reason,
  };
}

function summarizeSample(sample) {
  const rootNormalization = firstRootNormalization(sample);
  return {
    ok: sample.ok ?? null,
    verdict: sample.quality?.verdict ?? null,
    rootTranslationMode: rootNormalization?.mode ?? null,
    rootRecommendation: rootNormalization?.recommendation ?? null,
    heightScale: rootNormalization?.heightScale ?? null,
    verticalDeltaRange: rootNormalization?.verticalDeltaRange ?? null,
    appliedScale: rootNormalization?.appliedScale ?? null,
  };
}

function decide(metrics) {
  const values = Object.values(metrics);
  const hasRegression = values.some((metric) => metric.status === "regressed");
  const hasImprovement = values.some((metric) => metric.status === "improved");
  if (hasImprovement && hasRegression) return "candidate-tradeoff";
  if (hasRegression) return "candidate-regressed";
  if (hasImprovement) return "candidate-improved";
  return "stable";
}

function metricReasons(metrics) {
  return Object.values(metrics)
    .filter((metric) => metric.status !== "stable" && metric.status !== "missing")
    .map((metric) => `${metric.id} ${metric.status}: ${metric.baseline} -> ${metric.candidate}`);
}

function summarize(samples) {
  return {
    candidateImproved: samples.filter((sample) => sample.decision === "candidate-improved").length,
    candidateRegressed: samples.filter((sample) => sample.decision === "candidate-regressed").length,
    candidateTradeoff: samples.filter((sample) => sample.decision === "candidate-tradeoff").length,
    stable: samples.filter((sample) => sample.decision === "stable").length,
    missing: samples.filter((sample) => sample.decision === "missing-candidate").length,
  };
}

function lowerBetter(id, baseline, candidate, tolerance) {
  return compareMetric(id, baseline, candidate, tolerance, "lower");
}

function higherBetter(id, baseline, candidate, tolerance) {
  return compareMetric(id, baseline, candidate, tolerance, "higher");
}

function compareMetric(id, baseline, candidate, tolerance, better) {
  if (!Number.isFinite(baseline) || !Number.isFinite(candidate)) {
    return { id, better, baseline: finiteOrNull(baseline), candidate: finiteOrNull(candidate), delta: null, status: "missing" };
  }
  const delta = round(candidate - baseline);
  let status = "stable";
  if (better === "lower") {
    if (candidate < baseline - tolerance) status = "improved";
    else if (candidate > baseline + tolerance) status = "regressed";
  } else if (candidate > baseline + tolerance) {
    status = "improved";
  } else if (candidate < baseline - tolerance) {
    status = "regressed";
  }
  return { id, better, baseline: round(baseline), candidate: round(candidate), delta, tolerance, status };
}

function verdictScore(verdict) {
  if (verdict === "pass") return 3;
  if (verdict === "warn") return 2;
  if (verdict === "fail") return 1;
  return null;
}

function maxAbsRange(range) {
  const values = [range?.min, range?.max].filter(Number.isFinite).map(Math.abs);
  return values.length > 0 ? Math.max(...values) : null;
}

function maxTrackedNodeDisplacement(sample) {
  const values = Object.values(sample.quality?.metrics?.trackedNodeDisplacement ?? {})
    .map((range) => range?.max)
    .filter(Number.isFinite);
  return values.length > 0 ? Math.max(...values) : null;
}

function firstRootNormalization(sample) {
  return sample.normalization?.rootTranslations?.[0] ?? null;
}

function finiteOrNull(value) {
  return Number.isFinite(value) ? round(value) : null;
}

function round(value) {
  return Math.round(value * 100000) / 100000;
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
