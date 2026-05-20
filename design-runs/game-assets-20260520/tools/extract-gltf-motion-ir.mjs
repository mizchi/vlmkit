#!/usr/bin/env node
import { readFile, writeFile } from "node:fs/promises";
import { basename, relative, resolve } from "node:path";
import { axisRange, computeWorldMatrices, nodeIndexWorldPosition, vec3Range } from "./gltf-bind-pose.mjs";

const repoRoot = resolve(new URL("../../..", import.meta.url).pathname);

function parseArgs(argv) {
  const args = {
    input: "",
    out: "",
    id: "",
    sourceKind: "gltf-animation",
    clips: [],
    loopTolerance: 0.001,
    targetSpace: "auto",
    retargetPreset: "identity",
    strictRetarget: false,
  };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === "--input") args.input = resolve(required(argv, ++i, arg));
    else if (arg === "--out") args.out = resolve(required(argv, ++i, arg));
    else if (arg === "--id") args.id = required(argv, ++i, arg);
    else if (arg === "--source-kind") args.sourceKind = required(argv, ++i, arg);
    else if (arg === "--clip") args.clips.push(...csv(required(argv, ++i, arg)));
    else if (arg === "--clips") args.clips.push(...csv(required(argv, ++i, arg)));
    else if (arg === "--loop-tolerance") args.loopTolerance = Number(required(argv, ++i, arg));
    else if (arg === "--target-space") args.targetSpace = required(argv, ++i, arg);
    else if (arg === "--retarget-preset") args.retargetPreset = required(argv, ++i, arg);
    else if (arg === "--strict-retarget") args.strictRetarget = true;
    else if (arg === "--help" || arg === "-h") {
      console.log(`Usage:
  node design-runs/game-assets-20260520/tools/extract-gltf-motion-ir.mjs --input <animated.glb|motion.vrma> --out <motion.json> [options]

Options:
  --id <id>                  Motion IR id
  --source-kind <kind>       Source kind label (default: gltf-animation)
  --clip <id[,id]>           Extract selected clip(s), repeatable
  --target-space <name>      auto|node|humanoid (default: auto)
  --retarget-preset <name>   identity|robot-voxel (default: identity)
  --strict-retarget          Fail instead of skipping unsupported preset targets
  --loop-tolerance <n>       Loop closure tolerance (default: 0.001)
`);
      process.exit(0);
    } else {
      throw new Error(`Unknown argument: ${arg}`);
    }
  }
  if (!args.input) throw new Error("--input is required");
  if (!args.out) throw new Error("--out is required");
  if (!["auto", "node", "humanoid"].includes(args.targetSpace)) throw new Error("--target-space must be auto, node, or humanoid");
  if (!["identity", "robot-voxel"].includes(args.retargetPreset)) throw new Error("--retarget-preset must be identity or robot-voxel");
  if (!args.id) args.id = basename(args.input).replace(/\.[^.]+$/, "");
  return args;
}

function required(argv, index, flag) {
  const value = argv[index];
  if (!value || value.startsWith("--")) throw new Error(`${flag} requires a value`);
  return value;
}

function csv(value) {
  return value.split(",").map((item) => item.trim()).filter(Boolean);
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const buffer = await readFile(args.input);
  const { gltf, bin } = decodeGlb(buffer);
  const requested = new Set(args.clips);
  const animations = (gltf.animations ?? []).filter((animation) => requested.size === 0 || requested.has(animation.name));
  if (animations.length === 0) throw new Error(`no animation clips matched: ${args.clips.join(",") || "<all>"}`);

  const retarget = {};
  const vrmaHumanoid = readVrmaHumanoid(gltf);
  const targetSpace = args.targetSpace === "auto" && vrmaHumanoid ? "humanoid" : args.targetSpace === "auto" ? "node" : args.targetSpace;
  if (targetSpace === "humanoid" && !vrmaHumanoid) {
    throw new Error("target-space humanoid requires root extension VRMC_vrm_animation.humanoid.humanBones");
  }
  const warnings = [];
  const clips = animations.map((animation, index) => extractClip(gltf, bin, animation, index, retarget, warnings, {
    fallbackClipId: animations.length === 1 ? args.id : `${args.id}_${index + 1}`,
    loopTolerance: args.loopTolerance,
    targetSpace,
    vrmaHumanoid,
    retargetPreset: args.retargetPreset,
    strictRetarget: args.strictRetarget,
  }));
  const motion = {
    version: 1,
    id: args.id,
    source: {
      kind: args.sourceKind,
      input: relative(repoRoot, args.input),
      targetSpace,
      vrmcVrmAnimation: vrmaHumanoid ? { specVersion: vrmaHumanoid.specVersion, humanoidBoneCount: vrmaHumanoid.nodeToBone.size } : null,
      sourceRig: vrmaHumanoid ? analyzeSourceRig(gltf, vrmaHumanoid) : null,
      skippedChannelCount: warnings.length,
      warnings,
      note: targetSpace === "humanoid"
        ? "Extracted from VRMC_vrm_animation humanoid mapping. Targets are humanoid bone names."
        : "Extracted from glTF/GLB animation clips. Targets are glTF node names with identity retarget entries.",
    },
    retarget,
    clips,
  };
  await writeFile(args.out, `${JSON.stringify(motion, null, 2)}\n`);
  console.log(`Wrote ${relative(repoRoot, args.out)} (${clips.map((clip) => clip.id).join(", ")})`);
}

