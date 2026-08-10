#!/usr/bin/env node
/**
 * Web-perf check (CLS / LCP / FCP / layout-shift sources).
 *
 * Lighthouse-light: uses Playwright's in-page `PerformanceObserver`
 * to measure the visual-stability metrics that overlap with VRT's
 * lane — primarily CLS (Cumulative Layout Shift) since CLS *is* a
 * visual regression. Also surfaces LCP, FCP, and the specific
 * elements that triggered each layout shift, which is the data
 * Lighthouse provides but that's hard to get from a static
 * screenshot.
 *
 * No Lighthouse dependency — uses standard W3C PerformanceObserver
 * APIs that Chromium has shipped since 2020. Runs in ~3-5s vs
 * Lighthouse's ~30s.
 *
 * Usage:
 *   vlmkit check perf <url>
 *   vlmkit check perf <html>           # local HTML supported via setContent
 */
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { handleCliError } from "@mizchi/vlmkit-core/cli-error.ts";
import { DIM, RESET, GREEN, RED, YELLOW, BOLD, CYAN } from "@mizchi/vlmkit-core/terminal-colors.ts";
import { withBrowser } from "@mizchi/vlmkit-core/browser-launch.ts";

export interface PerfOptions {
  source: string;
  outputDir: string;
  reportPath?: string;
  viewport?: { width: number; height: number };
  /** Wait time (ms) after page load before reading metrics. Default 3000. */
  observeMs?: number;
}

export interface LayoutShiftSource {
  /** A short DOM path like `main>section>div.card`. */
  path: string;
  tag: string;
  value: number;
  /** Was the shift caused by user input? CLS excludes input-triggered shifts. */
  hadRecentInput: boolean;
}

export interface PerfReport {
  source: string;
  viewport: { width: number; height: number };
  /**
   * Observation window after networkidle, in ms. On the report because CLS is
   * only meaningful relative to how long it was measured for — a reader
   * comparing two runs needs to know the windows matched.
   */
  observeMs: number;
  /** Cumulative Layout Shift score (CLS). Good ≤ 0.1, poor > 0.25. */
  cls: number;
  /** Largest Contentful Paint (ms). Good ≤ 2500, poor > 4000. */
  lcp: number;
  /** First Contentful Paint (ms). Good ≤ 1800, poor > 3000. */
  fcp: number;
  /** Time to first byte (ms). */
  ttfb: number;
  /** Top layout-shift sources ordered by individual `value` desc. */
  shiftSources: LayoutShiftSource[];
  /** Total number of layout-shift events observed (regardless of source attribution). */
  shiftEvents: number;
  /** LCP element identity (the largest visible content node). */
  lcpElement?: { path: string; tag: string; text: string };
  /** Computed verdict per metric. */
  verdicts: {
    cls: "good" | "needs-improvement" | "poor";
    lcp: "good" | "needs-improvement" | "poor";
    fcp: "good" | "needs-improvement" | "poor";
  };
  reportPath: string;
}

