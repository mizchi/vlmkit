import type { LLMResponse } from "@mizchi/vlmkit-ai";

export interface GenerateInput {
  planMarkdown: string;
  testFilePath: string;
  rulesMarkdown?: string;
  helperImportPath?: string;
  seedTestPath?: string;
  requireScreenshots?: boolean;
  locatorInventory?: LocatorInventory;
}

export interface LocatorInventory {
  roles?: string[];
  labels?: string[];
  testIds?: string[];
  texts?: string[];
}

export interface GeneratorModelOptions {
  provider?: "anthropic" | "gemini" | "openrouter";
  model?: string;
  maxTokens?: number;
}

export interface GenerateRetryOptions {
  maxAttempts?: number;
}

export interface GenerateResult {
  source: string;
  diagnostics: string[];
  attempts: number;
  costUsd: number;
  provider?: string;
  model?: string;
}

export interface GenerateDeps {
  complete: (prompt: string) => Promise<Pick<LLMResponse, "content" | "costUsd" | "provider" | "model">>;
}
