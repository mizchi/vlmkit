#!/usr/bin/env node
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { basename, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = fileURLToPath(new URL(".", import.meta.url));
const defaultManifestPath = join(here, "stages.json");
const defaultOutDir = join(here, "outputs");

const RATES_PER_1M = {
  textInput: 5,
  imageInput: 8,
  imageOutput: 30,
};

function usage() {
  console.log(`Usage:
  node design-runs/game-assets-20260520/run-gpt-image-2.mjs [options]

Options:
  --list                    List stages
  --stage <id|all>          Stage to run or dry-run (default: all)
  --run                     Call the OpenAI API. Without this, prints a dry-run.
  --model <model>           Image model (default from stages.json)
  --quality <q>             Override quality: low|medium|high|auto
  --size <size>             Override size: 1024x1024|1024x1536|1536x1024|auto
  --n <count>               Images per stage (default: 1)
  --out <dir>               Output directory (default: outputs)
  --manifest <path>         Scenario manifest path
  --help                    Show this help
`);
}

function parseArgs(argv) {
  const args = {
    list: false,
    stage: "all",
    run: false,
    model: undefined,
    quality: undefined,
    size: undefined,
    n: 1,
    outDir: defaultOutDir,
    manifestPath: defaultManifestPath,
  };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === "--list") args.list = true;
    else if (arg === "--run") args.run = true;
    else if (arg === "--stage") args.stage = requiredValue(argv, ++i, "--stage");
    else if (arg === "--model") args.model = requiredValue(argv, ++i, "--model");
    else if (arg === "--quality") args.quality = requiredValue(argv, ++i, "--quality");
    else if (arg === "--size") args.size = requiredValue(argv, ++i, "--size");
    else if (arg === "--n") args.n = parsePositiveInt(requiredValue(argv, ++i, "--n"), "--n");
    else if (arg === "--out") args.outDir = resolve(requiredValue(argv, ++i, "--out"));
    else if (arg === "--manifest") args.manifestPath = resolve(requiredValue(argv, ++i, "--manifest"));
    else if (arg === "--help" || arg === "-h") {
      usage();
      process.exit(0);
    } else {
      throw new Error(`Unknown argument: ${arg}`);
    }
  }
  return args;
}

function requiredValue(argv, index, flag) {
  const value = argv[index];
  if (!value || value.startsWith("--")) throw new Error(`${flag} requires a value`);
  return value;
}

function parsePositiveInt(value, flag) {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) throw new Error(`${flag} must be a positive integer`);
  return parsed;
}

async function loadManifest(path) {
  const raw = await readFile(path, "utf8");
  const manifest = JSON.parse(raw);
  if (!manifest.model) throw new Error("manifest.model is required");
  if (!Array.isArray(manifest.stages) || manifest.stages.length === 0) {
    throw new Error("manifest.stages must be a non-empty array");
  }
  for (const stage of manifest.stages) {
    if (!stage.id) throw new Error("stage.id is required");
    if (!Array.isArray(stage.prompt) || stage.prompt.length === 0) {
      throw new Error(`stage ${stage.id} prompt must be a non-empty array`);
    }
  }
  return manifest;
}

function selectStages(manifest, selected) {
  if (selected === "all") return manifest.stages;
  const stage = manifest.stages.find((item) => item.id === selected);
  if (!stage) {
    const available = manifest.stages.map((item) => item.id).join(", ");
    throw new Error(`Unknown stage: ${selected}. Available: ${available}`);
  }
  return [stage];
}

function buildPrompt(stage) {
  return stage.prompt.join("\n");
}

function printStage(stage, options, model) {
  const quality = options.quality ?? stage.quality ?? "medium";
  const size = options.size ?? stage.size ?? "1024x1024";
  console.log(`\n## ${stage.id} - ${stage.title ?? stage.id}`);
  console.log(`model: ${model}`);
  console.log(`quality: ${quality}`);
  console.log(`size: ${size}`);
  console.log(`n: ${options.n}`);
  console.log("\nPrompt:\n");
  console.log(buildPrompt(stage));
  if (Array.isArray(stage.checks)) {
    console.log("\nChecks:");
    for (const check of stage.checks) console.log(`- ${check}`);
  }
}

async function generateStage(stage, options, model) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error("OPENAI_API_KEY is required when --run is set");
  const quality = options.quality ?? stage.quality ?? "medium";
  const size = options.size ?? stage.size ?? "1024x1024";
  const body = {
    model,
    prompt: buildPrompt(stage),
    quality,
    size,
    n: options.n,
    output_format: "png",
    background: "opaque",
  };
  const response = await fetch("https://api.openai.com/v1/images/generations", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
  const text = await response.text();
  let json;
  try {
    json = JSON.parse(text);
  } catch {
    json = { raw: text };
  }
  if (!response.ok) {
    const message = json?.error?.message ?? text;
    throw new Error(`OpenAI image generation failed for ${stage.id}: ${message}`);
  }
  await mkdir(options.outDir, { recursive: true });
  const files = [];
  const images = Array.isArray(json.data) ? json.data : [];
  for (let i = 0; i < images.length; i++) {
    const b64 = images[i]?.b64_json;
    if (!b64) continue;
    const suffix = images.length > 1 ? `-${i + 1}` : "";
    const file = join(options.outDir, `${stage.id}${suffix}.png`);
    await writeFile(file, Buffer.from(b64, "base64"));
    files.push(file);
  }
  const metadata = {
    stage: stage.id,
    model,
    quality,
    size,
    n: options.n,
    prompt: body.prompt,
    checks: stage.checks ?? [],
    usage: json.usage,
    estimatedCostUsd: estimateCost(json.usage),
    outputFiles: files.map((file) => basename(file)),
    createdAt: new Date().toISOString(),
  };
  const metadataPath = join(options.outDir, `${stage.id}.metadata.json`);
  await writeFile(metadataPath, `${JSON.stringify(metadata, null, 2)}\n`);
  return { files, metadataPath, metadata };
}

function estimateCost(usage) {
  if (!usage) return undefined;
  const textTokens = usage.input_tokens_details?.text_tokens ?? usage.input_text_tokens ?? 0;
  const imageTokens = usage.input_tokens_details?.image_tokens ?? 0;
  const outputTokens = usage.output_tokens ?? 0;
  const cost = (textTokens * RATES_PER_1M.textInput
    + imageTokens * RATES_PER_1M.imageInput
    + outputTokens * RATES_PER_1M.imageOutput) / 1_000_000;
  return Math.round(cost * 1_000_000) / 1_000_000;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const manifest = await loadManifest(args.manifestPath);
  const model = args.model ?? manifest.model;
  const stages = selectStages(manifest, args.list ? "all" : args.stage);

  if (args.list) {
    console.log(`Manifest: ${args.manifestPath}`);
    console.log(`Default model: ${model}`);
    for (const stage of stages) {
      console.log(`- ${stage.id}: ${stage.title ?? stage.id} (${stage.size ?? "auto"}, ${stage.quality ?? "medium"})`);
    }
    return;
  }

  if (!args.run) {
    console.log("DRY RUN. Add --run to call the OpenAI API.");
    for (const stage of stages) printStage(stage, args, model);
    return;
  }

  for (const stage of stages) {
    printStage(stage, args, model);
    const result = await generateStage(stage, args, model);
    console.log(`\nWrote ${result.files.length} image(s) and ${result.metadataPath}`);
    if (result.metadata.estimatedCostUsd !== undefined) {
      console.log(`Estimated stage cost from returned usage: $${result.metadata.estimatedCostUsd}`);
    }
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
