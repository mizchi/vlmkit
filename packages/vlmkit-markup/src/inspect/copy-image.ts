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
 * of the gate wants. The judgement lives in `@mizchi/vlmkit-judge`: `judgeSceneCopy` sorts
 * the scene's strings into seen and unseen with the page's own reason classes and hands them
 * to the same `analyzeCopy` the DOM path uses. This file only reads the files and the frame's
 * pixels. Same shape as `integrity-image.ts`: the DOM becomes one adapter among several
 * rather than the only way in.
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
 * Two of the gate's five rules cannot run at all here, and `copy-invisible` runs over the
 * reason classes the scene carries facts for (geometry always; `opacity`, a text `color` and
 * the frame's pixels each add classes; `unreachable` never). Those gaps are **named in the report** (`skippedRules`,
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
  SCENE_COPY_SKIPPED_RULES,
  judgeSceneCopy,
  parseSceneElements,
  type SceneCopyReport,
  type SceneCopyTruncation,
  type SceneElement,
  type SceneInkVerdict,
} from "@mizchi/vlmkit-judge/scene.ts";
import { type InvisibleReason, parseCopyManifest } from "./copy-check.ts";

export interface CopyImageOptions {
  elementsPath: string;
  /** Frame PNG. Optional: without it the ink check (unpainted text) cannot run. */
  imagePath?: string;
  manifestPath?: string;
  /** Copy that must be GONE (CLI `--forbid`) — text-only, so it works here too. */
  forbidPath?: string;
  /** Invisible-match reason classes to accept as satisfied (CLI `--allow-invisible`). */
  allowInvisible?: InvisibleReason[];
}

/** Rules this input cannot support, each with the reason. The judge's list, under its old name. */
export const COPY_IMAGE_SKIPPED_RULES: { rule: string; reason: string }[] = [...SCENE_COPY_SKIPPED_RULES];
export type CopyTruncation = SceneCopyTruncation;
export type CopyImageReport = SceneCopyReport;

/**
 * Max channel spread within a text bbox for the region to count as unpainted.
 *
 * Deliberately near-zero rather than an ink *ratio*: the claim being made is "no glyphs were
 * painted here at all", and a flat region is the only pixel evidence that supports it
 * without a font metric. Antialiased 8px text on a busy panel still spreads far more than 2
 * channel steps, so legible-but-faint copy is not reported. Same-colour-on-same-colour text
 * slips through here; `camouflage` catches it when the scene carries the colours.
 */
const UNPAINTED_TOLERANCE = 2;

export async function runImageCopyCheck(options: CopyImageOptions): Promise<CopyImageReport> {
  const elements = parseSceneElements(await readFile(options.elementsPath, "utf-8"));
  const image = options.imagePath ? PNG.sync.read(await readFile(options.imagePath)) : undefined;
  const forbiddenLines = options.forbidPath
    ? parseCopyManifest(await readFile(options.forbidPath, "utf8"))
    : undefined;
  const manifestLines = options.manifestPath
    ? parseCopyManifest(await readFile(options.manifestPath, "utf8"))
    : undefined;

  const report = judgeSceneCopy(elements, {
    source: options.imagePath ?? options.elementsPath,
    ...(manifestLines ? { manifestLines } : {}),
    ...(forbiddenLines ? { forbiddenLines } : {}),
    ...(options.allowInvisible ? { allowInvisible: options.allowInvisible } : {}),
    ...(image ? { ink: (element: SceneElement) => inkVerdict(image, element), inkSource: options.imagePath } : {}),
  });

  appendRunLedger({
    tool: "check-copy",
    source: options.imagePath ?? options.elementsPath,
    ...(options.manifestPath ? { target: options.manifestPath } : {}),
    headline: {
      mode: "elements",
      elements: report.elements,
      textElements: report.textElements,
      missing: report.missingLines.length,
      placeholders: report.placeholders.length,
      manifestLines: report.manifestLines,
      truncated: report.truncated.length,
      ...(report.invisibleLines.length > 0 ? { invisibleOnly: report.invisibleLines.length } : {}),
      ...(report.allowedInvisibleLines.length > 0 ? { allowedInvisible: report.allowedInvisibleLines.length } : {}),
      skippedRules: report.skippedRules.length,
    },
  });
  return report;
}

/**
 * Does the frame carry any ink inside this element's box?
 *
 * `off-frame` when the box does not intersect the image at all — an answer, not a finding
 * (see the module header). Otherwise `unpainted` iff every pixel in the intersection is the
 * same colour within `UNPAINTED_TOLERANCE`.
 */
function inkVerdict(image: PNG, element: SceneElement): SceneInkVerdict {
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
