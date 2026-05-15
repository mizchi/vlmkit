#!/usr/bin/env node
/**
 * Auto-discovered interaction exploration.
 *
 * Where `vrt interact` requires the test author to hand-write a
 * `sequence.json`, `vrt explore` reads the *page's* declaration of
 * what's interactive. Shaped like Chrome's proposed WebMCP without
 * depending on the spec — opt-in via two complementary mechanisms:
 *
 *   1. `window.__vrtActions` — a JS array each page can attach:
 *
 *      window.__vrtActions = [
 *        { name: "open-menu",  run: () => document.querySelector(".trigger").click() },
 *        { name: "fill-form",  run: async () => { await fillForm(); ... } },
 *      ];
 *
 *   2. `data-vrt-action="<name>"` attributes — for static cases
 *      where the action is "click this element."
 *
 *      <button data-vrt-action="cta-click">Sign up</button>
 *      <details><summary data-vrt-action="disclose-faq">FAQ</summary>…</details>
 *
 * For each discovered action: snapshot baseline, invoke the action,
 * snapshot after, diff. Same downstream signal as `vrt interact` —
 * pixel diff + heatmap regions + dead-action flag — but the
 * sequence is auto-derived. When WebMCP ships, swap the discovery
 * layer to read its tool registry instead.
 *
 * Usage:
 *   vrt explore <html|url>
 *   vrt explore <html|url> --wait 500    # delay after action before snapshot
 */
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium, type Page } from "playwright";
import { compareScreenshots } from "./heatmap.ts";
import { findHeatmapRegionsFromFile, type HeatmapRegion } from "./heatmap-regions.ts";
import type { VrtSnapshot } from "./types.ts";
import { handleCliError } from "./cli-error.ts";
import { DIM, RESET, GREEN, RED, YELLOW, BOLD, CYAN } from "./terminal-colors.ts";

export interface ExploreOptions {
  source: string;
  outputDir: string;
  reportPath?: string;
  viewport?: { width: number; height: number };
  /** Pixel diff threshold. Default 0.03. */
  threshold?: number;
  /** ms to wait after each action before snapshot. Default 200. */
  waitAfterAction?: number;
  /** Exit non-zero when any declared action induced 0 diff (dead action). */
  strict?: boolean;
  /**
   * Disambiguate the Δ-0% case by also counting DOM mutations between
   * the click and the after-screenshot. When 0 mutations *and* 0
   * pixel delta, the handler is almost certainly a silent no-op (the
   * dogfood byte-identical-PNG case). When mutations > 0 but pixel
   * delta = 0, the change was off-screen or invisible.
   * Costs one extra `page.evaluate` per action (~5ms) — cheap to keep
   * default-on, but kept opt-in to preserve the existing report
   * contract.
   */
  strictTiming?: boolean;
}

export interface DiscoveredAction {
  name: string;
  /** Where the declaration came from. */
  origin: "window.__vrtActions" | "data-vrt-action";
  /** Optional selector for attribute-declared actions. */
  selector?: string;
}

export interface ExploreFinding {
  action: DiscoveredAction;
  baselineScreenshot: string;
  afterScreenshot: string;
  diffPixels: number;
  diffRatio: number;
  heatmapPath?: string;
  heatmapRegions: HeatmapRegion[];
  /** True when the action ran without throwing. */
  executed: boolean;
  /** Error if execution threw. */
  error?: string;
  /**
   * DOM mutation count observed between action invocation and the
   * after-screenshot. Only populated when --strict-timing was set.
   * Distinguishes "no pixel delta because the handler did nothing"
   * (0 mutations) from "no pixel delta but DOM changed off-screen"
   * (> 0 mutations).
   */
  mutationCount?: number;
}

export interface ExploreReport {
  source: string;
  viewport: { width: number; height: number };
  actions: DiscoveredAction[];
  findings: ExploreFinding[];
  reportPath: string;
}

