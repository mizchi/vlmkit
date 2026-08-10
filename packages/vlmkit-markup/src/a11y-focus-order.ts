#!/usr/bin/env node
/**
 * A11y focus-order check.
 *
 * Drives `Tab` through the page and records the focused element at
 * each step. Detects two classes of bug:
 *
 *   1. **Visual mismatch** — focus jumps around the page instead of
 *      reading top-to-bottom, left-to-right. Common cause: rearranging
 *      elements with `order:` (flexbox), `grid-area`, or `position`
 *      without setting matching `tabindex`. Keyboard users get
 *      disoriented.
 *
 *   2. **Trap or skipped** — `Tab` lands on the same element twice in
 *      a row (focus trap) or skips an element with `tabindex="-1"`
 *      that should be reachable (e.g., custom button without
 *      `role="button"` + `tabindex="0"`).
 *
 * Pairs well with `vlmkit check a11y touch` (size) and `vlmkit check a11y contrast`
 * (contrast) — those check static rendering, this checks the
 * keyboard journey.
 *
 * Usage:
 *   vlmkit check a11y focus <html-or-url>
 */
import { writeFile, mkdir } from "node:fs/promises";
import { join, resolve } from "node:path";
import { type Page } from "playwright";
import { withBrowser } from "@mizchi/vlmkit-core/browser-launch.ts";
import { type PageLoadOptions, navigatePage } from "@mizchi/vlmkit-core/page-load.ts";
import { sourceToUrl } from "@mizchi/vlmkit-core/page-open.ts";
import { DIM, RESET, GREEN, RED, BOLD, CYAN } from "@mizchi/vlmkit-core/terminal-colors.ts";
import { classifyFocusOrderStep } from "./markup-core-a11y-focus-order.ts";

export interface FocusOrderOptions extends PageLoadOptions {
  /**
   * Suppress the human-readable console block. Set by `--json`: the console
   * output caps its list at five rows, so mixing it into stdout ahead of the
   * JSON left `--json` unparseable — while the truncation notice pointed the
   * reader at exactly that stream. Shipped broken in 0.9.0-dev; caught by
   * running the built CLI rather than the run function.
   */
  quiet?: boolean;
  source: string;
  outputDir: string;
  reportPath?: string;
  viewport?: { width: number; height: number };
  /** Maximum Tab presses (avoids infinite focus loops). Default 64. */
  maxSteps?: number;
}

export interface FocusStep {
  tabIndex: number;
  path: string;
  tag: string;
  text: string;
  bbox: { x: number; y: number; width: number; height: number };
  /** Author `tabindex` attribute value (null = unset / default). */
  tabindexAttr: string | null;
}

export interface FocusOrderFinding {
  /** "trap" = same element focused twice in a row. */
  /** "reverse" = focus moved backward (negative Δy or Δx in same row). */
  /** "skip-row" = focus skipped down by > 1 visual row at a time. */
  kind: "trap" | "reverse" | "skip-row";
  fromIndex: number;
  toIndex: number;
  message: string;
}

export interface FocusOrderReport {
  source: string;
  viewport: { width: number; height: number };
  screenshot: string;
  steps: FocusStep[];
  findings: FocusOrderFinding[];
  reportPath: string;
}


export const A11Y_FOCUS_ORDER_SAMPLE_SCRIPT = `
(function focused() {
  const el = document.activeElement;
  if (!el || el === document.body || el === document.documentElement) return null;
  function shortPath(el) {
    const parts = [];
    let cur = el;
    while (cur && cur !== document.body && parts.length < 5) {
      let p = cur.tagName.toLowerCase();
      if (cur.id) p += "#" + cur.id;
      else if (cur.className && typeof cur.className === "string") {
        const cls = cur.className.trim().split(/\\s+/).slice(0, 2).join(".");
        if (cls) p += "." + cls;
      }
      parts.unshift(p);
      cur = cur.parentElement;
    }
    return parts.join(">");
  }
  const r = el.getBoundingClientRect();
  const text = (el.textContent || el.getAttribute("aria-label") || el.getAttribute("title") || el.getAttribute("placeholder") || "").trim().slice(0, 60);
  return {
    path: shortPath(el),
    tag: el.tagName.toLowerCase(),
    text,
    bbox: { x: r.x, y: r.y, width: r.width, height: r.height },
    tabindexAttr: el.getAttribute("tabindex"),
  };
})()
`;

