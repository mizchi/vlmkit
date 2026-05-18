#!/usr/bin/env node
/**
 * Cross-browser parity check.
 *
 * Renders the same HTML / URL in Chromium, Firefox, and WebKit;
 * pixel-diffs each against the first successful engine (the
 * reference). Catches per-engine rendering quirks:
 *
 *   - Font rendering differences (text-row Y-shifts)
 *   - Form control native styling differences (button heights,
 *     input padding, select arrow)
 *   - Unsupported CSS feature (e.g., `:has()` in older WebKit,
 *     `view-transition` API)
 *   - Default UA stylesheet differences
 *
 * Engines that aren't installed are skipped with an actionable
 * install hint — the tool stays useful in a Chromium-only sandbox.
 *
 * Usage:
 *   vrt cross-browser <html-or-url>
 *   vrt cross-browser <url> --engines chromium,firefox
 */
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium, firefox, webkit, type Browser, type BrowserType } from "playwright";
import { compareScreenshots } from "@mizchi/vrt-core/heatmap.ts";
import { findHeatmapRegionsFromFile, type HeatmapRegion } from "@mizchi/vrt-core/heatmap-regions.ts";
import type { VrtSnapshot } from "@mizchi/vrt-core/types.ts";
import { handleCliError } from "@mizchi/vrt-core/cli-error.ts";
import { DIM, RESET, GREEN, RED, YELLOW, BOLD, CYAN } from "@mizchi/vrt-core/terminal-colors.ts";

export type EngineName = "chromium" | "firefox" | "webkit";

export const ALL_ENGINES: EngineName[] = ["chromium", "firefox", "webkit"];

const ENGINE_BY_NAME: Record<EngineName, BrowserType> = {
  chromium, firefox, webkit,
};

export interface CrossBrowserOptions {
  source: string;
  outputDir: string;
  reportPath?: string;
  viewport?: { width: number; height: number };
  engines?: EngineName[];
  threshold?: number;
  /** When true, don't set a warning exit code if engines auto-skip. */
  allowSkipped?: boolean;
}

export interface EngineResult {
  engine: EngineName;
  status: "ok" | "skipped" | "failed";
  screenshotPath?: string;
  /** Delta vs the reference engine (the first ok engine in the list). */
  deltaRatio: number;
  deltaPixels: number;
  totalPixels: number;
  heatmapPath?: string;
  heatmapRegions: HeatmapRegion[];
  /** UA string actually used by the engine, if launched. */
  userAgent?: string;
  error?: string;
}

export interface CrossBrowserReport {
  source: string;
  viewport: { width: number; height: number };
  /** Engine treated as the reference (first to succeed). */
  reference?: EngineName;
  engines: EngineResult[];
  reportPath: string;
}

function isUrl(s: string): boolean { return /^(https?|file):\/\//.test(s); }

function parseArgs(argv: string[]) {
  let outputDir = "";
  let report = "";
  let engines: EngineName[] | undefined;
  let threshold = 0.03;
  let allowSkipped = false;
  const positional: string[] = [];
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--output-dir") outputDir = argv[++i];
    else if (a === "--report") report = argv[++i];
    else if (a === "--threshold") threshold = parseFloat(argv[++i] ?? "0.03");
    else if (a === "--allow-skipped") allowSkipped = true;
    else if (a === "--engines") {
      engines = (argv[++i] ?? "").split(",").map((v) => v.trim()).filter((v) =>
        ALL_ENGINES.includes(v as EngineName)) as EngineName[];
    } else positional.push(a);
  }
  return { positional, outputDir, report, engines, threshold, allowSkipped };
}