function isUrl(s: string): boolean { return /^https?:\/\//.test(s); }

const PERF_INSTALL_SCRIPT = `
(function installPerf() {
  const data = { cls: 0, shifts: [], shiftEvents: 0, lcp: 0, fcp: 0, ttfb: 0, lcpEl: null };
  window.__vrtPerf = data;
  function shortPath(el) {
    const parts = [];
    let cur = el;
    while (cur && cur !== document.body && parts.length < 5) {
      let p = cur.tagName ? cur.tagName.toLowerCase() : '#text';
      if (cur.id) p += '#' + cur.id;
      else if (cur.className && typeof cur.className === 'string') {
        const cls = cur.className.trim().split(/\\s+/).slice(0, 2).join('.');
        if (cls) p += '.' + cls;
      }
      parts.unshift(p);
      cur = cur.parentElement;
    }
    return parts.join('>');
  }
  try {
    new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        // Include shifts regardless of hadRecentInput in the *shifts*
        // list — the per-source filter still applies below. Filtering
        // only at aggregation time matches Chrome's CLS calculation
        // when the page has no real user input (Playwright's
        // setContent fires a synthetic navigation that some Chromium
        // versions flag as input-related).
        // Always sum into CLS (see note above re: hadRecentInput).
        data.cls += entry.value;
        data.shiftEvents++;
        const sources = entry.sources || [];
        if (sources.length === 0) {
          // Layout shift without an identified source — common for
          // text-pushing shifts where the *moved* element is anonymous.
          data.shifts.push({
            path: '(unknown source)',
            tag: '?',
            value: entry.value,
            hadRecentInput: false,
          });
          continue;
        }
        for (const src of sources) {
          const el = src.node;
          if (!el || !el.tagName) continue;
          data.shifts.push({
            path: shortPath(el),
            tag: el.tagName.toLowerCase(),
            value: entry.value,
            hadRecentInput: entry.hadRecentInput,
          });
        }
      }
    }).observe({ type: 'layout-shift', buffered: true });
  } catch {}
  try {
    new PerformanceObserver((list) => {
      const entries = list.getEntries();
      const last = entries[entries.length - 1];
      if (last) {
        data.lcp = last.startTime;
        const el = last.element;
        if (el && el.tagName) {
          data.lcpEl = {
            path: shortPath(el),
            tag: el.tagName.toLowerCase(),
            text: (el.textContent || el.getAttribute('alt') || '').trim().slice(0, 60),
          };
        }
      }
    }).observe({ type: 'largest-contentful-paint', buffered: true });
  } catch {}
  try {
    new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        if (entry.name === 'first-contentful-paint') data.fcp = entry.startTime;
      }
    }).observe({ type: 'paint', buffered: true });
  } catch {}
  try {
    const nav = performance.getEntriesByType('navigation')[0];
    if (nav) data.ttfb = nav.responseStart;
  } catch {}
})();
`;

function classify(value: number, good: number, poor: number): "good" | "needs-improvement" | "poor" {
  if (value <= good) return "good";
  if (value <= poor) return "needs-improvement";
  return "poor";
}

/**
 * What the in-page observers hand back.
 *
 * Named rather than inlined on a `let raw: {…}` because the value now comes out
 * of the `withBrowser` callback, and the in-page cast used to spell its type
 * `typeof raw` — which stops resolving once `raw` is the callback's result.
 */
type PerfRaw = {
  cls: number;
  shifts: Array<{ path: string; tag: string; value: number; hadRecentInput: boolean }>;
  shiftEvents: number;
  lcp: number;
  fcp: number;
  ttfb: number;
  lcpEl: { path: string; tag: string; text: string } | null;
};

export async function runPerf(options: PerfOptions): Promise<PerfReport> {
  const outputDir = resolve(options.outputDir);
  await mkdir(outputDir, { recursive: true });
  const viewport = options.viewport ?? { width: 1280, height: 720 };
  const observeMs = options.observeMs ?? 3000;

  const raw = await withBrowser(async (browser) => {
    const page = await browser.newPage({ viewport });
    // Install observers BEFORE the page loads. Two paths:
    //   - URL mode: `page.addInitScript` fires before any author
    //     script on the goto navigation.
    //   - HTML mode: setContent does NOT trigger addInitScript
    //     callbacks. Inject the install script directly into the
    //     HTML's <head> before passing to setContent.
    if (isUrl(options.source)) {
      await page.addInitScript(PERF_INSTALL_SCRIPT);
      await page.goto(options.source, { waitUntil: "networkidle", timeout: 30000 });
    } else {
      let html = await readFile(resolve(options.source), "utf-8");
      const installTag = `<script>${PERF_INSTALL_SCRIPT}</script>`;
      // Prefer injecting after the opening <head> (or <html> as fallback)
      // so observers are installed before any author script in the page.
      if (/<head[^>]*>/i.test(html)) {
        html = html.replace(/(<head[^>]*>)/i, `$1${installTag}`);
      } else if (/<html[^>]*>/i.test(html)) {
        html = html.replace(/(<html[^>]*>)/i, `$1<head>${installTag}</head>`);
      } else {
        html = `${installTag}${html}`;
      }
      await page.setContent(html, { waitUntil: "networkidle" });
    }
    // Observe for the requested window — layout shifts often happen
    // late as fonts / images / lazy-loaded content settle.
    await page.waitForTimeout(observeMs);
    // Fallback: if addInitScript didn't fire (some edge cases with
    // setContent on Playwright 1.5x), install observers now and wait
    // again for a shorter window. The data we capture this way misses
    // the earliest paint, but at least the call doesn't crash.
    const installed = await page.evaluate(() => "__vrtPerf" in (window as unknown as Record<string, unknown>));
    if (!installed) {
      await page.evaluate(PERF_INSTALL_SCRIPT);
      await page.waitForTimeout(Math.min(observeMs, 1500));
    }
    const measured = await page.evaluate(() => {
      const w = window as unknown as { __vrtPerf?: PerfRaw };
      return w.__vrtPerf ?? { cls: 0, shifts: [], shiftEvents: 0, lcp: 0, fcp: 0, ttfb: 0, lcpEl: null };
    }) as PerfRaw;
    await page.close();
    return measured;
  });

  // Aggregate per-element shift contributions; sort by largest.
  const byElement = new Map<string, LayoutShiftSource>();
  for (const s of raw.shifts) {
    if (s.hadRecentInput) continue;  // input-triggered shifts don't count toward CLS
    const existing = byElement.get(s.path);
    if (existing) existing.value += s.value;
    else byElement.set(s.path, { ...s });
  }
  const shiftSources = [...byElement.values()].sort((a, b) => b.value - a.value);

  const cls = Number(raw.cls.toFixed(4));
  const lcp = Math.round(raw.lcp);
  const fcp = Math.round(raw.fcp);
  const ttfb = Math.round(raw.ttfb);

  const verdicts = {
    cls: classify(cls, 0.1, 0.25),
    lcp: classify(lcp, 2500, 4000),
    fcp: classify(fcp, 1800, 3000),
  };

  const reportPath = options.reportPath ?? join(outputDir, "report.md");
  const md = renderReport({
    source: options.source, viewport, observeMs,
    cls, lcp, fcp, ttfb,
    shiftSources, shiftEvents: raw.shiftEvents,
    lcpElement: raw.lcpEl ?? undefined, verdicts,
  });
  await writeFile(reportPath, md);


  return {
    source: options.source, viewport, observeMs,
    cls, lcp, fcp, ttfb, shiftSources, shiftEvents: raw.shiftEvents,
    lcpElement: raw.lcpEl ?? undefined, verdicts, reportPath,
  };
}

/**
 * Terminal summary, extracted from the measurement function. A gate's `run`
 * must not print — the core runner owns output and decides between prose and
 * `--json`.
 */
export function formatPerfReport(report: PerfReport): string {
  const lines: string[] = [];
  lines.push(`  ${BOLD}${CYAN}vlmkit check perf${RESET}`);
  lines.push(`  ${DIM}source: ${report.source}  observed: ${report.observeMs}ms${RESET}`);
  const icon = (v: "good" | "needs-improvement" | "poor") =>
    v === "good" ? `${GREEN}✓${RESET}` : v === "needs-improvement" ? `${YELLOW}!${RESET}` : `${RED}✗${RESET}`;
  lines.push(`  ${icon(report.verdicts.cls)} CLS  ${report.cls.toString().padStart(6)}  ${DIM}(good ≤ 0.1, poor > 0.25)${RESET}`);
  lines.push(`  ${icon(report.verdicts.lcp)} LCP  ${report.lcp.toString().padStart(6)}  ${DIM}ms (good ≤ 2500, poor > 4000)${RESET}`);
  lines.push(`  ${icon(report.verdicts.fcp)} FCP  ${report.fcp.toString().padStart(6)}  ${DIM}ms (good ≤ 1800, poor > 3000)${RESET}`);
  if (report.shiftSources.length > 0) {
    lines.push(`  ${DIM}top shift source: ${report.shiftSources[0]!.path} (${report.shiftSources[0]!.value.toFixed(4)})${RESET}`);
  }
  lines.push(`  ${DIM}report: ${report.reportPath}${RESET}`);
  return lines.join("\n");
}

function renderReport(r: Omit<PerfReport, "reportPath">): string {
  const lines: string[] = [];
  lines.push("# Web-perf report (CLS / LCP / FCP)");
  lines.push("");
  lines.push(`Source: \`${r.source}\` at ${r.viewport.width}×${r.viewport.height}`);
  lines.push("");
  lines.push("Captures Web Vitals via in-page `PerformanceObserver` — no Lighthouse " +
    "dependency. Numbers reflect a single observation window from `networkidle` " +
    "+ a settling delay; for production monitoring use a dedicated RUM tool.");
  lines.push("");
  lines.push("## Core Web Vitals");
  lines.push("");
  lines.push("| Metric | Value | Verdict |");
  lines.push("|---|---|---|");
  const icon = (v: string) => v === "good" ? "✓" : v === "needs-improvement" ? "⚠" : "✗";
  lines.push(`| **CLS** (Cumulative Layout Shift) | ${r.cls} | ${icon(r.verdicts.cls)} ${r.verdicts.cls} |`);
  lines.push(`| **LCP** (Largest Contentful Paint) | ${r.lcp} ms | ${icon(r.verdicts.lcp)} ${r.verdicts.lcp} |`);
  lines.push(`| **FCP** (First Contentful Paint) | ${r.fcp} ms | ${icon(r.verdicts.fcp)} ${r.verdicts.fcp} |`);
  lines.push(`| TTFB | ${r.ttfb} ms | — |`);
  lines.push("");
  lines.push("Thresholds: CLS good ≤ 0.1 / poor > 0.25 · LCP good ≤ 2500 ms / poor > 4000 ms · FCP good ≤ 1800 ms / poor > 3000 ms.");
  lines.push("");

  if (r.lcpElement) {
    lines.push("## LCP element");
    lines.push("");
    lines.push(`The largest contentful element on this page is \`${r.lcpElement.path}\` ` +
      `(\`${r.lcpElement.tag}\`)${r.lcpElement.text ? ` — "${r.lcpElement.text}"` : ""}.`);
    lines.push("");
    if (r.verdicts.lcp !== "good") {
      lines.push("LCP optimization usually targets this specific element: preload its " +
        "image, inline its critical CSS, or move it earlier in the DOM.");
      lines.push("");
    }
  }

  if (r.cls > 0 || r.shiftSources.length > 0) {
    lines.push("## Layout-shift sources");
    lines.push("");
    lines.push(`Observed **${r.shiftEvents}** layout-shift event(s) during the ${r.viewport.width}×${r.viewport.height} capture window.`);
    lines.push("");
    if (r.shiftSources.length > 0) {
      lines.push("| Element | Tag | Contribution |");
      lines.push("|---|---|---|");
      for (const s of r.shiftSources.slice(0, 10)) {
        lines.push(`| \`${s.path}\` | \`${s.tag}\` | ${s.value.toFixed(4)} |`);
      }
      lines.push("");
    } else {
      lines.push("_(No element-level source attribution available — Chromium's " +
        "`LayoutShift.sources` is empty for shifts that propagate from " +
        "the document root, JS-injected content, or font swap. The CLS " +
        "score is still trustworthy.)_");
      lines.push("");
    }
    if (r.verdicts.cls !== "good") {
      lines.push("CLS fixes by element:");
      lines.push("- **Images**: add explicit `width` + `height` attrs so the browser " +
        "reserves space before the image loads.");
      lines.push("- **Fonts**: use `font-display: optional` or preload critical fonts to " +
        "avoid mid-load layout reflow.");
      lines.push("- **Ads / embeds**: reserve fixed-size containers with `min-height` " +
        "even when content is dynamic.");
      lines.push("- **`@media` / responsive layouts**: avoid layout-affecting CSS that " +
        "applies after first paint.");
      lines.push("");
    }
  }

  lines.push("## Note on scope");
  lines.push("");
  lines.push("`vlmkit check perf` covers visual-stability metrics (CLS, LCP) that overlap " +
    "with the VRT toolkit's lane. For full Web Vitals analysis (TBT, INP, " +
    "JavaScript bundle size, network waterfall), run a dedicated tool like " +
    "Lighthouse, PageSpeed Insights, or WebPageTest. This tool's value is " +
    "a fast (~3s) check that catches the regression classes a pixel-diff " +
    "tool can't see directly — fonts swapping in, images loading without " +
    "reserved space, JS-injected content shifting layout post-paint.");
  lines.push("");
  return lines.join("\n");
}

/**
 * CLI entry removed: this module is measurement code now, not a command.
 * `check perf` is declared in `../gates/perf.gate.ts` and driven by the core runner
 * (`@mizchi/vlmkit-core/plugin/runner.ts`), which owns argument parsing,
 * `--json`, `--advisory`, the run ledger and the exit code.
 */
