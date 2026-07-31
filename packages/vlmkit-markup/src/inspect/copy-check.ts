#!/usr/bin/env node
/**
 * Copy fidelity gate.
 *
 * "Placeholder text is a bug" is a ground rule of the markup skills, but it
 * had no detector — text truth lived only in the target pixels and the
 * verifier's eyes. This closes it with two checks:
 *
 *   1. Placeholder scan (always on): lorem-ipsum and template-filler
 *      phrases in the rendered page text are suspects.
 *   2. Manifest check (opt-in, `--manifest copy.md`): every non-empty
 *      line of the manifest must appear in the rendered text. The
 *      manifest is the copy twin of the motion brief — a small text
 *      carrier for truth a screenshot can't transport reliably (exact
 *      spellings, punctuation, casing).
 *   3. Target-image check (opt-in, `--target target.png`): each rendered
 *      text block's bbox is cropped out of the target image and stacked
 *      into contact sheets. Without an API key the sheets + a worksheet
 *      go to `--out` for the agent's own vision to review; with `--vlm`
 *      a VLM transcribes each crop and mismatches become suspects.
 *      This is the gate for copy truth that exists ONLY in pixels (no
 *      manifest, no reference page) — the S9 class of bug.
 *
 * Disclosure-state sweep (default on, `--no-states` to skip): before
 * matching, closed `<details>` are opened and unselected `[role=tab]` /
 * `[aria-expanded=false]` controls are clicked, capturing the text each
 * state reveals. Manifest lines found only in a revealed state PASS
 * (with provenance) instead of reading as missing. Without this the
 * gate only saw default-state text, which incentivized agents to ship
 * disclosures open-by-default just to satisfy the manifest (observed in
 * the S14a creative run). Placeholder text hiding in a closed panel is
 * still a suspect. The target-image check always uses the default state
 * (the screenshot is of the default state).
 *
 * Whitespace is normalized on both sides; comparison is case-sensitive
 * (casing is spec in copy). Checks 1-2 are deterministic; check 3 uses
 * vision only for READING — every coordinate is DOM/pixel math.
 *
 * CLI:
 *   vlmkit check copy <html-or-url> [--manifest <file>] [--target <png>] [--vlm [model]] [--no-states] [--json]
 */
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { PNG } from "pngjs";
import {
  buildContactSheets,
  COLLECT_TEXT_BLOCKS,
  compareTranscript,
  cropRegion,
  formatCopyWorksheet,
  TRANSCRIBE_PROMPT,
  type TextBlock,
} from "./copy-target.ts";
import { handleCliError } from "@mizchi/vlmkit-core/cli-error.ts";
import { appendRunLedger } from "@mizchi/vlmkit-core/run-ledger.ts";
import { BOLD, CYAN, DIM, GREEN, RED, RESET, YELLOW } from "@mizchi/vlmkit-core/terminal-colors.ts";

export type CopyIssueKind = "placeholder-text" | "copy-missing" | "copy-image-mismatch";

export interface CopyIssue {
  kind: CopyIssueKind;
  severity: "warn" | "suspect";
  message: string;
}

export interface CopyImageReview {
  /** Text blocks found in the attempt render, reading order. */
  blocks: number;
  /** Contact-sheet files written under `outDir`. */
  sheetFiles: string[];
  worksheetPath: string;
  /** "vlm" when transcription ran automatically, "agent" otherwise. */
  reviewedBy: "vlm" | "agent";
  /** VLM path only: rows whose transcription differs from the DOM text. */
  mismatches: { text: string; read: string; y: number }[];
  /** Blocks dropped by the row cap, if any (never capped silently). */
  droppedBlocks: number;
}

/** Text captured after one disclosure-reveal action. */
export interface StateText {
  kind: "details" | "tab" | "expand";
  /** Human-readable handle, e.g. `details "Shipping & returns"`. */
  label: string;
  /** Full body innerText while this state is active. */
  text: string;
}

export interface StateSweep {
  states: StateText[];
  /** Reveal actions found beyond the action cap (never capped silently). */
  droppedActions: number;
}

export interface CopyCheckReport {
  source: string;
  textLength: number;
  manifestLines: number;
  missingLines: string[];
  /** Manifest lines satisfied only by a revealed disclosure state. */
  revealedLines: { line: string; state: string }[];
  /** Disclosure states explored (0 = nothing to reveal or sweep disabled). */
  statesExplored: number;
  droppedStates: number;
  placeholders: string[];
  imageReview?: CopyImageReview;
  issues: CopyIssue[];
}

