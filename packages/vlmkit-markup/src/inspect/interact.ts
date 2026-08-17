#!/usr/bin/env node
/**
 * Interaction-sequence VRT.
 *
 * Beyond `:hover` and `:focus-visible` (covered by `vrt
 * component-from-image --states`), real UI bugs hide behind scripted
 * sequences: open a dropdown, fill a form, scroll a page, click
 * through a multi-step flow. This tool drives an HTML through a
 * declarative sequence of Playwright actions, captures named
 * snapshots between steps, and pixel-diffs each transition.
 *
 * The agent declares the sequence in JSON:
 *
 *   {
 *     "viewport": { "width": 1280, "height": 720 },
 *     "steps": [
 *       { "action": "snapshot", "name": "default" },
 *       { "action": "click", "selector": ".dropdown-trigger" },
 *       { "action": "snapshot", "name": "menu-open" },
 *       { "action": "type", "selector": "input[name=email]",
 *         "text": "test@example.com" },
 *       { "action": "snapshot", "name": "filled" }
 *     ]
 *   }
 *
 * Outputs:
 *   - One PNG per named snapshot
 *   - Pixel diff between consecutive snapshots ("how much did this
 *     step change?") + heatmap region clusters on each transition
 *   - A markdown report showing the sequence + delta table
 *
 * Usage:
 *   vlmkit inspect interact <html-or-url> --sequence <path-to-sequence.json>
 */
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { basename, dirname, join, resolve } from "node:path";
import { type Page } from "playwright";
import { isCliEntry } from "@mizchi/vlmkit-core/plugin/cli-entry.ts";
import { compareScreenshots } from "@mizchi/vlmkit-core/heatmap.ts";
import { findHeatmapRegionsFromFile, type HeatmapRegion } from "@mizchi/vlmkit-core/heatmap-regions.ts";
import { annotateHeatmapRegionKinds } from "../heatmap-region-kinds.ts";
import { healSelector } from "../heal/selector-heal.ts";
import type { VrtSnapshot } from "@mizchi/vlmkit-core/types.ts";
import { handleCliError } from "@mizchi/vlmkit-core/cli-error.ts";
import { DIM, RESET, GREEN, RED, YELLOW, BOLD, CYAN } from "@mizchi/vlmkit-core/terminal-colors.ts";
import { classifyHealTier } from "./selector-heal-calibration.ts";
import { withBrowser } from "@mizchi/vlmkit-core/browser-launch.ts";

export type SequenceAction =
  | { action: "snapshot"; name: string }
  | { action: "click"; selector: string }
  | { action: "hover"; selector: string }
  | { action: "focus"; selector: string }
  | { action: "blur"; selector: string }
  | { action: "press"; selector?: string; key: string }
  | { action: "type"; selector: string; text: string }
  | { action: "fill"; selector: string; value: string }
  | { action: "select"; selector: string; value: string }
  | { action: "scroll"; selector?: string; x?: number; y?: number }
  | { action: "wait"; ms: number }
  | { action: "waitForSelector"; selector: string };

export interface Sequence {
  viewport?: { width: number; height: number };
  steps: SequenceAction[];
}

export interface InteractOptions {
  source: string;
  sequencePath: string;
  outputDir: string;
  reportPath?: string;
  /** Pixel diff threshold. Default 0.03. */
  threshold?: number;
  /**
   * Run the healer probe on every step with a selector — not only on
   * failures. Catches the typo-matched-the-wrong-element case where a
   * step technically succeeds but acts on the wrong target. Adds one
   * healer DOM scan (~50-200ms) per selector step; expect a 1.5-3×
   * wall-time increase on selector-heavy sequences. Default off.
   */
  healAll?: boolean;
}

export interface SnapshotEntry {
  name: string;
  screenshotPath: string;
  /** Actions executed since the previous snapshot. */
  actionsBefore: SequenceAction[];
}

export interface TransitionDelta {
  from: string;
  to: string;
  actions: SequenceAction[];
  diffPixels: number;
  diffRatio: number;
  totalPixels: number;
  heatmapPath?: string;
  heatmapRegions: HeatmapRegion[];
}

