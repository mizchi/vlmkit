#!/usr/bin/env node
import { readFile, writeFile } from "node:fs/promises";
import { basename, relative, resolve } from "node:path";

const repoRoot = resolve(new URL("../../..", import.meta.url).pathname);

function parseArgs(argv) {
  const args = {
    input: "",
    out: "",
    preset: "robot-voxel",
    specVersion: "1.0",
  };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === "--input") args.input = resolve(required(argv, ++i, arg));
    else if (arg === "--out") args.out = resolve(required(argv, ++i, arg));
    else if (arg === "--preset") args.preset = required(argv, ++i, arg);
    else if (arg === "--spec-version") args.specVersion = required(argv, ++i, arg);
    else if (arg === "--help" || arg === "-h") {
      console.log(`Usage:
  node design-runs/game-assets-20260520/tools/stamp-vrma-humanoid.mjs --input <animated.glb> --out <motion.vrma> [options]

Options:
  --preset <name>          Humanoid mapping preset: robot-voxel (default)
  --spec-version <value>   VRMC_vrm_animation spec version (default: 1.0)
`);
      process.exit(0);
    } else {
      throw new Error(`Unknown argument: ${arg}`);
    }
  }
  if (!args.input) throw new Error("--input is required");
  if (!args.out) throw new Error("--out is required");
  if (args.preset !== "robot-voxel") throw new Error("--preset currently supports only robot-voxel");
  return args;
}

function required(argv, index, flag) {
  const value = argv[index];
  if (!value || value.startsWith("--")) throw new Error(`${flag} requires a value`);
  return value;
}

async function main() {
  const input = parseArgs(process.argv.slice(2));
  const buffer = await readFile(input.input);
  const { gltf, bin } = decodeGlb(buffer);
  const nodeIndexByName = new Map((gltf.nodes ?? []).map((node, index) => [node.name, index]));
  const humanBones = {};
  for (const [boneName, nodeName] of Object.entries(ROBOT_VOXEL_HUMANOID)) {
    const node = nodeIndexByName.get(nodeName);
    if (node === undefined) throw new Error(`preset ${input.preset} node not found: ${boneName} -> ${nodeName}`);
    humanBones[boneName] = { node };
  }
  gltf.extensions ??= {};
  gltf.extensions.VRMC_vrm_animation = {
    specVersion: input.specVersion,
    humanoid: { humanBones },
    extras: {
      generator: basename(new URL(import.meta.url).pathname),
      source: relative(repoRoot, input.input),
      preset: input.preset,
    },
  };
  gltf.extensionsUsed = unique([...(gltf.extensionsUsed ?? []), "VRMC_vrm_animation"]);
  const output = encodeGlb(gltf, bin);
  await writeFile(input.out, output);
  console.log(`Wrote ${relative(repoRoot, input.out)} (${Object.keys(humanBones).length} human bones)`);
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

function encodeGlb(gltf, bin) {
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

function padBuffer(buffer, padValue) {
  const padding = (4 - (buffer.length % 4)) % 4;
  if (padding === 0) return buffer;
  return Buffer.concat([buffer, Buffer.alloc(padding, padValue)]);
}

function unique(values) {
  return [...new Set(values)];
}

const ROBOT_VOXEL_HUMANOID = {
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
