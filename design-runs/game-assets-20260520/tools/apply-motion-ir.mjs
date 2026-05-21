#!/usr/bin/env node
import { readFile, writeFile } from "node:fs/promises";
import { basename, dirname, join, relative, resolve } from "node:path";
import { axisRange, computeWorldMatrices, nodeWorldPosition, vec3, vec3Range, vec4 } from "./gltf-bind-pose.mjs";
import { motionCorePolicy } from "./motion-core-runtime.mjs";

const repoRoot = resolve(new URL("../../..", import.meta.url).pathname);
const entryDir = dirname(resolve(process.argv[1] ?? new URL(".", import.meta.url).pathname));

function parseArgs(argv) {
  const entryName = basename(entryDir);
  const args = {
    input: join(entryDir, `${entryName}.glb`),
    motion: "",
    out: join(entryDir, `${entryName}.motion.glb`),
    auditOut: "",
    clip: "",
    replaceExisting: false,
    rootTranslationMode: "keep",
    poseNormalization: "none",
  };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === "--input") args.input = resolve(required(argv, ++i, arg));
    else if (arg === "--motion") args.motion = resolve(required(argv, ++i, arg));
    else if (arg === "--out") args.out = resolve(required(argv, ++i, arg));
    else if (arg === "--audit-out") args.auditOut = resolve(required(argv, ++i, arg));
    else if (arg === "--clip") args.clip = required(argv, ++i, arg);
    else if (arg === "--replace-existing") args.replaceExisting = true;
    else if (arg === "--root-translation-mode") args.rootTranslationMode = required(argv, ++i, arg);
    else if (arg === "--pose-normalization") args.poseNormalization = required(argv, ++i, arg);
    else if (arg === "--help" || arg === "-h") {
      console.log(`Usage:
  node design-runs/game-assets-20260520/tools/apply-motion-ir.mjs --input <model.glb> --motion <motion.json> [options]

Options:
  --out <path>           Output GLB path
  --audit-out <path>     Write normalization audit JSON
  --clip <id>            Apply only one motion clip
  --replace-existing     Remove existing GLB animations before adding motion IR
  --root-translation-mode <mode>
                         keep|relative|horizontal-only|zero|scale-to-model (default: keep)
  --pose-normalization <mode>
                         none|arm-rest-offset (default: none)
`);
      process.exit(0);
    } else {
      throw new Error(`Unknown argument: ${arg}`);
    }
  }
  if (!args.motion) throw new Error("--motion is required");
  if (!["keep", "relative", "horizontal-only", "zero", "scale-to-model"].includes(args.rootTranslationMode)) {
    throw new Error("--root-translation-mode must be keep, relative, horizontal-only, zero, or scale-to-model");
  }
  if (!["none", "arm-rest-offset"].includes(args.poseNormalization)) {
    throw new Error("--pose-normalization must be none or arm-rest-offset");
  }
  return args;
}

function required(argv, index, flag) {
  const value = argv[index];
  if (!value || value.startsWith("--")) throw new Error(`${flag} requires a value`);
  return value;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const input = await readFile(args.input);
  const motion = JSON.parse(await readFile(args.motion, "utf8"));
  validateMotion(motion);
  const { gltf, bin } = decodeGlb(input);
  const nodeIndexByName = new Map((gltf.nodes ?? []).map((node, index) => [node.name, index]));
  const clips = motion.clips.filter((clip) => !args.clip || clip.id === args.clip);
  if (clips.length === 0) throw new Error(`no motion clips matched: ${args.clip}`);
  if (args.replaceExisting || !gltf.animations) gltf.animations = [];

  const chunks = [bin];
  const audit = createAudit(args, motion, gltf, nodeIndexByName);
  const poseOffsets = poseNormalizationOffsets(audit, args.poseNormalization);
  for (const clip of clips) {
    gltf.animations.push(buildAnimation(gltf, chunks, motion, clip, nodeIndexByName, {
      rootTranslationMode: args.rootTranslationMode,
      poseNormalization: args.poseNormalization,
      poseOffsets,
      audit,
    }));
  }
  const output = encodeGlb(gltf, chunks);
  await writeFile(args.out, output);
  if (args.auditOut) {
    audit.output = relative(repoRoot, args.out);
    await writeFile(args.auditOut, `${JSON.stringify(audit, null, 2)}\n`);
  }
  console.log(`Wrote ${relative(repoRoot, args.out)} (${clips.map((clip) => clip.id).join(", ")})`);
}

function validateMotion(motion) {
  if (motion.version !== 1) throw new Error("motion.version must be 1");
  if (!Array.isArray(motion.clips) || motion.clips.length === 0) throw new Error("motion.clips must be a non-empty array");
  if (!motion.retarget || typeof motion.retarget !== "object") throw new Error("motion.retarget is required");
}

