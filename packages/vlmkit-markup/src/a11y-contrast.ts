#!/usr/bin/env node
/**
 * Accessibility / WCAG contrast check.
 *
 * Use case: agent writes new HTML/CSS, doesn't notice that the muted
 * `color: #9ca3af` on `background: #ffffff` only hits 2.9:1 contrast
 * — below WCAG AA's 4.5:1 for body text. Tool scans every visible
 * text-bearing element, computes its actual text-vs-background
 * contrast ratio via WCAG formula, and reports failures.
 *
 * Implementation:
 *   1. Playwright renders the HTML.
 *   2. In-browser script walks visible text nodes, reads
 *      `getComputedStyle(el).color` for foreground and walks up the
 *      ancestor chain for the first non-transparent background.
 *      Returns text + colors + font size + bbox.
 *   3. Compute WCAG luminance + contrast ratio. Flag elements below
 *      4.5:1 (or 3.0:1 for "large text" ≥ 18px or ≥ 14px-bold).
 *
 * Unlike axe-core / pa11y which require a DOM-aware semantic scan,
 * this is purely visual — works on any page that renders text.
 *
 * Usage:
 *   vlmkit check a11y contrast <html>
 */
import { writeFile, mkdir } from "node:fs/promises";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { type PageLoadOptions, pickPageLoad } from "@mizchi/vlmkit-core/page-load.ts";
import { openSource, resolveSource } from "@mizchi/vlmkit-core/page-open.ts";
import { DIM, RESET, GREEN, RED, YELLOW, BOLD, CYAN } from "@mizchi/vlmkit-core/terminal-colors.ts";
import { handleCliError } from "@mizchi/vlmkit-core/cli-error.ts";
import { evaluateA11yContrast } from "./markup-core-a11y-contrast.ts";
import { withBrowser } from "@mizchi/vlmkit-core/browser-launch.ts";
import { applySelectorAllowRules, parseSelectorAllowRules } from "./inspect/selector-exemption.ts";
import { CONTRAST_BACKGROUND_JS } from "./contrast-background.ts";
import type { RuleView } from "@mizchi/vlmkit-core/plugin/contract.ts";
import { ruleTier } from "@mizchi/vlmkit-core/plugin/rule-tier.ts";

export interface A11yContrastOptions extends PageLoadOptions {
  /**
   * Suppress the human-readable console block. Set by `--json`: the console
   * output caps its list at five rows, so mixing it into stdout ahead of the
   * JSON left `--json` unparseable — while the truncation notice pointed the
   * reader at exactly that stream. Shipped broken in 0.9.0-dev; caught by
   * running the built CLI rather than the run function.
   */
  quiet?: boolean;
  /**
   * `--allow "<selector>;<reason>"` — text whose contrast is signed off.
   *
   * v7's agent-l: "same data as integrity but fail-level, one rule, no `--allow`:
   * red CI or contrast off, nothing between." `check integrity` reports the same
   * colours as a warn with a per-selector exemption; this gate reports them as a
   * fail with no exemption at all, so a single approved brand grey forced the whole
   * rule off.
   */
  allow?: readonly string[];
  htmlPath: string;
  outputDir: string;
  reportPath?: string;
  viewport?: { width: number; height: number };
  /** Min text length to bother analyzing. Default 1. */
  minTextLength?: number;
}

export type WcagLevel = "AAA" | "AA" | "AA-large" | "fail";

export interface ContrastFinding {
  path: string;
  tag: string;
  text: string;
  fontSize: number;
  fontWeight: number;
  bbox: { x: number; y: number; width: number; height: number };
  foreground: { r: number; g: number; b: number; hex: string };
  background: { r: number; g: number; b: number; hex: string };
  /** Computed WCAG contrast ratio (1 = identical, 21 = max black/white). */
  ratio: number;
  /** Required threshold based on font size/weight. 4.5 for normal text, 3.0 for large. */
  requiredAA: number;
  level: WcagLevel;
  /**
   * How many elements share this exact case (same selector, colours and type size).
   *
   * Reported because the dedup is by case, not by element: Bootstrap's sidebar has ELEVEN links at
   * `#0d6efd` on `#f8f9fa`, and "1 contrast failure" reads as one link to fix. `check integrity`'s
   * own contrast rule says "11 element(s)" for the same defect, and the two gates should not
   * describe one page differently.
   */
  elements: number;
}

