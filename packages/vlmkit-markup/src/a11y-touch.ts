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
 *   vrt a11y-touch <html-or-url>
 *   vrt a11y-touch <url> --level AAA   # 44x44 (default)
 *   vrt a11y-touch <url> --level AA    # 24x24
 */
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { basename, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium, type Page } from "playwright";
import { handleCliError } from "@mizchi/vlmkit-core/cli-error.ts";
import { DIM, RESET, GREEN, RED, BOLD, CYAN } from "@mizchi/vlmkit-core/terminal-colors.ts";
import { openSource } from "@mizchi/vlmkit-core/page-open.ts";
import {
  requiredTouchSide,
  touchTargetBelowRequired,
  touchTargetInCluster,
} from "./markup-core-a11y-touch.ts";

export type WcagTouchLevel = "AAA" | "AA";

export interface TouchCheckOptions {
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
 * post-process so the `vrt diff-pr` CI gate can reuse it on its
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

function parseArgs(argv: string[]) {
  let outputDir = "";
  let report = "";
  let level: WcagTouchLevel = "AAA";
  const positional: string[] = [];
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--output-dir") outputDir = argv[++i];
    else if (a === "--report") report = argv[++i];
    else if (a === "--level") {
      const v = argv[++i];
      if (v === "AA" || v === "AAA") level = v;
    } else positional.push(a);
  }
  return { positional, outputDir, report, level };
}

function isUrl(s: string): boolean {
  return /^https?:\/\//.test(s);
}

export async function runA11yTouch(options: TouchCheckOptions): Promise<TouchReport> {
  const outputDir = resolve(options.outputDir);
  await mkdir(outputDir, { recursive: true });
  const viewport = options.viewport ?? { width: 1280, height: 900 };
  const level = options.level ?? "AAA";
  const required = level === "AAA" ? 44 : 24;

  const browser = await chromium.launch();
  let samples: A11yTouchRawSample[];
  let screenshotPath: string;
  try {
    // One load path for files and URLs. The file branch used to
    // `setContent(readFile(...))`, which drops the document's base URL: on
    // fixtures/external-assets that hid the 20x20 tap target entirely (the
    // element gets its size from CSS) while reporting three styled-and-compliant
    // buttons as failures at their unstyled sizes.
    const { page } = await openSource(browser, options.source, { viewport, settleMs: 0 });
    await page.addStyleTag({
      content: `*, *::before, *::after { transition: none !important; animation: none !important; }`,
    });
    samples = await page.evaluate(A11Y_TOUCH_SAMPLE_SCRIPT) as A11yTouchRawSample[];
    screenshotPath = join(outputDir, "page.png");
    await page.screenshot({ path: screenshotPath, fullPage: false });
    await page.close();
  } finally {
    await browser.close();
  }

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
    viewport,
    screenshot: screenshotPath,
    inspectedCount: byPath.size,
    failures: findings,
  });
  await writeFile(reportPath, md);

  console.log(`  ${BOLD}${CYAN}vrt a11y-touch${RESET}`);
  console.log(`  ${DIM}source: ${options.source}  level: WCAG ${level} (${required}×${required} min)${RESET}`);
  console.log(`  ${DIM}inspected ${byPath.size} interactive element(s)${RESET}`);
  const icon = findings.length === 0 ? `${GREEN}✓${RESET}` : `${RED}✗${RESET}`;
  console.log(`  ${icon} ${findings.length} undersized target(s)`);
  for (const f of findings.slice(0, 5)) {
    const cl = f.cluster ? " (clustered)" : "";
    console.log(`    ${DIM}${f.path} — ${Math.round(f.bbox.width)}×${Math.round(f.bbox.height)}${cl} — "${f.text}"${RESET}`);
  }
  console.log(`  ${DIM}report: ${reportPath}${RESET}`);

  return {
    source: options.source, level, viewport, screenshot: screenshotPath,
    inspectedCount: byPath.size, failures: findings, reportPath,
  };
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
  lines.push("2. Re-run `vrt a11y-touch`. The failure list should empty out.");
  lines.push("");
  return lines.join("\n");
}

async function main(argv = process.argv.slice(2)) {
  if (argv[0] === "--help" || argv[0] === "-h") argv = [];
  const { positional, outputDir, report, level } = parseArgs(argv);
  if (positional.length === 0) {
    console.log("Usage: vrt a11y-touch <html-or-url> [--level AAA|AA] [--output-dir dir]");
    console.log("Options:");
    console.log("  --level AAA|AA    WCAG threshold — AAA=44px (default), AA=24px-with-spacing.");
    console.log("  --output-dir <dir> Default: ./test-results/a11y-touch");
    console.log("  --report <path>    Markdown report path");
    process.exit(1);
  }
  await runA11yTouch({
    source: positional[0]!,
    outputDir: outputDir || join(process.cwd(), "test-results", "a11y-touch"),
    reportPath: report || undefined,
    level,
  });
}

const isCliEntry = process.env.__VRT_DISPATCHER_LEAF__ === "a11y-touch" || (process.argv[1] ? resolve(process.argv[1]) === fileURLToPath(import.meta.url) : false);
if (isCliEntry) {
  main().catch(handleCliError);
}
