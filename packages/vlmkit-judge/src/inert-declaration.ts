/**
 * `check css` / `inert-declaration`: a declaration the browser parsed and applies, that does
 * nothing where it is — `top` on a static box, `flex: 1` under a block parent, `width` on an
 * inline span, `background-size` with no image. Ported from veriss's `W_LAYOUT_DECLARATION_INERT`
 * (rule catalog §3), where the context comes from its own layout model; here it is the rendering
 * browser's computed style of each element the declaration's rule matches.
 *
 * Two guards keep a table entry from becoming a false claim:
 *   - a declaration is a candidate only when it is inert on EVERY element its rule matches (a
 *     shared class that works on some of them is not a mistake);
 *   - the collector then removes it from the stylesheet and requires every element's box and
 *     every pixel of the page to stay the same (`confirmed`); a table entry the browser disagrees
 *     with is dropped there, not reported.
 *
 * Pure: no DOM, no Node built-ins (`purity.test.ts`).
 */

/** What the browser computed about one element and where it sits. */
export interface InertContext {
  tag: string;
  display: string;
  position: string;
  float: string;
  /** Display of the box it is laid out in (ancestors with display: contents skipped); null for the root. */
  parentDisplay: string | null;
  /** img, video, canvas, iframe, embed, object, svg, input, textarea, select, button…: sized by itself. */
  replaced: boolean;
  /** overflow-x or overflow-y is neither visible nor clip. */
  scrollContainer: boolean;
  overflowX: string;
  /** column-count or column-width is not auto. */
  multicol: boolean;
  /** Any background-image layer is not none. */
  backgroundImage: boolean;
  borderStyle: { top: string; right: string; bottom: string; left: string };
  flexWrap: string;
}

const WIDE = new Set(["inherit", "initial", "unset", "revert", "revert-layer"]);

/** Values that set a property to what it is anyway: writing them is not a mistake. */
const INITIAL: Record<string, readonly string[]> = {
  top: ["auto"],
  right: ["auto"],
  bottom: ["auto"],
  left: ["auto"],
  inset: ["auto"],
  "z-index": ["auto"],
  "flex-grow": ["0"],
  "flex-shrink": ["1"],
  "flex-basis": ["auto"],
  flex: ["0 1 auto", "initial", "none"],
  order: ["0"],
  "grid-column": ["auto", "auto / auto"],
  "grid-row": ["auto", "auto / auto"],
  "grid-area": ["auto"],
  "justify-self": ["auto", "normal"],
  "align-self": ["auto", "normal"],
  float: ["none"],
  clear: ["none"],
  "justify-content": ["normal"],
  "align-items": ["normal", "stretch"],
  "align-content": ["normal"],
  "flex-direction": ["row"],
  "flex-wrap": ["nowrap"],
  "flex-flow": ["row", "nowrap", "row nowrap"],
  "grid-template-columns": ["none"],
  "grid-template-rows": ["none"],
  "grid-template-areas": ["none"],
  "grid-template": ["none"],
  "grid-auto-flow": ["row"],
  "grid-auto-columns": ["auto"],
  "grid-auto-rows": ["auto"],
  gap: ["normal", "0", "0px"],
  "row-gap": ["normal", "0", "0px"],
  "column-gap": ["normal", "0", "0px"],
  "grid-gap": ["normal", "0", "0px"],
  "vertical-align": ["baseline"],
  width: ["auto"],
  height: ["auto"],
  "min-width": ["auto", "0", "0px"],
  "min-height": ["auto", "0", "0px"],
  "max-width": ["none"],
  "max-height": ["none"],
  "margin-top": ["0", "0px"],
  "margin-bottom": ["0", "0px"],
  "margin-block": ["0", "0px"],
  "margin-block-start": ["0", "0px"],
  "margin-block-end": ["0", "0px"],
  transform: ["none"],
  translate: ["none"],
  rotate: ["none"],
  scale: ["none"],
  "text-overflow": ["clip"],
  "object-fit": ["fill"],
  "object-position": ["50% 50%", "center", "center center"],
  "overscroll-behavior": ["auto"],
  "overscroll-behavior-x": ["auto"],
  "overscroll-behavior-y": ["auto"],
  "scroll-snap-type": ["none"],
  resize: ["none"],
  "table-layout": ["auto"],
  clip: ["auto"],
  "background-position": ["0% 0%", "0 0", "left top"],
  "background-size": ["auto", "auto auto"],
  "background-repeat": ["repeat"],
  "background-attachment": ["scroll"],
};

