// CI: when a Playwright VRT (toHaveScreenshot) fails, let a model decide whether
// the change is intended (accept -> update baselines) or a regression (reject).
// Requires `@mizchi/vlmkit-heal` (devDep) and an OPENROUTER_API_KEY secret.
//   node vrt-review.mjs
import { execSync } from "node:child_process";
import { findVrtArtifacts, reviewVrtDiff, collectGitContext } from "@mizchi/vlmkit-heal";

const cwd = process.cwd();
const { baseline, actual, diff } = findVrtArtifacts(cwd);
if (!baseline || !actual) {
  console.log("no VRT artifacts found; nothing to review");
  process.exit(0);
}

const review = await reviewVrtDiff({
  baselinePng: baseline,
  actualPng: actual,
  diffPng: diff,
  // optional explicit intent (e.g. from the PR description); else inferred from git
  expectedChange: process.env.EXPECTED_CHANGE,
  gitContext: collectGitContext(cwd, {
    base: process.env.GITHUB_BASE_REF ? `origin/${process.env.GITHUB_BASE_REF}` : undefined,
  }),
  // Use a CAPABLE reasoning VLM — small VLMs miss collateral breakage.
  tier: { provider: "openrouter", model: "openai/gpt-5-mini", vision: true },
});

console.log(`VRT review: ${review.verdict} (confidence ${review.confidence}, via ${review.intentSource})`);
console.log(`reason: ${review.reason}`);

if (review.verdict === "accept" && review.confidence >= 0.8) {
  // Intended change: refresh the baselines here; a later workflow step commits them.
  execSync("pnpm exec playwright test --update-snapshots", { stdio: "inherit" });
  console.log("::notice::Intended change accepted — baselines updated.");
  process.exit(0);
}
if (review.verdict === "reject") {
  console.log("::error::VRT regression — the model rejected the change.");
  process.exit(1);
}
console.log("::warning::VRT change needs human review (unsure / low confidence).");
process.exit(1);
