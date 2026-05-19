#!/usr/bin/env node
/**
 * Inline → componentized refactor verifier.
 *
 * Use case: agent extracts an inline `<div class="card">…</div>`
 * into a shared `<Card />` component (React / Vue / Svelte / a
 * partial). On a page with N call sites, the agent intends every
 * `.card` to render identically. Bug class: they converted 4 of 5
 * instances; the 5th is still inline and has drifted (different
 * padding, missing border, etc.). A single-page VRT misses this
 * because the page diff is zero before vs after the refactor.
 *
 * Approach: capture every `--selector` match on the page via
 * Playwright `locator.screenshot()`, compare each instance against
 * the first one (the reference). Drift surfaces as pixel diff %.
 *
 * This is the single-page-multi-instance sibling of
 * `multi-page-consistency.ts` (which is one-match-per-page across
 * multiple pages).
 *
 * Usage:
 *   vrt component-consistency <html> --selector .card
 */
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { basename, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";
import { compareScreenshots } from "@mizchi/vlmkit-core/heatmap.ts";
import { extractPaletteFromFile } from "../style/palette-extract.ts";
import { diffPalettes } from "../style/palette-diff.ts";
import type { VrtSnapshot } from "@mizchi/vlmkit-core/types.ts";
import { DIM, RESET, GREEN, RED, YELLOW, BOLD, CYAN } from "@mizchi/vlmkit-core/terminal-colors.ts";
import { handleCliError } from "@mizchi/vlmkit-core/cli-error.ts";

export interface ComponentConsistencyOptions {
  htmlPath: string;
  selector: string;
  outputDir: string;
  reportPath?: string;
  threshold?: number;
  viewport?: { width: number; height: number };
  /** Which instance to use as the reference. Default 0 (first match). */
  referenceIndex?: number;
}

export interface InstanceEntry {
  index: number;
  screenshotPath: string;
  bbox: { x: number; y: number; width: number; height: number };
}

export interface InstanceDelta {
  candidateIndex: number;
  diffRatio: number;
  diffPixels: number;
  totalPixels: number;
  bboxDeltas: { width: number; height: number };
  paletteOnlyInRef: number;
  paletteOnlyInCand: number;
}

export interface ComponentConsistencyReport {
  html: string;
  selector: string;
  instanceCount: number;
  referenceIndex: number;
  instances: InstanceEntry[];
  deltas: InstanceDelta[];
  reportPath: string;
}

function parseArgs(argv: string[]) {
  let selector = "";
  let outputDir = "";
  let report = "";
  let threshold = 0.03;
  let referenceIndex = 0;
  const positional: string[] = [];
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--selector") selector = argv[++i];
    else if (a === "--output-dir") outputDir = argv[++i];
    else if (a === "--report") report = argv[++i];
    else if (a === "--threshold") threshold = parseFloat(argv[++i] ?? "0.03");
    else if (a === "--reference-index") referenceIndex = parseInt(argv[++i] ?? "0", 10);
    else positional.push(a);
  }
  return { positional, selector, outputDir, report, threshold, referenceIndex };
}

export async function runComponentConsistency(
  options: ComponentConsistencyOptions,
): Promise<ComponentConsistencyReport> {
  if (!options.selector) throw new Error("--selector is required");
  const outputDir = resolve(options.outputDir);
  await mkdir(outputDir, { recursive: true });
  const htmlPath = resolve(options.htmlPath);
  const html = await readFile(htmlPath, "utf-8");
  const viewport = options.viewport ?? { width: 1280, height: 900 };
  const referenceIndex = options.referenceIndex ?? 0;
  const threshold = options.threshold ?? 0.03;

  const browser = await chromium.launch();
  const instances: InstanceEntry[] = [];
  try {
    const page = await browser.newPage({ viewport });
    await page.setContent(html, { waitUntil: "networkidle" });
    await page.addStyleTag({
      content: `*, *::before, *::after { transition: none !important; animation: none !important; }`,
    });
    const locator = page.locator(options.selector);
    const count = await locator.count();
    if (count === 0) {
      throw new Error(`Selector \`${options.selector}\` matched zero elements on ${htmlPath}`);
    }
    for (let i = 0; i < count; i++) {
      const inst = locator.nth(i);
      const bbox = await inst.boundingBox();
      if (!bbox) continue;
      const screenshotPath = join(outputDir, `instance-${i}.png`);
      await inst.screenshot({ path: screenshotPath });
      instances.push({ index: i, screenshotPath, bbox });
    }
    await page.close();
  } finally {
    await browser.close();
  }

  if (instances.length < 2) {
    throw new Error(`Selector matched ${instances.length} element(s); need at least 2 to check consistency.`);
  }

  const reference = instances[referenceIndex] ?? instances[0]!;
  const deltas: InstanceDelta[] = [];
  for (const cand of instances) {
    if (cand.index === reference.index) continue;
    const snap: VrtSnapshot = {
      testId: `consistency-${cand.index}`,
      testTitle: `${cand.index} vs ${reference.index}`,
      projectName: "component-consistency",
      screenshotPath: cand.screenshotPath,
      baselinePath: reference.screenshotPath,
      status: "changed",
    };
    const diff = await compareScreenshots(snap, { outputDir, threshold });
    const [refPalette, candPalette] = await Promise.all([
      extractPaletteFromFile(reference.screenshotPath).catch(() => []),
      extractPaletteFromFile(cand.screenshotPath).catch(() => []),
    ]);
    const paletteDiff = diffPalettes(refPalette, candPalette);
    deltas.push({
      candidateIndex: cand.index,
      diffRatio: diff?.diffRatio ?? 0,
      diffPixels: diff?.diffPixels ?? 0,
      totalPixels: diff?.totalPixels ?? 0,
      bboxDeltas: {
        width: Math.round(cand.bbox.width - reference.bbox.width),
        height: Math.round(cand.bbox.height - reference.bbox.height),
      },
      paletteOnlyInRef: paletteDiff.onlyInBaseline.length,
      paletteOnlyInCand: paletteDiff.onlyInVariant.length,
    });
  }

  const reportPath = options.reportPath ?? join(outputDir, "report.md");
  const md = renderReport(htmlPath, options.selector, instances, reference.index, deltas);
  await writeFile(reportPath, md);

  console.log(`  ${BOLD}${CYAN}vrt component-consistency${RESET}`);
  console.log(`  ${DIM}html: ${htmlPath}  selector: ${options.selector}${RESET}`);
  console.log(`  ${DIM}${instances.length} instance(s), reference = #${reference.index}${RESET}`);
  for (const d of deltas) {
    const pct = (d.diffRatio * 100).toFixed(2);
    const icon = d.diffRatio === 0 ? `${GREEN}✓${RESET}` : d.diffRatio < 0.01 ? `${YELLOW}~${RESET}` : `${RED}✗${RESET}`;
    const whDelta = `Δ ${d.bboxDeltas.width > 0 ? "+" : ""}${d.bboxDeltas.width} / ${d.bboxDeltas.height > 0 ? "+" : ""}${d.bboxDeltas.height}`;
    console.log(`  ${icon} instance #${d.candidateIndex}  ${pct.padStart(6)}%  ${DIM}${whDelta}${RESET}`);
  }
  console.log(`  ${DIM}report: ${reportPath}${RESET}`);

  return {
    html: htmlPath,
    selector: options.selector,
    instanceCount: instances.length,
    referenceIndex: reference.index,
    instances,
    deltas,
    reportPath,
  };
}

