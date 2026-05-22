/**
 * @mizchi/vlmkit-ai — VLM / LLM clients, reasoning pipeline, NLP helpers
 *
 * Curated public API. The `nlp` module (STOP_WORDS / SYNONYMS dictionaries)
 * remains deep-importable but is not in the barrel — those are tuning
 * tables, not user-facing primitives.
 */

// ---- Errors ----
export { VrtConfigError, type VrtConfigErrorCode } from "./errors.ts";

// ---- LLM clients ----
export {
  createUnifiedLLMClient,
  createLLMProvider,
  type CreateLLMProviderOptions,
  type LLMClientOptions,
  type LLMResponse,
  type LLMProviderName,
  type UnifiedLLMClient,
  type MessageContent,
  type TextContent,
  type ImageContent,
} from "./llm-client.ts";

// ---- VLM clients ----
export {
  fetchVisionModels,
  listModels,
  resolveModel,
  listGeminiModels,
  resolveGeminiModel,
  isGeminiDirectModel,
  createVlmClient,
  type CreateVlmClientOptions,
  type VlmClient,
  type VlmModel,
  type VlmResponse,
} from "./vlm-client.ts";

// ---- Image generation clients ----
export {
  buildGenerationBody,
  createImageGenClient,
  estimateImageGenCost,
  listImageGenModels,
  parseGenerationResponse,
  resolveImageGenModel,
  type CreateImageGenClientOptions,
  type ImageGenBackground,
  type ImageGenClient,
  type ImageGenModel,
  type ImageGenOutputFormat,
  type ImageGenQuality,
  type ImageGenRequest,
  type ImageGenRequestBody,
  type ImageGenResponse,
  type ImageGenSize,
  type ImageGenUsage,
  type ParsedGeneration,
} from "./image-gen-client.ts";

// ---- Reasoning ----
export {
  createReasoningPipeline,
  type ReasoningPipeline,
  type PipelineConfig,
  type AnalyzeOptions,
  type StructuredDiffReport,
  type VisualChange,
  type CssFix,
  type FixSuggestion,
} from "./reasoning-pipeline.ts";
export {
  reasonAboutChanges,
  type ReasoningChain,
  type ActualChange,
  type ExpectationMapping,
} from "./reasoning.ts";

// ---- Intent / diff extraction ----
export {
  buildIntent,
  buildIntentWithLLM,
  buildReasoningPrompt,
  extractDiffSemantics,
  parseDiff,
  type LLMProvider,
} from "./intent.ts";
