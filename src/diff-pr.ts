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
  resolveA11yPolicy,
  resolveThreshold,
  type DiffPrConfig,
  type DiffPrRoute,
} from "./diff-pr-config.ts";
import { compareScreenshots } from "@mizchi/vlmkit-core/heatmap.ts";
import { runA11yOnPage } from "./a11y-on-page.ts";
import { runMediaVariants, type VariantResult, type MediaVariant } from "@mizchi/vlmkit-markup/stress/media-variants.ts";
import { runCrossBrowser, type EngineName, type EngineResult } from "@mizchi/vlmkit-markup/stress/cross-browser.ts";
import { filterA11yFindings, filterCrossBrowserFindings, filterMediaVariantFindings, loadApprovalManifest, type ApprovalManifest } from "./vrt/snapshot/approval.ts";
import { BOLD, CYAN, DIM, GREEN, RED, RESET, YELLOW } from "@mizchi/vlmkit-core/terminal-colors.ts";
import type { VrtSnapshot } from "@mizchi/vlmkit-core/types.ts";
import type { ContrastFinding } from "@mizchi/vlmkit-core/a11y-contrast.ts";
import type { TouchTargetFinding } from "@mizchi/vlmkit-core/a11y-touch.ts";
import type { FocusOrderFinding } from "@mizchi/vlmkit-core/a11y-focus-order.ts";
import type { SemanticFinding } from "./a11y-semantic-checks.ts";

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
  /**
   * Populated when the project's vrt.config declares an `a11y` block
   * (or the route overrides). Undefined for visual-only gating.
   */
  a11y?: {
    contrastFailures: ContrastFinding[];
    touchFailures: TouchTargetFinding[];
    focusOrderFailures: FocusOrderFinding[];
    semanticFailures: SemanticFinding[];
    maxContrast: number;
    maxTouch: number;
    maxFocusOrder: number;
    maxSemantic: number;
    contrastPass: boolean;
    touchPass: boolean;
    focusOrderPass: boolean;
    semanticPass: boolean;
  };
}

