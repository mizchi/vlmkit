import { spawnSync } from "node:child_process";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const runDir = resolve(here, "..");
const repoRoot = resolve(runDir, "../..");
const cliPath = join(
  runDir,
  "_build/js/debug/build/motion-core-cli/motion-core-cli.js",
);

let built = false;

export const motionCorePolicy = Object.freeze({
  root: Object.freeze({
    recommendationId: rootTranslationRecommendationId,
    candidateId: rootTranslationCandidateId,
  }),
  pose: Object.freeze({
    armRestMotionGateStatus,
    armRestCandidateStatus,
    mismatchWarningIds: poseMismatchWarningIds,
    normalizationCandidateSpecs: poseNormalizationCandidateSpecs,
  }),
  selection: Object.freeze({
    candidateGroup: selectCandidateGroup,
  }),
  retarget: Object.freeze({
    strictVerdict: retargetStrictVerdict,
    robotVoxelRuleId: robotVoxelRetargetRuleId,
    robotVoxelScore: robotVoxelRetargetScore,
    robotVoxelVerdict: robotVoxelRetargetVerdict,
  }),
  quality: Object.freeze({
    verdictScore: qualityVerdictScore,
    compareMetricStatus: qualityCompareMetricStatus,
    comparisonDecision: qualityComparisonDecision,
    summaryVerdict: qualitySummaryVerdict,
    renderVerifyVerdict: qualityRenderVerifyVerdict,
    foregroundVerdict: qualityForegroundVerdict,
    screenCoverageMinVerdict: qualityScreenCoverageMinVerdict,
    screenCoverageMaxVerdict: qualityScreenCoverageMaxVerdict,
    jumpVerdict: qualityJumpVerdict,
    groundVerdict: qualityGroundVerdict,
    footContactVerdict: qualityFootContactVerdict,
    limbExtentVerdict: qualityLimbExtentVerdict,
    loopMetadataVerdict: qualityLoopMetadataVerdict,
  }),
  kaguraRuntime: Object.freeze({
    outcomeStatus: kaguraRuntimeOutcomeStatus,
    shouldFail: kaguraRuntimeShouldFail,
  }),
});

export function armRestMotionGateStatus(maxUpperArmRotationRangeDeg) {
  return runMotionCore([
    "arm-rest-gate",
    optionalDoubleArg(maxUpperArmRotationRangeDeg),
  ]);
}

export function armRestCandidateStatus(maxUpperArmRotationRangeDeg) {
  return runMotionCore([
    "arm-rest-candidate",
    optionalDoubleArg(maxUpperArmRotationRangeDeg),
  ]);
}

export function selectCandidateGroup(automatic, decisions) {
  return runMotionCore([
    "select-candidate-group",
    automatic ? "true" : "false",
    intArg(decisions.candidateImproved),
    intArg(decisions.candidateRegressed),
    intArg(decisions.candidateTradeoff),
    intArg(decisions.stable),
    intArg(decisions.missingComparison),
    intArg(decisions.missingSampleComparison),
  ]);
}

export function rootTranslationRecommendationId({
  mode,
  heightScale,
  heightScaleDelta,
  verticalDeltaRange,
}) {
  return runMotionCore([
    "root-translation-recommendation",
    mode,
    optionalDoubleArg(heightScale),
    optionalDoubleArg(heightScaleDelta),
    optionalDoubleArg(verticalDeltaRange),
  ]);
}

export function rootTranslationCandidateId(recommendationId) {
  return runMotionCore([
    "root-translation-candidate",
    recommendationId,
  ]);
}

export function poseMismatchWarningIds({
  scaleSpreadRatio,
  footSpreadScale,
  upperLegSpreadScale,
  shoulderWidthScale,
  skeletonHeightScale,
  armAngleDeltaDeg,
}) {
  const output = runMotionCore([
    "pose-mismatch-warning-ids",
    optionalDoubleArg(scaleSpreadRatio),
    optionalDoubleArg(footSpreadScale),
    optionalDoubleArg(upperLegSpreadScale),
    optionalDoubleArg(shoulderWidthScale),
    optionalDoubleArg(skeletonHeightScale),
    optionalDoubleArg(armAngleDeltaDeg),
  ]);
  return output ? output.split("|") : [];
}

export function poseNormalizationCandidateSpecs({
  hasArmRestAngleMismatch,
  hasFootSpreadMismatch,
  hasLegSpreadMismatch,
  hasShoulderWidthMismatch,
  maxUpperArmRotationRangeDeg,
}) {
  const output = runMotionCore([
    "pose-normalization-candidate-specs",
    hasArmRestAngleMismatch ? "true" : "false",
    hasFootSpreadMismatch ? "true" : "false",
    hasLegSpreadMismatch ? "true" : "false",
    hasShoulderWidthMismatch ? "true" : "false",
    optionalDoubleArg(maxUpperArmRotationRangeDeg),
  ]);
  return output ? output.split("|").map(parseCandidateSpec) : [];
}

export function retargetStrictVerdict({
  trackCount,
  skipped,
  minRetainedRatioWarn,
}) {
  return runMotionCore([
    "retarget-strict-verdict",
    intArg(trackCount),
    intArg(skipped),
    optionalDoubleArg(minRetainedRatioWarn ?? 0.4),
  ]);
}

export function robotVoxelRetargetRuleId(text) {
  return runMotionCore([
    "robot-voxel-retarget-rule",
    String(text ?? "").toLowerCase(),
  ]);
}

export function robotVoxelRetargetScore(weightedPenalty) {
  return Number(runMotionCore([
    "robot-voxel-retarget-score",
    optionalDoubleArg(weightedPenalty),
  ]));
}

