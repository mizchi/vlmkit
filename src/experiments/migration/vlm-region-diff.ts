#!/usr/bin/env node
/**
 * VLM-driven region diff helper.
 *
 * Takes a baseline PNG + variant PNG (or a single triptych: baseline |
 * variant | heatmap), sends both via OpenRouter to a VLM with a strict
 * JSON prompt, and emits a list of {region, baselineColor, variantColor,
 * description} differences. The output is informational — the diff
 * loop's value-only fix pipeline can't act on sub-pixel rasterization
 * artifacts, but a coding agent (or the operator) can use the report to
 * target gradients, image sources, or sub-color literals that
 * computedStyleDiff misses.
 *
 * Usage:
 *   node src/experiments/migration/vlm-region-diff.ts \
 *     --baseline target.png --variant current.html.png \
 *     [--model anthropic/claude-haiku-4-5] [--out path] [--max-tokens 600]
 *
 *   # Triptych mode (baseline | variant | heatmap concatenated):
 *   node src/experiments/migration/vlm-region-diff.ts \
 *     --triptych ./diff/wide-triptych.png [--model ...]
 */
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { handleCliError } from "@mizchi/vlmkit-core/cli-error.ts";
import { PNG } from "pngjs";

interface RegionBbox {
  left: number;
  top: number;
  width: number;
  height: number;
}

interface RegionColorSample {
  source: "bbox-average";
  pixelCount: number;
  totalPixelCount: number;
  changedPixelCount: number;
  averageChannelDelta: number;
}

interface RegionDiff {
  region: string;
  bbox: RegionBbox | null;
  baselineColor: string | null;
  variantColor: string | null;
  description: string;
  colorSample?: RegionColorSample;
}

interface VlmReviewResult {
  verdict: "diff" | "no-diff" | "uncertain";
  regions: RegionDiff[];
  summary: string;
}

interface CliArgs {
  baseline: string | null;
  variant: string | null;
  triptych: string | null;
  model: string;
  out: string | null;
  maxTokens: number;
  dryRun: boolean;
}

function parseArgs(argv: string[]): CliArgs {
  const args: CliArgs = {
    baseline: null,
    variant: null,
    triptych: null,
    model: "anthropic/claude-haiku-4-5",
    out: null,
    maxTokens: 600,
    dryRun: false,
  };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === "--baseline") args.baseline = resolve(argv[++i] ?? "");
    else if (arg === "--variant") args.variant = resolve(argv[++i] ?? "");
    else if (arg === "--triptych") args.triptych = resolve(argv[++i] ?? "");
    else if (arg === "--model") args.model = argv[++i] ?? args.model;
    else if (arg === "--out") args.out = resolve(argv[++i] ?? "");
    else if (arg === "--max-tokens") args.maxTokens = Number.parseInt(argv[++i] ?? "600", 10) || 600;
    else if (arg === "--dry-run") args.dryRun = true;
    else if (arg === "--help" || arg === "-h") {
      console.log(`Usage:
  vlmkit diff region --baseline <png> --variant <png> [--model id]
  vlmkit diff region --triptych <png> [--model id]

Options:
  --baseline <path>   Baseline (target) PNG
  --variant  <path>   Variant (current) PNG
  --triptych <path>   Single PNG: [baseline | variant | heatmap]
  --model    <id>     OpenRouter VLM model (default: anthropic/claude-haiku-4-5;
                      see docs/reports/2026-05-23-vlm-region-diff-bakeoff.md)
  --out      <path>   Write JSON result to this file (default: stdout)
  --max-tokens <n>    OpenRouter max_tokens (default: 600)
  --dry-run           Build the request but skip the API call
`);
      process.exit(0);
    }
  }
  return args;
}

function ensureArgs(args: CliArgs): void {
  if (args.triptych) return;
  if (!args.baseline || !args.variant) {
    throw new Error("vlm-region-diff: either --triptych or both --baseline + --variant are required");
  }
}

