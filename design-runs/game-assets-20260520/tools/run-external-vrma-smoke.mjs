#!/usr/bin/env node
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { spawn } from "node:child_process";
import { basename, dirname, join, relative, resolve } from "node:path";
import { retargetProfileNames } from "./retarget-profiles.mjs";

const repoRoot = resolve(new URL("../../..", import.meta.url).pathname);
const toolsDir = dirname(new URL(import.meta.url).pathname);
const defaultExternalDir = resolve(repoRoot, "design-runs/game-assets-20260520/external/vrma/tk256ailab");
const defaultModel = resolve(repoRoot, "design-runs/game-assets-20260520/models/robot-voxel-motion/robot-voxel-motion.glb");

function parseArgs(argv) {
  const args = {
    samples: ["LookAround"],
    externalDir: defaultExternalDir,
    model: defaultModel,
    view: "iso",
    mode: "material",
    renderTimes: "",
    rootTranslationMode: "relative",
    retargetProfile: "robot-voxel",
    minQuality: "warn",
    out: "",
    continueOnError: true,
    reviewVlm: false,
    reviewDryRun: false,
    reviewModels: "bytedance/ui-tars-1.5-7b,amazon/nova-lite-v1",
  };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === "--sample") args.samples = csv(required(argv, ++i, arg));
    else if (arg === "--samples") args.samples = csv(required(argv, ++i, arg));
    else if (arg === "--external-dir") args.externalDir = resolve(required(argv, ++i, arg));
    else if (arg === "--model") args.model = resolve(required(argv, ++i, arg));
    else if (arg === "--view") args.view = required(argv, ++i, arg);
    else if (arg === "--mode") args.mode = required(argv, ++i, arg);
    else if (arg === "--time") args.renderTimes = required(argv, ++i, arg);
    else if (arg === "--root-translation-mode") args.rootTranslationMode = required(argv, ++i, arg);
    else if (arg === "--retarget-profile") args.retargetProfile = required(argv, ++i, arg);
    else if (arg === "--min-quality") args.minQuality = required(argv, ++i, arg);
    else if (arg === "--out") args.out = resolve(required(argv, ++i, arg));
    else if (arg === "--fail-fast") args.continueOnError = false;
    else if (arg === "--review-vlm") args.reviewVlm = true;
    else if (arg === "--review-dry-run") args.reviewDryRun = true;
    else if (arg === "--review-models") args.reviewModels = required(argv, ++i, arg);
    else if (arg === "--help" || arg === "-h") {
      console.log(`Usage:
  node design-runs/game-assets-20260520/tools/run-external-vrma-smoke.mjs [options]

Options:
  --sample <csv>          Sample names from tk256ailab/vrm-viewer (default: LookAround)
  --samples <csv>         Alias for --sample
  --external-dir <path>   Ignored working directory
  --model <path>          Target GLB model for retargeting
  --view <name|all>       Render view (default: iso)
  --mode <name>           Render mode: material|geometry (default: material)
  --time <csv>            Render sample times; default is derived from motion duration
  --root-translation-mode <mode>
                          keep|relative|horizontal-only|zero|scale-to-model (default: relative)
  --retarget-profile <profile>
                          ${retargetProfileNames().join("|")} (default: robot-voxel)
  --min-quality <verdict>
                          Minimum accepted quality verdict: pass|warn|fail (default: warn)
  --out <path>            Smoke report path
  --fail-fast             Stop on first sample failure
  --review-vlm            Run optional VLM review after deterministic checks
  --review-dry-run        Build VLM prompt/contact sheet but skip API call
  --review-models <csv>   VLM reviewer model ids
`);
      process.exit(0);
    } else {
      throw new Error(`Unknown argument: ${arg}`);
    }
  }
  args.samples = args.samples.map(stripVrma).filter(Boolean);
  if (args.samples.length === 0) throw new Error("at least one sample is required");
  if (!["keep", "relative", "horizontal-only", "zero", "scale-to-model"].includes(args.rootTranslationMode)) {
    throw new Error("--root-translation-mode must be keep, relative, horizontal-only, zero, or scale-to-model");
  }
  if (!retargetProfileNames().includes(args.retargetProfile)) {
    throw new Error(`--retarget-profile must be one of: ${retargetProfileNames().join(", ")}`);
  }
  if (!["pass", "warn", "fail"].includes(args.minQuality)) {
    throw new Error("--min-quality must be pass, warn, or fail");
  }
  if (!args.out) args.out = join(args.externalDir, "smoke-report.json");
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

