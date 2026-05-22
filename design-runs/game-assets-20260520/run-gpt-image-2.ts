#!/usr/bin/env node
/**
 * Dogfood driver for the gpt-image-2 game-asset pipeline.
 *
 * The OpenAI request/response/cost arithmetic lives in
 * `@mizchi/vlmkit-ai/image-gen-client.ts` so other parts of vlmkit
 * (CLI workflows, markup tools) can reuse the same plumbing.
 */
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { basename, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  createImageGenClient,
  resolveImageGenModel,
  type ImageGenQuality,
  type ImageGenRequest,
  type ImageGenSize,
} from "@mizchi/vlmkit-ai/image-gen-client.ts";

const here = fileURLToPath(new URL(".", import.meta.url));
const defaultManifestPath = join(here, "stages.json");
const defaultOutDir = join(here, "outputs");

interface CliArgs {
  list: boolean;
  stage: string;
  run: boolean;
  model: string | undefined;
  quality: ImageGenQuality | undefined;
  size: ImageGenSize | undefined;
  n: number;
  outDir: string;
  manifestPath: string;
}

interface Stage {
  id: string;
  title?: string;
  size?: ImageGenSize;
  quality?: ImageGenQuality;
  prompt: string[];
  checks?: string[];
}

interface Manifest {
  model: string;
  stages: Stage[];
}

function usage(): void {
  console.log(`Usage:
  node design-runs/game-assets-20260520/run-gpt-image-2.ts [options]

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

function requiredValue(argv: string[], index: number, flag: string): string {
  const value = argv[index];
  if (!value || value.startsWith("--")) throw new Error(`${flag} requires a value`);
  return value;
}

function parsePositiveInt(value: string, flag: string): number {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) throw new Error(`${flag} must be a positive integer`);
  return parsed;
}

function parseArgs(argv: string[]): CliArgs {
  const args: CliArgs = {
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
    else if (arg === "--quality") args.quality = requiredValue(argv, ++i, "--quality") as ImageGenQuality;
    else if (arg === "--size") args.size = requiredValue(argv, ++i, "--size") as ImageGenSize;
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

async function loadManifest(path: string): Promise<Manifest> {
  const raw = await readFile(path, "utf8");
  const manifest = JSON.parse(raw) as Manifest;
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

function selectStages(manifest: Manifest, selected: string): Stage[] {
  if (selected === "all") return manifest.stages;
  const stage = manifest.stages.find((item) => item.id === selected);
  if (!stage) {
    const available = manifest.stages.map((item) => item.id).join(", ");
    throw new Error(`Unknown stage: ${selected}. Available: ${available}`);
  }
  return [stage];
}

function buildPrompt(stage: Stage): string {
  return stage.prompt.join("\n");
}

function printStage(stage: Stage, options: CliArgs, model: string): void {
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

async function generateStage(stage: Stage, options: CliArgs, modelId: string): Promise<{ files: string[]; metadataPath: string; metadata: Record<string, unknown> }> {
  const model = resolveImageGenModel(modelId);
  const client = createImageGenClient(model);
  const quality = options.quality ?? stage.quality ?? "medium";
  const size = options.size ?? stage.size ?? "1024x1024";
  const request: ImageGenRequest = {
    prompt: buildPrompt(stage),
    quality,
    size,
    n: options.n,
    outputFormat: "png",
    background: "opaque",
  };
  const response = await client.generate(request);
  await mkdir(options.outDir, { recursive: true });
  const files: string[] = [];
  for (let i = 0; i < response.images.length; i++) {
    const suffix = response.images.length > 1 ? `-${i + 1}` : "";
    const file = join(options.outDir, `${stage.id}${suffix}.png`);
    await writeFile(file, response.images[i]);
    files.push(file);
  }
  const metadata = {
    stage: stage.id,
    model: response.model,
    quality,
    size,
    n: options.n,
    prompt: request.prompt,
    checks: stage.checks ?? [],
    usage: response.usage,
    estimatedCostUsd: response.costUsd,
    latencyMs: response.latencyMs,
    outputFiles: files.map((file) => basename(file)),
    createdAt: new Date().toISOString(),
  };
  const metadataPath = join(options.outDir, `${stage.id}.metadata.json`);
  await writeFile(metadataPath, `${JSON.stringify(metadata, null, 2)}\n`);
  return { files, metadataPath, metadata };
}

async function main(): Promise<void> {
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
    if (typeof result.metadata.estimatedCostUsd === "number") {
      console.log(`Estimated stage cost from returned usage: $${result.metadata.estimatedCostUsd}`);
    }
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
