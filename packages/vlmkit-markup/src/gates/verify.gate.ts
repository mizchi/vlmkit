/**
 * The two `verify *` gates: markup (the one-shot done-condition verdict) and
 * flow (scripted action + deterministic post-condition).
 *
 * `verify markup` is the aggregate gate — it *runs other gates* and folds their
 * suspects into its verdict. Which gates is `DEFAULT_VERIFY_GATES` in
 * `markup-verify.ts` (check breakpoints / scan scroll / check animation /
 * check motion), overridable per call. They are driven through the same core
 * runner the CLI uses, so their counts come from the shared rule table and a
 * project's rule settings apply to them — which they did not when this was
 * four hand-written calls behind a four-value union.
 */

import { readFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { readAll, readFlag } from "@mizchi/vlmkit-core/arg-reader.ts";
import { UsageError } from "@mizchi/vlmkit-core/cli-error.ts";
import { defineGate } from "@mizchi/vlmkit-core/plugin/contract.ts";
import type { Finding } from "@mizchi/vlmkit-core/plugin/contract.ts";
import {
  type MarkupVerifyOptions,
  type MarkupVerifyReport,
  formatMarkupVerifyReport,
  runMarkupVerify,
} from "../verify/markup-verify.ts";
import {
  type Flow,
  type FlowVerifyReport,
  formatFlowReport,
  runFlowVerify,
} from "../inspect/flow-verify.ts";
import { firstPositional } from "./arg-helpers.ts";

export const verifyMarkupGate = defineGate<MarkupVerifyReport, MarkupVerifyOptions>({
  id: "verify.markup",
  command: ["verify", "markup"],
  title: "Markup done-condition verdict",
  summary:
    "One-shot done-condition verdict: composition per target + gates + pixel diff + kickback list with selector attribution",
  category: "verdict",
  usage: `One-shot done-condition verdict: composition per target viewport +
dynamic gates + rest-pose pixel diff, with a paste-ready kickback
listing every residual. Add --reference to print the calibration floor.`,
  rules: [
    {
      id: "target-failed",
      title: "A target viewport did not reach the done condition",
      severity: "suspect",
      docs: "Composition, gap or pixel-diff residuals for that target. The kickback lists each one.",
    },
    {
      id: "gate-suspect",
      title: "A dynamic gate reported suspects",
      severity: "suspect",
      docs: "One of DEFAULT_VERIFY_GATES. The kickback names the command to run for detail.",
    },
    {
      id: "regressed",
      title: "This attempt measures worse than the previous verify run",
      severity: "suspect",
      docs: "The trend comes from the run ledger. Revert the last change before trying anything else.",
    },
  ],
  inputs: [
    { name: "attempt", placeholder: "attempt.html", kind: "path", description: "Attempt page", positional: 0, required: true },
    {
      name: "target",
      placeholder: "png",
      kind: "path",
      description: "Target screenshot (width/height define the render viewport)",
      repeatable: true,
      required: true,
    },
    { name: "reference", placeholder: "html", kind: "path", description: "Reference page measured against the same targets (calibration floor)" },
    { name: "no-fix-context", kind: "boolean", description: "Skip selector attribution on kickback residuals (saves one page load)" },
  ],
  parse: (argv) => {
    const attempt = firstPositional(argv, "vlmkit verify markup <attempt.html> --target <png>", ["--target", "--reference"]);
    const targets = readAll(argv, "target");
    if (targets.length === 0) throw new UsageError("--target <png> is required (repeatable)");
    const reference = readFlag(argv, "reference");
    // Existence is checked here rather than in `run` so a typo fails before
    // the browser starts, the same reason integrity parses `--allow` in parse.
    if (!existsSync(attempt)) throw new UsageError(`attempt not found: ${attempt}`);
    for (const target of targets) {
      if (!existsSync(target)) throw new UsageError(`target not found: ${target}`);
    }
    if (reference && !existsSync(reference)) throw new UsageError(`reference not found: ${reference}`);
    return {
      attempt,
      targets,
      fixContext: !argv.includes("--no-fix-context"),
      ...(reference ? { reference } : {}),
    };
  },
  run: (options) => runMarkupVerify(options),
  findings: (report): Finding[] => {
    const findings: Finding[] = [];
    if (report.trend?.direction === "regressed") {
      findings.push({
        rule: "regressed",
        severity: "suspect",
        message:
          `worse than the previous run (targets passed ${report.trend.previous.targetsPassed}`
          + ` -> ${report.trend.current.targetsPassed}, residuals ${report.trend.previous.residuals}`
          + ` -> ${report.trend.current.residuals})`,
        evidence: { trend: report.trend },
      });
    }
    for (const target of report.targets) {
      if (target.pass) continue;
      findings.push({
        rule: "target-failed",
        severity: "suspect",
        message:
          `${target.target}: ${target.missingBlocking} missing, ${target.extraBlocking} extra,`
          + ` ${target.orderViolations} order, ${target.gapDeltas} gap,`
          + ` pixel diff ${(target.pixelDiffRatio * 100).toFixed(2)}%`,
        viewport: target.width,
        evidence: { target: target.target, matched: target.matched, renderedHeight: target.renderedHeight },
      });
    }
    for (const gate of report.gates) {
      if (gate.suspects === 0) continue;
      findings.push({
        rule: "gate-suspect",
        severity: "suspect",
        message: `gate ${gate.gate}: ${gate.suspects} suspect issue(s) — ${gate.summary}`,
        evidence: { gate: gate.gate, gateId: gate.gateId, suspects: gate.suspects, warns: gate.warns },
      });
    }
    return findings;
  },
  format: formatMarkupVerifyReport,
  headline: (report) =>
    `${report.done ? "DONE" : "NOT DONE"}`
    + ` (${report.targets.filter((t) => t.pass).length}/${report.targets.length} targets passed,`
    + ` ${report.kickback.length} kickback item(s))`,
  // runMarkupVerify appends its own entry — and the trend it reports is read
  // back out of that ledger, so a second write would corrupt the next run's
  // comparison.
  ledger: () => null,
});

export interface FlowGateOptions {
  source: string;
  flowPath: string;
  storageState?: string;
}

export const verifyFlowGate = defineGate<FlowVerifyReport, FlowGateOptions>({
  id: "verify.flow",
  command: ["verify", "flow"],
  title: "Verified scripted flow",
  summary: "Verified scripted browser flow: action -> deterministic post-condition assert (no LLM)",
  category: "verdict",
  usage: `Verified scripted browser flow: each step performs an action and
asserts a deterministic post-condition on the live DOM. FAILS at the
first unmet post-condition — "it did something" is not success. No LLM.

flow.json: { "viewport"?, "steps": [ { "label"?, "do": <action>, "expect": [<assert>...] } ] }
  action:  {action:"click", selector, force?} | {action:"focus"|"hover", selector}
           | {action:"press", key, selector?}
           | {action:"fill"|"type", selector, value|text} | {action:"wait", ms}
           (force skips actionability — use it to click a disabled control
            and assert that nothing changes)
  assert:  {assert:"attr", selector, name, equals} | {assert:"visible"|"hidden"|"focused", selector}
           | {assert:"text", selector, contains} | {assert:"count", selector, equals}`,
  rules: [
    {
      id: "step-failed",
      title: "A step's post-condition was not met",
      severity: "suspect",
      docs: "The flow stops at the first failure; later steps are not attempted.",
    },
    {
      id: "redirected",
      title: "Requested URL redirected elsewhere",
      severity: "suspect",
      docs: "Every step ran against a page the caller did not ask for — usually an expired session.",
    },
  ],
  inputs: [
    { name: "source", placeholder: "html-or-url", kind: "path-or-url", description: "Page to drive", positional: 0, required: true },
    { name: "flow", placeholder: "file", kind: "path", description: "Flow JSON", required: true },
    { name: "storage-state", placeholder: "file", kind: "path", description: "Playwright storage state for pages behind a login" },
  ],
  parse: (argv) => {
    const source = firstPositional(argv, "vlmkit verify flow <html-or-url> --flow <flow.json>", ["--flow"]);
    const flowPath = readFlag(argv, "flow");
    if (!flowPath) throw new UsageError("--flow <flow.json> is required");
    const storageState = readFlag(argv, "storage-state");
    return { source, flowPath, ...(storageState ? { storageState } : {}) };
  },
  run: async ({ source, flowPath, storageState }) => {
    let flow: Flow;
    try {
      flow = JSON.parse(await readFile(flowPath, "utf8")) as Flow;
    } catch (e) {
      if ((e as { code?: string }).code === "ENOENT") throw e;
      throw new UsageError(`--flow ${flowPath} is not valid JSON: ${e instanceof Error ? e.message : String(e)}`);
    }
    if (!Array.isArray(flow?.steps) || flow.steps.length === 0) {
      throw new UsageError(`--flow ${flowPath}: "steps" must be a non-empty array`);
    }
    return runFlowVerify({ source, flow, ...(storageState ? { storageState } : {}) });
  },
  findings: (report): Finding[] => {
    const findings: Finding[] = [];
    if (report.redirected) {
      findings.push({ rule: "redirected", severity: "suspect", message: report.redirected });
    }
    for (const step of report.steps) {
      if (step.passed) continue;
      findings.push({
        rule: "step-failed",
        severity: "suspect",
        message: `step ${step.index + 1}${step.label ? ` (${step.label})` : ""}: ${describeStepFailure(step)}`,
        evidence: { index: step.index, label: step.label, action: step.action, assertions: step.assertions },
      });
    }
    return findings;
  },
  format: formatFlowReport,
  headline: (report) => `${report.done ? "DONE" : "FAILED"} (${report.passed}/${report.total} steps)`,
  // runFlowVerify appends its own entry.
  ledger: () => null,
});

function describeStepFailure(step: FlowVerifyReport["steps"][number]): string {
  if (step.actionError) return `action ${step.action} failed: ${step.actionError}`;
  const failed = step.assertions.filter((a) => !a.passed);
  if (failed.length === 0) return `action ${step.action} failed`;
  return failed.map((a) => `${a.assert.assert} not met (measured ${a.actual})`).join("; ");
}