export interface A11yContrastReport {
  html: string;
  viewport: { width: number; height: number };
  screenshot: string;
  totalText: number;
  failures: ContrastFinding[];
  /**
   * Text whose background could not be resolved from computed style — a `background-image` or
   * gradient in the stack, so what is behind it is a pixel question.
   *
   * On the report because it is coverage, not a detail: "0 failures over 59 elements" and "0
   * failures over 59, of which 26 were unmeasurable" are different claims, and only the second
   * one is honest. `check integrity` has always stated this; this gate used to guess white and
   * report the inverse of the truth.
   */
  unmeasuredComposite?: number;
  /** Findings an `--allow` rule declared deliberate. Listed, never merely subtracted. */
  exempted?: { finding: ContrastFinding; reason: string; rule: string }[];
  /** `--allow` rules that matched nothing. */
  unusedAllow?: string[];
  reportPath: string;
}

export const A11Y_CONTRAST_SAMPLE_SCRIPT = `
(function a11ySample(minLen) {
${CONTRAST_BACKGROUND_JS}
  function shortPath(el) {
    const parts = [];
    let cur = el;
    while (cur && cur !== document.body && parts.length < 5) {
      let p = cur.tagName.toLowerCase();
      if (cur.id) p += "#" + cur.id;
      else if (cur.className && typeof cur.className === "string") {
        const cls = cur.className.trim().split(/\\s+/).slice(0, 2).join(".");
        if (cls) p += "." + cls;
      }
      parts.unshift(p);
      cur = cur.parentElement;
    }
    return parts.join(">");
  }
  const out = [];
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  let node;
  while ((node = walker.nextNode())) {
    const text = (node.nodeValue || "").trim();
    if (text.length < minLen) continue;
    const el = node.parentElement;
    if (!el) continue;
    if (el.tagName === "SCRIPT" || el.tagName === "STYLE" || el.tagName === "NOSCRIPT") continue;
    const cs = getComputedStyle(el);
    if (cs.visibility === "hidden" || cs.display === "none" || parseFloat(cs.opacity) < 0.5) continue;
    const r = el.getBoundingClientRect();
    if (r.width < 1 || r.height < 1) continue;
    const fgColor = parseColor(cs.color);
    if (!fgColor) continue;
    const resolved = resolveTextBackground(el);
    const fontSize = parseFloat(cs.fontSize) || 16;
    const fontWeight = parseInt(cs.fontWeight, 10) || 400;
    // A composite background is REPORTED, not guessed at. The old sampler had no notion of a
    // background image and returned white, which turned near-white text on a dark gradient into
    // a 1.08:1 "failure" — the inverse of the truth. The analyzer surfaces these as a stated
    // exemption, because silently dropping the elements a check cannot read is
    // indistinguishable from finding them acceptable.
    if (resolved.composite) {
      out.push({
        path: shortPath(el),
        tag: el.tagName.toLowerCase(),
        text: text.slice(0, 60),
        fontSize, fontWeight,
        bbox: { x: r.x, y: r.y, width: r.width, height: r.height },
        foreground: { r: fgColor[0]|0, g: fgColor[1]|0, b: fgColor[2]|0 },
        background: { r: 255, g: 255, b: 255 },
        composite: true,
      });
      if (out.length > 500) break;
      continue;
    }
    // The text's own alpha and every ancestor opacity, composited onto the resolved
    // background, so a translucent colour and a faded ancestor read as the colour a person
    // actually sees rather than as the colour the author typed.
    // (No backticks in here: this comment lives inside a template literal, and a backtick
    // would end the script. Third time this session — see theme.gate.ts and integrity-check.ts.)
    const fg = blendColor(resolved.bg, [fgColor[0], fgColor[1], fgColor[2], fgColor[3] * inheritedOpacity(el)]);
    out.push({
      path: shortPath(el),
      tag: el.tagName.toLowerCase(),
      text: text.slice(0, 60),
      fontSize, fontWeight,
      bbox: { x: r.x, y: r.y, width: r.width, height: r.height },
      foreground: { r: Math.round(fg[0]), g: Math.round(fg[1]), b: Math.round(fg[2]) },
      background: { r: Math.round(resolved.bg[0]), g: Math.round(resolved.bg[1]), b: Math.round(resolved.bg[2]) },
    });
    if (out.length > 500) break;
  }
  return out;
})
`;

