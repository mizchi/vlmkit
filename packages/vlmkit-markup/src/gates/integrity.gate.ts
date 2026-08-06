/**
 * `check integrity` as a gate definition. Measurement code in
 * `../inspect/integrity-check.ts` is untouched.
 *
 * Two things change, both fixes:
 *
 *   - The gate gains `--advisory`. It never had it, which made the gate most
 *     often piloted before it gates CI the one gate that could not be piloted.
 *   - Its `"fail" | "warn"` severities normalize to `"suspect" | "warn"`.
 *     Integrity was the only gate using `fail`, and the divergence is why
 *     aggregate runners had to special-case it.
 *
 * The `--allow` exemption mini-DSL stays exactly as it is. It does something
 * rule settings deliberately do not: exempt a *pattern* (selector + kind +
 * viewport) rather than a whole rule, and report what it exempted. Rule
 * settings are the coarse instrument (`text-collision=off`), `--allow` the
 * precise one; both are enumerable, which was the original point.
 */

import { defineGate } from "@mizchi/vlmkit-core/plugin/contract.ts";
import type { Finding } from "@mizchi/vlmkit-core/plugin/contract.ts";
import { readAll, readChoice, readFlag } from "@mizchi/vlmkit-core/arg-reader.ts";
import { UsageError } from "@mizchi/vlmkit-core/cli-error.ts";
import {
  type IntegrityOptions,
  type IntegrityReport,
  formatIntegrityReport,
  runIntegrityCheck,
} from "../inspect/integrity-check.ts";
import { ALLOW_HELP, parseAllowRules } from "../inspect/integrity-exemption.ts";
import { firstPositional, numberList, optionalInt } from "./arg-helpers.ts";

/** Heights the CLI has always paired with its default sweep widths. */
const VIEWPORT_HEIGHTS: Record<number, number> = { 1280: 800, 768: 900, 375: 700 };

