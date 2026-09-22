#!/usr/bin/env node
/**
 * Visual grounding scan — can an agent that sees only a screenshot act on this page?
 *
 * Every other gate in this repo measures the page for a *human* reader or for a
 * *DOM-driven* test: `check a11y touch` asks whether a finger can hit a control,
 * `check interactions` drives the keyboard, `scan handlers` enumerates listeners
 * a selector can reach. A computer-use agent is neither. It receives a PNG,
 * names a target in words, emits a pixel coordinate, and finds out what happened
 * by looking at the next PNG. Three things it depends on are invisible to every
 * gate above:
 *
 *   1. **The coordinate it emits is the one the browser routes.** A control can
 *      be painted, focusable and keyboard-operable while `elementFromPoint` at
 *      its own centre returns a cookie banner. Selector-driven tooling never
 *      notices — Playwright's `click()` scrolls, waits for actionability and
 *      would report the interception; a screenshot-driven agent just sends the
 *      click and reads someone else's dialog back.
 *   2. **The words it uses resolve to one target.** "Click Edit" is unanswerable
 *      when six rows each paint `Edit`, and the accessible names are the same
 *      six. A DOM test picks `nth(3)`; an agent looking at pixels cannot.
 *   3. **The screenshot it is given still resolves the target.** The PNG is
 *      downscaled before the model sees it (`image-resize.ts` is where this
 *      toolkit does it), so a 9px close button is a smear of four pixels at the
 *      resolution the decision is actually made at.
 *
 * So this gate measures in the agent's coordinate space, not the page's, and its
 * positive output is the thing such an agent needs and no tool here produced: an
 * **action map** — role, visible label, and the click point in screenshot
 * pixels, for every target in the frame. `--json` emits it; `--mark` draws it
 * onto the screenshot (numbered boxes — the "set-of-mark" prompt that a vision
 * model grounds against far more reliably than raw pixels).
 *
 * Deterministic: Playwright hit testing, computed style, and pixel arithmetic.
 * No VLM, no API key. The judgement calls a VLM would make here ("is this the
 * Submit button?") are exactly the ones it gets wrong; the ones it cannot make
 * ("which element receives a click at 613,284?") are the ones that decide
 * whether the agent's turn succeeds.
 *
 * What it deliberately does NOT cover:
 *   - Text painted over by a `pointer-events: none` layer. That layer does not
 *     intercept the click, so hit testing calls it clean, and it IS clean for
 *     routing — but the agent cannot read what is under it. `check integrity`
 *     measures painted-over text; this gate measures where clicks land.
 *   - Whether the action had an effect. That is the other half of the loop and
 *     `vlmkit inspect explore` already measures it (pixel delta + DOM mutations
 *     per action, with the dead-action verdict).
 *   - Controls discovered only from wired listeners. `scan handlers` patches
 *     `addEventListener` to find those; this gate reads roles and `[onclick]`.
 *
 * Usage:
 *   vlmkit check grounding <html-or-url>
 *   vlmkit check grounding <url> --resolution 1024x768 --json
 *   vlmkit check grounding <url> --mark marked.png
 */
