/**
 * What the last `--after` action changed — the half of a computer-use turn the
 * action map cannot answer by itself.
 *
 * v3 asked whether an agent can tell from the next picture that its click
 * worked. v4 answered it, twice, and not well:
 *
 *   - the larger model WITH the tool re-ran the map after archiving and found
 *     "`t8` still lists as a plain actionable button, `"disabled": false` … no
 *     archived flag anywhere in the report. The tool's action map does not track
 *     this state change; I had to trust the screenshot instead";
 *   - the smaller model WITHOUT it archived the right ticket on its seventh
 *     action, read the "Archived." confirmation as a menu item called Archive,
 *     clicked it five times, and reported that it had failed.
 *
 * A map is a picture of one screen, so "did it work" was never in it. The
 * replay already holds both screens, though: the one before the last action and
 * the one after. This module compares them and says what moved — controls that
 * came or went, a control whose ARIA state or look changed, text that appeared
 * or disappeared — in the same ids the map uses. It does not say whether the
 * change was the one the caller wanted; that is the caller's to judge, from a
 * list of facts rather than from pixels.
 *
 * What it deliberately does not claim: that "nothing changed" means the click
 * missed. A handler can do work the page does not show (v3's `Mark all read`).
 * The empty case says exactly what was compared.
 */

import type { GroundingAction } from "./grounding-scan.ts";

/** One control's state, keyed by the same stable selector the map uses. */
export interface ControlState {
  /** ARIA states that are on: `current`, `pressed`, `checked`, `selected`, `expanded`, `disabled`. */
  states: string[];
  /**
   * Computed style of the control and its text-bearing descendants, per
   * property, so a change can be named ("text-decoration-line, color") rather
   * than reported as a hash that differs.
   */
  look: Record<string, string>;
  /**
   * The `look` properties some `:hover` rule in the page's own stylesheets sets
   * on this control or on one of its text carriers — what a pointer arriving or
   * leaving can change by itself.
   */
  hover?: string[];
}

/** Everything compared about one screen. */
export interface ScreenState {
  /** The map's own rows: selector, label as the map prints it, and whether it is painted. */
  targets: { selector: string; label: string; onScreen: boolean; box?: { x: number; y: number; width: number; height: number } }[];
  controls: Record<string, ControlState>;
  /** Painted text runs, collapsed, as a multiset. */
  texts: string[];
}

export interface ChangedControl {
  selector: string;
  /** The row in the AFTER map, when the control is in it. */
  targetId?: string;
  label: string;
}

export interface ScreenChange {
  /** The action whose effect this is — the last `--after`. */
  by: GroundingAction;
  /**
   * For a click: what it landed on, hit-tested on the screen it was sent to.
   * A map row when it reached one (`label` set); otherwise the element hit,
   * with `label` empty, and `wouldReach` when an interactive ancestor would
   * still take it.
   *
   * v4's control arm read "Archived." — the confirmation of a click that had
   * worked — as a menu item, and clicked the words five times. A caller told
   * "the click went to p.flash, which is not a control" has the answer.
   */
  landedOn?: ChangedControl & { wouldReach?: string };
  appeared: ChangedControl[];
  disappeared: ChangedControl[];
  relabelled: (ChangedControl & { from: string })[];
  restated: (ChangedControl & { added: string[]; removed: string[] })[];
  /**
   * `hoverOnly` says the pointer arrived on the control (`entered`) or left it
   * (`left`) AND every property that changed is one a `:hover` rule in the
   * page sets on it — so the change may be nothing but the pointer. The first
   * run of this listed the row the pointer had just left as "changed
   * background-color" beside the row that was actually chosen; the first fix
   * went by pointer position alone and filed an archived row's strike-through
   * as "possibly just hover". Both halves are needed.
   */
  restyled: (ChangedControl & { properties: string[]; hoverOnly?: "left" | "entered" })[];
  textAdded: string[];
  textRemoved: string[];
}

/** The ARIA states worth reading back: each one is a state a click commonly sets. */
const STATES = ["current", "pressed", "checked", "selected", "expanded", "disabled"] as const;
/** The properties that carry "this item is done / chosen / dimmed" on screen. */
const LOOK = ["color", "background-color", "text-decoration-line", "opacity", "font-weight"] as const;

/**
 * In-page: `(selectors) => ScreenState minus targets`. A function source rather
 * than a template-literal IIFE, because it takes an argument — the map's own
 * selectors, so both screens are keyed the way the map is.
 *
 * Text is "painted" by the same rule the collector uses for targets: inside the
 * viewport and inside every clipping ancestor. A viewport-only test would say a
 * scrolled list's rows never changed.
 */
