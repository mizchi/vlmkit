/**
 * `check design` as a gate definition. Measurement code in
 * `../style/design-policy.ts` is untouched.
 *
 * This gate deliberately emits nothing above `warn` for its own two rules —
 * a drifting design system is information, not a broken page, and the gate
 * reports inconsistency rather than claiming which value is correct. Only
 * `redirected` is a suspect, because a report about the login screen is not
 * a report about the page that was asked for.
 */

import { readAll, readChoice, readFlag, readInt, readNumber } from "@mizchi/vlmkit-core/arg-reader.ts";
import { defineGate } from "@mizchi/vlmkit-core/plugin/contract.ts";
import type { Finding } from "@mizchi/vlmkit-core/plugin/contract.ts";
import {
  type DesignPolicyOptions,
  type DesignPolicyReport,
  formatDesignReport,
  runDesignPolicyCheck,
} from "../style/design-policy.ts";
import { firstPositional } from "./arg-helpers.ts";

export const designGate = defineGate<DesignPolicyReport, DesignPolicyOptions>({
  id: "check.design",
  command: ["check", "design"],
  title: "Design-system coherence",
  summary:
    "Coherence of the design system the page itself implies (component/spacing consistency)",
  usage: `Conformance to the design system the page itself implies: are components
styled consistently, and does spacing stay on the page's own scale? Reports
INCONSISTENCY, never which value is correct — taste stays with humans.

Findings are warn-level by design; a drifting design system is information,
not a broken page. Study behind the thresholds:
docs/design/design-policy-metrics.md`,
  rules: [
    {
      id: "component-drift",
      title: "Elements in one role are styled inconsistently",
      severity: "warn",
      docs: "Raise to suspect to enforce a house design system in CI.",
    },
    {
      id: "scale-outlier",
      title: "Spacing value off the page's own scale",
      severity: "info",
      docs: "Info by default — a one-off value is normal in real pages.",
    },
    { id: "redirected", title: "Requested URL redirected elsewhere", severity: "suspect" },
  ],
  inputs: [
    { name: "source", placeholder: "html-or-url", kind: "path-or-url", description: "Page to check", positional: 0, required: true },
    { name: "min-reuse", kind: "number", description: "Times each style must be reused", defaultDescription: "3" },
    { name: "min-instances", kind: "number", description: "Instances before a role is judged", defaultDescription: "3" },
    { name: "exclude", placeholder: "selector", kind: "string", description: "Exclude a vendor-owned subtree (audited)", repeatable: true },
    { name: "timeout", placeholder: "ms", kind: "number", description: "Page navigation timeout", defaultDescription: "30000" },
    {
      name: "wait-until",
      kind: "string",
      description: "Navigation wait state",
      choices: ["domcontentloaded", "load", "networkidle"],
      defaultDescription: "networkidle",
    },
    { name: "har", placeholder: "file", kind: "path", description: "Replay network responses from a Playwright HAR" },
    { name: "storage-state", placeholder: "file", kind: "path", description: "Playwright storage state for pages behind a login" },
  ],
  parse: (argv) => {
    const source = firstPositional(argv, "vlmkit check design <html-or-url>", ["--min-reuse", "--min-instances", "--exclude"]);
    // Validated at read time: `--min-reuse abc` used to become NaN, and since
    // every `reuse >= NaN` comparison is false, the gate reported every role
    // as drifting instead of saying the flag was wrong.
    const minReuse = readNumber(argv, "min-reuse", { min: 0 });
    const minInstances = readInt(argv, "min-instances", { min: 1 });
    const timeout = readInt(argv, "timeout", { min: 1 });
    const waitUntil = readChoice(argv, "wait-until", ["domcontentloaded", "load", "networkidle"] as const);
    const storageState = readFlag(argv, "storage-state");
    const har = readFlag(argv, "har");
    const exclude = readAll(argv, "exclude");
    return {
      source,
      ...(minReuse !== undefined ? { minReuse } : {}),
      ...(minInstances !== undefined ? { minInstances } : {}),
      ...(exclude.length > 0 ? { exclude } : {}),
      ...(timeout !== undefined ? { timeout } : {}),
      ...(waitUntil ? { waitUntil } : {}),
      ...(storageState ? { storageState } : {}),
      ...(har ? { har } : {}),
    };
  },
  run: (options) => runDesignPolicyCheck(options),
  findings: (report): Finding[] =>
    report.findings.map((finding) => ({
      rule: finding.kind,
      severity: finding.severity,
      message: finding.message,
      // This gate attributes to a *role* (a group of like elements), not to a
      // selector, so the role travels as evidence rather than being forced
      // into the selector field where it would read as something clickable.
      ...(finding.role ? { evidence: { role: finding.role } } : {}),
    })),
  format: formatDesignReport,
  // runDesignPolicyCheck appends its own entry.
  ledger: () => null,
});