async function captureWithEngine(
  engine: EngineName,
  source: string,
  html: string | null,
  viewport: { width: number; height: number },
  outputPath: string,
): Promise<{ ok: true; userAgent: string } | { ok: false; reason: "not-installed" | "error"; message: string }> {
  let browser: Browser | null = null;
  try {
    browser = await ENGINE_BY_NAME[engine].launch();
  } catch (error) {
    const msg = String(error);
    // Playwright's "browser not installed" errors include
    // distinctive markers like "Executable doesn't exist" or
    // "Please install" — surface a clean instruction instead of
    // the full stack.
    if (/Executable doesn't exist|Please install|Failed to launch.*didn't exist/i.test(msg)) {
      return { ok: false, reason: "not-installed", message: `${engine} not installed — run \`npx playwright install ${engine}\`` };
    }
    return { ok: false, reason: "error", message: msg };
  }
  try {
    const context = await browser.newContext({ viewport });
    const page = await context.newPage();
    if (isUrl(source)) {
      await page.goto(source, { waitUntil: "networkidle", timeout: 30000 });
    } else {
      await page.setContent(html!, { waitUntil: "networkidle" });
    }
    // Disable transitions for determinism (same pattern as the rest
    // of the toolkit).
    await page.addStyleTag({
      content: `*, *::before, *::after { transition: none !important; animation: none !important; }`,
    });
    const userAgent = await page.evaluate(() => navigator.userAgent);
    await page.screenshot({ path: outputPath, fullPage: false });
    await page.close();
    await context.close();
    return { ok: true, userAgent };
  } catch (error) {
    return { ok: false, reason: "error", message: String(error) };
  } finally {
    await browser?.close();
  }
}

export async function runCrossBrowser(
  options: CrossBrowserOptions,
): Promise<CrossBrowserReport> {
  const outputDir = resolve(options.outputDir);
  await mkdir(outputDir, { recursive: true });
  const viewport = options.viewport ?? { width: 1280, height: 720 };
  const threshold = options.threshold ?? 0.03;
  const engines = options.engines ?? ALL_ENGINES;
  const html = isUrl(options.source) ? null : await readFile(resolve(options.source), "utf-8");

  const engineResults: EngineResult[] = [];
  let reference: EngineName | undefined;
  let referencePath: string | undefined;

  for (const engine of engines) {
    const screenshotPath = join(outputDir, `${engine}.png`);
    const result = await captureWithEngine(engine, options.source, html, viewport, screenshotPath);
    if (!result.ok) {
      engineResults.push({
        engine,
        status: result.reason === "not-installed" ? "skipped" : "failed",
        deltaRatio: 0,
        deltaPixels: 0,
        totalPixels: 0,
        heatmapRegions: [],
        error: result.message,
      });
      continue;
    }
    if (!reference) {
      reference = engine;
      referencePath = screenshotPath;
      engineResults.push({
        engine,
        status: "ok",
        screenshotPath,
        deltaRatio: 0,
        deltaPixels: 0,
        totalPixels: 0,
        heatmapRegions: [],
        userAgent: result.userAgent,
      });
      continue;
    }
    // Diff against reference.
    const snap: VrtSnapshot = {
      testId: `cross-${engine}`,
      testTitle: `${engine} vs ${reference}`,
      projectName: "cross-browser",
      screenshotPath,
      baselinePath: referencePath!,
      status: "changed",
    };
    const diff = await compareScreenshots(snap, { outputDir, threshold });
    const heatmapPath = join(outputDir, `cross-${engine}_heatmap.png`);
    let heatmapRegions: HeatmapRegion[] = [];
    try {
      heatmapRegions = await findHeatmapRegionsFromFile(heatmapPath, {}, screenshotPath);
    } catch {
      // No heatmap (zero diff).
    }
    engineResults.push({
      engine,
      status: "ok",
      screenshotPath,
      deltaRatio: diff?.diffRatio ?? 0,
      deltaPixels: diff?.diffPixels ?? 0,
      totalPixels: diff?.totalPixels ?? 0,
      heatmapPath: diff?.diffPixels && diff.diffPixels > 0 ? heatmapPath : undefined,
      heatmapRegions,
      userAgent: result.userAgent,
    });
  }

  const reportPath = options.reportPath ?? join(outputDir, "report.md");
  const md = renderReport({
    source: options.source,
    viewport,
    reference,
    engines: engineResults,
  });
  await writeFile(reportPath, md);

  const usable = engineResults.filter((r) => r.status === "ok").length;
  const skipped = engineResults.filter((r) => r.status === "skipped").length;

  console.log(`  ${BOLD}${CYAN}vrt cross-browser${RESET}`);
  console.log(`  ${DIM}source: ${options.source}${RESET}`);
  if (reference) {
    console.log(`  ${DIM}reference: ${reference}${RESET}`);
  }
  if (usable < 2) {
    console.log(`  ${YELLOW}!${RESET} Only ${usable} engine(s) usable — no cross-engine comparison performed. Install missing engines with \`npx playwright install firefox webkit\`.`);
    // Set a warning exit code so CI matrices using cross-browser as a
    // gate don't silently pass on an under-configured runner. Use 2
    // (warning) not 1 (hard fail) — the run *did* succeed, just on
    // fewer engines than intended. Override with --allow-skipped.
    if (!options.allowSkipped) process.exitCode = 2;
  }
  for (const r of engineResults) {
    if (r.status === "skipped") {
      console.log(`  ${YELLOW}-${RESET} ${r.engine.padEnd(10)} ${DIM}skipped — ${r.error}${RESET}`);
    } else if (r.status === "failed") {
      console.log(`  ${RED}✗${RESET} ${r.engine.padEnd(10)} ${DIM}failed — ${r.error}${RESET}`);
    } else if (r.engine === reference) {
      console.log(`  ${GREEN}✓${RESET} ${r.engine.padEnd(10)} ${DIM}(reference)${RESET}`);
    } else {
      const pct = (r.deltaRatio * 100).toFixed(2);
      const icon = r.deltaRatio === 0 ? `${GREEN}✓${RESET}`
        : r.deltaRatio < 0.01 ? `${YELLOW}~${RESET}`
        : `${RED}✗${RESET}`;
      console.log(`  ${icon} ${r.engine.padEnd(10)} Δ ${pct.padStart(6)}%  ${DIM}${r.heatmapRegions.length} region(s)${RESET}`);
    }
  }
  console.log(`  ${DIM}report: ${reportPath}${RESET}`);

  return {
    source: options.source, viewport, reference,
    engines: engineResults, reportPath,
  };
}

