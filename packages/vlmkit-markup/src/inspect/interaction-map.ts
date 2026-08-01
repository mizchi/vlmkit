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
import { fileURLToPath, pathToFileURL } from "node:url";
import { handleCliError } from "@mizchi/vlmkit-core/cli-error.ts";
import { appendRunLedger } from "@mizchi/vlmkit-core/run-ledger.ts";
import { BOLD, CYAN, DIM, GREEN, RED, RESET, YELLOW } from "@mizchi/vlmkit-core/terminal-colors.ts";
import type { Page } from "playwright";

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

export function deriveInteractionIssues(map: InteractionMapResult): InteractionIssue[] {
  const issues: InteractionIssue[] = [];
  // Roving-tabindex composites (tablists, radio groups, menus) expose
  // ONE tab stop by design; the arrows reach the rest. An unreachable
  // member whose same-role sibling IS reachable is the pattern working,
  // not a defect.
  const reachableRoles = new Set(map.elements.filter((e) => e.tabReachable).map((e) => e.role));
  for (const el of map.elements) {
    const label = `${el.role} "${el.name}" (${el.path})`;
    if (el.hasAriaExpanded && el.activation && !("expanded" in el.activation.ariaDelta) && !el.activation.layoutChanged) {
      issues.push({
        kind: "dead-disclosure",
        severity: "suspect",
        element: label,
        message: `${label} declares aria-expanded but activating it (${el.activation.key === " " ? "Space" : el.activation.key}) changes neither the attribute nor the layout — the disclosure is wired to nothing.`,
      });
    }
    if (el.activation?.brokenControlsId) {
      issues.push({
        kind: "broken-aria-controls",
        severity: "suspect",
        element: label,
        message: `${label} has aria-controls="${el.activation.brokenControlsId}" but no element carries that id.`,
      });
    }
    if (el.activation && el.activation.key !== "ArrowRight" && el.activation.key !== "ArrowDown"
      && Object.keys(el.activation.ariaDelta).length === 0
      && !el.activation.layoutChanged
      && el.activation.focusMovedTo === null
      && !el.hasAriaExpanded) {
      issues.push({
        kind: "inert-control",
        severity: "warn",
        element: label,
        message: `${label} shows no observable response to ${el.activation.key === " " ? "Space" : el.activation.key} — no ARIA change, no layout change. Dead control, or its response is outside this probe.`,
      });
    }
    if (el.tabReachable && el.focusIndicator === false) {
      issues.push({
        kind: "no-focus-indicator",
        severity: "warn",
        element: label,
        message: `${label} paints NO visible focus indicator on keyboard focus (outline/box-shadow/border/background all unchanged) — keyboard users cannot see where they are.`,
      });
    }
    if (!el.tabReachable && !(ROVING_ROLES.has(el.role) && reachableRoles.has(el.role))) {
      issues.push({
        kind: "not-tab-reachable",
        severity: "warn",
        element: label,
        message: `${label} was never reached by Tab — keyboard users cannot operate it.`,
      });
    }
    if (el.activation?.popupRole && (el.activation.popupRole === "dialog" || el.activation.popupRole === "menu" || el.activation.popupRole === "listbox")
      && el.activation.focusMovedIntoPopup === false) {
      issues.push({
        kind: "popup-no-focus-move",
        severity: "warn",
        element: label,
        message: `${label} opens a ${el.activation.popupRole} but keyboard focus stays on the trigger — the ${el.activation.popupRole} pattern moves focus into the popup.`,
      });
    }
    if (el.activation?.focusTrapped === false) {
      issues.push({
        kind: "focus-escapes-trap",
        severity: "suspect",
        element: label,
        message: `${label} opens a modal dialog whose Tab focus ESCAPES the dialog — a modal must trap focus while open.`,
      });
    }
    if ((el.role === "grid" || el.role === "listbox") && el.activation
      && Object.keys(el.activation.ariaDelta).length === 0
      && !el.activation.focusMovedWithin && el.activation.focusMovedTo === null) {
      issues.push({
        kind: "composite-arrows-dead",
        severity: "warn",
        element: label,
        message: `${label}: ${el.activation.key} produces no selection change and no focus movement inside the composite — arrow navigation is not wired.`,
      });
    }
    if (el.activation?.popupArrowCycles === false) {
      issues.push({
        kind: "popup-arrows-dead",
        severity: "warn",
        element: label,
        message: `${label} opens a ${el.activation.popupRole} but ArrowDown does not move focus within it — menu/listbox items must be arrow-navigable.`,
      });
    }
    if (el.activation?.escapeCloses === true && el.activation.focusReturnsToOpener === false) {
      issues.push({
        kind: "focus-not-returned",
        severity: "warn",
        element: label,
        message: `${label}: Escape closes its popup but focus does NOT return to the trigger — keyboard users are dropped at the document root.`,
      });
    }
    if ((el.hasPopup || el.role === "combobox") && el.activation?.escapeCloses === false) {
      issues.push({
        kind: "escape-stuck",
        severity: "warn",
        element: label,
        message: `${label} opened a popup that Escape does not close.`,
      });
    }
  }
  return issues;
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
  await settleAfterLoad(page);
}

