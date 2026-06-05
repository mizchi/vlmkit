#!/usr/bin/env node
/**
 * VLM-driven region diff helper.
 *
 * Takes a baseline PNG + variant PNG (or a single triptych: baseline |
 * variant | heatmap), sends both via OpenRouter to a VLM with a strict
 * JSON prompt, and emits measured region differences plus downstream
 * CHANGE records. With `--elements-json`, it can join VLM bboxes to DOM
 * element rects and attach a concrete selector candidate. Property,
 * measured colors, bbox, and delta are structured so a coding agent
 * (or the operator) can target gradients, image sources, or sub-color
 * literals that computedStyleDiff misses.
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
import { readPngDimensions, resizePngBuffer } from "@mizchi/vlmkit-core/image-resize.ts";
import {
  captureRegionElementsFromHtml,
  matchRegionBboxToElement,
  parseRegionElementsJson,
  parseRegionElementsViewport,
  resolveRegionElementsTargetUrl,
  type RegionElementRect,
  type RegionElementsViewport,
  type RegionSelectorMatch,
  type RegionSelectorMatchEvidence,
} from "@mizchi/vlmkit-markup/region-selector-match.ts";
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
  selectorHint?: string | null;
  propertyHint?: RegionChangeProperty | null;
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

type RegionChangeProperty =
  | "background-color"
  | "background"
  | "color"
  | "border-color"
  | "outline-color"
  | "fill"
  | "box-shadow";

interface RegionStructuredChange {
  type: "CHANGE";
  source: "vlm-region-diff";
  selector: string | null;
  selectorHint: string;
  selectorConfidence?: "high" | "medium" | "low";
  property: RegionChangeProperty;
  from: string | null;
  to: string | null;
  delta: {
    kind: "color";
    averageChannelDelta: number | null;
  };
  bbox: RegionBbox | null;
  region: string;
  description: string;
  confidence: "high" | "medium" | "low";
  evidence: {
    colorSample?: RegionColorSample;
    selectorMatch?: RegionSelectorMatchEvidence;
  };
}

interface BuildStructuredRegionChangesOptions {
  elements?: RegionElementRect[];
}

type RegionDiffOutputMode = "triptych" | "split";

interface RegionDiffOutput extends VlmReviewResult {
  model: string;
  mode: RegionDiffOutputMode;
  usage: unknown | null;
  changes: RegionStructuredChange[];
  rawContent?: string;
}

interface RunRegionDiffAnalysisOptions {
  baseline: string;
  variant: string;
  elements?: RegionElementRect[];
  model?: string;
  maxTokens?: number;
  apiKey?: string;
}

interface CliArgs {
  baseline: string | null;
  variant: string | null;
  triptych: string | null;
  elementsJson: string | null;
  elementsHtml: string | null;
  elementsViewport: RegionElementsViewport | null;
  model: string;
  out: string | null;
  format: "json" | "markdown";
  maxTokens: number;
  maxImageEdge: number;
  dryRun: boolean;
}

function parseArgs(argv: string[]): CliArgs {
  const args: CliArgs = {
    baseline: null,
    variant: null,
    triptych: null,
    elementsJson: null,
    elementsHtml: null,
    elementsViewport: null,
    model: DEFAULT_REGION_DIFF_MODEL,
    out: null,
    format: "json",
    maxTokens: DEFAULT_REGION_DIFF_MAX_TOKENS,
    maxImageEdge: DEFAULT_REGION_DIFF_MAX_IMAGE_EDGE,
    dryRun: false,
  };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === "--baseline") args.baseline = resolve(argv[++i] ?? "");
    else if (arg === "--variant") args.variant = resolve(argv[++i] ?? "");
    else if (arg === "--triptych") args.triptych = resolve(argv[++i] ?? "");
    else if (arg === "--elements-json") args.elementsJson = resolve(argv[++i] ?? "");
    else if (arg === "--elements-html") args.elementsHtml = argv[++i] ?? "";
    else if (arg === "--elements-viewport") args.elementsViewport = parseRegionElementsViewport(argv[++i] ?? "");
    else if (arg === "--model") args.model = argv[++i] ?? args.model;
    else if (arg === "--out") args.out = resolve(argv[++i] ?? "");
    else if (arg === "--format") {
      const value = argv[++i] ?? "json";
      if (value !== "json" && value !== "markdown") {
        throw new Error(`--format must be json|markdown, got ${value}`);
      }
      args.format = value;
    }
    else if (arg === "--max-tokens") {
      args.maxTokens = Number.parseInt(argv[++i] ?? "", 10) || DEFAULT_REGION_DIFF_MAX_TOKENS;
    }
    else if (arg === "--max-image-edge") {
      args.maxImageEdge = Number.parseInt(argv[++i] ?? "", 10) || DEFAULT_REGION_DIFF_MAX_IMAGE_EDGE;
    }
    else if (arg === "--dry-run") args.dryRun = true;
    else if (arg === "--help" || arg === "-h") {
      console.log(`Usage:
  vlmkit diff region --baseline <png> --variant <png> [--model id]
  vlmkit diff region --triptych <png> [--model id]

Options:
  --baseline <path>   Baseline (target) PNG
  --variant  <path>   Variant (current) PNG
  --triptych <path>   Single PNG: [baseline | variant | heatmap]
  --elements-json <path>
                      Optional DOM bbox JSON for the variant screenshot;
                      accepts an array or { "elements": [...] } where each
                      row has path/tag/classes/top/left/width/height
  --elements-html <path-or-url>
                      Capture DOM bbox JSON from the variant/current HTML or URL.
                      Ignored when --elements-json is supplied.
  --elements-viewport <size>
                      Viewport for --elements-html, e.g. 1280x900.
                      Defaults to the variant PNG dimensions in split mode.
  --model    <id>     OpenRouter VLM model (default: anthropic/claude-haiku-4-5;
                      see docs/reports/2026-05-23-vlm-region-diff-bakeoff.md)
  --out      <path>   Write result to this file (default: stdout)
  --format <kind>     json|markdown (default: json)
  --max-tokens <n>    OpenRouter max_tokens (default: 1500; auto-retries
                      once with doubled tokens when the response is
                      truncated)
  --max-image-edge <px>
                      Downscale images so no edge exceeds this before the
                      VLM call (default: 7500; Anthropic rejects >8000px).
                      Region bboxes are mapped back to original pixels.
  --dry-run           Build the request but skip the API call
`);
      process.exit(0);
    }
  }
  return args;
}

const DEFAULT_REGION_DIFF_MODEL = "anthropic/claude-haiku-4-5";

// Anthropic rejects images with any edge above 8000px; full-page mobile
// captures routinely exceed that. Keep a safety margin below the limit.
const DEFAULT_REGION_DIFF_MAX_IMAGE_EDGE = 7500;

/**
 * Common downscale factor so every image fits within maxEdge on both
 * axes. A single factor is used for all images so VLM bbox coordinates
 * stay consistent across baseline and variant.
 */