import { resolve } from "node:path";
import { mkdir, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import { STABLE_SELECTOR_JS } from "@mizchi/vlmkit-core/stable-selector.ts";
import { withAuthState } from "@mizchi/vlmkit-core/auth-state.ts";
import { describeRedirect } from "@mizchi/vlmkit-core/navigation-redirect.ts";
import { type PageLoadOptions, navigatePage, navigationOptions } from "@mizchi/vlmkit-core/page-load.ts";
import { BOLD, CYAN, DIM, GREEN, RED, RESET, YELLOW } from "@mizchi/vlmkit-core/terminal-colors.ts";
import type { RuleView } from "@mizchi/vlmkit-core/plugin/contract.ts";
import { retuneNote, tierIssues } from "@mizchi/vlmkit-core/plugin/rule-prose.ts";
import { withBrowser } from "@mizchi/vlmkit-core/browser-launch.ts";
import { isUrlSource, sourceToUrl } from "@mizchi/vlmkit-core/page-open.ts";
import {
  RESOLUTION_PRESETS,
  type ResolutionPreset,
  resolveResolutionForViewport,
} from "@mizchi/vlmkit-core/image-resize.ts";
import { drawText, fitText, measureText, textHeight } from "@mizchi/vlmkit-core/bitmap-font.ts";

export interface Box {
  x: number;
  y: number;
  width: number;
  height: number;
}

/** One candidate as the page reports it, before any agent-space arithmetic. */
export interface GroundingTargetSample {
  selector: string;
  tag: string;
  /** ARIA role, explicit or implicit. `generic` for `[onclick]` / `[tabindex]` with no role. */
  role: string;
  /** Accessible name: aria-label / aria-labelledby / text / value / placeholder / title. */
  name: string;
  /**
   * Text actually PAINTED inside the box — `innerText`, so display:none subtrees
   * and `visibility: hidden` spans are already excluded. This is what a reader of
   * the screenshot has; `name` is what the a11y tree has, and the two disagreeing
   * is its own finding.
   */
  visibleText: string;
  /**
   * The box paints something other than text: a replaced element, a background
   * or mask image, or generated `::before` / `::after` content (icon fonts).
   * An icon-only button is perfectly groundable; a box that paints *nothing* is
   * not, and that is the distinction this flag exists to draw.
   */
  hasGlyph: boolean;
  /** Viewport-relative CSS px, unclamped — may extend past the frame on any side. */
  bbox: Box;
  /**
   * The point the agent would click: the centre of the box's intersection with
   * the viewport, not the centre of the box. A sticky header half off the top
   * has a box centre at y=-4, and an agent told to click there clicks nothing.
   */
  clickPoint: { x: number; y: number };
  /** Fraction of a 3x3 grid inside the visible box that `elementFromPoint` routes to this target. */
  hitFraction: number;
  /** Did the click point itself route here? The other eight points are evidence, this is the verdict. */
  centreHit: boolean;
  /** What took the click point instead. Absent when `centreHit`. */
  interceptedBy?: string;
  /**
   * The interceptor is a `<label>` whose control is this target, so the click is
   * forwarded and the agent's turn still succeeds.
   *
   * Without this the checkbox-inside-its-own-label pattern — the single most
   * common way a form is written — reported every checkbox on the page as
   * occluded. The hit test is right that the label takes the click; it is the
   * conclusion that would have been wrong.
   */
  forwardedByLabel?: boolean;
  /**
   * A point inside the box that DOES route to the target, found by sweeping it
   * when the centre did not. Absent when the centre routed (nothing to search
   * for) or when the sweep found nothing (the target really is unreachable).
   *
   * `room` is how far that point sits from the nearest thing that is not the
   * target, in CSS px — the margin an agent's coordinate error has to stay
   * inside. A 1px pocket and a 40px one are both "reachable" and only one of
   * them is worth aiming at.
   */
  reachable?: { x: number; y: number; room: number; sampled: number; clear: number };
  /** `disabled` / `aria-disabled`. Kept in the map, excluded from every finding. */
  disabled: boolean;
  /**
   * Any part of the box actually PAINTED — inside the viewport and inside every
   * clipping ancestor. False for a list item scrolled out of its scrollport as
   * much as for one below the page fold: neither is on the screen the agent has.
   */
  inFrame: boolean;
  /** The box extends past the visible area — the frame's edge, or a container's. */
  clipped: boolean;
  /**
   * The nearest ancestor that hides this target entirely, when one does, with
   * how far it would have to scroll for the target to come into view (CSS px,
   * positive = down / right).
   *
   * The round that added this had all three agents work out the remedy from the
   * picture instead: "the actual fix is scrolling the list, which the harness
   * supports (wheel) and the tool never names as an option." The control arm,
   * with no tool at all, specified it: "A DOM-aware tool would have told me
   * directly '12 tickets, scrolled to 4/12'."
   */
  clippedBy?: { selector: string; scrollable: boolean; dy: number; dx: number };
  /**
   * Own visible text of up to three ancestors, nearest first, for disambiguation.
   *
   * Six rows of `Edit` are only unresolvable if nothing around them differs. The
   * row's own text usually does, and telling the agent "the one in the row that
   * reads `ACME Corp`" is the difference between an unanswerable instruction and
   * an answerable one — so the report names the level that separates them rather
   * than only reporting the clash.
   */
  ancestorTexts: string[];
}

export interface GroundingPageSample {
  viewportWidth: number;
  viewportHeight: number;
  /** Candidates dropped by the in-page cap, so a truncated scan never reads as a clean one. */
  capped: number;
}

export interface GroundingScanInput {
  source: string;
  page: GroundingPageSample;
  targets: GroundingTargetSample[];
}

/** The resolution the decision is actually made at. */
export interface AgentFrame {
  /**
   * How the resolution was chosen — a preset name, or the `WxH` the caller asked
   * for. This is the CAP that was applied, not the frame that came out of it:
   * `medium` caps at 640x480 and a 16:9 viewport under it is 640x360. Findings
   * quote `width`x`height`; v1's agent read the cap in every message and
   * reported, correctly, that "that parenthetical never matches the real frame
   * size, in every single finding line".
   */
  resolution: string;
  /** Screenshot pixels the model sees. */
  width: number;
  height: number;
  /** CSS px -> screenshot px. 1 when no downscale applies. */
  scale: number;
  viewportWidth: number;
  viewportHeight: number;
}

/** One row of the action map: what an agent needs to act, in the space it acts in. */
export interface GroundingTarget {
  /** Short stable handle used by the marked screenshot and by the prose. */
  id: string;
  selector: string;
  role: string;
  /** What a reader of the screenshot would call it: visible text, else the accessible name. */
  label: string;
  /**
   * Click point in screenshot px — **the coordinate to emit**, which is the
   * whole contract of this row. It is the centre of the visible box normally,
   * and the middle of the largest clear pocket when something covers that
   * centre, because a map whose coordinate does not reach its own target is
   * worse than no map: v1's smaller model emitted the centre the map gave it
   * and activated the promo ribbon on top of the button.
   */
  point: { x: number; y: number };
  /**
   * Present when `point` is NOT the centre of the element's own box: why it
   * moved, where the centre was, and how far the new point sits from whatever
   * would make it miss — the interceptor for `occluded`, the frame edge for
   * `clipped` — in screenshot px.
   *
   * `clipped` is here because v1's follow-up run asked for it by name: "the
   * click point is silently recentred into the visible sliver, but only the
   * occlusion case gets an explicit `aimedOffCentre` field — clipping gets no
   * equivalent margin number, just prose." Both cases move the coordinate, so
   * both declare it, and a consumer can tell a 3px aim budget from a 40px one
   * without re-deriving it from two boxes.
   */
  aimedOffCentre?: { reason: "occluded" | "clipped"; centre: { x: number; y: number }; room: number };
  /** Click point in CSS px, for a caller driving a real browser instead. */
  cssPoint: { x: number; y: number };
  /** Box in screenshot px. */
  box: Box;
  /**
   * The part of the box inside the frame, in screenshot px. Equal to `box` for a
   * target the frame contains; smaller for one the fold or an edge cuts.
   *
   * Carried because it is the box every measurement here is actually taken on,
   * and a consumer aiming at `point` needs to know how much of the target it can
   * see rather than how big the element is.
   */
  visibleBox: Box;
  /** Min side of `visibleBox` — the limiting dimension for resolving the target at all. */
  minSide: number;
  /**
   * Distance from the click point to the nearest OTHER target's box, screenshot px.
   *
   * Absent when the frame holds no other target — `Infinity` serializes as `null`
   * through `--json`, and a `null` margin reads like a measurement that failed
   * rather than one with nothing to measure against.
   */
  aimMargin?: number;
  /** The target that margin is measured against. */
  nearest?: string;
  disabled: boolean;
  inFrame: boolean;
  clipped: boolean;
  /** See `GroundingTargetSample.clippedBy`. Scaled into screenshot px. */
  clippedBy?: { selector: string; scrollable: boolean; dy: number; dx: number };
  /**
   * Rule ids this target tripped. Present on the row as well as in `issues` so a
   * caller consuming the action map alone — which is the point of the action map —
   * still learns that this coordinate is not to be trusted.
   */
  risks: GroundingIssueKind[];
}

export type GroundingIssueKind =
  /** A URL that redirected somewhere meaningful — almost always a login wall. */
  | "redirected"
  | "occluded-target"
  | "ambiguous-target"
  | "unlabeled-target"
  | "imprecise-target"
  | "crowded-target"
  | "label-mismatch";

export interface GroundingIssue {
  kind: GroundingIssueKind;
  severity: "warn" | "suspect";
  message: string;
  selector?: string;
}

/** One `--at` answer: what a click at this screenshot coordinate would reach. */
export interface GroundingProbe {
  /** As given, in screenshot px. */
  point: { x: number; y: number };
  /** The same point in CSS px, which is where it was dispatched. */
  cssPoint: { x: number; y: number };
  /** `stableSelector` of the element that takes the click, or null for nothing. */
  hit: string | null;
  /** The action-map row this landed on, when it landed on one. */
  targetId?: string;
  /**
   * The nearest element from the hit up to `<body>` that carries a role, an
   * `onclick` or a non-negative `tabindex` — what the click would most likely
   * set off, when the hit itself is not in the map.
   *
   * Absent means nothing on that path declares itself interactive, which is the
   * closest this gate can honestly get to "the click does nothing". Added
   * because a run read the old `(not a target)` and said: it "never says whether
   * #promo is inert or itself clickable; 'not a target' means 'not in the
   * actionable list,' not 'safe to slip onto.'"
   */
  wouldReach?: string;
  /** Outside the frame, so no click could be sent there at all. */
  offFrame?: boolean;
}

export interface GroundingScanReport {
  source: string;
  frame: AgentFrame;
  targets: GroundingTarget[];
  /** Present only when `--at` was passed. Absent means "not asked", never "clean". */
  probes?: GroundingProbe[];
  /** Candidates the in-page cap dropped. */
  capped: number;
  issues: GroundingIssue[];
}

export interface GroundingScanOptions extends PageLoadOptions {
  source: string;
  html?: string;
  storageState?: string;
  viewport?: { width: number; height: number };
  /**
   * The size the screenshot is reduced to before a model reads it: a preset name
   * from `image-resize.ts`, or `WxH`. Omitted means `resolveResolutionForViewport`,
   * i.e. the same choice this toolkit's own VLM path makes for that viewport.
   */
  resolution?: ResolutionPreset | { maxWidth: number; maxHeight: number };
  /** Min side (screenshot px) below which a target is not resolvable. Default 10. */
  precisionFloor?: number;
  /** Click-point-to-neighbour distance (screenshot px) below which a miss hits the neighbour. Default 6. */
  aimMargin?: number;
  /** Write a numbered set-of-mark screenshot here. */
  markPath?: string;
  /**
   * `--at x,y` — hit-test these screenshot-px points and report what each one
   * reaches, without changing the verdict.
   *
   * v1's agent found the gap by needing it: it disbelieved an `occluded-target`
   * line, was right to, and had "no coordinate-hit-test command to confirm
   * whether a specific pixel actually resolves to a given element short of
   * trusting the report". A map a caller cannot check is a map it has to take on
   * faith, and the one line it should not have taken on faith was the one it
   * caught.
   */
  at?: readonly { x: number; y: number }[];
}

const MAX_TARGETS = 300;

/**
 * Resolve the screenshot the agent actually reads.
 *
 * Kept separate and pure because the number it returns is the one every finding
 * in this gate is denominated in: get the scale wrong and a clean page reports
 * six unreachable buttons, or a page of 8px icons reports clean.
 */
export function resolveAgentFrame(
  viewport: { width: number; height: number },
  resolution?: ResolutionPreset | { maxWidth: number; maxHeight: number },
): AgentFrame {
  const chosen = resolution ?? resolveResolutionForViewport(viewport.width);
  const box = typeof chosen === "string" ? RESOLUTION_PRESETS[chosen] : chosen;
  const label = typeof chosen === "string"
    ? `${chosen}, cap ${box.maxWidth}x${box.maxHeight}`
    : `cap ${box.maxWidth}x${box.maxHeight}`;
  // `min(1, ...)` because `resizePngBuffer` returns the original when it already
  // fits: a preset LARGER than the viewport must not scale the coordinates up.
  const scale = Math.min(1, box.maxWidth / viewport.width, box.maxHeight / viewport.height);
  return {
    resolution: label,
    width: Math.round(viewport.width * scale),
    height: Math.round(viewport.height * scale),
    scale,
    viewportWidth: viewport.width,
    viewportHeight: viewport.height,
  };
}

/** Normalized for comparison: an agent reading pixels does not see case or runs of space. */
function normalizeLabel(text: string): string {
  return text.replace(/\s+/g, " ").trim().toLowerCase();
}

/** Distance from a point to a box, 0 when the point is inside it. */
function boxDistance(point: { x: number; y: number }, box: Box): number {
  const dx = Math.max(box.x - point.x, 0, point.x - (box.x + box.width));
  const dy = Math.max(box.y - point.y, 0, point.y - (box.y + box.height));
  return Math.hypot(dx, dy);
}

/** Does `outer` fully contain `inner`? */
function encloses(outer: Box, inner: Box): boolean {
  return outer.x <= inner.x
    && outer.y <= inner.y
    && outer.x + outer.width >= inner.x + inner.width
    && outer.y + outer.height >= inner.y + inner.height;
}

function scaleBox(box: Box, scale: number): Box {
  return {
    x: Math.round(box.x * scale),
    y: Math.round(box.y * scale),
    width: Math.round(box.width * scale),
    height: Math.round(box.height * scale),
  };
}

function shorten(text: string, max = 48): string {
  const one = text.replace(/\s+/g, " ").trim();
  return one.length > max ? `${one.slice(0, max - 1)}…` : one;
}

/**
 * Pure post-process: samples in CSS px -> action map in screenshot px + findings.
 *
 * Split out for the same reason every other gate here splits it out — the
 * interesting arithmetic is testable against hand-built samples, with no browser
 * and no fixture page to keep in agreement with the assertions.
 */
export function analyzeGroundingSamples(
  input: GroundingScanInput,
  options: {
    resolution?: ResolutionPreset | { maxWidth: number; maxHeight: number };
    precisionFloor?: number;
    aimMargin?: number;
  } = {},
): GroundingScanReport {
  const precisionFloor = options.precisionFloor ?? 10;
  const aimFloor = options.aimMargin ?? 6;
  const frame = resolveAgentFrame(
    { width: input.page.viewportWidth, height: input.page.viewportHeight },
    options.resolution,
  );

  const targets: GroundingTarget[] = input.targets.map((sample, i) => {
    // The point that reaches the target beats the point at its centre.
    const aim = sample.reachable ?? sample.clickPoint;
    return {
    id: `t${i + 1}`,
    selector: sample.selector,
    role: sample.role,
    label: shorten(sample.visibleText || sample.name),
    point: {
      x: Math.round(aim.x * frame.scale),
      y: Math.round(aim.y * frame.scale),
    },
    cssPoint: { x: Math.round(aim.x), y: Math.round(aim.y) },
    ...(sample.reachable
      ? {
        aimedOffCentre: {
          reason: "occluded" as const,
          centre: {
            x: Math.round(sample.clickPoint.x * frame.scale),
            y: Math.round(sample.clickPoint.y * frame.scale),
          },
          room: Math.round(sample.reachable.room * frame.scale),
        },
      }
      : {}),
    box: scaleBox(sample.bbox, frame.scale),
    visibleBox: scaleBox(sample.bbox, frame.scale),
    minSide: 0,
    disabled: sample.disabled,
    inFrame: sample.inFrame,
    clipped: sample.clipped,
    ...(sample.clippedBy
      ? {
        clippedBy: {
          selector: sample.clippedBy.selector,
          scrollable: sample.clippedBy.scrollable,
          dy: Math.round(sample.clippedBy.dy * frame.scale),
          dx: Math.round(sample.clippedBy.dx * frame.scale),
        },
      }
      : {}),
    risks: [],
    };
  });

  // Second pass: the two geometric properties that are relations between targets
  // rather than facts about one. `minSide` uses the VISIBLE box — a card half
  // below the fold is as resolvable as the part of it on screen, and no more.
  for (let i = 0; i < targets.length; i++) {
    const target = targets[i]!;
    const sample = input.targets[i]!;
    const visible = {
      x: Math.max(target.box.x, 0),
      y: Math.max(target.box.y, 0),
      width: Math.max(0, Math.min(target.box.x + target.box.width, frame.width) - Math.max(target.box.x, 0)),
      height: Math.max(0, Math.min(target.box.y + target.box.height, frame.height) - Math.max(target.box.y, 0)),
    };
    if (sample.inFrame) {
      target.visibleBox = visible;
      // The collector already clamps the click point into the visible part, so
      // a clipped target's coordinate is off its own centre too — say so, with
      // the margin the frame edge leaves. Occlusion has already claimed the
      // field when both apply: it is the one that decides whether the click
      // reaches the element at all.
      const boxCentre = {
        x: Math.round(target.box.x + target.box.width / 2),
        y: Math.round(target.box.y + target.box.height / 2),
      };
      // The condition is that the frame CUT the box, not that the two centres
      // differ: `point` and `boxCentre` are rounded from different quantities,
      // so they disagree by a pixel on perfectly ordinary targets, and the first
      // version of this labelled three nav links and a table button `clipped`
      // with 7px of room. A cut box is a fact; a ±1 disagreement is arithmetic.
      const cut = visible.width !== target.box.width || visible.height !== target.box.height;
      if (!target.aimedOffCentre && cut) {
        target.aimedOffCentre = {
          reason: "clipped",
          centre: boxCentre,
          room: Math.max(0, Math.round(Math.min(
            target.point.x - visible.x,
            visible.x + visible.width - target.point.x,
            target.point.y - visible.y,
            visible.y + visible.height - target.point.y,
          ))),
        };
      }
    }
    target.minSide = sample.inFrame
      ? Math.min(visible.width, visible.height)
      : Math.min(target.box.width, target.box.height);
    if (!sample.inFrame) continue;
    let margin = Number.POSITIVE_INFINITY;
    for (let j = 0; j < targets.length; j++) {
      if (i === j) continue;
      const other = targets[j]!;
      if (!other.inFrame) continue;
      // A box that encloses the other is not a neighbour a miss lands on — it
      // is the container. Both directions, because nesting is reported from
      // both ends: a card with a click handler is a target whose own centre
      // sits on the CTA inside it, and the first version tested only whether
      // the OTHER box was the outer one, so every wrapper reported itself
      // crowded by its own child.
      if (encloses(other.box, target.box) || encloses(target.box, other.box)) continue;
      const d = boxDistance(target.point, other.box);
      if (d < margin) {
        margin = d;
        target.nearest = other.id;
      }
    }
    if (Number.isFinite(margin)) target.aimMargin = Math.round(margin * 10) / 10;
  }

  const issues: GroundingIssue[] = [];
  const raise = (target: GroundingTarget, issue: GroundingIssue) => {
    target.risks.push(issue.kind);
    issues.push(issue);
  };
  /** Findings are about what an agent can act on now: not disabled, not below the fold. */
  const actionable = targets.filter((t, i) => !t.disabled && input.targets[i]!.inFrame);
  const sampleOf = new Map(targets.map((t, i) => [t.id, input.targets[i]!]));

  for (const target of actionable) {
    const sample = sampleOf.get(target.id)!;
    if (!sample.centreHit && !sample.forwardedByLabel) {
      const centre = target.aimedOffCentre?.centre ?? target.point;
      raise(target, {
        kind: "occluded-target",
        severity: "suspect",
        selector: target.selector,
        message: `${target.selector} (${target.role}${target.label ? ` "${target.label}"` : ""})`
          + ` is covered at its own centre (${centre.x},${centre.y}): a click there goes to`
          + ` ${sample.interceptedBy ?? "nothing"}`
          // Say where it CAN be clicked, when it can. The alternative — telling an
          // agent a target is hopeless and letting it aim at the covered centre
          // anyway — is what v1's haiku run did, and it activated the interceptor.
          + (target.aimedOffCentre
            ? `. This map aims at (${target.point.x},${target.point.y}) instead, which does reach it,`
              + ` with ${target.aimedOffCentre.room}px of room before the nearest thing that is not`
              + ` this element — still a defect, because anything aiming at the centre misses.`
            : ` — and no point inside the box routes here, so nothing can click it`
              + ` until ${sample.interceptedBy ?? "the interceptor"} moves or drops pointer-events.`),
      });
    }
    if (!sample.visibleText.trim() && !sample.hasGlyph) {
      raise(target, {
        kind: "unlabeled-target",
        severity: "warn",
        selector: target.selector,
        message: `${target.selector} (${target.role}) paints no text and no icon`
          + (sample.name ? `; its accessible name is "${shorten(sample.name)}", which is not on screen` : "")
          + ` — there is nothing in the screenshot for an agent to aim at.`,
      });
    }
    if (target.minSide < precisionFloor) {
      // The number quoted has to be the one that tripped the rule. It used to be
      // the full box, and on a form row at the bottom of the frame that read
      // "#publish (button \"Send\") is 34x18 screenshot px — under the 10px
      // floor": a self-contradicting line, because the 18 is the element's
      // height and the 6 the frame leaves of it is what the rule measured.
      const cut = target.visibleBox.width !== target.box.width
        || target.visibleBox.height !== target.box.height;
      raise(target, {
        kind: "imprecise-target",
        severity: "warn",
        selector: target.selector,
        message: `${target.selector} (${target.role}${target.label ? ` "${target.label}"` : ""})`
          + ` shows ${target.visibleBox.width}x${target.visibleBox.height} screenshot px in the ${frame.width}x${frame.height} frame`
          + (cut
            ? ` — the frame cuts it (the element is ${target.box.width}x${target.box.height}); this gate measures the initial frame and never scrolls, so scroll it into view and re-run before aiming`
            : ` — the whole element`)
          + `, under the ${precisionFloor}px floor either way: a few pixels for the model to aim at.`,
      });
    }
    if (target.aimMargin !== undefined && target.aimMargin < aimFloor && target.nearest) {
      const neighbour = targets.find((t) => t.id === target.nearest)!;
      raise(target, {
        kind: "crowded-target",
        severity: "warn",
        selector: target.selector,
        message: `${target.selector}'s click point is ${Math.round(target.aimMargin)}px from`
          + ` ${neighbour.selector} (${neighbour.role}${neighbour.label ? ` "${neighbour.label}"` : ""})`
          + ` — a coordinate off by ${aimFloor}px activates the neighbour instead.`,
      });
    }
    const visible = normalizeLabel(sample.visibleText);
    const accessible = normalizeLabel(sample.name);
    if (visible && accessible && !accessible.includes(visible) && !visible.includes(accessible)) {
      raise(target, {
        kind: "label-mismatch",
        severity: "warn",
        selector: target.selector,
        message: `${target.selector} reads "${shorten(sample.visibleText)}" on screen but its accessible name is`
          + ` "${shorten(sample.name)}" — an agent told to click one of the two cannot find the other.`,
      });
    }
  }

  // Ambiguity is a property of the frame, not of one target: raised once per
  // clashing group, attributed to the first member so a `--allow` can scope it.
  const groups = new Map<string, GroundingTarget[]>();
  for (const target of actionable) {
    if (!target.label) continue;
    const key = `${target.role}\u0000${normalizeLabel(target.label)}`;
    const list = groups.get(key) ?? [];
    list.push(target);
    groups.set(key, list);
  }
  for (const group of groups.values()) {
    if (group.length < 2) continue;
    const disambiguator = findDisambiguator(group.map((t) => sampleOf.get(t.id)!));
    const first = group[0]!;
    first.risks.push("ambiguous-target");
    for (const other of group.slice(1)) other.risks.push("ambiguous-target");
    issues.push({
      kind: "ambiguous-target",
      severity: "warn",
      selector: first.selector,
      message: `${group.length} ${first.role}s in the frame all read "${first.label}"`
        + ` (${group.map((t) => `${t.id} at ${t.point.x},${t.point.y}`).join(", ")})`
        + (disambiguator
          ? ` — distinguishable only by their surrounding text (${disambiguator.join(" / ")}),`
            + ` so an accessible name carrying it would let an agent name one.`
          : ` — nothing visible distinguishes them, so "click ${first.label}" has no answer.`),
    });
  }

  return {
    source: input.source,
    frame,
    targets,
    capped: input.page.capped,
    issues,
  };
}

/**
 * The nearest ancestor level whose own text differs across every member of a
 * clashing group, as short strings in group order. `undefined` when no level
 * within reach separates them — which is the worse finding of the two.
 */
export function findDisambiguator(samples: GroundingTargetSample[]): string[] | undefined {
  const depth = Math.min(...samples.map((s) => s.ancestorTexts.length));
  for (let level = 0; level < depth; level++) {
    const texts = samples.map((s) => shorten(s.ancestorTexts[level] ?? "", 32));
    if (texts.some((t) => !t)) continue;
    if (new Set(texts.map(normalizeLabel)).size === samples.length) return texts;
  }
  return undefined;
}

/** In-page collector. */
export const COLLECT_GROUNDING_SCRIPT = `(() => {
  ${STABLE_SELECTOR_JS}

  // Leaf roles only. A \`listbox\` or \`tablist\` is a container an agent aims
  // INTO, and reporting the container as its own target would double every
  // option and make each one "crowded" by its own parent.
  const EXPLICIT = new Set([
    "button", "link", "checkbox", "radio", "switch", "tab", "menuitem",
    "menuitemcheckbox", "menuitemradio", "option", "combobox", "textbox",
    "searchbox", "slider", "spinbutton", "treeitem",
  ]);
  const IMPLICIT = new Map([
    ["button", "button"], ["select", "combobox"], ["textarea", "textbox"],
    ["summary", "button"], ["option", "option"],
  ]);
  const INPUT_ROLES = new Map([
    ["button", "button"], ["submit", "button"], ["reset", "button"], ["image", "button"],
    ["checkbox", "checkbox"], ["radio", "radio"], ["range", "slider"], ["number", "spinbutton"],
    ["search", "searchbox"], ["file", "button"], ["color", "button"],
  ]);

  const roleOf = (el) => {
    const explicit = (el.getAttribute("role") || "").trim();
    if (explicit) return EXPLICIT.has(explicit) ? explicit : "";
    const tag = el.tagName.toLowerCase();
    if (tag === "a" || tag === "area") return el.hasAttribute("href") ? "link" : "";
    if (tag === "input") {
      const type = (el.getAttribute("type") || "text").toLowerCase();
      if (type === "hidden") return "";
      return INPUT_ROLES.get(type) || "textbox";
    }
    if (el.isContentEditable) return "textbox";
    const implicit = IMPLICIT.get(tag);
    if (implicit) return implicit;
    // Not a control by markup, but an agent looking at the pixels cannot tell —
    // and a div with a click handler is exactly what it will try to click.
    if (el.hasAttribute("onclick")) return "generic";
    const tabindex = el.getAttribute("tabindex");
    if (tabindex !== null && Number(tabindex) >= 0) return "generic";
    return "";
  };

  const accessibleName = (el) => {
    const labelled = (el.getAttribute("aria-labelledby") || "")
      .split(/\\s+/).filter(Boolean)
      .map((id) => (document.getElementById(id) || {}).textContent || "")
      .join(" ").trim();
    return (el.getAttribute("aria-label")
      || labelled
      || (el.tagName === "INPUT" || el.tagName === "TEXTAREA"
        ? (el.value || el.getAttribute("placeholder") || "")
        : "")
      || (el.innerText || el.textContent || "")
      || el.getAttribute("title")
      || (el.querySelector("img") || {}).alt
      || "").replace(/\\s+/g, " ").trim().slice(0, 120);
  };

  const paintsGlyph = (el) => {
    if (el.querySelector("img, svg, canvas, video, picture, object")) return true;
    const tag = el.tagName.toLowerCase();
    // Form controls paint their own chrome (a checkbox box, a select arrow),
    // which is a mark on screen whether or not the element has any text.
    if (tag === "input" || tag === "select" || tag === "textarea" || tag === "img" || tag === "svg") return true;
    const cs = getComputedStyle(el);
    if (cs.backgroundImage && cs.backgroundImage !== "none") return true;
    if (cs.maskImage && cs.maskImage !== "none") return true;
    // A painted border or a non-transparent background is a visible box the
    // agent can see and aim at even with no text in it.
    if (cs.backgroundColor && !/^(transparent|rgba\\(0, 0, 0, 0\\))$/.test(cs.backgroundColor)) return true;
    for (const pseudo of ["::before", "::after"]) {
      const content = getComputedStyle(el, pseudo).content;
      if (content && content !== "none" && content !== "normal" && content !== '""') return true;
    }
    return false;
  };

  const ancestorTexts = (el) => {
    const out = [];
    let cur = el.parentElement;
    while (cur && cur !== document.body && out.length < 3) {
      const text = (cur.innerText || "").replace(/\\s+/g, " ").trim();
      if (text) out.push(text.slice(0, 120));
      cur = cur.parentElement;
    }
    return out;
  };

  const CLIPS = /^(auto|scroll|hidden|clip)$/;
  const SCROLLS = /^(auto|scroll)$/;
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const targets = [];
  let capped = 0;
  const seen = new Set();
  for (const el of document.querySelectorAll("body *")) {
    if (seen.has(el)) continue;
    const role = roleOf(el);
    if (!role) continue;
    const cs = getComputedStyle(el);
    if (cs.display === "none" || cs.visibility === "hidden" || Number(cs.opacity) === 0) continue;
    if (el.getAttribute("aria-hidden") === "true") continue;
    const rect = el.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) continue;
    if (targets.length >= ${MAX_TARGETS}) { capped++; continue; }
    seen.add(el);

    // What is PAINTED, not what is inside the viewport. A list item scrolled out
    // of a 218px scrollport has a box well inside a 720px viewport and is not on
    // screen at all; asking only the viewport made the gate call seven such rows
    // an occluded-target "by html" — html being merely what is drawn where the row
    // is not — and advise moving html. The fix is to scroll the list, and that is
    // a fact about the ancestor, so the ancestors have to be walked.
    // (No backticks in this block: it lives inside a template literal.)
    let clip = { left: 0, top: 0, right: vw, bottom: vh };
    let clippedBy = null;
    for (let p = el.parentElement; p && p !== document.documentElement; p = p.parentElement) {
      const ps = getComputedStyle(p);
      if (!CLIPS.test(ps.overflowX) && !CLIPS.test(ps.overflowY)) continue;
      const pr = p.getBoundingClientRect();
      const before = clip;
      clip = {
        left: Math.max(clip.left, pr.left), top: Math.max(clip.top, pr.top),
        right: Math.min(clip.right, pr.right), bottom: Math.min(clip.bottom, pr.bottom),
      };
      // Blame the FIRST ancestor that actually hides it, and say how far it would
      // have to scroll — a caller with a wheel needs the delta, not the fact.
      if (!clippedBy && (rect.bottom <= pr.top || rect.top >= pr.bottom
        || rect.right <= pr.left || rect.left >= pr.right)) {
        const scrollable = SCROLLS.test(ps.overflowY) || SCROLLS.test(ps.overflowX);
        clippedBy = {
          selector: stableSelector(p),
          scrollable,
          dy: Math.round(rect.top < pr.top ? rect.top - pr.top : rect.bottom > pr.bottom ? rect.bottom - pr.bottom : 0),
          dx: Math.round(rect.left < pr.left ? rect.left - pr.left : rect.right > pr.right ? rect.right - pr.right : 0),
        };
      }
      void before;
    }

    const left = Math.max(rect.left, clip.left);
    const top = Math.max(rect.top, clip.top);
    const right = Math.min(rect.right, clip.right);
    const bottom = Math.min(rect.bottom, clip.bottom);
    const inFrame = right > left && bottom > top;
    const cx = inFrame ? (left + right) / 2 : rect.left + rect.width / 2;
    const cy = inFrame ? (top + bottom) / 2 : rect.top + rect.height / 2;

    let hits = 0;
    let probes = 0;
    let centreHit = false;
    let interceptor = null;
    let forwardedByLabel = false;
    if (inFrame) {
      const xs = [left + (right - left) * 0.25, cx, left + (right - left) * 0.75];
      const ys = [top + (bottom - top) * 0.25, cy, top + (bottom - top) * 0.75];
      for (const py of ys) {
        for (const px of xs) {
          probes++;
          const hit = document.elementFromPoint(px, py);
          const onTarget = hit === el || (hit && el.contains(hit));
          if (onTarget) hits++;
          if (px === cx && py === cy) {
            centreHit = !!onTarget;
            if (!onTarget && hit) {
              interceptor = stableSelector(hit);
              // A <label> for this control forwards the click; the hit test is
              // right that the label takes it and wrong that the turn fails.
              let node = hit;
              while (node && node !== document.body) {
                if (node.tagName === "LABEL" && (node.control === el || node.contains(el))) {
                  forwardedByLabel = true;
                  break;
                }
                node = node.parentElement;
              }
            }
          }
        }
      }
    }

    // The centre is intercepted — so find a point that is NOT, before saying
    // the target is unreachable. A 3x3 grid answers "is the centre clear", and
    // reporting that as "no point inside the box routes here at all" is a
    // different and much stronger claim, which on a button 86% covered by a
    // promo ribbon was simply false: a 17px strip on its right edge routed to
    // it the whole time. The sweep is a real search on a fine grid, and the
    // point it returns is the middle of the largest clear pocket rather than
    // the first hit — a coordinate one pixel inside the boundary is not one to
    // hand an agent that rounds.
    let reach = null;
    if (inFrame && !centreHit && !forwardedByLabel) {
      const w = right - left;
      const h = bottom - top;
      // Cap the work: an occluded target is rare, but the page decides how many.
      const step = Math.max(1, Math.ceil(Math.sqrt((w * h) / 400)));
      const clear = [];
      const blocked = [];
      for (let py = top + step / 2; py < bottom; py += step) {
        for (let px = left + step / 2; px < right; px += step) {
          const hit = document.elementFromPoint(px, py);
          (hit === el || (hit && el.contains(hit)) ? clear : blocked).push([px, py]);
        }
      }
      if (clear.length > 0) {
        let best = null;
        let bestRoom = -1;
        for (const [px, py] of clear) {
          // Room = how far this point is from anything that is not the target,
          // counting the box edges, so the winner sits in open space.
          let room = Math.min(px - left, right - px, py - top, bottom - py);
          for (const [bx, by] of blocked) {
            room = Math.min(room, Math.max(Math.abs(px - bx), Math.abs(py - by)));
          }
          if (room > bestRoom) { bestRoom = room; best = [px, py]; }
        }
        reach = { x: best[0], y: best[1], room: Math.max(0, Math.round(bestRoom)), sampled: clear.length + blocked.length, clear: clear.length };
      }
    }

    targets.push({
      selector: stableSelector(el),
      tag: el.tagName.toLowerCase(),
      role,
      name: accessibleName(el),
      visibleText: (el.innerText || "").replace(/\\s+/g, " ").trim().slice(0, 120),
      hasGlyph: paintsGlyph(el),
      bbox: { x: rect.x, y: rect.y, width: rect.width, height: rect.height },
      clickPoint: { x: cx, y: cy },
      hitFraction: probes > 0 ? hits / probes : 0,
      centreHit,
      ...(interceptor ? { interceptedBy: interceptor } : {}),
      ...(forwardedByLabel ? { forwardedByLabel: true } : {}),
      ...(reach ? { reachable: reach } : {}),
      disabled: !!el.disabled || el.getAttribute("aria-disabled") === "true",
      inFrame,
      clipped: rect.left < left || rect.top < top || rect.right > right || rect.bottom > bottom,
      ...(clippedBy ? { clippedBy } : {}),
      ancestorTexts: ancestorTexts(el),
    });
  }

  return { page: { viewportWidth: vw, viewportHeight: vh, capped }, targets };
})()`;

export async function runGroundingScan(options: GroundingScanOptions): Promise<GroundingScanReport> {
  const viewport = options.viewport ?? { width: 1280, height: 720 };
  return await withBrowser(async (browser) => {
    const page = await browser.newPage(withAuthState({ viewport }, options.storageState));
    if (options.html !== undefined) {
      await page.setContent(options.html, navigationOptions(options));
    } else {
      const url = sourceToUrl(options.source);
      await navigatePage(page, url, options);
    }
    const redirectNote = isUrlSource(options.source) ? describeRedirect(options.source, page.url()) : null;
    const collected = await page.evaluate(COLLECT_GROUNDING_SCRIPT) as Omit<GroundingScanInput, "source">;
    const report = analyzeGroundingSamples({ source: options.source, ...collected }, options);
    if (options.at && options.at.length > 0) {
      report.probes = await probePoints(page, options.at, report);
    }
    if (options.markPath) {
      // The screenshot is taken AFTER the hit testing, from the same page state,
      // so the coordinates drawn on it are the coordinates that were measured.
      const shot = await page.screenshot({ type: "png" });
      await writeMarkedScreenshot(options.markPath, shot, report);
    }
    await page.close();
    if (redirectNote) {
      report.issues.unshift({ kind: "redirected", severity: "suspect", message: redirectNote });
    }
    return report;
  });
}

/**
 * Answer `--at`: dispatch each point at the live page and say what takes it.
 *
 * The points arrive in SCREENSHOT px, because that is the space the caller has
 * a coordinate in — the map's, the marked PNG's, and its own answer's. One
 * divide by the frame's scale is the whole conversion, and doing it here rather
 * than asking the caller to is the point: a caller that could do the arithmetic
 * reliably would not need the check.
 */
async function probePoints(
  page: import("playwright").Page,
  points: readonly { x: number; y: number }[],
  report: GroundingScanReport,
): Promise<GroundingProbe[]> {
  const { scale, width, height } = report.frame;
  const out: GroundingProbe[] = [];
  for (const point of points) {
    const cssPoint = { x: Math.round(point.x / scale), y: Math.round(point.y / scale) };
    if (point.x < 0 || point.y < 0 || point.x >= width || point.y >= height) {
      out.push({ point, cssPoint, hit: null, offFrame: true });
      continue;
    }
    const probed = await page.evaluate(
      ([x, y, selectorJs]) => {
        // eslint-disable-next-line no-eval
        const stableSelector = (0, eval)(`(function(){${selectorJs};return stableSelector})()`) as (el: Element) => string;
        const el = document.elementFromPoint(x, y);
        if (!el) return { hit: null, wouldReach: null };
        let node: Element | null = el;
        let wouldReach: string | null = null;
        while (node && node.tagName !== "BODY") {
          const tabindex = node.getAttribute("tabindex");
          if (node.getAttribute("role")
            || node.hasAttribute("onclick")
            || (tabindex !== null && Number(tabindex) >= 0)
            || /^(a|area|button|input|select|textarea|summary)$/i.test(node.tagName)) {
            wouldReach = stableSelector(node);
            break;
          }
          node = node.parentElement;
        }
        return { hit: stableSelector(el), wouldReach };
      },
      [cssPoint.x, cssPoint.y, STABLE_SELECTOR_JS] as const,
    ) as { hit: string | null; wouldReach: string | null };
    const find = (selector: string | null) =>
      selector ? report.targets.find((t) => t.selector === selector) : undefined;
    // A hit on a button's own icon is a hit on the button: `elementFromPoint`
    // returns the innermost element, which is often a child the map does not
    // list. Resolving the enclosing control back to its row is what stops that
    // reading as "not in this map" when the click does exactly what was wanted.
    const row = find(probed.hit) ?? find(probed.wouldReach);
    out.push({
      point,
      cssPoint,
      hit: probed.hit,
      ...(row ? { targetId: row.id } : {}),
      ...(!row && probed.wouldReach ? { wouldReach: probed.wouldReach } : {}),
    });
  }
  return out;
}

/**
 * Set-of-mark overlay: the action map drawn onto the screenshot the agent reads.
 *
 * Numbered boxes rather than raw pixels because that is the one prompt-side
 * change measured to move grounding accuracy on this class of task — the model
 * answers "which mark" instead of "which coordinate", and the coordinate comes
 * back out of the map. Marks are drawn at the SCALED resolution, so a mark's
 * position in the file is the click point in the JSON, byte for byte.
 *
 * The glyphs are this repo's own 5x7 bitmap font (`bitmap-font.ts`), so the
 * output has no fontconfig dependency and is identical on every platform.
 */
export async function writeMarkedScreenshot(
  path: string,
  screenshot: Buffer,
  report: GroundingScanReport,
): Promise<void> {
  const { PNG } = await import("pngjs");
  const src = PNG.sync.read(screenshot);
  const { width, height } = report.frame;
  const dst = new PNG({ width, height });
  // Nearest-neighbour, matching `resizePngBuffer` exactly: a mark drawn over a
  // differently-resampled image would sit a pixel off from where the coordinate
  // in the JSON points.
  const xRatio = src.width / width;
  const yRatio = src.height / height;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const si = (Math.min(Math.floor(y * yRatio), src.height - 1) * src.width
        + Math.min(Math.floor(x * xRatio), src.width - 1)) * 4;
      const di = (y * width + x) * 4;
      dst.data[di] = src.data[si]!;
      dst.data[di + 1] = src.data[si + 1]!;
      dst.data[di + 2] = src.data[si + 2]!;
      dst.data[di + 3] = 255;
    }
  }
  drawActionMarks({ width, height, data: dst.data }, report.targets);
  await mkdir(dirname(resolve(path)), { recursive: true });
  await writeFile(resolve(path), PNG.sync.write(dst));
}

