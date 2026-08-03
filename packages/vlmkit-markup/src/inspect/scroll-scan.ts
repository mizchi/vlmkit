#!/usr/bin/env node
/**
 * Scroll region inventory — annotation-free scroll existence detection.
 *
 * `contract introspect` only sees scrollports that carry a
 * `data-scrollport` attribute. This tool walks every element's computed
 * overflow and scroll metrics and reports what *actually* scrolls (or
 * clips) on the page, with no markup cooperation required:
 *
 *   - real scroll containers: selector, axis, overflow amount, bbox —
 *     JSON output includes an `expectedScrollports` block that pastes
 *     straight into a UI Contract
 *   - unintended page-level horizontal scroll (the classic mobile
 *     regression), with the offending elements that stick out
 *   - `overflow: hidden` elements whose content overflows well past the
 *     box — cut-off-content suspects
 *   - declared-but-dead scrollports (overflow: auto/scroll, content fits)
 *   - nested same-axis scroll containers (scroll-inside-scroll)
 *
 * Deterministic: Playwright + computed style + scroll metrics. No VLM.
 *
 * Usage:
 *   vlmkit scan scroll <html-or-url>
 *   vlmkit scan scroll <html-or-url> --json
 */
import { resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { handleCliError } from "@mizchi/vlmkit-core/cli-error.ts";
import { withAuthState } from "@mizchi/vlmkit-core/auth-state.ts";
import { describeRedirect } from "@mizchi/vlmkit-core/navigation-redirect.ts";
import { appendRunLedger } from "@mizchi/vlmkit-core/run-ledger.ts";
import { BOLD, CYAN, DIM, GREEN, RED, RESET, YELLOW } from "@mizchi/vlmkit-core/terminal-colors.ts";
import type { UiExpectedScrollportContract } from "../contract/ui-contract.ts";

export type ScrollAxis = "x" | "y" | "both";

export interface ScrollElementSample {
  selector: string;
  tagName: string;
  /** Computed overflow-x / overflow-y. */
  overflowX: string;
  overflowY: string;
  /** scrollWidth - clientWidth / scrollHeight - clientHeight (px, >= 0). */
  overflowAmountX: number;
  overflowAmountY: number;
  clientWidth: number;
  clientHeight: number;
  bbox: { x: number; y: number; width: number; height: number };
  /** Value of a data-scrollport-ish annotation when present. */
  scrollportAttr?: string;
  /** Selector of the nearest ancestor scroll container, when any. */
  ancestorScroller?: string;
}

export interface ScrollPageSample {
  viewportWidth: number;
  viewportHeight: number;
  scrollWidth: number;
  scrollHeight: number;
  /** Elements whose border box sticks out past the right viewport edge. */
  overflowOffenders: {
    selector: string;
    right: number;
    width: number;
    /**
     * Page overflow (px) that disappears when this element's own width /
     * min-width rigidity is neutralized. High = this element is a cause;
     * 0 = it was merely stretched by something else. Absent when the
     * measurement was not run (only the top candidates are probed).
     */
    relieves?: number;
  }[];
}

export interface ScrollScanInput {
  source: string;
  page: ScrollPageSample;
  elements: ScrollElementSample[];
}

export interface ScrollContainer {
  selector: string;
  axis: ScrollAxis;
  overflowAmountX: number;
  overflowAmountY: number;
  clientWidth: number;
  clientHeight: number;
  bbox: { x: number; y: number; width: number; height: number };
  scrollportAttr?: string;
  nestedIn?: string;
}

export type ScrollScanIssueKind =
  /**
   * A URL that redirected somewhere meaningful — almost always a login wall.
   * Measured 2026-08-02: pointed at an auth-walled route with no session, this
   * gate reported `status: ok` for the login page while naming the requested
   * URL as its source. Reported as a suspect issue so the pass cannot be silent.
   */
  | "redirected"
  | "page-overflow-x"
  | "clipped-content"
  | "nested-scroll";

export interface ScrollScanIssue {
  kind: ScrollScanIssueKind;
  severity: "warn" | "suspect";
  message: string;
  selector?: string;
}

export interface ScrollScanReport {
  source: string;
  page: {
    viewportWidth: number;
    viewportHeight: number;
    scrollWidth: number;
    scrollHeight: number;
    horizontalOverflow: number;
    verticalScroll: number;
  };
  containers: ScrollContainer[];
  /** overflow: auto/scroll declared, but content fits — nothing to scroll. */
  deadScrollports: { selector: string; overflowX: string; overflowY: string }[];
  /** overflow: hidden/clip with content overflowing past the threshold. */
  clipped: { selector: string; hiddenX: number; hiddenY: number }[];
  /** Ready-to-paste UI Contract scrollport expectations for the real containers. */
  expectedScrollports: UiExpectedScrollportContract[];
  issues: ScrollScanIssue[];
}

export interface ScrollScanOptions {
  /**
   * Playwright storage-state file so gates can measure pages behind a
   * login. Falls back to VLMKIT_STORAGE_STATE. See auth-state.ts.
   */
  storageState?: string;
  source: string;
  html?: string;
  viewport?: { width: number; height: number };
  /** Hidden-content px below which overflow:hidden clipping is ignored (default 16). */
  clipThreshold?: number;
  /** Scrollable px below which a container is not counted as real (default 2). */
  minOverflow?: number;
  /** Cap for reported clipped elements / offenders (default 20). */
  maxFindings?: number;
}

function isUrl(source: string): boolean {
  return /^(https?|file):\/\//.test(source);
}

function scrollable(overflow: string): boolean {
  return overflow === "auto" || overflow === "scroll";
}

function clipping(overflow: string): boolean {
  return overflow === "hidden" || overflow === "clip";
}

function slug(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
}

export function analyzeScrollSamples(
  input: ScrollScanInput,
  options: { clipThreshold?: number; minOverflow?: number; maxFindings?: number } = {},
): ScrollScanReport {
  const clipThreshold = options.clipThreshold ?? 16;
  const minOverflow = options.minOverflow ?? 2;
  const maxFindings = options.maxFindings ?? 20;

  const containers: ScrollContainer[] = [];
  const deadScrollports: ScrollScanReport["deadScrollports"] = [];
  const clipped: ScrollScanReport["clipped"] = [];

  for (const el of input.elements) {
    const scrollX = scrollable(el.overflowX) && el.overflowAmountX >= minOverflow;
    const scrollY = scrollable(el.overflowY) && el.overflowAmountY >= minOverflow;
    if (scrollX || scrollY) {
      containers.push({
        selector: el.selector,
        axis: scrollX && scrollY ? "both" : scrollX ? "x" : "y",
        overflowAmountX: el.overflowAmountX,
        overflowAmountY: el.overflowAmountY,
        clientWidth: el.clientWidth,
        clientHeight: el.clientHeight,
        bbox: el.bbox,
        ...(el.scrollportAttr !== undefined ? { scrollportAttr: el.scrollportAttr } : {}),
        ...(el.ancestorScroller ? { nestedIn: el.ancestorScroller } : {}),
      });
      continue;
    }
    if ((scrollable(el.overflowX) || scrollable(el.overflowY))
      && el.overflowAmountX < minOverflow && el.overflowAmountY < minOverflow) {
      deadScrollports.push({ selector: el.selector, overflowX: el.overflowX, overflowY: el.overflowY });
      continue;
    }
    const hiddenX = clipping(el.overflowX) ? el.overflowAmountX : 0;
    const hiddenY = clipping(el.overflowY) ? el.overflowAmountY : 0;
    if (hiddenX >= clipThreshold || hiddenY >= clipThreshold) {
      clipped.push({ selector: el.selector, hiddenX, hiddenY });
    }
  }
  clipped.sort((a, b) => Math.max(b.hiddenX, b.hiddenY) - Math.max(a.hiddenX, a.hiddenY));

  const horizontalOverflow = Math.max(0, input.page.scrollWidth - input.page.viewportWidth);
  const verticalScroll = Math.max(0, input.page.scrollHeight - input.page.viewportHeight);

  const issues: ScrollScanIssue[] = [];
  if (horizontalOverflow >= minOverflow) {
    // Lead with measured causes when we have them: constraining these is
    // what actually removes the overflow. Fall back to the widest boxes
    // when nothing was probed or nothing relieved anything.
    const causes = input.page.overflowOffenders
      // 10% keeps co-causes visible (two rigid siblings splitting the
      // blame) without promoting rounding noise into a "cause".
      .filter((o) => (o.relieves ?? 0) >= Math.max(minOverflow, horizontalOverflow * 0.1))
      .sort((a, b) => (b.relieves ?? 0) - (a.relieves ?? 0))
      .slice(0, 3);
    const widest = input.page.overflowOffenders
      .slice(0, 3)
      .map((o) => `${o.selector} (right edge ${o.right}px)`)
      .join(", ");
    const detail = causes.length > 0
      ? ` — caused by: ${causes.map((o) => `${o.selector} (${o.width}px wide; constraining it removes ${o.relieves}px of the overflow)`).join(", ")}`
      : (widest ? ` — sticking out: ${widest}` : "");
    issues.push({
      kind: "page-overflow-x",
      severity: "suspect",
      message: `The page scrolls horizontally by ${horizontalOverflow}px at ${input.page.viewportWidth}px viewport width` +
        detail + ".",
    });
  }
  for (const clip of clipped.slice(0, maxFindings)) {
    issues.push({
      kind: "clipped-content",
      severity: "warn",
      selector: clip.selector,
      message: `${clip.selector} clips ${Math.max(clip.hiddenX, clip.hiddenY)}px of its content behind overflow: hidden — cut-off content unless the oversize is decorative.`,
    });
  }
  for (const container of containers) {
    if (container.nestedIn) {
      issues.push({
        kind: "nested-scroll",
        severity: "warn",
        selector: container.selector,
        message: `${container.selector} scrolls inside another scroll container (${container.nestedIn}) — nested scrolling is easy to trigger accidentally and hard to use.`,
      });
    }
  }

  const idCounts = new Map<string, number>();
  const expectedScrollports: UiExpectedScrollportContract[] = containers.map((c, i) => {
    const base = slug(c.scrollportAttr ?? c.selector) || `scrollport-${i}`;
    const n = (idCounts.get(base) ?? 0) + 1;
    idCounts.set(base, n);
    const id = n === 1 ? base : `${base}-${n}`;
    const minOverflowPx = c.axis === "x"
      ? c.overflowAmountX
      : c.axis === "both" ? Math.max(c.overflowAmountX, c.overflowAmountY) : c.overflowAmountY;
    return {
      id,
      selector: c.selector,
      axis: c.axis,
      required: true,
      ...(minOverflowPx > 0 ? { minOverflow: minOverflowPx } : {}),
    };
  });

  return {
    source: input.source,
    page: {
      viewportWidth: input.page.viewportWidth,
      viewportHeight: input.page.viewportHeight,
      scrollWidth: input.page.scrollWidth,
      scrollHeight: input.page.scrollHeight,
      horizontalOverflow,
      verticalScroll,
    },
    containers,
    deadScrollports,
    clipped: clipped.slice(0, maxFindings),
    expectedScrollports,
    issues,
  };
}

/** In-page collector shared with `check integrity` (A7 delegation). */
export const COLLECT_SCROLL_SCRIPT = `(() => {
  function stableSelector(el) {
    const id = el.getAttribute && el.getAttribute("id");
    if (id) return "#" + CSS.escape(id);
    const classes = el.classList ? Array.from(el.classList).slice(0, 3) : [];
    if (classes.length > 0) {
      const selector = el.tagName.toLowerCase() + classes.map((c) => "." + CSS.escape(c)).join("");
      if (document.querySelectorAll(selector).length === 1) return selector;
    }
    const parent = el.parentElement;
    if (!parent) return el.tagName.toLowerCase();
    const siblings = Array.from(parent.children).filter((item) => item.tagName === el.tagName);
    return stableSelector(parent) + " > " + el.tagName.toLowerCase() + ":nth-of-type(" + (siblings.indexOf(el) + 1) + ")";
  }

  const SCROLLABLE = /^(auto|scroll)$/;
  const CLIPPING = /^(hidden|clip)$/;
  const scrollers = new Set();
  const elements = [];
  for (const el of Array.from(document.querySelectorAll("body *"))) {
    const style = getComputedStyle(el);
    const interesting = SCROLLABLE.test(style.overflowX) || SCROLLABLE.test(style.overflowY)
      || CLIPPING.test(style.overflowX) || CLIPPING.test(style.overflowY);
    if (!interesting) continue;
    const overflowAmountX = Math.max(0, el.scrollWidth - el.clientWidth);
    const overflowAmountY = Math.max(0, el.scrollHeight - el.clientHeight);
    let ancestorScroller;
    for (let p = el.parentElement; p && p !== document.body; p = p.parentElement) {
      if (scrollers.has(p)) { ancestorScroller = stableSelector(p); break; }
    }
    if ((SCROLLABLE.test(style.overflowX) && overflowAmountX > 1)
      || (SCROLLABLE.test(style.overflowY) && overflowAmountY > 1)) {
      scrollers.add(el);
    }
    const rect = el.getBoundingClientRect();
    const scrollportAttr = el.getAttribute("data-scrollport")
      ?? el.getAttribute("data-vlmkit-scrollport")
      ?? el.getAttribute("data-ui-scrollport")
      ?? el.getAttribute("data-scroll-region")
      ?? undefined;
    elements.push({
      selector: stableSelector(el),
      tagName: el.tagName,
      overflowX: style.overflowX,
      overflowY: style.overflowY,
      overflowAmountX,
      overflowAmountY,
      clientWidth: el.clientWidth,
      clientHeight: el.clientHeight,
      bbox: { x: Math.round(rect.x), y: Math.round(rect.y), width: Math.round(rect.width), height: Math.round(rect.height) },
      ...(scrollportAttr !== undefined ? { scrollportAttr } : {}),
      ...(ancestorScroller ? { ancestorScroller } : {}),
    });
  }

  const doc = document.scrollingElement || document.documentElement;
  const viewportWidth = window.innerWidth;
  const offenders = [];
  if (doc.scrollWidth > viewportWidth + 1) {
    const cands = [];
    for (const el of Array.from(document.querySelectorAll("body *"))) {
      const rect = el.getBoundingClientRect();
      if (rect.right > viewportWidth + 1 && rect.width > 0) {
        cands.push({ el, selector: stableSelector(el), right: Math.round(rect.right), width: Math.round(rect.width) });
      }
    }
    cands.sort((a, b) => b.right - a.right);
    // Ranking by right edge names symptoms, not causes: in a grid/flex
    // shell one rigid child stretches the track, so every stretched
    // ancestor and sibling reports a larger right edge than the element
    // actually at fault (2026-08-01 hard-target audit: a 760px table made
    // the gate blame the sidebar and the page shell). So measure instead
    // of ranking — neutralize each candidate's own rigidity and see how
    // much page overflow disappears; that delta is the "relieves" value.
    // Probe generously: the culprit is often ranked LOW by right edge
    // (stretched ancestors and siblings outrank it), so a small window
    // would reproduce the very bug this measurement exists to fix.
    const baseline = doc.scrollWidth;
    for (const c of cands.slice(0, 40)) {
      const el = c.el;
      const prevW = el.style.getPropertyValue("width");
      const prevWP = el.style.getPropertyPriority("width");
      const prevMin = el.style.getPropertyValue("min-width");
      const prevMinP = el.style.getPropertyPriority("min-width");
      el.style.setProperty("width", "0", "important");
      el.style.setProperty("min-width", "0", "important");
      const after = doc.scrollWidth;
      if (prevW) el.style.setProperty("width", prevW, prevWP); else el.style.removeProperty("width");
      if (prevMin) el.style.setProperty("min-width", prevMin, prevMinP); else el.style.removeProperty("min-width");
      c.relieves = Math.max(0, baseline - after);
    }
    // Measured causes must survive the report's top-N slice, so order by
    // how much overflow each element accounts for and fall back to right
    // edge (which keeps the pre-measurement ordering when nothing relieved).
    cands.sort((a, b) => ((b.relieves || 0) - (a.relieves || 0)) || (b.right - a.right));
    for (const c of cands) {
      offenders.push({
        selector: c.selector, right: c.right, width: c.width,
        ...(c.relieves !== undefined ? { relieves: c.relieves } : {}),
      });
    }
  }

  return {
    page: {
      viewportWidth,
      viewportHeight: window.innerHeight,
      scrollWidth: doc.scrollWidth,
      scrollHeight: doc.scrollHeight,
      overflowOffenders: offenders.slice(0, 10),
    },
    elements,
  };
})()`;

export async function runScrollScan(options: ScrollScanOptions): Promise<ScrollScanReport> {
  const viewport = options.viewport ?? { width: 1280, height: 720 };
  const { chromium } = await import("playwright");
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage(withAuthState({ viewport }, options.storageState));
    if (options.html !== undefined) {
      await page.setContent(options.html, { waitUntil: "networkidle" });
    } else if (isUrl(options.source)) {
      await page.goto(options.source, { waitUntil: "networkidle", timeout: 30000 });
    } else {
      // file: URL navigation so relative stylesheets/scripts/images resolve —
      // setContent gives the document an about:blank base URL.
      await page.goto(pathToFileURL(resolve(options.source)).href, { waitUntil: "networkidle", timeout: 30000 });
    }
    // A redirect here is almost always a login wall. Without this the gate
    // measured the login page and reported `status: ok` while naming the
    // requested URL as its source (measured 2026-08-02).
    const redirectNote = isUrl(options.source) ? describeRedirect(options.source, page.url()) : null;
    const collected = await page.evaluate(COLLECT_SCROLL_SCRIPT) as Omit<ScrollScanInput, "source">;
    await page.close();
    const report = analyzeScrollSamples(
      { source: options.source, ...collected },
      options,
    );
    // Pushed as a suspect ISSUE, not just printed: the status line is derived
    // from the issue list, so a note alone would have left `status: ok`.
    if (redirectNote) {
      report.issues.unshift({ kind: "redirected", severity: "suspect",  message: redirectNote });
    }
    return report;
  } finally {
    await browser.close();
  }
}

