/**
 * `check composition` — does the page's layout carry the four classical
 * composition principles (近接 proximity / 整列 alignment / 反復 repetition /
 * 対比 contrast), measured from geometry alone?
 *
 * This is the sibling of `check design`, and the line between them is the line
 * `docs/design/design-policy-metrics.md` drew: beauty is not measurable,
 * self-consistency is. `check design` measures consistency of STYLE (do your
 * buttons render one way). This measures consistency of COMPOSITION (does the
 * spacing group what belongs together, do the edges line up, does size encode
 * priority). Neither judges taste, and neither says which value is right.
 *
 * Why it is a separate gate rather than four more `check design` rules: run
 * both on `fixtures/composition/proximity-broken.html` and `check design`
 * prints findings BYTE-IDENTICAL to the intact page. Style reuse cannot see a
 * heading that has drifted away from the content it labels, because no
 * signature changed — only the margins did.
 *
 * Every threshold here was set against paired mutants (6 designed pages x 8
 * single-principle CSS mutations, `docs/reports/2026-09-21-composition-principles-v1.md`),
 * not by taste. The rule is: fire on the mutant, stay silent on the original.
 * Six candidate metrics were REJECTED for failing that, and the rejections are
 * recorded next to the survivors because they are the more useful half of the
 * study:
 *
 *   - **Column rail score** (do a container's children share a left edge)
 *     scored 1.00 on 14 of 16 pages. Block layout hands every child the same
 *     left edge, so the metric measures CSS, not design — the same trap as the
 *     4px-grid metric `check design` already rejected.
 *   - **Group separation ratio** (inter-group gap / intra-group gap): the
 *     originals span 0.86-3.00 and the mutants land inside that range. No
 *     threshold separates them, so it is reported as context and never judged.
 *   - **Type-scale sprawl** and **indistinct steps** over all font sizes both ran
 *     BACKWARDS: designed pages use more sizes (3-14) than generated ones (2-4),
 *     and more near-equal pairs. Contrast is only judgeable against the
 *     hierarchy the page DECLARES, which is what `flat-heading-step` does.
 *   - **text-align disagreement** inside a stack fired 8 times on an intact
 *     designed page. A centred hero next to left-aligned body copy is a
 *     decision, not a defect.
 *   - **Section rhythm** (variation of the gaps between sections) had no data on
 *     half the corpus and no separation on the rest.
 *
 * 反復 is deliberately absent: `check design`'s `component-drift` already owns
 * it, and the mutant run confirms it responds (a per-nth-child padding mutation
 * moved ecommerce-catalog from 6 to 7 button styles). A second repetition rule
 * here would report the same defect twice.
 */

import { resolve } from "node:path";
import { settlePage, sourceToUrl } from "@mizchi/vlmkit-core/page-open.ts";
import { withAuthState } from "@mizchi/vlmkit-core/auth-state.ts";
import { appendRunLedger } from "@mizchi/vlmkit-core/run-ledger.ts";
import { describeRedirect } from "@mizchi/vlmkit-core/navigation-redirect.ts";
import { BOLD, CYAN, DIM, GREEN, RED, RESET, YELLOW } from "@mizchi/vlmkit-core/terminal-colors.ts";
import type { RuleView } from "@mizchi/vlmkit-core/plugin/contract.ts";
import { applyRuleTiers, hiddenByRuleNote } from "@mizchi/vlmkit-core/plugin/rule-tier.ts";
import { withBrowser } from "@mizchi/vlmkit-core/browser-launch.ts";
import { parseSelectorAllowRules, selectorAllowFilter, type SelectorAllowRule } from "../inspect/selector-exemption.ts";
import { STYLE_SAMPLING_JS } from "./style-sampling.ts";

// ---------------------------------------------------------------------------
// Thresholds. Each one names the measurement that set it.

/**
 * How much wider a label's gap to its content must be than its gap to the
 * boundary above before the label reads as belonging to the wrong group.
 *
 * A ratio alone is not enough — 16px vs 24px is a 1.5x ratio nobody perceives
 * as mis-grouping, and that pair was v2's false positive on
 * `fixtures/css-challenge/form-app.html`. So an absolute floor applies too.
 */
export const PROXIMITY_RATIO = 1.5;
export const PROXIMITY_FLOOR_PX = 8;

/**
 * Two of the page's rails this far apart are an accident rather than an indent
 * — the window `check integrity`'s A12 near-misalignment probe uses, applied
 * ACROSS containers instead of between siblings.
 *
 * The lower bound is load-bearing: rails 1px apart are `Math.round` applied to
 * fractional layout (`landing-product` renders rails at 78 and 79, and at 1201
 * and 1202), not decisions anybody made. A12 excludes sub-2px for the same
 * reason.
 */
export const RAIL_NEAR_MIN_PX = 2;
export const RAIL_NEAR_MAX_PX = 8;

/**
 * A declared heading level must render at least this much larger than the next
 * one down, or the document's own structure is invisible.
 *
 * Deliberately tiny (4%): the claim is not "your type scale should be a major
 * third", it is "you told the browser these are different levels and they come
 * out the same". `fixtures/css-challenge/stacking-context.html` renders h2 and
 * h3 both at 16px at the same weight, which is the one such row in the corpus.
 */
export const HEADING_STEP = 1.04;

/** Below this size ratio nothing on the page is bigger than its body text. */
export const RANGE_FLOOR = 1.3;
/**
 * Text blocks needed before "nothing on this page is emphasized" is a claim
 * worth making. A page with one `<span>` trivially has no type contrast, and
 * saying so is noise rather than a finding — it was reported on a fixture whose
 * whole body was four words.
 */
export const CONTRAST_MIN_LEAVES = 5;
/**
 * …and emphasis carried by WEIGHT instead of size counts, which is why this
 * exists. `form-app` renders its card titles at 18px/700 over 14px/400 body —
 * a size ratio of 1.29, under the floor, on a page whose hierarchy is
 * perfectly legible because the titles are bold and ruled off. Reporting that
 * was a false positive; a weight step of 200 is a visible step.
 */
