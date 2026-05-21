import { motionCorePolicy } from "./motion-core-runtime.mjs";

export function classifyRuntimeOutcome({ targetOk, calibrationOk }) {
  const status = motionCorePolicy.kaguraRuntime.outcomeStatus({
    targetOk,
    calibrationOk,
  });
  if (status === "pass") {
    return {
      status: "pass",
      environmentLikelyBroken: false,
      assetLikelyBroken: false,
    };
  }
  if (status === "environment-failed") {
    return {
      status: "environment-failed",
      environmentLikelyBroken: true,
      assetLikelyBroken: false,
    };
  }
  if (status === "asset-failed") {
    return {
      status: "asset-failed",
      environmentLikelyBroken: false,
      assetLikelyBroken: true,
    };
  }
  return {
    status: "target-failed",
    environmentLikelyBroken: false,
    assetLikelyBroken: false,
  };
}

export function shouldFailProcess(outcome, { allowEnvironmentFailure = false } = {}) {
  return motionCorePolicy.kaguraRuntime.shouldFail(outcome.status, {
    allowEnvironmentFailure,
  });
}

export function createClipPlaybackStatus(requestedClips, runtimeState) {
  const requested = [...new Set((requestedClips ?? []).filter(Boolean))];
  if (requested.length === 0) {
    return {
      status: "not-applicable",
      requestedClips: [],
      playableClips: [],
      missingClips: [],
      playedClip: null,
      reason: "handoff contract declares no animation clips",
    };
  }
  if (!runtimeState || typeof runtimeState !== "object") {
    return {
      status: "pending-viewer-support",
      requestedClips: requested,
      playableClips: [],
      missingClips: requested,
      playedClip: null,
      reason: "Kagura gltf_viewer did not expose runtime clip playback state",
    };
  }

  const playableClips = sortedUnique([
    ...arrayOfStrings(runtimeState.clips),
    ...arrayOfStrings(runtimeState.clipIds),
    ...arrayOfStrings(runtimeState.availableClips),
  ]);
  const playedClip = stringOrNull(
    runtimeState.currentClip ?? runtimeState.playedClip ?? runtimeState.clip,
  );
  const missingClips = playableClips.length > 0
    ? requested.filter((clip) => !playableClips.includes(clip))
    : [];
  const playing = runtimeState.playing === undefined ? null : runtimeState.playing === true;
  const timeSeconds = Number.isFinite(runtimeState.timeSeconds) ? runtimeState.timeSeconds : null;

  if (missingClips.length > 0) {
    return {
      status: "missing-clips",
      requestedClips: requested,
      playableClips,
      missingClips,
      playedClip,
      playing,
      timeSeconds,
      reason: "Kagura runtime did not expose every requested clip",
    };
  }
  if (playedClip && !requested.includes(playedClip)) {
    return {
      status: "unexpected-clip",
      requestedClips: requested,
      playableClips,
      missingClips,
      playedClip,
      playing,
      timeSeconds,
      reason: "Kagura runtime played a clip outside the handoff contract",
    };
  }
  if (playedClip && requested.includes(playedClip) && playing !== false) {
    return {
      status: "verified",
      requestedClips: requested,
      playableClips,
      missingClips,
      playedClip,
      playing: playing ?? true,
      timeSeconds,
      reason: "Kagura runtime exposed and played a requested clip",
    };
  }
  return {
    status: "available-not-playing",
    requestedClips: requested,
    playableClips,
    missingClips,
    playedClip,
    playing,
    timeSeconds,
    reason: "Kagura runtime exposed clips but did not report active playback",
  };
}

