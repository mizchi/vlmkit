/**
 * `check color` — what a page's colours are FOR, and where colour is the only
 * thing carrying a meaning.
 *
 * ## Why this is not `vlmkit palette` or `check a11y contrast`
 *
 * `vlmkit palette` reads a screenshot's pixel histogram: it knows area and
 * nothing else, so it cannot tell a brand accent from a photograph. `check a11y
 * contrast` reads one text/background pair at a time: it knows whether a string
 * is legible and nothing about the palette it belongs to. Neither can see a
 * colour's JOB, which is what the two rules here are about — and the proof that
 * the evidence is disjoint is that `check a11y contrast` passes every
 * `color-only-link` this gate reports, correctly, because the criterion it
 * measures is satisfied (caniuse's `#0046d1` links are 8.2:1 against their
 * background and 2.8:1 against the sentence they sit in).
 *
 * ## What it reports without judging
 *
 * The palette, decomposed by role and ranked by painted area: **surfaces** (what
 * the page is painted with), **ink** (text), **marks** (borders), plus three
 * named colours — the **base** (largest surface), the **body ink** (largest by
 * area), and the **link ink** (the most-used interactive ink that is not the
 * body ink).
 *
 * Two of those three needed a measurement to get right, and both corrections are
 * the same lesson from opposite sides:
 *
 * - The base cannot be "the largest declared background": danluu.com declares
 *   **zero** backgrounds on 625 boxes. The composited page background stands in,
 *   which is what a reader sees either way.
 * - The link ink cannot be "the most-used interactive ink". That reported the
 *   BODY ink as the link colour on **7 of the 14** corpus pages — `#000000` for
 *   MDN, whose links are `#044c9f`; `#202124` for web.dev, whose links are
 *   `#1a73e8` — because navigation items, card titles and logos outnumber links
 *   in prose and are deliberately set in the body colour, marked by position
 *   rather than by hue. See `findLinkInk`.
 *
 * That is the extraction, and it is deliberately a report rather than a verdict.
 * See "What was measured and rejected" below for why nothing here scores a page
 * against a target ratio.
 *
 * ## The two rules
 *
 * Both are WCAG criteria with the standard's own number, not a threshold chosen
 * here, and both were measured on 14 mirrored professionally designed pages
 * (`docs/reports/2026-09-23-color-roles-v1.md`):
 *
 * - **`control-boundary-invisible`** (WCAG 1.4.11 Non-text Contrast): a text
 *   control whose own boundary — its fill or its strongest border — is under
 *   3:1 against the surface behind it, with no shadow or outline drawing an edge
 *   either. So the field's extent is invisible. 4 of 15 controls on the corpus,
 *   and the populations do not touch: the four measure 0, 0, 1.08, 1.09 and the
 *   eleven others 4.18 to 15.7. Three were verified by screenshot as fields with
 *   no boundary at all; NN/g's newsletter input on its dark footer shows nothing
 *   but a caret.
 *
 * - **`color-only-link`** (WCAG 1.4.1 Use of Color, technique G183, which names
 *   3:1 exactly): a link inside a flow that also holds its own prose, marked off
 *   from that prose by colour alone — no underline, no weight step, no border,
 *   no fill — and under 3:1 against it. 8 of 2627 painted links in a flow, 0.3%,
 *   every one verified. (4899 when collapsed `<details>` content still counted —
 *   see `painted` in the collector; the 8 are the same eight.)
 *
 * The "flow also holds prose" condition is the whole rule, the same way
 * `measureProximity`'s "boundary must be a preceding sibling" is. danluu.com is
 * 210 undecorated `#0000ee` links at 1.7:1 against its body colour and is NOT a
 * finding, because every row is a link: there is no sentence for a link to hide
 * inside. A list of links is a list, not a trap.
 *
 * ## What was measured and rejected
 *
 * Three candidates were measured on the same corpus and thrown out. They are
 * recorded because the first two are the obvious things to propose:
 *
 * - **Base/main/accent against 70:25:5.** The 13 measurable designed pages miss
 *   that split by **15 to 55 points**, with base shares from 39.6% to 97.6%. A
 *   rule scoring against the slogan reports every one of them as wrong. Rendered
 *   area share is dominated by whichever background is largest, which is a
 *   layout fact; the slogan is advice for someone choosing a palette.
 * - **Palette sprawl** (too many distinct colours). 3 to 35 across the designed
 *   pages with no clustering, and the most carefully built pages are at the top
 *   (Smashing 20 surfaces, the Tailwind docs 16 inks). Runs BACKWARDS, exactly
 *   like the type-scale candidates in `docs/design/composition-metrics.md`.
 * - **Accent role collision** (the interactive colour reused for static text).
 *   Fires on 13 of 15 pages, and the collisions are the body ink: Wikipedia has
 *   257 static elements and 5 links at `#202122`, css-tricks 792 and 406 at
 *   `#ffffff`. A link styled in the body colour is the norm — nav items, card
 *   titles, logos — because position marks them instead. The hypothesis had the
 *   direction backwards.
 */