export const WEIGHT_STEP = 200;

/**
 * A label is a box about as tall as its own type. A card is many times taller
 * than its heading, and calling a card a label is how v2 reported a 16-vs-24px
 * "inversion" on `form-app`'s `div.card`.
 */
export const LABEL_HEIGHT_FACTOR = 3;

/** Fraction of the viewport a block must span to carry the page's rail. */
export const RAIL_WIDTH_FRACTION = 0.35;

// ---------------------------------------------------------------------------
// Samples

/** One visible layout box, with the geometry the principles are measured from. */
export interface CompositionBox {
  i: number;
  /** Index of the nearest COLLECTED ancestor, or -1. A skipped wrapper hands its children up. */
  parent: number;
  selector: string;
  tag: string;
  /** 1-6 for `h1`-`h6`, else 0. */
  heading: number;
  x: number;
  y: number;
  w: number;
  h: number;
  position: string;
  fontSize: number;
  fontWeight: number;
  /** backgroundColor, for deciding whether a box paints its own group boundary. */
  bg: string;
  /** Border width (top) and corner radius — the other two ways a box paints one. */
  border: number;
  radius: number;
  /** `textContent` length, trimmed. */
  textLen: number;
  /** Innermost box carrying text: the unit a reader perceives as one paragraph. */
  leaf: boolean;
}

export interface CompositionInput {
  boxes: CompositionBox[];
  viewport: { width: number; height: number };
}

/**
 * Collect every visible layout box.
 *
 * `leaf` is computed after the walk because it needs descendants: a box carries
 * text of its own only if none of its collected descendants does. That
 * distinction is what makes the body-size estimate the size of actual
 * paragraphs rather than of every wrapper that inherits one.
 */
export const COLLECT_COMPOSITION = `(() => {
  ${STYLE_SAMPLING_JS}
  const boxes = [];
  const indexOf = new Map();
  for (const el of document.querySelectorAll("body *")) {
    // An SVG's internals are drawing instructions, not layout boxes.
    if (el.closest("svg")) continue;
    if (!visible(el)) continue;
    const r = el.getBoundingClientRect();
    if (r.width < 2 || r.height < 2) continue;
    const cs = getComputedStyle(el);
    // display:contents has no box, so it must not become a grouping parent.
    if (cs.display === "contents") continue;
    let parent = -1;
    for (let p = el.parentElement; p; p = p.parentElement) {
      if (indexOf.has(p)) { parent = indexOf.get(p); break; }
    }
    const i = boxes.length;
    indexOf.set(el, i);
    const tag = el.tagName.toLowerCase();
    boxes.push({
      i, parent, selector: path(el), tag,
      heading: /^h[1-6]$/.test(tag) ? Number(tag.slice(1)) : 0,
      x: Math.round(r.x * 10) / 10,
      y: Math.round((r.y + window.scrollY) * 10) / 10,
      w: Math.round(r.width * 10) / 10,
      h: Math.round(r.height * 10) / 10,
      position: cs.position,
      fontSize: px(cs.fontSize),
      fontWeight: Number(cs.fontWeight) || 400,
      bg: cs.backgroundColor,
      border: px(cs.borderTopWidth),
      radius: px(cs.borderTopLeftRadius),
      textLen: (el.textContent || "").trim().length,
      leaf: false,
    });
  }
  const hasTextDescendant = new Array(boxes.length).fill(false);
  for (const b of boxes) {
    if (b.textLen === 0) continue;
    for (let p = b.parent; p >= 0; p = boxes[p].parent) hasTextDescendant[p] = true;
  }
  for (const b of boxes) b.leaf = b.textLen > 0 && !hasTextDescendant[b.i];
  return { boxes, viewport: { width: window.innerWidth, height: window.innerHeight } };
})()`;

// ---------------------------------------------------------------------------
// Report shape

export type CompositionFindingKind =
  | "proximity-inversion"
  | "rail-near-miss"
  | "flat-heading-step"
  | "no-type-contrast"
  | "nothing-judged"
  | "redirected";

export interface CompositionFinding {
  kind: CompositionFindingKind;
  severity: "info" | "warn" | "suspect";
  message: string;
  selector?: string;
  evidence?: Record<string, unknown>;
}

/** One label and the two gaps that decide whether it reads as grouped. */
export interface LabelGap {
  selector: string;
  parent: string;
  level: number;
  /** Gap to the boundary above: the previous sibling, or the group's own top edge. */
  before: number;
  /** What that boundary WAS, so the reader can see which block the label is being pulled toward. */
  boundary: string;
  /** Gap to the content the label introduces. */
  after: number;
  inverted: boolean;
  firstChild: boolean;
}

export interface RailNearMiss {
  axis: "left" | "right";
  a: number;
  b: number;
  delta: number;
  /** Blocks sitting on the second rail — the ones that look misaligned. */
  users: number;
  selector: string;
  /**
   * The container both rails have a child on — the reason the two edges are
   * comparable at all, and the thing to look at. Without it the row claims
   * nothing: two edges 5px apart in unrelated parts of the page is not a
   * misalignment. See `sharedParent`.
   */
  via: string;
  /** The sibling on the FIRST rail, so the row names both sides of the split. */
  siblingOnA: string;
}

export interface CompositionReport {
  source: string;
  /** 近接 */
  labels: LabelGap[];
  /**
   * Labels seen but not judged, with why. Never silent: a page where every
   * heading sits flush against a painted card edge has NO judgeable label, and
   * that has to read differently from a page that passed.
   */
  labelsUnjudged: { selector: string; reason: string }[];
  /** 整列 */
  rails: { lefts: number; rights: number; blocks: number; near: RailNearMiss[] };
  /**
   * 近接 at page scale. Reported, never judged — the study measured the
   * originals at 0.86-3.00 with the mutants inside that range.
   */
  separation: { intra: number; inter: number; ratio: number; samples: number };
  /** 対比 */
  hierarchy: {
    levels: { level: number; fontSize: number; fontWeight: number; selector: string }[];
    flat: { pair: string; sizes: string; selector: string }[];
    bodyFontSize: number;
    maxFontSize: number;
    range: number;
    weightDelta: number;
  };
  findings: CompositionFinding[];
  /** Boxes considered, so a quiet verdict can be weighed against its coverage. */
  boxes: number;
  allowed: { selector: string; reason: string }[];
  unusedAllow: string[];
  verdict: "composed" | "unbalanced" | "not-judged";
}