function buildAnimation(gltf, chunks, motion, clip, nodeIndexByName, options) {
  if (!clip.id) throw new Error("motion clip id is required");
  if (!Array.isArray(clip.tracks) || clip.tracks.length === 0) throw new Error(`clip ${clip.id} must have tracks`);
  const animation = { name: clip.id, samplers: [], channels: [] };
  for (const track of clip.tracks) {
    const nodeName = motion.retarget?.[track.target] ?? track.target;
    const node = nodeIndexByName.get(nodeName);
    if (node === undefined) throw new Error(`clip ${clip.id} target not found: ${track.target} -> ${nodeName}`);
    const samples = normalizeSamples(clip, track, {
      baseTranslation: gltf.nodes[node]?.translation ?? [0, 0, 0],
      isRootTranslation: isRootTranslationTrack(track, nodeName),
      rootTranslationMode: options.rootTranslationMode,
      poseNormalization: options.poseNormalization,
      poseOffset: options.poseOffsets.get(track.target) ?? null,
    });
    recordRootTranslationAudit(options.audit, clip, track, nodeName, gltf.nodes[node]?.translation ?? [0, 0, 0], samples, options.rootTranslationMode);
    const inputAccessor = addAccessor(
      gltf,
      chunks,
      new Float32Array(samples.times),
      5126,
      "SCALAR",
      undefined,
      { min: [Math.min(...samples.times)], max: [Math.max(...samples.times)] },
    );
    const outputAccessor = addAccessor(
      gltf,
      chunks,
      new Float32Array(samples.values.flat()),
      5126,
      track.path === "rotation" ? "VEC4" : "VEC3",
    );
    const sampler = animation.samplers.length;
    animation.samplers.push({ input: inputAccessor, output: outputAccessor, interpolation: "LINEAR" });
    animation.channels.push({ sampler, target: { node, path: gltfPath(track.path) } });
  }
  return animation;
}

function createAudit(args, motion, gltf, nodeIndexByName) {
  const sourceRig = motion.source?.sourceRig ?? null;
  const targetRig = analyzeTargetRig(gltf, motion, nodeIndexByName);
  const motionActivity = analyzeMotionActivity(motion);
  return {
    version: 1,
    kind: "motion-normalization-audit",
    input: relative(repoRoot, args.input),
    motion: relative(repoRoot, args.motion),
    output: relative(repoRoot, args.out),
    rootTranslationMode: args.rootTranslationMode,
    poseNormalization: args.poseNormalization,
    motionSource: {
      kind: motion.source?.kind ?? null,
      targetSpace: motion.source?.targetSpace ?? null,
      humanoidBoneCount: motion.source?.vrmcVrmAnimation?.humanoidBoneCount ?? null,
    },
    sourceRig,
    targetRig,
    motionActivity,
    sourceTargetRigComparison: compareSourceTargetRig(sourceRig, targetRig, motionActivity),
    poseNormalizationDetails: null,
    clips: [],
  };
}

function analyzeTargetRig(gltf, motion, nodeIndexByName) {
  const worldMatrices = computeWorldMatrices(gltf);
  const retargetNodes = [...new Set(Object.values(motion.retarget ?? {}).filter((name) => typeof name === "string" && name))];
  const nodePositions = Object.fromEntries(retargetNodes
    .map((name) => [name, nodeWorldPosition(name, nodeIndexByName, worldMatrices)])
    .filter(([, position]) => position !== null)
    .map(([name, position]) => [name, position.map(round)]));
  const trackedPositions = Object.fromEntries(TARGET_RIG_TRACKED_NODES
    .map((name) => [name, nodeWorldPosition(name, nodeIndexByName, worldMatrices)])
    .filter(([, position]) => position !== null)
    .map(([name, position]) => [name, position.map(round)]));
  const positions = Object.values(nodePositions);
  return {
    nodeCount: gltf.nodes?.length ?? 0,
    retargetNodeCount: retargetNodes.length,
    measuredRetargetNodeCount: positions.length,
    skeletonBounds: vec3Range(positions),
    bindMetrics: targetBindMetrics(trackedPositions, positions),
    trackedNodePositions: trackedPositions,
  };
}

function targetBindMetrics(trackedPositions, retargetPositions) {
  const skeletonBounds = vec3Range(retargetPositions);
  const root = trackedPositions.robot_root ?? null;
  const pelvis = trackedPositions.pelvis ?? null;
  const head = trackedPositions.head ?? null;
  const leftHand = trackedPositions.left_hand ?? null;
  const rightHand = trackedPositions.right_hand ?? null;
  const leftUpperArm = trackedPositions.left_upper_arm ?? null;
  const rightUpperArm = trackedPositions.right_upper_arm ?? null;
  const leftUpperLeg = trackedPositions.left_upper_leg ?? null;
  const rightUpperLeg = trackedPositions.right_upper_leg ?? null;
  const leftFoot = trackedPositions.left_foot ?? null;
  const rightFoot = trackedPositions.right_foot ?? null;
  const lowestFootY = minFinite([leftFoot?.[1], rightFoot?.[1]]);
  const leftArmDownAngle = armDownAngleDeg(leftUpperArm, leftHand);
  const rightArmDownAngle = armDownAngleDeg(rightUpperArm, rightHand);
  return {
    skeletonHeight: roundNullable(axisRange(skeletonBounds, 1)),
    skeletonWidth: roundNullable(axisRange(skeletonBounds, 0)),
    skeletonDepth: roundNullable(axisRange(skeletonBounds, 2)),
    rootToHeadHeight: roundNullable(deltaAxis(root, head, 1)),
    rootToLowestFootHeight: roundNullable(lowestFootY === null || !root ? null : lowestFootY - root[1]),
    pelvisToHeadHeight: roundNullable(deltaAxis(pelvis, head, 1)),
    pelvisToLowestFootHeight: roundNullable(lowestFootY === null || !pelvis ? null : pelvis[1] - lowestFootY),
    shoulderWidth: roundNullable(distanceAxis(leftUpperArm, rightUpperArm, 0)),
    handSpan: roundNullable(distanceAxis(leftHand, rightHand, 0)),
    upperLegSpread: roundNullable(distanceAxis(leftUpperLeg, rightUpperLeg, 0)),
    footSpread: roundNullable(distanceAxis(leftFoot, rightFoot, 0)),
    leftArmDownAngleDeg: roundNullable(leftArmDownAngle),
    rightArmDownAngleDeg: roundNullable(rightArmDownAngle),
    armDownAngleDeg: roundNullable(averageFinite([leftArmDownAngle, rightArmDownAngle])),
  };
}

