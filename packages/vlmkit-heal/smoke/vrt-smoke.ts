/**
 * VRT-diff 疎通 smoke: drives the observe tier (ui-tars) through the heal loop.
 *
 * Mutates vrt-page.html so the committed screenshot baseline no longer matches,
 * runs a real Playwright VRT test, and lets the heal loop hand the failing
 * screenshot to the real ui-tars observe tier for an intentional-vs-regression
 * verdict. The codegen tier is stubbed to a no-op so this exercises ONLY the
 * observe path. Success = the observe tier actually ran on a real screenshot.
 *
 *   HEAL_REAL_LLM=1 node packages/vlmkit-heal/smoke/vrt-smoke.ts
 */
import { execSync } from "node:child_process";
import { readFileSync, writeFileSync, rmSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { heal, fetchOpenRouterPricing, withPricing } from "../src/index.ts";
import type { ModelTier } from "../src/index.ts";

const here = dirname(fileURLToPath(import.meta.url));
const pkg = join(here, "..");
const fixtures = join(pkg, "fixtures");
const pageFile = join(fixtures, "vrt-page.html");
const testFile = join(fixtures, "vrt.spec.ts");

const real = process.env.HEAL_REAL_LLM === "1";
const original = readFileSync(pageFile, "utf8");

// Intentional UI change: badge text + color.
const mutated = original
  .replace(">Active<", ">Archived<")
  .replace("#2563eb", "#dc2626");
writeFileSync(pageFile, mutated);

// observe = a cheap *reasoning* VLM for the intentional-vs-regression judgment.
// (ui-tars is GUI-grounding, not a judgment model — kept out of this tier.)
let observeTiers: ModelTier[] = [{ provider: "openrouter", model: "google/gemini-2.5-flash-lite", vision: true }];
if (real) {
  const pricing = await fetchOpenRouterPricing(process.env.OPENROUTER_API_KEY!);
  observeTiers = withPricing(observeTiers, pricing);
}

try {
  const result = await heal(
    {
      testCommand: "pnpm exec playwright test vrt.spec.ts",
      testFile,
      cwd: fixtures,
      observe: { tiers: observeTiers },
      codegen: { tiers: [{ provider: "openrouter", model: "qwen/qwen3-coder-30b-a3b-instruct", vision: false }] },
      updateSnapshotsCommand: "pnpm exec playwright test vrt.spec.ts --update-snapshots",
      expectedChange: "The status badge changes from a blue 'Active' to a red 'Archived'.",
      budgetUsd: 1,
      maxAttempts: 2,
    },
    real
      ? // real observe (ui-tars); stub codegen so only the observe path is exercised
        { codegen: { propose: async () => ({ costUsd: 0 }) } }
      : {
          captureActual: async () => Buffer.from("fake"),
          observe: { observe: async () => ({ verdict: "intentional-change", costUsd: 0 }) },
          codegen: { propose: async () => ({ costUsd: 0 }) },
        },
  );

  const observeAttempt = result.attempts.find((a) => a.phase === "observe");
  console.log("\n=== VRT-diff 疎通 result ===");
  console.log("verdict       :", result.verdict);
  console.log("observe ran   :", observeAttempt ? "yes (observe tier saw the screenshot)" : "no");
  console.log("observe cost  :", observeAttempt ? `$${observeAttempt.costUsd.toFixed(6)}` : "-");
  console.log("totalCost     :", `$${result.totalCostUsd.toFixed(6)}`);

  if (!observeAttempt) {
    console.error("FAIL: observe tier was never reached");
    process.exitCode = 1;
  } else {
    console.log("OK: VRT-diff routed to the observe tier on a real screenshot.");
  }
} finally {
  // Restore the fixture: page, baseline, and transient playwright output.
  writeFileSync(pageFile, original);
  rmSync(join(fixtures, "test-results"), { recursive: true, force: true });
  try {
    execSync("git checkout -- vrt.spec.ts-snapshots", { cwd: fixtures });
  } catch {
    /* snapshot not yet committed; ignore */
  }
}
