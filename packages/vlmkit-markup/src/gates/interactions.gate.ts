/**
 * `check interactions` as a gate definition. Measurement code in
 * `../inspect/interaction-map.ts` is untouched.
 *
 * The composite report here is the same object the MCP tool already
 * assembled by hand (`{ map, issues, comparison, handlerSurface, ... }`).
 * Assembling it once, in the gate, is what lets the MCP tool eventually be a
 * loop over the registry instead of a second copy of this logic.
 *
 * `--reference` turns the reference page's inventory into a behavioral
 * contract, so its mismatches are findings too — that is the part which
 * catches a page matching every screenshot while responding wrongly to the
 * keyboard. They are attributed to `contract-missing` / `contract-mismatch`
 * rather than to the per-element rules, so a project can enforce the contract
 * without re-tuning the element rules.
 */

import { readFlag } from "@mizchi/vlmkit-core/arg-reader.ts";
import { PAGE_LOAD_INPUTS, type PageLoadOptions, parsePageLoad } from "@mizchi/vlmkit-core/page-load.ts";
import { defineGate } from "@mizchi/vlmkit-core/plugin/contract.ts";
import type { Finding } from "@mizchi/vlmkit-core/plugin/contract.ts";
import { GREEN, RESET, YELLOW } from "@mizchi/vlmkit-core/terminal-colors.ts";
import {
  type InteractionComparison,
  type InteractionIssue,
  type InteractionMapResult,
  buildInteractionMap,
  compareInteractionMaps,
  deriveInteractionIssues,
  formatInteractionReport,
} from "../inspect/interaction-map.ts";
import {
  type HandlerIssue,
  type HandlerSurface,
  type SurfaceMismatch,
  formatHandlerSurface,
} from "../inspect/handler-map.ts";
import { firstPositional, optionalInt } from "@mizchi/vlmkit-core/plugin/args.ts";

export interface InteractionsGateOptions extends PageLoadOptions {
  source: string;
  reference?: string;
  maxElements: number;
  handlers: boolean;
}

export interface InteractionsGateReport {
  map: InteractionMapResult;
  issues: InteractionIssue[];
  comparison?: InteractionComparison;
  handlerSurface?: HandlerSurface;
  handlerIssues?: HandlerIssue[];
  surfaceMismatches?: SurfaceMismatch[];
}

