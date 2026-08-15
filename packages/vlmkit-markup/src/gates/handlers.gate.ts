/**
 * `scan handlers` as a gate definition. Measurement code in
 * `../inspect/handler-map.ts` is untouched.
 *
 * `scan` reads like inventory rather than judgment, and that mismatch is part
 * of what let the exit-code contract drift here: two commands in the same
 * group disagreed about whether a finding fails. It has a verdict (a
 * pointer-only control is a real defect), so it is a gate.
 */

import { PAGE_LOAD_INPUTS, type PageLoadOptions, parsePageLoad } from "@mizchi/vlmkit-core/page-load.ts";
import { defineGate } from "@mizchi/vlmkit-core/plugin/contract.ts";
import type { Finding } from "@mizchi/vlmkit-core/plugin/contract.ts";
import {
  type HandlerIssue,
  type HandlerSurface,
  buildHandlerSurface,
  deriveHandlerIssues,
  HANDLER_SURFACE_RULES,
  formatHandlerSurface,
} from "../inspect/handler-map.ts";
import { firstPositional } from "@mizchi/vlmkit-core/plugin/args.ts";

export interface HandlersGateReport {
  surface: HandlerSurface;
  issues: HandlerIssue[];
}

export const handlersGate = defineGate<HandlersGateReport, PageLoadOptions & { source: string; probeDrag?: boolean }>({
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

HTML5 drag and drop is inspected the same way as any other handler
family, and its failure modes are handlers that CANNOT FIRE. Read
from the DOM: a dragstart source that is not draggable, and a drop
target with no dragover to preventDefault on.

--probe-drag also drives a real mouse gesture at every pointer-drag
surface (pointerdown + pointermove on one element -- canvas editors,
sortable lists, sliders) and reports how many of the element's own
pixels moved while held and after release. Reported, not graded: a
0% row is ambiguous between dead handlers, a gesture that began
somewhere ungrabbable, and feedback painted outside the box. What it
does settle is that those types were exercised, so they stop being
listed as uncovered.

It also counts invocations of the element's OWN listeners, and that
one IS graded: registered handlers a delivered gesture never invoked
means something is intercepting -- an overlay, pointer-events on an
ancestor, a listener on a detached node. That separates "unreachable"
from "reachable but inert", which pixels cannot.

--probe-drag adds the two that no static read can reach, by firing
the sequence and watching what happens: a dragover handler that
never calls preventDefault (registered, so the check above passes
it, and the browser rejects the drop anyway), and a dragstart that
leaves the DataTransfer empty. Off by default because dispatching
runs the page's own handlers; 'check interactions --handlers' turns
it on, since that gate already probes.

There is no dragmove event — the continuous ones are drag (on the
source) and dragover (on the target).

Framework caveat: React-style root delegation appears as one listener
on the delegation root; per-element granularity is a vanilla/Web
Components property.`,
  rules: [...HANDLER_SURFACE_RULES],
  inputs: [
    { name: "source", placeholder: "html-or-url", kind: "path-or-url", description: "Page to scan", positional: 0, required: true },
    {
      name: "probe-drag",
      kind: "boolean",
      description: "Fire the drag sequence to check dragover preventDefault + DataTransfer (runs page handlers)",
    },
    ...PAGE_LOAD_INPUTS,
  ],
  // Opt-in, because this gate is an inventory and dispatching runs the page's own logic —
  // a drop handler that POSTs will POST. `check interactions` probes by default and turns
  // it on with `--handlers`.
  parse: (argv) => ({
    source: firstPositional(argv, "vlmkit scan handlers <html-or-url>"),
    probeDrag: argv.includes("--probe-drag"),
    ...parsePageLoad(argv),
  }),
  run: async ({ source, probeDrag, ...pageLoad }) => {
    const surface = await buildHandlerSurface({ source, probeDrag, ...pageLoad });
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
