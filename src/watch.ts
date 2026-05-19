#!/usr/bin/env node
/**
 * `vrt watch` — dev inner-loop wrapper around `vrt compare`.
 *
 * Watches the variant file (and the dir of its referenced
 * stylesheets), re-runs the compare on every save, and surfaces a
 * **round-vs-round delta** alongside the usual golden-vs-current diff
 * so an agent / developer can see whether their last edit moved the
 * loop forward or regressed something.
 *
 * The four signals emitted between runs:
 *   - per-viewport diff% delta              (golden-vs-variant change)
 *   - wireframe suggestions resolved        (vanished since last run)
 *   - wireframe suggestions persisted       (still there)
 *   - wireframe suggestions newly introduced (showed up after edit)
 *
 * The last one is the most-valuable signal: it tells you that your
 * last edit broke something you didn't intend to.
 */

import { watch as fsWatch } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { runMigrationCompare, parseMigrationCompareArgs, type MigrationCompareReport } from "./experiments/migration/migration-compare.ts";
import {
  BOLD,
  CYAN,
  DIM,
  GREEN,
  RED,
  RESET,
  YELLOW,
} from "@mizchi/vrt-core/terminal-colors.ts";
import type { WireframeFixSuggestion } from "./experiments/migration/wireframe-fix-candidates.ts";

const DEBOUNCE_MS = 150;
const WATCH_OUTPUT_DIR_DEFAULT = ".vrt/runs";

export interface RoundSummary {
  timestamp: string;
  diffByViewport: Record<string, number>;
  suggestions: WireframeFixSuggestion[];
  reportPath?: string;
}

/**
 * Build a stable key for a wireframe suggestion so we can pair across
 * runs. Includes scope so a row that flipped between "subset" and
 * "divergent" isn't silently treated as the same row.
 */
function suggestionKey(s: WireframeFixSuggestion): string {
  // Strip the per-run numeric magnitude — it shifts as the variant
  // converges, so we shouldn't treat "Δ +12 on mobile" and "Δ +8 on
  // mobile" as different rows. Bucket to nearest 4px.
  const mag = Math.round(s.deltaPx / 4) * 4;
  return `${s.scope}|${Math.sign(s.deltaPx)}:${mag}|${[...s.viewports].sort().join(",")}|${s.evidence.split(":")[0]}`;
}

export interface WatchRunDelta {
  diffDelta: Record<string, { prev: number; curr: number; delta: number }>;
  resolved: WireframeFixSuggestion[];
  persisted: WireframeFixSuggestion[];
  newlyIntroduced: WireframeFixSuggestion[];
  /**
   * Component-level sign flips: a suggestion's prefix (e.g.
   * "component rank=0 (bbox 343×112)") appeared with one sign in
   * prev and the opposite sign in curr. Signals the last edit
   * overshot zero — the agent should damp, not push further.
   */
  zeroCrossings: ZeroCrossing[];
}

export interface ZeroCrossing {
  /** Component-identity prefix (e.g. "component rank=0 (bbox 343×112)"). */
  componentPrefix: string;
  prev: { deltaPx: number; viewports: string[] };
  curr: { deltaPx: number; viewports: string[] };
  /** Suggested damping: half the prev magnitude, sign of curr. */
  dampedTargetPx: number;
  message: string;
}

const SIGNIFICANT_MAGNITUDE = 6;

