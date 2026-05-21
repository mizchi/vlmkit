import assert from "node:assert/strict";
import test from "node:test";

import {
  classifyRuntimeOutcome,
  sanitizeServerLogLine,
  shouldFailProcess,
} from "./kagura-runtime-smoke-utils.mjs";

test("classifyRuntimeOutcome marks calibration double-fail as environment failure", () => {
  assert.deepEqual(classifyRuntimeOutcome({ targetOk: false, calibrationOk: false }), {
    status: "environment-failed",
    environmentLikelyBroken: true,
    assetLikelyBroken: false,
  });
});

test("classifyRuntimeOutcome keeps target failure separate when calibration passes", () => {
  assert.deepEqual(classifyRuntimeOutcome({ targetOk: false, calibrationOk: true }), {
    status: "asset-failed",
    environmentLikelyBroken: false,
    assetLikelyBroken: true,
  });
});

test("classifyRuntimeOutcome passes target success even when calibration is absent", () => {
  assert.deepEqual(classifyRuntimeOutcome({ targetOk: true, calibrationOk: null }), {
    status: "pass",
    environmentLikelyBroken: false,
    assetLikelyBroken: false,
  });
});

test("shouldFailProcess can soft-fail environment failures only", () => {
  assert.equal(
    shouldFailProcess(
      { status: "environment-failed", environmentLikelyBroken: true },
      { allowEnvironmentFailure: true },
    ),
    false,
  );
  assert.equal(
    shouldFailProcess(
      { status: "asset-failed", assetLikelyBroken: true },
      { allowEnvironmentFailure: true },
    ),
    true,
  );
});

test("sanitizeServerLogLine removes unstable terminal and local path details", () => {
  assert.equal(
    sanitizeServerLogLine(
      "\u001b[36m[moonbit]\u001b[0m Watching build directory: /tmp/work/kagura/examples/gltf_viewer/_build",
      { kaguraRepo: "/tmp/work/kagura" },
    ),
    "[moonbit] Watching build directory: <kaguraRepo>/examples/gltf_viewer/_build",
  );
  assert.equal(
    sanitizeServerLogLine("(node:58962) [DEP0190] warning"),
    "(node:<pid>) [DEP0190] warning",
  );
});
