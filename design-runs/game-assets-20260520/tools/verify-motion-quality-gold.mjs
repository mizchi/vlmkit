#!/usr/bin/env node
import { readFile, writeFile } from "node:fs/promises";
import { dirname, join, relative, resolve } from "node:path";

const repoRoot = resolve(new URL("../../..", import.meta.url).pathname);

function parseArgs(argv) {
  const args = {
    report: "",
    gold: "",
    out: "",
  };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === "--report") args.report = resolve(required(argv, ++i, arg));
    else if (arg === "--gold") args.gold = resolve(required(argv, ++i, arg));
    else if (arg === "--out") args.out = resolve(required(argv, ++i, arg));
    else if (arg === "--help" || arg === "-h") {
      console.log(`Usage:
  node design-runs/game-assets-20260520/tools/verify-motion-quality-gold.mjs --report <smoke-report.json> --gold <gold.json> [options]

Options:
  --report <path>       Smoke report from run-external-vrma-smoke.mjs
  --gold <path>         Quality gold fixture
  --out <path>          Verification report JSON
`);
      process.exit(0);
    } else {
      throw new Error(`Unknown argument: ${arg}`);
    }
  }
  if (!args.report) throw new Error("--report is required");
  if (!args.gold) throw new Error("--gold is required");
  if (!args.out) args.out = join(dirname(args.report), "quality-gold.verify.json");
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
  const gold = JSON.parse(await readFile(args.gold, "utf8"));
  const checks = [];

  checkEqual(checks, "report-ok", report.ok, true);
  checkEqual(checks, "min-quality", report.minQuality, gold.report?.minQuality);
  checkEqual(checks, "retarget-profile", report.retargetProfile, gold.report?.retargetProfile);
  checkEqual(checks, "root-translation-mode", report.rootTranslationMode, gold.report?.rootTranslationMode);

  const samplesByName = new Map((report.samples ?? []).map((sample) => [sample.sample, sample]));
  for (const [sampleName, expected] of Object.entries(gold.samples ?? {})) {
    const sample = samplesByName.get(sampleName);
    if (!sample) {
      checks.push(fail(`sample:${sampleName}:exists`, "sample is missing from smoke report"));
      continue;
    }
    checkEqual(checks, `sample:${sampleName}:ok`, sample.ok, true);
    checkEqual(checks, `sample:${sampleName}:verdict`, sample.quality?.verdict, expected.verdict);
    checkMinimum(checks, `sample:${sampleName}:retarget-score`, sample.quality?.retarget?.score, expected.minRetargetScore);
    checkMaximum(checks, `sample:${sampleName}:retarget-penalty`, sample.quality?.retarget?.weightedPenalty, expected.maxRetargetPenalty);
    checkRange(checks, `sample:${sampleName}:groundDeltaY.min`, sample.quality?.metrics?.groundDeltaY?.min, expected.groundDeltaY?.min);
    checkRange(checks, `sample:${sampleName}:groundDeltaY.max`, sample.quality?.metrics?.groundDeltaY?.max, expected.groundDeltaY?.max);
    checkRange(checks, `sample:${sampleName}:footMinDeltaY.min`, sample.quality?.metrics?.footContact?.minDeltaY?.min, expected.footMinDeltaY?.min);
    checkRange(checks, `sample:${sampleName}:footMinDeltaY.max`, sample.quality?.metrics?.footContact?.minDeltaY?.max, expected.footMinDeltaY?.max);
    checkRange(checks, `sample:${sampleName}:maxTrackedNodeDisplacement`, maxTrackedNodeDisplacement(sample), expected.maxTrackedNodeDisplacement);
    checkRange(checks, `sample:${sampleName}:maxPelvisDisplacement`, sample.quality?.metrics?.trackedNodeDisplacement?.pelvis?.max, expected.maxPelvisDisplacement);
    if (expected.rootNormalization) {
      const rootNormalization = firstRootNormalization(sample);
      checkEqual(checks, `sample:${sampleName}:rootNormalization.recommendation`, rootNormalization?.recommendation?.id, expected.rootNormalization.recommendation);
      checkEqual(checks, `sample:${sampleName}:rootNormalization.severity`, rootNormalization?.recommendation?.severity, expected.rootNormalization.severity);
      checkRange(checks, `sample:${sampleName}:rootNormalization.heightScale`, rootNormalization?.heightScale, expected.rootNormalization.heightScale);
      checkRange(checks, `sample:${sampleName}:rootNormalization.verticalDeltaRange`, rootNormalization?.verticalDeltaRange, expected.rootNormalization.verticalDeltaRange);
    }
    if (expected.targetRig) {
      checkRange(checks, `sample:${sampleName}:targetRig.skeletonHeight`, sample.normalization?.targetRig?.bindMetrics?.skeletonHeight, expected.targetRig.skeletonHeight);
      checkRange(checks, `sample:${sampleName}:targetRig.shoulderWidth`, sample.normalization?.targetRig?.bindMetrics?.shoulderWidth, expected.targetRig.shoulderWidth);
      checkRange(checks, `sample:${sampleName}:targetRig.handSpan`, sample.normalization?.targetRig?.bindMetrics?.handSpan, expected.targetRig.handSpan);
      checkRange(checks, `sample:${sampleName}:targetRig.upperLegSpread`, sample.normalization?.targetRig?.bindMetrics?.upperLegSpread, expected.targetRig.upperLegSpread);
      checkRange(checks, `sample:${sampleName}:targetRig.footSpread`, sample.normalization?.targetRig?.bindMetrics?.footSpread, expected.targetRig.footSpread);
      checkRange(checks, `sample:${sampleName}:targetRig.pelvisToLowestFootHeight`, sample.normalization?.targetRig?.bindMetrics?.pelvisToLowestFootHeight, expected.targetRig.pelvisToLowestFootHeight);
      checkRange(checks, `sample:${sampleName}:targetRig.armDownAngleDeg`, sample.normalization?.targetRig?.bindMetrics?.armDownAngleDeg, expected.targetRig.armDownAngleDeg);
    }
    if (expected.sourceRig) {
      checkRange(checks, `sample:${sampleName}:sourceRig.skeletonHeight`, sample.normalization?.sourceRig?.bindMetrics?.skeletonHeight, expected.sourceRig.skeletonHeight);
      checkRange(checks, `sample:${sampleName}:sourceRig.shoulderWidth`, sample.normalization?.sourceRig?.bindMetrics?.shoulderWidth, expected.sourceRig.shoulderWidth);
      checkRange(checks, `sample:${sampleName}:sourceRig.handSpan`, sample.normalization?.sourceRig?.bindMetrics?.handSpan, expected.sourceRig.handSpan);
      checkRange(checks, `sample:${sampleName}:sourceRig.upperLegSpread`, sample.normalization?.sourceRig?.bindMetrics?.upperLegSpread, expected.sourceRig.upperLegSpread);
      checkRange(checks, `sample:${sampleName}:sourceRig.footSpread`, sample.normalization?.sourceRig?.bindMetrics?.footSpread, expected.sourceRig.footSpread);
      checkRange(checks, `sample:${sampleName}:sourceRig.armDownAngleDeg`, sample.normalization?.sourceRig?.bindMetrics?.armDownAngleDeg, expected.sourceRig.armDownAngleDeg);
      checkRange(checks, `sample:${sampleName}:sourceTargetRigComparison.skeletonHeightScale`, sample.normalization?.sourceTargetRigComparison?.scales?.skeletonHeight, expected.sourceRig.skeletonHeightScale);
      checkRange(checks, `sample:${sampleName}:sourceTargetRigComparison.shoulderWidthScale`, sample.normalization?.sourceTargetRigComparison?.scales?.shoulderWidth, expected.sourceRig.shoulderWidthScale);
      checkRange(checks, `sample:${sampleName}:sourceTargetRigComparison.upperLegSpreadScale`, sample.normalization?.sourceTargetRigComparison?.scales?.upperLegSpread, expected.sourceRig.upperLegSpreadScale);
      checkEqual(checks, `sample:${sampleName}:sourceTargetRigComparison.recommendation`, sample.normalization?.sourceTargetRigComparison?.recommendation?.id, expected.sourceRig.recommendation);
      for (const warning of expected.sourceRig.warnings ?? [expected.sourceRig.warning].filter(Boolean)) {
        checkIncludes(checks, `sample:${sampleName}:sourceTargetRigComparison.warning:${warning}`, warningIds(sample.normalization?.sourceTargetRigComparison), warning);
      }
    }
  }

  const ok = checks.every((check) => check.ok);
  const result = {
    ok,
    inputs: {
      report: relative(repoRoot, args.report),
      gold: relative(repoRoot, args.gold),
    },
    checks,
  };
  await writeFile(args.out, `${JSON.stringify(result, null, 2)}\n`);
  console.log(`${ok ? "OK" : "FAIL"} ${relative(repoRoot, args.out)} (${checks.length} check(s))`);
  if (!ok) process.exit(1);
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

