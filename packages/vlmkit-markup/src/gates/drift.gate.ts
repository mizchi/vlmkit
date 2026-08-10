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

import { join } from "node:path";
import { readAll, readFlag, readInt, readNumber } from "@mizchi/vlmkit-core/arg-reader.ts";
import { UsageError } from "@mizchi/vlmkit-core/cli-error.ts";
import { PAGE_LOAD_INPUTS, parsePageLoad } from "@mizchi/vlmkit-core/page-load.ts";
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
const DRIFT_VALUE_FLAGS = ["--selector", "--output-dir", "--report", "--threshold", "--reference-index"];

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
      title: "Instance differs from the reference beyond the threshold",
      severity: "suspect",
      docs: "Raise the tolerance with --threshold rather than disabling the rule.",
    },
  ],
  inputs: [
    { name: "source", placeholder: "html-or-url", kind: "path-or-url", description: "Page containing the instances", positional: 0, required: true },
    { name: "selector", placeholder: "sel", kind: "string", description: "CSS selector matching >=2 instances", required: true },
    { name: "reference-index", placeholder: "n", kind: "number", description: "Which match is the reference", defaultDescription: "0" },
    { name: "threshold", placeholder: "0..1", kind: "number", description: "Pixel diff threshold", defaultDescription: String(DEFAULT_THRESHOLD) },
    { name: "output-dir", placeholder: "dir", kind: "path", description: "Output directory", defaultDescription: "./test-results/component-consistency" },
    { name: "report", placeholder: "path", kind: "path", description: "Markdown report path" },
  ],
  parse: (argv) => {
    const htmlPath = firstPositional(argv, "vlmkit check drift component <html-or-url> --selector <sel>", DRIFT_VALUE_FLAGS);
    const selector = readFlag(argv, "selector");
    if (!selector) throw new UsageError("--selector <sel> is required (it must match at least two instances)");
    const threshold = readNumber(argv, "threshold", { min: 0, max: 1 }) ?? DEFAULT_THRESHOLD;
    const referenceIndex = readInt(argv, "reference-index", { min: 0 });
    const outputDir = readFlag(argv, "output-dir");
    const reportPath = readFlag(argv, "report");
    return {
      htmlPath,
      selector,
      threshold,
      outputDir: outputDir ?? join(process.cwd(), "test-results", "component-consistency"),
      ...(referenceIndex !== undefined ? { referenceIndex } : {}),
      ...(reportPath ? { reportPath } : {}),
    };
  },
  run: (options) => runComponentConsistency(options),
  findings: (report, options): Finding[] =>
    report.deltas
      .filter((d) => d.diffRatio > options.threshold)
      .map((d) => ({
        rule: "instance-drift",
        severity: "suspect",
        message:
          `instance #${d.candidateIndex} differs from reference #${report.referenceIndex}`
          + ` by ${(d.diffRatio * 100).toFixed(2)}% (threshold ${(options.threshold * 100).toFixed(2)}%)`
          + `, size delta ${d.bboxDeltas.width}x${d.bboxDeltas.height}px`,
        selector: report.selector,
        evidence: { diffRatio: d.diffRatio, bboxDeltas: d.bboxDeltas },
      })),
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
      docs: "Raise the tolerance with --threshold rather than disabling the rule.",
    },
  ],
  inputs: [
    { name: "selector", placeholder: "sel", kind: "string", description: "CSS selector present on every page", required: true },
    { name: "urls", placeholder: "url", kind: "string", description: "Page URL", repeatable: true },
    { name: "files", placeholder: "path", kind: "string", description: "Page file", repeatable: true },
    { name: "threshold", placeholder: "0..1", kind: "number", description: "Pixel diff threshold", defaultDescription: String(DEFAULT_THRESHOLD) },
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
    const outputDir = readFlag(argv, "output-dir");
    const reportPath = readFlag(argv, "report");
    return {
      selector,
      threshold,
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