export function formatScrollScanReport(report: ScrollScanReport): string {
  const lines: string[] = [];
  const status = report.issues.some((i) => i.severity === "suspect") ? "suspect"
    : report.issues.length > 0 ? "warn"
    : "ok";
  lines.push(`${BOLD}${CYAN}vlmkit scan scroll${RESET}`);
  lines.push(`${DIM}source: ${report.source} (${report.page.viewportWidth}x${report.page.viewportHeight})${RESET}`);
  lines.push("");
  lines.push(`status: ${status}`);
  lines.push(`page: ${report.page.scrollWidth}x${report.page.scrollHeight} — horizontal overflow ${report.page.horizontalOverflow}px, vertical scroll ${report.page.verticalScroll}px`);
  lines.push(`scroll containers: ${report.containers.length} (dead scrollports ${report.deadScrollports.length}, clipped ${report.clipped.length})`);
  if (report.containers.length > 0) {
    lines.push("");
    lines.push("Scroll containers:");
    for (const c of report.containers) {
      const amount = c.axis === "x" ? `${c.overflowAmountX}px` : c.axis === "y" ? `${c.overflowAmountY}px` : `${c.overflowAmountX}px/${c.overflowAmountY}px`;
      const attr = c.scrollportAttr !== undefined ? ` [data-scrollport="${c.scrollportAttr}"]` : "";
      const nested = c.nestedIn ? ` (nested in ${c.nestedIn})` : "";
      lines.push(`  - ${c.selector}: axis=${c.axis} overflow=${amount} box=(${c.bbox.x},${c.bbox.y}) ${c.bbox.width}x${c.bbox.height}${attr}${nested}`);
    }
  }
  if (report.deadScrollports.length > 0) {
    lines.push("");
    lines.push("Dead scrollports (declared scrollable, content fits):");
    for (const d of report.deadScrollports.slice(0, 10)) {
      lines.push(`  - ${d.selector} (overflow: ${d.overflowX} ${d.overflowY})`);
    }
  }
  if (report.issues.length > 0) {
    lines.push("");
    lines.push("Issues:");
    for (const issue of report.issues) {
      const icon = issue.severity === "suspect" ? `${RED}x${RESET}` : `${YELLOW}!${RESET}`;
      const selector = issue.selector ? ` ${issue.selector}` : "";
      lines.push(`  ${icon} ${issue.kind}${selector}: ${issue.message}`);
    }
  } else {
    lines.push("");
    lines.push(`${GREEN}No scroll issues detected.${RESET}`);
  }
  if (report.expectedScrollports.length > 0) {
    lines.push("");
    lines.push(`Contract hint: --json emits ${report.expectedScrollports.length} expectedScrollports entr${report.expectedScrollports.length === 1 ? "y" : "ies"} ready for a UI Contract.`);
  }
  return lines.join("\n");
}

