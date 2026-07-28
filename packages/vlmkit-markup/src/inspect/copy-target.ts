/**
 * Image-side copy verification support for `check copy --target`.
 *
 * The S9 run proved the blind spot: a wrong © year, missing `·`
 * separators, and proper-noun typos survived 18 rounds across two
 * models because text truth lived only in the target pixels, and no
 * gate ever read them. This module closes the gap without asking the
 * VLM for anything it is bad at (coordinates, colors, deltas):
 *
 *   - Coordinates come from the DOM. Each rendered text block of the
 *     attempt carries a bbox; the *same* bbox is cropped out of the
 *     target image. By the time copy matters the composition is
 *     converged, so the crop shows the target's version of that text.
 *   - Reading is the only vision task. Crops are stacked into contact
 *     sheets so an agent (keyless mode) reads a handful of images once,
 *     or a VLM (`--vlm`) transcribes each crop for automatic diffing.
 *
 * Everything here except `collectTextBlocks` is pure pixel/string math.
 */
import { PNG } from "pngjs";

export interface TextBlock {
  /** Whitespace-normalized text of one block-level text run. */
  text: string;
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface ContactSheet {
  png: PNG;
  /** Indices into the input block array, top-to-bottom sheet order. */
  rows: number[];
}

/**
 * Browser-side collector: every text node is bucketed under its closest
 * non-inline ancestor, so `<p>Instagram · <a>RSS</a> · Contact</p>`
 * becomes ONE block with the full line and the union bbox of its text
 * rects — the unit a reader compares in one glance.
 */
export const COLLECT_TEXT_BLOCKS = `
(() => {
  const SKIP = new Set(["SCRIPT", "STYLE", "NOSCRIPT", "TEMPLATE"]);
  const buckets = new Map();
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  let node;
  while ((node = walker.nextNode())) {
    const raw = node.nodeValue || "";
    if (!raw.trim()) continue;
    const el = node.parentElement;
    if (!el || SKIP.has(el.tagName)) continue;
    const style = getComputedStyle(el);
    if (style.visibility === "hidden" || style.display === "none") continue;
    let block = el;
    while (block && block !== document.body) {
      const d = getComputedStyle(block).display;
      if (d !== "inline" && d !== "contents") break;
      block = block.parentElement;
    }
    if (!block) continue;
    const range = document.createRange();
    range.selectNodeContents(node);
    const rects = Array.from(range.getClientRects()).filter((r) => r.width > 0 && r.height > 0);
    if (rects.length === 0) continue;
    let b = buckets.get(block);
    if (!b) {
      b = { parts: [], x1: Infinity, y1: Infinity, x2: -Infinity, y2: -Infinity };
      buckets.set(block, b);
    }
    b.parts.push(raw);
    for (const r of rects) {
      b.x1 = Math.min(b.x1, r.left + scrollX);
      b.y1 = Math.min(b.y1, r.top + scrollY);
      b.x2 = Math.max(b.x2, r.right + scrollX);
      b.y2 = Math.max(b.y2, r.bottom + scrollY);
    }
  }
  return Array.from(buckets.values())
    .map((b) => ({
      text: b.parts.join(" ").replace(/\\s+/g, " ").trim(),
      x: Math.round(b.x1),
      y: Math.round(b.y1),
      width: Math.round(b.x2 - b.x1),
      height: Math.round(b.y2 - b.y1),
    }))
    .filter((t) => t.text.length > 0 && t.width > 1 && t.height > 1)
    .sort((a, b) => a.y - b.y || a.x - b.x);
})()
`;

/**
 * Canonicalize a string for image-vs-DOM comparison. Whitespace
 * collapses; typographic variants that VLMs and design tools swap
 * freely (curly quotes, dash family, ellipsis, NBSP) unify so they
 * never produce false suspects. Casing, digits, and separator glyphs
 * like `·` stay significant — they are exactly what this gate exists
 * to catch.
 */
export function canonicalizeForCompare(text: string): string {
  return text
    .replace(/[‘’ʼ]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/[–—−]/g, "-")
    .replace(/…/g, "...")
    .replace(/ /g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export interface TranscriptComparison {
  match: boolean;
  expected: string;
  read: string;
}

export function compareTranscript(expected: string, read: string): TranscriptComparison {
  const e = canonicalizeForCompare(expected);
  const r = canonicalizeForCompare(read);
  return { match: e === r, expected: e, read: r };
}

const SEPARATOR_HEIGHT = 8;
const SEPARATOR_GRAY = 0x80;

function clamp(v: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, v));
}

/**
 * Crop a padded bbox out of a PNG, clamped to the image bounds.
 *
 * The right edge gets extra room (25% of the bbox width, at least
 * 32px): the bbox comes from the ATTEMPT's line boxes, and when the
 * attempt's copy is missing trailing words the target's line runs
 * longer — the overhang must be visible in the crop or the omission
 * class of bug stays invisible.
 */
export function cropRegion(
  src: PNG,
  bbox: { x: number; y: number; width: number; height: number },
  pad = 6,
): PNG {
  const padRight = Math.max(pad, 32, Math.round(bbox.width * 0.25));
  const x1 = clamp(bbox.x - pad, 0, src.width);
  const y1 = clamp(bbox.y - pad, 0, src.height);
  const x2 = clamp(bbox.x + bbox.width + padRight, 0, src.width);
  const y2 = clamp(bbox.y + bbox.height + pad, 0, src.height);
  const w = Math.max(1, x2 - x1);
  const h = Math.max(1, y2 - y1);
  const out = new PNG({ width: w, height: h });
  for (let dy = 0; dy < h; dy++) {
    const srcStart = ((y1 + dy) * src.width + x1) * 4;
    const dstStart = dy * w * 4;
    src.data.copy(out.data, dstStart, srcStart, srcStart + w * 4);
  }
  return out;
}

/**
 * Stack crops of `blocks` (cut from `target`) into contact sheets of at
 * most `maxRows` rows, separated by solid gray bars. Sheet width is the
 * widest crop in the sheet; narrower crops are left-aligned on white.
 * Row order matches the block order given (callers pass reading order).
 */
export function buildContactSheets(
  target: PNG,
  blocks: TextBlock[],
  options?: { pad?: number; maxRows?: number },
): ContactSheet[] {
  const pad = options?.pad ?? 6;
  const maxRows = options?.maxRows ?? 12;
  const sheets: ContactSheet[] = [];
  for (let start = 0; start < blocks.length; start += maxRows) {
    const slice = blocks.slice(start, start + maxRows);
    const crops = slice.map((b) => cropRegion(target, b, pad));
    const width = Math.max(...crops.map((c) => c.width));
    const height = crops.reduce((sum, c) => sum + c.height, 0) +
      SEPARATOR_HEIGHT * (crops.length - 1);
    const sheet = new PNG({ width, height });
    sheet.data.fill(0xff);
    let y = 0;
    for (let i = 0; i < crops.length; i++) {
      const crop = crops[i]!;
      for (let dy = 0; dy < crop.height; dy++) {
        const srcStart = dy * crop.width * 4;
        const dstStart = ((y + dy) * width) * 4;
        crop.data.copy(sheet.data, dstStart, srcStart, srcStart + crop.width * 4);
      }
      y += crop.height;
      if (i < crops.length - 1) {
        for (let dy = 0; dy < SEPARATOR_HEIGHT; dy++) {
          for (let dx = 0; dx < width; dx++) {
            const o = ((y + dy) * width + dx) * 4;
            sheet.data[o] = SEPARATOR_GRAY;
            sheet.data[o + 1] = SEPARATOR_GRAY;
            sheet.data[o + 2] = SEPARATOR_GRAY;
            sheet.data[o + 3] = 0xff;
          }
        }
        y += SEPARATOR_HEIGHT;
      }
    }
    sheets.push({ png: sheet, rows: slice.map((_, i) => start + i) });
  }
  return sheets;
}

/**
 * The keyless-mode deliverable: a worksheet mapping each sheet row to
 * the text the attempt's DOM renders there. The reader's job is pure
 * vision — read the target pixels, compare against the expected string,
 * and flag ANY character difference.
 */
export function formatCopyWorksheet(input: {
  source: string;
  target: string;
  sheetFiles: string[];
  sheets: ContactSheet[];
  blocks: TextBlock[];
}): string {
  const lines: string[] = [];
  lines.push(`# Copy review worksheet`);
  lines.push("");
  lines.push(`- attempt: ${input.source}`);
  lines.push(`- target image: ${input.target}`);
  lines.push("");
  lines.push(
    `Each sheet stacks crops FROM THE TARGET IMAGE, top to bottom, separated by gray bars.`,
  );
  lines.push(
    `For each row, read the pixels and compare against the expected text below (what the attempt's DOM renders at that position). Any character difference — a digit, a year, punctuation, a separator glyph like \`·\`, a proper-noun spelling — is a copy bug in the attempt. Whitespace and straight-vs-curly quote differences are fine.`,
  );
  for (let s = 0; s < input.sheets.length; s++) {
    lines.push("");
    lines.push(`## ${input.sheetFiles[s]}`);
    lines.push("");
    const sheet = input.sheets[s]!;
    for (let r = 0; r < sheet.rows.length; r++) {
      const block = input.blocks[sheet.rows[r]!]!;
      lines.push(`${r + 1}. (y=${block.y}) \`${block.text}\``);
    }
  }
  lines.push("");
  return lines.join("\n");
}

/** Prompt for the VLM transcription path — read, never measure. */
export const TRANSCRIBE_PROMPT =
  "Transcribe ALL text visible in this image, exactly as printed: keep digits, punctuation, separator characters (like ·), and casing. Output only the transcribed text on a single line, with single spaces between words. No commentary.";