const FLEX = new Set(["flex", "inline-flex"]);
const GRID = new Set(["grid", "inline-grid"]);
const CONTAINER = new Set([...FLEX, ...GRID]);
const SIDES = ["top", "right", "bottom", "left"] as const;

const isFlexItem = (c: InertContext) => FLEX.has(c.parentDisplay ?? "") && !outOfFlow(c);
const isGridItem = (c: InertContext) => GRID.has(c.parentDisplay ?? "") && !outOfFlow(c);
const outOfFlow = (c: InertContext) => c.position === "absolute" || c.position === "fixed";
/** An inline box that is not replaced: no width, height, vertical margin or transform. */
const plainInline = (c: InertContext) => c.display === "inline" && !c.replaced;

/**
 * Why `property: value` does nothing on an element in this context, or null when it may do
 * something (or the property is not one this table knows). Values are as authored.
 */
export function inertReason(property: string, value: string, c: InertContext): string | null {
  const p = property.toLowerCase();
  const v = value
    .trim()
    .toLowerCase()
    .replace(/\s*!important$/, "");
  if (c.display === "none" || c.display === "contents") return null;
  if (WIDE.has(v) || /var\(|env\(|attr\(/.test(v)) return null;
  if (INITIAL[p]?.includes(v)) return null;

  if (["top", "right", "bottom", "left", "inset"].includes(p) || p.startsWith("inset-"))
    return c.position === "static"
      ? "it is position: static, which offsets do not move (add position: relative, or use a margin or transform)"
      : null;
  if (p === "z-index")
    return c.position === "static" && !isFlexItem(c) && !isGridItem(c)
      ? "it is position: static and not a flex or grid item, so it is not stacked (add position: relative)"
      : null;
  if (p === "flex" || p === "flex-grow" || p === "flex-shrink" || p === "flex-basis")
    return isFlexItem(c) ? null : `it is not a flex item (${notItem(c)})`;
  if (p === "grid-column" || p === "grid-row" || p === "grid-area" || /^grid-(?:column|row)-(?:start|end)$/.test(p))
    return GRID.has(c.parentDisplay ?? "")
      ? null
      : `it is not a grid item (its parent is display: ${c.parentDisplay ?? "none"})`;
  if (p === "order")
    return isFlexItem(c) || isGridItem(c)
      ? null
      : `it is not a flex or grid item (${notItem(c)}), so it keeps the source order`;
  if (p === "justify-self")
    return isFlexItem(c)
      ? "its parent is a flex container, which ignores justify-self (use margin-inline-start: auto)"
      : null;
  if (p === "float")
    return outOfFlow(c)
      ? `it is position: ${c.position}, which does not float`
      : isFlexItem(c) || isGridItem(c)
        ? `it is a ${isFlexItem(c) ? "flex" : "grid"} item, which does not float`
        : null;
  if (p === "clear")
    return isFlexItem(c) || isGridItem(c)
      ? `it is a ${isFlexItem(c) ? "flex" : "grid"} item, where nothing floats`
      : null;

  if (
    ["justify-content", "align-items", "flex-direction", "flex-wrap", "flex-flow"].includes(p) ||
    /^grid-(?:template|auto)/.test(p)
  )
    return CONTAINER.has(c.display)
      ? FLEX.has(c.display) && /^grid-/.test(p)
        ? `it is display: ${c.display}, not grid`
        : GRID.has(c.display) && /^flex-/.test(p)
          ? `it is display: ${c.display}, not flex`
          : null
      : `it is display: ${c.display}, not flex or grid`;
  if (p === "align-content")
    return FLEX.has(c.display) && c.flexWrap === "nowrap"
      ? "it is a single-line flex container (flex-wrap: nowrap), so there are no lines to distribute"
      : null;
  if (p === "gap" || p === "row-gap" || p === "grid-gap")
    return CONTAINER.has(c.display) ? null : `it is display: ${c.display}, not flex or grid, so gap spaces nothing`;
  if (p === "column-gap")
    return CONTAINER.has(c.display) || c.multicol
      ? null
      : `it is display: ${c.display}, not flex, grid or multi-column`;

  if (p === "vertical-align")
    return isFlexItem(c) || isGridItem(c)
      ? "it is a flex or grid item, which vertical-align does not move (use align-self)"
      : ["block", "flex", "grid", "list-item", "table", "flow-root"].includes(c.display)
        ? `it is display: ${c.display}, and vertical-align moves only inline boxes and table cells`
        : null;
  if (
    plainInline(c) &&
    ([
      "width",
      "height",
      "min-width",
      "min-height",
      "max-width",
      "max-height",
      "transform",
      "translate",
      "rotate",
      "scale",
    ].includes(p) ||
      /^margin-(?:top|bottom|block(?:-start|-end)?)$/.test(p))
  )
    return `it is an inline box (display: inline), which takes no ${/^margin/.test(p) ? "vertical margin" : /width|height/.test(p) ? "size" : "transform"} (use display: inline-block)`;

  if (/^background-(?:position|size|repeat|attachment)$/.test(p))
    return c.backgroundImage ? null : `it has no background-image, so there is nothing to ${p.slice(11)}`;
  if (p === "border-width")
    return SIDES.every((s) => c.borderStyle[s] === "none" || c.borderStyle[s] === "hidden")
      ? "its border-style is none on every side, so the border is 0 wide (add border-style)"
      : null;
  {
    const side = /^border-(top|right|bottom|left)-width$/.exec(p)?.[1] as (typeof SIDES)[number] | undefined;
    if (side)
      return c.borderStyle[side] === "none" || c.borderStyle[side] === "hidden"
        ? `its border-${side}-style is ${c.borderStyle[side]}, so that border is 0 wide`
        : null;
  }
  if (p === "text-overflow")
    return CONTAINER.has(c.display)
      ? `it is display: ${c.display}, whose text is laid out in its items (put text-overflow on the item)`
      : c.overflowX === "visible"
        ? "its overflow-x is visible, so nothing is clipped to mark (add overflow: hidden and white-space: nowrap)"
        : null;
  if (p === "object-fit" || p === "object-position")
    return c.replaced ? null : `a <${c.tag}> is not a replaced element (put it on the img or video)`;
  if (p.startsWith("overscroll-behavior") || p === "scroll-snap-type")
    return c.scrollContainer || c.tag === "html" || c.tag === "body"
      ? null
      : "it is not a scroll container (overflow is visible or clip), so it never scrolls";
  if (p === "resize")
    return c.scrollContainer || c.overflowX === "hidden"
      ? null
      : "its overflow is visible, and only a box whose overflow is not visible can be resized";
  if (p === "table-layout")
    return c.display === "table" || c.display === "inline-table" ? null : `it is display: ${c.display}, not table`;
  if (p === "clip") return outOfFlow(c) ? null : "clip applies only to position: absolute or fixed (use clip-path)";
  return null;
}

function notItem(c: InertContext): string {
  return outOfFlow(c)
    ? `it is position: ${c.position}, out of the flow`
    : `its parent is display: ${c.parentDisplay ?? "none"}`;
}

/** The reason when the declaration is inert on every element given, else null. */
export function inertOnAll(property: string, value: string, contexts: readonly (InertContext | null)[]): string | null {
  if (contexts.length === 0) return null;
  let first: string | null = null;
  for (const c of contexts) {
    const why = c ? inertReason(property, value, c) : null;
    if (!why) return null;
    first ??= why;
  }
  return first;
}

export interface InertSample {
  /** The widths it was measured inert at (all the widths where its rule matches something). */
  widths?: number[];
  /** The most elements its rule matches at one width (contexts holds every width's). */
  elements?: number;
  selector: string;
  property: string;
  value: string;
  sheet: string;
  line?: number;
  /** The computed context of each element the rule matches (null: not readable). */
  contexts: (InertContext | null)[];
  /** Removing the declaration left every box and every pixel as it was. */
  confirmed: boolean;
}

export interface InertFinding {
  rule: "inert-declaration";
  severity: "warn";
  selector: string;
  property: string;
  sheet: string;
  line?: number;
  message: string;
}

export function judgeInertDeclarations(samples: readonly InertSample[]): InertFinding[] {
  const out: InertFinding[] = [];
  for (const s of samples) {
    const why = s.confirmed ? inertOnAll(s.property, s.value, s.contexts) : null;
    if (!why) continue;
    const where = `${s.sheet}${s.line !== undefined ? `:${s.line}` : ""}`;
    const n = s.elements ?? s.contexts.length;
    const at =
      s.widths && s.widths.length
        ? ` at ${s.widths.length > 1 ? `${s.widths.slice(0, -1).join(", ")} and ${s.widths.at(-1)}` : s.widths[0]}px`
        : "";
    out.push({
      rule: "inert-declaration",
      severity: "warn",
      selector: s.selector,
      property: s.property,
      sheet: s.sheet,
      ...(s.line !== undefined ? { line: s.line } : {}),
      message: `${s.selector} \`${s.property}: ${s.value}\` (${where}) does nothing on the ${n === 1 ? "element" : `${n} elements`} it matches${at}: ${why}. Removing it leaves the page pixel for pixel the same`,
    });
  }
  return out;
}

/** Whether `inertReason` judges this property at all (the collector reads only these). */
export function inertCandidateProperty(property: string): boolean {
  const p = property.toLowerCase();
  return (
    p in INITIAL ||
    p.startsWith("inset-") ||
    /^border-(?:(?:top|right|bottom|left)-)?width$/.test(p) ||
    /^grid-(?:column|row)-(?:start|end)$/.test(p)
  );
}

/**
 * The body of the function the collector runs on each element (`this`) to read its `InertContext`
 * (a function body, as every `*_FN` script is: `onNode` wraps it).
 */
export const INERT_CONTEXT_FN = `
  const s = getComputedStyle(this);
  let parent = this.parentElement;
  while (parent && getComputedStyle(parent).display === "contents") parent = parent.parentElement;
  const tag = this.localName;
  const replaced = ["img", "video", "canvas", "iframe", "embed", "object", "svg", "input", "textarea", "select", "button", "audio", "meter", "progress"].includes(tag);
  const scrolls = (v) => v !== "visible" && v !== "clip";
  return {
    tag, display: s.display, position: s.position, float: s.float,
    parentDisplay: parent ? getComputedStyle(parent).display : null,
    replaced, scrollContainer: scrolls(s.overflowX) || scrolls(s.overflowY), overflowX: s.overflowX,
    multicol: s.columnCount !== "auto" || s.columnWidth !== "auto",
    backgroundImage: s.backgroundImage !== "none",
    borderStyle: { top: s.borderTopStyle, right: s.borderRightStyle, bottom: s.borderBottomStyle, left: s.borderLeftStyle },
    flexWrap: s.flexWrap,
  };
`;

/**
 * The width features of a media condition, each as its text inside its own parentheses: a "("
 * right after a name is a function's (calc(), min()), part of the feature's value.
 */
function widthFeatures(cond: string): string[] {
  const out: string[] = [];
  const fnParen = (i: number) => /[\w-]/.test(cond[i - 1] ?? "");
  const walk = (from: number, to: number) => {
    for (let i = from, depth = 0, start = -1; i < to; i++) {
      if (cond[i] === "(") {
        if (depth === 0) start = i;
        depth++;
      } else if (cond[i] === ")" && depth > 0 && --depth === 0) {
        if (fnParen(start)) continue;
        const inner = cond.slice(start + 1, i);
        const nested = [...inner.matchAll(/\(/g)].some((m) => !/[\w-]/.test(inner[m.index! - 1] ?? ""));
        if (nested) walk(start + 1, i);
        else if (/(?:^|[\s:<>=(-])(?:min-|max-)?(?:device-)?width\b/i.test(inner)) out.push(inner);
      }
    }
  };
  walk(0, cond.length);
  return out;
}

/**
 * One width inside each regime the page's width media queries make, between `min` and `max`:
 * the ends, and the middle of each span between two breakpoints, plus each width a query matches
 * exactly (`(width: 600px)`), which no middle shows. A declaration written for one regime and
 * made inert in another by a query (a desktop grid placement under a mobile `display: block`) is
 * then seen to work somewhere. With no width query, one desktop width.
 *
 * A width feature whose value is not a px / em / rem number (a calc(), a vw) cannot be placed
 * here, and more regimes than `cap` would leave some out (the one where the declaration works
 * could be among them): then no widths at all, so nothing is judged across widths rather than
 * from too few.
 */
export function regimeWidths(conditions: readonly string[], min = 320, max = 1920, cap = 16): number[] {
  const edges = new Set<number>();
  const exact = new Set<number>();
  for (const cond of conditions)
    for (const feature of widthFeatures(cond)) {
      const value = feature.replace(/(?:min-|max-)?(?:device-)?width/gi, "");
      if (value.includes("(")) return [];
      const numbers = [...value.matchAll(/(-?(?:\d+\.?\d*|\.\d+))\s*([a-z%]*)/gi)];
      if (!numbers.length || numbers.some((m) => !/^(?:px|r?em)$/i.test(m[2]!) && parseFloat(m[1]!) !== 0)) return [];
      const isExact = /^\s*(?:width|device-width)\s*(?::|=)/i.test(feature) || /^[^<>]*=[^<>]*$/.test(feature);
      for (const m of numbers) {
        const px = Math.round(parseFloat(m[1]!) * (m[2]!.toLowerCase() === "px" || !m[2] ? 1 : 16));
        // The range's own ends count: (max-width: 320px) splits 320 from 321, and without it the page read as
        // having no width query at all (one desktop width, the narrow regime never judged).
        if (px >= min && px <= max) (isExact ? exact : edges).add(px);
      }
    }
  for (const e of exact) edges.add(e);
  if (edges.size === 0) return [1280];
  const sorted = [...edges].sort((a, b) => a - b);
  const widths = [
    ...new Set([min, ...sorted.slice(1).map((b, i) => Math.round((sorted[i]! + b) / 2)), max, ...exact]),
  ].sort((a, b) => a - b);
  return widths.length > cap ? [] : widths;
}

/**
 * Per-width results merged by declaration (`key`: where it is written). `sample: null` is a
 * width where the rule matched something and the declaration was not a confirmed candidate:
 * it may work there, so the declaration is dropped. Widths where the rule matches nothing do
 * not appear at all.
 */
export function mergeInertWidths(
  entries: readonly { key: string; width: number; sample: InertSample | null }[],
): InertSample[] {
  const by = new Map<string, { width: number; sample: InertSample | null }[]>();
  for (const e of entries) by.set(e.key, [...(by.get(e.key) ?? []), e]);
  const out: InertSample[] = [];
  for (const list of by.values()) {
    if (list.some((e) => e.sample === null)) continue;
    const samples = list.map((e) => e.sample!);
    const widths = [...new Set(list.map((e) => e.width))].sort((a, b) => a - b);
    out.push({
      ...samples[0]!,
      widths,
      elements: Math.max(...samples.map((x) => x.contexts.length)),
      contexts: samples.flatMap((x) => x.contexts),
      confirmed: samples.every((x) => x.confirmed),
    });
  }
  return out;
}
