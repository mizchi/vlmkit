#!/usr/bin/env node
/**
 * `vrt diff-pr` — CI-mode runner. Walks the declared route set,
 * compares each route's current rendering against a pinned baseline
 * PNG, applies the per-route diff-ratio policy, and exits non-zero on
 * any uncovered breach.
 *
 * Two subcommands:
 *   vrt diff-pr pin [--config vrt.config.json]
 *     Capture baselines for every declared route into
 *     <baselineDir>/<route>/<viewport>.png. Run once on main when the
 *     design is intended; downstream PRs gate against these PNGs.
 *
 *   vrt diff-pr [--config vrt.config.json] [--output <dir>]
 *     For each route, render the current state at every viewport,
 *     pixel-diff against the pinned PNG, apply the per-route policy.
 *     Emit a markdown summary suitable for pasting into a PR comment.
 *     Exit non-zero on any uncovered breach.
 *
 * Stays narrow: uses Playwright directly + the existing
 * `compareScreenshots` helper, NOT the full migration-compare
 * pipeline. The richer wireframe-suggestions / palette-diff signals
 * are still available via `vrt compare` / `vrt watch` for the
 * development loop; this is the policy gate.
 */

import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { mkdir, readdir, readFile, rm, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { chromium, type Browser } from "playwright";
import {
  configBaseDir,
  findConfigPath,
  loadDiffPrConfig,
  resolveThreshold,
  type DiffPrConfig,
  type DiffPrRoute,
} from "./diff-pr-config.ts";
import { compareScreenshots } from "./heatmap.ts";
import { BOLD, CYAN, DIM, GREEN, RED, RESET, YELLOW } from "./terminal-colors.ts";
import type { VrtSnapshot } from "./types.ts";

// Same defaults as migration-compare's STATIC_VIEWPORTS so a baseline
// pinned with one CLI is comparable with the other.
const DEFAULT_VIEWPORTS: Array<{ label: string; width: number; height: number }> = [
  { label: "mobile", width: 375, height: 812 },
  { label: "desktop", width: 1280, height: 900 },
  { label: "wide", width: 1440, height: 900 },
];

interface PerViewportResult {
  viewport: string;
  diffRatio: number;
  diffPixels: number;
  totalPixels: number;
  threshold: number;
  pass: boolean;
  baselinePath?: string;
  variantPath?: string;
  heatmapPath?: string;
}

interface PerRouteResult {
  route: DiffPrRoute;
  viewports: PerViewportResult[];
  failed: boolean;
  error?: string;
}

function getArg(args: string[], name: string): string | undefined {
  const i = args.indexOf(`--${name}`);
  if (i < 0 || i === args.length - 1) return undefined;
  const v = args[i + 1];
  return v.startsWith("--") ? undefined : v;
}

function pctStr(n: number): string {
  return `${(n * 100).toFixed(2)}%`;
}

function baselineDirForRoute(config: DiffPrConfig, route: DiffPrRoute): string {
  return resolve(configBaseDir(config), config.baselineDir, route.name);
}

function viewportSpecsFor(config: DiffPrConfig): Array<{ label: string; width: number; height: number }> {
  if (!config.viewports || config.viewports.length === 0) return DEFAULT_VIEWPORTS;
  const out: Array<{ label: string; width: number; height: number }> = [];
  for (const name of config.viewports) {
    const match = DEFAULT_VIEWPORTS.find((v) => v.label === name);
    if (match) out.push(match);
  }
  return out.length > 0 ? out : DEFAULT_VIEWPORTS;
}

async function renderViewport(
  browser: Browser,
  url: string,
  width: number,
  height: number,
  outputPath: string,
  waitFor?: string,
): Promise<void> {
  const page = await browser.newPage({ viewport: { width, height } });
  try {
    await page.goto(url, { waitUntil: "networkidle", timeout: 30000 });
    if (waitFor) {
      await page.locator(waitFor).first().waitFor({ state: "visible", timeout: 10000 }).catch(() => {});
    }
    await page.screenshot({ path: outputPath, fullPage: true });
  } finally {
    await page.close();
  }
}

async function cmdPin(args: string[]): Promise<void> {
  const cwd = process.cwd();
  const configPath = findConfigPath(cwd, getArg(args, "config"));
  if (!configPath) {
    console.error(`${RED}error:${RESET} no vrt.config.json found (and --config not given)`);
    process.exit(1);
  }
  const config = loadDiffPrConfig(configPath);

  // Filter to specific routes if any positional arguments were given.
  // Unknown route names are an error so a typo doesn't silently
  // refresh nothing.
  const requested = args.filter((a) => !a.startsWith("--"));
  // Strip --flag value pairs from `requested`.
  const flaggedValues = new Set<string>();
  for (let i = 0; i < args.length; i++) {
    if (args[i].startsWith("--") && i + 1 < args.length && !args[i + 1].startsWith("--")) {
      flaggedValues.add(args[i + 1]);
    }
  }
  const requestedRouteNames = requested.filter((r) => !flaggedValues.has(r));
  let routesToPin = config.routes;
  if (requestedRouteNames.length > 0) {
    const unknown = requestedRouteNames.filter((n) => !config.routes.some((r) => r.name === n));
    if (unknown.length > 0) {
      console.error(`${RED}error:${RESET} unknown route(s): ${unknown.join(", ")}`);
      console.error(`Known routes: ${config.routes.map((r) => r.name).join(", ")}`);
      process.exit(1);
    }
    routesToPin = config.routes.filter((r) => requestedRouteNames.includes(r.name));
  }

  console.log(`${BOLD}${CYAN}vrt diff-pr pin${RESET}  ${DIM}${configPath}${RESET}`);
  const scopeNote = routesToPin.length === config.routes.length
    ? `pinning ${routesToPin.length} route(s)`
    : `pinning ${routesToPin.length} of ${config.routes.length} route(s) (${routesToPin.map((r) => r.name).join(", ")}); other baselines untouched`;
  console.log(`${DIM}  ${scopeNote} into ${config.baselineDir}/${RESET}`);
  console.log();

  const viewports = viewportSpecsFor(config);
  const browser = await chromium.launch();
  try {
    for (const route of routesToPin) {
      process.stdout.write(`  ${route.name.padEnd(20)} ${DIM}${route.url}${RESET} ...`);
      const dir = baselineDirForRoute(config, route);
      // Clean only this route's dir so other routes' baselines stay
      // untouched (the partial-pin use case).
      if (existsSync(dir)) await rm(dir, { recursive: true });
      await mkdir(dir, { recursive: true });
      let success = 0;
      for (const vp of viewports) {
        try {
          await renderViewport(browser, route.url, vp.width, vp.height, join(dir, `${vp.label}.png`), route.waitFor);
          success++;
        } catch (err) {
          console.log(`\n    ${RED}${vp.label}: ${String(err)}${RESET}`);
        }
      }
      console.log(` ${GREEN}ok${RESET} ${DIM}(${success}/${viewports.length} viewport(s))${RESET}`);
    }
  } finally {
    await browser.close();
  }
  console.log();
  console.log(`${DIM}Baselines pinned. Run \`vrt diff-pr\` in CI to gate against them.${RESET}`);
}

async function cmdRun(args: string[]): Promise<number> {
  const cwd = process.cwd();
  const configPath = findConfigPath(cwd, getArg(args, "config"));
  if (!configPath) {
    console.error(`${RED}error:${RESET} no vrt.config.json found (and --config not given)`);
    return 1;
  }
  const config = loadDiffPrConfig(configPath);
  const outputDir = resolve(cwd, getArg(args, "output") ?? ".vrt/runs/diff-pr");
  await mkdir(outputDir, { recursive: true });

  console.log(`${BOLD}${CYAN}vrt diff-pr${RESET}  ${DIM}${configPath}${RESET}`);
  console.log(`${DIM}  ${config.routes.length} route(s); thresholds ${JSON.stringify(config.thresholds)}${RESET}`);
  console.log();

  const viewports = viewportSpecsFor(config);
  const results: PerRouteResult[] = [];
  const browser = await chromium.launch();

  try {
    for (const route of config.routes) {
      const baselineDir = baselineDirForRoute(config, route);
      if (!existsSync(baselineDir)) {
        console.log(`  ${route.name.padEnd(20)} ${RED}no baseline${RESET} ${DIM}(${baselineDir} — run \`vrt diff-pr pin\` first)${RESET}`);
        results.push({ route, viewports: [], failed: true, error: `no baseline at ${baselineDir}` });
        continue;
      }
      const pinned = (await readdir(baselineDir)).filter((f) => f.endsWith(".png"));
      if (pinned.length === 0) {
        console.log(`  ${route.name.padEnd(20)} ${RED}no PNGs in baseline dir${RESET}`);
        results.push({ route, viewports: [], failed: true, error: "no pinned PNGs" });
        continue;
      }

      const routeOut = resolve(outputDir, route.name);
      await mkdir(routeOut, { recursive: true });

      const perVp: PerViewportResult[] = [];
      for (const vp of viewports) {
        const baselinePath = join(baselineDir, `${vp.label}.png`);
        if (!existsSync(baselinePath)) continue;
        const variantPath = join(routeOut, `${vp.label}.png`);
        try {
          await renderViewport(browser, route.url, vp.width, vp.height, variantPath, route.waitFor);
        } catch (err) {
          perVp.push({
            viewport: vp.label,
            diffRatio: 1,
            diffPixels: 0,
            totalPixels: 0,
            threshold: resolveThreshold(config, route, vp.label),
            pass: false,
          });
          console.log(`  ${route.name.padEnd(20)} ${vp.label} ${RED}render error: ${String(err)}${RESET}`);
          continue;
        }
        const snap: VrtSnapshot = {
          testId: `${route.name}-${vp.label}`,
          testTitle: `${route.name} ${vp.label}`,
          projectName: "diff-pr",
          screenshotPath: variantPath,
          baselinePath,
          status: "changed",
        };
        const diff = await compareScreenshots(snap, { outputDir: routeOut });
        const diffRatio = diff?.diffRatio ?? 0;
        const diffPixels = diff?.diffPixels ?? 0;
        const totalPixels = diff?.totalPixels ?? 0;
        const threshold = resolveThreshold(config, route, vp.label);
        perVp.push({
          viewport: vp.label,
          diffRatio,
          diffPixels,
          totalPixels,
          threshold,
          pass: diffRatio <= threshold,
          baselinePath,
          variantPath,
          heatmapPath: diff?.heatmapPath,
        });
      }

      const failed = perVp.some((v) => !v.pass);
      const status = failed ? `${RED}FAIL${RESET}` : `${GREEN}pass${RESET}`;
      const breakdown = perVp.map((v) => {
        const tag = v.pass ? GREEN : RED;
        return `${tag}${v.viewport}=${pctStr(v.diffRatio)}${RESET}`;
      }).join(" ");
      console.log(`  ${route.name.padEnd(20)} ${status}  ${breakdown}`);
      results.push({ route, viewports: perVp, failed });
    }
  } finally {
    await browser.close();
  }

  const summary = buildMarkdownSummary(config, results);
  const summaryPath = resolve(outputDir, "summary.md");
  await writeFile(summaryPath, summary);

  const anyFail = results.some((r) => r.failed);
  console.log();
  console.log(`${DIM}Summary written to ${summaryPath}${RESET}`);
  if (anyFail) {
    console.log(`${RED}${BOLD}FAIL${RESET} — at least one route over threshold or missing baseline.`);
    return 1;
  }
  console.log(`${GREEN}${BOLD}PASS${RESET} — all routes within threshold.`);
  return 0;
}

export function buildMarkdownSummary(config: DiffPrConfig, results: PerRouteResult[]): string {
  const lines: string[] = [];
  lines.push("# vrt diff-pr summary");
  lines.push("");
  const totalRoutes = results.length;
  const failed = results.filter((r) => r.failed).length;
  const overall = failed === 0 ? "**PASS**" : `**FAIL** (${failed} of ${totalRoutes} route(s))`;
  lines.push(`Status: ${overall}`);
  if (config.configPath) lines.push(`Config: \`${config.configPath}\``);
  lines.push("");
  lines.push("| route | viewport | diff% | threshold | status |");
  lines.push("|---|---|---|---|---|");
  for (const r of results) {
    if (r.viewports.length === 0) {
      lines.push(`| \`${r.route.name}\` | — | — | — | ❌ ${r.error ?? "no result"} |`);
      continue;
    }
    for (const vp of r.viewports) {
      const icon = vp.pass ? "✅" : "❌";
      lines.push(`| \`${r.route.name}\` | ${vp.viewport} | ${pctStr(vp.diffRatio)} | ${pctStr(vp.threshold)} | ${icon} |`);
    }
  }
  // Surface the worst offenders for quick eyeballing.
  const overThreshold = results
    .flatMap((r) => r.viewports.filter((v) => !v.pass).map((v) => ({ route: r.route.name, vp: v })))
    .sort((a, b) => (b.vp.diffRatio - b.vp.threshold) - (a.vp.diffRatio - a.vp.threshold))
    .slice(0, 5);
  if (overThreshold.length > 0) {
    lines.push("");
    lines.push("## Worst offenders");
    lines.push("");
    for (const o of overThreshold) {
      const over = (o.vp.diffRatio - o.vp.threshold) * 100;
      lines.push(`- \`${o.route}\` / ${o.vp.viewport}: ${pctStr(o.vp.diffRatio)} ` +
        `(${over.toFixed(2)}pp over threshold ${pctStr(o.vp.threshold)})`);
    }
  }
  lines.push("");
  return lines.join("\n");
}

function ghAvailable(): boolean {
  const r = spawnSync("gh", ["--version"], { stdio: "ignore" });
  return r.status === 0;
}

interface PostPrOptions {
  prRef: string;
  summaryPath: string;
  marker: string;
}

/**
 * Post the markdown summary as a PR comment. Strategy:
 *   1. If `gh` CLI is on PATH, use `gh pr comment <ref> --body-file
 *      <summary>` (overwrites any prior vrt-marked comment via the
 *      `marker` HTML comment).
 *   2. Otherwise print the markdown with copy-paste instructions
 *      so the operator can post it manually. Returns the exit code
 *      from gh on success, 0 when we successfully printed the
 *      fallback, or 1 on a hard error.
 */
async function postPrComment(opts: PostPrOptions): Promise<number> {
  if (!existsSync(opts.summaryPath)) {
    console.error(`${RED}error:${RESET} no summary at ${opts.summaryPath}`);
    console.error(`Run \`vrt diff-pr\` first to produce the summary, or pass --summary <path>.`);
    return 1;
  }
  const summary = await readFile(opts.summaryPath, "utf-8");
  // Tag the comment so we (or the operator) can find it later for an
  // overwrite. `gh pr comment` doesn't natively support edit-in-place,
  // but the marker at least makes the comment recognizable.
  const body = `<!-- ${opts.marker} -->\n${summary}`;
  const decoratedPath = `${opts.summaryPath}.posted.md`;
  await writeFile(decoratedPath, body);

  if (!ghAvailable()) {
    console.log(`${YELLOW}gh CLI not available — printing markdown for manual posting.${RESET}`);
    console.log(`${DIM}Target PR: ${opts.prRef}${RESET}`);
    console.log(`${DIM}Marker:    ${opts.marker} (use to locate / overwrite later)${RESET}`);
    console.log(`${DIM}File:      ${decoratedPath}${RESET}`);
    console.log();
    console.log(`Once gh is installed (or pasted by hand):`);
    console.log(`  gh pr comment ${opts.prRef} --body-file ${decoratedPath}`);
    console.log();
    console.log(`Or paste the contents below:`);
    console.log(`${DIM}─────────────────────────────────────────────────────${RESET}`);
    process.stdout.write(body);
    console.log(`${DIM}─────────────────────────────────────────────────────${RESET}`);
    return 0;
  }

  const result = spawnSync(
    "gh",
    ["pr", "comment", opts.prRef, "--body-file", decoratedPath],
    { stdio: "inherit" },
  );
  if (result.status !== 0) {
    console.error(`${RED}gh pr comment failed (exit ${result.status}).${RESET}`);
    console.error(`Body left at ${decoratedPath} for manual retry.`);
    return result.status ?? 1;
  }
  console.log(`${GREEN}✓${RESET} posted summary to PR ${opts.prRef}`);
  return 0;
}

async function cmdPost(args: string[]): Promise<number> {
  const prRef = getArg(args, "pr");
  if (!prRef) {
    console.error(`${RED}error:${RESET} --pr <ref> is required (e.g. owner/repo#123 or 123 inside the repo)`);
    return 1;
  }
  const cwd = process.cwd();
  const summaryFlag = getArg(args, "summary");
  const summaryPath = summaryFlag
    ? resolve(cwd, summaryFlag)
    : resolve(cwd, ".vrt/runs/diff-pr/summary.md");
  const marker = getArg(args, "marker") ?? "vrt-diff-pr-summary";
  return postPrComment({ prRef, summaryPath, marker });
}

function formatUsage(): string {
  return `vrt diff-pr <command>

Subcommands:
  pin    [route...] [--config vrt.config.json]
                              Capture baseline PNGs for declared routes.
                              No positional args → pin every route.
                              Positional names → pin only those, leave
                              the rest untouched (partial refresh).
  post   --pr <ref> [--summary <path>] [--marker <id>]
                              Post the most recent summary.md to a PR
                              via gh CLI. Falls back to printing the
                              markdown with copy-paste instructions
                              when gh is not on PATH.
  (none) [--config vrt.config.json] [--output <dir>]
                              Diff every route's current rendering
                              against its pinned baseline; apply
                              per-route thresholds; emit markdown.
                              Exit non-zero on any breach.

Config (vrt.config.json):
  {
    "baseUrl": "http://localhost:3000",
    "thresholds": { "mobile": 0.01, "desktop": 0.005, "wide": 0.005 },
    "baselineDir": ".vrt/baselines",
    "routes": [
      "/",
      { "name": "admin", "path": "/admin",
        "thresholds": { "mobile": 0.03 } }
    ]
  }`;
}

async function main(argv = process.argv.slice(2)) {
  const command = argv[0];
  if (command === "help" || command === "--help" || command === "-h") {
    console.log(formatUsage());
    return;
  }
  if (command === "pin") {
    await cmdPin(argv.slice(1));
    return;
  }
  if (command === "post") {
    const code = await cmdPost(argv.slice(1));
    if (code !== 0) process.exit(code);
    return;
  }
  // No subcommand or any other flags → diff run.
  const code = await cmdRun(argv);
  if (code !== 0) process.exit(code);
}

const isCliEntry = process.argv[1]
  && new URL(import.meta.url).pathname === process.argv[1];
if (isCliEntry) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}

export { main };