const SYSTEM_PROMPT = `You are a visual regression analyst. The user shows you two rendered PNG screenshots: a baseline (target) and a variant (current). Identify regions whose visible color, gradient, or fill differs between the two.

Strict JSON output:
{
  "verdict": "diff" | "no-diff" | "uncertain",
  "regions": [
    { "region": "<short descriptor of the area>", "bbox": { "left": 0, "top": 0, "width": 100, "height": 50 }, "baselineColor": "<hex or rgb()>", "variantColor": "<hex or rgb()>", "description": "<one sentence>" }
  ],
  "summary": "<one-sentence overall judgement>"
}

Rules:
- Only list regions with clearly visible color differences (>5% RGB delta).
- When possible, include bbox in baseline/variant image pixel coordinates for the visible changed area.
- If you cannot localize a region to a bbox, set bbox to null.
- Use hex like \`#1234ab\` or \`rgb(18, 52, 171)\` when you can read a value off the pixels.
- If you cannot identify a precise color, set the field to null instead of guessing.
- Limit to the top 5 regions by perceptual impact.`;

function buildPrompt(args: CliArgs): string {
  return args.triptych
    ? "The single image below is a triptych — baseline (left) | variant (middle) | diff heatmap (right). Compare baseline and variant. Ignore the heatmap pixel intensity; use it only as a hint of where to look."
    : "The two images below are baseline (first) and variant (second). Compare them and list visible color/region differences.";
}

async function buildRequestBody(args: CliArgs): Promise<Record<string, unknown>> {
  const userContent: Array<Record<string, unknown>> = [
    { type: "text", text: buildPrompt(args) },
  ];
  if (args.triptych) {
    const data = await readFile(args.triptych);
    userContent.push({
      type: "image_url",
      image_url: { url: `data:image/png;base64,${data.toString("base64")}` },
    });
  } else {
    const [base, variant] = await Promise.all([
      readFile(args.baseline!),
      readFile(args.variant!),
    ]);
    userContent.push({ type: "text", text: "Baseline:" });
    userContent.push({
      type: "image_url",
      image_url: { url: `data:image/png;base64,${base.toString("base64")}` },
    });
    userContent.push({ type: "text", text: "Variant:" });
    userContent.push({
      type: "image_url",
      image_url: { url: `data:image/png;base64,${variant.toString("base64")}` },
    });
  }
  return {
    model: args.model,
    messages: [
      { role: "system", content: SYSTEM_PROMPT },
      { role: "user", content: userContent },
    ],
    temperature: 0,
    max_tokens: args.maxTokens,
  };
}

function parseVlmResponse(content: string): VlmReviewResult {
  // Strip code fences if present.
  const stripped = content.replace(/^[\s\S]*?({[\s\S]*})[\s\S]*$/, "$1");
  let parsed: unknown;
  try {
    parsed = JSON.parse(stripped);
  } catch {
    return { verdict: "uncertain", regions: [], summary: `parse error: ${content.slice(0, 200)}` };
  }
  if (!parsed || typeof parsed !== "object") {
    return { verdict: "uncertain", regions: [], summary: "non-object response" };
  }
  const obj = parsed as Record<string, unknown>;
  const verdictRaw = typeof obj.verdict === "string" ? obj.verdict : "uncertain";
  const verdict: "diff" | "no-diff" | "uncertain" =
    verdictRaw === "diff" || verdictRaw === "no-diff" ? verdictRaw : "uncertain";
  const regions: RegionDiff[] = [];
  for (const entry of Array.isArray(obj.regions) ? obj.regions : []) {
    if (!entry || typeof entry !== "object") continue;
    const r = entry as Record<string, unknown>;
    regions.push({
      region: typeof r.region === "string" ? r.region : "(unnamed)",
      bbox: parseRegionBbox(r.bbox),
      baselineColor: typeof r.baselineColor === "string" ? r.baselineColor : null,
      variantColor: typeof r.variantColor === "string" ? r.variantColor : null,
      description: typeof r.description === "string" ? r.description : "",
    });
  }
  const summary = typeof obj.summary === "string" ? obj.summary : "";
  return { verdict, regions, summary };
}

