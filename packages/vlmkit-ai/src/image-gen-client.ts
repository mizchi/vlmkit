/**
 * Image generation client (OpenAI gpt-image-2).
 *
 * Mirrors the vlm-client / llm-client split: a small registry of known
 * models, pure builders + parsers that can be unit-tested without a network
 * call, and a `createImageGenClient` factory that wires them to the actual
 * OpenAI Images API.
 *
 * Used by:
 * - `design-runs/game-assets-20260520/run-gpt-image-2.mjs` (dogfood driver)
 * - vlmkit-markup pipelines that need to synthesize reference imagery
 * - downstream callers in `src/cli/workflow/` (added separately)
 *
 * The OpenAI Images endpoint returns base64-encoded PNGs by default; we
 * surface them as `Uint8Array`. Reference-image inputs (edit mode via
 * `/v1/images/edits`) are intentionally out of scope here; add a separate
 * `editImage` method if/when a caller needs it.
 */
import { VrtConfigError } from "./errors.ts";

// ---- Types ----

export type ImageGenSize = "1024x1024" | "1024x1536" | "1536x1024" | "auto";
export type ImageGenQuality = "low" | "medium" | "high" | "auto";
export type ImageGenOutputFormat = "png" | "jpeg" | "webp";
export type ImageGenBackground = "opaque" | "transparent" | "auto";

export interface ImageGenModel {
  id: string;
  provider: "openai";
  /** USD per 1M tokens (matches OpenAI's published pricing table). */
  costPer1MInputTextTokens: number;
  costPer1MInputImageTokens: number;
  costPer1MOutputImageTokens: number;
}

export interface ImageGenRequest {
  prompt: string;
  size?: ImageGenSize;
  quality?: ImageGenQuality;
  n?: number;
  outputFormat?: ImageGenOutputFormat;
  background?: ImageGenBackground;
}

export interface ImageGenUsage {
  inputTextTokens: number;
  inputImageTokens: number;
  outputTokens: number;
}

export interface ImageGenResponse {
  model: string;
  images: Uint8Array[];
  usage: ImageGenUsage | null;
  costUsd: number;
  latencyMs: number;
}

export interface ImageGenRequestBody {
  model: string;
  prompt: string;
  size: ImageGenSize;
  quality: ImageGenQuality;
  n: number;
  output_format: ImageGenOutputFormat;
  background: ImageGenBackground;
}

export interface ImageGenClient {
  model: ImageGenModel;
  generate(req: ImageGenRequest): Promise<ImageGenResponse>;
}

// ---- Registry ----

const IMAGE_GEN_MODELS: ImageGenModel[] = [
  {
    id: "gpt-image-2",
    provider: "openai",
    costPer1MInputTextTokens: 5,
    costPer1MInputImageTokens: 8,
    costPer1MOutputImageTokens: 30,
  },
  {
    id: "gpt-image-2-2026-04-21",
    provider: "openai",
    costPer1MInputTextTokens: 5,
    costPer1MInputImageTokens: 8,
    costPer1MOutputImageTokens: 30,
  },
];

const VALID_SIZES: ReadonlySet<ImageGenSize> = new Set(["1024x1024", "1024x1536", "1536x1024", "auto"]);
const VALID_QUALITIES: ReadonlySet<ImageGenQuality> = new Set(["low", "medium", "high", "auto"]);
const VALID_OUTPUT_FORMATS: ReadonlySet<ImageGenOutputFormat> = new Set(["png", "jpeg", "webp"]);
const VALID_BACKGROUNDS: ReadonlySet<ImageGenBackground> = new Set(["opaque", "transparent", "auto"]);

export function listImageGenModels(): ImageGenModel[] {
  return IMAGE_GEN_MODELS.map((m) => ({ ...m }));
}

export function resolveImageGenModel(id: string): ImageGenModel {
  const hit = IMAGE_GEN_MODELS.find((m) => m.id === id);
  if (!hit) {
    throw new VrtConfigError(
      "INVALID_MODEL",
      `Unknown image generation model: "${id}". Known: ${IMAGE_GEN_MODELS.map((m) => m.id).join(", ")}`,
    );
  }
  return { ...hit };
}

// ---- Pure builders / parsers ----

