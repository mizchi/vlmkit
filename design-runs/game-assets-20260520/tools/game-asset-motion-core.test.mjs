import assert from "node:assert/strict";
import { Buffer } from "node:buffer";
import test from "node:test";

import {
  createClipPlaybackStatus,
  createPosePlaybackStatus,
  decideMotionSourceAdapter,
  sampleGltfClipPose,
  verifyMotionIr,
} from "./game-asset-motion-core.mjs";

test("decideMotionSourceAdapter routes Mixamo/FBX through GLB conversion", () => {
  const decision = decideMotionSourceAdapter({
    path: "downloads/mixamo-walk.fbx",
    sourceKind: "mixamo",
  });
  assert.equal(decision.inputFormat, "fbx");
  assert.equal(decision.status, "requires-conversion");
  assert.equal(decision.strategy, "convert-to-glb-first");
  assert.equal(decision.directFbxParsing, false);
  assert.equal(decision.outputContract, "motion-ir");
  assert.ok(decision.requiredExternalTools.includes("Blender"));
});

test("decideMotionSourceAdapter keeps GLB, VRMA, and Motion IR on the shared contract", () => {
  assert.equal(decideMotionSourceAdapter({ path: "walk-cycle.glb" }).strategy, "extract-gltf-animation");
  assert.equal(decideMotionSourceAdapter({ path: "robot-alert.vrma" }).strategy, "extract-vrm-vrma");
  assert.equal(decideMotionSourceAdapter({ path: "robot.motion.json" }).strategy, "use-motion-ir");
});

test("verifyMotionIr accepts a minimal retargeted looping Motion IR", () => {
  const result = verifyMotionIr({
    version: 1,
    id: "robot-wave",
    source: { kind: "generated" },
    retarget: { head: "Head" },
    clips: [{
      id: "wave",
      durationSeconds: 1,
      loop: true,
      tracks: [{
        target: "head",
        path: "rotation",
        keyframes: [
          { time: 0, rotation: [0, 0, 0, 1] },
          { time: 1, rotation: [0, 0, 0, 1] },
        ],
      }],
    }],
  }, {
    modelNodeNames: ["Head"],
    requiredTargets: ["head"],
  });
  assert.equal(result.ok, true);
  assert.deepEqual(result.failures, []);
});

test("verifyMotionIr rejects missing retargets and bad loop endpoints", () => {
  const result = verifyMotionIr({
    version: 1,
    id: "robot-wave",
    source: { kind: "generated" },
    retarget: { head: "MissingHead" },
    clips: [{
      id: "wave",
      durationSeconds: 1,
      loop: true,
      tracks: [{
        target: "head",
        path: "rotation",
        keyframes: [
          { time: 0, euler: [0, 0, 0] },
          { time: 0.5, euler: [0, 0.2, 0] },
        ],
      }],
    }],
  }, {
    modelNodeNames: ["Head"],
    requiredTargets: ["hips"],
  });
  assert.equal(result.ok, false);
  assert.ok(result.failures.some((failure) => failure.path === "retarget.head"));
  assert.ok(result.failures.some((failure) => failure.reason.includes("missing required source target")));
  assert.ok(result.failures.some((failure) => failure.reason.includes("looping track must end")));
});

test("runtime gates verify matching clip and pose playback", () => {
  const clipPlayback = createClipPlaybackStatus(["walk_cycle"], {
    clips: ["walk_cycle"],
    currentClip: "walk_cycle",
    playing: true,
    timeSeconds: 0.25,
  });
  assert.equal(clipPlayback.status, "verified");

  const posePlayback = createPosePlaybackStatus({
    clipPlayback,
    runtimeState: {
      nodeTransforms: [
        { nodeIndex: 1, translation: [0, 1.285, 0], rotation: [0, 0, 0, 1] },
      ],
    },
    expectedPose: {
      clip: "walk_cycle",
      timeSeconds: 0.25,
      durationSeconds: 1,
      sampledNodes: [
        { nodeIndex: 1, nodeName: "pelvis", translation: [0, 1.285, 0] },
      ],
    },
  });
  assert.equal(posePlayback.status, "verified");
});

test("sampleGltfClipPose samples translation and rotation channels", () => {
  const times = Buffer.alloc(8);
  times.writeFloatLE(0, 0);
  times.writeFloatLE(1, 4);
  const translations = Buffer.alloc(24);
  [0, 0, 0, 1, 2, 3].forEach((value, index) => translations.writeFloatLE(value, index * 4));
  const rotations = Buffer.alloc(32);
  [0, 0, 0, 1, 0, 0, 0.70710678, 0.70710678]
    .forEach((value, index) => rotations.writeFloatLE(value, index * 4));
  const bin = Buffer.concat([times, translations, rotations]);
  const gltf = {
    nodes: [{ name: "root" }],
    bufferViews: [
      { buffer: 0, byteOffset: 0, byteLength: 8 },
      { buffer: 0, byteOffset: 8, byteLength: 24 },
      { buffer: 0, byteOffset: 32, byteLength: 32 },
    ],
    accessors: [
      { bufferView: 0, componentType: 5126, count: 2, type: "SCALAR" },
      { bufferView: 1, componentType: 5126, count: 2, type: "VEC3" },
      { bufferView: 2, componentType: 5126, count: 2, type: "VEC4" },
    ],
    animations: [{
      name: "move",
      samplers: [
        { input: 0, output: 1, interpolation: "LINEAR" },
        { input: 0, output: 2, interpolation: "LINEAR" },
      ],
      channels: [
        { sampler: 0, target: { node: 0, path: "translation" } },
        { sampler: 1, target: { node: 0, path: "rotation" } },
      ],
    }],
  };
  const pose = sampleGltfClipPose(gltf, bin, "move", 0.5);
  assert.deepEqual(pose.sampledNodes[0].translation, [0.5, 1, 1.5]);
  assert.ok(Math.abs(pose.sampledNodes[0].rotation[2] - 0.38268343) < 0.0001);
  assert.ok(Math.abs(pose.sampledNodes[0].rotation[3] - 0.92387953) < 0.0001);
});
