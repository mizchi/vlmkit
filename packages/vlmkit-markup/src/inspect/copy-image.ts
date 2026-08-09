/**
 * `check copy` without a DOM: an element-rect JSON (text + bbox per element) and,
 * optionally, the frame PNG those rects were drawn into.
 *
 * Requested in vlmkit#118 by the same canvas/WebGPU game engine that asked for image-only
 * `check integrity` (#116). `runCopyCheck` reads text through Playwright — `COLLECT_RAW_TEXT`
 * and `COLLECT_TEXT_VISIBILITY` walk text nodes — so a canvas UI presents one `<canvas>`
 * element with no text nodes at all: the manifest check reports every line missing and the
 * placeholder scan reports nothing. Both verdicts are about the DOM, not about the frame.
 *
 * The engine already knows what it drew and where, which is exactly the input the pure part
 * of the gate wants. `analyzeCopy` in `copy-check.ts` is reused **unchanged**: it takes
 * `{pageText, visibleText, invisibleChunks, manifestLines}` and owns the placeholder scan,
 * the manifest matching and the invisible-reason attribution. This file's whole job is to
 * turn element rects into those four strings honestly. Same shape as `integrity-image.ts`:
 * the DOM becomes one adapter among several rather than the only way in.
 *
 * ## Element order matters, so it is defined
 *
 * The DOM path joins text-node values in document order and normalizes whitespace, which
 * lets one manifest line span several nodes (`<p>Instagram · <a>RSS</a></p>` is one line).
 * Element rects have no document order, so they are sorted by (top, left) — reading order,
 * the same order `COLLECT_TEXT_BLOCKS` sorts its blocks into. A manifest line may therefore
 * span two adjacent drawn strings, exactly as it may span two text nodes.
 *
 * ## What it will not do
 *
 * Two of the gate's five rules cannot run at all here, and `copy-invisible` runs over two of
 * its seven reason classes. Those gaps are **named in the report** (`skippedRules`,
 * `inertRules`, `coverageNotes`) rather than omitted, because a `no copy issues` result over
 * two-and-a-bit rules is a much weaker claim than the same words over five, and the reader
 * has to be able to see the difference. Same reasoning as `integrity-image.ts`.
 *
 * Deliberately NOT implemented, each because the input cannot support it honestly:
 *
 *   - **Off-frame text.** An element whose box lies outside the frame might not have been
 *     drawn, or might be a scrolled-out row of a list the engine reports in full. Element
 *     rects carry no scroll or clip-chain information, so the two are indistinguishable and
 *     reporting either way would be a guess. Such elements are counted in `coverageNotes`
 *     instead, so a caller can see their ink went unchecked.
 *   - **`--target` image review.** The crop/contact-sheet path compares a *reference*
 *     screenshot against a live render; wiring it here needs a second image and a different
 *     question than "is my frame's copy right". The gate rejects `--target` in this mode
 *     rather than accepting it and quietly reviewing nothing.
 *   - **Disclosure-state sweep.** Opening `<details>` and clicking tabs needs a live page.
 *     A collapsed panel's copy is simply absent from the frame the engine handed over.
 */
import { readFile } from "node:fs/promises";
import { PNG } from "pngjs";
import { appendRunLedger } from "@mizchi/vlmkit-core/run-ledger.ts";
import {
  type CopyCheckReport,
  type InvisibleReason,
  analyzeCopy,
  normalizeWhitespace,
  parseCopyManifest,
} from "./copy-check.ts";
// The element-rect parser is shared with image-mode `check integrity`, name and all: it
// accepts `{elements:[…]}` or a bare array, snake_case and camelCase optional fields, and
// throws on a row missing geometry. A second parser would be a second set of accepted
// spellings, and callers write this JSON from a non-JS language.
// `describe` comes from there too, so one element reads the same way (`.class`, then `#id`,
// then the tag, then the path) whichever gate reports it.
import {
  type IntegrityImageElement,
  describe as describeElement,
  parseIntegrityImageElements,
} from "./integrity-image.ts";

