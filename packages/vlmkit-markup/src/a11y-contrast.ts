#!/usr/bin/env node
/**
 * Accessibility / WCAG contrast check.
 *
 * Use case: agent writes new HTML/CSS, doesn't notice that the muted
 * `color: #9ca3af` on `background: #ffffff` only hits 2.9:1 contrast
 * — below WCAG AA's 4.5:1 for body text. Tool scans every visible
 * text-bearing element, computes its actual text-vs-background
 * contrast ratio via WCAG formula, and reports failures.
 *
 * Implementation:
 *   1. Playwright renders the HTML.
 *   2. In-browser script walks visible text nodes, reads
 *      `getComputedStyle(el).color` for foreground and walks up the
 *      ancestor chain for the first non-transparent background.
 *      Returns text + colors + font size + bbox.
 *   3. Compute WCAG luminance + contrast ratio. Flag elements below
 *      4.5:1 (or 3.0:1 for "large text" ≥ 18px or ≥ 14px-bold).
 *
 * Unlike axe-core / pa11y which require a DOM-aware semantic scan,
 * this is purely visual — works on any page that renders text.
 *
 * Usage:
 *   vrt a11y-contrast <html>
 */
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";
import { DIM, RESET, GREEN, RED, YELLOW, BOLD, CYAN } from "@mizchi/vlmkit-core/terminal-colors.ts";
import { handleCliError } from "@mizchi/vlmkit-core/cli-error.ts";
import { evaluateA11yContrast } from "./markup-core-a11y-contrast.ts";

export interface A11yContrastOptions {
  htmlPath: string;
  outputDir: string;
  reportPath?: string;
  viewport?: { width: number; height: number };
  /** Min text length to bother analyzing. Default 1. */
  minTextLength?: number;
}

export type WcagLevel = "AAA" | "AA" | "AA-large" | "fail";

export interface ContrastFinding {
  path: string;
  tag: string;
  text: string;
  fontSize: number;
  fontWeight: number;
  bbox: { x: number; y: number; width: number; height: number };
  foreground: { r: number; g: number; b: number; hex: string };
  background: { r: number; g: number; b: number; hex: string };
  /** Computed WCAG contrast ratio (1 = identical, 21 = max black/white). */
  ratio: number;
  /** Required threshold based on font size/weight. 4.5 for normal text, 3.0 for large. */
  requiredAA: number;
  level: WcagLevel;
}

export interface A11yContrastReport {
  html: string;
  viewport: { width: number; height: number };
  screenshot: string;
  totalText: number;
  failures: ContrastFinding[];
  reportPath: string;
}

export const A11Y_CONTRAST_SAMPLE_SCRIPT = `
(function a11ySample(minLen) {
  function parseColor(s) {
    if (!s) return null;
    const m = s.match(/rgba?\\(([^)]+)\\)/);
    if (!m) return null;
    const parts = m[1].split(",").map((x) => parseFloat(x.trim()));
    const r = parts[0], g = parts[1], b = parts[2], a = parts.length >= 4 ? parts[3] : 1;
    return { r: r|0, g: g|0, b: b|0, a };
  }
  function effectiveBg(el) {
    let cur = el;
    while (cur && cur !== document.documentElement) {
      const cs = getComputedStyle(cur);
      const c = parseColor(cs.backgroundColor);
      if (c && c.a >= 0.5) return c;
      cur = cur.parentElement;
    }
    // Fallback to html background or white.
    const htmlBg = parseColor(getComputedStyle(document.documentElement).backgroundColor);
    if (htmlBg && htmlBg.a >= 0.5) return htmlBg;
    return { r: 255, g: 255, b: 255, a: 1 };
  }
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
  const out = [];
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  let node;
  while ((node = walker.nextNode())) {
    const text = (node.nodeValue || "").trim();
    if (text.length < minLen) continue;
    const el = node.parentElement;
    if (!el) continue;
    if (el.tagName === "SCRIPT" || el.tagName === "STYLE" || el.tagName === "NOSCRIPT") continue;
    const cs = getComputedStyle(el);
    if (cs.visibility === "hidden" || cs.display === "none" || parseFloat(cs.opacity) < 0.5) continue;
    const r = el.getBoundingClientRect();
    if (r.width < 1 || r.height < 1) continue;
    const fg = parseColor(cs.color);
    if (!fg) continue;
    const bg = effectiveBg(el);
    const fontSize = parseFloat(cs.fontSize) || 16;
    const fontWeight = parseInt(cs.fontWeight, 10) || 400;
    out.push({
      path: shortPath(el),
      tag: el.tagName.toLowerCase(),
      text: text.slice(0, 60),
      fontSize, fontWeight,
      bbox: { x: r.x, y: r.y, width: r.width, height: r.height },
      foreground: { r: fg.r, g: fg.g, b: fg.b },
      background: { r: bg.r, g: bg.g, b: bg.b },
    });
    if (out.length > 500) break;
  }
  return out;
})
`;