function computeRegionImageScale(
  dims: Array<{ width: number; height: number }>,
  maxEdge: number = DEFAULT_REGION_DIFF_MAX_IMAGE_EDGE,
): number {
  let maxDim = 0;
  for (const d of dims) maxDim = Math.max(maxDim, d.width, d.height);
  return maxDim > maxEdge ? maxEdge / maxDim : 1;
}

/** Map VLM bboxes from downscaled image coordinates back to original pixels. */
function scaleRegionBboxesToOriginal(
  result: VlmReviewResult,
  imageScale: number,
): VlmReviewResult {
  if (imageScale === 1) return result;
  const inverse = 1 / imageScale;
  return {
    ...result,
    regions: result.regions.map((region) => region.bbox
      ? {
          ...region,
          bbox: {
            left: Math.round(region.bbox.left * inverse),
            top: Math.round(region.bbox.top * inverse),
            width: Math.round(region.bbox.width * inverse),
            height: Math.round(region.bbox.height * inverse),
          },
        }
      : region),
  };
}

// Region lists on a busy page easily exceed the old 600-token default,
// which silently degraded the verdict to `uncertain` via truncated JSON.
const DEFAULT_REGION_DIFF_MAX_TOKENS = 1500;

/**
 * Detect a truncated VLM response: the provider says `length`, or the
 * content contains an opening brace but never parses (mid-JSON cut)
 * while no finish reason is available.
 */