export function detectZeroCrossings(prev: RoundSummary, curr: RoundSummary): ZeroCrossing[] {
  // Index suggestions by component-identity prefix (everything before
  // the first colon in `evidence`). Bbox suggestions encode rank +
  // bbox dims there, which is stable across rounds; text-row prefixes
  // don't carry component identity so they're skipped.
  const indexByPrefix = (sugs: WireframeFixSuggestion[]) => {
    const out = new Map<string, WireframeFixSuggestion>();
    for (const s of sugs) {
      const prefix = s.evidence.split(":")[0].trim();
      // Only track bbox-rank-keyed suggestions (skip text-rows).
      if (!prefix.startsWith("component rank=")) continue;
      // Keep the last entry with this prefix; in practice the
      // generator emits exactly one row per component identity in a
      // run.
      out.set(prefix, s);
    }
    return out;
  };
  const prevMap = indexByPrefix(prev.suggestions);
  const currMap = indexByPrefix(curr.suggestions);

  const out: ZeroCrossing[] = [];
  for (const [prefix, prevSug] of prevMap) {
    const currSug = currMap.get(prefix);
    if (!currSug) continue;
    const ps = Math.sign(prevSug.deltaPx);
    const cs = Math.sign(currSug.deltaPx);
    if (ps === 0 || cs === 0 || ps === cs) continue;
    if (Math.abs(prevSug.deltaPx) < SIGNIFICANT_MAGNITUDE) continue;
    if (Math.abs(currSug.deltaPx) < SIGNIFICANT_MAGNITUDE) continue;
    const damped = Math.round((prevSug.deltaPx / 2) * -1); // toward middle
    const direction = cs > 0 ? "added too much" : "removed too much";
    out.push({
      componentPrefix: prefix,
      prev: {
        deltaPx: prevSug.deltaPx,
        viewports: [...prevSug.viewports],
      },
      curr: {
        deltaPx: currSug.deltaPx,
        viewports: [...currSug.viewports],
      },
      dampedTargetPx: damped,
      message: `${prefix} flipped sign (${prevSug.deltaPx >= 0 ? "+" : ""}${prevSug.deltaPx}px → ${currSug.deltaPx >= 0 ? "+" : ""}${currSug.deltaPx}px). Your last edit ${direction}; try damping ~50% (next edit ≈ ${damped >= 0 ? "+" : ""}${damped}px).`,
    });
  }
  return out;
}

export function diffWatchRuns(prev: RoundSummary | null, curr: RoundSummary): WatchRunDelta {
  const diffDelta: WatchRunDelta["diffDelta"] = {};
  for (const [vp, ratio] of Object.entries(curr.diffByViewport)) {
    const prevRatio = prev?.diffByViewport[vp] ?? ratio;
    diffDelta[vp] = { prev: prevRatio, curr: ratio, delta: ratio - prevRatio };
  }

  if (!prev) {
    return {
      diffDelta,
      resolved: [],
      persisted: [],
      newlyIntroduced: curr.suggestions,
      zeroCrossings: [],
    };
  }

  const prevKeys = new Map(prev.suggestions.map((s) => [suggestionKey(s), s]));
  const currKeys = new Map(curr.suggestions.map((s) => [suggestionKey(s), s]));
  const resolved: WireframeFixSuggestion[] = [];
  const persisted: WireframeFixSuggestion[] = [];
  const newlyIntroduced: WireframeFixSuggestion[] = [];
  for (const [k, s] of prevKeys) {
    if (!currKeys.has(k)) resolved.push(s);
    else persisted.push(currKeys.get(k)!);
  }
  for (const [k, s] of currKeys) {
    if (!prevKeys.has(k)) newlyIntroduced.push(s);
  }
  const zeroCrossings = detectZeroCrossings(prev, curr);
  return { diffDelta, resolved, persisted, newlyIntroduced, zeroCrossings };
}

export function summarizeReport(report: MigrationCompareReport): RoundSummary {
  const diffByViewport: Record<string, number> = {};
  for (const r of report.results) {
    diffByViewport[r.viewport] = r.diffRatio;
  }
  // The compare layer carries wireframe suggestions only in the
  // per-variant terminal output, not in the JSON. The watcher
  // re-renders the same data path; we capture the suggestions via a
  // separate field added below.
  return {
    timestamp: new Date().toISOString(),
    diffByViewport,
    suggestions: (report as MigrationCompareReport & {
      wireframeFixSuggestions?: Array<{ variantFile: string; suggestions: WireframeFixSuggestion[] }>;
    }).wireframeFixSuggestions?.[0]?.suggestions ?? [],
    reportPath: report.reportPath,
  };
}

