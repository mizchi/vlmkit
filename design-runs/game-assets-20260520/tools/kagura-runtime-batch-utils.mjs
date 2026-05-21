export function defaultRuntimeSmokeReportPath(contractPath) {
  return String(contractPath).replace(/\.json$/, ".kagura-runtime-smoke.json");
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
