/**
 * Run @mizchi/vlmkit-heal after Playwright Test Agents generated a spec.
 *
 * Usage:
 *   OPENROUTER_API_KEY=... npx tsx examples/test-agents/heal-after-generator.ts tests/<topic>.spec.ts
 *
 * Optional:
 *   EXPECTED_CHANGE="The status badge changes from Active to Archived"
 *   TEST_COMMAND="pnpm exec playwright test tests/<topic>.spec.ts"
 *   UPDATE_SNAPSHOTS_COMMAND="pnpm exec playwright test tests/<topic>.spec.ts --update-snapshots"
 *   BUDGET_USD=1.00
 *   MAX_ATTEMPTS=4
 *   OUTPUT_DIR=test-results
 *   GIT_BASE=origin/main
 *   GUARDRAIL_CONTEXT_FILE=specs/<topic>.plan.md
 *   GUARDRAIL_CONTEXT="original request / plan / locator inventory"
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  collectGitContext,
  fetchOpenRouterPricing,
  heal,
  withPricing,
  type ModelTier,
} from "@mizchi/vlmkit-heal";

const testFileArg = process.argv[2] ?? process.env.TEST_FILE;
if (!testFileArg) {
  console.error("Usage: npx tsx examples/test-agents/heal-after-generator.ts tests/<topic>.spec.ts");
  process.exit(2);
}

const openRouterKey = process.env.OPENROUTER_API_KEY;
if (!openRouterKey) {
  console.error("OPENROUTER_API_KEY is required");
  process.exit(2);
}

const pricing = await fetchOpenRouterPricing(openRouterKey);

const observeTiers: ModelTier[] = withPricing([
  { provider: "openrouter", model: "openai/gpt-5-mini", vision: true },
  { provider: "openrouter", model: "anthropic/claude-sonnet-4.6", vision: true },
], pricing);

const codegenTiers: ModelTier[] = withPricing([
  { provider: "openrouter", model: "qwen/qwen3-coder-30b-a3b-instruct", vision: false },
  { provider: "openrouter", model: "openai/gpt-5-codex", vision: false },
], pricing);

const testCommand = process.env.TEST_COMMAND ?? `pnpm exec playwright test ${testFileArg}`;
const guardrailContextFile = process.env.GUARDRAIL_CONTEXT_FILE;
const guardrailContext = guardrailContextFile
  ? readFileSync(guardrailContextFile, "utf8")
  : process.env.GUARDRAIL_CONTEXT;
const result = await heal({
  testCommand,
  updateSnapshotsCommand: process.env.UPDATE_SNAPSHOTS_COMMAND ?? `${testCommand} --update-snapshots`,
  testFile: resolve(testFileArg),
  cwd: process.cwd(),
  observe: { tiers: observeTiers },
  codegen: { tiers: codegenTiers },
  budgetUsd: Number(process.env.BUDGET_USD ?? "1"),
  maxAttempts: Number(process.env.MAX_ATTEMPTS ?? "4"),
  outputDir: process.env.OUTPUT_DIR,
  expectedChange: process.env.EXPECTED_CHANGE,
  guardrailContext,
  gitContext: process.env.NO_GIT_CONTEXT === "1"
    ? undefined
    : collectGitContext(process.cwd(), { base: process.env.GIT_BASE ?? "origin/main" }),
});

console.log(JSON.stringify({
  verdict: result.verdict,
  totalCostUsd: result.totalCostUsd,
  attempts: result.attempts.map((a) => ({
    phase: a.phase,
    errorKind: a.errorKind,
    model: a.tier.model,
    costUsd: a.costUsd,
  })),
}, null, 2));

process.exitCode = result.verdict === "fixed" ? 0 : 1;
