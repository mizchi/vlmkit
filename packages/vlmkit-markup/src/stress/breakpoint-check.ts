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
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { extractBreakpoints } from "@mizchi/vlmkit-capture/viewport-discovery.ts";
import { handleCliError } from "@mizchi/vlmkit-core/cli-error.ts";
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
  | "boundary-spike"
  | "boundary-gap"
  | "overflow-at-boundary";

export interface BreakpointCheckIssue {
  kind: BreakpointCheckIssueKind;
  severity: "warn" | "suspect";
  message: string;
  selector?: string;
  breakpoint?: number;
}

export interface BreakpointCheckReport {
  source: string;
  breakpoints: BreakpointResult[];
  /** Breakpoint values that were checked. */
  checkedValues: number[];
  issues: BreakpointCheckIssue[];
}

export interface BreakpointCheckOptions {
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
}

function isUrl(source: string): boolean {
  return /^(https?|file):\/\//.test(source);
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
  for (const sheet of Array.from(document.styleSheets)) {
    try {
      const rules = sheet.cssRules;
      if (!rules) continue;
      for (const rule of Array.from(rules)) chunks.push(rule.cssText || "");
    } catch {}
  }
  return chunks.join("\\n");
})()`;

export async function runBreakpointCheck(options: BreakpointCheckOptions): Promise<BreakpointCheckReport> {
  const height = options.height ?? 900;
  const maxElements = options.maxElements ?? 400;
  const maxBreakpoints = options.maxBreakpoints ?? 8;

  const { chromium } = await import("playwright");
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage({ viewport: { width: 1280, height } });
    if (options.html !== undefined) {
      await page.setContent(options.html, { waitUntil: "networkidle" });
    } else if (isUrl(options.source)) {
      await page.goto(options.source, { waitUntil: "networkidle", timeout: 30000 });
    } else {
      await page.setContent(await readFile(resolve(options.source), "utf-8"), { waitUntil: "networkidle" });
    }

    let values: number[];
    let rawByValue = new Map<number, string[]>();
    if (options.breakpoints && options.breakpoints.length > 0) {
      values = [...options.breakpoints];
    } else {
      // Collect CSS in-page so external local stylesheets count too.
      const cssText = await page.evaluate(COLLECT_CSS_SCRIPT) as string;
      const breakpoints = extractBreakpoints(cssText);
      for (const bp of breakpoints) {
        const bucket = rawByValue.get(bp.value) ?? [];
        bucket.push(bp.raw);
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
      issues: deriveBreakpointIssues(results),
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
  if (report.checkedValues.length === 0) {
    lines.push("breakpoints: none discovered — nothing to check (pass --breakpoints to force widths)");
    return lines.join("\n");
  }
  lines.push(`breakpoints checked: ${report.checkedValues.join(", ")}px (each at B-1 / B / B+1)`);
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
  --json                Print JSON report
  --height <px>         Render height (default: 900)
  --max-elements <n>    Elements sampled per width (default: 400)
  --fail-on-suspect     Exit non-zero when suspect issues are found`);
  process.exit(exitCode);
}

function parseArgs(argv: string[]) {
  let json = false;
  let failOnSuspect = false;
  let breakpoints: number[] | undefined;
  let height: number | undefined;
  let maxElements: number | undefined;
  const positional: string[] = [];
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i]!;
    if (arg === "--help" || arg === "-h" || arg === "help") printUsage(0);
    else if (arg === "--json") json = true;
    else if (arg === "--fail-on-suspect") failOnSuspect = true;
    else if (arg === "--breakpoints") {
      breakpoints = (argv[++i] ?? "").split(",").map((v) => Number.parseInt(v.trim(), 10)).filter((v) => Number.isFinite(v));
    } else if (arg === "--height") height = Number.parseInt(argv[++i] ?? "900", 10);
    else if (arg === "--max-elements") maxElements = Number.parseInt(argv[++i] ?? "400", 10);
    else positional.push(arg);
  }
  if (positional.length === 0) printUsage(1);
  return { source: positional[0]!, json, failOnSuspect, breakpoints, height, maxElements };
}

async function main(argv = process.argv.slice(2)): Promise<void> {
  const parsed = parseArgs(argv);
  const report = await runBreakpointCheck({
    source: parsed.source,
    ...(parsed.breakpoints ? { breakpoints: parsed.breakpoints } : {}),
    ...(parsed.height !== undefined ? { height: parsed.height } : {}),
    ...(parsed.maxElements !== undefined ? { maxElements: parsed.maxElements } : {}),
  });
  if (parsed.json) {
    console.log(JSON.stringify(report, null, 2));
  } else {
    console.log(formatBreakpointCheckReport(report));
  }
  if (parsed.failOnSuspect && report.issues.some((issue) => issue.severity === "suspect")) {
    process.exit(1);
  }
}

const isCliEntry = process.env.__VRT_DISPATCHER_LEAF__ === "breakpoint-check" ||
  (process.argv[1] ? resolve(process.argv[1]) === fileURLToPath(import.meta.url) : false);
if (isCliEntry) {
  main().catch(handleCliError);
}
