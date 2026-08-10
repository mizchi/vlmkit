#!/usr/bin/env node
/**
 * Layout contract — deterministic verification of a brief's STRUCTURAL
 * requirements (docs/design/creative-markup-eval.md follow-up, 2026-07-30).
 *
 * S14a verification measured "sidebar is 260px at 1280" and "stats strip
 * is 2x2 at 768" with ad-hoc DOM scripts; this gate makes those checks a
 * declarative artifact the brief can carry, the loop can run, and the
 * verifier does not have to re-invent. Same shape as the interaction
 * behavioral contract: the reference is a small machine-checkable spec,
 * the measurement is pure DOM math, no VLM.
 *
 * Contract JSON:
 *   {
 *     "rules": [
 *       { "selector": ".sidebar",     "at": 1280, "width": 260 },
 *       { "selector": ".stat-cell",   "at": 1280, "perRow": 4 },
 *       { "selector": ".stat-cell",   "at": 768,  "perRow": 2 },
 *       { "selector": ".stat-cell",   "at": 375,  "perRow": 1 },
 *       { "selector": ".sidebar",     "at": 768,  "fullWidth": true },
 *       { "selector": ".sidebar",     "at": 768,  "above": "main" },
 *       { "selector": ".faq details", "at": 1280, "count": 2 },
 *       { "selector": "#drawer",      "at": 375,  "visible": false }
 *     ]
 *   }
 *
 * Assertions per rule (any subset; all present ones must hold):
 *   width (±tolerance, default 1) / minWidth / maxWidth — first match's box
 *   perRow    — modal number of matches per visual row (tops clustered ±8px)
 *   fullWidth — first match spans ≥95% of the viewport width
 *   above     — every match's bottom sits above every `above`-match's top
 *   count     — number of visible matches
 *   visible   — whether at least one visible match exists
 *
 * CLI:
 *   vlmkit check layout <html-or-url> --contract contract.json [--json]
 */
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { withAuthState } from "@mizchi/vlmkit-core/auth-state.ts";
import { describeRedirect } from "@mizchi/vlmkit-core/navigation-redirect.ts";
import { appendRunLedger } from "@mizchi/vlmkit-core/run-ledger.ts";
import { BOLD, CYAN, DIM, GREEN, RED, RESET } from "@mizchi/vlmkit-core/terminal-colors.ts";
import { withBrowser } from "@mizchi/vlmkit-core/browser-launch.ts";

export interface LayoutRect {
  left: number;
  top: number;
  width: number;
  height: number;
}

export interface LayoutRule {
  selector: string;
  /** Viewport width this rule is checked at. */
  at: number;
  /** Expected width (px) of the first visible match, ± tolerance. */
  width?: number;
  /** Tolerance for `width` (default 1px). */
  tolerance?: number;
  minWidth?: number;
  maxWidth?: number;
  /**
   * Minimum height (px) of EVERY visible match — unlike the width
   * assertions (first match), this checks all matches because its use
   * case is touch-target rules like "every button >= 48px tall".
   */
  minHeight?: number;
  /** Modal number of matches per visual row (tops clustered within 8px). */
  perRow?: number;
  /** First match spans >= 95% of the viewport width. */
  fullWidth?: boolean;
  /** Every match ends above every match of this selector. */
  above?: string;
  /** Number of visible matches. */
  count?: number;
  /** Whether at least one visible match exists. */
  visible?: boolean;
}

export interface LayoutContract {
  rules: LayoutRule[];
}

export interface LayoutCheck {
  name: string;
  expected: string;
  measured: string;
  passed: boolean;
}

export interface LayoutRuleResult {
  rule: LayoutRule;
  viewport: number;
  checks: LayoutCheck[];
  passed: boolean;
}

export interface LayoutReport {
  source: string;
  results: LayoutRuleResult[];
  passed: number;
  total: number;
  done: boolean;
  /**
   * Set when the URL redirected — almost always a login wall. Measured
   * 2026-08-02: against an auth-walled route this gate reported
   * `VIOLATED: count expected 2, measured 0`, which reads as "your markup is
   * wrong" when the real cause is that the session expired.
   */
  redirected?: string;
}