export const integrityGate = defineGate<IntegrityReport, IntegrityOptions>({
  id: "check.integrity",
  command: ["check", "integrity"],
  title: "Reference-free integrity gate",
  summary:
    "Reference-free defect gate: JS errors, empty render, broken resources, text collision/clipping/protrusion, collapsed containers, overflow, invisible text, occluded text, near-misalignment, unstyled page (multi-viewport)",
  usage: `Reference-free integrity gate for creative/zero-shot markup: JS
construction failures, empty renders, broken resources, colliding or
clipped text, collapsed containers, page overflow, and unstyled pages —
swept across multiple viewports. Deterministic (DOM + pixels, no VLM);
intentional-pattern exemptions are reported, not silently dropped.

${ALLOW_HELP}`,
  rules: [
    { id: "js-error", title: "Uncaught JS error", severity: "suspect", docs: "Construction-phase errors mean the page never finished building." },
    { id: "degenerate-render", title: "Empty or near-empty render", severity: "suspect" },
    { id: "broken-image", title: "Image failed to load", severity: "suspect" },
    { id: "failed-stylesheet", title: "Stylesheet failed to load", severity: "suspect" },
    { id: "broken-font", title: "Webfont failed to load", severity: "warn" },
    { id: "text-collision", title: "Overlapping text runs", severity: "suspect" },
    { id: "text-clipped", title: "Text clipped by its container", severity: "suspect" },
    { id: "collapsed-container", title: "Container collapsed to zero size", severity: "suspect" },
    { id: "page-overflow-x", title: "Page scrolls horizontally", severity: "suspect" },
    { id: "clipped-content", title: "Content clipped by an overflow container", severity: "warn" },
    { id: "nested-scroll", title: "Scroll container nested in a scroll container", severity: "warn" },
    { id: "unstyled-page", title: "Page renders with no author styles applied", severity: "suspect" },
    { id: "container-protrusion", title: "Child protrudes past its container", severity: "suspect" },
    { id: "invisible-text", title: "Text present in the DOM but not visible", severity: "suspect" },
    { id: "low-contrast-text", title: "Text below the contrast floor", severity: "warn" },
    { id: "near-misalignment", title: "Near-miss alignment (a few px off a shared edge)", severity: "warn" },
    { id: "occluded-text", title: "Text covered by another element", severity: "suspect" },
    { id: "redirected", title: "Requested URL redirected elsewhere", severity: "suspect" },
  ],
  inputs: [
    { name: "source", placeholder: "html-or-url", kind: "path-or-url", description: "Page to check", positional: 0, required: true },
    { name: "viewports", placeholder: "w,w,...", kind: "number-list", description: "Sweep widths", defaultDescription: "1280,768,375" },
    { name: "max-findings", kind: "number", description: "Per-class report cap", defaultDescription: "12" },
    { name: "timeout", placeholder: "ms", kind: "number", description: "Page navigation timeout", defaultDescription: "30000" },
    {
      name: "wait-until",
      kind: "string",
      description: "Navigation wait state",
      choices: ["domcontentloaded", "load", "networkidle"],
      defaultDescription: "networkidle",
    },
    { name: "har", placeholder: "file", kind: "path", description: "Replay network responses from a Playwright HAR" },
    {
      name: "storage-state",
      kind: "path",
      description: "Playwright storage state, to measure pages behind a login (or set VLMKIT_STORAGE_STATE)",
    },
    { name: "allow", kind: "string", description: "Exempt an intentional pattern (see below)", repeatable: true },
  ],
  parse: (argv) => {
    const source = firstPositional(argv, "vlmkit check integrity <html-or-url>");
    const widths = numberList(argv, "viewports");
    if (widths && widths.some((w) => w <= 0)) {
      throw new UsageError("--viewports must be positive px widths, e.g. --viewports 1280,768,375");
    }
    const maxFindings = optionalInt(argv, "max-findings", { min: 1 });
    const timeout = optionalInt(argv, "timeout", { min: 1 });
    const waitUntil = readChoice(argv, "wait-until", ["domcontentloaded", "load", "networkidle"] as const);
    const storageState = readFlag(argv, "storage-state");
    const har = readFlag(argv, "har");
    // Parsed before the browser starts, so a typo in an exemption fails in
    // milliseconds instead of after a three-viewport sweep.
    const allow = parseAllowRules(readAll(argv, "allow"));
    return {
      source,
      ...(widths && widths.length > 0
        ? { viewports: widths.map((width) => ({ width, height: VIEWPORT_HEIGHTS[width] ?? 800 })) }
        : {}),
      ...(maxFindings !== undefined ? { maxFindings } : {}),
      ...(timeout !== undefined ? { timeout } : {}),
      ...(waitUntil ? { waitUntil } : {}),
      ...(storageState ? { storageState } : {}),
      ...(har ? { har } : {}),
      ...(allow.length > 0 ? { allow } : {}),
    };
  },
  run: (options) => runIntegrityCheck(options),
  findings: (report): Finding[] =>
    report.findings.map((finding) => ({
      rule: finding.kind,
      // The one severity translation in the codebase: integrity says "fail"
      // where every other gate says "suspect".
      severity: finding.severity === "fail" ? "suspect" : "warn",
      message: finding.message,
      ...(finding.selector ? { selector: finding.selector } : {}),
      viewport: finding.viewport,
      ...(finding.evidence ? { evidence: finding.evidence } : {}),
    })),
  format: formatIntegrityReport,
  headline: (report) => {
    const fails = report.findings.filter((f) => f.severity === "fail").length;
    const warns = report.findings.length - fails;
    return `${report.verdict === "clean" ? "CLEAN" : "DEFECTS"}`
      + ` (${fails} fail, ${warns} warn, ${report.exempted.length} exempted`
      + `, ${report.viewports.length} viewport(s))`;
  },
  ledger: (report, options) => ({
    tool: "check-integrity",
    source: options.source,
    headline: {
      verdict: report.verdict,
      findings: report.findings.length,
      exempted: report.exempted.length,
      viewports: report.viewports.length,
    },
  }),
});