export function createPosePlaybackStatus({
  clipPlayback,
  runtimeState,
  expectedPose,
  tolerance = 0.002,
} = {}) {
  const clip = clipPlayback?.playedClip ?? expectedPose?.clip ?? null;
  const timeSeconds = Number.isFinite(clipPlayback?.timeSeconds)
    ? clipPlayback.timeSeconds
    : Number.isFinite(expectedPose?.timeSeconds)
      ? expectedPose.timeSeconds
      : null;
  if (clipPlayback?.status !== "verified" || !expectedPose) {
    return {
      status: "not-applicable",
      clip,
      timeSeconds,
      comparedNodeCount: 0,
      maxDelta: null,
      mismatches: [],
      reason: "clip playback was not verified",
    };
  }
  const expectedNodes = Array.isArray(expectedPose.sampledNodes)
    ? expectedPose.sampledNodes
    : [];
  if (expectedNodes.length === 0) {
    return {
      status: "not-applicable",
      clip,
      timeSeconds,
      comparedNodeCount: 0,
      maxDelta: null,
      mismatches: [],
      reason: "sampled glTF animation has no node transform channels",
    };
  }
  const runtimeNodes = arrayOfObjects(runtimeState?.nodeTransforms);
  if (runtimeNodes.length === 0) {
    return {
      status: "pending-viewer-support",
      clip,
      timeSeconds,
      comparedNodeCount: 0,
      maxDelta: null,
      mismatches: [],
      reason: "Kagura gltf_viewer did not expose node transform playback state",
    };
  }

  const runtimeByNode = new Map();
  for (const node of runtimeNodes) {
    if (Number.isInteger(node.nodeIndex)) runtimeByNode.set(node.nodeIndex, node);
  }
  const mismatches = [];
  const comparedNodeIndexes = new Set();
  let maxDelta = 0;
  for (const expected of expectedNodes) {
    const actual = runtimeByNode.get(expected.nodeIndex);
    if (!actual) {
      mismatches.push({
        nodeIndex: expected.nodeIndex,
        nodeName: expected.nodeName ?? null,
        path: "node",
        delta: null,
        reason: "runtime node transform is missing",
      });
      continue;
    }
    let comparedThisNode = false;
    for (const path of ["translation", "rotation", "scale"]) {
      if (!Array.isArray(expected[path])) continue;
      const actualTuple = actual[path];
      if (!Array.isArray(actualTuple)) {
        mismatches.push({
          nodeIndex: expected.nodeIndex,
          nodeName: expected.nodeName ?? null,
          path,
          delta: null,
          expected: expected[path],
          actual: null,
          reason: `runtime ${path} is missing`,
        });
        continue;
      }
      const delta = path === "rotation"
        ? quaternionMaxDelta(actualTuple, expected[path])
        : tupleMaxDelta(actualTuple, expected[path]);
      maxDelta = Math.max(maxDelta, delta);
      comparedThisNode = true;
      if (delta > tolerance) {
        mismatches.push({
          nodeIndex: expected.nodeIndex,
          nodeName: expected.nodeName ?? null,
          path,
          delta: roundDelta(delta),
          expected: expected[path],
          actual: actualTuple,
          reason: `runtime ${path} differs from sampled glTF animation`,
        });
      }
    }
    if (comparedThisNode) comparedNodeIndexes.add(expected.nodeIndex);
  }
  if (mismatches.length > 0) {
    return {
      status: mismatches.some((mismatch) => mismatch.path === "node")
        ? "missing-node-transform"
        : "mismatch",
      clip,
      timeSeconds,
      comparedNodeCount: comparedNodeIndexes.size,
      maxDelta: Number.isFinite(maxDelta) ? roundDelta(maxDelta) : null,
      mismatches,
      reason: "Kagura runtime node transforms differ from sampled glTF animation",
    };
  }
  return {
    status: "verified",
    clip,
    timeSeconds,
    comparedNodeCount: comparedNodeIndexes.size,
    maxDelta: roundDelta(maxDelta),
    mismatches: [],
    reason: "Kagura runtime node transforms match sampled glTF animation",
  };
}

