/**
 * `check integrity` without a DOM: a frame PNG plus an element-rect JSON.
 *
 * Requested in vlmkit#116 by a canvas/WebGPU game engine. In a canvas UI the DOM holds a
 * single `<canvas>` element, so every `getBoundingClientRect`-based rule finds nothing to
 * look at and the gate reports `clean` on a frame that may be visibly broken. The same
 * applies to native renderers (GLFW / SDL / wgpu), Flutter / Skia, and engine editor UIs.
 *
 * The measurement functions in `integrity-check.ts` are reused unchanged. They were already
 * pure over candidate structs — `findTextCollisions(IntegrityTextBlock[])`,
 * `judgeProtrusions(ProtrusionCandidate[])` and so on — so this file is an adapter, not a
 * second implementation of the rules. **That is the whole point: the DOM becomes one adapter
 * among several rather than the only way in.**
 *
 * ## What it will not do
 *
 * Six of the gate's eighteen rules are evaluable from this input. The other twelve need
 * computed styles, a network log, or a live page. This module **names the ones it skipped**
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
import {
  type AlignmentGroup,
  type ClipCandidate,
  type CollapseCandidate,
  type IntegrityExemption,
  type IntegrityFinding,
  type IntegrityReport,
  type IntegrityTextBlock,
  type ProtrusionCandidate,
  findTextCollisions,
  judgeAlignment,
  judgeClippedText,
  judgeCollapsedContainers,
  judgeProtrusions,
  measureInkRatio,
} from "./integrity-check.ts";

/**
 * One element rect, as the caller's renderer knows it.
 *
 * A superset of the `--elements-json` schema `diff png` already accepts, so an engine that
 * emits that shape can pass the same file here. Everything past the six required geometry
 * fields is optional and unlocks a specific rule — stated per field, because "add more
 * fields and more things happen" is not a contract anyone can plan against.
 */
export interface IntegrityImageElement {
  path: string;
  tag: string;
  id?: string;
  classes?: string;
  top: number;
  left: number;
  width: number;
  height: number;
  /** Text drawn in this element. Required for text-collision and text-clipped. */
  text?: string;
  /**
   * The text's measured extent, which only the renderer can know. With it,
   * text-clipped can fire; without it, a caller gets no clipping analysis rather than a
   * guess from glyph counts.
   */
  textMeasured?: { width: number; height: number };
  /** Clip rect applied to this element, if any. Defaults to the element's own box. */
  clip?: { top: number; left: number; width: number; height: number };
  /** On a separate compositing layer. Overlapping layers are not collisions. */
  overlay?: boolean;
  /** Stacking order. Blocks on different z are layered, not colliding. */
  zIndex?: number;
  /** Decorative / not announced. Excluded from text rules, like `aria-hidden`. */
  ariaHidden?: boolean;
}

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