export interface CompositionOptions {
  source: string;
  waitUntil?: "domcontentloaded" | "load" | "networkidle";
  timeout?: number;
  har?: string;
  storageState?: string;
  /** Viewport width. Composition is a function of width, so it is reported. */
  viewport?: number;
  /** `--allow "<selector>;<reason>"` for a deviation that is deliberate. */
  allow?: readonly string[];
}

export const COMPOSITION_ALLOW_HELP = `Declare one composition deviation deliberate, repeatably. Syntax:
  <selector>;<reason>
Use the selector AS PRINTED in the finding — it is an id-preferring path, so
\`section#hero>h2\` matches and \`.hero-title\` does not (a rule matching nothing is
reported, so the mistake is loud rather than silent).
e.g. --allow "section.hero>h2;the hero heading is deliberately isolated"
A reason is required; a bare \`*\` is refused because that is \`--rule <rule>=off\`.
An allowed row leaves the verdict and is still listed.`;

export function parseCompositionAllowRules(specs: readonly string[]): SelectorAllowRule[] {
  return parseSelectorAllowRules(specs, { ruleId: "proximity-inversion" });
}

// ---------------------------------------------------------------------------
// Judging — pure, so every threshold above is testable without a browser.

const bottom = (b: CompositionBox) => b.y + b.h;
const rightEdge = (b: CompositionBox) => b.x + b.w;
/** Out-of-flow boxes do not make the gaps a reader reads as separation. */
const inFlow = (b: CompositionBox) => b.position !== "fixed" && b.position !== "absolute";

const TRANSPARENT = new Set(["rgba(0, 0, 0, 0)", "transparent"]);

/**
 * Does this box establish its group by PAINTING a boundary?
 *
 * 近接 is about gaps doing the grouping work. A card with a border, a radius or
 * its own background has already grouped its contents, so the gap between its
 * first heading and that heading's content cannot cause mis-grouping — there is
 * nothing above the heading inside the box to mis-group it with. Judging those
 * cases is what made the probe fire three times on blog-magazine's intact
 * sidebar panels.
 */
function paintsBoundary(box: CompositionBox, boxes: readonly CompositionBox[]): boolean {
  if (box.border >= 1 || box.radius >= 1) return true;
  if (TRANSPARENT.has(box.bg)) return false;
  const parent = box.parent >= 0 ? boxes[box.parent] : undefined;
  return parent ? box.bg !== parent.bg : true;
}

function childMap(boxes: readonly CompositionBox[]): Map<number, CompositionBox[]> {
  const kids = new Map<number, CompositionBox[]>();
  for (const b of boxes) {
    if (b.parent < 0 || !inFlow(b)) continue;
    const list = kids.get(b.parent) ?? [];
    list.push(b);
    kids.set(b.parent, list);
  }
  return kids;
}

function maxFont(box: CompositionBox, kids: Map<number, CompositionBox[]>): number {
  let max = box.textLen > 0 ? box.fontSize : 0;
  for (const c of kids.get(box.i) ?? []) max = Math.max(max, maxFont(c, kids));
  return max;
}

/** Heading level of the first text-bearing box in this subtree, 0 if none. */
function leadingHeading(box: CompositionBox, kids: Map<number, CompositionBox[]>): number {
  if (box.textLen > 0 && box.heading > 0) return box.heading;
  for (const c of kids.get(box.i) ?? []) {
    if (c.textLen === 0) continue;
    return leadingHeading(c, kids);
  }
  return 0;
}

/**
 * Is this box a label — a heading, or a row that IS one?
 *
 * The test is geometric rather than textual. A "short text" test cannot tell
 * `form-app`'s whole `div.card` (~190px around 18px type) from
 * `blog-magazine`'s `.section-head` (~34px around 28px type, an h2 beside a
 * "View archive" link) — and that second row genuinely is the label for what
 * follows, so excluding it along with the card lost real coverage.
 */
function labelLevel(box: CompositionBox, kids: Map<number, CompositionBox[]>): number {
  if (box.heading > 0 && box.textLen > 0) return box.heading;
  const level = leadingHeading(box, kids);
  if (level === 0) return 0;
  const font = maxFont(box, kids);
  if (font === 0 || box.h > font * LABEL_HEIGHT_FACTOR) return 0;
  return level;
}

/** Children of one parent that form a single vertical stack, top to bottom. */
function verticalStack(list: readonly CompositionBox[]): CompositionBox[] | null {
  const sorted = [...list].sort((a, b) => a.y - b.y || a.x - b.x);
  for (let i = 1; i < sorted.length; i++) {
    if (sorted[i]!.y < bottom(sorted[i - 1]!) - 1) return null;
  }
  return sorted;
}

/** Where each box sits in its parent's vertical stack, for walking upward. */
interface StackSlot {
  parent: CompositionBox;
  stack: CompositionBox[];
  index: number;
}

function stackSlots(
  boxes: readonly CompositionBox[],
  kids: Map<number, CompositionBox[]>,
): Map<number, StackSlot> {
  const slots = new Map<number, StackSlot>();
  for (const [parent, list] of kids) {
    if (list.length < 2) continue;
    const stack = verticalStack(list);
    if (!stack) continue;
    for (let index = 0; index < stack.length; index++) {
      slots.set(stack[index]!.i, { parent: boxes[parent]!, stack, index });
    }
  }
  return slots;
}

