/**
 * The three `check a11y *` gates: contrast, touch, focus.
 *
 * They share a shape (render once, sample, write a markdown report, list the
 * failures) and a set of flags, so they live in one file. Each is still an
 * independent gate with its own id, rule table and command.
 *
 * These are the first three-token commands in the registry
 * (`["check", "a11y", "contrast"]`). The registry resolves longest-prefix, so
 * no dispatcher special-casing is needed — the hand-written `CHECK_A11Y`
 * branch in `src/cli/cli.ts` goes away.
 *
 * Severity: `suspect`, for all three. These findings are violations of an
 * external standard (WCAG), not of a preference the caller declared — the
 * distinction that keeps `check tokens` and `check theme` at `warn`. Note that
 * `check a11y touch` and `check a11y focus` previously had no exit logic at
 * all, so this is a real behavior change: they now fail on a finding, and
 * `--advisory` is the opt-out.
 */

import { join } from "node:path";
import { readChoice, readFlag } from "@mizchi/vlmkit-core/arg-reader.ts";
import { PAGE_LOAD_INPUTS, parsePageLoad } from "@mizchi/vlmkit-core/page-load.ts";
import { defineGate } from "@mizchi/vlmkit-core/plugin/contract.ts";
import type { Finding } from "@mizchi/vlmkit-core/plugin/contract.ts";
import {
  type A11yContrastOptions,
  type A11yContrastReport,
  formatA11yContrastReport,
  runA11yContrast,
} from "../a11y-contrast.ts";
import {
  type TouchCheckOptions,
  type TouchReport,
  type WcagTouchLevel,
  formatA11yTouchReport,
  runA11yTouch,
} from "../a11y-touch.ts";
import {
  type FocusOrderOptions,
  type FocusOrderReport,
  formatFocusOrderReport,
  runFocusOrder,
} from "../a11y-focus-order.ts";
import { firstPositional, optionalInt } from "./arg-helpers.ts";

const A11Y_VALUE_FLAGS = ["--output-dir", "--report", "--level", "--max-steps"];

/** Flags every a11y gate shares. `quiet` is forced: the runner owns output. */
function reportFlags(argv: readonly string[], defaultDir: string) {
  const outputDir = readFlag(argv, "output-dir");
  const reportPath = readFlag(argv, "report");
  return {
    outputDir: outputDir ?? join(process.cwd(), "test-results", defaultDir),
    quiet: true,
    ...(reportPath ? { reportPath } : {}),
  };
}

const REPORT_INPUTS = (defaultDir: string) => [
  {
    name: "output-dir",
    placeholder: "dir",
    kind: "path" as const,
    description: "Screenshot / report output directory",
    defaultDescription: `./test-results/${defaultDir}`,
  },
  { name: "report", placeholder: "path", kind: "path" as const, description: "Markdown report path" },
];

export const a11yContrastGate = defineGate<A11yContrastReport, A11yContrastOptions>({
  id: "check.a11y.contrast",
  command: ["check", "a11y", "contrast"],
  title: "WCAG AA contrast scan",
  summary: "WCAG AA contrast scan",
  category: "correctness",
  usage: `Measures the computed contrast ratio of every text-bearing element
against its effective background and reports each pair below the WCAG AA
threshold for its font size and weight.`,
  rules: [
    {
      id: "contrast-below-aa",
      title: "Text contrast below the WCAG AA threshold for its size/weight",
      severity: "suspect",
      docs: "The report gives the measured ratio, the required ratio, and both hex values.",
    },
  ],
  inputs: [
    { name: "source", placeholder: "html-or-url", kind: "path-or-url", description: "Page to scan", positional: 0, required: true },
    ...REPORT_INPUTS("a11y-contrast"),
    ...PAGE_LOAD_INPUTS,
  ],
  parse: (argv) => ({
    htmlPath: firstPositional(argv, "vlmkit check a11y contrast <html-or-url>", A11Y_VALUE_FLAGS),
    ...reportFlags(argv, "a11y-contrast"),
    ...parsePageLoad(argv),
  }),
  run: (options) => runA11yContrast(options),
  findings: (report): Finding[] =>
    report.failures.map((f) => ({
      rule: "contrast-below-aa",
      severity: "suspect",
      message: `${f.ratio.toFixed(2)}:1 (need ${f.requiredAA}) — ${f.foreground.hex} on ${f.background.hex} — "${f.text}"`,
      evidence: { path: f.path, tag: f.tag, ratio: f.ratio, required: f.requiredAA, bbox: f.bbox },
    })),
  format: formatA11yContrastReport,
  ledger: (report, options) => ({
    tool: "check-a11y-contrast",
    source: options.htmlPath,
    headline: { inspected: report.totalText, failures: report.failures.length, report: report.reportPath },
  }),
});