function isUrl(s: string): boolean { return /^https?:\/\//.test(s); }

function parseArgs(argv: string[]) {
  let outputDir = "";
  let report = "";
  let threshold = 0.03;
  let waitAfter = 200;
  let strict = false;
  let strictTiming = false;
  const positional: string[] = [];
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--output-dir") outputDir = argv[++i];
    else if (a === "--report") report = argv[++i];
    else if (a === "--threshold") threshold = parseFloat(argv[++i] ?? "0.03");
    else if (a === "--wait") waitAfter = parseInt(argv[++i] ?? "200", 10);
    else if (a === "--strict") strict = true;
    else if (a === "--strict-timing") strictTiming = true;
    else positional.push(a);
  }
  return { positional, outputDir, report, threshold, waitAfter, strict, strictTiming };
}

// Browser-side discovery. Returns the declared actions; the runner
// invokes each one via a separate evaluate call so we capture
// per-action errors cleanly.
const DISCOVER_SCRIPT = `
(function discover() {
  const out = [];
  const seen = new Set();
  // 1. window.__vrtActions
  const actions = (window).__vrtActions;
  if (Array.isArray(actions)) {
    for (const a of actions) {
      if (a && typeof a.name === 'string' && typeof a.run === 'function') {
        out.push({ name: a.name, origin: 'window.__vrtActions' });
        seen.add(a.name);
      }
    }
  }
  // 2. data-vrt-action attributes
  for (const el of document.querySelectorAll('[data-vrt-action]')) {
    const name = el.getAttribute('data-vrt-action');
    if (!name || seen.has(name)) continue;
    // Build a selector that targets this element. Prefer id when
    // present, fall back to attribute.
    let selector;
    if (el.id) selector = '#' + CSS.escape(el.id);
    else selector = '[data-vrt-action="' + CSS.escape(name) + '"]';
    out.push({ name, origin: 'data-vrt-action', selector });
    seen.add(name);
  }
  return out;
})()
`;

async function invokeAction(page: Page, action: DiscoveredAction): Promise<void> {
  if (action.origin === "window.__vrtActions") {
    await page.evaluate(async (name) => {
      const list = (window as unknown as { __vrtActions?: Array<{ name: string; run: () => unknown | Promise<unknown> }> }).__vrtActions;
      const found = list?.find((a) => a.name === name);
      if (!found) throw new Error(`window.__vrtActions["${name}"] not found at invocation time`);
      await found.run();
    }, action.name);
    return;
  }
  // data-vrt-action: click the element.
  if (!action.selector) throw new Error("attribute-declared action missing selector");
  await page.click(action.selector, { timeout: 5000 });
}

