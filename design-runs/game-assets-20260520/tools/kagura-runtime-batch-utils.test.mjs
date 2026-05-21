import assert from "node:assert/strict";
import test from "node:test";

import {
  defaultRuntimeSmokeReportPath,
  nextRuntimeSmokePort,
  summarizeRuntimeBatch,
} from "./kagura-runtime-batch-utils.mjs";

test("defaultRuntimeSmokeReportPath writes next to the handoff contract", () => {
  assert.equal(
    defaultRuntimeSmokeReportPath("/repo/models/robot/kagura-handoff.json"),
    "/repo/models/robot/kagura-handoff.kagura-runtime-smoke.json",
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
