#!/usr/bin/env node
/**
 * Auto-discovered interaction exploration.
 *
 * Where `vlmkit inspect interact` requires the test author to hand-write a
 * `sequence.json`, `vlmkit inspect explore` reads the *page's* declaration of
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
 * snapshot after, diff. Same downstream signal as `vlmkit inspect interact` —
 * pixel diff + heatmap regions + dead-action flag — but the
 * sequence is auto-derived. When WebMCP ships, swap the discovery
 * layer to read its tool registry instead.
 *
 * Usage:
 *   vlmkit inspect explore <html|url>
 *   vlmkit inspect explore <html|url> --wait 500    # delay after action before snapshot
 */
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { join, resolve } from "node:path";
import { type Page } from "playwright";
import { isCliEntry } from "@mizchi/vlmkit-core/plugin/cli-entry.ts";
import { compareScreenshots } from "@mizchi/vlmkit-core/heatmap.ts";
import { findHeatmapRegionsFromFile, type HeatmapRegion } from "@mizchi/vlmkit-core/heatmap-regions.ts";
import { annotateHeatmapRegionKinds } from "../heatmap-region-kinds.ts";
import type { VrtSnapshot } from "@mizchi/vlmkit-core/types.ts";
import { handleCliError } from "@mizchi/vlmkit-core/cli-error.ts";
import { DIM, RESET, GREEN, RED, YELLOW, BOLD, CYAN } from "@mizchi/vlmkit-core/terminal-colors.ts";
import { withBrowser } from "@mizchi/vlmkit-core/browser-launch.ts";

export interface ExploreOptions {
  source: string;
  outputDir: string;
  reportPath?: string;
  viewport?: { width: number; height: number };
  /** Pixel diff threshold. Default 0.03. */
  threshold?: number;
  /** ms to wait after each action before snapshot. Default 200. */
  waitAfterAction?: number;
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
  /**
   * The pixel-delta cutoff used for dead-action / silent-handler
   * classification. Defaults to max(threshold, 0.001) so callers who
   * raise --threshold see the dead-action gate move with them
   * instead of being pinned at the historical 0.001 floor.
   */
  silentFloor: number;
  /** Whether --strict-timing was on; controls the report's Mut. column. */
  strictTiming: boolean;
  /**
   * Actions that ran and painted nothing (`diffRatio < silentFloor`).
   *
   * These three counts exist so the caller can decide what a run is worth.
   * `runExplore` used to assign `process.exitCode = 1` itself under `--strict`,
   * which meant a measurement reached out and set the exit status of whatever
   * process happened to be hosting it — a test runner, the API server, a batch
   * driver. The exit code belongs to whoever owns the process; `main()` sets it.
   */
  deadActions: number;
  /**
   * Dead actions that also produced 0 DOM mutations, so the handler is a no-op or
   * unwired rather than off-screen. Always 0 without `--strict-timing`, because
   * without mutation counts the two cases are indistinguishable.
   */
  silentHandlers: number;
  /** Actions whose invocation threw. */
  failedActions: number;
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

/**
 * Put the pointer where it will be when the "after" screenshot is taken, BEFORE
 * the baseline is captured, so that hover paint is in both images and the measured
 * delta is the handler's effect alone.
 *
 * Two artifacts made this necessary, and both were measured rather than guessed:
 *
 *   1. **Cross-talk.** The virtual mouse is a property of the page, not the
 *      document, so it survives the `setContent` that resets state between
 *      actions. Action N's baseline therefore still carried the hover highlight
 *      left on whatever element action N-1 clicked, and the "delta" was that
 *      highlight *disappearing* — attributed to action N. In the test fixture a
 *      dead action on a `<span>` measured 0.28%, and the heatmap put the changed
 *      region squarely on a different element: the button clicked before it.
 *
 *   2. **The target's own hover-in.** Clicking necessarily hovers first, so a
 *      hoverable element with no handler at all reported the arrival of the mouse
 *      as a change — 0.42% for an inert `<button>`. A dead action that reads as
 *      alive is the exact failure this gate exists to catch.
 *
 * A focus ring is deliberately NOT suppressed: it is a real visual consequence of
 * the click, and the silent floor is small precisely so that a focus paint counts
 * as "not dead".
 */
async function settleHover(page: Page, action: DiscoveredAction): Promise<void> {
  if (action.origin === "data-vrt-action" && action.selector) {
    // Hover the element the click will land on. A failure here is not the
    // action's verdict — let `invokeAction` produce the real error.
    await page.hover(action.selector, { timeout: 5000 }).catch(() => {});
    return;
  }
  // A JS action never touches the pointer, so any fixed point will do; what
  // matters is that it is the same for the baseline and the after shot.
  await page.mouse.move(0, 0);
}

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
  // The dead-action / silent-handler cutoff is intentionally NOT
  // `--threshold`. --threshold is the pixelmatch noise floor used by
  // compareScreenshots; the silent cutoff is a stricter "essentially
  // zero" floor that distinguishes "the click did nothing visible"
  // from "the click produced a legitimate small change like a focus
  // ring." If we honored --threshold here, a 1-2% focus paint with
  // default --threshold 0.03 would be misclassified as dead and flip
  // --strict / --strict-timing to non-zero exit — exactly the
  // regression PR #13 review (Codex) flagged. Kept as a constant.
  const silentFloor = 0.001;
  const waitAfter = options.waitAfterAction ?? 200;
  const html = isUrl(options.source) ? null : await readFile(resolve(options.source), "utf-8");