function isTruncatedRegionDiffResponse(
  content: string,
  finishReason: string | undefined,
): boolean {
  if (finishReason === "length") return true;
  if (finishReason != null) return false;
  if (!content.includes("{")) return false;
  const stripped = content.replace(/^[\s\S]*?({[\s\S]*})[\s\S]*$/, "$1");
  try {
    JSON.parse(stripped);
    return false;
  } catch {
    return true;
  }
}

async function callRegionDiffWithTruncationRetry(
  body: Record<string, unknown>,
  apiKey: string,
  maxTokens: number,
): Promise<{ data: Awaited<ReturnType<typeof callOpenRouterRegionDiff>>; content: string }> {
  let data = await callOpenRouterRegionDiff(body, apiKey);
  let content = data.choices?.[0]?.message?.content ?? "";
  const finishReason = data.choices?.[0]?.finish_reason;
  if (isTruncatedRegionDiffResponse(content, finishReason)) {
    const retryTokens = maxTokens * 2;
    console.error(
      `vlm-region-diff: response truncated (finish_reason=${finishReason ?? "unknown"}); retrying once with max_tokens=${retryTokens}`,
    );
    data = await callOpenRouterRegionDiff({ ...body, max_tokens: retryTokens }, apiKey);
    content = data.choices?.[0]?.message?.content ?? "";
  }
  return { data, content };
}

function downscaleForVlm(buffer: Buffer, scale: number): Buffer {
  if (scale >= 1) return buffer;
  const { width, height } = readPngDimensions(buffer);
  return resizePngBuffer(buffer, {
    resolution: {
      maxWidth: Math.max(1, Math.round(width * scale)),
      maxHeight: Math.max(1, Math.round(height * scale)),
    },
  });
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
    { "region": "<short descriptor of the area>", "selectorHint": "<semantic selector or null>", "propertyHint": "background-color" | "background" | "color" | "border-color" | "outline-color" | "fill" | "box-shadow" | null, "bbox": { "left": 0, "top": 0, "width": 100, "height": 50 }, "baselineColor": "<hex or rgb()>", "variantColor": "<hex or rgb()>", "description": "<one sentence>" }
  ],
  "summary": "<one-sentence overall judgement>"
}

Rules:
- Only list regions with clearly visible color differences (>5% RGB delta).
- Include selectorHint when the screenshot gives an obvious semantic target, but use null rather than inventing a real CSS selector.
- Include propertyHint when the changed visual property is obvious.
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

interface RegionDiffRequest {
  body: Record<string, unknown>;
  /** Factor the images were downscaled by before the VLM call (1 = untouched). */
  imageScale: number;
}

async function buildRegionDiffRequest(args: CliArgs): Promise<RegionDiffRequest> {
  const userContent: Array<Record<string, unknown>> = [
    { type: "text", text: buildPrompt(args) },
  ];
  let imageScale = 1;
  if (args.triptych) {
    const data = await readFile(args.triptych);
    imageScale = computeRegionImageScale([readPngDimensions(data)], args.maxImageEdge);
    userContent.push({
      type: "image_url",
      image_url: { url: `data:image/png;base64,${downscaleForVlm(data, imageScale).toString("base64")}` },
    });
  } else {
    const [base, variant] = await Promise.all([
      readFile(args.baseline!),
      readFile(args.variant!),
    ]);
    imageScale = computeRegionImageScale(
      [readPngDimensions(base), readPngDimensions(variant)],
      args.maxImageEdge,
    );
    userContent.push({ type: "text", text: "Baseline:" });
    userContent.push({
      type: "image_url",
      image_url: { url: `data:image/png;base64,${downscaleForVlm(base, imageScale).toString("base64")}` },
    });
    userContent.push({ type: "text", text: "Variant:" });
    userContent.push({
      type: "image_url",
      image_url: { url: `data:image/png;base64,${downscaleForVlm(variant, imageScale).toString("base64")}` },
    });
  }
  if (imageScale < 1) {
    console.error(
      `vlm-region-diff: downscaled image(s) by x${imageScale.toFixed(3)} to fit --max-image-edge ${args.maxImageEdge}; bboxes are mapped back to original pixels`,
    );
  }
  return {
    body: {
      model: args.model,
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: userContent },
      ],
      temperature: 0,
      max_tokens: args.maxTokens,
    },
    imageScale,
  };
}

