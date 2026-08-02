#!/usr/bin/env node
/**
 * Media-query boundary quickcheck.
 *
 * `scan breakpoints` discovers breakpoint values statically; this tool
 * *verifies* them. For every breakpoint B it renders the page at B−1, B,
 * and B+1 and checks the boundary invariant on discrete per-element
 * style properties:
 *
 *     value(B) must equal value(B−1) or value(B+1)
 *
 * A width belongs to exactly one media regime, so a property that
 * matches *neither* neighbor means the boundary is inconsistent — the
 * classic `max-width: 767px` + `min-width: 769px` off-by-one where
 * 768px gets neither rule (or both). Violations surface as:
 *
 *   - `boundary-spike`: a discrete property differs from both neighbors
 *     at exactly B
 *   - `boundary-gap`: an element is hidden (or visible) only at exactly B
 *   - `overflow-at-boundary`: the page scrolls horizontally at a sampled
 *     width — layout breaks right at the boundary
 *
 * Only discrete properties are compared (display, position,
 * flex-direction, grid track *count*, …) — continuous values like px
 * widths legitimately change at every viewport width in fluid layouts.
 *
 * Deterministic: Playwright + computed styles, resize without reload. No VLM.
 *
 * Usage:
 *   vlmkit check breakpoints <html-or-url>
 *   vlmkit check breakpoints <html-or-url> --breakpoints 768,1024 --json
 */
import { resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { extractBreakpoints } from "@mizchi/vlmkit-capture/viewport-discovery.ts";
import { handleCliError } from "@mizchi/vlmkit-core/cli-error.ts";
import { withAuthState } from "@mizchi/vlmkit-core/auth-state.ts";
import { describeRedirect } from "@mizchi/vlmkit-core/navigation-redirect.ts";
import { appendRunLedger } from "@mizchi/vlmkit-core/run-ledger.ts";
import { BOLD, CYAN, DIM, GREEN, RED, RESET, YELLOW } from "@mizchi/vlmkit-core/terminal-colors.ts";

/** Discrete computed properties compared across boundary widths. */
export interface ElementStyleSample {
  selector: string;
  hidden: boolean;
  display: string;
  position: string;
  float: string;
  flexDirection: string;
  flexWrap: string;
  /** Number of explicit grid column tracks (0 when not a grid). */
  gridColumnCount: number;
  order: string;
  textAlign: string;
}

export interface WidthSample {
  width: number;
  horizontalOverflow: number;
  elements: ElementStyleSample[];
}

export interface BoundaryViolation {
  selector: string;
  property: string;
  below: string;
  at: string;
  above: string;
}

export interface BoundaryGap {
  selector: string;
  /** "hidden-only-at" = vanishes exactly at B; "visible-only-at" = exists only at B. */
  kind: "hidden-only-at" | "visible-only-at";
}

export interface BreakpointResult {
  value: number;
  raw: string[];
  samples: { width: number; horizontalOverflow: number }[];
  spikes: BoundaryViolation[];
  gaps: BoundaryGap[];
}

export type BreakpointCheckIssueKind =
  /**
   * A URL that redirected somewhere meaningful — almost always a login wall.
   * Measured 2026-08-02: pointed at an auth-walled route with no session, this
   * gate reported `status: ok` for the login page while naming the requested
   * URL as its source. Reported as a suspect issue so the pass cannot be silent.
   */
  | "redirected"
  | "boundary-spike"
  | "boundary-gap"
  | "overflow-at-boundary"
  | "sweep-overflow";

export interface BreakpointCheckIssue {
  kind: BreakpointCheckIssueKind;
  severity: "warn" | "suspect";
  message: string;
  selector?: string;
  breakpoint?: number;
}

export interface SweepOverflowRange {
  from: number;
  to: number;
  maxOverflow: number;
}

export interface SweepResult {
  min: number;
  max: number;
  step: number;
  sampledWidths: number;
  overflowRanges: SweepOverflowRange[];
}

/**
 * Collapse per-width overflow samples into contiguous ranges. The declared
 * B±1 checks can never see a width in the middle of a regime — the classic
 * miss is a fixed-width child that only overflows at, say, 830-870px,
 * between two healthy breakpoints.
 */
export function collapseSweepOverflow(
  samples: { width: number; horizontalOverflow: number }[],
  minOverflow = 1,
): SweepOverflowRange[] {
  const ranges: SweepOverflowRange[] = [];
  let open: SweepOverflowRange | null = null;
  for (const s of [...samples].sort((a, b) => a.width - b.width)) {
    if (s.horizontalOverflow >= minOverflow) {
      if (open) {
        open.to = s.width;
        open.maxOverflow = Math.max(open.maxOverflow, s.horizontalOverflow);
      } else {
        open = { from: s.width, to: s.width, maxOverflow: s.horizontalOverflow };
      }
    } else if (open) {
      ranges.push(open);
      open = null;
    }
  }
  if (open) ranges.push(open);
  return ranges;
}

export function deriveSweepIssues(sweep: SweepResult): BreakpointCheckIssue[] {
  return sweep.overflowRanges.map((r) => ({
    kind: "sweep-overflow" as const,
    severity: "warn" as const,
    message: `Horizontal overflow at ${r.from === r.to ? `${r.from}px` : `${r.from}-${r.to}px`} (up to ${r.maxOverflow}px past the viewport) — a width between declared breakpoints that the B±1 checks never render. Look for a fixed-width element inside that regime.`,
  }));
}

export interface BreakpointCheckReport {
  source: string;
  breakpoints: BreakpointResult[];
  /** Breakpoint values that were checked. */
  checkedValues: number[];
  /** Cross-origin stylesheets whose rules were unreadable in-page: how many, and how many were recovered by fetching. */
  stylesheets?: { crossOrigin: number; fetched: number };
  /** Present when --sweep ran: continuous-width overflow fuzz results. */
  sweep?: SweepResult;
  issues: BreakpointCheckIssue[];
}

export interface BreakpointCheckOptions {
  /**
   * Playwright storage-state file so gates can measure pages behind a
   * login. Falls back to VLMKIT_STORAGE_STATE. See auth-state.ts.
   */
  storageState?: string;
  source: string;
  html?: string;
  /** Override discovered breakpoints (px values). */
  breakpoints?: number[];
  /** Viewport height for all renders (default 900). */
  height?: number;
  /** Max elements sampled per width (default 400). */
  maxElements?: number;
  /** Max breakpoints checked (default 8). */
  maxBreakpoints?: number;
  /** Also sweep the whole width range checking horizontal overflow only. */
  sweep?: boolean;
  /** Sweep step in px (default 25). */
  sweepStep?: number;
  /** Sweep range (defaults: 320 .. max(1280, largest breakpoint + 100)). */
  sweepMin?: number;
  sweepMax?: number;
}

function isUrl(source: string): boolean {
  return /^(https?|file):\/\//.test(source);
}

/**
 * Extract width breakpoints written in media-query range syntax —
 * `(width >= 768px)`, `(48rem < width)`, `(400px <= width <= 700px)` —
 * which the legacy `extractBreakpoints` (min-/max-width forms only) cannot
 * see. rem/em are converted at 16px; strict inequalities shift by 1px so
 * the returned value is a width that belongs to the adjacent regime.
 */
export function extractRangeSyntaxBreakpoints(css: string): { value: number; raw: string }[] {
  const found = new Map<number, string>();
  const toPx = (num: string, unit: string): number =>
    Math.round(parseFloat(num) * (unit === "rem" || unit === "em" ? 16 : 1));
  const add = (value: number, raw: string) => {
    if (Number.isFinite(value) && value > 0 && !found.has(value)) found.set(value, raw.trim());
  };
  for (const mediaMatch of css.matchAll(/@media\s+([^{]+)\{/g)) {
    const condition = mediaMatch[1]!;
    // width-first: (width >= 768px)
    for (const m of condition.matchAll(/\(\s*width\s*(<=|>=|<|>)\s*([\d.]+)(px|rem|em)\s*\)/g)) {
      const v = toPx(m[2]!, m[3]!);
      const op = m[1]!;
      add(op === ">" ? v + 1 : op === "<" ? v - 1 : v, m[0]!);
    }
    // value-first, optionally a double range: (400px <= width <= 700px)
    for (const m of condition.matchAll(
      /\(\s*([\d.]+)(px|rem|em)\s*(<=|>=|<|>)\s*width(?:\s*(<=|>=|<|>)\s*([\d.]+)(px|rem|em))?\s*\)/g,
    )) {
      const left = toPx(m[1]!, m[2]!);
      const leftOp = m[3]!;
      add(leftOp === "<" ? left + 1 : leftOp === ">" ? left - 1 : left, m[0]!);
      if (m[4] && m[5] && m[6]) {
        const right = toPx(m[5]!, m[6]!);
        const rightOp = m[4]!;
        add(rightOp === "<" ? right - 1 : rightOp === ">" ? right + 1 : right, m[0]!);
      }
    }
  }
  return [...found.entries()].map(([value, raw]) => ({ value, raw })).sort((a, b) => a.value - b.value);
}

const DISCRETE_PROPS = [
  "display",
  "position",
  "float",
  "flexDirection",
  "flexWrap",
  "order",
  "textAlign",
] as const;

/**
 * Boundary invariant on three same-page renders at B−1 / B / B+1: every
 * discrete property at B must match one of its neighbors. Elements are
 * matched across widths by selector; elements missing from a width's
 * sample set are treated as absent (not compared).
 */
export function analyzeBoundary(
  below: WidthSample,
  at: WidthSample,
  above: WidthSample,
): { spikes: BoundaryViolation[]; gaps: BoundaryGap[] } {
  const byselector = (sample: WidthSample) => new Map(sample.elements.map((e) => [e.selector, e]));
  const belowMap = byselector(below);
  const aboveMap = byselector(above);
  const spikes: BoundaryViolation[] = [];
  const gaps: BoundaryGap[] = [];

  for (const el of at.elements) {
    const b = belowMap.get(el.selector);
    const a = aboveMap.get(el.selector);
    if (!b || !a) continue;

    if (el.hidden && !b.hidden && !a.hidden) {
      gaps.push({ selector: el.selector, kind: "hidden-only-at" });
      continue;
    }
    if (!el.hidden && b.hidden && a.hidden) {
      gaps.push({ selector: el.selector, kind: "visible-only-at" });
      continue;
    }
    // A hidden element's other computed properties are meaningless.
    if (el.hidden) continue;

    for (const prop of DISCRETE_PROPS) {
      const atValue = el[prop];
      if (atValue !== b[prop] && atValue !== a[prop]) {
        spikes.push({ selector: el.selector, property: prop, below: b[prop], at: atValue, above: a[prop] });
      }
    }
    if (el.gridColumnCount !== b.gridColumnCount && el.gridColumnCount !== a.gridColumnCount) {
      spikes.push({
        selector: el.selector,
        property: "gridColumnCount",
        below: String(b.gridColumnCount),
        at: String(el.gridColumnCount),
        above: String(a.gridColumnCount),
      });
    }
  }
  return { spikes, gaps };
}

export function deriveBreakpointIssues(results: BreakpointResult[]): BreakpointCheckIssue[] {
  const issues: BreakpointCheckIssue[] = [];
  for (const result of results) {
    for (const spike of result.spikes) {
      issues.push({
        kind: "boundary-spike",
        severity: "suspect",
        selector: spike.selector,
        breakpoint: result.value,
        message: `${spike.selector} ${spike.property} is \`${spike.at}\` at exactly ${result.value}px but \`${spike.below}\` below and \`${spike.above}\` above — the media queries around ${result.value}px overlap or leave a 1px gap (check for max-width: ${result.value - 1}px vs min-width: ${result.value + 1}px off-by-ones).`,
      });
    }
    for (const gap of result.gaps) {
      issues.push({
        kind: "boundary-gap",
        severity: "suspect",
        selector: gap.selector,
        breakpoint: result.value,
        message: gap.kind === "hidden-only-at"
          ? `${gap.selector} disappears at exactly ${result.value}px but is visible at ${result.value - 1}px and ${result.value + 1}px — both hide rules apply (or neither show rule does) on the boundary itself.`
          : `${gap.selector} is visible only at exactly ${result.value}px — the boundary width falls outside both adjacent regimes' hide rules.`,
      });
    }
    for (const sample of result.samples) {
      if (sample.horizontalOverflow > 1) {
        issues.push({
          kind: "overflow-at-boundary",
          severity: "warn",
          breakpoint: result.value,
          message: `The page scrolls horizontally by ${sample.horizontalOverflow}px at ${sample.width}px — layout breaks right at the ${result.value}px boundary.`,
        });
      }
    }
  }
  return issues;
}

const collectStylesScript = (maxElements: number) => `((maxElements) => {
  function stableSelector(el) {
    const id = el.getAttribute && el.getAttribute("id");
    if (id) return "#" + CSS.escape(id);
    const parent = el.parentElement;
    if (!parent) return el.tagName.toLowerCase();
    const siblings = Array.from(parent.children).filter((item) => item.tagName === el.tagName);
    return stableSelector(parent) + " > " + el.tagName.toLowerCase() + ":nth-of-type(" + (siblings.indexOf(el) + 1) + ")";
  }
  const doc = document.scrollingElement || document.documentElement;
  const elements = [];
  for (const el of Array.from(document.querySelectorAll("body, body *")).slice(0, maxElements)) {
    const style = getComputedStyle(el);
    const rect = el.getBoundingClientRect();
    const hidden = style.display === "none" || style.visibility === "hidden"
      || (rect.width === 0 && rect.height === 0);
    const gridColumnCount = style.display.includes("grid") && style.gridTemplateColumns !== "none"
      ? style.gridTemplateColumns.split(" ").length
      : 0;
    elements.push({
      selector: stableSelector(el),
      hidden,
      display: style.display,
      position: style.position,
      float: style.float,
      flexDirection: style.flexDirection,
      flexWrap: style.flexWrap,
      gridColumnCount,
      order: style.order,
      textAlign: style.textAlign,
    });
  }
  return {
    horizontalOverflow: Math.max(0, doc.scrollWidth - window.innerWidth),
    elements,
  };
})(${maxElements})`;

const COLLECT_CSS_SCRIPT = `(() => {
  const chunks = [];
  const crossOriginHrefs = [];
  for (const sheet of Array.from(document.styleSheets)) {
    try {
      const rules = sheet.cssRules;
      if (!rules) continue;
      for (const rule of Array.from(rules)) chunks.push(rule.cssText || "");
    } catch {
      // Cross-origin stylesheet: CSSOM access throws. Report the href so
      // the caller can fetch the text out-of-band instead of silently
      // discovering zero breakpoints on CDN-hosted CSS.
      if (sheet.href) crossOriginHrefs.push(sheet.href);
    }
  }
  return { cssText: chunks.join("\\n"), crossOriginHrefs };
})()`;

export async function runBreakpointCheck(options: BreakpointCheckOptions): Promise<BreakpointCheckReport> {
  const height = options.height ?? 900;
  const maxElements = options.maxElements ?? 400;
  const maxBreakpoints = options.maxBreakpoints ?? 8;

  const { chromium } = await import("playwright");
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage(withAuthState({ viewport: { width: 1280, height } }, options.storageState));
    if (options.html !== undefined) {
      await page.setContent(options.html, { waitUntil: "networkidle" });
    } else if (isUrl(options.source)) {
      await page.goto(options.source, { waitUntil: "networkidle", timeout: 30000 });
    } else {
      // file: URL navigation so relative stylesheets resolve — setContent
      // gives the document an about:blank base URL and we'd analyze an
      // unstyled page.
      await page.goto(pathToFileURL(resolve(options.source)).href, { waitUntil: "networkidle", timeout: 30000 });
    }


    // A redirect here is almost always a login wall. Without this the gate
    // measured the login page and reported `status: ok` while naming the
    // requested URL as its source (measured 2026-08-02).
    const redirectNote = isUrl(options.source) ? describeRedirect(options.source, page.url()) : null;

    let values: number[];
    let rawByValue = new Map<number, string[]>();
    let stylesheets: BreakpointCheckReport["stylesheets"];
    if (options.breakpoints && options.breakpoints.length > 0) {
      values = [...options.breakpoints];
    } else {
      // Collect CSS in-page so external local stylesheets count too.
      const collected = await page.evaluate(COLLECT_CSS_SCRIPT) as { cssText: string; crossOriginHrefs: string[] };
      let cssText = collected.cssText;
      // CSSOM refuses cross-origin rules; fetch those sheets out-of-band so
      // CDN-hosted responsive CSS still yields breakpoints. Chromium also
      // treats file:-linked stylesheets as cross-origin (unique file
      // origins), and Node fetch can't read file: URLs — go through the
      // filesystem for those.
      let fetched = 0;
      for (const href of collected.crossOriginHrefs.slice(0, 20)) {
        try {
          if (href.startsWith("file:")) {
            const { readFile } = await import("node:fs/promises");
            cssText += "\n" + await readFile(fileURLToPath(href), "utf-8");
          } else {
            const res = await fetch(href);
            if (!res.ok) continue;
            cssText += "\n" + await res.text();
          }
          fetched++;
        } catch {
          // Unreachable sheet — surfaced via report.stylesheets below.
        }
      }
      if (collected.crossOriginHrefs.length > 0) {
        stylesheets = { crossOrigin: collected.crossOriginHrefs.length, fetched };
      }
      for (const bp of extractBreakpoints(cssText)) {
        const bucket = rawByValue.get(bp.value) ?? [];
        bucket.push(bp.raw);
        rawByValue.set(bp.value, bucket);
      }
      // Modern range syntax ((width >= 768px)) is invisible to the legacy
      // extractor; merge its boundaries in.
      for (const bp of extractRangeSyntaxBreakpoints(cssText)) {
        const bucket = rawByValue.get(bp.value) ?? [];
        if (!bucket.includes(bp.raw)) bucket.push(bp.raw);
        rawByValue.set(bp.value, bucket);
      }
      values = [...rawByValue.keys()];
    }
    values = [...new Set(values)]
      .filter((v) => Number.isFinite(v) && v > 2)
      .sort((a, b) => a - b)
      .slice(0, maxBreakpoints);

    // Sample every needed width once (adjacent breakpoints share B+1/B−1
    // widths only when 2px apart — dedupe regardless).
    const widths = [...new Set(values.flatMap((v) => [v - 1, v, v + 1]))].sort((a, b) => a - b);
    const samples = new Map<number, WidthSample>();
    for (const width of widths) {
      await page.setViewportSize({ width, height });
      // Media queries re-evaluate synchronously on resize; a settled rAF
      // keeps transition-mid states out of the sample.
      await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));
      const collected = await page.evaluate(collectStylesScript(maxElements)) as Omit<WidthSample, "width">;
      samples.set(width, { width, ...collected });
    }

    // Continuous-width sweep: horizontal overflow only, so each width costs
    // one resize + one scalar read. Widths in the middle of a regime are
    // exactly what the declared B±1 checks can never render.
    let sweep: SweepResult | undefined;
    if (options.sweep) {
      const step = Math.max(5, options.sweepStep ?? 25);
      const min = options.sweepMin ?? 320;
      const max = options.sweepMax ?? Math.max(1280, (values[values.length - 1] ?? 0) + 100);
      const sweepSamples: { width: number; horizontalOverflow: number }[] = [];
      for (let width = min; width <= max; width += step) {
        await page.setViewportSize({ width, height });
        await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));
        const overflow = await page.evaluate(
          "Math.max(0, document.documentElement.scrollWidth - window.innerWidth)",
        ) as number;
        sweepSamples.push({ width, horizontalOverflow: overflow });
      }
      sweep = {
        min,
        max,
        step,
        sampledWidths: sweepSamples.length,
        overflowRanges: collapseSweepOverflow(sweepSamples),
      };
    }
    await page.close();

    const results: BreakpointResult[] = values.map((value) => {
      const below = samples.get(value - 1)!;
      const at = samples.get(value)!;
      const above = samples.get(value + 1)!;
      const { spikes, gaps } = analyzeBoundary(below, at, above);
      return {
        value,
        raw: rawByValue.get(value) ?? [],
        samples: [below, at, above].map((s) => ({ width: s.width, horizontalOverflow: s.horizontalOverflow })),
        spikes,
        gaps,
      };
    });

    // A 2px gap between adjacent declared boundaries (max-width: 767px +
    // min-width: 769px) leaves the middle width in neither regime, and the
    // declared-value invariants cannot see it — the orphan width only ever
    // appears as a *neighbor* sample there. Check the midpoint as its own
    // synthetic boundary; every needed width is already sampled.
    for (let i = 0; i + 1 < values.length; i++) {
      const a = values[i]!;
      const b = values[i + 1]!;
      if (b - a !== 2) continue;
      const mid = a + 1;
      const below = samples.get(a)!;
      const at = samples.get(mid)!;
      const above = samples.get(b)!;
      const { spikes, gaps } = analyzeBoundary(below, at, above);
      if (spikes.length === 0 && gaps.length === 0) continue;
      results.push({
        value: mid,
        raw: [`synthetic midpoint between the ${a}px and ${b}px boundaries`],
        samples: [below, at, above].map((s) => ({ width: s.width, horizontalOverflow: s.horizontalOverflow })),
        spikes,
        gaps,
      });
    }

    return {
      source: options.source,
      breakpoints: results,
      checkedValues: values,
      ...(stylesheets ? { stylesheets } : {}),
      ...(sweep ? { sweep } : {}),
      issues: [
        // First, and suspect: the status line is derived from the issue list, so
        // a printed note alone would have left `status: ok` on a login page.
        ...(redirectNote
          ? [{ kind: "redirected" as const, severity: "suspect" as const, message: redirectNote }]
          : []),
        ...deriveBreakpointIssues(results),
        ...(sweep ? deriveSweepIssues(sweep) : []),
      ],
    };
  } finally {
    await browser.close();
  }
}