export interface A11yContrastRawSample {
  path: string;
  tag: string;
  text: string;
  fontSize: number;
  fontWeight: number;
  bbox: { x: number; y: number; width: number; height: number };
  foreground: { r: number; g: number; b: number };
  background: { r: number; g: number; b: number };
  /**
   * The background could not be resolved from computed style — a `background-image` or gradient
   * is in the stack, so what is behind the text is a pixel question. Optional: a sample without
   * it was measured normally, which keeps recorded runs and hand-built samples working.
   */
  composite?: boolean;
}

function toHex(c: { r: number; g: number; b: number }): string {
  const h = (n: number) => n.toString(16).padStart(2, "0");
  return `#${h(c.r)}${h(c.g)}${h(c.b)}`;
}

/**
 * Build the list of contrast failures from raw samples (post-process
 * step extracted from `runA11yContrast`). Pure — no I/O — so it can
 * be invoked over Playwright pages owned by other modules (e.g. the
 * `vlmkit diff-pr` CI gate calls this without spinning up a second
 * browser instance per route).
 */
export function analyzeA11yContrastSamples(samples: A11yContrastRawSample[]): ContrastFinding[] {
  /**
   * Deduped by the path AND the values the verdict is computed from, not by the path alone.
   *
   * `shortPath` keeps a tag plus its first two classes per ancestor, so Bootstrap's sidebar links
   * all serialize to `…>li.nav-item>a.nav-link.d-flex` — including the `.active` one, which is
   * white on blue and passes. Keying on the path kept whichever came first and dropped the rest,
   * and on the Bootstrap dashboard example that meant this gate reported **0 contrast failures on a
   * page with 11**: `#0d6efd` on `#f8f9fa` at 4.27:1, which `check integrity`'s own contrast rule
   * reported correctly at the same moment. Two gates in one toolkit disagreeing about WCAG on one
   * page, and the one whose whole subject is contrast was the wrong one.
   *
   * The key is the finding's identity: same selector, same colours, same type size is the same
   * case and worth collapsing; same selector with different colours is two cases.
   */
  const byPath = new Map<string, A11yContrastRawSample>();
  const identity = (s: A11yContrastRawSample) =>
    `${s.path}|${toHex(s.foreground)}|${toHex(s.background)}|${s.fontSize}|${s.fontWeight}`;
  for (const s of samples) {
    const key = identity(s);
    if (!byPath.has(key)) byPath.set(key, s);
  }
  const findings: ContrastFinding[] = [];
  const counts = new Map<string, number>();
  for (const s of samples) counts.set(identity(s), (counts.get(identity(s)) ?? 0) + 1);
  for (const [key, s] of byPath) {
    // A background the style walk could not resolve is not measured, and not silently dropped
    // either — `unmeasuredComposite` carries the count so the caller can state it. Measuring it
    // anyway is what produced 9 failures at 1.08:1 for near-white text on a dark gradient.
    if (s.composite) continue;
    const evaluation = evaluateA11yContrast({
      foreground: s.foreground,
      background: s.background,
      fontSize: s.fontSize,
      fontWeight: s.fontWeight,
    });
    if (evaluation.level !== "fail") continue;
    findings.push({
      path: s.path,
      tag: s.tag,
      text: s.text,
      fontSize: s.fontSize,
      fontWeight: s.fontWeight,
      bbox: s.bbox,
      foreground: { ...s.foreground, hex: toHex(s.foreground) },
      background: { ...s.background, hex: toHex(s.background) },
      ratio: evaluation.ratio,
      requiredAA: evaluation.requiredAA,
      level: evaluation.level,
      elements: counts.get(key) ?? 1,
    });
  }
  findings.sort((a, b) => a.ratio - b.ratio);
  return findings;
}

