/**
 * Convert a `snapshot-report.json` into structured fix tasks + a markdown
 * prompt that a coding subagent can act on.
 *
 * Bridges `vrt snapshot` detection output and "fix the diff" agent runs.
 */
import { existsSync } from "node:fs";
import { basename, dirname, isAbsolute, join, relative, resolve } from "node:path";

export interface SnapshotReportResult {
  url: string;
  label: string;
  viewport: string;
  screenshotPath: string;
  baselinePath?: string;
  diffRatio?: number;
  isNew?: boolean;
  globalShift?: number;
  compensatedDiffRatio?: number;
  shiftOnly?: boolean;
}

export interface SnapshotReport {
  timestamp?: string;
  urls?: string[];
  labels?: string[];
  options?: Record<string, unknown>;
  results: SnapshotReportResult[];
}

export interface SnapshotFixTaskPaths {
  baseline: string;
  current: string;
  heatmap?: string;
  html?: string;
}

export interface SnapshotFixTask {
  label: string;
  viewport: string;
  url: string;
  diffRatio: number;
  compensatedDiffRatio?: number;
  globalShift?: number;
  shiftOnly: boolean;
  paths: SnapshotFixTaskPaths;
}

export interface ExtractFixTasksOptions {
  labels?: string[];
  minDiffRatio?: number;
  outputDir?: string;
}

function heatmapPathFor(label: string, viewport: string, outputDir: string): string {
  const testId = `${label}-${viewport}`;
  const safeName = testId.replace(/[/\\:]/g, "_");
  return join(outputDir, `${safeName}_heatmap.png`);
}

function htmlPathFor(label: string, outputDir: string): string {
  return join(outputDir, `${label}.html`);
}

function deriveBaselinePath(currentPath: string): string {
  if (currentPath.endsWith("-current.png")) {
    return currentPath.replace(/-current\.png$/u, "-baseline.png");
  }
  return currentPath;
}

export function extractSnapshotFixTasks(
  report: SnapshotReport,
  options: ExtractFixTasksOptions = {},
): SnapshotFixTask[] {
  const minDiffRatio = options.minDiffRatio ?? 0;
  const labelFilter = options.labels && options.labels.length > 0
    ? new Set(options.labels)
    : undefined;
  const outputDir = options.outputDir
    ? resolve(options.outputDir)
    : undefined;

  const tasks: SnapshotFixTask[] = [];
  for (const entry of report.results) {
    if (entry.isNew) continue;
    const ratio = entry.diffRatio ?? 0;
    if (ratio <= minDiffRatio) continue;
    if (labelFilter && !labelFilter.has(entry.label)) continue;

    const baselinePath = entry.baselinePath ?? deriveBaselinePath(entry.screenshotPath);
    const dir = outputDir ?? dirname(entry.screenshotPath);
    const heatmap = heatmapPathFor(entry.label, entry.viewport, dir);
    const html = htmlPathFor(entry.label, dir);

    tasks.push({
      label: entry.label,
      viewport: entry.viewport,
      url: entry.url,
      diffRatio: ratio,
      compensatedDiffRatio: entry.compensatedDiffRatio,
      globalShift: entry.globalShift,
      shiftOnly: entry.shiftOnly ?? false,
      paths: {
        baseline: baselinePath,
        current: entry.screenshotPath,
        heatmap: existsSync(heatmap) ? heatmap : undefined,
        html: existsSync(html) ? html : undefined,
      },
    });
  }

  tasks.sort((a, b) => b.diffRatio - a.diffRatio);
  return tasks;
}

export interface FormatPromptOptions {
  /** Base directory paths are made relative to. Falls back to cwd. */
  relativeTo?: string;
  /** Maximum number of tasks to include. */
  limit?: number;
  /** Extra hint shown before the per-task list. */
  intro?: string;
}

function relPath(absolute: string, base: string): string {
  if (!isAbsolute(absolute)) return absolute;
  const rel = relative(base, absolute);
  return rel.length === 0 ? basename(absolute) : rel;
}

function formatPct(ratio: number): string {
  return `${(ratio * 100).toFixed(2)}%`;
}

export function formatSnapshotFixPromptMarkdown(
  tasks: SnapshotFixTask[],
  options: FormatPromptOptions = {},
): string {
  const base = options.relativeTo ? resolve(options.relativeTo) : process.cwd();
  const limit = options.limit ?? tasks.length;
  const selected = tasks.slice(0, limit);

  const lines: string[] = [];
  lines.push("# VRT Snapshot Fix Tasks");
  lines.push("");
  lines.push(
    options.intro ??
      "The following routes regressed against their VRT baselines. " +
      "For each task, inspect the baseline / current / heatmap images, " +
      "identify the visual cause in the linked HTML, and propose a code " +
      "fix that closes the diff. Report the fix as a unified diff against " +
      "the source files responsible for the affected route.",
  );
  lines.push("");

  if (selected.length === 0) {
    lines.push("_No diffs above the configured threshold — nothing to fix._");
    lines.push("");
    return lines.join("\n");
  }

  lines.push(`Total regressed snapshots: ${tasks.length}` +
    (limit < tasks.length ? ` (showing top ${limit} by diff ratio)` : ""));
  lines.push("");

  for (const [index, task] of selected.entries()) {
    lines.push(`## ${index + 1}. ${task.label} — ${task.viewport} (${formatPct(task.diffRatio)})`);
    lines.push("");
    lines.push(`- URL: ${task.url}`);
    lines.push(`- Diff ratio: ${formatPct(task.diffRatio)} ` +
      `(${task.compensatedDiffRatio !== undefined ? `${formatPct(task.compensatedDiffRatio)} after shift compensation` : "no shift compensation"})`);
    if (task.globalShift !== undefined && task.globalShift !== 0) {
      lines.push(`- Global shift: ${task.globalShift > 0 ? "+" : ""}${task.globalShift}px` +
        (task.shiftOnly ? " (shift-only — likely layout reflow above the fold)" : ""));
    }
    lines.push(`- Baseline: \`${relPath(task.paths.baseline, base)}\``);
    lines.push(`- Current: \`${relPath(task.paths.current, base)}\``);
    if (task.paths.heatmap) {
      lines.push(`- Heatmap: \`${relPath(task.paths.heatmap, base)}\``);
    }
    if (task.paths.html) {
      lines.push(`- Captured HTML: \`${relPath(task.paths.html, base)}\``);
    }
    lines.push("");
  }

  lines.push("## Next Steps");
  lines.push("");
  lines.push("1. Open each pair of baseline/current images to confirm the visual regression.");
  lines.push("2. If a heatmap is present, use it to localize the diff region.");
  lines.push("3. Map the affected DOM (from the captured HTML) back to source files.");
  lines.push("4. Propose a minimal CSS or markup change and re-run `vrt snapshot` to verify.");
  lines.push("5. Once green, run `vrt snapshot approve --label <label>` to promote the new baseline if the visual change is intentional.");
  lines.push("");

  return lines.join("\n");
}

export function formatSnapshotFixPromptJson(tasks: SnapshotFixTask[]): string {
  return JSON.stringify({ tasks }, null, 2);
}
