#!/usr/bin/env node
/**
 * Scroll *behavior* verification — the complement of `scan scroll`.
 *
 * `scan scroll` proves scroll containers exist; nothing verified what
 * happens DURING scrolling. This drives the page (and its snap
 * containers) programmatically and checks:
 *
 *   - `position: fixed` elements keep their viewport-relative bbox while
 *     the page scrolls (`fixed-drifts`, suspect)
 *   - `position: sticky` elements that the scroll has engaged actually
 *     stick at their computed `top` offset (`sticky-not-sticking`,
 *     suspect); sticky elements the scroll never reaches are inventory
 *     only
 *   - `scroll-snap-type` containers, after a partial programmatic scroll
 *     and settle, land aligned to some child's snap edge
 *     (`snap-not-snapping`, warn)
 *
 * Page-level sticky/fixed only in v1 — sticky inside nested scrollers is
 * inventoried but not driven. Deterministic: DOM metrics only, no VLM.
 *
 * CLI:
 *   vlmkit check scroll <html-or-url> [--json]
 */
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { withAuthState } from "@mizchi/vlmkit-core/auth-state.ts";
import { describeRedirect } from "@mizchi/vlmkit-core/navigation-redirect.ts";
import { type PageLoadOptions, navigatePage, navigationOptions } from "@mizchi/vlmkit-core/page-load.ts";
import { BOLD, CYAN, DIM, GREEN, RED, RESET, YELLOW } from "@mizchi/vlmkit-core/terminal-colors.ts";

export interface StickyFixedSample {
  selector: string;
  position: "sticky" | "fixed";
  /** Computed `top` in px; null when `auto`. */
  stickyTopPx: number | null;
  /** Viewport-relative bbox before the page scroll. */
  before: { x: number; y: number; width: number; height: number };
  /** Viewport-relative bbox after the page scroll. */
  after: { x: number; y: number; width: number; height: number };
  /** Document-relative top at rest (before scroll). */
  documentTop: number;
}

export interface SnapSample {
  selector: string;
  axis: "x" | "y";
  strictness: string;
  /** Scroll offset the container settled at after the programmatic scroll. */
  settledOffset: number;
  /** Snap-aligned candidate offsets derived from the children. */
  candidateOffsets: number[];
  /** Maximum reachable scroll offset (scrollSize - clientSize). */
  maxOffset: number;
  childCount: number;
}

export interface ScrollBehaviorInput {
  source: string;
  /** How far the page was actually scrolled (px). 0 = page doesn't scroll. */
  pageScrolled: number;
  stickyFixed: StickyFixedSample[];
  snaps: SnapSample[];
}

export type ScrollBehaviorIssueKind =
  /**
   * A URL that redirected somewhere meaningful — almost always a login wall.
   * Measured 2026-08-02: pointed at an auth-walled route with no session, this
   * gate reported `status: ok` for the login page while naming the requested
   * URL as its source. Reported as a suspect issue so the pass cannot be silent.
   */
  | "redirected"
  | "fixed-drifts"
  | "sticky-not-sticking"
  | "snap-not-snapping";

export interface ScrollBehaviorIssue {
  kind: ScrollBehaviorIssueKind;
  severity: "warn" | "suspect";
  selector: string;
  message: string;
}

export interface ScrollBehaviorReport extends ScrollBehaviorInput {
  /** Sticky elements the scroll engaged (scrolled past their rest position). */
  engagedSticky: number;
  issues: ScrollBehaviorIssue[];
}

export interface ScrollBehaviorOptions extends PageLoadOptions {
  /**
   * Playwright storage-state file so gates can measure pages behind a
   * login. Falls back to VLMKIT_STORAGE_STATE. See auth-state.ts.
   */
  storageState?: string;
  source: string;
  html?: string;
  viewport?: { width: number; height: number };
  /** Tolerance in px for fixed/sticky position checks (default 2). */
  tolerance?: number;
  /** Tolerance in px for snap alignment (default 3). */
  snapTolerance?: number;
  /** Max elements per category (default 20). */
  maxElements?: number;
}