export async function runA11yContrast(
  options: A11yContrastOptions,
): Promise<A11yContrastReport> {
  const outputDir = resolve(options.outputDir);
  await mkdir(outputDir, { recursive: true });
  // A URL is a valid source now that loading goes through `openSource`;
  // `resolve()` would have turned it into `<cwd>/http:/host/page.html`.
  const htmlPath = resolveSource(options.htmlPath);
  const viewport = options.viewport ?? { width: 1280, height: 900 };
  const minLen = options.minTextLength ?? 1;

  // Returned out of the callback rather than assigned into outer `let`s:
  // TypeScript's definite-assignment analysis does not follow an assignment made
  // inside a closure, so `let samples: T[]` + assign-in-callback reads as
  // "used before being assigned" at every later use.
  const { samples, screenshotPath } = await withBrowser(async (browser) => {
    // Navigate rather than `setContent(readFile(...))`: the latter leaves the
    // document on `about:blank`, so a relative `<link rel="stylesheet">` never
    // loads and the gate measures unstyled markup. Measured on
    // fixtures/external-assets: it reported 0 contrast failures where the same
    // CSS inlined reported 1.
    const { page } = await openSource(browser, htmlPath, { viewport, settleMs: 0, ...pickPageLoad(options) });
    await page.addStyleTag({
      content: `*, *::before, *::after { transition: none !important; animation: none !important; }`,
    });
    const samples = await page.evaluate(`(${A11Y_CONTRAST_SAMPLE_SCRIPT})(${minLen})`) as A11yContrastRawSample[];
    const screenshotPath = join(outputDir, "page.png");
    await page.screenshot({ path: screenshotPath, fullPage: false });
    await page.close();
    return { samples, screenshotPath };
  });

  // `analyzeA11yContrastSamples`, not a second copy of it.
  //
  // This function used to re-implement the dedup and the finding construction inline, and the two
  // copies drifted in the way that pattern always does: the exported one is what
  // `vlmkit diff-pr` calls, this one is what `check a11y contrast` calls, and a fix to either left
  // the other reporting something else about the same page. Found on the Bootstrap dashboard
  // example (2026-08-16), where this gate reported **0 contrast failures on a page with 11**.
  const findings = analyzeA11yContrastSamples(samples);
  const compositeCount = samples.filter((s) => s.composite).length;

  const reportPath = options.reportPath ?? join(outputDir, "report.md");
  const md = renderReport({
    html: htmlPath,
    viewport,
    screenshot: screenshotPath,
    // The samples, not the deduped cases. The label reads "inspected N text-bearing element(s)",
    // and `byPath.size` made that 10 on a page with 105 — a coverage claim off by 10x, in the
    // reassuring direction.
    totalText: samples.length,
    failures: findings,
    ...(compositeCount > 0 ? { unmeasuredComposite: compositeCount } : {}),
  });
  await writeFile(reportPath, md);



  const allowRules = parseSelectorAllowRules(options.allow ?? [], { ruleId: "contrast-below-aa" });
  const applied = applySelectorAllowRules(findings, allowRules, (f) => f.path);
  return {
    html: htmlPath,
    viewport,
    screenshot: screenshotPath,
    totalText: samples.length,
    failures: applied.kept,
    ...(compositeCount > 0 ? { unmeasuredComposite: compositeCount } : {}),
    ...(applied.exempted.length > 0
      ? {
        exempted: applied.exempted.map((e) => ({
          finding: e.finding,
          reason: e.rule.reason,
          rule: e.rule.raw.split(";")[0] ?? e.rule.raw,
        })),
      }
      : {}),
    ...(applied.unused.length > 0 ? { unusedAllow: applied.unused.map((r) => r.raw) } : {}),
    reportPath,
  };
}

