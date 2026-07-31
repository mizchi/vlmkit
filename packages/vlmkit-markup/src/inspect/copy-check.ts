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
 *      line of the manifest must appear in the VISIBLY rendered text
 *      (markdown headings in the manifest are section comments, not
 *      required lines). The manifest is the copy twin of the motion
 *      brief — a small text carrier for truth a screenshot can't
 *      transport reliably (exact spellings, punctuation, casing).
 *      Matching runs against visible text, not raw innerText: a line
 *      present only in invisible text (font-size:0 / opacity:0 /
 *      transparent color) is reported as `copy-invisible` — observed
 *      as an agent gaming vector in the S18 run.
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

export type CopyIssueKind = "placeholder-text" | "copy-missing" | "copy-invisible" | "copy-image-mismatch";

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
  /** Manifest lines present in the DOM text but not visibly rendered (gaming vector). */
  invisibleLines: string[];
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
 * Manifest lines: non-empty lines with markdown list markers stripped.
 * Markdown headings (`# ` … `###### `, hash + space) are SECTION COMMENTS
 * and are skipped — authors organize manifests with headings, and treating
 * `# Sidebar` as a required line "Sidebar" turned out to be a footgun
 * (observed S18: the heading words leaked into the requirement set and an
 * agent satisfied them with invisible text). A `#` glued to content
 * (`#10412`, `#general`) is NOT a heading and stays a required line.
 */