function stripVrma(value) {
  return value.replace(/\.vrma$/i, "");
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  await mkdir(args.externalDir, { recursive: true });
  const samples = [];
  for (const sample of args.samples) {
    const result = await runSample(args, sample);
    samples.push(result);
    if (!result.ok && !args.continueOnError) break;
  }
  const ok = samples.every((sample) => sample.ok);
  const report = {
    ok,
    generatedAt: new Date().toISOString(),
    model: relative(repoRoot, args.model),
    externalDir: relative(repoRoot, args.externalDir),
    rootTranslationMode: args.rootTranslationMode,
    retargetProfile: args.retargetProfile,
    minQuality: args.minQuality,
    samples,
  };
  await writeFile(args.out, `${JSON.stringify(report, null, 2)}\n`);
  console.log(`${ok ? "OK" : "FAIL"} ${relative(repoRoot, args.out)} (${samples.length} sample(s))`);
  if (!ok) process.exit(1);
}

async function runSample(args, sample) {
  const vrmaPath = join(args.externalDir, `${sample}.vrma`);
  const motionPath = join(args.externalDir, `${sample}.extracted.motion.json`);
  const motionVerifyPath = join(args.externalDir, `${sample}.extracted.motion.verify.json`);
  const roundtripPath = join(args.externalDir, `${sample}.robot-roundtrip.glb`);
  const normalizationAuditPath = join(args.externalDir, `${sample}.normalization-audit.json`);
  const glbVerifyPath = join(args.externalDir, `${sample}.robot-roundtrip.verify.json`);
  const renderDir = join(args.externalDir, "renders", sample);
  const renderVerifyPath = join(args.externalDir, `${sample}.robot-roundtrip.render-verify.json`);
  const qualityPath = join(args.externalDir, `${sample}.motion-quality.json`);
  const vlmReviewPath = join(args.externalDir, `${sample}.vlm-review.json`);
  const steps = [];
  let motion = null;
  let quality = null;
  let vlmReview = null;

  try {
    await runStep(steps, "fetch", ["node", script("fetch-external-vrma-sample.mjs"), "--sample", sample, "--out-dir", args.externalDir]);
    await runStep(steps, "extract", [
      "node", script("extract-gltf-motion-ir.mjs"),
      "--input", vrmaPath,
      "--source-kind", "external-vrma",
      "--target-space", "humanoid",
      "--retarget-preset", "robot-voxel",
      "--out", motionPath,
    ]);
    await runStep(steps, "verify-motion-ir", [
      "node", script("verify-motion-ir.mjs"),
      "--motion", motionPath,
      "--model", args.model,
      "--out", motionVerifyPath,
    ]);
    await runStep(steps, "apply-motion-ir", [
      "node", script("apply-motion-ir.mjs"),
      "--input", args.model,
      "--motion", motionPath,
      "--replace-existing",
      "--root-translation-mode", args.rootTranslationMode,
      "--audit-out", normalizationAuditPath,
      "--out", roundtripPath,
    ]);
    const normalizationAudit = JSON.parse(await readFile(normalizationAuditPath, "utf8"));
    await runStep(steps, "verify-gltf-motion", [
      "node", script("verify-gltf-motion.mjs"),
      "--input", roundtripPath,
      "--motion-ir", motionPath,
      "--out", glbVerifyPath,
    ]);
    motion = JSON.parse(await readFile(motionPath, "utf8"));
    const clipId = motion.clips[0]?.id ?? sample;
    const times = args.renderTimes || renderTimesForMotion(motion);
    await runStep(steps, "render-animation", [
      "node", script("render-animation.mjs"),
      "--input", roundtripPath,
      "--clip", clipId,
      "--view", args.view,
      "--time", times,
      "--mode", args.mode,
      "--out", renderDir,
    ]);
    await runStep(steps, "verify-renders", [
      "node", script("verify-renders.mjs"),
      "--dir", renderDir,
      "--out", renderVerifyPath,
    ]);
    await runStep(steps, "verify-motion-quality", [
      "node", script("verify-motion-quality.mjs"),
      "--renders-dir", renderDir,
      "--render-verify", renderVerifyPath,
      "--motion", motionPath,
      "--retarget-profile", args.retargetProfile,
      "--out", qualityPath,
    ]);
    quality = JSON.parse(await readFile(qualityPath, "utf8"));
    if (!meetsQuality(quality.verdict, args.minQuality)) {
      throw new Error(`quality verdict ${quality.verdict} is below required ${args.minQuality}`);
    }
    if (args.reviewVlm) {
      const reviewArgs = [
        "node", script("review-motion-with-vlm.mjs"),
        "--renders-dir", renderDir,
        "--quality", qualityPath,
        "--motion", motionPath,
        "--models", args.reviewModels,
        "--out", vlmReviewPath,
      ];
      if (args.reviewDryRun) reviewArgs.push("--dry-run");
      await runStep(steps, "review-motion-with-vlm", reviewArgs);
      vlmReview = JSON.parse(await readFile(vlmReviewPath, "utf8"));
    }
    return sampleSummary(sample, true, steps, {
      vrmaPath,
      motionPath,
      motionVerifyPath,
      roundtripPath,
      glbVerifyPath,
      renderDir,
      renderVerifyPath,
      qualityPath,
      vlmReviewPath,
      motion,
      quality,
      vlmReview,
      normalizationAudit,
      normalizationAuditPath,
    });
  } catch (error) {
    return sampleSummary(sample, false, steps, {
      vrmaPath,
      motionPath,
      motionVerifyPath,
      roundtripPath,
      glbVerifyPath,
      renderDir,
      renderVerifyPath,
      qualityPath,
      vlmReviewPath,
      error: error instanceof Error ? error.message : String(error),
      motion,
      quality,
      vlmReview,
      normalizationAuditPath,
    });
  }
}

