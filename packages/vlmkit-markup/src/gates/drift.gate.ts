/**
 * The two `check drift *` gates: component (N instances on one page) and
 * pages (one selector across N pages).
 *
 * Like `check a11y *`, these are three-token commands the registry resolves
 * by longest prefix, so the hand-written `CHECK_DRIFT` branch in the
 * dispatcher goes away.
 *
 * Both rules default to `suspect`: a component that renders differently in
 * two places is a defect in one of them, and the threshold flag (`--threshold`)
 * is the intended way to say how much difference is acceptable. That is the
 * same reasoning that keeps `check tokens` at `warn` — there the scale is a
 * preference, here the two renders are supposed to agree.
 */

import { createHash } from "node:crypto";
import { basename, join, resolve } from "node:path";
import { readAll, readFlag, readInt, readNumber } from "@mizchi/vlmkit-core/arg-reader.ts";
import { UsageError } from "@mizchi/vlmkit-core/cli-error.ts";
import { PAGE_LOAD_INPUTS, parsePageLoad } from "@mizchi/vlmkit-core/page-load.ts";
import { DRIFT_ALLOW_HELP } from "../component/drift-exemption.ts";
import { defineGate } from "@mizchi/vlmkit-core/plugin/contract.ts";
import type { Finding } from "@mizchi/vlmkit-core/plugin/contract.ts";
import {
  type ComponentConsistencyOptions,
  type ComponentConsistencyReport,
  formatComponentConsistencyReport,
  runComponentConsistency,
} from "../component/component-consistency.ts";
import {
  type MultiPageConsistencyOptions,
  type MultiPageConsistencyReport,
  formatMultiPageConsistencyReport,
  runMultiPageConsistency,
} from "../stress/multi-page-consistency.ts";
import { firstPositional } from "./arg-helpers.ts";

const DEFAULT_THRESHOLD = 0.03;
/**
 * A short, stable directory name for one (source, selector) pair.
 *
 * Stable so a re-run overwrites its own previous report — which is what a caller
 * comparing two runs of the same check wants — and distinct so a different check does
 * not land on top of it.
 */
function runSlug(source: string, selector: string): string {
  const name = basename(source).replace(/\.[^.]+$/, "") || "page";
  const hash = createHash("sha1").update(`${resolve(source)}\u0000${selector}`).digest("hex").slice(0, 8);
  return `${name.replace(/[^A-Za-z0-9._-]+/g, "-")}-${hash}`;
}

const DRIFT_VALUE_FLAGS = ["--selector", "--output-dir", "--report", "--threshold", "--pixel-tolerance", "--reference-index", "--allow"];

/** Options plus the threshold, which the verdict needs and the report lacks. */
export interface ComponentDriftGateOptions extends ComponentConsistencyOptions {
  threshold: number;
}

export interface PageDriftGateOptions extends MultiPageConsistencyOptions {
  threshold: number;
}


