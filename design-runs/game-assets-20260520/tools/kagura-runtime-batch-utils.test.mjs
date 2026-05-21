import assert from "node:assert/strict";
import test from "node:test";

import {
  createRuntimeBatchSummary,
  defaultRuntimeSmokeReportPath,
  defaultRuntimeSmokeSummaryPath,
  nextRuntimeSmokePort,
  summarizeRuntimeBatch,
} from "./kagura-runtime-batch-utils.mjs";

test("defaultRuntimeSmokeReportPath writes next to the handoff contract", () => {
  assert.equal(
    defaultRuntimeSmokeReportPath("/repo/models/robot/kagura-handoff.json"),
    "/repo/models/robot/kagura-handoff.kagura-runtime-smoke.json",
  );
});

test("defaultRuntimeSmokeSummaryPath writes an ignored generated summary", () => {
  assert.equal(
    defaultRuntimeSmokeSummaryPath("/repo/design-runs/game-assets-20260520/models/robot/kagura-handoff.json"),
    "/repo/design-runs/game-assets-20260520/models/kagura-runtime-batch.kagura-runtime-smoke.json",
  );
});

test("nextRuntimeSmokePort reserves target and calibration ports per contract", () => {
  assert.equal(nextRuntimeSmokePort(8765, 0), 8765);
  assert.equal(nextRuntimeSmokePort(8765, 1), 8767);
  assert.equal(nextRuntimeSmokePort(8765, 2), 8769);
});

test("summarizeRuntimeBatch counts pass and failure classes", () => {
  assert.deepEqual(
    summarizeRuntimeBatch([
      { outcome: { status: "pass" } },
      { outcome: { status: "environment-failed" } },
      { outcome: { status: "asset-failed" } },
      { outcome: { status: "target-failed" } },
    ]),
    {
      total: 4,
      passed: 1,
      failed: 3,
      counts: {
        pass: 1,
        "environment-failed": 1,
        "asset-failed": 1,
        "target-failed": 1,
      },
    },
  );
});

test("createRuntimeBatchSummary includes stable per-asset metrics", () => {
  const summary = createRuntimeBatchSummary([
    {
      contract: "design-runs/game-assets-20260520/models/robot/kagura-handoff.json",
      assetId: "robot",
      ok: true,
      outcome: { status: "pass" },
      checks: [
        {
          id: "runtime-frame",
          status: "pass",
          source: "webgpu-readback",
          visiblePixelRatio: 0.6422,
          nonDominantPixelRatio: 0.6422,
        },
      ],
      warnings: [{ path: "kaguraHandoff.animationClips" }],
      failures: [],
      runtime: {
        clipPlayback: {
          status: "pending-viewer-support",
          requestedClips: ["idle_bob"],
          playableClips: [],
          missingClips: ["idle_bob"],
          playedClip: null,
        },
        posePlayback: {
          status: "pending-viewer-support",
          comparedNodeCount: 0,
          maxDelta: null,
          mismatches: [],
        },
      },
    },
  ]);
  assert.deepEqual(summary, {
    total: 1,
    passed: 1,
    failed: 0,
    counts: {
      pass: 1,
      "environment-failed": 0,
      "asset-failed": 0,
      "target-failed": 0,
    },
    assets: [
      {
        contract: "design-runs/game-assets-20260520/models/robot/kagura-handoff.json",
        assetId: "robot",
        ok: true,
        outcome: "pass",
        frame: {
          status: "pass",
          source: "webgpu-readback",
          visiblePixelRatio: 0.6422,
          nonDominantPixelRatio: 0.6422,
        },
        clipPlayback: {
          status: "pending-viewer-support",
          requestedClipCount: 1,
          playableClipCount: 0,
          missingClipCount: 1,
          playedClip: null,
        },
        posePlayback: {
          status: "pending-viewer-support",
          comparedNodeCount: 0,
          maxDelta: null,
          mismatchCount: 0,
        },
        warningCount: 1,
        failureCount: 0,
        warningPaths: ["kaguraHandoff.animationClips"],
      },
    ],
  });
});