export function analyzeScrollBehavior(
  input: ScrollBehaviorInput,
  options: Pick<ScrollBehaviorOptions, "tolerance" | "snapTolerance"> = {},
): ScrollBehaviorReport {
  const tolerance = options.tolerance ?? 2;
  const snapTolerance = options.snapTolerance ?? 3;
  const issues: ScrollBehaviorIssue[] = [];
  let engagedSticky = 0;

  for (const s of input.stickyFixed) {
    if (s.position === "fixed") {
      if (input.pageScrolled <= 0) continue;
      const dx = Math.abs(s.after.x - s.before.x);
      const dy = Math.abs(s.after.y - s.before.y);
      if (dx > tolerance || dy > tolerance) {
        issues.push({
          kind: "fixed-drifts",
          severity: "suspect",
          selector: s.selector,
          message: `${s.selector} is position: fixed but its viewport position moved (${s.before.x},${s.before.y}) -> (${s.after.x},${s.after.y}) while the page scrolled ${input.pageScrolled}px — a transformed ancestor creates a new containing block and silently demotes fixed to absolute.`,
        });
      }
      continue;
    }
    // Sticky: engaged when the page scrolled past the element's rest
    // position minus its stick offset — only then must it hold `top`.
    if (s.stickyTopPx === null) continue;
    const engageAt = s.documentTop - s.stickyTopPx;
    if (input.pageScrolled <= engageAt + tolerance) continue;
    engagedSticky++;
    if (Math.abs(s.after.y - s.stickyTopPx) > tolerance) {
      issues.push({
        kind: "sticky-not-sticking",
        severity: "suspect",
        selector: s.selector,
        message: `${s.selector} is position: sticky (top: ${s.stickyTopPx}px) and the scroll engaged it, but it sits at viewport y=${s.after.y} — usually an overflow: hidden/auto ancestor or a too-short parent (sticky can never leave its parent's box).`,
      });
    }
  }

  for (const snap of input.snaps) {
    if (snap.strictness === "proximity") continue; // proximity may legitimately not snap
    if (snap.childCount === 0) {
      issues.push({
        kind: "snap-not-snapping",
        severity: "warn",
        selector: snap.selector,
        message: `${snap.selector} declares scroll-snap-type ${snap.axis} ${snap.strictness} but NO child declares scroll-snap-align — the container never snaps (settled at an arbitrary ${snap.settledOffset}px).`,
      });
      continue;
    }
    const aligned = snap.candidateOffsets.some((o) => Math.abs(o - snap.settledOffset) <= snapTolerance)
      || Math.abs(snap.settledOffset - snap.maxOffset) <= snapTolerance;
    if (!aligned) {
      issues.push({
        kind: "snap-not-snapping",
        severity: "warn",
        selector: snap.selector,
        message: `${snap.selector} declares scroll-snap-type ${snap.axis} ${snap.strictness} but settled at offset ${snap.settledOffset}px, aligned to no child snap edge (nearest candidates: ${snap.candidateOffsets.slice(0, 5).join(", ")}px) — children may be missing scroll-snap-align.`,
      });
    }
  }

  return { ...input, engagedSticky, issues };
}

