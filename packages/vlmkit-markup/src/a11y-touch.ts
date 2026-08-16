#!/usr/bin/env node
/**
 * A11y touch-target check.
 *
 * WCAG 2.2 AA (criterion 2.5.8) requires interactive elements to be at least 24 × 24 CSS
 * px; WCAG 2.1 AAA (criterion 2.5.5) raises that to 44 × 44. Small touch targets are
 * unreachable for users with motor impairments and frustrating on touchscreens.
 *
 * Scans visible interactive elements (button, link, input, select, textarea, [role=button],
 * [role=link], elements with tabindex ≥ 0) and reports those below the level's floor that
 * no exception excuses. The exceptions and the thresholds live together in
 * `markup-core/a11y_touch.mbt` — read that file for which two are applied and why.
 *
 * **AA is the default**, changed in 0.11.0. AAA is 44px with only the Inline exception, so
 * it reported 37 of 38 targets on vite.dev and 17 of 18 on Bootstrap's dashboard example —
 * unmodified vendor defaults in both cases, i.e. a floor no project using either framework
 * could reach. Three things settle the direction: AA is the level conformance is defined
 * against, W3C advises against requiring AAA as a general policy, and `src/a11y-on-page.ts`
 * (the `vlmkit diff-pr` path) already ran this check at AA — so one page could pass CI and
 * fail the CLI.
 *
 * Usage:
 *   vlmkit check a11y touch <html-or-url>              # 24x24, WCAG 2.5.8
 *   vlmkit check a11y touch <url> --level AAA          # 44x44, WCAG 2.5.5
 */
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { basename, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { type Page } from "playwright";
import { handleCliError } from "@mizchi/vlmkit-core/cli-error.ts";
import { DIM, RESET, GREEN, RED, BOLD, CYAN, YELLOW } from "@mizchi/vlmkit-core/terminal-colors.ts";
import { type PageLoadOptions, pickPageLoad } from "@mizchi/vlmkit-core/page-load.ts";
import { openSource } from "@mizchi/vlmkit-core/page-open.ts";
import { touchPolicy } from "./markup-core-a11y-touch.ts";
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
  /** Required size threshold. AA → 24px (default), AAA → 44px. */
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

/**
 * A WCAG exception that excuses an undersized target, when one applies.
 *
 * - `inline` — the target is in a sentence and sized by the line (2.5.5 and 2.5.8).
 * - `spacing` — a 24px circle on it clears every neighbour (2.5.8, so AA only).
 *
 * The criteria's other three exceptions (Equivalent, User-agent control, Essential) need
 * intent rather than measurement, and are declared with `--allow "<selector>;<reason>"`.
 */
export type TouchWcagException = "inline" | "spacing";

export interface TouchTargetFinding {
  path: string;
  tag: string;
  text: string;
  bbox: { x: number; y: number; width: number; height: number };
  /** Minimum of width and height — the limiting dimension. */
  minSide: number;
  required: number;
  /** Another below-floor target's center within 24 px. Annotation; never a cause. */
  cluster: boolean;
  /** Set only on an exempted target. Absent means this is a real failure. */
  exception?: TouchWcagException;
}

export interface TouchAnalysis {
  /** The level's floor in px. */
  required: number;
  /** Undersized, and no exception applies. */
  failures: TouchTargetFinding[];
  /**
   * Undersized but excused by the criterion itself. LISTED, never merely subtracted —
   * the property every exemption in this repo has, and the reason an earlier version of
   * this gate refused to apply the spacing exception at all.
   */
  wcagExempt: TouchTargetFinding[];
  /** Distinct rendered targets measured. */
  inspectedCount: number;
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
   * Undersized targets the SUCCESS CRITERION itself excuses (Inline / Spacing), as
   * distinct from `exempted` below, which is the project's own judgement call. Both are
   * listed; only these two are decidable from the page.
   */
  wcagExempt?: TouchTargetFinding[];
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
  // Whether the target sits in running text: the nearest non-inline ancestor holds text
  // that is not inside this target. That is WCAG's "in a sentence" — and it is checked by
  // walking the block's OWN child nodes rather than subtracting textContent, because a
  // target with no text of its own (an icon link) makes the subtraction return the whole
  // block and every icon in a text block would read as prose.
  function inSentence(el) {
    let block = el.parentElement;
    while (block && getComputedStyle(block).display.indexOf("inline") === 0) {
      block = block.parentElement;
    }
    if (!block) return false;
    let other = 0;
    for (const node of block.childNodes) {
      if (node === el) continue;
      if (node.nodeType === 1 && node.contains(el)) continue;
      other += (node.textContent || "").trim().length;
    }
    return other > 0;
  }
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
      // For the Inline exception. Only a bare \`inline\` box is sized by the line —
      // \`inline-block\` and \`inline-flex\` carry their own height and can be grown.
      display: cs.display,
      inSentence: inSentence(el),
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
  /**
   * Computed `display`. Optional: a caller that built samples by hand — or a run recorded
   * before this field existed — gets no Inline exemption rather than a wrong one, which is
   * the conservative direction (it keeps findings, same as `FocusStep.pinned`).
   */
  display?: string;
  /** Whether the nearest block ancestor holds text outside this target. See above. */
  inSentence?: boolean;
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

/**
 * Every distinct rendered target's verdict, with the criteria's own exceptions applied.
 *
 * ONE implementation. `runA11yTouch` used to re-implement the dedupe, the cluster
 * arithmetic and the finding construction inline — the CLI path and the `vlmkit diff-pr`
 * path could therefore disagree about WCAG on one page, which is exactly what happened to
 * `check a11y contrast` (see `a11y-contrast.ts`). The inline copy existed because the
 * exported version spent an O(n²) boundary call per pair; `touchPolicy` crosses once, so
 * the reason is gone and so is the copy.
 */
export function analyzeA11yTouch(
  samples: readonly A11yTouchRawSample[],
  level: WcagTouchLevel = "AA",
): TouchAnalysis {
  const byPath = new Map<string, A11yTouchRawSample>();
  for (const s of samples) {
    const key = targetKey(s);
    if (!byPath.has(key)) byPath.set(key, s);
  }
  const elements = [...byPath.values()];
  const { required, verdicts } = touchPolicy(
    level,
    elements.map((e) => ({
      rect: e.bbox,
      display: e.display ?? "",
      inSentence: e.inSentence === true,
    })),
  );

  const failures: TouchTargetFinding[] = [];
  const exempted: TouchTargetFinding[] = [];
  for (const v of verdicts) {
    if (!v.undersized) continue;
    const e = elements[v.targetPosition]!;
    const finding: TouchTargetFinding = {
      path: e.path,
      tag: e.tag,
      text: e.text,
      bbox: e.bbox,
      minSide: Math.round(v.minSide),
      required,
      cluster: v.clustered,
      ...(v.exception ? { exception: v.exception as TouchWcagException } : {}),
    };
    (v.exception ? exempted : failures).push(finding);
  }
  const bySize = (a: TouchTargetFinding, b: TouchTargetFinding) => a.minSide - b.minSide;
  failures.sort(bySize);
  exempted.sort(bySize);
  return { required, failures, wcagExempt: exempted, inspectedCount: elements.length };
}

/**
 * The failures alone, for callers that only ever wanted those — `vlmkit diff-pr` through
 * `src/a11y-on-page.ts`, and the `rules.ts` barrel.
 *
 * Kept as its own export rather than folded into `analyzeA11yTouch`: both are public
 * surface, and a caller counting `.length` should not silently start counting exempted
 * targets too.
 */
export function analyzeA11yTouchSamples(
  samples: readonly A11yTouchRawSample[],
  level: WcagTouchLevel = "AA",
): TouchTargetFinding[] {
  return analyzeA11yTouch(samples, level).failures;
}

export async function runA11yTouch(options: TouchCheckOptions): Promise<TouchReport> {
  const outputDir = resolve(options.outputDir);
  await mkdir(outputDir, { recursive: true });
  const viewport = options.viewport ?? { width: 1280, height: 900 };
  const level = options.level ?? "AA";

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

  // One analysis, shared with `vlmkit diff-pr` — see `analyzeA11yTouch`.
  const analysis = analyzeA11yTouch(samples, level);
  const findings = analysis.failures;

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
    required: analysis.required,
    viewport,
    screenshot: screenshotPath,
    inspectedCount: analysis.inspectedCount,
    failures: kept,
    wcagExempt: analysis.wcagExempt,
  });
  await writeFile(reportPath, md);

  return {
    source: options.source, level, required: analysis.required, viewport, screenshot: screenshotPath,
    inspectedCount: analysis.inspectedCount, failures: kept, reportPath,
    ...(analysis.wcagExempt.length > 0 ? { wcagExempt: analysis.wcagExempt } : {}),
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
  // The criterion's own exceptions, on their own line and never folded into the count
  // above. A reader has to be able to tell "nothing is undersized" from "seven are, and
  // WCAG excuses them" — those call for different work, and collapsing them is what made
  // an earlier version of this gate refuse to apply the spacing exception at all.
  if (!off && report.wcagExempt?.length) {
    const inline = report.wcagExempt.filter((f) => f.exception === "inline").length;
    const spacing = report.wcagExempt.length - inline;
    const which = [
      ...(inline > 0 ? [`${inline} in a sentence`] : []),
      ...(spacing > 0 ? [`${spacing} with clear spacing`] : []),
    ].join(", ");
    lines.push(
      `  ${DIM}${report.wcagExempt.length} undersized target(s) excused by WCAG`
      + ` ${report.level === "AA" ? "2.5.8" : "2.5.5"} itself (${which})${RESET}`,
    );
  }
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
  const criterion = r.level === "AA" ? "2.5.8 Target Size (Minimum)" : "2.5.5 Target Size (Enhanced)";
  lines.push(
    `WCAG level: **${r.level}** (${criterion}) — every interactive element needs a shorter`
    + ` side of at least ${r.required}px, unless one of the criterion's exceptions applies.`
    + ` \`clustered\` annotates a finding (another below-floor target within 24px`
    + ` center-to-center); it never causes one.`,
  );
  lines.push("");
  lines.push(
    "Two exceptions are decided from the page and applied below: **Inline** (the target is"
    + " in a sentence, so the line-height sizes it — both levels) and **Spacing** (a 24px"
    + " circle centered on the target clears every neighbour — AA only, since 2.5.5 has no"
    + " spacing exception). The other three — Equivalent, User-agent control, Essential —"
    + " need intent rather than measurement; declare those with"
    + " `--allow \"<selector>;<reason>\"`.",
  );
  lines.push("");
  lines.push(`Inspected **${r.inspectedCount}** interactive element(s).  ` +
    `Screenshot: \`${r.screenshot}\``);
  lines.push("");
  if (r.wcagExempt?.length) {
    lines.push(`## ${r.wcagExempt.length} undersized target(s) excused by the criterion`);
    lines.push("");
    lines.push("Listed rather than dropped: an exemption a reader cannot see is a blind spot.");
    lines.push("");
    lines.push("| Element | Text | Size | Min side | Need | Exception |");
    lines.push("|---|---|---|---|---|---|");
    for (const f of r.wcagExempt.slice(0, 30)) {
      const sz = `${Math.round(f.bbox.width)}×${Math.round(f.bbox.height)}`;
      lines.push(`| \`${f.path}\` | \`${f.text}\` | ${sz} | ${f.minSide} | ${f.required} | ${f.exception} |`);
    }
    if (r.wcagExempt.length > 30) {
      lines.push(`\n_… ${r.wcagExempt.length - 30} more row(s) omitted; the JSON report has all of them._`);
    }
    lines.push("");
  }
  if (r.failures.length === 0) {
    lines.push("## All interactive elements meet the size threshold.");
    return lines.join("\n");
  }
  lines.push(`## ${r.failures.length} undersized target(s)`);
  lines.push("");
  lines.push("Targets below the threshold are hard to tap on touchscreens and " +
    "unreachable for users with motor impairments. Every row here is undersized AND " +
    "unexcused: it is neither in a sentence nor (at AA) clear of its neighbours. The " +
    "`cluster` flag says another below-floor target's center is within 24px.");
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
