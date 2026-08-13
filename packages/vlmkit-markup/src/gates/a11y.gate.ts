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
import { firstPositional, optionalInt, runOutputDir, viewportFlag } from "./arg-helpers.ts";

const A11Y_VALUE_FLAGS = ["--output-dir", "--report", "--level", "--max-steps", "--viewport"];

/**
 * Flags every a11y gate shares. `quiet` is forced: the runner owns output.
 *
 * The default directory is keyed on the source, not one folder per gate. Measured on
 * two pages in a row: both wrote `report.md` and `page.png` into
 * `test-results/a11y-contrast/`, so the second silently replaced the first - the same
 * clobber v2 found in `check drift component` and that was fixed for drift alone.
 */
function reportFlags(argv: readonly string[], defaultDir: string, source: string) {
  const outputDir = readFlag(argv, "output-dir");
  const reportPath = readFlag(argv, "report");
  return {
    outputDir: outputDir ?? runOutputDir(defaultDir, source),
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
  parse: (argv) => {
    const htmlPath = firstPositional(argv, "vlmkit check a11y contrast <html-or-url>", A11Y_VALUE_FLAGS);
    return {
      htmlPath,
      ...reportFlags(argv, "a11y-contrast", htmlPath),
      ...parsePageLoad(argv),
    };
  },
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
  usage: `Measures every interactive element's rendered box and reports targets whose
SHORTER SIDE is under the level's floor: 44px at AAA (default), 24px at AA.
A target at or above the floor is not reported, whatever its spacing — so at
--level AA a 24x24 button in a tight row passes, and that is WCAG 2.5.8, which
sizes targets and does not condemn a compliant one for being adjacent.

\`clustered\` on a finding means another below-floor target sits within 24px
center-to-center. It ANNOTATES a finding; it never causes one. WCAG's
spacing exception, which can excuse an undersized target that is far enough
from its neighbours, is deliberately not applied — an undersized target is
reported either way, and \`clustered\` tells you which side of that line it is
on. This is stricter than WCAG on purpose. If that is not the trade you want,
--rule target-undersized=warn keeps the findings without failing the build.
There is no per-selector exemption on this gate yet, so a vendor widget's
controls cannot be scoped out — only the whole rule can be re-tuned.`,
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
      description: "Shorter-side floor — AAA is 44px, AA is 24px",
      choices: ["AAA", "AA"],
      defaultDescription: "AAA",
    },
    ...REPORT_INPUTS("a11y-touch"),
    ...PAGE_LOAD_INPUTS,
  ],
  parse: (argv) => {
    const source = firstPositional(argv, "vlmkit check a11y touch <html-or-url>", A11Y_VALUE_FLAGS);
    return {
      source,
      level: (readChoice(argv, "level", ["AAA", "AA"] as const) ?? "AAA") as WcagTouchLevel,
      ...reportFlags(argv, "a11y-touch", source),
      ...parsePageLoad(argv),
    };
  },
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
    // Focus order is judged from each stop's x/y, so the width is part of the
    // question. A dogfood agent: "`check a11y focus` has no `--viewport` flag while
    // `check animation` does — focus order is only checkable at one unnamed width,
    // even though the wrapped toolbar changes visual order at 375px."
    { name: "viewport", placeholder: "WxH", kind: "string", description: "Viewport", defaultDescription: "1280x720" },
    ...REPORT_INPUTS("a11y-focus-order"),
    ...PAGE_LOAD_INPUTS,
  ],
  parse: (argv) => {
    const maxSteps = optionalInt(argv, "max-steps", { min: 1 });
    const viewport = viewportFlag(argv);
    const source = firstPositional(argv, "vlmkit check a11y focus <html-or-url>", A11Y_VALUE_FLAGS);
    return {
      source,
      ...(maxSteps !== undefined ? { maxSteps } : {}),
      ...(viewport ? { viewport } : {}),
      ...reportFlags(argv, "a11y-focus-order", source),
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