function extractClip(gltf, bin, animation, animationIndex, retarget, warnings, options) {
  const tracks = [];
  let durationSeconds = 0;
  const clipId = animation.name || options.fallbackClipId;
  for (const [channelIndex, channel] of (animation.channels ?? []).entries()) {
    const sampler = animation.samplers[channel.sampler];
    if (!sampler) throw new Error(`missing sampler in clip ${clipId}`);
    const node = gltf.nodes?.[channel.target.node];
    const nodeName = node?.name;
    if (!nodeName) throw new Error(`animation ${clipId} channel targets unnamed node ${channel.target.node}`);
    if (!["rotation", "translation"].includes(channel.target.path)) continue;
    const targetName = targetNameForChannel(channel, nodeName, options);
    if (!targetName) {
      warnings.push(skippedChannelWarning(clipId, animationIndex, channelIndex, nodeName, channel.target.path, "node has no humanoid bone mapping"));
      continue;
    }
    const retargetName = retargetNameForTarget(targetName, nodeName, options);
    if (!retargetName) {
      warnings.push(skippedChannelWarning(clipId, animationIndex, channelIndex, nodeName, channel.target.path, `retarget preset ${options.retargetPreset} has no target for ${targetName}`));
      continue;
    }
    retarget[targetName] = retargetName;
    const times = readFloatAccessor(gltf, bin, sampler.input);
    const outputAccessor = gltf.accessors[sampler.output];
    const output = readFloatAccessor(gltf, bin, sampler.output);
    const tupleSize = componentsPerType(outputAccessor.type);
    if (channel.target.path === "rotation" && tupleSize !== 4) {
      throw new Error(`rotation output must be VEC4 in clip ${clipId}.${targetName}`);
    }
    if (channel.target.path === "translation" && tupleSize !== 3) {
      throw new Error(`translation output must be VEC3 in clip ${clipId}.${targetName}`);
    }
    const keyframes = [];
    for (let i = 0; i < times.length; i++) {
      const values = output.slice(i * tupleSize, i * tupleSize + tupleSize).map(round);
      const keyframe = { time: round(times[i]) };
      if (channel.target.path === "rotation") keyframe.rotation = values;
      else keyframe.translation = values;
      keyframes.push(keyframe);
      durationSeconds = Math.max(durationSeconds, times[i]);
    }
    tracks.push({
      target: targetName,
      path: channel.target.path,
      keyframes,
    });
  }
  if (tracks.length === 0) throw new Error(`clip has no supported tracks: ${clipId}`);
  const loop = tracks.every((track) => {
    const first = track.keyframes[0];
    const last = track.keyframes.at(-1);
    const firstValue = track.path === "rotation" ? first.rotation : first.translation;
    const lastValue = track.path === "rotation" ? last.rotation : last.translation;
    return first.time === 0 && Math.abs(last.time - durationSeconds) <= 0.0001 && tuplesClose(firstValue, lastValue, options.loopTolerance);
  });
  return {
    id: clipId,
    durationSeconds: round(durationSeconds),
    loop,
    tracks,
  };
}

function readVrmaHumanoid(gltf) {
  const extension = gltf.extensions?.VRMC_vrm_animation;
  const humanBones = extension?.humanoid?.humanBones;
  if (!humanBones) return null;
  const nodeToBone = new Map();
  const boneToNode = new Map();
  for (const [boneName, bone] of Object.entries(humanBones)) {
    if (Number.isInteger(bone?.node)) {
      nodeToBone.set(bone.node, boneName);
      boneToNode.set(boneName, bone.node);
    }
  }
  return { specVersion: extension.specVersion ?? "", nodeToBone, boneToNode };
}