/** Rules this input cannot support, each with the reason. Reported, not hidden. */
export const IMAGE_MODE_SKIPPED_RULES: { rule: string; reason: string }[] = [
  { rule: "js-error", reason: "needs a live page's console" },
  { rule: "broken-image", reason: "needs the network log" },
  { rule: "failed-stylesheet", reason: "needs the network log" },
  { rule: "broken-font", reason: "needs the network log" },
  { rule: "redirected", reason: "needs the navigation result" },
  { rule: "unstyled-page", reason: "needs computed styles" },
  { rule: "page-overflow-x", reason: "needs the document scroll size" },
  { rule: "clipped-content", reason: "needs overflow computed styles" },
  { rule: "nested-scroll", reason: "needs overflow computed styles" },
  { rule: "invisible-text", reason: "needs computed color / opacity / visibility" },
  { rule: "low-contrast-text", reason: "needs computed text and background colors" },
  { rule: "occluded-text", reason: "needs paint order, which element rects do not carry" },
];

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
  const maxFindings = options.maxFindings ?? 12;

  let image: { data: Uint8Array; width: number; height: number } | undefined;
  if (options.imagePath) {
    const png = PNG.sync.read(await readFile(options.imagePath));
    image = {
      data: new Uint8Array(png.data.buffer, png.data.byteOffset, png.data.byteLength),
      width: png.width,
      height: png.height,
    };
  }

  const viewport = options.viewport
    ?? image?.width
    ?? Math.max(0, ...elements.map((e) => e.left + e.width));

  const findings: IntegrityFinding[] = [];
  const exempted: IntegrityExemption[] = [];
  const inertRules: { rule: string; reason: string }[] = [];

  // --- degenerate render (the one rule that reads pixels) ---
  const inkRatio = image ? measureInkRatio(image.data, image.width, image.height) : 0;
  if (!image) {
    inertRules.push({ rule: "degenerate-render", reason: "no --image given" });
  } else if (elements.length === 0 && inkRatio < 0.001) {
    findings.push({
      kind: "degenerate-render",
      severity: "fail",
      viewport,
      message: `The frame contains no elements and almost no ink (ink ratio ${(inkRatio * 100).toFixed(2)}%) — nothing but background painted.`,
      evidence: { inkRatio, elements: 0 },
    });
  }

  const withText = elements.filter((e) => (e.text ?? "").trim().length > 0);

  // --- text collision ---
  if (withText.length < 2) {
    inertRules.push({
      rule: "text-collision",
      reason: withText.length === 0
        ? "no element carried `text`"
        : "only one element carried `text`; a collision needs two",
    });
  } else {
    const collisions = findTextCollisions(withText.map(toTextBlock), viewport, { maxFindings });
    findings.push(...collisions.findings);
    exempted.push(...collisions.exempted);
  }

  // --- text clipped ---
  //
  // Requires an explicit `clip` rect, not just an oversized text extent. In a DOM the
  // clip comes from `overflow: hidden|clip` and the amount from `scrollWidth -
  // clientWidth`; on a canvas, text drawn wider than its box is not clipped at all — it
  // *overdraws*, which is what the collision and protrusion rules are for. Treating the
  // element's own box as a clip rect reported a label whose 90px of text sat in a 180px
  // box as "cutting off 40px", which is the opposite of true.
  const clipCandidates = withText
    .filter((element) => element.textMeasured && element.clip)
    .map(toClipCandidate)
    .filter(isMeaningfullyClipped);
  if (clipCandidates.length === 0) {
    inertRules.push({
      rule: "text-clipped",
      reason: withText.some((e) => e.textMeasured)
        ? "no element declared a `clip` rect its text exceeds; oversized text without a clip overdraws rather than clipping"
        : "no element carried both `text` and `textMeasured`; the renderer must supply the measured extent",
    });
  } else {
    const clipped = judgeClippedText(clipCandidates, viewport, maxFindings);
    findings.push(...clipped.findings);
    exempted.push(...clipped.exempted);
  }

  // --- protrusion and collapse, both from nearest recorded ancestor ---
  const byPath = new Map(elements.map((element) => [element.path, element]));
  const protrusions: ProtrusionCandidate[] = [];
  const collapseByPath = new Map<string, CollapseCandidate>();
  for (const element of elements) {
    const ancestor = nearestRecordedAncestor(element, byPath);
    if (!ancestor) continue;
    collectCollapse(element, ancestor, collapseByPath);
    const overflow = protrusionAmount(element, ancestor);
    if (overflow) {
      protrusions.push({
        parent: describe(ancestor),
        child: describe(element),
        amount: overflow.amount,
        axis: overflow.axis,
        // No computed styles, so neither exemption can be established. Both default to
        // false, which means an intentionally-positioned badge WILL be reported here —
        // set `overlay` on the element to opt it out.
        positioned: element.overlay === true,
        negBreakout: false,
      });
    }
  }
  if (protrusions.length === 0) {
    inertRules.push({ rule: "container-protrusion", reason: "no element exceeded its nearest recorded ancestor's box" });
  } else {
    const judged = judgeProtrusions(protrusions, viewport, maxFindings);
    findings.push(...judged.findings);
    exempted.push(...judged.exempted);
  }

  const collapsed = judgeCollapsedContainers([...collapseByPath.values()], viewport);
  findings.push(...collapsed.findings);
  exempted.push(...collapsed.exempted);

  // --- near-misalignment: siblings share a parent path prefix ---
  const groups = alignmentGroups(elements, byPath);
  if (groups.length === 0) {
    inertRules.push({ rule: "near-misalignment", reason: "no recorded ancestor had two or more recorded children" });
  } else {
    findings.push(...judgeAlignment(groups, viewport, Math.min(maxFindings, 8)));
  }

  return {
    source: options.imagePath ?? options.elementsPath,
    verdict: findings.some((f) => f.severity === "fail") ? "defects" : "clean",
    findings,
    exempted,
    viewports: [{
      width: image?.width ?? viewport,
      height: image?.height ?? Math.max(0, ...elements.map((e) => e.top + e.height)),
      components: elements.length,
      inkRatio,
      textBlocks: withText.length,
    }],
    kickback: findings.map((f) => `${f.kind}${f.selector ? ` (${f.selector})` : ""}: ${f.message}`),
    skippedRules: IMAGE_MODE_SKIPPED_RULES,
    inertRules,
  };
}

/**
 * The browser collector's thresholds, replicated so the two adapters agree.
 *
 * `judgeCollapsedContainers` has no height check of its own — it trusts the caller to have
 * filtered to containers that actually collapsed. The first version of this adapter passed
 * every ancestor and reported a 360px-tall root as "collapsed" because it held 40px
 * children; the judge had no way to know better.
 */