function poseNormalizationOffsets(audit, mode) {
  if (mode === "none") {
    audit.poseNormalizationDetails = { mode, offsets: [] };
    return new Map();
  }
  if (mode !== "arm-rest-offset") throw new Error(`unsupported pose normalization mode: ${mode}`);
  const source = audit.sourceRig?.trackedBonePositions ?? {};
  const target = audit.targetRig?.trackedNodePositions ?? {};
  const offsets = ARM_REST_OFFSET_SEGMENTS
    .map((segment) => armRestOffset(segment, source, target))
    .filter(Boolean);
  audit.poseNormalizationDetails = { mode, offsets };
  return new Map(offsets.map((offset) => [offset.sourceTarget, offset]));
}

function armRestOffset(segment, source, target) {
  const sourceStart = source[segment.sourceStart];
  const sourceEnd = source[segment.sourceEnd];
  const targetStart = target[segment.targetStart];
  const targetEnd = target[segment.targetEnd];
  const sourceVector = vectorBetween(sourceStart, sourceEnd);
  const targetVector = vectorBetween(targetStart, targetEnd);
  if (!sourceVector || !targetVector) return null;
  const alignQuaternion = quatFromUnitVectors(sourceVector, targetVector);
  return {
    sourceTarget: segment.sourceTarget,
    targetNode: segment.targetNode,
    sourceVector: sourceVector.map(round),
    targetVector: targetVector.map(round),
    alignQuaternion: alignQuaternion.map(round),
    alignAngleDeg: round(2 * Math.acos(clamp(alignQuaternion[3], -1, 1)) * 180 / Math.PI),
  };
}

function analyzeMotionActivity(motion) {
  const clips = (motion.clips ?? []).map((clip) => analyzeClipMotionActivity(clip));
  const bestClip = clips
    .filter((clip) => Number.isFinite(clip.upperArmRotationRangeDeg))
    .sort((a, b) => b.upperArmRotationRangeDeg - a.upperArmRotationRangeDeg)[0] ?? null;
  return {
    armRest: {
      gate: "upper-arm-rotation-range",
      thresholdDeg: ARM_REST_MOTION_GATE_DEG,
      maxUpperArmRotationRangeDeg: roundNullable(bestClip?.upperArmRotationRangeDeg ?? null),
      strongestClip: bestClip?.id ?? null,
      measuredClipCount: clips.filter((clip) => Number.isFinite(clip.upperArmRotationRangeDeg)).length,
      clips,
    },
  };
}

function analyzeClipMotionActivity(clip) {
  const upperArmTracks = (clip.tracks ?? [])
    .filter((track) => track.path === "rotation" && ARM_REST_MOTION_GATE_TARGETS.has(track.target))
    .map((track) => ({
      target: track.target,
      rotationRangeDeg: roundNullable(rotationTrackRangeDeg(clip, track)),
      keyframeCount: track.keyframes?.length ?? 0,
    }));
  const ranges = upperArmTracks.map((track) => track.rotationRangeDeg).filter(Number.isFinite);
  return {
    id: clip.id,
    durationSeconds: clip.durationSeconds ?? null,
    upperArmTrackCount: upperArmTracks.length,
    upperArmRotationRangeDeg: ranges.length > 0 ? round(Math.max(...ranges)) : null,
    upperArmTracks,
  };
}

function rotationTrackRangeDeg(clip, track) {
  if (!Array.isArray(track.keyframes) || track.keyframes.length === 0) return null;
  const sorted = [...track.keyframes].sort((a, b) => a.time - b.time);
  const first = sorted[0]?.rotation ? vec4(sorted[0].rotation, `rotation for ${clip.id}.${track.target}`) : null;
  if (!first) return null;
  const ranges = sorted
    .map((keyframe) => keyframe.rotation ? quatAngleDeg(first, vec4(keyframe.rotation, `rotation for ${clip.id}.${track.target}`)) : null)
    .filter(Number.isFinite);
  return ranges.length > 0 ? Math.max(...ranges) : null;
}

