/**
 * The scene contract: one flat list of rendered elements, from any renderer.
 *
 * A browser is one source of this list; a canvas / WebGPU engine, a native toolkit or a
 * game's scene graph is another. The judges in this package never see which. The shape is
 * the `--elements` JSON that `vlmkit check integrity` and `vlmkit check copy` already accept
 * in image mode (itself a superset of `diff png --elements-json`), so an engine that emits
 * that file already speaks the contract. Everything past the six geometry fields is optional,
 * and each optional field unlocks named rules rather than "more checks, somehow".
 *
 * **The collector resolves, the judge decides.** Fields hold facts a renderer knows —
 * rects, the RGBA it paints with, font size — never conclusions such as a contrast ratio.
 * The arithmetic that turns facts into verdicts lives here (`color.ts`), so a browser and an
 * engine reporting the same pixels get the same finding.
 *
 * Containment comes from `path` prefixes (`hud[0]>bar[0]`). A capture may omit
 * uninteresting nodes, so what is derived is the **nearest recorded ancestor**, and findings
 * say so rather than claiming a parent the data cannot prove.
 */
import { UsageError } from "./errors.ts";
import { blendColor, compositeBackground, parseColor, toHex, type Rgb, type Rgba } from "./color.ts";
import type { CompositionBox, CompositionInput } from "./composition.ts";
import type { ColorRolesInput, ColorUse, ControlSample, LinkSample } from "./color-roles.ts";
import type { DesignPolicyInput, DesignSpacingSample, DesignStyleSample } from "./design-policy.ts";
import {
  findTextCollisions,
  judgeAlignment,
  judgeClippedText,
  judgeCollapsedContainers,
  judgeProtrusions,
  judgeTextContrast,
  measureInkRatio,
  textContrastCandidates,
  type AlignmentGroup,
  type ClipCandidate,
  type CollapseCandidate,
  type ContrastCandidate,
  type IntegrityExemption,
  type IntegrityFinding,
  type IntegrityReport,
  type IntegrityTextBlock,
  type ProtrusionCandidate,
  type TextContrastSample,
} from "./integrity.ts";

/** One element, as the renderer that drew it knows it. Coordinates are frame pixels. */
export interface SceneElement {
  /** `name[index]>name[index]…` — unique, and the source of containment. */
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
  /** Clip rect applied to this element, if any. */
  clip?: { top: number; left: number; width: number; height: number };
  /** On a separate compositing layer. Overlapping layers are not collisions. */
  overlay?: boolean;
  /** Stacking order. Blocks on different z are layered, not colliding. */
  zIndex?: number;
  /** Decorative / not announced. Excluded from text rules, like `aria-hidden`. */
  ariaHidden?: boolean;

  // --- paint: unlocks invisible-text and low-contrast-text -------------------------
  /** Resolved text colour: `rgb()`, `rgba()` or `#hex`. */
  color?: string;
  /** Resolved background fill of this element's own box, if it paints one. */
  background?: string;
  /**
   * Something non-uniform is painted behind this element (an image, a gradient, a
   * video). Contrast against it is a pixel question, so it is refused and counted, never
   * guessed.
   */
  backgroundImage?: boolean;
  /** This element's own opacity, 0-1. Multiplied down the recorded ancestor chain. */
  opacity?: number;
  /** A text shadow may carry the contrast the fill lacks; such text is exempted. */
  textShadow?: boolean;
  /** Disabled control: reduced contrast is the platform convention; exempted. */
  disabled?: boolean;

  // --- type: sets the WCAG floor, and feeds composition ---------------------------
  /** px. Default 16. */
  fontSize?: number;
  /** 100-900. Default 400. */
  fontWeight?: number;
  /** 1-6 for a heading, else absent. Also read from an `h1`-`h6` tag. */
  heading?: number;
  /** Border width, px. A painted border groups its contents (composition). */
  border?: number;
  /** Corner radius, px. */
  radius?: number;
  /** px: one number for all four sides, or `[top, right, bottom, left]`. Part of the style signature `check design` compares. */
  padding?: number | [number, number, number, number];

