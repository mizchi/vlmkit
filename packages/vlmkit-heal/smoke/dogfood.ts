/**
 * Dogfood harness: take the canonical GREEN test, break it in several realistic
 * ways, and check the heal loop restores green via real OpenRouter codegen.
 *
 *   HEAL_REAL_LLM=1 node packages/vlmkit-heal/smoke/dogfood.ts
 */
import { readFileSync, writeFileSync, rmSync } from "node:fs";
import { dirname, join, basename } from "node:path";
import { fileURLToPath } from "node:url";
import { heal, fetchOpenRouterPricing, withPricing } from "../src/index.ts";
import type { ModelTier, HealResult } from "../src/index.ts";

const here = dirname(fileURLToPath(import.meta.url));
const fixtures = join(here, "..", "fixtures");
const canonical = readFileSync(join(fixtures, "canonical.spec.ts"), "utf8");

interface Mutation {
  name: string;
  from: string;
  to: string;
}

// Each breaks the canonical test in a different, realistic way.
const MUTATIONS: Mutation[] = [
  { name: "locator: button name", from: 'name: "Submit"', to: 'name: "Send"' },
  { name: "locator: placeholder", from: '"Email address"', to: '"E-mail"' },
  { name: "assert: heading text", from: 'toHaveText("Dashboard")', to: 'toHaveText("Welcome")' },
  { name: "assert: result text", from: 'toHaveText("submitted")', to: 'toHaveText("done")' },
  { name: "assert: item count", from: "toHaveCount(2)", to: "toHaveCount(5)" },
];

const real = process.env.HEAL_REAL_LLM === "1";
let codegenTiers: ModelTier[] = [
  { provider: "openrouter", model: "qwen/qwen3-coder-30b-a3b-instruct", vision: false },
  { provider: "openrouter", model: "openai/gpt-4o-mini", vision: false },
];
if (real) {
  const pricing = await fetchOpenRouterPricing(process.env.OPENROUTER_API_KEY!);
  codegenTiers = withPricing(codegenTiers, pricing);
}

interface Row {
  name: string;
  verdict: HealResult["verdict"];
  attempts: number;
  tiersUsed: string;
  costUsd: number;
}
const rows: Row[] = [];

for (let i = 0; i < MUTATIONS.length; i++) {
  const mut = MUTATIONS[i];
  if (!canonical.includes(mut.from)) {
    console.error(`SKIP "${mut.name}": pattern not found in canonical`);
    continue;
  }
  const specName = `_dogfood_${i}.spec.ts`;
  const specPath = join(fixtures, specName);
  writeFileSync(specPath, canonical.replace(mut.from, mut.to));

  try {
    const result = await heal(
      {
        testCommand: `pnpm exec playwright test ${specName}`,
        testFile: specPath,
        cwd: fixtures,
        observe: { tiers: [{ provider: "openrouter", model: "google/gemini-2.5-flash-lite", vision: true }] },
        codegen: { tiers: codegenTiers },
        budgetUsd: 1,
        maxAttempts: 4,
      },
      real ? undefined : { codegen: { propose: async () => ({ newTestSource: canonical, costUsd: 0 }) } },
    );
    rows.push({
      name: mut.name,
      verdict: result.verdict,
      attempts: result.attempts.length,
      tiersUsed: [...new Set(result.attempts.map((a) => a.tier.model.split("/").pop()))].join(" -> ") || "-",
      costUsd: result.totalCostUsd,
    });
    console.log(`[${i + 1}/${MUTATIONS.length}] ${mut.name}: ${result.verdict}`);
  } finally {
    rmSync(specPath, { force: true });
    rmSync(specPath + ".heal-bak", { force: true });
  }
}

rmSync(join(fixtures, "test-results"), { recursive: true, force: true });
rmSync(join(fixtures, "..", "test-results"), { recursive: true, force: true });

console.log("\n=== Dogfood summary ===");
for (const r of rows) {
  const mark = r.verdict === "fixed" ? "OK " : "XX ";
  console.log(
    `${mark} ${r.name.padEnd(24)} verdict=${r.verdict.padEnd(8)} attempts=${r.attempts} tiers=[${r.tiersUsed}] $${r.costUsd.toFixed(6)}`,
  );
}
const fixed = rows.filter((r) => r.verdict === "fixed").length;
console.log(`\nfixed ${fixed}/${rows.length}  total $${rows.reduce((s, r) => s + r.costUsd, 0).toFixed(6)}`);
process.exitCode = fixed === rows.length ? 0 : 1;