/** How far above this box the boundary of its group is, and what that boundary is. */
interface GapAbove {
  gap: number;
  via: string;
}

/**
 * The gap above a label, climbing out of wrappers that start where it starts.
 *
 * The climb is the load-bearing part, and it is there because of margin
 * collapsing. In the shape generated markup reaches for most —
 *
 *     <section>          // no padding, no background
 *       <h2>Title</h2>   // margin-top collapses through the section
 *       <p>…</p>
 *
 * — the section's border box begins exactly where the `h2` does, so measuring
 * "distance to the parent's top edge" yields 0 and the comparison goes vacuous
 * (anything is >= 0 * 1.5). Declining to judge it is honest but useless: that
 * was `fixtures/composition/proximity-broken.html` reporting COMPOSED with
 * zero labels judged, on a page whose every heading had visibly drifted.
 *
 * When a box is flush with its parent, the parent is not the boundary — the
 * parent's own boundary is. So climb until an ancestor either has a previous
 * sibling (the real block above), sits inside a box that PAINTS a boundary
 * (nothing above it to mis-group with, so there is nothing to judge), or offers
 * genuine padding of its own.
 */
/**
 * Is this block a KICKER — part of the label's own title block rather than
 * material the label could be mis-grouped with?
 *
 * The breadcrumb / date / eyebrow / byline above a heading is set tight against
 * it ON PURPOSE: the two read as one title block, and the wider gap below the
 * heading separates that block from the body. Measuring the heading against the
 * kicker therefore reports the most conventional editorial layout on the web as
 * a proximity inversion, which is what the live corpus showed — 6 of 14
 * professionally designed pages, every one of them on exactly this shape:
 *
 *     Home > Articles > Resources          <- breadcrumb, 16px above the title
 *     Optimize Largest Contentful Paint    <- h1
 *                                          <- 32px, then the body
 *
 * (web.dev and developer.chrome.com's `devsite-article-meta`, css-tricks'
 * `breadcrumbs` and its cards' `<time>`, tailwindcss' eyebrow `p.flex`.)
 *
 * Subordinate is the whole test, and it is deliberately two-sided: short text
 * AND a smaller font than the heading. A competing content block is either long
 * (a paragraph) or set at the heading's own scale (another heading).
 */
/**
 * How much smaller than its label a block must be to read as part of the label's
 * own title block rather than as a competing group.
 *
 * Measured on the live corpus, and the point is that the two populations are not
 * close. Breadcrumb/meta lines above a page title: web.dev and
 * developer.chrome.com both render a 16px `devsite-article-meta` above a 48px
 * h1 — a ratio of **3.0**. Ordinary body prose above a section heading: a 16px
 * `<p>` above a 24px h2 on the same two pages, **1.5**, and a 19.2px CodePen
 * embed above a 32px h3 on css-tricks, **1.67**. A cut at 2.0 has real margin on
 * both sides; it is a qualitative step ("at most half the label's size"), not a
 * value tuned until the answer came out right.
 *
 * Length was tried first and was WRONG, in the direction that matters. A
 * 74-character paragraph is "short", and body text is of course smaller than a
 * heading, so a char-limit test absorbed ordinary prose: on web.dev it climbed
 * past the paragraph above `h2#monitor_lcp_breakdown_in_javascript` and reported
 * `before: 16` where the rendered gaps are 32 above and 32 below — equal, and no
 * inversion at all. The test has to be about the block's RANK, not its size on
 * the page. (`textContent` length is a bad proxy for "short" anyway: that same
 * `devsite-article-meta` is one 24px line carrying 357 characters, most of them
 * in markup a reader never sees.)
 */
export const KICKER_SIZE_RATIO = 2;
function isKicker(
  prev: CompositionBox,
  labelFontSize: number,
  kids: Map<number, CompositionBox[]>,
): boolean {
  if (prev.textLen === 0) return false;
  const prevFont = maxFont(prev, kids);
  if (prevFont <= 0) return false;
  // A kicker is a line of type, not a block with its own content: a 450px
  // CodePen embed is excluded by the ratio above, but say it directly too.
  if (prev.h > prevFont * LABEL_HEIGHT_FACTOR) return false;
  return labelFontSize / prevFont >= KICKER_SIZE_RATIO;
}

/**
 * How far above this label the nearest block it could be MIS-GROUPED with sits.
 *
 * Two properties, both learned from the live corpus rather than from the
 * fixtures:
 *
 *   - The answer is always a preceding SIBLING, never a container's padding
 *     edge. A label that opens its group has nothing above it inside that group,
 *     so comparing its container's padding-top against the gap below it compares
 *     two unlike things — that reported w3c-apg's page title (4.7px of `main`
 *     padding vs 27.5px to the body) and nngroup's footer heading. When the
 *     climb runs out of siblings the label is unjudgeable, and says so.
 *   - A kicker is climbed THROUGH, not measured against, because it belongs to
 *     the label (see `isKicker`).
 *
 * The climb itself is still there for margin collapsing: an unbounded
 * `<section>`'s border box begins exactly where its first heading does, so the
 * section's own preceding sibling is the real boundary. Without it,
 * `fixtures/composition/proximity-broken.html` reported COMPOSED with zero
 * labels judged.
 */
function gapAbove(
  box: CompositionBox,
  boxes: readonly CompositionBox[],
  slots: Map<number, StackSlot>,
  kids: Map<number, CompositionBox[]>,
  labelFontSize: number,
): GapAbove | null {
  let cur = box;
  // Bounded: a pathological tree cannot spin here, and eight levels of
  // coincident wrappers or stacked kickers is already far past anything real.
  for (let climbed = 0; climbed < 8; climbed++) {
    const slot = slots.get(cur.i);
    if (!slot) return null;
    if (slot.index > 0) {
      const prev = slot.stack[slot.index - 1]!;
      // A kicker is part of the title block: keep looking above IT.
      if (isKicker(prev, labelFontSize, kids)) { cur = prev; continue; }
      const gap = Math.round((cur.y - bottom(prev)) * 10) / 10;
      // Flush against the block above means the separation is done by PAINT (a
      // background or a rule), not by space, so there is no gap to compare and
      // the ratio test would be vacuous — anything is >= 0 * 1.5. nngroup's
      // footer stacks its sections edge to edge and reported its "Follow us"
      // heading twice because of it.
      if (gap < 1) return null;
      return { gap, via: prev.selector };
    }
    // First child. A box that paints its own boundary has already grouped its
    // contents, and an unpainted one just hands the question to its own parent.
    if (paintsBoundary(slot.parent, boxes)) return null;
    cur = slot.parent;
  }
  return null;
}