export function formatWatchDelta(delta: WatchRunDelta, isFirst: boolean): string {
  const lines: string[] = [];
  lines.push("");
  lines.push(`${BOLD}${CYAN}Round delta${RESET}${isFirst ? `  ${DIM}(first run)${RESET}` : ""}`);
  for (const [vp, d] of Object.entries(delta.diffDelta)) {
    const arrow = d.delta < -0.0005 ? `${GREEN}↓${RESET}` : d.delta > 0.0005 ? `${RED}↑${RESET}` : `${DIM}=${RESET}`;
    const pct = (n: number) => `${(n * 100).toFixed(2)}%`;
    const deltaPct = (n: number) => `${n >= 0 ? "+" : ""}${(n * 100).toFixed(2)}pp`;
    lines.push(`  ${vp.padEnd(8)} ${pct(d.curr).padStart(7)} ${arrow} ${DIM}${pct(d.prev)} (${deltaPct(d.delta)})${RESET}`);
  }
  if (delta.zeroCrossings.length > 0) {
    lines.push("");
    lines.push(`  ${RED}${BOLD}zero-crossing${RESET} ${DIM}(your last edit overshot — damp before pushing further)${RESET}`);
    for (const z of delta.zeroCrossings.slice(0, 3)) {
      lines.push(`    ${RED}~${RESET} ${z.message}`);
    }
  }
  if (delta.newlyIntroduced.length > 0) {
    lines.push("");
    lines.push(`  ${RED}${BOLD}newly introduced${RESET} ${DIM}(your last edit produced these — likely regressed something)${RESET}`);
    for (const s of delta.newlyIntroduced.slice(0, 5)) {
      lines.push(`    ${RED}+${RESET} [${s.confidence}] ${s.evidence}`);
    }
  }
  if (delta.resolved.length > 0) {
    lines.push("");
    lines.push(`  ${GREEN}${BOLD}resolved${RESET} ${DIM}(${delta.resolved.length} suggestion(s) cleared by your last edit)${RESET}`);
    for (const s of delta.resolved.slice(0, 5)) {
      lines.push(`    ${GREEN}-${RESET} [${s.confidence}] ${s.evidence}`);
    }
  }
  if (delta.persisted.length > 0) {
    lines.push("");
    lines.push(`  ${DIM}persisted (${delta.persisted.length} unchanged)${RESET}`);
  }
  if (delta.newlyIntroduced.length === 0 && delta.resolved.length === 0 && delta.persisted.length === 0) {
    lines.push(`  ${GREEN}clean — no wireframe suggestions outstanding${RESET}`);
  }
  return lines.join("\n");
}

interface WatchOptions {
  args: string[];
  watchPath: string;
  outputDir: string;
  variant: string;
  baseline: string;
}

function parseWatchArgs(rawArgs: string[]): { compareArgs: string[]; watchPathOverride?: string } {
  // Strip our own flags before delegating the rest to parseMigrationCompareArgs.
  const out: string[] = [];
  let watchPath: string | undefined;
  for (let i = 0; i < rawArgs.length; i++) {
    if (rawArgs[i] === "--watch-path" && i + 1 < rawArgs.length) {
      watchPath = rawArgs[i + 1];
      i++;
    } else {
      out.push(rawArgs[i]);
    }
  }
  return { compareArgs: out, watchPathOverride: watchPath };
}