/**
 * Terminal summary, extracted from the `!options.quiet` block inside the
 * measurement function. A gate's `run` must not print: the core runner owns
 * output, and `--json` is its decision to make, not the measurement's.
 */
export function formatA11yContrastReport(report: A11yContrastReport, rules?: RuleView): string {
  const lines: string[] = [];
  lines.push(`  ${BOLD}${CYAN}vlmkit check a11y contrast${RESET}`);
  lines.push(`  ${DIM}html: ${report.html}${RESET}`);
  lines.push(
    `  ${DIM}inspected ${report.totalText} text-bearing element(s)`
    // Stated on the coverage line, not buried: "0 failures over 59" and "0 failures over 59, 26
    // of them unmeasurable" are different claims and only the second is honest.
    + (report.unmeasuredComposite
      ? `, ${report.unmeasuredComposite} not measurable (background-image/gradient behind the text)`
      : "")
    + `${RESET}`,
  );
  // `--rule contrast-below-aa=off` used to change the exit code and nothing on this screen.
  // The measured count survives the rule being off, because the ratios were still measured;
  // what changes is that they are not reported as failures.
  const tier = ruleTier(rules, "contrast-below-aa", "suspect");
  const off = tier === "off";
  const icon = off
    ? `${DIM}-${RESET}`
    : report.failures.length === 0
      ? `${GREEN}✓${RESET}`
      : tier === "suspect" ? `${RED}✗${RESET}` : tier === "warn" ? `${YELLOW}!${RESET}` : `${DIM}i${RESET}`;
  lines.push(
    `  ${icon} ${report.failures.length} contrast failure(s)`
    + (off
      ? `${DIM} measured and NOT reported — contrast-below-aa is off${RESET}`
      : tier === "suspect" ? "" : `${DIM} [contrast-below-aa re-tuned to ${tier}]${RESET}`)
    + `${report.exempted?.length ? `${DIM}, ${report.exempted.length} exempted${RESET}` : ""}`,
  );
  const CONSOLE_ROWS = 5;
  for (const f of off ? [] : report.failures.slice(0, CONSOLE_ROWS)) {
    const shared = f.elements > 1 ? ` ${f.elements} element(s)` : "";
    lines.push(`    ${DIM}${f.path} — ${f.ratio.toFixed(2)}:1 (need ${f.requiredAA}) — \`${f.foreground.hex}\` on \`${f.background.hex}\` — "${f.text}"${shared}${RESET}`);
  }
  // Disclose the cut: a headline count above a five-row list reads as "here they
  // are", and a reader has no way to know seven more exist. Same wording as
  // `check breakpoints` and `check integrity`.
  if (!off && report.failures.length > CONSOLE_ROWS) {
    lines.push(`    ${DIM}… ${report.failures.length - CONSOLE_ROWS} more (see the report, or --json for all)${RESET}`);
  }
  // Listed, never merely subtracted.
  for (const e of report.exempted ?? []) {
    lines.push(
      `    ${DIM}- ${e.finding.path} — ${e.finding.ratio.toFixed(2)}:1:`
      + ` user exemption (${e.rule}): ${e.reason}${RESET}`,
    );
  }
  if (report.unusedAllow?.length) {
    lines.push(
      `  ${YELLOW}${report.unusedAllow.length} --allow rule(s) matched nothing:`
      + ` ${report.unusedAllow.join(", ")}${RESET}`,
    );
    lines.push(`    ${DIM}Delete them: an exemption kept past what it covered only widens the blind spot.${RESET}`);
  }
  lines.push(`  ${DIM}report: ${report.reportPath}${RESET}`);
  return lines.join("\n");
}

