/**
 * `check layout` as a gate definition. Measurement code in
 * `../inspect/layout-contract.ts` is untouched.
 *
 * This gate is the reason the rule table is shaped the way it is. `LayoutRule`
 * was already declarative data — a contract JSON lists assertions and
 * `evaluateLayoutRule` interprets them — which proved rules-as-data works
 * before the contract generalized it. Here the *assertion kinds* are the rule
 * table, so `--rule check.layout/near-miss...`-style tuning applies to the
 * assertion type while the contract file keeps holding the per-selector
 * expectations.
 *
 * `ledger` returns null on purpose: `runLayoutVerify` appends its own entry
 * from inside the measurement function, so letting the runner append too
 * would double-count every run in `.vlmkit/run-ledger.jsonl` — and the
 * ledger exists precisely so round counts stop being unreliable.
 */

import { readFile } from "node:fs/promises";
import { readFlag } from "@mizchi/vlmkit-core/arg-reader.ts";
import { UsageError } from "@mizchi/vlmkit-core/cli-error.ts";
import { defineGate } from "@mizchi/vlmkit-core/plugin/contract.ts";
import type { Finding } from "@mizchi/vlmkit-core/plugin/contract.ts";
import {
  type LayoutContract,
  type LayoutReport,
  type LayoutVerifyOptions,
  formatLayoutReport,
  runLayoutVerify,
} from "../inspect/layout-contract.ts";
import { firstPositional } from "./arg-helpers.ts";

/** `evaluateLayoutRule` names its checks in camelCase; rule ids are slugs. */
const CHECK_RULE_IDS: Record<string, string> = {
  visible: "visible",
  count: "count",
  width: "width",
  minWidth: "min-width",
  maxWidth: "max-width",
  minHeight: "min-height",
  fullWidth: "full-width",
  perRow: "per-row",
  above: "above",
  "(no assertion)": "no-assertion",
};

/**
 * The gate's own options: the contract is a *file path* on the command line
 * and a parsed object in `LayoutVerifyOptions`. Keeping them as separate
 * types means `parse` stays synchronous (it validates flags, it does not do
 * IO) and the read happens in `run`, where a missing file is a measurement
 * failure rather than a usage error.
 */
export interface LayoutGateOptions {
  source: string;
  contractPath: string;
  storageState?: string;
}

export const layoutGate = defineGate<LayoutReport, LayoutGateOptions>({
  id: "check.layout",
  command: ["check", "layout"],
  title: "Layout contract verification",
  summary:
    "Layout contract: verify a brief's structural requirements (widths, per-row counts, stacking order) per viewport — deterministic DOM math",
  usage: `Deterministic verification of a brief's structural requirements:
widths, per-row counts, stacking order, visibility — per viewport.
Turns "sidebar is 260px at 1280, stats are 2x2 at 768" into a
machine-checkable contract (DOM math, no VLM).`,
  rules: [
    { id: "visible", title: "Selector visibility matches the contract", severity: "suspect" },
    { id: "count", title: "Visible match count matches the contract", severity: "suspect" },
    { id: "width", title: "First match width within tolerance", severity: "suspect" },
    { id: "min-width", title: "First match at least this wide", severity: "suspect" },
    { id: "max-width", title: "First match at most this wide", severity: "suspect" },
    { id: "min-height", title: "Every match at least this tall", severity: "suspect" },
    { id: "full-width", title: "First match spans >=95% of the viewport", severity: "suspect" },
    { id: "per-row", title: "Modal matches-per-visual-row equals the contract", severity: "suspect" },
    { id: "above", title: "Every match ends above every match of another selector", severity: "suspect" },
    {
      id: "no-assertion",
      title: "Contract rule declares no assertion",
      severity: "suspect",
      docs: "A rule with no assertion field silently verifies nothing, so it is reported as a defect in the contract.",
    },
    {
      id: "redirected",
      title: "Requested URL redirected elsewhere",
      severity: "suspect",
      docs: "Every rule was evaluated against a page the caller did not ask for, so even an all-pass is not a pass.",
    },
  ],
  inputs: [
    { name: "source", placeholder: "html-or-url", kind: "path-or-url", description: "Page to check", positional: 0, required: true },
    {
      name: "contract",
      kind: "path",
      description: 'Contract JSON: { "rules": [ { selector, at, ...assertions } ] }',
      required: true,
    },
    {
      name: "storage-state",
      kind: "path",
      description: "Playwright storage state, to measure pages behind a login",
    },
  ],
  parse: (argv) => {
    const source = firstPositional(argv, "vlmkit check layout <html-or-url> --contract <contract.json>");
    const contractPath = readFlag(argv, "contract");
    if (!contractPath) throw new UsageError("--contract <contract.json> is required");
    const storageState = readFlag(argv, "storage-state");
    return { source, contractPath, ...(storageState ? { storageState } : {}) };
  },
  run: async ({ source, contractPath, storageState }) => {
    let contract: LayoutContract;
    try {
      contract = JSON.parse(await readFile(contractPath, "utf8")) as LayoutContract;
    } catch (e) {
      // ENOENT keeps its own handling — `handleCliError` renders it as
      // "file not found: <path>", which is better than anything said here.
      if ((e as { code?: string }).code === "ENOENT") throw e;
      throw new UsageError(`--contract ${contractPath} is not valid JSON: ${e instanceof Error ? e.message : String(e)}`);
    }
    if (!Array.isArray(contract?.rules) || contract.rules.length === 0) {
      throw new UsageError(`--contract ${contractPath}: "rules" must be a non-empty array`);
    }
    const options: LayoutVerifyOptions = { source, contract, ...(storageState ? { storageState } : {}) };
    return runLayoutVerify(options);
  },
  findings: (report): Finding[] => {
    const findings: Finding[] = [];
    if (report.redirected) {
      findings.push({ rule: "redirected", severity: "suspect", message: report.redirected });
    }
    for (const result of report.results) {
      for (const check of result.checks) {
        if (check.passed) continue;
        findings.push({
          rule: CHECK_RULE_IDS[check.name] ?? "no-assertion",
          severity: "suspect",
          message: `${check.name}: expected ${check.expected}, measured ${check.measured}`,
          selector: result.rule.selector,
          viewport: result.viewport,
        });
      }
    }
    return findings;
  },
  format: formatLayoutReport,
  // See the module docstring: runLayoutVerify already appends its own entry.
  ledger: () => null,
});