  // --- role: unlocks check color's two WCAG rules ---------------------------------
  /**
   * What the element is for, which only the scene's author knows — a DOM infers it from
   * the tag, a canvas has no tags. `field`: a text control whose extent is the affordance
   * (WCAG 1.4.11 reads its boundary). `link`: a link inside a flow of prose, the flow being
   * its nearest recorded ancestor (WCAG 1.4.1 compares their inks) and the flow's own `text`
   * — without the link's — being the prose it counts. `button`: interactive,
   * counted in the interactive ink but judged by neither rule.
   *
   * `check design` reads the role too, as the DOM path reads an ARIA role: elements that
   * share one are expected to share a style. Any string groups there (`card`, `tab`, …);
   * only the three above mean anything to `check color`.
   */
  role?: string;
  /** Resolved colour of the border `border` px wide. A field's strongest drawn edge. */
  borderColor?: string;
  /** A link's non-colour cue. */
  underline?: boolean;
  /** A field draws its edge with a shadow or a painted outline instead of a border. */
  shadow?: boolean;
  outline?: boolean;
}

// ---------------------------------------------------------------------------
// Reading

/**
 * Parse an elements file's text (or an already-parsed value).
 *
 * Accepts `{elements:[…]}` or a bare array, and both `snake_case` and `camelCase` for the
 * optional fields — the reporting engine writes JSON from a non-JS language, and rejecting
 * `text_measured` would be a gratuitous obstacle.
 */
export function parseSceneElements(source: string | unknown): SceneElement[] {
  const parsed: unknown = typeof source === "string" ? JSON.parse(source) : source;
  const rows = Array.isArray(parsed)
    ? parsed
    : (parsed as { elements?: unknown })?.elements;
  if (!Array.isArray(rows)) {
    throw new UsageError("elements JSON must be an array or an object with an `elements` array");
  }
  const out: SceneElement[] = [];
  for (const [index, row] of rows.entries()) {
    if (typeof row !== "object" || row === null) continue;
    const record = row as Record<string, unknown>;
    const pick = (camel: string, snake: string): unknown => record[camel] ?? record[snake];
    const path = str(record.path);
    const numbers = ["top", "left", "width", "height"].map((key) => num(record[key]));
    if (!path || numbers.some((value) => value === undefined)) {
      // A row missing geometry cannot be placed, and silently dropping it would make a
      // typo look like a clean frame.
      throw new UsageError(
        `elements[${index}] needs path/top/left/width/height (got ${JSON.stringify(record).slice(0, 120)})`,
      );
    }
    const [top, left, width, height] = numbers as [number, number, number, number];
    const measured = pick("textMeasured", "text_measured");
    const element: SceneElement = {
      path,
      tag: str(record.tag) ?? "node",
      top, left, width, height,
      ...(str(record.id) ? { id: str(record.id)! } : {}),
      ...(str(record.classes) ? { classes: str(record.classes)! } : {}),
      ...(str(record.text) !== undefined ? { text: str(record.text)! } : {}),
      ...(parseBox(measured) ? { textMeasured: parseBox(measured)! } : {}),
      ...(parseRect(record.clip) ? { clip: parseRect(record.clip)! } : {}),
      ...(record.overlay === true ? { overlay: true } : {}),
      ...(num(pick("zIndex", "z_index")) !== undefined ? { zIndex: num(pick("zIndex", "z_index"))! } : {}),
      ...(pick("ariaHidden", "aria_hidden") === true ? { ariaHidden: true } : {}),
      ...(str(record.color) ? { color: str(record.color)! } : {}),
      ...(str(record.background) ? { background: str(record.background)! } : {}),
      ...(pick("backgroundImage", "background_image") === true ? { backgroundImage: true } : {}),
      ...(num(record.opacity) !== undefined ? { opacity: num(record.opacity)! } : {}),
      ...(pick("textShadow", "text_shadow") === true ? { textShadow: true } : {}),
      ...(record.disabled === true ? { disabled: true } : {}),
      ...(num(pick("fontSize", "font_size")) !== undefined ? { fontSize: num(pick("fontSize", "font_size"))! } : {}),
      ...(num(pick("fontWeight", "font_weight")) !== undefined ? { fontWeight: num(pick("fontWeight", "font_weight"))! } : {}),
      ...(num(record.heading) !== undefined ? { heading: num(record.heading)! } : {}),
      ...(num(record.border) !== undefined ? { border: num(record.border)! } : {}),
      ...(num(record.radius) !== undefined ? { radius: num(record.radius)! } : {}),
      ...(str(record.role) ? { role: str(record.role)! } : {}),
      ...(parsePadding(record.padding) ? { padding: parsePadding(record.padding)! } : {}),
      ...(str(pick("borderColor", "border_color")) ? { borderColor: str(pick("borderColor", "border_color"))! } : {}),
      ...(record.underline === true ? { underline: true } : {}),
      ...(record.shadow === true ? { shadow: true } : {}),
      ...(record.outline === true ? { outline: true } : {}),
    };
    for (const key of ["color", "background", "borderColor"] as const) {
      const value = element[key];
      if (value !== undefined && parseColor(value) === null) {
        throw new UsageError(
          `elements[${index}].${key} is "${value}", which is not a resolved colour — give rgb()/rgba()/#hex.`
          + " Resolving oklch()/lab()/named colours is the renderer's job, so the judge never guesses a second answer.",
        );
      }
    }
    out.push(element);
  }
  return out;
}

