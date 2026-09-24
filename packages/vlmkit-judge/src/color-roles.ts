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

import { parseSelectorAllowRules, selectorAllowFilter, type SelectorAllowRule } from "./allow.ts";

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
export const trimPalette = (list: readonly ColorUse[]): ColorUse[] => {
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
  const declared = trimPalette(input.palette.surfaces)[0];
  if (declared) return declared;
  if (!input.baseHex) return null;
  return { hex: input.baseHex, area: input.viewport.width * input.viewport.height, count: 0, samples: ["(page background)"] };
}

/** The ink the page's text is mostly set in: the largest by painted area. */
export function findBodyInk(input: ColorRolesInput): ColorUse | null {
  return trimPalette(input.palette.ink)[0] ?? null;
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