async function buildRequestBody(args: CliArgs): Promise<Record<string, unknown>> {
  return (await buildRegionDiffRequest(args)).body;
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
      selectorHint: typeof r.selectorHint === "string" ? r.selectorHint : null,
      propertyHint: parseRegionChangeProperty(r.propertyHint),
      bbox: parseRegionBbox(r.bbox),
      baselineColor: typeof r.baselineColor === "string" ? r.baselineColor : null,
      variantColor: typeof r.variantColor === "string" ? r.variantColor : null,
      description: typeof r.description === "string" ? r.description : "",
    });
  }
  const summary = typeof obj.summary === "string" ? obj.summary : "";
  return { verdict, regions, summary };
}

function parseRegionChangeProperty(value: unknown): RegionChangeProperty | null {
  if (typeof value !== "string") return null;
  switch (value) {
    case "background-color":
    case "background":
    case "color":
    case "border-color":
    case "outline-color":
    case "fill":
    case "box-shadow":
      return value;
    default:
      return null;
  }
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

function buildStructuredRegionChanges(
  result: VlmReviewResult,
  options: BuildStructuredRegionChangesOptions = {},
): RegionStructuredChange[] {
  if (result.verdict === "no-diff") return [];
  return result.regions.map((region): RegionStructuredChange => {
    const averageDelta = region.colorSample?.averageChannelDelta
      ?? computeAverageDeltaFromColorStrings(region.baselineColor, region.variantColor);
    const selectorMatch = region.bbox && options.elements
      ? matchRegionBboxToElement(region.bbox, options.elements)
      : null;
    const evidence: RegionStructuredChange["evidence"] = {};
    if (region.colorSample) evidence.colorSample = region.colorSample;
    if (selectorMatch) evidence.selectorMatch = selectorMatch.evidence;
    return {
      type: "CHANGE",
      source: "vlm-region-diff",
      selector: selectorMatch?.selector ?? null,
      selectorHint: region.selectorHint ?? region.region,
      ...(selectorMatch ? { selectorConfidence: selectorMatch.confidence } : {}),
      property: region.propertyHint ?? inferRegionChangeProperty(region),
      from: region.baselineColor,
      to: region.variantColor,
      delta: {
        kind: "color",
        averageChannelDelta: averageDelta,
      },
      bbox: region.bbox,
      region: region.region,
      description: region.description,
      confidence: inferRegionChangeConfidence(region, averageDelta),
      evidence,
    };
  });
}

function inferRegionChangeProperty(region: RegionDiff): RegionChangeProperty {
  const text = `${region.region} ${region.description}`.toLowerCase();
  if (/\b(text|label|copy|glyph|font|type)\b/.test(text)) return "color";
  if (/\b(border|stroke|divider|rule)\b/.test(text)) return "border-color";
  if (/\boutline|focus-ring|focus ring\b/.test(text)) return "outline-color";
  if (/\b(icon|svg|fill)\b/.test(text)) return "fill";
  if (/\bshadow\b/.test(text)) return "box-shadow";
  if (/\bgradient|image\b/.test(text)) return "background";
  return "background-color";
}

function inferRegionChangeConfidence(
  region: RegionDiff,
  averageDelta: number | null,
): RegionStructuredChange["confidence"] {
  if (region.bbox && region.colorSample && (averageDelta ?? 0) >= 5) return "high";
  if (region.bbox && region.baselineColor && region.variantColor) return "medium";
  return "low";
}

function computeAverageDeltaFromColorStrings(
  baselineColor: string | null,
  variantColor: string | null,
): number | null {
  const baseline = parseColorString(baselineColor);
  const variant = parseColorString(variantColor);
  if (!baseline || !variant) return null;
  return averageChannelDelta(baseline, variant);
}

function parseColorString(value: string | null): [number, number, number] | null {
  if (!value) return null;
  const hex = value.trim().match(/^#([0-9a-f]{3}|[0-9a-f]{6})$/i);
  if (hex) {
    const raw = hex[1]!;
    const full = raw.length === 3
      ? raw.split("").map((char) => char + char).join("")
      : raw;
    return [
      Number.parseInt(full.slice(0, 2), 16),
      Number.parseInt(full.slice(2, 4), 16),
      Number.parseInt(full.slice(4, 6), 16),
    ];
  }
  const rgb = value.trim().match(/^rgb\(\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)\s*\)$/i);
  if (!rgb) return null;
  return [
    clampRgb(Number.parseFloat(rgb[1]!)),
    clampRgb(Number.parseFloat(rgb[2]!)),
    clampRgb(Number.parseFloat(rgb[3]!)),
  ];
}

function clampRgb(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(255, Math.round(value)));
}

