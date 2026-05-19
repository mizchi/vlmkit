#!/usr/bin/env node
/**
 * Theme parity check.
 *
 * Catches "agent added dark mode but forgot to update some elements"
 * — a class of bug where the page mostly responds to a theme toggle
 * but specific elements keep their light-mode colors (hard-coded fill
 * / text / border that doesn't reference a CSS variable).
 *
 * Approach: render the same HTML once with `prefers-color-scheme:
 * light` and once with `dark`, via Playwright's
 * `page.emulateMedia({ colorScheme })`. Per-component:
 *  - extract dominant fill via per-bbox color sampling
 *  - compare light-render fill ↔ dark-render fill
 *  - flag bboxes where the fill is identical → "unthemed" element
 *
 * No source-code analysis — the signal is purely visual. Works with
 * any styling approach (CSS variables, data-attribute toggles, etc.)
 * as long as the page responds to the standard
 * `prefers-color-scheme` media query.
 *
 * Usage:
 *   vrt theme-parity <html> [--output-dir dir]
 */
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { basename, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { PNG } from "pngjs";
import { chromium } from "playwright";
import { extractComponentsFromFile, type ComponentBbox } from "../component/component-bbox.ts";
import { DIM, RESET, GREEN, RED, YELLOW, BOLD, CYAN } from "@mizchi/vrt-core/terminal-colors.ts";
import { handleCliError } from "@mizchi/vrt-core/cli-error.ts";

export interface ThemeParityOptions {
  htmlPath: string;
  outputDir: string;
  reportPath?: string;
  viewport?: { width: number; height: number };
  /** Per-axis RGB delta threshold below which two colors are "the same". Default 16. */
  unchangedColorThreshold?: number;
}

export interface UnthemedBbox {
  rank: number;
  bbox: { top: number; left: number; width: number; height: number };
  lightFill: { r: number; g: number; b: number; hex: string };
  darkFill: { r: number; g: number; b: number; hex: string };
  /** RGB Euclidean distance between light and dark fill. */
  fillDelta: number;
}

export interface ThemeParityReport {
  html: string;
  viewport: { width: number; height: number };
  lightScreenshot: string;
  darkScreenshot: string;
  /** Pixel diff % between light and dark renders. Low % suggests the page barely responds to the toggle. */
  themePixelDelta: number;
  unthemed: UnthemedBbox[];
  /** All matched bboxes (for transparency). */
  totalMatched: number;
  reportPath: string;
}

function toHex(r: number, g: number, b: number): string {
  const c = (n: number) => n.toString(16).padStart(2, "0");
  return `#${c(r)}${c(g)}${c(b)}`;
}

/** Sample a bbox region's dominant color by averaging pixels (cheap; good enough for solid fills). */
function sampleBboxFill(
  data: Uint8Array,
  width: number,
  bbox: { top: number; left: number; width: number; height: number },
): { r: number; g: number; b: number } {
  // Sample a 5×5 grid inside the bbox, avoid edges (anti-aliasing).
  const inset = 2;
  const x0 = bbox.left + inset, x1 = bbox.left + bbox.width - inset;
  const y0 = bbox.top + inset, y1 = bbox.top + bbox.height - inset;
  if (x1 <= x0 || y1 <= y0) {
    const i = (bbox.top * width + bbox.left) * 4;
    return { r: data[i]!, g: data[i + 1]!, b: data[i + 2]! };
  }
  let r = 0, g = 0, b = 0, n = 0;
  const stepX = Math.max(1, Math.floor((x1 - x0) / 5));
  const stepY = Math.max(1, Math.floor((y1 - y0) / 5));
  for (let y = y0; y < y1; y += stepY) {
    for (let x = x0; x < x1; x += stepX) {
      const i = (y * width + x) * 4;
      r += data[i]!;
      g += data[i + 1]!;
      b += data[i + 2]!;
      n++;
    }
  }
  return { r: Math.round(r / n), g: Math.round(g / n), b: Math.round(b / n) };
}

function dist(a: { r: number; g: number; b: number }, b: { r: number; g: number; b: number }): number {
  const dr = a.r - b.r, dg = a.g - b.g, db = a.b - b.b;
  return Math.sqrt(dr * dr + dg * dg + db * db);
}

function parseArgs(argv: string[]) {
  let outputDir = "";
  let report = "";
  let threshold: number | undefined;
  const positional: string[] = [];
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--output-dir") outputDir = argv[++i];
    else if (a === "--report") report = argv[++i];
    else if (a === "--threshold") threshold = parseFloat(argv[++i] ?? "16");
    else positional.push(a);
  }
  return { positional, outputDir, report, threshold };
}

