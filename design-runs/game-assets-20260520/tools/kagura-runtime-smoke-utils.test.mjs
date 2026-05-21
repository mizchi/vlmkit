import assert from "node:assert/strict";
import test from "node:test";

import {
  classifyRuntimeOutcome,
  createClipPlaybackStatus,
  createPosePlaybackStatus,
  sampleGltfClipPose,
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

test("createClipPlaybackStatus marks no clips as not-applicable", () => {
  assert.deepEqual(createClipPlaybackStatus([], null), {
    status: "not-applicable",
    requestedClips: [],
    playableClips: [],
    missingClips: [],
    playedClip: null,
    reason: "handoff contract declares no animation clips",
  });
});

test("createClipPlaybackStatus marks viewer without clip API as pending viewer support", () => {
  assert.deepEqual(createClipPlaybackStatus(["idle_bob"], null), {
    status: "pending-viewer-support",
    requestedClips: ["idle_bob"],
    playableClips: [],
    missingClips: ["idle_bob"],
    playedClip: null,
    reason: "Kagura gltf_viewer did not expose runtime clip playback state",
  });
});

test("createClipPlaybackStatus marks a matching played clip as verified", () => {
  assert.deepEqual(createClipPlaybackStatus(["idle_bob", "walk_cycle"], {
    clips: ["idle_bob", "walk_cycle"],
    currentClip: "walk_cycle",
    playing: true,
    timeSeconds: 0.42,
  }), {
    status: "verified",
    requestedClips: ["idle_bob", "walk_cycle"],
    playableClips: ["idle_bob", "walk_cycle"],
    missingClips: [],
    playedClip: "walk_cycle",
    playing: true,
    timeSeconds: 0.42,
    reason: "Kagura runtime exposed and played a requested clip",
  });
});

test("createPosePlaybackStatus waits for viewer node transform support", () => {
  assert.deepEqual(createPosePlaybackStatus({
    clipPlayback: { status: "verified", playedClip: "walk_cycle", timeSeconds: 0.25 },
    runtimeState: { currentClip: "walk_cycle" },
    expectedPose: {
      clip: "walk_cycle",
      timeSeconds: 0.25,
      durationSeconds: 1,
      sampledNodes: [
        { nodeIndex: 1, nodeName: "pelvis", translation: [0, 1.285, 0] },
      ],
    },
  }), {
    status: "pending-viewer-support",
    clip: "walk_cycle",
    timeSeconds: 0.25,
    comparedNodeCount: 0,
    maxDelta: null,
    mismatches: [],
    reason: "Kagura gltf_viewer did not expose node transform playback state",
  });
});

test("createPosePlaybackStatus verifies sampled node transforms", () => {
  assert.deepEqual(createPosePlaybackStatus({
    clipPlayback: { status: "verified", playedClip: "walk_cycle", timeSeconds: 0.25 },
    runtimeState: {
      nodeTransforms: [
        {
          nodeIndex: 1,
          translation: [0, 1.285, 0],
          rotation: [0, 0, 0, 1],
          scale: [1, 1, 1],
        },
        {
          nodeIndex: 2,
          translation: [0, 0.36, 0],
          rotation: [0.01, 0, 0, 0.99995],
          scale: [1, 1, 1],
        },
      ],
    },
    expectedPose: {
      clip: "walk_cycle",
      timeSeconds: 0.25,
      durationSeconds: 1,
      sampledNodes: [
        { nodeIndex: 1, nodeName: "pelvis", translation: [0, 1.285, 0] },
        { nodeIndex: 2, nodeName: "torso", rotation: [0.01, 0, 0, 0.99995] },
      ],
    },
  }), {
    status: "verified",
    clip: "walk_cycle",
    timeSeconds: 0.25,
    comparedNodeCount: 2,
    maxDelta: 0,
    mismatches: [],
    reason: "Kagura runtime node transforms match sampled glTF animation",
  });
});

test("createPosePlaybackStatus fails mismatched sampled transforms", () => {
  const status = createPosePlaybackStatus({
    tolerance: 0.001,
    clipPlayback: { status: "verified", playedClip: "walk_cycle", timeSeconds: 0.25 },
    runtimeState: {
      nodeTransforms: [
        { nodeIndex: 1, translation: [0, 1.20, 0], rotation: [0, 0, 0, 1], scale: [1, 1, 1] },
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
  assert.equal(status.status, "mismatch");
  assert.equal(status.comparedNodeCount, 1);
  assert.equal(status.mismatches[0].nodeName, "pelvis");
  assert.ok(status.maxDelta > 0.08);
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
  assert.equal(pose.clip, "move");
  assert.equal(pose.sampledNodes.length, 1);
  assert.deepEqual(pose.sampledNodes[0].translation, [0.5, 1, 1.5]);
  assert.ok(Math.abs(pose.sampledNodes[0].rotation[2] - 0.38268343) < 0.0001);
  assert.ok(Math.abs(pose.sampledNodes[0].rotation[3] - 0.92387953) < 0.0001);
});