export function robotVoxelRetargetVerdict({
  weightedPenalty,
  hardFailureCount,
}) {
  return runMotionCore([
    "robot-voxel-retarget-verdict",
    optionalDoubleArg(weightedPenalty),
    intArg(hardFailureCount),
  ]);
}

export function qualityVerdictScore(verdict) {
  return Number(runMotionCore([
    "quality-verdict-score",
    String(verdict ?? ""),
  ]));
}

export function qualityCompareMetricStatus({
  baseline,
  candidate,
  tolerance,
  better,
}) {
  return runMotionCore([
    "quality-compare-metric-status",
    optionalDoubleArg(baseline),
    optionalDoubleArg(candidate),
    optionalDoubleArg(tolerance),
    String(better ?? ""),
  ]);
}

export function qualityComparisonDecision({
  improved,
  regressed,
}) {
  return runMotionCore([
    "quality-comparison-decision",
    intArg(improved),
    intArg(regressed),
  ]);
}

export function qualitySummaryVerdict({ failCount, warnCount }) {
  return runMotionCore([
    "quality-summary-verdict",
    intArg(failCount),
    intArg(warnCount),
  ]);
}

export function qualityRenderVerifyVerdict({ hasReport, ok }) {
  return runMotionCore([
    "quality-render-verify-verdict",
    hasReport ? "true" : "false",
    ok ? "true" : "false",
  ]);
}

export function qualityForegroundVerdict({ minForeground, threshold }) {
  return runMotionCore([
    "quality-foreground-verdict",
    optionalDoubleArg(minForeground),
    optionalDoubleArg(threshold),
  ]);
}

export function qualityScreenCoverageMinVerdict({ minCoverage, threshold }) {
  return runMotionCore([
    "quality-screen-coverage-min-verdict",
    optionalDoubleArg(minCoverage),
    optionalDoubleArg(threshold),
  ]);
}

export function qualityScreenCoverageMaxVerdict({ maxCoverage, threshold }) {
  return runMotionCore([
    "quality-screen-coverage-max-verdict",
    optionalDoubleArg(maxCoverage),
    optionalDoubleArg(threshold),
  ]);
}

export function qualityJumpVerdict({ value, threshold }) {
  return runMotionCore([
    "quality-jump-verdict",
    optionalDoubleArg(value),
    optionalDoubleArg(threshold),
  ]);
}

export function qualityGroundVerdict({ minGround, warnThreshold, failThreshold }) {
  return runMotionCore([
    "quality-ground-verdict",
    optionalDoubleArg(minGround),
    optionalDoubleArg(warnThreshold),
    optionalDoubleArg(failThreshold),
  ]);
}

export function qualityFootContactVerdict({
  contactCount,
  minFootDeltaY,
  sinkWarnThreshold,
  alwaysFloatingWarnThreshold,
}) {
  return runMotionCore([
    "quality-foot-contact-verdict",
    intArg(contactCount),
    optionalDoubleArg(minFootDeltaY),
    optionalDoubleArg(sinkWarnThreshold),
    optionalDoubleArg(alwaysFloatingWarnThreshold),
  ]);
}

export function qualityLimbExtentVerdict({
  displacementCount,
  pelvis,
  maxTrackedNode,
  maxPelvisWarn,
  maxTrackedNodeWarn,
}) {
  return runMotionCore([
    "quality-limb-extent-verdict",
    intArg(displacementCount),
    optionalDoubleArg(pelvis),
    optionalDoubleArg(maxTrackedNode),
    optionalDoubleArg(maxPelvisWarn),
    optionalDoubleArg(maxTrackedNodeWarn),
  ]);
}

export function qualityLoopMetadataVerdict(missingCount) {
  return runMotionCore([
    "quality-loop-metadata-verdict",
    intArg(missingCount),
  ]);
}

export function kaguraRuntimeOutcomeStatus({
  targetOk,
  calibrationOk,
}) {
  return runMotionCore([
    "kagura-runtime-outcome-status",
    targetOk ? "true" : "false",
    optionalBoolArg(calibrationOk),
  ]);
}

export function kaguraRuntimeShouldFail(outcomeStatus, {
  allowEnvironmentFailure = false,
} = {}) {
  return runMotionCore([
    "kagura-runtime-should-fail",
    String(outcomeStatus ?? ""),
    allowEnvironmentFailure ? "true" : "false",
  ]) === "true";
}

export function runMotionCore(args) {
  ensureMotionCoreCli();
  return run(process.execPath, [cliPath, ...args]);
}

export function ensureMotionCoreCli() {
  if (built) return;
  run("moon", [
    "-C",
    runDir,
    "build",
    "motion-core",
    "motion-core-cli-args",
    "motion-core-cli",
    "--target",
    "js",
  ]);
  built = true;
}

function optionalDoubleArg(value) {
  return Number.isFinite(value) ? String(value) : "null";
}

function intArg(value) {
  return String(Number.isFinite(value) ? Math.trunc(value) : 0);
}

function optionalBoolArg(value) {
  return typeof value === "boolean" ? String(value) : "null";
}

function parseCandidateSpec(value) {
  const [id, status, ...extra] = value.split(":");
  if (!id || !status || extra.length > 0) {
    throw new Error(`invalid motion-core candidate spec: ${value}`);
  }
  return { id, status };
}

function run(command, args) {
  const result = spawnSync(command, args, {
    cwd: repoRoot,
    encoding: "utf8",
  });
  if (result.status !== 0) {
    const detail = [result.stdout, result.stderr].filter(Boolean).join("\n");
    throw new Error(
      `${command} ${args.join(" ")} failed with ${result.status}\n${detail}`,
    );
  }
  return result.stdout.trim();
}
