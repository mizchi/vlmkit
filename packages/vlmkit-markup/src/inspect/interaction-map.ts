#!/usr/bin/env node
/**
 * A11y-event state map — the interaction axis of markup verification.
 *
 * The existing gates verify what a page looks like (composition), how
 * it flows (scroll/breakpoints), and how it moves (animation). This
 * tool verifies how it RESPONDS: the state changes reachable through
 * accessibility events — Tab focus, Enter/Space activation, arrow-key
 * roving, Escape dismissal — expressed as ARIA state transitions.
 *
 * Everything is deterministic Playwright + DOM reading (no VLM):
 *
 *   1. Discover interactive elements (explicit roles + implicit ones)
 *      and stamp them so probes can re-find them across reloads.
 *   2. Tab-walk once: which elements keyboard focus actually reaches,
 *      and whether focus paints a visible indicator (computed
 *      outline/box-shadow/border/background delta vs the blurred
 *      state — a `*:focus { outline: none }` reset shows up here).
 *   3. Activation probe per element, each from a fresh page load: the
 *      role's canonical key (Enter for buttons/disclosures, Space for
 *      checkbox/switch, arrows for tab/radio roving, ArrowDown for
 *      combobox) fires, and the delta is recorded as: ARIA attribute
 *      transitions, the aria-controls target appearing/disappearing,
 *      a coarse layout-signature change, and where focus moved.
 *   4. Escape probe when the activation expanded a popup-like control.
 *
 * Two consumption modes:
 *   - standalone: inventory + issues (dead disclosure whose
 *     aria-expanded never changes, broken aria-controls id, inert
 *     control with no observable response, missing focus indicator,
 *     keyboard-unreachable control)
 *   - `--reference`: inventories are matched by (role, accessible
 *     name) and every behavioral mismatch is reported — the markup
 *     gate for "the recreated page responds to the same a11y events
 *     with the same state changes".
 *
 * CLI:
 *   vlmkit check interactions <html> [--reference <html>] [--max-elements 30] [--json]
 */
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { withAuthState } from "@mizchi/vlmkit-core/auth-state.ts";
import { settlePage } from "@mizchi/vlmkit-core/page-open.ts";
import { BOLD, CYAN, DIM, GREEN, RED, RESET, YELLOW } from "@mizchi/vlmkit-core/terminal-colors.ts";
import { callMarkupCoreJson } from "../markup-core-runtime.ts";
import type { Page } from "playwright";
import { withBrowser } from "@mizchi/vlmkit-core/browser-launch.ts";

// ---------------------------------------------------------------------------
// Types

export interface AriaSnapshot {
  expanded: string | null;
  selected: string | null;
  checked: string | null;
  pressed: string | null;
  /** `open` attribute of the owning <details> / <dialog>, if any. */
  open: boolean | null;
  controls: { id: string; exists: boolean; visible: boolean } | null;
  /**
   * Text of the element aria-activedescendant points at (id-agnostic:
   * ids differ between implementations, the referenced TEXT is the
   * comparable fact). null when the attribute is absent.
   */
  activeDescText: string | null;
  /** Text of aria-selected="true" descendants (composite selection). */
  selectedWithin: string | null;
  /** Concatenated text of live regions (aria-live/status/alert/output). */
  liveText: string;
  /** Coarse page-state fingerprint: visible elements : scrollHeight : text length. */
  layoutSignature: string;
}

export interface ActivationResult {
  key: string;
  /** attr -> [before, after], only attrs that changed. */
  ariaDelta: Record<string, [string | null, string | null]>;
  controlsBecameVisible: boolean | null;
  layoutChanged: boolean;
  /** Discovery index focus landed on after the key, when it moved. */
  focusMovedTo: number | null;
  escapeCloses?: boolean;
  /** Set when aria-controls names an id that does not exist. */
  brokenControlsId?: string;
  // --- popup patterns (dialog / menu / listbox), probed when the
  // activation opened one:
  /** Focus landed inside the popup subtree after opening. */
  focusMovedIntoPopup?: boolean;
  /** aria-modal dialogs only: Tab never left the popup subtree. */
  focusTrapped?: boolean;
  /** After Escape closed the popup, focus returned to the opener. */
  focusReturnsToOpener?: boolean;
  /** Role of the popup node the probe identified (dialog/menu/listbox). */
  popupRole?: string;
  /** menu/listbox with focus inside: ArrowDown moves focus within it. */
  popupArrowCycles?: boolean;
  /** The activation changed a live region's text (announce contract). */
  liveRegionChanged?: boolean;
  /** Focus moved to a different node INSIDE the same composite (grid cells). */
  focusMovedWithin?: boolean;
}

export interface InteractionElement {
  index: number;
  /** Matching identity across reference/attempt: role + normalized name. */
  key: string;
  role: string;
  name: string;
  path: string;
  hasAriaExpanded: boolean;
  hasPopup: boolean;
  tabReachable: boolean;
  /** null when the tab walk never reached it. */
  focusIndicator: boolean | null;
  activation?: ActivationResult;
}