export function sampleGltfClipPose(gltf, bin, clipName, timeSeconds) {
  const animations = Array.isArray(gltf?.animations) ? gltf.animations : [];
  const animation = animations.find((candidate) => candidate?.name === clipName);
  if (!animation) throw new Error(`animation clip not found in GLB: ${clipName}`);
  const sampledByNode = new Map();
  let durationSeconds = 0;
  for (const channel of animation.channels ?? []) {
    const sampler = animation.samplers?.[channel.sampler];
    if (!sampler) throw new Error(`missing sampler ${channel.sampler} in clip ${clipName}`);
    const times = readFloatAccessor(gltf, bin, sampler.input);
    const values = readFloatAccessor(gltf, bin, sampler.output);
    for (const time of times) durationSeconds = Math.max(durationSeconds, time);
    const path = channel.target?.path;
    if (!["translation", "rotation", "scale"].includes(path)) continue;
    const nodeIndex = channel.target?.node;
    if (!Number.isInteger(nodeIndex)) continue;
    const node = sampledByNode.get(nodeIndex) ?? {
      nodeIndex,
      nodeName: gltf.nodes?.[nodeIndex]?.name ?? null,
    };
    const sampleTime = normalizeClipTime(timeSeconds, times);
    node[path] = path === "rotation"
      ? sampleQuat(times, values, sampleTime, sampler.interpolation)
      : sampleVec3(times, values, sampleTime, sampler.interpolation);
    sampledByNode.set(nodeIndex, node);
  }
  return {
    clip: clipName,
    timeSeconds: normalizeDurationTime(timeSeconds, durationSeconds),
    durationSeconds,
    sampledNodes: [...sampledByNode.values()].sort((a, b) => a.nodeIndex - b.nodeIndex),
  };
}

export function sampleGltfClipPoseFromGlb(buffer, clipName, timeSeconds) {
  const { gltf, bin } = decodeGlb(buffer);
  return sampleGltfClipPose(gltf, bin, clipName, timeSeconds);
}

