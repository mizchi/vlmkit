import { createUnifiedLLMClient } from "@mizchi/vlmkit-ai";
import type { ModelTier } from "./types.ts";
import { billedCost } from "./cost.ts";
import { openAICompatComplete } from "./openai-compat.ts";

/** Observe phase: a vision model (tier0 = ui-tars) judges a vrt-diff failure. */
export interface ObserveClient {
  observe(input: {
    tier: ModelTier;
    screenshotPng?: Buffer;
    textReport: string;
  }): Promise<{ verdict: "intentional-change" | "regression" | "unknown"; costUsd: number }>;
}

/** Codegen phase: a text model proposes a corrected test (or a baseline update). */
export interface CodegenClient {
  propose(input: {
    tier: ModelTier;
    errorKind: string;
    testSource: string;
    context: string;
  }): Promise<{ newTestSource?: string; updateBaseline?: boolean; costUsd: number }>;
}

// --- Real implementations (thin wrappers over @mizchi/vlmkit-ai) ---
//
// NOTE: tier.baseURL (self-hosted ui-tars) is not yet honored here; the real
// wrapper drives provider/model via createUnifiedLLMClient, so ui-tars must be
// reached through provider:"openrouter" (model "bytedance/ui-tars-*"). A
// baseURL-aware client is a follow-up; the mock path covers 疎通 meanwhile.

function clientFor(tier: ModelTier, vision: boolean) {
  const client = createUnifiedLLMClient({ provider: tier.provider, model: tier.model, vision });
  if (!client) {
    throw new Error(`no API key for provider "${tier.provider}" (model ${tier.model})`);
  }
  return client;
}

// One entry point for both axes: a self-hosted baseURL tier hits an
// OpenAI-compatible endpoint directly (ui-tars etc.), otherwise route through
// the vlmkit-ai unified client. Cost is billed from the tier's per-token price
// whenever the provider doesn't report one.
async function completeForTier(
  tier: ModelTier,
  prompt: string,
  vision: boolean,
  screenshotPng?: Buffer,
): Promise<{ content: string; costUsd: number }> {
  if (tier.baseURL) {
    const res = await openAICompatComplete({
      tier,
      text: prompt,
      screenshotPng,
      apiKey: process.env.VLMKIT_HEAL_BASEURL_KEY,
    });
    return { content: res.content, costUsd: billedCost(tier, 0, res) };
  }
  const client = clientFor(tier, vision);
  const content = screenshotPng
    ? [
        { type: "text" as const, text: prompt },
        { type: "image" as const, base64: screenshotPng.toString("base64"), mimeType: "image/png" },
      ]
    : prompt;
  const res = await client.completeWithImages(content);
  return { content: res.content, costUsd: billedCost(tier, res.costUsd, res) };
}

export function createRealObserveClient(): ObserveClient {
  return {
    async observe({ tier, screenshotPng, textReport }) {
      const prompt =
        "A visual regression test failed. Decide if the change looks like an " +
        "INTENTIONAL UI change or a REGRESSION. Answer with exactly one word: " +
        "intentional-change OR regression.\n\nReport:\n" + textReport;
      const res = await completeForTier(tier, prompt, true, screenshotPng);
      const word = res.content.toLowerCase();
      const verdict = word.includes("intentional")
        ? "intentional-change"
        : word.includes("regression")
          ? "regression"
          : "unknown";
      return { verdict, costUsd: res.costUsd };
    },
  };
}

export function createRealCodegenClient(): CodegenClient {
  return {
    async propose({ tier, errorKind, testSource, context }) {
      const prompt =
        `A Playwright test is failing (errorKind: ${errorKind}). Rewrite the ` +
        `WHOLE test file so it passes against the current UI. Output ONLY the ` +
        `full updated TypeScript file inside a single \`\`\`ts code block.\n\n` +
        `Context:\n${context}\n\nCurrent file:\n\`\`\`ts\n${testSource}\n\`\`\``;
      const res = await completeForTier(tier, prompt, false);
      const newTestSource = extractCodeBlock(res.content) ?? undefined;
      return { newTestSource, costUsd: res.costUsd };
    },
  };
}

function extractCodeBlock(text: string): string | null {
  const m = text.match(/```(?:ts|typescript)?\n([\s\S]*?)```/);
  return m ? m[1].trimEnd() : null;
}