const MARK_CLEAN: readonly [number, number, number] = [0, 132, 255];
const MARK_RISK: readonly [number, number, number] = [220, 38, 38];
const MARK_INK: readonly [number, number, number] = [255, 255, 255];

/** Pure pixel writer, so the overlay is testable without a browser or a PNG file. */
export function drawActionMarks(
  target: { width: number; height: number; data: Uint8Array },
  targets: readonly GroundingTarget[],
): void {
  for (const t of targets) {
    if (!t.inFrame || t.disabled) continue;
    const colour = t.risks.length > 0 ? MARK_RISK : MARK_CLEAN;
    strokeRect(target, t.box, colour);
    const label = t.id.replace(/^t/, "");
    const chipW = measureText(label) + 4;
    const chipH = textHeight() + 4;
    // Inside the top-left corner when the box has room, immediately above it when
    // it does not. A 4x4 target is smaller than its own mark, and a chip drawn
    // inside it hides the very element the reader is being pointed at — which is
    // the case this gate reports most often, since a target that small is already
    // an `imprecise-target`.
    const fits = t.box.width >= chipW && t.box.height >= chipH;
    // Pushed back in when the box starts off the edge: a chip drawn at a negative
    // origin is silently clipped to nothing, losing the mark entirely.
    const chipX = Math.max(0, Math.min(t.box.x, target.width - chipW));
    const chipY = fits
      ? Math.max(0, Math.min(t.box.y, target.height - chipH))
      : Math.max(0, Math.min(t.box.y - chipH, target.height - chipH));
    fillRect(target, { x: chipX, y: chipY, width: chipW, height: chipH }, colour);
    drawText(target, fitText(label, chipW - 4), chipX + 2, chipY + 2, MARK_INK);
  }
}

