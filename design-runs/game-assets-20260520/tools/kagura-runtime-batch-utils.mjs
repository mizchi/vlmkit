export function defaultRuntimeSmokeReportPath(contractPath) {
  return String(contractPath).replace(/\.json$/, ".kagura-runtime-smoke.json");
}

export function defaultRuntimeSmokeSummaryPath(firstContractPath) {
  return String(firstContractPath)
    .replace(/\/[^/]+\/kagura-handoff\.json$/, "/kagura-runtime-batch.kagura-runtime-smoke.json");
}

export function nextRuntimeSmokePort(basePort, index) {
  return Number(basePort) + index * 2;
}

export function summarizeRuntimeBatch(results) {
  const counts = {
    pass: 0,
    "environment-failed": 0,
    "asset-failed": 0,
    "target-failed": 0,
  };
  for (const result of results) {
    const status = result.outcome?.status ?? "target-failed";
    counts[status] = (counts[status] ?? 0) + 1;
  }
  return {
    total: results.length,
    passed: counts.pass,
    failed: results.length - counts.pass,
    counts,
  };
}

export function createRuntimeBatchSummary(results) {
  return {
    ...summarizeRuntimeBatch(results),
    assets: results.map((report) => {
      const frame = report.checks?.find((check) => check.id === "runtime-frame");
      return {
        contract: report.contract,
        assetId: report.assetId,
        ok: report.ok,
        outcome: report.outcome?.status ?? "target-failed",
        frame: frame
          ? {
              status: frame.status,
              source: frame.source,
              visiblePixelRatio: frame.visiblePixelRatio,
              nonDominantPixelRatio: frame.nonDominantPixelRatio,
            }
          : null,
        clipPlayback: summarizeClipPlayback(report.runtime?.clipPlayback),
        posePlayback: summarizePosePlayback(report.runtime?.posePlayback),
        warningCount: report.warnings?.length ?? 0,
        failureCount: report.failures?.length ?? 0,
        warningPaths: (report.warnings ?? []).map((warning) => warning.path),
      };
    }),
  };
}

function summarizeClipPlayback(clipPlayback) {
  if (!clipPlayback) return null;
  return {
    status: clipPlayback.status,
    requestedClipCount: clipPlayback.requestedClips?.length ?? 0,
    playableClipCount: clipPlayback.playableClips?.length ?? 0,
    missingClipCount: clipPlayback.missingClips?.length ?? 0,
    playedClip: clipPlayback.playedClip ?? null,
  };
}

function summarizePosePlayback(posePlayback) {
  if (!posePlayback) return null;
  return {
    status: posePlayback.status,
    comparedNodeCount: posePlayback.comparedNodeCount ?? 0,
    maxDelta: posePlayback.maxDelta ?? null,
    mismatchCount: posePlayback.mismatches?.length ?? 0,
  };
}
