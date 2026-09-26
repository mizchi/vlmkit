/**
 * Zoom for any VLM this package already knows: the model ids `createVlmClient` takes
 * (`claude:…`, `gemini:…`, an OpenRouter id) resolve to a zoom driver with the same keys, so a
 * caller switches a question from one look to "look, then zoom where it matters" by changing
 * one call.
 *
 * Also usable with a self-hosted OpenAI-compatible server (vLLM, Ollama, LM Studio): build
 * `openAiCompatibleDriver({ url, model })` and hand it to `runZoomLoop` directly.
 */
import { VrtConfigError } from "./errors.ts";
import { isClaudeDirectModel, isGeminiDirectModel, type VlmModel, type VlmResponse } from "./vlm-client.ts";
import { anthropicDriver, geminiDriver, openAiCompatibleDriver } from "./zoom-drivers.ts";
import { runZoomLoop, type VisionChatDriver, type ZoomLoopOptions, type ZoomLoopResult } from "./zoom-loop.ts";

export * from "./zoom-geometry.ts";
export { prepareZoomSource, zoomInto, type ZoomSource, type ZoomOutcome } from "./zoom-image.ts";
export * from "./zoom-loop.ts";
export * from "./zoom-drivers.ts";

export interface ZoomDriverOptions {
  /** Overrides the environment key lookup, as in `createVlmClient`. */
  apiKey?: string;
  /** OpenRouter only: false for a model without function calling (the loop then uses the text protocol). */
  nativeTools?: boolean;
}

/** A driver for a model id, with the same key lookup and error as `createVlmClient`. */
export function createZoomDriver(model: VlmModel, options: ZoomDriverOptions = {}): VisionChatDriver {
  const need = (value: string | undefined, name: string): string => {
    if (!value) throw new VrtConfigError("MISSING_KEY", `${name} is required for ${model.id}`);
    return value;
  };
  if (isGeminiDirectModel(model.id)) {
    return geminiDriver({
      model: model.id.replace("gemini:", ""),
      apiKey: need(options.apiKey ?? process.env.GEMINI_API_KEY ?? process.env.GOOGLE_AI_API_KEY, "GEMINI_API_KEY (or GOOGLE_AI_API_KEY)"),
    });
  }
  if (isClaudeDirectModel(model.id)) {
    return anthropicDriver({
      model: model.id.replace("claude:", ""),
      apiKey: need(options.apiKey ?? process.env.ANTHROPIC_API_KEY, "ANTHROPIC_API_KEY"),
    });
  }
  return openAiCompatibleDriver({
    model: model.id,
    apiKey: need(options.apiKey ?? process.env.OPENROUTER_API_KEY, "OPENROUTER_API_KEY"),
    headers: { "HTTP-Referer": "https://github.com/mizchi/vrt", "X-Title": "vrt" },
    ...(options.nativeTools !== undefined ? { nativeTools: options.nativeTools } : {}),
  });
}

export interface ZoomAnalysis extends VlmResponse {
  zoom: Omit<ZoomLoopResult, "answer" | "usage">;
}

/**
 * Ask a question about one or more PNG screenshots, letting the model zoom. Same shape as a
 * `VlmClient` response (content, tokens, cost, latency) plus what the model zoomed into, so a
 * bench can put it beside a single-look answer.
 */
export async function analyzeWithZoom(
  model: VlmModel,
  images: readonly { png: Buffer; label?: string }[],
  prompt: string,
  options: ZoomLoopOptions & ZoomDriverOptions = {},
): Promise<ZoomAnalysis> {
  const start = Date.now();
  const driver = createZoomDriver(model, options);
  const { answer, usage, ...zoom } = await runZoomLoop(driver, images, prompt, options);
  return {
    content: answer,
    model: model.id,
    promptTokens: usage.promptTokens,
    completionTokens: usage.completionTokens,
    totalTokens: usage.promptTokens + usage.completionTokens,
    costUsd: (usage.promptTokens / 1000) * model.promptCostPer1k + (usage.completionTokens / 1000) * model.completionCostPer1k,
    latencyMs: Date.now() - start,
    zoom,
  };
}
