#!/usr/bin/env node
import { readFile, writeFile } from "node:fs/promises";
import { basename, dirname, join, relative, resolve } from "node:path";
import { axisRange, computeWorldMatrices, nodeWorldPosition, vec3, vec3Range, vec4 } from "./gltf-bind-pose.mjs";

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
  for (const clip of clips) {
    gltf.animations.push(buildAnimation(gltf, chunks, motion, clip, nodeIndexByName, {
      rootTranslationMode: args.rootTranslationMode,
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
  return {
    version: 1,
    kind: "motion-normalization-audit",
    input: relative(repoRoot, args.input),
    motion: relative(repoRoot, args.motion),
    output: relative(repoRoot, args.out),
    rootTranslationMode: args.rootTranslationMode,
    motionSource: {
      kind: motion.source?.kind ?? null,
      targetSpace: motion.source?.targetSpace ?? null,
      humanoidBoneCount: motion.source?.vrmcVrmAnimation?.humanoidBoneCount ?? null,
    },
    sourceRig,
    targetRig,
    sourceTargetRigComparison: compareSourceTargetRig(sourceRig, targetRig),
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

function compareSourceTargetRig(sourceRig, targetRig) {
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
  const warnings = [];
  if (scaleSpread && scaleSpread.ratio >= CORE_SCALE_SPREAD_WARN_RATIO) {
    warnings.push({
      id: "scale-inconsistent",
      severity: "warn",
      reason: "source-to-target scale differs across skeleton height, leg height, and hand span",
    });
  }
  if (Number.isFinite(scales.footSpread) && (scales.footSpread >= FOOT_SPREAD_POSE_WARN_RATIO || scales.footSpread <= 1 / FOOT_SPREAD_POSE_WARN_RATIO)) {
    warnings.push({
      id: "foot-spread-mismatch",
      severity: "warn",
      reason: "source and target rest poses have very different foot spacing",
    });
  }
  if (Number.isFinite(scales.upperLegSpread) && (scales.upperLegSpread >= LEG_SPREAD_POSE_WARN_RATIO || scales.upperLegSpread <= 1 / LEG_SPREAD_POSE_WARN_RATIO)) {
    warnings.push({
      id: "leg-spread-mismatch",
      severity: "warn",
      reason: "source and target rest poses have very different upper-leg spacing",
    });
  }
  if (hasRelativeScaleMismatch(scales.shoulderWidth, scales.skeletonHeight, SHOULDER_SCALE_MISMATCH_WARN_DELTA)) {
    warnings.push({
      id: "shoulder-width-mismatch",
      severity: "warn",
      reason: "source and target shoulder widths do not scale with skeleton height",
    });
  }
  const armAngleDelta = angleDelta(sourceRig.bindMetrics.armDownAngleDeg, targetRig.bindMetrics.armDownAngleDeg);
  if (armAngleDelta !== null && armAngleDelta >= ARM_REST_ANGLE_WARN_DEG) {
    warnings.push({
      id: "arm-rest-angle-mismatch",
      severity: "warn",
      reason: "source and target rest arms point in different directions",
      value: { deltaDeg: round(armAngleDelta) },
    });
  }
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
  };
}

function scaleMetric(source, target) {
  if (!Number.isFinite(source) || !Number.isFinite(target) || Math.abs(source) <= 0.0001) return null;
  return target / source;
}

function hasRelativeScaleMismatch(scale, referenceScale, threshold) {
  if (!Number.isFinite(scale) || !Number.isFinite(referenceScale) || Math.abs(referenceScale) <= 0.0001) return false;
  return Math.abs(scale / referenceScale - 1) >= threshold;
}

function angleDelta(source, target) {
  if (!Number.isFinite(source) || !Number.isFinite(target)) return null;
  return Math.abs(source - target);
}

function mapValues(object, mapper) {
  return Object.fromEntries(Object.entries(object).map(([key, value]) => [key, mapper(value)]));
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
    recommendation: recommendRootTranslationNormalization({
      mode: rootTranslationMode,
      heightScale,
      heightScaleDelta,
      verticalDeltaRange,
    }),
  });
}

function recommendRootTranslationNormalization({ mode, heightScale, heightScaleDelta, verticalDeltaRange }) {
  if (heightScale === null) {
    return {
      id: "height-scale-unavailable",
      severity: "warn",
      reason: "source initial root height is too close to zero to compare source and target scale",
    };
  }
  if (mode === "scale-to-model") {
    return {
      id: "scale-to-model-active",
      severity: "info",
      reason: "root deltas are scaled by target/source root height",
    };
  }
  if (mode === "zero") {
    return {
      id: "root-motion-locked",
      severity: "info",
      reason: "root translation is locked to the target base transform",
    };
  }
  if (mode === "horizontal-only") {
    if (verticalDeltaRange >= VERTICAL_ROOT_MOTION_SCALE_THRESHOLD) {
      return {
        id: "vertical-motion-dropped",
        severity: "warn",
        reason: "clip has meaningful vertical root motion but horizontal-only mode drops it",
      };
    }
    return {
      id: "horizontal-only-ok",
      severity: "info",
      reason: "vertical root delta is small enough for horizontal-only normalization",
    };
  }
  if (mode === "keep") {
    if (heightScaleDelta >= HEIGHT_SCALE_DELTA_THRESHOLD) {
      return {
        id: "source-space-kept",
        severity: "warn",
        reason: "source and target root heights differ; keep mode may import source avatar scale",
      };
    }
    return {
      id: "keep-ok",
      severity: "info",
      reason: "source and target root heights are close enough for keep mode",
    };
  }
  if (heightScaleDelta >= HEIGHT_SCALE_DELTA_THRESHOLD && verticalDeltaRange >= VERTICAL_ROOT_MOTION_SCALE_THRESHOLD) {
    return {
      id: "consider-scale-to-model",
      severity: "warn",
      reason: "source and target root heights differ and the clip has meaningful vertical root motion; compare scale-to-model before accepting relative",
    };
  }
  return {
    id: "relative-ok",
    severity: "info",
    reason: "relative root motion avoids importing source avatar height while preserving the clip delta",
  };
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
      values.push(vec4(keyframe.rotation, `rotation for ${clip.id}.${track.target}`));
    } else {
      values.push(quatFromEuler(...vec3(keyframe.euler, `euler for ${clip.id}.${track.target}`)));
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
const TARGET_RIG_TRACKED_NODES = [
  "robot_root",
  "pelvis",
  "head",
  "left_upper_arm",
  "right_upper_arm",
  "left_hand",
  "right_hand",
  "left_upper_leg",
  "right_upper_leg",
  "left_foot",
  "right_foot",
];
const CORE_SCALE_SPREAD_WARN_RATIO = 1.25;
const FOOT_SPREAD_POSE_WARN_RATIO = 2.0;
const LEG_SPREAD_POSE_WARN_RATIO = 2.0;
const SHOULDER_SCALE_MISMATCH_WARN_DELTA = 0.4;
const ARM_REST_ANGLE_WARN_DEG = 45;
const HEIGHT_SCALE_DELTA_THRESHOLD = 0.2;
const VERTICAL_ROOT_MOTION_SCALE_THRESHOLD = 0.08;

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
