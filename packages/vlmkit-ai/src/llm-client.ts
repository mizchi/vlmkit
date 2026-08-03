/**
 * Unified LLM client
 *
 * Supports both text and image. Provider priority:
 * 1. Anthropic (ANTHROPIC_API_KEY) -- text + vision
 * 2. Gemini (GEMINI_API_KEY) -- text + vision
 * 3. OpenRouter (OPENROUTER_API_KEY) -- text + vision
 *
 * Backwards-compatible with the existing LLMProvider interface.
 */
import type { LLMProvider } from "./intent.ts";
import { VrtConfigError } from "./errors.ts";
import { readEnv } from "@mizchi/vlmkit-core/legacy-names.ts";

// ---- Types ----

export interface LLMClientOptions {
  /** Whether vision support is needed */
  vision?: boolean;
  /** Max tokens */
  maxTokens?: number;
  /** Specific provider */
  provider?: "anthropic" | "gemini" | "openrouter";
  /** Specific model */
  model?: string;
  /**
   * When `false`, factories return `null` instead of throwing
   * `VrtConfigError` if the required API key is missing. Default: `true`.
   */
  throwIfMissing?: boolean;
}

export interface ImageContent {
  type: "image";
  base64: string;
  mimeType?: string;
}

export interface TextContent {
  type: "text";
  text: string;
}

export type MessageContent = string | Array<TextContent | ImageContent>;

export interface LLMResponse {
  content: string;
  model: string;
  provider: string;
  promptTokens: number;
  completionTokens: number;
  costUsd: number;
  latencyMs: number;
}

export interface UnifiedLLMClient {
  /** Text only (backwards-compatible) */
  complete(prompt: string): Promise<string>;
  /** Text + images */
  completeWithImages(content: MessageContent, options?: { maxTokens?: number }): Promise<LLMResponse>;
  /** VRT diff analysis: pass heatmap + text report together */
  analyzeDiff(options: {
    heatmapBase64?: string;
    baselineBase64?: string;
    currentBase64?: string;
    textReport: string;
    prompt?: string;
    maxTokens?: number;
  }): Promise<LLMResponse>;

  provider: string;
  model: string;
}

// ---- Anthropic ----

function createAnthropicClient(apiKey: string, model?: string): UnifiedLLMClient {
  const modelId = model ?? "claude-sonnet-4-6";

  async function call(content: MessageContent, maxTokens: number): Promise<LLMResponse> {
    const start = Date.now();

    type AnthropicBlock =
      | { type: "text"; text: string }
      | { type: "image"; source: { type: "base64"; media_type: string; data: string } };

    const messageContent: string | AnthropicBlock[] =
      typeof content === "string"
        ? content
        : content.map((c): AnthropicBlock => {
          if (c.type === "text") return { type: "text", text: c.text };
          return {
            type: "image",
            source: { type: "base64", media_type: c.mimeType ?? "image/png", data: c.base64 },
          };
        });

    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: modelId,
        max_tokens: maxTokens,
        messages: [{ role: "user", content: messageContent }],
      }),
    });

    if (!res.ok) {
      const body = (await res.text()).slice(0, 200);
      throw new Error(`Anthropic API error: ${res.status} ${body}`);
    }

    const data = await res.json() as {
      content: Array<{ type: string; text: string }>;
      usage?: { input_tokens: number; output_tokens: number };
    };

    const latencyMs = Date.now() - start;
    const text = data.content.filter((c) => c.type === "text").map((c) => c.text).join("");
    const promptTokens = data.usage?.input_tokens ?? 0;
    const completionTokens = data.usage?.output_tokens ?? 0;

    return {
      content: text,
      model: modelId,
      provider: "anthropic",
      promptTokens,
      completionTokens,
      costUsd: 0, // Anthropic pricing varies, skip for now
      latencyMs,
    };
  }

  return {
    provider: "anthropic",
    model: modelId,
    async complete(prompt) { return (await call(prompt, 1024)).content; },
    async completeWithImages(content, options) { return call(content, options?.maxTokens ?? 1024); },
    async analyzeDiff(options) { return call(buildDiffContent(options), options.maxTokens ?? 1024); },
  };
}

// ---- Gemini ----

