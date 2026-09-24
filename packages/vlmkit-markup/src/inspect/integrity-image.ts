/**
 * `check integrity` without a DOM: a frame PNG plus an element-rect JSON.
 *
 * Requested in vlmkit#116 by a canvas/WebGPU game engine. In a canvas UI the DOM holds a
 * single `<canvas>` element, so every `getBoundingClientRect`-based rule finds nothing to
 * look at and the gate reports `clean` on a frame that may be visibly broken. The same
 * applies to native renderers (GLFW / SDL / wgpu), Flutter / Skia, and engine editor UIs.
 *
 * The measurement functions in `@mizchi/vlmkit-judge/integrity.ts` are reused unchanged —
 * the same ones the browser path in `integrity-check.ts` calls. They were already
 * pure over candidate structs — `findTextCollisions(IntegrityTextBlock[])`,
 * `judgeProtrusions(ProtrusionCandidate[])` and so on — so this file is an adapter, not a
 * second implementation of the rules. **That is the whole point: the DOM becomes one adapter
 * among several rather than the only way in.**
 *
 * Imported from the judge package rather than through `integrity-check.ts`, so this adapter
 * never loads the Playwright runner it has no use for.
 *
 * Since phase 2 of `docs/design/package-decomposition.md` the adapter itself lives there too,
 * as the **scene contract** (`@mizchi/vlmkit-judge/scene.ts`): the element shape, its parser
 * and every rule it can evaluate. This file is the part that touches the file system —
 * reading the elements file and the frame PNG — and keeps the names callers already import.
 * The paint fields (`color`, `background`, …) that unlock `invisible-text` and
 * `low-contrast-text` are documented on `SceneElement`.
 *
 * ## What it will not do
 *
 * Six of the gate's eighteen rules are evaluable from rects alone, eight when text elements
 * carry `color` and a `background` behind them. The rest need computed styles, a network log,
 * or a live page. This module **names the ones it skipped**
 * rather than omitting them, because a `clean` verdict that quietly covered a third of the
 * rules it usually covers is worth much less than it looks — the same reason `check story`
 * distinguishes `story-drift` (a finding) from `mount-failed` (nothing was measured).
 *
 * ## Parentage
 *
 * `path` is `tag[0]>tag[1]>…`, so containment relationships come from string prefixes and
 * need no CSS. One caveat, respected below: the DOM capture only records elements that carry
 * a class or are semantic, so a recorded path can skip levels and a node's true parent may be
 * absent from the input. What is derived is therefore the **nearest recorded ancestor**, and
 * the findings say so — claiming "parent" would be a claim the data cannot support.
 */
import { readFile } from "node:fs/promises";
import { PNG } from "pngjs";
import type { IntegrityReport } from "@mizchi/vlmkit-judge/integrity.ts";
import {
  describeElement,
  judgeSceneIntegrity,
  parseSceneElements,
  SCENE_SKIPPED_RULES_WITHOUT_PAINT,
  type SceneElement,
} from "@mizchi/vlmkit-judge/scene.ts";

/**
 * One element rect, as the caller's renderer knows it — the scene contract's element.
 * A superset of the `--elements-json` schema `diff png` already accepts.
 */
export type IntegrityImageElement = SceneElement;

export interface IntegrityImageOptions {
  /** Frame PNG. Optional: without it the ink-based degenerate-render rule cannot run. */
  imagePath?: string;
  elementsPath: string;
  maxFindings?: number;
  /**
   * Width reported on findings. Defaults to the image width, else the widest element
   * right edge — the rules take a viewport only to label findings.
   */
  viewport?: number;
}

/**
 * Rules an elements file without paint cannot support, each with the reason. With `color`
 * on text elements, `invisible-text` and `low-contrast-text` leave this list and run.
 */
export const IMAGE_MODE_SKIPPED_RULES: { rule: string; reason: string }[] = [...SCENE_SKIPPED_RULES_WITHOUT_PAINT];

export interface IntegrityImageReport extends IntegrityReport {
  /** Rules that did not run, and why. */
  skippedRules: { rule: string; reason: string }[];
  /** Rules that ran but had no input — e.g. no element carried `text`. */
  inertRules: { rule: string; reason: string }[];
}

export async function runImageIntegrityCheck(
  options: IntegrityImageOptions,
): Promise<IntegrityImageReport> {
  const elements = parseIntegrityImageElements(await readFile(options.elementsPath, "utf-8"));
  let image: { data: Uint8Array; width: number; height: number } | undefined;
  if (options.imagePath) {
    const png = PNG.sync.read(await readFile(options.imagePath));
    image = {
      data: new Uint8Array(png.data.buffer, png.data.byteOffset, png.data.byteLength),
      width: png.width,
      height: png.height,
    };
  }
  const judged = judgeSceneIntegrity(elements, {
    image,
    maxFindings: options.maxFindings,
    viewport: options.viewport,
  });
  return { source: options.imagePath ?? options.elementsPath, ...judged };
}

/** `.class`, then `#id`, then `tag`, then the path. See `describeElement`. */
export const describe: (element: IntegrityImageElement) => string = describeElement;

/**
 * Parse the elements file. Accepts `{elements:[…]}` or a bare array, and both
 * `snake_case` and `camelCase` for the optional fields.
 */
export const parseIntegrityImageElements: (source: string) => IntegrityImageElement[] = parseSceneElements;