export function sanitizeServerLogLine(line, { kaguraRepo = "" } = {}) {
  let text = String(line).replace(/\u001b\[[0-9;]*m/g, "");
  if (kaguraRepo) {
    text = text.split(kaguraRepo).join("<kaguraRepo>");
  }
  return text.replace(/\(node:\d+\)/g, "(node:<pid>)");
}

function arrayOfStrings(value) {
  return Array.isArray(value) ? value.filter((item) => typeof item === "string" && item) : [];
}

function arrayOfObjects(value) {
  return Array.isArray(value) ? value.filter((item) => item && typeof item === "object") : [];
}

function sortedUnique(values) {
  return [...new Set(values)].sort((a, b) => a.localeCompare(b));
}

function stringOrNull(value) {
  return typeof value === "string" && value ? value : null;
}

function tupleMaxDelta(actual, expected) {
  if (actual.length !== expected.length) return Number.POSITIVE_INFINITY;
  let max = 0;
  for (let i = 0; i < expected.length; i++) {
    const a = Number(actual[i]);
    const e = Number(expected[i]);
    if (!Number.isFinite(a) || !Number.isFinite(e)) return Number.POSITIVE_INFINITY;
    max = Math.max(max, Math.abs(a - e));
  }
  return max;
}

function quaternionMaxDelta(actual, expected) {
  if (actual.length !== 4 || expected.length !== 4) return Number.POSITIVE_INFINITY;
  const same = tupleMaxDelta(actual, expected);
  const negated = tupleMaxDelta(actual, expected.map((value) => -value));
  return Math.min(same, negated);
}

function roundDelta(value) {
  if (!Number.isFinite(value)) return null;
  return Math.round(value * 1_000_000) / 1_000_000;
}

function decodeGlb(buffer) {
  if (buffer.readUInt32LE(0) !== 0x46546c67) throw new Error("invalid GLB magic");
  if (buffer.readUInt32LE(4) !== 2) throw new Error("unsupported GLB version");
  const totalLength = buffer.readUInt32LE(8);
  if (totalLength !== buffer.length) {
    throw new Error(`GLB length mismatch: header=${totalLength} actual=${buffer.length}`);
  }
  let offset = 12;
  let gltf = null;
  let bin = null;
  while (offset < buffer.length) {
    const chunkLength = buffer.readUInt32LE(offset);
    const chunkType = buffer.readUInt32LE(offset + 4);
    const chunk = buffer.subarray(offset + 8, offset + 8 + chunkLength);
    if (chunkType === 0x4e4f534a) gltf = JSON.parse(chunk.toString("utf8"));
    if (chunkType === 0x004e4942) bin = chunk;
    offset += 8 + chunkLength;
  }
  if (!gltf) throw new Error("missing JSON chunk");
  if (!bin) throw new Error("missing BIN chunk");
  return { gltf, bin };
}

function readFloatAccessor(gltf, bin, accessorIndex) {
  const accessor = gltf.accessors?.[accessorIndex];
  if (!accessor) throw new Error(`missing accessor ${accessorIndex}`);
  if (accessor.componentType !== 5126) throw new Error(`accessor ${accessorIndex} is not float`);
  const view = gltf.bufferViews?.[accessor.bufferView];
  if (!view) throw new Error(`missing bufferView ${accessor.bufferView}`);
  const tupleSize = componentsPerType(accessor.type);
  const stride = view.byteStride ?? tupleSize * 4;
  const baseOffset = (view.byteOffset ?? 0) + (accessor.byteOffset ?? 0);
  const values = [];
  for (let i = 0; i < accessor.count; i++) {
    const elementOffset = baseOffset + i * stride;
    for (let j = 0; j < tupleSize; j++) {
      values.push(bin.readFloatLE(elementOffset + j * 4));
    }
  }
  return values;
}

function componentsPerType(type) {
  if (type === "SCALAR") return 1;
  if (type === "VEC2") return 2;
  if (type === "VEC3") return 3;
  if (type === "VEC4") return 4;
  throw new Error(`Unsupported accessor type: ${type}`);
}

function normalizeDurationTime(timeSeconds, durationSeconds) {
  if (!Number.isFinite(timeSeconds)) return 0;
  if (!Number.isFinite(durationSeconds) || durationSeconds <= 0) return timeSeconds;
  const wrapped = timeSeconds % durationSeconds;
  return wrapped < 0 ? wrapped + durationSeconds : wrapped;
}

function normalizeClipTime(timeSeconds, times) {
  const last = times.length > 0 ? times[times.length - 1] : 0;
  return normalizeDurationTime(timeSeconds, last);
}

function sampleVec3(times, values, time, interpolation = "LINEAR") {
  const index = keyframeIndex(times, time);
  const base = tupleAt(values, index, 3);
  if (interpolation === "STEP" || index >= times.length - 1) return base;
  const t = interpolationRatio(times, index, time);
  return lerpTuple(base, tupleAt(values, index + 1, 3), t);
}

function sampleQuat(times, values, time, interpolation = "LINEAR") {
  const index = keyframeIndex(times, time);
  const base = tupleAt(values, index, 4);
  if (interpolation === "STEP" || index >= times.length - 1) return normalizeQuat(base);
  const t = interpolationRatio(times, index, time);
  return slerpQuat(base, tupleAt(values, index + 1, 4), t);
}

function keyframeIndex(times, time) {
  if (times.length === 0) return 0;
  if (time <= times[0]) return 0;
  if (time >= times[times.length - 1]) return times.length - 1;
  for (let i = 0; i < times.length - 1; i++) {
    if (times[i] <= time && time < times[i + 1]) return i;
  }
  return times.length - 1;
}

function interpolationRatio(times, index, time) {
  const start = times[index];
  const end = times[index + 1];
  const span = end - start;
  return span > 1e-10 ? (time - start) / span : 0;
}

function tupleAt(values, index, size) {
  const offset = index * size;
  return values.slice(offset, offset + size);
}

function lerpTuple(a, b, t) {
  return a.map((value, index) => value + (b[index] - value) * t);
}

function normalizeQuat(q) {
  const length = Math.hypot(q[0], q[1], q[2], q[3]);
  if (length <= 1e-12) return [0, 0, 0, 1];
  return q.map((value) => value / length);
}

function slerpQuat(a, b, t) {
  let qa = normalizeQuat(a);
  let qb = normalizeQuat(b);
  let dot = qa.reduce((sum, value, index) => sum + value * qb[index], 0);
  if (dot < 0) {
    qb = qb.map((value) => -value);
    dot = -dot;
  }
  if (dot > 0.9995) return normalizeQuat(lerpTuple(qa, qb, t));
  const theta0 = Math.acos(Math.max(-1, Math.min(1, dot)));
  const theta = theta0 * t;
  const sinTheta = Math.sin(theta);
  const sinTheta0 = Math.sin(theta0);
  const s0 = Math.cos(theta) - dot * sinTheta / sinTheta0;
  const s1 = sinTheta / sinTheta0;
  return normalizeQuat(qa.map((value, index) => value * s0 + qb[index] * s1));
}
