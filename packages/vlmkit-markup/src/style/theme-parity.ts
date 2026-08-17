#!/usr/bin/env node
/**
 * Theme parity check.
 *
 * Catches "agent added dark mode but forgot to update some elements"
 * — a class of bug where the page mostly responds to a theme toggle
 * but specific elements keep their light-mode colors (hard-coded fill
 * / text / border that doesn't reference a CSS variable).
 *
 * Approach: render the same HTML once with `prefers-color-scheme:
 * light` and once with `dark`, via Playwright's
 * `page.emulateMedia({ colorScheme })`. Per-component:
 *  - extract dominant fill via per-bbox color sampling
 *  - compare light-render fill ↔ dark-render fill
 *  - flag bboxes where the fill is identical → "unthemed" element
 *
 * No source-code analysis — the signal is purely visual. Works with
 * any styling approach (CSS variables, data-attribute toggles, etc.)
 * as long as the page responds to the standard
 * `prefers-color-scheme` media query.
 *
 * Usage:
 *   vlmkit check theme <html> [--output-dir dir]
 */
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { basename, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { PNG } from "pngjs";
import { type PageLoadOptions, pickPageLoad } from "@mizchi/vlmkit-core/page-load.ts";
import { openSource, resolveSource } from "@mizchi/vlmkit-core/page-open.ts";
import { extractComponentsFromFile, type ComponentBbox } from "../component/component-bbox.ts";
import { DIM, RESET, GREEN, RED, YELLOW, BOLD, CYAN } from "@mizchi/vlmkit-core/terminal-colors.ts";
import type { RuleView } from "@mizchi/vlmkit-core/plugin/contract.ts";
import { ruleTier } from "@mizchi/vlmkit-core/plugin/rule-tier.ts";
import { handleCliError } from "@mizchi/vlmkit-core/cli-error.ts";
import { withBrowser } from "@mizchi/vlmkit-core/browser-launch.ts";

export interface ThemeParityOptions extends PageLoadOptions {
  htmlPath: string;
  outputDir: string;
  reportPath?: string;
  viewport?: { width: number; height: number };
  /** Per-axis RGB delta threshold below which two colors are "the same". Default 16. */
  unchangedColorThreshold?: number;
  /**
   * How the page turns dark, when auto-detection gets it wrong: a class on the root
   * (`dark`, `.theme-dark`) or an attribute (`data-theme=dark`).
   *
   * Auto-detection reads the stylesheets, so it needs no flag on any of the common setups.
   * The override exists for the case it cannot see: a dark rule injected by script after
   * measurement, or a class the site applies to something other than `<html>`.
   */
  darkSelector?: string;
}

/**
 * How a page expresses dark mode. Not a preference — a fact about its CSS, measured.
 *
 * Flipping `prefers-color-scheme` is the only strategy this gate exercised for its first year,
 * and it is not the common one. Measured on vite.dev: `prefers-color-scheme` appears ZERO times
 * in its stylesheets while `.dark` appears 47, including `:root.dark`. The gate reported
 * `theme pixel delta: 0.0% (page barely responds to color scheme)` and
 * `unthemed components: 8 of 8` for a site with a working theme toggle — a false claim about
 * the majority strategy (Tailwind `darkMode: "class"`, VitePress, next-themes, Docusaurus's
 * `data-theme`).
 */
export type ThemeStrategy = "media" | "class" | "attribute" | "none";

export interface ThemeStrategyDetection {
  strategy: ThemeStrategy;
  /** `prefers-color-scheme: dark` rule count found in readable stylesheets. */
  mediaRules: number;
  /** The root class or attribute the dark render applied, when not `media`. */
  darkSelector?: string;
  /** Stylesheets the browser refused to expose (cross-origin) — the blind spot in the count. */
  unreadableSheets: number;
}

/**
 * Read the page's own CSS and report which dark-mode strategy it uses.
 *
 * Counting rules rather than trusting one match: a single stray `.dark` in a vendor reset must
 * not outvote a page built on the media query. Class candidates are checked against what is
 * actually in the stylesheets, so a page with no dark styling at all still reports `none` and
 * gets today's advice.
 */
export const DETECT_THEME_STRATEGY = `(() => {
  // Written without a single regex built from a string, and with no nested quote characters.
  // The first version used new RegExp("...\\\\s...") inside this template literal and shipped a
  // broken script twice over: the backslashes collapsed, so the emitted pattern was
  // [s,>+~] (matching a literal "s") and the attribute test did not even parse. Plain string
  // work is longer here and cannot be silently mangled by one more layer of escaping.
  const CLASS_CANDIDATES = ["dark", "dark-mode", "theme-dark", "dark-theme"];
  const ATTR_CANDIDATES = ["data-theme", "data-mode", "data-color-scheme", "data-bs-theme"];
  const DELIMS = [" ", ">", "+", "~", ":", "[", ".", ""];
  // A selector themes the PAGE when the class sits on the root (or on nothing, i.e. a bare
  // descendant scope). A component called .dark-badge says nothing about the strategy, which is
  // why this is prefix-plus-delimiter rather than a substring test.
  const themesPage = (selector, cls) => selector.split(",").some((part) => {
    const p = part.trim();
    for (const prefix of ["." + cls, "html." + cls, ":root." + cls, "body." + cls]) {
      if (!p.startsWith(prefix)) continue;
      if (DELIMS.indexOf(p.charAt(prefix.length)) !== -1) return true;
    }
    return false;
  });
  const namesDarkAttr = (selector, attr) => selector.split(",").some((part) => {
    const p = part.trim();
    const at = p.indexOf("[" + attr);
    if (at === -1) return false;
    const close = p.indexOf("]", at);
    return close !== -1 && p.slice(at, close).indexOf("dark") !== -1;
  });
  let mediaRules = 0, unreadable = 0;
  const classHits = new Map(), attrHits = new Map();
  const walk = (rules) => {
    for (const rule of rules) {
      const condition = String(rule.conditionText || (rule.media && rule.media.mediaText) || "");
      if (condition && condition.split(" ").join("").indexOf("prefers-color-scheme:dark") !== -1) {
        mediaRules += rule.cssRules ? rule.cssRules.length : 1;
      }
      const sel = rule.selectorText;
      if (sel) {
        for (const c of CLASS_CANDIDATES) {
          if (themesPage(sel, c)) classHits.set(c, (classHits.get(c) || 0) + 1);
        }
        for (const a of ATTR_CANDIDATES) {
          if (namesDarkAttr(sel, a)) attrHits.set(a + "=dark", (attrHits.get(a + "=dark") || 0) + 1);
        }
      }
      if (rule.cssRules) walk(rule.cssRules);
    }
  };
  for (const sheet of Array.from(document.styleSheets)) {
    try { walk(Array.from(sheet.cssRules)); } catch (e) { unreadable++; }
  }
  const best = (m) => Array.from(m.entries()).sort((a, b) => b[1] - a[1])[0];
  const topClass = best(classHits), topAttr = best(attrHits);
  const classCount = topClass ? topClass[1] : 0;
  const attrCount = topAttr ? topAttr[1] : 0;
  // Counting rules rather than trusting one match: a stray .dark in a vendor reset must not
  // outvote a page built on the media query, and a page can carry both.
  if (mediaRules > 0 && mediaRules >= classCount && mediaRules >= attrCount) {
    return { strategy: "media", mediaRules: mediaRules, unreadableSheets: unreadable };
  }
  if (classCount > 0 && classCount >= attrCount) {
    return { strategy: "class", mediaRules: mediaRules, darkSelector: topClass[0], unreadableSheets: unreadable };
  }
  if (attrCount > 0) {
    return { strategy: "attribute", mediaRules: mediaRules, darkSelector: topAttr[0], unreadableSheets: unreadable };
  }
  return { strategy: "none", mediaRules: mediaRules, unreadableSheets: unreadable };
})()`;

export interface UnthemedBbox {
  rank: number;
  bbox: { top: number; left: number; width: number; height: number };
  lightFill: { r: number; g: number; b: number; hex: string };
  darkFill: { r: number; g: number; b: number; hex: string };
  /** RGB Euclidean distance between light and dark fill. */
  fillDelta: number;
}

export interface ThemeParityReport {
  html: string;
  viewport: { width: number; height: number };
  lightScreenshot: string;
  darkScreenshot: string;
  /** Pixel diff % between light and dark renders. Low % suggests the page barely responds to the toggle. */
  themePixelDelta: number;
  unthemed: UnthemedBbox[];
  /** All matched bboxes (for transparency). */
  totalMatched: number;
  /**
   * Which strategy the dark render actually exercised.
   *
   * Printed next to the delta, because what a 0.0% delta MEANS depends entirely on this: with
   * `media` on a class-themed page it means the gate flipped something the page ignores.
   */
  themeStrategy: ThemeStrategyDetection;
  reportPath: string;
}

function toHex(r: number, g: number, b: number): string {
  const c = (n: number) => n.toString(16).padStart(2, "0");
  return `#${c(r)}${c(g)}${c(b)}`;
}

/** Sample a bbox region's dominant color by averaging pixels (cheap; good enough for solid fills). */
function sampleBboxFill(
  data: Uint8Array,
  width: number,
  bbox: { top: number; left: number; width: number; height: number },
): { r: number; g: number; b: number } {
  // Sample a 5×5 grid inside the bbox, avoid edges (anti-aliasing).
  const inset = 2;
  const x0 = bbox.left + inset, x1 = bbox.left + bbox.width - inset;
  const y0 = bbox.top + inset, y1 = bbox.top + bbox.height - inset;
  if (x1 <= x0 || y1 <= y0) {
    const i = (bbox.top * width + bbox.left) * 4;
    return { r: data[i]!, g: data[i + 1]!, b: data[i + 2]! };
  }
  let r = 0, g = 0, b = 0, n = 0;
  const stepX = Math.max(1, Math.floor((x1 - x0) / 5));
  const stepY = Math.max(1, Math.floor((y1 - y0) / 5));
  for (let y = y0; y < y1; y += stepY) {
    for (let x = x0; x < x1; x += stepX) {
      const i = (y * width + x) * 4;
      r += data[i]!;
      g += data[i + 1]!;
      b += data[i + 2]!;
      n++;
    }
  }
  return { r: Math.round(r / n), g: Math.round(g / n), b: Math.round(b / n) };
}

function dist(a: { r: number; g: number; b: number }, b: { r: number; g: number; b: number }): number {
  const dr = a.r - b.r, dg = a.g - b.g, db = a.b - b.b;
  return Math.sqrt(dr * dr + dg * dg + db * db);
}

export async function runThemeParity(
  options: ThemeParityOptions,
): Promise<ThemeParityReport> {
  const outputDir = resolve(options.outputDir);
  await mkdir(outputDir, { recursive: true });
  // A URL is a valid source now that loading goes through `openSource`;
  // `resolve()` would have turned it into `<cwd>/http:/host/page.html`.
  const htmlPath = resolveSource(options.htmlPath);
  const viewport = options.viewport ?? { width: 1280, height: 900 };
  const unchangedThreshold = options.unchangedColorThreshold ?? 16;

  return await withBrowser(async (browser) => {
    // Light render.
    // Navigate, so an external stylesheet actually participates in the theme
    // comparison — the whole point of the gate.
    const { page: lightPage } = await openSource(browser, htmlPath, {
      viewport,
      colorScheme: "light",
      settleMs: 0,
      // Both renders load under identical rules: comparing a settled light
      // render against an early dark one would report the difference as a
      // theme defect.
      ...pickPageLoad(options),
    });
    // Disable transitions/animations for deterministic capture (cf.
    // Subagent H dogfood, same root cause as multi-state state diffs).
    await lightPage.addStyleTag({
      content: `*, *::before, *::after {
        transition: none !important;
        animation: none !important;
      }`,
    });
    // Read the page's own CSS before screenshotting it: which strategy the dark render should
    // use is a fact about the stylesheets, and getting it wrong is how this gate came to report
    // `0.0% delta, 8 of 8 unthemed` for a site whose theme toggle works.
    const detected = options.darkSelector
      ? {
        strategy: (options.darkSelector.includes("=") ? "attribute" : "class") as ThemeStrategy,
        mediaRules: 0,
        darkSelector: options.darkSelector,
        unreadableSheets: 0,
      }
      : await lightPage.evaluate(DETECT_THEME_STRATEGY) as ThemeStrategyDetection;
    const lightPath = join(outputDir, "light.png");
    await lightPage.screenshot({ path: lightPath, fullPage: false });
    await lightPage.close();

    // Dark render. `colorScheme: "dark"` stays on for every strategy — it is what a
    // media-query page reads, it costs nothing on a class-themed one, and a page can use both.
    const { page: darkPage } = await openSource(browser, htmlPath, {
      viewport,
      colorScheme: "dark",
      settleMs: 0,
      ...pickPageLoad(options),
    });
    if (detected.strategy === "class" && detected.darkSelector) {
      // On the root element, which is where every class-strategy library puts it
      // (`document.documentElement.classList`). Applied after load so the site's own
      // preference script has already run and cannot overwrite it.
      await darkPage.evaluate((cls) => document.documentElement.classList.add(cls), detected.darkSelector);
    } else if (detected.strategy === "attribute" && detected.darkSelector) {
      const [name, value = "dark"] = detected.darkSelector.split("=");
      await darkPage.evaluate(([n, v]) => document.documentElement.setAttribute(n!, v!), [name, value]);
    }
    await darkPage.addStyleTag({
      content: `*, *::before, *::after {
        transition: none !important;
        animation: none !important;
      }`,
    });
    const darkPath = join(outputDir, "dark.png");
    await darkPage.screenshot({ path: darkPath, fullPage: false });
    await darkPage.close();

    // Per-pixel theme delta — how much of the page actually responded.
    const lightPng = PNG.sync.read(await readFile(lightPath));
    const darkPng = PNG.sync.read(await readFile(darkPath));
    let changedPixels = 0;
    const totalPixels = lightPng.width * lightPng.height;
    for (let i = 0; i < lightPng.data.length; i += 4) {
      const d = Math.abs(lightPng.data[i]! - darkPng.data[i]!)
        + Math.abs(lightPng.data[i + 1]! - darkPng.data[i + 1]!)
        + Math.abs(lightPng.data[i + 2]! - darkPng.data[i + 2]!);
      if (d >= 24) changedPixels++;  // ~8/channel — robust to AA
    }
    const themePixelDelta = changedPixels / totalPixels;

    // Bbox-level theme parity: extract components from the light
    // render, then for each, sample its fill from BOTH renders. A
    // component whose fill barely changes is unthemed.
    const lightBboxes = await extractComponentsFromFile(lightPath).catch(() => [] as ComponentBbox[]);
    const unthemed: UnthemedBbox[] = [];
    let totalMatched = 0;
    for (let i = 0; i < lightBboxes.length; i++) {
      const bbox = lightBboxes[i]!;
      totalMatched++;
      const lightFill = sampleBboxFill(lightPng.data, lightPng.width, bbox);
      const darkFill = sampleBboxFill(darkPng.data, darkPng.width, bbox);
      const delta = dist(lightFill, darkFill);
      if (delta < unchangedThreshold) {
        unthemed.push({
          rank: i,
          bbox: { top: bbox.top, left: bbox.left, width: bbox.width, height: bbox.height },
          lightFill: { ...lightFill, hex: toHex(lightFill.r, lightFill.g, lightFill.b) },
          darkFill: { ...darkFill, hex: toHex(darkFill.r, darkFill.g, darkFill.b) },
          fillDelta: delta,
        });
      }
    }

    const reportPath = options.reportPath ?? join(outputDir, "report.md");
    const md = renderReport({
      html: htmlPath,
      viewport,
      lightScreenshot: lightPath,
      darkScreenshot: darkPath,
      themePixelDelta,
      unthemed,
      totalMatched,
      themeStrategy: detected,
    });
    await writeFile(reportPath, md);

    return {
      html: htmlPath,
      viewport,
      lightScreenshot: lightPath,
      darkScreenshot: darkPath,
      themePixelDelta,
      unthemed,
      totalMatched,
      themeStrategy: detected,
      reportPath,
    };
  });
}

/** Terminal summary, extracted from `runThemeParity` so `run` stops printing. */
export const THEME_INERT_DELTA = 0.02;

export function formatThemeParityReport(report: ThemeParityReport, rules?: RuleView): string {
  const lines: string[] = [];
  lines.push(`  ${BOLD}${CYAN}vlmkit check theme${RESET}`);
  lines.push(`  ${DIM}html: ${report.html}${RESET}`);
  // Two independent rules, and the pixel-delta line is the one worth keeping when
  // `theme-inert` is off: the DELTA is a measurement either way. Only its verdict character
  // changes, from a warning to a plain reading.
  const inertTier = ruleTier(rules, "theme-inert", "warn");
  const unthemedTier = ruleTier(rules, "unthemed-component", "warn");
  const pct = (report.themePixelDelta * 100).toFixed(1);
  const inert = report.themePixelDelta < THEME_INERT_DELTA;
  const strategy = report.themeStrategy;
  const inertIcon = !inert
    ? `${GREEN}\u2713${RESET}`
    : inertTier === "off"
      ? `${DIM}-${RESET}`
      : inertTier === "suspect" ? `${RED}\u2717${RESET}` : inertTier === "info" ? `${DIM}i${RESET}` : `${YELLOW}!${RESET}`;
  lines.push(
    `  ${inertIcon} theme pixel delta: ${pct}%`
    + ` (page ${inert ? "barely" : "broadly"} responds to ${strategy?.strategy === "media" || strategy === undefined
      ? "color scheme"
      : strategy.strategy === "none" ? "either dark-mode strategy" : `\`${strategy.darkSelector}\``})`
    + (inert && inertTier === "off" ? `${DIM} \u2014 theme-inert is off, reported as a reading only${RESET}` : ""),
  );
  // Next to the delta, not in a footnote: what a 0.0% means depends on which strategy was
  // exercised, and the gate spent a year flipping the media query at pages that theme by class.
  if (strategy) {
    lines.push(strategy.strategy === "none"
      ? `    ${DIM}strategy: none found in the readable CSS — no \`prefers-color-scheme\` rule,`
        + ` no root \`.dark\` / \`[data-theme=dark]\` selector`
        + (strategy.unreadableSheets > 0 ? `; ${strategy.unreadableSheets} cross-origin sheet(s) could not be read` : "")
        + `${RESET}`
      : `    ${DIM}strategy: ${strategy.strategy}`
        + (strategy.strategy === "media"
          ? ` (${strategy.mediaRules} \`prefers-color-scheme: dark\` rule(s))`
          : ` — the dark render applied \`${strategy.darkSelector}\` to the root element`
            + (strategy.mediaRules > 0 ? `, and the page also has ${strategy.mediaRules} media rule(s)` : ""))
        + (strategy.unreadableSheets > 0 ? `; ${strategy.unreadableSheets} cross-origin sheet(s) unreadable` : "")
        + `${RESET}`);
  }
  const unthemedOff = unthemedTier === "off";
  const unthemedIcon = unthemedOff
    ? `${DIM}-${RESET}`
    : report.unthemed.length === 0
      ? `${GREEN}\u2713${RESET}`
      : unthemedTier === "suspect" ? `${RED}\u2717${RESET}` : unthemedTier === "info" ? `${DIM}i${RESET}` : `${YELLOW}!${RESET}`;
  lines.push(
    `  ${unthemedIcon} unthemed components: ${report.unthemed.length} of ${report.totalMatched}`
    + (unthemedOff ? `${DIM} \u2014 measured and NOT reported, unthemed-component is off${RESET}` : ""),
  );
  for (const u of unthemedOff ? [] : report.unthemed.slice(0, 5)) {
    lines.push(
      `    ${DIM}#${u.rank} ${u.bbox.left},${u.bbox.top} ${u.bbox.width}\u00d7${u.bbox.height}`
      + ` fill ${u.lightFill.hex} (\u0394 ${u.fillDelta.toFixed(1)})${RESET}`,
    );
  }
  lines.push(`  ${DIM}report: ${report.reportPath}${RESET}`);
  return lines.join("\n");
}

