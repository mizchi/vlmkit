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
 *   vrt interact <html-or-url> --sequence <path-to-sequence.json>
 */
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { basename, dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium, type Page } from "playwright";
import { compareScreenshots } from "@mizchi/vrt-core/heatmap.ts";
import { findHeatmapRegionsFromFile, type HeatmapRegion } from "@mizchi/vrt-core/heatmap-regions.ts";
import { healSelector } from "../heal/selector-heal.ts";
import type { VrtSnapshot } from "@mizchi/vrt-core/types.ts";
import { handleCliError } from "@mizchi/vrt-core/cli-error.ts";
import { DIM, RESET, GREEN, RED, YELLOW, BOLD, CYAN } from "@mizchi/vrt-core/terminal-colors.ts";

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

export interface InteractReport {
  source: string;
  viewport: { width: number; height: number };
  snapshots: SnapshotEntry[];
  transitions: TransitionDelta[];
  reportPath: string;
  healAllFindings?: HealAllFinding[];
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

  const browser = await chromium.launch();
  const snapshots: SnapshotEntry[] = [];
  const healAllFindings: HealAllFinding[] = [];
  let pendingActions: SequenceAction[] = [];
  try {
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
          console.log(`  ${YELLOW}step failed (${summarizeAction(step)}): ${msg.split("\n")[0]}${RESET}`);
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
                console.log(`    ${DIM}suggestions for \`${failedSelector}\`:${RESET}`);
                for (const c of candidates) {
                  console.log(`      ${DIM}${(c.confidence * 100).toFixed(0).padStart(3)}%  \`${c.selector}\`  ${c.text ? `"${c.text}"` : ""}${RESET}`);
                }
              }
            } catch { /* healer failure is non-fatal */ }
          }
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
            // Tiering: 0.3+ is "did you mean" (strong, actionable);
            // 0.1-0.3 is "weak match" (sibling-button-style overlap
            // that's worth eyeballing but not an obvious typo).
            // Dogfood (2026-05-15) flagged 13% as noise when labelled
            // "did you mean", hence the split. Healer's internal
            // floor stays at 0.05; we ignore the 0.05-0.1 band here.
            const top = candidates[0];
            if (top && top.confidence >= 0.1) {
              const tier: "strong" | "weak" = top.confidence >= 0.3 ? "strong" : "weak";
              healAllFindings.push({
                stepIndex,
                action: step,
                originalSelector: successSelector,
                tier,
                suggestion: { selector: top.selector, confidence: top.confidence, text: top.text },
              });
              const label = tier === "strong" ? `${YELLOW}did you mean${RESET}` : `${DIM}weak match${RESET}`;
              console.log(`    ${label} ${DIM}\`${top.selector}\`${RESET} ${DIM}(${(top.confidence * 100).toFixed(0)}% confidence${top.text ? `, "${top.text}"` : ""})${RESET}`);
            }
          } catch { /* healer failure is non-fatal */ }
        }
        pendingActions.push(step);
      }
    }
    await page.close();
  } finally {
    await browser.close();
  }

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
    healAllFindings: options.healAll ? healAllFindings : undefined,
  });
  await writeFile(reportPath, md);

  console.log(`  ${BOLD}${CYAN}vrt interact${RESET}`);
  console.log(`  ${DIM}source: ${options.source}  sequence: ${options.sequencePath}${RESET}`);
  console.log(`  ${DIM}captured ${snapshots.length} snapshot(s), ${transitions.length} transition(s)${RESET}`);
  for (const t of transitions) {
    const pct = (t.diffRatio * 100).toFixed(2);
    const icon = t.diffRatio === 0 ? `${YELLOW}~${RESET}` : `${GREEN}✓${RESET}`;
    const summary = t.actions.map(summarizeAction).join(", ");
    console.log(`  ${icon} ${t.from} → ${t.to}  ${pct.padStart(6)}%  ${DIM}${summary}${RESET}`);
  }
  if (options.healAll) {
    const strongCount = healAllFindings.filter((f) => f.tier === "strong").length;
    const weakCount = healAllFindings.length - strongCount;
    const selectorStepCount = sequence.steps.filter((s) => "selector" in s && s.selector).length;
    console.log(`  ${DIM}heal-all: ${strongCount} strong + ${weakCount} weak suggestion(s) across ${selectorStepCount} selector step(s)${RESET}`);
  }
  console.log(`  ${DIM}report: ${reportPath}${RESET}`);

  return {
    source: options.source,
    viewport,
    snapshots,
    transitions,
    reportPath,
    healAllFindings: options.healAll ? healAllFindings : undefined,
  };
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

async function main(argv = process.argv.slice(2)) {
  if (argv[0] === "--help" || argv[0] === "-h") argv = [];
  const { positional, sequence, outputDir, report, threshold, healAll } = parseArgs(argv);
  if (positional.length === 0 || !sequence) {
    console.log("Usage: vrt interact <html-or-url> --sequence <path.json> [options]");
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
    process.exit(1);
  }
  await runInteract({
    source: positional[0]!,
    sequencePath: sequence,
    outputDir: outputDir || join(process.cwd(), "test-results", "interact"),
    reportPath: report || undefined,
    threshold,
    healAll,
  });
}

const isCliEntry = process.argv[1] ? resolve(process.argv[1]) === fileURLToPath(import.meta.url) : false;
if (isCliEntry) {
  main().catch(handleCliError);
}
