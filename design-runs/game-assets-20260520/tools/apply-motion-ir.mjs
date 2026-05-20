#!/usr/bin/env node
import { readFile, writeFile } from "node:fs/promises";
import { basename, dirname, join, relative, resolve } from "node:path";

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
  const audit = createAudit(args, motion);
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

function createAudit(args, motion) {
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
    clips: [],
  };
}

function recordRootTranslationAudit(audit, clip, track, nodeName, baseTranslation, samples, rootTranslationMode) {
  if (!audit || track.path !== "translation" || !isRootTranslationTrack(track, nodeName)) return;
  const sorted = [...track.keyframes].sort((a, b) => a.time - b.time);
  const sourceTranslations = sorted.map((keyframe) => vec3(keyframe.translation, `translation for ${clip.id}.${track.target}`));
  const normalizedTranslations = samples.values.map((value) => vec3(value, `normalized translation for ${clip.id}.${track.target}`));
  const base = vec3(baseTranslation, "base translation");
  const first = sourceTranslations[0] ?? [0, 0, 0];
  const scale = rootTranslationMode === "scale-to-model" && Math.abs(first[1]) > 0.0001
    ? base[1] / first[1]
    : 1;
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
    sourceRange: vec3Range(sourceTranslations),
    normalizedRange: vec3Range(normalizedTranslations),
    deltaRange: vec3Range(sourceTranslations.map((value) => [
      value[0] - first[0],
      value[1] - first[1],
      value[2] - first[2],
    ])),
  });
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

function vec3(value, context) {
  if (!Array.isArray(value) || value.length !== 3 || value.some((item) => !Number.isFinite(item))) {
    throw new Error(`${context} must be a finite vec3`);
  }
  return value;
}

function vec4(value, context) {
  if (!Array.isArray(value) || value.length !== 4 || value.some((item) => !Number.isFinite(item))) {
    throw new Error(`${context} must be a finite vec4`);
  }
  return value;
}

function tuplesClose(a, b, tolerance) {
  if (!a || !b || a.length !== b.length) return false;
  return a.every((value, index) => Math.abs(value - b[index]) <= tolerance);
}

function vec3Range(values) {
  if (values.length === 0) return null;
  return {
    min: [
      round(Math.min(...values.map((value) => value[0]))),
      round(Math.min(...values.map((value) => value[1]))),
      round(Math.min(...values.map((value) => value[2]))),
    ],
    max: [
      round(Math.max(...values.map((value) => value[0]))),
      round(Math.max(...values.map((value) => value[1]))),
      round(Math.max(...values.map((value) => value[2]))),
    ],
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

const ROOT_TRANSLATION_TARGETS = new Set(["root", "hips", "pelvis", "robot_root"]);

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
