import type { ModelTier } from "./types.ts";

export interface TokenUsage {
  promptTokens: number;
  completionTokens: number;
}

/** Estimate USD from token usage and the tier's per-token pricing. */
export function estimateCost(tier: ModelTier, usage: TokenUsage): number {
  const p = tier.promptCostPerToken ?? 0;
  const c = tier.completionCostPerToken ?? 0;
  return usage.promptTokens * p + usage.completionTokens * c;
}

/**
 * The cost to bill for a response: trust the provider's `costUsd` when it
 * reports one (>0), otherwise fall back to the tier's per-token estimate.
 * OpenRouter returns `costUsd: 0`, so this is what makes the budget cap
 * effective for OpenRouter tiers.
 */
export function billedCost(tier: ModelTier, costUsd: number, usage: TokenUsage): number {
  return costUsd > 0 ? costUsd : estimateCost(tier, usage);
}

export interface Pricing {
  prompt: number;
  completion: number;
}

/** Fetch per-token pricing for every model from the OpenRouter catalog. */
export async function fetchOpenRouterPricing(apiKey: string): Promise<Map<string, Pricing>> {
  const res = await fetch("https://openrouter.ai/api/v1/models", {
    headers: { Authorization: `Bearer ${apiKey}` },
  });
  if (!res.ok) throw new Error(`OpenRouter models error: ${res.status}`);
  const data = (await res.json()) as { data: Array<{ id: string; pricing?: { prompt?: string; completion?: string } }> };
  const map = new Map<string, Pricing>();
  for (const m of data.data) {
    map.set(m.id, {
      prompt: parseFloat(m.pricing?.prompt ?? "0"),
      completion: parseFloat(m.pricing?.completion ?? "0"),
    });
  }
  return map;
}

/** Return a copy of tiers with per-token pricing filled in from a pricing map. */
export function withPricing(tiers: ModelTier[], pricing: Map<string, Pricing>): ModelTier[] {
  return tiers.map((t) => {
    const p = pricing.get(t.model);
    return p ? { ...t, promptCostPerToken: p.prompt, completionCostPerToken: p.completion } : t;
  });
}
