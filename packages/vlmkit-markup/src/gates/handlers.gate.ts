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
  type ProbeFamily,
  buildHandlerSurface,
  deriveHandlerIssues,
  HANDLER_SURFACE_RULES,
  PROBE_FAMILIES,
  formatHandlerSurface,
} from "../inspect/handler-map.ts";
import { firstPositional } from "@mizchi/vlmkit-core/plugin/args.ts";
import { readFlag } from "@mizchi/vlmkit-core/arg-reader.ts";
import { UsageError } from "@mizchi/vlmkit-core/cli-error.ts";

export interface HandlersGateReport {
  surface: HandlerSurface;
  issues: HandlerIssue[];
}

/**
 * `--probe drag,wheel` / `--probe all`.
 *
 * A list rather than a flag per family: they keep coming, and each one runs the page's own
 * handlers, so the caller should be able to say exactly which. An unknown name is a UsageError
 * rather than a silent no-op — a typo that quietly probes nothing is the failure mode the whole
 * "absent means not measured" rule exists to avoid.
 */
export function parseProbeFamilies(argv: readonly string[]): ProbeFamily[] {
  const raw = readFlag(argv, "probe");
  if (!raw) return [];
  if (raw === "all") return [...PROBE_FAMILIES];
  const asked = raw.split(",").map((f) => f.trim()).filter(Boolean);
  const unknown = asked.filter((f) => !(PROBE_FAMILIES as readonly string[]).includes(f));
  if (unknown.length > 0) {
    throw new UsageError(
      `--probe ${unknown.join(", ")}: unknown family. Known: ${PROBE_FAMILIES.join(", ")}, or 'all'.`,
    );
  }
  return asked as ProbeFamily[];
}

export const handlersGate = defineGate<
  HandlersGateReport,
  PageLoadOptions & { source: string; probeDrag?: boolean; probes?: ProbeFamily[] }
>({
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

--probe <families> drives the other interaction families, each of
which runs the page's own handlers:

  wheel   rolls a 200px wheel over every wheel/scroll handler and
          reports what scrolled (consuming it is what a map does, so
          it is not graded). Grades a preventDefault() that did
          nothing -- a passive listener, or a non-cancelable event.
  hover   hovers each trigger and then focuses it, and reports what
          became visible either way. Triggers come from the
          stylesheets too, since a CSS :hover reveal has no listener.
  menu    right-clicks each contextmenu handler: cancelled or not,
          and whether anything appeared.
  touch   taps and swipes in a page with touch emulation on -- a
          second load, because emulation changes maxTouchPoints and
          "ontouchstart" in window, which pages branch on.
  input   types an ASCII sample, the same text in Japanese, and the
          Japanese one through an IME composition, into every visible
          text field. Grades a field that keeps the ASCII and drops
          the Japanese; the ASCII drive is the control.
  dblclick
          double-clicks each dblclick handler at a point its own
          handler does NOT apply to -- the miss -- and reports what got
          selected. On a page where double-click means something, the
          miss is ordinary play, the handler is silent about it, and the
          browser leaves a range selection behind.

--probe all for every family. An unknown name is an error rather
than a silent no-op.

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
    {
      name: "probe",
      kind: "string",
      placeholder: "drag,wheel|all",
      description: "Interaction families to drive (runs the page's own handlers). `all` for every family",
    },
    ...PAGE_LOAD_INPUTS,
  ],
  // Opt-in, because this gate is an inventory and dispatching runs the page's own logic —
  // a drop handler that POSTs will POST. `check interactions` probes by default and turns
  // it on with `--handlers`.
  parse: (argv) => ({
    source: firstPositional(argv, "vlmkit scan handlers <html-or-url>"),
    probeDrag: argv.includes("--probe-drag"),
    probes: parseProbeFamilies(argv),
    ...parsePageLoad(argv),
  }),
  run: async ({ source, probeDrag, probes, ...pageLoad }) => {
    const surface = await buildHandlerSurface({ source, probeDrag, probes, ...pageLoad });
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
  format: ({ surface, issues }, rules) => formatHandlerSurface(surface, issues, rules),
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
