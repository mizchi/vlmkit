#!/usr/bin/env node
import { relative, resolve } from "node:path";
import { verifyKaguraHandoff } from "./verify-kagura-handoff.mjs";

const repoRoot = resolve(new URL("../../..", import.meta.url).pathname);

const defaultContracts = [
  "design-runs/game-assets-20260520/models/goblin-club-blockout/kagura-handoff.json",
  "design-runs/game-assets-20260520/models/goblin-voxel/kagura-handoff.json",
  "design-runs/game-assets-20260520/models/robot-voxel-motion/kagura-handoff.json",
];

function parseArgs(argv) {
  const contracts = [];
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === "--contract") contracts.push(resolve(required(argv, ++i, arg)));
    else if (arg === "--help" || arg === "-h") {
      console.log(`Usage:
  node design-runs/game-assets-20260520/tools/check-kagura-handoffs.mjs [options]

Options:
  --contract <path>   Contract to verify, repeatable. Defaults to all local handoffs.
`);
      process.exit(0);
    } else {
      throw new Error(`Unknown argument: ${arg}`);
    }
  }
  return contracts.length > 0 ? contracts : defaultContracts.map((path) => resolve(repoRoot, path));
}

function required(argv, index, flag) {
  const value = argv[index];
  if (!value || value.startsWith("--")) throw new Error(`${flag} requires a value`);
  return value;
}

async function main() {
  const contracts = parseArgs(process.argv.slice(2));
  const results = [];
  for (const contract of contracts) {
    const { result, outPath } = await verifyKaguraHandoff({ contract });
    results.push({ result, outPath });
    console.log(`${result.ok ? "OK" : "FAIL"} ${relative(repoRoot, outPath)}`);
  }
  const failed = results.filter(({ result }) => !result.ok);
  console.log(`kagura handoff smoke: ${results.length - failed.length}/${results.length} passed`);
  if (failed.length > 0) process.exit(1);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
