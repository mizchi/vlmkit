import { isDeepStrictEqual } from "node:util";
import { evaluateRetargetWarnings } from "./retarget-profiles.mjs";

export function evaluateRetargetCalibrationCases(fixture) {
  return (fixture?.cases ?? []).map((testCase) => evaluateRetargetCalibrationCase(testCase));
}

export function summarizeRetargetCalibration(results) {
  const profiles = {};
  for (const result of results) {
    const profile = result.profile ?? "unknown";
    const entry = profiles[profile] ?? { caseCount: 0, passed: 0, failed: 0 };
    entry.caseCount++;
    if (result.ok) entry.passed++;
    else entry.failed++;
    profiles[profile] = entry;
  }
  return {
    caseCount: results.length,
    passed: results.filter((result) => result.ok).length,
    failed: results.filter((result) => !result.ok).length,
    profiles,
  };
}

function evaluateRetargetCalibrationCase(testCase) {
  const profile = testCase.profile ?? "strict";
  const actual = evaluateRetargetWarnings(motionWithWarnings(testCase.warnings ?? []), {
    profileName: profile,
  });
  const checks = [];
  for (const [key, expected] of Object.entries(testCase.expected ?? {})) {
    checkExpected(checks, key, getPath(actual, key), expected);
  }
  return {
    id: testCase.id,
    profile,
    ok: checks.every((check) => check.ok),
    checks,
    actual,
  };
}

function checkExpected(checks, id, actual, expected) {
  if (isPlainObject(expected)) {
    for (const [key, nestedExpected] of Object.entries(expected)) {
      checkExpected(checks, `${id}.${key}`, actual?.[key], nestedExpected);
    }
    return;
  }
  checkEqual(checks, id, actual, expected);
}

function motionWithWarnings(reasons) {
  return {
    source: {
      skippedChannelCount: reasons.length,
      warnings: reasons.map((reason, index) => ({
        clipId: "Calibration",
        animationIndex: 0,
        channelIndex: index,
        node: reason.match(/for ([^\s]+)/)?.[1] ?? null,
        path: "rotation",
        reason,
      })),
    },
    clips: [
      {
        id: "Calibration",
        tracks: [{ target: "hips" }, { target: "head" }],
      },
    ],
  };
}

function getPath(value, path) {
  return String(path).split(".").reduce((current, key) => current?.[key], value);
}

function checkEqual(checks, id, actual, expected) {
  checks.push(isDeepStrictEqual(actual, expected)
    ? { id, ok: true, value: { actual, expected } }
    : { id, ok: false, reason: "value mismatch", value: { actual, expected } });
}

function isPlainObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}