async function resolveRegionElementsForArgs(
  args: CliArgs,
  variantPng: PNG | null,
): Promise<RegionElementRect[] | undefined> {
  if (args.triptych) return undefined;
  if (args.elementsJson) {
    return parseRegionElementsJson(await readFile(args.elementsJson, "utf-8"));
  }
  if (!args.elementsHtml) return undefined;
  const viewport = args.elementsViewport ?? (
    variantPng ? { width: variantPng.width, height: variantPng.height } : null
  );
  if (!viewport) {
    throw new Error("--elements-html requires --elements-viewport when variant PNG dimensions are unavailable");
  }
  return captureRegionElementsFromHtml(args.elementsHtml, viewport);
}

async function runRegionDiffAnalysis(
  options: RunRegionDiffAnalysisOptions,
): Promise<RegionDiffOutput> {
  const model = options.model ?? DEFAULT_REGION_DIFF_MODEL;
  const args: CliArgs = {
    baseline: resolve(options.baseline),
    variant: resolve(options.variant),
    triptych: null,
    elementsJson: null,
    elementsHtml: null,
    elementsViewport: null,
    model,
    out: null,
    format: "json",
    maxTokens: options.maxTokens ?? DEFAULT_REGION_DIFF_MAX_TOKENS,
    maxImageEdge: DEFAULT_REGION_DIFF_MAX_IMAGE_EDGE,
    dryRun: false,
  };
  const { body, imageScale } = await buildRegionDiffRequest(args);
  const apiKey = options.apiKey ?? process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    throw new Error("OPENROUTER_API_KEY is required for region diff analysis");
  }
  const { data, content } = await callRegionDiffWithTruncationRetry(body, apiKey, args.maxTokens);
  const [baselinePng, variantPng] = await Promise.all([
    readPng(args.baseline!),
    readPng(args.variant!),
  ]);
  const parsed = enrichRegionColorsWithBboxSamples(
    scaleRegionBboxesToOriginal(parseVlmResponse(content), imageScale),
    baselinePng,
    variantPng,
  );
  return {
    model,
    mode: "split",
    usage: data.usage ?? null,
    ...parsed,
    changes: buildStructuredRegionChanges(parsed, { elements: options.elements }),
    rawContent: content,
  };
}

async function callOpenRouterRegionDiff(
  body: Record<string, unknown>,
  apiKey: string,
): Promise<{
  choices?: Array<{ message?: { content?: string }; finish_reason?: string }>;
  usage?: { total_tokens?: number; cost?: number; prompt_tokens?: number; completion_tokens?: number };
}> {
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
  return await response.json() as {
    choices?: Array<{ message?: { content?: string }; finish_reason?: string }>;
    usage?: { total_tokens?: number; cost?: number; prompt_tokens?: number; completion_tokens?: number };
  };
}

