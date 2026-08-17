/**
 * VLM (Vision Language Model) client
 *
 * Multi-provider support:
 * - OpenRouter (100+ vision models)
 * - Google AI (Gemini direct)
 *
 * Model list is fetched dynamically from the API.
 */
import { readFile } from "node:fs/promises";
import { VrtConfigError } from "./errors.ts";

// ---- Types ----

export interface VlmModel {
  id: string;
  name: string;
  promptCostPer1k: number;
  completionCostPer1k: number;
  contextLength: number;
  modality: string;
}

export interface VlmResponse {
  content: string;
  model: string;
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  costUsd: number;
  latencyMs: number;
}

export interface VlmClient {
  model: VlmModel;
  analyzeImage(imageBase64: string, prompt: string, options?: { maxTokens?: number }): Promise<VlmResponse>;
  analyzeImageFile(imagePath: string, prompt: string, options?: { maxTokens?: number }): Promise<VlmResponse>;
  analyzeDiff(baselineBase64: string, currentBase64: string, prompt: string, options?: { maxTokens?: number }): Promise<VlmResponse>;
}

// ---- Model discovery from OpenRouter API ----

let _cachedModels: VlmModel[] | null = null;

/**
 * Drop the cached OpenRouter model list.
 *
 * The cache is process-wide and had no way out, which matters beyond tests: the API server
 * (`src/api/`) and a `--loop` run are long-lived, so a model added or repriced upstream is
 * invisible to them until restart. Named after `resetGateRegistryCache`, which exists for the
 * same reason on the same kind of lazily-built module state.
 */
export function resetVisionModelCache(): void {
  _cachedModels = null;
}

export async function fetchVisionModels(): Promise<VlmModel[]> {
  if (_cachedModels) return _cachedModels;

  const res = await fetch("https://openrouter.ai/api/v1/models");
  if (!res.ok) throw new Error(`OpenRouter API error: ${res.status}`);
  const data = await res.json() as { data: any[] };

  _cachedModels = data.data
    .filter((m: any) => {
      const inputMods = m.architecture?.input_modalities ?? [];
      return inputMods.includes("image");
    })
    .map((m: any) => ({
      id: m.id,
      name: m.name ?? m.id,
      promptCostPer1k: parseFloat(m.pricing?.prompt ?? "999"),
      completionCostPer1k: parseFloat(m.pricing?.completion ?? "999"),
      contextLength: m.context_length ?? 0,
      modality: m.architecture?.modality ?? "",
    }))
    .sort((a: VlmModel, b: VlmModel) => a.promptCostPer1k - b.promptCostPer1k);

  return _cachedModels;
}

export async function listModels(options?: { maxCost?: number; limit?: number; includeGemini?: boolean; includeClaude?: boolean }): Promise<VlmModel[]> {
  const openRouterModels = await fetchVisionModels();
  const direct: VlmModel[] = [];
  if (options?.includeGemini !== false) direct.push(...GOOGLE_MODELS);
  if (options?.includeClaude !== false) direct.push(...CLAUDE_MODELS);
  const models = [...direct, ...openRouterModels];
  // Sort by cost
  models.sort((a, b) => a.promptCostPer1k - b.promptCostPer1k);
  let filtered = models;
  if (options?.maxCost !== undefined) {
    filtered = filtered.filter((m) => m.promptCostPer1k <= options.maxCost!);
  }
  if (options?.limit) {
    filtered = filtered.slice(0, options.limit);
  }
  return filtered;
}