function createGeminiLLMClient(apiKey: string, model?: string): UnifiedLLMClient {
  const modelId = model ?? "gemini-2.5-flash-preview-05-20";

  async function call(content: MessageContent, maxTokens: number): Promise<LLMResponse> {
    const { GoogleGenerativeAI } = await import("@google/generative-ai");
    const genAI = new GoogleGenerativeAI(apiKey);
    const genModel = genAI.getGenerativeModel({ model: modelId });
    const start = Date.now();

    type GeminiPart =
      | { text: string }
      | { inlineData: { mimeType: string; data: string } };

    const parts: GeminiPart[] =
      typeof content === "string"
        ? [{ text: content }]
        : content.map((c): GeminiPart => {
          if (c.type === "text") return { text: c.text };
          return { inlineData: { mimeType: c.mimeType ?? "image/png", data: c.base64 } };
        });

    const result = await genModel.generateContent({
      contents: [{ role: "user", parts }],
      generationConfig: { maxOutputTokens: maxTokens },
    });

    const latencyMs = Date.now() - start;
    const response = result.response;
    const usage = response.usageMetadata;

    return {
      content: response.text(),
      model: modelId,
      provider: "gemini",
      promptTokens: usage?.promptTokenCount ?? 0,
      completionTokens: usage?.candidatesTokenCount ?? 0,
      costUsd: 0,
      latencyMs,
    };
  }

  return {
    provider: "gemini",
    model: modelId,
    async complete(prompt) { return (await call(prompt, 1024)).content; },
    async completeWithImages(content, options) { return call(content, options?.maxTokens ?? 1024); },
    async analyzeDiff(options) { return call(buildDiffContent(options), options.maxTokens ?? 1024); },
  };
}

// ---- OpenRouter ----