export async function runThemeParity(
  options: ThemeParityOptions,
): Promise<ThemeParityReport> {
  const outputDir = resolve(options.outputDir);
  await mkdir(outputDir, { recursive: true });
  const htmlPath = resolve(options.htmlPath);
  const html = await readFile(htmlPath, "utf-8");
  const viewport = options.viewport ?? { width: 1280, height: 900 };
  const unchangedThreshold = options.unchangedColorThreshold ?? 16;

  const browser = await chromium.launch();
  try {
    // Light render.
    const lightPage = await browser.newPage({ viewport, colorScheme: "light" });
    await lightPage.setContent(html, { waitUntil: "networkidle" });
    // Disable transitions/animations for deterministic capture (cf.
    // Subagent H dogfood, same root cause as multi-state state diffs).
    await lightPage.addStyleTag({
      content: `*, *::before, *::after {
        transition: none !important;
        animation: none !important;
      }`,
    });
    const lightPath = join(outputDir, "light.png");
    await lightPage.screenshot({ path: lightPath, fullPage: false });
    await lightPage.close();

    // Dark render.
    const darkPage = await browser.newPage({ viewport, colorScheme: "dark" });
    await darkPage.setContent(html, { waitUntil: "networkidle" });
    await darkPage.addStyleTag({
      content: `*, *::before, *::after {
        transition: none !important;
        animation: none !important;
      }`,
    });
    const darkPath = join(outputDir, "dark.png");
    await darkPage.screenshot({ path: darkPath, fullPage: false });
    await darkPage.close();

    // Per-pixel theme delta — how much of the page actually responded.
    const lightPng = PNG.sync.read(await readFile(lightPath));
    const darkPng = PNG.sync.read(await readFile(darkPath));
    let changedPixels = 0;
    const totalPixels = lightPng.width * lightPng.height;
    for (let i = 0; i < lightPng.data.length; i += 4) {
      const d = Math.abs(lightPng.data[i]! - darkPng.data[i]!)
        + Math.abs(lightPng.data[i + 1]! - darkPng.data[i + 1]!)
        + Math.abs(lightPng.data[i + 2]! - darkPng.data[i + 2]!);
      if (d >= 24) changedPixels++;  // ~8/channel — robust to AA
    }
    const themePixelDelta = changedPixels / totalPixels;

    // Bbox-level theme parity: extract components from the light
    // render, then for each, sample its fill from BOTH renders. A
    // component whose fill barely changes is unthemed.
    const lightBboxes = await extractComponentsFromFile(lightPath).catch(() => [] as ComponentBbox[]);
    const unthemed: UnthemedBbox[] = [];
    let totalMatched = 0;
    for (let i = 0; i < lightBboxes.length; i++) {
      const bbox = lightBboxes[i]!;
      totalMatched++;
      const lightFill = sampleBboxFill(lightPng.data, lightPng.width, bbox);
      const darkFill = sampleBboxFill(darkPng.data, darkPng.width, bbox);
      const delta = dist(lightFill, darkFill);
      if (delta < unchangedThreshold) {
        unthemed.push({
          rank: i,
          bbox: { top: bbox.top, left: bbox.left, width: bbox.width, height: bbox.height },
          lightFill: { ...lightFill, hex: toHex(lightFill.r, lightFill.g, lightFill.b) },
          darkFill: { ...darkFill, hex: toHex(darkFill.r, darkFill.g, darkFill.b) },
          fillDelta: delta,
        });
      }
    }

    const reportPath = options.reportPath ?? join(outputDir, "report.md");
    const md = renderReport({
      html: htmlPath,
      viewport,
      lightScreenshot: lightPath,
      darkScreenshot: darkPath,
      themePixelDelta,
      unthemed,
      totalMatched,
    });
    await writeFile(reportPath, md);

    console.log(`  ${BOLD}${CYAN}vrt theme-parity${RESET}`);
    console.log(`  ${DIM}html: ${htmlPath}${RESET}`);
    const pct = (themePixelDelta * 100).toFixed(1);
    const themeIcon = themePixelDelta < 0.02 ? `${YELLOW}!${RESET}` : `${GREEN}✓${RESET}`;
    console.log(`  ${themeIcon} theme pixel delta: ${pct}% (page ${themePixelDelta < 0.02 ? "barely" : "broadly"} responds to color scheme)`);
    const unthemedIcon = unthemed.length === 0 ? `${GREEN}✓${RESET}` : `${RED}✗${RESET}`;
    console.log(`  ${unthemedIcon} unthemed components: ${unthemed.length} of ${totalMatched}`);
    for (const u of unthemed.slice(0, 5)) {
      console.log(`    ${DIM}#${u.rank} ${u.bbox.left},${u.bbox.top} ${u.bbox.width}×${u.bbox.height} fill ${u.lightFill.hex} (Δ ${u.fillDelta.toFixed(1)})${RESET}`);
    }
    console.log(`  ${DIM}report: ${reportPath}${RESET}`);

    return {
      html: htmlPath,
      viewport,
      lightScreenshot: lightPath,
      darkScreenshot: darkPath,
      themePixelDelta,
      unthemed,
      totalMatched,
      reportPath,
    };
  } finally {
    await browser.close();
  }
}

