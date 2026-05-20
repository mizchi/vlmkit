#!/usr/bin/env node
import { readFile, stat, writeFile } from "node:fs/promises";
import { basename, dirname, join, relative, resolve } from "node:path";

const repoRoot = resolve(new URL("../../..", import.meta.url).pathname);
const entryDir = dirname(resolve(process.argv[1] ?? new URL(".", import.meta.url).pathname));

function parseArgs(argv) {
  const entryName = basename(entryDir);
  const args = {
    input: join(entryDir, `${entryName}.glb`),
    out: join(entryDir, `${entryName}.verify.json`),
    contract: join(entryDir, "kagura-handoff.json"),
    motionIr: "",
    requiredNodes: [],
    requiredClips: [],
    loopClips: null,
    skipLoopCheck: false,
    loopTolerance: 0.001,
  };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === "--input") args.input = resolve(required(argv, ++i, arg));
    else if (arg === "--out") args.out = resolve(required(argv, ++i, arg));
    else if (arg === "--contract") args.contract = resolve(required(argv, ++i, arg));
    else if (arg === "--motion-ir") args.motionIr = resolve(required(argv, ++i, arg));
    else if (arg === "--required-nodes") args.requiredNodes = csv(required(argv, ++i, arg));
    else if (arg === "--required-clips") args.requiredClips = csv(required(argv, ++i, arg));
    else if (arg === "--loop-clips") args.loopClips = csv(required(argv, ++i, arg));
    else if (arg === "--skip-loop-check") args.skipLoopCheck = true;
    else if (arg === "--loop-tolerance") args.loopTolerance = Number(required(argv, ++i, arg));
    else if (arg === "--help" || arg === "-h") {
      console.log(`Usage:
  node design-runs/game-assets-20260520/tools/verify-gltf-motion.mjs [options]

Options:
  --input <path>             GLB path (default: <entry-dir>/<entry-dir-name>.glb)
  --out <path>               Verification JSON path
  --contract <path>          Asset handoff JSON for required nodes/clips
  --motion-ir <path>         Motion IR sidecar used for clip and loop metadata
  --required-nodes <csv>     Required glTF node names
  --required-clips <csv>     Required animation clip names
  --loop-clips <csv>         Clips that must close as loops
  --skip-loop-check          Do not validate first/last key equality
  --loop-tolerance <n>       First/last key tolerance (default: 0.001)
`);
      process.exit(0);
    } else {
      throw new Error(`Unknown argument: ${arg}`);
    }
  }
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

