/**
 * `check scroll` as a gate definition. Measurement code in
 * `../inspect/scroll-behavior.ts` is untouched.
 */

import { defineGate } from "@mizchi/vlmkit-core/plugin/contract.ts";
import type { Finding } from "@mizchi/vlmkit-core/plugin/contract.ts";
import {
  type ScrollBehaviorOptions,
  type ScrollBehaviorReport,
  formatScrollBehaviorReport,
  runScrollBehavior,
} from "../inspect/scroll-behavior.ts";
import { firstPositional, viewportFlag } from "./arg-helpers.ts";

export const scrollGate = defineGate<ScrollBehaviorReport, ScrollBehaviorOptions>({
  id: "check.scroll",
  command: ["check", "scroll"],
  title: "Scroll behavior verification",
  summary:
    "Scroll behavior: fixed holds position, engaged sticky sticks, mandatory snap lands on a child edge",
  usage: `Scroll behavior verification: fixed elements must hold their viewport
position, engaged sticky elements must stick at their top offset, and
mandatory snap containers must land on a child snap edge. (Existence /
inventory is \`vlmkit scan scroll\`.)`,
  rules: [
    { id: "redirected", title: "Requested URL redirected elsewhere", severity: "suspect" },
    {
      id: "fixed-drifts",
      title: "position:fixed element moved with the scroll",
      severity: "suspect",
      docs: "A fixed element must hold its viewport position; drift usually means a transformed ancestor.",
    },
    {
      id: "sticky-not-sticking",
      title: "Engaged position:sticky element did not stick",
      severity: "suspect",
      docs: "Checked only for sticky elements the scroll actually scrolled past.",
    },
    { id: "snap-not-snapping", title: "Mandatory snap container settled off every child edge", severity: "warn" },
  ],
  inputs: [
    { name: "source", placeholder: "html-or-url", kind: "path-or-url", description: "Page to check", positional: 0, required: true },
    { name: "viewport", placeholder: "WxH", kind: "string", description: "Viewport", defaultDescription: "1280x720" },
  ],
  parse: (argv) => {
    const source = firstPositional(argv, "vlmkit check scroll <html-or-url>");
    const viewport = viewportFlag(argv);
    return { source, ...(viewport ? { viewport } : {}) };
  },
  run: (options) => runScrollBehavior(options),
  findings: (report): Finding[] =>
    report.issues.map((issue) => ({
      rule: issue.kind,
      severity: issue.severity,
      message: issue.message,
      ...(issue.selector ? { selector: issue.selector } : {}),
    })),
  format: formatScrollBehaviorReport,
  ledger: (report, options) => ({
    tool: "check-scroll",
    source: options.source,
    headline: {
      pageScrolled: report.pageScrolled,
      stickyFixed: report.stickyFixed.length,
      engagedSticky: report.engagedSticky,
      snaps: report.snaps.length,
      issues: report.issues.length,
    },
  }),
});