/**
 * `load` fires before a client-rendered app paints: the 2026-08-01
 * hard-target audit caught this gate reporting "interactive elements: 0"
 * on a React page that has a button, two links and a scroller — it was
 * measuring the "Loading…" placeholder. Wait for the network to go quiet
 * and give the framework a commit tick.
 *
 * Both waits are bounded and swallowed on purpose: a page that never goes
 * idle (polling, websockets) must not turn this into a 30s hang, and a
 * static file must not pay for a long wait it does not need.
 */
export async function settleAfterLoad(page: Page, settleMs = 250): Promise<void> {
  await page.waitForLoadState("networkidle", { timeout: 5000 }).catch(() => {});
  await page.evaluate(() => (document.fonts ? document.fonts.ready.then(() => undefined) : undefined))
    .catch(() => {});
  await page.waitForTimeout(settleMs);
}

export async function buildInteractionMap(options: InteractionMapOptions): Promise<InteractionMapResult> {
  const maxElements = options.maxElements ?? 30;
  const settleMs = options.settleMs ?? 120;
  const { chromium } = await import("playwright");
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
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
  } finally {
    await browser.close();
  }
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

function printUsage(exitCode: number): never {
  console.log(`Usage: vlmkit check interactions <html-or-url> [options]

A11y-event state map: discovers interactive elements, probes their
canonical keyboard events (Tab / Enter / Space / arrows / Escape), and
records the resulting state changes as ARIA transitions + layout
deltas. With --reference, the reference's inventory is the behavioral
contract and every response mismatch is reported.

Options:
  --reference <html>    Reference page defining the interaction contract
  --max-elements <n>    Probe cap (default 30; the report says when capped)
  --handlers            Also enumerate the wired event-callback surface (scan handlers) and cross-check it
  --json                Print JSON report`);
  process.exit(exitCode);
}

async function main(argv = process.argv.slice(2)): Promise<void> {
  if (argv.includes("--help") || argv.includes("-h")) printUsage(0);
  let reference: string | undefined;
  let maxElements = 30;
  let json = false;
  let handlers = false;
  const positional: string[] = [];
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i]!;
    if (arg === "--reference") reference = argv[++i]!;
    else if (arg === "--max-elements") maxElements = Number(argv[++i]!);
    else if (arg === "--json") json = true;
    else if (arg === "--handlers") handlers = true;
    else if (!arg.startsWith("-")) positional.push(arg);
  }
  const source = positional[0];
  if (!source) printUsage(1);

  const map = await buildInteractionMap({ source, maxElements });
  const issues = deriveInteractionIssues(map);
  let comparison: InteractionComparison | undefined;
  if (reference) {
    const refMap = await buildInteractionMap({ source: reference, maxElements });
    comparison = compareInteractionMaps(refMap, map);
  }
  let handlerBlock = "";
  let handlerSuspects = 0;
  if (handlers) {
    const { buildHandlerSurface, compareHandlerSurfaces, deriveHandlerIssues, formatHandlerSurface } = await import("./handler-map.ts");
    const surface = await buildHandlerSurface({ source });
    const handlerIssues = deriveHandlerIssues(surface);
    handlerSuspects = handlerIssues.filter((i) => i.severity === "suspect").length;
    handlerBlock = "\n\n" + formatHandlerSurface(surface, handlerIssues);
    if (reference) {
      const refSurface = await buildHandlerSurface({ source: reference });
      const surfaceMismatches = compareHandlerSurfaces(refSurface, surface);
      handlerBlock += "\n\nSurface vs reference:";
      if (surfaceMismatches.length === 0) handlerBlock += `\n  ${GREEN}event vocabulary matches${RESET}`;
      for (const m of surfaceMismatches) handlerBlock += `\n  ${YELLOW}warn${RESET} ${m.message}`;
    }
  }

  appendRunLedger({
    tool: "check-interactions",
    source,
    ...(reference ? { target: reference } : {}),
    headline: {
      elements: map.elements.length,
      suspects: issues.filter((i) => i.severity === "suspect").length
        + (comparison ? comparison.missing.length + comparison.mismatches.filter((m) => m.severity === "suspect").length : 0),
      warns: issues.filter((i) => i.severity === "warn").length
        + (comparison ? comparison.extra.length + comparison.mismatches.filter((m) => m.severity === "warn").length : 0),
    },
  });

  if (json) console.log(JSON.stringify({ map, issues, comparison }, null, 2));
  else console.log(formatInteractionReport(map, issues, comparison) + handlerBlock);
  const failing = issues.some((i) => i.severity === "suspect")
    || handlerSuspects > 0
    || (comparison && (comparison.missing.length > 0 || comparison.mismatches.some((m) => m.severity === "suspect")));
  if (failing) process.exit(1);
}

const isCliEntry = process.env.__VRT_DISPATCHER_LEAF__ === "interaction-map" ||
  (process.argv[1] ? resolve(process.argv[1]) === fileURLToPath(import.meta.url) : false);
if (isCliEntry) {
  main().catch(handleCliError);
}