function renderReport(r: Omit<A11yContrastReport, "reportPath">): string {
  const lines: string[] = [];
  lines.push("# A11y contrast report");
  lines.push("");
  lines.push(`HTML: \`${r.html}\``);
  lines.push("");
  lines.push(`Inspected **${r.totalText}** unique text-bearing elements. ` +
    `Screenshot: \`${r.screenshot}\`.`);
  if (r.unmeasuredComposite) {
    lines.push("");
    lines.push(
      `**${r.unmeasuredComposite}** of them were NOT measured: a \`background-image\` or gradient`
      + " sits behind the text, so the colour underneath varies across the element and is not"
      + " derivable from computed style. Guessing white there is how near-white text on a dark"
      + " gradient gets reported as a 1.08:1 failure. Sampling the rendered pixels would answer"
      + " it; a style walk cannot.",
    );
  }
  lines.push("");
  if (r.failures.length === 0) {
    lines.push("## All text passes WCAG AA contrast");
    lines.push("");
    lines.push("Every visible text element has a contrast ratio ≥ 4.5:1 (or ≥ 3:1 for " +
      "large text, defined as ≥ 18px regular or ≥ 14px bold).");
  } else {
    lines.push(`## ${r.failures.length} contrast failure(s)`);
    lines.push("");
    lines.push("WCAG 2.1 AA requires ≥ 4.5:1 contrast for normal text and ≥ 3:1 for " +
      "large text (≥ 18px regular, or ≥ 14px bold). Ratios below these thresholds " +
      "make text hard to read for users with low vision.");
    lines.push("");
    lines.push("| Element | Text (truncated) | Foreground | Background | Ratio | Need |");
    lines.push("|---|---|---|---|---|---|");
    for (const f of r.failures.slice(0, 20)) {
      const fgSwatch = `\`${f.foreground.hex}\``;
      const bgSwatch = `\`${f.background.hex}\``;
      lines.push(`| \`${f.path}\` (${f.fontSize.toFixed(0)}px${f.fontWeight >= 600 ? " b" : ""}) | \`${f.text}\` | ${fgSwatch} | ${bgSwatch} | **${f.ratio}:1** | ${f.requiredAA}:1 |`);
    }
    if (r.failures.length > 20) lines.push(`\n_… ${r.failures.length - 20} more row(s) omitted; the JSON report has all of them._`);
    if (r.failures.length > 20) {
      lines.push(`| _…${r.failures.length - 20} more_ | | | | | |`);
    }
  }
  lines.push("");
  lines.push("## Suggested next step");
  lines.push("");
  if (r.failures.length === 0) {
    lines.push("Page is WCAG AA contrast-clean. Consider running with `--strict` to also " +
      "check AAA (7:1 normal, 4.5:1 large) when supporting low-vision users.");
  } else {
    lines.push("For each failing row:");
    lines.push("1. Increase contrast by darkening the foreground or lightening the background " +
      "until the ratio crosses 4.5:1 (or 3:1 for large text).");
    lines.push("2. Use a contrast-ratio calculator to find specific hex values — every step " +
      "toward black/white on a light/dark bg adds ratio.");
    lines.push("3. Common fix: muted-gray-on-white text (e.g. `#9ca3af` on `#ffffff` = 2.85:1) " +
      "→ try `#6b7280` (4.69:1) or darker.");
    lines.push("4. Re-run `vlmkit check a11y contrast`. Failures should clear.");
  }
  lines.push("");
  return lines.join("\n");
}

/**
 * CLI entry removed: this module is measurement code now, not a command.
 * `check a11y contrast` is declared in `./gates/a11y.gate.ts` and driven by the core runner
 * (`@mizchi/vlmkit-core/plugin/runner.ts`), which owns argument parsing,
 * `--json`, `--advisory`, the run ledger and the exit code.
 */