export interface InteractionMapResult {
  source: string;
  elements: InteractionElement[];
  /** Elements beyond --max-elements that were NOT probed (never silent). */
  capped: number;
}

export type InteractionIssueKind =
  | "dead-disclosure"
  | "broken-aria-controls"
  | "inert-control"
  | "no-focus-indicator"
  | "not-tab-reachable"
  | "escape-stuck"
  | "popup-no-focus-move"
  | "focus-escapes-trap"
  | "focus-not-returned"
  | "popup-arrows-dead"
  | "composite-arrows-dead";

export interface InteractionIssue {
  kind: InteractionIssueKind;
  severity: "warn" | "suspect";
  element: string;
  message: string;
}

// ---------------------------------------------------------------------------
// Browser-side scripts

/**
 * Discovery: interactive elements by explicit role or implicit HTML
 * semantics, document order, stamped with data-vlmkit-ix so later
 * evaluate calls (and fresh loads, which re-run this deterministically)
 * can address them by index. Also captures each element's BLURRED
 * focus-adjacent styles for the indicator comparison.
 */
export const DISCOVER_SCRIPT = `
(() => {
  const IMPLICIT = new Map([
    ["button", "button"], ["summary", "button"], ["select", "combobox"], ["textarea", "textbox"],
  ]);
  const INPUT_ROLES = new Map([
    ["checkbox", "checkbox"], ["radio", "radio"], ["button", "button"], ["submit", "button"],
    ["range", "slider"], ["text", "textbox"], ["email", "textbox"], ["search", "searchbox"],
  ]);
  const EXPLICIT = new Set(["button", "tab", "checkbox", "switch", "radio", "menuitem", "combobox", "link", "option", "slider", "textbox", "searchbox", "listbox", "grid"]);
  const focusStyleFingerprint = (root) => {
    // The focus indicator is often drawn on a DESCENDANT (APG wraps tab
    // text in <span class="focus"> and sets outline:none on the button).
    // Fingerprint the element plus its descendants' focus-relevant
    // styles so a child-borne ring is not read as 'no indicator'.
    const nodes = [root, ...root.querySelectorAll("*")].slice(0, 12);
    return nodes.map((n) => {
      const s = getComputedStyle(n);
      return [s.outlineStyle, s.outlineWidth, s.outlineColor, s.boxShadow, s.borderColor, s.borderWidth, s.backgroundColor].join(",");
    }).join("|");
  };
  const out = [];
  const seen = new Set();
  const els = document.querySelectorAll("*");
  for (const el of els) {
    let role = (el.getAttribute("role") || "").trim();
    if (role && !EXPLICIT.has(role)) continue;
    if (!role) {
      const tag = el.tagName.toLowerCase();
      if (tag === "a" && el.hasAttribute("href")) role = "link";
      else if (tag === "input") role = INPUT_ROLES.get((el.getAttribute("type") || "text").toLowerCase()) || "";
      else role = IMPLICIT.get(tag) || "";
    }
    if (!role) continue;
    const style = getComputedStyle(el);
    if (style.display === "none" || style.visibility === "hidden") continue;
    const rect = el.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) continue; // popup interiors etc. — probed via the popup pattern
    if (role === "option" && el.closest('[role="listbox"], [role="combobox"]')) continue; // captured via the container's selection facts
    if (seen.has(el)) continue;
    seen.add(el);
    const ix = out.length;
    el.setAttribute("data-vlmkit-ix", String(ix));
    const name = (el.getAttribute("aria-label")
      || (el.getAttribute("aria-labelledby") || "").split(/\\s+/).map((id) => document.getElementById(id)?.textContent || "").join(" ").trim()
      || el.textContent
      || el.getAttribute("value")
      || el.getAttribute("placeholder")
      || "").replace(/\\s+/g, " ").trim().slice(0, 80);
    const parts = [];
    let cur = el;
    while (cur && cur !== document.body && parts.length < 4) {
      let p = cur.tagName.toLowerCase();
      if (cur.id) p += "#" + cur.id;
      else if (typeof cur.className === "string" && cur.className.trim()) p += "." + cur.className.trim().split(/\\s+/)[0];
      parts.unshift(p);
      cur = cur.parentElement;
    }
    out.push({
      index: ix,
      role,
      name,
      path: parts.join(">"),
      hasAriaExpanded: el.hasAttribute("aria-expanded"),
      hasPopup: el.hasAttribute("aria-haspopup"),
      blurredStyle: focusStyleFingerprint(el),
    });
  }
  return out;
})()
`;