export const driftComponentGate = defineGate<ComponentConsistencyReport, ComponentDriftGateOptions>({
  id: "check.drift.component",
  command: ["check", "drift", "component"],
  title: "Component drift across instances",
  summary: "Drift across N selector instances on one page",
  category: "design-system",
  usage: `Crops every match of --selector out of one render, picks one as the
reference, and pixel-diffs the rest against it. Catches the same component
styled differently in two places on the same page — a copy-paste divergence
no single-element check can see.

Local files only, despite the <html-or-url> spelling: the measurement reads
the bytes and setContent()s them, so nothing is navigated. That is also why
this is the one URL-shaped gate with no --timeout / --wait-until / --har —
there is no navigation to time out, no load milestone to wait for and no
network to replay. Pass a URL and it fails as a missing file.`,
  rules: [
    {
      id: "instance-drift",
      title: "Instance is styled differently from the reference",
      severity: "suspect",
      // `--allow` leads, because this rule fires on tracked computed style and
      // `--threshold` is a pass line on the pixel ratio — a different number. v4's
      // repair agent was sent the wrong way by the old wording: "`Raise the pass line
      // with --threshold rather than disabling the rule` actively pointed me toward the
      // wrong lever — `--threshold` would have been a blunt fudge; `--allow` was the
      // correct, reviewable one."
      docs: "For a deliberate variant, declare the properties with --allow \"<property>[@<selector>];<reason>\" — the difference stays listed and a stale rule is reported. --threshold is a pass line on the *pixel ratio*, which is not what this rule reads. `--threshold` does not change the measured ratio; `--pixel-tolerance` does.",
    },
    {
      id: "instance-content-differs",
      title: "Instance differs in pixels but not in any tracked computed style",
      severity: "info",
      docs: `Informational by design: two instances of one component holding different copy differ in
pixels and in height, and that is not drift. Raised instead of \`instance-drift\` whenever every
tracked style property matches, so the gate can pass on a page with real content.`,
    },
  ],
  inputs: [
    { name: "source", placeholder: "html-or-url", kind: "path-or-url", description: "Page containing the instances", positional: 0, required: true },
    { name: "selector", placeholder: "sel", kind: "string", description: "CSS selector matching >=2 instances", required: true },
    { name: "reference-index", placeholder: "n", kind: "number", description: "Which match is the reference", defaultDescription: "0" },
    { name: "threshold", placeholder: "0..1", kind: "number", description: "Pass line on the measured diff ratio (does not change the measurement)", defaultDescription: String(DEFAULT_THRESHOLD) },
    { name: "pixel-tolerance", placeholder: "0..1", kind: "number", description: "Comparator per-pixel colour tolerance", defaultDescription: "0.1" },
    { name: "allow", placeholder: "<property>[@<selector>];<reason>", kind: "string", repeatable: true, description: DRIFT_ALLOW_HELP },
    { name: "output-dir", placeholder: "dir", kind: "path", description: "Output directory", defaultDescription: "./test-results/component-consistency" },
    { name: "report", placeholder: "path", kind: "path", description: "Markdown report path" },
  ],
  parse: (argv) => {
    const htmlPath = firstPositional(argv, "vlmkit check drift component <html-or-url> --selector <sel>", DRIFT_VALUE_FLAGS);
    const selector = readFlag(argv, "selector");
    if (!selector) throw new UsageError("--selector <sel> is required (it must match at least two instances)");
    const threshold = readNumber(argv, "threshold", { min: 0, max: 1 }) ?? DEFAULT_THRESHOLD;
    const pixelTolerance = readNumber(argv, "pixel-tolerance", { min: 0, max: 1 });
    const allow = readAll(argv, "allow");
    const referenceIndex = readInt(argv, "reference-index", { min: 0 });
    const outputDir = readFlag(argv, "output-dir");
    const reportPath = readFlag(argv, "report");
    return {
      htmlPath,
      selector,
      threshold,
      ...(pixelTolerance !== undefined ? { pixelTolerance } : {}),
      ...(allow.length > 0 ? { allow } : {}),
      // Per (source, selector), not one global directory. A dogfood agent read a
      // report file that belonged to somebody else's run: "`cat
      // test-results/component-consistency/report.md` returned a *different* run —
      // `Selector: .card:not(.card--featured)`, 2 instances, a different HTML path —
      // while my terminal showed `.card`, 3 instances. A parallel agent had clobbered
      // it. I trusted the terminal." Two invocations that measure different things
      // must not write to the same path.
      outputDir: outputDir ?? join(
        process.cwd(),
        "test-results",
        "component-consistency",
        runSlug(htmlPath, selector),
      ),
      ...(referenceIndex !== undefined ? { referenceIndex } : {}),
      ...(reportPath ? { reportPath } : {}),
    };
  },
  run: (options) => runComponentConsistency(options),
  // Drift is a difference in *styling*, and pixels alone cannot tell that from a
  // difference in copy. A dogfood agent could not get this gate to pass on a page
  // with real content: "It raw-pixel-diffs crops, so two identically-styled cards
  // with different copy read `4.86% Δ 0 / 0` — above the 3% default. Proved it: same
  // styling + identical text = `0.00%`. The message […] claims drift where none
  // exists, and the report's remedy ('Replace the inline markup with the shared
  // component invocation') is unfollowable — the markup is already identical."
  //
  // So the computed style decides, and the pixel ratio only gates whether the
  // difference is worth mentioning at all. Measured on the dogfood page: the featured
  // card reports 9 style deltas naming `padding-*` and `border-top-color`; the
  // same-styled card with different copy reports 0 despite 3.37% of pixels.
  findings: (report, options): Finding[] =>
    report.deltas
      .filter((d) => d.diffRatio > options.threshold)
      .map((d) => d.styleDeltas.length > 0
        ? {
          rule: "instance-drift",
          severity: "suspect" as const,
          message:
            `instance #${d.candidateIndex} is styled differently from reference #${report.referenceIndex}`
            + ` — ${d.styleDeltas.length} computed propert${d.styleDeltas.length === 1 ? "y" : "ies"} differ:`
            + ` ${d.styleDeltas.slice(0, 4).map((s) => `${s.property} ${s.reference} → ${s.candidate}`).join("; ")}`
            + `${d.styleDeltas.length > 4 ? `; and ${d.styleDeltas.length - 4} more` : ""}`
            + ` (${(d.diffRatio * 100).toFixed(2)}% of pixels, size delta ${d.bboxDeltas.width}x${d.bboxDeltas.height}px)`,
          selector: report.selector,
          evidence: { diffRatio: d.diffRatio, bboxDeltas: d.bboxDeltas, styleDeltas: d.styleDeltas },
        }
        : {
          rule: "instance-content-differs",
          severity: "info" as const,
          message:
            `instance #${d.candidateIndex} differs from reference #${report.referenceIndex}`
            + ` by ${(d.diffRatio * 100).toFixed(2)}% of pixels, but every tracked computed style property`
            + ` matches — this is different content in the same component, not drift.`
            + ` Size delta ${d.bboxDeltas.width}x${d.bboxDeltas.height}px is what the copy costs.`,
          selector: report.selector,
          evidence: { diffRatio: d.diffRatio, bboxDeltas: d.bboxDeltas },
        }),
  format: formatComponentConsistencyReport,
  ledger: (report, options) => ({
    tool: "check-drift-component",
    source: options.htmlPath,
    headline: {
      selector: report.selector,
      instances: report.instanceCount,
      drifting: report.deltas.filter((d) => d.diffRatio > options.threshold).length,
      report: report.reportPath,
    },
  }),
});