/** 近接 — every label, with the two gaps that decide its affiliation. */
export function measureProximity(boxes: readonly CompositionBox[]): {
  labels: LabelGap[];
  unjudged: { selector: string; reason: string }[];
} {
  const kids = childMap(boxes);
  const slots = stackSlots(boxes, kids);
  const labels: LabelGap[] = [];
  const unjudged: { selector: string; reason: string }[] = [];
  for (const [parent, list] of kids) {
    if (list.length < 2) continue;
    const stack = verticalStack(list);
    if (!stack) continue;
    for (let i = 0; i < stack.length - 1; i++) {
      const c = stack[i]!;
      const level = labelLevel(c, kids);
      if (level === 0) continue;
      // `after` is measured inside the label's OWN group — the next thing in
      // this stack — while `before` may come from an ancestor's stack. That
      // asymmetry is the point: the content a label introduces is always its
      // sibling, but the boundary it is being pulled away from need not be.
      const after = Math.round((stack[i + 1]!.y - bottom(c)) * 10) / 10;
      if (after < 0) continue;
      const above = gapAbove(c, boxes, slots, kids, maxFont(c, kids));
      if (!above) {
        unjudged.push({
          selector: c.selector,
          reason: "nothing above it could be mis-grouped with it — it opens its group, or only a kicker sits above",
        });
        continue;
      }
      labels.push({
        selector: c.selector, parent: boxes[parent]!.selector, level,
        before: above.gap, after, boundary: above.via,
        inverted: after >= above.gap * PROXIMITY_RATIO && after - above.gap >= PROXIMITY_FLOOR_PX,
        firstChild: i === 0,
      });
    }
  }
  return { labels, unjudged };
}

/**
 * Two blocks on the two rails that share a parent, or null.
 *
 * This is the whole claim the rule makes. Siblings share a containing block, so
 * the same edge is available to both and a 2-8px difference is one of them
 * being offset. A box and its own ancestor have DIFFERENT containing blocks and
 * their edges differ by the ancestor's padding or border, which is by design —
 * a `<td>`'s 2px cellpadding, a `<textarea>` inside its form, a `<div class=note>`
 * inset inside its section. Two blocks in unrelated parts of the page (a 462px
 * sidebar column and a 1032px article body) have no reason to agree at all.
 *
 * Measured: requiring this took the live corpus from 46 findings to 0 while all
 * three alignment mutants keep firing. The full table is in
 * `docs/reports/2026-09-23-composition-rail-classification-v3.md`; the two
 * findings worth carrying here are that the INTUITIVE fix is wrong and that a
 * detail of the collector was load-bearing:
 *
 *   - "exclude ancestor/descendant pairs" also silences `rail-nested`, where a
 *     subsection really is indented 5px from its container while its own
 *     siblings are not. The distinction is siblinghood, not nesting.
 *   - `parent === -1` means the collector recorded no ancestor box. Treating it
 *     as a shared parent left 4 findings standing: MDN's skip links
 *     (`ul.a11y-menu>li>a`, inset 2px inside the 1265px full-bleed rail) report
 *     -1, as do the page-layout divs, and neither is the other's sibling.
 */
function sharedParent(
  a: readonly CompositionBox[],
  b: readonly CompositionBox[],
  boxes: readonly CompositionBox[],
): { via: CompositionBox; onA: CompositionBox; onB: CompositionBox } | null {
  const byParent = new Map<number, CompositionBox>();
  for (const box of a) {
    if (box.parent >= 0 && !byParent.has(box.parent)) byParent.set(box.parent, box);
  }
  for (const box of b) {
    if (box.parent < 0) continue;
    const onA = byParent.get(box.parent);
    if (!onA) continue;
    const via = boxes[box.parent];
    if (!via) continue;
    return { via, onA, onB: box };
  }
  return null;
}

/**
 * 整列 — the page's rails, page-wide.
 *
 * Page-wide rather than per container because per-container alignment is free:
 * the probe's column rail score was 1.00 on 14 of 16 pages. What an author can
 * still get wrong is the rail BETWEEN containers, which is where a stray margin
 * on one section shows up.
 */
export function measureRails(
  boxes: readonly CompositionBox[],
  viewportWidth: number,
): CompositionReport["rails"] {
  const wide = boxes.filter((b) => inFlow(b) && b.w >= viewportWidth * RAIL_WIDTH_FRACTION);
  const tally = (pick: (b: CompositionBox) => number) => {
    const counts = new Map<number, CompositionBox[]>();
    for (const b of wide) {
      const v = Math.round(pick(b));
      counts.set(v, [...(counts.get(v) ?? []), b]);
    }
    // A single box does not make a rail. Requiring two on each side is what
    // keeps one stray block from inventing a phantom rail to compare against.
    return [...counts.entries()].filter(([, users]) => users.length >= 2).sort((a, b) => a[0] - b[0]);
  };
  const lefts = tally((b) => b.x);
  const rights = tally((b) => rightEdge(b));
  const nearMisses = (entries: [number, CompositionBox[]][], axis: "left" | "right"): RailNearMiss[] => {
    const out: RailNearMiss[] = [];
    for (let i = 1; i < entries.length; i++) {
      const delta = entries[i]![0] - entries[i - 1]![0];
      if (delta < RAIL_NEAR_MIN_PX || delta > RAIL_NEAR_MAX_PX) continue;
      const users = entries[i]![1];
      // Adjacent rail values are not enough: the two edges have to belong to
      // one container's children before a difference between them means
      // anything. `sharedParent` documents the 46-to-0 measurement.
      const pair = sharedParent(entries[i - 1]![1], users, boxes);
      if (!pair) continue;
      out.push({
        axis, a: entries[i - 1]![0], b: entries[i]![0], delta,
        users: users.length, selector: pair.onB.selector,
        via: pair.via.selector, siblingOnA: pair.onA.selector,
      });
    }
    return out;
  };
  return {
    blocks: wide.length,
    lefts: lefts.length,
    rights: rights.length,
    near: [...nearMisses(lefts, "left"), ...nearMisses(rights, "right")],
  };
}