/** Focus-adjacent style + identity of the currently focused element. */
const FOCUS_SAMPLE_SCRIPT = `
(() => {
  const el = document.activeElement;
  if (!el || el === document.body || el === document.documentElement) return null;
  const direct = el.hasAttribute("data-vlmkit-ix");
  const owner = direct ? el : el.closest("[data-vlmkit-ix]");
  const fpTarget = owner || el;
  const nodes = [fpTarget, ...fpTarget.querySelectorAll("*")].slice(0, 12);
  const focusedStyle = nodes.map((n) => {
    const s = getComputedStyle(n);
    return [s.outlineStyle, s.outlineWidth, s.outlineColor, s.boxShadow, s.borderColor, s.borderWidth, s.backgroundColor].join(",");
  }).join("|");
  return {
    ix: owner ? Number(owner.getAttribute("data-vlmkit-ix")) : null,
    direct,
    fingerprint: el.tagName + "#" + (el.id || "") + ":" + (el.textContent || "").trim().slice(0, 24),
    focusedStyle,
  };
})()
`;

function ariaSnapshotScript(index: number): string {
  return `
(() => {
  const el = document.querySelector('[data-vlmkit-ix="${index}"]');
  if (!el) return null;
  const controlsId = (el.getAttribute("aria-controls") || "").split(/\\s+/)[0] || null;
  let controls = null;
  if (controlsId) {
    const target = document.getElementById(controlsId);
    let visible = false;
    if (target) {
      const s = getComputedStyle(target);
      const r = target.getBoundingClientRect();
      visible = s.display !== "none" && s.visibility !== "hidden" && r.width > 0 && r.height > 0;
    }
    controls = { id: controlsId, exists: !!target, visible };
  }
  const owner = el.closest("details, dialog");
  const adId = el.getAttribute("aria-activedescendant");
  const adEl = adId ? document.getElementById(adId) : null;
  const activeDescText = adEl ? (adEl.textContent || "").replace(/\\s+/g, " ").trim().slice(0, 32) : null;
  const selectedWithin = [...el.querySelectorAll('[aria-selected="true"]')]
    .map((o) => (o.textContent || "").replace(/\\s+/g, " ").trim().slice(0, 24))
    .join(",") || null;
  const liveText = [...document.querySelectorAll('[aria-live], [role="status"], [role="alert"], output')]
    .map((e) => (e.textContent || "").replace(/\\s+/g, " ").trim())
    .join("|").slice(0, 400);
  let visibleCount = 0;
  for (const e of document.querySelectorAll("body *")) {
    const r = e.getBoundingClientRect();
    if (r.width > 0 && r.height > 0) visibleCount++;
  }
  return {
    expanded: el.getAttribute("aria-expanded"),
    selected: el.getAttribute("aria-selected"),
    checked: el.getAttribute("aria-checked"),
    pressed: el.getAttribute("aria-pressed"),
    open: owner ? owner.hasAttribute("open") : null,
    controls,
    activeDescText,
    selectedWithin,
    liveText,
    layoutSignature: visibleCount + ":" + document.documentElement.scrollHeight + ":" + (document.body.innerText || "").length,
  };
})()
`;
}

/**
 * Identify a popup that appeared after activation: the trigger's
 * aria-controls target when visible, else any newly-visible
 * dialog/menu/listbox. Stamps it data-vlmkit-popup and reports whether
 * the active element sits inside it.
 */
function popupProbeScript(index: number): string {
  return `
(() => {
  const trigger = document.querySelector('[data-vlmkit-ix="${index}"]');
  if (!trigger) return null;
  const visible = (el) => {
    if (!el) return false;
    const s = getComputedStyle(el);
    const r = el.getBoundingClientRect();
    return s.display !== "none" && s.visibility !== "hidden" && r.width > 0 && r.height > 0;
  };
  let popup = null;
  const controlsId = (trigger.getAttribute("aria-controls") || "").split(/\\s+/)[0];
  if (controlsId) {
    const t = document.getElementById(controlsId);
    if (visible(t)) popup = t;
  }
  if (!popup) {
    for (const el of document.querySelectorAll('[role="dialog"], [role="menu"], [role="listbox"], dialog[open]')) {
      if (visible(el) && !el.contains(trigger)) { popup = el; break; }
    }
  }
  if (!popup) return null;
  popup.setAttribute("data-vlmkit-popup", "1");
  const role = popup.getAttribute("role") || (popup.tagName.toLowerCase() === "dialog" ? "dialog" : "");
  return {
    popupRole: role,
    modal: popup.getAttribute("aria-modal") === "true" || popup.tagName.toLowerCase() === "dialog",
    focusInside: popup.contains(document.activeElement),
  };
})()
`;
}

/**
 * Where is focus relative to the open popup? Native modal dialogs let
 * Tab visit BROWSER chrome (activeElement = body) — that is not a trap
 * leak; landing on a page element OUTSIDE the popup is.
 */
const FOCUS_INSIDE_POPUP_SCRIPT = `
(() => {
  const popup = document.querySelector('[data-vlmkit-popup]');
  if (!popup) return null;
  const el = document.activeElement;
  if (!el || el === document.body || el === document.documentElement) return "chrome";
  return popup.contains(el) ? "inside" : "outside";
})()
`;

