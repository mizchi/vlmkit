import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { createModelRouter, type Budget } from "./router.ts";
import { runTest as defaultRunTest, classify, type RunResult } from "./runner.ts";
import { applyPatch, commitPatch } from "./patch.ts";
import { findVrtArtifacts, findErrorContext } from "./capture.ts";
import { createRealCodegenClient, type CodegenClient } from "./clients.ts";
import { reviewVrtDiff, type VrtReview } from "./review.ts";
import type { HealAttempt, HealOptions, HealResult, ModelTier } from "./types.ts";

export interface HealDeps {
  runTest: (command: string, cwd: string) => Promise<RunResult>;
  /** Judge a vrt-diff (baseline vs actual) -> accept/reject/unsure. Default: reviewVrtDiff. */
  reviewVrt: (input: { baselinePng: Buffer; actualPng: Buffer; diffPng?: Buffer; expectedChange?: string; gitContext?: string; tier: ModelTier }) => Promise<VrtReview>;
  codegen: CodegenClient;
  /** Baseline files the loop is also allowed to overwrite (besides testFile). */
  baselineAllow?: string[];
  /** Command to refresh VRT baselines. Default: testCommand + " --update-snapshots". */
  updateSnapshotsCommand?: string;
  /** Grab the VRT screenshots (expected/actual/diff) for review. Default: newest from the outputDir. */
  captureVrt?: (cwd: string) => Promise<{ baseline?: Buffer; actual?: Buffer; diff?: Buffer }>;
  /** Page aria snapshot to feed codegen (real element names). Default: newest error-context.md. */
  captureContext?: (cwd: string) => Promise<string | undefined>;
}

/**
 * Self-healing loop. Runs the test command; on failure, observes (vision tier
 * for vrt-diff) and proposes a patch (text tier), escalating cheap -> strong
 * across a shared budget. Success requires two consecutive green runs.
 */