const PLACEHOLDER_PATTERNS: { pattern: RegExp; label: string }[] = [
  { pattern: /lorem ipsum/i, label: "lorem ipsum" },
  { pattern: /dolor sit amet/i, label: "dolor sit amet" },
  { pattern: /placeholder/i, label: "placeholder" },
  { pattern: /\bTODO\b/, label: "TODO" },
  { pattern: /\bTBD\b/, label: "TBD" },
  { pattern: /\bFIXME\b/, label: "FIXME" },
  { pattern: /your (?:text|copy|content|title|heading) here/i, label: "your ... here" },
  { pattern: /insert .{0,20}(?:text|copy|content) /i, label: "insert ... text" },
];

export function normalizeWhitespace(text: string): string {
  return text.replace(/\s+/g, " ").trim();
}

/**
 * Manifest lines: non-empty lines with markdown list/heading markers
 * stripped. Comment lines (starting with `#` followed by a space… no —
 * headings use that) are kept as content once the marker is removed.
 */
export function parseCopyManifest(raw: string): string[] {
  return raw
    .split("\n")
    .map((line) => line.replace(/^\s*(?:[-*+]\s+|#{1,6}\s+|\d+\.\s+)/, "").trim())
    .filter((line) => line.length > 0);
}

/** Reveal actions beyond this are dropped from the sweep (and counted, loudly). */
const MAX_STATE_ACTIONS = 30;

/**
 * In-page disclosure-state sweep. Opens closed `<details>` (pure DOM
 * property, cumulative), then clicks unselected `[role=tab]`s and
 * `[aria-expanded=false]` controls (page JS decides what appears), and
 * captures `body.innerText` after each action. innerText only reports
 * laid-out text, so each capture is exactly "what a user in this state
 * can read." Serialized for page.evaluate.
 */
export const COLLECT_STATE_TEXTS = `(() => {
  const MAX = ${MAX_STATE_ACTIONS};
  const short = (el) => {
    const t = ((el && (el.innerText || el.textContent)) || "").replace(/\\s+/g, " ").trim();
    return t.length > 60 ? t.slice(0, 57) + "…" : t;
  };
  const actions = [];
  for (const d of document.querySelectorAll("details:not([open])")) {
    actions.push({ kind: "details", el: d, label: 'details "' + short(d.querySelector("summary")) + '"' });
  }
  for (const t of document.querySelectorAll('[role="tab"]')) {
    if (t.getAttribute("aria-selected") !== "true") {
      actions.push({ kind: "tab", el: t, label: 'tab "' + short(t) + '"' });
    }
  }
  for (const c of document.querySelectorAll('[aria-expanded="false"]')) {
    actions.push({ kind: "expand", el: c, label: c.tagName.toLowerCase() + '[aria-expanded] "' + short(c) + '"' });
  }
  const seen = new Set();
  const states = [];
  let dropped = 0;
  for (const a of actions) {
    if (seen.has(a.el)) continue;
    seen.add(a.el);
    if (states.length >= MAX) { dropped++; continue; }
    try {
      if (a.kind === "details") a.el.open = true;
      else a.el.click();
    } catch { continue; }
    states.push({ kind: a.kind, label: a.label, text: document.body ? document.body.innerText : "" });
  }
  return { states, droppedActions: dropped };
})()`;

export function analyzeCopy(input: {
  source: string;
  pageText: string;
  manifestLines?: string[];
  stateSweep?: StateSweep;
}): CopyCheckReport {
  const normalized = normalizeWhitespace(input.pageText);
  const states = (input.stateSweep?.states ?? []).map((s) => ({
    ...s,
    normalized: normalizeWhitespace(s.text),
  }));
  const issues: CopyIssue[] = [];

  const placeholders: string[] = [];
  for (const { pattern, label } of PLACEHOLDER_PATTERNS) {
    const m = normalized.match(pattern);
    if (m) {
      placeholders.push(label);
      const at = Math.max(0, m.index! - 30);
      issues.push({
        kind: "placeholder-text",
        severity: "suspect",
        message: `Placeholder "${label}" found in rendered text: "…${normalized.slice(at, m.index! + m[0].length + 30)}…" — replace with the real copy from the target.`,
      });
      continue;
    }
    const hidden = states.find((s) => pattern.test(s.normalized));
    if (hidden) {
      placeholders.push(label);
      issues.push({
        kind: "placeholder-text",
        severity: "suspect",
        message: `Placeholder "${label}" found in text revealed by ${hidden.label} — hidden placeholder copy is still a bug.`,
      });
    }
  }

  const manifestLines = input.manifestLines ?? [];
  const missingLines: string[] = [];
  const revealedLines: { line: string; state: string }[] = [];
  for (const line of manifestLines) {
    const needle = normalizeWhitespace(line);
    if (normalized.includes(needle)) continue;
    const state = states.find((s) => s.normalized.includes(needle));
    if (state) {
      revealedLines.push({ line, state: state.label });
      continue;
    }
    missingLines.push(line);
    const scope = states.length > 0
      ? `rendered text or any of ${states.length} revealed disclosure state(s)`
      : "rendered text";
    issues.push({
      kind: "copy-missing",
      severity: "suspect",
      message: `Manifest line not found in ${scope}: "${line}" (comparison is whitespace-normalized, case-sensitive).`,
    });
  }

  return {
    source: input.source,
    textLength: normalized.length,
    manifestLines: manifestLines.length,
    missingLines,
    revealedLines,
    statesExplored: states.length,
    droppedStates: input.stateSweep?.droppedActions ?? 0,
    placeholders,
    issues,
  };
}

export interface CopyCheckOptions {
  source: string;
  html?: string;
  manifestPath?: string;
  viewport?: { width: number; height: number };
  /** Target screenshot for the image-side check. */
  targetPath?: string;
  /** Where sheets + worksheet go. Default: `.vlmkit/copy-review/`. */
  outDir?: string;
  /**
   * Transcribe one crop (PNG buffer) to text. Wired to a VLM by the
   * CLI's `--vlm`; injectable for tests. Absent = keyless agent mode.
   */
  readTargetText?: (cropPng: Buffer) => Promise<string>;
  /** Disclosure-state sweep before matching. Default true (`--no-states`). */
  exploreStates?: boolean;
}

function isUrl(source: string): boolean {
  return /^(https?|file):\/\//.test(source);
}

/** Rows beyond this are dropped from the sheets (and counted, loudly). */
const MAX_REVIEW_ROWS = 80;

export async function runCopyCheck(options: CopyCheckOptions): Promise<CopyCheckReport> {
  const target = options.targetPath
    ? PNG.sync.read(await readFile(options.targetPath) as Buffer)
    : undefined;
  const viewport = options.viewport ??
    (target
      ? { width: target.width, height: Math.min(target.height, 4000) }
      : { width: 1280, height: 720 });

  const { chromium } = await import("playwright");
  const browser = await chromium.launch();
  let pageText: string;
  let blocks: TextBlock[] = [];
  let stateSweep: StateSweep | undefined;
  try {
    const page = await browser.newPage({ viewport });
    if (options.html !== undefined) {
      await page.setContent(options.html, { waitUntil: "networkidle" });
    } else if (isUrl(options.source)) {
      await page.goto(options.source, { waitUntil: "networkidle", timeout: 30000 });
    } else {
      await page.goto(pathToFileURL(resolve(options.source)).href, { waitUntil: "networkidle", timeout: 30000 });
    }
    pageText = await page.evaluate("document.body ? document.body.innerText : \"\"") as string;
    if (target) {
      blocks = (await page.evaluate(COLLECT_TEXT_BLOCKS) as TextBlock[])
        .filter((b) => b.y < target.height && b.x < target.width);
    }
    if (options.exploreStates !== false) {
      stateSweep = await page.evaluate(COLLECT_STATE_TEXTS) as StateSweep;
    }
    await page.close();
  } finally {
    await browser.close();
  }

  const manifestLines = options.manifestPath
    ? parseCopyManifest(await readFile(options.manifestPath, "utf8"))
    : undefined;
  const report = analyzeCopy({
    source: options.source,
    pageText,
    ...(manifestLines ? { manifestLines } : {}),
    ...(stateSweep ? { stateSweep } : {}),
  });

  if (target && options.targetPath) {
    const droppedBlocks = Math.max(0, blocks.length - MAX_REVIEW_ROWS);
    const kept = blocks.slice(0, MAX_REVIEW_ROWS);
    const outDir = options.outDir ?? join(dirname(resolve(options.source)), ".vlmkit-copy-review");
    await mkdir(outDir, { recursive: true });

    const mismatches: { text: string; read: string; y: number }[] = [];
    let reviewedBy: "vlm" | "agent" = "agent";
    if (options.readTargetText) {
      reviewedBy = "vlm";
      for (const block of kept) {
        const crop = cropRegion(target, block);
        const read = await options.readTargetText(PNG.sync.write(crop));
        const cmp = compareTranscript(block.text, read);
        if (!cmp.match) mismatches.push({ text: cmp.expected, read: cmp.read, y: block.y });
      }
      for (const m of mismatches) {
        report.issues.push({
          kind: "copy-image-mismatch",
          severity: "suspect",
          message: `Target image reads "${m.read}" where the attempt renders "${m.text}" (y=${m.y}). Fix the attempt's copy to match the target pixels.`,
        });
      }
    }

    const sheets = buildContactSheets(target, kept);
    const sheetFiles: string[] = [];
    for (let i = 0; i < sheets.length; i++) {
      const file = join(outDir, `copy-sheet-${i + 1}.png`);
      await writeFile(file, PNG.sync.write(sheets[i]!.png));
      sheetFiles.push(file);
    }
    const worksheetPath = join(outDir, "copy-review.md");
    await writeFile(worksheetPath, formatCopyWorksheet({
      source: options.source,
      target: options.targetPath,
      sheetFiles,
      sheets,
      blocks: kept,
    }));
    report.imageReview = {
      blocks: kept.length,
      sheetFiles,
      worksheetPath,
      reviewedBy,
      mismatches,
      droppedBlocks,
    };
  }

  appendRunLedger({
    tool: "check-copy",
    source: options.source,
    ...(options.targetPath
      ? { target: options.targetPath }
      : options.manifestPath
      ? { target: options.manifestPath }
      : {}),
    headline: {
      missing: report.missingLines.length,
      placeholders: report.placeholders.length,
      manifestLines: report.manifestLines,
      ...(report.statesExplored > 0
        ? { statesExplored: report.statesExplored, revealedOnly: report.revealedLines.length }
        : {}),
      ...(report.imageReview
        ? {
          imageBlocks: report.imageReview.blocks,
          imageMismatches: report.imageReview.reviewedBy === "vlm"
            ? report.imageReview.mismatches.length
            : "pending-agent-review",
        }
        : {}),
    },
  });
  return report;
}

export function formatCopyCheckReport(report: CopyCheckReport): string {
  const lines: string[] = [];
  const status = report.issues.some((i) => i.severity === "suspect") ? "suspect"
    : report.issues.length > 0 ? "warn"
    : "ok";
  lines.push(`${BOLD}${CYAN}vlmkit check copy${RESET}`);
  lines.push(`${DIM}source: ${report.source}${RESET}`);
  lines.push("");
  lines.push(`status: ${status}`);
  lines.push(`rendered text: ${report.textLength} chars`);
  if (report.statesExplored > 0) {
    lines.push(`disclosure states: ${report.statesExplored} explored (details / tabs / aria-expanded)`);
    if (report.droppedStates > 0) {
      lines.push(`  ${YELLOW}! ${report.droppedStates} reveal action(s) beyond the cap were NOT explored${RESET}`);
    }
  }
  if (report.manifestLines > 0) {
    const revealed = report.revealedLines.length > 0 ? `, ${report.revealedLines.length} revealed-only` : "";
    lines.push(`manifest: ${report.manifestLines} line(s), missing ${report.missingLines.length}${revealed}`);
    for (const r of report.revealedLines) {
      lines.push(`  ${DIM}revealed: "${r.line}" ← ${r.state} (hidden by default is fine — do NOT ship it open just for this gate)${RESET}`);
    }
  } else {
    lines.push(`manifest: none (pass --manifest, or --target <png> to verify copy against the target pixels)`);
  }
  if (report.imageReview) {
    const r = report.imageReview;
    lines.push(`target image: ${r.blocks} text block(s) cropped into ${r.sheetFiles.length} sheet(s)`);
    if (r.droppedBlocks > 0) {
      lines.push(`  ${YELLOW}! ${r.droppedBlocks} block(s) beyond the ${r.blocks}-row cap were NOT reviewed${RESET}`);
    }
    if (r.reviewedBy === "vlm") {
      lines.push(`  transcribed by VLM: ${r.mismatches.length} mismatch(es) (details in Issues below)`);
    } else {
      lines.push("");
      lines.push(`${BOLD}ACTION REQUIRED — keyless mode:${RESET} read the contact sheet(s) with your own vision and compare each row against the expected text in the worksheet. Any character difference is a copy bug.`);
      lines.push(`  worksheet: ${r.worksheetPath}`);
      for (const f of r.sheetFiles) lines.push(`  sheet: ${f}`);
    }
  }
  if (report.issues.length > 0) {
    lines.push("");
    lines.push("Issues:");
    for (const issue of report.issues) {
      const icon = issue.severity === "suspect" ? `${RED}x${RESET}` : `${YELLOW}!${RESET}`;
      lines.push(`  ${icon} ${issue.kind}: ${issue.message}`);
    }
  } else {
    lines.push("");
    lines.push(`${GREEN}No copy issues detected.${RESET}`);
  }
  return lines.join("\n");
}

function printUsage(exitCode: number): never {
  console.log(`Usage: vlmkit check copy <html-or-url> [options]

Copy fidelity gate: placeholder-text scan (always on), optional manifest
verification, and optional target-image verification (crops every
rendered text block's bbox out of the target screenshot; a VLM
transcribes them with --vlm, or contact sheets are written for the
agent's own vision without an API key).

Manifest matching sweeps disclosure states by default: closed <details>
are opened and unselected [role=tab] / [aria-expanded=false] controls
are clicked, so copy inside collapsed panels passes (with provenance)
instead of reading as missing — no need to ship disclosures open just
to satisfy the gate.

Options:
  --manifest <file>   Copy manifest (plain text / markdown; one required line per row)
  --target <png>      Target screenshot to verify copy against (bbox-cropped per text block)
  --out <dir>         Sheet/worksheet output dir (default: .vlmkit-copy-review next to the source)
  --vlm [model]       Transcribe crops with a VLM (default model: VRT_VLM_MODEL); requires API key
  --no-states         Skip the disclosure-state sweep (default-state text only)
  --json              Print JSON report
  --fail-on-suspect   Exit non-zero when suspect issues are found`);
  process.exit(exitCode);
}

async function main(argv = process.argv.slice(2)): Promise<void> {
  if (argv.includes("--help") || argv.includes("-h")) printUsage(0);
  let manifestPath: string | undefined;
  let targetPath: string | undefined;
  let outDir: string | undefined;
  let vlm: string | true | undefined;
  let json = false;
  let failOnSuspect = false;
  let exploreStates = true;
  const positional: string[] = [];
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i]!;
    if (arg === "--manifest") manifestPath = argv[++i]!;
    else if (arg === "--target") targetPath = argv[++i]!;
    else if (arg === "--out") outDir = argv[++i]!;
    else if (arg === "--vlm") {
      const next = argv[i + 1];
      vlm = next && !next.startsWith("-") ? argv[++i]! : true;
    } else if (arg === "--no-states") exploreStates = false;
    else if (arg === "--json") json = true;
    else if (arg === "--fail-on-suspect") failOnSuspect = true;
    else if (!arg.startsWith("-")) positional.push(arg);
  }
  if (positional.length === 0) printUsage(1);

  let readTargetText: ((cropPng: Buffer) => Promise<string>) | undefined;
  if (vlm !== undefined) {
    if (!targetPath) {
      console.error("--vlm requires --target <png>");
      process.exit(1);
    }
    const { createVlmClient, resolveModel } = await import("@mizchi/vlmkit-ai/vlm-client.ts");
    const modelId = vlm === true
      ? (process.env.VRT_VLM_MODEL ?? "bytedance/ui-tars-1.5-7b")
      : vlm;
    const model = await resolveModel(modelId);
    const client = await createVlmClient(model);
    readTargetText = async (cropPng: Buffer) => {
      const res = await client!.analyzeImage(cropPng.toString("base64"), TRANSCRIBE_PROMPT, { maxTokens: 256 });
      return res.content;
    };
  }

  const report = await runCopyCheck({
    source: positional[0]!,
    ...(manifestPath ? { manifestPath } : {}),
    ...(targetPath ? { targetPath } : {}),
    ...(outDir ? { outDir } : {}),
    ...(readTargetText ? { readTargetText } : {}),
    exploreStates,
  });
  if (json) console.log(JSON.stringify(report, null, 2));
  else console.log(formatCopyCheckReport(report));
  if (failOnSuspect && report.issues.some((i) => i.severity === "suspect")) process.exit(1);
}

const isCliEntry = process.env.__VRT_DISPATCHER_LEAF__ === "copy-check" ||
  (process.argv[1] ? resolve(process.argv[1]) === fileURLToPath(import.meta.url) : false);
if (isCliEntry) {
  main().catch(handleCliError);
}