function compareSourceTargetRig(sourceRig, targetRig, motionActivity) {
  if (!sourceRig?.bindMetrics || !targetRig?.bindMetrics) {
    return {
      status: "unavailable",
      recommendation: {
        id: "rig-comparison-unavailable",
        severity: "warn",
        reason: "source or target bind metrics are missing",
      },
    };
  }
  const scales = {
    skeletonHeight: scaleMetric(sourceRig.bindMetrics.skeletonHeight, targetRig.bindMetrics.skeletonHeight),
    legHeight: scaleMetric(sourceRig.bindMetrics.hipsToLowestFootHeight, targetRig.bindMetrics.pelvisToLowestFootHeight),
    shoulderWidth: scaleMetric(sourceRig.bindMetrics.shoulderWidth, targetRig.bindMetrics.shoulderWidth),
    handSpan: scaleMetric(sourceRig.bindMetrics.handSpan, targetRig.bindMetrics.handSpan),
    upperLegSpread: scaleMetric(sourceRig.bindMetrics.upperLegSpread, targetRig.bindMetrics.upperLegSpread),
    footSpread: scaleMetric(sourceRig.bindMetrics.footSpread, targetRig.bindMetrics.footSpread),
  };
  const coreScales = [scales.skeletonHeight, scales.legHeight, scales.handSpan].filter(Number.isFinite);
  const scaleSpread = coreScales.length > 0 ? {
    min: round(Math.min(...coreScales)),
    max: round(Math.max(...coreScales)),
    ratio: round(Math.max(...coreScales) / Math.min(...coreScales)),
  } : null;
  const armAngleDelta = angleDelta(sourceRig.bindMetrics.armDownAngleDeg, targetRig.bindMetrics.armDownAngleDeg);
  const warnings = motionCorePolicy.pose.mismatchWarningIds({
    scaleSpreadRatio: scaleSpread?.ratio,
    footSpreadScale: scales.footSpread,
    upperLegSpreadScale: scales.upperLegSpread,
    shoulderWidthScale: scales.shoulderWidth,
    skeletonHeightScale: scales.skeletonHeight,
    armAngleDeltaDeg: armAngleDelta,
  }).map((id) => poseMismatchWarning(id, armAngleDelta));
  const recommendation = warnings.length > 0
    ? {
      id: "pose-mismatch-warning",
      severity: "warn",
      reason: "source and target bind metrics are measurable but rest-pose proportions differ",
    }
    : {
      id: "source-target-scale-compatible",
      severity: "info",
      reason: "source and target bind metrics have compatible scale ratios",
    };
  return {
    status: "measured",
    scales: mapValues(scales, roundNullable),
    scaleSpread,
    warnings,
    recommendation,
    normalizationCandidates: poseNormalizationCandidates(warnings, motionActivity),
  };
}

function poseMismatchWarning(id, armAngleDelta) {
  const detail = POSE_MISMATCH_WARNING_DETAILS[id];
  if (!detail) throw new Error(`unknown pose mismatch warning id: ${id}`);
  const warning = { id, ...detail };
  if (id === "arm-rest-angle-mismatch") {
    warning.value = { deltaDeg: round(armAngleDelta) };
  }
  return warning;
}

function scaleMetric(source, target) {
  if (!Number.isFinite(source) || !Number.isFinite(target) || Math.abs(source) <= 0.0001) return null;
  return target / source;
}

function angleDelta(source, target) {
  if (!Number.isFinite(source) || !Number.isFinite(target)) return null;
  return Math.abs(source - target);
}

function mapValues(object, mapper) {
  return Object.fromEntries(Object.entries(object).map(([key, value]) => [key, mapper(value)]));
}

function poseNormalizationCandidates(warnings, motionActivity) {
  const ids = new Set(warnings.map((warning) => warning.id));
  return motionCorePolicy.pose.normalizationCandidateSpecs({
    hasArmRestAngleMismatch: ids.has("arm-rest-angle-mismatch"),
    hasFootSpreadMismatch: ids.has("foot-spread-mismatch"),
    hasLegSpreadMismatch: ids.has("leg-spread-mismatch"),
    hasShoulderWidthMismatch: ids.has("shoulder-width-mismatch"),
    maxUpperArmRotationRangeDeg: motionActivity?.armRest?.maxUpperArmRotationRangeDeg,
  }).map((spec) => poseNormalizationCandidate(spec, ids, motionActivity));
}