export async function runExplore(options: ExploreOptions): Promise<ExploreReport> {
  const outputDir = resolve(options.outputDir);
  await mkdir(outputDir, { recursive: true });
  const viewport = options.viewport ?? { width: 1280, height: 720 };
  const threshold = options.threshold ?? 0.03;
  const waitAfter = options.waitAfterAction ?? 200;
  const html = isUrl(options.source) ? null : await readFile(resolve(options.source), "utf-8");

  const findings: ExploreFinding[] = [];
  let actions: DiscoveredAction[] = [];

  const browser = await chromium.launch();
  try {
    const page = await browser.newPage({ viewport });
    if (isUrl(options.source)) {
      await page.goto(options.source, { waitUntil: "networkidle", timeout: 30000 });
    } else {
      await page.setContent(html!, { waitUntil: "networkidle" });
    }
    // Disable transitions so post-action snapshot is at the settled
    // state, not mid-animation.
    await page.addStyleTag({
      content: `*, *::before, *::after { transition: none !important; animation: none !important; }`,
    });

    actions = await page.evaluate(DISCOVER_SCRIPT) as DiscoveredAction[];

    if (actions.length === 0) {
      console.log(`  ${YELLOW}!${RESET} no declared actions found — page exposes neither \`window.__vrtActions\` nor \`data-vrt-action\` attributes`);
    }

    // Capture a baseline used as the "before" reference for EACH
    // action. We reset state between actions by reloading the page.
    // For richer flows the page should use a single multi-step action
    // in __vrtActions; we don't try to be a state machine here.
    for (const action of actions) {
      // Fresh state for every action.
      if (isUrl(options.source)) {
        await page.goto(options.source, { waitUntil: "networkidle", timeout: 30000 });
      } else {
        await page.setContent(html!, { waitUntil: "networkidle" });
      }
      await page.addStyleTag({
        content: `*, *::before, *::after { transition: none !important; animation: none !important; }`,
      });

      const safe = action.name.replace(/[^a-z0-9._-]+/gi, "_");
      const baselineShot = join(outputDir, `${safe}-before.png`);
      const afterShot = join(outputDir, `${safe}-after.png`);
      await page.screenshot({ path: baselineShot, fullPage: false });

      // Mutation observer: counts DOM changes between click and the
      // after-screenshot. Lets the report distinguish "silent handler"
      // (0 mutations, 0 pixel delta) from "off-screen DOM change"
      // (> 0 mutations, 0 pixel delta). Only installed under
      // --strict-timing because every page.evaluate has wire cost.
      if (options.strictTiming) {
        await page.evaluate(() => {
          const w = window as unknown as {
            __vrtMutationCount?: number;
            __vrtMutationObs?: MutationObserver;
          };
          w.__vrtMutationCount = 0;
          const obs = new MutationObserver((muts) => {
            w.__vrtMutationCount = (w.__vrtMutationCount ?? 0) + muts.length;
          });
          obs.observe(document.documentElement, {
            childList: true, attributes: true, characterData: true, subtree: true,
          });
          w.__vrtMutationObs = obs;
        });
      }

      let executed = false;
      let error: string | undefined;
      try {
        await invokeAction(page, action);
        await page.waitForTimeout(waitAfter);
        executed = true;
      } catch (e) {
        error = String(e instanceof Error ? e.message : e);
      }
      let mutationCount: number | undefined;
      if (options.strictTiming) {
        // Navigation-capable actions (link clicks, form submits)
        // destroy the execution context the observer lived in, so
        // page.evaluate throws after invokeAction already succeeded.
        // Swallow the readback failure so a single navigating action
        // doesn't abort the whole explore run — leave mutationCount
        // undefined so the report shows the no-data state honestly.
        try {
          mutationCount = await page.evaluate(() => {
            const w = window as unknown as {
              __vrtMutationCount?: number;
              __vrtMutationObs?: MutationObserver;
            };
            w.__vrtMutationObs?.disconnect();
            return w.__vrtMutationCount ?? 0;
          });
        } catch {
          mutationCount = undefined;
        }
      }
      await page.screenshot({ path: afterShot, fullPage: false });

      let diffRatio = 0, diffPixels = 0;
      let heatmapRegions: HeatmapRegion[] = [];
      let heatmapPath: string | undefined;
      if (executed) {
        const snap: VrtSnapshot = {
          testId: `explore-${safe}`,
          testTitle: `${action.name} baseline → after`,
          projectName: "explore",
          screenshotPath: afterShot,
          baselinePath: baselineShot,
          status: "changed",
        };
        const diff = await compareScreenshots(snap, { outputDir, threshold });
        diffRatio = diff?.diffRatio ?? 0;
        diffPixels = diff?.diffPixels ?? 0;
        const heatmapMaybe = join(outputDir, `explore-${safe}_heatmap.png`);
        try {
          heatmapRegions = await findHeatmapRegionsFromFile(heatmapMaybe, {}, afterShot);
          if (diffPixels > 0) heatmapPath = heatmapMaybe;
        } catch { /* no heatmap */ }
      }

      findings.push({
        action,
        baselineScreenshot: baselineShot,
        afterScreenshot: afterShot,
        diffPixels,
        diffRatio,
        heatmapPath,
        heatmapRegions,
        executed,
        error,
        mutationCount,
      });
    }
    await page.close();
  } finally {
    await browser.close();
  }

  const reportPath = options.reportPath ?? join(outputDir, "report.md");
  const md = renderReport({
    source: options.source, viewport, actions, findings,
  });
  await writeFile(reportPath, md);

  console.log(`  ${BOLD}${CYAN}vrt explore${RESET}`);
  console.log(`  ${DIM}source: ${options.source}${RESET}`);
  console.log(`  ${DIM}discovered ${actions.length} action(s)${RESET}`);
  let deadCount = 0;
  let silentHandlerCount = 0;
  for (const f of findings) {
    const isSilent = options.strictTiming && f.executed
      && f.diffRatio < 0.001 && f.mutationCount === 0;
    const icon = !f.executed ? `${RED}✗${RESET}`
      : isSilent ? `${RED}!${RESET}`
      : f.diffRatio < 0.001 ? `${YELLOW}~${RESET}`
      : `${GREEN}✓${RESET}`;
    const pct = (f.diffRatio * 100).toFixed(2);
    const mut = f.mutationCount !== undefined ? `, ${f.mutationCount} mut` : "";
    const detail = !f.executed ? `failed: ${f.error}`
      : isSilent ? `Δ ${pct}% — silent handler (0 DOM mutations)`
      : `Δ ${pct}%${mut}`;
    console.log(`  ${icon} ${f.action.name.padEnd(24)} ${DIM}${detail}${RESET}`);
    if (f.executed && f.diffRatio < 0.001) deadCount++;
    if (isSilent) silentHandlerCount++;
  }
  console.log(`  ${DIM}report: ${reportPath}${RESET}`);

  if (options.strict && (deadCount > 0 || findings.some((f) => !f.executed))) {
    process.exitCode = 1;
  }
  if (options.strictTiming && silentHandlerCount > 0) {
    process.exitCode = 1;
  }

  return { source: options.source, viewport, actions, findings, reportPath };
}