/** ArrowDown inside an open popup: does focus move and stay inside? */
const POPUP_ACTIVE_SCRIPT = `
(() => {
  const popup = document.querySelector('[data-vlmkit-popup]');
  const el = document.activeElement;
  if (!popup || !el) return null;
  return { inside: popup.contains(el), tag: el.tagName + "#" + (el.id || "") + ":" + (el.textContent || "").trim().slice(0, 24) };
})()
`;

function popupClosedScript(index: number): string {
  return `
(() => {
  const popup = document.querySelector('[data-vlmkit-popup]');
  const trigger = document.querySelector('[data-vlmkit-ix="${index}"]');
  const visible = (el) => {
    if (!el) return false;
    const s = getComputedStyle(el);
    const r = el.getBoundingClientRect();
    return s.display !== "none" && s.visibility !== "hidden" && r.width > 0 && r.height > 0;
  };
  return {
    closed: !visible(popup),
    focusOnTrigger: trigger === document.activeElement,
  };
})()
`;
}

// ---------------------------------------------------------------------------
// Pure helpers

/** The role's canonical activation key; null = focus-only element. */
export function activationKeyForRole(role: string): string | null {
  switch (role) {
    case "button":
    case "menuitem":
      return "Enter";
    case "checkbox":
    case "switch":
      return " ";
    case "tab":
      return "ArrowRight";
    case "radio":
      return "ArrowDown";
    case "combobox":
    case "listbox":
      return "ArrowDown";
    case "grid":
      return "ArrowRight";
    default:
      return null; // link (navigation), textbox/searchbox (typing), option, slider
  }
}

export function ariaDelta(before: AriaSnapshot, after: AriaSnapshot): Record<string, [string | null, string | null]> {
  const delta: Record<string, [string | null, string | null]> = {};
  for (const attr of ["expanded", "selected", "checked", "pressed"] as const) {
    if (before[attr] !== after[attr]) delta[attr] = [before[attr], after[attr]];
  }
  if (before.open !== after.open) {
    delta["open"] = [String(before.open), String(after.open)];
  }
  if (before.activeDescText !== after.activeDescText) {
    delta["activedescendant"] = [before.activeDescText, after.activeDescText];
  }
  if (before.selectedWithin !== after.selectedWithin) {
    delta["selection"] = [before.selectedWithin, after.selectedWithin];
  }
  return delta;
}

const ROVING_ROLES = new Set(["tab", "radio", "menuitem", "option"]);

/**
 * The wording for each issue kind.
 *
 * Separated from the rules because the two change for different reasons and at
 * different rates: a rule changing is a behaviour change that needs review, while
 * rewording a diagnostic is editorial. The rules now live in MoonBit
 * (`markup-core/interaction_issues.mbt`) and return ids; this table turns an id
 * plus the element's label into the sentence a reader sees, so rewording does not
 * mean rebuilding MoonBit.
 */
const ISSUE_MESSAGE: Record<
  InteractionIssueKind,
  (label: string, evidence: { key?: string; popupRole?: string; brokenControlsId?: string }) => string
> = {
  "dead-disclosure": (label, e) =>
    `${label} declares aria-expanded but activating it (${describeKey(e.key ?? "")}) changes neither the attribute nor the layout — the disclosure is wired to nothing.`,
  "broken-aria-controls": (label, e) =>
    `${label} has aria-controls="${e.brokenControlsId}" but no element carries that id.`,
  "inert-control": (label, e) =>
    `${label} shows no observable response to ${describeKey(e.key ?? "")} — no ARIA change, no layout change. Dead control, or its response is outside this probe.`,
  "no-focus-indicator": (label) =>
    `${label} paints NO visible focus indicator on keyboard focus (outline/box-shadow/border/background all unchanged) — keyboard users cannot see where they are.`,
  "not-tab-reachable": (label) =>
    `${label} was never reached by Tab — keyboard users cannot operate it.`,
  "popup-no-focus-move": (label, e) =>
    `${label} opens a ${e.popupRole} but keyboard focus stays on the trigger — the ${e.popupRole} pattern moves focus into the popup.`,
  "focus-escapes-trap": (label) =>
    `${label} opens a modal dialog whose Tab focus ESCAPES the dialog — a modal must trap focus while open.`,
  "composite-arrows-dead": (label, e) =>
    `${label}: ${e.key} produces no selection change and no focus movement inside the composite — arrow navigation is not wired.`,
  "popup-arrows-dead": (label, e) =>
    `${label} opens a ${e.popupRole} but ArrowDown does not move focus within it — menu/listbox items must be arrow-navigable.`,
  "focus-not-returned": (label) =>
    `${label}: Escape closes its popup but focus does NOT return to the trigger — keyboard users are dropped at the document root.`,
  "escape-stuck": (label) => `${label} opened a popup that Escape does not close.`,
};