/** Cluster row tops (±8px) and return the modal row size. */
export function modalRowSize(rects: LayoutRect[]): number {
  if (rects.length === 0) return 0;
  const sorted = [...rects].sort((a, b) => a.top - b.top);
  const rows: number[] = [];
  let rowTop = sorted[0]!.top;
  let size = 0;
  for (const r of sorted) {
    if (Math.abs(r.top - rowTop) <= 8) {
      size++;
    } else {
      rows.push(size);
      rowTop = r.top;
      size = 1;
    }
  }
  rows.push(size);
  const counts = new Map<number, number>();
  for (const s of rows) counts.set(s, (counts.get(s) ?? 0) + 1);
  let best = 0, bestN = 0;
  for (const [s, n] of counts) if (n > bestN || (n === bestN && s > best)) { best = s; bestN = n; }
  return best;
}

export interface LayoutMeasurement {
  viewport: number;
  rects: LayoutRect[];
  aboveRects?: LayoutRect[];
}

export function evaluateLayoutRule(rule: LayoutRule, m: LayoutMeasurement): LayoutRuleResult {
  const checks: LayoutCheck[] = [];
  const first = m.rects[0];
  const push = (name: string, expected: string, measured: string, passed: boolean) =>
    checks.push({ name, expected, measured, passed });

  if (rule.visible !== undefined) {
    push("visible", String(rule.visible), String(m.rects.length > 0), (m.rects.length > 0) === rule.visible);
  }
  if (rule.count !== undefined) {
    push("count", String(rule.count), String(m.rects.length), m.rects.length === rule.count);
  }
  if (rule.width !== undefined) {
    const tol = rule.tolerance ?? 1;
    push("width", `${rule.width}±${tol}px`, first ? `${Math.round(first.width)}px` : "(no match)",
      !!first && Math.abs(first.width - rule.width) <= tol);
  }
  if (rule.minWidth !== undefined) {
    push("minWidth", `>=${rule.minWidth}px`, first ? `${Math.round(first.width)}px` : "(no match)",
      !!first && first.width >= rule.minWidth);
  }
  if (rule.maxWidth !== undefined) {
    push("maxWidth", `<=${rule.maxWidth}px`, first ? `${Math.round(first.width)}px` : "(no match)",
      !!first && first.width <= rule.maxWidth);
  }
  if (rule.minHeight !== undefined) {
    const shortest = m.rects.length > 0
      ? m.rects.reduce((a, b) => (b.height < a.height ? b : a))
      : undefined;
    push("minHeight", `every match >=${rule.minHeight}px`,
      shortest ? `shortest ${Math.round(shortest.height)}px of ${m.rects.length}` : "(no match)",
      !!shortest && shortest.height >= rule.minHeight);
  }
  if (rule.fullWidth) {
    push("fullWidth", `>=${Math.round(m.viewport * 0.95)}px (95% of ${m.viewport})`,
      first ? `${Math.round(first.width)}px` : "(no match)",
      !!first && first.width >= m.viewport * 0.95);
  }
  if (rule.perRow !== undefined) {
    const modal = modalRowSize(m.rects);
    push("perRow", String(rule.perRow), String(modal), modal === rule.perRow);
  }
  if (rule.above !== undefined) {
    const others = m.aboveRects ?? [];
    const maxBottom = m.rects.length ? Math.max(...m.rects.map((r) => r.top + r.height)) : Number.POSITIVE_INFINITY;
    const minTop = others.length ? Math.min(...others.map((r) => r.top)) : Number.NEGATIVE_INFINITY;
    push("above", `every ${rule.selector} ends above every ${rule.above}`,
      m.rects.length === 0 ? "(no match)" : others.length === 0 ? `(no match for ${rule.above})`
        : `bottom ${Math.round(maxBottom)} vs top ${Math.round(minTop)}`,
      m.rects.length > 0 && others.length > 0 && maxBottom <= minTop + 4);
  }
  if (checks.length === 0) {
    push("(no assertion)", "at least one assertion field", "none", false);
  }
  return { rule, viewport: m.viewport, checks, passed: checks.every((c) => c.passed) };
}

// A real function (not a string): page.evaluate(fn, arg) passes the
// argument; a string body would be evaluated as an expression and never
// receive `selectors` (same lesson as flow-verify's assertions).
function collectRects(selectors: string[]): Record<string, LayoutRect[]> {
  const out: Record<string, LayoutRect[]> = {};
  for (const sel of selectors) {
    const rects: LayoutRect[] = [];
    let list: Element[] = [];
    try { list = Array.from(document.querySelectorAll(sel)); } catch { list = []; }
    for (const el of list) {
      const style = getComputedStyle(el);
      if (style.display === "none" || style.visibility === "hidden") continue;
      const r = el.getBoundingClientRect();
      if (r.width <= 0 || r.height <= 0) continue;
      rects.push({ left: r.left + scrollX, top: r.top + scrollY, width: r.width, height: r.height });
    }
    out[sel] = rects;
  }
  return out;
}