function analyzeSourceRig(gltf, vrmaHumanoid) {
  const worldMatrices = computeWorldMatrices(gltf);
  const bonePositions = Object.fromEntries([...vrmaHumanoid.boneToNode.entries()]
    .map(([boneName, nodeIndex]) => [boneName, nodeIndexWorldPosition(nodeIndex, worldMatrices)])
    .filter(([, position]) => position !== null)
    .map(([boneName, position]) => [boneName, position.map(round)]));
  const trackedBonePositions = Object.fromEntries(SOURCE_RIG_TRACKED_BONES
    .map((boneName) => [boneName, bonePositions[boneName] ?? null])
    .filter(([, position]) => position !== null));
  const positions = Object.values(bonePositions);
  return {
    humanoidBoneCount: vrmaHumanoid.nodeToBone.size,
    measuredHumanoidBoneCount: positions.length,
    skeletonBounds: vec3Range(positions),
    bindMetrics: humanoidBindMetrics(trackedBonePositions, positions),
    trackedBonePositions,
  };
}

function humanoidBindMetrics(trackedBonePositions, bonePositions) {
  const skeletonBounds = vec3Range(bonePositions);
  const hips = trackedBonePositions.hips ?? null;
  const head = trackedBonePositions.head ?? null;
  const leftHand = trackedBonePositions.leftHand ?? null;
  const rightHand = trackedBonePositions.rightHand ?? null;
  const leftUpperArm = trackedBonePositions.leftUpperArm ?? null;
  const rightUpperArm = trackedBonePositions.rightUpperArm ?? null;
  const leftUpperLeg = trackedBonePositions.leftUpperLeg ?? null;
  const rightUpperLeg = trackedBonePositions.rightUpperLeg ?? null;
  const leftFoot = trackedBonePositions.leftFoot ?? null;
  const rightFoot = trackedBonePositions.rightFoot ?? null;
  const lowestFootY = minFinite([leftFoot?.[1], rightFoot?.[1]]);
  const leftArmDownAngle = armDownAngleDeg(leftUpperArm, leftHand);
  const rightArmDownAngle = armDownAngleDeg(rightUpperArm, rightHand);
  return {
    skeletonHeight: roundNullable(axisRange(skeletonBounds, 1)),
    skeletonWidth: roundNullable(axisRange(skeletonBounds, 0)),
    skeletonDepth: roundNullable(axisRange(skeletonBounds, 2)),
    hipsToHeadHeight: roundNullable(deltaAxis(hips, head, 1)),
    hipsToLowestFootHeight: roundNullable(lowestFootY === null || !hips ? null : hips[1] - lowestFootY),
    shoulderWidth: roundNullable(distanceAxis(leftUpperArm, rightUpperArm, 0)),
    handSpan: roundNullable(distanceAxis(leftHand, rightHand, 0)),
    upperLegSpread: roundNullable(distanceAxis(leftUpperLeg, rightUpperLeg, 0)),
    footSpread: roundNullable(distanceAxis(leftFoot, rightFoot, 0)),
    leftArmDownAngleDeg: roundNullable(leftArmDownAngle),
    rightArmDownAngleDeg: roundNullable(rightArmDownAngle),
    armDownAngleDeg: roundNullable(averageFinite([leftArmDownAngle, rightArmDownAngle])),
  };
}

function targetNameForChannel(channel, nodeName, options) {
  if (options.targetSpace === "node") return nodeName;
  const boneName = options.vrmaHumanoid?.nodeToBone.get(channel.target.node);
  if (!boneName) {
    if (options.strictRetarget) throw new Error(`animation channel targets node without humanoid bone mapping: ${nodeName}`);
    return null;
  }
  return boneName;
}

function retargetNameForTarget(targetName, nodeName, options) {
  if (options.targetSpace === "node") return nodeName;
  if (options.retargetPreset === "robot-voxel") {
    const mapped = ROBOT_VOXEL_RETARGET[targetName];
    if (!mapped && options.strictRetarget) throw new Error(`retarget preset robot-voxel has no target for ${targetName}`);
    return mapped ?? null;
  }
  return targetName;
}