export function formatBreakpointCheckReport(report: BreakpointCheckReport): string {
  const lines: string[] = [];
  const status = report.issues.some((i) => i.severity === "suspect") ? "suspect"
    : report.issues.length > 0 ? "warn"
    : "ok";
  lines.push(`${BOLD}${CYAN}vlmkit check breakpoints${RESET}`);
  lines.push(`${DIM}source: ${report.source}${RESET}`);
  lines.push("");
  lines.push(`status: ${status}`);
  // Before anything else, and before the sweep early-return below: a redirect
  // means every number under it describes a different page. Without this the
  // status flipped to `suspect` with no stated reason.
  for (const issue of report.issues.filter((i) => i.kind === "redirected")) {
    lines.push(`${RED}x ${issue.message}${RESET}`);
  }
  if (report.stylesheets && report.stylesheets.fetched < report.stylesheets.crossOrigin) {
    lines.push(`${YELLOW}note: ${report.stylesheets.crossOrigin - report.stylesheets.fetched} of ${report.stylesheets.crossOrigin} cross-origin stylesheet(s) could not be read — their breakpoints are not covered${RESET}`);
  }
  if (report.sweep) {
    const s = report.sweep;
    const verdict = s.overflowRanges.length === 0
      ? `${GREEN}clean${RESET}`
      : `${YELLOW}${s.overflowRanges.length} overflow range(s)${RESET}`;
    lines.push(`width sweep: ${s.min}-${s.max}px step ${s.step} (${s.sampledWidths} widths) — ${verdict}`);
  }
  if (report.checkedValues.length === 0) {
    lines.push("breakpoints: none discovered — nothing to check (pass --breakpoints to force widths)");
    if (!report.sweep || report.issues.length === 0) return lines.join("\n");
  } else {
    lines.push(`breakpoints checked: ${report.checkedValues.join(", ")}px (each at B-1 / B / B+1)`);
  }
  lines.push("");
  for (const bp of report.breakpoints) {
    const overflowNote = bp.samples.some((s) => s.horizontalOverflow > 1)
      ? ` overflow:${bp.samples.map((s) => `${s.horizontalOverflow}`).join("/")}px`
      : "";
    const verdict = bp.spikes.length === 0 && bp.gaps.length === 0 && !overflowNote
      ? `${GREEN}clean${RESET}`
      : `${bp.spikes.length} spike(s), ${bp.gaps.length} gap(s)${overflowNote}`;
    const raw = bp.raw.length > 0 ? ` ${DIM}${bp.raw[0]}${bp.raw.length > 1 ? ` +${bp.raw.length - 1}` : ""}${RESET}` : "";
    lines.push(`  ${bp.value}px: ${verdict}${raw}`);
  }
  if (report.issues.length > 0) {
    lines.push("");
    lines.push("Issues:");
    for (const issue of report.issues.slice(0, 30)) {
      const icon = issue.severity === "suspect" ? `${RED}x${RESET}` : `${YELLOW}!${RESET}`;
      const selector = issue.selector ? ` ${issue.selector}` : "";
      lines.push(`  ${icon} ${issue.kind}${selector}: ${issue.message}`);
    }
    if (report.issues.length > 30) lines.push(`  … ${report.issues.length - 30} more (use --json for all)`);
  } else {
    lines.push("");
    lines.push(`${GREEN}All boundaries consistent.${RESET}`);
  }
  return lines.join("\n");
}

