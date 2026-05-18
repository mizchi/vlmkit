#!/usr/bin/env node
/**
 * VRT Snapshot -- capture URLs at multiple viewports, auto-compare with previous
 *
 * Usage:
 *   vrt snapshot http://localhost:4156/todomvc --output snapshots/luna/
 *   vrt snapshot http://localhost:3000/ http://localhost:3000/luna/ --output snapshots/sol/
 */
import { existsSync } from "node:fs";
import { access, copyFile, mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { compareScreenshots, generateDiffReport } from "@mizchi/vrt-core/heatmap.ts";
import { DIM, RESET, GREEN, RED, YELLOW, CYAN, BOLD, hr } from "@mizchi/vrt-core/terminal-colors.ts";
import { applyMask } from "@mizchi/vrt-core/mask.ts";
import { approveSnapshotsFromReport } from "./approve.ts";
import { determineSnapshotExitCode, parseSnapshotCliArgs, parseSnapshotConfig, type SnapshotConfig } from "../../cli/commands/snapshot.ts";
import {
  extractSnapshotFixTasks,
  formatSnapshotFixPromptJson,
  formatSnapshotFixPromptMarkdown,
  type SnapshotReport,
} from "@mizchi/vrt-markup/heal/fix-prompt.ts";
import {
  buildStabilityReport,
  formatStabilitySummary,
  type StabilityIterationResult,
} from "./stability.ts";
import { resolveCaptureBackend, type CaptureBackend } from "@mizchi/vrt-capture/capturer.ts";
import { writeFlipbook, type FlipbookFrame } from "../compare/flipbook.ts";
import type { VrtSnapshot } from "@mizchi/vrt-core/types.ts";

const DEFAULT_SNAPSHOT_CONFIG_FILE = "vrt.config.json";
const VIEWPORTS = [
  { width: 1280, height: 900, label: "desktop" },
  { width: 375, height: 812, label: "mobile" },
];

interface SnapshotResult {
  url: string;
  label: string;
  viewport: string;
  screenshotPath: string;
  baselinePath?: string;
  diffRatio?: number;
  isNew: boolean;
  globalShift?: number;
  compensatedDiffRatio?: number;
  shiftOnly?: boolean;
}

function formatSnapshotUsage(): string {
  return [
    "Usage:",
    "  vrt snapshot <url1> [url2] ... [--output dir] [--label name] [--threshold 0.1] [--fail-on-diff] [--fail-on-new-baseline] [--max-diff-ratio n] [--backend local|cloudflare] [--config vrt.config.json]",
    "  vrt snapshot approve [--output dir] [--label name] [--config vrt.config.json]",
    "  vrt snapshot fix-prompt [--output dir] [--label name] [--format markdown|json] [--limit n] [--min-diff 0.01] [--out path] [--config vrt.config.json]",
    "  vrt snapshot stability <url1> [url2]... [--iterations 3] [--output dir] [--threshold 0.1] [--fp-threshold 0] [--fail-above-rate 0.05] [--config vrt.config.json]",
  ].join("\n");
}

function findSnapshotConfigPath(cliArgs: string[], cwd: string): string | undefined {
  for (let i = 0; i < cliArgs.length; i++) {
    if (cliArgs[i] === "--config") {
      const value = cliArgs[i + 1];
      if (!value) {
        throw new Error("Missing value for --config");
      }
      return resolve(cwd, value);
    }
  }

  const defaultPath = resolve(cwd, DEFAULT_SNAPSHOT_CONFIG_FILE);
  return existsSync(defaultPath) ? defaultPath : undefined;
}

async function loadSnapshotConfigForCli(cliArgs: string[], cwd: string): Promise<{
  config: SnapshotConfig;
  configPath?: string;
}> {
  const configPath = findSnapshotConfigPath(cliArgs, cwd);
  if (!configPath) {
    return { config: {} };
  }

  const raw = await readFile(configPath, "utf-8");
  const config = parseSnapshotConfig(raw);
  if (config.outputDir && !config.outputDir.startsWith("/") && !/^[A-Za-z]:[\\/]/.test(config.outputDir)) {
    config.outputDir = resolve(dirname(configPath), config.outputDir);
  }
  return { config, configPath };
}

async function approve(options: {
  outputDir: string;
  labels: string[];
  configPath?: string;
}) {
  const reportPath = join(options.outputDir, "snapshot-report.json");
  let result: Awaited<ReturnType<typeof approveSnapshotsFromReport>>;
  try {
    result = await approveSnapshotsFromReport(reportPath, options.labels);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      throw new Error(`No snapshot report found at ${reportPath}. Run \`vrt snapshot <url...>\` first.`);
    }
    throw error;
  }

  console.log();
  console.log(`${BOLD}${CYAN}Snapshot Approve${RESET}`);
  console.log(`  ${DIM}Output: ${options.outputDir}${RESET}`);
  if (options.configPath) {
    console.log(`  ${DIM}Config: ${options.configPath}${RESET}`);
  }
  if (options.labels.length > 0) {
    console.log(`  ${DIM}Labels: ${options.labels.join(", ")}${RESET}`);
  }
  console.log();
  for (const entry of result.entries) {
    console.log(`  ${GREEN}${entry.label}${RESET} ${DIM}${entry.viewport}${RESET}`);
  }
  console.log();
  console.log(`  ${GREEN}Approved baselines:${RESET} ${result.updated}`);
  console.log(`  ${DIM}Report: ${reportPath}${RESET}`);
  console.log();
}

