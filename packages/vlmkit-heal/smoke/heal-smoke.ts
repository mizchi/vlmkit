/**
 * 疎通 smoke: proves the heal loop drives a REAL Playwright run and heals a
 * real file. The LLM is mocked (returns the corrected locator) so the proof is
 * deterministic and needs no API key. Set HEAL_REAL_LLM=1 to drive real tiers
 * (cheap codegen -> sonnet, ui-tars observe) instead.
 *
 *   node packages/vlmkit-heal/smoke/heal-smoke.ts
 */
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { heal, fetchOpenRouterPricing, withPricing } from "../src/index.ts";
import type { ModelTier } from "../src/index.ts";

const here = dirname(fileURLToPath(import.meta.url));
const fixtures = join(here, "..", "fixtures");
const testFile = join(fixtures, "broken.spec.ts");

// What a competent codegen model would return: the same file with "Begin" -> "Start".
const CORRECTED = readFileSync(testFile, "utf8").replace('name: "Begin"', 'name: "Start"');

const original = readFileSync(testFile, "utf8");
const real = process.env.HEAL_REAL_LLM === "1";

// All tiers via OpenRouter (single OPENROUTER_API_KEY).
let observeTiers: ModelTier[] = [{ provider: "openrouter", model: "bytedance/ui-tars-1.5-7b", vision: true }];
let codegenTiers: ModelTier[] = [
  { provider: "openrouter", model: "qwen/qwen3-coder-30b-a3b-instruct", vision: false }, // cheapest
  { provider: "openrouter", model: "openai/gpt-4o-mini", vision: false }, // reliable fallback
];

// Fill per-token pricing so the budget cap is effective (OpenRouter reports costUsd: 0).
if (real) {
  const pricing = await fetchOpenRouterPricing(process.env.OPENROUTER_API_KEY!);
  observeTiers = withPricing(observeTiers, pricing);
  codegenTiers = withPricing(codegenTiers, pricing);
}

const result = await heal(
  {
    testCommand: "pnpm exec playwright test broken.spec.ts",
    testFile,
    cwd: fixtures,
    observe: { tiers: observeTiers },
    codegen: { tiers: codegenTiers },
    budgetUsd: 1,
    maxAttempts: 4,
  },
  real
    ? undefined
    : {
        observe: { observe: async () => ({ verdict: "unknown", costUsd: 0 }) },
        codegen: { propose: async () => ({ newTestSource: CORRECTED, costUsd: 0 }) },
      },
);

console.log("\n=== heal 疎通 result ===");
console.log("verdict   :", result.verdict);
console.log("attempts  :", result.attempts.map((a) => `${a.phase}/${a.errorKind}`).join(", "));
console.log("totalCost :", `$${result.totalCostUsd.toFixed(6)}`);

// Restore the fixture to its broken state so the smoke is repeatable.
writeFileSync(testFile, original);

if (result.verdict !== "fixed") {
  console.error("FAIL: expected verdict 'fixed'");
  process.exit(1);
}
console.log("OK: broken locator healed via real Playwright runs.");
