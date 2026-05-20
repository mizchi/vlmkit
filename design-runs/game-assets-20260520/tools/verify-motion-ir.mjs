#!/usr/bin/env node
import { readFile, writeFile } from "node:fs/promises";
import { relative, resolve } from "node:path";

const repoRoot = resolve(new URL("../../..", import.meta.url).pathname);

function parseArgs(argv) {
  const args = {
    motion: "",
    model: "",
    out: "",
    requiredTargets: [],
  };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === "--motion") args.motion = resolve(required(argv, ++i, arg));
    else if (arg === "--model") args.model = resolve(required(argv, ++i, arg));
    else if (arg === "--out") args.out = resolve(required(argv, ++i, arg));
    else if (arg === "--required-targets") args.requiredTargets = csv(required(argv, ++i, arg));
    else if (arg === "--help" || arg === "-h") {
      console.log(`Usage:
  node design-runs/game-assets-20260520/tools/verify-motion-ir.mjs --motion <motion.json> [options]

Options:
  --model <path>             Optional GLB used to validate retargeted nodes
  --out <path>               Verification JSON path
  --required-targets <csv>   Required source targets in the motion IR
`);
      process.exit(0);
    } else {
      throw new Error(`Unknown argument: ${arg}`);
    }
  }
  if (!args.motion) throw new Error("--motion is required");
  if (!args.out) args.out = args.motion.replace(/\.json$/, ".verify.json");
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
  const motion = JSON.parse(await readFile(args.motion, "utf8"));
  const modelNodes = args.model ? await readGlbNodeNames(args.model) : null;
  const failures = [];
  const warnings = [];

  requireType(motion.version, "number", "version", failures);
  if (motion.version !== 1) failures.push({ path: "version", reason: "expected version 1" });
  requireType(motion.id, "string", "id", failures);
  requireObject(motion.source, "source", failures);
  requireType(motion.source?.kind, "string", "source.kind", failures);
  requireObject(motion.retarget, "retarget", failures);
  requireArray(motion.clips, "clips", failures);

  const retarget = motion.retarget && typeof motion.retarget === "object" ? motion.retarget : {};
  for (const [sourceTarget, nodeName] of Object.entries(retarget)) {
    if (typeof nodeName !== "string" || !nodeName) {
      failures.push({ path: `retarget.${sourceTarget}`, reason: "expected non-empty target node name" });
    } else if (modelNodes && !modelNodes.has(nodeName)) {
      failures.push({ path: `retarget.${sourceTarget}`, reason: `target node missing in model: ${nodeName}` });
    }
  }
  for (const target of args.requiredTargets) {
    if (!(target in retarget)) failures.push({ path: "retarget", reason: `missing required source target: ${target}` });
  }

  const clipIds = new Set();
  const clipSummaries = [];
  for (const [clipIndex, clip] of (motion.clips ?? []).entries()) {
    const clipPath = `clips[${clipIndex}]`;
    if (typeof clip.id !== "string" || !clip.id) failures.push({ path: `${clipPath}.id`, reason: "expected non-empty clip id" });
    if (clipIds.has(clip.id)) failures.push({ path: `${clipPath}.id`, reason: `duplicate clip id: ${clip.id}` });
    clipIds.add(clip.id);
    if (!Number.isFinite(clip.durationSeconds) || clip.durationSeconds <= 0) {
      failures.push({ path: `${clipPath}.durationSeconds`, reason: "expected positive durationSeconds" });
    }
    requireArray(clip.tracks, `${clipPath}.tracks`, failures);
    const trackTargets = new Set();
    for (const [trackIndex, track] of (clip.tracks ?? []).entries()) {
      const trackPath = `${clipPath}.tracks[${trackIndex}]`;
      const targetKey = `${track.target}:${track.path}`;
      if (trackTargets.has(targetKey)) failures.push({ path: trackPath, reason: `duplicate target/path in clip: ${targetKey}` });
      trackTargets.add(targetKey);
      validateTrack(track, trackPath, clip, retarget, modelNodes, failures, warnings);
    }
    clipSummaries.push({
      id: clip.id ?? "",
      durationSeconds: clip.durationSeconds ?? null,
      loop: Boolean(clip.loop),
      trackCount: Array.isArray(clip.tracks) ? clip.tracks.length : 0,
    });
  }

  const ok = failures.length === 0;
  const result = {
    ok,
    motion: relative(repoRoot, args.motion),
    model: args.model ? relative(repoRoot, args.model) : null,
    clipSummaries,
    failures,
    warnings,
  };
  await writeFile(args.out, `${JSON.stringify(result, null, 2)}\n`);
  console.log(`${ok ? "OK" : "FAIL"} ${relative(repoRoot, args.out)}`);
  if (!ok) process.exit(1);
}