export interface CopyImageOptions {
  elementsPath: string;
  /** Frame PNG. Optional: without it the ink check (unpainted text) cannot run. */
  imagePath?: string;
  manifestPath?: string;
  /** Invisible-match reason classes to accept as satisfied (CLI `--allow-invisible`). */
  allowInvisible?: InvisibleReason[];
}

/** Rules this input cannot support, each with the reason. Reported, not hidden. */
export const COPY_IMAGE_SKIPPED_RULES: { rule: string; reason: string }[] = [
  { rule: "redirected", reason: "needs a navigation result; element rects carry no URL" },
  {
    rule: "copy-image-mismatch",
    reason: "needs a reference screenshot to crop and transcribe (--target), which this mode does not accept",
  },
];

/** One element whose text is drawn but cut off by its own clip rect. */
export interface CopyTruncation {
  selector: string;
  text: string;
  /** Px of text beyond the clip rect, per axis. */
  clippedX: number;
  clippedY: number;
  /** Manifest lines this element's text satisfies — satisfied on paper, unreadable in fact. */
  manifestLines: string[];
}

export interface CopyImageReport extends CopyCheckReport {
  /** Rules that cannot run in this mode, and why. */
  skippedRules: { rule: string; reason: string }[];
  /** Rules that ran but had no input — e.g. no element carried `text`. */
  inertRules: { rule: string; reason: string }[];
  /** Coverage caveats that are not per-rule (partial reason classes, unchecked elements). */
  coverageNotes: string[];
  truncated: CopyTruncation[];
  elements: number;
  textElements: number;
}

/**
 * Px of text beyond the clip rect below which truncation is not worth reporting.
 *
 * 4, the same floor image-mode `check integrity` uses for `text-clipped`. Sub-pixel layout
 * and glyph-metric rounding routinely produce 1-2px of overhang on text that reads fine.
 */
const TRUNCATION_FLOOR = 4;

/**
 * Max channel spread within a text bbox for the region to count as unpainted.
 *
 * Deliberately near-zero rather than an ink *ratio*: the claim being made is "no glyphs were
 * painted here at all", and a flat region is the only pixel evidence that supports it
 * without a font metric. Antialiased 8px text on a busy panel still spreads far more than 2
 * channel steps, so legible-but-faint copy is not reported. The cost of the tight threshold
 * is that same-color-on-same-color text (the DOM path's `camouflage` class) slips through —
 * stated in `coverageNotes` rather than papered over with a looser number.
 */
const UNPAINTED_TOLERANCE = 2;