  const findings: ExploreFinding[] = [];
  let actions: DiscoveredAction[] = [];

  await withBrowser(async (browser) => {
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
      await settleHover(page, action);

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
          await annotateHeatmapRegionKinds(heatmapRegions, afterShot);
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
  });

  const reportPath = options.reportPath ?? join(outputDir, "report.md");
  const md = renderReport({
    source: options.source, viewport, actions, findings,
    silentFloor, strictTiming: !!options.strictTiming,
  });
  await writeFile(reportPath, md);

  return {
    source: options.source, viewport, actions, findings, reportPath,
    silentFloor, strictTiming: !!options.strictTiming,
    deadActions: findings.filter((f) => f.executed && f.diffRatio < silentFloor).length,
    silentHandlers: findings.filter((f) => isSilentHandler(f, silentFloor)).length,
    failedActions: findings.filter((f) => !f.executed).length,
  };
}

/**
 * Ran, painted nothing, and mutated nothing — so the handler is a no-op or was
 * never wired up, rather than having changed something off-screen.
 *
 * `mutationCount` is `undefined` unless `--strict-timing` installed the observer,
 * and `undefined === 0` is false, which is the point: without mutation data the
 * two cases are indistinguishable and nothing may be called silent.
 */
function isSilentHandler(f: ExploreFinding, silentFloor: number): boolean {
  return f.executed && f.diffRatio < silentFloor && f.mutationCount === 0;
}

/**
 * The terminal summary. Extracted from `runExplore` alongside the exit code: a
 * measurement that prints cannot be composed, and this one was printing five
 * lines per run into whatever stdout it found.
 */
export function formatExploreReport(report: ExploreReport): string {
  const lines: string[] = [];
  lines.push(`  ${BOLD}${CYAN}vlmkit inspect explore${RESET}`);
  lines.push(`  ${DIM}source: ${report.source}${RESET}`);
  if (report.actions.length === 0) {
    lines.push(`  ${YELLOW}!${RESET} no declared actions found — page exposes neither \`window.__vrtActions\` nor \`data-vrt-action\` attributes`);
    lines.push(`  ${DIM}report: ${report.reportPath}${RESET}`);
    return lines.join("\n");
  }
  lines.push(`  ${DIM}discovered ${report.actions.length} action(s)${RESET}`);
  for (const f of report.findings) {
    const isSilent = isSilentHandler(f, report.silentFloor);
    const icon = !f.executed ? `${RED}✗${RESET}`
      : isSilent ? `${RED}!${RESET}`
      : f.diffRatio < report.silentFloor ? `${YELLOW}~${RESET}`
      : `${GREEN}✓${RESET}`;
    const pct = (f.diffRatio * 100).toFixed(2);
    const mut = f.mutationCount !== undefined ? `, ${f.mutationCount} mut` : "";
    const detail = !f.executed ? `failed: ${f.error}`
      : isSilent ? `Δ ${pct}% — silent handler (0 DOM mutations)`
      : `Δ ${pct}%${mut}`;
    lines.push(`  ${icon} ${f.action.name.padEnd(24)} ${DIM}${detail}${RESET}`);
  }
  lines.push(`  ${DIM}report: ${report.reportPath}${RESET}`);
  return lines.join("\n");
}

/**
 * Named fields rather than `Omit<ExploreReport, "reportPath">`: the markdown is
 * rendered before the counts are derived, and widening the parameter to the whole
 * report would force the caller to compute them twice or fake them.
 */
