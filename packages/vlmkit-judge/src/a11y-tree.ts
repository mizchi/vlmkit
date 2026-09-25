/**
 * The accessibility-tree contract: what a platform's accessibility API says is on screen,
 * plus the frame it was painted into — from any platform.
 *
 * A browser's DOM is one place accessibility lives. Flutter's semantics tree, Android's
 * `uiautomator dump`, iOS's XCUITest hierarchy, macOS AX and Windows UI Automation are
 * others, and none of them has a DOM a gate could read paint out of. What every one of them
 * does have is a list of nodes with a role, a name, a rect and a few states, and a
 * screenshot. That pair is this contract, and the judges below need nothing more.
 *
 * **Why a second contract beside `scene.ts`.** A scene carries what a renderer *painted*
 * (colours, font, border) and feeds the style gates. An accessibility tree carries what the
 * platform *announces* (role, name, state, actions) and paints nothing: Flutter web marks
 * its accessibility DOM transparent, so every colour read from it is `rgba(0,0,0,0)`. Paint
 * therefore comes from the frame, never from the tree — contrast is measured in pixels.
 *
 * **The collector resolves, the judge decides**, as everywhere in this package. A collector
 * maps its platform's roles onto `A11yRole` and its units onto viewport units; the judges
 * here never learn which platform they are reading.
 *
 * Coordinates are **viewport units**: CSS px on the web, dp on Android, pt on Apple
 * platforms — the unit WCAG's target-size floors are written in. The frame may be denser
 * (a 3x phone screenshot); `scale` says by how much.
 */
import { UsageError } from "./errors.ts";
import { contrastRatio, relativeLuminance, textContrastFloor, type Rgb } from "./color.ts";

export const A11Y_TREE_FORMAT = "vlmkit-a11y/1";

/**
 * The roles a judge reasons about. A collector maps onto these; anything it cannot map
 * stays as its own string and is judged only by what its `actions` say it does.
 */
export type A11yRole =
  | "button" | "link" | "textfield" | "checkbox" | "radio" | "switch" | "slider" | "tab"
  | "menuitem" | "combobox" | "heading" | "text" | "image" | "group" | "list" | "listitem"
  | "dialog" | "scrollview" | "window";

/** Roles a user operates. A node with one of these and no name is announced as nothing. */
export const INTERACTIVE_ROLES: ReadonlySet<string> = new Set([
  "button", "link", "textfield", "checkbox", "radio", "switch", "slider", "tab", "menuitem", "combobox",
]);

export interface A11yRect {
  left: number;
  top: number;
  width: number;
  height: number;
}

export interface A11yNode {
  /** `name[index]>name[index]…` — unique; ancestry comes from its prefixes, as in `scene.ts`. */
  path: string;
  /** An `A11yRole`, or the platform's own role when it has no mapping. */
  role: string;
  /** The accessible name: what a screen reader announces. Absent or empty means unnamed. */
  name?: string;
  /** A control's current value (a text field's content, a slider's position). Not a name. */
  value?: string;
  rect: A11yRect;
  states?: {
    disabled?: boolean;
    focused?: boolean;
    checked?: boolean;
    selected?: boolean;
    expanded?: boolean;
    /** Present in the tree but not announced (`aria-hidden`, `importantForAccessibility=no`). */
    hidden?: boolean;
  };
  /** What the platform says the node can do: `tap`, `longPress`, `scroll`, `focus`, `setText`, … */
  actions?: string[];
  /** Declared text size in viewport units, when the platform reports it. Else it is measured. */
  textSize?: number;
  /** Declared font weight, 100-900, when reported. */
  fontWeight?: number;
}

export interface A11yTree {
  format: typeof A11Y_TREE_FORMAT;
  /** Which collector wrote it: `flutter-web`, `android`, … Informational. */
  platform?: string;
  /** The visible area, in viewport units. Content outside it has to be scrolled to. */
  viewport: { width: number; height: number };
  /** Frame pixels per viewport unit. Default: frame width / viewport width. */
  scale?: number;
  /** The frame PNG the collector took with the tree, relative to the tree file. */
  frame?: string;
  nodes: A11yNode[];
}

/** An RGBA frame, row-major, 4 bytes per pixel — what `decodePng` returns. */
export interface RgbaFrame {
  width: number;
  height: number;
  data: Uint8Array;
}

// ---------------------------------------------------------------------------
// Reading

const num = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v);

