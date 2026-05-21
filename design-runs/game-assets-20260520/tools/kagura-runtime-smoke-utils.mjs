export function classifyRuntimeOutcome({ targetOk, calibrationOk }) {
  if (targetOk) {
    return {
      status: "pass",
      environmentLikelyBroken: false,
      assetLikelyBroken: false,
    };
  }
  if (calibrationOk === false) {
    return {
      status: "environment-failed",
      environmentLikelyBroken: true,
      assetLikelyBroken: false,
    };
  }
  if (calibrationOk === true) {
    return {
      status: "asset-failed",
      environmentLikelyBroken: false,
      assetLikelyBroken: true,
    };
  }
  return {
    status: "target-failed",
    environmentLikelyBroken: false,
    assetLikelyBroken: false,
  };
}

export function shouldFailProcess(outcome, { allowEnvironmentFailure = false } = {}) {
  if (outcome.status === "pass") return false;
  if (outcome.status === "environment-failed" && allowEnvironmentFailure) return false;
  return true;
}

export function sanitizeServerLogLine(line, { kaguraRepo = "" } = {}) {
  let text = String(line).replace(/\u001b\[[0-9;]*m/g, "");
  if (kaguraRepo) {
    text = text.split(kaguraRepo).join("<kaguraRepo>");
  }
  return text.replace(/\(node:\d+\)/g, "(node:<pid>)");
}
