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
import { type Page } from "playwright";
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
import { UsageError } from "@mizchi/vlmkit-core/cli-error.ts";
import { withBrowser } from "@mizchi/vlmkit-core/browser-launch.ts";

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
    throw new UsageError("--selector is required");
  }
  const urls = options.urls ?? [];
  const files = (options.files ?? []).map((f) => resolve(f));
  if (urls.length + files.length < 2) {
    throw new UsageError("at least two --urls or --files are required");
  }
  const outputDir = resolve(options.outputDir);
  await mkdir(outputDir, { recursive: true });
  const viewport = options.viewport ?? { width: 1280, height: 900 };

  const pages: PageEntry[] = [];
  await withBrowser(async (browser) => {
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
  });

  if (pages.length === 0 || !pages[0]!.matched) {
    throw new UsageError(`Selector \`${options.selector}\` did not match on the reference page (${pages[0]?.label ?? "<none>"})`);
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

  return { selector: options.selector, pages, reference: reference.label, deltas, reportPath };
}

/**
 * Terminal summary, extracted from the measurement function. A gate's `run`
 * must not print — the core runner owns output and decides between prose and
 * `--json`.
 */
export function formatMultiPageConsistencyReport(report: MultiPageConsistencyReport): string {
  const lines: string[] = [];
  lines.push(`  ${BOLD}${CYAN}vlmkit check drift pages${RESET}`);
  lines.push(`  ${DIM}selector: ${report.selector}${RESET}`);
  lines.push(`  ${DIM}reference: ${report.reference}${RESET}`);
  for (const d of report.deltas) {
    const pct = Number.isNaN(d.diffRatio) ? "n/a" : (d.diffRatio * 100).toFixed(2) + "%";
    const icon = Number.isNaN(d.diffRatio)
      ? `${YELLOW}!${RESET}`
      : d.diffRatio === 0 ? `${GREEN}✓${RESET}` : d.diffRatio < 0.01 ? `${YELLOW}~${RESET}` : `${RED}✗${RESET}`;
    lines.push(`  ${icon} ${d.candidate.padEnd(40)} ${pct}`);
  }
  lines.push(`  ${DIM}report: ${report.reportPath}${RESET}`);
  return lines.join("\n");
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

/**
 * CLI entry removed: this module is measurement code now, not a command.
 * `check drift pages` is declared in `../gates/drift.gate.ts` and driven by the core runner
 * (`@mizchi/vlmkit-core/plugin/runner.ts`), which owns argument parsing,
 * `--json`, `--advisory`, the run ledger and the exit code.
 */