function renderReport(r: Omit<ThemeParityReport, "reportPath">): string {
  const lines: string[] = [];
  lines.push("# Theme parity report");
  lines.push("");
  lines.push(`HTML: \`${r.html}\` at ${r.viewport.width}×${r.viewport.height}`);
  lines.push("");
  const pct = (r.themePixelDelta * 100).toFixed(2);
  const strat = r.themeStrategy;
  const flipped = strat === undefined || strat.strategy === "media" || strat.strategy === "none"
    ? "`prefers-color-scheme` from `light` to `dark`"
    : `\`${strat.darkSelector}\` on the root element (${strat.strategy} strategy)`;
  lines.push(`**Theme pixel delta**: ${pct}% — fraction of pixels that changed when switching ` +
    `${flipped}.`);
  lines.push("");
  if (strat) {
    lines.push(`**Dark-mode strategy detected**: \`${strat.strategy}\`` +
      (strat.strategy === "media" ? ` (${strat.mediaRules} \`prefers-color-scheme: dark\` rule(s) in the readable CSS)`
        : strat.strategy === "none" ? " — neither a `prefers-color-scheme` rule nor a root `.dark` / `[data-theme=dark]` selector is in the readable CSS"
        : ` — root \`${strat.darkSelector}\`, applied by this gate for the dark render` +
          (strat.mediaRules > 0 ? `; the page also carries ${strat.mediaRules} media rule(s)` : "")));
    if (strat.unreadableSheets > 0) {
      lines.push("");
      lines.push(`> ${strat.unreadableSheets} cross-origin stylesheet(s) could not be read, so the ` +
        "strategy count is a lower bound. If the page themes from one of those, pass " +
        "`--dark-selector` to name the class or attribute directly.");
    }
    lines.push("");
  }
  if (r.themePixelDelta < 0.02) {
    lines.push(strat && (strat.strategy === "class" || strat.strategy === "attribute")
      // Reaching this line under a class strategy means the class WAS applied and the pixels
      // still did not move, which is a real finding rather than the gate testing the wrong knob.
      ? "> The page barely responds to its own dark-mode " + strat.strategy +
        " (`" + strat.darkSelector + "` was applied to the root and the render hardly changed). " +
        "Either the dark rules are not reaching these elements, or the values behind them are " +
        "the same in both themes."
      : "> The page barely responds to the color-scheme toggle. Either dark-mode " +
      "styles are missing entirely, or the page doesn't use the standard " +
      "`@media (prefers-color-scheme: dark)` query.");
    lines.push("");
  }
  lines.push("- Light: `" + r.lightScreenshot + "`");
  lines.push("- Dark:  `" + r.darkScreenshot + "`");
  lines.push("");
  lines.push("## Unthemed components");
  lines.push("");
  lines.push("Components whose dominant fill is **identical** in light and dark mode " +
    "(distance < 16 RGB units). These elements have hard-coded colors that " +
    "don't reference a theme variable — a classic dark-mode regression.");
  lines.push("");
  if (r.unthemed.length === 0) {
    lines.push("_None — every detected component changed fill between themes._");
  } else {
    lines.push(`Found **${r.unthemed.length}** of ${r.totalMatched} matched components.`);
    lines.push("");
    lines.push("| Rank | Bbox | Light fill | Dark fill | Δ |");
    lines.push("|---|---|---|---|---|");
    for (const u of r.unthemed.slice(0, 10)) {
      const bb = `${u.bbox.left},${u.bbox.top} ${u.bbox.width}×${u.bbox.height}`;
      lines.push(`| #${u.rank} | ${bb} | \`${u.lightFill.hex}\` | \`${u.darkFill.hex}\` | ${u.fillDelta.toFixed(1)} |`);
    }
  }
  lines.push("");
  lines.push("## Suggested next step");
  lines.push("");
  if (r.themePixelDelta < 0.02) {
    lines.push("1. Add `@media (prefers-color-scheme: dark) { ... }` styles or a " +
      "`:root { --bg: ...; }` / `[data-theme='dark']` toggle. Currently no theme " +
      "switching is wired up.");
  } else if (r.unthemed.length > 0) {
    lines.push("1. Open `light.png` and `dark.png` side-by-side. Locate the elements at " +
      "the bboxes listed above — they keep the same fill color across themes.");
    lines.push("2. Replace the hard-coded color values in the CSS for those elements with " +
      "either a `var(--token)` reference, or matching dark-mode overrides via " +
      "`@media (prefers-color-scheme: dark)`.");
    lines.push("3. Re-run `vlmkit check theme`. Unthemed count should drop to 0.");
  } else {
    lines.push("Every detected component changed fill between themes. Page is theme-clean.");
  }
  lines.push("");
  return lines.join("\n");
}

/**
 * CLI entry removed: this module is measurement code now, not a command.
 * `check theme` is declared in `../gates/theme.gate.ts` and driven by the core runner
 * (`@mizchi/vlmkit-core/plugin/runner.ts`), which owns argument parsing,
 * `--json`, `--advisory`, the run ledger and the exit code.
 */
