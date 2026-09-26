/**
 * `check responsive` as a gate definition. Measurement, generation and shrinking live in
 * `../stress/responsive-pbt.ts` (browser) and `@mizchi/vlmkit-judge/responsive.ts` +
 * `pbt.ts` (pure); this declares the surface.
 *
 * Severities are `check integrity`'s for the rules it shares — the judges are the same,
 * only the viewports are generated — and `warn` for `text-starved`, which is cramped
 * rather than unreadable. `untested-media-feature` is `info`: it states a limit of the
 * search, never a defect of the page.
 */

import { readChoice, readFlag, readNumber } from "@mizchi/vlmkit-core/arg-reader.ts";
import { UsageError } from "@mizchi/vlmkit-core/cli-error.ts";
import { PAGE_LOAD_INPUTS, parsePageLoad } from "@mizchi/vlmkit-core/page-load.ts";
import { defineGate } from "@mizchi/vlmkit-core/plugin/contract.ts";
import type { Finding } from "@mizchi/vlmkit-core/plugin/contract.ts";
import { firstPositional, optionalInt } from "@mizchi/vlmkit-core/plugin/args.ts";
import {
  formatResponsiveReport,
  runResponsiveCheck,
  type ResponsiveOptions,
  type ResponsiveReport,
} from "../stress/responsive-pbt.ts";

const VALUE_FLAGS = [
  "--seed", "--runs", "--min-width", "--max-width", "--min-height", "--max-height",
  "--text-scale", "--width", "--color-scheme", "--max-shrinks",
];