/** One node of an engine-style tree: position local to the parent, children nested. */
export interface SceneNode extends Partial<Omit<SceneElement, "path" | "top" | "left" | "width" | "height">> {
  name: string;
  x: number;
  y: number;
  width: number;
  height: number;
  children?: SceneNode[];
}

/**
 * Flatten a scene graph whose positions are local to the parent — the way an engine stores
 * them — into the flat, frame-space list the judges read. Paths are `name[i]` segments,
 * where `i` counts same-named siblings, so two `row`s stay distinct.
 */
export function sceneFromTree(root: SceneNode): SceneElement[] {
  const out: SceneElement[] = [];
  const walk = (node: SceneNode, originX: number, originY: number, path: string): void => {
    const { name, x, y, width, height, children, ...rest } = node;
    const left = originX + x;
    const top = originY + y;
    out.push({ tag: name, ...rest, path, left, top, width, height });
    const seen = new Map<string, number>();
    for (const child of children ?? []) {
      const i = seen.get(child.name) ?? 0;
      seen.set(child.name, i + 1);
      walk(child, left, top, `${path}>${child.name}[${i}]`);
    }
  };
  walk(root, 0, 0, `${root.name}[0]`);
  return out;
}

/**
 * A stable label for an element.
 *
 * `.class` then `#id` then `tag`, matching `selectorForElement` in
 * `region-selector-match.ts`, so the same element reads the same way whether it surfaced
 * through `diff png --elements-json` or here. Falls back to the path, which is always
 * present and always unique.
 */
export function describeElement(element: SceneElement): string {
  const className = (element.classes ?? "").split(/\s+/).find((token) => /^-?[A-Za-z_][\w-]*$/.test(token));
  if (className) return `.${className}`;
  if (element.id && /^-?[A-Za-z_][\w-]*$/.test(element.id)) return `#${element.id}`;
  if (/^[A-Za-z][\w-]*$/.test(element.tag)) return element.tag;
  return element.path;
}

/**
 * The longest recorded path that is a strict prefix of this element's.
 *
 * Not "the parent": the capture skips uninteresting nodes, so the true parent may not be in
 * the input. Callers get the closest thing the data supports.
 */