/**
 * Keyboard-interaction issues implied by a probe run.
 *
 * The rules are in MoonBit. This assembles the payload they read, and turns the
 * ids they return into messages.
 *
 * The payload is deliberately **narrower than the map**: `ariaDelta` is a
 * `Record<string, [string | null, string | null]>` and the rules only ask whether
 * it is empty and whether it mentions `expanded`, so those two facts cross the
 * boundary instead of the map. Sending the whole structure because it exists would
 * make every future change to it a change in MoonBit too.
 */
export function deriveInteractionIssues(map: InteractionMapResult): InteractionIssue[] {
  const payload = {
    elements: map.elements.map((el) => ({
      role: el.role,
      has_aria_expanded: el.hasAriaExpanded,
      has_popup: el.hasPopup,
      tab_reachable: el.tabReachable,
      focus_indicator: el.focusIndicator ?? undefined,
      activation: el.activation
        ? {
          key: el.activation.key,
          aria_delta_empty: Object.keys(el.activation.ariaDelta).length === 0,
          aria_delta_has_expanded: "expanded" in el.activation.ariaDelta,
          layout_changed: el.activation.layoutChanged,
          // The rules ask "did focus move", not where to. `focusMovedTo` is a
          // discovery index and 0 is a valid one, so this must compare to null
          // rather than test truthiness.
          focus_moved: el.activation.focusMovedTo !== null,
          focus_moved_within: el.activation.focusMovedWithin === true,
          broken_controls_id: el.activation.brokenControlsId,
          popup_role: el.activation.popupRole,
          focus_moved_into_popup: el.activation.focusMovedIntoPopup,
          focus_trapped: el.activation.focusTrapped,
          popup_arrow_cycles: el.activation.popupArrowCycles,
          escape_closes: el.activation.escapeCloses,
          focus_returns_to_opener: el.activation.focusReturnsToOpener,
        }
        : undefined,
    })),
  };

  const raised = callMarkupCoreJson<{
    kind: InteractionIssueKind;
    severity: "warn" | "suspect";
    /** Position in the array above — not `el.index`, which callers may reuse. */
    element_position: number;
    key?: string;
    popup_role?: string;
    broken_controls_id?: string;
  }[]>("interaction-issues", payload);

  return raised.map((issue) => {
    // By position. Keying on `el.index` looked equivalent and was not: the field is
    // a discovery index a caller can legitimately repeat, and doing so labelled
    // every finding with the last element that shared the value.
    const el = map.elements[issue.element_position];
    const label = el ? `${el.role} "${el.name}" (${el.path})` : `element ${issue.element_position}`;
    return {
      kind: issue.kind,
      severity: issue.severity,
      element: label,
      message: ISSUE_MESSAGE[issue.kind](label, {
        key: issue.key,
        popupRole: issue.popup_role,
        brokenControlsId: issue.broken_controls_id,
      }),
    };
  });
}

export interface InteractionMismatch {
  severity: "warn" | "suspect";
  key: string;
  message: string;
}

export interface InteractionComparison {
  missing: InteractionElement[];
  extra: InteractionElement[];
  mismatches: InteractionMismatch[];
}

/**
 * Reference-vs-attempt inventory diff, keyed by (role, accessible
 * name). The reference defines the behavioral contract: every
 * interactive element must exist, be reachable the same way, and
 * respond to its canonical event with the same ARIA transition.
 */