function printUsage(exitCode: number): never {
  console.log(`Usage: vlmkit check breakpoints <html-or-url> [options]

Boundary quickcheck: render at B-1 / B / B+1 for every discovered media
query breakpoint and verify each discrete style property at B matches
one of its neighbors. Catches off-by-one boundaries (768px styled by
neither/both regimes), elements that vanish exactly on the boundary,
and horizontal overflow at boundary widths.

Options:
  --breakpoints <list>  Comma-separated px values (default: discovered from CSS)
  --sweep               Also fuzz the whole width range for horizontal overflow
                        (widths between breakpoints that B±1 never renders)
  --sweep-step <px>     Sweep step (default: 25)
  --json                Print JSON report
  --height <px>         Render height (default: 900)
  --max-elements <n>    Elements sampled per width (default: 400)
  --advisory            Print findings but exit 0 (default: a suspect exits 1)`);
  process.exit(exitCode);
}

function parseArgs(argv: string[]) {
  let json = false;
  let failOnSuspect = false;
  let advisory = false;
  let breakpoints: number[] | undefined;
  let height: number | undefined;
  let maxElements: number | undefined;
  let sweep = false;
  let sweepStep: number | undefined;
  const positional: string[] = [];
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i]!;
    if (arg === "--help" || arg === "-h" || arg === "help") printUsage(0);
    else if (arg === "--json") json = true;
    else if (arg === "--fail-on-suspect") failOnSuspect = true; // accepted no-op
    else if (arg === "--advisory") advisory = true;
    else if (arg === "--sweep") sweep = true;
    else if (arg === "--sweep-step") sweepStep = Number.parseInt(argv[++i] ?? "25", 10);
    else if (arg === "--breakpoints") {
      breakpoints = (argv[++i] ?? "").split(",").map((v) => Number.parseInt(v.trim(), 10)).filter((v) => Number.isFinite(v));
    } else if (arg === "--height") height = Number.parseInt(argv[++i] ?? "900", 10);
    else if (arg === "--max-elements") maxElements = Number.parseInt(argv[++i] ?? "400", 10);
    else positional.push(arg);
  }
  if (positional.length === 0) printUsage(1);
  return { source: positional[0]!, json, failOnSuspect, advisory, breakpoints, height, maxElements, sweep, sweepStep };
}

