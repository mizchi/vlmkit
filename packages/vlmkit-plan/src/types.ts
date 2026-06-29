import type { LLMResponse } from "@mizchi/vlmkit-ai";

export interface SeedTestRef {
  path: string;
  source?: string;
}

export interface UiObservation {
  url?: string;
  title?: string;
  roles?: string[];
  labels?: string[];
  testIds?: string[];
  texts?: string[];
  notes?: string[];
}

export interface PlanInput {
  title: string;
  request: string;
  seed?: SeedTestRef;
  prd?: string;
  observations?: UiObservation[];
  constraints?: string[];
}

export interface PlanLocatorInventory {
  roles?: string[];
  labels?: string[];
  testIds?: string[];
  texts?: string[];
}

export interface PlanScenario {
  title: string;
  seed?: string;
  steps: string[];
  expectedResults: string[];
  locatorHints?: string[];
  vrt?: {
    startState?: string;
    goalState?: string;
  };
}

export interface StructuredPlan {
  title: string;
  applicationOverview: string;
  scenarios: PlanScenario[];
  generationNotes: string[];
  locatorInventory?: PlanLocatorInventory;
}

export interface PlannerModelOptions {
  provider?: "anthropic" | "gemini" | "openrouter";
  model?: string;
  maxTokens?: number;
}

export interface PlanRetryOptions {
  maxAttempts?: number;
}

export interface PlanResult {
  markdown: string;
  diagnostics: string[];
  attempts: number;
  costUsd: number;
  provider?: string;
  model?: string;
}

export interface StructuredPlanResult extends PlanResult {
  plan: StructuredPlan | null;
}

export interface PlanDeps {
  complete: (prompt: string) => Promise<Pick<LLMResponse, "content" | "costUsd" | "provider" | "model">>;
}
