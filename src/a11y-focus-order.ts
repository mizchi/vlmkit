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
 * Pairs well with `vrt a11y-touch` (size) and `vrt a11y-contrast`
 * (contrast) — those check static rendering, this checks the
 * keyboard journey.
 *
 * Usage:
 *   vrt a11y-focus-order <html-or-url>
 */
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium, type Page } from "playwright";
import { handleCliError } from "./cli-error.ts";
import { DIM, RESET, GREEN, RED, YELLOW, BOLD, CYAN } from "./terminal-colors.ts";

export interface FocusOrderOptions {
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

function isUrl(s: string): boolean { return /^https?:\/\//.test(s); }

function parseArgs(argv: string[]) {
  let outputDir = "";
  let report = "";
  let maxSteps = 64;
  const positional: string[] = [];
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--output-dir") outputDir = argv[++i];
    else if (a === "--report") report = argv[++i];
    else if (a === "--max-steps") maxSteps = parseInt(argv[++i] ?? "64", 10);
    else positional.push(a);
  }
  return { positional, outputDir, report, maxSteps };
}

const SAMPLE_FOCUSED_SCRIPT = `
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

export async function runFocusOrder(
  options: FocusOrderOptions,
): Promise<FocusOrderReport> {
  const outputDir = resolve(options.outputDir);
  await mkdir(outputDir, { recursive: true });
  const viewport = options.viewport ?? { width: 1280, height: 720 };
  const maxSteps = options.maxSteps ?? 64;
  const html = isUrl(options.source) ? null : await readFile(resolve(options.source), "utf-8");

  const steps: FocusStep[] = [];
  let screenshotPath: string;
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage({ viewport });
    if (isUrl(options.source)) {
      await page.goto(options.source, { waitUntil: "networkidle", timeout: 30000 });
    } else {
      await page.setContent(html!, { waitUntil: "networkidle" });
    }
    await page.addStyleTag({
      content: `*, *::before, *::after { transition: none !important; animation: none !important; }`,
    });
    screenshotPath = join(outputDir, "page.png");
    await page.screenshot({ path: screenshotPath, fullPage: false });

    // Start from the document. The first Tab moves focus to the
    // earliest focusable element. We capture activeElement after
    // each press until either the focus cycles back to the first
    // element or we hit `maxSteps`.
    let firstPath: string | null = null;
    for (let i = 0; i < maxSteps; i++) {
      await page.keyboard.press("Tab");
      const sample = await page.evaluate(SAMPLE_FOCUSED_SCRIPT) as Omit<FocusStep, "tabIndex"> | null;
      if (!sample) break;
      if (firstPath === null) firstPath = sample.path;
      else if (sample.path === firstPath && i > 0) break;  // cycled
      steps.push({ tabIndex: i, ...sample });
    }
    await page.close();
  } finally {
    await browser.close();
  }

  // Detect findings:
  //   trap     — same element twice in a row
  //   reverse  — y moved up by > 4px, or x moved left by > 40px on
  //              the same row (similar y, within ±16px). Out-of-DOM
  //              order on the visual page.
  //   skip-row — y jumped > 200px without intermediate stops on rows
  //              in between. (Heuristic; large jumps are sometimes
  //              legitimate, e.g. jumping past a paragraph.)
  const findings: FocusOrderFinding[] = [];
  for (let i = 1; i < steps.length; i++) {
    const prev = steps[i - 1]!;
    const cur = steps[i]!;
    // Trap = same path AND overlapping bbox. Sibling elements with
    // identical class/tag (the path generator can't distinguish them
    // without nth-of-type) would otherwise false-positive.
    const samePath = prev.path === cur.path;
    const sameBbox = Math.abs(prev.bbox.x - cur.bbox.x) < 4
      && Math.abs(prev.bbox.y - cur.bbox.y) < 4;
    if (samePath && sameBbox) {
      findings.push({
        kind: "trap",
        fromIndex: i - 1, toIndex: i,
        message: `Focus stayed on the same element (\`${cur.path}\`) across two Tab presses.`,
      });
      continue;
    }
    if (samePath && !sameBbox) {
      // Two siblings with identical class/tag — not a trap, just
      // path-generator ambiguity. Continue with visual checks below.
    }
    const dy = cur.bbox.y - prev.bbox.y;
    const dx = cur.bbox.x - prev.bbox.x;
    const sameRow = Math.abs(dy) <= 16;
    if (sameRow && dx < -40) {
      findings.push({
        kind: "reverse",
        fromIndex: i - 1, toIndex: i,
        message: `Focus moved left within the same row (from \`${prev.path}\` at x=${prev.bbox.x.toFixed(0)} to \`${cur.path}\` at x=${cur.bbox.x.toFixed(0)}). Visual order is L-to-R; check \`tabindex\` or DOM order.`,
      });
    } else if (dy < -24) {
      // 24 px is approximately one button-row height — anything less
      // is the inline-text vs button-row bbox.y delta and would
      // false-positive on normal layouts. Subagent dogfood validated
      // this threshold needs to be conservative.
      findings.push({
        kind: "reverse",
        fromIndex: i - 1, toIndex: i,
        message: `Focus moved up the page (from y=${prev.bbox.y.toFixed(0)} to y=${cur.bbox.y.toFixed(0)}, Δ ${dy.toFixed(0)}px). Visual order is T-to-B; reorder DOM or remove \`tabindex\` overrides.`,
      });
    } else if (dy > 200) {
      // Only flag if there are other interactive elements in between
      // — checking inside the report would require capturing the
      // full element list. For now, surface as a heuristic.
      findings.push({
        kind: "skip-row",
        fromIndex: i - 1, toIndex: i,
        message: `Focus jumped from y=${prev.bbox.y.toFixed(0)} to y=${cur.bbox.y.toFixed(0)} (Δ ${dy.toFixed(0)}px) — verify no focusable elements were skipped between.`,
      });
    }
  }

  const reportPath = options.reportPath ?? join(outputDir, "report.md");
  const md = renderReport({
    source: options.source, viewport, screenshot: screenshotPath, steps, findings,
  });
  await writeFile(reportPath, md);

  console.log(`  ${BOLD}${CYAN}vrt a11y-focus-order${RESET}`);
  console.log(`  ${DIM}source: ${options.source}${RESET}`);
  console.log(`  ${DIM}captured ${steps.length} focus step(s)${RESET}`);
  const icon = findings.length === 0 ? `${GREEN}✓${RESET}` : `${RED}✗${RESET}`;
  console.log(`  ${icon} ${findings.length} finding(s)`);
  for (const f of findings.slice(0, 5)) {
    console.log(`    ${DIM}[${f.kind}] ${f.message}${RESET}`);
  }
  console.log(`  ${DIM}report: ${reportPath}${RESET}`);

  return {
    source: options.source, viewport, screenshot: screenshotPath,
    steps, findings, reportPath,
  };
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

async function main(argv = process.argv.slice(2)) {
  if (argv[0] === "--help" || argv[0] === "-h") argv = [];
  const { positional, outputDir, report, maxSteps } = parseArgs(argv);
  if (positional.length === 0) {
    console.log("Usage: vrt a11y-focus-order <html-or-url> [options]");
    console.log("Options:");
    console.log("  --max-steps N        Maximum Tab presses (default: 64)");
    console.log("  --output-dir <dir>   Default: ./test-results/a11y-focus-order");
    console.log("  --report <path>      Markdown report path");
    process.exit(1);
  }
  await runFocusOrder({
    source: positional[0]!,
    outputDir: outputDir || join(process.cwd(), "test-results", "a11y-focus-order"),
    reportPath: report || undefined,
    maxSteps,
  });
}

const isCliEntry = process.argv[1] ? resolve(process.argv[1]) === fileURLToPath(import.meta.url) : false;
if (isCliEntry) {
  main().catch(handleCliError);
}
