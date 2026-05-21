import assert from "node:assert/strict";
import test from "node:test";

import {
  evaluateRetargetCalibrationCases,
  summarizeRetargetCalibration,
} from "./retarget-profile-calibration-utils.mjs";

test("evaluateRetargetCalibrationCases pins tolerated, soft-fail, and hard-fail cases", () => {
  const fixture = {
    cases: [
      {
        id: "fine-detail",
        profile: "robot-voxel",
        warnings: [
          "retarget preset robot-voxel has no target for leftThumbProximal",
          "retarget preset robot-voxel has no target for rightToes",
          "retarget preset robot-voxel has no target for chest",
        ],
        expected: {
          verdict: "pass",
          score: 1,
          weightedPenalty: 0,
          skippedByPolicy: {
            finger: { count: 1, penalty: 0 },
            toe: { count: 1, penalty: 0 },
            "upper-body-fallback": { count: 1, penalty: 0 },
          },
        },
      },
      {
        id: "unexpected-soft",
        profile: "robot-voxel",
        warnings: [
          "retarget preset robot-voxel has no target for antenna",
          "retarget preset robot-voxel has no target for tail",
          "retarget preset robot-voxel has no target for cape",
        ],
        expected: {
          verdict: "fail",
          score: 0.25,
          weightedPenalty: 1.5,
          nonToleratedSkipped: 3,
        },
      },
      {
        id: "core-hard-fail",
        profile: "robot-voxel",
        warnings: [
          "retarget preset robot-voxel has no target for hips",
        ],
        expected: {
          verdict: "fail",
          hardFailureSkipped: 1,
        },
      },
    ],
  };

  const results = evaluateRetargetCalibrationCases(fixture);

  assert.equal(results.every((result) => result.ok), true);
  assert.deepEqual(summarizeRetargetCalibration(results), {
    caseCount: 3,
    passed: 3,
    failed: 0,
    profiles: {
      "robot-voxel": {
        caseCount: 3,
        passed: 3,
        failed: 0,
      },
    },
  });
});

