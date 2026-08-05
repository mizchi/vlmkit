/**
 * `scan scroll` as a gate definition. Measurement code in
 * `../inspect/scroll-scan.ts` is untouched.
 *
 * Inventory *and* verdict: it lists every scroll container (pasteable into a
 * UI Contract) and fails on unintended page-level horizontal scroll. Named
 * `scan` for the first half; a gate because of the second.
 */

import { defineGate } from "@mizchi/vlmkit-core/plugin/contract.ts";
import type { Finding } from "@mizchi/vlmkit-core/plugin/contract.ts";
import {
  type ScrollScanOptions,
  type ScrollScanReport,
  formatScrollScanReport,
  runScrollScan,
} from "../inspect/scroll-scan.ts";
import { firstPositional, optionalInt, viewportFlag } from "./arg-helpers.ts";

export const scrollScanGate = defineGate<ScrollScanReport, ScrollScanOptions>({
  id: "scan.scroll",
  command: ["scan", "scroll"],
  title: "Scroll inventory",
  summary: "Annotation-free scroll inventory: containers, page overflow-x, clipped content",
  usage: `Annotation-free scroll inventory: every element that actually scrolls
(selector, axis, overflow px, bbox), unintended page-level horizontal
scroll with the sticking-out offenders, overflow:hidden cut-off
suspects, declared-but-dead scrollports, and nested scrolling.

--json includes expectedScrollports entries pasteable into a UI Contract.`,
  rules: [
    { id: "redirected", title: "Requested URL redirected elsewhere", severity: "suspect" },
    {
      id: "page-overflow-x",
      title: "Page scrolls horizontally",
      severity: "suspect",
      docs: "Almost never intended; the report names the elements sticking out.",
    },
    {
      id: "clipped-content",
      title: "Content cut off by an overflow:hidden container",
      severity: "warn",
      docs: "Tune the px floor with --clip-threshold rather than disabling the rule.",
    },
    { id: "nested-scroll", title: "Scroll container nested inside a scroll container", severity: "warn" },
  ],
  inputs: [
    { name: "source", placeholder: "html-or-url", kind: "path-or-url", description: "Page to scan", positional: 0, required: true },
    { name: "viewport", placeholder: "WxH", kind: "string", description: "Viewport", defaultDescription: "1280x720" },
    { name: "clip-threshold", placeholder: "px", kind: "number", description: "Hidden px below which clipping is ignored", defaultDescription: "16" },
  ],
  parse: (argv) => {
    const source = firstPositional(argv, "vlmkit scan scroll <html-or-url>", ["--clip-threshold"]);
    const clipThreshold = optionalInt(argv, "clip-threshold", { min: 0 });
    const viewport = viewportFlag(argv);
    return {
      source,
      ...(clipThreshold !== undefined ? { clipThreshold } : {}),
      ...(viewport ? { viewport } : {}),
    };
  },
  run: (options) => runScrollScan(options),
  findings: (report): Finding[] =>
    report.issues.map((issue) => ({
      rule: issue.kind,
      severity: issue.severity,
      message: issue.message,
      ...(issue.selector ? { selector: issue.selector } : {}),
    })),
  format: formatScrollScanReport,
  ledger: (report, options) => ({
    tool: "scan-scroll",
    source: options.source,
    headline: {
      containers: report.containers.length,
      overflowX: report.page.horizontalOverflow,
      issues: report.issues.length,
    },
  }),
});