/**
 * `check drift pages` takes its URLs through `--urls`, not through a
 * `path-or-url` positional, which is why it was not in the 2026-08-10 audit's
 * list of URL gates. It navigates them all the same, so it takes the same three
 * page-load flags. (`--files` goes through `setContent`, so `--har` has no
 * document request to intercept on that branch.)
 */
export const driftPagesGate = defineGate<MultiPageConsistencyReport, PageDriftGateOptions>({
  id: "check.drift.pages",
  command: ["check", "drift", "pages"],
  title: "Selector drift across pages",
  summary: "Drift of one selector across N pages",
  category: "design-system",
  usage: `Crops the same selector out of several pages and diffs each against the
first. Catches a shared header, footer or card that quietly diverged on one
route.

Pass either --urls or --files, each repeatable.`,
  rules: [
    {
      id: "page-drift",
      title: "Selector renders differently on this page than on the reference",
      severity: "suspect",
      docs: "Raise the pass line with --threshold rather than disabling the rule. `--threshold` does not change the measured ratio; `--pixel-tolerance` does.",
    },
  ],
  inputs: [
    { name: "selector", placeholder: "sel", kind: "string", description: "CSS selector present on every page", required: true },
    { name: "urls", placeholder: "url", kind: "string", description: "Page URL", repeatable: true },
    { name: "files", placeholder: "path", kind: "string", description: "Page file", repeatable: true },
    { name: "threshold", placeholder: "0..1", kind: "number", description: "Pass line on the measured diff ratio (does not change the measurement)", defaultDescription: String(DEFAULT_THRESHOLD) },
    { name: "pixel-tolerance", placeholder: "0..1", kind: "number", description: "Comparator per-pixel colour tolerance", defaultDescription: "0.1" },
    { name: "output-dir", placeholder: "dir", kind: "path", description: "Output directory", defaultDescription: "./test-results/consistency" },
    { name: "report", placeholder: "path", kind: "path", description: "Markdown report path" },
    ...PAGE_LOAD_INPUTS,
  ],
  parse: (argv) => {
    const selector = readFlag(argv, "selector");
    if (!selector) throw new UsageError("--selector <sel> is required");
    const urls = readAll(argv, "urls");
    const files = readAll(argv, "files");
    if (urls.length === 0 && files.length === 0) {
      throw new UsageError("pass --urls <url> or --files <path> (each repeatable) — at least two pages");
    }
    const threshold = readNumber(argv, "threshold", { min: 0, max: 1 }) ?? DEFAULT_THRESHOLD;
    const pixelTolerance = readNumber(argv, "pixel-tolerance", { min: 0, max: 1 });
    const outputDir = readFlag(argv, "output-dir");
    const reportPath = readFlag(argv, "report");
    return {
      selector,
      threshold,
      ...(pixelTolerance !== undefined ? { pixelTolerance } : {}),
      outputDir: outputDir ?? join(process.cwd(), "test-results", "consistency"),
      ...(urls.length > 0 ? { urls } : {}),
      ...(files.length > 0 ? { files } : {}),
      ...(reportPath ? { reportPath } : {}),
      ...parsePageLoad(argv),
    };
  },
  run: (options) => runMultiPageConsistency(options),
  findings: (report, options): Finding[] =>
    report.deltas
      .filter((d) => d.diffRatio > options.threshold)
      .map((d) => ({
        rule: "page-drift",
        severity: "suspect",
        message:
          `${d.candidate} differs from ${report.reference}`
          + ` by ${(d.diffRatio * 100).toFixed(2)}% (threshold ${(options.threshold * 100).toFixed(2)}%)`,
        selector: report.selector,
        evidence: { diffRatio: d.diffRatio, bboxDeltas: d.bboxDeltas },
      })),
  format: formatMultiPageConsistencyReport,
  ledger: (report, options) => ({
    tool: "check-drift-pages",
    source: report.reference,
    headline: {
      selector: report.selector,
      pages: report.pages.length,
      drifting: report.deltas.filter((d) => d.diffRatio > options.threshold).length,
      report: report.reportPath,
    },
  }),
});
