#!/usr/bin/env node
import { readFile, writeFile } from "node:fs/promises";
import { relative, resolve } from "node:path";
import { decodeGlb, verifyMotionIr } from "./game-asset-motion-core.mjs";

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
  const verification = verifyMotionIr(motion, {
    modelNodeNames: modelNodes,
    requiredTargets: args.requiredTargets,
  });
  const result = {
    ok: verification.ok,
    motion: relative(repoRoot, args.motion),
    model: args.model ? relative(repoRoot, args.model) : null,
    clipSummaries: verification.clipSummaries,
    failures: verification.failures,
    warnings: verification.warnings,
  };
  await writeFile(args.out, `${JSON.stringify(result, null, 2)}\n`);
  console.log(`${verification.ok ? "OK" : "FAIL"} ${relative(repoRoot, args.out)}`);
  if (!verification.ok) process.exit(1);
}

async function readGlbNodeNames(path) {
  const buffer = await readFile(path);
  const { gltf } = decodeGlb(buffer);
  return new Set((gltf.nodes ?? []).map((node) => node.name));
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
