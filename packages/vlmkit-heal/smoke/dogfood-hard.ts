/**
 * Harder dogfood scenarios: multi-break, element removal (delete-line judgment),
 * real budget cap, and real tier escalation. Each declares an expected verdict.
 *
 *   HEAL_REAL_LLM=1 node packages/vlmkit-heal/smoke/dogfood-hard.ts
 */
import { readFileSync, writeFileSync, rmSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { heal, fetchOpenRouterPricing, withPricing } from "../src/index.ts";
import type { ModelTier, HealOptions, HealResult, Verdict } from "../src/index.ts";

const here = dirname(fileURLToPath(import.meta.url));
const fixtures = join(here, "..", "fixtures");
const canonical = readFileSync(join(fixtures, "canonical.spec.ts"), "utf8");
const real = process.env.HEAL_REAL_LLM === "1";

let pricing: Map<string, { prompt: number; completion: number }> | undefined;
if (real) pricing = await fetchOpenRouterPricing(process.env.OPENROUTER_API_KEY!);
const price = (tiers: ModelTier[]) => (pricing ? withPricing(tiers, pricing) : tiers);

const CODER: ModelTier = { provider: "openrouter", model: "qwen/qwen3-coder-30b-a3b-instruct", vision: false };
const FALLBACK: ModelTier = { provider: "openrouter", model: "openai/gpt-4o-mini", vision: false };
const UITARS: ModelTier = { provider: "openrouter", model: "bytedance/ui-tars-1.5-7b", vision: true };

interface Scenario {
  name: string;
  transform: (src: string) => string;
  override: Partial<HealOptions>;
  expect: Verdict;
  why: string;
}

const SCENARIOS: Scenario[] = [
  {
    name: "multi-break (locator + assert)",
    transform: (s) => s.replace('name: "Submit"', 'name: "Send"').replace('toHaveText("Dashboard")', 'toHaveText("Welcome")'),
    override: { codegen: { tiers: price([CODER, FALLBACK]) }, budgetUsd: 1, maxAttempts: 4 },
    expect: "fixed",
    why: "two breakages fixed in one rewrite",
  },
  {
    name: "element removed (delete line)",
    transform: (s) =>
      s.replace(
        'await page.getByRole("button", { name: "Submit" }).click();',
        'await page.getByRole("button", { name: "Submit" }).click();\n  await page.getByRole("button", { name: "Cancel" }).click();',
      ),
    override: { codegen: { tiers: price([CODER, FALLBACK]) }, budgetUsd: 1, maxAttempts: 4 },
    expect: "fixed",
    why: "no Cancel button exists; correct fix is to remove the bogus line",
  },
  {
    name: "budget cap (tiny budget)",
    transform: (s) => s.replace('name: "Submit"', 'name: "Send"'),
    override: { codegen: { tiers: price([CODER]) }, budgetUsd: 0.00003, maxAttempts: 4 },
    expect: "give-up",
    why: "one call exceeds the budget -> hard stop (safety)",
  },
  {
    name: "escalation (ui-tars tier0 -> coder tier1)",
    transform: (s) => s.replace('name: "Submit"', 'name: "Send"'),
    override: { codegen: { tiers: price([UITARS, CODER]) }, budgetUsd: 1, maxAttempts: 5 },
    expect: "fixed",
    why: "ui-tars can't produce code -> escalate to the coder tier",
  },
];

interface Row { name: string; got: Verdict; want: Verdict; ok: boolean; tiers: string; attempts: number; cost: number }
const rows: Row[] = [];

for (let i = 0; i < SCENARIOS.length; i++) {
  const sc = SCENARIOS[i];
  const specName = `_hard_${i}.spec.ts`;
  const specPath = join(fixtures, specName);
  writeFileSync(specPath, sc.transform(canonical));
  try {
    const result: HealResult = await heal(
      {
        testCommand: `pnpm exec playwright test ${specName}`,
        testFile: specPath,
        cwd: fixtures,
        observe: { tiers: price([{ provider: "openrouter", model: "google/gemini-2.5-flash-lite", vision: true }]) },
        codegen: { tiers: price([CODER]) },
        budgetUsd: 1,
        maxAttempts: 4,
        ...sc.override,
      },
      real ? undefined : { codegen: { propose: async () => ({ newTestSource: canonical, costUsd: 0 }) } },
    );
    rows.push({
      name: sc.name,
      got: result.verdict,
      want: sc.expect,
      ok: result.verdict === sc.expect,
      tiers: [...new Set(result.attempts.map((a) => a.tier.model.split("/").pop()))].join(" -> ") || "-",
      attempts: result.attempts.length,
      cost: result.totalCostUsd,
    });
    console.log(`[${i + 1}/${SCENARIOS.length}] ${sc.name}: got=${result.verdict} want=${sc.expect}`);
  } finally {
    rmSync(specPath, { force: true });
    rmSync(specPath + ".heal-bak", { force: true });
  }
}

rmSync(join(fixtures, "test-results"), { recursive: true, force: true });
rmSync(join(fixtures, "..", "test-results"), { recursive: true, force: true });

console.log("\n=== Hard dogfood summary ===");
for (const r of rows) {
  console.log(
    `${r.ok ? "OK " : "XX "} ${r.name.padEnd(38)} got=${r.got.padEnd(8)} want=${r.want.padEnd(8)} tiers=[${r.tiers}] attempts=${r.attempts} $${r.cost.toFixed(6)}`,
  );
}
const pass = rows.filter((r) => r.ok).length;
console.log(`\nexpected-verdict ${pass}/${rows.length}  total $${rows.reduce((s, r) => s + r.cost, 0).toFixed(6)}`);
process.exitCode = pass === rows.length ? 0 : 1;