function parseRegionBbox(value: unknown): RegionBbox | null {
  if (!value) return null;
  let left: unknown;
  let top: unknown;
  let width: unknown;
  let height: unknown;
  if (Array.isArray(value)) {
    [left, top, width, height] = value;
  } else if (typeof value === "object") {
    const obj = value as Record<string, unknown>;
    left = obj.left ?? obj.x;
    top = obj.top ?? obj.y;
    width = obj.width ?? obj.w;
    height = obj.height ?? obj.h;
  } else {
    return null;
  }
  const bbox = {
    left: numberFromUnknown(left),
    top: numberFromUnknown(top),
    width: numberFromUnknown(width),
    height: numberFromUnknown(height),
  };
  if (
    bbox.left === null ||
    bbox.top === null ||
    bbox.width === null ||
    bbox.height === null ||
    bbox.width <= 0 ||
    bbox.height <= 0
  ) {
    return null;
  }
  return {
    left: bbox.left,
    top: bbox.top,
    width: bbox.width,
    height: bbox.height,
  };
}

function numberFromUnknown(value: unknown): number | null {
  const n = typeof value === "number"
    ? value
    : typeof value === "string"
      ? Number.parseFloat(value)
      : Number.NaN;
  return Number.isFinite(n) ? n : null;
}

interface BboxColorPairSample {
  baseline: { hex: string; rgb: [number, number, number] };
  variant: { hex: string; rgb: [number, number, number] };
  pixelCount: number;
  totalPixelCount: number;
  changedPixelCount: number;
  averageChannelDelta: number;
}

function sampleBboxColorPair(
  baselinePng: PNG,
  variantPng: PNG,
  bbox: RegionBbox,
): BboxColorPairSample | null {
  const baselineBounds = clampBboxToPng(baselinePng, bbox);
  const variantBounds = clampBboxToPng(variantPng, bbox);
  if (!baselineBounds || !variantBounds) return null;

  const left = Math.max(baselineBounds.left, variantBounds.left);
  const top = Math.max(baselineBounds.top, variantBounds.top);
  const right = Math.min(baselineBounds.right, variantBounds.right);
  const bottom = Math.min(baselineBounds.bottom, variantBounds.bottom);
  if (right <= left || bottom <= top) return null;

  const changed = makeAccumulator();
  const all = makeAccumulator();
  for (let y = top; y < bottom; y++) {
    for (let x = left; x < right; x++) {
      const baselinePixel = readOpaqueRgb(baselinePng, x, y);
      const variantPixel = readOpaqueRgb(variantPng, x, y);
      if (!baselinePixel || !variantPixel) continue;
      addPair(all, baselinePixel, variantPixel);
      if (averageChannelDelta(baselinePixel, variantPixel) > 1) {
        addPair(changed, baselinePixel, variantPixel);
      }
    }
  }
  if (all.count === 0) return null;

  const source = changed.count > 0 ? changed : all;
  const baselineRgb = averageRgb(source.baseline, source.count);
  const variantRgb = averageRgb(source.variant, source.count);
  return {
    baseline: { hex: rgbToHex(baselineRgb), rgb: baselineRgb },
    variant: { hex: rgbToHex(variantRgb), rgb: variantRgb },
    pixelCount: source.count,
    totalPixelCount: all.count,
    changedPixelCount: changed.count,
    averageChannelDelta: averageChannelDelta(baselineRgb, variantRgb),
  };
}

function clampBboxToPng(
  png: PNG,
  bbox: RegionBbox,
): { left: number; top: number; right: number; bottom: number } | null {
  const left = Math.max(0, Math.floor(bbox.left));
  const top = Math.max(0, Math.floor(bbox.top));
  const right = Math.min(png.width, Math.ceil(bbox.left + bbox.width));
  const bottom = Math.min(png.height, Math.ceil(bbox.top + bbox.height));
  if (right <= left || bottom <= top) return null;
  return { left, top, right, bottom };
}

function readOpaqueRgb(png: PNG, x: number, y: number): [number, number, number] | null {
  const i = (y * png.width + x) * 4;
  if ((png.data[i + 3] ?? 0) === 0) return null;
  return [png.data[i] ?? 0, png.data[i + 1] ?? 0, png.data[i + 2] ?? 0];
}

function makeAccumulator(): {
  baseline: [number, number, number];
  variant: [number, number, number];
  count: number;
} {
  return { baseline: [0, 0, 0], variant: [0, 0, 0], count: 0 };
}

function addPair(
  acc: ReturnType<typeof makeAccumulator>,
  baseline: [number, number, number],
  variant: [number, number, number],
): void {
  acc.baseline[0] += baseline[0];
  acc.baseline[1] += baseline[1];
  acc.baseline[2] += baseline[2];
  acc.variant[0] += variant[0];
  acc.variant[1] += variant[1];
  acc.variant[2] += variant[2];
  acc.count++;
}

