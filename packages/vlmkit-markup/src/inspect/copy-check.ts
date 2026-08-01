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
  invisibleLines: { line: string; reason: InvisibleReason }[];
  /** Invisible matches accepted via allowInvisible (deliberate, per-class suppression). */
  allowedInvisibleLines: { line: string; reason: InvisibleReason }[];
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
 *   - zero-area render boxes (font-size:0, transform:scale(0);
 *     display:none has no boxes at all),
 *   - everything `Element.checkVisibility()` rejects: `visibility:
 *     hidden/collapse`, an ancestor opacity chain of 0, and
 *     content-visibility-skipped subtrees — the latter matters because
 *     Chromium hides closed `<details>` content and `hidden="until-found"`
 *     via `content-visibility: hidden` on a UA shadow slot, which still
 *     reports client rects (a manual ancestor walk misses it),
 *   - text painted with alpha < 0.02 (`color: transparent`),
 *   - text a user cannot reach by scrolling (the 2026-07-31 silencing
 *     battery: 10 of 12 hiding vectors passed the pre-geometric gate).
 *     Each text rect is intersected with every ancestor's clip — overflow
 *     hidden/clip clamps to the client box, overflow auto/scroll clamps
 *     to the scrollable content span (so copy deep inside a scrollport
 *     stays visible), `clip: rect(...)` and `clip-path: inset(...)`
 *     clamp geometrically — and finally with the document's scrollable
 *     bounds [0, scrollWidth] x [0, scrollHeight]. Kills off-screen
 *     positioning (left/top -9999px, fixed off-viewport, off to the
 *     right), text-indent:-9999px, transform translations, clip-rect,
 *     clip-path inset, and zero-size overflow boxes. This also excludes
 *     sr-only text BY POLICY: manifest lines are the user-visible copy
 *     spec; assistive-tech-only strings do not belong in a manifest,
 *   - camouflaged text: color within ~8 RGB of the nearest ancestor's
 *     solid background (skipped when a background-image or text-shadow
 *     could make it legible).
 * Deliberately NOT excluded: `<option>` text inside a visible `<select>`
 * (the UA paints the selected option in the control and the rest on
 * open — option text nodes have no boxes of their own, which
 * false-positived S17's "Germany"), and below-the-fold / inner-scrollport
 * text (reachable by scrolling). Known residual vectors (documented in
 * the battery report): z-index occlusion (hit-testing false-positives
 * on stretched-link overlays) and non-inset clip-path shapes.
 * `text-transform` is applied so the matched text is what the user reads.
 * Positioned elements escaping an overflow-hidden ancestor via an
 * outside containing block are approximated by the plain parent walk
 * (may over-clip); acceptable because only zero-intersection flags.
 */
export const INVISIBLE_REASONS = [
  "zero-size",
  "hidden",
  "transparent",
  "visually-hidden",
  "unreachable",
  "camouflage",
  "unknown",
] as const;
export type InvisibleReason = (typeof INVISIBLE_REASONS)[number];

export const COLLECT_TEXT_VISIBILITY = `(() => {
  const rgbaOf = (color) => {
    const m = /rgba?\\(([^)]+)\\)/.exec(color || "");
    if (!m) return null;
    const p = m[1].split(",").map((s) => parseFloat(s));
    return { r: p[0], g: p[1], b: p[2], a: p.length >= 4 ? p[3] : 1 };
  };
  const alphaOf = (color) => { const c = rgbaOf(color); return c ? c.a : 1; };
  const intersect = (a, b) => ({
    left: Math.max(a.left, b.left), top: Math.max(a.top, b.top),
    right: Math.min(a.right, b.right), bottom: Math.min(a.bottom, b.bottom),
  });
  const areaOf = (r) => Math.max(0, r.right - r.left) * Math.max(0, r.bottom - r.top);
  const parseLen = (v, ref) => {
    const n = parseFloat(v);
    if (!Number.isFinite(n)) return 0;
    return v.trim().endsWith("%") ? (n / 100) * ref : n;
  };
  /** clip-path: inset(t r b l [round ...]) -> clip rect in viewport coords, else null. */
  const clipPathRect = (cs, box) => {
    const m = /^inset\\(([^)]+)\\)$/.exec((cs.clipPath || "").trim());
    if (!m) return null;
    const body = m[1].split(/\\s+round\\s+/)[0].trim().split(/\\s+/);
    const t = parseLen(body[0] ?? "0", box.height);
    const r = parseLen(body[1] ?? body[0] ?? "0", box.width);
    const b = parseLen(body[2] ?? body[0] ?? "0", box.height);
    const l = parseLen(body[3] ?? body[1] ?? body[0] ?? "0", box.width);
    return { left: box.left + l, top: box.top + t, right: box.right - r, bottom: box.bottom - b };
  };
  /** clip: rect(t, r, b, l) (positioned elements) -> clip rect in viewport coords, else null. */
  const clipRect = (cs, box) => {
    const m = /^rect\\(([^)]+)\\)$/.exec((cs.clip || "").trim());
    if (!m) return null;
    const v = m[1].split(/[,\\s]+/).map((s) => s.trim());
    const num = (s, fallback) => (s === "auto" || s === undefined) ? fallback : parseLen(s, 0);
    return {
      left: box.left + num(v[3], 0), top: box.top + num(v[0], 0),
      right: box.left + num(v[1], box.right - box.left), bottom: box.top + num(v[2], box.bottom - box.top),
    };
  };
  /** Does any of the node's rects survive every ancestor clip + the document's scrollable bounds? */
  const reachableArea = (el, rects) => {
    const de = document.documentElement;
    const doc = { left: -de.scrollLeft, top: -de.scrollTop, right: -de.scrollLeft + de.scrollWidth, bottom: -de.scrollTop + de.scrollHeight };
    let best = 0;
    for (let r of rects) {
      let rect = { left: r.left, top: r.top, right: r.right, bottom: r.bottom };
      for (let p = el; p && p !== de; p = p.parentElement) {
        const cs = getComputedStyle(p);
        const box = p.getBoundingClientRect();
        const cx = box.left + p.clientLeft, cy = box.top + p.clientTop;
        const ox = cs.overflowX, oy = cs.overflowY;
        if (p !== el) {
          if (ox === "hidden" || ox === "clip") rect = intersect(rect, { left: cx, right: cx + p.clientWidth, top: -1e9, bottom: 1e9 });
          else if (ox === "auto" || ox === "scroll") {
            // Reachable iff inside the scrollable content span; the user can
            // then scroll it anywhere in the client box, so collapse to it.
            rect = intersect(rect, { left: cx - p.scrollLeft, right: cx - p.scrollLeft + p.scrollWidth, top: -1e9, bottom: 1e9 });
            if (rect.right - rect.left > 0) { rect.left = cx; rect.right = cx + p.clientWidth; }
          }
          if (oy === "hidden" || oy === "clip") rect = intersect(rect, { top: cy, bottom: cy + p.clientHeight, left: -1e9, right: 1e9 });
          else if (oy === "auto" || oy === "scroll") {
            rect = intersect(rect, { top: cy - p.scrollTop, bottom: cy - p.scrollTop + p.scrollHeight, left: -1e9, right: 1e9 });
            if (rect.bottom - rect.top > 0) { rect.top = cy; rect.bottom = cy + p.clientHeight; }
          }
        }
        const cp = clipPathRect(cs, box);
        if (cp) rect = intersect(rect, cp);
        const cr = clipRect(cs, box);
        if (cr) rect = intersect(rect, cr);
        if (areaOf(rect) < 1) break;
      }
      best = Math.max(best, areaOf(intersect(rect, doc)));
      if (best >= 4) return best;
    }
    return best;
  };
  /** Text color ~== the nearest solid ancestor background (no bg-image / text-shadow rescue). */
  const camouflaged = (el, cs) => {
    if ((cs.textShadow || "none") !== "none") return false;
    if (parseFloat(cs.webkitTextStrokeWidth || "0") > 0) return false;
    const fg = rgbaOf(cs.color);
    if (!fg) return false;
    for (let p = el; p; p = p.parentElement) {
      const pcs = getComputedStyle(p);
      if ((pcs.backgroundImage || "none") !== "none") return false;
      const bg = rgbaOf(pcs.backgroundColor);
      if (bg && bg.a >= 0.9) {
        return Math.max(Math.abs(fg.r - bg.r), Math.abs(fg.g - bg.g), Math.abs(fg.b - bg.b)) <= 8;
      }
    }
    const white = { r: 255, g: 255, b: 255 };
    return Math.max(Math.abs(fg.r - white.r), Math.abs(fg.g - white.g), Math.abs(fg.b - white.b)) <= 8;
  };
  /** sr-only signature: a clip:rect ancestor clipping to ~nothing, or a <=2px overflow box. */
  const visuallyHiddenAncestor = (el) => {
    for (let p = el; p && p !== document.documentElement; p = p.parentElement) {
      const cs = getComputedStyle(p);
      const box = p.getBoundingClientRect();
      const cr = clipRect(cs, box);
      if (cr && areaOf(cr) <= 4) return true;
      const clipsX = cs.overflowX === "hidden" || cs.overflowX === "clip";
      const clipsY = cs.overflowY === "hidden" || cs.overflowY === "clip";
      if (clipsX && clipsY && p.clientWidth <= 2 && p.clientHeight <= 2) return true;
    }
    return false;
  };
  const root = document.body || document.documentElement;
  if (!root) return { visible: "", invisible: [] };
  const parts = [];
  const invisible = [];
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  let node;
  while ((node = walker.nextNode())) {
    if (!node.data || !node.data.trim()) continue;
    const el = node.parentElement;
    if (!el) continue;
    const tag = el.tagName;
    if (tag === "SCRIPT" || tag === "STYLE" || tag === "NOSCRIPT" || tag === "TEMPLATE") continue;
    const cs = getComputedStyle(el);
    let text = node.data;
    if (cs.textTransform === "uppercase") text = text.toUpperCase();
    else if (cs.textTransform === "lowercase") text = text.toLowerCase();
    else if (cs.textTransform === "capitalize") {
      text = text.replace(/(^|\\s)(\\S)/g, (m0, sp, ch) => sp + ch.toUpperCase());
    }
    const select = el.closest ? el.closest("select") : null;
    if (select) {
      if (typeof select.checkVisibility !== "function" ||
        select.checkVisibility({ visibilityProperty: true, opacityProperty: true, contentVisibilityAuto: true })) {
        parts.push(node.data);
      }
      continue;
    }
    const drop = (reason) => invisible.push({ reason, text });
    // checkVisibility before the rect check so display:none subtrees read
    // "hidden" and "zero-size" stays rendered-but-zero (font-size:0, scale(0)).
    if (typeof el.checkVisibility === "function") {
      if (!el.checkVisibility({ visibilityProperty: true, opacityProperty: true, contentVisibilityAuto: true })) { drop("hidden"); continue; }
    } else {
      if (cs.visibility === "hidden" || cs.visibility === "collapse") { drop("hidden"); continue; }
      let opacity = 1;
      for (let p = el; p && opacity >= 0.02; p = p.parentElement) {
        const po = parseFloat(getComputedStyle(p).opacity);
        opacity *= Number.isFinite(po) ? po : 1;
      }
      if (opacity < 0.02) { drop("hidden"); continue; }
    }
    const range = document.createRange();
    range.selectNodeContents(node);
    const rects = Array.from(range.getClientRects()).filter((r) => r.width * r.height >= 1);
    if (rects.length === 0) { drop("zero-size"); continue; }
    if (alphaOf(cs.color) < 0.02) { drop("transparent"); continue; }
    // Legible text needs a few px^2; a 1x1 sr-only box scores exactly 1.
    if (reachableArea(el, rects) < 4) {
      drop(visuallyHiddenAncestor(el) ? "visually-hidden" : "unreachable");
      continue;
    }
    if (camouflaged(el, cs)) { drop("camouflage"); continue; }
    parts.push(text);
  }
  return { visible: parts.join("\\n"), invisible };
})()`;

/** The visible half of COLLECT_TEXT_VISIBILITY (the disclosure sweep only needs this). */
export const COLLECT_VISIBLE_TEXT = `${COLLECT_TEXT_VISIBILITY}.visible`;

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
  /** Visibly rendered text (COLLECT_TEXT_VISIBILITY.visible). Defaults to pageText when absent. */
  visibleText?: string;
  /** Classified invisible text chunks (COLLECT_TEXT_VISIBILITY.invisible) for reason attribution. */
  invisibleChunks?: { reason: string; text: string }[];
  /** Invisible-match reasons to accept as satisfied (deliberate suppression, e.g. ["visually-hidden"]). */
  allowInvisible?: InvisibleReason[];
  manifestLines?: string[];
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

  return {
    source: input.source,
    textLength: normalized.length,
    manifestLines: manifestLines.length,
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
  /**
   * Invisible-match reasons to accept as satisfied (CLI `--allow-invisible`).
   * Per-class, deliberate suppression — e.g. ["visually-hidden"] when the
   * team decides sr-only text may satisfy manifest lines. Default: none.
   */
  allowInvisible?: InvisibleReason[];
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
  let invisibleChunks: { reason: string; text: string }[];
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
    ({ visible: visibleText, invisible: invisibleChunks } =
      await page.evaluate(COLLECT_TEXT_VISIBILITY) as { visible: string; invisible: { reason: string; text: string }[] });
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
    invisibleChunks,
    ...(options.allowInvisible ? { allowInvisible: options.allowInvisible } : {}),
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
      ...(report.allowedInvisibleLines.length > 0 ? { allowedInvisible: report.allowedInvisibleLines.length } : {}),
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
    const allowed = report.allowedInvisibleLines.length > 0 ? `, ${report.allowedInvisibleLines.length} invisible-allowed` : "";
    lines.push(`manifest: ${report.manifestLines} line(s), missing ${report.missingLines.length}${invisible}${allowed}${revealed}`);
    for (const r of report.revealedLines) {
      lines.push(`  ${DIM}revealed: "${r.line}" ← ${r.state} (hidden by default is fine — do NOT ship it open just for this gate)${RESET}`);
    }
    for (const a of report.allowedInvisibleLines) {
      lines.push(`  ${DIM}invisible-allowed: "${a.line}" (${a.reason} — accepted via --allow-invisible)${RESET}`);
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

Manifest lines must appear in the VISIBLY rendered text: copy a user
cannot actually see (font-size:0, opacity:0, transparent color,
off-screen positioning, text-indent, transforms, clip/clip-path,
zero-size overflow boxes, same-color camouflage, sr-only) is reported
as copy-invisible with a reason class, not as satisfied. The manifest
is the user-visible copy spec — keep assistive-tech-only strings out
of it. Markdown headings in the manifest ("# Section") are organizing
comments, not required lines.

Reason classes: zero-size, hidden, transparent, visually-hidden
(sr-only-style clip/1px box), unreachable (off-screen/clipped),
camouflage, unknown. When an invisibility is deliberate, accept that
class with --allow-invisible; each accepted line is listed with its
reason so the suppression stays auditable.

Options:
  --manifest <file>   Copy manifest (plain text / markdown; one required line per row)
  --allow-invisible <classes>  Comma-separated reason classes to accept as satisfied
                      (e.g. --allow-invisible visually-hidden)
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
  let allowInvisible: InvisibleReason[] | undefined;
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
    else if (arg === "--allow-invisible") {
      const classes = (argv[++i] ?? "").split(",").map((s) => s.trim()).filter(Boolean);
      const bad = classes.filter((c) => !(INVISIBLE_REASONS as readonly string[]).includes(c));
      if (classes.length === 0 || bad.length > 0) {
        console.error(`--allow-invisible: unknown class(es) ${bad.map((b) => `"${b}"`).join(", ") || "(none given)"}. Valid: ${INVISIBLE_REASONS.join(", ")}`);
        process.exit(1);
      }
      allowInvisible = classes as InvisibleReason[];
    } else if (arg === "--json") json = true;
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
    ...(allowInvisible ? { allowInvisible } : {}),
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
