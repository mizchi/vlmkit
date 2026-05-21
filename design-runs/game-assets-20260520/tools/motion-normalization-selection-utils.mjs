import { motionCorePolicy } from "./motion-core-runtime.mjs";

export const DEFAULT_NORMALIZATION_PROMOTION_POLICY = Object.freeze({
  minComparedSamples: 3,
  minImprovedSamples: 2,
  note: "Non-automatic candidates become default-change-ready only with enough repeated improvements and no regressions, tradeoffs, or missing comparisons.",
});

export function groupCandidates(results) {
  const groups = new Map();
  for (const result of results) {
    const key = [
      result.id,
      result.kind,
      result.rootTranslationMode ?? "",
      result.poseNormalization ?? "",
    ].join("|");
    const group = groups.get(key) ?? {
      id: result.id,
      kind: result.kind,
      status: result.status,
      automatic: result.automatic,
      rootTranslationMode: result.rootTranslationMode,
      poseNormalization: result.poseNormalization,
      recommendation: "",
      sampleCount: 0,
      comparedSampleCount: 0,
      decisions: {
        candidateImproved: 0,
        candidateRegressed: 0,
        candidateTradeoff: 0,
        stable: 0,
        missingComparison: 0,
        missingSampleComparison: 0,
      },
      samples: [],
    };
    group.sampleCount += 1;
    if (result.comparisonFound) group.comparedSampleCount += 1;
    incrementDecision(group.decisions, result.decision);
    group.samples.push({
      sample: result.sample,
      outputReport: result.outputReport,
      compareReport: result.compareReport,
      decision: result.decision,
      reasons: result.reasons,
    });
    group.recommendation = motionCorePolicy.selection.candidateGroup(group.automatic, group.decisions);
    groups.set(key, group);
  }
  return [...groups.values()].sort((a, b) => {
    return a.id.localeCompare(b.id) || String(a.poseNormalization).localeCompare(String(b.poseNormalization));
  });
}

export function attachNormalizationReadiness(groups, policy = DEFAULT_NORMALIZATION_PROMOTION_POLICY) {
  return groups.map((group) => ({
    ...group,
    readiness: normalizationReadiness(group, policy),
  }));
}

export function normalizationReadiness(group, policy = DEFAULT_NORMALIZATION_PROMOTION_POLICY) {
  const decisions = group.decisions ?? {};
  const missingCount = (decisions.missingComparison ?? 0) + (decisions.missingSampleComparison ?? 0);
  const blockers = [];
  if (!["accepted", "promotable"].includes(group.recommendation)) {
    blockers.push(`recommendation is ${group.recommendation}`);
  }
  if ((decisions.candidateRegressed ?? 0) > 0) {
    blockers.push("candidate has regression samples");
  }
  if ((decisions.candidateTradeoff ?? 0) > 0) {
    blockers.push("candidate has tradeoff samples");
  }
  if (missingCount > 0) {
    blockers.push("comparison reports are missing");
  }
  if ((group.comparedSampleCount ?? 0) < policy.minComparedSamples) {
    blockers.push(`needs at least ${policy.minComparedSamples} compared samples`);
  }
  if (!group.automatic && (decisions.candidateImproved ?? 0) < policy.minImprovedSamples) {
    blockers.push(`needs at least ${policy.minImprovedSamples} improved samples`);
  }
  const defaultChangeReady = blockers.length === 0;
  return {
    status: defaultChangeReady
      ? "ready"
      : missingCount > 0 || (group.comparedSampleCount ?? 0) < policy.minComparedSamples
        ? "needs-more-samples"
        : "blocked",
    defaultChangeReady,
    blockers,
    minComparedSamples: policy.minComparedSamples,
    minImprovedSamples: policy.minImprovedSamples,
  };
}

export function summarizeNormalizationSelection(groups, plan) {
  return {
    groupCount: groups.length,
    runnable: plan.summary?.runnable ?? (plan.runnable?.length ?? 0),
    blocked: plan.summary?.blocked ?? (plan.blocked?.length ?? 0),
    accepted: groups.filter((group) => group.recommendation === "accepted").length,
    promotable: groups.filter((group) => group.recommendation === "promotable").length,
    rejected: groups.filter((group) => group.recommendation === "rejected").length,
    needsPolicy: groups.filter((group) => group.recommendation === "needs-policy").length,
    neutral: groups.filter((group) => group.recommendation === "neutral").length,
    missingComparison: groups.filter((group) => group.recommendation === "missing-comparison").length,
    readyDefaultChanges: groups.filter((group) => group.readiness?.defaultChangeReady === true).length,
    needsMoreSamples: groups.filter((group) => group.readiness?.status === "needs-more-samples").length,
    blockedDefaultChanges: groups.filter((group) => group.readiness?.status === "blocked").length,
  };
}

export function incrementDecision(decisions, decision) {
  if (decision === "candidate-improved") decisions.candidateImproved += 1;
  else if (decision === "candidate-regressed") decisions.candidateRegressed += 1;
  else if (decision === "candidate-tradeoff") decisions.candidateTradeoff += 1;
  else if (decision === "stable") decisions.stable += 1;
  else if (decision === "missing-sample-comparison") decisions.missingSampleComparison += 1;
  else decisions.missingComparison += 1;
}