import { pathToFileURL } from "node:url";
import { resolve, dirname } from "node:path";
import { mkdir, writeFile } from "node:fs/promises";
import { withBrowser } from "@mizchi/vlmkit-core/browser-launch.ts";
import { settlePage } from "@mizchi/vlmkit-core/page-open.ts";
import { withAuthState } from "@mizchi/vlmkit-core/auth-state.ts";
import { appendRunLedger } from "@mizchi/vlmkit-core/run-ledger.ts";
import { describeRedirect } from "@mizchi/vlmkit-core/navigation-redirect.ts";
import { type PageLoadOptions } from "@mizchi/vlmkit-core/page-load.ts";
import { BOLD, CYAN, DIM, GREEN, RED, RESET, YELLOW } from "@mizchi/vlmkit-core/terminal-colors.ts";
import type { RuleView } from "@mizchi/vlmkit-core/plugin/contract.ts";
import { applyRuleTiers, hiddenByRuleNote } from "@mizchi/vlmkit-core/plugin/rule-tier.ts";
import { CONTRAST_BACKGROUND_JS } from "../contrast-background.ts";
import { parseSelectorAllowRules, selectorAllowFilter, type SelectorAllowRule } from "../inspect/selector-exemption.ts";
import { STYLE_SAMPLING_JS } from "./style-sampling.ts";

// ---------------------------------------------------------------------------
// Thresholds. Both are WCAG's, which is the point: a number this file chose
// would be a free parameter, and the study that rejected 70:25:5 is the reason
// there are only two numbers here.
// ---------------------------------------------------------------------------

/**
 * WCAG 1.4.11 Non-text Contrast, and WCAG 1.4.1 technique G183 for the link
 * case. Both name 3:1, so neither is tuned.
 *
 * On the live corpus the control populations do not straddle it: 0, 0, 1.08,
 * 1.09 below, 4.18 upward above. Nothing was fitted to land there.
 */
export const NON_TEXT_CONTRAST_FLOOR = 3;

/**
 * A weight difference this large counts as a non-colour cue on its own. 400 to
 * 500 is not reliably visible at body size; 400 to 700 is, and 100 is the step
 * between adjacent named weights — so the cut sits at the first step that is
 * more than one notch.
 */
export const WEIGHT_CUE_STEP = 100;

/**
 * Characters of the flow's OWN text before it counts as prose a link could hide
 * inside. Below this it is a link list with separators.
 *
 * Measured rather than guessed: danluu.com's rows carry 0-4 characters of own
 * text around each link, MDN's breadcrumb separators 1-3, and the shortest
 * genuine sentence-with-a-link on the corpus is Wikipedia's 24-character
 * citation fragment. 15 sits in that gap.
 */
export const PROSE_FLOOR_CHARS = 15;

/** Surfaces/ink/marks below this share of their role's total are not the palette. */
export const PALETTE_MIN_SHARE = 0.005;

// ---------------------------------------------------------------------------

export interface ColorUse {
  hex: string;
  /** Painted area in CSS px^2 — a box's own area for a surface, the stroke's for a mark. */
  area: number;
  /** How many elements paint it. */
  count: number;
  /** Up to three selectors, so a row can be looked at. */
  samples: string[];
}

export interface ControlBoundary {
  selector: string;
  tag: string;
  /** The surface behind the control, as composited. */
  onHex: string;
  fillHex: string | null;
  fillRatio: number;
  borderHex: string | null;
  borderRatio: number;
  /** A shadow or outline draws an edge too; a field with either is marked. */
  hasShadow: boolean;
  hasOutline: boolean;
  /** The strongest edge the control draws: max(fill, border). */
  best: number;
}

export interface LinkCue {
  selector: string;
  /** The block holding both the link and the prose it sits in. */
  flow: string;
  /** Characters of the flow's own text. */
  proseChars: number;
  linkHex: string;
  bodyHex: string;
  /** Contrast between link ink and the surrounding ink, both composited. */
  vsBody: number | null;
  underlined: boolean;
  weightStep: number;
  hasFill: boolean;
  hasBorder: boolean;
  /** Same ink as the prose: no signal at all, which is a different row. */
  sameInk: boolean;
}

export type ColorFindingKind =
  | "control-boundary-invisible"
  | "color-only-link"
  | "link-no-cue"
  | "unreadable-color"
  | "nothing-judged"
  | "redirected";

export interface ColorFinding {
  kind: ColorFindingKind;
  severity: "suspect" | "warn" | "info";
  selector?: string;
  message: string;
  evidence?: Record<string, unknown>;
}

export interface ColorRolesInput {
  palette: { surfaces: ColorUse[]; ink: ColorUse[]; marks: ColorUse[] };
  /** The composited page background: the base even when nothing declares one. */
  baseHex: string;
  interactiveInk: ColorUse[];
  controls: ControlBoundary[];
  controlsSkipped: { selector: string; reason: string }[];
  links: LinkCue[];
  /**
   * Declared colours the parser refused. Never silently dropped: the round that
   * built this gate found `check a11y contrast` inspecting 10 of 1068 elements
   * on a page whose colours were `lab()`, and reporting it clean.
   */
  unreadable: { property: string; count: number; samples: string[] }[];
  boxes: number;
  viewport: { width: number; height: number };
}