export function compareInteractionMaps(
  reference: InteractionMapResult,
  attempt: InteractionMapResult,
): InteractionComparison {
  const byKey = (els: InteractionElement[]) => {
    const m = new Map<string, InteractionElement[]>();
    for (const el of els) {
      const list = m.get(el.key) ?? [];
      list.push(el);
      m.set(el.key, list);
    }
    return m;
  };
  const refByKey = byKey(reference.elements);
  const attByKey = byKey(attempt.elements);
  const missing: InteractionElement[] = [];
  const extra: InteractionElement[] = [];
  const mismatches: InteractionMismatch[] = [];

  for (const [key, refs] of refByKey) {
    const atts = attByKey.get(key) ?? [];
    for (let i = atts.length; i < refs.length; i++) missing.push(refs[i]!);
    const pairs = Math.min(refs.length, atts.length);
    for (let i = 0; i < pairs; i++) {
      const r = refs[i]!;
      const a = atts[i]!;
      if (r.tabReachable && !a.tabReachable) {
        mismatches.push({ severity: "suspect", key, message: `${key}: reachable by Tab in the reference but NOT in the attempt.` });
      }
      if (r.focusIndicator === true && a.focusIndicator === false) {
        mismatches.push({ severity: "suspect", key, message: `${key}: the reference paints a focus indicator, the attempt does not.` });
      }
      if (r.activation && a.activation) {
        const rDelta = JSON.stringify(r.activation.ariaDelta);
        const aDelta = JSON.stringify(a.activation.ariaDelta);
        if (rDelta !== aDelta) {
          mismatches.push({
            severity: "suspect",
            key,
            message: `${key}: ${describeKey(r.activation.key)} produces ARIA transition ${rDelta} in the reference but ${aDelta} in the attempt.`,
          });
        }
        if (r.activation.layoutChanged && !a.activation.layoutChanged && rDelta === aDelta) {
          mismatches.push({
            severity: "suspect",
            key,
            message: `${key}: ${describeKey(r.activation.key)} visibly changes the reference layout but not the attempt's.`,
          });
        }
        if (r.activation.controlsBecameVisible === true && a.activation.controlsBecameVisible === false) {
          mismatches.push({
            severity: "suspect",
            key,
            message: `${key}: the reference's aria-controls target becomes visible on activation; the attempt's does not.`,
          });
        }
        if (r.activation.escapeCloses === true && a.activation.escapeCloses === false) {
          mismatches.push({ severity: "warn", key, message: `${key}: Escape closes the reference's popup but not the attempt's.` });
        }
        if (r.activation.focusMovedIntoPopup === true && a.activation.focusMovedIntoPopup === false) {
          mismatches.push({ severity: "suspect", key, message: `${key}: opening moves focus into the popup in the reference but not in the attempt.` });
        }
        if (r.activation.focusTrapped === true && a.activation.focusTrapped === false) {
          mismatches.push({ severity: "suspect", key, message: `${key}: the reference's modal dialog traps Tab focus; the attempt's does not.` });
        }
        if (r.activation.focusReturnsToOpener === true && a.activation.focusReturnsToOpener === false) {
          mismatches.push({ severity: "suspect", key, message: `${key}: Escape returns focus to the trigger in the reference but not in the attempt.` });
        }
        if (r.activation.popupArrowCycles === true && a.activation.popupArrowCycles === false) {
          mismatches.push({ severity: "suspect", key, message: `${key}: arrow keys navigate the reference's popup items but not the attempt's.` });
        }
        if (r.activation.liveRegionChanged === true && !a.activation.liveRegionChanged) {
          mismatches.push({ severity: "suspect", key, message: `${key}: the reference announces this action through a live region; the attempt does not.` });
        }
        if (r.activation.focusMovedWithin === true && !a.activation.focusMovedWithin && JSON.stringify(a.activation.ariaDelta) === "{}") {
          mismatches.push({ severity: "suspect", key, message: `${key}: arrow keys move focus within the reference's composite but produce no response in the attempt.` });
        }
        if ((r.activation.focusMovedTo !== null) && (a.activation.focusMovedTo === null)) {
          mismatches.push({ severity: "warn", key, message: `${key}: ${describeKey(r.activation.key)} moves focus in the reference (roving) but not in the attempt.` });
        }
      } else if (r.activation && !a.activation) {
        mismatches.push({ severity: "warn", key, message: `${key}: probed in the reference but not probeable in the attempt.` });
      }
    }
  }
  for (const [key, atts] of attByKey) {
    const refs = refByKey.get(key) ?? [];
    for (let i = refs.length; i < atts.length; i++) extra.push(atts[i]!);
  }
  return { missing, extra, mismatches };
}

function describeKey(key: string): string {
  return key === " " ? "Space" : key;
}

// ---------------------------------------------------------------------------
// The probe driver

export interface InteractionMapOptions {
  /**
   * Playwright storage-state file so gates can measure pages behind a
   * login. Falls back to VLMKIT_STORAGE_STATE. See auth-state.ts.
   */
  storageState?: string;
  source: string;
  maxElements?: number;
  settleMs?: number;
}

interface DiscoveredElement {
  index: number;
  role: string;
  name: string;
  path: string;
  hasAriaExpanded: boolean;
  hasPopup: boolean;
  blurredStyle: string;
}

async function gotoSource(page: Page, source: string): Promise<void> {
  const url = /^(https?|file):\/\//.test(source) ? source : pathToFileURL(resolve(source)).href;
  await page.goto(url, { waitUntil: "load", timeout: 30000 });
  await settlePage(page);
}