/** Parse a tree file's text (or an already-parsed value), refusing anything else by name. */
export function parseA11yTree(source: string | unknown): A11yTree {
  let raw: unknown = source;
  if (typeof source === "string") {
    try {
      raw = JSON.parse(source);
    } catch (error) {
      throw new UsageError(`not an accessibility tree: ${(error as Error).message}`);
    }
  }
  const tree = raw as Partial<A11yTree> | null;
  if (!tree || tree.format !== A11Y_TREE_FORMAT) {
    throw new UsageError(
      `not an accessibility tree (format ${JSON.stringify(tree?.format ?? null)}; expected "${A11Y_TREE_FORMAT}").`
      + " Write one with: vlmkit scan a11y <page-or-dump.xml> --out a11y.json",
    );
  }
  if (!tree.viewport || !num(tree.viewport.width) || !num(tree.viewport.height) || tree.viewport.width <= 0 || tree.viewport.height <= 0) {
    throw new UsageError("accessibility tree: `viewport` needs a positive width and height (viewport units).");
  }
  if (!Array.isArray(tree.nodes)) throw new UsageError("accessibility tree: `nodes` must be an array.");
  const seen = new Set<string>();
  tree.nodes.forEach((node, i) => {
    const where = `accessibility tree: nodes[${i}]`;
    if (!node || typeof node.path !== "string" || node.path === "") throw new UsageError(`${where} needs a \`path\`.`);
    if (seen.has(node.path)) throw new UsageError(`${where}: path "${node.path}" is not unique.`);
    seen.add(node.path);
    if (typeof node.role !== "string") throw new UsageError(`${where} (${node.path}) needs a \`role\`.`);
    const r = node.rect;
    if (!r || !num(r.left) || !num(r.top) || !num(r.width) || !num(r.height)) {
      throw new UsageError(`${where} (${node.path}) needs \`rect\` {left, top, width, height}.`);
    }
  });
  if (tree.scale !== undefined && (!num(tree.scale) || tree.scale <= 0)) {
    throw new UsageError("accessibility tree: `scale` must be a positive number.");
  }
  return tree as A11yTree;
}

// ---------------------------------------------------------------------------
// Shared reading of the tree

/** Every recorded ancestor of `path`, nearest first, by prefix — as `scene.ts` derives containment. */
function ancestorsOf(path: string, byPath: ReadonlyMap<string, A11yNode>): A11yNode[] {
  const out: A11yNode[] = [];
  let cut = path.lastIndexOf(">");
  while (cut > 0) {
    const node = byPath.get(path.slice(0, cut));
    if (node) out.push(node);
    cut = path.lastIndexOf(">", cut - 1);
  }
  return out;
}

const isHidden = (node: A11yNode, byPath: ReadonlyMap<string, A11yNode>): boolean =>
  node.states?.hidden === true || ancestorsOf(node.path, byPath).some((a) => a.states?.hidden === true);

const named = (node: A11yNode): string => (node.name ?? "").trim();

/** Operable: an interactive role, or a platform role the tree says can be tapped or typed into. */
export function isInteractive(node: A11yNode): boolean {
  return INTERACTIVE_ROLES.has(node.role)
    || (node.actions ?? []).some((a) => a === "tap" || a === "setText" || a === "longPress");
}

const scrolls = (node: A11yNode): boolean =>
  node.role === "scrollview" || (node.actions ?? []).includes("scroll");

const indexBy = (tree: A11yTree): Map<string, A11yNode> => new Map(tree.nodes.map((n) => [n.path, n]));

// ---------------------------------------------------------------------------
// Unlabelled controls

export interface UnlabelledControl {
  path: string;
  role: string;
  rect: A11yRect;
}

/**
 * Operable nodes a screen reader announces as nothing but their role (WCAG 4.1.2, name).
 * A text field's value is not a name — "edit text, 1234" says nothing about what 1234 is —
 * so a field is judged on `name` alone — though, as ARIA's name-from-content has it, a named
 * descendant names the control around it. Hidden nodes are left out, as they are not
 * announced. Disabled ones are not: 4.1.2 has no inactive exemption (1.4.3 does), and a
 * screen reader still reads a disabled control. Flutter web turns a `SelectableText` into an
 * empty, disabled, unnamed `<textarea>` — ofc-app's seed line — so that is the case it finds.
 */