export async function runImageCopyCheck(options: CopyImageOptions): Promise<CopyImageReport> {
  const elements = parseIntegrityImageElements(await readFile(options.elementsPath, "utf-8"));

  let image: PNG | undefined;
  if (options.imagePath) image = PNG.sync.read(await readFile(options.imagePath));

  const manifestLines = options.manifestPath
    ? parseCopyManifest(await readFile(options.manifestPath, "utf8"))
    : undefined;

  // Reading order, so joining adjacent strings means what it means in the DOM path.
  const withText = elements
    .filter((element) => (element.text ?? "").trim().length > 0)
    .sort((a, b) => a.top - b.top || a.left - b.left);

  const inertRules: { rule: string; reason: string }[] = [];
  const coverageNotes: string[] = [];

  const visible: string[] = [];
  const invisibleChunks: { reason: string; text: string }[] = [];
  const truncated: CopyTruncation[] = [];
  let offFrame = 0;
  let inkChecked = 0;

  for (const element of withText) {
    const text = element.text!;
    // Zero-area boxes first: an element with no box painted nothing regardless of pixels,
    // and running the ink check on it would read whatever happens to sit at that point.
    if (element.width <= 0 || element.height <= 0) {
      invisibleChunks.push({ reason: "zero-size", text });
      continue;
    }
    if (image) {
      const verdict = inkVerdict(image, element);
      if (verdict === "off-frame") {
        offFrame++;
      } else {
        inkChecked++;
        if (verdict === "unpainted") {
          invisibleChunks.push({ reason: "unpainted", text });
          continue;
        }
      }
    }
    visible.push(text);
    const cut = truncationOf(element);
    if (cut) {
      truncated.push({
        selector: describeElement(element),
        text,
        clippedX: cut.clippedX,
        clippedY: cut.clippedY,
        manifestLines: (manifestLines ?? []).filter((line) =>
          normalizeWhitespace(text).includes(normalizeWhitespace(line))
        ),
      });
    }
  }

  // Raw text carries every string the engine says it drew, visible or not — that is what
  // `analyzeCopy` needs to tell copy-invisible (rendered but unseeable) from copy-missing
  // (never rendered at all).
  const rawParts = [...visible, ...invisibleChunks.map((chunk) => chunk.text)];

  const report = analyzeCopy({
    source: options.imagePath ?? options.elementsPath,
    pageText: rawParts.join("\n"),
    visibleText: visible.join("\n"),
    invisibleChunks,
    ...(options.allowInvisible ? { allowInvisible: options.allowInvisible } : {}),
    ...(manifestLines ? { manifestLines } : {}),
  }) as CopyImageReport;

  // Truncation is reported for every clipped text element, not only manifest-carrying ones:
  // the reported pain (vlmkit#118) is a dynamic number outgrowing its box, and no static
  // manifest lists those. This overlaps image-mode `check integrity`'s `text-clipped` by
  // design — integrity answers "is this frame broken", copy answers "can the user read the
  // strings" — and one duplicated finding when both gates run is a better trade than copy
  // passing a manifest line the user can only half read.
  for (const cut of truncated) {
    const axis = cut.clippedX >= cut.clippedY
      ? `${cut.clippedX}px horizontally`
      : `${cut.clippedY}px vertically`;
    const satisfied = cut.manifestLines.length > 0
      ? ` It satisfies manifest line(s) ${cut.manifestLines.map((l) => `"${l}"`).join(", ")} on paper,`
        + ` but the user cannot read all of it.`
      : "";
    report.issues.push({
      kind: "copy-truncated",
      severity: "suspect",
      message: `${cut.selector} draws "${cut.text}" but its measured text runs ${axis} past the clip rect,`
        + ` so it renders cut off.${satisfied}`
        + ` Shorten the string, widen the box, or shrink the type.`,
    });
  }

  if (withText.length === 0) {
    inertRules.push({
      rule: "placeholder-text",
      reason: "no element carried `text`; nothing to scan",
    });
  }
  // Ordered so `copy-missing` gets exactly one reason: no manifest is the more fundamental
  // absence, and reporting both would read as two independent gaps.
  if (manifestLines === undefined) {
    inertRules.push({ rule: "copy-missing", reason: "no --manifest given; there is nothing to require" });
  } else if (withText.length === 0) {
    inertRules.push({
      rule: "copy-missing",
      reason: "no element carried `text`, so every manifest line reports missing for want of input rather than for a real absence",
    });
  }
  if (withText.every((element) => !element.textMeasured || !element.clip)) {
    inertRules.push({
      rule: "copy-truncated",
      reason: withText.some((element) => element.textMeasured)
        ? "no element declared both `textMeasured` and a `clip` rect; text wider than its box overdraws rather than truncating unless a clip says otherwise"
        : "no element carried `textMeasured`; only the renderer knows the drawn extent",
    });
  }

  coverageNotes.push(
    "copy-invisible covers 2 of its 7 reason classes here: zero-size (empty box) and"
    + " unpainted (--image only, a flat bbox). hidden, transparent, camouflage, unreachable and"
    + " visually-hidden all need computed styles.",
  );
  if (!image) {
    coverageNotes.push(
      "No --image: text the engine reports but never actually painted (missing font, alpha 0,"
      + " skipped draw call) cannot be detected. Pass the frame PNG to enable the ink check.",
    );
  } else {
    coverageNotes.push(`Ink checked in ${inkChecked} text bbox(es) against ${options.imagePath}.`);
    if (offFrame > 0) {
      coverageNotes.push(
        `${offFrame} text element(s) lie outside the frame, so their ink went unchecked. Element`
        + " rects carry no scroll or clip-chain data, so \"never drawn\" and \"scrolled out of this"
        + " frame\" are indistinguishable and neither is reported.",
      );
    }
  }
  coverageNotes.push(
    "No disclosure-state sweep: opening <details> and clicking tabs needs a live page, so copy"
    + " only reachable through an interaction is absent from this input, not hidden in it.",
  );

  report.skippedRules = COPY_IMAGE_SKIPPED_RULES;
  report.inertRules = inertRules;
  report.coverageNotes = coverageNotes;
  report.truncated = truncated;
  report.elements = elements.length;
  report.textElements = withText.length;

  appendRunLedger({
    tool: "check-copy",
    source: options.imagePath ?? options.elementsPath,
    ...(options.manifestPath ? { target: options.manifestPath } : {}),
    headline: {
      mode: "elements",
      elements: elements.length,
      textElements: withText.length,
      missing: report.missingLines.length,
      placeholders: report.placeholders.length,
      manifestLines: report.manifestLines,
      truncated: truncated.length,
      ...(report.invisibleLines.length > 0 ? { invisibleOnly: report.invisibleLines.length } : {}),
      ...(report.allowedInvisibleLines.length > 0 ? { allowedInvisible: report.allowedInvisibleLines.length } : {}),
      skippedRules: COPY_IMAGE_SKIPPED_RULES.length,
    },
  });
  return report;
}