function motionRequiredNodes(motionIr) {
  if (!motionIr) return [];
  const retargetNodes = Object.values(motionIr.retarget ?? {}).filter((nodeName) => typeof nodeName === "string" && nodeName);
  if (retargetNodes.length > 0) return [...new Set(retargetNodes)];
  const trackTargets = (motionIr.clips ?? [])
    .flatMap((clip) => clip.tracks ?? [])
    .map((track) => track.target)
    .filter((target) => typeof target === "string" && target);
  return [...new Set(trackTargets)];
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const contract = await readContractIfPresent(args.contract);
  const motionIr = args.motionIr ? JSON.parse(await readFile(args.motionIr, "utf8")) : null;
  const motionClipIds = (motionIr?.clips ?? []).map((clip) => clip.id).filter(Boolean);
  const motionNodeIds = motionRequiredNodes(motionIr);
  const requiredNodes = args.requiredNodes.length > 0
    ? args.requiredNodes
    : motionNodeIds.length > 0
      ? motionNodeIds
    : contract?.motionContract?.requiredNodes ?? [];
  const requiredClips = args.requiredClips.length > 0
    ? args.requiredClips
    : motionClipIds.length > 0
      ? motionClipIds
      : (contract?.motionContract?.clips ?? []).map((clip) => clip.id).filter(Boolean);

  const glb = await readFile(args.input);
  const { gltf, bin } = decodeGlb(glb);
  const nodeNames = new Set((gltf.nodes ?? []).map((node) => node.name));
  const animationNames = new Set((gltf.animations ?? []).map((animation) => animation.name));
  const loopClipNames = resolveLoopClipNames(args, contract, motionIr, animationNames);
  const missingNodes = requiredNodes.filter((name) => !nodeNames.has(name));
  const missingClips = requiredClips.filter((name) => !animationNames.has(name));
  const duplicateTargets = [];
  const loopFailures = [];
  const clipSummaries = [];

  for (const animation of gltf.animations ?? []) {
    const seenTargets = new Set();
    let duration = 0;
    for (let channelIndex = 0; channelIndex < animation.channels.length; channelIndex++) {
      const channel = animation.channels[channelIndex];
      const target = `${channel.target.node}:${channel.target.path}`;
      if (seenTargets.has(target)) duplicateTargets.push({ clip: animation.name, target });
      seenTargets.add(target);
      const sampler = animation.samplers[channel.sampler];
      const timeAccessor = gltf.accessors[sampler.input];
      duration = Math.max(duration, timeAccessor.max?.[0] ?? 0);
      const outputAccessor = gltf.accessors[sampler.output];
      const output = readFloatAccessor(gltf, bin, sampler.output);
      const tupleSize = componentsPerType(outputAccessor.type);
      const first = output.slice(0, tupleSize);
      const last = output.slice(output.length - tupleSize);
      if (loopClipNames.has(animation.name) && !tuplesClose(first, last, args.loopTolerance)) {
        loopFailures.push({
          clip: animation.name,
          node: gltf.nodes[channel.target.node]?.name ?? String(channel.target.node),
          path: channel.target.path,
          first: first.map(round),
          last: last.map(round),
        });
      }
    }
    clipSummaries.push({
      name: animation.name,
      durationSeconds: round(duration),
      channels: animation.channels.length,
      samplers: animation.samplers.length,
    });
  }

  const ok = missingNodes.length === 0 && missingClips.length === 0 && duplicateTargets.length === 0 && loopFailures.length === 0;
  const result = {
    ok,
    input: relative(repoRoot, args.input),
    contract: contract ? relative(repoRoot, args.contract) : null,
    motionIr: args.motionIr ? relative(repoRoot, args.motionIr) : null,
    glb: {
      version: 2,
      byteLength: glb.length,
      nodeCount: gltf.nodes?.length ?? 0,
      meshCount: gltf.meshes?.length ?? 0,
      materialCount: gltf.materials?.length ?? 0,
      animationCount: gltf.animations?.length ?? 0,
    },
    requiredNodes,
    missingNodes,
    requiredClips,
    missingClips,
    loopClips: [...loopClipNames],
    duplicateTargets,
    loopFailures,
    clipSummaries,
  };
  await writeFile(args.out, `${JSON.stringify(result, null, 2)}\n`);
  console.log(`${ok ? "OK" : "FAIL"} ${relative(repoRoot, args.out)}`);
  if (!ok) process.exit(1);
}

async function readContractIfPresent(path) {
  try {
    const st = await stat(path);
    if (!st.isFile()) return null;
    return JSON.parse(await readFile(path, "utf8"));
  } catch {
    return null;
  }
}

function resolveLoopClipNames(args, contract, motionIr, animationNames) {
  if (args.skipLoopCheck) return new Set();
  if (args.loopClips) return new Set(args.loopClips);
  if (motionIr) {
    return new Set((motionIr.clips ?? []).filter((clip) => clip.loop === true).map((clip) => clip.id).filter(Boolean));
  }
  const contractLoops = (contract?.motionContract?.clips ?? [])
    .filter((clip) => clip.type === "loop" || clip.loop === true)
    .map((clip) => clip.id)
    .filter(Boolean);
  if (contractLoops.length > 0) return new Set(contractLoops);
  return new Set(animationNames);
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
  if (a.length !== b.length) return false;
  return a.every((value, index) => Math.abs(value - b[index]) <= tolerance);
}

function round(value) {
  return Math.round(value * 1000) / 1000;
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