export interface A11yContrastRawSample {
  path: string;
  tag: string;
  text: string;
  fontSize: number;
  fontWeight: number;
  bbox: { x: number; y: number; width: number; height: number };
  foreground: { r: number; g: number; b: number };
  background: { r: number; g: number; b: number };
}

function toHex(c: { r: number; g: number; b: number }): string {
  const h = (n: number) => n.toString(16).padStart(2, "0");
  return `#${h(c.r)}${h(c.g)}${h(c.b)}`;
}

/**
 * Build the list of contrast failures from raw samples (post-process
 * step extracted from `runA11yContrast`). Pure — no I/O — so it can
 * be invoked over Playwright pages owned by other modules (e.g. the
 * `vrt diff-pr` CI gate calls this without spinning up a second
 * browser instance per route).
 */
export function analyzeA11yContrastSamples(samples: A11yContrastRawSample[]): ContrastFinding[] {
  const byPath = new Map<string, A11yContrastRawSample>();
  for (const s of samples) if (!byPath.has(s.path)) byPath.set(s.path, s);
  const findings: ContrastFinding[] = [];
  for (const s of byPath.values()) {
    const evaluation = evaluateA11yContrast({
      foreground: s.foreground,
      background: s.background,
      fontSize: s.fontSize,
      fontWeight: s.fontWeight,
    });
    if (evaluation.level !== "fail") continue;
    findings.push({
      path: s.path,
      tag: s.tag,
      text: s.text,
      fontSize: s.fontSize,
      fontWeight: s.fontWeight,
      bbox: s.bbox,
      foreground: { ...s.foreground, hex: toHex(s.foreground) },
      background: { ...s.background, hex: toHex(s.background) },
      ratio: evaluation.ratio,
      requiredAA: evaluation.requiredAA,
      level: evaluation.level,
    });
  }
  findings.sort((a, b) => a.ratio - b.ratio);
  return findings;
}

function parseArgs(argv: string[]) {
  let outputDir = "";
  let report = "";
  const positional: string[] = [];
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--output-dir") outputDir = argv[++i];
    else if (a === "--report") report = argv[++i];
    else positional.push(a);
  }
  return { positional, outputDir, report };
}

export async function runA11yContrast(
  options: A11yContrastOptions,
): Promise<A11yContrastReport> {
  const outputDir = resolve(options.outputDir);
  await mkdir(outputDir, { recursive: true });
  const htmlPath = resolve(options.htmlPath);
  const html = await readFile(htmlPath, "utf-8");
  const viewport = options.viewport ?? { width: 1280, height: 900 };
  const minLen = options.minTextLength ?? 1;

  const browser = await chromium.launch();
  let samples: A11yContrastRawSample[];
  let screenshotPath: string;
  try {
    const page = await browser.newPage({ viewport });
    await page.setContent(html, { waitUntil: "networkidle" });
    await page.addStyleTag({
      content: `*, *::before, *::after { transition: none !important; animation: none !important; }`,
    });
    samples = await page.evaluate(`(${A11Y_CONTRAST_SAMPLE_SCRIPT})(${minLen})`) as A11yContrastRawSample[];
    screenshotPath = join(outputDir, "page.png");
    await page.screenshot({ path: screenshotPath, fullPage: false });
    await page.close();
  } finally {
    await browser.close();
  }

  // Dedupe by path — many text nodes from the same element produce
  // identical findings.
  const byPath = new Map<string, A11yContrastRawSample>();
  for (const s of samples) {
    if (!byPath.has(s.path)) byPath.set(s.path, s);
  }

  const findings: ContrastFinding[] = [];
  for (const s of byPath.values()) {
    const evaluation = evaluateA11yContrast({
      foreground: s.foreground,
      background: s.background,
      fontSize: s.fontSize,
      fontWeight: s.fontWeight,
    });
    if (evaluation.level !== "fail") continue;
    findings.push({
      path: s.path,
      tag: s.tag,
      text: s.text,
      fontSize: s.fontSize,
      fontWeight: s.fontWeight,
      bbox: s.bbox,
      foreground: { ...s.foreground, hex: toHex(s.foreground) },
      background: { ...s.background, hex: toHex(s.background) },
      ratio: evaluation.ratio,
      requiredAA: evaluation.requiredAA,
      level: evaluation.level,
    });
  }
  findings.sort((a, b) => a.ratio - b.ratio);  // worst first

  const reportPath = options.reportPath ?? join(outputDir, "report.md");
  const md = renderReport({
    html: htmlPath,
    viewport,
    screenshot: screenshotPath,
    totalText: byPath.size,
    failures: findings,
  });
  await writeFile(reportPath, md);

  console.log(`  ${BOLD}${CYAN}vrt a11y-contrast${RESET}`);
  console.log(`  ${DIM}html: ${htmlPath}${RESET}`);
  console.log(`  ${DIM}inspected ${byPath.size} text-bearing element(s)${RESET}`);
  const icon = findings.length === 0 ? `${GREEN}✓${RESET}` : `${RED}✗${RESET}`;
  console.log(`  ${icon} ${findings.length} contrast failure(s)`);
  for (const f of findings.slice(0, 5)) {
    console.log(`    ${DIM}${f.path} — ${f.ratio.toFixed(2)}:1 (need ${f.requiredAA}) — \`${f.foreground.hex}\` on \`${f.background.hex}\` — "${f.text}"${RESET}`);
  }
  console.log(`  ${DIM}report: ${reportPath}${RESET}`);

  return {
    html: htmlPath,
    viewport,
    screenshot: screenshotPath,
    totalText: byPath.size,
    failures: findings,
    reportPath,
  };
}