export async function resolveModel(idOrIndex: string): Promise<VlmModel> {
  // Check direct providers first
  const geminiModel = resolveGeminiModel(idOrIndex);
  if (geminiModel) return geminiModel;

  const claudeModel = resolveClaudeModel(idOrIndex);
  if (claudeModel) return claudeModel;

  const models = await fetchVisionModels();

  // Exact ID match
  const exact = models.find((m) => m.id === idOrIndex);
  if (exact) return exact;

  // Partial match — prefer exact substring, then fuzzy
  const partial = models.filter((m) => m.id.includes(idOrIndex));
  if (partial.length === 1) return partial[0];
  if (partial.length > 1) {
    // The escape hatch: a query that names a whole segment (`qwen3-vl` against
    // `qwen/qwen3-vl` and `qwen/qwen3-vl-30b-a3b-instruct`) means the exact one.
    //
    // It has to be UNIQUE to be an answer. It used to sort by id length and take the shortest
    // if that one happened to be a segment match, which silently picks between vendors: with
    // `a/vision-pro` and `b/vision-max`, the query `vision-` resolved to `a/vision-pro` because
    // its id is one character shorter. Those are different models at different prices, and a
    // model chosen by string length is not a choice the caller made.
    // A WHOLE path segment, not a prefix of one. `includes("/" + q)` was the old spelling and it
    // matches `qwen/qwen3-vl-30b-a3b-instruct` for the query `qwen3-vl` too, so both candidates
    // "matched the segment" and the tie was broken by id length.
    const segmentMatches = partial.filter((m) => m.id.split("/").includes(idOrIndex));
    if (segmentMatches.length === 1) return segmentMatches[0];
    const shown = (segmentMatches.length > 1 ? segmentMatches : partial)
      .slice(0, 5).map((m) => m.id).join(", ");
    throw new VrtConfigError(
      "MULTIPLE_MATCHES",
      `Ambiguous model "${idOrIndex}". Matches: ${shown}\nTip: use more specific ID, e.g. "${(segmentMatches[0] ?? partial[0]).id}"`,
    );
  }

  // Numeric index
  const idx = parseInt(idOrIndex, 10);
  if (!isNaN(idx) && idx >= 0 && idx < models.length) return models[idx];

  throw new VrtConfigError(
    "INVALID_MODEL",
    `Model not found: "${idOrIndex}". Use --list to see available models.`,
  );
}

// ---- Google AI (Gemini direct) ----

const GOOGLE_MODELS: VlmModel[] = [
  { id: "gemini:gemini-2.5-flash-preview-05-20", name: "Gemini 2.5 Flash (direct)", promptCostPer1k: 1.5e-7, completionCostPer1k: 6e-7, contextLength: 1048576, modality: "text+image->text" },
  { id: "gemini:gemini-2.0-flash", name: "Gemini 2.0 Flash (direct)", promptCostPer1k: 1e-7, completionCostPer1k: 4e-7, contextLength: 1048576, modality: "text+image->text" },
  { id: "gemini:gemini-2.0-flash-lite", name: "Gemini 2.0 Flash Lite (direct)", promptCostPer1k: 7.5e-8, completionCostPer1k: 3e-7, contextLength: 1048576, modality: "text+image->text" },
];

export function isGeminiDirectModel(id: string): boolean {
  return id.startsWith("gemini:");
}

export function resolveGeminiModel(id: string): VlmModel | undefined {
  return GOOGLE_MODELS.find((m) => m.id === id || m.id === `gemini:${id}`);
}

export function listGeminiModels(): VlmModel[] {
  return [...GOOGLE_MODELS];
}

// ---- Anthropic (Claude direct) ----
//
// Per-token USD prices follow the OpenRouter convention used elsewhere
// in this file (`promptCostPer1k` is actually "per token"; the runtime
// cost expression `(tokens/1000) * promptCostPer1k` is consistent
// within this tool's reporting and comparable across providers).
//
// 2026 Anthropic list pricing (input / output per million tokens):
//   - Haiku 4.5: $1.00 / $5.00
//   - Sonnet 4.6: $3.00 / $15.00
//   - Opus 4.7:  $15.00 / $75.00

