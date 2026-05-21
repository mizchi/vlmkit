import assert from "node:assert/strict";
import { Buffer } from "node:buffer";
import { describe, it } from "node:test";

import {
  createClipPlaybackStatus,
  createPosePlaybackStatus,
  decideMotionSourceAdapter,
  sampleGltfClipPose,
  verifyMotionIr,
} from "./game-asset-motion.ts";

describe("decideMotionSourceAdapter", () => {
  it("routes Mixamo/FBX through external GLB conversion before Motion IR extraction", () => {
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
    assert.ok(decision.reasons.some((reason) => reason.includes("FBX")));
  });

  it("uses the glTF animation extractor for GLB inputs", () => {
    const decision = decideMotionSourceAdapter({ path: "walk-cycle.glb" });

    assert.equal(decision.inputFormat, "glb");
    assert.equal(decision.status, "ready");
    assert.equal(decision.strategy, "extract-gltf-animation");
    assert.equal(decision.directFbxParsing, false);
    assert.equal(decision.outputContract, "motion-ir");
  });

  it("keeps VRMA as a VRM/VRMA bridge source with the same Motion IR contract", () => {
    const decision = decideMotionSourceAdapter({ path: "robot-alert.vrma" });

    assert.equal(decision.inputFormat, "vrma");
    assert.equal(decision.status, "ready");
    assert.equal(decision.strategy, "extract-vrm-vrma");
    assert.equal(decision.outputContract, "motion-ir");
  });
});

describe("verifyMotionIr", () => {
  it("accepts a minimal retargeted looping Motion IR", () => {
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
    assert.deepEqual(result.clipSummaries, [{
      id: "wave",
      durationSeconds: 1,
      loop: true,
      trackCount: 1,
    }]);
  });

  it("rejects duplicate clip ids, missing retarget nodes, and non-looping endpoints", () => {
    const result = verifyMotionIr({
      version: 1,
      id: "robot-wave",
      source: { kind: "generated" },
      retarget: { head: "MissingHead" },
      clips: [
        {
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
        },
        {
          id: "wave",
          durationSeconds: 1,
          tracks: [],
        },
      ],
    }, {
      modelNodeNames: ["Head"],
      requiredTargets: ["hips"],
    });

    assert.equal(result.ok, false);
    assert.ok(result.failures.some((failure) => failure.path === "retarget.head"));
    assert.ok(result.failures.some((failure) => failure.reason.includes("missing required source target")));
    assert.ok(result.failures.some((failure) => failure.reason.includes("duplicate clip id")));
    assert.ok(result.failures.some((failure) => failure.reason.includes("looping track must end")));
  });
});

describe("runtime playback verification", () => {
  it("marks a matching played clip as verified", () => {
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

  it("waits for viewer node transform support when clip playback is verified", () => {
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

  it("verifies sampled node transforms", () => {
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
});

describe("sampleGltfClipPose", () => {
  it("samples translation and rotation channels", () => {
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
    assert.ok(Math.abs((pose.sampledNodes[0].rotation?.[2] ?? 0) - 0.38268343) < 0.0001);
    assert.ok(Math.abs((pose.sampledNodes[0].rotation?.[3] ?? 0) - 0.92387953) < 0.0001);
  });
});