function createOpenRouterLLMClient(apiKey: string, model?: string): UnifiedLLMClient {
  const modelId = model ?? "qwen/qwen3-vl-8b-instruct";

  async function call(content: MessageContent, maxTokens: number): Promise<LLMResponse> {
    const start = Date.now();

    type OpenRouterBlock =
      | { type: "text"; text: string }
      | { type: "image_url"; image_url: { url: string } };

    const messageContent: string | OpenRouterBlock[] =
      typeof content === "string"
        ? content
        : content.map((c): OpenRouterBlock => {
          if (c.type === "text") return { type: "text", text: c.text };
          return { type: "image_url", image_url: { url: `data:${c.mimeType ?? "image/png"};base64,${c.base64}` } };
        });

    const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${apiKey}`,
        "HTTP-Referer": "https://github.com/mizchi/vrt",
      },
      body: JSON.stringify({
        model: modelId,
        max_tokens: maxTokens,
        messages: [{ role: "user", content: messageContent }],
      }),
    });

    if (!res.ok) throw new Error(`OpenRouter API error: ${res.status} ${(await res.text()).slice(0, 200)}`);

    const data = await res.json() as {
      choices: Array<{ message: { content: string } }>;
      usage?: { prompt_tokens: number; completion_tokens: number };
    };

    const latencyMs = Date.now() - start;
    return {
      content: data.choices[0]?.message?.content ?? "",
      model: modelId,
      provider: "openrouter",
      promptTokens: data.usage?.prompt_tokens ?? 0,
      completionTokens: data.usage?.completion_tokens ?? 0,
      costUsd: 0,
      latencyMs,
    };
  }

  return {
    provider: "openrouter",
    model: modelId,
    async complete(prompt) { return (await call(prompt, 1024)).content; },
    async completeWithImages(content, options) { return call(content, options?.maxTokens ?? 1024); },
    async analyzeDiff(options) { return call(buildDiffContent(options), options.maxTokens ?? 1024); },
  };
}

// ---- Diff content builder ----

function buildDiffContent(options: {
  heatmapBase64?: string;
  baselineBase64?: string;
  currentBase64?: string;
  textReport: string;
  prompt?: string;
}): MessageContent {
  const parts: Array<TextContent | ImageContent> = [];

  if (options.baselineBase64) {
    parts.push({ type: "text", text: "Baseline screenshot:" });
    parts.push({ type: "image", base64: options.baselineBase64 });
  }
  if (options.currentBase64) {
    parts.push({ type: "text", text: "Current screenshot:" });
    parts.push({ type: "image", base64: options.currentBase64 });
  }
  if (options.heatmapBase64) {
    parts.push({ type: "text", text: "Diff heatmap (red = changed pixels):" });
    parts.push({ type: "image", base64: options.heatmapBase64 });
  }

  parts.push({ type: "text", text: options.textReport });

  if (options.prompt) {
    parts.push({ type: "text", text: options.prompt });
  }

  return parts;
}

// ---- Factory ----

export type LLMProviderName = "gemini" | "anthropic" | "openrouter";

const VALID_PROVIDERS: ReadonlySet<LLMProviderName> = new Set([
  "gemini",
  "anthropic",
  "openrouter",
]);

/**
 * Resolve provider and key from environment variables.
 *
 * VRT_LLM_PROVIDER: gemini (default) | anthropic | openrouter
 * VRT_LLM_MODEL: model ID (defaults to provider's default)
 *
 * Returns a config, or describes why no config was available. The
 * factory decides whether to throw based on `throwIfMissing`.
 */
function resolveProviderConfig(options?: LLMClientOptions):
  | { ok: true; provider: LLMProviderName; key: string; model?: string }
  | { ok: false; code: "INVALID_PROVIDER" | "MISSING_KEY"; message: string }
{
  const rawProvider = options?.provider
    ?? readEnv("LLM_PROVIDER")
    ?? "gemini";

  if (!VALID_PROVIDERS.has(rawProvider as LLMProviderName)) {
    return {
      ok: false,
      code: "INVALID_PROVIDER",
      message: `Unknown VRT_LLM_PROVIDER "${rawProvider}". Expected: gemini | anthropic | openrouter.`,
    };
  }
  const provider = rawProvider as LLMProviderName;

  const model = options?.model ?? readEnv("LLM_MODEL") ?? undefined;

  const keyMap: Record<LLMProviderName, string | undefined> = {
    gemini: process.env.GEMINI_API_KEY ?? process.env.GOOGLE_AI_API_KEY,
    anthropic: process.env.ANTHROPIC_API_KEY,
    openrouter: process.env.OPENROUTER_API_KEY,
  };
  const envVarName: Record<LLMProviderName, string> = {
    gemini: "GEMINI_API_KEY (or GOOGLE_AI_API_KEY)",
    anthropic: "ANTHROPIC_API_KEY",
    openrouter: "OPENROUTER_API_KEY",
  };

  const key = keyMap[provider];
  if (!key) {
    return {
      ok: false,
      code: "MISSING_KEY",
      message: `${envVarName[provider]} is required for provider "${provider}".`,
    };
  }

  return { ok: true, provider, key, model };
}

/**
 * Create a unified LLM client.
 *
 * Provider is set via `VRT_LLM_PROVIDER` env var (default: `gemini`).
 *
 * Throws `VrtConfigError` when the resolved provider has no API key
 * (`code: "MISSING_KEY"`) or the provider value is unknown
 * (`code: "INVALID_PROVIDER"`). Pass `{ throwIfMissing: false }` for
 * legacy `T | null` return.
 */
export function createUnifiedLLMClient(options?: LLMClientOptions): UnifiedLLMClient | null {
  const throwIfMissing = options?.throwIfMissing ?? true;
  const config = resolveProviderConfig(options);
  if (!config.ok) {
    if (throwIfMissing) {
      throw new VrtConfigError(config.code, config.message);
    }
    return null;
  }

  switch (config.provider) {
    case "anthropic":
      return createAnthropicClient(config.key, config.model);
    case "gemini":
      return createGeminiLLMClient(config.key, config.model);
    case "openrouter":
      return createOpenRouterLLMClient(config.key, config.model);
  }
}

export interface CreateLLMProviderOptions {
  /**
   * When `false`, returns `null` instead of throwing `VrtConfigError`
   * if no provider has an API key. Default: `true`.
   */
  throwIfMissing?: boolean;
}

/**
 * Backwards-compatible: returns the existing `LLMProvider` interface.
 * Uses the provider specified by `VRT_LLM_PROVIDER`. Falls back to
 * other providers if the requested key is missing.
 *
 * Throws `VrtConfigError` (`code: "NO_PROVIDER_AVAILABLE"`) when no
 * provider in the fallback chain has an API key. Pass
 * `{ throwIfMissing: false }` for the legacy `T | null` return.
 */
export function createLLMProvider(options?: CreateLLMProviderOptions): LLMProvider | null {
  const throwIfMissing = options?.throwIfMissing ?? true;
  // Try requested/default provider first without throwing — we'll fall back.
  const client = createUnifiedLLMClient({ throwIfMissing: false });
  if (client) return { complete: (prompt: string) => client.complete(prompt) };

  // Fallback: use any available key
  const fallbackOrder: LLMProviderName[] = ["gemini", "anthropic", "openrouter"];
  for (const provider of fallbackOrder) {
    const fb = createUnifiedLLMClient({ provider, throwIfMissing: false });
    if (fb) return { complete: (prompt: string) => fb.complete(prompt) };
  }

  if (throwIfMissing) {
    throw new VrtConfigError(
      "NO_PROVIDER_AVAILABLE",
      "No LLM provider available. Set one of: GEMINI_API_KEY, ANTHROPIC_API_KEY, OPENROUTER_API_KEY.",
    );
  }
  return null;
}
