import { Buffer } from "node:buffer";
import { extname } from "node:path";
export function decideMotionSourceAdapter(input) {
    const inputFormat = detectMotionSourceFormat(input);
    if (inputFormat === "fbx") {
        return {
            inputFormat,
            status: "requires-conversion",
            strategy: "convert-to-glb-first",
            directFbxParsing: false,
            outputContract: "motion-ir",
            requiredExternalTools: ["Blender", "FBX2glTF"],
            reasons: [
                "FBX is tool-version dependent and not stable enough for direct parsing in the core verifier.",
                "Mixamo/FBX animation should converge on the same GLB -> Motion IR path used by generated assets.",
            ],
            nextSteps: [
                "Convert the FBX animation to GLB with an external tool while preserving clip names and skeleton transforms.",
                "Run the glTF animation extractor on the converted GLB and verify the resulting Motion IR.",
            ],
            warnings: input.convertedGlbPath
                ? [`Converted GLB is available at ${input.convertedGlbPath}; validate that GLB instead of parsing FBX directly.`]
                : [],
        };
    }
    if (inputFormat === "glb" || inputFormat === "gltf") {
        return {
            inputFormat,
            status: "ready",
            strategy: "extract-gltf-animation",
            directFbxParsing: false,
            outputContract: "motion-ir",
            requiredExternalTools: [],
            reasons: [
                "glTF/GLB exposes animation samplers and channels through a documented JSON contract.",
            ],
            nextSteps: [
                "Extract animation channels into Motion IR.",
                "Verify retarget mappings and runtime playback against the GLB.",
            ],
            warnings: [],
        };
    }
    if (inputFormat === "vrma") {
        return {
            inputFormat,
            status: "ready",
            strategy: "extract-vrm-vrma",
            directFbxParsing: false,
            outputContract: "motion-ir",
            requiredExternalTools: [],
            reasons: [
                "VRMA is handled as a VRM/VRMA playback bridge but still emits the shared Motion IR contract.",
            ],
            nextSteps: [
                "Extract the VRMA clip into Motion IR.",
                "Verify required humanoid targets against the destination VRM/GLB model.",
            ],
            warnings: [],
        };
    }
    if (inputFormat === "motion-ir") {
        return {
            inputFormat,
            status: "ready",
            strategy: "use-motion-ir",
            directFbxParsing: false,
            outputContract: "motion-ir",
            requiredExternalTools: [],
            reasons: [
                "Input is already normalized to the reusable Motion IR contract.",
            ],
            nextSteps: [
                "Verify the Motion IR schema and retarget mappings before rendering.",
            ],
            warnings: [],
        };
    }
    return {
        inputFormat,
        status: "unsupported",
        strategy: "unsupported",
        directFbxParsing: false,
        outputContract: "motion-ir",
        requiredExternalTools: [],
        reasons: ["Motion source format could not be inferred."],
        nextSteps: ["Provide a GLB, glTF, VRMA, Motion IR JSON, or FBX source that can be converted externally."],
        warnings: [],
    };
}
export function verifyMotionIr(motion, options = {}) {
    const failures = [];
    const warnings = [];
    const modelNodes = options.modelNodeNames ? new Set(options.modelNodeNames) : null;
    const motionRecord = recordOrEmpty(motion);
    requireType(motionRecord.version, "number", "version", failures);
    if (motionRecord.version !== 1)
        failures.push({ path: "version", reason: "expected version 1" });
    requireType(motionRecord.id, "string", "id", failures);
    requireObject(motionRecord.source, "source", failures);
    requireType(asRecord(motionRecord.source)?.kind, "string", "source.kind", failures);
    requireObject(motionRecord.retarget, "retarget", failures);
    requireArray(motionRecord.clips, "clips", failures);
    const retarget = recordOrEmpty(motionRecord.retarget);
    for (const [sourceTarget, nodeName] of Object.entries(retarget)) {
        if (typeof nodeName !== "string" || !nodeName) {
            failures.push({ path: `retarget.${sourceTarget}`, reason: "expected non-empty target node name" });
        }
        else if (modelNodes && !modelNodes.has(nodeName)) {
            failures.push({ path: `retarget.${sourceTarget}`, reason: `target node missing in model: ${nodeName}` });
        }
    }
    for (const target of options.requiredTargets ?? []) {
        if (!(target in retarget))
            failures.push({ path: "retarget", reason: `missing required source target: ${target}` });
    }
    const clipIds = new Set();
    const clipSummaries = [];
    const clips = Array.isArray(motionRecord.clips) ? motionRecord.clips : [];
    for (const [clipIndex, clipValue] of clips.entries()) {
        const clipPath = `clips[${clipIndex}]`;
        const clip = recordOrEmpty(clipValue);
        if (typeof clip.id !== "string" || !clip.id) {
            failures.push({ path: `${clipPath}.id`, reason: "expected non-empty clip id" });
        }
        else if (clipIds.has(clip.id)) {
            failures.push({ path: `${clipPath}.id`, reason: `duplicate clip id: ${clip.id}` });
        }
        else {
            clipIds.add(clip.id);
        }
        if (!isFiniteNumber(clip.durationSeconds) || clip.durationSeconds <= 0) {
            failures.push({ path: `${clipPath}.durationSeconds`, reason: "expected positive durationSeconds" });
        }
        requireArray(clip.tracks, `${clipPath}.tracks`, failures);
        const trackTargets = new Set();
        const tracks = Array.isArray(clip.tracks) ? clip.tracks : [];
        for (const [trackIndex, trackValue] of tracks.entries()) {
            const trackPath = `${clipPath}.tracks[${trackIndex}]`;
            const track = recordOrEmpty(trackValue);
            const target = typeof track.target === "string" ? track.target : "";
            const path = typeof track.path === "string" ? track.path : "";
            const targetKey = `${target}:${path}`;
            if (target && path) {
                if (trackTargets.has(targetKey))
                    failures.push({ path: trackPath, reason: `duplicate target/path in clip: ${targetKey}` });
                trackTargets.add(targetKey);
            }
            validateMotionIrTrack(track, trackPath, clip, retarget, modelNodes, failures, warnings);
        }
        clipSummaries.push({
            id: typeof clip.id === "string" ? clip.id : "",
            durationSeconds: isFiniteNumber(clip.durationSeconds) ? clip.durationSeconds : null,
            loop: Boolean(clip.loop),
            trackCount: tracks.length,
        });
    }
    return {
        ok: failures.length === 0,
        clipSummaries,
        failures,
        warnings,
    };
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
    const runtime = asRecord(runtimeState);
    if (!runtime) {
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
        ...arrayOfStrings(runtime.clips),
        ...arrayOfStrings(runtime.clipIds),
        ...arrayOfStrings(runtime.availableClips),
    ]);
    const playedClip = stringOrNull(runtime.currentClip ?? runtime.playedClip ?? runtime.clip);
    const missingClips = playableClips.length > 0
        ? requested.filter((clip) => !playableClips.includes(clip))
        : [];
    const playing = runtime.playing === undefined ? null : runtime.playing === true;
    const timeSeconds = isFiniteNumber(runtime.timeSeconds) ? runtime.timeSeconds : null;
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
export function createPosePlaybackStatus({ clipPlayback, runtimeState, expectedPose, tolerance = 0.002, } = {}) {
    const clip = clipPlayback?.playedClip ?? expectedPose?.clip ?? null;
    const timeSeconds = isFiniteNumber(clipPlayback?.timeSeconds)
        ? clipPlayback.timeSeconds
        : isFiniteNumber(expectedPose?.timeSeconds)
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
    const runtime = asRecord(runtimeState);
    const runtimeNodes = arrayOfObjects(runtime?.nodeTransforms);
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
        if (Number.isInteger(node.nodeIndex))
            runtimeByNode.set(node.nodeIndex, node);
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
            const expectedTuple = expected[path];
            if (!Array.isArray(expectedTuple))
                continue;
            const actualTuple = actual[path];
            if (!Array.isArray(actualTuple)) {
                mismatches.push({
                    nodeIndex: expected.nodeIndex,
                    nodeName: expected.nodeName ?? null,
                    path,
                    delta: null,
                    expected: expectedTuple,
                    actual: null,
                    reason: `runtime ${path} is missing`,
                });
                continue;
            }
            const delta = path === "rotation"
                ? quaternionMaxDelta(actualTuple, expectedTuple)
                : tupleMaxDelta(actualTuple, expectedTuple);
            maxDelta = Math.max(maxDelta, delta);
            comparedThisNode = true;
            if (delta > tolerance) {
                mismatches.push({
                    nodeIndex: expected.nodeIndex,
                    nodeName: expected.nodeName ?? null,
                    path,
                    delta: roundDelta(delta),
                    expected: expectedTuple,
                    actual: actualTuple.map(Number),
                    reason: `runtime ${path} differs from sampled glTF animation`,
                });
            }
        }
        if (comparedThisNode)
            comparedNodeIndexes.add(expected.nodeIndex);
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
    const binBuffer = Buffer.isBuffer(bin) ? bin : Buffer.from(bin);
    const animations = Array.isArray(gltf.animations) ? gltf.animations : [];
    const animation = animations.find((candidate) => candidate?.name === clipName);
    if (!animation)
        throw new Error(`animation clip not found in GLB: ${clipName}`);
    const sampledByNode = new Map();
    let durationSeconds = 0;
    for (const channel of animation.channels ?? []) {
        const samplerIndex = channel.sampler;
        if (!Number.isInteger(samplerIndex))
            throw new Error(`missing sampler index in clip ${clipName}`);
        const samplerIndexNumber = samplerIndex;
        const sampler = animation.samplers?.[samplerIndexNumber];
        if (!sampler)
            throw new Error(`missing sampler ${samplerIndex} in clip ${clipName}`);
        const times = readFloatAccessor(gltf, binBuffer, sampler.input);
        const values = readFloatAccessor(gltf, binBuffer, sampler.output);
        for (const time of times)
            durationSeconds = Math.max(durationSeconds, time);
        const path = channel.target?.path;
        if (path !== "translation" && path !== "rotation" && path !== "scale")
            continue;
        const nodeIndex = channel.target?.node;
        if (!Number.isInteger(nodeIndex))
            continue;
        const nodeIndexNumber = nodeIndex;
        const node = sampledByNode.get(nodeIndexNumber) ?? {
            nodeIndex: nodeIndexNumber,
            nodeName: gltf.nodes?.[nodeIndexNumber]?.name ?? null,
        };
        const sampleTime = normalizeClipTime(timeSeconds, times);
        if (path === "rotation") {
            node.rotation = sampleQuat(times, values, sampleTime, sampler.interpolation);
        }
        else if (path === "translation") {
            node.translation = sampleVec3(times, values, sampleTime, sampler.interpolation);
        }
        else if (path === "scale") {
            node.scale = sampleVec3(times, values, sampleTime, sampler.interpolation);
        }
        sampledByNode.set(nodeIndexNumber, node);
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
    if (!bin)
        throw new Error("missing BIN chunk");
    return sampleGltfClipPose(gltf, bin, clipName, timeSeconds);
}
export function decodeGlb(buffer) {
    const source = Buffer.isBuffer(buffer) ? buffer : Buffer.from(buffer);
    if (source.readUInt32LE(0) !== 0x46546c67)
        throw new Error("invalid GLB magic");
    if (source.readUInt32LE(4) !== 2)
        throw new Error("unsupported GLB version");
    const totalLength = source.readUInt32LE(8);
    if (totalLength !== source.length) {
        throw new Error(`GLB length mismatch: header=${totalLength} actual=${source.length}`);
    }
    let offset = 12;
    let gltf = null;
    let bin = null;
    while (offset < source.length) {
        const chunkLength = source.readUInt32LE(offset);
        const chunkType = source.readUInt32LE(offset + 4);
        const chunk = source.subarray(offset + 8, offset + 8 + chunkLength);
        if (chunkType === 0x4e4f534a)
            gltf = JSON.parse(chunk.toString("utf8"));
        if (chunkType === 0x004e4942)
            bin = chunk;
        offset += 8 + chunkLength;
    }
    if (!gltf)
        throw new Error("missing JSON chunk");
    return { gltf, bin };
}
function detectMotionSourceFormat(input) {
    const declared = normalizeFormat(input.format ?? input.sourceKind);
    if (declared !== "unknown")
        return declared;
    const path = input.path?.split(/[?#]/, 1)[0] ?? "";
    if (path.endsWith(".motion.json"))
        return "motion-ir";
    return normalizeFormat(extname(path));
}
function normalizeFormat(value) {
    const normalized = (value ?? "").toLowerCase().replace(/^\./, "").trim();
    if (!normalized)
        return "unknown";
    if (normalized.includes("mixamo"))
        return "fbx";
    if (normalized === "fbx" || normalized.includes("fbx"))
        return "fbx";
    if (normalized === "glb" || normalized === "model/gltf-binary")
        return "glb";
    if (normalized === "gltf" || normalized === "model/gltf+json")
        return "gltf";
    if (normalized === "vrma")
        return "vrma";
    if (normalized === "motion-ir" || normalized === "motionir")
        return "motion-ir";
    return "unknown";
}
function validateMotionIrTrack(track, trackPath, clip, retarget, modelNodes, failures, warnings) {
    const target = typeof track.target === "string" ? track.target : "";
    const path = typeof track.path === "string" ? track.path : "";
    if (!target)
        failures.push({ path: `${trackPath}.target`, reason: "expected non-empty target" });
    if (!["rotation", "translation"].includes(path))
        failures.push({ path: `${trackPath}.path`, reason: "expected rotation or translation" });
    if (target && !(target in retarget)) {
        warnings.push({ path: `${trackPath}.target`, reason: "target has no retarget entry; it will be treated as a glTF node name" });
        if (modelNodes && !modelNodes.has(target))
            failures.push({ path: `${trackPath}.target`, reason: `target node missing in model: ${target}` });
    }
    requireArray(track.keyframes, `${trackPath}.keyframes`, failures);
    const keyframes = Array.isArray(track.keyframes)
        ? [...track.keyframes].map(recordOrEmpty).sort((a, b) => numberValue(a.time) - numberValue(b.time))
        : [];
    if (clip.loop && keyframes.length > 0 && keyframes[0]?.time !== 0) {
        failures.push({ path: `${trackPath}.keyframes[0].time`, reason: "looping tracks must start at 0" });
    }
    const values = [];
    for (const [index, keyframe] of keyframes.entries()) {
        const keyPath = `${trackPath}.keyframes[${index}]`;
        if (!isFiniteNumber(keyframe.time) || keyframe.time < 0)
            failures.push({ path: `${keyPath}.time`, reason: "expected non-negative finite time" });
        if (index > 0 && numberValue(keyframe.time) <= numberValue(keyframes[index - 1]?.time)) {
            failures.push({ path: `${keyPath}.time`, reason: "keyframe times must be strictly increasing" });
        }
        if (path === "translation") {
            if (!isVec(keyframe.translation, 3))
                failures.push({ path: `${keyPath}.translation`, reason: "expected finite vec3" });
            else
                values.push(keyframe.translation);
        }
        else if (keyframe.rotation !== undefined) {
            if (!isVec(keyframe.rotation, 4))
                failures.push({ path: `${keyPath}.rotation`, reason: "expected finite quaternion vec4" });
            else
                values.push(keyframe.rotation);
        }
        else if (keyframe.euler !== undefined) {
            if (!isVec(keyframe.euler, 3))
                failures.push({ path: `${keyPath}.euler`, reason: "expected finite euler vec3" });
            else
                values.push(quatFromEuler(keyframe.euler[0], keyframe.euler[1], keyframe.euler[2]));
        }
        else if (path === "rotation") {
            failures.push({ path: keyPath, reason: "rotation tracks require rotation or euler" });
        }
    }
    const lastTime = keyframes.at(-1)?.time;
    if (isFiniteNumber(clip.durationSeconds) && isFiniteNumber(lastTime) && lastTime > clip.durationSeconds + 0.0001) {
        failures.push({ path: `${trackPath}.keyframes`, reason: "last keyframe exceeds clip duration" });
    }
    if (clip.loop && isFiniteNumber(clip.durationSeconds) && Math.abs((isFiniteNumber(lastTime) ? lastTime : -1) - clip.durationSeconds) > 0.0001) {
        failures.push({ path: `${trackPath}.keyframes`, reason: "looping track must end at clip duration" });
    }
    if (clip.loop && values.length > 1 && !tuplesClose(values[0], values.at(-1), 0.001)) {
        failures.push({ path: `${trackPath}.keyframes`, reason: "looping track first and last values must match" });
    }
}
function readFloatAccessor(gltf, bin, accessorIndex) {
    if (!Number.isInteger(accessorIndex))
        throw new Error("missing accessor index");
    const index = accessorIndex;
    const accessor = gltf.accessors?.[index];
    if (!accessor)
        throw new Error(`missing accessor ${accessorIndex}`);
    if (accessor.componentType !== 5126)
        throw new Error(`accessor ${accessorIndex} is not float`);
    if (!Number.isInteger(accessor.bufferView))
        throw new Error(`accessor ${accessorIndex} has no bufferView`);
    const bufferViewIndex = accessor.bufferView;
    const view = gltf.bufferViews?.[bufferViewIndex];
    if (!view)
        throw new Error(`missing bufferView ${accessor.bufferView}`);
    const tupleSize = componentsPerType(accessor.type);
    const stride = view.byteStride ?? tupleSize * 4;
    const baseOffset = (view.byteOffset ?? 0) + (accessor.byteOffset ?? 0);
    const values = [];
    for (let i = 0; i < (accessor.count ?? 0); i++) {
        const elementOffset = baseOffset + i * stride;
        for (let j = 0; j < tupleSize; j++) {
            values.push(bin.readFloatLE(elementOffset + j * 4));
        }
    }
    return values;
}
function componentsPerType(type) {
    if (type === "SCALAR")
        return 1;
    if (type === "VEC2")
        return 2;
    if (type === "VEC3")
        return 3;
    if (type === "VEC4")
        return 4;
    throw new Error(`Unsupported accessor type: ${type}`);
}
function normalizeDurationTime(timeSeconds, durationSeconds) {
    if (!Number.isFinite(timeSeconds))
        return 0;
    if (!Number.isFinite(durationSeconds) || durationSeconds <= 0)
        return timeSeconds;
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
    if (interpolation === "STEP" || index >= times.length - 1)
        return base;
    const t = interpolationRatio(times, index, time);
    return lerpTuple(base, tupleAt(values, index + 1, 3), t);
}
function sampleQuat(times, values, time, interpolation = "LINEAR") {
    const index = keyframeIndex(times, time);
    const base = tupleAt(values, index, 4);
    if (interpolation === "STEP" || index >= times.length - 1)
        return normalizeQuat(base);
    const t = interpolationRatio(times, index, time);
    return slerpQuat(base, tupleAt(values, index + 1, 4), t);
}
function keyframeIndex(times, time) {
    if (times.length === 0)
        return 0;
    if (time <= times[0])
        return 0;
    if (time >= times[times.length - 1])
        return times.length - 1;
    for (let i = 0; i < times.length - 1; i++) {
        if (times[i] <= time && time < times[i + 1])
            return i;
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
    if (length <= 1e-12)
        return [0, 0, 0, 1];
    return q.map((value) => value / length);
}
function slerpQuat(a, b, t) {
    const qa = normalizeQuat(a);
    let qb = normalizeQuat(b);
    let dot = qa.reduce((sum, value, index) => sum + value * qb[index], 0);
    if (dot < 0) {
        qb = qb.map((value) => -value);
        dot = -dot;
    }
    if (dot > 0.9995)
        return normalizeQuat(lerpTuple(qa, qb, t));
    const theta0 = Math.acos(Math.max(-1, Math.min(1, dot)));
    const theta = theta0 * t;
    const sinTheta = Math.sin(theta);
    const sinTheta0 = Math.sin(theta0);
    const s0 = Math.cos(theta) - dot * sinTheta / sinTheta0;
    const s1 = sinTheta / sinTheta0;
    return normalizeQuat(qa.map((value, index) => value * s0 + qb[index] * s1));
}
function requireType(value, type, path, failures) {
    if (typeof value !== type)
        failures.push({ path, reason: `expected ${type}` });
}
function requireObject(value, path, failures) {
    if (!isRecord(value))
        failures.push({ path, reason: "expected object" });
}
function requireArray(value, path, failures) {
    if (!Array.isArray(value))
        failures.push({ path, reason: "expected array" });
}
function isVec(value, length) {
    return Array.isArray(value) && value.length === length && value.every(Number.isFinite);
}
function tuplesClose(a, b, tolerance) {
    if (!a || !b || a.length !== b.length)
        return false;
    return a.every((value, index) => Math.abs(value - b[index]) <= tolerance);
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
function arrayOfStrings(value) {
    return Array.isArray(value) ? value.filter((item) => typeof item === "string" && item) : [];
}
function arrayOfObjects(value) {
    return Array.isArray(value) ? value.filter(isRecord) : [];
}
function sortedUnique(values) {
    return [...new Set(values)].sort((a, b) => a.localeCompare(b));
}
function stringOrNull(value) {
    return typeof value === "string" && value ? value : null;
}
function tupleMaxDelta(actual, expected) {
    if (actual.length !== expected.length)
        return Number.POSITIVE_INFINITY;
    let max = 0;
    for (let i = 0; i < expected.length; i++) {
        const a = Number(actual[i]);
        const e = Number(expected[i]);
        if (!Number.isFinite(a) || !Number.isFinite(e))
            return Number.POSITIVE_INFINITY;
        max = Math.max(max, Math.abs(a - e));
    }
    return max;
}
function quaternionMaxDelta(actual, expected) {
    if (actual.length !== 4 || expected.length !== 4)
        return Number.POSITIVE_INFINITY;
    const same = tupleMaxDelta(actual, expected);
    const negated = tupleMaxDelta(actual, expected.map((value) => -value));
    return Math.min(same, negated);
}
function roundDelta(value) {
    if (!Number.isFinite(value))
        return null;
    return Math.round(value * 1_000_000) / 1_000_000;
}
function isRecord(value) {
    return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}
function asRecord(value) {
    return isRecord(value) ? value : null;
}
function recordOrEmpty(value) {
    return asRecord(value) ?? {};
}
function isFiniteNumber(value) {
    return typeof value === "number" && Number.isFinite(value);
}
function numberValue(value) {
    return isFiniteNumber(value) ? value : Number.NaN;
}
