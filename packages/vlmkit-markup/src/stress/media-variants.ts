#!/usr/bin/env node
/**
 * Media-query / page-state variant check.
 *
 * Renders an HTML / URL under five orthogonal user-preference
 * variants and pixel-diffs each against the default render. Catches
 * "agent wrote a beautiful default but didn't wire up any of the
 * five common user-preference adaptations" in one pass:
 *
 *   forced-colors    `@media (forced-colors: active)` — Windows
 *                    high-contrast mode emulation. Page should
 *                    survive UA color overrides.
 *   reduced-motion   `@media (prefers-reduced-motion: reduce)` —
 *                    animations / transitions suppressed for users
 *                    with vestibular disorders.
 *   print            `@media print` — page renders without nav
 *                    bars, includes URLs in links, etc.
 *   rtl              `dir="rtl"` on `<html>` — layout mirrors L↔R
 *                    for Arabic / Hebrew etc.
 *   zoom-200         200% browser zoom — text reflows, no
 *                    horizontal-scroll bug (WCAG 1.4.10).
 *
 * Each variant gets a delta-vs-default measurement plus a heuristic
 * verdict. The reduced-motion check additionally peeks at the
 * stylesheet text for `prefers-reduced-motion` rules — purely
 * pixel-based detection is unreliable since both "no animation"
 * and "animation correctly suppressed" yield identical screenshots.
 *
 * Usage:
 *   vlmkit stress media <html-or-url>
 *   vlmkit stress media <url> --variants forced-colors,print,rtl
 */
import { writeFile, mkdir } from "node:fs/promises";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { type Page } from "playwright";
import { sourceToUrl } from "@mizchi/vlmkit-core/page-open.ts";
import { compareScreenshots } from "@mizchi/vlmkit-core/heatmap.ts";
import type { VrtSnapshot } from "@mizchi/vlmkit-core/types.ts";
import { handleCliError } from "@mizchi/vlmkit-core/cli-error.ts";
import { DIM, RESET, GREEN, RED, YELLOW, BOLD, CYAN } from "@mizchi/vlmkit-core/terminal-colors.ts";
import { type PageLoadOptions, navigatePage } from "@mizchi/vlmkit-core/page-load.ts";
import { withBrowser } from "@mizchi/vlmkit-core/browser-launch.ts";

export type MediaVariant = "forced-colors" | "reduced-motion" | "print" | "rtl" | "zoom-200";

export const ALL_VARIANTS: MediaVariant[] = [
  "forced-colors",
  "reduced-motion",
  "print",
  "rtl",
  "zoom-200",
];

export interface MediaVariantsOptions extends PageLoadOptions {
  source: string;
  outputDir: string;
  reportPath?: string;
  viewport?: { width: number; height: number };
  variants?: MediaVariant[];
  threshold?: number;
}

export interface VariantResult {
  variant: MediaVariant;
  screenshotPath: string;
  deltaRatio: number;
  deltaPixels: number;
  totalPixels: number;
  /** Heuristic verdict for the variant. */
  verdict: "ok" | "suspect" | "warn" | "skip";
  note: string;
}

export interface MediaVariantsReport {
  source: string;
  viewport: { width: number; height: number };
  defaultScreenshot: string;
  variants: VariantResult[];
  reportPath: string;
}


/**
 * Always navigate. The file branch used to `setContent` the read bytes, which
 * leaves the document without a base URL so an external stylesheet never loads
 * — and this gate compares screenshots across media emulations, so an unstyled
 * document inverts its verdict. Measured on fixtures/external-assets:
 * forced-colors read `Delta 0.36% -> fails` unstyled and `Delta 1.46% -> passes`
 * with the CSS actually applied.
 */
async function loadPage(page: Page, source: string, pageLoad: PageLoadOptions = {}): Promise<void> {
  // Every variant pass (default + forced-colors + print + ...) goes through
  // here, so the load options apply uniformly. A variant loaded under different
  // rules than the baseline would diff two different documents.
  await navigatePage(page, sourceToUrl(source), pageLoad);
}