export interface ColorRolesReport extends ColorRolesInput {
  source: string;
  /** The largest surface, or the composited page background when none is declared. */
  base: ColorUse | null;
  /** The ink most of the page's text is set in. */
  bodyInk: ColorUse | null;
  /** The most-used interactive ink that is not the body ink, or null if there is none. */
  linkInk: ColorUse | null;
  /** Rows a `--allow` rule signed off. Listed, never silently gone. */
  allowed: { selector: string; reason: string }[];
  /** `--allow` rules that matched nothing, as written: a typo is otherwise silent. */
  unusedAllow: string[];
  findings: ColorFinding[];
  verdict: "consistent" | "color-dependent" | "not-judged";
}

// ---------------------------------------------------------------------------
// Browser collection
// ---------------------------------------------------------------------------

/**
 * Collect every visible box's colours with the role its element plays.
 *
 * Interpolates `CONTRAST_BACKGROUND_JS`, so a gradient behind something stays
 * `composite: true` — a refusal, not a guess — and `lab()` / `oklch()` resolve
 * through the browser's own rasterisation.
 *
 * Contains no backticks and no interpolation of its own beyond that one
 * fragment, for the reason its header gives.
 */
export const COLLECT_COLOR_ROLES = `(() => {
  ${CONTRAST_BACKGROUND_JS}
  ${STYLE_SAMPLING_JS}

  const hex = (c) => "#" + c.slice(0, 3).map((n) => Math.round(Math.min(255, Math.max(0, n))).toString(16).padStart(2, "0")).join("");
  const SKIP_TAGS = new Set(["script", "style", "head", "meta", "link", "title", "noscript", "template", "br", "wbr"]);
  // Colour's own answer to "is this on the page", because the shared visible() is
  // shaped for geometry: it skips an off-screen content-visibility: auto section,
  // and a footer drawn that way is still paint the page has. What colour must not
  // count is content that is never painted until someone opens it. A closed
  // details element is exactly that, and checkVisibility says so whatever it is
  // asked, while its descendants still report a size, because asking for one
  // forces layout. Reading only the size put 5615 collapsed elements into
  // css-tricks' palette and made its comment boxes the page's largest surface.
  const painted = (el) => {
    const shown = typeof el.checkVisibility === "function"
      ? el.checkVisibility({ visibilityProperty: true, opacityProperty: true })
      : visible(el);
    if (!shown || inheritedOpacity(el) < 0.05) return false;
    const r = el.getBoundingClientRect();
    return r.width >= 1 && r.height >= 1;
  };
  const ownText = (el) => {
    let n = 0;
    for (const node of el.childNodes) if (node.nodeType === 3) n += (node.nodeValue || "").trim().length;
    return n;
  };
  const SIDES = ["Top", "Right", "Bottom", "Left"];
  const drawnBorders = (cs) => {
    const out = [];
    for (const side of SIDES) {
      const w = parseFloat(cs["border" + side + "Width"]) || 0;
      const style = cs["border" + side + "Style"];
      if (w <= 0 || style === "none" || style === "hidden") continue;
      const c = parseColor(cs["border" + side + "Color"]);
      if (!c || c[3] <= 0.05) continue;
      out.push({ side: side.toLowerCase(), w: w, color: c });
    }
    return out;
  };

  // --- palette -------------------------------------------------------------
  const tally = { surfaces: new Map(), ink: new Map(), marks: new Map(), interactive: new Map() };
  const add = (into, h, area, sample) => {
    const e = into.get(h) || { hex: h, area: 0, count: 0, samples: [] };
    e.area += area; e.count++;
    if (e.samples.length < 3) e.samples.push(sample);
    into.set(h, e);
  };
  const unreadable = new Map();
  const noteUnreadable = (property, value, sample) => {
    const e = unreadable.get(property) || { property: property, count: 0, samples: [] };
    e.count++;
    if (e.samples.length < 2 && e.samples.indexOf(value) === -1) e.samples.push(value);
    unreadable.set(property, e);
  };

  const INTERACTIVE_SEL = "a[href], button, input, select, textarea, summary, [role=button], [role=link], [role=tab], [role=menuitem], [role=checkbox], [role=radio], [role=switch], [role=option], [contenteditable=true]";
  const isInteractive = (el) => el.matches(INTERACTIVE_SEL) && !(el.tagName === "A" && !el.hasAttribute("href"));

  let boxes = 0;
  for (const el of document.querySelectorAll("*")) {
    const tag = el.tagName.toLowerCase();
    if (SKIP_TAGS.has(tag)) continue;
    if (el.closest("svg") && tag !== "svg") continue;
    if (!painted(el)) continue;
    boxes++;
    const cs = getComputedStyle(el);
    const r = el.getBoundingClientRect();
    const area = Math.round(r.width * r.height);
    const sel = path(el);

    const bg = parseColor(cs.backgroundColor);
    if (bg === null && cs.backgroundColor) noteUnreadable("background-color", cs.backgroundColor, sel);
    if (bg && bg[3] > 0.05) add(tally.surfaces, hex(bg), area, sel);

    if (ownText(el) > 0) {
      const fg = parseColor(cs.color);
      if (fg === null) noteUnreadable("color", cs.color, sel);
      else {
        const behind = resolveTextBackground(el);
        add(tally.ink, hex(blendColor(behind.bg, fg)), area, sel);
      }
    }
    for (const b of drawnBorders(cs)) {
      const along = b.side === "top" || b.side === "bottom" ? r.width : r.height;
      add(tally.marks, hex(b.color), Math.round(b.w * along), sel);
    }
  }

  // --- controls (WCAG 1.4.11) ---------------------------------------------
  // Only controls whose EXTENT is the affordance. A checkbox, radio, colour
  // swatch or range is drawn by the platform and a submit button carries its own
  // label, so none of those is a field whose boundary is the only thing saying
  // where to type.
  const OPAQUE_INPUT_TYPES = new Set(["hidden", "submit", "button", "reset", "image", "color", "range", "checkbox", "radio", "file"]);
  const controls = [], controlsSkipped = [];
  for (const el of document.querySelectorAll("input, textarea, select, [contenteditable=true]")) {
    if (!painted(el)) continue;
    const tag = el.tagName.toLowerCase();
    if (tag === "input" && OPAQUE_INPUT_TYPES.has((el.getAttribute("type") || "text").toLowerCase())) continue;
    const sel = path(el);
    const behind = resolveTextBackground(el.parentElement || el);
    if (behind.composite) { controlsSkipped.push({ selector: sel, reason: "background-image behind the control" }); continue; }
    const cs = getComputedStyle(el);
    const own = parseColor(cs.backgroundColor);
    const fillRatio = own && own[3] > 0.05 ? contrastRatio(blendColor(behind.bg, own), behind.bg) : 0;
    let borderRatio = 0, borderHex = null;
    for (const b of drawnBorders(cs)) {
      const rr = contrastRatio(blendColor(behind.bg, b.color), behind.bg);
      if (rr > borderRatio) { borderRatio = rr; borderHex = hex(b.color); }
    }
    // An outline only stands in for a boundary when it is actually painted. A
    // reset that writes a 1px solid TRANSPARENT outline — to reserve the space a
    // focus ring will need — would otherwise suppress a real finding, which is
    // the same class of hole as counting a zero-width border-color.
    const outlineW = parseFloat(cs.outlineWidth) || 0;
    const outlineColor = parseColor(cs.outlineColor);
    const outlinePainted = outlineW > 0
      && cs.outlineStyle !== "none" && cs.outlineStyle !== "hidden"
      && !!outlineColor && outlineColor[3] > 0.05;
    controls.push({
      selector: sel, tag: tag, onHex: hex(behind.bg),
      fillHex: own && own[3] > 0.05 ? hex(own) : null,
      fillRatio: Math.round(fillRatio * 100) / 100,
      borderHex: borderHex, borderRatio: Math.round(borderRatio * 100) / 100,
      hasShadow: (cs.boxShadow || "none") !== "none",
      hasOutline: outlinePainted,
      best: Math.round(Math.max(fillRatio, borderRatio) * 100) / 100,
    });
  }

  // --- links in a prose flow (WCAG 1.4.1 / G183) --------------------------
  const flows = new Set();
  for (const a of document.querySelectorAll("a[href]")) if (a.parentElement) flows.add(a.parentElement);
  const links = [];
  for (const flow of flows) {
    if (!painted(flow)) continue;
    const kids = [];
    for (const c of flow.children) if (c.matches("a[href]") && painted(c)) kids.push(c);
    if (kids.length === 0) continue;
    const flowCs = getComputedStyle(flow);
    const bodyInk = parseColor(flowCs.color);
    if (!bodyInk) continue;
    const behind = resolveTextBackground(flow);
    const prose = ownText(flow);
    for (const a of kids) {
      const cs = getComputedStyle(a);
      const linkInk = parseColor(cs.color);
      if (!linkInk) continue;
      const bordered = drawnBorders(cs).length > 0;
      const fill = parseColor(cs.backgroundColor);
      links.push({
        selector: path(a), flow: path(flow), proseChars: prose,
        linkHex: hex(linkInk), bodyHex: hex(bodyInk),
        vsBody: behind.composite ? null
          : Math.round(contrastRatio(blendColor(behind.bg, linkInk), blendColor(behind.bg, bodyInk)) * 100) / 100,
        underlined: (cs.textDecorationLine || "").indexOf("underline") !== -1,
        weightStep: Math.abs((Number(cs.fontWeight) || 400) - (Number(flowCs.fontWeight) || 400)),
        hasFill: !!(fill && fill[3] > 0.05),
        hasBorder: bordered,
        sameInk: hex(linkInk) === hex(bodyInk),
      });
    }
  }

  // Interactive ink: once per control, and read off the CONTROL rather than off
  // the boxes inside it. Counting every ink-bearing descendant instead made
  // css-tricks' nav — every link wrapping a span — outvote the page's real link
  // colour, 404 white to 410 blue, because each nav link counted twice.
  for (const el of document.querySelectorAll(INTERACTIVE_SEL)) {
    if (!isInteractive(el) || !painted(el)) continue;
    const cs = getComputedStyle(el);
    const fg = parseColor(cs.color);
    if (!fg) continue;
    const r = el.getBoundingClientRect();
    const behind = resolveTextBackground(el);
    add(tally.interactive, hex(blendColor(behind.bg, fg)), Math.round(r.width * r.height), path(el));
  }

  const rank = (m) => [...m.values()].sort((a, b) => b.area - a.area);
  const pageBehind = resolveTextBackground(document.body || document.documentElement);
  return {
    palette: { surfaces: rank(tally.surfaces), ink: rank(tally.ink), marks: rank(tally.marks) },
    baseHex: hex(pageBehind.bg),
    interactiveInk: rank(tally.interactive),
    controls: controls, controlsSkipped: controlsSkipped, links: links,
    unreadable: [...unreadable.values()],
    boxes: boxes,
    viewport: { width: window.innerWidth, height: window.innerHeight },
  };
})()`;

