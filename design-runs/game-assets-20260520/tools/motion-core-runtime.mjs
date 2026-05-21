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