const median = (xs: number[]): number => {
  if (xs.length === 0) return 0;
  const s = [...xs].sort((a, b) => a - b);
  const m = s.length >> 1;
  return s.length % 2 ? s[m]! : (s[m - 1]! + s[m]!) / 2;
};

/**
 * 近接 at page scale — reported, never judged.
 *
 * Kept in the report because it is the number a reader wants when a proximity
 * row fires ("how wide ARE this page's group gaps"), and left out of the
 * verdict because the study measured intact pages across 0.86-3.00 with the
 * mutants inside that range.
 */
export function measureSeparation(boxes: readonly CompositionBox[]): CompositionReport["separation"] {
  const kids = childMap(boxes);
  const intra: number[] = [];
  const inter: number[] = [];
  // Floor of 2, matching `measureProximity`. A stricter floor here meant the
  // gaps BETWEEN sections were invisible whenever a page had exactly two of
  // them — which is where the inter-group number comes from.
  for (const [, list] of kids) {
    if (list.length < 2) continue;
    const stack = verticalStack(list);
    if (!stack) continue;
    for (let i = 1; i < stack.length; i++) {
      const gap = Math.round((stack[i]!.y - bottom(stack[i - 1]!)) * 10) / 10;
      if (gap < 0) continue;
      (leadingHeading(stack[i]!, kids) > 0 ? inter : intra).push(gap);
    }
  }
  const a = median(intra);
  const b = median(inter);
  return {
    intra: a, inter: b,
    ratio: a === 0 ? 0 : Math.round((b / a) * 100) / 100,
    samples: inter.length,
  };
}

/** 対比 — does the page RENDER the hierarchy it DECLARES? */
export function measureHierarchy(boxes: readonly CompositionBox[]): CompositionReport["hierarchy"] {
  const byLevel = new Map<number, CompositionBox>();
  for (const b of boxes) {
    if (b.heading === 0 || b.textLen === 0) continue;
    const cur = byLevel.get(b.heading);
    // Largest instance of the level: a small h2 in a footer should not decide
    // what h2 means on a page whose h2 section heads are 28px.
    if (!cur || b.fontSize > cur.fontSize) byLevel.set(b.heading, b);
  }
  const ordered = [...byLevel.entries()].sort((a, b) => a[0] - b[0]);
  const flat: { pair: string; sizes: string; selector: string }[] = [];
  for (let i = 1; i < ordered.length; i++) {
    const [hi, a] = ordered[i - 1]!;
    const [lo, b] = ordered[i]!;
    // A weight difference carries the distinction just as well as a size one,
    // so a same-size pair at different weights is not a defect.
    if (a.fontSize < b.fontSize * HEADING_STEP && a.fontWeight === b.fontWeight) {
      flat.push({ pair: `h${hi}/h${lo}`, sizes: `${a.fontSize}/${b.fontSize}`, selector: b.selector });
    }
  }
  const leaves = boxes.filter((b) => b.leaf && b.textLen >= 2);
  const sizeCounts = new Map<number, CompositionBox[]>();
  for (const b of leaves) sizeCounts.set(b.fontSize, [...(sizeCounts.get(b.fontSize) ?? []), b]);
  let bodyFontSize = 0;
  let bodyCount = 0;
  for (const [size, members] of sizeCounts) {
    if (members.length > bodyCount) { bodyFontSize = size; bodyCount = members.length; }
  }
  const bodyMembers = sizeCounts.get(bodyFontSize) ?? [];
  const weightCounts = new Map<number, number>();
  for (const b of bodyMembers) weightCounts.set(b.fontWeight, (weightCounts.get(b.fontWeight) ?? 0) + 1);
  const bodyWeight = [...weightCounts.entries()].sort((a, b) => b[1] - a[1] || a[0] - b[0])[0]?.[0] ?? 400;
  const maxFontSize = leaves.length === 0 ? 0 : Math.max(...leaves.map((b) => b.fontSize));
  const boldest = leaves.length === 0 ? bodyWeight : Math.max(bodyWeight, ...leaves.map((b) => b.fontWeight));
  return {
    levels: ordered.map(([level, b]) => ({ level, fontSize: b.fontSize, fontWeight: b.fontWeight, selector: b.selector })),
    flat,
    bodyFontSize,
    maxFontSize,
    range: bodyFontSize === 0 ? 0 : Math.round((maxFontSize / bodyFontSize) * 100) / 100,
    weightDelta: boldest - bodyWeight,
  };
}

