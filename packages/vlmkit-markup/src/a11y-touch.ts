#!/usr/bin/env node
/**
 * A11y touch-target check.
 *
 * WCAG 2.1 AAA (criterion 2.5.5) requires interactive elements to have
 * a target size of at least 44 × 44 CSS px. WCAG 2.2 AA (criterion
 * 2.5.8) relaxes this to 24 × 24 with sufficient spacing. Small
 * touch targets are unreachable for users with motor impairments
 * and frustrating on touchscreens.
 *
 * Scans visible interactive elements (button, link, input, select,
 * textarea, [role=button], [role=link], elements with tabindex ≥ 0)
 * and reports those whose bounding box falls below the chosen
 * threshold.
 *
 * Usage:
 *   vlmkit check a11y touch <html-or-url>
 *   vlmkit check a11y touch <url> --level AAA   # 44x44 (default)
 *   vlmkit check a11y touch <url> --level AA    # 24x24
 */
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { basename, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { type Page } from "playwright";
import { handleCliError } from "@mizchi/vlmkit-core/cli-error.ts";
import { DIM, RESET, GREEN, RED, BOLD, CYAN } from "@mizchi/vlmkit-core/terminal-colors.ts";
import { openSource } from "@mizchi/vlmkit-core/page-open.ts";
import {
  requiredTouchSide,
  touchTargetBelowRequired,
  touchTargetInCluster,
} from "./markup-core-a11y-touch.ts";
import { withBrowser } from "@mizchi/vlmkit-core/browser-launch.ts";

export type WcagTouchLevel = "AAA" | "AA";

export interface TouchCheckOptions {
  /**
   * Suppress the human-readable console block. Set by `--json`: the console
   * output caps its list at five rows, so mixing it into stdout ahead of the
   * JSON left `--json` unparseable — while the truncation notice pointed the
   * reader at exactly that stream. Shipped broken in 0.9.0-dev; caught by
   * running the built CLI rather than the run function.
   */
  quiet?: boolean;
  /** HTML file path or http(s) URL. */
  source: string;
  outputDir: string;
  reportPath?: string;
  viewport?: { width: number; height: number };
  /** Required size threshold. AAA → 44px, AA → 24px. Default AAA. */
  level?: WcagTouchLevel;
}

export interface TouchTargetFinding {
  path: string;
  tag: string;
  text: string;
  bbox: { x: number; y: number; width: number; height: number };
  /** Minimum of width and height — the limiting dimension. */
  minSide: number;
  required: number;
  /** Same selectors with overlapping or near-adjacent bboxes within 24 px. */
  cluster: boolean;
}

export interface TouchReport {
  source: string;
  level: WcagTouchLevel;
  /**
   * Required minimum side in px for `level`. On the report so the formatter
   * stays pure: deriving it needs `requiredTouchSide`, which runs the MoonBit
   * policy — real work, and a formatter that does real work can fail.
   */
  required: number;
  viewport: { width: number; height: number };
  screenshot: string;
  inspectedCount: number;
  failures: TouchTargetFinding[];
  reportPath: string;
}

export const A11Y_TOUCH_SAMPLE_SCRIPT = `
(function a11yTouch() {
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
  const selectors = [
    "button",
    "a[href]",
    "input:not([type='hidden'])",
    "select",
    "textarea",
    "summary",
    "[role='button']",
    "[role='link']",
    "[tabindex]:not([tabindex='-1'])",
  ].join(",");
  const out = [];
  const seen = new Set();
  for (const el of document.querySelectorAll(selectors)) {
    if (seen.has(el)) continue;
    seen.add(el);
    const cs = getComputedStyle(el);
    if (cs.visibility === "hidden" || cs.display === "none" || parseFloat(cs.opacity) < 0.5) continue;
    if (el.hasAttribute("disabled") || el.getAttribute("aria-hidden") === "true") continue;
    const r = el.getBoundingClientRect();
    if (r.width === 0 || r.height === 0) continue;
    const text = (el.textContent || el.getAttribute("aria-label") || el.getAttribute("title") || "").trim().slice(0, 60);
    out.push({
      path: shortPath(el),
      tag: el.tagName.toLowerCase(),
      text,
      bbox: { x: r.x, y: r.y, width: r.width, height: r.height },
    });
    if (out.length > 400) break;
  }
  return out;
})()
`;

export interface A11yTouchRawSample {
  path: string;
  tag: string;
  text: string;
  bbox: { x: number; y: number; width: number; height: number };
}

/**
 * Build the list of touch-target failures from raw samples. Pure
 * post-process so the `vlmkit diff-pr` CI gate can reuse it on its
 * own Playwright page without spinning up a new browser.
 */
export function analyzeA11yTouchSamples(
  samples: A11yTouchRawSample[],
  level: WcagTouchLevel = "AAA",
): TouchTargetFinding[] {
  const required = requiredTouchSide(level);
  const byPath = new Map<string, A11yTouchRawSample>();
  for (const s of samples) if (!byPath.has(s.path)) byPath.set(s.path, s);
  const findings: TouchTargetFinding[] = [];
  const elements = [...byPath.values()];
  const centers = elements.map((e) => ({
    x: e.bbox.x + e.bbox.width / 2,
    y: e.bbox.y + e.bbox.height / 2,
  }));
  for (let i = 0; i < elements.length; i++) {
    const e = elements[i]!;
    const minSide = Math.min(e.bbox.width, e.bbox.height);
    if (!touchTargetBelowRequired(minSide, level)) continue;
    let cluster = false;
    for (let j = 0; j < elements.length; j++) {
      if (i === j) continue;
      if (touchTargetInCluster(centers[i]!, centers[j]!)) {
        cluster = true;
        break;
      }
    }
    findings.push({
      path: e.path,
      tag: e.tag,
      text: e.text,
      bbox: e.bbox,
      minSide: Math.round(minSide),
      required,
      cluster,
    });
  }
  findings.sort((a, b) => a.minSide - b.minSide);
  return findings;
}

export async function runA11yTouch(options: TouchCheckOptions): Promise<TouchReport> {
  const outputDir = resolve(options.outputDir);
  await mkdir(outputDir, { recursive: true });
  const viewport = options.viewport ?? { width: 1280, height: 900 };
  const level = options.level ?? "AAA";
  const required = level === "AAA" ? 44 : 24;

  // Returned out of the callback, not assigned into outer `let`s — TypeScript's
  // definite-assignment analysis does not follow an assignment made in a closure.
  const { samples, screenshotPath } = await withBrowser(async (browser) => {
    // One load path for files and URLs. The file branch used to
    // `setContent(readFile(...))`, which drops the document's base URL: on
    // fixtures/external-assets that hid the 20x20 tap target entirely (the
    // element gets its size from CSS) while reporting three styled-and-compliant
    // buttons as failures at their unstyled sizes.
    const { page } = await openSource(browser, options.source, { viewport, settleMs: 0 });
    await page.addStyleTag({
      content: `*, *::before, *::after { transition: none !important; animation: none !important; }`,
    });
    const samples = await page.evaluate(A11Y_TOUCH_SAMPLE_SCRIPT) as A11yTouchRawSample[];
    const screenshotPath = join(outputDir, "page.png");
    await page.screenshot({ path: screenshotPath, fullPage: false });
    await page.close();
    return { samples, screenshotPath };
  });

  // Dedupe by path.
  const byPath = new Map<string, A11yTouchRawSample>();
  for (const s of samples) if (!byPath.has(s.path)) byPath.set(s.path, s);

  // Cluster detection: if two below-threshold targets are within
  // 24 px center-to-center, the WCAG 2.5.8 AA "with spacing" leniency
  // is forfeited. (Strict-AAA doesn't have the leniency anyway, but
  // we still surface clusters for context.)
  const findings: TouchTargetFinding[] = [];
  const elements = [...byPath.values()];
  for (let i = 0; i < elements.length; i++) {
    const e = elements[i]!;
    const minSide = Math.min(e.bbox.width, e.bbox.height);
    if (minSide >= required) continue;
    let cluster = false;
    for (let j = 0; j < elements.length; j++) {
      if (i === j) continue;
      const o = elements[j]!;
      const cx1 = e.bbox.x + e.bbox.width / 2, cy1 = e.bbox.y + e.bbox.height / 2;
      const cx2 = o.bbox.x + o.bbox.width / 2, cy2 = o.bbox.y + o.bbox.height / 2;
      const dx = cx2 - cx1, dy = cy2 - cy1;
      if (Math.sqrt(dx * dx + dy * dy) < 24) { cluster = true; break; }
    }
    findings.push({
      path: e.path,
      tag: e.tag,
      text: e.text,
      bbox: e.bbox,
      minSide: Math.round(minSide),
      required,
      cluster,
    });
  }
  findings.sort((a, b) => a.minSide - b.minSide);

  const reportPath = options.reportPath ?? join(outputDir, "report.md");
  const md = renderReport({
    source: options.source,
    level,
    required,
    viewport,
    screenshot: screenshotPath,
    inspectedCount: byPath.size,
    failures: findings,
  });
  await writeFile(reportPath, md);



  return {
    source: options.source, level, required, viewport, screenshot: screenshotPath,
    inspectedCount: byPath.size, failures: findings, reportPath,
  };
}

/**
 * Terminal summary, extracted from the `!options.quiet` block inside the
 * measurement function. A gate's `run` must not print: the core runner owns
 * output, and `--json` is its decision to make, not the measurement's.
 */
export function formatA11yTouchReport(report: TouchReport): string {
  const lines: string[] = [];
  lines.push(`  ${BOLD}${CYAN}vlmkit check a11y touch${RESET}`);
  lines.push(
    `  ${DIM}source: ${report.source}  level: WCAG ${report.level}`
    + ` (${report.required}×${report.required} min)${RESET}`,
  );
  lines.push(`  ${DIM}inspected ${report.inspectedCount} interactive element(s)${RESET}`);
  const icon = report.failures.length === 0 ? `${GREEN}✓${RESET}` : `${RED}✗${RESET}`;
  lines.push(`  ${icon} ${report.failures.length} undersized target(s)`);
  const CONSOLE_ROWS = 5;
  for (const f of report.failures.slice(0, CONSOLE_ROWS)) {
    const cl = f.cluster ? " (clustered)" : "";
    lines.push(`    ${DIM}${f.path} — ${Math.round(f.bbox.width)}×${Math.round(f.bbox.height)}${cl} — "${f.text}"${RESET}`);
  }
  // See a11y-contrast: an undisclosed cut makes a partial list look complete.
  if (report.failures.length > CONSOLE_ROWS) {
    lines.push(`    ${DIM}… ${report.failures.length - CONSOLE_ROWS} more (see the report, or --json for all)${RESET}`);
  }
  lines.push(`  ${DIM}report: ${report.reportPath}${RESET}`);
  return lines.join("\n");
}

function renderReport(r: Omit<TouchReport, "reportPath">): string {
  const lines: string[] = [];
  lines.push("# A11y touch-target report");
  lines.push("");
  lines.push(`Source: \`${r.source}\``);
  lines.push(`WCAG level: **${r.level}** — requires ${r.level === "AAA" ? "44×44 px" : "24×24 px (with spacing)"} for every interactive element.`);
  lines.push("");
  lines.push(`Inspected **${r.inspectedCount}** interactive element(s).  ` +
    `Screenshot: \`${r.screenshot}\``);
  lines.push("");
  if (r.failures.length === 0) {
    lines.push("## All interactive elements meet the size threshold.");
    return lines.join("\n");
  }
  lines.push(`## ${r.failures.length} undersized target(s)`);
  lines.push("");
  lines.push("Targets below the threshold are hard to tap on touchscreens and " +
    "unreachable for users with motor impairments. The `cluster` flag fires " +
    "when another interactive element's center is within 24 px — the WCAG " +
    "AA-with-spacing leniency does not apply.");
  lines.push("");
  lines.push("| Element | Text | Size | Min side | Need | Cluster |");
  lines.push("|---|---|---|---|---|---|");
  for (const f of r.failures.slice(0, 30)) {
    const sz = `${Math.round(f.bbox.width)}×${Math.round(f.bbox.height)}`;
    lines.push(`| \`${f.path}\` | \`${f.text}\` | ${sz} | **${f.minSide}** | ${f.required} | ${f.cluster ? "yes" : "no"} |`);
  }
  if (r.failures.length > 30) lines.push(`\n_… ${r.failures.length - 30} more row(s) omitted; the JSON report has all of them._`);
  if (r.failures.length > 30) lines.push(`| _…${r.failures.length - 30} more_ | | | | | |`);
  lines.push("");
  lines.push("## Suggested next step");
  lines.push("");
  lines.push("1. For each failing row, expand the element's bbox to ≥ " +
    `${r.failures[0]!.required}×${r.failures[0]!.required} px. Common fixes:`);
  lines.push("   - Increase `padding`. A 12px padding on an icon-only button " +
    "grows a 16×16 icon to 40×40 reach-bbox.");
  lines.push("   - Set `min-width` / `min-height` explicitly: " +
    `\`min-width: ${r.failures[0]!.required}px; min-height: ${r.failures[0]!.required}px;\`.`);
  lines.push("   - For inline links, wrap them in a block with hit padding " +
    "and use `display: inline-block`.");
  lines.push("2. Re-run `vlmkit check a11y touch`. The failure list should empty out.");
  lines.push("");
  return lines.join("\n");
}

/**
 * CLI entry removed: this module is measurement code now, not a command.
 * `check a11y touch` is declared in `./gates/a11y.gate.ts` and driven by the core runner
 * (`@mizchi/vlmkit-core/plugin/runner.ts`), which owns argument parsing,
 * `--json`, `--advisory`, the run ledger and the exit code.
 */
