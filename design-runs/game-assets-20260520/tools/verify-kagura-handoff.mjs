#!/usr/bin/env node
import { readFile, stat, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, relative, resolve } from "node:path";

const repoRoot = resolve(new URL("../../..", import.meta.url).pathname);

function parseArgs(argv) {
  const args = {
    contract: "",
    out: "",
  };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === "--contract") args.contract = resolve(required(argv, ++i, arg));
    else if (arg === "--out") args.out = resolve(required(argv, ++i, arg));
    else if (arg === "--help" || arg === "-h") {
      console.log(`Usage:
  node design-runs/game-assets-20260520/tools/verify-kagura-handoff.mjs --contract <path> [options]

Options:
  --contract <path>   Kagura handoff JSON contract
  --out <path>        Optional JSON smoke report path
`);
      process.exit(0);
    } else {
      throw new Error(`Unknown argument: ${arg}`);
    }
  }
  if (!args.contract) throw new Error("--contract is required");
  if (!args.out) args.out = args.contract.replace(/\.json$/, ".kagura-smoke.json");
  return args;
}

function required(argv, index, flag) {
  const value = argv[index];
  if (!value || value.startsWith("--")) throw new Error(`${flag} requires a value`);
  return value;
}

export async function verifyKaguraHandoff(options) {
  const contractPath = resolve(options.contract);
  const outPath = options.out ? resolve(options.out) : contractPath.replace(/\.json$/, ".kagura-smoke.json");
  const contract = JSON.parse(await readFile(contractPath, "utf8"));
  const contractDir = dirname(contractPath);
  const failures = [];
  const warnings = [];
  const checks = [];
  const handoff = contract.kaguraHandoff;

  addCheck(checks, "engine", contract.engine === "mizchi/kagura", "contract.engine must be mizchi/kagura", failures);
  requireObject(handoff, "kaguraHandoff", failures);

  if (handoff && typeof handoff === "object" && !Array.isArray(handoff)) {
    addCheck(checks, "runtime-format", handoff.runtimeFormat === "glb", "kaguraHandoff.runtimeFormat must be glb", failures);
    requireType(handoff.modelPath, "string", "kaguraHandoff.modelPath", failures);
    requirePositiveNumber(handoff.worldScale, "kaguraHandoff.worldScale", failures);
    requireObject(handoff.origin, "kaguraHandoff.origin", failures);
    requireObject(handoff.axes, "kaguraHandoff.axes", failures);
    requireArray(handoff.fixedCameraViews, "kaguraHandoff.fixedCameraViews", failures);
    requireArray(handoff.animationClips, "kaguraHandoff.animationClips", failures);
    requireType(handoff.snapshotVerification, "string", "kaguraHandoff.snapshotVerification", failures);

    if (typeof handoff.modelPath === "string") {
      addCheck(
        checks,
        "model-path-matches-primary",
        handoff.modelPath === contract.asset?.primaryModel,
        "kaguraHandoff.modelPath should match asset.primaryModel for the primary smoke",
        failures,
      );
      addCheck(
        checks,
        "model-path-glb",
        handoff.modelPath.endsWith(".glb"),
        "kaguraHandoff.modelPath must point to a GLB",
        failures,
      );
      await requireLocalFile(contractDir, handoff.modelPath, "kaguraHandoff.modelPath", failures);
    }

    if (handoff.origin && typeof handoff.origin === "object" && !Array.isArray(handoff.origin)) {
      addCheck(
        checks,
        "origin-policy",
        handoff.origin.policy === contract.asset?.originPolicy,
        "kaguraHandoff.origin.policy must match asset.originPolicy",
        failures,
      );
      requireFiniteTuple(handoff.origin.translation, 3, "kaguraHandoff.origin.translation", failures);
    }

    if (handoff.axes && typeof handoff.axes === "object" && !Array.isArray(handoff.axes)) {
      addCheck(checks, "up-axis", isAxis(handoff.axes.up), "kaguraHandoff.axes.up must be an axis such as +Y", failures);
      addCheck(checks, "front-axis", isAxis(handoff.axes.front), "kaguraHandoff.axes.front must be an axis such as +Z", failures);
      if (isAxis(handoff.axes.up) && isAxis(handoff.axes.front) && sameAxis(handoff.axes.up, handoff.axes.front)) {
        failures.push({ path: "kaguraHandoff.axes", reason: "up and front axes must not use the same axis" });
      }
    }

    if (Array.isArray(handoff.fixedCameraViews)) {
      addCheck(
        checks,
        "fixed-camera-views-present",
        handoff.fixedCameraViews.length > 0,
        "kaguraHandoff.fixedCameraViews must not be empty",
        failures,
      );
      const contractViews = new Set(contract.renderChecks?.views ?? []);
      for (const view of handoff.fixedCameraViews) {
        if (!contractViews.has(view)) {
          failures.push({ path: "kaguraHandoff.fixedCameraViews", reason: `view is not in renderChecks.views: ${view}` });
        }
      }
    }

    if (Array.isArray(handoff.animationClips)) {
      const requiredClips = (contract.motionContract?.clips ?? []).map((clip) => clip.id).filter(Boolean);
      for (const clip of requiredClips) {
        if (!handoff.animationClips.includes(clip)) {
          failures.push({ path: "kaguraHandoff.animationClips", reason: `missing motionContract clip: ${clip}` });
        }
      }
      if (!contract.motionContract && handoff.animationClips.length === 0) {
        warnings.push({ path: "kaguraHandoff.animationClips", reason: "static asset handoff has no animation clips" });
      }
    }

    if (typeof handoff.modelPath === "string") {
      const glbPath = resolve(contractDir, handoff.modelPath);
      try {
        const glb = await readFile(glbPath);
        const summary = inspectGlb(glb);
        for (const clip of handoff.animationClips ?? []) {
          if (!summary.animationClips.includes(clip)) {
            failures.push({ path: "kaguraHandoff.animationClips", reason: `clip missing from GLB: ${clip}` });
          }
        }
        checks.push({
          id: "glb-inspect",
          status: "pass",
          nodeCount: summary.nodeCount,
          meshCount: summary.meshCount,
          animationClips: summary.animationClips,
        });
      } catch (error) {
        failures.push({ path: "kaguraHandoff.modelPath", reason: error instanceof Error ? error.message : String(error) });
      }
    }

    if (typeof handoff.snapshotVerification === "string") {
      const snapshotPath = resolve(contractDir, handoff.snapshotVerification);
      await requireLocalFile(contractDir, handoff.snapshotVerification, "kaguraHandoff.snapshotVerification", failures);
      try {
        const snapshot = JSON.parse(await readFile(snapshotPath, "utf8"));
        if (snapshot.ok !== true) {
          failures.push({ path: "kaguraHandoff.snapshotVerification", reason: "snapshot verification is not ok" });
        }
        const frameFiles = (snapshot.frames ?? []).map((frame) => frame.file).filter(Boolean);
        for (const view of handoff.fixedCameraViews ?? []) {
          if (!frameFiles.some((file) => framePathHasView(file, view))) {
            failures.push({ path: "kaguraHandoff.fixedCameraViews", reason: `no verified snapshot for view: ${view}` });
          }
        }
        checks.push({
          id: "snapshot-verification",
          status: snapshot.ok === true ? "pass" : "fail",
          checkedFrameCount: snapshot.checkedFrameCount ?? frameFiles.length,
        });
      } catch (error) {
        failures.push({ path: "kaguraHandoff.snapshotVerification", reason: error instanceof Error ? error.message : String(error) });
      }
    }
  }

  const result = {
    ok: failures.length === 0,
    contract: relative(repoRoot, contractPath),
    assetId: contract.asset?.id ?? null,
    runtime: handoff
      ? {
          format: handoff.runtimeFormat ?? null,
          model: handoff.modelPath ?? null,
          worldScale: handoff.worldScale ?? null,
          originPolicy: handoff.origin?.policy ?? null,
          axes: handoff.axes ?? null,
          fixedCameraViews: handoff.fixedCameraViews ?? [],
          animationClips: handoff.animationClips ?? [],
        }
      : null,
    checks,
    warnings,
    failures,
  };
  await writeFile(outPath, `${JSON.stringify(result, null, 2)}\n`);
  return { result, outPath };
}

