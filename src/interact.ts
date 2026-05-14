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
import { compareScreenshots } from "./heatmap.ts";
import { findHeatmapRegionsFromFile, type HeatmapRegion } from "./heatmap-regions.ts";
import type { VrtSnapshot } from "./types.ts";
import { DIM, RESET, GREEN, RED, YELLOW, BOLD, CYAN } from "./terminal-colors.ts";

export type SequenceAction =
  | { action: "snapshot"; name: string }
  | { action: "click"; selector: string }
  | { action: "hover"; selector: string }
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

export interface InteractReport {
  source: string;
  viewport: { width: number; height: number };
  snapshots: SnapshotEntry[];
  transitions: TransitionDelta[];
  reportPath: string;
}

function parseArgs(argv: string[]) {
  let sequence = "";
  let outputDir = "";
  let report = "";
  let threshold = 0.03;
  const positional: string[] = [];
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--sequence") sequence = argv[++i];
    else if (a === "--output-dir") outputDir = argv[++i];
    else if (a === "--report") report = argv[++i];
    else if (a === "--threshold") threshold = parseFloat(argv[++i] ?? "0.03");
    else positional.push(a);
  }
  return { positional, sequence, outputDir, report, threshold };
}

function isUrl(s: string): boolean { return /^https?:\/\//.test(s); }

function summarizeAction(a: SequenceAction): string {
  switch (a.action) {
    case "snapshot": return `snapshot "${a.name}"`;
    case "click": return `click \`${a.selector}\``;
    case "hover": return `hover \`${a.selector}\``;
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

    for (const step of sequence.steps) {
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
        try {
          await executeStep(page, step);
        } catch (error) {
          console.log(`  ${YELLOW}step failed (${summarizeAction(step)}): ${String(error)}${RESET}`);
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
  console.log(`  ${DIM}report: ${reportPath}${RESET}`);

  return { source: options.source, viewport, snapshots, transitions, reportPath };
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
    lines.push("| From → To | Actions | Pixel diff | Region count |");
    lines.push("|---|---|---|---|");
    for (const t of r.transitions) {
      const acts = t.actions.length === 0
        ? "_(nothing)_"
        : t.actions.map((a) => `\`${summarizeAction(a).replace(/\|/g, "\\|")}\``).join("<br>");
      lines.push(`| **${t.from}** → **${t.to}** | ${acts} | ${(t.diffRatio * 100).toFixed(2)}% (${t.diffPixels} px) | ${t.heatmapRegions.length} |`);
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
  const { positional, sequence, outputDir, report, threshold } = parseArgs(argv);
  if (positional.length === 0 || !sequence) {
    console.log("Usage: vrt interact <html-or-url> --sequence <path.json> [options]");
    console.log("Options:");
    console.log("  --sequence <path>   JSON file describing the action sequence.");
    console.log("  --output-dir <dir>  Default: ./test-results/interact");
    console.log("  --report <path>     Markdown report path");
    console.log("  --threshold <0..1>  Pixel diff threshold (default: 0.03)");
    console.log("");
    console.log("Sequence schema:");
    console.log('  { "viewport": { "width": 1280, "height": 720 },');
    console.log('    "steps": [');
    console.log('      { "action": "snapshot", "name": "default" },');
    console.log('      { "action": "click", "selector": ".btn" },');
    console.log('      { "action": "snapshot", "name": "after-click" } ] }');
    console.log("");
    console.log("Actions: snapshot | click | hover | type | fill | select | scroll | wait | waitForSelector");
    process.exit(1);
  }
  await runInteract({
    source: positional[0]!,
    sequencePath: sequence,
    outputDir: outputDir || join(process.cwd(), "test-results", "interact"),
    reportPath: report || undefined,
    threshold,
  });
}

const isCliEntry = process.argv[1] ? resolve(process.argv[1]) === fileURLToPath(import.meta.url) : false;
if (isCliEntry) {
  main().catch((e) => { console.error(e); process.exit(1); });
}
