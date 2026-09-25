/**
 * `check copy`'s judgement, on text alone: the placeholder scan, the manifest match, the
 * forbid list and the invisible-reason attribution.
 *
 * Moved out of `vlmkit-markup/src/inspect/copy-check.ts`, which keeps the browser half —
 * `COLLECT_RAW_TEXT` / `COLLECT_TEXT_VISIBILITY` walk text nodes and classify each one the
 * page hides — and re-exports everything here under its old name. A scene reaches the same
 * `analyzeCopy` through `judgeSceneCopy` in `./scene.ts`, so the two sources are judged by one
 * definition of "missing", "invisible" and "forbidden".
 */

export type CopyIssueKind =
  | "placeholder-text"
  | "copy-missing"
  /**
   * The manifest's mirror (`--forbid`): copy that must NOT be on the page any
   * more. Matched against the raw text and every revealed state, because a
   * stale claim hidden behind a disclosure is still shipped.
   */
  | "copy-forbidden"
  | "copy-invisible"
  /**
   * Element-rect mode only (`copy-image.ts`): the renderer says the string is drawn but its
   * measured extent runs past its own clip rect, so the user reads a cut-off version. Needs
   * a text extent only the renderer can measure, which is why the DOM path has no equivalent
   * — there, `check integrity`'s `text-clipped` covers it from `scrollWidth - clientWidth`.
   */
  | "copy-truncated"
  | "copy-image-mismatch"
  | "redirected";

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
  invisibleLines: { line: string; reason: InvisibleReason }[];
  /** Invisible matches accepted via allowInvisible (deliberate, per-class suppression). */
  allowedInvisibleLines: { line: string; reason: InvisibleReason }[];
  /** Lines the forbid list says must be gone, found anyway, and where. */
  forbiddenLines: { line: string; where: "visible" | "invisible" | string }[];
  /** Lines in the forbid list (0 = no list given). */
  forbidLines: number;
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

export const INVISIBLE_REASONS = [
  "zero-size",
  "hidden",
  "transparent",
  "visually-hidden",
  "unreachable",
  "camouflage",
  // Element-rect mode only (`copy-image.ts`): the renderer reports text at a bbox the frame
  // PNG shows as a flat, ink-free region — a missing font, alpha 0, or a skipped draw call.
  // Its own class rather than `transparent`, because the DOM path's `transparent` is a
  // measured `color` alpha and this is a measured pixel spread; collapsing them would make
  // `--allow-invisible transparent` silence two different pieces of evidence.
  "unpainted",
  "unknown",
] as const;
export type InvisibleReason = (typeof INVISIBLE_REASONS)[number];

export function analyzeCopy(input: {
  source: string;
  /** Raw `innerText` — the placeholder scan and invisible-text detection run on this. */
  pageText: string;
  /** Visibly rendered text (COLLECT_TEXT_VISIBILITY.visible). Defaults to pageText when absent. */
  visibleText?: string;
  /** Classified invisible text chunks (COLLECT_TEXT_VISIBILITY.invisible) for reason attribution. */
  invisibleChunks?: { reason: string; text: string }[];
  /** Invisible-match reasons to accept as satisfied (deliberate suppression, e.g. ["visually-hidden"]). */
  allowInvisible?: InvisibleReason[];
  manifestLines?: string[];
  /**
   * Copy that must NOT be on the page any more — a claim that was edited out,
   * a price that changed, a feature that shipped. The manifest's mirror: it
   * says what is required, this says what is stale.
   *
   * Checked against the RAW text and every revealed state, not just the
   * visible text: a stale claim behind a disclosure, or left in the DOM at
   * `font-size:0`, is still shipped and still comes back on the next edit.
   */
  forbiddenLines?: string[];
  stateSweep?: StateSweep;
}): CopyCheckReport {
  const normalized = normalizeWhitespace(input.pageText);
  const visible = input.visibleText !== undefined ? normalizeWhitespace(input.visibleText) : normalized;
  const invisibleByReason = new Map<string, string>();
  for (const chunk of input.invisibleChunks ?? []) {
    invisibleByReason.set(chunk.reason, `${invisibleByReason.get(chunk.reason) ?? ""}\n${chunk.text}`);
  }
  const reasonBuckets = [...invisibleByReason.entries()]
    .map(([reason, text]) => ({ reason: reason as InvisibleReason, normalized: normalizeWhitespace(text) }));
  const allowInvisible = new Set(input.allowInvisible ?? []);
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
  const invisibleLines: { line: string; reason: InvisibleReason }[] = [];
  const allowedInvisibleLines: { line: string; reason: InvisibleReason }[] = [];
  for (const line of manifestLines) {
    const needle = normalizeWhitespace(line);
    if (visible.includes(needle)) continue;
    const state = states.find((s) => s.normalized.includes(needle));
    if (state) {
      revealedLines.push({ line, state: state.label });
      continue;
    }
    // copy-invisible is for text that IS rendered into the page (raw
    // innerText carries it) but the user cannot see it. Text that never
    // renders (display:none panels, hidden sections) stays plain missing —
    // that's the sweep's territory, not a gaming signal.
    const inRaw = normalized.includes(needle);
    const bucket = inRaw ? reasonBuckets.find((b) => b.normalized.includes(needle)) : undefined;
    const reason: InvisibleReason | undefined = inRaw ? (bucket?.reason ?? "unknown") : undefined;
    if (reason !== undefined) {
      if (allowInvisible.has(reason)) {
        allowedInvisibleLines.push({ line, reason });
        continue;
      }
      invisibleLines.push({ line, reason });
      issues.push({
        kind: "copy-invisible",
        severity: "suspect",
        message: `Manifest line found ONLY in text a user cannot see (reason: ${reason}): "${line}". Invisible text does not satisfy the copy gate — render it visibly or remove the hidden copy. If this invisibility is deliberate (e.g. assistive-tech-only copy), re-run with --allow-invisible ${reason}.`,
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

  // The manifest's mirror. A re-edit's requirement is two-sided — "the new
  // claim is on the page" AND "the old one is gone" — and only the first half
  // was checkable, so it was verified with a grep by hand (writer d, v1).
  const forbidLines = input.forbiddenLines ?? [];
  const forbiddenLines: { line: string; where: "visible" | "invisible" | string }[] = [];
  for (const line of forbidLines) {
    const needle = normalizeWhitespace(line);
    const state = states.find((s) => s.normalized.includes(needle));
    const where = visible.includes(needle)
      ? "visible"
      : normalized.includes(needle)
        ? "invisible"
        : state
          ? state.label
          : undefined;
    if (where === undefined) continue;
    forbiddenLines.push({ line, where });
    issues.push({
      kind: "copy-forbidden",
      severity: "suspect",
      message: `Copy that must be gone is still on the page (${where}): "${line}"`
        + " — the forbid list is for a claim that was edited out; remove it from the source rather than hiding it.",
    });
  }

  return {
    source: input.source,
    textLength: normalized.length,
    manifestLines: manifestLines.length,
    forbidLines: forbidLines.length,
    forbiddenLines,
    missingLines,
    revealedLines,
    invisibleLines,
    allowedInvisibleLines,
    statesExplored: states.length,
    droppedStates: input.stateSweep?.droppedActions ?? 0,
    placeholders,
    issues,
  };
}
