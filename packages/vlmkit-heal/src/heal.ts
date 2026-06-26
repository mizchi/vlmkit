import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { createModelRouter, type Budget } from "./router.ts";
import { runTest as defaultRunTest, classify, type RunResult } from "./runner.ts";
import { applyPatch, commitPatch } from "./patch.ts";
import { findActualScreenshot } from "./capture.ts";
import { createRealObserveClient, createRealCodegenClient, type ObserveClient, type CodegenClient } from "./clients.ts";
import type { HealAttempt, HealOptions, HealResult } from "./types.ts";

export interface HealDeps {
  runTest: (command: string, cwd: string) => Promise<RunResult>;
  observe: ObserveClient;
  codegen: CodegenClient;
  /** Baseline files the loop is also allowed to overwrite (besides testFile). */
  baselineAllow?: string[];
  /** Command to refresh VRT baselines. Default: testCommand + " --update-snapshots". */
  updateSnapshotsCommand?: string;
  /** Grab the failing screenshot to feed the observe tier. Default: newest test-results/*-actual.png. */
  captureActual?: (cwd: string, output: string) => Promise<Buffer | undefined>;
}

/**
 * Self-healing loop. Runs the test command; on failure, observes (vision tier
 * for vrt-diff) and proposes a patch (text tier), escalating cheap -> strong
 * across a shared budget. Success requires two consecutive green runs.
 */
export async function heal(opts: HealOptions, deps?: Partial<HealDeps>): Promise<HealResult> {
  const d: HealDeps = {
    runTest: deps?.runTest ?? defaultRunTest,
    observe: deps?.observe ?? createRealObserveClient(),
    codegen: deps?.codegen ?? createRealCodegenClient(),
    baselineAllow: deps?.baselineAllow,
    updateSnapshotsCommand: deps?.updateSnapshotsCommand,
    captureActual: deps?.captureActual ?? (async (cwd) => findActualScreenshot(cwd)),
  };

  let spent = 0;
  const budget: Budget = { budgetUsd: opts.budgetUsd, add: (n) => (spent += n), total: () => spent };
  const exhausted = () => budget.total() >= budget.budgetUsd;
  const observeRouter = createModelRouter(opts.observe, budget);
  const codegenRouter = createModelRouter(opts.codegen, budget);

  const allow = [resolve(opts.testFile), ...(d.baselineAllow ?? []).map((p) => resolve(p))];
  const attempts: HealAttempt[] = [];
  let finalPatch: string | undefined;
  let lastWasCodegen = false;

  const done = (verdict: HealResult["verdict"]): HealResult => ({
    verdict,
    attempts,
    totalCostUsd: budget.total(),
    finalPatch,
  });

  for (let attempt = 0; attempt < opts.maxAttempts; attempt++) {
    if (exhausted()) return done("give-up");

    const run = await d.runTest(opts.testCommand, opts.cwd);
    if (run.ok) {
      // verify = two consecutive green runs (flaky-test removal)
      const v1 = await d.runTest(opts.testCommand, opts.cwd);
      const v2 = await d.runTest(opts.testCommand, opts.cwd);
      if (v1.ok && v2.ok) {
        if (finalPatch) commitPatch(opts.testFile);
        return done("fixed");
      }
      // flaky: fall through and treat as failure
    }

    // A codegen patch from the previous iteration didn't fix it -> escalate.
    if (lastWasCodegen) codegenRouter.escalate();

    const output = `${run.stdout}\n${run.stderr}`;
    const errorKind = classify(output);

    // OBSERVE: for a vrt-diff, the vision tier (ui-tars) looks at the failing
    // screenshot and judges intentional-change vs regression.
    if (errorKind === "vrt-diff") {
      const tier = observeRouter.current();
      const screenshotPng = await d.captureActual?.(opts.cwd, output);
      const obs = await d.observe.observe({ tier, screenshotPng, textReport: output.slice(0, 2000) });
      observeRouter.record({ costUsd: obs.costUsd });
      attempts.push({ tier, phase: "observe", costUsd: obs.costUsd, errorKind });

      if (obs.verdict === "regression") return done("regression");
      if (obs.verdict === "intentional-change") {
        // Refresh the baseline (no test-code edit), then verify next iteration.
        const cmd = d.updateSnapshotsCommand ?? `${opts.testCommand} --update-snapshots`;
        await d.runTest(cmd, opts.cwd);
        finalPatch = "baseline-update";
        lastWasCodegen = false;
        continue;
      }
      if (exhausted()) return done("give-up");
      // verdict "unknown" -> fall through and try a codegen patch.
    }

    // CODEGEN: rewrite the test to follow the current UI.
    const ctier = codegenRouter.current();
    const testSource = readFileSync(opts.testFile, "utf8");
    const proposal = await d.codegen.propose({
      tier: ctier,
      errorKind,
      testSource,
      context: output.slice(0, 2000),
    });
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
