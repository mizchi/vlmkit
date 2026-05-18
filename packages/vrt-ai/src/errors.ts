/**
 * Tagged error class for factory functions in @mizchi/vrt-ai.
 *
 * Factories (`createVlmClient`, `createUnifiedLLMClient`,
 * `createLLMProvider`, `createReasoningPipeline`) historically returned
 * `null` when configuration was missing or invalid. The caller had no way
 * to discriminate between "no API key", "invalid model id", "ambiguous
 * model substring", or "provider value unknown" — every failure mode
 * collapsed into one nullable.
 *
 * From 0.5.0 the factories throw `VrtConfigError` by default. Callers
 * that want the legacy null behaviour pass `{ throwIfMissing: false }`.
 *
 * Codes are stable; new ones can only be added (never renumbered or
 * removed) in minor versions.
 */
export type VrtConfigErrorCode =
  /** Required env var (`OPENROUTER_API_KEY`, `GEMINI_API_KEY`, `ANTHROPIC_API_KEY`) not set. */
  | "MISSING_KEY"
  /** Provider/model id doesn't resolve. */
  | "INVALID_MODEL"
  /** Model substring matches more than one candidate. */
  | "MULTIPLE_MATCHES"
  /** `VRT_LLM_PROVIDER` value is not one of the known providers. */
  | "INVALID_PROVIDER"
  /** No provider in the fallback chain has an API key configured. */
  | "NO_PROVIDER_AVAILABLE"
  /** An optional runtime dependency (e.g. `@google/generative-ai`) failed to import. */
  | "MISSING_DEPENDENCY";

export class VrtConfigError extends Error {
  readonly code: VrtConfigErrorCode;

  constructor(code: VrtConfigErrorCode, message: string) {
    super(message);
    this.name = "VrtConfigError";
    this.code = code;
  }
}