/** Px of text beyond the element's own clip rect, or `null` when it fits (or cannot be known). */
function truncationOf(
  element: IntegrityImageElement,
): { clippedX: number; clippedY: number } | null {
  // Both fields required, deliberately. `textMeasured` alone says the string is wider than
  // its box, which on a canvas means it *overdraws* its neighbours — a collision, not a
  // truncation, and naming it "cut off" would send the reader after the wrong repair. Image
  // mode `check integrity` draws the same line for the same reason.
  if (!element.textMeasured || !element.clip) return null;
  const clippedX = Math.round(element.textMeasured.width - element.clip.width);
  const clippedY = Math.round(element.textMeasured.height - element.clip.height);
  if (clippedX < TRUNCATION_FLOOR && clippedY < TRUNCATION_FLOOR) return null;
  return { clippedX: Math.max(0, clippedX), clippedY: Math.max(0, clippedY) };
}

/**
 * Does the frame carry any ink inside this element's box?
 *
 * `off-frame` when the box does not intersect the image at all — an answer, not a finding
 * (see the module header). Otherwise `unpainted` iff every pixel in the intersection is the
 * same colour within `UNPAINTED_TOLERANCE`.
 */
function inkVerdict(image: PNG, element: IntegrityImageElement): "painted" | "unpainted" | "off-frame" {
  const box = element.clip ?? element;
  const x1 = Math.max(0, Math.floor(box.left));
  const y1 = Math.max(0, Math.floor(box.top));
  const x2 = Math.min(image.width, Math.ceil(box.left + box.width));
  const y2 = Math.min(image.height, Math.ceil(box.top + box.height));
  if (x2 - x1 < 1 || y2 - y1 < 1) return "off-frame";
  const min = [255, 255, 255];
  const max = [0, 0, 0];
  for (let y = y1; y < y2; y++) {
    for (let x = x1; x < x2; x++) {
      const offset = (y * image.width + x) * 4;
      for (let channel = 0; channel < 3; channel++) {
        const value = image.data[offset + channel]!;
        if (value < min[channel]!) min[channel] = value;
        if (value > max[channel]!) max[channel] = value;
      }
    }
  }
  const spread = Math.max(max[0]! - min[0]!, max[1]! - min[1]!, max[2]! - min[2]!);
  return spread > UNPAINTED_TOLERANCE ? "painted" : "unpainted";
}