export function judgeComposition(
  input: CompositionInput,
  options: Pick<CompositionOptions, "allow"> = {},
): Omit<CompositionReport, "source"> {
  const { boxes, viewport } = input;
  /** An allowed row leaves the verdict and is still listed — the repo-wide exemption property. */
  const allow = selectorAllowFilter(parseCompositionAllowRules(options.allow ?? []));
  const { keep } = allow;

  const { labels, unjudged } = measureProximity(boxes);
  const rails = measureRails(boxes, viewport.width);
  const separation = measureSeparation(boxes);
  const hierarchy = measureHierarchy(boxes);
  const findings: CompositionFinding[] = [];

  const inverted = labels.filter((l) => l.inverted && keep(l.selector));
  for (const l of inverted.slice(0, 5)) {
    findings.push({
      kind: "proximity-inversion",
      severity: "warn",
      selector: l.selector,
      message:
        `${l.selector} (h${l.level}) sits ${l.before}px below ${l.boundary}`
        + ` but ${l.after}px above the content it labels, inside ${l.parent}`
        + ` — a label reads as belonging to whatever it is CLOSEST to, so this one groups upward.`
        + ` Reduce the gap under it below ${Math.max(Math.round(l.before * PROXIMITY_RATIO) - 1, l.before + PROXIMITY_FLOOR_PX - 1)}px,`
        + ` or widen the gap above it. This reports the ambiguity, not which gap is correct.`,
      evidence: { before: l.before, after: l.after, level: l.level, parent: l.parent, boundary: l.boundary, firstChild: l.firstChild },
    });
  }
  if (inverted.length > 5) {
    findings.push({
      kind: "proximity-inversion",
      severity: "warn",
      message: `…and ${inverted.length - 5} more label(s) closer to what precedes them than to what they label.`,
      evidence: { remaining: inverted.length - 5 },
    });
  }

  for (const n of rails.near.filter((r) => keep(r.selector)).slice(0, 5)) {
    findings.push({
      kind: "rail-near-miss",
      severity: "info",
      selector: n.selector,
      message:
        `Two children of ${n.via} sit on ${n.axis} rails ${n.delta}px apart`
        + ` (${n.siblingOnA} at ${n.a}px, ${n.selector} at ${n.b}px; ${n.users} block(s) on the second).`
        + ` Siblings share a containing block, so the same edge was available to both`
        + ` — nobody designs a ${n.delta}px indent, so this is usually a stray margin. A ${n.delta}px`
        + ` split is at the edge of what a reader can see, which is why this never carries the verdict.`,
      evidence: {
        axis: n.axis, a: n.a, b: n.b, delta: n.delta, users: n.users,
        via: n.via, siblingOnA: n.siblingOnA,
      },
    });
  }

  for (const f of hierarchy.flat.filter((r) => keep(r.selector))) {
    findings.push({
      kind: "flat-heading-step",
      severity: "warn",
      selector: f.selector,
      message:
        `${f.pair} both render at ${f.sizes.split("/")[1]}px (${f.sizes}) at the same weight`
        + ` — the page DECLARES two heading levels and renders one, so the structure it asserts is invisible.`
        + ` e.g. ${f.selector}. Either separate the sizes or carry the level with weight.`,
      evidence: { pair: f.pair, sizes: f.sizes },
    });
  }

  const textLeaves = boxes.filter((b) => b.leaf && b.textLen >= 2).length;
  if (
    hierarchy.bodyFontSize > 0
    && textLeaves >= CONTRAST_MIN_LEAVES
    // The page has to CLAIM a hierarchy before failing to render one. A page
    // with no heading at all is a list, and "nothing reads as the most
    // important" describes a list correctly rather than finding a defect in it:
    // danluu.com is a date-and-link index, every row 16px/400 by design, and it
    // was the one live-corpus page this rule fired on.
    && hierarchy.levels.length > 0
    && hierarchy.range < RANGE_FLOOR
    && hierarchy.weightDelta < WEIGHT_STEP
  ) {
    findings.push({
      kind: "no-type-contrast",
      severity: "warn",
      message:
        `The largest text on the page is ${hierarchy.maxFontSize}px against ${hierarchy.bodyFontSize}px body`
        + ` (${hierarchy.range}x) and nothing is more than ${hierarchy.weightDelta} weight units heavier`
        + ` — nothing is emphasized by either size or weight, so no element reads as the most important.`,
      evidence: {
        range: hierarchy.range, weightDelta: hierarchy.weightDelta,
        maxFontSize: hierarchy.maxFontSize, bodyFontSize: hierarchy.bodyFontSize,
      },
    });
  }

  // Nothing judged is its own state, never a pass. A page whose every heading
  // sits flush inside a painted card has no judgeable label, and that has to
  // read differently from a page that was measured and came out clean — the
  // property `check design`'s `nothing-judged` established.
  const judgedAnything = labels.length > 0 || hierarchy.levels.length > 1 || rails.blocks > 0;
  if (!judgedAnything) {
    findings.push({
      kind: "nothing-judged",
      severity: "info",
      message:
        `No label, heading pair or page rail could be measured, so this verdict rests on no`
        + ` composition evidence (${boxes.length} visible box(es);`
        + ` ${unjudged.length} label(s) skipped as flush with their group edge).`
        + ` Composition is measured on heading-led groups and on blocks spanning`
        + ` >=${Math.round(RAIL_WIDTH_FRACTION * 100)}% of the viewport; a page built from neither has nothing to judge.`,
    });
  }

  const carries = findings.some((f) => f.severity === "warn" || f.severity === "suspect");
  return {
    labels, labelsUnjudged: unjudged, rails, separation, hierarchy, findings,
    boxes: boxes.length,
    allowed: allow.allowed,
    unusedAllow: allow.unused(),
    verdict: carries ? "unbalanced" : !judgedAnything ? "not-judged" : "composed",
  };
}

// ---------------------------------------------------------------------------
// Run

