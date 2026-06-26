import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { estimateCost, billedCost, withPricing } from "./cost.ts";
import type { ModelTier } from "./types.ts";

const tier: ModelTier = {
  provider: "openrouter",
  model: "qwen/qwen3-coder-30b-a3b-instruct",
  vision: false,
  promptCostPerToken: 0.00000007,
  completionCostPerToken: 0.0000003,
};

describe("estimateCost", () => {
  it("multiplies tokens by per-token pricing", () => {
    const c = estimateCost(tier, { promptTokens: 1000, completionTokens: 500 });
    assert.equal(c, 1000 * 0.00000007 + 500 * 0.0000003);
  });
  it("is zero when pricing is absent", () => {
    const bare: ModelTier = { provider: "openrouter", model: "x", vision: false };
    assert.equal(estimateCost(bare, { promptTokens: 999, completionTokens: 999 }), 0);
  });
});

describe("billedCost", () => {
  it("trusts a provider cost when > 0", () => {
    assert.equal(billedCost(tier, 0.5, { promptTokens: 1000, completionTokens: 1000 }), 0.5);
  });
  it("falls back to the token estimate when provider reports 0 (OpenRouter)", () => {
    const c = billedCost(tier, 0, { promptTokens: 1000, completionTokens: 0 });
    assert.equal(c, 1000 * 0.00000007);
    assert.ok(c > 0, "OpenRouter cost must be > 0 so the budget cap works");
  });
});

describe("withPricing", () => {
  it("fills per-token pricing from a catalog map", () => {
    const tiers: ModelTier[] = [{ provider: "openrouter", model: "a/b", vision: false }];
    const out = withPricing(tiers, new Map([["a/b", { prompt: 0.001, completion: 0.002 }]]));
    assert.equal(out[0].promptCostPerToken, 0.001);
    assert.equal(out[0].completionCostPerToken, 0.002);
  });
});