function script(name) {
  return join(toolsDir, name);
}

function renderTimesForMotion(motion) {
  const duration = Number(motion.clips?.[0]?.durationSeconds ?? 1);
  if (!Number.isFinite(duration) || duration <= 0) return "0,0.25,0.5,0.75";
  const last = Math.max(0, duration - 0.033);
  return [0, duration * 0.33, duration * 0.66, last].map(timeLabel).join(",");
}

function timeLabel(value) {
  return String(Math.round(value * 1000) / 1000);
}

function meetsQuality(actual, minimum) {
  const rank = { fail: 0, warn: 1, pass: 2 };
  return rank[actual] >= rank[minimum];
}

async function runStep(steps, name, argv) {
  const startedAt = Date.now();
  const result = await exec(argv);
  const step = {
    name,
    ok: result.code === 0,
    command: argv.map((part) => part.includes(" ") ? JSON.stringify(part) : part).join(" "),
    latencyMs: Date.now() - startedAt,
    stdout: result.stdout.trim(),
    stderr: result.stderr.trim(),
  };
  steps.push(step);
  if (!step.ok) throw new Error(`${name} failed: ${step.stderr || step.stdout || `exit ${result.code}`}`);
  return step;
}

function exec(argv) {
  return new Promise((resolveExec) => {
    const child = spawn(argv[0], argv.slice(1), { cwd: repoRoot, stdio: ["ignore", "pipe", "pipe"] });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (chunk) => { stdout += chunk; });
    child.stderr.on("data", (chunk) => { stderr += chunk; });
    child.on("close", (code) => resolveExec({ code, stdout, stderr }));
  });
}