function addCheck(checks, id, ok, failureReason, failures) {
  checks.push({ id, status: ok ? "pass" : "fail" });
  if (!ok) failures.push({ path: id, reason: failureReason });
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

function requirePositiveNumber(value, path, failures) {
  if (typeof value !== "number" || !Number.isFinite(value) || value <= 0) {
    failures.push({ path, reason: "expected positive finite number" });
  }
}

function requireFiniteTuple(value, length, path, failures) {
  if (!Array.isArray(value) || value.length !== length || !value.every(Number.isFinite)) {
    failures.push({ path, reason: `expected ${length} finite numbers` });
  }
}

async function requireLocalFile(baseDir, value, path, failures) {
  if (typeof value !== "string") return;
  const file = resolve(baseDir, value);
  try {
    const st = await stat(file);
    if (!st.isFile()) failures.push({ path, reason: `not a file: ${value}` });
  } catch {
    failures.push({ path, reason: `missing file: ${value}` });
  }
}

function isAxis(value) {
  return typeof value === "string" && /^[+-][XYZ]$/.test(value);
}

function sameAxis(a, b) {
  return a.slice(1) === b.slice(1);
}

function framePathHasView(file, view) {
  return new RegExp(`-${escapeRegExp(view)}(?:-|\\.)`).test(file);
}

function escapeRegExp(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function inspectGlb(buffer) {
  if (buffer.readUInt32LE(0) !== 0x46546c67) throw new Error("invalid GLB magic");
  if (buffer.readUInt32LE(4) !== 2) throw new Error("unsupported GLB version");
  const totalLength = buffer.readUInt32LE(8);
  if (totalLength !== buffer.length) throw new Error(`GLB length mismatch: header=${totalLength} actual=${buffer.length}`);
  let offset = 12;
  let json = null;
  while (offset < buffer.length) {
    const chunkLength = buffer.readUInt32LE(offset);
    const chunkType = buffer.readUInt32LE(offset + 4);
    const chunk = buffer.subarray(offset + 8, offset + 8 + chunkLength);
    if (chunkType === 0x4e4f534a) json = JSON.parse(chunk.toString("utf8"));
    offset += 8 + chunkLength;
  }
  if (!json) throw new Error("missing JSON chunk");
  return {
    nodeCount: json.nodes?.length ?? 0,
    meshCount: json.meshes?.length ?? 0,
    animationClips: (json.animations ?? []).map((animation) => animation.name).filter(Boolean),
  };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const { result, outPath } = await verifyKaguraHandoff(args);
  console.log(`${result.ok ? "OK" : "FAIL"} ${relative(repoRoot, outPath)}`);
  if (!result.ok) process.exit(1);
}

if (fileURLToPath(import.meta.url) === resolve(process.argv[1] ?? "")) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  });
}