export function buildGenerationBody(model: ImageGenModel, req: ImageGenRequest): ImageGenRequestBody {
  if (!req.prompt || !req.prompt.trim()) {
    throw new VrtConfigError("INVALID_REQUEST", "image-gen: prompt must be a non-empty string");
  }
  const size: ImageGenSize = req.size ?? "1024x1024";
  const quality: ImageGenQuality = req.quality ?? "medium";
  const outputFormat: ImageGenOutputFormat = req.outputFormat ?? "png";
  const background: ImageGenBackground = req.background ?? "opaque";
  const n = req.n ?? 1;
  if (!VALID_SIZES.has(size)) {
    throw new VrtConfigError("INVALID_REQUEST", `image-gen: invalid size "${size}"`);
  }
  if (!VALID_QUALITIES.has(quality)) {
    throw new VrtConfigError("INVALID_REQUEST", `image-gen: invalid quality "${quality}"`);
  }
  if (!VALID_OUTPUT_FORMATS.has(outputFormat)) {
    throw new VrtConfigError("INVALID_REQUEST", `image-gen: invalid output_format "${outputFormat}"`);
  }
  if (!VALID_BACKGROUNDS.has(background)) {
    throw new VrtConfigError("INVALID_REQUEST", `image-gen: invalid background "${background}"`);
  }
  if (!Number.isInteger(n) || n <= 0) {
    throw new VrtConfigError("INVALID_REQUEST", `image-gen: n must be a positive integer, got ${n}`);
  }
  return {
    model: model.id,
    prompt: req.prompt,
    size,
    quality,
    n,
    output_format: outputFormat,
    background,
  };
}

interface RawGenerationResponse {
  data?: Array<{ b64_json?: string; url?: string }>;
  usage?: {
    input_tokens?: number;
    output_tokens?: number;
    total_tokens?: number;
    input_tokens_details?: { text_tokens?: number; image_tokens?: number };
  };
}

export interface ParsedGeneration {
  images: Uint8Array[];
  usage: ImageGenUsage | null;
}

export function parseGenerationResponse(json: RawGenerationResponse): ParsedGeneration {
  const images: Uint8Array[] = [];
  for (const entry of json.data ?? []) {
    if (!entry || typeof entry.b64_json !== "string") continue;
    images.push(new Uint8Array(Buffer.from(entry.b64_json, "base64")));
  }
  const u = json.usage;
  const usage: ImageGenUsage | null = u
    ? {
        inputTextTokens: u.input_tokens_details?.text_tokens ?? u.input_tokens ?? 0,
        inputImageTokens: u.input_tokens_details?.image_tokens ?? 0,
        outputTokens: u.output_tokens ?? 0,
      }
    : null;
  return { images, usage };
}

export function estimateImageGenCost(model: ImageGenModel, usage: ImageGenUsage | null): number {
  if (!usage) return 0;
  const cost = (usage.inputTextTokens * model.costPer1MInputTextTokens
    + usage.inputImageTokens * model.costPer1MInputImageTokens
    + usage.outputTokens * model.costPer1MOutputImageTokens) / 1_000_000;
  return Math.round(cost * 1_000_000) / 1_000_000;
}

// ---- Client factory ----

export interface CreateImageGenClientOptions {
  apiKey?: string;
  throwIfMissing?: boolean;
  /** Override the API base URL (for tests / proxies). */
  baseUrl?: string;
}

export function createImageGenClient(
  modelOrId: ImageGenModel | string,
  options?: CreateImageGenClientOptions,
): ImageGenClient {
  const model = typeof modelOrId === "string" ? resolveImageGenModel(modelOrId) : modelOrId;
  const throwIfMissing = options?.throwIfMissing ?? true;
  const apiKey = options?.apiKey ?? process.env.OPENAI_API_KEY;
  if (!apiKey && throwIfMissing) {
    throw new VrtConfigError("MISSING_KEY", `OPENAI_API_KEY is required for ${model.id}`);
  }
  const baseUrl = options?.baseUrl ?? "https://api.openai.com";
  return {
    model,
    async generate(req: ImageGenRequest): Promise<ImageGenResponse> {
      const body = buildGenerationBody(model, req);
      const started = Date.now();
      const res = await fetch(`${baseUrl}/v1/images/generations`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey ?? ""}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
      });
      const text = await res.text();
      let json: RawGenerationResponse & { error?: { message?: string } };
      try {
        json = JSON.parse(text);
      } catch {
        throw new Error(`image-gen: non-JSON response from OpenAI (status ${res.status}): ${text.slice(0, 200)}`);
      }
      if (!res.ok) {
        const message = json.error?.message ?? text.slice(0, 200);
        throw new Error(`image-gen ${model.id} failed (${res.status}): ${message}`);
      }
      const parsed = parseGenerationResponse(json);
      return {
        model: model.id,
        images: parsed.images,
        usage: parsed.usage,
        costUsd: estimateImageGenCost(model, parsed.usage),
        latencyMs: Date.now() - started,
      };
    },
  };
}
