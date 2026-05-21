#!/usr/bin/env node
import { mkdir, writeFile } from "node:fs/promises";
import { dirname, relative, resolve } from "node:path";
import {
  createRuntimeBatchSummary,
  defaultRuntimeSmokeReportPath,
  defaultRuntimeSmokeSummaryPath,
  nextRuntimeSmokePort,
} from "./kagura-runtime-batch-utils.mjs";
import {
  classifyRuntimeOutcome,
  shouldFailProcess,
} from "./kagura-runtime-smoke-utils.mjs";
import { runKaguraRuntimeSmoke } from "./run-kagura-runtime-smoke.mjs";

const repoRoot = resolve(new URL("../../..", import.meta.url).pathname);
const defaultKaguraRepo = resolve(repoRoot, "..", "kagura");

const defaultContracts = [
  "design-runs/game-assets-20260520/models/goblin-club-blockout/kagura-handoff.json",
  "design-runs/game-assets-20260520/models/goblin-voxel/kagura-handoff.json",
  "design-runs/game-assets-20260520/models/robot-voxel-motion/kagura-handoff.json",
];

function parseArgs(argv) {
  const args = {
    contracts: [],
    calibrationContract: "",
    kaguraRepo: process.env.KAGURA_REPO ? resolve(process.env.KAGURA_REPO) : defaultKaguraRepo,
    port: 8765,
    timeoutMs: 90_000,
    minChangedPixelRatio: 0.01,
    minVisiblePixelRatio: 0.03,
    allowEnvironmentFailure: false,
    summaryOut: "",
  };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === "--") continue;
    else if (arg === "--contract") args.contracts.push(resolve(required(argv, ++i, arg)));
    else if (arg === "--calibration-contract") args.calibrationContract = resolve(required(argv, ++i, arg));
    else if (arg === "--kagura-repo") args.kaguraRepo = resolve(required(argv, ++i, arg));
    else if (arg === "--port") args.port = Number(required(argv, ++i, arg));
    else if (arg === "--timeout-ms") args.timeoutMs = Number(required(argv, ++i, arg));
    else if (arg === "--min-changed-pixel-ratio") args.minChangedPixelRatio = Number(required(argv, ++i, arg));
    else if (arg === "--min-visible-pixel-ratio") args.minVisiblePixelRatio = Number(required(argv, ++i, arg));
    else if (arg === "--summary-out") args.summaryOut = resolve(required(argv, ++i, arg));
    else if (arg === "--allow-environment-failure") args.allowEnvironmentFailure = true;
    else if (arg === "--help" || arg === "-h") {
      console.log(`Usage:
  node design-runs/game-assets-20260520/tools/check-kagura-runtime-smokes.mjs [options]

Options:
  --contract <path>                  Contract to run, repeatable. Defaults to all local handoffs.
  --calibration-contract <path>      Optional known-good Kagura handoff contract for every target.
  --kagura-repo <path>               Local mizchi/kagura repo (default: sibling ghq checkout)
  --port <n>                         First Kagura dev server port (default: 8765)
  --timeout-ms <n>                   Startup/browser timeout per target (default: 90000)
  --min-changed-pixel-ratio <n>      Minimum non-flat canvas ratio (default: 0.01)
  --min-visible-pixel-ratio <n>      Minimum non-dark canvas ratio (default: 0.03)
  --summary-out <path>               Batch summary path (default: generated next to models)
  --allow-environment-failure        Exit 0 when target and calibration both fail
`);
      process.exit(0);
    } else {
      throw new Error(`Unknown argument: ${arg}`);
    }
  }
  if (args.contracts.length === 0) {
    args.contracts = defaultContracts.map((path) => resolve(repoRoot, path));
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
  const results = [];
  for (const [index, contract] of args.contracts.entries()) {
    const port = nextRuntimeSmokePort(args.port, index);
    const report = await runTargetWithCalibration({ ...args, contract, port });
    results.push(report);
    await writeReport(defaultRuntimeSmokeReportPath(contract), report);
    console.log(`${report.outcome.status.toUpperCase()} ${relative(repoRoot, contract)}`);
  }
  const summary = createRuntimeBatchSummary(results);
  const summaryOut = args.summaryOut || defaultRuntimeSmokeSummaryPath(args.contracts[0]);
  await writeReport(summaryOut, summary);
  console.log(
    `kagura runtime smoke: ${summary.passed}/${summary.total} passed ` +
      `(environment-failed=${summary.counts["environment-failed"]}, ` +
      `asset-failed=${summary.counts["asset-failed"]}, target-failed=${summary.counts["target-failed"]})`,
  );
  console.log(`summary: ${relative(repoRoot, summaryOut)}`);
  if (results.some((report) => shouldFailProcess(report.outcome, args))) process.exit(1);
}

async function runTargetWithCalibration(args) {
  const report = await runKaguraRuntimeSmoke(args);
  let calibrationOk = null;
  if (args.calibrationContract) {
    const calibration = await runKaguraRuntimeSmoke({
      ...args,
      contract: args.calibrationContract,
      out: "",
      screenshot: "",
      calibrationContract: "",
      port: args.port + 1,
    });
    calibrationOk = calibration.ok;
    report.calibration = {
      ok: calibration.ok,
      contract: calibration.contract,
      assetId: calibration.assetId,
      checks: calibration.checks,
      warnings: calibration.warnings,
      failures: calibration.failures,
    };
  }
  report.outcome = classifyRuntimeOutcome({ targetOk: report.ok, calibrationOk });
  report.environmentLikelyBroken = report.outcome.environmentLikelyBroken;
  report.assetLikelyBroken = report.outcome.assetLikelyBroken;
  return report;
}

async function writeReport(outPath, report) {
  await mkdir(dirname(outPath), { recursive: true });
  await writeFile(outPath, `${JSON.stringify(report, null, 2)}\n`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
