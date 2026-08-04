#!/usr/bin/env node
/**
 * Multi-page consistency check.
 *
 * Use case: design-system enforcement. The footer / nav / pricing
 * card / etc. on every page should render identically. Catches drift
 * like "/pricing footer has 32px padding, /about footer has 24px"
 * — same selector, same expected appearance, divergent rendering.
 *
 * Workflow:
 *   1. Provide N URLs (or HTML files) and a CSS selector for the
 *      element of interest.
 *   2. Tool renders each page, locates the selector, snapshots that
 *      element's bounding box (Playwright `locator.screenshot()`).
 *   3. All snapshots are compared to the *first* one (treated as
 *      reference). Per-page deltas are reported alongside bbox /
 *      palette / heatmap diffs.
 *
 * Unlike migration-compare, this scenario:
 *   - has N sides (1 reference, N-1 candidates) instead of 1:1.
 *   - focuses on a sub-rectangle of the page (the selector match)
 *     rather than the full viewport. Cuts the noise from
 *     surrounding content unique to each page.
 *
 * Usage:
 *   vlmkit check drift pages --selector .footer --urls URL1 URL2 ...
 *   vlmkit check drift pages --selector .footer --files A.html B.html ...
 */
import { readFile, writeFile, mkdir, copyFile } from "node:fs/promises";
import { basename, join, resolve, extname } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium, type Page } from "playwright";
import { compareScreenshots } from "@mizchi/vlmkit-core/heatmap.ts";
import { extractPaletteFromFile } from "../style/palette-extract.ts";
import { diffPalettes, type PaletteDiff } from "../style/palette-diff.ts";
import {
  extractComponentsFromFile,
  matchComponents,
  type MatchedBbox,
} from "../component/component-bbox.ts";
import { findHeatmapRegionsFromFile, type HeatmapRegion } from "@mizchi/vlmkit-core/heatmap-regions.ts";
import type { VrtSnapshot } from "@mizchi/vlmkit-core/types.ts";
import { DIM, RESET, GREEN, RED, YELLOW, BOLD, CYAN } from "@mizchi/vlmkit-core/terminal-colors.ts";
import { handleCliError } from "@mizchi/vlmkit-core/cli-error.ts";

export interface MultiPageConsistencyOptions {
  /** CSS selector identifying the shared component on every page. */
  selector: string;
  /** List of URLs to fetch (one of urls/files must be set). */
  urls?: string[];
  /** List of HTML file paths to load via setContent. */
  files?: string[];
  outputDir: string;
  /** Markdown report path. Default: `${outputDir}/report.md`. */
  reportPath?: string;
  /** Pixel-diff threshold. Default 0.03. */
  threshold?: number;
  /** Viewport for rendering. Default { width: 1280, height: 900 }. */
  viewport?: { width: number; height: number };
}

export interface PageEntry {
  /** Display label — URL or filename. */
  label: string;
  /** Path to the captured element screenshot. */
  screenshotPath: string;
  /** Element bbox in the full page (top/left/width/height). */
  bbox: { x: number; y: number; width: number; height: number };
  /** Whether the selector matched on this page. */
  matched: boolean;
}

export interface PageDelta {
  candidate: string;
  diffPixels: number;
  totalPixels: number;
  diffRatio: number;
  bboxDeltas: { width: number; height: number };
  paletteOnlyInRef: number;
  paletteOnlyInCand: number;
  heatmapRegions: number;
}

export interface MultiPageConsistencyReport {
  selector: string;
  pages: PageEntry[];
  reference: string;
  deltas: PageDelta[];
  reportPath: string;
}

function parseArgs(argv: string[]) {
  const urls: string[] = [];
  const files: string[] = [];
  let selector = "";
  let outputDir = "";
  let report = "";
  let threshold = 0.03;
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--selector") selector = argv[++i];
    else if (a === "--output-dir") outputDir = argv[++i];
    else if (a === "--report") report = argv[++i];
    else if (a === "--threshold") threshold = parseFloat(argv[++i] ?? "0.03");
    else if (a === "--urls") {
      while (i + 1 < argv.length && !argv[i + 1].startsWith("--")) urls.push(argv[++i]);
    } else if (a === "--files") {
      while (i + 1 < argv.length && !argv[i + 1].startsWith("--")) files.push(argv[++i]);
    }
  }
  return { selector, urls, files, outputDir, report, threshold };
}

async function captureElement(
  page: Page,
  selector: string,
  outputPath: string,
): Promise<{ bbox: PageEntry["bbox"]; matched: boolean }> {
  const locator = page.locator(selector).first();
  const count = await locator.count();
  if (count === 0) return { bbox: { x: 0, y: 0, width: 0, height: 0 }, matched: false };
  const box = await locator.boundingBox();
  if (!box) return { bbox: { x: 0, y: 0, width: 0, height: 0 }, matched: false };
  await locator.screenshot({ path: outputPath });
  return { bbox: box, matched: true };
}