export interface LayoutVerifyOptions {
  /**
   * Playwright storage-state file so gates can measure pages behind a
   * login. Falls back to VLMKIT_STORAGE_STATE. See auth-state.ts.
   */
  storageState?: string;
  source: string;
  contract: LayoutContract;
  /** Height per viewport width (defaults match check integrity). */
  heights?: Record<number, number>;
}

const DEFAULT_HEIGHTS: Record<number, number> = { 1280: 800, 768: 900, 375: 700 };

export async function runLayoutVerify(options: LayoutVerifyOptions): Promise<LayoutReport> {
  const results: LayoutRuleResult[] = [];
  let redirected: string | undefined;
  await withBrowser(async (browser) => {
    const url = /^(https?|file):\/\//.test(options.source)
      ? options.source
      : pathToFileURL(resolve(options.source)).href;
    const widths = [...new Set(options.contract.rules.map((r) => r.at))].sort((a, b) => b - a);
    for (const width of widths) {
      const height = options.heights?.[width] ?? DEFAULT_HEIGHTS[width] ?? 800;
      const page = await browser.newPage(withAuthState({ viewport: { width, height } }, options.storageState));
      await page.goto(url, { waitUntil: "networkidle", timeout: 30000 });
      redirected ??= /^https?:\/\//.test(options.source)
        ? describeRedirect(options.source, page.url()) ?? undefined
        : undefined;
      const rules = options.contract.rules.filter((r) => r.at === width);
      const selectors = [...new Set(rules.flatMap((r) => r.above ? [r.selector, r.above] : [r.selector]))];
      const rectMap = await page.evaluate(collectRects, selectors);
      for (const rule of rules) {
        results.push(evaluateLayoutRule(rule, {
          viewport: width,
          rects: rectMap[rule.selector] ?? [],
          ...(rule.above ? { aboveRects: rectMap[rule.above] ?? [] } : {}),
        }));
      }
      await page.close();
    }
  });
  const passed = results.filter((r) => r.passed).length;
  // A redirect cannot be `done`: the rules were evaluated against a page the
  // caller did not ask for, so even "all passed" would be a claim about the
  // login screen.
  const done = passed === results.length && !redirected;
  appendRunLedger({
    tool: "layout-contract",
    source: options.source,
    headline: { done, passed, total: results.length, ...(redirected ? { redirected: true } : {}) },
  });
  return {
    source: options.source,
    results,
    passed,
    total: results.length,
    done,
    ...(redirected ? { redirected } : {}),
  };
}

export function formatLayoutReport(report: LayoutReport): string {
  const lines: string[] = [];
  lines.push(`${BOLD}${CYAN}vlmkit check layout${RESET}`);
  lines.push(`${DIM}source: ${report.source}${RESET}`);
  lines.push("");
  lines.push(`verdict: ${report.done ? `${GREEN}SATISFIED${RESET}` : `${RED}VIOLATED${RESET}`} (${report.passed}/${report.total} rules)`);
  if (report.redirected) {
    // Ahead of the per-rule list: without this a stale session reads as
    // "your cards are missing", sending the reader to debug their markup.
    lines.push(`${RED}x ${report.redirected}${RESET}`);
    lines.push(`${DIM}  Every rule below was evaluated against that page.${RESET}`);
  }
  lines.push("");
  for (const r of report.results) {
    const mark = r.passed ? `${GREEN}✓${RESET}` : `${RED}✗${RESET}`;
    lines.push(`${mark} ${r.rule.selector} @${r.viewport}`);
    for (const c of r.checks) {
      const m = c.passed ? `${GREEN}✓${RESET}` : `${RED}✗${RESET}`;
      lines.push(`    ${m} ${c.name}: expected ${c.expected}${c.passed ? "" : `, ${RED}measured ${c.measured}${RESET}`}`);
    }
  }
  return lines.join("\n");
}

/**
 * CLI entry removed: this module is measurement code now, not a command.
 * `check layout` is declared in `../gates/layout.gate.ts` and driven by the core
 * runner (`@mizchi/vlmkit-core/plugin/runner.ts`), which owns argument
 * parsing, `--json`, `--advisory`, the run ledger and the exit code.
 */