// ---------------------------------------------------------------------------
// Pure judgement
// ---------------------------------------------------------------------------

/**
 * The palette rows worth printing, largest first.
 *
 * Sorts rather than trusting the order it was handed: the collector emits ranked
 * lists, so relying on that made `findBase` return whichever surface happened to
 * come first and the dependency was invisible until a test passed an unsorted
 * array.
 */
const trim = (list: readonly ColorUse[]): ColorUse[] => {
  const ranked = [...list].sort((a, b) => b.area - a.area);
  const total = ranked.reduce((n, c) => n + c.area, 0);
  if (total <= 0) return ranked;
  return ranked.filter((c) => c.area / total >= PALETTE_MIN_SHARE);
};

/**
 * The base surface. A page that declares no background at all still has one —
 * danluu.com has zero declared surfaces on 625 boxes — so the composited page
 * background stands in, which is what a reader sees either way.
 */
export function findBase(input: ColorRolesInput): ColorUse | null {
  const declared = trim(input.palette.surfaces)[0];
  if (declared) return declared;
  if (!input.baseHex) return null;
  return { hex: input.baseHex, area: input.viewport.width * input.viewport.height, count: 0, samples: ["(page background)"] };
}

/** The ink the page's text is mostly set in: the largest by painted area. */
export function findBodyInk(input: ColorRolesInput): ColorUse | null {
  return trim(input.palette.ink)[0] ?? null;
}

