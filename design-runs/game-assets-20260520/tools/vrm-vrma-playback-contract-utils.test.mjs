import assert from "node:assert/strict";
import test from "node:test";

import {
  evaluateVrmVrmaPlaybackContract,
  humanoidBoneNames,
} from "./vrm-vrma-playback-contract-utils.mjs";

test("evaluateVrmVrmaPlaybackContract requires a humanoid VRMA and matching extracted Motion IR", () => {
  const vrmGltf = {
    extensions: {
      VRMC_vrm: {
        humanoid: {
          humanBones: {
            hips: { node: 0 },
            head: { node: 1 },
            leftFoot: { node: 2 },
            rightFoot: { node: 3 },
          },
        },
      },
    },
  };
  const vrmaGltf = {
    extensions: {
      VRMC_vrm_animation: {
        specVersion: "1.0",
        humanoid: {
          humanBones: {
            hips: { node: 0 },
            head: { node: 1 },
            leftFoot: { node: 2 },
            rightFoot: { node: 3 },
          },
        },
      },
    },
    animations: [{ name: "LookAround" }],
  };
  const motion = {
    source: {
      targetSpace: "humanoid",
      vrmcVrmAnimation: {
        specVersion: "1.0",
        humanoidBoneCount: 4,
      },
    },
    clips: [
      {
        id: "LookAround",
        tracks: [
          { target: "hips", path: "translation" },
          { target: "head", path: "rotation" },
        ],
      },
    ],
  };

  assert.deepEqual(humanoidBoneNames(vrmaGltf, "VRMC_vrm_animation"), [
    "head",
    "hips",
    "leftFoot",
    "rightFoot",
  ]);

  const report = evaluateVrmVrmaPlaybackContract({
    vrmGltf,
    vrmaGltf,
    motion,
    renderVerify: { ok: true },
    requiredBones: ["hips", "head"],
    requiredClips: ["LookAround"],
  });

  assert.equal(report.ok, true);
  assert.deepEqual(report.summary, {
    checkCount: 9,
    failed: 0,
    warnings: 0,
    vrmHumanoidBoneCount: 4,
    vrmaHumanoidBoneCount: 4,
    motionClipCount: 1,
    motionTrackCount: 2,
  });
});

test("humanoidBoneNames supports VRM 0.x humanoid extension shape", () => {
  assert.deepEqual(humanoidBoneNames({
    extensions: {
      VRM: {
        humanoid: {
          humanBones: [
            { bone: "hips", node: 3 },
            { bone: "head", node: 12 },
          ],
        },
      },
    },
  }, "VRMC_vrm"), ["head", "hips"]);
});
