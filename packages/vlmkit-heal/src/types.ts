import type { LLMResponse } from "@mizchi/vlmkit-ai";

/** A model choice in an escalation ladder. Cheapest first, strongest last. */
export interface ModelTier {
  provider: "anthropic" | "gemini" | "openrouter";
  model: string;
  vision: boolean;
  /** For self-hosted / non-OpenRouter endpoints (e.g. ui-tars). */
  baseURL?: string;
  /** USD per prompt token. Used to estimate cost when the provider returns 0 (e.g. OpenRouter). */
  promptCostPerToken?: number;
  /** USD per completion token. */
  completionCostPerToken?: number;
}

export interface RouterOptions {
  /** Escalation ladder, cheapest first. */
  tiers: ModelTier[];
  /** Failures at a tier before moving up. Default 1. */
  escalateAfter?: number;
}

export interface ModelRouter {
  /** The tier to use right now. */
  current(): ModelTier;
  /** Advance a tier (after `escalateAfter` failures); stays put at the last tier. */
  escalate(): void;
  /** Accumulate this call's cost into the shared budget. */
  record(r: Pick<LLMResponse, "costUsd">): void;
  /** Total spent so far across the shared budget. */
  spentUsd(): number;
  /** True once the shared budget is exceeded. */
  exhausted(): boolean;
}

export interface HealOptions {
  /** Command whose exit code defines pass/fail, e.g. "pnpm exec playwright test x.spec.ts". */
  testCommand: string;
  /** The only source file the loop may edit. */
  testFile: string;
  cwd: string;
  /** Vision axis. tier0 = ui-tars: screenshot analysis / realized verdict. */
  observe: RouterOptions;
  /** Text axis. tier0 = cheap LLM -> last = strong model. Produces patches. */
  codegen: RouterOptions;
  /** Shared cap across BOTH routers; the summed cost exceeding it stops the loop. */
  budgetUsd: number;
  maxAttempts: number;
  /** Consecutive "gate green but verify red" observations before reporting flaky. Default 2. */
  flakyThreshold?: number;
  /** Default false: the final green patch needs human approval before commit. */
  autoApply?: boolean;
  /**
   * Declared expected UI change, if any. intentional-vs-regression cannot be
   * decided from pixels alone; this is the expectation the observe tier checks
   * the diff against (e.g. "the status badge changes from Active to Archived").
   */
  expectedChange?: string;
}

export type Verdict = "fixed" | "regression" | "intentional-change" | "flaky" | "give-up";

export type ErrorKind = "locator" | "timeout" | "vrt-diff" | "other";

export interface HealAttempt {
  tier: ModelTier;
  phase: "observe" | "codegen";
  costUsd: number;
  errorKind: ErrorKind;
  patch?: string;
}

export interface HealResult {
  verdict: Verdict;
  attempts: HealAttempt[];
  totalCostUsd: number;
  /** Diff/replacement applied to testFile and/or baseline. */
  finalPatch?: string;
}