export function parseCopyManifest(raw: string): string[] {
  return raw
    .split("\n")
    .filter((line) => !/^\s*#{1,6}\s/.test(line))
    .map((line) => line.replace(/^\s*(?:[-*+]\s+|\d+\.\s+)/, "").trim())
    .filter((line) => line.length > 0);
}

/** Reveal actions beyond this are dropped from the sweep (and counted, loudly). */
const MAX_STATE_ACTIONS = 30;

/**
 * In-page action inventory for the disclosure-state sweep: tags each
 * reveal candidate (closed `<details>`, unselected `[role=tab]`,
 * `[aria-expanded=false]` control) with a `data-vlmkit-state` index and
 * returns their descriptors. The RUNNER performs the actions one at a
 * time and awaits a render commit between action and text capture —
 * reveal handlers that go through a microtask, requestAnimationFrame,
 * or a framework-batched render would otherwise update the DOM only
 * after a single synchronous evaluate had captured every state.
 */
export const TAG_STATE_ACTIONS = `(() => {
  const short = (el) => {
    const t = ((el && (el.innerText || el.textContent)) || "").replace(/\\s+/g, " ").trim();
    return t.length > 60 ? t.slice(0, 57) + "…" : t;
  };
  const actions = [];
  const push = (kind, el, label) => {
    if (el.hasAttribute("data-vlmkit-state")) return;
    el.setAttribute("data-vlmkit-state", String(actions.length));
    actions.push({ kind, label });
  };
  for (const d of document.querySelectorAll("details:not([open])")) {
    push("details", d, 'details "' + short(d.querySelector("summary")) + '"');
  }
  for (const t of document.querySelectorAll('[role="tab"]')) {
    if (t.getAttribute("aria-selected") !== "true") push("tab", t, 'tab "' + short(t) + '"');
  }
  for (const c of document.querySelectorAll('[aria-expanded="false"]')) {
    push("expand", c, c.tagName.toLowerCase() + '[aria-expanded] "' + short(c) + '"');
  }
  return actions;
})()`;

/** Double rAF + macrotask: lets microtask/rAF/framework-batched reveal handlers commit before the text capture. */
const AWAIT_RENDER_COMMIT = `new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(() => setTimeout(r, 0))))`;

/**
 * In-page collection of VISIBLY RENDERED text — the text the manifest is
 * matched against. `innerText` alone is gameable: a `font-size: 0` span,
 * an `opacity: 0` block, or `color: transparent` text all survive it
 * (observed S18: an agent packed six manifest lines into one font-size:0
 * span and the gate passed). Per text node this excludes:
 *   - zero-area render boxes (font-size:0; display:none has no boxes at all),
 *   - everything `Element.checkVisibility()` rejects: `visibility:
 *     hidden/collapse`, an ancestor opacity chain of 0, and
 *     content-visibility-skipped subtrees — the latter matters because
 *     Chromium hides closed `<details>` content and `hidden="until-found"`
 *     via `content-visibility: hidden` on a UA shadow slot, which still
 *     reports client rects (a manual ancestor walk misses it),
 *   - text painted with alpha < 0.02 (`color: transparent`).
 * Deliberately NOT excluded: sr-only / clip-rect patterns (their text
 * boxes keep a real size; assistive-tech copy stays legitimate), text
 * scrolled out of a scrollport, and `<option>` text inside a visible
 * `<select>` (the UA paints the selected option in the control and the
 * rest on open — option text nodes have no boxes of their own, which
 * false-positived S17's "Germany"). `text-transform` is applied so the
 * matched text is what the user reads.
 */
export const COLLECT_VISIBLE_TEXT = `(() => {
  const alphaOf = (color) => {
    const m = /rgba?\\(([^)]+)\\)/.exec(color || "");
    if (!m) return 1;
    const parts = m[1].split(",").map((p) => parseFloat(p));
    return parts.length >= 4 ? parts[3] : 1;
  };
  const root = document.body || document.documentElement;
  if (!root) return "";
  const parts = [];
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  let node;
  while ((node = walker.nextNode())) {
    if (!node.data || !node.data.trim()) continue;
    const el = node.parentElement;
    if (!el) continue;
    const tag = el.tagName;
    if (tag === "SCRIPT" || tag === "STYLE" || tag === "NOSCRIPT" || tag === "TEMPLATE") continue;
    const select = el.closest ? el.closest("select") : null;
    if (select) {
      if (typeof select.checkVisibility !== "function" ||
        select.checkVisibility({ visibilityProperty: true, opacityProperty: true, contentVisibilityAuto: true })) {
        parts.push(node.data);
      }
      continue;
    }
    const range = document.createRange();
    range.selectNodeContents(node);
    let area = 0;
    for (const r of range.getClientRects()) area = Math.max(area, r.width * r.height);
    if (area < 1) continue;
    const cs = getComputedStyle(el);
    if (typeof el.checkVisibility === "function") {
      if (!el.checkVisibility({ visibilityProperty: true, opacityProperty: true, contentVisibilityAuto: true })) continue;
    } else {
      if (cs.visibility === "hidden" || cs.visibility === "collapse") continue;
      let opacity = 1;
      for (let p = el; p && opacity >= 0.02; p = p.parentElement) {
        const po = parseFloat(getComputedStyle(p).opacity);
        opacity *= Number.isFinite(po) ? po : 1;
      }
      if (opacity < 0.02) continue;
    }
    if (alphaOf(cs.color) < 0.02) continue;
    let text = node.data;
    if (cs.textTransform === "uppercase") text = text.toUpperCase();
    else if (cs.textTransform === "lowercase") text = text.toLowerCase();
    else if (cs.textTransform === "capitalize") {
      text = text.replace(/(^|\\s)(\\S)/g, (m0, sp, ch) => sp + ch.toUpperCase());
    }
    parts.push(text);
  }
  return parts.join("\\n");
})()`;

async function sweepDisclosureStates(page: {
  evaluate: (script: string) => Promise<unknown>;
}): Promise<StateSweep> {
  const actions = await page.evaluate(TAG_STATE_ACTIONS) as { kind: StateText["kind"]; label: string }[];
  const kept = actions.slice(0, MAX_STATE_ACTIONS);
  const states: StateText[] = [];
  for (let i = 0; i < kept.length; i++) {
    const performed = await page.evaluate(`(() => {
      const el = document.querySelector('[data-vlmkit-state="${i}"]');
      if (!el) return false;
      try {
        if (el.tagName === "DETAILS") el.open = true;
        else el.click();
      } catch { return false; }
      return true;
    })()`) as boolean;
    if (!performed) continue;
    await page.evaluate(AWAIT_RENDER_COMMIT);
    const text = await page.evaluate(COLLECT_VISIBLE_TEXT) as string;
    states.push({ kind: kept[i]!.kind, label: kept[i]!.label, text });
  }
  return { states, droppedActions: Math.max(0, actions.length - kept.length) };
}

export function analyzeCopy(input: {
  source: string;
  /** Raw `innerText` — the placeholder scan and invisible-text detection run on this. */
  pageText: string;
  /** Visibly rendered text (COLLECT_VISIBLE_TEXT). Defaults to pageText when absent. */
  visibleText?: string;
  manifestLines?: string[];
  stateSweep?: StateSweep;
}): CopyCheckReport {
  const normalized = normalizeWhitespace(input.pageText);
  const visible = input.visibleText !== undefined ? normalizeWhitespace(input.visibleText) : normalized;
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
  const invisibleLines: string[] = [];
  for (const line of manifestLines) {
    const needle = normalizeWhitespace(line);
    if (visible.includes(needle)) continue;
    const state = states.find((s) => s.normalized.includes(needle));
    if (state) {
      revealedLines.push({ line, state: state.label });
      continue;
    }
    if (normalized.includes(needle)) {
      invisibleLines.push(line);
      issues.push({
        kind: "copy-invisible",
        severity: "suspect",
        message: `Manifest line found ONLY in invisible text (zero-size, zero-opacity, or transparent — e.g. a font-size:0 span): "${line}". Invisible text does not satisfy the copy gate — render it visibly, or remove the hidden copy.`,
      });
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
    invisibleLines,
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
  let visibleText: string;
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
    visibleText = await page.evaluate(COLLECT_VISIBLE_TEXT) as string;
    if (target) {
      blocks = (await page.evaluate(COLLECT_TEXT_BLOCKS) as TextBlock[])
        .filter((b) => b.y < target.height && b.x < target.width);
    }
    if (options.exploreStates !== false) {
      stateSweep = await sweepDisclosureStates(page);
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
    visibleText,
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
      ...(report.invisibleLines.length > 0 ? { invisibleOnly: report.invisibleLines.length } : {}),
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
    const invisible = report.invisibleLines.length > 0 ? `, ${report.invisibleLines.length} invisible-only` : "";
    lines.push(`manifest: ${report.manifestLines} line(s), missing ${report.missingLines.length}${invisible}${revealed}`);
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

Manifest lines must appear in the VISIBLY rendered text: copy that
exists only at font-size:0, opacity:0, or transparent color is
reported as copy-invisible, not as satisfied. Markdown headings in the
manifest ("# Section") are organizing comments, not required lines.

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