/**
 * The page's link ink: the interactive ink used on the most elements that is
 * NOT the body ink.
 *
 * The "not the body ink" clause is the whole definition, and it was measured
 * into existence. Ranking interactive ink by count alone reported the BODY ink
 * as the link colour on 7 of the 14 corpus pages — `#000000` for MDN, whose
 * links are `#044c9f`; `#202124` for web.dev, whose links are `#1a73e8` — because
 * navigation items, card titles and logos outnumber links in prose and are
 * deliberately set in the body colour, marked by position instead of by hue.
 *
 * That is the same finding that got `accent-role-collision` rejected, met a
 * second time from the other side: a link in the body colour is the norm, so any
 * definition of "the accent" that counts links is dominated by it.
 *
 * Returns null on a page whose only interactive ink IS the body ink — Hacker
 * News very nearly is one — because such a page has no link colour, and saying
 * so is better than naming its body grey.
 */
export function findLinkInk(input: ColorRolesInput): ColorUse | null {
  const body = findBodyInk(input)?.hex;
  const ranked = input.interactiveInk
    .filter((c) => c.hex !== body)
    .sort((a, b) => b.count - a.count);
  return ranked[0] ?? null;
}

/** A control whose own boundary is below the floor and which draws no other edge. */
export function invisibleControls(controls: readonly ControlBoundary[]): ControlBoundary[] {
  return controls.filter((c) => c.best < NON_TEXT_CONTRAST_FLOOR && !c.hasShadow && !c.hasOutline);
}

/**
 * Links marked off from the prose around them by colour alone.
 *
 * `sameInk` is split out rather than folded in: a link rendered in exactly the
 * body colour has no signal at all, which is a stronger claim than "not enough
 * contrast" and should not be reported as a ratio.
 */
export function colorOnlyLinks(links: readonly LinkCue[]): { weak: LinkCue[]; none: LinkCue[] } {
  const candidates = links.filter((l) =>
    l.proseChars >= PROSE_FLOOR_CHARS
    && !l.underlined
    && l.weightStep < WEIGHT_CUE_STEP
    && !l.hasFill
    && !l.hasBorder);
  return {
    none: candidates.filter((l) => l.sameInk),
    weak: candidates.filter((l) => !l.sameInk && l.vsBody !== null && l.vsBody < NON_TEXT_CONTRAST_FLOOR),
  };
}