export async function runMultiPageConsistency(
  options: MultiPageConsistencyOptions,
): Promise<MultiPageConsistencyReport> {
  if (!options.selector) {
    throw new Error("--selector is required");
  }
  const urls = options.urls ?? [];
  const files = (options.files ?? []).map((f) => resolve(f));
  if (urls.length + files.length < 2) {
    throw new Error("at least two --urls or --files are required");
  }
  const outputDir = resolve(options.outputDir);
  await mkdir(outputDir, { recursive: true });
  const viewport = options.viewport ?? { width: 1280, height: 900 };

  const browser = await chromium.launch();
  const pages: PageEntry[] = [];
  try {
    let idx = 0;
    for (const url of urls) {
      const page = await browser.newPage({ viewport });
      await page.goto(url, { waitUntil: "networkidle", timeout: 30000 });
      const label = url;
      const safeLabel = `page-${idx++}-${basename(url).replace(/[^a-z0-9.-]+/gi, "_") || "root"}`;
      const screenshotPath = join(outputDir, `${safeLabel}.png`);
      const { bbox, matched } = await captureElement(page, options.selector, screenshotPath);
      await page.close();
      pages.push({ label, screenshotPath, bbox, matched });
    }
    for (const file of files) {
      const page = await browser.newPage({ viewport });
      const html = await readFile(file, "utf-8");
      await page.setContent(html, { waitUntil: "networkidle" });
      const label = basename(file);
      const safeLabel = `page-${idx++}-${label.replace(/[^a-z0-9.-]+/gi, "_")}`;
      const screenshotPath = join(outputDir, `${safeLabel}.png`);
      const { bbox, matched } = await captureElement(page, options.selector, screenshotPath);
      await page.close();
      pages.push({ label, screenshotPath, bbox, matched });
    }
  } finally {
    await browser.close();
  }

  if (pages.length === 0 || !pages[0]!.matched) {
    throw new Error(`Selector \`${options.selector}\` did not match on the reference page (${pages[0]?.label ?? "<none>"})`);
  }

  const reference = pages[0]!;
  const deltas: PageDelta[] = [];
  for (let i = 1; i < pages.length; i++) {
    const cand = pages[i]!;
    if (!cand.matched) {
      deltas.push({
        candidate: cand.label,
        diffPixels: 0,
        totalPixels: 0,
        diffRatio: NaN,
        bboxDeltas: { width: 0, height: 0 },
        paletteOnlyInRef: 0,
        paletteOnlyInCand: 0,
        heatmapRegions: 0,
      });
      continue;
    }

    // Pad-or-crop the smaller image is messy; use compareScreenshots'
    // built-in resize handling.
    const snap: VrtSnapshot = {
      testId: `consistency-${i}`,
      testTitle: `${cand.label} vs ${reference.label}`,
      projectName: "multi-page-consistency",
      screenshotPath: cand.screenshotPath,
      baselinePath: reference.screenshotPath,
      status: "changed",
    };
    const diff = await compareScreenshots(snap, {
      outputDir,
      threshold: options.threshold ?? 0.03,
    });
    const diffPixels = diff?.diffPixels ?? 0;
    const totalPixels = diff?.totalPixels ?? 0;
    const diffRatio = diff?.diffRatio ?? 0;

    const [refPalette, candPalette] = await Promise.all([
      extractPaletteFromFile(reference.screenshotPath).catch(() => []),
      extractPaletteFromFile(cand.screenshotPath).catch(() => []),
    ]);
    const paletteDiff = diffPalettes(refPalette, candPalette);

    const [refBboxes, candBboxes] = await Promise.all([
      extractComponentsFromFile(reference.screenshotPath).catch(() => []),
      extractComponentsFromFile(cand.screenshotPath).catch(() => []),
    ]);
    const bboxMatches = matchComponents(refBboxes, candBboxes);
    const topBbox = bboxMatches[0];

    let heatmapRegions: HeatmapRegion[] = [];
    const heatmapPath = join(outputDir, `consistency-${i}_heatmap.png`);
    try {
      heatmapRegions = await findHeatmapRegionsFromFile(heatmapPath);
    } catch {
      // No heatmap (zero-diff or skipped).
    }

    // Use the *page-level* bbox delta (size of the selector match in
    // the live DOM), not the matchComponents bbox delta on the cropped
    // images — the latter is always near-zero because both crops were
    // taken at the element's own boundingBox, so the cropped images
    // are roughly the same dimensions even when the underlying element
    // sizes differ wildly.
    deltas.push({
      candidate: cand.label,
      diffPixels,
      totalPixels,
      diffRatio,
      bboxDeltas: {
        width: Math.round(cand.bbox.width - reference.bbox.width),
        height: Math.round(cand.bbox.height - reference.bbox.height),
      },
      paletteOnlyInRef: paletteDiff.onlyInBaseline.length,
      paletteOnlyInCand: paletteDiff.onlyInVariant.length,
      heatmapRegions: heatmapRegions.length,
    });
  }

  const reportPath = options.reportPath ?? join(outputDir, "report.md");
  const md = renderReport(options.selector, reference, pages, deltas);
  await writeFile(reportPath, md);

  // Console summary.
  console.log(`  ${BOLD}${CYAN}vlmkit check drift pages${RESET}`);
  console.log(`  ${DIM}selector: ${options.selector}${RESET}`);
  console.log(`  ${DIM}reference: ${reference.label}${RESET}`);
  for (const d of deltas) {
    const pct = Number.isNaN(d.diffRatio) ? "n/a" : (d.diffRatio * 100).toFixed(2) + "%";
    const icon = Number.isNaN(d.diffRatio)
      ? `${YELLOW}!${RESET}`
      : d.diffRatio === 0 ? `${GREEN}✓${RESET}` : d.diffRatio < 0.01 ? `${YELLOW}~${RESET}` : `${RED}✗${RESET}`;
    console.log(`  ${icon} ${d.candidate.padEnd(40)} ${pct}`);
  }
  console.log(`  ${DIM}report: ${reportPath}${RESET}`);

  return { selector: options.selector, pages, reference: reference.label, deltas, reportPath };
}