function formatRegionDiffMarkdown(result: RegionDiffOutput): string {
  const lines: string[] = [];
  lines.push("# VLM region diff");
  lines.push("");
  lines.push(`Model: \`${result.model}\``);
  lines.push(`Mode: \`${result.mode}\``);
  lines.push(`Verdict: \`${result.verdict}\``);
  if (result.summary) lines.push(`Summary: ${result.summary}`);
  lines.push("");
  if (result.changes.length === 0) {
    lines.push("No structured region changes.");
    return lines.join("\n") + "\n";
  }

  lines.push("| Selector | Property | From | To | Delta | Bbox | Confidence | Evidence |");
  lines.push("|---|---|---|---|---:|---|---|---|");
  for (const change of result.changes) {
    lines.push([
      codeCell(change.selector ?? change.selectorHint),
      codeCell(change.property),
      codeCell(change.from),
      codeCell(change.to),
      formatDelta(change.delta.averageChannelDelta),
      codeCell(formatBbox(change.bbox)),
      escapeMarkdownCell(`${change.confidence}${change.selectorConfidence ? ` / ${change.selectorConfidence}` : ""}`),
      escapeMarkdownCell(formatSelectorEvidence(change.evidence.selectorMatch)),
    ].join(" | ").replace(/^/, "| ").replace(/$/, " |"));
  }
  lines.push("");
  for (const change of result.changes) {
    if (!change.description) continue;
    const selector = change.selector ?? change.selectorHint;
    lines.push(`- ${codeCell(selector)} ${codeCell(change.property)}: ${change.description}`);
  }
  return lines.join("\n") + "\n";
}

function codeCell(value: string | null): string {
  return value ? `\`${escapeBackticks(value)}\`` : "-";
}

function escapeBackticks(value: string): string {
  return value.replace(/`/g, "\\`");
}

function escapeMarkdownCell(value: string): string {
  return value.replace(/\|/g, "\\|");
}

function formatDelta(value: number | null): string {
  return value === null ? "-" : String(value);
}

function formatBbox(bbox: RegionBbox | null): string | null {
  if (!bbox) return null;
  return `${bbox.left},${bbox.top} ${bbox.width}x${bbox.height}`;
}

function formatSelectorEvidence(evidence: RegionSelectorMatchEvidence | undefined): string {
  if (!evidence) return "-";
  return [
    codeCell(evidence.tag),
    codeCell(evidence.path),
    `score=${evidence.score}`,
    `coverage=${evidence.regionCoverage}`,
  ].join(" ");
}

export {
  DEFAULT_REGION_DIFF_MODEL,
  buildStructuredRegionChanges,
  computeRegionImageScale,
  isTruncatedRegionDiffResponse,
  scaleRegionBboxesToOriginal,
  enrichRegionColorsWithBboxSamples,
  formatRegionDiffMarkdown,
  parseRegionElementsJson,
  parseRegionElementsViewport,
  parseVlmResponse,
  resolveRegionElementsTargetUrl,
  runRegionDiffAnalysis,
  buildPrompt,
  buildRequestBody,
  type RegionDiff,
  type RegionBbox,
  type RegionColorSample,
  type RegionElementRect,
  type RegionElementsViewport,
  type RegionDiffOutput,
  type RegionStructuredChange,
  type RunRegionDiffAnalysisOptions,
  type VlmReviewResult,
};

async function main(argv = process.argv.slice(2)): Promise<void> {
  const args = parseArgs(argv);
  ensureArgs(args);
  const { body, imageScale } = await buildRegionDiffRequest(args);
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
  const { data, content } = await callRegionDiffWithTruncationRetry(body, apiKey, args.maxTokens);
  let parsed = scaleRegionBboxesToOriginal(parseVlmResponse(content), imageScale);
  let variantPng: PNG | null = null;
  if (!args.triptych && args.baseline && args.variant) {
    const [baselinePng, loadedVariantPng] = await Promise.all([
      readPng(args.baseline),
      readPng(args.variant),
    ]);
    variantPng = loadedVariantPng;
    parsed = enrichRegionColorsWithBboxSamples(parsed, baselinePng, variantPng);
  }
  const elements = await resolveRegionElementsForArgs(args, variantPng);
  const mode: RegionDiffOutputMode = args.triptych ? "triptych" : "split";
  const result: RegionDiffOutput = {
    model: args.model,
    mode,
    usage: data.usage ?? null,
    ...parsed,
    changes: buildStructuredRegionChanges(parsed, { elements }),
    rawContent: content,
  };
  const text = args.format === "markdown"
    ? formatRegionDiffMarkdown(result)
    : JSON.stringify(result, null, 2);
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