export const SCREEN_STATE_JS = `(selectors) => {
  const STATES = ${JSON.stringify(STATES)};
  const LOOK = ${JSON.stringify(LOOK)};
  const CLIPS = /^(auto|scroll|hidden|clip)$/;
  const vw = innerWidth, vh = innerHeight;
  const paintedCache = new Map();
  const painted = (el) => {
    if (paintedCache.has(el)) return paintedCache.get(el);
    let ok = false;
    const rect = el.getBoundingClientRect();
    const cs = getComputedStyle(el);
    if (rect.width > 0 && rect.height > 0 && cs.visibility !== "hidden" && cs.display !== "none") {
      let clip = { left: 0, top: 0, right: vw, bottom: vh };
      for (let p = el.parentElement; p && p !== document.documentElement; p = p.parentElement) {
        const ps = getComputedStyle(p);
        if (!CLIPS.test(ps.overflowX) && !CLIPS.test(ps.overflowY)) continue;
        const pr = p.getBoundingClientRect();
        clip = { left: Math.max(clip.left, pr.left), top: Math.max(clip.top, pr.top),
                 right: Math.min(clip.right, pr.right), bottom: Math.min(clip.bottom, pr.bottom) };
      }
      ok = Math.min(rect.right, clip.right) > Math.max(rect.left, clip.left)
        && Math.min(rect.bottom, clip.bottom) > Math.max(rect.top, clip.top);
    }
    paintedCache.set(el, ok);
    return ok;
  };

  // The page's own :hover rules, as the selector with :hover taken out and the
  // properties the rule sets. A cross-origin sheet throws on cssRules and is
  // skipped: the claim is only ever "a :hover rule sets this", never "none does".
  const hoverRules = [];
  const walk = (rules) => {
    for (const rule of rules) {
      if (rule.cssRules && !rule.selectorText) { walk(rule.cssRules); continue; }
      if (!rule.selectorText || !rule.selectorText.includes(":hover")) continue;
      const props = LOOK.filter((p) => rule.style.getPropertyValue(p)
        || (p === "background-color" && rule.style.getPropertyValue("background"))
        || (p === "text-decoration-line" && rule.style.getPropertyValue("text-decoration")));
      if (props.length === 0) continue;
      for (const part of rule.selectorText.split(",")) {
        if (!part.includes(":hover")) continue;
        const base = part.replace(/:hover/g, "").trim() || "*";
        hoverRules.push({ base, props });
      }
    }
  };
  for (const sheet of document.styleSheets) {
    try { walk(sheet.cssRules); } catch { /* cross-origin */ }
  }

  const controls = {};
  for (const selector of selectors) {
    const el = document.querySelector(selector);
    if (!el) continue;
    const states = [];
    for (const s of STATES) {
      const v = el.getAttribute("aria-" + s);
      if (v && v !== "false") states.push(s);
    }
    if (el.disabled && !states.includes("disabled")) states.push("disabled");
    if ((el.checked === true) && !states.includes("checked")) states.push("checked");
    // The control and up to six descendants that carry their own text.
    const carriers = [el];
    for (const d of el.querySelectorAll("*")) {
      if (carriers.length > 6) break;
      if ([...d.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim())) carriers.push(d);
    }
    const look = {};
    for (const prop of LOOK) {
      look[prop] = carriers.map((c) => getComputedStyle(c).getPropertyValue(prop)).join(" | ");
    }
    const hover = new Set();
    for (const { base, props } of hoverRules) {
      let hits = false;
      try { hits = carriers.some((c) => c.matches(base)); } catch { /* a selector matches() cannot parse */ }
      if (hits) for (const p of props) hover.add(p);
    }
    controls[selector] = { states, look, hover: [...hover] };
  }

  const texts = [];
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  for (let n = walker.nextNode(); n && texts.length < 400; n = walker.nextNode()) {
    const text = n.textContent.replace(/\\s+/g, " ").trim();
    if (!text || !n.parentElement || !painted(n.parentElement)) continue;
    texts.push(text.length > 80 ? text.slice(0, 79) + "\u2026" : text);
  }
  return { controls, texts };
}`;

/** Multiset difference: what `a` has more of than `b`, in `a`'s order. */
function minus(a: readonly string[], b: readonly string[]): string[] {
  const left = new Map<string, number>();
  for (const x of b) left.set(x, (left.get(x) ?? 0) + 1);
  const out: string[] = [];
  for (const x of a) {
    const n = left.get(x) ?? 0;
    if (n > 0) left.set(x, n - 1);
    else out.push(x);
  }
  return out;
}

/**
 * Pure: two screens -> what changed between them.
 *
 * `idOf` maps a selector to its row in the AFTER map, so every line can be
 * acted on with the ids the rest of the report uses. A control that left the
 * screen has no row, and is named by selector and label instead.
 */