/** Read all of the page's stylesheet text. Falls back to empty on errors. */
async function readAllStylesheets(page: Page): Promise<string> {
  try {
    return await page.evaluate(() => {
      const out: string[] = [];
      for (const sheet of Array.from(document.styleSheets)) {
        try {
          const rules = sheet.cssRules;
          if (!rules) continue;
          for (const r of Array.from(rules)) out.push(r.cssText || "");
        } catch {
          // CORS-restricted; skip.
        }
      }
      return out.join("\n");
    });
  } catch {
    return "";
  }
}

export async function runMediaVariants(
  options: MediaVariantsOptions,
): Promise<MediaVariantsReport> {
  const outputDir = resolve(options.outputDir);
  await mkdir(outputDir, { recursive: true });
  const viewport = options.viewport ?? { width: 1280, height: 720 };
  const threshold = options.threshold ?? 0.03;
  const variants = options.variants ?? ALL_VARIANTS;

  // Read both inside the callback (as the diff baseline) and after it (in the
  // report), so it can be neither callback-local nor a bare `let` assigned in the
  // closure — TypeScript's definite-assignment analysis does not follow the
  // latter. It only ever depended on `outputDir`, so hoisting the join is the
  // same string computed a few lines earlier.
  const defaultScreenshot = join(outputDir, "default.png");
  let allCss = "";
  const variantResults: VariantResult[] = [];
  await withBrowser(async (browser) => {
    // Default render — used as the baseline for diffs. Transitions
    // intentionally NOT disabled here because the reduced-motion
    // variant needs a fair comparison.
    const defaultPage = await browser.newPage({ viewport });
    await loadPage(defaultPage, options.source, options);
    await defaultPage.screenshot({ path: defaultScreenshot, fullPage: false });
    // Read all stylesheets — used for reduced-motion static check.
    allCss = await readAllStylesheets(defaultPage);
    await defaultPage.close();

    // One pass per requested variant.
    for (const variant of variants) {
      const screenshotPath = join(outputDir, `${variant}.png`);
      const page = await browser.newPage({
        viewport: variant === "zoom-200"
          ? { width: viewport.width / 2, height: viewport.height / 2 }
          : viewport,
      });
      // Hoisted so the per-variant verdict switch can see it below.
      let zoomOverflow: { scrollWidth: number; clientWidth: number } | undefined;
      try {
        // Apply variant emulation BEFORE loading content where the
        // setting affects how CSS is matched. For RTL the dir is set
        // via a script tag after load.
        if (variant === "forced-colors") {
          await page.emulateMedia({ forcedColors: "active" });
        } else if (variant === "reduced-motion") {
          await page.emulateMedia({ reducedMotion: "reduce" });
        } else if (variant === "print") {
          await page.emulateMedia({ media: "print" });
        }
        await loadPage(page, options.source, options);
        if (variant === "rtl") {
          await page.evaluate(() => { document.documentElement.dir = "rtl"; });
          await page.waitForLoadState("networkidle").catch(() => {});
        } else if (variant === "zoom-200") {
          // CSS zoom: 2 is the closest standard approximation of
          // browser zoom that doesn't require CDP setPageScaleFactor.
          // Applied after load so author CSS doesn't override.
          await page.addStyleTag({ content: `html { zoom: 2; }` });
        }
        // Capture horizontal-scroll telemetry for zoom-200 verdict.
        if (variant === "zoom-200") {
          zoomOverflow = await page.evaluate(() => ({
            scrollWidth: document.documentElement.scrollWidth,
            clientWidth: document.documentElement.clientWidth,
          }));
        }
        await page.screenshot({ path: screenshotPath, fullPage: false });
      } catch (error) {
        await page.close();
        variantResults.push({
          variant,
          screenshotPath,
          deltaRatio: 0,
          deltaPixels: 0,
          totalPixels: 0,
          verdict: "skip",
          note: `screenshot failed: ${String(error)}`,
        });
        continue;
      }
      await page.close();

      // Diff against default. For zoom-200 the screenshot dimensions
      // differ, so compareScreenshots' internal resize handles it.
      const snap: VrtSnapshot = {
        testId: `media-${variant}`,
        testTitle: `default → ${variant}`,
        projectName: "media-variants",
        screenshotPath: screenshotPath,
        baselinePath: defaultScreenshot,
        status: "changed",
      };
      const diff = await compareScreenshots(snap, { outputDir, threshold });
      const deltaRatio = diff?.diffRatio ?? 0;
      const deltaPixels = diff?.diffPixels ?? 0;
      const totalPixels = diff?.totalPixels ?? 0;

      // Per-variant heuristic verdicts:
      let verdict: VariantResult["verdict"] = "ok";
      let note = "";
      switch (variant) {
        case "forced-colors": {
          // High-contrast emulation: the UA overrides author colors
          // with system colors unless `forced-color-adjust: none` is
          // declared. Two-track check:
          //   1. delta < 0.5% → likely no response (suspect)
          //   2. stylesheet text contains `forced-color-adjust: none`
          //      → explicit opt-out, also suspect
          // Platform note: Chromium's forced-colors emulation on
          // non-Windows hosts is conservative; the absolute delta is
          // smaller than you'd see on a real Windows high-contrast
          // theme.
          const hasOptOut = /forced-color-adjust\s*:\s*none/i.test(allCss);
          if (hasOptOut) {
            verdict = "suspect";
            note = "Stylesheet declares `forced-color-adjust: none` — author opted out of high-contrast accommodation.";
          } else if (deltaRatio < 0.005) {
            verdict = "suspect";
            note = "Page barely changed under forced-colors emulation — verify text + background colors flip under high-contrast or use `Canvas` / `CanvasText` system colors.";
          } else {
            note = `Page responds to forced-colors emulation (Δ ${(deltaRatio * 100).toFixed(1)}%).`;
          }
          break;
        }
        case "reduced-motion": {
          // Pixel diff alone is unreliable: pages without animations
          // show 0% delta whether or not reduced-motion CSS is
          // present, and pages WITH animations may also show 0% if
          // the screenshot caught the animation at its rest state
          // (opacity: 1 frame of a pulse, etc.). Static stylesheet
          // analysis is more reliable:
          //   1. has `@media (prefers-reduced-motion: reduce)` rule?
          //   2. does the page declare any animations at all?
          const hasReduceRule = /@media[^{]*prefers-reduced-motion[^{]*reduce/i.test(allCss);
          const hasAnimation = /\banimation\s*:|@keyframes\b|\btransition\s*:/i.test(allCss);
          if (hasReduceRule) {
            verdict = "ok";
            note = "Stylesheet declares `@media (prefers-reduced-motion: reduce)` — author CSS honors the preference.";
          } else if (!hasAnimation) {
            verdict = "ok";
            note = "Page has no animation / transition declarations — reduced-motion accommodation not needed.";
          } else {
            verdict = "suspect";
            note = "Stylesheet declares animation / transition / @keyframes but no `@media (prefers-reduced-motion: reduce)` rule — motion is not suppressed for users with vestibular disorders.";
          }
          break;
        }
        case "print": {
          // Print emulation typically removes nav / footer / sticky
          // headers, replaces backgrounds with white. Look for
          // explicit `@media print` rules in the stylesheet text.
          const hasPrintRule = /@media[^{]*\bprint\b/i.test(allCss);
          if (hasPrintRule) {
            verdict = "ok";
            note = `Stylesheet declares \`@media print\` (Δ ${(deltaRatio * 100).toFixed(1)}%).`;
          } else if (deltaRatio < 0.005) {
            verdict = "warn";
            note = "Page renders nearly identically under print media — no `@media print` rule detected.";
          } else {
            verdict = "warn";
            note = `Some print-mode differences (Δ ${(deltaRatio * 100).toFixed(1)}%) but no \`@media print\` rule in stylesheet — UA defaults only.`;
          }
          break;
        }
        case "rtl": {
          // Pages with `dir="rtl"` should mirror horizontally. The
          // physical-property smell test is more reliable than pixel
          // delta on small pages: scan stylesheet text for
          // margin-left / margin-right / padding-left / padding-right
          // / text-align: left|right / left: / right: declarations.
          const physicalRe = /(margin|padding)-(left|right)\s*:|text-align\s*:\s*(left|right)\b|\b(left|right)\s*:\s*[^;]/gi;
          const matches = allCss.match(physicalRe) ?? [];
          const physicalCount = matches.length;
          if (physicalCount >= 2) {
            verdict = "suspect";
            note = `Stylesheet has ${physicalCount} physical property uses (margin-left / margin-right / text-align: left / etc.). Switch to logical equivalents (margin-inline-start, text-align: start) so layout flips correctly under RTL.`;
          } else if (physicalCount === 1) {
            verdict = "warn";
            note = `Stylesheet has 1 physical property use — review whether this should be logical for RTL.`;
          } else if (deltaRatio < 0.005) {
            verdict = "suspect";
            note = "Layout barely flipped under `dir=rtl` — page likely uses physical properties or has no horizontal layout to flip.";
          } else {
            note = `Layout responds to RTL (Δ ${(deltaRatio * 100).toFixed(1)}%, ${physicalCount} physical-prop uses).`;
          }
          break;
        }
        case "zoom-200": {
          // WCAG 1.4.10 (Reflow) requires content to fit without
          // horizontal scrolling at 200% zoom. Check
          // scrollWidth > clientWidth on the zoomed page — that's the
          // exact criterion for "needs horizontal scroll." Pixel delta
          // alone is misleading (a perfectly-reflowing page can have
          // 70%+ delta because layout rewrapped).
          if (zoomOverflow && zoomOverflow.scrollWidth > zoomOverflow.clientWidth + 4) {
            verdict = "suspect";
            note = `Horizontal scroll required at 200% zoom (scrollWidth ${zoomOverflow.scrollWidth} > clientWidth ${zoomOverflow.clientWidth}) — WCAG 1.4.10 violation.`;
          } else {
            note = `Reflowed at 200% zoom without horizontal scroll (Δ ${(deltaRatio * 100).toFixed(1)}%).`;
          }
          break;
        }
      }

      variantResults.push({
        variant, screenshotPath, deltaRatio, deltaPixels, totalPixels,
        verdict, note,
      });
    }
  });

  const reportPath = options.reportPath ?? join(outputDir, "report.md");
  const md = renderReport({
    source: options.source,
    viewport,
    defaultScreenshot,
    variants: variantResults,
  });
  await writeFile(reportPath, md);

  return {
    source: options.source, viewport, defaultScreenshot,
    variants: variantResults, reportPath,
  };
}

/**
 * Terminal summary, extracted from the measurement function. A gate's `run`
 * must not print — the core runner owns output and decides between prose and
 * `--json`.
 */
export function formatMediaVariantsReport(report: MediaVariantsReport): string {
  const lines: string[] = [];
  lines.push(`  ${BOLD}${CYAN}vlmkit stress media${RESET}`);
  lines.push(`  ${DIM}source: ${report.source}${RESET}`);
  for (const v of report.variants) {
    const icon = v.verdict === "ok" ? `${GREEN}✓${RESET}`
      : v.verdict === "warn" ? `${YELLOW}!${RESET}`
      : v.verdict === "suspect" ? `${RED}✗${RESET}`
      : `${DIM}-${RESET}`;
    lines.push(`  ${icon} ${v.variant.padEnd(16)} Δ ${(v.deltaRatio * 100).toFixed(2).padStart(6)}%  ${DIM}${v.note}${RESET}`);
  }
  lines.push(`  ${DIM}report: ${report.reportPath}${RESET}`);
  return lines.join("\n");
}

function renderReport(r: Omit<MediaVariantsReport, "reportPath">): string {
  const lines: string[] = [];
  lines.push("# Media-variant report");
  lines.push("");
  lines.push(`Source: \`${r.source}\` at ${r.viewport.width}×${r.viewport.height}`);
  lines.push("");
  lines.push("Each row renders the page under a different user-preference setting " +
    "and diffs against the default. The **Verdict** column applies a heuristic " +
    "per variant — `suspect` means the page didn't respond to the variant when " +
    "it likely should have.");
  lines.push("");
  lines.push("| Variant | Δ vs default | Verdict | Note |");
  lines.push("|---|---|---|---|");
  for (const v of r.variants) {
    const verdictIcon = v.verdict === "ok" ? "✓"
      : v.verdict === "warn" ? "⚠"
      : v.verdict === "suspect" ? "✗"
      : "—";
    lines.push(`| \`${v.variant}\` | ${(v.deltaRatio * 100).toFixed(2)}% | ${verdictIcon} ${v.verdict} | ${v.note} |`);
  }
  lines.push("");
  lines.push("## Screenshots");
  lines.push("");
  lines.push(`- default: \`${r.defaultScreenshot}\``);
  for (const v of r.variants) {
    lines.push(`- ${v.variant}: \`${v.screenshotPath}\``);
  }
  lines.push("");
  lines.push("## Suggested next step");
  lines.push("");
  const suspects = r.variants.filter((v) => v.verdict === "suspect");
  const warns = r.variants.filter((v) => v.verdict === "warn");
  if (suspects.length === 0 && warns.length === 0) {
    lines.push("All variants responded as expected. Page handles common user " +
      "preferences gracefully.");
  } else {
    if (suspects.length > 0) {
      lines.push(`**${suspects.length} variant(s) flagged as suspect** — the page didn't adapt:`);
      lines.push("");
      for (const v of suspects) {
        lines.push(`- \`${v.variant}\`: ${v.note}`);
      }
      lines.push("");
    }
    if (warns.length > 0) {
      lines.push(`${warns.length} warning(s) — review the listed variants and either confirm intended behavior or add the relevant CSS:`);
      lines.push("");
      for (const v of warns) {
        lines.push(`- \`${v.variant}\`: ${v.note}`);
      }
      lines.push("");
    }
    lines.push("Quick patches by variant:");
    lines.push("  - `forced-colors`: set `forced-color-adjust: auto` on themed elements; use `CanvasText` / `LinkText` system colors.");
    lines.push("  - `reduced-motion`: wrap animations in `@media (prefers-reduced-motion: no-preference) { /* keyframes */ }` or override with `@media (prefers-reduced-motion: reduce) { *, *::before, *::after { animation: none; transition: none; } }`.");
    lines.push("  - `print`: add `@media print { .no-print { display: none; } body { background: white; } }`.");
    lines.push("  - `rtl`: replace `margin-left` / `padding-right` / `text-align: left` with `margin-inline-start` / `padding-inline-end` / `text-align: start`.");
    lines.push("  - `zoom-200`: avoid fixed `width` on text containers; use `max-width` + `min-width: 0`; allow text wrapping.");
  }
  lines.push("");
  return lines.join("\n");
}

/**
 * CLI entry removed: this module is measurement code now, not a command.
 * `stress media` is declared in `../gates/stress.gate.ts` and driven by the core runner
 * (`@mizchi/vlmkit-core/plugin/runner.ts`), which owns argument parsing,
 * `--json`, `--advisory`, the run ledger and the exit code.
 */