async function runFixPrompt(options: {
  outputDir: string;
  labels: string[];
  fixPrompt: { format: "markdown" | "json"; limit?: number; minDiffRatio: number; outPath?: string };
  configPath?: string;
}) {
  const reportPath = join(options.outputDir, "snapshot-report.json");
  let raw: string;
  try {
    raw = await readFile(reportPath, "utf-8");
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      throw new Error(`No snapshot report found at ${reportPath}. Run \`vrt snapshot <url...>\` first.`);
    }
    throw error;
  }

  const report = JSON.parse(raw) as SnapshotReport;
  const tasks = extractSnapshotFixTasks(report, {
    labels: options.labels,
    minDiffRatio: options.fixPrompt.minDiffRatio,
    outputDir: options.outputDir,
  });

  const output = options.fixPrompt.format === "json"
    ? formatSnapshotFixPromptJson(tasks)
    : formatSnapshotFixPromptMarkdown(tasks, {
        relativeTo: options.outputDir,
        limit: options.fixPrompt.limit,
      });

  if (options.fixPrompt.outPath) {
    const outPath = resolve(options.fixPrompt.outPath);
    await mkdir(dirname(outPath), { recursive: true });
    await writeFile(outPath, output);
    console.log();
    console.log(`${BOLD}${CYAN}Snapshot Fix Prompt${RESET}`);
    console.log(`  ${DIM}Tasks: ${tasks.length}${RESET}`);
    console.log(`  ${DIM}Output: ${outPath}${RESET}`);
    if (options.configPath) {
      console.log(`  ${DIM}Config: ${options.configPath}${RESET}`);
    }
    console.log();
  } else {
    process.stdout.write(output);
    if (!output.endsWith("\n")) process.stdout.write("\n");
  }
}