function validateTrack(track, trackPath, clip, retarget, modelNodes, failures, warnings) {
  if (typeof track.target !== "string" || !track.target) failures.push({ path: `${trackPath}.target`, reason: "expected non-empty target" });
  if (!["rotation", "translation"].includes(track.path)) failures.push({ path: `${trackPath}.path`, reason: "expected rotation or translation" });
  if (track.target && !(track.target in retarget)) {
    warnings.push({ path: `${trackPath}.target`, reason: "target has no retarget entry; it will be treated as a glTF node name" });
    if (modelNodes && !modelNodes.has(track.target)) failures.push({ path: `${trackPath}.target`, reason: `target node missing in model: ${track.target}` });
  }
  requireArray(track.keyframes, `${trackPath}.keyframes`, failures);
  const keyframes = Array.isArray(track.keyframes) ? [...track.keyframes].sort((a, b) => a.time - b.time) : [];
  if (clip.loop && keyframes.length > 0 && keyframes[0].time !== 0) {
    failures.push({ path: `${trackPath}.keyframes[0].time`, reason: "looping tracks must start at 0" });
  }
  const values = [];
  for (const [index, keyframe] of keyframes.entries()) {
    const keyPath = `${trackPath}.keyframes[${index}]`;
    if (!Number.isFinite(keyframe.time) || keyframe.time < 0) failures.push({ path: `${keyPath}.time`, reason: "expected non-negative finite time" });
    if (index > 0 && keyframe.time <= keyframes[index - 1].time) failures.push({ path: `${keyPath}.time`, reason: "keyframe times must be strictly increasing" });
    if (track.path === "translation") {
      if (!isVec(keyframe.translation, 3)) failures.push({ path: `${keyPath}.translation`, reason: "expected finite vec3" });
      else values.push(keyframe.translation);
    } else if (keyframe.rotation !== undefined) {
      if (!isVec(keyframe.rotation, 4)) failures.push({ path: `${keyPath}.rotation`, reason: "expected finite quaternion vec4" });
      else values.push(keyframe.rotation);
    } else if (keyframe.euler !== undefined) {
      if (!isVec(keyframe.euler, 3)) failures.push({ path: `${keyPath}.euler`, reason: "expected finite euler vec3" });
      else values.push(quatFromEuler(...keyframe.euler));
    } else {
      failures.push({ path: keyPath, reason: "rotation tracks require rotation or euler" });
    }
  }
  const lastTime = keyframes.at(-1)?.time;
  if (Number.isFinite(clip.durationSeconds) && Number.isFinite(lastTime) && lastTime > clip.durationSeconds + 0.0001) {
    failures.push({ path: `${trackPath}.keyframes`, reason: "last keyframe exceeds clip duration" });
  }
  if (clip.loop && Number.isFinite(clip.durationSeconds) && Math.abs((lastTime ?? -1) - clip.durationSeconds) > 0.0001) {
    failures.push({ path: `${trackPath}.keyframes`, reason: "looping track must end at clip duration" });
  }
  if (clip.loop && values.length > 1 && !tuplesClose(values[0], values.at(-1), 0.001)) {
    failures.push({ path: `${trackPath}.keyframes`, reason: "looping track first and last values must match" });
  }
}

async function readGlbNodeNames(path) {
  const buffer = await readFile(path);
  const gltf = decodeGlb(buffer).gltf;
  return new Set((gltf.nodes ?? []).map((node) => node.name));
}

function decodeGlb(buffer) {
  if (buffer.readUInt32LE(0) !== 0x46546c67) throw new Error("invalid GLB magic");
  if (buffer.readUInt32LE(4) !== 2) throw new Error("unsupported GLB version");
  let offset = 12;
  let json;
  while (offset < buffer.length) {
    const chunkLength = buffer.readUInt32LE(offset);
    const chunkType = buffer.readUInt32LE(offset + 4);
    const chunk = buffer.subarray(offset + 8, offset + 8 + chunkLength);
    if (chunkType === 0x4e4f534a) json = JSON.parse(chunk.toString("utf8"));
    offset += 8 + chunkLength;
  }
  if (!json) throw new Error("missing JSON chunk");
  return { gltf: json };
}

function requireType(value, type, path, failures) {
  if (typeof value !== type) failures.push({ path, reason: `expected ${type}` });
}

function requireObject(value, path, failures) {
  if (!value || typeof value !== "object" || Array.isArray(value)) failures.push({ path, reason: "expected object" });
}

function requireArray(value, path, failures) {
  if (!Array.isArray(value)) failures.push({ path, reason: "expected array" });
}

function isVec(value, length) {
  return Array.isArray(value) && value.length === length && value.every(Number.isFinite);
}

function tuplesClose(a, b, tolerance) {
  if (!a || !b || a.length !== b.length) return false;
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

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