export function judgeColorRoles(
  input: ColorRolesInput,
  options: { source?: string; allow?: readonly string[] } = {},
): ColorRolesReport {
  /**
   * An allowed row leaves the verdict and is still listed — the repo-wide
   * exemption property, so a sign-off reads as a decision rather than as
   * silence. Substring, not equality, because a selector is a generated path.
   */
  const allow = selectorAllowFilter(parseColorAllowRules(options.allow ?? []));
  const { keep } = allow;

  const findings: ColorFinding[] = [];
  const controls = invisibleControls(input.controls).filter((c) => keep(c.selector));
  for (const c of controls.slice(0, 5)) {
    const edge = c.best === 0
      ? "draws no fill, border, shadow or outline at all"
      : `draws its strongest edge at ${c.best}:1 (${c.fillRatio >= c.borderRatio ? `fill ${c.fillHex}` : `border ${c.borderHex}`})`;
    findings.push({
      kind: "control-boundary-invisible",
      severity: "warn",
      selector: c.selector,
      message:
        `<${c.tag}> ${edge} against the ${c.onHex} behind it, so where to type is not visible.`
        + ` WCAG 1.4.11 asks for ${NON_TEXT_CONTRAST_FLOOR}:1 on a control's boundary; a shadow or an outline`
        + ` would satisfy it too, and this has neither.`,
      evidence: {
        onHex: c.onHex, fillHex: c.fillHex, fillRatio: c.fillRatio,
        borderHex: c.borderHex, borderRatio: c.borderRatio, best: c.best,
      },
    });
  }
  if (controls.length > 5) {
    findings.push({
      kind: "control-boundary-invisible",
      severity: "warn",
      message: `…and ${controls.length - 5} more control(s) with no visible boundary.`,
      evidence: { remaining: controls.length - 5 },
    });
  }

  const { weak, none } = colorOnlyLinks(input.links);
  // Dedup by the case rather than by the element: one stylesheet rule produces
  // as many rows as it has links, and "3 findings" reads as three fixes.
  const byCase = new Map<string, { rows: LinkCue[]; sample: LinkCue }>();
  for (const l of weak.filter((x) => keep(x.selector))) {
    const key = `${l.linkHex}|${l.bodyHex}`;
    const e = byCase.get(key) ?? { rows: [], sample: l };
    e.rows.push(l);
    byCase.set(key, e);
  }
  for (const { rows, sample } of [...byCase.values()].sort((a, b) => b.rows.length - a.rows.length).slice(0, 5)) {
    findings.push({
      kind: "color-only-link",
      severity: "warn",
      selector: sample.selector,
      message:
        `${sample.linkHex} link inside ${sample.bodyHex} prose at ${sample.vsBody}:1, with no underline,`
        + ` weight step, border or fill to mark it — so colour is the only thing saying it is a link`
        + ` (${rows.length} element(s), e.g. in ${sample.flow}).`
        + ` WCAG 1.4.1 technique G183 asks for ${NON_TEXT_CONTRAST_FLOOR}:1 against the surrounding text when`
        + ` colour is the only cue. This is disjoint from check a11y contrast, which measures the link`
        + ` against its BACKGROUND and passes.`,
      evidence: {
        linkHex: sample.linkHex, bodyHex: sample.bodyHex, vsBody: sample.vsBody,
        proseChars: sample.proseChars, flow: sample.flow, elements: rows.length,
      },
    });
  }
  for (const l of none.filter((x) => keep(x.selector)).slice(0, 3)) {
    findings.push({
      kind: "link-no-cue",
      severity: "warn",
      selector: l.selector,
      message:
        `Link renders in exactly the ${l.bodyHex} of the prose around it, with no underline, weight step,`
        + ` border or fill — nothing distinguishes it from the sentence (in ${l.flow}).`,
      evidence: { ink: l.bodyHex, flow: l.flow, proseChars: l.proseChars },
    });
  }

  const unreadableTotal = input.unreadable.reduce((n, u) => n + u.count, 0);
  if (unreadableTotal > 0) {
    findings.push({
      kind: "unreadable-color",
      severity: "info",
      message:
        `${unreadableTotal} declared colour(s) could not be read and were left out of everything above`
        + ` (${input.unreadable.map((u) => `${u.property} x${u.count}`).join(", ")};`
        + ` e.g. ${input.unreadable[0]?.samples[0] ?? "?"}).`
        + ` Reported rather than dropped: a colour gate that silently skips what it cannot parse is`
        + ` indistinguishable from one that found it acceptable.`,
      evidence: { total: unreadableTotal, byProperty: input.unreadable },
    });
  }

  const judgedAnything = input.controls.length > 0 || input.links.length > 0;
  if (!judgedAnything) {
    findings.push({
      kind: "nothing-judged",
      severity: "info",
      message:
        `No control and no link in a text flow, so neither rule had anything to measure`
        + ` — the palette below is reported, and this verdict rests on nothing.`
        + ` A page of ${input.boxes} box(es) with no interactive text is a document, not a defect.`,
      evidence: { boxes: input.boxes },
    });
  }

  const carries = findings.some((f) => f.severity === "warn" || f.severity === "suspect");
  return {
    ...input,
    source: options.source ?? "page.html",
    base: findBase(input),
    bodyInk: findBodyInk(input),
    linkInk: findLinkInk(input),
    allowed: allow.allowed,
    unusedAllow: allow.unused(),
    findings,
    verdict: !judgedAnything ? "not-judged" : carries ? "color-dependent" : "consistent",
  };
}