function renderReport(r: Omit<CrossBrowserReport, "reportPath">): string {
  const lines: string[] = [];
  lines.push("# Cross-browser parity report");
  lines.push("");
  lines.push(`Source: \`${r.source}\` at ${r.viewport.width}×${r.viewport.height}`);
  if (r.reference) {
    lines.push(`Reference engine: **${r.reference}**`);
  }
  lines.push("");

  const skipped = r.engines.filter((e) => e.status === "skipped");
  if (skipped.length > 0) {
    lines.push(`⚠ **${skipped.length} engine(s) skipped** — install with \`npx playwright install ${skipped.map((s) => s.engine).join(" ")}\` to get full parity coverage.`);
    lines.push("");
  }
  const usable = r.engines.filter((e) => e.status === "ok").length;
  if (usable < 2) {
    lines.push(`⚠ **No cross-engine comparison was performed** — only ${usable} engine(s) usable. The report below confirms render success on those engines but cannot detect parity bugs across browsers.`);
    lines.push("");
  }

  lines.push("## Engine results");
  lines.push("");
  lines.push("| Engine | Status | Δ vs reference | Regions | UA |");
  lines.push("|---|---|---|---|---|");
  for (const e of r.engines) {
    if (e.status === "ok") {
      const delta = e.engine === r.reference
        ? "_(reference)_"
        : `${(e.deltaRatio * 100).toFixed(2)}% (${e.deltaPixels} px)`;
      const ua = e.userAgent ? `\`${e.userAgent.slice(0, 60)}…\`` : "—";
      lines.push(`| \`${e.engine}\` | ✓ ok | ${delta} | ${e.heatmapRegions.length} | ${ua} |`);
    } else if (e.status === "skipped") {
      lines.push(`| \`${e.engine}\` | — skipped | — | — | _${e.error}_ |`);
    } else {
      lines.push(`| \`${e.engine}\` | ✗ failed | — | — | _${e.error}_ |`);
    }
  }
  lines.push("");

  const divergent = r.engines.filter((e) => e.status === "ok" && e.engine !== r.reference && e.deltaRatio > 0.001);
  if (divergent.length > 0) {
    lines.push("## Divergent engines — top regions");
    lines.push("");
    for (const e of divergent) {
      lines.push(`### ${e.engine} — ${(e.deltaRatio * 100).toFixed(2)}% diff vs ${r.reference}`);
      lines.push("");
      if (e.heatmapRegions.length === 0) {
        lines.push("_(no localizable regions — diff is broadly distributed)_");
        lines.push("");
        continue;
      }
      lines.push("| Top-Left | Size | Hot pixels | Fill | Kind |");
      lines.push("|---|---|---|---|---|");
      for (const reg of e.heatmapRegions.slice(0, 5)) {
        const fill = reg.dominantColor ? `\`${reg.dominantColor.hex}\`` : "—";
        const kind = reg.kind ? `\`${reg.kind}\`` : "—";
        lines.push(`| ${reg.left},${reg.top} | ${reg.width}×${reg.height} | ${reg.area} | ${fill} | ${kind} |`);
      }
      lines.push("");
    }
  }

  lines.push("## Suggested next step");
  lines.push("");
  if (divergent.length === 0 && skipped.length === 0) {
    lines.push("Every engine renders identically. Page is cross-browser-clean.");
  } else if (divergent.length > 0) {
    lines.push("For each divergent engine:");
    lines.push("1. Open both engines' screenshots side by side.");
    lines.push("2. Inspect the listed regions — common per-engine quirks:");
    lines.push("   - **WebKit**: form controls (button, input, select) render with macOS native styles unless `appearance: none` is set.");
    lines.push("   - **Firefox**: text rendering subpixel-shifts by 1-2px; sometimes whole text rows align differently.");
    lines.push("   - **Both**: `:has()`, `view-transition`, `@container` support varies by version.");
    lines.push("3. If a region is form-control: add `appearance: none` + explicit styles for buttons / inputs.");
    lines.push("4. If a region is text: check `font-family` fallback ordering — WebKit may pick a different fallback than Chromium.");
  }
  if (skipped.length > 0) {
    lines.push("");
    lines.push("To get full coverage, install the missing engines and re-run:");
    lines.push("```");
    lines.push(`npx playwright install ${skipped.map((s) => s.engine).join(" ")}`);
    lines.push("```");
  }
  lines.push("");
  return lines.join("\n");
}

async function main(argv = process.argv.slice(2)) {
  if (argv[0] === "--help" || argv[0] === "-h") argv = [];
  const { positional, outputDir, report, engines, threshold, allowSkipped } = parseArgs(argv);
  if (positional.length === 0) {
    console.log("Usage: vrt cross-browser <html-or-url> [options]");
    console.log("Options:");
    console.log("  --engines <list>    Comma-separated subset (default: chromium,firefox,webkit)");
    console.log("  --output-dir <dir>  Default: ./test-results/cross-browser");
    console.log("  --report <path>     Markdown report path");
    console.log("  --threshold <0..1>  Pixel diff threshold (default: 0.03)");
    console.log("  --allow-skipped     Exit 0 even when missing engines skipped the comparison");
    process.exit(1);
  }
  await runCrossBrowser({
    source: positional[0]!,
    outputDir: outputDir || join(process.cwd(), "test-results", "cross-browser"),
    reportPath: report || undefined,
    engines,
    allowSkipped,
    threshold,
  });
}

const isCliEntry = process.argv[1] ? resolve(process.argv[1]) === fileURLToPath(import.meta.url) : false;
if (isCliEntry) {
  main().catch(handleCliError);
}
