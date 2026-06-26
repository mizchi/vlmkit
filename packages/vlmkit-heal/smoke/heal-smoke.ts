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
import { heal } from "../src/index.ts";

const here = dirname(fileURLToPath(import.meta.url));
const fixtures = join(here, "..", "fixtures");
const testFile = join(fixtures, "broken.spec.ts");

// What a competent codegen model would return: the same file with "Begin" -> "Start".
const CORRECTED = readFileSync(testFile, "utf8").replace('name: "Begin"', 'name: "Start"');

const original = readFileSync(testFile, "utf8");
const real = process.env.HEAL_REAL_LLM === "1";

const result = await heal(
  {
    testCommand: "pnpm exec playwright test broken.spec.ts",
    testFile,
    cwd: fixtures,
    observe: { tiers: [{ provider: "openrouter", model: "bytedance/ui-tars-72b", vision: true }] },
    codegen: {
      tiers: [
        { provider: "gemini", model: "gemini-2.0-flash-lite", vision: false },
        { provider: "anthropic", model: "claude-sonnet-4-20250514", vision: false },
      ],
    },
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
