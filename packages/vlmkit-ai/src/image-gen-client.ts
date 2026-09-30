/**
 * Image generation client: OpenRouter's Images API (the default route) or the OpenAI Images API.
 *
 * `IMAGE_GEN_DEFAULT_MODEL` is the model the figure bench chose
 * (`src/experiments/benchmark/image-gen/`, evaluation saved under
 * `docs/reports/data/2026-09-30-image-gen/`); `VLMKIT_IMAGE_MODEL` overrides it. Any
 * `vendor/model` id is an OpenRouter model and needs `OPENROUTER_API_KEY`; its cost is the one
 * OpenRouter reports in `usage.cost`. The two bare ids in the registry (`gpt-image-2`, the dated
 * snapshot) call `api.openai.com` directly with `OPENAI_API_KEY`.
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

/** The figure bench's choice: 3/3 on its briefs at the lowest price measured (2026-09-30). */
export const IMAGE_GEN_DEFAULT_MODEL = "openai/gpt-image-2.5-flare";

export interface ImageGenModel {
  id: string;
  /** `openai`: api.openai.com + OPENAI_API_KEY. `openrouter`: openrouter.ai + OPENROUTER_API_KEY. */
  provider: "openai" | "openrouter";
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
  /** OpenRouter only (e.g. `16:9`); the OpenAI route takes `size`. */
  aspectRatio?: string;
  /**
   * OpenRouter only: images the model draws from — a style to match, a subject to edit. URLs or
   * `data:` URLs. Sent as `input_references`, which takes chat-style `image_url` parts (a bare
   * string or `{ url }` is a 400).
   */
  inputReferences?: string[];
}

export interface ImageGenUsage {
  inputTextTokens: number;
  inputImageTokens: number;
  outputTokens: number;
}

export interface ImageGenResponse {
  model: string;
  images: Uint8Array[];
  /** One per image when the API names it (`image/png`, `image/svg+xml`, …). */
  mediaTypes: (string | null)[];
  usage: ImageGenUsage | null;
  costUsd: number;
  latencyMs: number;
}