export function judgeUnlabelledControls(tree: A11yTree): UnlabelledControl[] {
  const byPath = indexBy(tree);
  // Name from content: a tappable row whose announced part is a named button inside it is
  // not silent. Only a named descendant counts; an unnamed one is the same problem again.
  const namedPaths = tree.nodes.filter((n) => named(n)).map((n) => n.path);
  const namedWithin = (path: string) => namedPaths.some((p) => p.startsWith(`${path}>`));
  return tree.nodes
    .filter((n) => isInteractive(n) && !named(n) && !namedWithin(n.path))
    .filter((n) => !isHidden(n, byPath))
    .map((n) => ({ path: n.path, role: n.role, rect: n.rect }));
}

// ---------------------------------------------------------------------------
// Unreachable content

export interface UnreachableContent {
  /**
   * The nearest recorded ancestor the out-of-reach nodes share — the thing that should have
   * scrolled — or null when they sit at the root.
   */
  container: string | null;
  /** The first out-of-reach node in tree order, as the example a reader can find. */
  first: { path: string; role: string; name: string; rect: A11yRect };
  /** Named or operable nodes under `container` that are out of reach (outermost only). */
  count: number;
  /** Which viewport edges they cross, together. */
  beyond: Array<"top" | "right" | "bottom" | "left">;
}

/** Past an edge by more than this many viewport units. Sub-pixel rounding is not overflow. */
const EDGE_TOLERANCE = 1;

/**
 * Named or operable content that lies outside the viewport with nothing that scrolls to it.
 *
 * The case this was written for: a Flutter result screen whose action log ran past the bottom
 * of a 375x568 phone — 35 of 52 labelled nodes below the fold, and the screen had no
 * scrollable ancestor, so no gesture could bring them into view. A scrolling container
 * anywhere above a node (`role: scrollview` or a `scroll` action) makes it reachable; this
 * judge does not second-guess a declared scroll.
 *
 * One finding per container, not per node: 35 log lines past the fold are one defect, the
 * log that does not scroll. A node inside another out-of-reach node is not counted again.
 */
export function judgeUnreachableContent(tree: A11yTree): UnreachableContent[] {
  const byPath = indexBy(tree);
  const { width, height } = tree.viewport;
  const groups = new Map<string, UnreachableContent>();
  const outermost: string[] = [];
  for (const node of tree.nodes) {
    if (!named(node) && !isInteractive(node)) continue;
    if (isHidden(node, byPath)) continue;
    const r = node.rect;
    if (r.width <= 0 || r.height <= 0) continue;
    const beyond: UnreachableContent["beyond"] = [];
    if (r.top < -EDGE_TOLERANCE) beyond.push("top");
    if (r.left + r.width > width + EDGE_TOLERANCE) beyond.push("right");
    if (r.top + r.height > height + EDGE_TOLERANCE) beyond.push("bottom");
    if (r.left < -EDGE_TOLERANCE) beyond.push("left");
    if (beyond.length === 0) continue;
    const ancestors = ancestorsOf(node.path, byPath);
    if (scrolls(node) || ancestors.some(scrolls)) continue;
    if (outermost.some((p) => node.path.startsWith(`${p}>`))) continue;
    outermost.push(node.path);
    const container = ancestors[0]?.path ?? null;
    const key = container ?? "";
    const group = groups.get(key);
    if (group) {
      group.count += 1;
      for (const edge of beyond) if (!group.beyond.includes(edge)) group.beyond.push(edge);
    } else {
      groups.set(key, {
        container,
        first: { path: node.path, role: node.role, name: named(node), rect: r },
        count: 1,
        beyond,
      });
    }
  }
  return [...groups.values()];
}

// ---------------------------------------------------------------------------
// Contrast, measured in the frame

export interface PixelContrastSample {
  path: string;
  name: string;
  rect: A11yRect;
  /** The most common colour in the rect: what the text sits on. */
  background: Rgb;
  /** The colour in the rect farthest in contrast from the background: the ink. */
  ink: Rgb;
  ratio: number;
  /** 4.5 or 3, from the text size. */
  floor: number;
  /** Text size in viewport units, and where it came from. */
  textSize: number;
  textSizeFrom: "declared" | "measured";
}

export interface PixelContrastSkip {
  path: string;
  name: string;
  reason: "disabled" | "outside-frame" | "no-ink";
}

export interface PixelContrastReport {
  samples: PixelContrastSample[];
  failures: PixelContrastSample[];
  skipped: PixelContrastSkip[];
}