const COLLAPSE_MAX_HEIGHT = 4;
const COLLAPSE_MIN_CHILD_HEIGHT = 24;

function collectCollapse(
  element: IntegrityImageElement,
  ancestor: IntegrityImageElement,
  into: Map<string, CollapseCandidate>,
): void {
  if (ancestor.height > COLLAPSE_MAX_HEIGHT || ancestor.width <= 0) return;
  if (element.height < COLLAPSE_MIN_CHILD_HEIGHT) return;
  const existing = into.get(ancestor.path) ?? {
    selector: describe(ancestor),
    height: ancestor.height,
    tallestChild: 0,
    anyInFlowChild: false,
    overflowHidden: false,
  };
  if (element.height > existing.tallestChild) existing.tallestChild = element.height;
  if (element.overlay !== true) existing.anyInFlowChild = true;
  into.set(ancestor.path, existing);
}

function toTextBlock(element: IntegrityImageElement): IntegrityTextBlock {
  return {
    selector: describe(element),
    text: element.text ?? "",
    x: element.left,
    y: element.top,
    width: element.width,
    height: element.height,
    overlay: element.overlay === true,
    zIndex: element.zIndex ?? 0,
    ariaHidden: element.ariaHidden === true,
    // No font metrics without a DOM. 0 means "shrink the box by nothing", which is the
    // same default the DOM path uses when canvas metrics were unavailable.
    inkInset: 0,
  };
}

/**
 * `clipX` / `clipY` are **amounts clipped in px**, not the clip rect's origin.
 *
 * The DOM path computes them as `scrollWidth - clientWidth`, and `judgeClippedText`
 * interpolates them straight into "cuts off Npx of text". Passing the rect's `left`/`top`
 * instead produced a message that read like a measurement and was not one: a label at
 * `left: 16` was reported as "cuts off 16px".
 */
function toClipCandidate(element: IntegrityImageElement): ClipCandidate {
  const clip = element.clip!;
  const measured = element.textMeasured!;
  const clipX = Math.max(0, Math.round(measured.width - clip.width));
  const clipY = Math.max(0, Math.round(measured.height - clip.height));
  const visibleWidth = Math.max(0, Math.min(measured.width, clip.width));
  const visibleHeight = Math.max(0, Math.min(measured.height, clip.height));
  return {
    selector: describe(element),
    text: element.text ?? "",
    clipX,
    clipY,
    // Neither is knowable without CSS. Empty means "no ellipsis declared", so a genuinely
    // clipped string is reported rather than excused — the safe direction for a gate.
    textOverflow: "",
    lineClamp: "",
    textVisibleArea: visibleWidth * visibleHeight,
    srOnlyShaped: element.width <= 2 && element.height <= 2,
    replacement: false,
  };
}

/**
 * The DOM collector's threshold, replicated: `clipX < 4 && clipY < max(4, lineHeight*0.6)`
 * is not a clip worth reporting. `judgeClippedText` has no such check — it reports every
 * candidate handed to it — so without this filter every clipped-or-not label became a
 * finding.
 */
function isMeaningfullyClipped(candidate: ClipCandidate): boolean {
  const lineHeight = Math.max(1, candidate.textVisibleArea > 0 ? candidate.clipY + 1 : 1);
  return candidate.clipX >= 4 || candidate.clipY >= Math.max(4, lineHeight * 0.6);
}

/**
 * The longest recorded path that is a strict prefix of this element's.
 *
 * Not "the parent": the capture skips uninteresting nodes, so the true parent may not be in
 * the input. Callers get the closest thing the data supports, and the finding text says
 * "nearest recorded ancestor" so nobody reads more into it.
 */
function nearestRecordedAncestor(
  element: IntegrityImageElement,
  byPath: Map<string, IntegrityImageElement>,
): IntegrityImageElement | undefined {
  const segments = element.path.split(">");
  for (let cut = segments.length - 1; cut > 0; cut--) {
    const candidate = byPath.get(segments.slice(0, cut).join(">"));
    if (candidate) return candidate;
  }
  return undefined;
}

function protrusionAmount(
  child: IntegrityImageElement,
  parent: IntegrityImageElement,
): { amount: number; axis: "horizontal" | "vertical" } | null {
  const right = (child.left + child.width) - (parent.left + parent.width);
  const left = parent.left - child.left;
  const bottom = (child.top + child.height) - (parent.top + parent.height);
  const top = parent.top - child.top;
  const horizontal = Math.max(right, left);
  const vertical = Math.max(bottom, top);
  const amount = Math.max(horizontal, vertical);
  if (amount <= 0) return null;
  return { amount, axis: horizontal >= vertical ? "horizontal" : "vertical" };
}