function renderReport(
  html: string,
  selector: string,
  instances: InstanceEntry[],
  refIdx: number,
  deltas: InstanceDelta[],
): string {
  const lines: string[] = [];
  lines.push("# Component consistency report");
  lines.push("");
  lines.push(`HTML: \`${html}\``);
  lines.push(`Selector: \`${selector}\`  —  **${instances.length}** instance(s) detected.`);
  lines.push(`Reference: instance **#${refIdx}**.`);
  lines.push("");
  lines.push("After an inline → componentized refactor, every call site should " +
    "render identically. Per-instance pixel diff against the reference reveals " +
    "which instances drifted — typically because one call site was missed during " +
    "the refactor and is still inline with stale styles.");
  lines.push("");
  lines.push("## Drift summary");
  lines.push("");
  lines.push("| Instance | Pixel diff | Δ W / H | Missing palette | Extra palette |");
  lines.push("|---|---|---|---|---|");
  for (const d of deltas) {
    const pct = (d.diffRatio * 100).toFixed(2) + "%";
    const wh = `${d.bboxDeltas.width > 0 ? "+" : ""}${d.bboxDeltas.width} / ${d.bboxDeltas.height > 0 ? "+" : ""}${d.bboxDeltas.height}`;
    lines.push(`| #${d.candidateIndex} | ${pct} | ${wh} | ${d.paletteOnlyInRef} | ${d.paletteOnlyInCand} |`);
  }
  lines.push("");
  lines.push("## Captured screenshots");
  lines.push("");
  for (const inst of instances) {
    const ref = inst.index === refIdx ? "  **(reference)**" : "";
    lines.push(`- instance #${inst.index}${ref} — ${inst.bbox.width}×${inst.bbox.height} at ${inst.bbox.x},${inst.bbox.y} — \`${inst.screenshotPath}\``);
  }
  lines.push("");
  lines.push("## Suggested next step");
  lines.push("");
  const drifters = deltas.filter((d) => d.diffRatio > 0.005);
  if (drifters.length === 0) {
    lines.push("All instances render identically to the reference — refactor is consistent.");
  } else {
    lines.push(`${drifters.length} instance(s) differ from the reference. For each:`);
    lines.push("1. Open the candidate screenshot next to the reference; identify the visible delta.");
    lines.push("2. Locate the call site in the source. If the page contains a mix of inline " +
      "markup and component invocations (`<Card>`), the drifting instance is likely the " +
      "still-inline one.");
    lines.push("3. Replace the inline markup with the shared component invocation.");
  }
  lines.push("");
  return lines.join("\n");
}

async function main(argv = process.argv.slice(2)) {
  if (argv[0] === "--help" || argv[0] === "-h") argv = [];
  const { positional, selector, outputDir, report, threshold, referenceIndex } = parseArgs(argv);
  if (positional.length === 0 || !selector) {
    console.log("Usage: vrt component-consistency <html> --selector <sel>");
    console.log("Options:");
    console.log("  --selector <sel>           CSS selector matching ≥ 2 instances of the component.");
    console.log("  --reference-index <N>      Which match to use as the reference. Default 0.");
    console.log("  --output-dir <dir>         Default: ./test-results/component-consistency");
    console.log("  --threshold <0..1>         Pixel diff threshold. Default 0.03.");
    process.exit(1);
  }
  await runComponentConsistency({
    htmlPath: positional[0]!,
    selector,
    outputDir: outputDir || join(process.cwd(), "test-results", "component-consistency"),
    reportPath: report || undefined,
    threshold,
    referenceIndex,
  });
}

const isCliEntry = process.env.__VRT_DISPATCHER_LEAF__ === "component-consistency" || (process.argv[1] ? resolve(process.argv[1]) === fileURLToPath(import.meta.url) : false);
if (isCliEntry) {
  main().catch(handleCliError);
}
