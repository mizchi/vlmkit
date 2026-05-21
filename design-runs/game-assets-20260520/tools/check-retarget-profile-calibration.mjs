#!/usr/bin/env node
import { readFile, writeFile } from "node:fs/promises";
import { relative, resolve } from "node:path";
import {
  evaluateRetargetCalibrationCases,
  summarizeRetargetCalibration,
} from "./retarget-profile-calibration-utils.mjs";

const repoRoot = resolve(new URL("../../..", import.meta.url).pathname);

function parseArgs(argv) {
  const args = {
    fixture: resolve(repoRoot, "design-runs/game-assets-20260520/motions/retarget-profile-calibration.json"),
    out: "",
  };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === "--fixture") args.fixture = resolve(required(argv, ++i, arg));
    else if (arg === "--out") args.out = resolve(required(argv, ++i, arg));
    else if (arg === "--help" || arg === "-h") {
      console.log(`Usage:
  node design-runs/game-assets-20260520/tools/check-retarget-profile-calibration.mjs [options]

Options:
  --fixture <path>   Retarget profile calibration fixture
  --out <path>       Optional verification report JSON
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

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const fixture = JSON.parse(await readFile(args.fixture, "utf8"));
  const cases = evaluateRetargetCalibrationCases(fixture);
  const summary = summarizeRetargetCalibration(cases);
  const ok = summary.failed === 0;
  const report = {
    version: 1,
    kind: "retarget-profile-calibration-verification",
    ok,
    input: relative(repoRoot, args.fixture),
    summary,
    cases,
  };
  if (args.out) await writeFile(args.out, `${JSON.stringify(report, null, 2)}\n`);
  console.log(`${ok ? "OK" : "FAIL"} ${relative(repoRoot, args.fixture)} (${summary.caseCount} case(s))`);
  if (!ok) process.exit(1);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});