export async function runCompositionCheck(options: CompositionOptions): Promise<CompositionReport> {
  return await withBrowser(async (browser) => {
    const width = options.viewport ?? 1280;
    const page = await browser.newPage(
      withAuthState({ viewport: { width, height: 900 } }, options.storageState),
    );
    if (options.har) await page.routeFromHAR(resolve(options.har), { notFound: "abort" });
    // Redirects only mean something for http(s); the URL itself comes from the shared converter.
    const isUrl = /^https?:\/\//.test(options.source);
    const url = sourceToUrl(options.source);
    await page.goto(url, {
      waitUntil: options.waitUntil ?? "networkidle",
      timeout: options.timeout ?? 30000,
    });
    // Same reason `check design` settles: this gate judges gaps and type sizes,
    // and measuring before the webfont resolves reports the fallback face's
    // metrics as the composition.
    await settlePage(page, 250);
    const redirect = isUrl ? describeRedirect(options.source, page.url()) : null;
    const input = await page.evaluate(COLLECT_COMPOSITION) as CompositionInput;
    const judged = judgeComposition(input, options);
    if (redirect) {
      judged.findings.unshift({ kind: "redirected", severity: "suspect", message: redirect });
    }
    const report: CompositionReport = { source: options.source, ...judged };
    appendRunLedger({
      tool: "check-composition",
      source: options.source,
      headline: {
        verdict: report.verdict,
        proximity: report.labels.filter((l) => l.inverted).length,
        flatSteps: report.hierarchy.flat.length,
        railNearMisses: report.rails.near.length,
      },
    });
    return report;
  });
}

// ---------------------------------------------------------------------------
// Prose

export function formatCompositionReport(report: CompositionReport, rules?: RuleView): string {
  const lines: string[] = [];
  lines.push("");
  lines.push(`${BOLD}${CYAN}vlmkit check composition${RESET}`);
  lines.push(`${DIM}source: ${report.source}${RESET}`);
  lines.push("");
  const tiers = applyRuleTiers(report.findings, (f) => ({ rule: f.kind, emitted: f.severity }), rules);
  const shown = tiers.shown;
  const suspects = shown.filter((f) => f.tier === "suspect").length;
  lines.push(
    `verdict: ${
      report.verdict === "composed"
        ? `${GREEN}COMPOSED${RESET}`
        : report.verdict === "unbalanced"
          ? `${YELLOW}UNBALANCED${RESET}`
          : `${YELLOW}NOT JUDGED${RESET}`
    } (${shown.length} finding(s)${suspects > 0 ? `, ${suspects} suspect` : ""})`,
  );
  const hidden = hiddenByRuleNote(tiers.hiddenByRule);
  if (hidden) lines.push(`${DIM}  ${hidden} — the verdict word above predates the settings${RESET}`);
  // Coverage on the verdict line, the way `check design` prints it: a quiet
  // verdict drawn from two labels is worth knowing about before it is trusted.
  lines.push(
    `${DIM}  measured: ${report.labels.length} label(s), ${report.hierarchy.levels.length} heading level(s),`
    + ` ${report.rails.blocks} wide block(s) on ${report.rails.lefts} left / ${report.rails.rights} right rail(s)`
    + ` — from ${report.boxes} visible box(es)${RESET}`,
  );
  if (report.labelsUnjudged.length > 0) {
    lines.push(
      `${DIM}  ${report.labelsUnjudged.length} label(s) not judged: they open a box that paints its own`
      + ` group edge, so nothing above them could be mis-grouped with${RESET}`,
    );
  }
  lines.push("");

  if (report.hierarchy.levels.length > 0) {
    lines.push(`${BOLD}Type hierarchy${RESET} ${DIM}(largest instance of each declared level)${RESET}`);
    for (const l of report.hierarchy.levels) {
      lines.push(`  h${l.level}  ${String(l.fontSize).padStart(5)}px / ${l.fontWeight}   ${DIM}${l.selector}${RESET}`);
    }
    lines.push(
      `${DIM}  body ${report.hierarchy.bodyFontSize}px, largest ${report.hierarchy.maxFontSize}px`
      + ` (${report.hierarchy.range}x), heaviest +${report.hierarchy.weightDelta} weight${RESET}`,
    );
    lines.push("");
  }
  if (report.separation.samples > 0) {
    // Measurement, not a verdict — and labelled as such, because the number
    // looks gateable and the study showed it is not.
    lines.push(
      `${DIM}Group gaps: ${report.separation.inter}px between heading-led groups vs`
      + ` ${report.separation.intra}px inside them (${report.separation.ratio}x, ${report.separation.samples} sample(s)).`
      + ` Context only — intact pages measure 0.86-3.00x, so this cannot carry a verdict.${RESET}`,
    );
    lines.push("");
  }
  if (report.allowed.length > 0) {
    for (const a of report.allowed) {
      lines.push(`${DIM}allowed: ${a.selector} — ${a.reason}${RESET}`);
    }
  }
  if (report.unusedAllow.length > 0) {
    lines.push(`${YELLOW}${report.unusedAllow.length} --allow rule(s) matched nothing: ${report.unusedAllow.join(", ")}${RESET}`);
    lines.push(`${DIM}Delete them: an exemption kept past what it covered only widens the blind spot.${RESET}`);
  }
  if (report.allowed.length > 0 || report.unusedAllow.length > 0) lines.push("");

  if (shown.length === 0) {
    lines.push(tiers.hiddenByRule.size > 0
      ? `${DIM}No composition finding reported — every finding's rule is off.${RESET}`
      : `${GREEN}Proximity, alignment and type hierarchy all read consistently.${RESET}`);
    return lines.join("\n");
  }
  const mark = (tier: CompositionFinding["severity"]) =>
    tier === "suspect" ? `${RED}x${RESET}` : tier === "warn" ? `${YELLOW}!${RESET}` : `${DIM}i${RESET}`;
  const row = ({ row: f, tier }: { row: CompositionFinding; tier: CompositionFinding["severity"] }) =>
    `  ${mark(tier)} [${f.kind}]${tier === f.severity ? "" : ` (re-tuned to ${tier})`}: ${f.message}`;
  const carried = shown.filter((f) => f.tier !== "info");
  const informational = shown.filter((f) => f.tier === "info");
  if (carried.length > 0) {
    lines.push(`${BOLD}Findings${RESET}`);
    for (const f of carried) lines.push(row(f));
  }
  if (informational.length > 0) {
    if (carried.length > 0) lines.push("");
    lines.push(`${BOLD}Informational${RESET} ${DIM}(true, but does not carry the verdict)${RESET}`);
    for (const f of informational) lines.push(row(f));
  }
  return lines.join("\n");
}
