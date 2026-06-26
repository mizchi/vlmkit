/**
 * Flaky 疎通: a genuinely flaky Playwright test (fails every 3rd run) must be
 * reported as `flaky` — NOT "fixed", and NOT patched. No LLM is needed: the
 * flaky path never reaches the codegen/observe tiers.
 *
 *   node packages/vlmkit-heal/smoke/dogfood-flaky.ts
 */
import { rmSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { heal } from "../src/index.ts";

const here = dirname(fileURLToPath(import.meta.url));
const fixtures = join(here, "..", "fixtures");

rmSync(join(fixtures, "_flaky_count.txt"), { force: true }); // reset counter

const dummy = { provider: "openrouter", model: "unused", vision: false } as const;
try {
  const result = await heal(
    {
      testCommand: "pnpm exec playwright test flaky.spec.ts",
      testFile: join(fixtures, "flaky.spec.ts"),
      cwd: fixtures,
      observe: { tiers: [dummy] },
      codegen: { tiers: [dummy] },
      budgetUsd: 1,
      maxAttempts: 5,
      flakyThreshold: 2,
    },
    {
      // assert these are never invoked on the flaky path
      observe: { observe: async () => { throw new Error("observe must not run for flaky"); } },
      codegen: { propose: async () => { throw new Error("codegen must not run for flaky"); } },
    },
  );
  console.log("\n=== Flaky 疎通 result ===");
  console.log("verdict :", result.verdict);
  console.log("attempts:", result.attempts.length, "(no observe/codegen attempts expected)");
  if (result.verdict !== "flaky") {
    console.error("FAIL: expected verdict 'flaky'");
    process.exitCode = 1;
  } else {
    console.log("OK: a genuinely flaky test was reported as flaky, not patched.");
  }
} finally {
  rmSync(join(fixtures, "_flaky_count.txt"), { force: true });
  rmSync(join(fixtures, "test-results"), { recursive: true, force: true });
  rmSync(join(fixtures, "..", "test-results"), { recursive: true, force: true });
}
