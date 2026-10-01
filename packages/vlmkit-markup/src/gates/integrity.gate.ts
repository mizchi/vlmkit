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
import { PAGE_LOAD_INPUTS, parsePageLoad } from "@mizchi/vlmkit-core/page-load.ts";
import {
  type IntegrityOptions,
  type IntegrityReport,
  formatIntegrityReport,
  runIntegrityCheck,
} from "../inspect/integrity-check.ts";
import { ALLOW_HELP, parseAllowRules } from "../inspect/integrity-exemption.ts";
import {
  IMAGE_MODE_SKIPPED_RULES,
  type IntegrityImageReport,
  runImageIntegrityCheck,
} from "../inspect/integrity-image.ts";
import { firstPositional, firstPositionalOrUndefined, numberList, optionalInt } from "@mizchi/vlmkit-core/plugin/args.ts";

/** Heights the CLI has always paired with its default sweep widths. */
const VIEWPORT_HEIGHTS: Record<number, number> = { 1280: 800, 768: 900, 375: 700 };

export const integrityGate = defineGate<IntegrityReport, IntegrityOptions>({
  id: "check.integrity",
  command: ["check", "integrity"],
  title: "Reference-free integrity gate",
  summary:
    "Reference-free defect gate: JS errors, empty render, broken resources, text collision/clipping/protrusion, collapsed containers, overflow, invisible text, occluded text, near-misalignment, unstyled page (multi-viewport)",
  category: "correctness",
  usage: `Reference-free integrity gate for creative/zero-shot markup: JS
construction failures, empty renders, broken resources, colliding or
clipped text, collapsed containers, page overflow, and unstyled pages —
swept across multiple viewports. Deterministic (DOM + pixels, no VLM);
intentional-pattern exemptions are reported, not silently dropped.

--timeline also judges the page across its motion: the page clock (rAF, timers,
Date) and every animation are held, and at each instant of page time the layout
judges run on what is there — text collision, clipping, protrusion, occlusion,
invisible / low-contrast text, collapse, overflow. A finding the settled page
also has is left to the ordinary run. One HELD across consecutive instants is
reported at its rule's severity ("While the page moves ..."); one seen at a
single instant is listed as transient and carries no weight. Instants default to
each animation's start, middle and end plus 0/250/500/1000/2000ms;
--timeline-at 0,150,300 names them.

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
    {
      id: "stale-har-fixture",
      title: "The --har recording is missing requests the page made",
      severity: "suspect",
      docs: "Not a defect in the page: the run's own network fixture is out of date, so the page was measured without those resources and every other finding is suspect. Re-record the HAR over the same navigation. Kept at `suspect` because the alternative is a verdict about a page that never finished loading.",
    },
  ],
  inputs: [
    { name: "source", placeholder: "html-or-url", kind: "path-or-url", description: "Page to check (omit when using --image/--elements)", positional: 0 },
    {
      name: "elements",
      placeholder: "elements.json",
      kind: "path",
      description: "Element rects instead of a DOM — canvas/WebGPU, native, Flutter (no browser)",
    },
    {
      name: "image",
      placeholder: "frame.png",
      kind: "path",
      description: "Frame PNG for --elements mode; enables the ink-based empty-render rule",
    },
    { name: "viewports", placeholder: "w,w,...", kind: "number-list", description: "Sweep widths", defaultDescription: "1280,768,375" },
    { name: "max-findings", kind: "number", description: "Per-class report cap", defaultDescription: "12" },
    {
      name: "storage-state",
      kind: "path",
      description: "Playwright storage state, to measure pages behind a login (or set VLMKIT_STORAGE_STATE)",
    },
    { name: "allow", kind: "string", description: "Exempt an intentional pattern (see below)", repeatable: true },
    { name: "timeline", kind: "boolean", description: "Also judge layout across the page's motion (clock and animations held), tiered by persistence" },
    { name: "timeline-at", placeholder: "ms,ms,...", kind: "number-list", description: "The instants of page time --timeline judges at", defaultDescription: "each animation's start/middle/end + 0,250,500,1000,2000" },
    // Spread, not re-declared. Hand-written copies of these three drifted from the
    // fragment: v5's CI agent found the `--wait-until` hint present on `check copy`
    // and `check breakpoints` and absent here — "and integrity is the gate you reach
    // for first."
    ...PAGE_LOAD_INPUTS,
  ],
  parse: (argv) => {
    const elements = readFlag(argv, "elements");
    const image = readFlag(argv, "image");
    if (elements) {
      // Image mode. Deliberately mutually exclusive with a page source rather than
      // "source wins" or "both are measured": the two paths evaluate different rule sets,
      // so a run that quietly picked one would make its verdict ambiguous.
      if (firstPositionalOrUndefined(argv)) {
        throw new UsageError(
          "check integrity takes either a page source or --elements, not both. The two modes "
          + "evaluate different rule sets, so a combined run's verdict would be ambiguous.",
        );
      }
      const maxFindingsForImage = optionalInt(argv, "max-findings", { min: 1 });
      return {
        source: image ?? elements,
        imageMode: {
          elementsPath: elements,
          ...(image ? { imagePath: image } : {}),
          ...(maxFindingsForImage !== undefined ? { maxFindings: maxFindingsForImage } : {}),
        },
      };
    }
    if (image) {
      throw new UsageError("--image needs --elements: a PNG alone carries no element rects to judge.");
    }
    const source = firstPositional(argv, "vlmkit check integrity <html-or-url> | --elements <elements.json> [--image <frame.png>]");
    const widths = numberList(argv, "viewports");
    if (widths && widths.some((w) => w <= 0)) {
      throw new UsageError("--viewports must be positive px widths, e.g. --viewports 1280,768,375");
    }
    const maxFindings = optionalInt(argv, "max-findings", { min: 1 });
    const pageLoad = parsePageLoad(argv);
    const timeout = pageLoad.timeout;
    const waitUntil = pageLoad.waitUntil;
    const storageState = readFlag(argv, "storage-state");
    const har = pageLoad.har;
    // Parsed before the browser starts, so a typo in an exemption fails in
    // milliseconds instead of after a three-viewport sweep.
    const allow = parseAllowRules(readAll(argv, "allow"));
    const timelineAt = numberList(argv, "timeline-at");
    if (timelineAt && timelineAt.some((t) => t < 0 || !Number.isFinite(t))) {
      throw new UsageError("--timeline-at takes instants in ms of page time, e.g. --timeline-at 0,150,300");
    }
    const timeline = argv.includes("--timeline") || (timelineAt !== undefined && timelineAt.length > 0);
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
      ...(timeline ? { timeline: timelineAt && timelineAt.length > 0 ? { at: timelineAt } : {} } : {}),
    };
  },
  run: (options) => (options.imageMode
    ? runImageIntegrityCheck(options.imageMode)
    : runIntegrityCheck(options)),
  findings: (report): Finding[] => [
    ...report.findings.map((finding) => ({
      rule: finding.kind,
      // The one severity translation in the codebase: integrity says "fail"
      // where every other gate says "suspect".
      severity: finding.severity === "fail" ? "suspect" as const : "warn" as const,
      message: finding.message,
      ...(finding.selector ? { selector: finding.selector } : {}),
      viewport: finding.viewport,
      ...(finding.evidence ? { evidence: finding.evidence } : {}),
    })),
    // A glimpse mid-motion: in the findings so --json and the ledger see it, at `info`, which
    // never affects a verdict.
    ...(report.timeline?.transient ?? []).map(({ finding, seenAtMs, run }) => ({
      rule: finding.kind,
      severity: "info" as const,
      message: `Only at ${seenAtMs.join("/")}ms of page time (transient): ${finding.message}`,
      ...(finding.selector ? { selector: finding.selector } : {}),
      viewport: finding.viewport,
      evidence: { ...(finding.evidence ?? {}), timeline: { seenAtMs, run } },
    })),
  ],
  format: formatIntegrityReport,
  headline: (report) => {
    const fails = report.findings.filter((f) => f.severity === "fail").length;
    const warns = report.findings.length - fails;
    const image = report as IntegrityImageReport;
    // In image mode the count of rules that did NOT run belongs in the headline, not
    // buried in the report body. `CLEAN` covering six (or eight) of eighteen rules is a different
    // claim from `CLEAN` covering all of them, and the difference has to be visible at
    // the point someone reads the verdict.
    const coverage = image.skippedRules
      ? ` [image mode: ${IMAGE_MODE_SKIPPED_RULES.length} rule(s) not evaluable`
        + `${image.inertRules?.length ? `, ${image.inertRules.length} inert` : ""}]`
      : "";
    return `${report.verdict === "clean" ? "CLEAN" : "DEFECTS"}`
      + ` (${fails} fail, ${warns} warn, ${report.exempted.length} exempted`
      + `, ${report.viewports.length} viewport(s))${coverage}`;
  },
  ledger: (report, options) => ({
    tool: "check-integrity",
    source: options.source,
    headline: {
      verdict: report.verdict,
      findings: report.findings.length,
      // `fails` / `warns` kept split. `runIntegrityCheck` used to append its own
      // row carrying that split; removing it (the runner owns the ledger) would
      // otherwise have quietly coarsened what the ledger records.
      fails: report.findings.filter((f) => f.severity === "fail").length,
      warns: report.findings.filter((f) => f.severity === "warn").length,
      exempted: report.exempted.length,
      viewports: report.viewports.length,
    },
  }),
});