export const responsiveGate = defineGate<ResponsiveReport, ResponsiveOptions>({
  id: "check.responsive",
  command: ["check", "responsive"],
  title: "Responsive layout as a property-based test",
  summary:
    "Generate viewports per media-query regime (plus text scale / scheme), check layout properties, shrink each failure to its exact width range, breakpoint and declaration",
  category: "behavior",
  usage: `Property-based responsive check. The page's own media queries partition the
width range into regimes; every transition is checked on both sides, then seeded
random viewports visit every regime (height, --text-scale, colour scheme and
reduced motion vary when the page reacts to them). Each case is one resize of one
loaded page, checked with check integrity's layout judges plus text-starved.

A failure is SHRUNK before it is reported:
  1. every dimension but width moves back to the base case while it still fails,
     so the report says which ones it needs;
  2. the width widens to the exact failing interval (1px precision), which is
     anchored to the page's transitions — "starts at the 700px breakpoint, clears
     at 872px" names the breakpoint to move and where to move it;
  3. ddmin over the inline-size declarations on the element, its ancestors and
     flex/grid siblings finds the smallest set whose override clears it.

Deterministic for a seed; the seed is printed, and every failure carries a
--width replay line. check breakpoints is the boundary-consistency check (B-1 /
B / B+1 agree); this is the exploration of every regime in between.`,
  rules: [
    { id: "page-overflow-x", title: "Page scrolls horizontally at a generated viewport", severity: "suspect" },
    { id: "text-collision", title: "Overlapping text runs at a generated viewport", severity: "suspect" },
    { id: "text-clipped", title: "Text clipped by its container at a generated viewport", severity: "suspect" },
    { id: "container-protrusion", title: "Child protrudes past its container at a generated viewport", severity: "suspect" },
    { id: "occluded-text", title: "Text covered by another element at a generated viewport", severity: "suspect" },
    { id: "collapsed-container", title: "Container collapsed to zero size at a generated viewport", severity: "suspect" },
    { id: "clipped-content", title: "Content clipped by an overflow container at a generated viewport", severity: "warn" },
    {
      id: "text-starved",
      title: "Text squeezed to a word or a character per line",
      severity: "warn",
      docs:
        "A block that wraps more than its author asked and is under 4em wide, under 6em over"
        + " three or more lines, or breaks a word of 15 characters or fewer: a flex/grid item"
        + " shrunk to min-content, or a breakpoint switched on before its row fits. Found by eye"
        + " 17 times on the demo sites and by no other gate.",
    },
    {
      id: "untested-media-feature",
      title: "A media feature the generator does not vary",
      severity: "info",
      docs: "hover, pointer, resolution, prefers-contrast, …: regimes selected only by these were measured as headless Chromium reports them.",
    },
    { id: "redirected", title: "Requested URL redirected elsewhere", severity: "suspect" },
  ],
  inputs: [
    { name: "source", placeholder: "html-or-url", kind: "path-or-url", description: "Page to check", positional: 0, required: true },
    { name: "seed", kind: "number", description: "Seed for the case stream (printed with every failure)", defaultDescription: "1" },
    { name: "runs", kind: "number", description: "Cases evaluated, transition edges included", defaultDescription: "60" },
    { name: "min-width", placeholder: "px", kind: "number", description: "Narrowest width generated", defaultDescription: "320" },
    { name: "max-width", placeholder: "px", kind: "number", description: "Widest width generated", defaultDescription: "max(1440, largest breakpoint + 160)" },
    { name: "min-height", placeholder: "px", kind: "number", description: "Shortest height generated", defaultDescription: "480" },
    { name: "max-height", placeholder: "px", kind: "number", description: "Tallest height generated", defaultDescription: "1000" },
    { name: "height", placeholder: "px", kind: "number", description: "Default height: most cases use it and failures shrink toward it", defaultDescription: "900" },
    {
      name: "text-scale",
      placeholder: "x",
      kind: "number",
      description: "Largest root font-size multiplier to generate (e.g. 2 for WCAG 1.4.4); with --width, the one scale replayed",
      defaultDescription: "off",
    },
    { name: "width", placeholder: "px", kind: "number", description: "Replay one case at this width instead of generating (reproduce lines use it)" },
    { name: "color-scheme", kind: "string", choices: ["light", "dark"], description: "With --width: the colour scheme replayed" },
    { name: "reduced-motion", kind: "boolean", description: "With --width: replay with prefers-reduced-motion: reduce" },
    { name: "max-shrinks", kind: "number", description: "Failure groups shrunk and explained; the rest are listed", defaultDescription: "8" },
    { name: "no-cause", kind: "boolean", description: "Skip the declaration search (faster; intervals and anchors still reported)" },
    {
      name: "storage-state",
      kind: "path",
      description: "Playwright storage state, to measure pages behind a login (or set VLMKIT_STORAGE_STATE)",
    },
    ...PAGE_LOAD_INPUTS,
  ],
  parse: (argv) => {
    const source = firstPositional(argv, "vlmkit check responsive <html-or-url>", VALUE_FLAGS);
    const int = (name: string, min = 1) => optionalInt(argv, name, { min });
    const seed = optionalInt(argv, "seed", { min: 0 });
    const runs = int("runs");
    const minWidth = int("min-width");
    const maxWidth = int("max-width");
    const minHeight = int("min-height");
    const maxHeight = int("max-height");
    const height = int("height");
    const maxShrinks = optionalInt(argv, "max-shrinks", { min: 0 });
    const textScale = readNumber(argv, "text-scale", { min: 0.5, max: 4 });
    const width = int("width");
    const colorScheme = readChoice(argv, "color-scheme", ["light", "dark"] as const);
    const reducedMotion = argv.includes("--reduced-motion");
    if (minWidth !== undefined && maxWidth !== undefined && minWidth > maxWidth) {
      throw new UsageError(`--min-width ${minWidth} is above --max-width ${maxWidth}`);
    }
    if (width === undefined && (colorScheme !== undefined || reducedMotion)) {
      throw new UsageError("--color-scheme and --reduced-motion pin a replayed case: pass --width too. Without it, both are generated whenever the page has a query for them.");
    }
    const storageState = readFlag(argv, "storage-state");
    return {
      source,
      ...(seed !== undefined ? { seed } : {}),
      ...(runs !== undefined ? { runs } : {}),
      ...(minWidth !== undefined ? { minWidth } : {}),
      ...(maxWidth !== undefined ? { maxWidth } : {}),
      ...(minHeight !== undefined ? { minHeight } : {}),
      ...(maxHeight !== undefined ? { maxHeight } : {}),
      ...(height !== undefined ? { height } : {}),
      ...(maxShrinks !== undefined ? { maxShrinks } : {}),
      ...(width === undefined && textScale !== undefined ? { textScale } : {}),
      ...(width !== undefined
        ? {
          replay: {
            width,
            ...(height !== undefined ? { height } : {}),
            ...(textScale !== undefined ? { textScale } : {}),
            ...(colorScheme !== undefined ? { colorScheme } : {}),
            ...(reducedMotion ? { reducedMotion: "reduce" as const } : {}),
          },
        }
        : {}),
      ...(argv.includes("--no-cause") ? { noCause: true } : {}),
      ...(storageState ? { storageState } : {}),
      ...parsePageLoad(argv),
    };
  },
  run: (options) => runResponsiveCheck(options),
  findings: (report): Finding[] =>
    report.issues.map((issue) => ({
      rule: issue.kind,
      severity: issue.severity,
      message: issue.message,
      ...(issue.selector ? { selector: issue.selector } : {}),
      ...(issue.viewport !== undefined ? { viewport: issue.viewport } : {}),
      ...(issue.failure !== undefined ? { evidence: { failure: report.failures[issue.failure] } } : {}),
    })),
  format: formatResponsiveReport,
  headline: (report) =>
    `${report.cases} case(s), ${report.regimes.length} regime(s), ${report.failures.length} failure group(s)`,
  ledger: (report, options) => ({
    tool: "check-responsive",
    source: options.source,
    headline: {
      seed: report.seed,
      cases: report.cases,
      regimes: report.regimes.length,
      failures: report.failures.length,
    },
  }),
});
