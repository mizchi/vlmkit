/**
 * `scan handlers` as a gate definition. Measurement code in
 * `../inspect/handler-map.ts` is untouched.
 *
 * `scan` reads like inventory rather than judgment, and that mismatch is part
 * of what let the exit-code contract drift here: two commands in the same
 * group disagreed about whether a finding fails. It has a verdict (a
 * pointer-only control is a real defect), so it is a gate.
 */

import { defineGate } from "@mizchi/vlmkit-core/plugin/contract.ts";
import type { Finding } from "@mizchi/vlmkit-core/plugin/contract.ts";
import {
  type HandlerIssue,
  type HandlerSurface,
  buildHandlerSurface,
  deriveHandlerIssues,
  formatHandlerSurface,
} from "../inspect/handler-map.ts";
import { firstPositional } from "./arg-helpers.ts";

export interface HandlersGateReport {
  surface: HandlerSurface;
  issues: HandlerIssue[];
}

export const handlersGate = defineGate<HandlersGateReport, { source: string }>({
  id: "scan.handlers",
  command: ["scan", "handlers"],
  title: "Event-callback surface",
  summary: "Event-callback surface: every wired listener + pointer-only-control cross-check (experimental)",
  category: "behavior",
  usage: `Enumerates every event callback wired on the page (addEventListener
via an init-script patch + on* attributes/properties) into a
per-element event surface, and cross-checks it against the a11y
interaction discovery. Headline detection: pointer-only controls —
click handlers on role-less elements no keyboard user can operate.

Framework caveat: React-style root delegation appears as one listener
on the delegation root; per-element granularity is a vanilla/Web
Components property.`,
  rules: [
    {
      id: "pointer-only-control",
      title: "Click handler on a role-less element with no keyboard path",
      severity: "suspect",
      docs: "Operable by mouse but not by keyboard or assistive tech. The headline detection of this gate.",
    },
    {
      id: "delegated-handlers-opaque",
      title: "Root delegation hides per-element handlers",
      severity: "warn",
      docs: "Expected on React-style apps: the surface is measurable, just not per element.",
    },
    { id: "unprobed-handler-types", title: "Event types this gate does not probe", severity: "warn" },
  ],
  inputs: [
    { name: "source", placeholder: "html-or-url", kind: "path-or-url", description: "Page to scan", positional: 0, required: true },
  ],
  parse: (argv) => ({ source: firstPositional(argv, "vlmkit scan handlers <html-or-url>") }),
  run: async ({ source }) => {
    const surface = await buildHandlerSurface({ source });
    return { surface, issues: deriveHandlerIssues(surface) };
  },
  findings: ({ issues }): Finding[] =>
    issues.map((issue) => ({
      rule: issue.kind,
      severity: issue.severity,
      message: issue.message,
      // `element` rather than `selector`: this gate identifies by DOM path,
      // which is not always a valid selector.
      ...(issue.element ? { evidence: { element: issue.element } } : {}),
    })),
  format: ({ surface, issues }) => formatHandlerSurface(surface, issues),
  ledger: ({ surface, issues }, { source }) => ({
    tool: "scan-handlers",
    source,
    headline: {
      registrations: surface.totalRegistrations,
      elements: surface.elements.length,
      suspects: issues.filter((i) => i.severity === "suspect").length,
    },
  }),
});