function alignmentGroups(
  elements: IntegrityImageElement[],
  byPath: Map<string, IntegrityImageElement>,
): AlignmentGroup[] {
  const children = new Map<string, IntegrityImageElement[]>();
  for (const element of elements) {
    const ancestor = nearestRecordedAncestor(element, byPath);
    if (!ancestor) continue;
    const list = children.get(ancestor.path) ?? [];
    list.push(element);
    children.set(ancestor.path, list);
  }
  const groups: AlignmentGroup[] = [];
  for (const [parentPath, list] of children) {
    if (list.length < 2) continue;
    groups.push({
      parent: describe(byPath.get(parentPath)!),
      children: list.map((element) => ({
        selector: describe(element),
        left: element.left,
        right: element.left + element.width,
        centerX: element.left + element.width / 2,
        top: element.top,
      })),
    });
  }
  return groups;
}

/**
 * A stable label for an element.
 *
 * `.class` then `#id` then `tag`, matching `selectorForElement` in
 * `region-selector-match.ts`, so the same element reads the same way whether it surfaced
 * through `diff png --elements-json` or here. Falls back to the path, which is always
 * present and always unique.
 */
function describe(element: IntegrityImageElement): string {
  const className = (element.classes ?? "").split(/\s+/).find((token) => /^-?[A-Za-z_][\w-]*$/.test(token));
  if (className) return `.${className}`;
  if (element.id && /^-?[A-Za-z_][\w-]*$/.test(element.id)) return `#${element.id}`;
  if (/^[A-Za-z][\w-]*$/.test(element.tag)) return element.tag;
  return element.path;
}

/**
 * Parse the elements file.
 *
 * Accepts `{elements:[…]}` or a bare array, like `diff png --elements-json`, and both
 * `snake_case` and `camelCase` for the optional fields — the reporting engine writes JSON
 * from a non-JS language, and rejecting `text_measured` would be a gratuitous obstacle.
 */
export function parseIntegrityImageElements(source: string): IntegrityImageElement[] {
  const parsed: unknown = JSON.parse(source);
  const rows = Array.isArray(parsed)
    ? parsed
    : (parsed as { elements?: unknown })?.elements;
  if (!Array.isArray(rows)) {
    throw new Error("elements JSON must be an array or an object with an `elements` array");
  }
  const out: IntegrityImageElement[] = [];
  for (const [index, row] of rows.entries()) {
    if (typeof row !== "object" || row === null) continue;
    const record = row as Record<string, unknown>;
    const path = str(record.path);
    const numbers = ["top", "left", "width", "height"].map((key) => num(record[key]));
    if (!path || numbers.some((value) => value === undefined)) {
      // A row missing geometry cannot be placed, and silently dropping it would make a
      // typo look like a clean frame.
      throw new Error(
        `elements[${index}] needs path/top/left/width/height (got ${JSON.stringify(record).slice(0, 120)})`,
      );
    }
    const [top, left, width, height] = numbers as [number, number, number, number];
    const measured = record.textMeasured ?? record.text_measured;
    const element: IntegrityImageElement = {
      path,
      tag: str(record.tag) ?? "node",
      top, left, width, height,
      ...(str(record.id) ? { id: str(record.id)! } : {}),
      ...(str(record.classes) ? { classes: str(record.classes)! } : {}),
      ...(str(record.text) !== undefined ? { text: str(record.text)! } : {}),
      ...(parseBox(measured) ? { textMeasured: parseBox(measured)! } : {}),
      ...(parseRect(record.clip) ? { clip: parseRect(record.clip)! } : {}),
      ...(record.overlay === true ? { overlay: true } : {}),
      ...(num(record.zIndex ?? record.z_index) !== undefined
        ? { zIndex: num(record.zIndex ?? record.z_index)! }
        : {}),
      ...((record.ariaHidden ?? record.aria_hidden) === true ? { ariaHidden: true } : {}),
    };
    out.push(element);
  }
  return out;
}

function str(value: unknown): string | undefined {
  return typeof value === "string" ? value : undefined;
}

function num(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

function parseBox(value: unknown): { width: number; height: number } | undefined {
  if (typeof value !== "object" || value === null) return undefined;
  const record = value as Record<string, unknown>;
  const width = num(record.width);
  const height = num(record.height);
  return width !== undefined && height !== undefined ? { width, height } : undefined;
}

function parseRect(
  value: unknown,
): { top: number; left: number; width: number; height: number } | undefined {
  if (typeof value !== "object" || value === null) return undefined;
  const record = value as Record<string, unknown>;
  const parts = ["top", "left", "width", "height"].map((key) => num(record[key]));
  if (parts.some((part) => part === undefined)) return undefined;
  const [top, left, width, height] = parts as [number, number, number, number];
  return { top, left, width, height };
}