export async function buildInteractionMap(options: InteractionMapOptions): Promise<InteractionMapResult> {
  const maxElements = options.maxElements ?? 30;
  const settleMs = options.settleMs ?? 120;
  return await withBrowser(async (browser) => {
    const page = await browser.newPage(withAuthState({ viewport: { width: 1280, height: 800 } }, options.storageState));
    await gotoSource(page, options.source);
    const discovered = await page.evaluate(DISCOVER_SCRIPT) as DiscoveredElement[];
    const capped = Math.max(0, discovered.length - maxElements);
    const kept = discovered.slice(0, maxElements);

    // --- Tab walk (single load): reachability + focus indicator.
    const tabReached = new Map<number, boolean | null>();
    const seenStops = new Set<number>();
    for (let i = 0; i < Math.min(96, discovered.length * 3 + 8); i++) {
      await page.keyboard.press("Tab");
      const sample = await page.evaluate(FOCUS_SAMPLE_SCRIPT) as
        { ix: number | null; direct: boolean; focusedStyle: string } | null;
      if (!sample || sample.ix === null) continue;
      if (seenStops.has(sample.ix)) break; // cycled
      seenStops.add(sample.ix);
      if (sample.direct) {
        const blurred = discovered[sample.ix]?.blurredStyle;
        tabReached.set(sample.ix, blurred !== undefined && sample.focusedStyle !== blurred);
      } else {
        // Focus is on a composite interior (roving gridcell etc.): the
        // container is reachable, but its child's blurred style is
        // unknown — leave the indicator unjudged rather than guessing.
        tabReached.set(sample.ix, null);
      }
    }

    // --- Activation probes, each from a fresh load.
    const elements: InteractionElement[] = [];
    for (const d of kept) {
      const key = activationKeyForRole(d.role);
      let activation: ActivationResult | undefined;
      if (key) {
        await gotoSource(page, options.source);
        await page.evaluate(DISCOVER_SCRIPT);
        const before = await page.evaluate(ariaSnapshotScript(d.index)) as AriaSnapshot | null;
        if (before) {
          await page.evaluate(`
(() => {
  const el = document.querySelector('[data-vlmkit-ix="${d.index}"]');
  if (!el) return;
  el.focus();
  if (document.activeElement === el || el.contains(document.activeElement)) return;
  const inner = el.querySelector('[tabindex="0"]') || el.querySelector('[role="option"], [role="gridcell"], [tabindex]');
  if (inner) inner.focus();
})()`);
          const preFocus = await page.evaluate(FOCUS_SAMPLE_SCRIPT) as { fingerprint: string } | null;
          await page.keyboard.press(key === " " ? "Space" : key);
          await page.waitForTimeout(settleMs);
          const after = await page.evaluate(ariaSnapshotScript(d.index)) as AriaSnapshot | null;
          if (after) {
            const focusSample = await page.evaluate(FOCUS_SAMPLE_SCRIPT) as
              { ix: number | null; fingerprint: string } | null;
            const delta = ariaDelta(before, after);
            const movedWithin = !!(preFocus && focusSample
              && preFocus.fingerprint !== focusSample.fingerprint
              && (focusSample.ix === null || focusSample.ix === d.index));
            activation = {
              key: key === " " ? "Space" : key,
              ariaDelta: delta,
              ...(before.liveText !== after.liveText ? { liveRegionChanged: true } : {}),
              ...(movedWithin ? { focusMovedWithin: true } : {}),
              controlsBecameVisible: before.controls && after.controls
                ? (!before.controls.visible && after.controls.visible ? true : before.controls.visible === after.controls.visible ? (after.controls.visible ? null : false) : false)
                : null,
              layoutChanged: before.layoutSignature !== after.layoutSignature,
              focusMovedTo: focusSample?.ix !== undefined && focusSample?.ix !== null && focusSample.ix !== d.index ? focusSample.ix : null,
            };
            if (before.controls && !before.controls.exists) {
              activation.brokenControlsId = before.controls.id;
            }
            const openedPopup = (d.hasPopup || d.role === "combobox")
              && (delta["expanded"]?.[1] === "true" || activation.controlsBecameVisible === true || activation.layoutChanged);
            if (openedPopup) {
              // Identify the popup node and whether focus moved into it.
              const popup = await page.evaluate(popupProbeScript(d.index)) as
                { popupRole: string; modal: boolean; focusInside: boolean } | null;
              if (popup) {
                activation.popupRole = popup.popupRole;
                activation.focusMovedIntoPopup = popup.focusInside;
                // Modal dialogs must trap Tab: walk a bounded number of
                // stops and require every one to stay inside the popup.
                if (popup.modal) {
                  let trapped = true;
                  for (let t = 0; t < 12; t++) {
                    await page.keyboard.press("Tab");
                    const where = await page.evaluate(FOCUS_INSIDE_POPUP_SCRIPT) as "inside" | "outside" | "chrome" | null;
                    if (where === "outside") {
                      trapped = false;
                      break;
                    }
                    if (where === null) break;
                  }
                  activation.focusTrapped = trapped;
                }
                if (popup.focusInside && (popup.popupRole === "menu" || popup.popupRole === "listbox")) {
                  const beforeArrow = await page.evaluate(POPUP_ACTIVE_SCRIPT) as { inside: boolean; tag: string } | null;
                  await page.keyboard.press("ArrowDown");
                  const afterArrow = await page.evaluate(POPUP_ACTIVE_SCRIPT) as { inside: boolean; tag: string } | null;
                  activation.popupArrowCycles = !!(beforeArrow && afterArrow && afterArrow.inside && afterArrow.tag !== beforeArrow.tag);
                }
              }
              await page.keyboard.press("Escape");
              await page.waitForTimeout(settleMs);
              if (popup) {
                const closedState = await page.evaluate(popupClosedScript(d.index)) as
                  { closed: boolean; focusOnTrigger: boolean } | null;
                activation.escapeCloses = closedState?.closed ?? false;
                if (closedState?.closed) {
                  activation.focusReturnsToOpener = closedState.focusOnTrigger;
                }
              } else {
                const closed = await page.evaluate(ariaSnapshotScript(d.index)) as AriaSnapshot | null;
                activation.escapeCloses = closed
                  ? (closed.expanded !== "true" && (!closed.controls || !closed.controls.visible))
                  : false;
              }
            }
          }
        }
      }
      elements.push({
        index: d.index,
        key: `${d.role}|${d.name}`,
        role: d.role,
        name: d.name,
        path: d.path,
        hasAriaExpanded: d.hasAriaExpanded,
        hasPopup: d.hasPopup,
        tabReachable: tabReached.has(d.index),
        focusIndicator: tabReached.has(d.index) ? tabReached.get(d.index) ?? null : null,
        ...(activation ? { activation } : {}),
      });
    }
    return { source: options.source, elements, capped };
  });
}