// ---------------------------------------------------------------------------
// Formatting
// ---------------------------------------------------------------------------

const pct = (n: number, total: number): string => total <= 0 ? "  —  " : `${(n / total * 100).toFixed(1)}%`;

function paletteBlock(name: string, list: readonly ColorUse[], limit = 5): string[] {
  const kept = trim(list);
  if (kept.length === 0) return [`  ${name.padEnd(9)} ${DIM}—${RESET}`];
  const total = kept.reduce((n, c) => n + c.area, 0);
  const lines = [`  ${name.padEnd(9)} ${kept.length} distinct`];
  for (const c of kept.slice(0, limit)) {
    lines.push(
      `    ${c.hex}  ${pct(c.area, total).padStart(6)}  ${String(c.count).padStart(4)} el`
      + `  ${DIM}${c.samples[0] ?? ""}${RESET}`,
    );
  }
  if (kept.length > limit) lines.push(`    ${DIM}…and ${kept.length - limit} more${RESET}`);
  return lines;
}

export function formatColorRolesReport(report: ColorRolesReport, rules?: RuleView): string {
  const out: string[] = [];
  const verdictColor = report.verdict === "consistent" ? GREEN : report.verdict === "not-judged" ? YELLOW : RED;
  out.push("");
  out.push(`${BOLD}${CYAN}vlmkit check color${RESET}`);
  out.push(`${DIM}source: ${report.source}${RESET}`);
  out.push("");
  // The prose has to know when a rule was turned off or re-tuned, or it prints a
  // verdict drawn from findings the reader can no longer see.
  const tiers = applyRuleTiers(report.findings, (f) => ({ rule: f.kind, emitted: f.severity }), rules);
  const shown = tiers.shown;
  const suspects = shown.filter((f) => f.tier === "suspect").length;
  out.push(
    `verdict: ${verdictColor}${report.verdict.toUpperCase()}${RESET}`
    + ` (${shown.length} finding(s)${suspects > 0 ? `, ${suspects} suspect` : ""})`,
  );
  const hidden = hiddenByRuleNote(tiers.hiddenByRule);
  if (hidden) out.push(`${DIM}  ${hidden} — the verdict word above predates the settings${RESET}`);
  out.push(
    `${DIM}  measured: ${report.controls.length} control(s), ${report.links.length} link(s) in a text flow`
    + ` — from ${report.boxes} visible box(es)${RESET}`,
  );
  if (report.controlsSkipped.length > 0) {
    out.push(`${DIM}  ${report.controlsSkipped.length} control(s) not measurable: background-image behind them${RESET}`);
  }
  out.push("");
  out.push(`${BOLD}Palette${RESET} ${DIM}(by painted area; reported, never judged — see the rejected candidates in the module docs)${RESET}`);
  out.push(...paletteBlock("surfaces", report.palette.surfaces));
  out.push(...paletteBlock("ink", report.palette.ink));
  out.push(...paletteBlock("marks", report.palette.marks));
  out.push(
    `  ${DIM}base ${report.base?.hex ?? "?"}`
    + (report.base?.count === 0 ? " (page background; nothing declares one)" : "")
    + `, body ink ${report.bodyInk?.hex ?? "?"}`
    + `, link ink ${report.linkInk?.hex ?? "none"}`
    + (report.linkInk ? ` on ${report.linkInk.count} element(s)` : " — every link is set in the body ink")
    + `${RESET}`,
  );

  // Tiers, not the emitted severity: a rule promoted to suspect or demoted to
  // info by project settings has to print where the reader expects it.
  const carried = shown.filter((f) => f.tier !== "info");
  const info = shown.filter((f) => f.tier === "info");
  if (carried.length > 0) {
    out.push("");
    out.push(`${BOLD}Findings${RESET}`);
    for (const f of carried) {
      out.push(
        `  ${f.tier === "suspect" ? RED + "✗" : YELLOW + "!"}${RESET} [${f.row.kind}]:`
        + ` ${f.row.selector ? `${f.row.selector} — ` : ""}${f.row.message}`,
      );
    }
  }
  if (info.length > 0) {
    out.push("");
    out.push(`${BOLD}Informational${RESET} ${DIM}(true, but does not carry the verdict)${RESET}`);
    for (const f of info) out.push(`  ${DIM}i${RESET} [${f.row.kind}]: ${f.row.message}`);
  }
  if (report.allowed.length > 0) {
    out.push("");
    out.push(`${BOLD}Signed off${RESET} ${DIM}(--allow; off the verdict, still listed)${RESET}`);
    for (const a of report.allowed) out.push(`  ${DIM}-${RESET} ${a.selector} — ${a.reason}`);
  }
  if (report.unusedAllow.length > 0) {
    out.push("");
    out.push(`${YELLOW}${report.unusedAllow.length} --allow rule(s) matched nothing: ${report.unusedAllow.join(", ")}${RESET}`);
  }
  out.push("");
  return out.join("\n");
}