function poseNormalizationCandidate(spec, warningIds, motionActivity) {
  const detail = POSE_NORMALIZATION_CANDIDATE_DETAILS[spec.id];
  if (!detail) throw new Error(`unknown pose normalization candidate id: ${spec.id}`);
  if (spec.id === "arm-rest-pose-offset") {
    const motionGate = armRestMotionGate(motionActivity);
    const runnable = spec.status === "runnable";
    return {
      id: spec.id,
      kind: detail.kind,
      status: spec.status,
      automatic: detail.automatic,
      poseNormalization: detail.poseNormalization,
      motionGate,
      triggerWarnings: [...detail.triggerWarnings],
      reason: runnable ? detail.runnableReason : detail.blockedReason,
    };
  }
  if (spec.id === "stance-width-adapter") {
    return {
      id: spec.id,
      kind: detail.kind,
      status: spec.status,
      automatic: detail.automatic,
      triggerWarnings: detail.triggerWarnings.filter((id) => warningIds.has(id)),
      reason: detail.reason,
    };
  }
  if (spec.id === "shoulder-width-adapter") {
    return {
      id: spec.id,
      kind: detail.kind,
      status: spec.status,
      automatic: detail.automatic,
      triggerWarnings: [...detail.triggerWarnings],
      reason: detail.reason,
    };
  }
  throw new Error(`unhandled pose normalization candidate id: ${spec.id}`);
}

function armRestMotionGate(motionActivity) {
  const armRest = motionActivity?.armRest;
  const value = armRest?.maxUpperArmRotationRangeDeg;
  const status = motionCorePolicy.pose.armRestMotionGateStatus(value);
  if (status === "unavailable") {
    return {
      id: "upper-arm-rotation-range",
      status,
      metric: "maxUpperArmRotationRangeDeg",
      thresholdDeg: ARM_REST_MOTION_GATE_DEG,
      valueDeg: null,
      strongestClip: null,
      reason: "upper-arm rotation tracks are unavailable",
    };
  }
  return {
    id: "upper-arm-rotation-range",
    status,
    metric: "maxUpperArmRotationRangeDeg",
    thresholdDeg: ARM_REST_MOTION_GATE_DEG,
    valueDeg: round(value),
    strongestClip: armRest.strongestClip ?? null,
    reason: status === "passed"
      ? "upper-arm motion is large enough to test rest-pose arm offsets"
      : "upper-arm motion is too small; rest-pose arm offsets are more likely to be noise than a useful fix",
  };
}

function recordRootTranslationAudit(audit, clip, track, nodeName, baseTranslation, samples, rootTranslationMode) {
  if (!audit || track.path !== "translation" || !isRootTranslationTrack(track, nodeName)) return;
  const sorted = [...track.keyframes].sort((a, b) => a.time - b.time);
  const sourceTranslations = sorted.map((keyframe) => vec3(keyframe.translation, `translation for ${clip.id}.${track.target}`));
  const normalizedTranslations = samples.values.map((value) => vec3(value, `normalized translation for ${clip.id}.${track.target}`));
  const base = vec3(baseTranslation, "base translation");
  const first = sourceTranslations[0] ?? [0, 0, 0];
  const heightScale = Math.abs(first[1]) > 0.0001 ? base[1] / first[1] : null;
  const scale = rootTranslationMode === "scale-to-model" && heightScale !== null ? heightScale : 1;
  const deltaRange = vec3Range(sourceTranslations.map((value) => [
    value[0] - first[0],
    value[1] - first[1],
    value[2] - first[2],
  ]));
  const verticalDeltaRange = axisRange(deltaRange, 1) ?? 0;
  const horizontalDeltaRange = Math.hypot(axisRange(deltaRange, 0) ?? 0, axisRange(deltaRange, 2) ?? 0);
  const heightScaleDelta = heightScale === null ? null : Math.abs(heightScale - 1);
  const clipAudit = audit.clips.find((item) => item.id === clip.id) ?? { id: clip.id, durationSeconds: clip.durationSeconds ?? null, rootTranslations: [] };
  if (!audit.clips.includes(clipAudit)) audit.clips.push(clipAudit);
  const recommendation = recommendRootTranslationNormalization({
    mode: rootTranslationMode,
    heightScale,
    heightScaleDelta,
    verticalDeltaRange,
  });
  clipAudit.rootTranslations.push({
    sourceTarget: track.target,
    targetNode: nodeName,
    mode: rootTranslationMode,
    keyframeCount: sorted.length,
    sourceInitialTranslation: first.map(round),
    targetBaseTranslation: base.map(round),
    sourceInitialRootHeight: round(first[1]),
    targetBaseRootHeight: round(base[1]),
    appliedScale: round(scale),
    heightScale: roundNullable(heightScale),
    heightScaleDelta: roundNullable(heightScaleDelta),
    verticalDeltaRange: round(verticalDeltaRange),
    horizontalDeltaRange: round(horizontalDeltaRange),
    sourceRange: vec3Range(sourceTranslations),
    normalizedRange: vec3Range(normalizedTranslations),
    deltaRange,
    recommendation,
    normalizationCandidates: rootTranslationNormalizationCandidates(recommendation),
  });
}

function rootTranslationNormalizationCandidates(recommendation) {
  const candidateId = motionCorePolicy.root.candidateId(recommendation.id);
  if (candidateId === "none") return [];
  const detail = ROOT_TRANSLATION_CANDIDATE_DETAILS[candidateId];
  if (!detail) throw new Error(`unknown root translation candidate id: ${candidateId}`);
  return [{ id: candidateId, ...detail, triggerRecommendation: recommendation.id }];
}