async function runOnce(compareArgs: string[], outputDir: string): Promise<RoundSummary | null> {
  // Force the output dir to per-run isolation so we don't clobber
  // the previous round's report. The watcher itself manages cleanup.
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const runDir = resolve(outputDir, stamp);
  await mkdir(runDir, { recursive: true });

  // Inject --output if the caller didn't pass one (or override theirs).
  const filtered: string[] = [];
  for (let i = 0; i < compareArgs.length; i++) {
    if (compareArgs[i] === "--output" || compareArgs[i] === "--output-dir") { i++; continue; }
    filtered.push(compareArgs[i]);
  }
  const args = [...filtered, "--output-dir", runDir];

  const options = parseMigrationCompareArgs(args);
  try {
    const report = await runMigrationCompare(options);
    return summarizeReport(report);
  } catch (err) {
    console.error(`${RED}compare error:${RESET} ${String(err)}`);
    return null;
  }
}

export async function runWatch(rawArgs: string[]): Promise<void> {
  const { compareArgs, watchPathOverride } = parseWatchArgs(rawArgs);
  if (compareArgs.length < 2) {
    console.error("Usage: vrt watch <baseline> <variant> [vrt compare flags...]");
    console.error("       (or --url + --current-url for URL mode)");
    process.exit(1);
  }
  const baseline = compareArgs[0];
  const variant = compareArgs[1];

  const outputDir = resolve(WATCH_OUTPUT_DIR_DEFAULT);
  await mkdir(outputDir, { recursive: true });

  // Pick what to watch. By default: the variant file + its parent dir
  // (so referenced stylesheets in the same dir are picked up). Caller
  // can override with --watch-path.
  const watchPath = watchPathOverride
    ? resolve(watchPathOverride)
    : dirname(resolve(variant));

  console.log(`${BOLD}${CYAN}vrt watch${RESET}`);
  console.log(`  ${DIM}baseline${RESET} ${baseline}`);
  console.log(`  ${DIM}variant ${RESET} ${variant}`);
  console.log(`  ${DIM}watching${RESET} ${watchPath}`);
  console.log(`  ${DIM}runs    ${RESET} ${outputDir}`);
  console.log(`  ${DIM}(Ctrl-C to exit)${RESET}`);
  console.log();

  let prev: RoundSummary | null = null;
  let running = false;
  let queued = false;
  let debounce: NodeJS.Timeout | null = null;

  const trigger = async () => {
    if (running) { queued = true; return; }
    running = true;
    try {
      console.log(`${DIM}[${new Date().toISOString().slice(11, 19)}] running compare…${RESET}`);
      const curr = await runOnce(compareArgs, outputDir);
      if (curr) {
        const delta = diffWatchRuns(prev, curr);
        const msg = formatWatchDelta(delta, prev === null);
        console.log(msg);
        await writeFile(resolve(outputDir, "latest-delta.md"), stripAnsi(msg) + "\n");
        prev = curr;
      }
    } finally {
      running = false;
      if (queued) { queued = false; setImmediate(trigger); }
    }
  };

  // Initial run.
  await trigger();

  const watcher = fsWatch(watchPath, { recursive: true }, (_event, filename) => {
    if (!filename) return;
    if (filename.endsWith("~") || filename.startsWith(".")) return;
    if (debounce) clearTimeout(debounce);
    debounce = setTimeout(trigger, DEBOUNCE_MS);
  });

  process.on("SIGINT", () => {
    watcher.close();
    console.log(`\n${DIM}stopping watch${RESET}`);
    process.exit(0);
  });

  // Keep the event loop alive forever.
  await new Promise<void>(() => {});
}

function stripAnsi(s: string): string {
  // Strip standard CSI / OSC sequences so the markdown file is clean.
  // eslint-disable-next-line no-control-regex
  return s.replace(/\x1b\[[0-9;]*m/g, "");
}

const isCliEntry = process.env.__VRT_DISPATCHER_LEAF__ === "watch" || (process.argv[1]
  && new URL(import.meta.url).pathname === process.argv[1]);
if (isCliEntry) {
  runWatch(process.argv.slice(2)).catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