function printUsage(exitCode: number): never {
  console.log(`Usage: vlmkit scan scroll <html-or-url> [options]

Annotation-free scroll inventory: every element that actually scrolls
(selector, axis, overflow px, bbox), unintended page-level horizontal
scroll with the sticking-out offenders, overflow:hidden cut-off
suspects, declared-but-dead scrollports, and nested scrolling.

Options:
  --json                Print JSON report (includes expectedScrollports
                        entries pasteable into a UI Contract)
  --viewport <WxH>      Viewport (default: 1280x720)
  --clip-threshold <n>  Hidden px below which clipping is ignored (default: 16)
  --advisory            Print findings but exit 0 (default: a suspect exits 1)`);
  process.exit(exitCode);
}

function parseArgs(argv: string[]) {
  let json = false;
  let failOnSuspect = false;
  let advisory = false;
  let clipThreshold: number | undefined;
  let viewport: { width: number; height: number } | undefined;
  const positional: string[] = [];
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i]!;
    if (arg === "--help" || arg === "-h" || arg === "help") printUsage(0);
    else if (arg === "--json") json = true;
    else if (arg === "--fail-on-suspect") failOnSuspect = true; // accepted no-op
    else if (arg === "--advisory") advisory = true;
    else if (arg === "--clip-threshold") clipThreshold = Number.parseInt(argv[++i] ?? "16", 10);
    else if (arg === "--viewport") {
      const m = (argv[++i] ?? "").match(/^(\d+)x(\d+)$/);
      if (!m) printUsage(1);
      viewport = { width: Number(m[1]), height: Number(m[2]) };
    } else positional.push(arg);
  }
  if (positional.length === 0) printUsage(1);
  return { source: positional[0]!, json, failOnSuspect, advisory, clipThreshold, viewport };
}

async function main(argv = process.argv.slice(2)): Promise<void> {
  const parsed = parseArgs(argv);
  const report = await runScrollScan({
    source: parsed.source,
    ...(parsed.clipThreshold !== undefined ? { clipThreshold: parsed.clipThreshold } : {}),
    ...(parsed.viewport ? { viewport: parsed.viewport } : {}),
  });
  appendRunLedger({
    tool: "scan-scroll",
    source: parsed.source,
    headline: {
      containers: report.containers.length,
      overflowX: report.page.horizontalOverflow,
      issues: report.issues.length,
    },
  });
  if (parsed.json) {
    console.log(JSON.stringify(report, null, 2));
  } else {
    console.log(formatScrollScanReport(report));
  }
  if (!parsed.advisory && report.issues.some((issue) => issue.severity === "suspect")) {
    process.exit(1);
  }
}

const isCliEntry = process.env.__VRT_DISPATCHER_LEAF__ === "scroll-scan" ||
  (process.argv[1] ? resolve(process.argv[1]) === fileURLToPath(import.meta.url) : false);
if (isCliEntry) {
  main().catch(handleCliError);
}