async function main(argv = process.argv.slice(2)): Promise<void> {
  const parsed = parseArgs(argv);
  const report = await runBreakpointCheck({
    source: parsed.source,
    ...(parsed.breakpoints ? { breakpoints: parsed.breakpoints } : {}),
    ...(parsed.height !== undefined ? { height: parsed.height } : {}),
    ...(parsed.maxElements !== undefined ? { maxElements: parsed.maxElements } : {}),
    ...(parsed.sweep ? { sweep: true } : {}),
    ...(parsed.sweepStep !== undefined ? { sweepStep: parsed.sweepStep } : {}),
  });
  appendRunLedger({
    tool: "check-breakpoints",
    source: parsed.source,
    headline: {
      breakpoints: report.checkedValues.length,
      issues: report.issues.length,
      sweepRanges: report.sweep?.overflowRanges.length ?? null,
    },
  });
  if (parsed.json) {
    console.log(JSON.stringify(report, null, 2));
  } else {
    console.log(formatBreakpointCheckReport(report));
  }
  if (!parsed.advisory && report.issues.some((issue) => issue.severity === "suspect")) {
    process.exit(1);
  }
}

const isCliEntry = process.env.__VRT_DISPATCHER_LEAF__ === "breakpoint-check" ||
  (process.argv[1] ? resolve(process.argv[1]) === fileURLToPath(import.meta.url) : false);
if (isCliEntry) {
  main().catch(handleCliError);
}