function recommendRootTranslationNormalization({ mode, heightScale, heightScaleDelta, verticalDeltaRange }) {
  const id = motionCorePolicy.root.recommendationId({
    mode,
    heightScale,
    heightScaleDelta,
    verticalDeltaRange,
  });
  return rootTranslationRecommendationDetails(id);
}

function rootTranslationRecommendationDetails(id) {
  const detail = ROOT_TRANSLATION_RECOMMENDATION_DETAILS[id];
  if (!detail) throw new Error(`unknown root translation recommendation id: ${id}`);
  return { id, ...detail };
}

function normalizeSamples(clip, track, options = {}) {
  if (!["rotation", "translation"].includes(track.path)) {
    throw new Error(`unsupported track path for ${track.target}: ${track.path}`);
  }
  if (!Array.isArray(track.keyframes) || track.keyframes.length === 0) {
    throw new Error(`track ${track.target}.${track.path} must have keyframes`);
  }
  const sorted = [...track.keyframes].sort((a, b) => a.time - b.time);
  if (clip.loop && sorted[0].time !== 0) throw new Error(`looping clip ${clip.id} track ${track.target} must start at time 0`);
  const times = [];
  const values = [];
  const firstTranslation = track.path === "translation"
    ? vec3(sorted[0].translation, `translation for ${clip.id}.${track.target}`)
    : null;
  for (const keyframe of sorted) {
    if (!Number.isFinite(keyframe.time) || keyframe.time < 0) throw new Error(`invalid keyframe time in ${clip.id}.${track.target}`);
    times.push(keyframe.time);
    if (track.path === "translation") {
      const translation = vec3(keyframe.translation, `translation for ${clip.id}.${track.target}`);
      values.push(normalizeTranslation(translation, firstTranslation, options));
    } else if (keyframe.rotation) {
      values.push(normalizeRotation(vec4(keyframe.rotation, `rotation for ${clip.id}.${track.target}`), options));
    } else {
      values.push(normalizeRotation(quatFromEuler(...vec3(keyframe.euler, `euler for ${clip.id}.${track.target}`)), options));
    }
  }
  if (clip.durationSeconds !== undefined && sorted.at(-1).time > clip.durationSeconds + 0.0001) {
    throw new Error(`clip ${clip.id} keyframe exceeds durationSeconds`);
  }
  if (clip.loop && clip.durationSeconds !== undefined && Math.abs(sorted.at(-1).time - clip.durationSeconds) > 0.0001) {
    throw new Error(`looping clip ${clip.id} last keyframe must match durationSeconds`);
  }
  if (clip.loop && !tuplesClose(values[0], values.at(-1), 0.001)) {
    throw new Error(`looping clip ${clip.id} track ${track.target}.${track.path} does not close`);
  }
  return { times, values };
}

function normalizeRotation(rotation, options) {
  if (options.poseNormalization !== "arm-rest-offset" || !options.poseOffset) return rotation;
  const align = options.poseOffset.alignQuaternion;
  return quatNormalize(quatMultiply(quatMultiply(align, rotation), quatInvert(align))).map(round);
}

function normalizeTranslation(value, firstValue, options) {
  if (!options.isRootTranslation || options.rootTranslationMode === "keep") return value;
  const base = vec3(options.baseTranslation, "base translation");
  if (options.rootTranslationMode === "zero") return base;
  const delta = [
    value[0] - firstValue[0],
    value[1] - firstValue[1],
    value[2] - firstValue[2],
  ];
  if (options.rootTranslationMode === "horizontal-only") {
    return [base[0] + delta[0], base[1], base[2] + delta[2]].map(round);
  }
  if (options.rootTranslationMode === "scale-to-model") {
    const scale = Math.abs(firstValue[1]) > 0.0001 ? base[1] / firstValue[1] : 1;
    return [base[0] + delta[0] * scale, base[1] + delta[1] * scale, base[2] + delta[2] * scale].map(round);
  }
  return [base[0] + delta[0], base[1] + delta[1], base[2] + delta[2]].map(round);
}

function isRootTranslationTrack(track, nodeName) {
  if (track.path !== "translation") return false;
  return ROOT_TRANSLATION_TARGETS.has(track.target) || ROOT_TRANSLATION_TARGETS.has(nodeName);
}