const COLLECT_SCRIPT = (maxElements: number) => `(async () => {
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
    const siblings = Array.from(parent.children).filter((s) => s.tagName === el.tagName);
    return el.tagName.toLowerCase() + ":nth-of-type(" + (siblings.indexOf(el) + 1) + ")";
  }
  const raf2 = () => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
  const box = (el) => {
    const b = el.getBoundingClientRect();
    return { x: Math.round(b.x), y: Math.round(b.y), width: Math.round(b.width), height: Math.round(b.height) };
  };

  // Inventory sticky/fixed + snap containers.
  const stickyFixed = [];
  const snapEls = [];
  for (const el of Array.from(document.querySelectorAll("*"))) {
    const style = getComputedStyle(el);
    if ((style.position === "sticky" || style.position === "fixed")) {
      const b = el.getBoundingClientRect();
      if (b.width > 0 && b.height > 0 && stickyFixed.length < ${maxElements}) {
        const topPx = Number.parseFloat(style.top);
        stickyFixed.push({
          el,
          selector: stableSelector(el),
          position: style.position,
          stickyTopPx: Number.isFinite(topPx) ? topPx : null,
          before: box(el),
          documentTop: Math.round(b.y + window.scrollY),
        });
      }
    }
    const snapType = style.scrollSnapType;
    if (snapType && snapType !== "none" && snapEls.length < ${maxElements}) {
      const axis = /x/.test(snapType) ? "x" : "y";
      const strictness = /mandatory/.test(snapType) ? "mandatory" : /proximity/.test(snapType) ? "proximity" : "mandatory";
      const scrollable = axis === "x" ? el.scrollWidth > el.clientWidth + 2 : el.scrollHeight > el.clientHeight + 2;
      if (scrollable) snapEls.push({ el, selector: stableSelector(el), axis, strictness });
    }
  }

  // Drive the page scroll and re-measure sticky/fixed.
  const maxScroll = Math.max(0, document.documentElement.scrollHeight - window.innerHeight);
  const pageScrolled = Math.min(maxScroll, Math.round(window.innerHeight * 1.5));
  if (pageScrolled > 0) {
    window.scrollTo(0, pageScrolled);
    await raf2();
  }
  for (const s of stickyFixed) s.after = box(s.el);
  if (pageScrolled > 0) {
    window.scrollTo(0, 0);
    await raf2();
  }

  // Drive each snap container: scroll ~40% of the client size, settle,
  // record where it landed and the child-aligned candidate offsets.
  const snaps = [];
  for (const { el, selector, axis, strictness } of snapEls) {
    const client = axis === "x" ? el.clientWidth : el.clientHeight;
    const target = Math.round(client * 0.4);
    if (axis === "x") el.scrollTo({ left: target }); else el.scrollTo({ top: target });
    // Settle: wait until the offset is stable across frames (snap animates).
    let last = -1;
    for (let i = 0; i < 60; i++) {
      await raf2();
      const now = axis === "x" ? el.scrollLeft : el.scrollTop;
      if (now === last) break;
      last = now;
    }
    const settledOffset = Math.round(axis === "x" ? el.scrollLeft : el.scrollTop);
    const maxOffset = Math.round(axis === "x" ? el.scrollWidth - el.clientWidth : el.scrollHeight - el.clientHeight);
    const candidateOffsets = [];
    const cRect = el.getBoundingClientRect();
    for (const child of Array.from(el.children)) {
      const align = getComputedStyle(child).scrollSnapAlign;
      if (!align || align === "none") continue;
      const chRect = child.getBoundingClientRect();
      const current = axis === "x" ? el.scrollLeft : el.scrollTop;
      const childStart = axis === "x" ? chRect.left - cRect.left + current : chRect.top - cRect.top + current;
      const childSize = axis === "x" ? chRect.width : chRect.height;
      if (/center/.test(align)) candidateOffsets.push(Math.round(childStart - (client - childSize) / 2));
      else if (/end/.test(align)) candidateOffsets.push(Math.round(childStart - client + childSize));
      else candidateOffsets.push(Math.round(childStart));
    }
    if (axis === "x") el.scrollTo({ left: 0 }); else el.scrollTo({ top: 0 });
    snaps.push({ selector, axis, strictness, settledOffset, candidateOffsets, maxOffset, childCount: candidateOffsets.length });
  }

  return {
    pageScrolled,
    stickyFixed: stickyFixed.map(({ el, ...rest }) => rest),
    snaps,
  };
})()`;

function isUrl(source: string): boolean {
  return /^(https?|file):\/\//.test(source);
}