/**
 * A "did you mean..." finding from --heal-all on a step that
 * technically succeeded. The originalSelector matched something, but
 * the healer found a higher-confidence sibling that may be what the
 * sequence author actually intended.
 */
export interface HealAllFinding {
  /** Step index in the sequence. */
  stepIndex: number;
  action: SequenceAction;
  originalSelector: string;
  /**
   * Confidence tier. "strong" (≥0.3) is the actionable case — the
   * sibling shares enough class-token signal that the typed selector
   * is likely the wrong one. "weak" (0.1-0.3) is informational only;
   * it's the typical sibling-button overlap that the dogfood
   * (2026-05-15) flagged as noise when labelled "did you mean".
   */
  tier: "strong" | "weak";
  suggestion: {
    selector: string;
    confidence: number;
    text: string;
  };
}

/**
 * A step that threw — a selector that matched nothing, a `select` with no such
 * option, a `waitForSelector` that timed out.
 *
 * These were printed to stdout and then dropped. Everything downstream saw only
 * the consequence: a transition with a near-zero delta, which the report's own
 * prose explains as "the actions had no visible effect — usually a sign the
 * selector didn't match". It had the reason and threw it away, so a `--json`
 * consumer or an agent reading the report could not tell a step that failed from
 * a step that legitimately changed nothing.
 */
export interface StepFailure {
  /** Index into `Sequence.steps`. */
  stepIndex: number;
  action: SequenceAction;
  /** First line of the thrown message; the stack is noise here. */
  message: string;
  /** Present when the failure looked like a selector miss and the healer ran. */
  suggestions?: Array<{ selector: string; confidence: number; text: string }>;
}

export interface InteractReport {
  source: string;
  viewport: { width: number; height: number };
  snapshots: SnapshotEntry[];
  transitions: TransitionDelta[];
  reportPath: string;
  healAllFindings?: HealAllFinding[];
  /** Steps that threw, in sequence order. Empty when every step ran. */
  stepFailures: StepFailure[];
}

function parseArgs(argv: string[]) {
  let sequence = "";
  let outputDir = "";
  let report = "";
  let threshold = 0.03;
  let healAll = false;
  const positional: string[] = [];
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--sequence") sequence = argv[++i];
    else if (a === "--output-dir") outputDir = argv[++i];
    else if (a === "--report") report = argv[++i];
    else if (a === "--threshold") threshold = parseFloat(argv[++i] ?? "0.03");
    else if (a === "--heal-all") healAll = true;
    else positional.push(a);
  }
  return { positional, sequence, outputDir, report, threshold, healAll };
}

