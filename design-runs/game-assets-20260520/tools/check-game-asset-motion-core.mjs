#!/usr/bin/env node
import { readFile } from "node:fs/promises";
import { relative, resolve } from "node:path";

import {
  createClipPlaybackStatus,
  createPosePlaybackStatus,
  decodeGlb,
  decideMotionSourceAdapter,
  sampleGltfClipPoseFromGlb,
  verifyMotionIr,
} from "./game-asset-motion-core.mjs";

const repoRoot = resolve(new URL("../../..", import.meta.url).pathname);
const robotDir = resolve(repoRoot, "design-runs/game-assets-20260520/models/robot-voxel-motion");
const modelPath = resolve(robotDir, "robot-voxel-motion.glb");
const motionPath = resolve(robotDir, "derived/robot-voxel-motion.fixture-vrma.extracted.motion.json");
const roundtripGlbPath = resolve(robotDir, "derived/robot-voxel-motion.fixture-vrma.roundtrip.glb");
const fixtureVrmaPath = resolve(robotDir, "derived/robot-voxel-motion.vrma-bridge.fixture.vrma");

async function main() {
  const adapterCases = [
    {
      id: "mixamo-fbx",
      input: { path: "external/Mixamo Walk.fbx", sourceKind: "mixamo" },
      expectedStrategy: "convert-to-glb-first",
    },
    {
      id: "fixture-vrma",
      input: { path: relative(repoRoot, fixtureVrmaPath) },
      expectedStrategy: "extract-vrm-vrma",
    },
    {
      id: "roundtrip-glb",
      input: { path: relative(repoRoot, roundtripGlbPath) },
      expectedStrategy: "extract-gltf-animation",
    },
    {
      id: "motion-ir",
      input: { path: relative(repoRoot, motionPath) },
      expectedStrategy: "use-motion-ir",
    },
  ];
  const adapters = adapterCases.map((entry) => {
    const decision = decideMotionSourceAdapter(entry.input);
    if (decision.strategy !== entry.expectedStrategy) {
      throw new Error(`${entry.id}: expected ${entry.expectedStrategy}, got ${decision.strategy}`);
    }
    if (decision.outputContract !== "motion-ir") {
      throw new Error(`${entry.id}: expected Motion IR output contract`);
    }
    return {
      id: entry.id,
      status: decision.status,
      strategy: decision.strategy,
      directFbxParsing: decision.directFbxParsing,
      requiredExternalTools: decision.requiredExternalTools,
    };
  });

  const motion = JSON.parse(await readFile(motionPath, "utf8"));
  const model = decodeGlb(await readFile(modelPath)).gltf;
  const modelNodeNames = (model.nodes ?? []).map((node) => node.name).filter(Boolean);
  const verification = verifyMotionIr(motion, {
    modelNodeNames,
    requiredTargets: ["hips", "head"],
  });
  if (!verification.ok) {
    throw new Error(`Motion IR verification failed: ${JSON.stringify(verification.failures)}`);
  }

  const clipId = motion.clips?.[0]?.id;
  if (!clipId) throw new Error("fixture Motion IR has no clips");
  const roundtripGlb = await readFile(roundtripGlbPath);
  const sampledPose = sampleGltfClipPoseFromGlb(roundtripGlb, clipId, 0.25);
  if (sampledPose.sampledNodes.length === 0) {
    throw new Error(`No sampled node transforms for clip ${clipId}`);
  }

  const requestedClips = motion.clips.map((clip) => clip.id).filter(Boolean);
  const clipPlayback = createClipPlaybackStatus(requestedClips, {
    clips: requestedClips,
    currentClip: clipId,
    playing: true,
    timeSeconds: sampledPose.timeSeconds,
  });
  if (clipPlayback.status !== "verified") {
    throw new Error(`Clip playback gate failed: ${clipPlayback.status}`);
  }

  const posePlayback = createPosePlaybackStatus({
    clipPlayback,
    expectedPose: sampledPose,
    runtimeState: { nodeTransforms: sampledPose.sampledNodes },
  });
  if (posePlayback.status !== "verified") {
    throw new Error(`Pose playback gate failed: ${posePlayback.status}`);
  }

  const result = {
    ok: true,
    adapters,
    motionIr: {
      ok: verification.ok,
      clipCount: verification.clipSummaries.length,
      warningCount: verification.warnings.length,
    },
    sampledPose: {
      clip: sampledPose.clip,
      timeSeconds: sampledPose.timeSeconds,
      durationSeconds: sampledPose.durationSeconds,
      sampledNodeCount: sampledPose.sampledNodes.length,
    },
    runtimeGate: {
      clipPlayback: clipPlayback.status,
      posePlayback: posePlayback.status,
      comparedNodeCount: posePlayback.comparedNodeCount,
      maxDelta: posePlayback.maxDelta,
    },
  };
  console.log(JSON.stringify(result, null, 2));
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