const CLAUDE_MODELS: VlmModel[] = [
  { id: "claude:claude-haiku-4-5-20251001", name: "Claude Haiku 4.5 (direct)", promptCostPer1k: 1e-6, completionCostPer1k: 5e-6, contextLength: 200000, modality: "text+image->text" },
  { id: "claude:claude-sonnet-4-6", name: "Claude Sonnet 4.6 (direct)", promptCostPer1k: 3e-6, completionCostPer1k: 1.5e-5, contextLength: 200000, modality: "text+image->text" },
  { id: "claude:claude-opus-4-7", name: "Claude Opus 4.7 (direct)", promptCostPer1k: 1.5e-5, completionCostPer1k: 7.5e-5, contextLength: 200000, modality: "text+image->text" },
];

export function isClaudeDirectModel(id: string): boolean {
  return id.startsWith("claude:");
}

export function resolveClaudeModel(id: string): VlmModel | undefined {
  return CLAUDE_MODELS.find((m) => m.id === id || m.id === `claude:${id}`);
}

export function listClaudeModels(): VlmModel[] {
  return [...CLAUDE_MODELS];
}

async function createClaudeClient(model: VlmModel, apiKey: string): Promise<VlmClient> {
  const claudeModelId = model.id.replace("claude:", "");

  type ClaudeContentBlock =
    | { type: "text"; text: string }
    | { type: "image"; source: { type: "base64"; media_type: "image/png" | "image/jpeg" | "image/webp" | "image/gif"; data: string } };

  async function callClaude(
    content: ClaudeContentBlock[],
    maxTokens: number,
  ): Promise<VlmResponse> {
    const start = Date.now();
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: claudeModelId,
        max_tokens: maxTokens,
        messages: [{ role: "user", content }],
      }),
    });

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Anthropic API error: ${res.status} ${text.slice(0, 200)}`);
    }

    const data = await res.json() as {
      content: Array<{ type: string; text?: string }>;
      usage?: { input_tokens: number; output_tokens: number };
    };

    const latencyMs = Date.now() - start;
    const textOut = data.content
      .filter((b) => b.type === "text" && typeof b.text === "string")
      .map((b) => b.text as string)
      .join("");
    const usage = data.usage ?? { input_tokens: 0, output_tokens: 0 };
    const costUsd = (usage.input_tokens / 1000) * model.promptCostPer1k +
                    (usage.output_tokens / 1000) * model.completionCostPer1k;

    return {
      content: textOut,
      model: model.id,
      promptTokens: usage.input_tokens,
      completionTokens: usage.output_tokens,
      totalTokens: usage.input_tokens + usage.output_tokens,
      costUsd,
      latencyMs,
    };
  }

  const client: VlmClient = {
    model,
    async analyzeImage(imageBase64, prompt, options) {
      return callClaude([
        { type: "image", source: { type: "base64", media_type: "image/png", data: imageBase64 } },
        { type: "text", text: prompt },
      ], options?.maxTokens ?? 1024);
    },
    async analyzeImageFile(imagePath, prompt, options) {
      const buf = await readFile(imagePath);
      return client.analyzeImage(buf.toString("base64"), prompt, options);
    },
    async analyzeDiff(baselineBase64, currentBase64, prompt, options) {
      return callClaude([
        { type: "text", text: "Baseline screenshot:" },
        { type: "image", source: { type: "base64", media_type: "image/png", data: baselineBase64 } },
        { type: "text", text: "Current screenshot:" },
        { type: "image", source: { type: "base64", media_type: "image/png", data: currentBase64 } },
        { type: "text", text: prompt },
      ], options?.maxTokens ?? 1024);
    },
  };
  return client;
}

async function createGeminiClient(model: VlmModel, apiKey: string): Promise<VlmClient> {
  const geminiModelId = model.id.replace("gemini:", "");
  let GoogleGenerativeAI: any;
  try {
    ({ GoogleGenerativeAI } = await import("@google/generative-ai"));
  } catch (e) {
    throw new VrtConfigError(
      "MISSING_DEPENDENCY",
      `@google/generative-ai is not installed. Run: pnpm add @google/generative-ai`,
    );
  }
  const genAI = new GoogleGenerativeAI(apiKey);
  const genModel = genAI.getGenerativeModel({ model: geminiModelId });

  async function callGemini(
    imageBase64: string,
    textPrompt: string,
    maxTokens: number,
  ): Promise<VlmResponse> {

    const start = Date.now();
    const result = await genModel.generateContent({
      contents: [{
        role: "user",
        parts: [
          { inlineData: { mimeType: "image/png", data: imageBase64 } },
          { text: textPrompt },
        ],
      }],
      generationConfig: { maxOutputTokens: maxTokens },
    });

    const latencyMs = Date.now() - start;
    const response = result.response;
    const content = response.text();
    const usage = response.usageMetadata;
    const promptTokens = usage?.promptTokenCount ?? 0;
    const completionTokens = usage?.candidatesTokenCount ?? 0;
    const costUsd = (promptTokens / 1000) * model.promptCostPer1k +
                    (completionTokens / 1000) * model.completionCostPer1k;

    return {
      content,
      model: model.id,
      promptTokens,
      completionTokens,
      totalTokens: promptTokens + completionTokens,
      costUsd,
      latencyMs,
    };
  }

  const client: VlmClient = {
    model,
    async analyzeImage(imageBase64, prompt, options) {
      return callGemini(imageBase64, prompt, options?.maxTokens ?? 1024);
    },
    async analyzeImageFile(imagePath, prompt, options) {
      const buf = await readFile(imagePath);
      return client.analyzeImage(buf.toString("base64"), prompt, options);
    },
    async analyzeDiff(baselineBase64, currentBase64, prompt, options) {
      const start = Date.now();
      const result = await genModel.generateContent({
        contents: [{
          role: "user",
          parts: [
            { text: "Baseline screenshot:" },
            { inlineData: { mimeType: "image/png", data: baselineBase64 } },
            { text: "Current screenshot:" },
            { inlineData: { mimeType: "image/png", data: currentBase64 } },
            { text: prompt },
          ],
        }],
        generationConfig: { maxOutputTokens: options?.maxTokens ?? 1024 },
      });

      const latencyMs = Date.now() - start;
      const response = result.response;
      const usage = response.usageMetadata;
      const promptTokens = usage?.promptTokenCount ?? 0;
      const completionTokens = usage?.candidatesTokenCount ?? 0;

      return {
        content: response.text(),
        model: model.id,
        promptTokens,
        completionTokens,
        totalTokens: promptTokens + completionTokens,
        costUsd: (promptTokens / 1000) * model.promptCostPer1k +
                 (completionTokens / 1000) * model.completionCostPer1k,
        latencyMs,
      };
    },
  };
  return client;
}

// ---- Client factory ----

export interface CreateVlmClientOptions {
  /** Override `OPENROUTER_API_KEY` / `GEMINI_API_KEY` lookup. */
  apiKey?: string;
  /**
   * When `false`, return `null` instead of throwing `VrtConfigError`
   * if the required API key is missing. Default: `true`.
   */
  throwIfMissing?: boolean;
}

/**
 * Construct a VLM client for the given model.
 *
 * Throws `VrtConfigError` (`code: "MISSING_KEY"`) when the model's
 * required API key isn't set in the environment. Pass
 * `{ throwIfMissing: false }` for the legacy `T | null` return.
 */
export async function createVlmClient(
  model: VlmModel,
  options?: CreateVlmClientOptions,
): Promise<VlmClient | null> {
  const throwIfMissing = options?.throwIfMissing ?? true;
  // Gemini direct
  if (isGeminiDirectModel(model.id)) {
    const key = options?.apiKey ?? process.env.GEMINI_API_KEY ?? process.env.GOOGLE_AI_API_KEY;
    if (!key) {
      if (throwIfMissing) {
        throw new VrtConfigError(
          "MISSING_KEY",
          `GEMINI_API_KEY (or GOOGLE_AI_API_KEY) is required for ${model.id}`,
        );
      }
      return null;
    }
    return createGeminiClient(model, key);
  }

  // Anthropic (Claude) direct
  if (isClaudeDirectModel(model.id)) {
    const key = options?.apiKey ?? process.env.ANTHROPIC_API_KEY;
    if (!key) {
      if (throwIfMissing) {
        throw new VrtConfigError(
          "MISSING_KEY",
          `ANTHROPIC_API_KEY is required for ${model.id}`,
        );
      }
      return null;
    }
    return createClaudeClient(model, key);
  }

  // OpenRouter
  const key = options?.apiKey ?? process.env.OPENROUTER_API_KEY;
  if (!key) {
    if (throwIfMissing) {
      throw new VrtConfigError(
        "MISSING_KEY",
        `OPENROUTER_API_KEY is required for ${model.id}`,
      );
    }
    return null;
  }

  async function callOpenRouter(
    messages: Array<{ role: string; content: any }>,
    maxTokens: number,
  ): Promise<VlmResponse> {
    const start = Date.now();
    const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${key}`,
        "HTTP-Referer": "https://github.com/mizchi/vrt",
        "X-Title": "vrt",
      },
      body: JSON.stringify({
        model: model.id,
        max_tokens: maxTokens,
        messages,
      }),
    });

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`OpenRouter API error: ${res.status} ${text.slice(0, 200)}`);
    }

    const data = await res.json() as {
      choices: Array<{ message: { content: string } }>;
      usage?: { prompt_tokens: number; completion_tokens: number; total_tokens?: number };
    };

    const latencyMs = Date.now() - start;
    const usage = data.usage ?? { prompt_tokens: 0, completion_tokens: 0 };
    const costUsd = (usage.prompt_tokens / 1000) * model.promptCostPer1k +
                    (usage.completion_tokens / 1000) * model.completionCostPer1k;

    return {
      content: data.choices[0]?.message?.content ?? "",
      model: model.id,
      promptTokens: usage.prompt_tokens,
      completionTokens: usage.completion_tokens,
      // Summed rather than read: `total_tokens` is optional in the OpenAI-compatible shape
      // OpenRouter serves, and several models omit it. Reading it directly put `undefined` into
      // `totalTokens`, which then reaches the bench reports that quote token counts — the
      // Anthropic and Gemini paths in this file have always summed. Kept as a fallback rather
      // than replaced, because a provider that reports a total including reasoning tokens is
      // more right than the sum of the other two fields.
      totalTokens: usage.total_tokens ?? (usage.prompt_tokens + usage.completion_tokens),
      costUsd,
      latencyMs,
    };
  }

  const orClient: VlmClient = {
    model,

    async analyzeImage(imageBase64, prompt, options) {
      return callOpenRouter([{
        role: "user",
        content: [
          { type: "image_url", image_url: { url: `data:image/png;base64,${imageBase64}` } },
          { type: "text", text: prompt },
        ],
      }], options?.maxTokens ?? 1024);
    },

    async analyzeImageFile(imagePath, prompt, options) {
      const buf = await readFile(imagePath);
      return orClient.analyzeImage(buf.toString("base64"), prompt, options);
    },

    async analyzeDiff(baselineBase64, currentBase64, prompt, options) {
      return callOpenRouter([{
        role: "user",
        content: [
          { type: "text", text: "Baseline screenshot:" },
          { type: "image_url", image_url: { url: `data:image/png;base64,${baselineBase64}` } },
          { type: "text", text: "Current screenshot:" },
          { type: "image_url", image_url: { url: `data:image/png;base64,${currentBase64}` } },
          { type: "text", text: prompt },
        ],
      }], options?.maxTokens ?? 1024);
    },
  };
  return orClient;
}