function fillRect(
  target: { width: number; height: number; data: Uint8Array },
  box: Box,
  rgb: readonly [number, number, number],
): void {
  for (let y = Math.max(0, box.y); y < Math.min(target.height, box.y + box.height); y++) {
    for (let x = Math.max(0, box.x); x < Math.min(target.width, box.x + box.width); x++) {
      const i = (y * target.width + x) * 4;
      target.data[i] = rgb[0];
      target.data[i + 1] = rgb[1];
      target.data[i + 2] = rgb[2];
      target.data[i + 3] = 255;
    }
  }
}

function strokeRect(
  target: { width: number; height: number; data: Uint8Array },
  box: Box,
  rgb: readonly [number, number, number],
): void {
  fillRect(target, { x: box.x, y: box.y, width: box.width, height: 1 }, rgb);
  fillRect(target, { x: box.x, y: box.y + box.height - 1, width: box.width, height: 1 }, rgb);
  fillRect(target, { x: box.x, y: box.y, width: 1, height: box.height }, rgb);
  fillRect(target, { x: box.x + box.width - 1, y: box.y, width: 1, height: box.height }, rgb);
}

export function formatGroundingReport(report: GroundingScanReport, rules?: RuleView): string {
  const lines: string[] = [];
  const { shown, status, note } = tierIssues(report.issues, rules);
  const inFrame = report.targets.filter((t) => t.inFrame && !t.disabled);
  lines.push(`${BOLD}${CYAN}vlmkit check grounding${RESET}`);
  lines.push(`${DIM}source: ${report.source} (${report.frame.viewportWidth}x${report.frame.viewportHeight})${RESET}`);
  lines.push("");
  lines.push(`status: ${status}`);
  lines.push(
    `frame: ${report.frame.width}x${report.frame.height} screenshot px`
    + ` — ${report.frame.resolution}, scale ${report.frame.scale.toFixed(2)}`
    + ` (every coordinate below is in these ${report.frame.width}x${report.frame.height} pixels)`,
  );
  lines.push(
    `targets: ${inFrame.length} actionable in frame`
    + ` (${report.targets.length - inFrame.length} disabled or out of the frame`
    + (report.capped > 0 ? `, ${report.capped} dropped by the cap` : "")
    + `)`,
  );
  // Out of the frame but in the page, with what to do about it. Listed as its own
  // block rather than dropped: a caller that cannot see these cannot plan the
  // scroll that reveals them, and the round that added it had every agent infer
  // the list's existence from a row clipped at a panel border.
  const offscreen = report.targets.filter((t) => !t.inFrame && !t.disabled && t.clippedBy);
  if (offscreen.length > 0) {
    lines.push("");
    lines.push(`Out of the frame (${offscreen.length}) — scroll first, then re-run:`);
    const byContainer = new Map<string, typeof offscreen>();
    for (const t of offscreen) {
      const key = t.clippedBy!.selector;
      byContainer.set(key, [...(byContainer.get(key) ?? []), t]);
    }
    for (const [selector, rows] of byContainer) {
      const how = rows[0]!.clippedBy!.scrollable
        ? `scroll it (nearest needs ${rows.map((r) => r.clippedBy!.dy).reduce((a, b) => Math.abs(a) < Math.abs(b) ? a : b)}px)`
        : `it does not scroll — this content cannot be reached by scrolling`;
      lines.push(`  ${selector}: hides ${rows.length} target(s) — ${how}`);
      for (const t of rows.slice(0, 6)) {
        lines.push(`    ${DIM}${t.id} ${t.role} "${t.label}" (dy ${t.clippedBy!.dy}px)${RESET}`);
      }
      if (rows.length > 6) lines.push(`    ${DIM}… ${rows.length - 6} more${RESET}`);
    }
  }
  if (inFrame.length > 0) {
    lines.push("");
    lines.push("Action map (click point in screenshot px):");
    for (const t of inFrame.slice(0, 20)) {
      // The row's risk tags go through the same rule view the issue list does.
      // A tag for a rule the project turned off is the failure the contract's
      // `RuleView` note is about — "the noise I re-tuned away is still in every
      // CI log" — and the map is the half a reader scans first.
      const shownRisks = [...new Set(t.risks)].filter((risk) => rules?.effective(risk) !== "off");
      const risk = shownRisks.length > 0 ? ` ${RED}[${shownRisks.join(",")}]${RESET}` : "";
      const label = t.label ? ` "${t.label}"` : ` ${DIM}(no visible label)${RESET}`;
      lines.push(`  ${t.id} ${t.role}${label} @ (${t.point.x},${t.point.y}) ${t.box.width}x${t.box.height} ${DIM}${t.selector}${RESET}${risk}`);
    }
    if (inFrame.length > 20) {
      lines.push(`  ${DIM}… ${inFrame.length - 20} more — --json emits the full map${RESET}`);
    }
  }
  if (report.probes && report.probes.length > 0) {
    lines.push("");
    lines.push("Probes (--at, screenshot px):");
    for (const probe of report.probes) {
      const where = probe.offFrame
        ? `${RED}outside the ${report.frame.width}x${report.frame.height} frame${RESET}`
        : probe.hit
          ? `${probe.hit}${
            probe.targetId
              ? ` ${DIM}(${probe.targetId})${RESET}`
              : probe.wouldReach
                ? ` ${YELLOW}(not in this map, and the click would set off ${probe.wouldReach})${RESET}`
                : ` ${DIM}(not in this map; nothing up to <body> declares itself interactive)${RESET}`
          }`
          : `${YELLOW}nothing${RESET}`;
      lines.push(`  (${probe.point.x},${probe.point.y}) ${DIM}= css (${probe.cssPoint.x},${probe.cssPoint.y})${RESET} -> ${where}`);
    }
  }
  if (shown.length > 0) {
    lines.push("");
    lines.push("Issues:");
    for (const entry of shown) {
      const issue = entry.row;
      const icon = entry.tier === "suspect" ? `${RED}x${RESET}` : `${YELLOW}!${RESET}`;
      lines.push(`  ${icon} ${issue.kind}: ${issue.message}${retuneNote(entry)}`);
    }
  } else if (note === undefined) {
    lines.push("");
    lines.push(`${GREEN}Every target in the frame is resolvable and routes its own clicks.${RESET}`);
  }
  if (note) {
    lines.push("");
    lines.push(`${DIM}${note}${RESET}`);
  }
  return lines.join("\n");
}

/**
 * CLI entry lives in `../gates/grounding.gate.ts`, driven by the core runner —
 * this module is measurement code, like every other `inspect/` sibling.
 */