export function nearestRecordedAncestor(
  element: SceneElement,
  byPath: ReadonlyMap<string, SceneElement>,
): SceneElement | undefined {
  const segments = element.path.split(">");
  for (let cut = segments.length - 1; cut > 0; cut--) {
    const candidate = byPath.get(segments.slice(0, cut).join(">"));
    if (candidate) return candidate;
  }
  return undefined;
}

// ---------------------------------------------------------------------------
// check integrity

/**
 * Every rule an elements file without paint cannot evaluate, each with the reason, in the
 * order the report has always listed them. Reported, not hidden: a `clean` verdict is only
 * worth what it rules out.
 */
export const SCENE_SKIPPED_RULES_WITHOUT_PAINT: readonly { rule: string; reason: string }[] = [
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

/**
 * The two contrast rules run once any text element carries `color`, so they leave the
 * skipped list only then — an elements file written before the paint fields existed
 * reports exactly what it always did.
 */
const CONTRAST_RULES = new Set(["invisible-text", "low-contrast-text"]);

/** What a scene with paint still cannot evaluate. */
export const SCENE_SKIPPED_RULES_WITH_PAINT: readonly { rule: string; reason: string }[] =
  SCENE_SKIPPED_RULES_WITHOUT_PAINT.filter((r) => !CONTRAST_RULES.has(r.rule));

export interface SceneIntegrityOptions {
  /** Frame pixels (RGBA). Without them the ink-based degenerate-render rule cannot run. */
  image?: { data: Uint8Array; width: number; height: number };
  maxFindings?: number;
  /**
   * Width reported on findings. Defaults to the image width, else the widest element
   * right edge — the rules take a viewport only to label findings.
   */
  viewport?: number;
}

export interface SceneIntegrityReport extends Omit<IntegrityReport, "source"> {
  /** Rules that did not run, and why. */
  skippedRules: { rule: string; reason: string }[];
  /** Rules that ran but had no input — e.g. no element carried `text`. */
  inertRules: { rule: string; reason: string }[];
}

/** Every `check integrity` rule a scene can support, judged in one pass. */
export function judgeSceneIntegrity(
  elements: readonly SceneElement[],
  options: SceneIntegrityOptions = {},
): SceneIntegrityReport {
  const maxFindings = options.maxFindings ?? 12;
  const image = options.image;
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
        parent: describeElement(ancestor),
        child: describeElement(element),
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

  // --- invisible-text / low-contrast-text, when the scene carries paint ---
  const painted = withText.filter((e) => e.color !== undefined);
  const skippedRules = [...(painted.length === 0 ? SCENE_SKIPPED_RULES_WITHOUT_PAINT : SCENE_SKIPPED_RULES_WITH_PAINT)];
  if (painted.length > 0) {
    const contrast = sceneContrastCandidates(painted, byPath, viewport);
    exempted.push(...contrast.refused);
    if (contrast.measured === 0) {
      for (const rule of CONTRAST_RULES) {
        inertRules.push({
          rule,
          reason: `${painted.length} element(s) carried \`color\`, but none had an opaque \`background\` on itself or a recorded ancestor — nothing to measure against`,
        });
      }
    }
    const judged = judgeTextContrast(contrast.candidates, contrast.composite, viewport, maxFindings);
    findings.push(...judged.findings);
    exempted.push(...judged.exempted);
  }

  return {
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
    skippedRules,
    inertRules,
  };
}

/**
 * `COLLECT_TEXT_CONTRAST`, over a scene instead of a live page: each painted text element as
 * a `TextContrastSample`, then the same `textContrastCandidates` the page's samples go
 * through — one loop, one cap, one floor, whichever renderer drew the frame.
 *
 * The one deliberate difference: the page composites a missing background over white,
 * because white IS what a browser paints under an unpainted document. A scene has no such
 * default — an engine's clear colour is whatever it is — so a text element with no opaque
 * background on itself or a recorded ancestor is refused, with the reason, rather than
 * measured against a white the frame may not contain.
 */
export function sceneContrastCandidates(
  painted: readonly SceneElement[],
  byPath: ReadonlyMap<string, SceneElement>,
  viewport: number,
): { candidates: ContrastCandidate[]; composite: number; measured: number; refused: IntegrityExemption[] } {
  const samples: TextContrastSample[] = [];
  const refused: IntegrityExemption[] = [];
  for (const element of painted) {
    if (element.opacity === 0) continue;
    if (element.width <= 2 || element.height <= 2) continue;
    const selector = describeElement(element);
    const text = (element.text ?? "").replace(/\s+/g, " ").trim().slice(0, 60);
    const backgrounds: Rgba[] = [];
    let opacity = 1;
    let opaque = false;
    let image = false;
    for (let node: SceneElement | undefined = element; node; node = nearestRecordedAncestor(node, byPath)) {
      opacity *= node.opacity ?? 1;
      if (opaque) continue;
      if (node.backgroundImage) { image = true; break; }
      const bg = node.background !== undefined ? parseColor(node.background) : null;
      if (bg && bg[3] > 0) backgrounds.push(bg);
      if (bg && bg[3] >= 1) opaque = true;
    }
    if (image) { samples.push({ selector, text, composite: true }); continue; }
    if (!opaque) {
      refused.push({
        kind: "low-contrast-text",
        viewport,
        selector,
        reason: "no opaque `background` on this element or a recorded ancestor — a scene has no default canvas colour, so the contrast is not measured",
      });
      continue;
    }
    samples.push({
      selector,
      text,
      color: parseColor(element.color) ?? [0, 0, 0, 1],
      backgrounds,
      opacity,
      fontSizePx: element.fontSize,
      fontWeight: element.fontWeight,
      disabled: element.disabled === true,
      shadowed: element.textShadow === true,
    });
  }
  const { candidates, skippedComposite } = textContrastCandidates(samples);
  return {
    candidates,
    composite: skippedComposite,
    measured: samples.filter((sample) => !sample.composite).length,
    refused,
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
  element: SceneElement,
  ancestor: SceneElement,
  into: Map<string, CollapseCandidate>,
): void {
  if (ancestor.height > COLLAPSE_MAX_HEIGHT || ancestor.width <= 0) return;
  if (element.height < COLLAPSE_MIN_CHILD_HEIGHT) return;
  const existing = into.get(ancestor.path) ?? {
    selector: describeElement(ancestor),
    height: ancestor.height,
    tallestChild: 0,
    anyInFlowChild: false,
    overflowHidden: false,
  };
  if (element.height > existing.tallestChild) existing.tallestChild = element.height;
  if (element.overlay !== true) existing.anyInFlowChild = true;
  into.set(ancestor.path, existing);
}

function toTextBlock(element: SceneElement): IntegrityTextBlock {
  return {
    selector: describeElement(element),
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
function toClipCandidate(element: SceneElement): ClipCandidate {
  const clip = element.clip!;
  const measured = element.textMeasured!;
  const clipX = Math.max(0, Math.round(measured.width - clip.width));
  const clipY = Math.max(0, Math.round(measured.height - clip.height));
  const visibleWidth = Math.max(0, Math.min(measured.width, clip.width));
  const visibleHeight = Math.max(0, Math.min(measured.height, clip.height));
  return {
    selector: describeElement(element),
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

function protrusionAmount(
  child: SceneElement,
  parent: SceneElement,
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
  elements: readonly SceneElement[],
  byPath: ReadonlyMap<string, SceneElement>,
): AlignmentGroup[] {
  const children = new Map<string, SceneElement[]>();
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
      parent: describeElement(byPath.get(parentPath)!),
      children: list.map((element) => ({
        selector: describeElement(element),
        left: element.left,
        right: element.left + element.width,
        centerX: element.left + element.width / 2,
        top: element.top,
      })),
    });
  }
  return groups;
}

// ---------------------------------------------------------------------------
// check composition

/**
 * The composition snapshot for a scene: every element as a box, parented by its nearest
 * recorded ancestor.
 *
 * `selector` is the element's **path**, not its short label, because the composition judge
 * names rows by it and `--allow` matches it — and a path is the one identifier a scene
 * guarantees is unique. `overlay` stands in for out-of-flow positioning: a HUD pinned over
 * the play field does not make gaps a reader reads as grouping.
 */
export function sceneToCompositionInput(
  elements: readonly SceneElement[],
  viewport: { width: number; height: number },
): CompositionInput {
  const byPath = new Map(elements.map((element) => [element.path, element]));
  const index = new Map(elements.map((element, i) => [element.path, i]));
  const boxes: CompositionBox[] = elements.map((element, i) => {
    const ancestor = nearestRecordedAncestor(element, byPath);
    const headingFromTag = /^h([1-6])$/i.exec(element.tag)?.[1];
    return {
      i,
      parent: ancestor ? index.get(ancestor.path)! : -1,
      selector: element.path,
      tag: element.tag,
      heading: element.heading ?? (headingFromTag ? Number(headingFromTag) : 0),
      x: element.left,
      y: element.top,
      w: element.width,
      h: element.height,
      position: element.overlay ? "absolute" : "static",
      fontSize: element.fontSize ?? 16,
      fontWeight: element.fontWeight ?? 400,
      bg: element.background ?? "transparent",
      border: element.border ?? 0,
      radius: element.radius ?? 0,
      textLen: (element.text ?? "").trim().length,
      leaf: false,
    };
  });
  // The DOM collector's `textLen` is a box's whole `textContent`, descendants included, and
  // `leaf` is computed after the walk: a box carries text of its own only if none of its
  // recorded descendants does. That is what keeps the body-size estimate the size of real
  // paragraphs rather than of every wrapper that inherits one.
  const own = boxes.map((b) => b.textLen);
  const hasTextDescendant = new Array<boolean>(boxes.length).fill(false);
  for (const b of boxes) {
    if (own[b.i] === 0) continue;
    for (let p = b.parent; p >= 0; p = boxes[p]!.parent) {
      hasTextDescendant[p] = true;
      boxes[p]!.textLen += own[b.i]!;
    }
  }
  for (const b of boxes) b.leaf = own[b.i]! > 0 && !hasTextDescendant[b.i];
  return { boxes, viewport };
}

// ---------------------------------------------------------------------------
// check color

/**
 * What is painted behind an element, walking its recorded ancestors (and itself, when
 * `includeSelf`) the way the page's `textBackgroundLayers` walks the DOM: stop at an image,
 * stop at the first opaque layer. A scene has no default canvas colour, so a walk that never
 * reaches an opaque layer answers `none` rather than assuming white.
 */
function backgroundBehind(
  element: SceneElement,
  byPath: ReadonlyMap<string, SceneElement>,
  includeSelf: boolean,
): { kind: "ok"; bg: Rgb } | { kind: "image" } | { kind: "none" } {
  const layers: Rgba[] = [];
  let node: SceneElement | undefined = includeSelf ? element : nearestRecordedAncestor(element, byPath);
  for (; node; node = nearestRecordedAncestor(node, byPath)) {
    if (node.backgroundImage) return { kind: "image" };
    const c = node.background !== undefined ? parseColor(node.background) : null;
    if (c && c[3] > 0) layers.push(c);
    if (c && c[3] >= 1) return { kind: "ok", bg: compositeBackground(layers) };
  }
  return { kind: "none" };
}

/** The roles `check color` reads; any other role is `check design`'s grouping only. */
const COLOR_ROLES = new Set(["field", "link", "button"]);

/**
 * The `check color` snapshot for a scene: the palette by role, and the samples the two WCAG
 * rules read — fields from `role: "field"`, links from `role: "link"` with their nearest
 * recorded ancestor as the prose flow.
 *
 * The same shape `COLLECT_COLOR_ROLES` returns, so `judgeColorRoles` cannot tell which
 * renderer drew the frame. Two honest differences from the page, both refusals: a field
 * with no opaque background behind it lands in `controlsSkipped` with that reason, and a
 * link whose flow has none gets `behind: null`, which the judge already treats as "not
 * measurable" (as it does text over an image). Selectors are scene paths, because that is
 * the one identifier a scene guarantees unique and the string `--allow` matches.
 */
export function sceneToColorRolesInput(
  elements: readonly SceneElement[],
  viewport: { width: number; height: number },
): ColorRolesInput {
  const byPath = new Map(elements.map((element) => [element.path, element]));
  const tally = { surfaces: new Map<string, ColorUse>(), ink: new Map<string, ColorUse>(), marks: new Map<string, ColorUse>(), interactive: new Map<string, ColorUse>() };
  const add = (into: Map<string, ColorUse>, hex: string, area: number, sample: string): void => {
    const entry = into.get(hex) ?? { hex, area: 0, count: 0, samples: [] };
    entry.area += area;
    entry.count++;
    if (entry.samples.length < 3) entry.samples.push(sample);
    into.set(hex, entry);
  };
  /** Text colour as painted: composited when it is translucent and something opaque is behind it. */
  const inkOf = (element: SceneElement): string | null => {
    const fg = parseColor(element.color);
    if (!fg) return null;
    if (fg[3] >= 1) return toHex(fg);
    const behind = backgroundBehind(element, byPath, true);
    return behind.kind === "ok" ? toHex(blendColor(behind.bg, fg)) : null;
  };

  const controls: ControlSample[] = [];
  const controlsSkipped: { selector: string; reason: string }[] = [];
  const links: LinkSample[] = [];

  for (const element of elements) {
    const area = Math.round(element.width * element.height);
    const own = parseColor(element.background);
    if (own && own[3] > 0.05) add(tally.surfaces, toHex(own), area, element.path);
    if ((element.text ?? "").trim() && element.color) {
      const ink = inkOf(element);
      if (ink) add(tally.ink, ink, area, element.path);
    }
    const border = parseColor(element.borderColor);
    if ((element.border ?? 0) > 0 && border && border[3] > 0.05) {
      add(tally.marks, toHex(border), Math.round((element.border ?? 0) * 2 * (element.width + element.height)), element.path);
    }
    if (COLOR_ROLES.has(element.role ?? "") && element.color) {
      const ink = inkOf(element);
      if (ink) add(tally.interactive, ink, area, element.path);
    }

    if (element.role === "field") {
      const behind = backgroundBehind(element, byPath, false);
      if (behind.kind !== "ok") {
        controlsSkipped.push({
          selector: element.path,
          reason: behind.kind === "image"
            ? "background-image behind the control"
            : "no opaque background behind the control in the scene",
        });
      } else {
        controls.push({
          selector: element.path,
          tag: element.tag,
          on: behind.bg,
          fill: own && own[3] > 0.05 ? own : null,
          borders: (element.border ?? 0) > 0 && border && border[3] > 0.05 ? [border] : [],
          hasShadow: element.shadow === true,
          hasOutline: element.outline === true,
        });
      }
    }

    if (element.role === "link") {
      const flow = nearestRecordedAncestor(element, byPath);
      const link = parseColor(element.color);
      const body = flow ? parseColor(flow.color) : null;
      if (!flow || !link || !body) continue;
      const behind = backgroundBehind(flow, byPath, true);
      links.push({
        selector: element.path,
        flow: flow.path,
        proseChars: (flow.text ?? "").trim().length,
        link,
        body,
        behind: behind.kind === "ok" ? behind.bg : null,
        underlined: element.underline === true,
        weightStep: Math.abs((element.fontWeight ?? 400) - (flow.fontWeight ?? 400)),
        hasFill: !!own && own[3] > 0.05,
        hasBorder: (element.border ?? 0) > 0,
      });
    }
  }

  const rank = (m: Map<string, ColorUse>) => [...m.values()].sort((a, b) => b.area - a.area);
  const roots = elements.filter((element) => !nearestRecordedAncestor(element, byPath));
  const base = roots.length > 0 ? backgroundBehind(roots[0]!, byPath, true) : { kind: "none" as const };
  return {
    palette: { surfaces: rank(tally.surfaces), ink: rank(tally.ink), marks: rank(tally.marks) },
    // Empty when the root paints nothing: findBase then names no base instead of a white
    // the frame may not contain.
    baseHex: base.kind === "ok" ? toHex(base.bg) : "",
    interactiveInk: rank(tally.interactive),
    controls,
    controlsSkipped,
    links,
    // The parser refuses an unresolved colour outright, so nothing reaches here unread.
    unreadable: [],
    boxes: elements.length,
    viewport,
  };
}

// ---------------------------------------------------------------------------
// check design

/**
 * A colour as Chromium's `getComputedStyle` spells it — `rgb(r, g, b)`, `rgba(r, g, b, a)`,
 * and `rgba(0, 0, 0, 0)` for nothing — because the design signature compares backgrounds as
 * strings. A scene's `#262b33` and `rgb(38, 43, 51)` must land in one signature.
 */
function computedColorString(value: string | undefined): string {
  const c = parseColor(value);
  if (!c || c[3] <= 0) return "rgba(0, 0, 0, 0)";
  const rgb = c.slice(0, 3).map(Math.round).join(", ");
  if (c[3] >= 1) return `rgb(${rgb})`;
  return `rgba(${rgb}, ${Number(c[3].toFixed(3))})`;
}

const SIDES = ["Top", "Right", "Bottom", "Left"] as const;

/**
 * The `check design` snapshot for a scene: one style sample per element that has a role,
 * and its padding as spacing samples.
 *
 * The role is what the DOM path infers from an ARIA role or the tag: here it is `role`, or
 * `h1`-`h6` for a heading. Elements without one are skipped and tallied by `tag`, as the
 * page does, so a scene that declared no roles reads as "nothing judged" rather than as
 * coherent. The signature fields are the page's — padding, corner radius, border width,
 * background, font size and weight — and `designSample` joins them, so a scene is compared
 * in the same signature space as a page.
 */
export function sceneToDesignPolicyInput(elements: readonly SceneElement[]): DesignPolicyInput {
  const samples: DesignStyleSample[] = [];
  const spacing: DesignSpacingSample[] = [];
  const skippedTags: Record<string, number> = {};
  let skipped = 0;
  for (const element of elements) {
    if (element.width < 2 || element.height < 2) continue;
    const pad = element.padding;
    const padding: [number, number, number, number] = pad === undefined
      ? [0, 0, 0, 0]
      : typeof pad === "number" ? [pad, pad, pad, pad] : pad;
    padding.forEach((value, i) => {
      if (value > 0) spacing.push({ selector: element.path, property: `padding${SIDES[i]}`, value });
    });
    const headingFromTag = /^h[1-6]$/i.test(element.tag) ? element.tag.toLowerCase() : undefined;
    const role = element.role ?? (element.heading ? `h${element.heading}` : headingFromTag);
    if (!role) {
      skipped++;
      skippedTags[element.tag] = (skippedTags[element.tag] ?? 0) + 1;
      continue;
    }
    samples.push({
      role,
      selector: element.path,
      padding,
      radius: element.radius ?? 0,
      borderWidth: element.border ?? 0,
      background: computedColorString(element.background),
      fontSize: element.fontSize ?? 16,
      fontWeight: String(element.fontWeight ?? 400),
      textFree: !(element.text ?? "").trim(),
    });
  }
  return { samples, spacing, skipped, skippedTags, statefulSkipped: 0 };
}

// ---------------------------------------------------------------------------

function parsePadding(value: unknown): number | [number, number, number, number] | undefined {
  if (num(value) !== undefined) return num(value)!;
  if (Array.isArray(value) && value.length === 4 && value.every((v) => num(v) !== undefined)) {
    return value as [number, number, number, number];
  }
  return undefined;
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
