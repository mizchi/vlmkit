#!/usr/bin/env node
import { readFile, stat, writeFile } from "node:fs/promises";
import { dirname, join, relative, resolve } from "node:path";

const repoRoot = resolve(new URL("../../..", import.meta.url).pathname);
const entryDir = dirname(resolve(process.argv[1] ?? new URL(".", import.meta.url).pathname));

function parseArgs(argv) {
  const args = {
    contract: join(entryDir, "kagura-handoff.json"),
    out: "",
  };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === "--contract") args.contract = resolve(required(argv, ++i, arg));
    else if (arg === "--out") args.out = resolve(required(argv, ++i, arg));
    else if (arg === "--help" || arg === "-h") {
      console.log(`Usage:
  node design-runs/game-assets-20260520/tools/verify-asset-contract.mjs [options]

Options:
  --contract <path>   Asset handoff JSON (default: <entry-dir>/kagura-handoff.json)
  --out <path>        Optional JSON report path
`);
      process.exit(0);
    } else {
      throw new Error(`Unknown argument: ${arg}`);
    }
  }
  if (!args.out) args.out = args.contract.replace(/\.json$/, ".verify.json");
  return args;
}

function required(argv, index, flag) {
  const value = argv[index];
  if (!value || value.startsWith("--")) throw new Error(`${flag} requires a value`);
  return value;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const contract = JSON.parse(await readFile(args.contract, "utf8"));
  const contractDir = dirname(args.contract);
  const failures = [];
  requireType(contract.version, "number", "version", failures);
  requireType(contract.engine, "string", "engine", failures);
  requireObject(contract.asset, "asset", failures);
  requireType(contract.asset?.id, "string", "asset.id", failures);
  requireType(contract.asset?.kind, "string", "asset.kind", failures);
  requireType(contract.asset?.primaryModel, "string", "asset.primaryModel", failures);
  requireType(contract.asset?.originPolicy, "string", "asset.originPolicy", failures);
  requireType(contract.asset?.coordinateNotes, "string", "asset.coordinateNotes", failures);
  requireObject(contract.renderChecks, "renderChecks", failures);
  requireArray(contract.renderChecks?.views, "renderChecks.views", failures);
  requireObject(contract.styleContract, "styleContract", failures);
  requireType(contract.styleContract?.target, "string", "styleContract.target", failures);

  await requireLocalFile(contractDir, contract.asset?.primaryModel, "asset.primaryModel", failures);
  if (contract.asset?.debugModel) await requireLocalFile(contractDir, contract.asset.debugModel, "asset.debugModel", failures);
  if (contract.asset?.debugMaterial) await requireLocalFile(contractDir, contract.asset.debugMaterial, "asset.debugMaterial", failures);
  if (contract.renderChecks?.structureVerification) {
    await requireLocalFile(contractDir, contract.renderChecks.structureVerification, "renderChecks.structureVerification", failures);
  }
  if (contract.renderChecks?.renderVerification) {
    await requireLocalFile(contractDir, contract.renderChecks.renderVerification, "renderChecks.renderVerification", failures);
  }
  if (contract.asset?.derivedModels !== undefined) {
    requireArray(contract.asset.derivedModels, "asset.derivedModels", failures);
    for (const [index, derived] of (contract.asset.derivedModels ?? []).entries()) {
      requireType(derived.id, "string", `asset.derivedModels[${index}].id`, failures);
      requireType(derived.model, "string", `asset.derivedModels[${index}].model`, failures);
      await requireLocalFile(contractDir, derived.model, `asset.derivedModels[${index}].model`, failures);
      if (derived.sourceMotion) await requireLocalFile(contractDir, derived.sourceMotion, `asset.derivedModels[${index}].sourceMotion`, failures);
      if (derived.extractedMotion) await requireLocalFile(contractDir, derived.extractedMotion, `asset.derivedModels[${index}].extractedMotion`, failures);
      if (derived.extractedMotionVerification) {
        await requireLocalFile(contractDir, derived.extractedMotionVerification, `asset.derivedModels[${index}].extractedMotionVerification`, failures);
      }
      if (derived.roundtripModel) await requireLocalFile(contractDir, derived.roundtripModel, `asset.derivedModels[${index}].roundtripModel`, failures);
      if (derived.roundtripVerification) {
        await requireLocalFile(contractDir, derived.roundtripVerification, `asset.derivedModels[${index}].roundtripVerification`, failures);
      }
      if (derived.roundtripRenderVerification) {
        await requireLocalFile(contractDir, derived.roundtripRenderVerification, `asset.derivedModels[${index}].roundtripRenderVerification`, failures);
      }
      if (derived.vrmaFixture) await requireLocalFile(contractDir, derived.vrmaFixture, `asset.derivedModels[${index}].vrmaFixture`, failures);
      if (derived.vrmaFixtureExtractedMotion) {
        await requireLocalFile(contractDir, derived.vrmaFixtureExtractedMotion, `asset.derivedModels[${index}].vrmaFixtureExtractedMotion`, failures);
      }
      if (derived.vrmaFixtureExtractedMotionVerification) {
        await requireLocalFile(contractDir, derived.vrmaFixtureExtractedMotionVerification, `asset.derivedModels[${index}].vrmaFixtureExtractedMotionVerification`, failures);
      }
      if (derived.vrmaFixtureRoundtripModel) {
        await requireLocalFile(contractDir, derived.vrmaFixtureRoundtripModel, `asset.derivedModels[${index}].vrmaFixtureRoundtripModel`, failures);
      }
      if (derived.vrmaFixtureRoundtripVerification) {
        await requireLocalFile(contractDir, derived.vrmaFixtureRoundtripVerification, `asset.derivedModels[${index}].vrmaFixtureRoundtripVerification`, failures);
      }
      if (derived.vrmaFixtureRoundtripRenderVerification) {
        await requireLocalFile(contractDir, derived.vrmaFixtureRoundtripRenderVerification, `asset.derivedModels[${index}].vrmaFixtureRoundtripRenderVerification`, failures);
      }
      if (derived.structureVerification) {
        await requireLocalFile(contractDir, derived.structureVerification, `asset.derivedModels[${index}].structureVerification`, failures);
      }
      if (derived.renderVerification) {
        await requireLocalFile(contractDir, derived.renderVerification, `asset.derivedModels[${index}].renderVerification`, failures);
      }
      if (derived.clips !== undefined) requireArray(derived.clips, `asset.derivedModels[${index}].clips`, failures);
      if (derived.renderChecks !== undefined) {
        requireArray(derived.renderChecks.views, `asset.derivedModels[${index}].renderChecks.views`, failures);
        requireArray(derived.renderChecks.sampledClips, `asset.derivedModels[${index}].renderChecks.sampledClips`, failures);
      }
    }
  }

  if (contract.motionContract) {
    requireArray(contract.motionContract.requiredNodes, "motionContract.requiredNodes", failures);
    requireArray(contract.motionContract.clips, "motionContract.clips", failures);
    for (const [index, clip] of (contract.motionContract.clips ?? []).entries()) {
      requireType(clip.id, "string", `motionContract.clips[${index}].id`, failures);
      requireType(clip.durationSeconds, "number", `motionContract.clips[${index}].durationSeconds`, failures);
    }
    if (!contract.motionContract.metadataPolicy?.reservedExtras?.includes("pivot")) {
      failures.push({ path: "motionContract.metadataPolicy.reservedExtras", reason: "motion assets should reserve extras.pivot" });
    }
  }

  const ok = failures.length === 0;
  const result = {
    ok,
    contract: relative(repoRoot, args.contract),
    assetId: contract.asset?.id ?? null,
    failures,
  };
  await writeFile(args.out, `${JSON.stringify(result, null, 2)}\n`);
  console.log(`${ok ? "OK" : "FAIL"} ${relative(repoRoot, args.out)}`);
  if (!ok) process.exit(1);
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

async function requireLocalFile(baseDir, value, path, failures) {
  if (typeof value !== "string") return;
  if (/^https?:\/\//.test(value)) return;
  const file = resolve(baseDir, value);
  try {
    const st = await stat(file);
    if (!st.isFile()) failures.push({ path, reason: `not a file: ${value}` });
  } catch {
    failures.push({ path, reason: `missing file: ${value}` });
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