/** A colour needs this many pixels to count as ink: one anti-aliased stray is not a glyph. */
const MIN_INK_PIXELS = 2;
/**
 * A pixel is ink when it differs from the background by at least this contrast. Low, so a
 * #eee-on-white label (1.16:1) is found and failed rather than skipped as blank.
 */
const INK_MASK_RATIO = 1.1;
/**
 * An ink component spanning this share of the rect's width is not a glyph when it is also
 * thin (`LINE_MAX_THICKNESS` or less: a rule, an underline) or spans this share of the height
 * too (an outline drawn round the label). Width alone is not enough: a text node's rect is
 * often exactly its text, so one glyph spans it — ofc-app's "7♥" card labels read as blank.
 */
const LINE_WIDTH_SHARE = 0.9;
/** Frame pixels per viewport unit times this: the thickest stroke read as a rule, not a glyph. */
const LINE_MAX_THICKNESS = 3;
/**
 * A line of mixed-case text inks about 0.9 of its font size (ascender to descender). The
 * estimate divides by it, so a line whose descenders are missing reads SMALLER than it is —
 * the strict direction: small text gets the 4.5:1 floor.
 */
const INK_PER_EM = 0.9;

const unpack = (key: number): Rgb => [(key >> 16) & 255, (key >> 8) & 255, key & 255];

/**
 * Nodes whose own name is what is drawn: named, not an image, and not merely repeating a
 * descendant's name (a button whose label is its child text is measured once, at the text).
 */
function textNodes(tree: A11yTree, byPath: ReadonlyMap<string, A11yNode>): A11yNode[] {
  const names = new Map<string, string[]>();
  for (const n of tree.nodes) {
    const name = named(n);
    if (!name) continue;
    const list = names.get(name) ?? [];
    list.push(n.path);
    names.set(name, list);
  }
  return tree.nodes.filter((n) => {
    const name = named(n);
    if (!name || n.role === "image" || isHidden(n, byPath)) return false;
    return !(names.get(name) ?? []).some((p) => p.startsWith(`${n.path}>`));
  });
}

/**
 * The pixel indexes of glyph ink: the connected components of the ink mask (4-connected),
 * less any that is a rule or an outline (see `LINE_WIDTH_SHARE`). A chip's outline measured as ink made every
 * chip on ofc-app's home screen read as 35.6-unit text (so large-text 3:1), and let the
 * outline's colour stand for the label's — the two errors this removes.
 */
function glyphPixels(keys: Int32Array, w: number, h: number, scale: number, isInk: (key: number) => boolean): number[] {
  const mask = new Uint8Array(w * h);
  for (let i = 0; i < mask.length; i++) mask[i] = isInk(keys[i]!) ? 1 : 0;
  const seen = new Uint8Array(w * h);
  const out: number[] = [];
  const stack: number[] = [];
  for (let start = 0; start < mask.length; start++) {
    if (!mask[start] || seen[start]) continue;
    const component: number[] = [];
    let minX = w;
    let maxX = -1;
    let minY = h;
    let maxY = -1;
    seen[start] = 1;
    stack.push(start);
    while (stack.length > 0) {
      const i = stack.pop()!;
      component.push(i);
      const x = i % w;
      const y = (i - x) / w;
      if (x < minX) minX = x;
      if (x > maxX) maxX = x;
      if (y < minY) minY = y;
      if (y > maxY) maxY = y;
      const next = [x > 0 ? i - 1 : -1, x < w - 1 ? i + 1 : -1, i - w, i + w];
      for (const j of next) {
        if (j < 0 || j >= mask.length || !mask[j] || seen[j]) continue;
        seen[j] = 1;
        stack.push(j);
      }
    }
    const spansWidth = maxX - minX + 1 >= w * LINE_WIDTH_SHARE;
    const thin = maxY - minY + 1 <= LINE_MAX_THICKNESS * scale;
    const spansHeight = maxY - minY + 1 >= h * LINE_WIDTH_SHARE;
    if (spansWidth && (thin || spansHeight)) continue;
    for (const i of component) out.push(i);
  }
  return out;
}

/**
 * WCAG 1.4.3 contrast, read from the frame instead of from declared colours.
 *
 * For each node that draws text: the most common colour inside its rect is the background.
 * Pixels that differ from it are split into connected components, and one that is an
 * outline, a rule or an underline is dropped, so what is left is glyphs.
 * Their colour farthest from the background in contrast (with at least two pixels, so
 * anti-aliasing is not ink) is the text. The floor is 4.5:1, or 3:1 for large text — 24 units, or 18.66 at
 * weight 700 and up — using the declared text size when the platform reports one and the
 * inked line height otherwise.
 *
 * Disabled nodes are listed as skipped, not judged: 1.4.3 exempts inactive components. The
 * method measures what is on screen, so it is right where declared colours are wrong
 * (Flutter's transparent accessibility DOM, a gradient, an image behind text) and it reads a
 * rect that also holds an icon as whatever contrasts most — which can only raise a ratio,
 * never invent a failure.
 */
