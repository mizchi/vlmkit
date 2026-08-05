/**
 * `check breakpoints` as a gate definition.
 *
 * The measurement code in `../stress/breakpoint-check.ts` is untouched —
 * this only declares what the gate is (id, command, rule table, flags) and
 * wires its existing `run` / `format` functions to the core runner. What
 * disappears is the module's hand-rolled `parseArgs`, its `printUsage`, its
 * `appendRunLedger` call, and its `process.exit(1)` (which truncates
 * buffered stdout — the bug `applyGateExit` was written to avoid).
 */

import { UsageError } from "@mizchi/vlmkit-core/cli-error.ts";
import { defineGate } from "@mizchi/vlmkit-core/plugin/contract.ts";
import type { Finding } from "@mizchi/vlmkit-core/plugin/contract.ts";
import {
  type BreakpointCheckOptions,
  type BreakpointCheckReport,
  formatBreakpointCheckReport,
  runBreakpointCheck,
} from "../stress/breakpoint-check.ts";
import { firstPositional, numberList, optionalInt } from "./arg-helpers.ts";

export const breakpointsGate = defineGate<BreakpointCheckReport, BreakpointCheckOptions>({
  id: "check.breakpoints",
  command: ["check", "breakpoints"],
  title: "Breakpoint boundary quickcheck",
  summary:
    "Boundary quickcheck: render at B-1/B/B+1 per breakpoint, flag spikes/gaps/overflow (--sweep fuzzes widths in between)",
  usage: `Boundary quickcheck: render at B-1 / B / B+1 for every discovered media
query breakpoint and verify each discrete style property at B matches
one of its neighbors. Catches off-by-one boundaries (768px styled by
neither/both regimes), elements that vanish exactly on the boundary,
and horizontal overflow at boundary widths.`,
  rules: [
    {
      id: "redirected",
      title: "Requested URL redirected elsewhere",
      severity: "suspect",
      docs: "Almost always a login wall. Reported so a pass on the login page cannot be silent.",
    },
    {
      id: "boundary-spike",
      title: "Property at B matches neither neighbor",
      severity: "suspect",
      docs: "An off-by-one media query: the boundary width itself is styled by neither regime, or by both.",
    },
    {
      id: "boundary-gap",
      title: "Element present at B-1/B+1 but absent at B",
      severity: "suspect",
    },
    { id: "overflow-at-boundary", title: "Horizontal overflow at a boundary width", severity: "warn" },
    {
      id: "sweep-overflow",
      title: "Horizontal overflow at a width between boundaries",
      severity: "warn",
      docs: "Only produced with --sweep: widths that B±1 rendering never visits.",
    },
  ],
  inputs: [
    { name: "source", placeholder: "html-or-url", kind: "path-or-url", description: "Page to check", positional: 0, required: true },
    {
      name: "breakpoints",
      kind: "number-list",
      description: "Comma-separated px values",
      defaultDescription: "discovered from CSS",
    },
    { name: "sweep", kind: "boolean", description: "Also fuzz the whole width range for horizontal overflow" },
    { name: "sweep-step", kind: "number", description: "Sweep step", defaultDescription: "25" },
    { name: "height", kind: "number", description: "Render height", defaultDescription: "900" },
    { name: "max-elements", kind: "number", description: "Elements sampled per width", defaultDescription: "400" },
  ],
  parse: (argv) => {
    const source = firstPositional(argv, "vlmkit check breakpoints <html-or-url>");
    const breakpoints = numberList(argv, "breakpoints");
    if (breakpoints && breakpoints.length === 0) {
      throw new UsageError("--breakpoints needs at least one px value, e.g. --breakpoints 768,1024");
    }
    const height = optionalInt(argv, "height", { min: 1 });
    const maxElements = optionalInt(argv, "max-elements", { min: 1 });
    const sweepStep = optionalInt(argv, "sweep-step", { min: 1 });
    return {
      source,
      ...(breakpoints ? { breakpoints } : {}),
      ...(height !== undefined ? { height } : {}),
      ...(maxElements !== undefined ? { maxElements } : {}),
      ...(argv.includes("--sweep") ? { sweep: true } : {}),
      ...(sweepStep !== undefined ? { sweepStep } : {}),
    };
  },
  run: (options) => runBreakpointCheck(options),
  findings: (report): Finding[] =>
    report.issues.map((issue) => ({
      rule: issue.kind,
      severity: issue.severity,
      message: issue.message,
      ...(issue.selector ? { selector: issue.selector } : {}),
      ...(issue.breakpoint !== undefined ? { viewport: issue.breakpoint } : {}),
    })),
  format: formatBreakpointCheckReport,
  ledger: (report, options) => ({
    tool: "check-breakpoints",
    source: options.source,
    headline: {
      breakpoints: report.checkedValues.length,
      issues: report.issues.length,
      sweepRanges: report.sweep?.overflowRanges.length ?? null,
    },
  }),
});