async function runStability(options: {
  urls: string[];
  labels: string[];
  outputDir: string;
  threshold: number;
  maskSelectors: string[];
  iterations: number;
  failAboveRate?: number;
  fpThreshold: number;
  configPath?: string;
  backend: CaptureBackend;
  flipbook?: boolean;
  flipbookDelayMs?: number;
}) {
  if (options.urls.length === 0) {
    throw new Error("No URLs provided for stability run. Pass URLs directly or configure routes in vrt.config.json.");
  }

  await mkdir(options.outputDir, { recursive: true });

  console.log();
  console.log(`${BOLD}${CYAN}Snapshot Stability${RESET}`);
  console.log(`  ${DIM}URLs: ${options.urls.length} | Iterations: ${options.iterations} | Output: ${options.outputDir}${RESET}`);
  console.log(`  ${DIM}Threshold: ${options.threshold} | Backend: ${options.backend.label}${RESET}`);
  if (options.configPath) {
    console.log(`  ${DIM}Config: ${options.configPath}${RESET}`);
  }
  if (options.maskSelectors.length > 0) {
    console.log(`  ${DIM}Mask: ${options.maskSelectors.join(", ")}${RESET}`);
  }
  console.log();

  const browser = await options.backend.launch();
  const iterations: StabilityIterationResult[] = [];

  try {
    for (let iter = 0; iter < options.iterations; iter++) {
      console.log(`  ${BOLD}Iteration ${iter + 1}/${options.iterations}${RESET}`);

      for (const [index, url] of options.urls.entries()) {
        const label = options.labels[index]!;

        for (const vp of VIEWPORTS) {
          const page = await browser.newPage({ viewport: { width: vp.width, height: vp.height } });
          await page.goto(url, { waitUntil: "networkidle", timeout: 30000 });
          await applyMask(page, options.maskSelectors);

          const currentPath = iter === 0
            ? join(options.outputDir, `${label}-${vp.label}-baseline.png`)
            : join(options.outputDir, `${label}-${vp.label}-iter${iter}.png`);
          await page.screenshot({ path: currentPath, fullPage: true });
          await page.close();

          if (iter === 0) {
            iterations.push({
              iteration: 0,
              url,
              label,
              viewport: vp.label,
              diffRatio: 0,
            });
            continue;
          }

          const baselinePath = join(options.outputDir, `${label}-${vp.label}-baseline.png`);
          const snap: VrtSnapshot = {
            testId: `${label}-${vp.label}-iter${iter}`,
            testTitle: `${label} ${vp.label} iter ${iter}`,
            projectName: "stability",
            screenshotPath: currentPath,
            baselinePath,
            status: "changed",
          };
          const diff = await compareScreenshots(snap, { outputDir: options.outputDir, threshold: options.threshold });
          const diffRatio = diff?.diffRatio ?? 0;
          const report = diffRatio > 0
            ? await generateDiffReport(snap, { outputDir: options.outputDir, detectShift: true, threshold: options.threshold })
            : null;
          const globalShift = report?.globalShift ?? 0;
          const compensatedDiffRatio = report
            ? report.compensatedDiffCount / report.totalPixels
            : diffRatio;

          const color = diffRatio === 0 ? GREEN : diffRatio < 0.01 ? YELLOW : RED;
          const pct = (diffRatio * 100).toFixed(2);
          console.log(`    ${label}/${vp.label}: ${color}${pct}%${RESET}` +
            (globalShift !== 0 ? ` ${DIM}(shift ${globalShift > 0 ? "+" : ""}${globalShift}px)${RESET}` : ""));

          iterations.push({
            iteration: iter,
            url,
            label,
            viewport: vp.label,
            diffRatio,
            compensatedDiffRatio,
            globalShift,
            shiftOnly: report?.shiftOnly ?? false,
          });
        }
      }
    }
  } finally {
    await options.backend.close(browser);
  }

  const report = buildStabilityReport({
    iterations: options.iterations,
    urls: options.urls,
    threshold: options.fpThreshold,
    results: iterations,
  });

  console.log();
  hr();
  console.log();
  console.log(formatStabilitySummary(report));
  console.log();

  const reportPath = join(options.outputDir, "stability-report.json");
  await writeFile(reportPath, JSON.stringify(report, null, 2));
  console.log(`  ${DIM}Report: ${reportPath}${RESET}`);

  if (options.flipbook) {
    const flipDir = join(options.outputDir, "flipbooks");
    await mkdir(flipDir, { recursive: true });
    const delayMs = options.flipbookDelayMs ?? 700;
    const generated: string[] = [];
    // Group iterations by (label, viewport). iteration 0 → baseline.png.
    const groups = new Map<string, FlipbookFrame[]>();
    for (const r of iterations) {
      const key = `${r.label}::${r.viewport}`;
      const frame: FlipbookFrame = r.iteration === 0
        ? {
            path: join(options.outputDir, `${r.label}-${r.viewport}-baseline.png`),
            label: "iter 0",
            sublabel: "baseline",
          }
        : {
            path: join(options.outputDir, `${r.label}-${r.viewport}-iter${r.iteration}.png`),
            label: `iter ${r.iteration}`,
            sublabel: `${(r.diffRatio * 100).toFixed(2)}% diff`,
          };
      const list = groups.get(key);
      if (list) list.push(frame); else groups.set(key, [frame]);
    }
    for (const [key, frames] of groups) {
      const [label, viewport] = key.split("::") as [string, string];
      const safe = `${label}-${viewport}-stability`.replace(/[/\\:]/g, "_");
      const outPath = join(flipDir, `${safe}.html`);
      await writeFlipbook(outPath, frames, {
        title: `${label} / ${viewport} (${options.iterations} iterations)`,
        delayMs,
        autoplay: true,
        loop: true,
      });
      generated.push(outPath);
    }
    console.log(`  ${DIM}Flipbooks: ${generated.length} written to ${flipDir}${RESET}`);
  }
  console.log();

  if (options.failAboveRate !== undefined && report.overallFalsePositiveRate > options.failAboveRate) {
    console.log(`  ${RED}FP rate ${(report.overallFalsePositiveRate * 100).toFixed(2)}% exceeds --fail-above-rate ${(options.failAboveRate * 100).toFixed(2)}%${RESET}`);
    console.log();
    process.exitCode = 1;
  }
}