/**
 * Walk Tab focus on an already-navigated Playwright Page and return
 * the focus sequence. Pulled out of `runFocusOrder` so `vlmkit diff-pr`
 * can reuse it without launching a second browser. The page is left
 * in whatever focus state Tab ended in — callers that need the
 * pristine page should clone it first.
 */
export async function collectFocusStepsOnPage(
  page: Page,
  maxSteps = 64,
): Promise<FocusStep[]> {
  const steps: FocusStep[] = [];
  let firstFingerprint: string | null = null;
  for (let i = 0; i < maxSteps; i++) {
    await page.keyboard.press("Tab");
    const sample = await page.evaluate(A11Y_FOCUS_ORDER_SAMPLE_SCRIPT) as Omit<FocusStep, "tabIndex"> | null;
    if (!sample) break;
    // Cycle detection: path + bbox together. Path alone aliases
    // sibling elements (3 buttons all serialize to "button"), which
    // would false-cycle on the first sibling jump. Bbox makes the
    // fingerprint position-aware.
    const fp = `${sample.path}@${sample.bbox.x.toFixed(0)},${sample.bbox.y.toFixed(0)}`;
    if (firstFingerprint === null) firstFingerprint = fp;
    else if (fp === firstFingerprint && i > 0) break;
    steps.push({ tabIndex: i, ...sample });
  }
  return steps;
}

/**
 * Detect focus-order findings from a captured step sequence. Pure
 * post-process — extracted from `runFocusOrder`. Heuristics are
 * deliberately conservative (24 px / 40 px / 16 px thresholds) to
 * avoid false positives on normal layouts. See the comments inside
 * `runFocusOrder` for the rationale.
 */
export function analyzeFocusOrderSteps(steps: FocusStep[]): FocusOrderFinding[] {
  const findings: FocusOrderFinding[] = [];
  for (let i = 1; i < steps.length; i++) {
    const prev = steps[i - 1]!;
    const cur = steps[i]!;
    const transition = classifyFocusOrderStep({
      samePath: prev.path === cur.path,
      prev: { x: prev.bbox.x, y: prev.bbox.y },
      cur: { x: cur.bbox.x, y: cur.bbox.y },
    });
    if (transition === "ok") continue;
    const dy = cur.bbox.y - prev.bbox.y;
    if (transition === "trap") {
      findings.push({
        kind: "trap",
        fromIndex: i - 1, toIndex: i,
        message: `Focus stayed on the same element (\`${cur.path}\`) across two Tab presses.`,
      });
    } else if (transition === "reverse-left") {
      findings.push({
        kind: "reverse",
        fromIndex: i - 1, toIndex: i,
        message: `Focus moved left within the same row (from \`${prev.path}\` at x=${prev.bbox.x.toFixed(0)} to \`${cur.path}\` at x=${cur.bbox.x.toFixed(0)}). Visual order is L-to-R; check \`tabindex\` or DOM order.`,
      });
    } else if (transition === "reverse-up") {
      findings.push({
        kind: "reverse",
        fromIndex: i - 1, toIndex: i,
        message: `Focus moved up by ${(-dy).toFixed(0)}px (from \`${prev.path}\` at y=${prev.bbox.y.toFixed(0)} to \`${cur.path}\` at y=${cur.bbox.y.toFixed(0)}). Visual order is top-to-bottom; check \`tabindex\` or DOM order.`,
      });
    } else if (transition === "skip-row") {
      findings.push({
        kind: "skip-row",
        fromIndex: i - 1, toIndex: i,
        message: `Focus jumped down by ${dy.toFixed(0)}px (from \`${prev.path}\` to \`${cur.path}\`). Confirm no focusable element was unintentionally skipped.`,
      });
    }
  }
  return findings;
}

