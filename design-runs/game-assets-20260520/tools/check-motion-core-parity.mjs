import {
  armRestCandidateStatus,
  armRestMotionGateStatus,
  poseMismatchWarningIds,
  poseNormalizationCandidateSpecs,
  rootTranslationCandidateId,
  rootTranslationRecommendationId,
  selectCandidateGroup,
  motionCorePolicy,
} from "./motion-core-runtime.mjs";

const cases = [
  ["arm-rest-gate null", () => armRestMotionGateStatus(null), "unavailable"],
  ["arm-rest-gate 14.48395", () => armRestMotionGateStatus(14.48395), "blocked"],
  ["arm-rest-gate 60", () => armRestMotionGateStatus(60), "passed"],
  [
    "arm-rest-candidate 14.48395",
    () => armRestCandidateStatus(14.48395),
    "needs-motion-evidence",
  ],
  ["arm-rest-candidate 108.40739", () => armRestCandidateStatus(108.40739), "runnable"],
  [
    "select-candidate-group needs-policy",
    () => selectCandidateGroup(false, {
      candidateImproved: 1,
      candidateRegressed: 0,
      candidateTradeoff: 0,
      stable: 0,
      missingComparison: 0,
      missingSampleComparison: 0,
    }),
    "needs-policy",
  ],
  [
    "select-candidate-group accepted",
    () => selectCandidateGroup(true, {
      candidateImproved: 1,
      candidateRegressed: 0,
      candidateTradeoff: 0,
      stable: 0,
      missingComparison: 0,
      missingSampleComparison: 0,
    }),
    "accepted",
  ],
  [
    "select-candidate-group rejected",
    () => selectCandidateGroup(false, {
      candidateImproved: 0,
      candidateRegressed: 1,
      candidateTradeoff: 0,
      stable: 0,
      missingComparison: 0,
      missingSampleComparison: 0,
    }),
    "rejected",
  ],
  [
    "select-candidate-group promotable",
    () => selectCandidateGroup(false, {
      candidateImproved: 2,
      candidateRegressed: 0,
      candidateTradeoff: 0,
      stable: 1,
      missingComparison: 0,
      missingSampleComparison: 0,
    }),
    "promotable",
  ],
  [
    "select-candidate-group stable-only",
    () => selectCandidateGroup(false, {
      candidateImproved: 0,
      candidateRegressed: 0,
      candidateTradeoff: 0,
      stable: 3,
      missingComparison: 0,
      missingSampleComparison: 0,
    }),
    "neutral",
  ],
  [
    "select-candidate-group missing-comparison",
    () => selectCandidateGroup(false, {
      candidateImproved: 0,
      candidateRegressed: 0,
      candidateTradeoff: 0,
      stable: 0,
      missingComparison: 1,
      missingSampleComparison: 0,
    }),
    "missing-comparison",
  ],
  [
    "root-translation-recommendation unavailable",
    () => rootTranslationRecommendationId({
      mode: "relative",
      heightScale: null,
      heightScaleDelta: 0.3,
      verticalDeltaRange: 0.2,
    }),
    "height-scale-unavailable",
  ],
  [
    "root-translation-recommendation relative candidate",
    () => rootTranslationRecommendationId({
      mode: "relative",
      heightScale: 0.6,
      heightScaleDelta: 0.2,
      verticalDeltaRange: 0.08,
    }),
    "consider-scale-to-model",
  ],
  [
    "root-translation-recommendation relative ok",
    () => rootTranslationRecommendationId({
      mode: "relative",
      heightScale: 0.6,
      heightScaleDelta: 0.2,
      verticalDeltaRange: 0.079,
    }),
    "relative-ok",
  ],
  [
    "root-translation-recommendation horizontal dropped",
    () => rootTranslationRecommendationId({
      mode: "horizontal-only",
      heightScale: 0.6,
      heightScaleDelta: 0.2,
      verticalDeltaRange: 0.08,
    }),
    "vertical-motion-dropped",
  ],
  [
    "root-translation-candidate scale",
    () => rootTranslationCandidateId("consider-scale-to-model"),
    "root-scale-to-model",
  ],
  [
    "root-translation-candidate relative",
    () => rootTranslationCandidateId("vertical-motion-dropped"),
    "root-relative",
  ],
  [
    "root-translation-candidate none",
    () => rootTranslationCandidateId("relative-ok"),
    "none",
  ],
  [
    "pose-mismatch-warning-ids all",
    () => poseMismatchWarningIds({
      scaleSpreadRatio: 1.25,
      footSpreadScale: 2.0,
      upperLegSpreadScale: 0.5,
      shoulderWidthScale: 1.6,
      skeletonHeightScale: 1.0,
      armAngleDeltaDeg: 45.0,
    }).join("|"),
    "scale-inconsistent|foot-spread-mismatch|leg-spread-mismatch|shoulder-width-mismatch|arm-rest-angle-mismatch",
  ],
  [
    "pose-mismatch-warning-ids none",
    () => poseMismatchWarningIds({
      scaleSpreadRatio: 1.249,
      footSpreadScale: 1.999,
      upperLegSpreadScale: 0.501,
      shoulderWidthScale: 1.39,
      skeletonHeightScale: 1.0,
      armAngleDeltaDeg: 44.9,
    }).join("|"),
    "",
  ],
  [
    "pose-mismatch-warning-ids missing reference",
    () => poseMismatchWarningIds({
      scaleSpreadRatio: null,
      footSpreadScale: null,
      upperLegSpreadScale: null,
      shoulderWidthScale: 1.6,
      skeletonHeightScale: null,
      armAngleDeltaDeg: null,
    }).join("|"),
    "",
  ],
  [
    "pose-normalization-candidate-specs all",
    () => formatCandidateSpecs(poseNormalizationCandidateSpecs({
      hasArmRestAngleMismatch: true,
      hasFootSpreadMismatch: true,
      hasLegSpreadMismatch: true,
      hasShoulderWidthMismatch: true,
      maxUpperArmRotationRangeDeg: 108.40739,
    })),
    "arm-rest-pose-offset:runnable|stance-width-adapter:runnable|shoulder-width-adapter:review-target-rig",
  ],
  [
    "pose-normalization-candidate-specs arm blocked",
    () => formatCandidateSpecs(poseNormalizationCandidateSpecs({
      hasArmRestAngleMismatch: true,
      hasFootSpreadMismatch: false,
      hasLegSpreadMismatch: false,
      hasShoulderWidthMismatch: false,
      maxUpperArmRotationRangeDeg: 14.48395,
    })),
    "arm-rest-pose-offset:needs-motion-evidence",
  ],
  [
    "pose-normalization-candidate-specs lower body",
    () => formatCandidateSpecs(poseNormalizationCandidateSpecs({
      hasArmRestAngleMismatch: false,
      hasFootSpreadMismatch: false,
      hasLegSpreadMismatch: true,
      hasShoulderWidthMismatch: false,
      maxUpperArmRotationRangeDeg: null,
    })),
    "stance-width-adapter:runnable",
  ],
  [
    "policy.root.recommendationId",
    () => motionCorePolicy.root.recommendationId({
      mode: "relative",
      heightScale: 0.6,
      heightScaleDelta: 0.2,
      verticalDeltaRange: 0.08,
    }),
    "consider-scale-to-model",
  ],
  [
    "policy.root.candidateId",
    () => motionCorePolicy.root.candidateId("vertical-motion-dropped"),
    "root-relative",
  ],
  [
    "policy.pose.armRestMotionGateStatus",
    () => motionCorePolicy.pose.armRestMotionGateStatus(108.40739),
    "passed",
  ],
  [
    "policy.pose.mismatchWarningIds",
    () => motionCorePolicy.pose.mismatchWarningIds({
      scaleSpreadRatio: null,
      footSpreadScale: 2.0,
      upperLegSpreadScale: null,
      shoulderWidthScale: null,
      skeletonHeightScale: null,
      armAngleDeltaDeg: null,
    }).join("|"),
    "foot-spread-mismatch",
  ],
  [
    "policy.pose.normalizationCandidateSpecs",
    () => formatCandidateSpecs(motionCorePolicy.pose.normalizationCandidateSpecs({
      hasArmRestAngleMismatch: true,
      hasFootSpreadMismatch: false,
      hasLegSpreadMismatch: false,
      hasShoulderWidthMismatch: false,
      maxUpperArmRotationRangeDeg: 108.40739,
    })),
    "arm-rest-pose-offset:runnable",
  ],
  [
    "policy.selection.candidateGroup",
    () => motionCorePolicy.selection.candidateGroup(false, {
      candidateImproved: 0,
      candidateRegressed: 0,
      candidateTradeoff: 1,
      missingComparison: 0,
      missingSampleComparison: 0,
    }),
    "rejected",
  ],
];

const failures = [];

for (const [label, evaluate, expected] of cases) {
  const actual = evaluate();
  if (actual !== expected) {
    failures.push(`${label}: expected ${expected}, got ${actual}`);
  }
}

if (failures.length > 0) {
  console.error(failures.join("\n"));
  process.exitCode = 1;
} else {
  console.log(`motion-core parity passed: ${cases.length} cases`);
}

function formatCandidateSpecs(specs) {
  return specs.map((spec) => `${spec.id}:${spec.status}`).join("|");
}