// ---------------------------------------------------------------------------
// Runner
// ---------------------------------------------------------------------------

export interface ColorRolesOptions extends PageLoadOptions {
  source: string;
  viewport?: number;
  allow?: readonly string[];
  storageState?: string;
  reportPath?: string;
}

export async function runColorRolesCheck(options: ColorRolesOptions): Promise<ColorRolesReport> {
  return await withBrowser(async (browser) => {
    const width = options.viewport ?? 1280;
    const page = await browser.newPage(
      withAuthState({ viewport: { width, height: 900 } }, options.storageState),
    );
    if (options.har) await page.routeFromHAR(resolve(options.har), { notFound: "abort" });
    const isUrl = /^https?:\/\//.test(options.source);
    const url = isUrl ? options.source : pathToFileURL(resolve(options.source)).href;
    await page.goto(url, {
      waitUntil: options.waitUntil ?? "networkidle",
      timeout: options.timeout ?? 30000,
    });
    await settlePage(page, 250);
    const redirect = isUrl ? describeRedirect(options.source, page.url()) : null;
    const input = await page.evaluate(COLLECT_COLOR_ROLES) as ColorRolesInput;
    const report = judgeColorRoles(input, { source: options.source, allow: options.allow });
    if (redirect) {
      report.findings.unshift({ kind: "redirected", severity: "suspect", message: redirect });
    }
    appendRunLedger({
      tool: "check-color",
      source: options.source,
      headline: {
        verdict: report.verdict,
        base: report.base?.hex ?? null,
        bodyInk: report.bodyInk?.hex ?? null,
        linkInk: report.linkInk?.hex ?? null,
        invisibleControls: invisibleControls(report.controls).length,
        colorOnlyLinks: colorOnlyLinks(report.links).weak.length,
        unreadableColors: report.unreadable.reduce((n, u) => n + u.count, 0),
      },
    });
    if (options.reportPath) {
      const target = resolve(options.reportPath);
      await mkdir(dirname(target), { recursive: true });
      await writeFile(target, markdownReport(report), "utf8");
    }
    return report;
  });
}

function markdownReport(report: ColorRolesReport): string {
  const rows = (name: string, list: readonly ColorUse[]) => {
    const kept = trim(list);
    if (kept.length === 0) return [`### ${name}\n\nNone.\n`];
    const total = kept.reduce((n, c) => n + c.area, 0);
    return [
      `### ${name}\n`,
      "| colour | share of role | elements | example |",
      "|---|---|---|---|",
      ...kept.map((c) => `| \`${c.hex}\` | ${pct(c.area, total)} | ${c.count} | \`${c.samples[0] ?? ""}\` |`),
      "",
    ];
  };
  return [
    `# check color — ${report.source}`,
    "",
    `Verdict: **${report.verdict.toUpperCase()}** (${report.findings.length} finding(s))`,
    "",
    `Base \`${report.base?.hex ?? "?"}\`, body ink \`${report.bodyInk?.hex ?? "?"}\`,`
    + ` link ink \`${report.linkInk?.hex ?? "none"}\`.`,
    `${report.controls.length} control(s) and ${report.links.length} link(s) in a text flow measured,`
    + ` from ${report.boxes} visible boxes.`,
    "",
    "## Palette",
    "",
    ...rows("Surfaces", report.palette.surfaces),
    ...rows("Ink", report.palette.ink),
    ...rows("Marks", report.palette.marks),
    "## Findings",
    "",
    ...(report.findings.length === 0
      ? ["None."]
      : report.findings.map((f) => `- **${f.kind}** (${f.severity})${f.selector ? ` \`${f.selector}\`` : ""}: ${f.message}`)),
    "",
  ].join("\n");
}

/**
 * `--allow "<selector>;<reason>"`, named after the rule an exemption most often
 * serves — the same convention `parseCompositionAllowRules` and
 * `parseDesignAllowRules` follow, so the refusal can suggest `--rule x=off`.
 */
export function parseColorAllowRules(specs: readonly string[]): SelectorAllowRule[] {
  return parseSelectorAllowRules(specs, { ruleId: "color-only-link" });
}

export const COLOR_ALLOW_HELP =
  'Sign off a control or link: --allow "<selector>;<reason>". The reason is required and the'
  + " exempted row is still listed, so an exemption reads as a decision rather than as silence.";