async function runDiffFlipbook(options: {
  outputDir: string;
  labels: string[];
  delayMs: number;
  flipbookOutDir?: string;
  configPath?: string;
}) {
  const reportPath = join(options.outputDir, "snapshot-report.json");
  let raw: string;
  try {
    raw = await readFile(reportPath, "utf-8");
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      throw new Error(`No snapshot report found at ${reportPath}. Run \`vrt snapshot <url...>\` first.`);
    }
    throw error;
  }

  const report = JSON.parse(raw) as { results: Array<{
    label: string; viewport: string; screenshotPath: string;
    baselinePath?: string; diffRatio?: number; isNew?: boolean;
  }> };

  const filter = options.labels.length > 0 ? new Set(options.labels) : undefined;
  const baseOut = resolve(options.flipbookOutDir ?? join(options.outputDir, "flipbooks"));
  await mkdir(baseOut, { recursive: true });

  const generated: string[] = [];
  for (const entry of report.results) {
    if (entry.isNew) continue;
    if ((entry.diffRatio ?? 0) === 0) continue;
    if (filter && !filter.has(entry.label)) continue;

    const baselinePath = entry.baselinePath ?? entry.screenshotPath.replace(/-current\.png$/, "-baseline.png");
    const currentPath = entry.screenshotPath;
    const safeName = `${entry.label}-${entry.viewport}`.replace(/[/\\:]/g, "_");
    const heatmapPath = join(options.outputDir, `${safeName}_heatmap.png`);

    const frames: FlipbookFrame[] = [
      { path: baselinePath, label: "baseline", sublabel: "saved baseline" },
      { path: currentPath, label: "current", sublabel: `${((entry.diffRatio ?? 0) * 100).toFixed(2)}% diff` },
    ];
    if (existsSync(heatmapPath)) {
      frames.push({ path: heatmapPath, label: "heatmap", sublabel: "pixel diff overlay" });
    }

    const outPath = join(baseOut, `${safeName}.html`);
    await writeFlipbook(outPath, frames, {
      title: `${entry.label} / ${entry.viewport}`,
      delayMs: options.delayMs,
      autoplay: true,
      loop: true,
    });
    generated.push(outPath);
  }

  console.log();
  console.log(`${BOLD}${CYAN}Snapshot Diff Flipbooks${RESET}`);
  console.log(`  ${DIM}Output: ${baseOut}${RESET}`);
  console.log(`  ${DIM}Generated: ${generated.length}${RESET}`);
  if (options.configPath) console.log(`  ${DIM}Config: ${options.configPath}${RESET}`);
  for (const g of generated) console.log(`  ${GREEN}${g}${RESET}`);
  if (generated.length === 0) {
    console.log(`  ${YELLOW}No entries with non-zero diff — nothing to render.${RESET}`);
  }
  console.log();
}