function renderReport(r: Omit<ExploreReport, "reportPath">): string {
  const lines: string[] = [];
  lines.push("# Explore report");
  lines.push("");
  lines.push(`Source: \`${r.source}\` at ${r.viewport.width}×${r.viewport.height}`);
  lines.push("");
  if (r.actions.length === 0) {
    lines.push("## No declared actions found");
    lines.push("");
    lines.push("The page exposes neither `window.__vrtActions` (JS hook) nor " +
      "`data-vrt-action` attributes. To enable auto-exploration, declare " +
      "actions in one of two ways:");
    lines.push("");
    lines.push("```html");
    lines.push("<!-- attribute-driven (clicks the element) -->");
    lines.push('<button data-vrt-action="open-menu">Menu</button>');
    lines.push("");
    lines.push("<!-- JS-driven (arbitrary side effects) -->");
    lines.push("<script>");
    lines.push("  window.__vrtActions = [");
    lines.push('    { name: "open-menu",  run: () => document.querySelector(".trigger").click() },');
    lines.push('    { name: "submit",     run: async () => { /* … */ } },');
    lines.push("  ];");
    lines.push("</script>");
    lines.push("```");
    return lines.join("\n");
  }
  lines.push(`Discovered **${r.actions.length}** declared action(s):`);
  lines.push("");
  for (const a of r.actions) {
    const src = a.origin === "window.__vrtActions" ? "JS" : "attribute";
    lines.push(`- **${a.name}** _(${src}${a.selector ? `, selector \`${a.selector}\`` : ""})_`);
  }
  lines.push("");
  lines.push("## Findings");
  lines.push("");
  lines.push("Each row: action invoked from a freshly-loaded page, baseline " +
    "captured before invocation, after captured post-invocation + " +
    "post-wait, pixel-diffed. A `dead` action (Δ near 0%) typically means " +
    "the declared selector / function had no visible side effect — verify " +
    "the declaration matches a real interaction.");
  lines.push("");
  lines.push("| Action | Origin | Status | Δ | Regions |");
  lines.push("|---|---|---|---|---|");
  for (const f of r.findings) {
    let status: string;
    if (!f.executed) {
      status = `**failed** — ${f.error}`;
    } else if (f.diffRatio < 0.001) {
      // --strict-timing populates mutationCount and disambiguates the
      // Δ-0 case: 0 mutations means the handler did nothing (silent
      // no-op or unwired); > 0 means DOM changed but didn't paint.
      if (f.mutationCount === 0) {
        status = "**silent** — 0 DOM mutations and 0 pixel delta; handler is a no-op or unwired";
      } else if (f.mutationCount !== undefined && f.mutationCount > 0) {
        status = `_DOM mutated (${f.mutationCount}) but 0 pixel delta — change was off-screen, invisible, or below the dirty-rect threshold_`;
      } else {
        status = "_no pixel delta — action may be wired but timing-missed, or genuinely no-op_";
      }
    } else {
      status = "ok";
    }
    const pct = f.executed ? `${(f.diffRatio * 100).toFixed(2)}%` : "—";
    lines.push(`| \`${f.action.name}\` | ${f.action.origin} | ${status} | ${pct} | ${f.heatmapRegions.length} |`);
  }
  lines.push("");
  const surfaced = r.findings.filter((f) => f.heatmapRegions.length > 0);
  if (surfaced.length > 0) {
    lines.push("## Heatmap regions per action");
    lines.push("");
    for (const f of surfaced) {
      lines.push(`### ${f.action.name} — Δ ${(f.diffRatio * 100).toFixed(2)}%`);
      lines.push("");
      lines.push("| Top-Left | Size | Hot pixels | Fill | Kind |");
      lines.push("|---|---|---|---|---|");
      for (const reg of f.heatmapRegions.slice(0, 5)) {
        const fill = reg.dominantColor ? `\`${reg.dominantColor.hex}\`` : "—";
        const kind = reg.kind ? `\`${reg.kind}\`` : "—";
        lines.push(`| ${reg.left},${reg.top} | ${reg.width}×${reg.height} | ${reg.area} | ${fill} | ${kind} |`);
      }
      lines.push("");
    }
  }
  return lines.join("\n");
}