export function measurePixelContrast(tree: A11yTree, frame: RgbaFrame): PixelContrastReport {
  const byPath = indexBy(tree);
  const scale = tree.scale ?? frame.width / tree.viewport.width;
  const samples: PixelContrastSample[] = [];
  const skipped: PixelContrastSkip[] = [];
  const luminance = new Map<number, number>();
  const lum = (key: number): number => {
    let l = luminance.get(key);
    if (l === undefined) {
      l = relativeLuminance(unpack(key));
      luminance.set(key, l);
    }
    return l;
  };
  const ratioOf = (a: number, b: number): number => {
    const [hi, lo] = [lum(a), lum(b)].sort((x, y) => y - x) as [number, number];
    return (hi + 0.05) / (lo + 0.05);
  };

  for (const node of textNodes(tree, byPath)) {
    const name = named(node);
    if (node.states?.disabled === true) {
      skipped.push({ path: node.path, name, reason: "disabled" });
      continue;
    }
    const x0 = Math.max(0, Math.round(node.rect.left * scale));
    const y0 = Math.max(0, Math.round(node.rect.top * scale));
    const x1 = Math.min(frame.width, Math.round((node.rect.left + node.rect.width) * scale));
    const y1 = Math.min(frame.height, Math.round((node.rect.top + node.rect.height) * scale));
    if (x1 <= x0 || y1 <= y0) {
      skipped.push({ path: node.path, name, reason: "outside-frame" });
      continue;
    }
    const w = x1 - x0;
    const h = y1 - y0;
    const keys = new Int32Array(w * h);
    const counts = new Map<number, number>();
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const i = ((y0 + y) * frame.width + x0 + x) * 4;
        const key = (frame.data[i]! << 16) | (frame.data[i + 1]! << 8) | frame.data[i + 2]!;
        keys[y * w + x] = key;
        counts.set(key, (counts.get(key) ?? 0) + 1);
      }
    }
    let bg = 0;
    let bgCount = -1;
    for (const [key, count] of counts) if (count > bgCount) { bg = key; bgCount = count; }
    const glyphs = glyphPixels(keys, w, h, scale, (key) => ratioOf(key, bg) >= INK_MASK_RATIO);
    const inkCounts = new Map<number, number>();
    for (const i of glyphs) inkCounts.set(keys[i]!, (inkCounts.get(keys[i]!) ?? 0) + 1);
    let ink = bg;
    let best = 1;
    for (const [key, count] of inkCounts) {
      if (count < MIN_INK_PIXELS) continue;
      const r = ratioOf(key, bg);
      if (r > best) { best = r; ink = key; }
    }
    if (ink === bg) {
      skipped.push({ path: node.path, name, reason: "no-ink" });
      continue;
    }
    let textSize: number;
    let textSizeFrom: PixelContrastSample["textSizeFrom"];
    if (num(node.textSize) && node.textSize > 0) {
      textSize = node.textSize;
      textSizeFrom = "declared";
    } else {
      // The tallest run of consecutive rows holding glyph ink is one line's ascender-to-descender extent.
      const inkedRows = new Uint8Array(h);
      for (const i of glyphs) inkedRows[Math.floor(i / w)] = 1;
      let run = 0;
      let tallest = 0;
      for (const inked of inkedRows) {
        run = inked ? run + 1 : 0;
        tallest = Math.max(tallest, run);
      }
      textSize = Math.round((tallest / scale / INK_PER_EM) * 10) / 10;
      textSizeFrom = "measured";
    }
    const { floor } = textContrastFloor(textSize, node.fontWeight ?? 400);
    samples.push({
      path: node.path,
      name,
      rect: node.rect,
      background: unpack(bg),
      ink: unpack(ink),
      ratio: Math.floor(contrastRatio(unpack(ink), unpack(bg)) * 100) / 100,
      floor,
      textSize,
      textSizeFrom,
    });
  }
  return { samples, failures: samples.filter((s) => s.ratio < s.floor), skipped };
}