function isUrl(s: string): boolean { return /^https?:\/\//.test(s); }

function summarizeAction(a: SequenceAction): string {
  switch (a.action) {
    case "snapshot": return `snapshot "${a.name}"`;
    case "click": return `click \`${a.selector}\``;
    case "hover": return `hover \`${a.selector}\``;
    case "focus": return `focus \`${a.selector}\``;
    case "blur": return `blur \`${a.selector}\``;
    case "press": return a.selector
      ? `press "${a.key}" on \`${a.selector}\``
      : `press "${a.key}"`;
    case "type": return `type "${a.text}" into \`${a.selector}\``;
    case "fill": return `fill \`${a.selector}\` = "${a.value}"`;
    case "select": return `select \`${a.selector}\` → "${a.value}"`;
    case "scroll": return a.selector
      ? `scroll \`${a.selector}\` to (${a.x ?? 0}, ${a.y ?? 0})`
      : `scroll window to (${a.x ?? 0}, ${a.y ?? 0})`;
    case "wait": return `wait ${a.ms}ms`;
    case "waitForSelector": return `waitFor \`${a.selector}\``;
  }
}

async function executeStep(page: Page, step: SequenceAction): Promise<void> {
  switch (step.action) {
    case "snapshot": return;  // handled by caller
    case "click": await page.click(step.selector, { timeout: 5000 }); return;
    case "hover": await page.hover(step.selector, { timeout: 5000 }); return;
    case "focus": await page.focus(step.selector, { timeout: 5000 }); return;
    case "blur":
      await page.locator(step.selector).first().evaluate((el) => (el as HTMLElement).blur());
      return;
    case "press":
      if (step.selector) {
        await page.press(step.selector, step.key, { timeout: 5000 });
      } else {
        await page.keyboard.press(step.key);
      }
      return;
    case "type": await page.type(step.selector, step.text, { timeout: 5000 }); return;
    case "fill": await page.fill(step.selector, step.value, { timeout: 5000 }); return;
    case "select": await page.selectOption(step.selector, step.value, { timeout: 5000 }); return;
    case "scroll":
      if (step.selector) {
        await page.locator(step.selector).first().evaluate((el, pos) => {
          el.scrollTo(pos.x ?? 0, pos.y ?? 0);
        }, { x: step.x ?? 0, y: step.y ?? 0 });
      } else {
        await page.evaluate((pos) => {
          window.scrollTo(pos.x ?? 0, pos.y ?? 0);
        }, { x: step.x ?? 0, y: step.y ?? 0 });
      }
      return;
    case "wait": await page.waitForTimeout(step.ms); return;
    case "waitForSelector": await page.waitForSelector(step.selector, { timeout: 5000 }); return;
  }
}

export async function runInteract(options: InteractOptions): Promise<InteractReport> {
  const outputDir = resolve(options.outputDir);
  await mkdir(outputDir, { recursive: true });

  const sequenceText = await readFile(resolve(options.sequencePath), "utf-8");
  const sequence: Sequence = JSON.parse(sequenceText);
  const viewport = sequence.viewport ?? { width: 1280, height: 720 };
  const threshold = options.threshold ?? 0.03;

  // Sanity check: at least two snapshot steps so we can diff a transition.
  const snapshotSteps = sequence.steps.filter((s) => s.action === "snapshot");
  if (snapshotSteps.length === 0) {
    throw new Error("Sequence must contain at least one `snapshot` step.");
  }

  const snapshots: SnapshotEntry[] = [];
  const healAllFindings: HealAllFinding[] = [];
  const stepFailures: StepFailure[] = [];
  let pendingActions: SequenceAction[] = [];
  await withBrowser(async (browser) => {
    const page = await browser.newPage({ viewport });
    if (isUrl(options.source)) {
      await page.goto(options.source, { waitUntil: "networkidle", timeout: 30000 });
    } else {
      const html = await readFile(resolve(options.source), "utf-8");
      await page.setContent(html, { waitUntil: "networkidle" });
    }
    await page.addStyleTag({
      content: `*, *::before, *::after { transition: none !important; animation: none !important; }`,
    });

    for (let stepIndex = 0; stepIndex < sequence.steps.length; stepIndex++) {
      const step = sequence.steps[stepIndex]!;
      if (step.action === "snapshot") {
        const safeName = step.name.replace(/[^a-z0-9._-]+/gi, "_");
        const screenshotPath = join(outputDir, `${safeName}.png`);
        await page.screenshot({ path: screenshotPath, fullPage: false });
        snapshots.push({
          name: step.name,
          screenshotPath,
          actionsBefore: pendingActions.slice(),
        });
        pendingActions = [];
      } else {
        let stepFailed = false;
        try {
          await executeStep(page, step);
        } catch (error) {
          stepFailed = true;
          const msg = String(error instanceof Error ? error.message : error);
          const failure: StepFailure = {
            stepIndex,
            action: step,
            message: msg.split("\n")[0]!,
          };
          // Self-healing: when the failure is a selector miss, ask
          // the healer for plausible alternatives. From the
          // browser-harness pattern + WebMCP extract — tell the
          // agent what to fix, don't just fail silently.
          const failedSelector = (step as { selector?: string }).selector;
          const isSelectorMiss = failedSelector
            && (/Timeout.*exceeded/i.test(msg) || /no element matched/i.test(msg) || /strict mode violation/i.test(msg));
          if (isSelectorMiss) {
            try {
              const candidates = await healSelector(page, failedSelector, { maxCandidates: 3 });
              if (candidates.length > 0) {
                failure.suggestions = candidates.map((c) => ({
                  selector: c.selector, confidence: c.confidence, text: c.text,
                }));
              }
            } catch { /* healer failure is non-fatal */ }
          }
          stepFailures.push(failure);
        }
        // --heal-all: probe successful selector steps for higher-
        // confidence siblings. Catches the typo-but-still-matches case
        // (e.g. `.btn-primary` was typed when the prose meant
        // `.btn-secondary`) that the failure-only healer can't see.
        const successSelector = !stepFailed ? (step as { selector?: string }).selector : undefined;
        if (options.healAll && successSelector) {
          try {
            const candidates = await healSelector(page, successSelector, {
              maxCandidates: 1,
              exclude: successSelector,
            });
            // The corpus-calibrated strong tier is deliberately conservative:
            // a 30% suggestion selected the wrong sibling. See docs/knowledge.md.
            const top = candidates[0];
            if (top) {
              const tier = classifyHealTier(top.confidence);
              if (tier !== "none") {
                healAllFindings.push({
                  stepIndex,
                  action: step,
                  originalSelector: successSelector,
                  tier,
                  suggestion: { selector: top.selector, confidence: top.confidence, text: top.text },
                });
              }
            }
          } catch { /* healer failure is non-fatal */ }
        }
        pendingActions.push(step);
      }
    }
    await page.close();
  });

  // Pixel-diff consecutive snapshots. Each transition surfaces the
  // delta induced by the actions between them.
  const transitions: TransitionDelta[] = [];
  for (let i = 1; i < snapshots.length; i++) {
    const prev = snapshots[i - 1]!;
    const cur = snapshots[i]!;
    const snap: VrtSnapshot = {
      testId: `transition-${i}`,
      testTitle: `${prev.name} → ${cur.name}`,
      projectName: "interact",
      screenshotPath: cur.screenshotPath,
      baselinePath: prev.screenshotPath,
      status: "changed",
    };
    const diff = await compareScreenshots(snap, { outputDir, threshold });
    const heatmapPath = join(outputDir, `transition-${i}_heatmap.png`);
    let heatmapRegions: HeatmapRegion[] = [];
    try {
      heatmapRegions = await findHeatmapRegionsFromFile(heatmapPath, {}, cur.screenshotPath);
      await annotateHeatmapRegionKinds(heatmapRegions, cur.screenshotPath);
    } catch {
      // No heatmap (zero diff).
    }
    transitions.push({
      from: prev.name,
      to: cur.name,
      actions: cur.actionsBefore,
      diffPixels: diff?.diffPixels ?? 0,
      diffRatio: diff?.diffRatio ?? 0,
      totalPixels: diff?.totalPixels ?? 0,
      heatmapPath: diff?.diffPixels && diff.diffPixels > 0 ? heatmapPath : undefined,
      heatmapRegions,
    });
  }

  const reportPath = options.reportPath ?? join(outputDir, "report.md");
  const md = renderReport({
    source: options.source,
    viewport,
    snapshots,
    transitions,
    stepFailures,
    healAllFindings: options.healAll ? healAllFindings : undefined,
  });
  await writeFile(reportPath, md);

  return {
    source: options.source,
    viewport,
    snapshots,
    transitions,
    reportPath,
    stepFailures,
    healAllFindings: options.healAll ? healAllFindings : undefined,
  };
}

/**
 * The terminal summary. Extracted from `runInteract` for the reason every gate's
 * `format` is separate from its `run`: a measurement that prints cannot be
 * composed, and the step-failure lines in particular were printed *during* the
 * run, interleaved with nothing and recoverable by no one.
 *
 * @param sequenceStepCount how many steps the sequence declared, for the
 *   `--heal-all` denominator. Not on the report, because a report is what was
 *   measured and this is what was asked for.
 */
export function formatInteractReport(
  report: InteractReport,
  options: { sequencePath?: string; healAll?: boolean; selectorStepCount?: number } = {},
): string {
  const lines: string[] = [];
  lines.push(`  ${BOLD}${CYAN}vlmkit inspect interact${RESET}`);
  lines.push(`  ${DIM}source: ${report.source}${options.sequencePath ? `  sequence: ${options.sequencePath}` : ""}${RESET}`);
  lines.push(`  ${DIM}captured ${report.snapshots.length} snapshot(s), ${report.transitions.length} transition(s)${RESET}`);
  for (const f of report.stepFailures) {
    lines.push(`  ${YELLOW}step ${f.stepIndex} failed (${summarizeAction(f.action)}): ${f.message}${RESET}`);
    for (const c of f.suggestions ?? []) {
      lines.push(`      ${DIM}${(c.confidence * 100).toFixed(0).padStart(3)}%  \`${c.selector}\`  ${c.text ? `"${c.text}"` : ""}${RESET}`);
    }
  }
  for (const t of report.transitions) {
    const pct = (t.diffRatio * 100).toFixed(2);
    const icon = t.diffRatio === 0 ? `${YELLOW}~${RESET}` : `${GREEN}✓${RESET}`;
    const summary = t.actions.map(summarizeAction).join(", ");
    lines.push(`  ${icon} ${t.from} → ${t.to}  ${pct.padStart(6)}%  ${DIM}${summary}${RESET}`);
  }
  if (options.healAll) {
    const findings = report.healAllFindings ?? [];
    const strongCount = findings.filter((f) => f.tier === "strong").length;
    const weakCount = findings.length - strongCount;
    lines.push(`  ${DIM}heal-all: ${strongCount} strong + ${weakCount} weak suggestion(s) across ${options.selectorStepCount ?? 0} selector step(s)${RESET}`);
  }
  lines.push(`  ${DIM}report: ${report.reportPath}${RESET}`);
  return lines.join("\n");
}

function renderReport(r: Omit<InteractReport, "reportPath">): string {
  const lines: string[] = [];
  lines.push("# Interaction-sequence report");
  lines.push("");
  lines.push(`Source: \`${r.source}\` at ${r.viewport.width}×${r.viewport.height}`);
  lines.push(`Captured **${r.snapshots.length}** snapshot(s), ${r.transitions.length} transition(s).`);
  lines.push("");
  lines.push("## Snapshots");
  lines.push("");
  for (const s of r.snapshots) {
    lines.push(`- **${s.name}** — \`${s.screenshotPath}\``);
  }
  lines.push("");

  // Before the transitions, because a failed step is the reason a transition is
  // dead, and reading them the other way round means guessing.
  if (r.stepFailures.length > 0) {
    lines.push("## Steps that failed");
    lines.push("");
    lines.push("These steps threw and were skipped. Any transition spanning one of them "
      + "measured a page the sequence never finished setting up, so read its delta as "
      + "incomplete rather than as a finding.");
    lines.push("");
    for (const f of r.stepFailures) {
      lines.push(`- **step ${f.stepIndex}** — ${summarizeAction(f.action)}`);
      lines.push(`  - \`${f.message}\``);
      for (const c of f.suggestions ?? []) {
        lines.push(`  - did you mean \`${c.selector}\`? _(${(c.confidence * 100).toFixed(0)}% confidence${c.text ? `, "${c.text}"` : ""})_`);
      }
    }
    lines.push("");
  }

  lines.push("## Transitions (delta per step group)");
  lines.push("");
  if (r.transitions.length === 0) {
    lines.push("_No transitions to report — sequence had only one snapshot._");
  } else {
    lines.push("Each transition shows the actions executed between two snapshots " +
      "and the pixel diff they induced. A near-zero delta means the actions had " +
      "no visible effect — usually a sign the selector didn't match, or the " +
      "click hit a no-op.");
    lines.push("");
    lines.push("| From → To | Actions | Pixel diff | Regions | Note |");
    lines.push("|---|---|---|---|---|");
    for (const t of r.transitions) {
      const acts = t.actions.length === 0
        ? "_(nothing)_"
        : t.actions.map((a) => `\`${summarizeAction(a).replace(/\|/g, "\\|")}\``).join("<br>");
      // "dead" = non-snapshot actions executed but no visible change.
      // Subagent dogfood: "0% on hover caught a real bug — surface it
      // prominently per-row, not only in the next-step section."
      const nonSnapshotActions = t.actions.filter((a) =>
        a.action !== "wait" && a.action !== "waitForSelector" && a.action !== "snapshot");
      const dead = nonSnapshotActions.length > 0 && t.diffRatio < 0.001;
      const note = dead
        ? "**dead** — actions had no visible effect (selector miss? no-op?)"
        : "";
      lines.push(`| **${t.from}** → **${t.to}** | ${acts} | ${(t.diffRatio * 100).toFixed(2)}% (${t.diffPixels} px) | ${t.heatmapRegions.length} | ${note} |`);
    }
    lines.push("");

    // Surface the largest changes per transition.
    const surface = r.transitions.filter((t) => t.heatmapRegions.length > 0);
    if (surface.length > 0) {
      lines.push("## Heatmap regions per transition");
      lines.push("");
      for (const t of surface) {
        lines.push(`### ${t.from} → ${t.to} — ${(t.diffRatio * 100).toFixed(2)}% diff`);
        lines.push("");
        lines.push("| Top-Left | Size | Hot pixels | Fill | Kind |");
        lines.push("|---|---|---|---|---|");
        for (const reg of t.heatmapRegions.slice(0, 5)) {
          const fill = reg.dominantColor ? `\`${reg.dominantColor.hex}\`` : "—";
          const kind = reg.kind ? `\`${reg.kind}\`` : "—";
          lines.push(`| ${reg.left},${reg.top} | ${reg.width}×${reg.height} | ${reg.area} | ${fill} | ${kind} |`);
        }
        lines.push("");
      }
    }
  }

  if (r.healAllFindings !== undefined) {
    lines.push("## Heal-all: did-you-mean suggestions");
    lines.push("");
    if (r.healAllFindings.length === 0) {
      lines.push("`--heal-all` enabled. No higher-confidence sibling found for any successful selector step — the selectors look unambiguous.");
    } else {
      const strongCount = r.healAllFindings.filter((f) => f.tier === "strong").length;
      const weakCount = r.healAllFindings.length - strongCount;
      lines.push(`\`--heal-all\` enabled. ${strongCount} strong + ${weakCount} weak suggestion(s). ` +
        "Each step below succeeded technically, but the healer found a sibling element with overlapping class-token signal. " +
        "**Strong** tier (≥30% confidence) is the typo-the-wrong-element case worth investigating; " +
        "**weak** tier (10-30%) is the sibling-button-style overlap that's mostly informational.");
      lines.push("");
      lines.push("| Step | Tier | Action | Used selector | Did you mean? | Confidence |");
      lines.push("|---|---|---|---|---|---|");
      for (const f of r.healAllFindings) {
        const summary = summarizeAction(f.action).replace(/\|/g, "\\|");
        const text = f.suggestion.text ? ` _(${f.suggestion.text.replace(/\|/g, "\\|")})_` : "";
        const tierCell = f.tier === "strong" ? "**strong**" : "_weak_";
        lines.push(`| ${f.stepIndex} | ${tierCell} | \`${summary}\` | \`${f.originalSelector}\` | \`${f.suggestion.selector}\`${text} | ${(f.suggestion.confidence * 100).toFixed(0)}% |`);
      }
      lines.push("");
      lines.push("**Remediation**: if a strong suggestion is correct, edit the step in your sequence JSON to use the suggested selector. " +
        "If all suggestions are false positives, re-run without `--heal-all` to silence them (default behavior is failure-only healing).");
    }
    lines.push("");
  }

  lines.push("## Suggested next step");
  lines.push("");
  const zeroDeltas = r.transitions.filter((t) => t.diffRatio < 0.001 && t.actions.length > 0);
  if (zeroDeltas.length > 0) {
    lines.push(`${zeroDeltas.length} transition(s) induced essentially zero pixel change — likely a no-op or selector miss:`);
    lines.push("");
    for (const t of zeroDeltas) {
      lines.push(`- **${t.from} → ${t.to}**: ${t.actions.map(summarizeAction).join(", ")}`);
    }
    lines.push("");
    lines.push("Verify each: open the source HTML, confirm the selector matches a real " +
      "element, and confirm the action is supposed to be visible (e.g., `click` on a " +
      "submit button without server response will show no visible change in static HTML).");
  } else {
    lines.push("Every action produced visible change. If a transition surfaces an " +
      "*unexpected* region in the Fill / Kind columns above (e.g., wrong color, " +
      "wrong element type), inspect the source CSS for that element.");
  }
  lines.push("");
  return lines.join("\n");
}

/**
 * The command. Returns its exit code rather than assigning `process.exitCode`,
 * and prints via `formatInteractReport` rather than from inside the measurement.
 *
 * @param cwd resolved against for the default output directory — an argument,
 *   because `process.chdir` is process-wide.
 */
export async function runInteractCli(
  cliArgs: readonly string[],
  options: { cwd?: string } = {},
): Promise<number> {
  const argv = [...cliArgs];
  // `--help` is a request that was satisfied; missing arguments are an error. Both
  // printed the same usage and both exited 1, so `vlmkit inspect interact --help`
  // failed in any `&&` chain or CI help check.
  const askedForHelp = argv[0] === "--help" || argv[0] === "-h";
  const { positional, sequence, outputDir, report, threshold, healAll } =
    parseArgs(askedForHelp ? [] : argv);
  if (askedForHelp || positional.length === 0 || !sequence) {
    console.log("Usage: vlmkit inspect interact <html-or-url> --sequence <path.json> [options]");
    console.log("Options:");
    console.log("  --sequence <path>   JSON file describing the action sequence.");
    console.log("  --output-dir <dir>  Default: ./test-results/interact");
    console.log("  --report <path>     Markdown report path");
    console.log("  --threshold <0..1>  Pixel diff threshold (default: 0.03)");
    console.log("  --heal-all          Run the healer probe on every selector step,");
    console.log("                      not only on failures. Surfaces \"did you mean?\"");
    console.log("                      siblings for steps that technically succeed —");
    console.log("                      catches the typo-matched-the-wrong-element case.");
    console.log("                      Adds one DOM scan per selector step (expect a");
    console.log("                      1.5-3x wall-time increase on selector-heavy seqs).");
    console.log("");
    console.log("Sequence schema:");
    console.log('  { "viewport": { "width": 1280, "height": 720 },');
    console.log('    "steps": [');
    console.log('      { "action": "snapshot", "name": "default" },');
    console.log('      { "action": "click", "selector": ".btn" },');
    console.log('      { "action": "snapshot", "name": "after-click" } ] }');
    console.log("");
    console.log("Actions: snapshot | click | hover | focus | blur | press | type | fill | select | scroll | wait | waitForSelector");
    console.log("");
    console.log("Action arguments:");
    console.log('  snapshot         { name: string }');
    console.log('  click | hover    { selector: string }');
    console.log('  focus | blur     { selector: string }');
    console.log('  press            { selector?: string, key: string }   // e.g. "Enter", "Escape", "Tab"');
    console.log('  type             { selector: string, text: string }   // appends text');
    console.log('  fill             { selector: string, value: string }  // replaces value');
    console.log('  select           { selector: string, value: string }  // <select>');
    console.log('  scroll           { selector?: string, x?: number, y?: number }');
    console.log('  wait             { ms: number }');
    console.log('  waitForSelector  { selector: string }');
    return askedForHelp ? 0 : 1;
  }
  const result = await runInteract({
    source: positional[0]!,
    sequencePath: sequence,
    outputDir: outputDir || join(options.cwd ?? process.cwd(), "test-results", "interact"),
    reportPath: report || undefined,
    threshold,
    healAll,
  });
  const selectorStepCount = (await readSequenceSteps(sequence)).filter(
    (s) => "selector" in s && s.selector,
  ).length;
  console.log(formatInteractReport(result, { sequencePath: sequence, healAll, selectorStepCount }));
  return 0;
}

/** Re-read for the `--heal-all` denominator only; `runInteract` owns the real parse. */
async function readSequenceSteps(sequencePath: string): Promise<SequenceAction[]> {
  try {
    const parsed = JSON.parse(await readFile(resolve(sequencePath), "utf-8")) as Sequence;
    return parsed.steps ?? [];
  } catch {
    return [];
  }
}

if (isCliEntry(import.meta.url, "interact")) {
  runInteractCli(process.argv.slice(2))
    .then((code) => { process.exitCode = code; })
    .catch(handleCliError);
}