export async function runFocusOrder(
  options: FocusOrderOptions,
): Promise<FocusOrderReport> {
  const outputDir = resolve(options.outputDir);
  await mkdir(outputDir, { recursive: true });
  const viewport = options.viewport ?? { width: 1280, height: 720 };
  const maxSteps = options.maxSteps ?? 64;
  const steps: FocusStep[] = [];
  // `withBrowser`, so a throw anywhere in the sweep below still closes the
  // browser. The `screenshotPath` comes out of the callback rather than an outer
  // `let`, because TypeScript's definite-assignment analysis does not follow an
  // assignment made in a closure.
  const screenshotPath = await withBrowser(async (browser) => {
    const page = await browser.newPage({ viewport });
    // Always navigate — a file gets a `file://` URL, not `setContent`.
    //
    // This gate classifies each focus step by the element's x/y, so an external
    // stylesheet that never loads does not merely degrade the result, it inverts it:
    // with no CSS every element sits in DOM order at the left margin, and the
    // reverse/skip-row classifications have nothing to detect. Measured on a fixture
    // whose layout lives only in `layout.css` (buttons at x=700 / x=20 / x=360, DOM
    // order a,b,c — a textbook `reverse-left`): `setContent` reported **0 findings,
    // exit 0**, and the identical layout with the CSS inlined reported the
    // `reverse` finding and exit 1. An accessibility gate calling a real WCAG
    // violation clean is the worst failure available to it.
    //
    // Same mechanism `page-open.ts` documents for `check a11y contrast` (a 1.92:1
    // contrast failure read as 0 failures), and the same conversion
    // `stress media`'s `loadPage` already made.
    await navigatePage(page, sourceToUrl(options.source), options);
    await page.addStyleTag({
      content: `*, *::before, *::after { transition: none !important; animation: none !important; }`,
    });
    const shot = join(outputDir, "page.png");
    await page.screenshot({ path: shot, fullPage: false });

    // Start from the document. The first Tab moves focus to the
    // earliest focusable element. We capture activeElement after
    // each press until either the focus cycles back to the first
    // element or we hit `maxSteps`.
    let firstPath: string | null = null;
    for (let i = 0; i < maxSteps; i++) {
      await page.keyboard.press("Tab");
      const sample = await page.evaluate(A11Y_FOCUS_ORDER_SAMPLE_SCRIPT) as Omit<FocusStep, "tabIndex"> | null;
      if (!sample) break;
      if (firstPath === null) firstPath = sample.path;
      else if (sample.path === firstPath && i > 0) break;  // cycled
      steps.push({ tabIndex: i, ...sample });
    }
    await page.close();
    return shot;
  });

  // Detect findings via the shared MoonBit-backed classifier.
  const findings: FocusOrderFinding[] = analyzeFocusOrderSteps(steps);

  const reportPath = options.reportPath ?? join(outputDir, "report.md");
  const md = renderReport({
    source: options.source, viewport, screenshot: screenshotPath, steps, findings,
  });
  await writeFile(reportPath, md);



  return {
    source: options.source, viewport, screenshot: screenshotPath,
    steps, findings, reportPath,
  };
}

/**
 * Terminal summary, extracted from the `!options.quiet` block inside the
 * measurement function. A gate's `run` must not print: the core runner owns
 * output, and `--json` is its decision to make, not the measurement's.
 */