function skippedChannelWarning(clipId, animationIndex, channelIndex, nodeName, path, reason) {
  return {
    clip: clipId,
    animationIndex,
    channelIndex,
    node: nodeName,
    path,
    reason,
  };
}

function decodeGlb(buffer) {
  if (buffer.readUInt32LE(0) !== 0x46546c67) throw new Error("invalid GLB magic");
  if (buffer.readUInt32LE(4) !== 2) throw new Error("unsupported GLB version");
  const totalLength = buffer.readUInt32LE(8);
  if (totalLength !== buffer.length) throw new Error(`GLB length mismatch: header=${totalLength} actual=${buffer.length}`);
  let offset = 12;
  let json;
  let bin;
  while (offset < buffer.length) {
    const chunkLength = buffer.readUInt32LE(offset);
    const chunkType = buffer.readUInt32LE(offset + 4);
    const chunk = buffer.subarray(offset + 8, offset + 8 + chunkLength);
    if (chunkType === 0x4e4f534a) json = JSON.parse(chunk.toString("utf8"));
    if (chunkType === 0x004e4942) bin = chunk;
    offset += 8 + chunkLength;
  }
  if (!json) throw new Error("missing JSON chunk");
  if (!bin) throw new Error("missing BIN chunk");
  return { gltf: json, bin };
}

function readFloatAccessor(gltf, bin, accessorIndex) {
  const accessor = gltf.accessors[accessorIndex];
  if (accessor.componentType !== 5126) throw new Error(`accessor ${accessorIndex} is not float`);
  const view = gltf.bufferViews[accessor.bufferView];
  const offset = (view.byteOffset ?? 0) + (accessor.byteOffset ?? 0);
  const tupleSize = componentsPerType(accessor.type);
  const length = accessor.count * tupleSize;
  const values = [];
  for (let i = 0; i < length; i++) {
    values.push(bin.readFloatLE(offset + i * 4));
  }
  return values;
}

function componentsPerType(type) {
  if (type === "SCALAR") return 1;
  if (type === "VEC3") return 3;
  if (type === "VEC4") return 4;
  throw new Error(`Unsupported accessor type: ${type}`);
}

function tuplesClose(a, b, tolerance) {
  if (!a || !b || a.length !== b.length) return false;
  return a.every((value, index) => Math.abs(value - b[index]) <= tolerance);
}

function deltaAxis(a, b, axis) {
  if (!a || !b) return null;
  return b[axis] - a[axis];
}

function distanceAxis(a, b, axis) {
  if (!a || !b) return null;
  return Math.abs(b[axis] - a[axis]);
}

function armDownAngleDeg(shoulder, hand) {
  if (!shoulder || !hand) return null;
  const vector = [hand[0] - shoulder[0], hand[1] - shoulder[1], hand[2] - shoulder[2]];
  const length = Math.hypot(...vector);
  if (length <= 0.0001) return null;
  const dotWithDown = -vector[1] / length;
  return Math.acos(clamp(dotWithDown, -1, 1)) * 180 / Math.PI;
}

function averageFinite(values) {
  const finite = values.filter(Number.isFinite);
  return finite.length > 0 ? finite.reduce((sum, value) => sum + value, 0) / finite.length : null;
}

function minFinite(values) {
  const finite = values.filter(Number.isFinite);
  return finite.length > 0 ? Math.min(...finite) : null;
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function roundNullable(value) {
  return value === null ? null : round(value);
}

function round(value) {
  return Math.round(value * 100000) / 100000;
}

const SOURCE_RIG_TRACKED_BONES = [
  "hips",
  "head",
  "leftUpperArm",
  "rightUpperArm",
  "leftLowerArm",
  "rightLowerArm",
  "leftHand",
  "rightHand",
  "leftUpperLeg",
  "rightUpperLeg",
  "leftFoot",
  "rightFoot",
];

const ROBOT_VOXEL_RETARGET = {
  hips: "pelvis",
  spine: "torso",
  head: "head",
  leftUpperArm: "left_upper_arm",
  leftLowerArm: "left_forearm",
  leftHand: "left_hand",
  rightUpperArm: "right_upper_arm",
  rightLowerArm: "right_forearm",
  rightHand: "right_hand",
  leftUpperLeg: "left_upper_leg",
  leftLowerLeg: "left_lower_leg",
  leftFoot: "left_foot",
  rightUpperLeg: "right_upper_leg",
  rightLowerLeg: "right_lower_leg",
  rightFoot: "right_foot",
};

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