export interface OpenRouterImageBody {
  model: string;
  prompt: string;
  n: number;
  aspect_ratio?: string;
  quality?: ImageGenQuality;
  background?: ImageGenBackground;
  input_references?: { type: "image_url"; image_url: { url: string } }[];
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

const OPENROUTER_ID = /^[a-z0-9][a-z0-9-]*\/[a-z0-9][a-z0-9.:\-]*$/;

export function resolveImageGenModel(id: string): ImageGenModel {
  const hit = IMAGE_GEN_MODELS.find((m) => m.id === id);
  if (hit) return { ...hit };
  // A catalogue id is not listed here: OpenRouter's image catalogue changes weekly, and the price
  // comes back with every response, so a copy of either would only go stale.
  if (OPENROUTER_ID.test(id)) {
    return { id, provider: "openrouter", costPer1MInputTextTokens: 0, costPer1MInputImageTokens: 0, costPer1MOutputImageTokens: 0 };
  }
  throw new VrtConfigError(
    "INVALID_MODEL",
    `Unknown image generation model: "${id}". Known: ${IMAGE_GEN_MODELS.map((m) => m.id).join(", ")}, or any OpenRouter id (vendor/model)`,
  );
}

/** `VLMKIT_IMAGE_MODEL`, else the bench's default. */
export function defaultImageGenModelId(env: Record<string, string | undefined> = process.env): string {
  return env.VLMKIT_IMAGE_MODEL?.trim() || IMAGE_GEN_DEFAULT_MODEL;
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

export function buildOpenRouterBody(model: ImageGenModel, req: ImageGenRequest): OpenRouterImageBody {
  if (!req.prompt || !req.prompt.trim()) {
    throw new VrtConfigError("INVALID_REQUEST", "image-gen: prompt must be a non-empty string");
  }
  const n = req.n ?? 1;
  if (!Number.isInteger(n) || n <= 0) {
    throw new VrtConfigError("INVALID_REQUEST", `image-gen: n must be a positive integer, got ${n}`);
  }
  // Only what the caller set: each OpenRouter model accepts a different subset of parameters.
  return {
    model: model.id,
    prompt: req.prompt,
    n,
    ...(req.aspectRatio ? { aspect_ratio: req.aspectRatio } : {}),
    ...(req.quality ? { quality: req.quality } : {}),
    ...(req.background ? { background: req.background } : {}),
    ...(req.inputReferences?.length
      ? { input_references: req.inputReferences.map((url) => ({ type: "image_url" as const, image_url: { url } })) }
      : {}),
  };
}

interface RawGenerationResponse {
  data?: Array<{ b64_json?: string; url?: string; media_type?: string }>;
  usage?: {
    /** OpenRouter: what the call was billed, in USD. */
    cost?: number;
    prompt_tokens?: number;
    completion_tokens?: number;
    input_tokens?: number;
    output_tokens?: number;
    total_tokens?: number;
    input_tokens_details?: { text_tokens?: number; image_tokens?: number };
  };
}

export interface ParsedGeneration {
  images: Uint8Array[];
  mediaTypes: (string | null)[];
  usage: ImageGenUsage | null;
  /** The provider's own figure (OpenRouter `usage.cost`), when it gives one. */
  reportedCostUsd: number | null;
}

export function parseGenerationResponse(json: RawGenerationResponse): ParsedGeneration {
  const images: Uint8Array[] = [];
  const mediaTypes: (string | null)[] = [];
  for (const entry of json.data ?? []) {
    if (!entry || typeof entry.b64_json !== "string") continue;
    images.push(new Uint8Array(Buffer.from(entry.b64_json, "base64")));
    mediaTypes.push(entry.media_type ?? null);
  }
  const u = json.usage;
  const usage: ImageGenUsage | null = u
    ? {
        inputTextTokens: u.input_tokens_details?.text_tokens ?? u.input_tokens ?? u.prompt_tokens ?? 0,
        inputImageTokens: u.input_tokens_details?.image_tokens ?? 0,
        outputTokens: u.output_tokens ?? u.completion_tokens ?? 0,
      }
    : null;
  const reportedCostUsd = typeof u?.cost === "number" ? u.cost : null;
  return { images, mediaTypes, usage, reportedCostUsd };
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

/** With no model: `VLMKIT_IMAGE_MODEL`, else `IMAGE_GEN_DEFAULT_MODEL`. */
export function createImageGenClient(
  modelOrId: ImageGenModel | string = defaultImageGenModelId(),
  options?: CreateImageGenClientOptions,
): ImageGenClient {
  const model = typeof modelOrId === "string" ? resolveImageGenModel(modelOrId) : modelOrId;
  const openRouter = model.provider === "openrouter";
  const keyName = openRouter ? "OPENROUTER_API_KEY" : "OPENAI_API_KEY";
  const throwIfMissing = options?.throwIfMissing ?? true;
  const apiKey = options?.apiKey ?? process.env[keyName];
  if (!apiKey && throwIfMissing) {
    throw new VrtConfigError("MISSING_KEY", `${keyName} is required for ${model.id}`);
  }
  const baseUrl = options?.baseUrl ?? (openRouter ? "https://openrouter.ai" : "https://api.openai.com");
  const path = openRouter ? "/api/v1/images" : "/v1/images/generations";
  const provider = openRouter ? "OpenRouter" : "OpenAI";
  return {
    model,
    async generate(req: ImageGenRequest): Promise<ImageGenResponse> {
      const body = openRouter ? buildOpenRouterBody(model, req) : buildGenerationBody(model, req);
      const started = Date.now();
      const res = await fetch(`${baseUrl}${path}`, {
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
        throw new Error(`image-gen: non-JSON response from ${provider} (status ${res.status}): ${text.slice(0, 200)}`);
      }
      if (!res.ok) {
        const message = json.error?.message ?? text.slice(0, 200);
        throw new Error(`image-gen ${model.id} failed (${res.status}): ${message}`);
      }
      const parsed = parseGenerationResponse(json);
      return {
        model: model.id,
        images: parsed.images,
        mediaTypes: parsed.mediaTypes,
        usage: parsed.usage,
        costUsd: parsed.reportedCostUsd ?? estimateImageGenCost(model, parsed.usage),
        latencyMs: Date.now() - started,
      };
    },
  };
}