function printUsage(): void {
  console.log("Usage: vrt explore <html-or-url> [options]");
  console.log("Options:");
  console.log("  --wait <ms>          Delay after each action before snapshot (default: 200)");
  console.log("  --threshold <0..1>   Pixel diff threshold (default: 0.03)");
  console.log("  --strict             Exit non-zero on dead or failed actions");
  console.log("  --strict-timing      Disambiguate Δ-0% via DOM-mutation count:");
  console.log("                       a silent handler (0 mutations + 0 px delta) is");
  console.log("                       flagged distinctly from an off-screen change");
  console.log("                       (mutations > 0 + 0 px delta). Adds ~5ms/action");
  console.log("                       and exits non-zero on any silent handler.");
  console.log("  --output-dir <dir>   Default: ./test-results/explore");
  console.log("  --report <path>      Markdown report path");
  console.log("");
  console.log("Pages opt-in to auto-exploration via:");
  console.log('  <button data-vrt-action="open-menu">...</button>');
  console.log("  window.__vrtActions = [{ name: 'open-menu', run: () => ... }]");
}

async function main(argv = process.argv.slice(2)) {
  if (argv.includes("--help") || argv.includes("-h")) {
    printUsage();
    return;
  }
  const { positional, outputDir, report, threshold, waitAfter, strict, strictTiming } = parseArgs(argv);
  if (positional.length === 0) {
    printUsage();
    process.exit(1);
  }
  await runExplore({
    source: positional[0]!,
    outputDir: outputDir || join(process.cwd(), "test-results", "explore"),
    reportPath: report || undefined,
    threshold,
    waitAfterAction: waitAfter,
    strict,
    strictTiming,
  });
}

const isCliEntry = process.argv[1] ? resolve(process.argv[1]) === fileURLToPath(import.meta.url) : false;
if (isCliEntry) {
  main().catch(handleCliError);
}