function sampleSummary(sample, ok, steps, data) {
  const motion = data.motion;
  const clip = motion?.clips?.[0] ?? null;
  const warnings = motion?.source?.warnings ?? [];
  return {
    sample,
    ok,
    clip: clip ? {
      id: clip.id,
      durationSeconds: clip.durationSeconds,
      loop: Boolean(clip.loop),
      trackCount: clip.tracks?.length ?? 0,
    } : null,
    retargetCount: motion?.retarget ? Object.keys(motion.retarget).length : 0,
    skippedChannelCount: motion?.source?.skippedChannelCount ?? warnings.length,
    normalization: summarizeNormalization(data.normalizationAudit),
    quality: summarizeQuality(data.quality),
    vlmReview: summarizeVlmReview(data.vlmReview),
    artifacts: {
      vrma: rel(data.vrmaPath),
      motion: rel(data.motionPath),
      motionVerify: rel(data.motionVerifyPath),
      roundtripModel: rel(data.roundtripPath),
      normalizationAudit: rel(data.normalizationAuditPath),
      glbVerify: rel(data.glbVerifyPath),
      renderDir: rel(data.renderDir),
      renderVerify: rel(data.renderVerifyPath),
      quality: rel(data.qualityPath),
      vlmReview: rel(data.vlmReviewPath),
    },
    steps,
    error: data.error ?? null,
  };
}

function summarizeNormalization(audit) {
  if (!audit) return null;
  const rootTranslations = (audit.clips ?? []).flatMap((clip) =>
    (clip.rootTranslations ?? []).map((item) => ({
      clip: clip.id,
      sourceTarget: item.sourceTarget,
      targetNode: item.targetNode,
      mode: item.mode,
      sourceInitialRootHeight: item.sourceInitialRootHeight,
      targetBaseRootHeight: item.targetBaseRootHeight,
      appliedScale: item.appliedScale,
      heightScale: item.heightScale,
      heightScaleDelta: item.heightScaleDelta,
      verticalDeltaRange: item.verticalDeltaRange,
      horizontalDeltaRange: item.horizontalDeltaRange,
      deltaRange: item.deltaRange,
      normalizedRange: item.normalizedRange,
      recommendation: item.recommendation,
    })),
  );
  return {
    rootTranslationMode: audit.rootTranslationMode,
    rootTranslations,
  };
}

function summarizeQuality(quality) {
  if (!quality) return null;
  const retainedCheck = (quality.checks ?? []).find((check) => check.id === "retained-channels") ?? null;
  return {
    verdict: quality.verdict,
    checks: (quality.checks ?? [])
      .filter((check) => check.verdict !== "pass")
      .map((check) => ({ id: check.id, verdict: check.verdict, value: check.value })),
    retarget: retainedCheck ? retainedCheck.value : null,
    metrics: {
      foregroundRatio: quality.metrics?.foregroundRatio ?? null,
      screenCoverageRatio: quality.metrics?.screenCoverageRatio ?? null,
      minGroundY: quality.metrics?.minGroundY ?? null,
      groundDeltaY: quality.metrics?.groundDeltaY ?? null,
      footContact: quality.metrics?.footContact ?? null,
      trackedNodeDisplacement: quality.metrics?.trackedNodeDisplacement ?? null,
      retainedChannelRatio: quality.metrics?.motion?.retainedChannelRatio ?? null,
      skippedByRegion: quality.metrics?.motion?.skippedByRegion ?? null,
    },
  };
}

function summarizeVlmReview(review) {
  if (!review) return null;
  return {
    status: review.status ?? null,
    consensusVerdict: review.consensus?.verdict ?? null,
    modelCount: Array.isArray(review.models) ? review.models.length : null,
  };
}

function rel(path) {
  return path ? relative(repoRoot, path) : null;
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
