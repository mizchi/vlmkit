import { motionCorePolicy } from "./motion-core-runtime.mjs";

export function classifyRuntimeOutcome({ targetOk, calibrationOk }) {
  const status = motionCorePolicy.kaguraRuntime.outcomeStatus({
    targetOk,
    calibrationOk,
  });
  if (status === "pass") {
    return {
      status: "pass",
      environmentLikelyBroken: false,
      assetLikelyBroken: false,
    };
  }
  if (status === "environment-failed") {
    return {
      status: "environment-failed",
      environmentLikelyBroken: true,
      assetLikelyBroken: false,
    };
  }
  if (status === "asset-failed") {
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
  return motionCorePolicy.kaguraRuntime.shouldFail(outcome.status, {
    allowEnvironmentFailure,
  });
}

export function sanitizeServerLogLine(line, { kaguraRepo = "" } = {}) {
  let text = String(line).replace(/\u001b\[[0-9;]*m/g, "");
  if (kaguraRepo) {
    text = text.split(kaguraRepo).join("<kaguraRepo>");
  }
  return text.replace(/\(node:\d+\)/g, "(node:<pid>)");
}