function renderReport(r: Omit<ThemeParityReport, "reportPath">): string {
  const lines: string[] = [];
  lines.push("# Theme parity report");
  lines.push("");
  lines.push(`HTML: \`${r.html}\` at ${r.viewport.width}×${r.viewport.height}`);
  lines.push("");
  const pct = (r.themePixelDelta * 100).toFixed(2);
  lines.push(`**Theme pixel delta**: ${pct}% — fraction of pixels that changed when switching ` +
    `\`prefers-color-scheme\` from \`light\` to \`dark\`.`);
  lines.push("");
  if (r.themePixelDelta < 0.02) {
    lines.push("> The page barely responds to the color-scheme toggle. Either dark-mode " +
      "styles are missing entirely, or the page doesn't use the standard " +
      "`@media (prefers-color-scheme: dark)` query.");
    lines.push("");
  }
  lines.push("- Light: `" + r.lightScreenshot + "`");
  lines.push("- Dark:  `" + r.darkScreenshot + "`");
  lines.push("");
  lines.push("## Unthemed components");
  lines.push("");
  lines.push("Components whose dominant fill is **identical** in light and dark mode " +
    "(distance < 16 RGB units). These elements have hard-coded colors that " +
    "don't reference a theme variable — a classic dark-mode regression.");
  lines.push("");
  if (r.unthemed.length === 0) {
    lines.push("_None — every detected component changed fill between themes._");
  } else {
    lines.push(`Found **${r.unthemed.length}** of ${r.totalMatched} matched components.`);
    lines.push("");
    lines.push("| Rank | Bbox | Light fill | Dark fill | Δ |");
    lines.push("|---|---|---|---|---|");
    for (const u of r.unthemed.slice(0, 10)) {
      const bb = `${u.bbox.left},${u.bbox.top} ${u.bbox.width}×${u.bbox.height}`;
      lines.push(`| #${u.rank} | ${bb} | \`${u.lightFill.hex}\` | \`${u.darkFill.hex}\` | ${u.fillDelta.toFixed(1)} |`);
    }
  }
  lines.push("");
  lines.push("## Suggested next step");
  lines.push("");
  if (r.themePixelDelta < 0.02) {
    lines.push("1. Add `@media (prefers-color-scheme: dark) { ... }` styles or a " +
      "`:root { --bg: ...; }` / `[data-theme='dark']` toggle. Currently no theme " +
      "switching is wired up.");
  } else if (r.unthemed.length > 0) {
    lines.push("1. Open `light.png` and `dark.png` side-by-side. Locate the elements at " +
      "the bboxes listed above — they keep the same fill color across themes.");
    lines.push("2. Replace the hard-coded color values in the CSS for those elements with " +
      "either a `var(--token)` reference, or matching dark-mode overrides via " +
      "`@media (prefers-color-scheme: dark)`.");
    lines.push("3. Re-run `vrt theme-parity`. Unthemed count should drop to 0.");
  } else {
    lines.push("Every detected component changed fill between themes. Page is theme-clean.");
  }
  lines.push("");
  return lines.join("\n");
}

async function main(argv = process.argv.slice(2)) {
  if (argv[0] === "--help" || argv[0] === "-h") argv = [];
  const { positional, outputDir, report, threshold } = parseArgs(argv);
  if (positional.length === 0) {
    console.log("Usage: vrt theme-parity <html> [--output-dir dir]");
    console.log("Options:");
    console.log("  --output-dir <dir>   Default: ./test-results/theme-parity");
    console.log("  --report <path>      Markdown report path");
    console.log("  --threshold <N>      RGB Euclidean distance below which a fill is 'unchanged'. Default 16.");
    process.exit(1);
  }
  await runThemeParity({
    htmlPath: positional[0]!,
    outputDir: outputDir || join(process.cwd(), "test-results", "theme-parity"),
    reportPath: report || undefined,
    unchangedColorThreshold: threshold,
  });
}

const isCliEntry = process.env.__VRT_DISPATCHER_LEAF__ === "theme-parity" || (process.argv[1] ? resolve(process.argv[1]) === fileURLToPath(import.meta.url) : false);
if (isCliEntry) {
  main().catch(handleCliError);
}
