#!/usr/bin/env node
/**
 * A11y touch-target check.
 *
 * WCAG 2.1 AAA (criterion 2.5.5) requires interactive elements to have
 * a target size of at least 44 × 44 CSS px. WCAG 2.2 AA (criterion
 * 2.5.8) relaxes this to 24 × 24 with sufficient spacing. Small
 * touch targets are unreachable for users with motor impairments
 * and frustrating on touchscreens.
 *
 * Scans visible interactive elements (button, link, input, select,
 * textarea, [role=button], [role=link], elements with tabindex ≥ 0)
 * and reports those whose bounding box falls below the chosen
 * threshold.
 *
 * Usage:
 *   vlmkit check a11y touch <html-or-url>
 *   vlmkit check a11y touch <url> --level AAA   # 44x44 (default)
 *   vlmkit check a11y touch <url> --level AA    # 24x24
 */
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { basename, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { type Page } from "playwright";
import { handleCliError } from "@mizchi/vlmkit-core/cli-error.ts";
import { DIM, RESET, GREEN, RED, BOLD, CYAN, YELLOW } from "@mizchi/vlmkit-core/terminal-colors.ts";
import { type PageLoadOptions, pickPageLoad } from "@mizchi/vlmkit-core/page-load.ts";
import { openSource } from "@mizchi/vlmkit-core/page-open.ts";
import {
  requiredTouchSide,
  touchTargetBelowRequired,
  touchTargetInCluster,
} from "./markup-core-a11y-touch.ts";
import { withBrowser } from "@mizchi/vlmkit-core/browser-launch.ts";
import { applySelectorAllowRules, parseSelectorAllowRules } from "./inspect/selector-exemption.ts";
import type { RuleView } from "@mizchi/vlmkit-core/plugin/contract.ts";
import { ruleTier } from "@mizchi/vlmkit-core/plugin/rule-tier.ts";

export type WcagTouchLevel = "AAA" | "AA";

export interface TouchCheckOptions extends PageLoadOptions {
  /**
   * Suppress the human-readable console block. Set by `--json`: the console
   * output caps its list at five rows, so mixing it into stdout ahead of the
   * JSON left `--json` unparseable — while the truncation notice pointed the
   * reader at exactly that stream. Shipped broken in 0.9.0-dev; caught by
   * running the built CLI rather than the run function.
   */
  quiet?: boolean;
  /** HTML file path or http(s) URL. */
  source: string;
  outputDir: string;
  reportPath?: string;
  viewport?: { width: number; height: number };
  /** Required size threshold. AAA → 44px, AA → 24px. Default AAA. */
  level?: WcagTouchLevel;
  /**
   * `--allow "<selector>;<reason>"` — a target whose size is deliberate.
   *
   * v7's agent-m and agent-l both hit the absence: "`check a11y touch` has no
   * `--exclude` and no selector `--allow` while `check design` and `check
   * integrity` both do. Vendor DOM is a page-level fact, not a per-gate one. The
   * only exit is turning the one rule off page-wide, which also stops checking our
   * own buttons."
   */
  allow?: readonly string[];
}

export interface TouchTargetFinding {
  path: string;
  tag: string;
  text: string;
  bbox: { x: number; y: number; width: number; height: number };
  /** Minimum of width and height — the limiting dimension. */
  minSide: number;
  required: number;
  /** Same selectors with overlapping or near-adjacent bboxes within 24 px. */
  cluster: boolean;
}

export interface TouchReport {
  source: string;
  level: WcagTouchLevel;
  /**
   * Required minimum side in px for `level`. On the report so the formatter
   * stays pure: deriving it needs `requiredTouchSide`, which runs the MoonBit
   * policy — real work, and a formatter that does real work can fail.
   */
  required: number;
  viewport: { width: number; height: number };
  screenshot: string;
  inspectedCount: number;
  failures: TouchTargetFinding[];
  /**
   * Targets an `--allow` rule declared deliberate. Listed, not dropped — an
   * exemption a reader cannot see is a blind spot rather than a decision.
   */
  exempted?: { finding: TouchTargetFinding; reason: string; rule: string }[];
  /** `--allow` rules that matched nothing. */
  unusedAllow?: string[];
  reportPath: string;
}

export const A11Y_TOUCH_SAMPLE_SCRIPT = `
(function a11yTouch() {
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
  const selectors = [
    "button",
    "a[href]",
    "input:not([type='hidden'])",
    "select",
    "textarea",
    "summary",
    "[role='button']",
    "[role='link']",
    "[tabindex]:not([tabindex='-1'])",
  ].join(",");
  const out = [];
  const seen = new Set();
  for (const el of document.querySelectorAll(selectors)) {
    if (seen.has(el)) continue;
    seen.add(el);
    const cs = getComputedStyle(el);
    if (cs.visibility === "hidden" || cs.display === "none" || parseFloat(cs.opacity) < 0.5) continue;
    if (el.hasAttribute("disabled") || el.getAttribute("aria-hidden") === "true") continue;
    const r = el.getBoundingClientRect();
    if (r.width === 0 || r.height === 0) continue;
    const text = (el.textContent || el.getAttribute("aria-label") || el.getAttribute("title") || "").trim().slice(0, 60);
    out.push({
      path: shortPath(el),
      tag: el.tagName.toLowerCase(),
      text,
      bbox: { x: r.x, y: r.y, width: r.width, height: r.height },
    });
    if (out.length > 400) break;
  }
  return out;
})()
`;

export interface A11yTouchRawSample {
  path: string;
  tag: string;
  text: string;
  bbox: { x: number; y: number; width: number; height: number };
}

/**
 * Build the list of touch-target failures from raw samples. Pure
 * post-process so the `vlmkit diff-pr` CI gate can reuse it on its
 * own Playwright page without spinning up a new browser.
 */
/**
 * Identity for one rendered target.
 *
 * NOT the generated CSS path alone. That path is not unique among identical
 * siblings — three `<button>`s in one `<div class="z">` all render as
 * `main>div.z>button` — so keying on it collapsed a whole toolbar into one
 * element. Found in v7 while checking an agent's report about `--level AA`:
 * same pixels, same geometry, and the verdict moved with the markup.
 *
 *   distinct classes -> inspected 3 | failures 3 | clustered 3
 *   identical markup -> inspected 1 | failures 1 | clustered 0
 *
 * Two things went wrong at once. Coverage was understated, and cluster
 * detection — which compares each target against the OTHERS — had nothing left
 * to compare against, so the single most common clustered case (a row of
 * identical icon buttons) could never report a cluster.
 *
 * Position closes it: two elements at the same path in different places on the
 * page are different elements, and one element sampled twice is at the same
 * place both times, which is what the dedupe was for.
 */
function targetKey(sample: A11yTouchRawSample): string {
  return `${sample.path}@${Math.round(sample.bbox.x)},${Math.round(sample.bbox.y)}`;
}

export function analyzeA11yTouchSamples(
  samples: A11yTouchRawSample[],
  level: WcagTouchLevel = "AAA",
): TouchTargetFinding[] {
  const required = requiredTouchSide(level);
  const byPath = new Map<string, A11yTouchRawSample>();
  for (const s of samples) {
    const key = targetKey(s);
    if (!byPath.has(key)) byPath.set(key, s);
  }
  const findings: TouchTargetFinding[] = [];
  const elements = [...byPath.values()];
  const centers = elements.map((e) => ({
    x: e.bbox.x + e.bbox.width / 2,
    y: e.bbox.y + e.bbox.height / 2,
  }));
  for (let i = 0; i < elements.length; i++) {
    const e = elements[i]!;
    const minSide = Math.min(e.bbox.width, e.bbox.height);
    if (!touchTargetBelowRequired(minSide, level)) continue;
    let cluster = false;
    for (let j = 0; j < elements.length; j++) {
      if (i === j) continue;
      if (touchTargetInCluster(centers[i]!, centers[j]!)) {
        cluster = true;
        break;
      }
    }
    findings.push({
      path: e.path,
      tag: e.tag,
      text: e.text,
      bbox: e.bbox,
      minSide: Math.round(minSide),
      required,
      cluster,
    });
  }
  findings.sort((a, b) => a.minSide - b.minSide);
  return findings;
}

export async function runA11yTouch(options: TouchCheckOptions): Promise<TouchReport> {
  const outputDir = resolve(options.outputDir);
  await mkdir(outputDir, { recursive: true });
  const viewport = options.viewport ?? { width: 1280, height: 900 };
  const level = options.level ?? "AAA";
  const required = level === "AAA" ? 44 : 24;

  // Returned out of the callback, not assigned into outer `let`s — TypeScript's
  // definite-assignment analysis does not follow an assignment made in a closure.
  const { samples, screenshotPath } = await withBrowser(async (browser) => {
    // One load path for files and URLs. The file branch used to
    // `setContent(readFile(...))`, which drops the document's base URL: on
    // fixtures/external-assets that hid the 20x20 tap target entirely (the
    // element gets its size from CSS) while reporting three styled-and-compliant
    // buttons as failures at their unstyled sizes.
    const { page } = await openSource(browser, options.source, { viewport, settleMs: 0, ...pickPageLoad(options) });
    await page.addStyleTag({
      content: `*, *::before, *::after { transition: none !important; animation: none !important; }`,
    });
    const samples = await page.evaluate(A11Y_TOUCH_SAMPLE_SCRIPT) as A11yTouchRawSample[];
    const screenshotPath = join(outputDir, "page.png");
    await page.screenshot({ path: screenshotPath, fullPage: false });
    await page.close();
    return { samples, screenshotPath };
  });

  // Dedupe by path AND position — see `targetKey`.
  const byPath = new Map<string, A11yTouchRawSample>();
  for (const s of samples) {
    const key = targetKey(s);
    if (!byPath.has(key)) byPath.set(key, s);
  }

  // Cluster detection, on targets ALREADY below the floor. WCAG 2.5.8's
  // "with spacing" leniency — which can excuse an undersized target that is far
  // enough from its neighbours — is deliberately not applied here, so a target
  // under the floor is reported either way and `cluster` says which side of that
  // line it is on. It annotates; it never triggers. The gate's `usage` says so
  // now: v7's agent-m read the old wording as "adjacency is flagged" and could
  // not reconcile it with a 24x24 button passing at AA.
  const findings: TouchTargetFinding[] = [];
  const elements = [...byPath.values()];
  for (let i = 0; i < elements.length; i++) {
    const e = elements[i]!;
    const minSide = Math.min(e.bbox.width, e.bbox.height);
    if (minSide >= required) continue;
    let cluster = false;
    for (let j = 0; j < elements.length; j++) {
      if (i === j) continue;
      const o = elements[j]!;
      const cx1 = e.bbox.x + e.bbox.width / 2, cy1 = e.bbox.y + e.bbox.height / 2;
      const cx2 = o.bbox.x + o.bbox.width / 2, cy2 = o.bbox.y + o.bbox.height / 2;
      const dx = cx2 - cx1, dy = cy2 - cy1;
      if (Math.sqrt(dx * dx + dy * dy) < 24) { cluster = true; break; }
    }
    findings.push({
      path: e.path,
      tag: e.tag,
      text: e.text,
      bbox: e.bbox,
      minSide: Math.round(minSide),
      required,
      cluster,
    });
  }
  findings.sort((a, b) => a.minSide - b.minSide);

  const reportPath = options.reportPath ?? join(outputDir, "report.md");
  // Exemptions last, so a rule matching nothing is reported against the findings
  // this run actually produced rather than against the raw samples.
  const allowRules = parseSelectorAllowRules(options.allow ?? [], { ruleId: "target-undersized" });
  const applied = applySelectorAllowRules(findings, allowRules, (f) => f.path);
  const kept = applied.kept;
  const exempted = applied.exempted.map((e) => ({
    finding: e.finding,
    reason: e.rule.reason,
    rule: e.rule.raw.split(";")[0] ?? e.rule.raw,
  }));

  const md = renderReport({
    source: options.source,
    level,
    required,
    viewport,
    screenshot: screenshotPath,
    inspectedCount: byPath.size,
    failures: kept,
  });
  await writeFile(reportPath, md);



  return {
    source: options.source, level, required, viewport, screenshot: screenshotPath,
    inspectedCount: byPath.size, failures: kept, reportPath,
    ...(exempted.length > 0 ? { exempted } : {}),
    ...(applied.unused.length > 0 ? { unusedAllow: applied.unused.map((r) => r.raw) } : {}),
  };
}

/**
 * Terminal summary, extracted from the `!options.quiet` block inside the
 * measurement function. A gate's `run` must not print: the core runner owns
 * output, and `--json` is its decision to make, not the measurement's.
 *
 * `rules` is the project's settings for this gate's one rule. Without it this printed all 45
 * findings on a page whose `target-undersized` was turned off, counted them on its own status
 * line with a red ✗, and sat above a green verdict and exit 0. The measured count stays
 * visible when the rule is off — 45 undersized targets do not stop existing because nobody
 * wants to be told about them, and a formatter that dropped the number would turn a
 * deliberate setting into a silently smaller measurement.
 */
export function formatA11yTouchReport(report: TouchReport, rules?: RuleView): string {
  const lines: string[] = [];
  lines.push(`  ${BOLD}${CYAN}vlmkit check a11y touch${RESET}`);
  lines.push(
    `  ${DIM}source: ${report.source}  level: WCAG ${report.level}`
    + ` (${report.required}×${report.required} min)${RESET}`,
  );
  lines.push(`  ${DIM}inspected ${report.inspectedCount} interactive element(s)${RESET}`);
  const tier = ruleTier(rules, "target-undersized", "suspect");
  const off = tier === "off";
  const icon = off
    ? `${DIM}-${RESET}`
    : report.failures.length === 0
      ? `${GREEN}✓${RESET}`
      : tier === "suspect" ? `${RED}✗${RESET}` : tier === "warn" ? `${YELLOW}!${RESET}` : `${DIM}i${RESET}`;
  lines.push(
    `  ${icon} ${report.failures.length} undersized target(s)`
    + (off
      ? `${DIM} measured and NOT reported — target-undersized is off${RESET}`
      : tier === "suspect" ? "" : `${DIM} [target-undersized re-tuned to ${tier}]${RESET}`)
    + `${report.exempted?.length ? `${DIM}, ${report.exempted.length} exempted${RESET}` : ""}`,
  );
  const CONSOLE_ROWS = 5;
  // Rows only while the rule is on. The count above stays either way: the exemption list and
  // the stale-`--allow` warning below are about the project's own settings, and a reader who
  // turned the rule off still needs to know an exemption has outlived what it covered.
  for (const f of off ? [] : report.failures.slice(0, CONSOLE_ROWS)) {
    const cl = f.cluster ? " (clustered)" : "";
    lines.push(`    ${DIM}${f.path} — ${Math.round(f.bbox.width)}×${Math.round(f.bbox.height)}${cl} — "${f.text}"${RESET}`);
  }
  // See a11y-contrast: an undisclosed cut makes a partial list look complete.
  if (!off && report.failures.length > CONSOLE_ROWS) {
    lines.push(`    ${DIM}… ${report.failures.length - CONSOLE_ROWS} more (see the report, or --json for all)${RESET}`);
  }
  // Exemptions are LISTED, never merely subtracted — the property every exemption
  // in this repo has. A reader has to be able to audit a colleague's judgement call.
  for (const e of report.exempted ?? []) {
    lines.push(
      `    ${DIM}- ${e.finding.path} — ${Math.round(e.finding.bbox.width)}×${Math.round(e.finding.bbox.height)}:`
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

function renderReport(r: Omit<TouchReport, "reportPath">): string {
  const lines: string[] = [];
  lines.push("# A11y touch-target report");
  lines.push("");
  lines.push(`Source: \`${r.source}\``);
  // Not "(with spacing)": nothing here applies WCAG's spacing exception, and
  // saying otherwise is what made a reader expect a 24x24 target in a tight row
  // to be reported at AA. The floor is the shorter side, full stop.
  lines.push(
    `WCAG level: **${r.level}** — every interactive element needs a shorter side of at least`
    + ` ${r.required}px. \`clustered\` annotates a finding (another below-floor target within`
    + ` 24px center-to-center); it never causes one.`,
  );
  lines.push("");
  lines.push(`Inspected **${r.inspectedCount}** interactive element(s).  ` +
    `Screenshot: \`${r.screenshot}\``);
  lines.push("");
  if (r.failures.length === 0) {
    lines.push("## All interactive elements meet the size threshold.");
    return lines.join("\n");
  }
  lines.push(`## ${r.failures.length} undersized target(s)`);
  lines.push("");
  lines.push("Targets below the threshold are hard to tap on touchscreens and " +
    "unreachable for users with motor impairments. The `cluster` flag fires " +
    "when another interactive element's center is within 24 px — the WCAG " +
    "AA-with-spacing leniency does not apply.");
  lines.push("");
  lines.push("| Element | Text | Size | Min side | Need | Cluster |");
  lines.push("|---|---|---|---|---|---|");
  for (const f of r.failures.slice(0, 30)) {
    const sz = `${Math.round(f.bbox.width)}×${Math.round(f.bbox.height)}`;
    lines.push(`| \`${f.path}\` | \`${f.text}\` | ${sz} | **${f.minSide}** | ${f.required} | ${f.cluster ? "yes" : "no"} |`);
  }
  if (r.failures.length > 30) lines.push(`\n_… ${r.failures.length - 30} more row(s) omitted; the JSON report has all of them._`);
  if (r.failures.length > 30) lines.push(`| _…${r.failures.length - 30} more_ | | | | | |`);
  lines.push("");
  lines.push("## Suggested next step");
  lines.push("");
  lines.push("1. For each failing row, expand the element's bbox to ≥ " +
    `${r.failures[0]!.required}×${r.failures[0]!.required} px. Common fixes:`);
  lines.push("   - Increase `padding`. A 12px padding on an icon-only button " +
    "grows a 16×16 icon to 40×40 reach-bbox.");
  lines.push("   - Set `min-width` / `min-height` explicitly: " +
    `\`min-width: ${r.failures[0]!.required}px; min-height: ${r.failures[0]!.required}px;\`.`);
  lines.push("   - For inline links, wrap them in a block with hit padding " +
    "and use `display: inline-block`.");
  lines.push("2. Re-run `vlmkit check a11y touch`. The failure list should empty out.");
  lines.push("");
  return lines.join("\n");
}

/**
 * CLI entry removed: this module is measurement code now, not a command.
 * `check a11y touch` is declared in `./gates/a11y.gate.ts` and driven by the core runner
 * (`@mizchi/vlmkit-core/plugin/runner.ts`), which owns argument parsing,
 * `--json`, `--advisory`, the run ledger and the exit code.
 */