export const a11yTouchGate = defineGate<TouchReport, TouchCheckOptions>({
  id: "check.a11y.touch",
  command: ["check", "a11y", "touch"],
  title: "Touch-target size check",
  summary: "Touch-target size check",
  category: "correctness",
  usage: `Measures every interactive element's rendered box and reports targets
below the WCAG minimum — AAA is 44x44, AA is 24x24 with spacing. Clustered
targets (within 24px of a sibling) are flagged, because adjacency is what
makes an undersized target unusable.`,
  rules: [
    {
      id: "target-undersized",
      title: "Interactive target smaller than the WCAG minimum",
      severity: "suspect",
      docs: "Switch the threshold with --level AA (24px) instead of disabling the rule.",
    },
  ],
  inputs: [
    { name: "source", placeholder: "html-or-url", kind: "path-or-url", description: "Page to scan", positional: 0, required: true },
    {
      name: "level",
      kind: "string",
      description: "WCAG threshold — AAA is 44px, AA is 24px-with-spacing",
      choices: ["AAA", "AA"],
      defaultDescription: "AAA",
    },
    ...REPORT_INPUTS("a11y-touch"),
    ...PAGE_LOAD_INPUTS,
  ],
  parse: (argv) => ({
    source: firstPositional(argv, "vlmkit check a11y touch <html-or-url>", A11Y_VALUE_FLAGS),
    level: (readChoice(argv, "level", ["AAA", "AA"] as const) ?? "AAA") as WcagTouchLevel,
    ...reportFlags(argv, "a11y-touch"),
    ...parsePageLoad(argv),
  }),
  run: (options) => runA11yTouch(options),
  findings: (report): Finding[] =>
    report.failures.map((f) => ({
      rule: "target-undersized",
      severity: "suspect",
      message:
        `${Math.round(f.bbox.width)}x${Math.round(f.bbox.height)}`
        + ` (min side ${Math.round(f.minSide)}, need ${f.required})${f.cluster ? ", clustered" : ""}`
        + ` — "${f.text}"`,
      evidence: { path: f.path, tag: f.tag, minSide: f.minSide, required: f.required, cluster: f.cluster },
    })),
  format: formatA11yTouchReport,
  ledger: (report, options) => ({
    tool: "check-a11y-touch",
    source: options.source,
    headline: {
      level: report.level,
      inspected: report.inspectedCount,
      failures: report.failures.length,
      report: report.reportPath,
    },
  }),
});

export const a11yFocusGate = defineGate<FocusOrderReport, FocusOrderOptions>({
  id: "check.a11y.focus",
  command: ["check", "a11y", "focus"],
  title: "Focus order / trap check",
  summary: "Focus order / trap check",
  category: "correctness",
  usage: `Walks Tab focus through the page and compares the visual position of
each stop against the previous one: focus that returns to the same element,
moves backward, or jumps several visual rows at a time is reported.`,
  rules: [
    {
      id: "trap",
      title: "Focus stays on the same element across a Tab press",
      severity: "suspect",
      docs: "A keyboard user cannot get past it. The most serious of the three.",
    },
    { id: "reverse", title: "Focus moved backward against reading order", severity: "suspect" },
    { id: "skip-row", title: "Focus skipped more than one visual row", severity: "warn" },
  ],
  inputs: [
    { name: "source", placeholder: "html-or-url", kind: "path-or-url", description: "Page to walk", positional: 0, required: true },
    { name: "max-steps", placeholder: "n", kind: "number", description: "Maximum Tab presses", defaultDescription: "64" },
    ...REPORT_INPUTS("a11y-focus-order"),
    ...PAGE_LOAD_INPUTS,
  ],
  parse: (argv) => {
    const maxSteps = optionalInt(argv, "max-steps", { min: 1 });
    return {
      source: firstPositional(argv, "vlmkit check a11y focus <html-or-url>", A11Y_VALUE_FLAGS),
      ...(maxSteps !== undefined ? { maxSteps } : {}),
      ...reportFlags(argv, "a11y-focus-order"),
      ...parsePageLoad(argv),
    };
  },
  run: (options) => runFocusOrder(options),
  findings: (report): Finding[] =>
    report.findings.map((f) => ({
      rule: f.kind,
      // A skipped row is a layout smell rather than a blocked keyboard path,
      // so it stays a warn while trap and reverse fail the command.
      severity: f.kind === "skip-row" ? "warn" : "suspect",
      message: f.message,
      evidence: { fromIndex: f.fromIndex, toIndex: f.toIndex },
    })),
  format: formatFocusOrderReport,
  ledger: (report, options) => ({
    tool: "check-a11y-focus",
    source: options.source,
    headline: { steps: report.steps.length, findings: report.findings.length, report: report.reportPath },
  }),
});