type RenderInput = Pick<ExploreReport, "source" | "viewport" | "actions" | "findings" | "silentFloor" | "strictTiming">;

function renderReport(r: RenderInput): string {
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
  // Add a Mut. column only when --strict-timing was on; otherwise the
  // column would be all em-dashes and just clutter the report.
  const showMut = r.strictTiming;
  if (showMut) {
    // The silent cutoff is independent of --threshold; --threshold is
    // the pixelmatch noise floor used for the diff itself, while this
    // 0.001 cutoff is "did anything happen at all". Spelled out in the
    // preamble so the value is auditable without reading source.
    lines.push(`Silent / dead cutoff: Δ < ${(r.silentFloor * 100).toFixed(2)}% ` +
      `(constant; independent of \`--threshold\`).`);
    lines.push("");
  }
  const header = showMut
    ? "| Action | Origin | Status | Δ | Mut. | Regions |"
    : "| Action | Origin | Status | Δ | Regions |";
  const sep = showMut ? "|---|---|---|---|---|---|" : "|---|---|---|---|---|";
  lines.push(header);
  lines.push(sep);
  for (const f of r.findings) {
    let status: string;
    if (!f.executed) {
      status = `**failed** — ${f.error}`;
    } else if (f.diffRatio < r.silentFloor) {
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
    const mutCell = f.mutationCount === undefined ? "—" : String(f.mutationCount);
    const row = showMut
      ? `| \`${f.action.name}\` | ${f.action.origin} | ${status} | ${pct} | ${mutCell} | ${f.heatmapRegions.length} |`
      : `| \`${f.action.name}\` | ${f.action.origin} | ${status} | ${pct} | ${f.heatmapRegions.length} |`;
    lines.push(row);
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
  console.log("Usage: vlmkit inspect explore <html-or-url> [options]");
  console.log("Options:");
  console.log("  --wait <ms>          Delay after each action before snapshot (default: 200)");
  console.log("  --threshold <0..1>   Pixel diff threshold (default: 0.03)");
  console.log("  --strict             Exit non-zero on dead or failed actions");
  console.log("  --strict-timing      Disambiguate Δ-0% via DOM-mutation count:");
  console.log("                       a silent handler (0 mutations + 0 px delta) is");
  console.log("                       flagged distinctly from an off-screen change");
  console.log("                       (mutations > 0 + 0 px delta). Adds ~5ms/action");
  console.log("                       and exits non-zero on any silent handler.");
  console.log("                       The Δ-0 cutoff is 0.001 (constant — NOT");
  console.log("                       --threshold, which is the pixelmatch noise floor");
  console.log("                       used for the diff itself).");
  console.log("  --output-dir <dir>   Default: ./test-results/explore");
  console.log("  --report <path>      Markdown report path");
  console.log("");
  console.log("Pages opt-in to auto-exploration via:");
  console.log('  <button data-vrt-action="open-menu">...</button>');
  console.log("  window.__vrtActions = [{ name: 'open-menu', run: () => ... }]");
}

/**
 * The command. Returns its exit code rather than assigning `process.exitCode`,
 * for the same reason `runExplore` no longer does: the process belongs to
 * whoever started it, and this module is importable now.
 *
 * @param cwd resolved against for the default output directory. An argument
 *   rather than a `process.chdir`, which is process-wide.
 */
export async function runExploreCli(
  cliArgs: readonly string[],
  options: { cwd?: string } = {},
): Promise<number> {
  const argv = [...cliArgs];
  if (argv.includes("--help") || argv.includes("-h")) {
    printUsage();
    return 0;
  }
  const { positional, outputDir, report, threshold, waitAfter, strict, strictTiming } = parseArgs(argv);
  if (positional.length === 0) {
    printUsage();
    return 1;
  }
  const cwd = options.cwd ?? process.cwd();
  const result = await runExplore({
    source: positional[0]!,
    outputDir: outputDir || join(cwd, "test-results", "explore"),
    reportPath: report || undefined,
    threshold,
    waitAfterAction: waitAfter,
    strictTiming,
  });
  console.log(formatExploreReport(result));

  // `--strict` fails on any action that painted nothing or threw; `--strict-timing`
  // fails only on the narrower silent-handler case it can actually distinguish.
  if (strict && (result.deadActions > 0 || result.failedActions > 0)) return 1;
  if (strictTiming && result.silentHandlers > 0) return 1;
  return 0;
}

if (isCliEntry(import.meta.url, "explore")) {
  runExploreCli(process.argv.slice(2))
    .then((code) => { process.exitCode = code; })
    .catch(handleCliError);
}