export function diffScreens(
  before: ScreenState,
  after: ScreenState,
  by: GroundingAction,
  idOf: (selector: string) => string | undefined = () => undefined,
  /** Where the pointer was before the action and is after it, CSS px. */
  pointer: { before?: { x: number; y: number }; after?: { x: number; y: number } } = {},
): ScreenChange {
  const under = (box: ScreenState["targets"][number]["box"], at?: { x: number; y: number }) =>
    !!box && !!at && at.x >= box.x && at.x < box.x + box.width && at.y >= box.y && at.y < box.y + box.height;
  const was = new Map(before.targets.filter((t) => t.onScreen).map((t) => [t.selector, t]));
  const now = new Map(after.targets.filter((t) => t.onScreen).map((t) => [t.selector, t]));
  const row = (selector: string, label: string): ChangedControl => {
    const targetId = idOf(selector);
    return { selector, label, ...(targetId ? { targetId } : {}) };
  };

  const change: ScreenChange = {
    by,
    appeared: [],
    disappeared: [],
    relabelled: [],
    restated: [],
    restyled: [],
    textAdded: [],
    textRemoved: [],
  };
  for (const [selector, t] of now) {
    const old = was.get(selector);
    if (!old) {
      change.appeared.push(row(selector, t.label));
      continue;
    }
    if (old.label !== t.label) change.relabelled.push({ ...row(selector, t.label), from: old.label });
    const a = before.controls[selector];
    const b = after.controls[selector];
    if (!a || !b) continue;
    const added = b.states.filter((s) => !a.states.includes(s));
    const removed = a.states.filter((s) => !b.states.includes(s));
    if (added.length > 0 || removed.length > 0) change.restated.push({ ...row(selector, t.label), added, removed });
    const properties = Object.keys(b.look).filter((p) => a.look[p] !== b.look[p]);
    if (properties.length > 0) {
      const entered = under(t.box, pointer.after) && !under(old.box, pointer.before);
      const left = under(old.box, pointer.before) && !under(t.box, pointer.after);
      const hoverable = new Set([...(a.hover ?? []), ...(b.hover ?? [])]);
      const onlyHover = properties.every((p) => hoverable.has(p));
      change.restyled.push({
        ...row(selector, t.label),
        properties,
        ...(onlyHover && entered ? { hoverOnly: "entered" as const }
          : onlyHover && left ? { hoverOnly: "left" as const } : {}),
      });
    }
  }
  for (const [selector, t] of was) {
    if (!now.has(selector)) change.disappeared.push({ selector, label: t.label });
  }
  change.textAdded = minus(after.texts, before.texts);
  change.textRemoved = minus(before.texts, after.texts);
  return change;
}

export function isEmptyChange(change: ScreenChange): boolean {
  return change.appeared.length === 0 && change.disappeared.length === 0
    && change.relabelled.length === 0 && change.restated.length === 0 && change.restyled.length === 0
    && change.textAdded.length === 0 && change.textRemoved.length === 0;
}

/** The prose block. Lines are capped per kind; `--json` carries all of them. */
export function formatScreenChange(change: ScreenChange, describe: (a: GroundingAction) => string): string[] {
  const lines = [`What the last action (${describe(change.by)}) changed:`];
  const name = (c: ChangedControl) => `${c.targetId ?? c.selector} "${c.label}"`;
  const landed = change.landedOn;
  if (landed) {
    lines.push(landed.label
      ? `  the click went to ${name(landed)}`
      : `  the click went to ${landed.selector}, which is not in the map`
        + (landed.wouldReach ? ` (it would set off ${landed.wouldReach})` : " — nothing up to <body> declares itself interactive"));
  }
  if (isEmptyChange(change)) {
    // Stated as what was compared, not as "the click missed": a handler can do
    // work the page does not show.
    lines.push("  nothing on screen — no control came, went, changed state or look, and no text changed"
      + (landed?.label ? "; the control may still have done something the page does not show" : ""));
    return lines;
  }
  const cap = <T>(items: T[], render: (item: T) => string, max = 6): void => {
    for (const item of items.slice(0, max)) lines.push(`  ${render(item)}`);
    if (items.length > max) lines.push(`  … ${items.length - max} more — --json has them all`);
  };
  cap(change.appeared, (c) => `+ ${name(c)} is on screen`);
  cap(change.disappeared, (c) => `- ${c.selector} "${c.label}" is gone from the screen`);
  cap(change.relabelled, (c) => `~ ${c.targetId ?? c.selector} now reads "${c.label}" (was "${c.from}")`);
  cap(change.restated, (c) => `~ ${name(c)} ${[
    ...c.added.map((s) => `is now ${s}`),
    ...c.removed.map((s) => `is no longer ${s}`),
  ].join(", ")}`);
  cap(change.restyled, (c) => `~ ${name(c)} changed ${c.properties.join(", ")}`
    + (c.hoverOnly === "entered" ? " — its :hover style, and the pointer is now on it"
      : c.hoverOnly === "left" ? " — its :hover style, and the pointer just left it" : ""));
  cap(change.textAdded, (t) => `+ text "${t}"`, 4);
  cap(change.textRemoved, (t) => `- text "${t}"`, 4);
  return lines;
}