export async function runScrollBehavior(options: ScrollBehaviorOptions): Promise<ScrollBehaviorReport> {
  const viewport = options.viewport ?? { width: 1280, height: 720 };
  const { chromium } = await import("playwright");
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage(withAuthState({ viewport }, options.storageState));
    if (options.html !== undefined) {
      await page.setContent(options.html, navigationOptions(options));
    } else {
      const url = isUrl(options.source) ? options.source : pathToFileURL(resolve(options.source)).href;
      await navigatePage(page, url, options);
    }
    // A redirect here is almost always a login wall. Without this the gate
    // measured the login page and reported `status: ok` while naming the
    // requested URL as its source (measured 2026-08-02).
    const redirectNote = isUrl(options.source) ? describeRedirect(options.source, page.url()) : null;
    const collected = await page.evaluate(COLLECT_SCRIPT(options.maxElements ?? 20)) as
      Omit<ScrollBehaviorInput, "source">;
    await page.close();
    const report = analyzeScrollBehavior({ source: options.source, ...collected }, options);
    // Pushed as a suspect ISSUE, not just printed: the status line is derived
    // from the issue list, so a note alone would have left `status: ok`.
    if (redirectNote) {
      report.issues.unshift({ kind: "redirected", severity: "suspect", selector: "", message: redirectNote });
    }
    // No ledger append here — `scrollGate.ledger` writes the row. This one
    // used the same `tool: "check-scroll"` name as the gate's, so a run left
    // two indistinguishable entries and any count over the ledger doubled.
    return report;
  } finally {
    await browser.close();
  }
}

export function formatScrollBehaviorReport(report: ScrollBehaviorReport): string {
  const lines: string[] = [];
  const status = report.issues.some((i) => i.severity === "suspect") ? "suspect"
    : report.issues.length > 0 ? "warn"
    : "ok";
  lines.push(`${BOLD}${CYAN}vlmkit check scroll${RESET}`);
  lines.push(`${DIM}source: ${report.source}${RESET}`);
  lines.push("");
  lines.push(`status: ${status}`);
  lines.push(`page scrolled: ${report.pageScrolled}px`);
  lines.push(`sticky/fixed elements: ${report.stickyFixed.length} (sticky engaged by the scroll: ${report.engagedSticky})`);
  lines.push(`snap containers driven: ${report.snaps.length}`);
  if (report.stickyFixed.length > 0) {
    lines.push("");
    lines.push("Sticky / fixed:");
    for (const s of report.stickyFixed) {
      lines.push(`  - ${s.selector}: ${s.position}${s.stickyTopPx !== null ? ` top=${s.stickyTopPx}px` : ""} viewport y ${s.before.y} -> ${s.after.y}`);
    }
  }
  if (report.snaps.length > 0) {
    lines.push("");
    lines.push("Snap containers:");
    for (const s of report.snaps) {
      lines.push(`  - ${s.selector}: ${s.axis} ${s.strictness}, settled at ${s.settledOffset}px (${s.childCount} snap-aligned children)`);
    }
  }
  if (report.issues.length > 0) {
    lines.push("");
    lines.push("Issues:");
    for (const issue of report.issues) {
      const icon = issue.severity === "suspect" ? `${RED}x${RESET}` : `${YELLOW}!${RESET}`;
      lines.push(`  ${icon} ${issue.kind} ${issue.selector}: ${issue.message}`);
    }
  } else {
    lines.push("");
    lines.push(`${GREEN}No scroll-behavior issues detected.${RESET}`);
  }
  return lines.join("\n");
}

/**
 * CLI entry removed: this module is measurement code now, not a command.
 * `check scroll` is declared in `../gates/scroll.gate.ts` and driven by the core
 * runner (`@mizchi/vlmkit-core/plugin/runner.ts`), which owns argument
 * parsing, `--json`, `--advisory`, the run ledger and the exit code.
 */
