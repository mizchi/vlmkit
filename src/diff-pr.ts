#!/usr/bin/env node
/**
 * `vlmkit diff-pr` — CI-mode runner. Walks the declared route set,
 * compares each route's current rendering against a pinned baseline
 * PNG, applies the per-route diff-ratio policy, and exits non-zero on
 * any uncovered breach.
 *
 * Two subcommands:
 *   vlmkit diff-pr pin [--config vlmkit.config.json]
 *     Capture baselines for every declared route into
 *     <baselineDir>/<route>/<viewport>.png. Run once on main when the
 *     design is intended; downstream PRs gate against these PNGs.
 *
 *   vlmkit diff-pr [--config vlmkit.config.json] [--output <dir>]
 *     For each route, render the current state at every viewport,
 *     pixel-diff against the pinned PNG, apply the per-route policy.
 *     Emit a markdown summary suitable for pasting into a PR comment.
 *     Exit non-zero on any uncovered breach.
 *
 * Both accept `--from-png <file>` / `--from-dir <dir>` in place of the
 * browser render, for projects whose frames exist as PNGs but have no
 * openable URL (canvas/WebGPU engines — see baseline-from-png.ts for the
 * file→route rule and what the no-browser path cannot do).
 *
 * Stays narrow: uses Playwright directly + the existing
 * `compareScreenshots` helper, NOT the full migration-compare
 * pipeline. The richer wireframe-suggestions / palette-diff signals
 * are still available via `vlmkit diff html` / `vlmkit watch` for the
 * development loop; this is the policy gate.
 */