function averageRgb(
  acc: [number, number, number],
  count: number,
): [number, number, number] {
  return [
    Math.round(acc[0] / count),
    Math.round(acc[1] / count),
    Math.round(acc[2] / count),
  ];
}

function rgbToHex([r, g, b]: [number, number, number]): string {
  return "#" + [r, g, b].map((c) =>
    Math.max(0, Math.min(255, c)).toString(16).padStart(2, "0")
  ).join("");
}

function averageChannelDelta(
  a: [number, number, number],
  b: [number, number, number],
): number {
  const delta = (Math.abs(a[0] - b[0]) + Math.abs(a[1] - b[1]) + Math.abs(a[2] - b[2])) / 3;
  return Number(delta.toFixed(2));
}

function enrichRegionColorsWithBboxSamples(
  result: VlmReviewResult,
  baselinePng: PNG,
  variantPng: PNG,
): VlmReviewResult {
  return {
    ...result,
    regions: result.regions.map((region) => {
      if (!region.bbox) return region;
      const sample = sampleBboxColorPair(baselinePng, variantPng, region.bbox);
      if (!sample) return region;
      return {
        ...region,
        baselineColor: sample.baseline.hex,
        variantColor: sample.variant.hex,
        colorSample: {
          source: "bbox-average",
          pixelCount: sample.pixelCount,
          totalPixelCount: sample.totalPixelCount,
          changedPixelCount: sample.changedPixelCount,
          averageChannelDelta: sample.averageChannelDelta,
        },
      };
    }),
  };
}

export {
  enrichRegionColorsWithBboxSamples,
  parseVlmResponse,
  buildPrompt,
  buildRequestBody,
  type RegionDiff,
  type RegionBbox,
  type RegionColorSample,
  type VlmReviewResult,
};

async function main(argv = process.argv.slice(2)): Promise<void> {
  const args = parseArgs(argv);
  ensureArgs(args);
  const body = await buildRequestBody(args);
  if (args.dryRun) {
    const payload = { dryRun: true, model: args.model, mode: args.triptych ? "triptych" : "split" };
    if (args.out) {
      const out = resolve(args.out);
      await mkdir(dirname(out), { recursive: true });
      await writeFile(out, JSON.stringify(payload, null, 2) + "\n");
    } else {
      process.stdout.write(JSON.stringify(payload, null, 2) + "\n");
    }
    return;
  }
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    throw new Error("OPENROUTER_API_KEY is required (or pass --dry-run to skip the call)");
  }
  const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
  if (!response.ok) {
    const text = await response.text();
    throw new Error(`OpenRouter ${response.status}: ${text.slice(0, 500)}`);
  }
  const data = await response.json() as {
    choices?: Array<{ message?: { content?: string } }>;
    usage?: { total_tokens?: number; cost?: number; prompt_tokens?: number; completion_tokens?: number };
  };
  const content = data.choices?.[0]?.message?.content ?? "";
  let parsed = parseVlmResponse(content);
  if (!args.triptych && args.baseline && args.variant) {
    const [baselinePng, variantPng] = await Promise.all([
      readPng(args.baseline),
      readPng(args.variant),
    ]);
    parsed = enrichRegionColorsWithBboxSamples(parsed, baselinePng, variantPng);
  }
  const result = {
    model: args.model,
    mode: args.triptych ? "triptych" : "split" as const,
    usage: data.usage ?? null,
    ...parsed,
    rawContent: content,
  };
  const text = JSON.stringify(result, null, 2);
  if (args.out) {
    const out = resolve(args.out);
    await mkdir(dirname(out), { recursive: true });
    await writeFile(out, text + "\n");
    console.error(`Wrote ${out}`);
  } else {
    process.stdout.write(text + "\n");
  }
}

async function readPng(path: string): Promise<PNG> {
  return PNG.sync.read(await readFile(path));
}

if (
  process.env.__VRT_DISPATCHER_LEAF__ === "vlm-region-diff"
  || process.argv[1]?.endsWith("vlm-region-diff.ts")
) {
  main().catch(handleCliError);
}