// ---------------------------------------------------------------------------
// Report + CLI

export function formatInteractionReport(
  map: InteractionMapResult,
  issues: InteractionIssue[],
  comparison?: InteractionComparison,
): string {
  const lines: string[] = [];
  lines.push(`${BOLD}${CYAN}vlmkit check interactions${RESET}`);
  lines.push(`${DIM}source: ${map.source}${RESET}`);
  lines.push("");
  const suspects = issues.filter((i) => i.severity === "suspect").length
    + (comparison ? comparison.missing.length + comparison.mismatches.filter((m) => m.severity === "suspect").length : 0);
  lines.push(`status: ${suspects === 0 ? `${GREEN}ok${RESET}` : `${RED}${suspects} suspect issue(s)${RESET}`}`);
  lines.push(`interactive elements: ${map.elements.length}${map.capped > 0 ? ` ${YELLOW}(+${map.capped} beyond the cap — NOT probed)${RESET}` : ""}`);
  lines.push("");
  for (const el of map.elements) {
    const focus = !el.tabReachable
      ? `${YELLOW}unreachable${RESET}`
      : el.focusIndicator === true
      ? "focus✓"
      : el.focusIndicator === null
      ? "focus(interior)" // reached via a composite child; indicator unjudged
      : `${YELLOW}no-indicator${RESET}`;
    let act = "";
    if (el.activation) {
      const delta = Object.entries(el.activation.ariaDelta).map(([k, [b, a]]) => `${k} ${b} -> ${a}`).join(", ");
      act = ` | ${el.activation.key}: ${delta || (el.activation.focusMovedWithin ? "focus moves within" : el.activation.layoutChanged ? "layout change" : el.activation.focusMovedTo !== null ? "focus moves" : "no response")}`;
      if (el.activation.liveRegionChanged) act += " | announces";
      if (el.activation.popupRole) {
        act += ` | opens ${el.activation.popupRole}${el.activation.focusMovedIntoPopup ? " (focus enters)" : ""}`;
        if (el.activation.focusTrapped !== undefined) act += el.activation.focusTrapped ? ", traps" : ", TRAP LEAKS";
        if (el.activation.popupArrowCycles !== undefined) act += el.activation.popupArrowCycles ? ", arrows cycle" : ", arrows DEAD";
      }
      if (el.activation.escapeCloses !== undefined) {
        act += ` | Esc ${el.activation.escapeCloses ? "closes" : "stuck"}`;
        if (el.activation.focusReturnsToOpener !== undefined) act += el.activation.focusReturnsToOpener ? "+returns focus" : ", focus LOST";
      }
    }
    lines.push(`  - [${el.role}] "${el.name}" ${focus}${act}`);
  }
  if (issues.length > 0) {
    lines.push("");
    lines.push(`${BOLD}Issues:${RESET}`);
    for (const i of issues) {
      const color = i.severity === "suspect" ? RED : YELLOW;
      lines.push(`  ${color}${i.severity}${RESET} [${i.kind}] ${i.message}`);
    }
  }
  if (comparison) {
    lines.push("");
    lines.push(`${BOLD}vs reference:${RESET}`);
    if (comparison.missing.length === 0 && comparison.extra.length === 0 && comparison.mismatches.length === 0) {
      lines.push(`  ${GREEN}interaction contract satisfied — same elements, same responses${RESET}`);
    }
    for (const m of comparison.missing) {
      lines.push(`  ${RED}missing${RESET} [${m.role}] "${m.name}" — the reference has this interactive element, the attempt does not.`);
    }
    for (const e of comparison.extra) {
      lines.push(`  ${YELLOW}extra${RESET} [${e.role}] "${e.name}" — not in the reference.`);
    }
    for (const mm of comparison.mismatches) {
      const color = mm.severity === "suspect" ? RED : YELLOW;
      lines.push(`  ${color}${mm.severity}${RESET} ${mm.message}`);
    }
  }
  return lines.join("\n");
}

/**
 * CLI entry removed: this module is measurement code now, not a command.
 * `check interactions` is declared in `../gates/interactions.gate.ts` and driven by the core runner
 * (`@mizchi/vlmkit-core/plugin/runner.ts`), which owns argument parsing,
 * `--json`, `--advisory`, the run ledger and the exit code.
 */