interface PerRouteResult {
  route: DiffPrRoute;
  viewports: PerViewportResult[];
  failed: boolean;
  error?: string;
  /**
   * Media-variants emulation summary. Run once per route at the
   * default viewport when `mediaVariants` is declared in config.
   */
  mediaVariants?: {
    variants: VariantResult[];
    suspectCount: number;
    warnCount: number;
    maxSuspects: number;
    maxWarns: number;
    pass: boolean;
  };
  /**
   * Cross-browser engine comparison summary. Runs once per route at
   * the default viewport when `crossBrowser` is declared.
   */
  crossBrowser?: {
    engines: EngineResult[];
    threshold: number;
    overCount: number;
    skippedCount: number;
    maxOver: number;
    pass: boolean;
  };
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

interface RenderResult {
  contrastFailures: ContrastFinding[];
  touchFailures: TouchTargetFinding[];
  focusOrderFailures: FocusOrderFinding[];
  semanticFailures: SemanticFinding[];
}

async function renderViewport(
  browser: Browser,
  url: string,
  width: number,
  height: number,
  outputPath: string,
  waitFor?: string,
  a11y?: ReturnType<typeof resolveA11yPolicy>,
): Promise<RenderResult> {
  const page = await browser.newPage({ viewport: { width, height } });
  try {
    await page.goto(url, { waitUntil: "networkidle", timeout: 30000 });
    if (waitFor) {
      await page.locator(waitFor).first().waitFor({ state: "visible", timeout: 10000 }).catch(() => {});
    }
    await page.screenshot({ path: outputPath, fullPage: true });
    if (a11y) {
      const r = await runA11yOnPage(page, {
        contrast: a11y.contrast,
        touch: a11y.touch,
        focusOrder: a11y.focusOrder,
        semantic: a11y.semantic,
        touchLevel: a11y.level === "AAA" ? "AAA" : "AA",
      });
      return r;
    }
    return { contrastFailures: [], touchFailures: [], focusOrderFailures: [], semanticFailures: [] };
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
          // a11y is intentionally NOT computed during `pin` — the
          // baseline PNG is what we care about. CI's `vrt diff-pr`
          // (no pin) runs the a11y checks against the live render.
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

  // Optional approval manifest — suppresses both visual (existing
  // tolerance contract) and a11y findings (rules with
  // kind: "a11y-contrast" / "a11y-touch", added by this commit).
  let manifest: ApprovalManifest | null = null;
  if (config.approvalPath) {
    const manifestPath = resolve(configBaseDir(config), config.approvalPath);
    if (existsSync(manifestPath)) {
      try { manifest = await loadApprovalManifest(manifestPath); } catch (err) {
        console.log(`${YELLOW}warn: approval manifest at ${manifestPath} failed to load: ${String(err)}${RESET}`);
      }
    }
  }

  console.log(`${BOLD}${CYAN}vrt diff-pr${RESET}  ${DIM}${configPath}${RESET}`);
  console.log(`${DIM}  ${config.routes.length} route(s); thresholds ${JSON.stringify(config.thresholds)}${RESET}`);
  if (manifest) console.log(`${DIM}  approval manifest: ${manifest.rules.length} rule(s)${RESET}`);
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

      const a11yPolicy = resolveA11yPolicy(config, route);
      const perVp: PerViewportResult[] = [];
      for (const vp of viewports) {
        const baselinePath = join(baselineDir, `${vp.label}.png`);
        if (!existsSync(baselinePath)) continue;
        const variantPath = join(routeOut, `${vp.label}.png`);
        let renderRes: RenderResult;
        try {
          renderRes = await renderViewport(
            browser, route.url, vp.width, vp.height,
            variantPath, route.waitFor, a11yPolicy,
          );
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
        const visualPass = diffRatio <= threshold;
        let a11y: PerViewportResult["a11y"];
        let a11yPass = true;
        if (a11yPolicy) {
          const maxContrast = a11yPolicy.maxContrastFailures ?? 0;
          const maxTouch = a11yPolicy.maxTouchFailures ?? 0;
          const maxFocusOrder = a11yPolicy.maxFocusOrderFailures ?? 0;
          const contrastSet = filterA11yFindings(renderRes.contrastFailures, manifest, "a11y-contrast");
          const touchSet = filterA11yFindings(renderRes.touchFailures, manifest, "a11y-touch");
          // Focus-order findings use `from`/`to` indices, not a
          // `path` — filterA11yFindings expects a `path` shape. We
          // synthesize a path-like message field for filtering.
          const focusOrderForFilter = renderRes.focusOrderFailures.map((f) => ({
            ...f,
            // Manifest matchers run substring against `path`; use the
            // message which contains the affected selector(s).
            path: f.message,
          }));
          const focusOrderSet = filterA11yFindings(focusOrderForFilter, manifest, "a11y-focus-order");
          const focusOrderKept = focusOrderSet.kept.map(({ path: _, ...rest }) => rest as FocusOrderFinding);
          const semanticSet = filterA11yFindings(renderRes.semanticFailures, manifest, "a11y-semantic");
          const maxSemantic = a11yPolicy.maxSemanticFailures ?? 0;
          const contrastPass = contrastSet.kept.length <= maxContrast;
          const touchPass = touchSet.kept.length <= maxTouch;
          const focusOrderPass = focusOrderKept.length <= maxFocusOrder;
          const semanticPass = semanticSet.kept.length <= maxSemantic;
          a11y = {
            contrastFailures: contrastSet.kept,
            touchFailures: touchSet.kept,
            focusOrderFailures: focusOrderKept,
            semanticFailures: semanticSet.kept,
            maxContrast,
            maxTouch,
            maxFocusOrder,
            maxSemantic,
            contrastPass,
            touchPass,
            focusOrderPass,
            semanticPass,
          };
          a11yPass = contrastPass && touchPass && focusOrderPass && semanticPass;
        }
        perVp.push({
          viewport: vp.label,
          diffRatio,
          diffPixels,
          totalPixels,
          threshold,
          pass: visualPass && a11yPass,
          baselinePath,
          variantPath,
          heatmapPath: diff?.heatmapPath,
          a11y,
        });
      }

      // Media variants — run ONCE per route at default desktop
      // viewport when `mediaVariants` is declared. Each variant
      // counts toward the route's pass/fail.
      let mediaVariantsResult: PerRouteResult["mediaVariants"];
      if (config.mediaVariants) {
        const mvDir = resolve(routeOut, "media-variants");
        const variants = config.mediaVariants.variants as MediaVariant[] | undefined;
        const maxSuspects = config.mediaVariants.maxSuspects ?? 0;
        const maxWarns = config.mediaVariants.maxWarns ?? 5;
        try {
          const mv = await runMediaVariants({
            source: route.url,
            outputDir: mvDir,
            viewport: { width: 1280, height: 720 },
            variants,
            threshold: config.mediaVariants.threshold ?? 0.03,
          });
          // Apply manifest suppression on the variant verdicts.
          // Rules with kind: "media-variant" + selector: <variant-name>
          // demote the matching finding's verdict to "ok" so the
          // gate doesn't count it.
          const filtered = filterMediaVariantFindings(mv.variants, manifest);
          const suspectCount = filtered.kept.filter((v) => v.verdict === "suspect").length;
          const warnCount = filtered.kept.filter((v) => v.verdict === "warn").length;
          mediaVariantsResult = {
            variants: filtered.kept,
            suspectCount,
            warnCount,
            maxSuspects,
            maxWarns,
            pass: suspectCount <= maxSuspects && warnCount <= maxWarns,
          };
        } catch (err) {
          console.log(`  ${YELLOW}media-variants error (${route.name}): ${String(err)}${RESET}`);
        }
      }

      // Cross-browser engine comparison. Once per route at default
      // desktop viewport. Engines that fail to launch (often firefox
      // /webkit on minimal CI runners) auto-skip; allowSkipped=true
      // by default so missing engines don't fail the build.
      let crossBrowserResult: PerRouteResult["crossBrowser"];
      if (config.crossBrowser) {
        const xbDir = resolve(routeOut, "cross-browser");
        const threshold = config.crossBrowser.threshold ?? 0.03;
        const maxOver = config.crossBrowser.maxOver ?? 0;
        const allowSkipped = config.crossBrowser.allowSkipped ?? true;
        try {
          const xb = await runCrossBrowser({
            source: route.url,
            outputDir: xbDir,
            viewport: { width: 1280, height: 720 },
            engines: config.crossBrowser.engines as EngineName[] | undefined,
            threshold,
            allowSkipped,
          });
          // Manifest can suppress per-engine failures
          // (kind: "cross-browser", selector: "firefox").
          const filtered = filterCrossBrowserFindings(xb.engines, manifest);
          const overCount = filtered.kept.filter(
            (e) => e.status === "ok" && e.deltaRatio > threshold,
          ).length;
          const skippedCount = filtered.kept.filter((e) => e.status === "skipped").length;
          const skipFails = !allowSkipped && skippedCount > 0;
          crossBrowserResult = {
            engines: filtered.kept,
            threshold,
            overCount,
            skippedCount,
            maxOver,
            pass: overCount <= maxOver && !skipFails,
          };
        } catch (err) {
          console.log(`  ${YELLOW}cross-browser error (${route.name}): ${String(err)}${RESET}`);
        }
      }

      const visualFailed = perVp.some((v) => !v.pass);
      const mvFailed = mediaVariantsResult ? !mediaVariantsResult.pass : false;
      const xbFailed = crossBrowserResult ? !crossBrowserResult.pass : false;
      const failed = visualFailed || mvFailed || xbFailed;
      const status = failed ? `${RED}FAIL${RESET}` : `${GREEN}pass${RESET}`;
      const breakdown = perVp.map((v) => {
        const tag = v.pass ? GREEN : RED;
        const a11ySuffix = v.a11y
          ? ` ${DIM}[a11y c=${v.a11y.contrastFailures.length}/t=${v.a11y.touchFailures.length}/f=${v.a11y.focusOrderFailures.length}/s=${v.a11y.semanticFailures.length}]${RESET}`
          : "";
        return `${tag}${v.viewport}=${pctStr(v.diffRatio)}${RESET}${a11ySuffix}`;
      }).join(" ");
      const mvSuffix = mediaVariantsResult
        ? ` ${DIM}[mv suspect=${mediaVariantsResult.suspectCount}/${mediaVariantsResult.maxSuspects} warn=${mediaVariantsResult.warnCount}/${mediaVariantsResult.maxWarns}]${RESET}`
        : "";
      const xbSuffix = crossBrowserResult
        ? ` ${DIM}[xb over=${crossBrowserResult.overCount}/${crossBrowserResult.maxOver} skip=${crossBrowserResult.skippedCount}]${RESET}`
        : "";
      console.log(`  ${route.name.padEnd(20)} ${status}  ${breakdown}${mvSuffix}${xbSuffix}`);
      results.push({
        route, viewports: perVp, failed,
        mediaVariants: mediaVariantsResult,
        crossBrowser: crossBrowserResult,
      });
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
  const anyA11y = results.some((r) => r.viewports.some((v) => v.a11y));
  if (anyA11y) {
    lines.push("| route | viewport | diff% | threshold | a11y (contrast / touch / focus / semantic) | status |");
    lines.push("|---|---|---|---|---|---|");
  } else {
    lines.push("| route | viewport | diff% | threshold | status |");
    lines.push("|---|---|---|---|---|");
  }
  for (const r of results) {
    if (r.viewports.length === 0) {
      const filler = anyA11y ? " | —" : "";
      lines.push(`| \`${r.route.name}\` | — | — | —${filler} | ❌ ${r.error ?? "no result"} |`);
      continue;
    }
    for (const vp of r.viewports) {
      const icon = vp.pass ? "✅" : "❌";
      if (anyA11y) {
        const a11yCell = vp.a11y
          ? `${vp.a11y.contrastFailures.length}/${vp.a11y.maxContrast} · ${vp.a11y.touchFailures.length}/${vp.a11y.maxTouch} · ${vp.a11y.focusOrderFailures.length}/${vp.a11y.maxFocusOrder} · ${vp.a11y.semanticFailures.length}/${vp.a11y.maxSemantic}`
          : "—";
        lines.push(`| \`${r.route.name}\` | ${vp.viewport} | ${pctStr(vp.diffRatio)} | ${pctStr(vp.threshold)} | ${a11yCell} | ${icon} |`);
      } else {
        lines.push(`| \`${r.route.name}\` | ${vp.viewport} | ${pctStr(vp.diffRatio)} | ${pctStr(vp.threshold)} | ${icon} |`);
      }
    }
  }
  // Surface the worst visual offenders for quick eyeballing.
  const overThreshold = results
    .flatMap((r) => r.viewports
      .filter((v) => v.diffRatio > v.threshold)
      .map((v) => ({ route: r.route.name, vp: v })))
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

  // A11y findings — list contrast / touch failures when the gate fired.
  const a11yFailRows: Array<{ route: string; vp: PerViewportResult }> = [];
  for (const r of results) {
    for (const v of r.viewports) {
      if (v.a11y && (!v.a11y.contrastPass || !v.a11y.touchPass || !v.a11y.focusOrderPass || !v.a11y.semanticPass)) {
        a11yFailRows.push({ route: r.route.name, vp: v });
      }
    }
  }
  if (a11yFailRows.length > 0) {
    lines.push("");
    lines.push("## A11y failures");
    lines.push("");
    for (const { route, vp } of a11yFailRows.slice(0, 5)) {
      if (vp.a11y && !vp.a11y.contrastPass) {
        const top = vp.a11y.contrastFailures.slice(0, 3)
          .map((f) => `\`${f.path}\` ${f.ratio.toFixed(2)}:1 (need ${f.requiredAA})`)
          .join("; ");
        lines.push(`- \`${route}\` / ${vp.viewport} — **contrast** ${vp.a11y.contrastFailures.length} > ${vp.a11y.maxContrast}: ${top}`);
      }
      if (vp.a11y && !vp.a11y.touchPass) {
        const top = vp.a11y.touchFailures.slice(0, 3)
          .map((f) => `\`${f.path}\` ${f.minSide}px < ${f.required}px`)
          .join("; ");
        lines.push(`- \`${route}\` / ${vp.viewport} — **touch** ${vp.a11y.touchFailures.length} > ${vp.a11y.maxTouch}: ${top}`);
      }
      if (vp.a11y && !vp.a11y.focusOrderPass) {
        const top = vp.a11y.focusOrderFailures.slice(0, 3)
          .map((f) => `${f.kind} (step ${f.fromIndex}→${f.toIndex})`)
          .join("; ");
        lines.push(`- \`${route}\` / ${vp.viewport} — **focus-order** ${vp.a11y.focusOrderFailures.length} > ${vp.a11y.maxFocusOrder}: ${top}`);
      }
      if (vp.a11y && !vp.a11y.semanticPass) {
        const top = vp.a11y.semanticFailures.slice(0, 3)
          .map((f) => `[${f.kind}] \`${f.path}\``)
          .join("; ");
        lines.push(`- \`${route}\` / ${vp.viewport} — **semantic** ${vp.a11y.semanticFailures.length} > ${vp.a11y.maxSemantic}: ${top}`);
      }
    }
  }

  // Cross-browser failures section.
  const xbFailRows = results.filter((r) => r.crossBrowser && !r.crossBrowser.pass);
  if (xbFailRows.length > 0) {
    lines.push("");
    lines.push("## Cross-browser failures");
    lines.push("");
    for (const r of xbFailRows) {
      const xb = r.crossBrowser!;
      lines.push(`- \`${r.route.name}\` — over ${xb.overCount}/${xb.maxOver} (threshold ${pctStr(xb.threshold)})`);
      for (const e of xb.engines.slice(0, 5)) {
        if (e.status === "ok" && e.deltaRatio > xb.threshold) {
          lines.push(`  - **${e.engine}** (${e.status}): Δ ${pctStr(e.deltaRatio)} > ${pctStr(xb.threshold)}`);
        } else if (e.status === "failed") {
          lines.push(`  - **${e.engine}** (${e.status}): ${e.error ?? "launch failed"}`);
        }
      }
    }
  }

  // Media-variants failures section.
  const mvFailRows = results.filter((r) => r.mediaVariants && !r.mediaVariants.pass);
  if (mvFailRows.length > 0) {
    lines.push("");
    lines.push("## Media-variant failures");
    lines.push("");
    for (const r of mvFailRows) {
      const mv = r.mediaVariants!;
      const offenders = mv.variants.filter((v) => v.verdict === "suspect" || v.verdict === "warn");
      lines.push(`- \`${r.route.name}\` — suspect ${mv.suspectCount}/${mv.maxSuspects}, warn ${mv.warnCount}/${mv.maxWarns}`);
      for (const v of offenders.slice(0, 5)) {
        lines.push(`  - **${v.variant}** (${v.verdict}): ${v.note}`);
      }
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

const isCliEntry = process.env.__VRT_DISPATCHER_LEAF__ === "diff-pr" || (process.argv[1]
  && new URL(import.meta.url).pathname === process.argv[1]);
if (isCliEntry) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}

export { main };