function warningIds(comparison) {
  return (comparison?.warnings ?? []).map((warning) => warning.id);
}

function checkIncludes(checks, id, actual, expected) {
  checks.push(Array.isArray(actual) && actual.includes(expected)
    ? pass(id, { actual, expected })
    : fail(id, "value is missing", { actual, expected }));
}

function checkEqual(checks, id, actual, expected) {
  checks.push(actual === expected
    ? pass(id, { actual, expected })
    : fail(id, "value mismatch", { actual, expected }));
}

function checkMinimum(checks, id, actual, minimum) {
  checks.push(Number.isFinite(actual) && actual >= minimum
    ? pass(id, { actual, minimum })
    : fail(id, "value below minimum", { actual, minimum }));
}

function checkMaximum(checks, id, actual, maximum) {
  checks.push(Number.isFinite(actual) && actual <= maximum
    ? pass(id, { actual, maximum })
    : fail(id, "value above maximum", { actual, maximum }));
}

function checkRange(checks, id, actual, range) {
  const [min, max] = range ?? [];
  checks.push(Number.isFinite(actual) && Number.isFinite(min) && Number.isFinite(max) && actual >= min && actual <= max
    ? pass(id, { actual, range })
    : fail(id, "value outside expected range", { actual, range }));
}

function pass(id, value) {
  return { id, ok: true, value };
}

function fail(id, reason, value = null) {
  return { id, ok: false, reason, value };
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