function renderReport(selector: string, reference: PageEntry, pages: PageEntry[], deltas: PageDelta[]): string {
  const lines: string[] = [];
  lines.push("# Multi-page consistency report");
  lines.push("");
  lines.push(`Selector: \`${selector}\``);
  lines.push(`Reference: \`${reference.label}\`  (bbox ${reference.bbox.width}×${reference.bbox.height} at ${reference.bbox.x},${reference.bbox.y})`);
  lines.push("");
  lines.push("Each candidate page's element is compared to the reference's. " +
    "When the same selector renders differently on different pages, the " +
    "design system is drifting — usually a per-page CSS override or a " +
    "scoped style that escaped its boundary.");
  lines.push("");
  lines.push("## Drift summary");
  lines.push("");
  lines.push("| Candidate | Pixel diff | Δ W / H | Missing palette | Extra palette | Heatmap clusters |");
  lines.push("|---|---|---|---|---|---|");
  for (const d of deltas) {
    const pct = Number.isNaN(d.diffRatio) ? "_(selector missing)_" : (d.diffRatio * 100).toFixed(2) + "%";
    const wh = `${d.bboxDeltas.width > 0 ? "+" : ""}${d.bboxDeltas.width} / ${d.bboxDeltas.height > 0 ? "+" : ""}${d.bboxDeltas.height}`;
    lines.push(`| \`${d.candidate}\` | ${pct} | ${wh} | ${d.paletteOnlyInRef} | ${d.paletteOnlyInCand} | ${d.heatmapRegions} |`);
  }
  lines.push("");
  lines.push("## Captured screenshots");
  lines.push("");
  for (const p of pages) {
    const status = p.matched
      ? `${p.bbox.width}×${p.bbox.height} at ${p.bbox.x},${p.bbox.y}`
      : "**selector did not match**";
    lines.push(`- \`${p.label}\` — ${status} — \`${p.screenshotPath}\``);
  }
  lines.push("");
  lines.push("## Suggested next step");
  lines.push("");
  lines.push("1. For each candidate with non-zero diff, open its screenshot next to " +
    "the reference and identify the visible delta (color, spacing, sizing).");
  lines.push("2. Check whether the candidate page has a CSS override scoped to it " +
    "(e.g., `body.pricing .footer { … }`) that the other pages don't share.");
  lines.push("3. Move shared component styles up to a global stylesheet, or " +
    "promote the component to a shared partial / framework component so all " +
    "pages render identically.");
  lines.push("");
  return lines.join("\n");
}

async function main(argv = process.argv.slice(2)) {
  if (argv[0] === "--help" || argv[0] === "-h") argv = [];
  const { selector, urls, files, outputDir, report, threshold } = parseArgs(argv);
  if (!selector || (urls.length === 0 && files.length === 0)) {
    console.log("Usage: vlmkit check drift pages --selector <sel> --urls URL1 URL2 ...");
    console.log("       vlmkit check drift pages --selector <sel> --files A.html B.html ...");
    console.log("Options:");
    console.log("  --output-dir <dir>       Output directory (default: ./test-results/consistency)");
    console.log("  --report <path>          Markdown report path");
    console.log("  --threshold <0..1>       Pixel diff threshold (default: 0.03)");
    process.exit(1);
  }
  await runMultiPageConsistency({
    selector,
    urls: urls.length > 0 ? urls : undefined,
    files: files.length > 0 ? files : undefined,
    outputDir: outputDir || join(process.cwd(), "test-results", "consistency"),
    reportPath: report || undefined,
    threshold,
  });
}

const isCliEntry = process.env.__VLMKIT_DISPATCHER_LEAF__ === "multi-page-consistency" || (process.argv[1] ? resolve(process.argv[1]) === fileURLToPath(import.meta.url) : false);
if (isCliEntry) {
  main().catch(handleCliError);
}