export async function heal(opts: HealOptions, deps?: Partial<HealDeps>): Promise<HealResult> {
  const d: HealDeps = {
    runTest: deps?.runTest ?? defaultRunTest,
    reviewVrt: deps?.reviewVrt ?? ((input) => reviewVrtDiff(input)),
    codegen: deps?.codegen ?? createRealCodegenClient(),
    baselineAllow: deps?.baselineAllow,
    updateSnapshotsCommand: deps?.updateSnapshotsCommand ?? opts.updateSnapshotsCommand,
    captureVrt: deps?.captureVrt ?? (async (cwd) => findVrtArtifacts(cwd, opts.outputDir)),
    captureContext: deps?.captureContext ?? (async (cwd) => findErrorContext(cwd, opts.outputDir)),
  };
  const acceptThreshold = opts.acceptThreshold ?? 0.8;
  const confirmAccept = opts.confirmAccept ?? true;

  let spent = 0;
  const budget: Budget = { budgetUsd: opts.budgetUsd, add: (n) => (spent += n), total: () => spent };
  const exhausted = () => budget.total() >= budget.budgetUsd;
  const observeRouter = createModelRouter(opts.observe, budget);
  const codegenRouter = createModelRouter(opts.codegen, budget);

  const allow = [resolve(opts.testFile), ...(d.baselineAllow ?? []).map((p) => resolve(p))];
  const attempts: HealAttempt[] = [];
  let finalPatch: string | undefined;
  let lastWasCodegen = false;
  let flakeStreak = 0;
  const flakyThreshold = opts.flakyThreshold ?? 2;

  // Snapshot the original so a non-"fixed" outcome leaves the working tree clean
  // (never leave an unverified patch behind on give-up/regression).
  const originalTestSource = readFileSync(opts.testFile, "utf8");

  const done = (verdict: HealResult["verdict"]): HealResult => {
    if (verdict === "fixed") {
      if (finalPatch) commitPatch(opts.testFile);
    } else {
      writeFileSync(opts.testFile, originalTestSource);
      commitPatch(opts.testFile); // drop any leftover .heal-bak
    }
    return { verdict, attempts, totalCostUsd: budget.total(), finalPatch };
  };

  for (let attempt = 0; attempt < opts.maxAttempts; attempt++) {
    if (exhausted()) return done("give-up");

    const run = await d.runTest(opts.testCommand, opts.cwd);
    if (run.ok) {
      // verify = two consecutive green runs (flaky-test removal)
      const v1 = await d.runTest(opts.testCommand, opts.cwd);
      const v2 = await d.runTest(opts.testCommand, opts.cwd);
      if (v1.ok && v2.ok) {
        return done("fixed");
      }
      // Gate passed but a verify run failed: the test CAN pass, so this is
      // instability, not a code bug. Don't patch it — retry, and report flaky
      // if it keeps happening.
      if (++flakeStreak >= flakyThreshold) return done("flaky");
      continue;
    }
    flakeStreak = 0;

    // A codegen patch from the previous iteration didn't fix it -> escalate.
    if (lastWasCodegen) codegenRouter.escalate();

    const output = `${run.stdout}\n${run.stderr}`;
    const errorKind = classify(output);

    // REVIEW: for a vrt-diff, judge baseline vs actual -> accept / reject / unsure.
    if (errorKind === "vrt-diff") {
      const art = await d.captureVrt?.(opts.cwd);
      if (art?.baseline && art.actual) {
        const tier = observeRouter.current();
        const review = await d.reviewVrt({
          baselinePng: art.baseline,
          actualPng: art.actual,
          diffPng: art.diff,
          expectedChange: opts.expectedChange,
          gitContext: opts.gitContext,
          tier,
        });
        observeRouter.record({ costUsd: review.costUsd });
        attempts.push({ tier, phase: "observe", costUsd: review.costUsd, errorKind });

        if (review.verdict === "reject") return done("regression");

        const accepted = review.verdict === "accept" && review.confidence >= acceptThreshold;
        if (accepted) {
          // An accept auto-updates the baseline, so a confidently-wrong accept (cheap
          // VLMs miss collateral breakage) is the dangerous case. Asymmetrically
          // confirm it with the STRONGEST observe tier before trusting it.
          const strong = opts.observe.tiers[opts.observe.tiers.length - 1];
          if (confirmAccept && strong && strong.model !== tier.model) {
            const confirm = await d.reviewVrt({
              baselinePng: art.baseline,
              actualPng: art.actual,
              diffPng: art.diff,
              expectedChange: opts.expectedChange,
              gitContext: opts.gitContext,
              tier: strong,
            });
            observeRouter.record({ costUsd: confirm.costUsd });
            attempts.push({ tier: strong, phase: "observe", costUsd: confirm.costUsd, errorKind });
            if (!(confirm.verdict === "accept" && confirm.confidence >= acceptThreshold)) {
              // The strong model disagrees -> don't bake it in; a human decides.
              return done("needs-review");
            }
          }
          // Intended change, confirmed -> refresh the baseline, then verify.
          const cmd = d.updateSnapshotsCommand ?? `${opts.testCommand} --update-snapshots`;
          await d.runTest(cmd, opts.cwd);
          finalPatch = "baseline-update";
          lastWasCodegen = false;
          continue;
        }
        // unsure, or accept below acceptThreshold -> do not auto-update; a human decides.
        return done("needs-review");
      }
      if (exhausted()) return done("give-up");
      // no VRT artifacts -> fall through and try a codegen patch.
    }

    // CODEGEN: rewrite the test to follow the current UI. Include the page aria
    // snapshot so the model knows the real element names (fixes locator breaks).
    const ctier = codegenRouter.current();
    const testSource = readFileSync(opts.testFile, "utf8");
    const pageSnapshot = await d.captureContext?.(opts.cwd);
    const contextParts = [
      formatGuardrailContext(opts.guardrailContext),
      pageSnapshot
        ? `${output.slice(0, 1500)}\n\nCurrent page snapshot (real roles/names):\n${pageSnapshot.slice(0, 1500)}`
        : output.slice(0, 2000),
    ].filter((part): part is string => Boolean(part));
    const context = contextParts.join("\n\n");
    const proposal = await d.codegen.propose({ tier: ctier, errorKind, testSource, context });
    codegenRouter.record({ costUsd: proposal.costUsd });
    attempts.push({ tier: ctier, phase: "codegen", costUsd: proposal.costUsd, errorKind, patch: proposal.newTestSource });

    if (proposal.updateBaseline) {
      const cmd = d.updateSnapshotsCommand ?? `${opts.testCommand} --update-snapshots`;
      await d.runTest(cmd, opts.cwd);
      finalPatch = "baseline-update";
      lastWasCodegen = false;
    } else if (proposal.newTestSource) {
      applyPatch({ file: opts.testFile, content: proposal.newTestSource, allow });
      finalPatch = proposal.newTestSource;
      lastWasCodegen = true;
    } else {
      // No usable patch -> escalate next time.
      codegenRouter.escalate();
      lastWasCodegen = false;
    }
  }

  return done("give-up");
}

function formatGuardrailContext(context: string | undefined): string | undefined {
  const trimmed = context?.trim();
  if (!trimmed) return undefined;
  return [
    "Original request/plan/locator guardrails:",
    trimmed.slice(0, 4000),
    "Do not weaken the scenario, drop primary interactions, or introduce locators outside the guardrails just to make the test pass.",
  ].join("\n");
}