function gltfPath(path) {
  if (path === "rotation") return "rotation";
  if (path === "translation") return "translation";
  throw new Error(`unsupported glTF animation path: ${path}`);
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

function vectorBetween(a, b) {
  if (!a || !b) return null;
  const vector = [b[0] - a[0], b[1] - a[1], b[2] - a[2]];
  const length = Math.hypot(...vector);
  return length > 0.0001 ? vector.map((value) => value / length) : null;
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

function quatFromUnitVectors(from, to) {
  const dot = clamp(from[0] * to[0] + from[1] * to[1] + from[2] * to[2], -1, 1);
  if (dot < -0.999999) {
    const axis = Math.abs(from[0]) < 0.9 ? [1, 0, 0] : [0, 1, 0];
    return quatNormalize([axis[1] * from[2] - axis[2] * from[1], axis[2] * from[0] - axis[0] * from[2], axis[0] * from[1] - axis[1] * from[0], 0]);
  }
  const cross = [
    from[1] * to[2] - from[2] * to[1],
    from[2] * to[0] - from[0] * to[2],
    from[0] * to[1] - from[1] * to[0],
  ];
  return quatNormalize([cross[0], cross[1], cross[2], 1 + dot]);
}

function quatMultiply(a, b) {
  return [
    a[3] * b[0] + a[0] * b[3] + a[1] * b[2] - a[2] * b[1],
    a[3] * b[1] - a[0] * b[2] + a[1] * b[3] + a[2] * b[0],
    a[3] * b[2] + a[0] * b[1] - a[1] * b[0] + a[2] * b[3],
    a[3] * b[3] - a[0] * b[0] - a[1] * b[1] - a[2] * b[2],
  ];
}

function quatInvert(q) {
  return [-q[0], -q[1], -q[2], q[3]];
}

function quatNormalize(q) {
  const length = Math.hypot(...q);
  if (length <= 0.0001) return [0, 0, 0, 1];
  return q.map((value) => value / length);
}

function quatAngleDeg(a, b) {
  const from = quatNormalize(a);
  const to = quatNormalize(b);
  const dot = Math.abs(from[0] * to[0] + from[1] * to[1] + from[2] * to[2] + from[3] * to[3]);
  return 2 * Math.acos(clamp(dot, -1, 1)) * 180 / Math.PI;
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

function addAccessor(gltf, chunks, typedArray, componentType, type, target, bounds) {
  const byteOffset = alignChunks(chunks, 4);
  const bytes = Buffer.from(typedArray.buffer, typedArray.byteOffset, typedArray.byteLength);
  const bufferView = gltf.bufferViews.length;
  const view = { buffer: 0, byteOffset, byteLength: bytes.byteLength };
  if (target) view.target = target;
  gltf.bufferViews.push(view);
  chunks.push(bytes);
  const accessor = {
    bufferView,
    byteOffset: 0,
    componentType,
    count: typedArray.length / componentsPerType(type),
    type,
  };
  if (bounds?.min) accessor.min = bounds.min;
  if (bounds?.max) accessor.max = bounds.max;
  const index = gltf.accessors.length;
  gltf.accessors.push(accessor);
  return index;
}

function encodeGlb(gltf, chunks) {
  const bin = Buffer.concat(chunks);
  const paddedBin = padBuffer(bin, 0x00);
  gltf.buffers[0].byteLength = paddedBin.length;
  const json = Buffer.from(JSON.stringify(gltf), "utf8");
  const paddedJson = padBuffer(json, 0x20);
  const totalLength = 12 + 8 + paddedJson.length + 8 + paddedBin.length;
  const header = Buffer.alloc(12);
  header.writeUInt32LE(0x46546c67, 0);
  header.writeUInt32LE(2, 4);
  header.writeUInt32LE(totalLength, 8);
  const jsonHeader = Buffer.alloc(8);
  jsonHeader.writeUInt32LE(paddedJson.length, 0);
  jsonHeader.writeUInt32LE(0x4e4f534a, 4);
  const binHeader = Buffer.alloc(8);
  binHeader.writeUInt32LE(paddedBin.length, 0);
  binHeader.writeUInt32LE(0x004e4942, 4);
  return Buffer.concat([header, jsonHeader, paddedJson, binHeader, paddedBin]);
}

function alignChunks(chunks, alignment) {
  const length = chunks.reduce((sum, chunk) => sum + chunk.length, 0);
  const padding = (alignment - (length % alignment)) % alignment;
  if (padding > 0) chunks.push(Buffer.alloc(padding));
  return length + padding;
}

function padBuffer(buffer, padValue) {
  const padding = (4 - (buffer.length % 4)) % 4;
  if (padding === 0) return buffer;
  return Buffer.concat([buffer, Buffer.alloc(padding, padValue)]);
}

function componentsPerType(type) {
  if (type === "SCALAR") return 1;
  if (type === "VEC3") return 3;
  if (type === "VEC4") return 4;
  throw new Error(`Unsupported accessor type: ${type}`);
}

function quatFromEuler(x, y, z) {
  const c1 = Math.cos(x / 2);
  const c2 = Math.cos(y / 2);
  const c3 = Math.cos(z / 2);
  const s1 = Math.sin(x / 2);
  const s2 = Math.sin(y / 2);
  const s3 = Math.sin(z / 2);
  return [
    s1 * c2 * c3 + c1 * s2 * s3,
    c1 * s2 * c3 - s1 * c2 * s3,
    c1 * c2 * s3 + s1 * s2 * c3,
    c1 * c2 * c3 - s1 * s2 * s3,
  ].map(round);
}

function round(value) {
  return Math.round(value * 100000) / 100000;
}

function roundNullable(value) {
  return value === null ? null : round(value);
}

const ROOT_TRANSLATION_TARGETS = new Set(["root", "hips", "pelvis", "robot_root"]);
const ARM_REST_MOTION_GATE_TARGETS = new Set(["leftUpperArm", "rightUpperArm"]);
const ARM_REST_OFFSET_SEGMENTS = [
  {
    sourceTarget: "leftUpperArm",
    targetNode: "left_upper_arm",
    sourceStart: "leftUpperArm",
    sourceEnd: "leftLowerArm",
    targetStart: "left_upper_arm",
    targetEnd: "left_forearm",
  },
  {
    sourceTarget: "leftLowerArm",
    targetNode: "left_forearm",
    sourceStart: "leftLowerArm",
    sourceEnd: "leftHand",
    targetStart: "left_forearm",
    targetEnd: "left_hand",
  },
  {
    sourceTarget: "rightUpperArm",
    targetNode: "right_upper_arm",
    sourceStart: "rightUpperArm",
    sourceEnd: "rightLowerArm",
    targetStart: "right_upper_arm",
    targetEnd: "right_forearm",
  },
  {
    sourceTarget: "rightLowerArm",
    targetNode: "right_forearm",
    sourceStart: "rightLowerArm",
    sourceEnd: "rightHand",
    targetStart: "right_forearm",
    targetEnd: "right_hand",
  },
];
const TARGET_RIG_TRACKED_NODES = [
  "robot_root",
  "pelvis",
  "head",
  "left_upper_arm",
  "right_upper_arm",
  "left_forearm",
  "right_forearm",
  "left_hand",
  "right_hand",
  "left_upper_leg",
  "right_upper_leg",
  "left_foot",
  "right_foot",
];
const POSE_MISMATCH_WARNING_DETAILS = Object.freeze({
  "scale-inconsistent": {
    severity: "warn",
    reason: "source-to-target scale differs across skeleton height, leg height, and hand span",
  },
  "foot-spread-mismatch": {
    severity: "warn",
    reason: "source and target rest poses have very different foot spacing",
  },
  "leg-spread-mismatch": {
    severity: "warn",
    reason: "source and target rest poses have very different upper-leg spacing",
  },
  "shoulder-width-mismatch": {
    severity: "warn",
    reason: "source and target shoulder widths do not scale with skeleton height",
  },
  "arm-rest-angle-mismatch": {
    severity: "warn",
    reason: "source and target rest arms point in different directions",
  },
});
const POSE_NORMALIZATION_CANDIDATE_DETAILS = Object.freeze({
  "arm-rest-pose-offset": {
    kind: "pose-pre-normalization",
    automatic: false,
    poseNormalization: "arm-rest-offset",
    triggerWarnings: ["arm-rest-angle-mismatch"],
    runnableReason: "source arms are in a different rest direction and the clip has strong upper-arm motion; run arm-rest-offset as a per-sample candidate",
    blockedReason: "source arms are in a different rest direction, but this clip does not have enough upper-arm motion evidence to justify arm-rest-offset",
  },
  "stance-width-adapter": {
    kind: "pose-pre-normalization",
    automatic: false,
    triggerWarnings: ["foot-spread-mismatch", "leg-spread-mismatch"],
    reason: "source and target lower-body rest stance differ; root/leg offsets need a separate candidate before changing animation data",
  },
  "shoulder-width-adapter": {
    kind: "target-rig-or-pose-policy",
    automatic: false,
    triggerWarnings: ["shoulder-width-mismatch"],
    reason: "target shoulder width differs from source skeleton scale; prefer target rig policy or explicit pose adapter over blind rotation retargeting",
  },
});
const ROOT_TRANSLATION_RECOMMENDATION_DETAILS = Object.freeze({
  "height-scale-unavailable": {
    severity: "warn",
    reason: "source initial root height is too close to zero to compare source and target scale",
  },
  "scale-to-model-active": {
    severity: "info",
    reason: "root deltas are scaled by target/source root height",
  },
  "root-motion-locked": {
    severity: "info",
    reason: "root translation is locked to the target base transform",
  },
  "vertical-motion-dropped": {
    severity: "warn",
    reason: "clip has meaningful vertical root motion but horizontal-only mode drops it",
  },
  "horizontal-only-ok": {
    severity: "info",
    reason: "vertical root delta is small enough for horizontal-only normalization",
  },
  "source-space-kept": {
    severity: "warn",
    reason: "source and target root heights differ; keep mode may import source avatar scale",
  },
  "keep-ok": {
    severity: "info",
    reason: "source and target root heights are close enough for keep mode",
  },
  "consider-scale-to-model": {
    severity: "warn",
    reason: "source and target root heights differ and the clip has meaningful vertical root motion; compare scale-to-model before accepting relative",
  },
  "relative-ok": {
    severity: "info",
    reason: "relative root motion avoids importing source avatar height while preserving the clip delta",
  },
});
const ROOT_TRANSLATION_CANDIDATE_DETAILS = Object.freeze({
  "root-scale-to-model": {
    kind: "root-translation-mode",
    status: "runnable",
    automatic: true,
    rootTranslationMode: "scale-to-model",
    reason: "source and target root heights differ while vertical root motion is significant; run scale-to-model as a candidate and compare quality metrics",
  },
  "root-relative": {
    kind: "root-translation-mode",
    status: "runnable",
    automatic: true,
    rootTranslationMode: "relative",
    reason: "horizontal-only mode drops meaningful vertical motion; run relative root motion as a candidate",
  },
});
const ARM_REST_MOTION_GATE_DEG = 60;

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