export function formatFocusOrderReport(report: FocusOrderReport): string {
  const lines: string[] = [];
  lines.push(`  ${BOLD}${CYAN}vlmkit check a11y focus${RESET}`);
  lines.push(`  ${DIM}source: ${report.source}${RESET}`);
  lines.push(`  ${DIM}captured ${report.steps.length} focus step(s)${RESET}`);
  const icon = report.findings.length === 0 ? `${GREEN}✓${RESET}` : `${RED}✗${RESET}`;
  lines.push(`  ${icon} ${report.findings.length} finding(s)`);
  const CONSOLE_ROWS = 5;
  for (const f of report.findings.slice(0, CONSOLE_ROWS)) {
    lines.push(`    ${DIM}[${f.kind}] ${f.message}${RESET}`);
  }
  // See a11y-contrast: an undisclosed cut makes a partial list look complete.
  if (report.findings.length > CONSOLE_ROWS) {
    lines.push(`    ${DIM}… ${report.findings.length - CONSOLE_ROWS} more (see the report, or --json for all)${RESET}`);
  }
  lines.push(`  ${DIM}report: ${report.reportPath}${RESET}`);
  return lines.join("\n");
}

function renderReport(r: Omit<FocusOrderReport, "reportPath">): string {
  const lines: string[] = [];
  lines.push("# A11y focus-order report");
  lines.push("");
  lines.push(`Source: \`${r.source}\` at ${r.viewport.width}×${r.viewport.height}`);
  lines.push("");
  lines.push(`Captured **${r.steps.length}** focus step(s) by pressing \`Tab\` until focus cycled or step limit hit.`);
  lines.push("");
  lines.push("## Focus sequence");
  lines.push("");
  lines.push("| # | Element | Text | Position (x,y) | tabindex |");
  lines.push("|---|---|---|---|---|");
  for (const s of r.steps) {
    const idx = s.tabindexAttr === null ? "—" : `\`${s.tabindexAttr}\``;
    lines.push(`| ${s.tabIndex} | \`${s.path}\` | \`${s.text}\` | ${s.bbox.x.toFixed(0)}, ${s.bbox.y.toFixed(0)} | ${idx} |`);
  }
  lines.push("");

  if (r.findings.length === 0) {
    lines.push("## ✓ No focus-order issues detected");
    lines.push("");
    lines.push("Focus order matches visual order (top-to-bottom, left-to-right within rows). " +
      "No focus traps or large unexplained jumps.");
  } else {
    lines.push(`## ${r.findings.length} finding(s)`);
    lines.push("");
    for (const f of r.findings) {
      const from = r.steps[f.fromIndex];
      const to = r.steps[f.toIndex];
      lines.push(`- **${f.kind}** (step ${f.fromIndex} → ${f.toIndex}): ${f.message}`);
      if (from && to) {
        lines.push(`  - from: \`${from.path}\` at (${from.bbox.x.toFixed(0)}, ${from.bbox.y.toFixed(0)})`);
        lines.push(`  - to:   \`${to.path}\` at (${to.bbox.x.toFixed(0)}, ${to.bbox.y.toFixed(0)})`);
      }
    }
    lines.push("");
    lines.push("## Suggested next step");
    lines.push("");
    lines.push("1. Open the page and step through with `Tab` manually to confirm the report.");
    lines.push("2. For `reverse` findings: check if the divergent element has an explicit " +
      "`tabindex` that overrides DOM order. If so, either remove the `tabindex` or " +
      "reorder the DOM.");
    lines.push("3. For `trap` findings: a custom widget likely captured focus and didn't " +
      "release. Check `onkeydown` handlers or roving-`tabindex` patterns.");
    lines.push("4. For `skip-row` findings: large vertical jumps are sometimes intentional " +
      "(skipping a paragraph between two buttons). Verify the skipped region has no " +
      "intended focusable elements.");
  }
  lines.push("");
  return lines.join("\n");
}

/**
 * CLI entry removed: this module is measurement code now, not a command.
 * `check a11y focus` is declared in `./gates/a11y.gate.ts` and driven by the core runner
 * (`@mizchi/vlmkit-core/plugin/runner.ts`), which owns argument parsing,
 * `--json`, `--advisory`, the run ledger and the exit code.
 */