import { spawnSync } from "node:child_process";
import { handleCliError } from "@mizchi/vlmkit-core/cli-error.ts";
import { readFlag } from "@mizchi/vlmkit-core/arg-reader.ts";
import { isCliEntry } from "@mizchi/vlmkit-core/plugin/cli-entry.ts";
import { existsSync } from "node:fs";
import { copyFile, mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { type Browser } from "playwright";
import {
  configBaseDir,
  findConfigPath,
  loadDiffPrConfig,
  resolveA11yPolicy,
  resolveThreshold,
  type DiffPrConfig,
  type DiffPrRoute,
} from "./diff-pr-config.ts";
import { clearRouteBaselinePngs, pinPngSources, resolvePngSources, type PngSource } from "./baseline-from-png.ts";
import { compareScreenshots } from "@mizchi/vlmkit-core/heatmap.ts";
import { runA11yOnPage } from "./a11y-on-page.ts";
import { runMediaVariants, type VariantResult, type MediaVariant } from "@mizchi/vlmkit-markup/stress/media-variants.ts";
import { runCrossBrowser, type EngineName, type EngineResult } from "@mizchi/vlmkit-markup/stress/cross-browser.ts";
import { filterA11yFindings, filterApprovedVrtRegions, filterCrossBrowserFindings, filterMediaVariantFindings, loadApprovalManifest, type ApprovalManifest } from "./vrt/snapshot/approval.ts";
import { BOLD, CYAN, DIM, GREEN, RED, RESET, YELLOW } from "@mizchi/vlmkit-core/terminal-colors.ts";
import type { VrtSnapshot } from "@mizchi/vlmkit-core/types.ts";
import type { ContrastFinding } from "@mizchi/vlmkit-markup/a11y-contrast.ts";
import type { TouchTargetFinding } from "@mizchi/vlmkit-markup/a11y-touch.ts";
import type { FocusOrderFinding } from "@mizchi/vlmkit-markup/a11y-focus-order.ts";
import type { SemanticFinding } from "./a11y-semantic-checks.ts";
import { launchBrowser, withBrowser } from "@mizchi/vlmkit-core/browser-launch.ts";

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
   * Populated when the project's vlmkit config declares an `a11y` block
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
   * Declared viewports with no baseline PNG to compare against.
   *
   * These used to be a bare `continue`, and `perVp.some((v) => !v.pass)` is `false`
   * for an empty array — so a route whose baselines did not cover its viewports
   * PASSED, having compared nothing. Measured: two declared viewports, one baseline
   * deleted, the current PNG for the unpinned one 100% different (red against green),
   * and the gate printed `home pass a=0.00%` / `PASS` / exit 0 without naming the
   * second viewport at all. With a stray PNG under a renamed label so the
   * `pinned.length === 0` check passes, ZERO pixels were compared and it still said
   * pass.
   *
   * This is not a breach — nothing was measured, which is worse — so it is reported
   * as its own thing and fails the route, the same way a missing baseline
   * *directory* already did.
   */
  unpinned?: string[];
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

function pctStr(n: number): string {
  return `${(n * 100).toFixed(2)}%`;
}

function baselineDirForRoute(config: DiffPrConfig, route: DiffPrRoute): string {
  return resolve(configBaseDir(config), config.baselineDir, route.name);
}

function baselineRootFor(config: DiffPrConfig): string {
  return resolve(configBaseDir(config), config.baselineDir);
}

/**
 * The `--from-png` / `--from-dir` flag set, shared by `pin` and the diff run.
 * `active` is what both commands branch on to skip Playwright entirely — the
 * reporting project's browser cannot produce a usable canvas frame at all, so
 * launching one would only cost time and then fail.
 */
interface FileSourceFlags {
  active: boolean;
  fromDir?: string;
  fromPng?: string;
  routeOverride?: string;
  viewportOverride?: string;
}

function fileSourceFlags(args: string[]): FileSourceFlags {
  const fromDir = readFlag(args, "from-dir");
  const fromPng = readFlag(args, "from-png");
  return {
    active: Boolean(fromDir || fromPng),
    fromDir,
    fromPng,
    routeOverride: readFlag(args, "route"),
    viewportOverride: readFlag(args, "viewport"),
  };
}

/** Positional route names, with `--flag value` pairs stripped out. */
function positionalRouteNames(args: string[]): string[] {
  const flaggedValues = new Set<string>();
  for (let i = 0; i < args.length; i++) {
    if (args[i].startsWith("--") && i + 1 < args.length && !args[i + 1].startsWith("--")) {
      flaggedValues.add(args[i + 1]);
    }
  }
  return args.filter((a) => !a.startsWith("--")).filter((a) => !flaggedValues.has(a));
}

/**
 * Viewport labels for file mode.
 *
 * `viewportSpecsFor` resolves a declared label to pixel dimensions and so
 * silently drops anything that is not mobile/desktop/wide — measured with the
 * built CLI: `"viewports": ["frame"]` produced `declared viewports: mobile,
 * desktop, wide`. That fallback is correct for the browser path, which has to
 * know what to resize the page to, and wrong here: a supplied PNG carries its
 * own dimensions, and `thresholds` already accepts arbitrary keys. So a canvas
 * engine can declare `"viewports": ["frame"]` and pin `hud/frame.png`.
 *
 * Limit worth stating: baselines pinned under a label the browser path does
 * not know are reachable only from file mode. For a project whose renders
 * cannot be produced by Playwright at all, that is the only mode anyway.
 */
function fileModeViewportSpecs(config: DiffPrConfig): Array<{ label: string; width: number; height: number }> {
  if (!config.viewports || config.viewports.length === 0) return viewportSpecsFor(config);
  return config.viewports.map((label) =>
    DEFAULT_VIEWPORTS.find((v) => v.label === label) ?? { label, width: 0, height: 0 }
  );
}

/**
 * Gates that need a live page and therefore cannot run in file mode. Reported
 * rather than silently skipped: a config that declares `a11y` and gets a PASS
 * must not read as "a11y passed".
 */
function skippedGatesForFileMode(config: DiffPrConfig): string[] {
  const skipped: string[] = [];
  if (config.a11y || config.routes.some((r) => r.a11y)) skipped.push("a11y");
  if (config.mediaVariants) skipped.push("media-variants");
  if (config.crossBrowser) skipped.push("cross-browser");
  return skipped;
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

/**
 * `pin --from-png/--from-dir`: copy already-rendered PNGs into the baseline
 * layout instead of driving a browser. No Playwright is launched — that is the
 * point of the flag, not an optimization.
 */
async function pinFromFiles(
  config: DiffPrConfig,
  configPath: string,
  routesToPin: DiffPrRoute[],
  files: FileSourceFlags,
): Promise<number> {
  const viewports = fileModeViewportSpecs(config).map((v) => v.label);
  let sources: PngSource[];
  try {
    sources = await resolvePngSources({
      routes: routesToPin,
      viewports,
      fromDir: files.fromDir,
      fromPng: files.fromPng,
      routeOverride: files.routeOverride,
      viewportOverride: files.viewportOverride,
      cwd: process.cwd(),
      // A dir claims to be the whole capture set; a single file claims one pair.
      requireFullCoverage: Boolean(files.fromDir),
    });
  } catch (err) {
    console.error(`${RED}error:${RESET} ${err instanceof Error ? err.message : String(err)}`);
    return 1;
  }

  const origin = files.fromDir ?? files.fromPng!;
  console.log(`${BOLD}${CYAN}vlmkit diff-pr pin${RESET}  ${DIM}${configPath}${RESET}`);
  console.log(`${DIM}  from ${origin} (no browser) → ${config.baselineDir}/${RESET}`);
  console.log();
  const written = await pinPngSources(baselineRootFor(config), sources, {
    wipeRouteDirs: Boolean(files.fromDir),
  });
  for (let i = 0; i < sources.length; i++) {
    const s = sources[i];
    console.log(`  ${s.route.name.padEnd(20)} ${s.viewport.padEnd(10)} ${GREEN}ok${RESET} ${DIM}${s.file} → ${written[i]} (${s.matchedAs})${RESET}`);
  }
  console.log();
  console.log(`${DIM}Pinned ${written.length} PNG(s). Run \`vlmkit baseline verify --from-dir <dir>\` to gate against them.${RESET}`);
  return 0;
}

async function cmdPin(args: string[]): Promise<void> {
  const cwd = process.cwd();
  const configPath = findConfigPath(cwd, readFlag(args, "config"));
  if (!configPath) {
    console.error(`${RED}error:${RESET} no vlmkit.config.json found (and --config not given)`);
    process.exit(1);
  }
  const config = loadDiffPrConfig(configPath);

  // Filter to specific routes if any positional arguments were given.
  // Unknown route names are an error so a typo doesn't silently
  // refresh nothing.
  const requestedRouteNames = positionalRouteNames(args);
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

  const files = fileSourceFlags(args);
  if (files.active) {
    const code = await pinFromFiles(config, configPath, routesToPin, files);
    if (code !== 0) process.exit(code);
    return;
  }

  console.log(`${BOLD}${CYAN}vlmkit diff-pr pin${RESET}  ${DIM}${configPath}${RESET}`);
  const scopeNote = routesToPin.length === config.routes.length
    ? `pinning ${routesToPin.length} route(s)`
    : `pinning ${routesToPin.length} of ${config.routes.length} route(s) (${routesToPin.map((r) => r.name).join(", ")}); other baselines untouched`;
  console.log(`${DIM}  ${scopeNote} into ${config.baselineDir}/${RESET}`);
  console.log();

  const viewports = viewportSpecsFor(config);
  await withBrowser(async (browser) => {
    for (const route of routesToPin) {
      process.stdout.write(`  ${route.name.padEnd(20)} ${DIM}${route.url}${RESET} ...`);
      const dir = baselineDirForRoute(config, route);
      // Clean only this route's PNGs, so other routes' baselines stay
      // untouched (the partial-pin use case) and `_history/` survives (the
      // archive `baseline update` writes just before calling us).
      await clearRouteBaselinePngs(dir);
      await mkdir(dir, { recursive: true });
      let success = 0;
      for (const vp of viewports) {
        try {
          // a11y is intentionally NOT computed during `pin` — the
          // baseline PNG is what we care about. CI's `vlmkit diff-pr`
          // (no pin) runs the a11y checks against the live render.
          await renderViewport(browser, route.url, vp.width, vp.height, join(dir, `${vp.label}.png`), route.waitFor);
          success++;
        } catch (err) {
          console.log(`\n    ${RED}${vp.label}: ${String(err)}${RESET}`);
        }
      }
      console.log(` ${GREEN}ok${RESET} ${DIM}(${success}/${viewports.length} viewport(s))${RESET}`);
    }
  });
  console.log();
  console.log(`${DIM}Baselines pinned. Run \`vlmkit diff-pr\` in CI to gate against them.${RESET}`);
}

async function cmdRun(args: string[]): Promise<number> {
  const cwd = process.cwd();
  const configPath = findConfigPath(cwd, readFlag(args, "config"));
  if (!configPath) {
    console.error(`${RED}error:${RESET} no vlmkit.config.json found (and --config not given)`);
    return 1;
  }
  const config = loadDiffPrConfig(configPath);
  const outputDir = resolve(cwd, readFlag(args, "output") ?? ".vlmkit/runs/diff-pr");
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

  // File mode: the "current" side comes from PNGs on disk rather than a
  // render. Resolved up front so a bad mapping fails before any work.
  const files = fileSourceFlags(args);
  const viewports = files.active ? fileModeViewportSpecs(config) : viewportSpecsFor(config);
  let fileSources: Map<string, string> | null = null;
  let skippedGates: string[] = [];
  if (files.active) {
    let sources: PngSource[];
    try {
      sources = await resolvePngSources({
        routes: config.routes,
        viewports: viewports.map((v) => v.label),
        fromDir: files.fromDir,
        fromPng: files.fromPng,
        routeOverride: files.routeOverride,
        viewportOverride: files.viewportOverride,
        cwd,
        requireFullCoverage: Boolean(files.fromDir),
      });
    } catch (err) {
      console.error(`${RED}error:${RESET} ${err instanceof Error ? err.message : String(err)}`);
      return 1;
    }
    fileSources = new Map(sources.map((s) => [`${s.route.name}/${s.viewport}`, s.file]));
    skippedGates = skippedGatesForFileMode(config);
  }

  // `--from-png` names exactly one route/viewport, so the other declared
  // routes are out of scope. Drop them from the run rather than letting them
  // report an empty `pass` — a route with no viewport rows reads as green in
  // both the terminal line and the markdown table, which is the silent
  // partial run this feature is supposed to make impossible.
  const routesToRun = fileSources
    ? config.routes.filter((r) => viewports.some((vp) => fileSources!.has(`${r.name}/${vp.label}`)))
    : config.routes;
  const outOfScope = config.routes.filter((r) => !routesToRun.includes(r)).map((r) => r.name);
  const scopeNote = outOfScope.length > 0
    ? `${routesToRun.length} of ${config.routes.length} declared route(s) checked ` +
      `(no PNG supplied for: ${outOfScope.join(", ")})`
    : undefined;

  console.log(`${BOLD}${CYAN}vlmkit diff-pr${RESET}  ${DIM}${configPath}${RESET}`);
  console.log(`${DIM}  ${config.routes.length} route(s); thresholds ${JSON.stringify(config.thresholds)}${RESET}`);
  if (manifest) console.log(`${DIM}  approval manifest: ${manifest.rules.length} rule(s)${RESET}`);
  if (fileSources) {
    console.log(`${DIM}  current side from ${files.fromDir ?? files.fromPng} (no browser): ${fileSources.size} PNG(s)${RESET}`);
    if (skippedGates.length > 0) {
      // Loud, because these gates are declared in config and a PASS here does
      // not cover them. They need a live page; a PNG cannot supply a DOM,
      // media-emulation, or a second engine.
      console.log(`${YELLOW}  warn: skipped (need a browser): ${skippedGates.join(", ")}${RESET}`);
    }
    if (scopeNote) console.log(`${YELLOW}  warn: ${scopeNote}${RESET}`);
  }
  console.log();

  const results: PerRouteResult[] = [];
  // Do not launch chromium at all in file mode — the reporting project's
  // headless canvas capture is exactly what does not work there.
  // `launchBrowser`, not `withBrowser`: in file mode there is no browser at all,
  // and a scope helper cannot express "maybe don't launch". The `finally` below
  // stays this function's job — `browser?.close()` on a nullable handle is exactly
  // the case `withBrowser` does not cover.
  const browser = fileSources ? null : await launchBrowser();

  try {
    for (const route of routesToRun) {
      const baselineDir = baselineDirForRoute(config, route);
      if (!existsSync(baselineDir)) {
        console.log(`  ${route.name.padEnd(20)} ${RED}no baseline${RESET} ${DIM}(${baselineDir} — run \`vlmkit diff-pr pin\` first)${RESET}`);
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

      // a11y needs a page; in file mode the policy is reported as skipped
      // above and not evaluated here.
      const a11yPolicy = fileSources ? undefined : resolveA11yPolicy(config, route);
      const perVp: PerViewportResult[] = [];
      /** Declared, but nothing pinned to compare against. Fails the route below. */
      const unpinned: string[] = [];
      for (const vp of viewports) {
        const baselinePath = join(baselineDir, `${vp.label}.png`);
        if (!existsSync(baselinePath)) {
          unpinned.push(vp.label);
          continue;
        }
        const suppliedFile = fileSources?.get(`${route.name}/${vp.label}`);
        // In file mode a viewport with no supplied PNG is out of scope
        // (--from-png names exactly one pair); --from-dir already enforced
        // full coverage, so this only skips what the caller narrowed away.
        if (fileSources && !suppliedFile) continue;
        const variantPath = join(routeOut, `${vp.label}.png`);
        let renderRes: RenderResult;
        try {
          if (suppliedFile) {
            // Copy rather than diff in place, so the run dir stays
            // self-contained (heatmap lands beside the variant) and the
            // caller's capture dir is never written to.
            await copyFile(suppliedFile, variantPath);
            renderRes = { contrastFailures: [], touchFailures: [], focusOrderFailures: [], semanticFailures: [] };
          } else {
            renderRes = await renderViewport(
              browser!, route.url, vp.width, vp.height,
              variantPath, route.waitFor, a11yPolicy,
            );
          }
        } catch (err) {
          perVp.push({
            viewport: vp.label,
            diffRatio: 1,
            diffPixels: 0,
            totalPixels: 0,
            threshold: resolveThreshold(config, route, vp.label),
            pass: false,
          });
          const what = suppliedFile ? "copy" : "render";
          console.log(`  ${route.name.padEnd(20)} ${vp.label} ${RED}${what} error: ${String(err)}${RESET}`);
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
        const rawDiff = await compareScreenshots(snap, { outputDir: routeOut });
        // Suppress diffs covered by an approval before gating. Without a DOM
        // here, selector rules can't bind, but region-bbox rules (the zone
        // matcher) do — that's the CI consumer of `vlmkit baseline approve
        // --region` (A/B epic 01).
        const diff = rawDiff && manifest
          ? filterApprovedVrtRegions(rawDiff, manifest, [], { viewport: vp.label }).diff
          : rawDiff;
        const diffRatio = diff?.diffRatio ?? 0;
        const diffPixels = diff?.diffPixels ?? 0;
        const totalPixels = diff?.totalPixels ?? rawDiff?.totalPixels ?? 0;
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
      if (config.mediaVariants && !fileSources) {
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
      if (config.crossBrowser && !fileSources) {
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
      // `some` on an empty array is false, so without this a route with no comparable
      // viewport reports pass. An unpinned viewport is not "within threshold"; it was
      // never measured.
      const failed = visualFailed || mvFailed || xbFailed || unpinned.length > 0;
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
      // Ahead of the deltas, because a reader who sees `a=0.00%` and nothing else has
      // no way to know a second viewport was declared.
      const unpinnedSuffix = unpinned.length > 0
        ? ` ${RED}not compared: ${unpinned.join(", ")} (no baseline — \`vlmkit diff-pr pin\`)${RESET}`
        : "";
      console.log(`  ${route.name.padEnd(20)} ${status}  ${breakdown}${unpinnedSuffix}${mvSuffix}${xbSuffix}`);
      results.push({
        route, viewports: perVp, failed,
        ...(unpinned.length > 0 ? { unpinned } : {}),
        mediaVariants: mediaVariantsResult,
        crossBrowser: crossBrowserResult,
      });
    }
  } finally {
    await browser?.close();
  }

  const summary = buildMarkdownSummary(config, results, {
    source: fileSources ? (files.fromDir ?? files.fromPng) : undefined,
    skippedGates,
    scopeNote,
  });
  const summaryPath = resolve(outputDir, "summary.md");
  await writeFile(summaryPath, summary);

  const anyFail = results.some((r) => r.failed);
  console.log();
  console.log(`${DIM}Summary written to ${summaryPath}${RESET}`);
  if (anyFail) {
    const unpinnedCount = results.reduce((n, r) => n + (r.unpinned?.length ?? 0), 0);
    console.log(`${RED}${BOLD}FAIL${RESET} — at least one route over threshold or missing baseline.`
      + (unpinnedCount > 0 ? ` ${unpinnedCount} declared viewport(s) had no baseline and were not compared.` : ""));
    return 1;
  }
  console.log(`${GREEN}${BOLD}PASS${RESET} — all routes within threshold.`);
  return 0;
}

export interface MarkdownSummaryOptions {
  /** `--from-dir`/`--from-png` origin, when the current side came from files. */
  source?: string;
  /** Declared gates that were not evaluated because there was no browser. */
  skippedGates?: string[];
  /** Set when the run covered fewer routes than the config declares. */
  scopeNote?: string;
}

export function buildMarkdownSummary(
  config: DiffPrConfig,
  results: PerRouteResult[],
  options: MarkdownSummaryOptions = {},
): string {
  const lines: string[] = [];
  lines.push("# vlmkit diff-pr summary");
  lines.push("");
  const totalRoutes = results.length;
  const failed = results.filter((r) => r.failed).length;
  const overall = failed === 0 ? "**PASS**" : `**FAIL** (${failed} of ${totalRoutes} route(s))`;
  lines.push(`Status: ${overall}`);
  if (config.configPath) lines.push(`Config: \`${config.configPath}\``);
  if (options.source) lines.push(`Current side: pre-rendered PNGs from \`${options.source}\` (no browser)`);
  if (options.scopeNote) lines.push(`**Partial run**: ${options.scopeNote}`);
  if (options.skippedGates && options.skippedGates.length > 0) {
    // The PASS above covers pixels only. Saying so in the artifact matters
    // more than in the terminal — the markdown is what gets pasted into a PR.
    lines.push(`**Not evaluated** (declared in config, needs a live page): ${options.skippedGates.join(", ")}`);
  }
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
    if (r.viewports.length === 0 && (r.unpinned ?? []).length === 0) {
      const filler = anyA11y ? " | —" : "";
      lines.push(`| \`${r.route.name}\` | — | — | —${filler} | ❌ ${r.error ?? "no result"} |`);
      continue;
    }
    // A row per declared-but-unpinned viewport, so the table accounts for every
    // viewport the config names. Without these the reader counts the rows, gets fewer
    // than they declared, and has nothing telling them why.
    for (const label of r.unpinned ?? []) {
      const filler = anyA11y ? " | —" : "";
      lines.push(`| \`${r.route.name}\` | ${label} | — | —${filler} | ❌ not compared: no baseline |`);
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
  const unpinnedRoutes = results.filter((r) => (r.unpinned ?? []).length > 0);
  if (unpinnedRoutes.length > 0) {
    // Its own section rather than a table row alone, for the same reason the
    // skipped-gates note is at the top: this markdown is what gets pasted into a PR,
    // and "not compared" is the one status a reader must not mistake for "compared and
    // fine".
    lines.push("");
    lines.push("## Not compared — no baseline");
    lines.push("");
    lines.push("These viewports are declared in config but have no pinned PNG, so nothing "
      + "was measured for them. That is why the run failed; it is not a pixel breach.");
    lines.push("");
    for (const r of unpinnedRoutes) {
      lines.push(`- \`${r.route.name}\`: ${r.unpinned!.join(", ")}`);
    }
    lines.push("");
    lines.push("Pin them with `vlmkit diff-pr pin` (or `pin <route>` for one), or drop the "
      + "viewport from `viewports` if it is no longer wanted.");
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
    console.error(`Run \`vlmkit diff-pr\` first to produce the summary, or pass --summary <path>.`);
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
  const prRef = readFlag(args, "pr");
  if (!prRef) {
    console.error(`${RED}error:${RESET} --pr <ref> is required (e.g. owner/repo#123 or 123 inside the repo)`);
    return 1;
  }
  const cwd = process.cwd();
  const summaryFlag = readFlag(args, "summary");
  const summaryPath = summaryFlag
    ? resolve(cwd, summaryFlag)
    : resolve(cwd, ".vlmkit/runs/diff-pr/summary.md");
  const marker = readFlag(args, "marker") ?? "vrt-diff-pr-summary";
  return postPrComment({ prRef, summaryPath, marker });
}

function formatUsage(): string {
  return `vlmkit diff-pr <command>

Subcommands:
  pin    [route...] [--config vlmkit.config.json]
                              Capture baseline PNGs for declared routes.
                              No positional args → pin every route.
                              Positional names → pin only those, leave
                              the rest untouched (partial refresh).
         [--from-dir <dir> | --from-png <file> [--route <r> --viewport <v>]]
                              Take already-rendered PNGs instead of
                              opening a URL (no browser launched). Files
                              map to routes by name:
                                <route>/<viewport>.png   (canonical)
                                <route>-<viewport>.png   (flat)
                                <route>.png              (1 viewport only)
                              --from-dir must cover every declared
                              route × viewport; unmapped or missing
                              files are an error, never a partial pin.
  post   --pr <ref> [--summary <path>] [--marker <id>]
                              Post the most recent summary.md to a PR
                              via gh CLI. Falls back to printing the
                              markdown with copy-paste instructions
                              when gh is not on PATH.
  (none) [--config vlmkit.config.json] [--output <dir>]
         [--from-dir <dir> | --from-png <file> [--route <r> --viewport <v>]]
                              Diff every route's current rendering
                              against its pinned baseline; apply
                              per-route thresholds; emit markdown.
                              Exit non-zero on any breach.
                              With --from-dir/--from-png the current side
                              is read from PNGs instead of rendered;
                              a11y / media-variants / cross-browser are
                              then skipped and reported as not evaluated.

Config (vlmkit.config.json):
  {
    "baseUrl": "http://localhost:3000",
    "thresholds": { "mobile": 0.01, "desktop": 0.005, "wide": 0.005 },
    "baselineDir": ".vlmkit/baselines",
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


if (isCliEntry(import.meta.url, "diff-pr")) {
  // `handleCliError`, not `console.error(err)`: `readFlag` throws `UsageError` for a
  // malformed flag, and that message already names the flag and the fix — a stack trace
  // only buries it.
  main().catch(handleCliError);
}

export { main };
