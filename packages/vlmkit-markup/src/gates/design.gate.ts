/**
 * `check design` as a gate definition. Measurement lives in
 * `../style/design-policy.ts`; this file only declares the surface.
 *
 * This gate deliberately emits nothing above `warn` for its own two rules —
 * a drifting design system is information, not a broken page, and the gate
 * reports inconsistency rather than claiming which value is correct. Only
 * `redirected` is a suspect, because a report about the login screen is not
 * a report about the page that was asked for.
 */

import { readAll, readChoice, readFlag, readInt, readNumber } from "@mizchi/vlmkit-core/arg-reader.ts";
import { defineGate } from "@mizchi/vlmkit-core/plugin/contract.ts";
import { PAGE_LOAD_INPUTS, parsePageLoad } from "@mizchi/vlmkit-core/page-load.ts";
import type { Finding } from "@mizchi/vlmkit-core/plugin/contract.ts";
import {
  DESIGN_ALLOW_HELP,
  formatDesignReport,
  parseDesignAllowRules,
  runDesignPolicyCheck,
  runSceneDesignPolicyCheck,
  type DesignPolicyOptions,
  type DesignPolicyReport,
} from "../style/design-policy.ts";
import { firstPositional, firstPositionalOrUndefined } from "@mizchi/vlmkit-core/plugin/args.ts";
import { UsageError } from "@mizchi/vlmkit-core/cli-error.ts";

export const designGate = defineGate<DesignPolicyReport, DesignPolicyOptions & { elementsPath?: string }>({
  id: "check.design",
  command: ["check", "design"],
  title: "Design-system coherence",
  summary:
    "Coherence of the design system the page itself implies (component/spacing consistency)",
  category: "design-system",
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
    {
      id: "nothing-judged",
      title: "No role had enough instances to judge, so the reuse check ran on nothing",
      severity: "info",
      docs:
        "Info by default — a genuinely small page is not a defect. Raise to suspect to"
        + " enforce that this gate must actually measure something, which is what stops a"
        + " --min-instances / --allow combination from reporting green forever in silence.",
    },
    { id: "redirected", title: "Requested URL redirected elsewhere", severity: "suspect" },
  ],
  inputs: [
    { name: "source", placeholder: "html-or-url", kind: "path-or-url", description: "Page to check (omit when using --elements)", positional: 0 },
    {
      name: "elements",
      placeholder: "scene.json",
      kind: "path",
      description: "A scene instead of a page — canvas/WebGPU, native, a game HUD (no browser). Groups by `role`; padding/radius/border/background/font form the signature",
    },
    { name: "min-reuse", kind: "number", description: "Times each style must be reused", defaultDescription: "3" },
    { name: "min-instances", kind: "number", description: "Instances before a role is judged", defaultDescription: "3" },
    {
      name: "exclude",
      placeholder: "selector",
      kind: "string",
      // No `--allow` twin here on purpose: this gate's findings attribute to a
      // ROLE, not a selector, so forgiving one would forgive the whole role and
      // delete the signal for the caller's own components too. Scoping the
      // measurement is the only granularity the metric has. Every exclusion is
      // reported with its element count, and one that removes nothing warns.
      description: "Exclude a vendor-owned subtree; each is reported with what it removed",
      repeatable: true,
    },
    {
      name: "allow",
      placeholder: "<selector>;<reason>",
      kind: "string",
      repeatable: true,
      description: DESIGN_ALLOW_HELP,
    },
    { name: "storage-state", placeholder: "file", kind: "path", description: "Playwright storage state for pages behind a login" },
    // Spread, not re-declared — see the note in `integrity.gate.ts`.
    ...PAGE_LOAD_INPUTS,
  ],
  parse: (argv) => {
    const valueFlags = ["--min-reuse", "--min-instances", "--exclude", "--allow", "--elements"];
    const elements = readFlag(argv, "elements");
    if (elements) {
      // Mutually exclusive with a page, as in `check integrity` and `check color`.
      if (firstPositionalOrUndefined(argv, valueFlags)) {
        throw new UsageError("check design takes either a page source or --elements, not both.");
      }
      if (readAll(argv, "exclude").length > 0) {
        throw new UsageError("--exclude scopes a page's DOM; a scene is already the elements you chose to write, so leave the vendor subtree out of it.");
      }
      const minReuse = readNumber(argv, "min-reuse", { min: 0 });
      const minInstances = readInt(argv, "min-instances", { min: 1 });
      const allow = readAll(argv, "allow");
      parseDesignAllowRules(allow);
      return {
        source: elements,
        elementsPath: elements,
        ...(minReuse !== undefined ? { minReuse } : {}),
        ...(minInstances !== undefined ? { minInstances } : {}),
        ...(allow.length > 0 ? { allow } : {}),
      };
    }
    const source = firstPositional(argv, "vlmkit check design <html-or-url> | --elements <scene.json>", valueFlags);
    // Validated at read time: `--min-reuse abc` used to become NaN, and since
    // every `reuse >= NaN` comparison is false, the gate reported every role
    // as drifting instead of saying the flag was wrong.
    const minReuse = readNumber(argv, "min-reuse", { min: 0 });
    const minInstances = readInt(argv, "min-instances", { min: 1 });
    const pageLoad = parsePageLoad(argv);
    const timeout = pageLoad.timeout;
    const waitUntil = pageLoad.waitUntil;
    const storageState = readFlag(argv, "storage-state");
    const har = pageLoad.har;
    const exclude = readAll(argv, "exclude");
    const allow = readAll(argv, "allow");
    // Parsed before the browser starts, so a typo'd exemption fails in milliseconds
    // rather than after a page load.
    parseDesignAllowRules(allow);
    return {
      source,
      ...(minReuse !== undefined ? { minReuse } : {}),
      ...(minInstances !== undefined ? { minInstances } : {}),
      ...(exclude.length > 0 ? { exclude } : {}),
      ...(allow.length > 0 ? { allow } : {}),
      ...(timeout !== undefined ? { timeout } : {}),
      ...(waitUntil ? { waitUntil } : {}),
      ...(storageState ? { storageState } : {}),
      ...(har ? { har } : {}),
    };
  },
  run: (options) => (options.elementsPath
    ? runSceneDesignPolicyCheck({ ...options, elementsPath: options.elementsPath })
    : runDesignPolicyCheck(options)),
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
