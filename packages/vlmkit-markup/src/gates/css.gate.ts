/**
 * `check css`: CSS the browser silently ignores — declarations it dropped and `@media` it cannot
 * evaluate or that match no width. Measurement in `../inspect/css-check.ts`, decisions in
 * `@mizchi/vlmkit-judge/css-check.ts`. Ported from veriss's static rules, decided by Chromium.
 */
import { readNumber } from "@mizchi/vlmkit-core/arg-reader.ts";
import { readFlag } from "@mizchi/vlmkit-core/arg-reader.ts";
import { UsageError } from "@mizchi/vlmkit-core/cli-error.ts";
import { PAGE_LOAD_INPUTS, parsePageLoad } from "@mizchi/vlmkit-core/page-load.ts";
import { firstPositional, viewportFlag } from "@mizchi/vlmkit-core/plugin/args.ts";
import { defineGate } from "@mizchi/vlmkit-core/plugin/contract.ts";
import type { Finding } from "@mizchi/vlmkit-core/plugin/contract.ts";
import {
  DEFAULT_MAX_ELEMENTS,
  formatCssCheckReport,
  runCssCheck,
  type CssCheckOptions,
  type CssCheckReport,
} from "../inspect/css-check.ts";

export const cssGate = defineGate<CssCheckReport, CssCheckOptions>({
  id: "check.css",
  command: ["check", "css"],
  title: "CSS the browser ignores",
  summary: "Declarations the browser dropped as invalid, and @media rules it cannot evaluate or that match no width",
  category: "correctness",
  usage: `Loads the page in Chromium and reads, through the DevTools protocol, every author
declaration in the rules that match its elements: one the browser's parser rejected
(parsedOk: false) is dropped whole, and the value before it stays — calc(100%-10px),
width: 100, color: #12345, a misspelt property. Every @media rule's atoms are evaluated
with matchMedia as (f) and not (f): a feature or value the browser does not know is false
both ways, so the query never matches for anyone. An @media whose width bounds exclude each
other (min-width: 900px and max-width: 600px) matches no viewport. Linked and CDN sheets are
read too (the CSSOM cannot read them from a file: page). Declarations under a media query
that does not match at the viewport are not read: pass --viewport for another width.
Vendor-prefixed declarations Chromium does not know are listed as info, not defects: they are
usually fallbacks written for another engine.`,
  rules: [
    {
      id: "dropped-declaration",
      title: "A declaration the browser dropped: an unknown property, or a value that does not parse",
      severity: "suspect",
      docs: "The whole declaration is ignored and the previous value stays. veriss calls these W_CSS_*_INVALID.",
    },
    {
      id: "vendor-declaration-dropped",
      title: "A vendor-prefixed declaration this browser does not know",
      severity: "info",
      docs: "Usually a fallback for another engine (-moz-osx-font-smoothing). Never affects the verdict.",
    },
    {
      id: "unknown-media-feature",
      title: "An @media whose feature or value the browser does not know: it never matches",
      severity: "suspect",
      docs: "Both (f) and not (f) evaluate false. Usually a typo (prefers-reduce-motion).",
    },
    {
      id: "never-matching-media",
      title: "An @media whose width bounds leave no viewport",
      severity: "suspect",
      docs: "Judged on plain `and` conjunctions of width tests in px / em / rem only.",
    },
  ],
  inputs: [
    {
      name: "source",
      placeholder: "html-or-url",
      kind: "path-or-url",
      description: "Page to check",
      positional: 0,
      required: true,
    },
    {
      name: "viewport",
      placeholder: "WxH",
      kind: "string",
      description: "Viewport the matched rules are read at",
      defaultDescription: "1280x800",
    },
    {
      name: "max-elements",
      placeholder: "n",
      kind: "number",
      description: "Elements whose matched rules are read, in document order",
      defaultDescription: String(DEFAULT_MAX_ELEMENTS),
    },
    {
      name: "storage-state",
      placeholder: "file",
      kind: "path",
      description: "Playwright storage state for pages behind a login",
    },
    ...PAGE_LOAD_INPUTS,
  ],
  parse: (argv) => {
    const source = firstPositional(argv, "vlmkit check css <html-or-url>", [
      "--viewport",
      "--max-elements",
      "--storage-state",
    ]);
    const viewport = viewportFlag(argv, "viewport");
    const maxElements = readNumber(argv, "max-elements");
    if (maxElements !== undefined && !(maxElements >= 1 && Number.isInteger(maxElements)))
      throw new UsageError(`--max-elements takes a positive whole number, got ${maxElements}`);
    const storageState = readFlag(argv, "storage-state");
    return {
      source,
      ...(viewport ? { viewport } : {}),
      ...(maxElements !== undefined ? { maxElements } : {}),
      ...(storageState ? { storageState } : {}),
      ...parsePageLoad(argv),
    };
  },
  run: (options) => runCssCheck(options),
  findings: (report): Finding[] =>
    report.findings.map((f) => ({
      rule: f.rule,
      severity: f.severity,
      message: f.message,
      ...(f.selector ? { selector: f.selector } : {}),
    })),
  format: formatCssCheckReport,
  headline: (report) =>
    `${report.findings.length} finding(s): ${report.declarations.length} dropped declaration(s), ${report.media.length} @media read, ${report.inspected.elements} element(s)`,
  ledger: (report, options) => ({
    tool: "check-css",
    source: options.source,
    headline: {
      findings: report.findings.length,
      dropped: report.declarations.length,
      media: report.media.length,
      elements: report.inspected.elements,
    },
  }),
});
