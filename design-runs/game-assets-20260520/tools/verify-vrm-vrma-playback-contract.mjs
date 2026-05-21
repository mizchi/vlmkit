#!/usr/bin/env node
import { readFile, writeFile } from "node:fs/promises";
import { dirname, join, relative, resolve } from "node:path";
import { evaluateVrmVrmaPlaybackContract } from "./vrm-vrma-playback-contract-utils.mjs";

const repoRoot = resolve(new URL("../../..", import.meta.url).pathname);

function parseArgs(argv) {
  const args = {
    vrm: "",
    vrma: "",
    motion: "",
    renderVerify: "",
    out: "",
    requiredBones: ["hips", "head"],
    requiredClips: [],
    allowNonVrmTarget: false,
  };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === "--vrm") args.vrm = resolve(required(argv, ++i, arg));
    else if (arg === "--vrma") args.vrma = resolve(required(argv, ++i, arg));
    else if (arg === "--motion") args.motion = resolve(required(argv, ++i, arg));
    else if (arg === "--render-verify") args.renderVerify = resolve(required(argv, ++i, arg));
    else if (arg === "--out") args.out = resolve(required(argv, ++i, arg));
    else if (arg === "--required-bones") args.requiredBones = csv(required(argv, ++i, arg));
    else if (arg === "--required-clips") args.requiredClips = csv(required(argv, ++i, arg));
    else if (arg === "--allow-non-vrm-target") args.allowNonVrmTarget = true;
    else if (arg === "--help" || arg === "-h") {
      console.log(`Usage:
  node design-runs/game-assets-20260520/tools/verify-vrm-vrma-playback-contract.mjs --vrm <model.vrm|model.glb> --vrma <motion.vrma> --motion <motion.json> [options]

Options:
  --vrm <path>                 Target VRM model, or GLB with --allow-non-vrm-target
  --vrma <path>                VRMA source file
  --motion <path>              Extracted Motion IR from extract-gltf-motion-ir.mjs
  --render-verify <path>       Optional render verification JSON for the playback/retarget output
  --required-bones <csv>       Required humanoid bones (default: hips,head)
  --required-clips <csv>       Required clip ids
  --allow-non-vrm-target       Allow fixture GLB targets without VRMC_vrm humanoid metadata
  --out <path>                 Verification report JSON
`);
      process.exit(0);
    } else {
      throw new Error(`Unknown argument: ${arg}`);
    }
  }
  if (!args.vrm) throw new Error("--vrm is required");
  if (!args.vrma) throw new Error("--vrma is required");
  if (!args.motion) throw new Error("--motion is required");
  if (!args.out) args.out = join(dirname(args.motion), "vrm-vrma-playback-contract.verify.json");
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
  const vrmGltf = decodeGlb(await readFile(args.vrm)).gltf;
  const vrmaGltf = decodeGlb(await readFile(args.vrma)).gltf;
  const motion = JSON.parse(await readFile(args.motion, "utf8"));
  const renderVerify = args.renderVerify ? JSON.parse(await readFile(args.renderVerify, "utf8")) : null;
  const evaluation = evaluateVrmVrmaPlaybackContract({
    vrmGltf,
    vrmaGltf,
    motion,
    renderVerify,
    requiredBones: args.requiredBones,
    requiredClips: args.requiredClips,
    allowNonVrmTarget: args.allowNonVrmTarget,
  });
  const report = {
    version: 1,
    kind: "vrm-vrma-playback-contract-verification",
    ok: evaluation.ok,
    inputs: {
      vrm: relative(repoRoot, args.vrm),
      vrma: relative(repoRoot, args.vrma),
      motion: relative(repoRoot, args.motion),
      renderVerify: args.renderVerify ? relative(repoRoot, args.renderVerify) : null,
    },
    policy: {
      requiredBones: args.requiredBones,
      requiredClips: args.requiredClips,
      allowNonVrmTarget: args.allowNonVrmTarget,
    },
    summary: evaluation.summary,
    checks: evaluation.checks,
  };
  await writeFile(args.out, `${JSON.stringify(report, null, 2)}\n`);
  console.log(`${report.ok ? "OK" : "FAIL"} ${relative(repoRoot, args.out)} (${report.summary.checkCount} check(s))`);
  if (!report.ok) process.exit(1);
}

function decodeGlb(buffer) {
  if (buffer.readUInt32LE(0) !== 0x46546c67) throw new Error("invalid GLB magic");
  if (buffer.readUInt32LE(4) !== 2) throw new Error("unsupported GLB version");
  const totalLength = buffer.readUInt32LE(8);
  if (totalLength !== buffer.length) throw new Error(`GLB length mismatch: header=${totalLength} actual=${buffer.length}`);
  let offset = 12;
  let gltf = null;
  while (offset < buffer.length) {
    const chunkLength = buffer.readUInt32LE(offset);
    const chunkType = buffer.readUInt32LE(offset + 4);
    const chunk = buffer.subarray(offset + 8, offset + 8 + chunkLength);
    if (chunkType === 0x4e4f534a) gltf = JSON.parse(chunk.toString("utf8"));
    offset += 8 + chunkLength;
  }
  if (!gltf) throw new Error("missing JSON chunk");
  return { gltf };
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});