function renderReport(r: Omit<A11yContrastReport, "reportPath">): string {
  const lines: string[] = [];
  lines.push("# A11y contrast report");
  lines.push("");
  lines.push(`HTML: \`${r.html}\``);
  lines.push("");
  lines.push(`Inspected **${r.totalText}** unique text-bearing elements. ` +
    `Screenshot: \`${r.screenshot}\`.`);
  lines.push("");
  if (r.failures.length === 0) {
    lines.push("## All text passes WCAG AA contrast");
    lines.push("");
    lines.push("Every visible text element has a contrast ratio ≥ 4.5:1 (or ≥ 3:1 for " +
      "large text, defined as ≥ 18px regular or ≥ 14px bold).");
  } else {
    lines.push(`## ${r.failures.length} contrast failure(s)`);
    lines.push("");
    lines.push("WCAG 2.1 AA requires ≥ 4.5:1 contrast for normal text and ≥ 3:1 for " +
      "large text (≥ 18px regular, or ≥ 14px bold). Ratios below these thresholds " +
      "make text hard to read for users with low vision.");
    lines.push("");
    lines.push("| Element | Text (truncated) | Foreground | Background | Ratio | Need |");
    lines.push("|---|---|---|---|---|---|");
    for (const f of r.failures.slice(0, 20)) {
      const fgSwatch = `\`${f.foreground.hex}\``;
      const bgSwatch = `\`${f.background.hex}\``;
      lines.push(`| \`${f.path}\` (${f.fontSize.toFixed(0)}px${f.fontWeight >= 600 ? " b" : ""}) | \`${f.text}\` | ${fgSwatch} | ${bgSwatch} | **${f.ratio}:1** | ${f.requiredAA}:1 |`);
    }
    if (r.failures.length > 20) {
      lines.push(`| _…${r.failures.length - 20} more_ | | | | | |`);
    }
  }
  lines.push("");
  lines.push("## Suggested next step");
  lines.push("");
  if (r.failures.length === 0) {
    lines.push("Page is WCAG AA contrast-clean. Consider running with `--strict` to also " +
      "check AAA (7:1 normal, 4.5:1 large) when supporting low-vision users.");
  } else {
    lines.push("For each failing row:");
    lines.push("1. Increase contrast by darkening the foreground or lightening the background " +
      "until the ratio crosses 4.5:1 (or 3:1 for large text).");
    lines.push("2. Use a contrast-ratio calculator to find specific hex values — every step " +
      "toward black/white on a light/dark bg adds ratio.");
    lines.push("3. Common fix: muted-gray-on-white text (e.g. `#9ca3af` on `#ffffff` = 2.85:1) " +
      "→ try `#6b7280` (4.69:1) or darker.");
    lines.push("4. Re-run `vrt a11y-contrast`. Failures should clear.");
  }
  lines.push("");
  return lines.join("\n");
}

async function main(argv = process.argv.slice(2)) {
  if (argv[0] === "--help" || argv[0] === "-h") argv = [];
  const { positional, outputDir, report } = parseArgs(argv);
  if (positional.length === 0) {
    console.log("Usage: vrt a11y-contrast <html> [--output-dir dir]");
    console.log("Options:");
    console.log("  --output-dir <dir>   Default: ./test-results/a11y-contrast");
    console.log("  --report <path>      Markdown report path");
    process.exit(1);
  }
  await runA11yContrast({
    htmlPath: positional[0]!,
    outputDir: outputDir || join(process.cwd(), "test-results", "a11y-contrast"),
    reportPath: report || undefined,
  });
}

const isCliEntry = process.env.__VRT_DISPATCHER_LEAF__ === "a11y-contrast" || (process.argv[1] ? resolve(process.argv[1]) === fileURLToPath(import.meta.url) : false);
if (isCliEntry) {
  main().catch(handleCliError);
}