export const interactionsGate = defineGate<InteractionsGateReport, InteractionsGateOptions>({
  id: "check.interactions",
  command: ["check", "interactions"],
  title: "A11y-event state map",
  summary:
    "A11y-event state map: keyboard probes -> ARIA transitions; --reference makes it a behavioral contract",
  category: "behavior",
  usage: `A11y-event state map: discovers interactive elements, probes their
canonical keyboard events (Tab / Enter / Space / arrows / Escape), and
records the resulting state changes as ARIA transitions + layout
deltas. With --reference, the reference's inventory is the behavioral
contract and every response mismatch is reported.`,
  rules: [
    { id: "dead-disclosure", title: "Disclosure control changes no state", severity: "suspect" },
    { id: "broken-aria-controls", title: "aria-controls points at nothing", severity: "suspect" },
    { id: "focus-escapes-trap", title: "Focus leaves a modal dialog", severity: "suspect" },
    { id: "inert-control", title: "Control responds to no probed key", severity: "warn" },
    { id: "no-focus-indicator", title: "Focused element shows no visible indicator", severity: "warn" },
    { id: "not-tab-reachable", title: "Interactive element is not reachable by Tab", severity: "warn" },
    { id: "escape-stuck", title: "Escape does not dismiss", severity: "warn" },
    { id: "popup-no-focus-move", title: "Opening a popup does not move focus into it", severity: "warn" },
    { id: "focus-not-returned", title: "Closing a popup does not restore focus", severity: "warn" },
    { id: "popup-arrows-dead", title: "Arrow keys do not navigate a popup", severity: "warn" },
    { id: "composite-arrows-dead", title: "Arrow keys do not navigate a composite widget", severity: "warn" },
    {
      id: "contract-missing",
      title: "Reference interaction absent from this page",
      severity: "suspect",
      docs: "Only with --reference: matched by (role, accessible name).",
    },
    {
      id: "contract-mismatch",
      title: "Interaction responds differently than the reference",
      severity: "suspect",
      docs: "Only with --reference. The comparison decides suspect vs warn per mismatch.",
    },
    {
      id: "contract-extra",
      title: "Interaction present here but not in the reference",
      severity: "warn",
      docs: "Only with --reference. Extra interactivity is reported, never blocking.",
    },
    {
      id: "handler-surface-mismatch",
      title: "Event vocabulary differs from the reference",
      severity: "warn",
      docs: "Only with --handlers --reference.",
    },
  ],
  inputs: [
    { name: "source", placeholder: "html-or-url", kind: "path-or-url", description: "Page to probe", positional: 0, required: true },
    { name: "reference", placeholder: "html", kind: "path", description: "Reference page defining the interaction contract" },
    { name: "max-elements", kind: "number", description: "Probe cap (the report says when capped)", defaultDescription: "30" },
    {
      name: "handlers",
      kind: "boolean",
      description: "Also enumerate the wired event-callback surface (scan handlers) and cross-check it",
    },
    ...PAGE_LOAD_INPUTS,
  ],
  parse: (argv) => {
    const source = firstPositional(argv, "vlmkit check interactions <html-or-url>", ["--reference", "--max-elements"]);
    const reference = readFlag(argv, "reference");
    const maxElements = optionalInt(argv, "max-elements", { min: 1 }) ?? 30;
    return {
      source,
      maxElements,
      handlers: argv.includes("--handlers"),
      ...(reference ? { reference } : {}),
      ...parsePageLoad(argv),
    };
  },
  run: async ({ source, reference, maxElements, handlers, ...pageLoad }) => {
    const map = await buildInteractionMap({ source, maxElements, ...pageLoad });
    const report: InteractionsGateReport = { map, issues: deriveInteractionIssues(map) };
    if (reference) {
      // The reference is measured with the same load options: comparing a
      // settled attempt against an early-read reference would report the
      // reference's placeholder as the contract.
      const refMap = await buildInteractionMap({ source: reference, maxElements, ...pageLoad });
      report.comparison = compareInteractionMaps(refMap, map);
    }
    if (handlers) {
      const { buildHandlerSurface, compareHandlerSurfaces, deriveHandlerIssues } = await import(
        "../inspect/handler-map.ts"
      );
      const surface = await buildHandlerSurface({ source, ...pageLoad });
      report.handlerSurface = surface;
      report.handlerIssues = deriveHandlerIssues(surface);
      if (reference) {
        const refSurface = await buildHandlerSurface({ source: reference, ...pageLoad });
        report.surfaceMismatches = compareHandlerSurfaces(refSurface, surface);
      }
    }
    return report;
  },
  findings: (report): Finding[] => {
    // Both issue types identify by DOM path (`element`), not by selector, so
    // the path travels as evidence rather than as a selector nothing can query.
    const findings: Finding[] = report.issues.map((issue) => ({
      rule: issue.kind,
      severity: issue.severity,
      message: issue.message,
      ...(issue.element ? { evidence: { element: issue.element } } : {}),
    }));
    for (const issue of report.handlerIssues ?? []) {
      findings.push({
        rule: issue.kind,
        severity: issue.severity,
        message: issue.message,
        ...(issue.element ? { evidence: { element: issue.element } } : {}),
      });
    }
    const comparison = report.comparison;
    if (comparison) {
      for (const missing of comparison.missing) {
        findings.push({
          rule: "contract-missing",
          severity: "suspect",
          message: `reference interaction missing: ${describeEntry(missing)}`,
        });
      }
      for (const extra of comparison.extra) {
        findings.push({
          rule: "contract-extra",
          severity: "warn",
          message: `not in the reference: ${describeEntry(extra)}`,
        });
      }
      for (const mismatch of comparison.mismatches) {
        findings.push({ rule: "contract-mismatch", severity: mismatch.severity, message: mismatch.message });
      }
    }
    for (const mismatch of report.surfaceMismatches ?? []) {
      findings.push({ rule: "handler-surface-mismatch", severity: "warn", message: mismatch.message });
    }
    return findings;
  },
  format: (report) => {
    const text = formatInteractionReport(report.map, report.issues, report.comparison);
    return report.handlerSurface && report.handlerIssues ? `${text}\n\n${formatHandlerBlock(report)}` : text;
  },
  ledger: (report, options) => ({
    tool: "check-interactions",
    source: options.source,
    ...(options.reference ? { target: options.reference } : {}),
    headline: {
      elements: report.map.elements.length,
      suspects: report.issues.filter((i) => i.severity === "suspect").length
        + (report.comparison
          ? report.comparison.missing.length
            + report.comparison.mismatches.filter((m) => m.severity === "suspect").length
          : 0),
      warns: report.issues.filter((i) => i.severity === "warn").length
        + (report.comparison
          ? report.comparison.extra.length
            + report.comparison.mismatches.filter((m) => m.severity === "warn").length
          : 0),
    },
  }),
});

function describeEntry(entry: { role: string; name: string; path: string }): string {
  return [entry.role, entry.name && `"${entry.name}"`, entry.path].filter(Boolean).join(" ");
}

/**
 * The handler block, kept in the same shape the CLI printed before the
 * migration so the output a reader has learned to scan does not move.
 *
 * `formatHandlerSurface` is imported statically because `format` is
 * synchronous by contract, and it costs nothing: it is a pure string
 * function. Only `buildHandlerSurface` — which launches a browser — stays
 * lazily imported inside `run`.
 */
function formatHandlerBlock(report: InteractionsGateReport): string {
  let block = formatHandlerSurface(report.handlerSurface!, report.handlerIssues!);
  if (report.surfaceMismatches) {
    block += "\n\nSurface vs reference:";
    if (report.surfaceMismatches.length === 0) block += `\n  ${GREEN}event vocabulary matches${RESET}`;
    for (const mismatch of report.surfaceMismatches) block += `\n  ${YELLOW}warn${RESET} ${mismatch.message}`;
  }
  return block;
}