async function main() {
  const cliArgs = process.argv.slice(2);
  if (cliArgs.length === 0 || cliArgs.includes("--help") || cliArgs.includes("-h") || cliArgs.includes("help")) {
    console.log(formatSnapshotUsage());
    process.exit(cliArgs.length === 0 ? 1 : 0);
  }

  const cwd = process.cwd();
  const { config, configPath } = await loadSnapshotConfigForCli(cliArgs, cwd);
  const parsed = parseSnapshotCliArgs(cliArgs, config, cwd);
  const outputDir = resolve(parsed.outputDir);

  if (parsed.mode === "approve") {
    await approve({ outputDir, labels: parsed.labels, configPath });
    return;
  }

  if (parsed.mode === "fix-prompt") {
    await runFixPrompt({
      outputDir,
      labels: parsed.labels,
      fixPrompt: parsed.fixPrompt!,
      configPath,
    });
    return;
  }

  if (parsed.mode === "flipbook") {
    await runDiffFlipbook({
      outputDir,
      labels: parsed.labels,
      delayMs: parsed.flipbook!.delayMs,
      flipbookOutDir: parsed.flipbook!.outDir,
      configPath,
    });
    return;
  }

  const { backend: captureBackend, source: backendSource } = resolveCaptureBackend({
    backendFlag: parsed.backend,
  });

  if (parsed.mode === "stability") {
    await runStability({
      urls: parsed.urls,
      labels: parsed.labels,
      outputDir,
      threshold: parsed.threshold,
      maskSelectors: parsed.maskSelectors,
      iterations: parsed.stability!.iterations,
      failAboveRate: parsed.stability!.failAboveRate,
      fpThreshold: parsed.stability!.fpThreshold,
      configPath,
      backend: captureBackend,
      flipbook: parsed.stability!.flipbook,
    });
    return;
  }

  const urls = parsed.urls;
  if (urls.length === 0) {
    console.log(formatSnapshotUsage());
    throw new Error("No snapshot URLs provided. Pass URLs directly or configure routes in vrt.config.json.");
  }
  const labels = parsed.labels;

  await mkdir(outputDir, { recursive: true });

  console.log();
  console.log(`${BOLD}${CYAN}╔════════════════════════════════════════════════════════════════════════╗${RESET}`);
  console.log(`${BOLD}${CYAN}║  VRT Snapshot                                                        ║${RESET}`);
  console.log(`${BOLD}${CYAN}╚════════════════════════════════════════════════════════════════════════╝${RESET}`);
  console.log(`  ${DIM}URLs: ${urls.length} | Viewports: ${VIEWPORTS.map((v) => v.label).join(", ")} | Output: ${outputDir}${RESET}`);
  console.log(`  ${DIM}Threshold: ${parsed.threshold} | Backend: ${captureBackend.label}${backendSource === "default" ? "" : ` (${backendSource})`}${RESET}`);
  if (configPath) {
    console.log(`  ${DIM}Config: ${configPath}${RESET}`);
  }
  if (parsed.maskSelectors.length > 0) {
    console.log(`  ${DIM}Mask: ${parsed.maskSelectors.join(", ")}${RESET}`);
  }
  console.log();

  const browser = await captureBackend.launch();
  const results: SnapshotResult[] = [];

  try {
    for (const [index, url] of urls.entries()) {
      const label = labels[index]!;
      console.log(`  ${BOLD}${label}${RESET} ${DIM}(${url})${RESET}`);

      for (const vp of VIEWPORTS) {
        const page = await browser.newPage({ viewport: { width: vp.width, height: vp.height } });
        await page.goto(url, { waitUntil: "networkidle", timeout: 30000 });
        await applyMask(page, parsed.maskSelectors);

        const currentPath = join(outputDir, `${label}-${vp.label}-current.png`);
        await page.screenshot({ path: currentPath, fullPage: true });

        // Save HTML on first viewport only
        if (vp === VIEWPORTS[0]) {
          const html = await page.content();
          await writeFile(join(outputDir, `${label}.html`), html);
        }

        await page.close();

        // Check for previous baseline
        const baselinePath = join(outputDir, `${label}-${vp.label}-baseline.png`);
        let hasBaseline = false;
        try {
          await access(baselinePath);
          hasBaseline = true;
        } catch { /* no baseline */ }

        if (hasBaseline) {
          const snap: VrtSnapshot = {
            testId: `${label}-${vp.label}`,
            testTitle: `${label} ${vp.label}`,
            projectName: "snapshot",
            screenshotPath: currentPath,
            baselinePath,
            status: "changed",
          };
          const diff = await compareScreenshots(snap, { outputDir, threshold: parsed.threshold });
          const diffRatio = diff?.diffRatio ?? 0;

          // Shift detection for enhanced analysis
          const report = diffRatio > 0
            ? await generateDiffReport(snap, { outputDir, detectShift: true, threshold: parsed.threshold })
            : null;
          const globalShift = report?.globalShift ?? 0;
          const compensatedDiffRatio = report ? report.compensatedDiffCount / report.totalPixels : diffRatio;
          const shiftOnly = report?.shiftOnly ?? false;

          let diffStr: string;
          if (diffRatio === 0) {
            diffStr = `${GREEN}0.0%${RESET}`;
          } else if (globalShift !== 0) {
            const rawPct = (diffRatio * 100).toFixed(2);
            const compPct = (compensatedDiffRatio * 100).toFixed(2);
            const color = compensatedDiffRatio < 0.01 ? YELLOW : RED;
            diffStr = `${color}${compPct}%${RESET} ${DIM}(raw ${rawPct}%, shift ${globalShift > 0 ? "+" : ""}${globalShift}px)${RESET}`;
          } else {
            diffStr = `${diffRatio < 0.01 ? YELLOW : RED}${(diffRatio * 100).toFixed(2)}%${RESET}`;
          }

          console.log(`    ${vp.label.padEnd(10)} ${diffStr}`);
          results.push({
            url, label, viewport: vp.label, screenshotPath: currentPath, baselinePath,
            diffRatio, isNew: false, globalShift, compensatedDiffRatio, shiftOnly,
          });
        } else {
          // First run: promote current to baseline
          await copyFile(currentPath, baselinePath);
          console.log(`    ${vp.label.padEnd(10)} ${DIM}(new baseline)${RESET}`);
          results.push({ url, label, viewport: vp.label, screenshotPath: currentPath, isNew: true });
        }
      }
    }
  } finally {
    await captureBackend.close(browser);
  }

  // Summary
  console.log();
  hr();
  console.log();

  const compared = results.filter((r) => !r.isNew);
  const newBaselines = results.filter((r) => r.isNew);
  const falsePositives = compared.filter((r) => (r.diffRatio ?? 0) > 0);

  if (newBaselines.length > 0) {
    console.log(`  ${DIM}New baselines: ${newBaselines.length}${RESET}`);
  }
  if (compared.length > 0) {
    const fpRate = (falsePositives.length / compared.length * 100).toFixed(1);
    console.log(`  Compared: ${compared.length} | Diff > 0: ${falsePositives.length} (${fpRate}%)`);
    if (falsePositives.length > 0) {
      for (const fp of falsePositives) {
        console.log(`    ${RED}${fp.label} ${fp.viewport}: ${((fp.diffRatio ?? 0) * 100).toFixed(2)}%${RESET}`);
      }
    } else {
      console.log(`  ${GREEN}All snapshots match baseline${RESET}`);
    }
  }

  const exitStatus = determineSnapshotExitCode(results, {
    failOnDiff: parsed.failOnDiff,
    failOnNewBaseline: parsed.failOnNewBaseline,
    maxDiffRatio: parsed.maxDiffRatio,
  });

  // Write JSON summary
  await writeFile(
    join(outputDir, "snapshot-report.json"),
    JSON.stringify({
      timestamp: new Date().toISOString(),
      urls,
      labels,
      options: {
        threshold: parsed.threshold,
        failOnDiff: parsed.failOnDiff,
        failOnNewBaseline: parsed.failOnNewBaseline,
        maxDiffRatio: parsed.maxDiffRatio ?? null,
        configPath: configPath ?? null,
      },
      results,
      exitStatus,
    }, null, 2),
  );

  console.log();
  console.log(`  ${DIM}Report: ${join(outputDir, "snapshot-report.json")}${RESET}`);
  if (exitStatus.reasons.length > 0) {
    console.log();
    console.log(`  ${RED}Snapshot failed:${RESET}`);
    for (const reason of exitStatus.reasons) {
      console.log(`    ${RED}- ${reason}${RESET}`);
    }
    process.exitCode = exitStatus.exitCode;
  }
  console.log();
}

if (process.argv[1]?.endsWith("snapshot.ts")) {
  main().catch((e) => { console.error(e); process.exit(1); });
}
