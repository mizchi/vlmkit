/**
 * `check composition` as a gate definition. Measurement lives in
 * `../style/composition.ts`; this file only declares the surface.
 *
 * Severities mirror `check design`'s, and for the same reason: a page whose
 * labels group upward is information for a human, not a broken page, so
 * nothing here exceeds `warn` except `redirected` (a report about the login
 * screen is not a report about the page that was asked for).
 *
 * `rail-near-miss` is `info` because the study measured it as real but
 * sub-perceptual: a 5px rail split was caught by a vision reader on one page
 * (two adjacent cards, easy to compare) and missed on two others, and a
 * per-element padding change reports through it as well as through
 * `check design`'s `component-drift`. It is true, it does not carry a verdict —
 * the same shape as `scale-outlier`.
 */

import { readAll, readFlag, readInt } from "@mizchi/vlmkit-core/arg-reader.ts";
import { defineGate } from "@mizchi/vlmkit-core/plugin/contract.ts";
import { PAGE_LOAD_INPUTS, parsePageLoad } from "@mizchi/vlmkit-core/page-load.ts";
import type { Finding } from "@mizchi/vlmkit-core/plugin/contract.ts";
import { firstPositional } from "@mizchi/vlmkit-core/plugin/args.ts";
import {
  COMPOSITION_ALLOW_HELP,
  type CompositionOptions,
  type CompositionReport,
  formatCompositionReport,
  parseCompositionAllowRules,
  runCompositionCheck,
} from "../style/composition.ts";

export const compositionGate = defineGate<CompositionReport, CompositionOptions>({
  id: "check.composition",
  command: ["check", "composition"],
  title: "Composition principles (proximity / alignment / contrast)",
  summary:
    "Whether spacing groups what belongs together, edges share a rail, and size encodes priority",
  category: "design-system",
  usage: `Does the layout carry the classical composition principles — 近接 proximity,
整列 alignment, 対比 contrast — measured from rendered geometry alone? No
reference design, no tokens file, no VLM.

  proximity-inversion  a label sits closer to what precedes it than to what it
                       labels, so it reads as belonging to the wrong group
  rail-near-miss       two of the page's rails sit 2-8px apart (informational)
  flat-heading-step    two declared heading levels render at one size
  no-type-contrast     nothing is larger or heavier than the body text

反復 repetition is NOT here: \`check design\`'s component-drift already measures
style reuse, and a second rule for it would report the same defect twice. Run
both — this gate sees defects that leave every style signature untouched, and
that one sees the reverse.

Reports the AMBIGUITY, never which gap or size is correct. Findings are
warn-level; taste stays with humans. Study behind every threshold, including
the six candidate metrics that were rejected for not discriminating:
docs/design/composition-metrics.md`,
  rules: [
    {
      id: "proximity-inversion",
      title: "A label is closer to what precedes it than to what it labels",
      severity: "warn",
      docs:
        "近接. A label reads as belonging to whatever it is closest to. Fires when the gap"
        + " below a heading is >=1.5x the gap above it AND at least 8px wider — both, because"
        + " 16px vs 24px is a 1.5x ratio nobody perceives. Raise to suspect to gate on it.",
    },
    {
      id: "rail-near-miss",
      title: "Two of the page's rails sit 2-8px apart",
      severity: "info",
      docs:
        "整列, across containers — `check integrity`'s A12 covers the same window between"
        + " siblings. Info by default: measured as real but sub-perceptual, and a padding"
        + " change reports here as well as through check design. Sub-2px pairs are excluded"
        + " as rounding of fractional layout, not decisions.",
    },
    {
      id: "flat-heading-step",
      title: "Two declared heading levels render at the same size and weight",
      severity: "warn",
      docs:
        "対比. The page asserted the levels differ; the render says they do not, so the"
        + " structure it declares is invisible. A weight difference counts as the"
        + " distinction, so a same-size pair at different weights is not reported.",
    },
    {
      id: "no-type-contrast",
      title: "Nothing is larger or heavier than the body text",
      severity: "warn",
      docs:
        "対比, as a floor rather than a discriminator. Requires BOTH a size ratio under"
        + " 1.3x and a weight step under 200 — emphasis carried by weight alone is real"
        + " emphasis, and reporting it was a false positive on a page with bold card titles.",
    },
    {
      id: "nothing-judged",
      title: "No label, heading pair or rail could be measured",
      severity: "info",
      docs:
        "Info by default — a page built from neither heading-led groups nor wide blocks has"
        + " nothing to judge, which is not a defect. Raise to suspect to enforce that this"
        + " gate must actually measure something rather than reporting green in silence.",
    },
    { id: "redirected", title: "Requested URL redirected elsewhere", severity: "suspect" },
  ],
  inputs: [
    {
      name: "source", placeholder: "html-or-url", kind: "path-or-url",
      description: "Page to check", positional: 0, required: true,
    },
    {
      name: "viewport", kind: "number",
      description: "Viewport width; composition is a function of width, so it is reported",
      defaultDescription: "1280",
    },
    {
      name: "allow", placeholder: "<selector>;<reason>", kind: "string", repeatable: true,
      description: COMPOSITION_ALLOW_HELP,
    },
    {
      name: "storage-state", placeholder: "file", kind: "path",
      description: "Playwright storage state for pages behind a login",
    },
    // Spread, not re-declared — see the note in `integrity.gate.ts`.
    ...PAGE_LOAD_INPUTS,
  ],
  parse: (argv) => {
    const source = firstPositional(argv, "vlmkit check composition <html-or-url>", [
      "--viewport", "--allow", "--storage-state",
    ]);
    // Validated at read time so a typo'd width fails in milliseconds rather
        // than rendering the page at NaN and reporting on nothing.
    const viewport = readInt(argv, "viewport", { min: 200 });
    const pageLoad = parsePageLoad(argv);
    const storageState = readFlag(argv, "storage-state");
    const allow = readAll(argv, "allow");
    // Parsed before the browser starts, for the same reason `check design` does it.
    parseCompositionAllowRules(allow);
    return {
      source,
      ...(viewport !== undefined ? { viewport } : {}),
      ...(allow.length > 0 ? { allow } : {}),
      ...(storageState ? { storageState } : {}),
      ...(pageLoad.timeout !== undefined ? { timeout: pageLoad.timeout } : {}),
      ...(pageLoad.waitUntil ? { waitUntil: pageLoad.waitUntil } : {}),
      ...(pageLoad.har ? { har: pageLoad.har } : {}),
    };
  },
  run: (options) => runCompositionCheck(options),
  findings: (report): Finding[] =>
    report.findings.map((finding) => ({
      rule: finding.kind,
      severity: finding.severity,
      message: finding.message,
      ...(finding.selector ? { selector: finding.selector } : {}),
      ...(finding.evidence ? { evidence: finding.evidence } : {}),
    })),
  format: formatCompositionReport,
  headline: (report) =>
    `${report.labels.length} label(s), ${report.hierarchy.levels.length} heading level(s),`
    + ` ${report.rails.blocks} wide block(s) on ${report.rails.lefts} left rail(s)`,
  // runCompositionCheck appends its own entry.
  ledger: () => null,
});
