#!/usr/bin/env node
/**
 * Event-handler surface inventory (experimental).
 *
 * `check interactions` discovers what the page CLAIMS to be interactive
 * (roles, semantics) and probes it. This tool enumerates what is
 * actually WIRED: every callback registered on the page, whether or
 * not the element carries any semantics. The two views cross-check
 * each other — the headline detection is the **pointer-only control**:
 * a visible element with a click/pointer handler but no role, no
 * keyboard path, and no delegation excuse. The role-driven map can
 * never see it (it is never discovered); the handler surface can.
 *
 * Enumeration is two-route, both deterministic:
 *   1. An init-script patch of `EventTarget.prototype.addEventListener`
 *      runs BEFORE any page script and records every registration with
 *      the live element reference (kept in the page world) plus a
 *      source snippet. Browser-agnostic, catches window/document
 *      delegation.
 *   2. A DOM sweep for `on*` attributes and `on*` properties assigned
 *      by script.
 * Framework caveat (documented, not hidden): React-style root
 * delegation shows up as one listener on the delegation root — the
 * per-element granularity of vanilla pages does not survive
 * frameworks. CDP `DOMDebugger.getEventListeners` is a future third
 * route (Chromium-only ground truth with source positions).
 *
 * CLI:
 *   vlmkit scan handlers <html-or-url> [--json]
 * Integration:
 *   vlmkit check interactions <html> --handlers   (adds surface + cross-check issues)
 */
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { withAuthState } from "@mizchi/vlmkit-core/auth-state.ts";
import type { RuleView } from "@mizchi/vlmkit-core/plugin/contract.ts";
import { type PageLoadOptions, applyHar, navigationOptions } from "@mizchi/vlmkit-core/page-load.ts";
import { settlePage } from "@mizchi/vlmkit-core/page-open.ts";
import { BOLD, CYAN, DIM, GREEN, RED, RESET, YELLOW } from "@mizchi/vlmkit-core/terminal-colors.ts";
import { DISCOVER_SCRIPT } from "./interaction-map.ts";
import { withBrowser } from "@mizchi/vlmkit-core/browser-launch.ts";
import { PNG } from "pngjs";
import type { Browser, ElementHandle, JSHandle, Page } from "playwright";

export interface HandlerSurfaceEntry {
  /** Handler types on ancestors that also carry handlers (delegation). */
  ancestorTypes: string[];
  /** Discovery index when the element is also in the interaction map. */
  ix: number | null;
  path: string;
  /** Trimmed visible text, for human identification. */
  text: string;
  /** event type -> registration count. */
  types: Record<string, number>;
  /** Up to 3 handler source snippets. */
  samples: string[];
  visible: boolean;
  /** A discovered interactive element lives inside this one (delegation). */
  containsInteractive: boolean;
  /** This element lives inside a discovered interactive element. */
  insideInteractive: boolean;
  /**
   * Effective draggability (`el.draggable`), which a `dragstart` handler needs to fire.
   *
   * Optional because a surface captured by an older build has no such field, and reading
   * `undefined` as "not draggable" would invent findings on data this gate did not collect.
   */
  draggable?: boolean;
  /**
   * True when the browser turns this element's activation keypress into a `click`.
   *
   * The interaction probe presses keys and never calls `.click()`, so this is what decides
   * whether a `click` handler was exercised by it. Measured per element type; a
   * `div[role=button]` is false and a `<button>` is true, which is the difference between the
   * gate having tested a control and having only looked at it.
   */
  nativeActivation?: boolean;
  /**
   * Longest single run of this element's own `dragover` handler, in ms, when the probe drove one.
   *
   * Measured inside the listener wrapper rather than inferred from the interval between events.
   * The interval version was tried first and reported 68ms for a handler that returns immediately:
   * `dragover` keeps firing while the probe takes its 60-80ms hover screenshot, and that landed
   * inside the gap. Only covers listeners added with `addEventListener` — an `ondragover=`
   * property assignment is not wrapped, so it reads as unmeasured rather than as fast.
   */
  dragoverMs?: number;
}

export interface HandlerSurface {
  source: string;
  elements: HandlerSurfaceEntry[];
  /** window/document registrations: type -> count. */
  globals: Record<string, number>;
  totalRegistrations: number;
  /**
   * Visible interactive controls the page presents, handler or not.
   *
   * The denominator `registrations: 0 across 0 element(s)` was missing: a static
   * document and a page of dead buttons both printed zero, and both read `ok`.
   */
  visibleControls?: number;
  /** Present only when `probeDrag` was requested. Absent means "not measured". */
  dragProbe?: DragProbe[];
  /**
   * Present only when `probeDrag` was requested AND the page has a pointer-drag surface.
   * Absent means "not measured", never "measured and fine".
   */
  pointerDragProbe?: PointerDragProbe[];
  /**
   * Present only when `probeDrag` was requested AND the page declares a `dragstart` source.
   * Absent means "not measured", never "measured and fine".
   */
  realDragProbe?: RealDragProbe[];
  /**
   * Declared drop targets that nothing can drop on, because something else is on top.
   *
   * A hit test, not a gesture: three points inside the target (centre, 25%, 75%) are passed to
   * `elementFromPoint`, and the target is unreachable when none of them lands on it or inside it.
   * `elementFromPoint` honours `pointer-events`, so it answers the same question the browser
   * would when routing the drag.
   *
   * The first version derived this from the gesture — "the target saw no drag event" — and it
   * reported a **false positive** on the fixture's delegated list: the aim point lands on the
   * child `<li>`, and the event bubbles to the `<ul>`, so the list HAD received it. It also had
   * to guess the interceptor from whichever element took the most `dragover`s, which named an
   * element the drag merely crossed. The hit test needs neither guess.
   */
  unreachableTargets?: { path: string; interceptedBy: string }[];
  /** Present only when the `wheel` family was driven. Absent means "not measured". */
  wheelProbe?: WheelProbe[];
  /** Present only when the `hover` family was driven. Absent means "not measured". */
  hoverProbe?: HoverProbe[];
  /** Present only when the `menu` family was driven. Absent means "not measured". */
  menuProbe?: MenuProbe[];
  /** Present only when the `touch` family was driven. Absent means "not measured". */
  touchProbe?: TouchProbe[];
  /** Present only when the `input` family was driven. Absent means "not measured". */
  textInputProbe?: TextInputProbe[];
  /** Text fields beyond the cap that were not typed into. */
  textInputCapped?: number;
  /** Stylesheets the hover probe could not read (another origin), and triggers left unvisited. */
  hoverProbeLimits?: { unreadableSheets: number; capped: number };
  /**
   * Per element and type: a handler that CALLED `preventDefault()` and whether the call did
   * anything. Collected for every element the run touched, from the listener patch.
   */
  cancelAttempts?: { path: string; type: string; passive: boolean; effective: boolean }[];
  /**
   * What the interaction probe reached, when one ran at all.
   *
   * Absent on a `scan handlers` run, and that absence is load-bearing: it means no handler on
   * the page was exercised, which is the truth for an inventory. It used to be indistinguishable
   * from "everything in `PROBED_TYPES` was covered".
   */
  interactionProbe?: InteractionProbeEvidence;
}

/** Install BEFORE page scripts run (page.addInitScript). */
export const HANDLER_PATCH_SCRIPT = `
(() => {
  window.__vlmkitHandlers = [];
  const orig = EventTarget.prototype.addEventListener;
  EventTarget.prototype.addEventListener = function (type, fn, opts) {
    try {
      window.__vlmkitHandlers.push({ t: this, type: String(type), src: String(fn).slice(0, 80).replace(/\\s+/g, " ") });
    } catch {}
    return orig.call(this, type, fn, opts);
  };
})()
`;


/**
 * Count invocations of the page's OWN listeners, without changing how they behave.
 *
 * Answers one question the pixel probe cannot: did the element's handlers run at all? A
 * gesture that produced no visible change is ambiguous, but a gesture that invoked *nothing*
 * has one explanation — something is between the pointer and the listener. Measured on three
 * pads with identical registrations:
 *
 *   working pad                 pointerdown 1, pointermove 5, pointerup 1
 *   inert pad (handlers do nothing)   the same
 *   pad under a transparent sibling   {} -- never invoked
 *
 * **Install this BEFORE HANDLER_PATCH_SCRIPT.** Both patch `addEventListener`, and the last
 * one installed is the outermost, so the registration recorder has to see the page's real
 * function rather than this wrapper. Measured both orders: invocation-patch first gives
 * `samples` of "function pageHandler(e){ window.ran = true; }", the other order gives
 * "function () { const tag = this === window ? ..." -- the wrapper's own source, which would
 * silently corrupt every handler snippet in the report.
 *
 * ## Fidelity
 *
 * A wrapper is a different function object, so `removeEventListener(type, fn)` would stop
 * matching and every "add then remove" would leak a live listener — the tool would alter the
 * page it is measuring. A WeakMap from the page's listener to its wrapper, plus the same
 * lookup on `removeEventListener`, is what prevents that.
 *
 * Verified by running a fixture with and without this patch and diffing the page's own log:
 * byte-identical. It covers a listener removed by reference (never fires), `{ once: true }`
 * (fires exactly once across two clicks), an object listener with `handleEvent` (`this` is the
 * object), a function listener (`this` is the element), the same function registered in both
 * phases with only the capture one removed, and a throwing listener that must not stop the
 * listeners after it.
 *
 * Keyed by (listener, type) and not by the capture flag on purpose: the browser's identity is
 * (type, listener, capture), and reusing one wrapper for both phases is what lets
 * `removeEventListener(type, fn, true)` remove only the capture registration. Pinned.
 */
export const HANDLER_INVOCATION_PATCH_SCRIPT = `
(() => {
  const counts = new WeakMap();
  const wrappers = new WeakMap();
  // Longest single invocation per (element, type), in ms. Measured directly rather than inferred
  // from the interval between events: the interval also contains whatever the PROBE was doing,
  // and taking a mid-drag screenshot (60-80ms) made a dragover handler that returns immediately
  // look like it took 68ms. The fixture's fast zone caught that, which is what it is for.
  const slowest = new WeakMap();
  // Per (element, type): how the listener was registered, whether it CALLED preventDefault, and
  // whether that call ever had an effect. A passive listener's preventDefault is a silent no-op —
  // Chromium logs "Unable to preventDefault inside passive event listener invocation" and carries
  // on — so code written to cancel an event can fail to cancel it with nothing in the page to show
  // for it. Measured per element: a wheel listener registered {passive: true} that calls
  // preventDefault records attempted with effective false, while the same listener registered
  // {passive: false}, and one registered with no option at all, record effective true.
  const cancels = new WeakMap();
  // The listener currently running, so the preventDefault patch below can attribute the call
  // without mutating the event object. A stack, because a listener can dispatch an event.
  const running = [];
  const origPreventDefault = Event.prototype.preventDefault;
  Event.prototype.preventDefault = function () {
    const top = running[running.length - 1];
    if (top) top.attempted = true;
    return origPreventDefault.call(this);
  };
  const origAdd = EventTarget.prototype.addEventListener;
  const origRemove = EventTarget.prototype.removeEventListener;
  const bump = (target) => {
    counts.set(target, (counts.get(target) || 0) + 1);
  };
  const recordFor = (target, type, passive) => {
    let perType = cancels.get(target);
    if (!perType) { perType = {}; cancels.set(target, perType); }
    if (!perType[type]) perType[type] = { passive: passive, attempted: false, effective: false };
    return perType[type];
  };
  const wrapperFor = (type, listener, passive) => {
    let perType = wrappers.get(listener);
    if (!perType) { perType = new Map(); wrappers.set(listener, perType); }
    const existing = perType.get(type);
    if (existing) return existing;
    // Preserves this and arguments, and returns whatever the page returned.
    const invoke = typeof listener === "function"
      ? function () { return listener.apply(this, arguments); }
      : function () { return listener.handleEvent.apply(listener, arguments); };
    const wrapped = function (event) {
      bump(this);
      const rec = recordFor(this, type, passive);
      running.push(rec);
      const t0 = performance.now();
      try {
        return invoke.apply(this, arguments);
      } finally {
        running.pop();
        // Effective only if the call actually cancelled: a passive listener's does not.
        if (rec.attempted && event && event.defaultPrevented) rec.effective = true;
        // In a finally, so a listener that throws still reports the time it burned.
        const took = performance.now() - t0;
        let perType = slowest.get(this);
        if (!perType) { perType = {}; slowest.set(this, perType); }
        if (!(took <= perType[type])) perType[type] = took;
      }
    };
    perType.set(type, wrapped);
    return wrapped;
  };
  EventTarget.prototype.addEventListener = function (type, listener, opts) {
    if (!listener) return origAdd.call(this, type, listener, opts);
    try {
      const passive = !!(opts && typeof opts === "object" && opts.passive);
      return origAdd.call(this, type, wrapperFor(String(type), listener, passive), opts);
    } catch (e) {
      // A listener this cannot wrap (an exotic object) must still be registered as-is.
      return origAdd.call(this, type, listener, opts);
    }
  };
  EventTarget.prototype.removeEventListener = function (type, listener, opts) {
    if (!listener) return origRemove.call(this, type, listener, opts);
    const perType = wrappers.get(listener);
    const wrapped = perType && perType.get(String(type));
    return origRemove.call(this, type, wrapped || listener, opts);
  };
  window.__vlmkitCallCount = (el) => counts.get(el) || 0;
  window.__vlmkitResetCalls = (el) => { counts.delete(el); slowest.delete(el); };
  // Every element that has a recorded duration, with its slowest call per type. Collected from the
  // elements the caller asks about, since a WeakMap cannot be enumerated.
  window.__vlmkitCancelInfo = (el) => {
    const perType = cancels.get(el);
    if (!perType) return null;
    const out = [];
    for (const type of Object.keys(perType)) {
      const rec = perType[type];
      if (rec.attempted) out.push({ type: type, passive: rec.passive, effective: rec.effective });
    }
    return out.length > 0 ? out : null;
  };
  window.__vlmkitSlowestCall = (el, type) => {
    const perType = slowest.get(el);
    return perType && typeof perType[type] === "number" ? perType[type] : null;
  };
})()
`;

const COMMON_ON_PROPS = [
  "onclick", "ondblclick", "onmousedown", "onmouseup", "onpointerdown", "onpointerup",
  "onkeydown", "onkeyup", "onkeypress", "oninput", "onchange", "onsubmit",
  "onfocus", "onblur", "onmouseover", "onmouseenter", "ontouchstart",
  // The HTML5 drag-and-drop family. The `addEventListener` route already recorded these
  // — it is type-agnostic — but this DOM sweep did not, so `el.ondragover = fn` and
  // `<div ondrop="...">` were invisible. Measured on a fixture assigning `ondragover` as a
  // property: the element did not appear in the surface at all.
  //
  // These seven are the whole DOM vocabulary. There is no `dragmove` event: the
  // continuous ones are `drag`, fired on the source, and `dragover`, fired on the target.
  "ondragstart", "ondrag", "ondragenter", "ondragover", "ondragleave", "ondrop", "ondragend",
];

/**
 * `matches()` for the elements whose activation keypress the browser turns into a click.
 *
 * Measured, one element at a time, focusing and pressing the key its role activates with:
 * `button`, `a[href]`, `input[type=submit|button|reset]` on Enter and
 * `input[type=checkbox|radio]`, `summary` on Space/Enter all fire `click`. An `<a>` with no
 * `href`, `input[type=text]`, `<select>` (Space opens the dropdown) and `<textarea>` do not.
 */
const NATIVE_CLICK_ON_ACTIVATION =
  "button, a[href], input[type=submit], input[type=button], input[type=reset],"
  + " input[type=checkbox], input[type=radio], summary";

/**
 * `describe(el)` — the element → path derivation, as one definition for the three places
 * that need it: the surface collector, the drag probe, and the TypeScript-side lookup that
 * turns a reported path back into an element handle.
 *
 * It was copied into all three, and the copies drifted in the one way a copy of a browser
 * script drifts: **`\s` in a plain template literal loses its backslash.** `split(/\s+/)`
 * reached the browser as `split(/s+/)` in the probe's copy — splitting the class list on the
 * letter *s* — so any element (or ancestor) whose first class contains an `s` got a different
 * path from the collector's, the `row.path === e.path` join silently failed, and every
 * probe-derived finding disappeared. Measured on the drag fixture, whose classes happen to
 * contain no `s`: renaming one container class `row` → `rows` took the run from 1
 * `dragover-not-prevented` + 3 `dragstart-transfers-nothing` to **zero findings**, with no
 * behavioural change to the page at all. `sortable`, `list`, `cards`, `items` are ordinary
 * class names, so on real pages this was the normal case rather than the corner one.
 *
 * `String.raw` is what makes the escape survive interpolation, and is the idiom the rest of
 * the repo already uses for browser scripts (`OBSERVE_SCRIPT` in `src/util/markup-loop.ts`).
 */
const DESCRIBE_PATH_FN = String.raw`
  const describe = (el) => {
    const parts = [];
    let cur = el;
    while (cur && cur !== document.body && cur.tagName && parts.length < 4) {
      let p = cur.tagName.toLowerCase();
      if (cur.id) p += "#" + cur.id;
      else if (typeof cur.className === "string" && cur.className.trim()) p += "." + cur.className.trim().split(/\s+/)[0];
      parts.unshift(p);
      cur = cur.parentElement;
    }
    return parts.join(">");
  };
`;

/**
 * Serialize the recorded registrations + on*-scan into a per-element
 * surface. Runs AFTER DISCOVER_SCRIPT so data-vlmkit-ix stamps exist.
 */
/**
 * The browser-side half. Exported so a consumer with its own `Page` can
 * `evaluate` it and hand the result to `deriveHandlerIssues` — see
 * `@mizchi/vlmkit-markup/rules`. Pair it with `DISCOVER_SCRIPT` from
 * `interaction-map`, which stamps the interactive elements this cross-references.
 */
export const COLLECT_SURFACE_SCRIPT = `
(() => {
  const ON_PROPS = ${JSON.stringify(COMMON_ON_PROPS)};
  const perElement = new Map();
  const globals = {};
  let total = 0;
  ${DESCRIBE_PATH_FN}
  const record = (el, type, src) => {
    total++;
    if (el === window || el === document || el === document.documentElement || el === document.body) {
      const label = el === window ? "window" : el === document ? "document" : el.tagName.toLowerCase();
      const key = label + ":" + type;
      globals[key] = (globals[key] || 0) + 1;
      return;
    }
    if (!el || !el.tagName) return;
    let entry = perElement.get(el);
    if (!entry) {
      entry = { el, types: {}, samples: [] };
      perElement.set(el, entry);
    }
    entry.types[type] = (entry.types[type] || 0) + 1;
    if (src && entry.samples.length < 3) entry.samples.push(src);
  };
  for (const h of (window.__vlmkitHandlers || [])) record(h.t, h.type, h.src);
  for (const el of document.querySelectorAll("*")) {
    for (const name of el.getAttributeNames ? el.getAttributeNames() : []) {
      if (name.startsWith("on")) record(el, name.slice(2), (el.getAttribute(name) || "").slice(0, 80));
    }
    for (const prop of ON_PROPS) {
      if (typeof el[prop] === "function" && !el.hasAttribute(prop)) {
        record(el, prop.slice(2), String(el[prop]).slice(0, 80).replace(/\\s+/g, " "));
      }
    }
  }
  const handledEls = [...perElement.keys()];
  const out = [];
  for (const { el, types, samples } of perElement.values()) {
    const style = getComputedStyle(el);
    const rect = el.getBoundingClientRect();
    const ancestorTypes = {};
    for (const other of handledEls) {
      if (other !== el && other.contains && other.contains(el)) {
        for (const t of Object.keys(perElement.get(other).types)) ancestorTypes[t] = true;
      }
    }
    out.push({
      ancestorTypes: Object.keys(ancestorTypes),
      ix: el.hasAttribute("data-vlmkit-ix") ? Number(el.getAttribute("data-vlmkit-ix")) : null,
      path: describe(el),
      // Accessible name when there is no text, because an icon-only button has neither.
      //
      // Found against a real SVG editor: eight rows read "div>div>div>button" with an empty
      // label, one per toolbar icon, and nothing told them apart -- these elements carry no
      // id and no class, so describe() cannot disambiguate either. Their aria-labels say
      // "Zoom Out", "Zoom In", "Fit to Canvas". A finding is only actionable if the reader
      // can tell which element it is about, and both of this gate's identity signals were
      // blank at once.
      //
      // Order approximates what a screen reader announces: aria-label, then title, then an
      // image's alt, then a control's placeholder or value.
      text: (() => {
        const own = (el.textContent || "").replace(/\\s+/g, " ").trim();
        if (own) return own.slice(0, 40);
        const img = el.querySelector ? el.querySelector("img[alt]") : null;
        const named = [
          el.getAttribute && el.getAttribute("aria-label"),
          el.getAttribute && el.getAttribute("title"),
          img && img.getAttribute("alt"),
          el.getAttribute && el.getAttribute("placeholder"),
          el.getAttribute && el.getAttribute("value"),
        ].find((v) => v && String(v).trim());
        return named ? String(named).replace(/\\s+/g, " ").trim().slice(0, 40) : "";
      })(),
      types,
      samples,
      visible: style.display !== "none" && style.visibility !== "hidden" && rect.width > 0 && rect.height > 0,
      containsInteractive: !!el.querySelector("[data-vlmkit-ix]"),
      insideInteractive: !!(el.parentElement && el.parentElement.closest("[data-vlmkit-ix]")),
      // The DOM property, not the attribute: it reflects EFFECTIVE draggability, so an
      // anchor with href and an img -- draggable by default -- read true with no attribute,
      // and draggable="false" on them reads false. Deriving this from the attribute alone
      // would get both wrong.
      //
      // (No backticks in here: this comment lives inside COLLECT_SURFACE_SCRIPT's template
      // literal, and a backtick closes the string. That is what broke the build once.)
      draggable: el.draggable === true,
      // Whether an activation keypress becomes a click here. Measured list; a role-only
      // element is NOT in it, which is why the probe never fires its click handler.
      nativeActivation: el.matches(${JSON.stringify(NATIVE_CLICK_ON_ACTIVATION)}),
    });
  }
  // How many controls the page PRESENTS, whether or not any handler was found.
  //
  // Without this, a page of three inert buttons reported "registrations: 0 across
  // 0 element(s)" and "status: ok" — v7's agent-l: "zero listeners on a 3-button
  // page is the finding." The gate could not say it, because it only ever
  // inventoried elements that already had a handler; a page with no controls and a
  // page whose controls are all dead produced identical output.
  //
  // Native controls plus anything carrying an interactive ARIA role, which is the
  // same population "check interactions" discovers.
  const CONTROL_SELECTOR = 'button, a[href], input:not([type="hidden"]), select, textarea,'
    + ' summary, [role="button"], [role="link"], [role="menuitem"], [role="tab"],'
    + ' [role="checkbox"], [role="radio"], [role="switch"], [tabindex]:not([tabindex="-1"])';
  let controls = 0;
  for (const el of document.querySelectorAll(CONTROL_SELECTOR)) {
    const cs = getComputedStyle(el);
    if (cs.display === "none" || cs.visibility === "hidden") continue;
    const r = el.getBoundingClientRect();
    if (r.width < 1 || r.height < 1) continue;
    controls++;
  }
  return { elements: out, globals, total, controls };
})()
`;


/**
 * Per-element outcome of firing the drag sequence, when `probeDrag` is on.
 *
 * The two things this measures are the two that CANNOT be read off the DOM, and one of
 * them is the most common drag bug there is:
 *
 *   - **Did `dragover` call `preventDefault()`?** A `dragover` handler that forgets it is
 *     invisible to the static check — a handler *is* registered — and the drop is still
 *     rejected by the default action, so the wired `drop` never runs. `dispatchEvent`
 *     returns false when a listener cancelled the event, which is exactly this question.
 *   - **Did `dragstart` put anything in the `DataTransfer`?** A target reading
 *     `getData()` gets "" otherwise, and Firefox and Safari will not start a drag at all
 *     without data.
 *
 * Measured before building any of this: synthetic `DragEvent`s with a real `DataTransfer`
 * run the page's own handlers (`dragstart@ok`, `dragover@zone`, `drop@zone`,
 * `dragend@ok`), `dispatchEvent` returned false for a dragover that prevented and true
 * for one that forgot, and `dt.getData("text/plain")` came back as the value the page's
 * dragstart had set. All four signals are observable without a VLM.
 *
 * **What this note used to claim, and got wrong:** "a real OS-level drag — which CDP cannot
 * drive anyway". Chromium drives one fine; `probeRealDrags` does it with
 * `mouse.down`/`move`/`up` and gets the whole genuine sequence. Dispatching still earns its
 * place — it reaches a target no source on the page happens to pair with, and it answers the
 * `preventDefault` question directly through the return value — but it cannot see whether the
 * *browser* will start a drag at all, because dispatching a `dragstart` runs the handler
 * whatever the element's state. `drag-source-inert` is that blind spot, and it needed the real
 * gesture.
 */
export interface DragProbe {
  /** `path` of the surface entry this belongs to. */
  path: string;
  /** Handler types that actually ran when dispatched. */
  ran: string[];
  /**
   * True when NO listener cancelled the dragover — i.e. `preventDefault()` was not
   * called and the drop will be rejected. Undefined when the element has no dragover.
   */
  dragoverUnprevented?: boolean;
  /** `dataTransfer.types` after the element's dragstart ran. Undefined with no dragstart. */
  transferredTypes?: string[];
}

/**
 * Fire the drag sequence at each element that has drag handlers and report what happened.
 *
 * **This dispatches events, so it can run the page's own logic** — a drop handler that
 * POSTs will POST. `scan handlers` is an inventory and keeps it behind `--probe-drag`;
 * `check interactions` probes by default and turns it on with `--handlers`.
 *
 * A source is paired with each candidate target rather than probed alone, because the
 * questions are about the pair: the DataTransfer a source fills is the one a target reads.
 */
export const PROBE_DRAG_SCRIPT = `
(() => {
  const SOURCE_TYPES = ["dragstart"];
  const TARGET_TYPES = ["dragover", "drop"];
  const results = [];
  const paths = new Map();
  // Re-derive the same path strings the surface uses, so a probe row joins to its entry.
  // One definition, shared with the collector: a second copy is what broke the join.
  ${DESCRIBE_PATH_FN}
  const wanted = new Set([...SOURCE_TYPES, ...TARGET_TYPES]);
  const candidates = [];
  for (const el of document.querySelectorAll("*")) {
    const own = new Set();
    for (const name of (el.getAttributeNames ? el.getAttributeNames() : [])) {
      if (name.startsWith("ondrag") || name === "ondrop") own.add(name.slice(2));
    }
    for (const t of wanted) {
      if (typeof el["on" + t] === "function") own.add(t);
    }
    for (const h of (window.__vlmkitHandlers || [])) {
      if (h.t === el && wanted.has(h.type)) own.add(h.type);
    }
    if (own.size > 0) candidates.push({ el, own });
  }
  for (const { el, own } of candidates) {
    const dt = new DataTransfer();
    const ran = new Set();
    const hooks = [];
    for (const t of wanted) {
      const h = () => ran.add(t);
      document.addEventListener(t, h, true);
      hooks.push([t, h]);
    }
    const fire = (type, target) => target.dispatchEvent(
      new DragEvent(type, { bubbles: true, cancelable: true, dataTransfer: dt })
    );
    const row = { path: describe(el), ran: [] };
    try {
      if (own.has("dragstart")) {
        fire("dragstart", el);
        // dt.types, not getData on a guessed format: a page may transfer application/json
        // or a custom type, and asking for text/plain would call that "nothing
        // transferred". (No backticks in this comment -- it is inside a template literal.)
        row.transferredTypes = Array.from(dt.types || []);
      }
      if (own.has("dragover")) {
        // The return value IS the finding: false means a listener cancelled, which is what
        // a drop target must do.
        row.dragoverUnprevented = fire("dragover", el) === true;
      }
      if (own.has("drop")) fire("drop", el);
    } catch (e) {
      row.error = String(e).slice(0, 120);
    }
    for (const [t, h] of hooks) document.removeEventListener(t, h, true);
    row.ran = [...ran];
    results.push(row);
  }
  return results;
})()
`;


/**
 * What a real pointer-drag gesture did to a drag surface.
 *
 * `mouse.down` / `mouse.move` / `mouse.up` is the same input a user produces, so this measures
 * the real thing. (This note used to open with "unlike HTML5 drag, which CDP cannot drive" —
 * that was wrong, and `probeRealDrags` drives one the same way.)
 *
 * **Pixels, not the DOM.** Measured on four fixtures plus a real SVG editor:
 *
 *   case            during-move   after-release
 *   works              3.02%         3.02%
 *   feedback-only      3.02%         0.00%   (reverts on release)
 *   dead               0.00%         0.00%
 *   canvas drawing     1.24%         2.16%   <-- DOM never changes at all
 *
 * The canvas row is why this compares screenshots. A DOM comparison would call every
 * `<canvas>`-based editor dead, and the separation between 0.00% and 1.24% is wide.
 *
 * **Deliberately reported, not graded.** A 0% result is ambiguous: dead handlers, a gesture
 * that started somewhere ungrabbable, or feedback rendered outside the element's box all
 * look identical from here. Turning that into a finding would be reporting a state this has
 * not established — so the numbers go in the report and the reader decides.
 */
export interface PointerDragProbe {
  /** `path` of the surface entry this belongs to. */
  path: string;
  /** Fraction of the element's pixels that changed *while* the drag was held. */
  feedbackRatio: number;
  /** Fraction that differ between before the drag and after release. */
  committedRatio: number;
  /**
   * How many of the element's OWN listeners ran during the gesture.
   *
   * Zero with the gesture delivered is the one unambiguous outcome here: registered handlers
   * that nothing invoked means something is between the pointer and the listener. Undefined
   * when the counting patch was not installed.
   */
  handlerCalls?: number;
  /** Set when the gesture could not be performed (no box, offscreen, detached). */
  error?: string;
}


/**
 * Perform the gesture on each pointer-drag surface and measure the pixels either side.
 *
 * Started at 30% into the element and dragged toward 70% in stepped moves, so the gesture
 * resembles a real one: measured on a real editor, 4 steps produced 5 `pointermove` calls and
 * the rubber-band appeared. The stepping is not load-bearing for the fixtures in
 * `fixtures/handlers/pointer-drag.html` — breaking it back to a single jump leaves that test
 * green, checked — because each of them positions from `clientX` rather than integrating
 * deltas. It is kept because a drag that DOES integrate deltas is a shape real code takes,
 * and one jump would under-drive it.
 *
 * The element is screenshotted rather than the page: a drag surface is often the largest
 * thing on screen, and full-page pixels would drown a 3% change in a 100% denominator.
 */
/**
 * The element a surface path names, as a handle.
 *
 * Evaluated as a *string* rather than a function so it shares `DESCRIBE_PATH_FN` with the two
 * browser scripts — a hand-written TypeScript copy of the same walk is what let the probe and
 * the collector disagree about an element's path.
 */
async function handleForPath(page: Page, path: string): Promise<JSHandle> {
  return await page.evaluateHandle(`(() => {
    ${DESCRIBE_PATH_FN}
    const want = ${JSON.stringify(path)};
    for (const el of document.querySelectorAll("*")) if (describe(el) === want) return el;
    return null;
  })()`);
}

async function probePointerDrags(
  page: Page,
  elements: readonly HandlerSurfaceEntry[],
): Promise<PointerDragProbe[]> {
  const surfaces = elements.filter((e) => e.visible && isPointerDragSurface(Object.keys(e.types)));
  const out: PointerDragProbe[] = [];
  for (const entry of surfaces) {
    const row: PointerDragProbe = { path: entry.path, feedbackRatio: 0, committedRatio: 0 };
    try {
      // Located by re-deriving the surface's own path, so the probe cannot drag a different
      // element than the one it reports on.
      const el = (await handleForPath(page, entry.path)).asElement();
      if (!el) { row.error = "element not found for its own path"; out.push(row); continue; }
      const box = await el.boundingBox();
      if (!box || box.width < 4 || box.height < 4) {
        row.error = "no usable box"; out.push(row); continue;
      }
      const before = await el.screenshot();
      // Reset immediately before the gesture, so the count is this gesture's and not the
      // page's own start-up chatter.
      await page.evaluate((node) => (window as unknown as {
        __vlmkitResetCalls?: (n: Element) => void;
      }).__vlmkitResetCalls?.(node as Element), el);
      const at = (fx: number, fy: number) => [box.x + box.width * fx, box.y + box.height * fy] as const;
      await page.mouse.move(...at(0.3, 0.3));
      await page.mouse.down();
      await page.mouse.move(...at(0.5, 0.5), { steps: 4 });
      const during = await el.screenshot();
      await page.mouse.move(...at(0.7, 0.7), { steps: 4 });
      await page.mouse.up();
      // A frame for the release to render, matching what `settlePage` does elsewhere.
      await page.waitForTimeout(120);
      const after = await el.screenshot();
      row.feedbackRatio = pixelDelta(before, during);
      row.committedRatio = pixelDelta(before, after);
      const calls = await page.evaluate((node) => (window as unknown as {
        __vlmkitCallCount?: (n: Element) => number;
      }).__vlmkitCallCount?.(node as Element), el);
      if (typeof calls === "number") row.handlerCalls = calls;
    } catch (err) {
      row.error = err instanceof Error ? err.message.slice(0, 120) : String(err).slice(0, 120);
    }
    out.push(row);
  }
  return out;
}

/**
 * What a real HTML5 drag did — a gesture the browser turns into `dragstart`/`drop`, not a
 * `dispatchEvent` of a `DragEvent` this code constructed.
 *
 * **Chromium drives a real drag, and the note here previously said it could not.** Measured
 * with `mouse.down` / `mouse.move` / `mouse.up` on the drag fixture, which logs every drag
 * event through a capture listener on `document`:
 *
 *     dragstart@native-source, drag@native-source, dragenter@zone, dragover@zone,
 *     drop@zone, dragend@native-source
 *
 * That matters because the synthetic probe (`PROBE_DRAG_SCRIPT`) cannot see whether the
 * *browser* will start a drag at all — dispatching a `dragstart` runs the handler whatever the
 * element's state, so it reports a source that no user can pick up as working. Three cases,
 * all measured on scratch fixtures, all reported as fine by the synthetic probe:
 *
 *     source                                 real gesture      static read
 *     draggable="true"                       dragstart, drop   fine
 *     dragstart handler, draggable false      nothing          `drag-source-not-draggable`
 *     draggable="true" + -webkit-user-drag:none  nothing       **fine** — invisible
 *     draggable="true" under a transparent veil  nothing       **fine** — invisible
 *
 * **The selection has to be cleared before every gesture**, and this was measured rather than
 * assumed. Selected text is itself draggable, so a leftover selection from a previous gesture
 * starts a *text* drag: the same two gestures in the same order gave `[]` on the first run and
 * `dragstart@s-notdraggable` on the second, and one run dropped the string `"\ntarget ok"` into
 * a page's own drop handler. Without the reset the probe is order-dependent and feeds the page
 * junk it would never receive from a user.
 */
export interface RealDragProbe {
  /** `path` of the surface entry this belongs to — a source with a `dragstart` handler. */
  path: string;
  /** True when the gesture made the browser start a drag whose source was this element. */
  dragstartFired: boolean;
  /** Target paths the gesture was aimed at, in order. Empty when the page declares none. */
  targetsTried: string[];
  /** Where a `drop` actually landed, if any. Absent means no target accepted the drag. */
  droppedOn?: string;
  /** Drag sources other than this element that the gesture started, if any. */
  startedOn?: string[];
  /**
   * Drag event types the recorder actually saw during this source's gestures.
   *
   * Observed, not inferred. `unprobed-handler-types` reads this to stop calling a type
   * uncovered, and the first version of that inferred the list — "a drop landed, so
   * `dragleave` must have fired too" — which is not sound: a gesture that enters a target and
   * drops there need never leave it. The recorder has the answer, so it reports the answer.
   */
  observedTypes?: string[];
  /**
   * How many gestures this source received.
   *
   * Zero means the budget ran out first, and a zero-gesture row must not be graded — reporting
   * "started no drag" for a drag never performed is the same false claim as a clean bill of
   * health for something unmeasured, pointed the other way. The first version of this loop did
   * exactly that: `#not-draggable` spent the whole budget retrying every target, and the two
   * perfectly good sources behind it in document order were both reported inert.
   */
  gestures: number;
  /** True when the gesture budget ran out before every target had been tried. */
  capped?: boolean;
  /**
   * Fraction of each aimed-at target's own pixels that changed while the drag was held over it.
   *
   * The visible half of the drop contract: whether the zone tells the user it will accept. Two
   * screenshots of the target with the mouse still down, taken only once the drag has started —
   * measured at ~60-80ms each, and it separates a zone that highlights on `dragenter` (99% of its
   * box) from one that does not (0.00%, byte-identical frames).
   *
   * Reported, not graded, and the one case worth grading is already covered: a zone that
   * highlights and then refuses the drop is `dragover-not-prevented`, whose message says so when
   * this measured a highlight. 0% on its own has the usual several explanations — feedback drawn
   * outside the zone's box, a placeholder inserted in a sibling list, a deliberate no-op.
   */
  hoverFeedback?: { target: string; ratio: number }[];
  /**
   * What pressing Escape mid-drag did.
   *
   * `cancelled` is the browser's own verdict — `dragend` carrying `dropEffect: "none"` with no
   * `drop` — and `ratio` is how much of the source's own pre-drag box differs afterwards. A
   * cancelled drag should leave nothing behind: measured, a source that restores itself on
   * `dragend` reads 0.00% and one that does not reads 99.03%, having hidden itself on `dragstart`
   * and stayed hidden.
   */
  cancel?: { started: boolean; cancelled: boolean; ratio?: number };
  /**
   * Every drag event this source's gestures produced, in order, with repeats coalesced.
   *
   * The debugging record: the aggregate fields say a drop did or did not land, and this says
   * which elements the drag crossed on the way and what each of them did with the event.
   */
  timeline?: DragTimelineStep[];
  /** Set when the gesture could not be performed (no box, offscreen, detached). */
  error?: string;
}

/**
 * One step of a real drag, in the order the browser produced it.
 *
 * This is the "what happened in between" that the aggregate fields cannot carry: which elements
 * the drag actually crossed, in sequence, and what each of them did with the event. A measured
 * route from the fixture, coalescing repeats:
 *
 *     dragstart@div#ok -> dragenter@div#ok -> dragover@div#ok -> drag@div#ok x3
 *     -> dragenter@div#user-drag-none -> dragleave@div#ok -> dragover@div#user-drag-none
 *     -> dragenter@div#zone -> dragover@div#zone x2 (prevented) -> drop@div#zone -> dragend@div#ok
 */
export interface DragTimelineStep {
  type: string;
  /** The element the event targeted, as the same path the surface uses. */
  path: string;
  /** Consecutive identical (type, path) events collapsed into this step. `drag` fires per pixel. */
  count: number;
  /**
   * `dragover`/`drop` only: did a listener cancel it, read AFTER the page's handlers ran?
   *
   * The decisive fact for a drop, and measured on the real gesture rather than inferred from a
   * synthetic `dispatchEvent`: `#zone` (which calls `preventDefault`) reports true and a `drop`
   * follows; `#zone-forgot-prevent` reports false and **no drop event is produced at all**.
   *
   * `null` means a handler called `stopPropagation()`, so the event never reached the
   * document-level listener that reads this. Not false — unknown.
   */
  prevented?: boolean | null;
  /*
   * There is deliberately no per-step timing here. Deriving a handler's cost from the interval
   * between consecutive events was tried and is not sound in this probe: `dragover` keeps firing
   * while the probe takes its 60-80ms hover screenshot, so a handler that returns immediately
   * measured 68ms. Handler duration is timed inside the listener instead — see
   * `HandlerSurfaceEntry.dragoverMs`.
   */
  /**
   * `drop` only: what the target actually received.
   *
   * Readable exactly once. Under the drag-and-drop protected mode `getData()` returns `""`
   * during `dragstart`/`dragover`/`dragenter` — measured — and the real payload during `drop`.
   * So this is the one place the source's promise and the target's reading can be compared.
   */
  received?: { type: string; value: string }[];
}

/**
 * Records every drag event on `document`, in both phases.
 *
 * **Capture** runs before the page's own listeners, so a handler that calls `stopPropagation()`
 * cannot hide its own event from the log. **Bubble** runs after them, which is the only place
 * `defaultPrevented` means "the page decided", and its absence is itself the signal that
 * propagation was stopped.
 *
 * `dropEffect` is deliberately not recorded: measured on a target that accepts the drop and one
 * that refuses it, it read `copy` in both, so reporting it would add a column that discriminates
 * nothing.
 *
 * Installed once and reset per gesture.
 */
const DRAG_RECORDER_SCRIPT = String.raw`
(() => {
  ${DESCRIBE_PATH_FN}
  const w = window;
  w.__vlmkitDragLog = [];
  if (!w.__vlmkitDragRecorder) {
    w.__vlmkitDragRecorder = true;
    // All seven, so the list of types a gesture exercised is observed rather than inferred.
    // There is no dragmove event: drag is the continuous one on the source.
    // (No backticks anywhere in this script. It is a String.raw template, where a backtick
    // ends the literal and an escaped one leaves the backslash behind in the emitted code.)
    for (const t of ["dragstart", "drag", "dragenter", "dragover", "dragleave", "drop", "dragend"]) {
      document.addEventListener(t, (e) => {
        // drag and dragover fire continuously -- tens of times per gesture -- and every entry
        // crosses the CDP boundary. 400 is far more than any assertion here needs.
        if (w.__vlmkitDragLog.length >= 400) return;
        const el = e.target;
        // describe() walks up to body and stops, so body itself derives to the empty string --
        // and a drag crossing the page background targets exactly that. Name it.
        const path = !el || !el.tagName
          ? "(non-element)"
          : el === document.body ? "body" : el === document.documentElement ? "html" : (describe(el) || "body");
        const row = { type: t, path: path };
        // dropEffect, on dragend ONLY. It is the browser's verdict on the whole drag -- "none"
        // means nothing accepted it, which is what Escape produces -- and it is the one place the
        // value discriminates: on dragover it read "copy" both for a zone that accepts the drop
        // and for one that refuses it, so it is not recorded there.
        if (t === "dragend" && e.dataTransfer) {
          try { row.dropEffect = String(e.dataTransfer.dropEffect); } catch (err) { row.dropEffect = "(unreadable)"; }
        }
        if (t === "drop" && e.dataTransfer) {
          // Only readable here. Truncated because a target may carry a whole serialized model.
          row.received = [];
          try {
            for (const type of Array.from(e.dataTransfer.types).slice(0, 4)) {
              row.received.push({ type: type, value: String(e.dataTransfer.getData(type)).slice(0, 80) });
            }
          } catch (err) {
            row.received.push({ type: "(unreadable)", value: String(err && err.name) });
          }
        }
        w.__vlmkitDragLog.push(row);
      }, true);
    }
    // Bubble phase, dragover/drop only: the page's handlers have run by now, so
    // defaultPrevented is the page's answer rather than the initial state. Matched back to the
    // capture entry by identity of (type, path) from the end -- the same event, one phase later.
    for (const t of ["dragover", "drop"]) {
      document.addEventListener(t, (e) => {
        const el = e.target;
        const path = !el || !el.tagName
          ? "(non-element)"
          : el === document.body ? "body" : el === document.documentElement ? "html" : (describe(el) || "body");
        for (let i = w.__vlmkitDragLog.length - 1; i >= 0; i--) {
          const row = w.__vlmkitDragLog[i];
          if (row.type !== t || row.path !== path) continue;
          if (row.prevented === undefined) row.prevented = e.defaultPrevented;
          return;
        }
      }, false);
    }
  }
  return true;
})()
`;

/**
 * Which declared drop targets a pointer can actually land on.
 *
 * Three points per target rather than one: a badge or tooltip overlapping the middle does not
 * make a zone undroppable, and a target is only reported when none of centre, 25% and 75% lands
 * on it or on one of its descendants. A descendant counts because the event bubbles — that
 * distinction is the whole reason this is a hit test and not a replay of the gesture log.
 *
 * Dispatches nothing, so it runs on a plain `scan handlers` too: the finding it feeds is about
 * the page's geometry, and there is no reason to hide it behind a probe flag.
 */
const TARGET_REACH_SCRIPT = String.raw`
(() => {
  ${DESCRIBE_PATH_FN}
  const out = [];
  for (const el of document.querySelectorAll("*")) {
    const own = new Set();
    for (const name of (el.getAttributeNames ? el.getAttributeNames() : [])) {
      if (name === "ondragover" || name === "ondrop" || name === "ondragenter") own.add(name.slice(2));
    }
    for (const t of ["dragover", "drop", "dragenter"]) {
      if (typeof el["on" + t] === "function") own.add(t);
    }
    for (const h of (window.__vlmkitHandlers || [])) {
      if (h.t === el && (h.type === "dragover" || h.type === "drop" || h.type === "dragenter")) own.add(h.type);
    }
    if (own.size === 0) continue;
    const r = el.getBoundingClientRect();
    if (r.width < 4 || r.height < 4) continue;
    const style = getComputedStyle(el);
    if (style.display === "none" || style.visibility === "hidden") continue;
    let hitBy = null;
    let reached = false;
    for (const pt of [[0.5, 0.5], [0.25, 0.25], [0.75, 0.75]]) {
      const hit = document.elementFromPoint(r.left + r.width * pt[0], r.top + r.height * pt[1]);
      if (!hit) continue;
      if (hit === el || el.contains(hit)) { reached = true; break; }
      if (!hitBy) hitBy = describe(hit) || (hit === document.body ? "body" : hit.tagName.toLowerCase());
    }
    if (!reached && hitBy) out.push({ path: describe(el), interceptedBy: hitBy });
  }
  return out;
})()
`;

/**
 * A total budget, because the work is a source x target product and each gesture is a
 * round-trip of real input.
 *
 * A source that cannot start a drag costs exactly 2 gestures; one that can costs 1 plus the
 * targets that refuse it, plus up to `EXTRA_TARGET_VISITS` more. Measured at roughly 0.2s each
 * on the fixtures, two screenshots included, so 24 is about five seconds in the worst case —
 * and 16 was reached by the six-source, six-target fixture once the extra visits were added,
 * which is exactly the case that should not be truncated. The first version had no
 * short-circuits at all and a budget of 12, which `#not-draggable` alone consumed by retrying
 * every target.
 */
const MAX_REAL_DRAG_GESTURES = 24;

/**
 * How many more targets a source visits after one has already accepted its drop.
 *
 * Not zero, because the facts this probe collects are about the TARGETS — is it reachable, does
 * it advertise itself, does it accept — and stopping at the first success left every zone after
 * it unmeasured. Not unbounded, because each gesture runs the page's own drop handler for real:
 * on an app that moves a card into a column, ten gestures move ten cards.
 *
 * Three is what the fixtures need (the widest has four zones after the working one) and it keeps
 * a page with a dozen drop zones inside the total budget. Whatever is left unvisited is reported
 * as `capped` rather than passed over in silence.
 */
const EXTRA_TARGET_VISITS = 3;

/**
 * How many sources get the Escape gesture.
 *
 * Its own counter rather than a share of the total, so a page with many drag sources cannot spend
 * the whole budget on cancels and leave the drop questions unanswered — or the reverse. Four is
 * enough to cover a fixture and any page where the sources are variations of one component, which
 * is what a sortable list is; a page whose tenth source reverts differently from its first is not
 * a shape worth another four gestures.
 */
const MAX_CANCEL_GESTURES = 4;

/**
 * Drag each source onto the page's declared targets and report what the browser did.
 *
 * Two short-circuits, and both are about spending gestures where they answer something:
 *
 *   - **A source that starts no drag is not retried against other targets.** Whether the
 *     browser picks the element up has nothing to do with where the gesture is heading, so the
 *     second target would re-measure the same fact. It gets one retry from a different point
 *     instead (25%/25% after the centre): a card whose only draggable part is a handle, or one
 *     with a `draggable="false"` child under the centre, would otherwise read as inert.
 *   - **A source that lands a drop stops there.** "Can this be dropped anywhere" is the
 *     question; a second success adds nothing.
 *
 * A page with no declared drop target still gets one gesture, to a point 60px away, because
 * `dragstartFired` is worth measuring on its own.
 */
async function probeRealDrags(
  page: Page,
  elements: readonly HandlerSurfaceEntry[],
): Promise<RealDragProbe[]> {
  const sources = elements.filter((e) => e.visible && e.types.dragstart);
  if (sources.length === 0) return [];
  const targets = elements.filter((e) => e.visible && (e.types.dragover || e.types.drop));
  await page.evaluate(DRAG_RECORDER_SCRIPT);
  const out: RealDragProbe[] = [];
  let budget = MAX_REAL_DRAG_GESTURES;
  let cancelBudget = MAX_CANCEL_GESTURES;

  type LogRow = {
    type: string;
    path: string;
    prevented?: boolean;
    dropEffect?: string;
    received?: { type: string; value: string }[];
  };
  /**
   * One gesture, and — when a target element is given — what its pixels did while hovered.
   *
   * The two screenshots are taken only after the drag has actually started, which is checked by
   * reading the log mid-gesture rather than assumed. That keeps the cost off every source the
   * browser refuses to pick up: those get one cheap `evaluate` instead of two screenshots, and
   * they have no hover feedback to measure anyway. Taking `before` at that point rather than
   * pre-press is also the more honest baseline — the drag is in progress and the pointer has not
   * reached the target yet, so the difference is the hover and nothing else.
   */
  const gesture = async (
    from: { x: number; y: number },
    to: { x: number; y: number },
    target?: ElementHandle<Element> | null,
    cancel = false,
  ) => {
    // Selected text is draggable, so a leftover selection starts a text drag instead of this
    // one — measured, and it made the same two gestures disagree between runs.
    await page.evaluate("(() => { window.__vlmkitDragLog = []; const s = window.getSelection && window.getSelection(); if (s) s.removeAllRanges(); return true; })()");
    await page.mouse.move(from.x, from.y);
    await page.mouse.down();
    // A short move first: the browser needs a threshold crossed before it promotes the
    // press to a drag. Measured — 2 steps here then 5 to the target landed the drop.
    await page.mouse.move(from.x + 8, from.y + 6, { steps: 2 });
    let before: Buffer | null = null;
    if (target) {
      const started = await page.evaluate(
        "(window.__vlmkitDragLog || []).some((r) => r.type === 'dragstart')",
      ) as boolean;
      if (started) before = await target.screenshot().catch(() => null);
    }
    await page.mouse.move(to.x, to.y, { steps: 5 });
    // Mid-drag, with the mouse still down. Measured as workable: ~60-80ms per shot, and it
    // separates a zone that highlights on dragenter (99% of its own box changed) from one that
    // does not (0.00%, byte-identical).
    const during = before ? await target!.screenshot().catch(() => null) : null;
    // Escape before the release, which is the order a user produces and the order measured to
    // cancel: `dragend` arrives with `dropEffect: "none"` and no `drop` fires.
    if (cancel) await page.keyboard.press("Escape");
    await page.mouse.up();
    // Read once, and a missing `dragend` can be believed. A re-read after 120ms sat here as a guard
    // against reading too early, and the measurement says that cannot happen: the evaluate is
    // queued behind the page's own main-thread work, so anything able to delay `dragend` delays the
    // read with it. Driven against a `dragover` handler that busy-waits 300ms, `dragend` was
    // already in the log on the first read and the second changed nothing. Removing the guard also
    // left every test green, which is how it came up for checking.
    const log = await page.evaluate("window.__vlmkitDragLog") as LogRow[];
    return { log, hoverRatio: before && during ? pixelDelta(before, during) : undefined };
  };

  for (const src of sources) {
    const row: RealDragProbe = { path: src.path, dragstartFired: false, targetsTried: [], gestures: 0 };
    try {
      const handle = (await handleForPath(page, src.path)).asElement();
      if (!handle) { row.error = "element not found for its own path"; out.push(row); continue; }
      const box = await handle.boundingBox();
      if (!box || box.width < 4 || box.height < 4) { row.error = "no usable box"; out.push(row); continue; }
      const startedOn = new Set<string>();
      const timeline: DragTimelineStep[] = [];
      const centre = { x: box.x + box.width / 2, y: box.y + box.height / 2 };
      const offCentre = { x: box.x + box.width * 0.25, y: box.y + box.height * 0.25 };
      const aimAt = async (target: HandlerSurfaceEntry) => {
        const handle = (await handleForPath(page, target.path)).asElement();
        const tb = await handle?.boundingBox();
        return tb ? { at: { x: tb.x + tb.width / 2, y: tb.y + tb.height / 2 }, handle } : null;
      };
      // With no declared target, move off the element so the gesture is still a drag.
      const elsewhere = { x: centre.x + 60, y: centre.y + 60 };

      const run = async (
        from: { x: number; y: number },
        to: { x: number; y: number },
        aimed?: { path: string; handle: ElementHandle<Element> | null },
      ) => {
        budget--;
        row.gestures++;
        const { log, hoverRatio } = await gesture(from, to, aimed?.handle);
        if (aimed && hoverRatio !== undefined) hoverFeedback.push({ target: aimed.path, ratio: hoverRatio });
        for (const r of log) {
          // Coalesce consecutive repeats: `drag` fires per mouse move and `dragover` per frame
          // over the same element, and a hundred identical lines is not a timeline anyone reads.
          const last = timeline[timeline.length - 1];
          if (last && last.type === r.type && last.path === r.path && !r.received) last.count++;
          else {
            timeline.push({
              type: r.type,
              path: r.path,
              count: 1,
              // A dragover/drop with no bubble-phase entry was stopped mid-flight by a
              // handler's `stopPropagation()`. Unknown, not "not prevented".
              ...(r.type === "dragover" || r.type === "drop" ? { prevented: r.prevented ?? null } : {}),
              ...(r.received ? { received: r.received } : {}),
            });
          }
          if (r.type !== "dragstart") continue;
          if (r.path === src.path) row.dragstartFired = true;
          else startedOn.add(r.path);
        }
        return log;
      };

      const hoverFeedback: { target: string; ratio: number }[] = [];

      const first = targets.length > 0 ? await aimAt(targets[0]!) : null;
      const firstAim = first?.at ?? elsewhere;
      const firstAimed = first && targets[0] ? { path: targets[0].path, handle: first.handle } : undefined;
      if (budget <= 0) { row.capped = true; out.push(row); continue; }
      let log = await run(centre, firstAim, firstAimed);
      if (targets.length > 0) row.targetsTried.push(targets[0]!.path);
      if (!row.dragstartFired && budget > 0) log = await run(offCentre, firstAim, firstAimed);

      if (row.dragstartFired) {
        const dropped = log.find((r) => r.type === "drop");
        if (dropped) row.droppedOn = dropped.path;
        // Only now is trying other targets informative: the source does pick up, and the
        // question becomes whether anything on the page accepts it.
        //
        // The loop used to stop at the first drop, and that hid the target-side facts for every
        // zone after it: whether a real drag reaches it, whether it advertises itself, whether it
        // would accept. Those are the questions this probe answers, and a lucky first success
        // made the rest unanswerable. So a source that has already dropped keeps going for a few
        // more targets — bounded, because each gesture runs the page's own drop logic.
        let extra = row.droppedOn ? EXTRA_TARGET_VISITS : Infinity;
        for (const t of targets.slice(1)) {
          if (extra <= 0) { row.capped = true; break; }
          if (budget <= 0) { row.capped = true; break; }
          extra--;
          const aim = await aimAt(t);
          if (!aim) continue;
          row.targetsTried.push(t.path);
          const again = await run(centre, aim.at, { path: t.path, handle: aim.handle });
          const drop = again.find((r) => r.type === "drop");
          // The FIRST target that accepted it is the answer to "can this be dropped"; a later
          // one does not overwrite it, so the reported target stays the one a user would hit.
          if (drop && !row.droppedOn) row.droppedOn = drop.path;
        }
      }
      // ---- The cancel: Escape mid-flight, and does the page put things back ----------------
      //
      // Only for a source the browser will actually pick up, and only while the cancel budget
      // lasts. Measured on a fixture whose source hides itself on `dragstart` (the optimistic
      // "it left the list" every sortable does): the one that restores on `dragend` leaves its
      // own box byte-identical, and the one that forgets leaves 99.03% of it changed. Both report
      // `dragend` with `dropEffect: "none"`, which is the browser saying the drag was cancelled —
      // so the two signals are independent, and the finding needs both.
      //
      // The region is clipped from a PAGE screenshot rather than taken from the element: the
      // element is `visibility: hidden` in exactly the failing case, and `elementHandle
      // .screenshot()` waits for it to become visible and then times out after 30s. Measured.
      if (row.dragstartFired && cancelBudget > 0 && budget > 0) {
        cancelBudget--;
        budget--;
        row.gestures++;
        const clip = {
          x: Math.max(0, Math.floor(box.x)),
          y: Math.max(0, Math.floor(box.y)),
          width: Math.max(1, Math.ceil(box.width)),
          height: Math.max(1, Math.ceil(box.height)),
        };
        const before = await page.screenshot({ clip }).catch(() => null);
        const { log: cancelLog } = await gesture(centre, firstAim, null, true);
        await page.waitForTimeout(150);
        const after = before ? await page.screenshot({ clip }).catch(() => null) : null;
        const end = cancelLog.find((r) => r.type === "dragend");
        row.cancel = {
          // Whether this gesture managed to start a drag at all. A source that removed itself
          // during the earlier gestures is no longer there to pick up, and "Escape did not cancel
          // it" would be the wrong story for that.
          started: cancelLog.some((r) => r.type === "dragstart"),
          cancelled: end?.dropEffect === "none" && !cancelLog.some((r) => r.type === "drop"),
          ...(before && after ? { ratio: pixelDelta(before, after) } : {}),
        };
      }
      if (startedOn.size > 0) row.startedOn = [...startedOn];
      if (hoverFeedback.length > 0) row.hoverFeedback = hoverFeedback;
      if (timeline.length > 0) {
        row.timeline = timeline;
        // Derived from the timeline rather than accumulated beside it: one record of what the
        // recorder saw, so the coverage claim and the printed route cannot disagree.
        row.observedTypes = [...new Set(timeline.map((step) => step.type))].sort();
      }
    } catch (err) {
      row.error = err instanceof Error ? err.message.slice(0, 120) : String(err).slice(0, 120);
    }
    out.push(row);
  }
  return out;
}

/**
 * What a real touch did to an element wired for touch.
 *
 * Driven in a page of its own, with touch emulation on, and that separation is measured rather
 * than stylistic: turning it on takes `navigator.maxTouchPoints` from 0 to 1 and makes
 * `"ontouchstart" in window` true, which is exactly what a page branches on to decide it is on a
 * phone. Every other family would then be measuring a different page.
 *
 * Two things are read per element:
 *
 *   - a **tap**, and how many of the element's own listeners it invoked. Zero with the tap landing
 *     on its box is the same unambiguous outcome `pointer-drag-intercepted` grades: something is on
 *     top. Measured — a pad under a transparent sibling logged nothing while its neighbour logged
 *     its handler.
 *   - a **swipe**, for elements with `touchmove`, and how much of the element changed. Reported,
 *     not graded, for the same reason the pointer-drag numbers are: 0% has several explanations.
 */
export interface TouchProbe {
  path: string;
  text: string;
  /** Invocations of the element's own listeners during the tap. */
  tapCalls: number;
  /** Fraction of the element's pixels that changed during a swipe, when it handles `touchmove`. */
  swipeRatio?: number;
  error?: string;
}

/**
 * Tap, and swipe, in a touch-enabled page.
 *
 * The page is loaded a second time. That is the cost of not lying about the environment, and it is
 * paid only when `--probe touch` is asked for.
 */
async function probeTouches(
  browser: Browser,
  options: HandlerSurfaceOptions,
  elements: readonly HandlerSurfaceEntry[],
): Promise<TouchProbe[]> {
  const targets = elements.filter((e) =>
    e.visible && (e.types["touchstart"] || e.types["touchend"] || e.types["touchmove"]));
  if (targets.length === 0) return [];
  const page = await browser.newPage(withAuthState({
    viewport: { width: 1280, height: 800 },
    hasTouch: true,
  }, options.storageState));
  const out: TouchProbe[] = [];
  try {
    await page.addInitScript(HANDLER_INVOCATION_PATCH_SCRIPT);
    await page.addInitScript(HANDLER_PATCH_SCRIPT);
    const url = /^(https?|file):\/\//.test(options.source)
      ? options.source
      : pathToFileURL(resolve(options.source)).href;
    await applyHar(page, options.har);
    await page.goto(url, navigationOptions(options, "load"));
    await settlePage(page);
    await page.evaluate(DISCOVER_SCRIPT);
    const cdp = await page.context().newCDPSession(page);
    const touchPoint = (x: number, y: number) => [{ x, y, radiusX: 4, radiusY: 4, force: 1, id: 1 }];
    for (const entry of targets) {
      const row: TouchProbe = { path: entry.path, text: entry.text, tapCalls: 0 };
      try {
        const el = (await handleForPath(page, entry.path)).asElement();
        if (!el) { row.error = "element not found for its own path"; out.push(row); continue; }
        const box = await el.boundingBox();
        if (!box || box.width < 4 || box.height < 4) { row.error = "no usable box"; out.push(row); continue; }
        await page.evaluate((node) => (window as unknown as {
          __vlmkitResetCalls?: (n: Element) => void;
        }).__vlmkitResetCalls?.(node as Element), el);
        await page.touchscreen.tap(box.x + box.width / 2, box.y + box.height / 2);
        await page.waitForTimeout(80);
        const calls = await page.evaluate((node) => (window as unknown as {
          __vlmkitCallCount?: (n: Element) => number;
        }).__vlmkitCallCount?.(node as Element), el);
        if (typeof calls === "number") row.tapCalls = calls;

        if (entry.types["touchmove"]) {
          // Playwright's touchscreen only taps, so the swipe goes through CDP directly.
          const before = await el.screenshot().catch(() => null);
          await cdp.send("Input.dispatchTouchEvent", {
            type: "touchStart",
            touchPoints: touchPoint(box.x + box.width * 0.25, box.y + box.height * 0.25),
          });
          for (let i = 1; i <= 5; i++) {
            await cdp.send("Input.dispatchTouchEvent", {
              type: "touchMove",
              touchPoints: touchPoint(
                box.x + box.width * (0.25 + 0.1 * i),
                box.y + box.height * (0.25 + 0.08 * i),
              ),
            });
          }
          await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
          await page.waitForTimeout(120);
          const after = before ? await el.screenshot().catch(() => null) : null;
          if (before && after) row.swipeRatio = pixelDelta(before, after);
        }
      } catch (err) {
        row.error = err instanceof Error ? err.message.slice(0, 120) : String(err).slice(0, 120);
      }
      out.push(row);
    }
  } finally {
    await page.close().catch(() => {});
  }
  return out;
}

/**
 * What a text field did with text typed into it — plain, and through an IME composition.
 *
 * Three drives per field, and the comparison between them is the whole design:
 *
 *     field                     ASCII in / out        CJK in / out     verdict
 *     no handler                vlmkit7  vlmkit7      日本語  日本語
 *     strips non-ASCII on input vlmkit7  vlmkit7      日本語  ""       rejects non-ASCII
 *     digits only (by design)   vlmkit7  "7"          日本語  ""       -- excluded
 *     maxlength=4               vlmkit7  "vlmk"       日本語  日本語     -- excluded
 *
 * **The ASCII drive is the control, and it is what makes the finding attributable.** A field that
 * mangles the ASCII sample too is filtering by its own rules — a phone number field, a numeric
 * amount — and losing the CJK text there says nothing about non-ASCII. Only a field that keeps the
 * ASCII and drops the CJK is reported.
 *
 * **The composition is driven, and its result is evidence rather than a finding.** Three hypotheses
 * about IME-specific defects were measured and none survived: a field that destroys the committed
 * text destroys it identically without a composition (so it is not IME-specific); the confirming
 * Enter cannot be judged, because a CDP composition does not consume it the way a real IME does and
 * the native form submission fires either way; and a handler that rewrites `value` on every `input`
 * — the shape most likely to corrupt composing text — produced the same result composed or not,
 * across identity, trim, slice and space-stripping rewrites. So the composition is driven for
 * coverage and its committed value is printed, and nothing is graded from it.
 */
export interface TextInputProbe {
  path: string;
  text: string;
  /** What came back after typing an ASCII sample. */
  plainAscii: string;
  /** What came back after typing a CJK sample with no composition. */
  plainCjk: string;
  /** What came back after composing kana and committing kanji. */
  composed: string;
  /** Event types the field actually saw across the three drives. */
  observedTypes: string[];
  error?: string;
}

const TEXT_PROBE_ASCII = "vlmkit7";
const TEXT_PROBE_CJK = "日本語";
const TEXT_PROBE_KANA = "にほんご";

/** Records what a field receives, so coverage is observed rather than assumed. */
const INPUT_RECORDER_SCRIPT = String.raw`
(() => {
  const w = window;
  w.__vlmkitInputLog = [];
  if (!w.__vlmkitInputRecorder) {
    w.__vlmkitInputRecorder = true;
    for (const t of ["input", "change", "keydown", "keyup", "keypress", "focus", "blur",
                     "compositionstart", "compositionupdate", "compositionend"]) {
      document.addEventListener(t, (e) => {
        if (w.__vlmkitInputLog.length >= 400) return;
        w.__vlmkitInputLog.push(t);
      }, true);
    }
  }
  return true;
})()
`;

/**
 * Type into every text field, three ways.
 *
 * `Input.insertText` rather than `keyboard.type`: it is what commits a composition, so the plain and
 * composed drives differ in exactly one thing — whether a composition was open first. Capped at 8
 * fields, and the cap is reported.
 */
async function probeTextInputs(page: Page): Promise<{ rows: TextInputProbe[]; capped: number }> {
  const candidates = await page.evaluate(TEXT_FIELD_SCRIPT) as { path: string; text: string }[];
  const targets = candidates.slice(0, MAX_TEXT_FIELDS);
  if (targets.length === 0) return { rows: [], capped: 0 };
  await page.evaluate(INPUT_RECORDER_SCRIPT);
  const cdp = await page.context().newCDPSession(page);
  const rows: TextInputProbe[] = [];
  for (const entry of targets) {
    const row: TextInputProbe = {
      path: entry.path,
      // The field's own label-ish text (placeholder / name / id): a field with no handler has no
      // surface entry to borrow one from, and the finding has to name something a reader can find.
      text: entry.text,
      plainAscii: "",
      plainCjk: "",
      composed: "",
      observedTypes: [],
    };
    try {
      const el = (await handleForPath(page, entry.path)).asElement();
      if (!el) { row.error = "element not found for its own path"; rows.push(row); continue; }
      const seen = new Set<string>();
      const drive = async (text: string, compose: boolean) => {
        // Cleared through the DOM, which fires the page's own input handler the same way a user
        // selecting-all and deleting would.
        await el.evaluate((node: Element) => {
          const field = node as unknown as { value?: string; textContent: string | null; dispatchEvent: (e: Event) => boolean };
          if (typeof field.value === "string") field.value = "";
          else field.textContent = "";
          field.dispatchEvent(new Event("input", { bubbles: true }));
        });
        await page.evaluate("(() => { window.__vlmkitInputLog = []; return true; })()");
        // Focus, and CHECK it. A field inside a closed `<details>`, an `inert` subtree or a
        // `hidden` ancestor passes the size and display filter and then takes no text at all —
        // measured on a real page, where a textarea inside a closed <details> reported
        // `"vlmkit7" became ""` for a drive that never happened. The ASCII control kept that from
        // becoming a false positive, and it would have made a genuine non-ASCII defect in the same
        // place unreportable. A drive that could not start measures nothing and says so.
        const focused = await el.evaluate((node: Element) => {
          (node as HTMLElement).focus();
          return document.activeElement === node;
        });
        if (!focused) throw new Error("could not focus the field (hidden, inert, or inside a closed <details>)");
        if (compose) {
          await cdp.send("Input.imeSetComposition", {
            text: TEXT_PROBE_KANA,
            selectionStart: TEXT_PROBE_KANA.length,
            selectionEnd: TEXT_PROBE_KANA.length,
          });
        }
        await cdp.send("Input.insertText", { text });
        // Blur, because `change` fires there and not on every keystroke.
        await el.evaluate((node: Element) => (node as HTMLElement).blur());
        await page.waitForTimeout(40);
        for (const t of await page.evaluate("window.__vlmkitInputLog") as string[]) seen.add(t);
        return await el.evaluate((node: Element) => {
          const field = node as unknown as { value?: string; textContent: string | null };
          return typeof field.value === "string" ? field.value : String(field.textContent ?? "");
        });
      };
      row.plainAscii = await drive(TEXT_PROBE_ASCII, false);
      row.plainCjk = await drive(TEXT_PROBE_CJK, false);
      row.composed = await drive(TEXT_PROBE_CJK, true);
      row.observedTypes = [...seen].sort();
    } catch (err) {
      row.error = err instanceof Error ? err.message.slice(0, 120) : String(err).slice(0, 120);
    }
    rows.push(row);
  }
  return { rows, capped: Math.max(0, candidates.length - targets.length) };
}

/**
 * What a real right-click on a `contextmenu` handler did.
 *
 * Three outcomes, all measured on the fixture, and two of them are defects:
 *
 *     element          handler ran   cancelled   revealed
 *     #ctxOk               yes         yes       #menu        the contract
 *     #ctxNoPrevent        yes         NO        -            the browser's own menu still opens
 *     #ctxNothing          yes         yes       -            the native menu is gone, nothing replaces it
 *
 * `cancelled` is read after the page's handlers have run, the same bubble-phase trick the drag
 * probe uses for `dragover`: before them it is always false and says nothing about the page.
 */
export interface MenuProbe {
  path: string;
  text: string;
  /** How many of the element's own listeners ran. Zero means the right-click never reached it. */
  handlerCalls: number;
  /** Did a listener cancel the event, read after the page's handlers ran? */
  prevented: boolean;
  /** Elements that became visible, as `path|text` labels. */
  revealed: string[];
  error?: string;
}

/** Records `contextmenu` in the bubble phase, where `defaultPrevented` is the page's answer. */
const MENU_RECORDER_SCRIPT = String.raw`
(() => {
  const w = window;
  w.__vlmkitMenuLog = [];
  if (!w.__vlmkitMenuRecorder) {
    w.__vlmkitMenuRecorder = true;
    document.addEventListener("contextmenu", (e) => {
      w.__vlmkitMenuLog.push({ prevented: e.defaultPrevented });
    }, false);
  }
  return true;
})()
`;

async function probeMenus(
  page: Page,
  elements: readonly HandlerSurfaceEntry[],
): Promise<MenuProbe[]> {
  const targets = elements.filter((e) => e.visible && e.types["contextmenu"]);
  if (targets.length === 0) return [];
  await page.evaluate(MENU_RECORDER_SCRIPT);
  const out: MenuProbe[] = [];
  const snapshot = async () => new Set(await page.evaluate(VISIBLE_SNAPSHOT_SCRIPT) as string[]);
  for (const entry of targets) {
    const row: MenuProbe = { path: entry.path, text: entry.text, handlerCalls: 0, prevented: false, revealed: [] };
    try {
      const el = (await handleForPath(page, entry.path)).asElement();
      if (!el) { row.error = "element not found for its own path"; out.push(row); continue; }
      const box = await el.boundingBox();
      if (!box || box.width < 4 || box.height < 4) { row.error = "no usable box"; out.push(row); continue; }
      // Escape first: a menu left open by the previous target would still be visible and would
      // read as this one's reveal.
      await page.keyboard.press("Escape");
      await page.mouse.move(0, 0);
      await page.waitForTimeout(60);
      const base = await snapshot();
      await page.evaluate("(() => { window.__vlmkitMenuLog = []; return true; })()");
      await page.evaluate((node) => (window as unknown as {
        __vlmkitResetCalls?: (n: Element) => void;
      }).__vlmkitResetCalls?.(node as Element), el);
      await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2, { button: "right" });
      await page.waitForTimeout(100);
      row.revealed = [...await snapshot()].filter((label) => !base.has(label));
      const log = await page.evaluate("window.__vlmkitMenuLog") as { prevented: boolean }[];
      row.prevented = log.some((r) => r.prevented);
      const calls = await page.evaluate((node) => (window as unknown as {
        __vlmkitCallCount?: (n: Element) => number;
      }).__vlmkitCallCount?.(node as Element), el);
      if (typeof calls === "number") row.handlerCalls = calls;
    } catch (err) {
      row.error = err instanceof Error ? err.message.slice(0, 120) : String(err).slice(0, 120);
    }
    out.push(row);
  }
  return out;
}

/**
 * What hovering an element revealed, and whether focusing it revealed the same thing.
 *
 * WCAG 1.4.13 and 2.1.1: content that appears on hover has to appear on keyboard focus too, or the
 * keyboard user never sees it. Measured as a diff of what is VISIBLE on the page, not of the
 * element's own pixels — the thing that appears is a tooltip or a menu positioned outside the
 * trigger's box, so an element-local screenshot would see nothing.
 *
 * Four shapes, all separated on the fixture:
 *
 *     trigger                       hover reveals   focus reveals
 *     CSS :hover only               #t1             -              <- defect
 *     CSS :hover, :focus            #t2             #t2
 *     JS mouseenter only            #t3             -              <- defect
 *     JS mouseenter + focus         #t4             #t4
 *     handler that reveals nothing  -               -              <- nothing to say
 *
 * **The CSS-only trigger is the common form and has no JS handler at all**, so the target list
 * cannot come from the handler surface alone: it also takes every element matched by a selector
 * containing `:hover`, read from the stylesheets.
 */
export interface HoverProbe {
  path: string;
  /** The trigger's own visible text, for the finding. Its own, because a CSS-only trigger has no
   * entry in the handler surface to borrow one from. */
  text: string;
  /** Elements that became visible while hovering, as `path|text` labels. */
  revealedOnHover: string[];
  /** The same, while focused. */
  revealedOnFocus: string[];
  /** False when `focus()` did not move the active element — the trigger cannot be focused at all. */
  focusable: boolean;
  error?: string;
}

/**
 * Everything visible right now, as a set of labels.
 *
 * Cheap and stable: a label is the element's id-or-tag plus the first 20 characters of its text, so
 * a tooltip that appears reads as a new entry and a re-layout of existing content does not.
 */
const VISIBLE_SNAPSHOT_SCRIPT = String.raw`
(() => {
  const out = [];
  for (const el of document.querySelectorAll("*")) {
    const r = el.getBoundingClientRect();
    if (r.width < 1 || r.height < 1) continue;
    const s = getComputedStyle(el);
    if (s.display === "none" || s.visibility === "hidden" || Number(s.opacity) === 0) continue;
    out.push((el.id ? "#" + el.id : el.tagName.toLowerCase()) + "|" + (el.textContent || "").trim().slice(0, 20));
    if (out.length >= 800) break;
  }
  return out;
})()
`;

/**
 * Elements a stylesheet styles on `:hover`.
 *
 * The CSS-only trigger has no listener to find, so the selectors are where it has to come from.
 * A sheet from another origin throws on `.cssRules`, and that is disclosed rather than swallowed —
 * the same treatment `check integrity` gives an unreadable stylesheet.
 */
const HOVER_SELECTOR_SCRIPT = String.raw`
(() => {
  ${DESCRIBE_PATH_FN}
  const paths = [];
  let unreadable = 0;
  const visit = (rules) => {
    for (const rule of rules) {
      // selectorText FIRST, and recursion in addition rather than instead. Since CSS Nesting
      // shipped, a plain CSSStyleRule also has a cssRules property -- an empty list, which is
      // truthy -- so "if (rule.cssRules) recurse and continue" walked into every style rule's empty
      // child list and never looked at a selector. Found by the fixture reporting only its JS
      // triggers while the sheet plainly contained two :hover rules.
      if (rule.cssRules && rule.cssRules.length) visit(rule.cssRules);
      const sel = rule.selectorText;
      if (!sel || sel.indexOf(":hover") === -1) continue;
      for (const part of sel.split(",")) {
        // The element that has to be hovered is the one carrying :hover, so drop whatever the
        // selector says about its siblings or descendants after that point.
        const cut = part.indexOf(":hover");
        const trigger = part.slice(0, cut).trim();
        if (!trigger) continue;
        try {
          for (const el of document.querySelectorAll(trigger)) {
            const r = el.getBoundingClientRect();
            if (r.width < 1 || r.height < 1) continue;
            const p = describe(el);
            if (p && paths.indexOf(p) === -1) paths.push(p);
          }
        } catch (e) { /* a selector querySelectorAll cannot parse, e.g. one with ::part */ }
      }
    }
  };
  for (const sheet of document.styleSheets) {
    try { visit(sheet.cssRules); } catch (e) { unreadable++; }
  }
  return { paths: paths, unreadable: unreadable };
})()
`;

/**
 * Hover each trigger, then focus it, and diff what became visible either way.
 *
 * Capped at 12 triggers: each one costs two hovers and four snapshots, and a page that styles
 * fifty things on hover is styling them, not revealing fifty menus. Whatever is left over is
 * reported as capped rather than passed over.
 */
const MAX_HOVER_TARGETS = 12;

/**
 * Every visible field that holds text, found in the page rather than in the handler surface.
 *
 * The surface only contains elements that have a handler, and a field's filter is not always on the
 * field: `maxlength` and `pattern` are attributes, and a form-level submit handler is somewhere else
 * entirely. Taking targets from the surface left three of the fixture's six fields unprobed —
 * including the two controls a reader needs in order to interpret the finding — which is the same
 * gap the CSS-only hover trigger exposed.
 *
 * The type list excludes the inputs that hold no text: a checkbox takes no `insertText` and would
 * report three empty values.
 */
const TEXT_FIELD_SCRIPT = String.raw`
(() => {
  ${DESCRIBE_PATH_FN}
  const NO_TEXT = ["checkbox", "radio", "button", "submit", "reset", "file", "color", "range",
                   "image", "hidden"];
  const out = [];
  for (const el of document.querySelectorAll("input, textarea, [contenteditable=true]")) {
    if (el.tagName === "INPUT" && NO_TEXT.indexOf(String(el.type).toLowerCase()) !== -1) continue;
    if (el.disabled || el.readOnly) continue;
    const r = el.getBoundingClientRect();
    if (r.width < 4 || r.height < 4) continue;
    const s = getComputedStyle(el);
    if (s.display === "none" || s.visibility === "hidden") continue;
    const p = describe(el);
    if (p) out.push({ path: p, text: (el.placeholder || el.name || el.id || "").slice(0, 40) });
  }
  return out;
})()
`;
const MAX_TEXT_FIELDS = 8;

async function probeHovers(
  page: Page,
  elements: readonly HandlerSurfaceEntry[],
): Promise<{ rows: HoverProbe[]; unreadableSheets: number; capped: number }> {
  const fromHandlers = elements
    .filter((e) => e.visible && (e.types["mouseenter"] || e.types["mouseover"]))
    .map((e) => e.path);
  const css = await page.evaluate(HOVER_SELECTOR_SCRIPT) as { paths: string[]; unreadable: number };
  const all = [...new Set([...fromHandlers, ...css.paths])];
  const targets = all.slice(0, MAX_HOVER_TARGETS);
  const rows: HoverProbe[] = [];
  const snapshot = async () => new Set(await page.evaluate(VISIBLE_SNAPSHOT_SCRIPT) as string[]);
  for (const path of targets) {
    const row: HoverProbe = { path, text: "", revealedOnHover: [], revealedOnFocus: [], focusable: false };
    try {
      const el = (await handleForPath(page, path)).asElement();
      if (!el) { row.error = "element not found for its own path"; rows.push(row); continue; }
      const box = await el.boundingBox();
      if (!box || box.width < 1 || box.height < 1) { row.error = "no usable box"; rows.push(row); continue; }
      row.text = (await el.evaluate((node: Element) => (node.textContent ?? "").trim().slice(0, 40))) ?? "";
      // Neither hovered nor focused. The mouse goes to the corner rather than merely elsewhere,
      // because "elsewhere" can be another trigger.
      await page.mouse.move(0, 0);
      await page.evaluate("(() => { const a = document.activeElement; if (a && a.blur) a.blur(); return true; })()");
      await page.waitForTimeout(60);
      const base = await snapshot();
      await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
      await page.waitForTimeout(80);
      row.revealedOnHover = [...await snapshot()].filter((label) => !base.has(label));
      await page.mouse.move(0, 0);
      await page.waitForTimeout(60);
      row.focusable = await el.evaluate((node: Element) => {
        (node as HTMLElement).focus?.();
        return document.activeElement === node || node.contains(document.activeElement);
      });
      await page.waitForTimeout(80);
      row.revealedOnFocus = [...await snapshot()].filter((label) => !base.has(label));
      await page.evaluate("(() => { const a = document.activeElement; if (a && a.blur) a.blur(); return true; })()");
    } catch (err) {
      row.error = err instanceof Error ? err.message.slice(0, 120) : String(err).slice(0, 120);
    }
    rows.push(row);
  }
  return { rows, unreadableSheets: css.unreadable, capped: Math.max(0, all.length - targets.length) };
}

/**
 * What a real wheel over a `wheel`-handler element did.
 *
 * `mouse.wheel` is the same input a user's trackpad produces, and it separates cleanly. Measured on
 * two panels that both scroll, one of which cancels the wheel:
 *
 *     panel                          scrollTop after a 200px wheel
 *     no wheel handler                 0 -> 200
 *     handler calling preventDefault    0 -> 0
 *
 * Reported, not graded. A page that consumes the wheel deliberately — a map that zooms, a carousel
 * that steps, a chart that pans — is doing the right thing, and this cannot tell it from a panel
 * that swallowed the gesture by accident. What it does settle is that the `wheel` handlers ran,
 * so they stop being listed as unexercised, and it is what makes the passive record below possible.
 */
export interface WheelProbe {
  path: string;
  /** How far the element (or its scrolling ancestor) moved. */
  scrolledPx: number;
  /** True when the element or an ancestor could have scrolled at all. */
  scrollable: boolean;
  /** Set when the gesture could not be performed. */
  error?: string;
}

/**
 * Roll the wheel over each element that handles it.
 *
 * The scroll is read from the element and from its nearest scrollable ancestor, plus the window:
 * a wheel over a panel that cannot scroll itself normally scrolls the page, and "nothing moved
 * anywhere" is the interesting answer.
 */
async function probeWheels(page: Page, elements: readonly HandlerSurfaceEntry[]): Promise<WheelProbe[]> {
  // `scroll` handlers count as targets too: rolling the wheel over a scrollable panel is how a
  // `scroll` handler runs, and without them nothing on the page exercises that type. It is also
  // what surfaces a `preventDefault()` on `scroll`, which is not cancelable at all.
  const targets = elements.filter((e) =>
    e.visible && (e.types["wheel"] || e.types["mousewheel"] || e.types["scroll"]));
  const out: WheelProbe[] = [];
  for (const entry of targets) {
    const row: WheelProbe = { path: entry.path, scrolledPx: 0, scrollable: false };
    try {
      const el = (await handleForPath(page, entry.path)).asElement();
      if (!el) { row.error = "element not found for its own path"; out.push(row); continue; }
      const box = await el.boundingBox();
      if (!box || box.width < 4 || box.height < 4) { row.error = "no usable box"; out.push(row); continue; }
      const read = async () => await el.evaluate((node: Element) => {
        // Starts at the element itself and walks up ONCE. Adding node.scrollTop separately and
        // then walking from the node double-counted it, and a 200px wheel reported 400px.
        let cur: Element | null = node;
        let scrollable = false;
        let sum = 0;
        while (cur) {
          if (cur.scrollHeight > cur.clientHeight + 1) scrollable = true;
          sum += cur.scrollTop;
          cur = cur.parentElement;
        }
        const root = document.scrollingElement;
        if (root && root.scrollHeight > root.clientHeight + 1) scrollable = true;
        return { sum: sum + window.scrollY, scrollable };
      });
      const before = await read();
      row.scrollable = before.scrollable;
      await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
      await page.mouse.wheel(0, 200);
      // A frame for the scroll to land, the same wait the pointer-drag probe uses.
      await page.waitForTimeout(120);
      const after = await read();
      row.scrolledPx = Math.abs(after.sum - before.sum);
    } catch (err) {
      row.error = err instanceof Error ? err.message.slice(0, 120) : String(err).slice(0, 120);
    }
    out.push(row);
  }
  return out;
}

/**
 * Fraction of pixels that differ, on a per-channel sum with a small floor.
 *
 * A floor of 12 across the three channels rather than exact equality: anti-aliased text and
 * subpixel rendering shift by a unit or two between otherwise identical frames, and counting
 * those would put a nonzero "feedback" on a drag that produced none. Differently-sized
 * frames mean the element resized, which is itself a change — reported as 1.
 */
function pixelDelta(a: Buffer, b: Buffer): number {
  const A = PNG.sync.read(a);
  const B = PNG.sync.read(b);
  if (A.width !== B.width || A.height !== B.height) return 1;
  let changed = 0;
  for (let i = 0; i < A.data.length; i += 4) {
    const d = Math.abs(A.data[i]! - B.data[i]!)
      + Math.abs(A.data[i + 1]! - B.data[i + 1]!)
      + Math.abs(A.data[i + 2]! - B.data[i + 2]!);
    if (d > 12) changed++;
  }
  return A.width * A.height === 0 ? 0 : changed / (A.width * A.height);
}

/**
 * The interaction families this gate can drive, each opt-in.
 *
 * Separate flags rather than one switch, because they differ in what they do to the page. `drag`
 * and `wheel` fire the page's own handlers; `input` puts text into fields. A page whose drop
 * handler POSTs will POST, so the default stays an inventory that presses nothing.
 */
export const PROBE_FAMILIES = ["drag", "wheel", "hover", "menu", "touch", "input"] as const;
export type ProbeFamily = typeof PROBE_FAMILIES[number];

export interface HandlerSurfaceOptions extends PageLoadOptions {
  source: string;
  storageState?: string;
  /**
   * Fire the drag sequence and record what ran. Off by default because dispatching runs
   * the page's own handlers — see `PROBE_DRAG_SCRIPT`.
   *
   * Equivalent to `probes: ["drag"]`, kept because it is the documented flag.
   */
  probeDrag?: boolean;
  /** Families to drive. Merged with `probeDrag`. */
  probes?: readonly ProbeFamily[];
}

export async function buildHandlerSurface(options: HandlerSurfaceOptions): Promise<HandlerSurface> {
  const probes = new Set<ProbeFamily>(options.probes ?? []);
  if (options.probeDrag) probes.add("drag");
  // The listener patch serves every family — invocation counts, handler duration, and the
  // preventDefault-versus-passive record — so it goes on whenever anything will be driven.
  const anyProbe = probes.size > 0;
  return await withBrowser(async (browser) => {
    const page = await browser.newPage(withAuthState({ viewport: { width: 1280, height: 800 } }, options.storageState));
    // Order matters and was measured: the invocation patch goes first so the registration
    // recorder below still sees the page's real listener rather than a wrapper. See
    // HANDLER_INVOCATION_PATCH_SCRIPT. Only for probe runs — the inventory has no use for it
    // and every patch is a chance to alter the page.
    if (anyProbe) await page.addInitScript(HANDLER_INVOCATION_PATCH_SCRIPT);
    await page.addInitScript(HANDLER_PATCH_SCRIPT);
    const url = /^(https?|file):\/\//.test(options.source)
      ? options.source
      : pathToFileURL(resolve(options.source)).href;
    await applyHar(page, options.har);
    // `load` remains the default here (not networkidle): the settle below waits
    // for network idle with a bound, so this gate already survives a page that
    // never reaches it. `--wait-until` can still lower it.
    await page.goto(url, navigationOptions(options, "load"));
    // Client-rendered pages register their handlers after `load` — without
    // this the scan inventories the pre-render DOM (see settlePage).
    await settlePage(page);
    await page.evaluate(DISCOVER_SCRIPT); // stamp interactive elements for cross-referencing
    const raw = await page.evaluate(COLLECT_SURFACE_SCRIPT) as {
      elements: HandlerSurfaceEntry[];
      globals: Record<string, number>;
      total: number;
      controls: number;
    };
    // A hit test over the declared drop targets. No events, no flag: it asks where a pointer
    // would land, which is a fact about the page as inventoried.
    const unreachableTargets = await page.evaluate(TARGET_REACH_SCRIPT) as
      { path: string; interceptedBy: string }[];
    // Real mouse input first among the probes, on the least-perturbed page: it is the one
    // that answers whether the BROWSER starts a drag here, and a synthetic dispatch that has
    // already run the page's drop handlers can have moved the source out from under it.
    const realDragProbe = probes.has("drag")
      ? await probeRealDrags(page, raw.elements)
      : undefined;
    // After the surface, so a probe that mutates the page cannot change what was
    // inventoried. Dispatching runs the page's own handlers, and a drop handler is exactly
    // the kind that rewrites the DOM.
    const dragProbe = probes.has("drag")
      ? await page.evaluate(PROBE_DRAG_SCRIPT) as DragProbe[]
      : undefined;
    // Real mouse input, so this needs the Page rather than an evaluate. Only for the
    // elements already classified as pointer-drag surfaces — one on the editor this came
    // from, so the screenshot cost is bounded by how many drag surfaces a page has.
    const pointerDragProbe = probes.has("drag")
      ? await probePointerDrags(page, raw.elements)
      : undefined;
    const wheelProbe = probes.has("wheel") ? await probeWheels(page, raw.elements) : undefined;
    const hover = probes.has("hover") ? await probeHovers(page, raw.elements) : undefined;
    const menuProbe = probes.has("menu") ? await probeMenus(page, raw.elements) : undefined;
    const textInput = probes.has("input") ? await probeTextInputs(page) : undefined;
    // A separate page, because touch emulation changes what the page sees: `navigator
    // .maxTouchPoints` goes 0 -> 1 and `"ontouchstart" in window` false -> true, both of which real
    // apps branch on. Measured, and the reason this does not just add `hasTouch` to the page every
    // other family uses.
    const touchProbe = probes.has("touch")
      ? await probeTouches(browser, options, raw.elements)
      : undefined;
    // Every element whose handler called preventDefault during this run, with whether the call had
    // an effect. Asked per element because a WeakMap cannot be enumerated; only for elements that
    // have handlers at all, which is every entry in the surface.
    const cancelAttempts: { path: string; type: string; passive: boolean; effective: boolean }[] = [];
    if (anyProbe) {
      for (const entry of raw.elements) {
        const info = await page.evaluate(`(() => {
          ${DESCRIBE_PATH_FN}
          const want = ${JSON.stringify(entry.path)};
          for (const el of document.querySelectorAll("*")) {
            if (describe(el) !== want) continue;
            return window.__vlmkitCancelInfo ? window.__vlmkitCancelInfo(el) : null;
          }
          return null;
        })()`) as { type: string; passive: boolean; effective: boolean }[] | null;
        for (const rec of info ?? []) cancelAttempts.push({ path: entry.path, ...rec });
      }
    }
    // The slowest single invocation of each drag-target element's own dragover handler, read from
    // the invocation patch after the gestures have run. Asked per element because a WeakMap cannot
    // be enumerated, and only for the elements that have such a handler.
    if (probes.has("drag")) {
      for (const entry of raw.elements) {
        if (!entry.types["dragover"]) continue;
        const took = await page.evaluate(`(() => {
          ${DESCRIBE_PATH_FN}
          const want = ${JSON.stringify(entry.path)};
          for (const el of document.querySelectorAll("*")) {
            if (describe(el) !== want) continue;
            return window.__vlmkitSlowestCall ? window.__vlmkitSlowestCall(el, "dragover") : null;
          }
          return null;
        })()`) as number | null;
        if (typeof took === "number") entry.dragoverMs = took;
      }
    }
    return {
      source: options.source,
      elements: raw.elements,
      globals: raw.globals,
      totalRegistrations: raw.total,
      visibleControls: raw.controls,
      ...(dragProbe ? { dragProbe } : {}),
      ...(pointerDragProbe && pointerDragProbe.length > 0 ? { pointerDragProbe } : {}),
      ...(realDragProbe && realDragProbe.length > 0 ? { realDragProbe } : {}),
      ...(unreachableTargets.length > 0 ? { unreachableTargets } : {}),
      ...(wheelProbe && wheelProbe.length > 0 ? { wheelProbe } : {}),
      ...(hover && hover.rows.length > 0 ? { hoverProbe: hover.rows } : {}),
      ...(menuProbe && menuProbe.length > 0 ? { menuProbe } : {}),
      ...(textInput && textInput.rows.length > 0 ? { textInputProbe: textInput.rows } : {}),
      ...(textInput && textInput.capped > 0 ? { textInputCapped: textInput.capped } : {}),
      ...(touchProbe && touchProbe.length > 0 ? { touchProbe } : {}),
      ...(hover && (hover.unreadableSheets > 0 || hover.capped > 0)
        ? { hoverProbeLimits: { unreadableSheets: hover.unreadableSheets, capped: hover.capped } }
        : {}),
      ...(cancelAttempts.length > 0 ? { cancelAttempts } : {}),
    };
  });
}

// ---------------------------------------------------------------------------
// Cross-check issues

const POINTER_TYPES = new Set(["click", "dblclick", "mousedown", "mouseup", "pointerdown", "pointerup", "touchstart"]);
const KEYBOARD_TYPES = new Set(["keydown", "keyup", "keypress"]);

/**
 * HTML5 drag-and-drop, kept out of `POINTER_TYPES` deliberately.
 *
 * A drag-only element IS mouse-only, but the remedy is not the one
 * `pointer-only-control` prescribes: adding `tabindex` and a key handler does not make a
 * drag operable, because there is no keyboard drag. It needs a separate non-drag path
 * (move-up/move-down buttons, a "move to" menu), so it gets its own finding with its own
 * advice rather than being folded in.
 *
 * `dragmove` is not in this list because it is not a DOM event. The continuous ones are
 * `drag`, fired on the source, and `dragover`, fired on the target.
 */
const DRAG_SOURCE_TYPES = new Set(["dragstart", "drag", "dragend"]);
const DRAG_TARGET_TYPES = new Set(["dragenter", "dragover", "dragleave", "drop"]);
const DRAG_TYPES = new Set([...DRAG_SOURCE_TYPES, ...DRAG_TARGET_TYPES]);

/**
 * The *other* drag: a gesture built from pointer/mouse/touch events rather than the HTML5
 * DnD API. Canvas editors, sortable lists, sliders, maps and split panes all work this way,
 * and none of them registers a single `dragstart`.
 *
 * Found by running this gate against a real SVG editor
 * (https://moonlight.mizchi.workers.dev, mirrored locally). Its canvas registers
 * `pointerdown`, `pointermove`, `pointerup`, and the gate reported:
 *
 *   suspect [pointer-only-control] ... has a pointerdown/pointerup handler but no role, no
 *   keyboard handler ... Give it a role + tabindex + key handling, or move the handler onto
 *   a real control.
 *
 * The finding is right and **the advice is wrong**: `tabindex` and a key handler do not make
 * a drawing canvas draggable, any more than they start an HTML5 drag. It is the same
 * situation `drag-without-keyboard-alternative` was written for, and that rule could not see
 * it because it only looked for `dragstart`.
 *
 * **`down` AND `move` on the same element** is the signature, deliberately conservative:
 *
 *   - `move` is what separates a drag from a click. A `pointerdown`-only element is a
 *     button written the hard way, which `pointer-only-control` describes correctly.
 *   - `move`-only is hover tracking, not a drag.
 *   - The common alternative — `pointerdown` on the element, `pointermove`/`pointerup` on
 *     `window` — is NOT matched, and that is a known miss. Pairing an element's `down` with
 *     a global `move` would call every `pointerdown` on a page with a cursor-follow effect a
 *     drag, and a wrong "this is a drag" claim misroutes the fix in the other direction.
 *   - `setPointerCapture` in the handler source would be the unambiguous marker, but the
 *     surface caps samples at 80 characters and real apps ship minified, so it is not
 *     reliably visible. Checked on the editor above: not in the captured snippets.
 */
const POINTER_DRAG_DOWN = new Set(["pointerdown", "mousedown", "touchstart"]);
const POINTER_DRAG_MOVE = new Set(["pointermove", "mousemove", "touchmove"]);

/** Does this element's handler set describe a pointer-driven drag gesture? */
export function isPointerDragSurface(types: readonly string[]): boolean {
  return types.some((t) => POINTER_DRAG_DOWN.has(t)) && types.some((t) => POINTER_DRAG_MOVE.has(t));
}

/** Event types the interaction probes actually fire. */
/**
 * Types the interaction probe CAN exercise — its ceiling, not its coverage.
 *
 * This set used to be the coverage claim itself: any registered type in here was left out of
 * `unprobed-handler-types`, on every run of both gates. Two measurements say that was false in
 * both directions.
 *
 * **`scan handlers` probes nothing at all.** It is an inventory; no probe in it presses, focuses
 * or clicks anything. On a page whose six handlers were all in this set the gate printed
 * `status: ok` and disclosed nothing:
 *
 *     registrations: 6 across 1 element(s), on a page presenting 1 control(s)
 *       - div#a "A": click, keydown, focus, keyup, keypress, blur
 *     status: ok
 *
 * **`check interactions` never clicks.** Its probe focuses an element and presses the key its
 * role activates with — there is no `.click()` anywhere in `interaction-map.ts`. For a native
 * control the browser turns that keypress into a click; for a role-only element it does not,
 * and that element is exactly what `pointer-only-control` exists to find. Measured:
 *
 *     <button> + Enter                        click fires
 *     <a href> + Enter                        click fires
 *     <input type=submit> + Enter             click fires
 *     div[role=button][tabindex=0] + Enter    NO click
 *     div[role=checkbox][tabindex=0] + Space  NO click
 *
 * So coverage is now decided per element from what the probe actually did — see
 * `InteractionProbeEvidence` — and this set only bounds what it could ever have done.
 */
export const PROBED_TYPES = new Set(["click", "keydown", "keyup", "keypress", "focus", "blur"]);

/**
 * Which elements the interaction probe reached, and how far.
 *
 * Supplied by `check interactions`, which owns the probe; absent on a `scan handlers` run,
 * where the honest answer is "nothing was exercised". Read from the interaction map rather
 * than re-derived, because the map records what the probe did rather than what it intended:
 *
 *   - `focusedIx` — the tab walk stopped here, or an activation probe focused it. Either fires
 *     `focus` (and `blur` when focus leaves).
 *   - `activatedIx` — a key was pressed while this element held focus, so its keyboard handlers
 *     ran. Only elements whose role has an activation key get this (`activationKeyForRole`
 *     returns null for a link, a textbox, an option, a slider), and only within
 *     `--max-elements`.
 *
 * The Tab presses of the walk also fire `keydown` on whatever happens to be focused at the
 * time, and that is deliberately NOT counted: an incidental Tab keydown is not an exercise of
 * the element's keyboard handler, and counting it would reinstate the overclaim this replaced.
 */
export interface InteractionProbeEvidence {
  focusedIx: number[];
  activatedIx: number[];
}



/**
 * Did THIS run exercise this element's handler of this type?
 *
 * Per element, because the probe is per element: it focuses one control and presses one key.
 * The old answer was a page-global set membership test, which claimed coverage for every
 * element on every run — including runs where nothing was pressed at all.
 */
function probedForElement(
  type: string,
  e: HandlerSurfaceEntry,
  probe: InteractionProbeEvidence | undefined,
): boolean {
  // No probe ran. `scan handlers` is an inventory: it opens the page, reads registrations and
  // closes it. Nothing was exercised, so nothing is covered.
  if (!probe || e.ix === null) return false;
  const focused = probe.focusedIx.includes(e.ix) || probe.activatedIx.includes(e.ix);
  const activated = probe.activatedIx.includes(e.ix);
  if (type === "focus" || type === "blur") return focused;
  if (KEYBOARD_TYPES.has(type)) return activated;
  // The probe never calls `.click()`. A click happens only when the browser synthesizes one
  // from the activation keypress, which it does for a native control and not for a
  // `div[role=button]` — measured both ways.
  if (type === "click") return activated && e.nativeActivation === true;
  return false;
}

export interface HandlerIssue {
  kind: "pointer-only-control" | "unprobed-handler-types" | "delegated-handlers-opaque" | "no-handlers-found"
    | "drag-source-not-draggable" | "drop-without-dragover" | "drag-without-keyboard-alternative"
    | "dragover-not-prevented" | "dragstart-transfers-nothing" | "pointer-drag-intercepted"
    | "drag-source-inert" | "drop-target-unreachable" | "drag-cancel-not-reverted"
    | "drag-source-detached-mid-drag" | "dragover-handler-slow" | "passive-listener-cannot-cancel"
    | "hover-only-reveal" | "contextmenu-not-prevented" | "contextmenu-replaces-nothing"
    | "touch-handlers-not-invoked" | "text-input-rejects-non-ascii";
  severity: "warn" | "suspect";
  element: string;
  message: string;
  /**
   * The event types this issue is about, when it is about a list of them.
   *
   * `unprobed-handler-types` used to carry its list inside the prose only, so a JSON consumer
   * had to parse an English sentence to find out which types went unexercised — and a test
   * asserting on the sentence matched the advice as readily as the list ("--probe-drag" contains
   * "drag", "the probe focuses a control" contains "focus"). The list is data; it travels as data.
   */
  types?: string[];
}

/**
 * The rule table for everything `deriveHandlerIssues` can emit.
 *
 * It lived in `handlers.gate.ts` only, and `check interactions --handlers` emits the same
 * issues through the same function — so that gate declared none of them. The runner caught
 * it and said so, which is how this was found while adding the drag rules:
 *
 *     check.interactions emitted undeclared rule id(s): unprobed-handler-types
 *
 * An undeclared rule cannot be tuned (`--rule pointer-only-control=off` had nothing to
 * bind to on that gate) and every run printed the error line. Declared here, next to the
 * `HandlerIssue` kinds, and spread into both gates — one definition, so a rule added to the
 * deriver cannot reach only one of its two consumers.
 */
export const HANDLER_SURFACE_RULES = [
    {
      id: "pointer-only-control",
      title: "Click handler on a role-less element with no keyboard path",
      severity: "suspect",
      docs: "Operable by mouse but not by keyboard or assistive tech. The headline detection of this gate.",
    },
    {
      id: "delegated-handlers-opaque",
      title: "Root delegation hides per-element handlers",
      severity: "warn",
      docs: "Expected on React-style apps: the surface is measurable, just not per element.",
    },
    {
      id: "drag-source-not-draggable",
      title: "dragstart handler on an element that is not draggable",
      severity: "suspect",
      docs:
        "The handler can never fire: the browser starts no drag on an element whose"
        + " `draggable` is false. Add `draggable=\"true\"`, or move the handler to an element"
        + " draggable by default (<a href>, <img>).",
    },
    {
      id: "drop-without-dragover",
      title: "drop handler with no dragover/dragenter to preventDefault on",
      severity: "suspect",
      docs:
        "Also unfireable. dragover's default action rejects the drop, so a target must"
        + " register dragover (or dragenter) and call preventDefault(). Checked on the element"
        + " and every ancestor it would bubble through, so delegated targets are not flagged.",
    },
    {
      id: "dragover-not-prevented",
      title: "dragover handler that never calls preventDefault",
      severity: "suspect",
      docs:
        "Probed, not read: the static check cannot see this, because a dragover handler DOES"
        + " exist — it just does not cancel, so the browser rejects the drop and the wired"
        + " drop handler never runs. Requires --probe-drag (or `check interactions --handlers`).",
    },
    {
      id: "pointer-drag-intercepted",
      title: "Drag handlers that a real gesture never invoked",
      severity: "suspect",
      docs:
        "Registered, the gesture was delivered over the element, and none of its own listeners"
        + " ran — an overlay, `pointer-events` on an ancestor, or a listener on a detached node."
        + " The one unambiguous outcome of the pointer-drag probe: the pixel numbers beside it"
        + " are reported rather than graded, because 0% pixels has several explanations and"
        + " 0 invocations has one. Requires --probe-drag.",
    },
    {
      id: "drag-source-inert",
      title: "A real drag gesture on this source started no drag",
      severity: "suspect",
      docs:
        "Driven, not read: a real mouse gesture over the element produced no `dragstart` at"
        + " all, twice, from two different points. The browser refuses to start a drag here —"
        + " `-webkit-user-drag: none` on it or an ancestor, an overlay taking the press, or"
        + " `draggable` on a different node than the handler. Distinct from"
        + " `drag-source-not-draggable`, which reads the `draggable` property and reports the"
        + " one case that IS statically visible; this covers the ones that are not, and which"
        + " the synthetic dispatch reports as working. Requires --probe-drag.",
    },
    {
      id: "contextmenu-not-prevented",
      title: "A contextmenu handler that lets the browser menu open too",
      severity: "suspect",
      docs:
        "Driven: a real right-click ran the handler and nothing cancelled the event, so the browser's"
        + " own menu opens as well as whatever the page wanted to show. Read after the page's"
        + " handlers have run — before them `defaultPrevented` is always false and says nothing."
        + " Requires --probe menu.",
    },
    {
      id: "contextmenu-replaces-nothing",
      title: "A contextmenu handler that cancels the browser menu and shows nothing",
      severity: "warn",
      docs:
        "The right-click was cancelled and nothing became visible, so the user right-clicks and gets"
        + " nothing at all — worse off than with the browser's menu. Warn rather than suspect: the"
        + " replacement may be drawn somewhere this cannot see (a canvas, a portal positioned"
        + " offscreen until placed), and suppressing the menu deliberately is a choice a page is"
        + " allowed to make. Requires --probe menu.",
    },
    {
      id: "text-input-rejects-non-ascii",
      title: "A text field that keeps ASCII and drops non-ASCII text",
      severity: "warn",
      docs:
        "Typed into, three ways: an ASCII sample, the same sample in Japanese, and the Japanese one"
        + " through an IME composition. The field kept the ASCII and lost the Japanese, so a name,"
        + " address or comment typed in a non-Latin script disappears. The ASCII drive is the"
        + " control, and it is what makes the finding attributable: a field that mangles ASCII too"
        + " is filtering by its own rules (a phone number, a numeric amount) and is not reported."
        + " Warn rather than suspect, because a field may legitimately accept only Latin text — and"
        + " if so it should say so rather than swallowing what was typed. Requires --probe input.",
    },
    {
      id: "touch-handlers-not-invoked",
      title: "Touch handlers a real tap never invoked",
      severity: "suspect",
      docs:
        "Registered, the tap landed on the element's own box, and none of its listeners ran — the"
        + " same unambiguous outcome `pointer-drag-intercepted` grades, for touch. Something is"
        + " between the finger and the listener: an overlay, `pointer-events` on an ancestor, a"
        + " listener on a detached node. Driven in a page with touch emulation on, which is a"
        + " different environment from the rest of the run and reported as such. Requires"
        + " --probe touch.",
    },
    {
      id: "hover-only-reveal",
      title: "Content that appears on hover and not on focus",
      severity: "suspect",
      docs:
        "WCAG 1.4.13 and 2.1.1: hovering the trigger made something visible and focusing the same"
        + " trigger made nothing visible, so a keyboard user never sees it. Measured as a diff of"
        + " what is visible on the PAGE rather than of the trigger's own pixels — a tooltip or menu"
        + " appears outside the trigger's box. Triggers come from the hover handlers AND from every"
        + " selector containing `:hover`, because the CSS-only trigger is the common form and has no"
        + " listener to find. Requires --probe hover.",
    },
    {
      id: "passive-listener-cannot-cancel",
      title: "A handler calls preventDefault() on a listener that cannot cancel",
      severity: "suspect",
      docs:
        "The listener was registered `{ passive: true }` and its handler calls preventDefault(),"
        + " which is a silent no-op — Chromium logs \"Unable to preventDefault inside passive event"
        + " listener invocation\" and carries on. So code written to stop a scroll, a zoom or a"
        + " browser gesture does not stop it, and the page shows nothing for it. Measured per"
        + " element: the same wheel listener records the call as ineffective under"
        + " `{ passive: true }` and effective under `{ passive: false }` and with no option at all."
        + " Needs a probe family that makes the event fire.",
    },
    {
      id: "drag-source-detached-mid-drag",
      title: "dragstart fired and dragend never did",
      severity: "suspect",
      docs:
        "The source left the document while it was being dragged, so `dragend` — the only place a"
        + " drag is guaranteed to end up, success or not — never ran on it. Measured on a source"
        + " that removes itself in `dragstart`: the drop still lands, the drag looks like it"
        + " worked, and every cleanup wired to `dragend` is silently skipped. Read from a capture"
        + " listener on `document`, which `stopPropagation` cannot hide from. One read is enough:"
        + " the evaluate that reads the log is queued behind the page's own main-thread work, so"
        + " nothing able to delay `dragend` can arrive after it — checked against a `dragover`"
        + " handler busy-waiting 300ms. Requires --probe-drag.",
    },
    {
      id: "dragover-handler-slow",
      title: "A dragover handler slow enough to stutter the drag",
      severity: "warn",
      docs:
        "Timed inside the listener wrapper, so the number is the handler's own run and not the"
        + " interval between events: the interval version reported 68ms for a handler that returns"
        + " immediately, because dragover keeps firing while the probe takes its hover screenshot."
        + " Warn rather than suspect: it is a smoothness defect. Only sees listeners added with"
        + " addEventListener, so an `ondragover=` property reads as unmeasured. Requires"
        + " --probe-drag.",
    },
    {
      id: "drag-cancel-not-reverted",
      title: "Escape cancelled the drag and the page kept the change",
      severity: "suspect",
      docs:
        "Driven: the probe presses Escape mid-drag, the browser reports the drag as cancelled"
        + " (dragend with dropEffect \"none\", no drop), and the source's own box still differs"
        + " from before the gesture. The shape this catches is the optimistic update every"
        + " sortable makes — hide the item on dragstart because it is 'leaving' — with no restore"
        + " on a cancelled drag. Measured separation on a fixture: the source that restores reads"
        + " 0.00%, the one that forgets reads 99.03%. Requires --probe-drag.",
    },
    {
      id: "drop-target-unreachable",
      title: "A real drag never reached this drop target",
      severity: "suspect",
      docs:
        "A hit test, so it needs no probe flag: three points inside the target (centre, 25%, 75%)"
        + " are passed to elementFromPoint, and none of them lands on it or inside it. A"
        + " descendant counts as reaching it, because the event bubbles — deriving this from the"
        + " gesture log instead reported the fixture's delegated <ul> as unreachable, since the"
        + " aim lands on its <li>. Measured on a target with a correct contract (dragover calling"
        + " preventDefault, a wired drop) under a transparent sibling: the whole run reported"
        + " nothing about it, because the static check sees both handlers and the synthetic"
        + " dispatch runs them directly at the element.",
    },
    {
      id: "dragstart-transfers-nothing",
      title: "dragstart leaves the DataTransfer empty",
      severity: "warn",
      docs:
        "A target calling getData() reads \"\". Chromium still starts the drag, Firefox and"
        + " Safari do not, so this is a cross-browser defect rather than a local one — and a"
        + " page may deliberately keep its payload in its own state, which is why it warns.",
    },
    {
      id: "drag-without-keyboard-alternative",
      title: "Drag-operated element with no keyboard path",
      severity: "warn",
      docs:
        "HTML5 drag has no keyboard equivalent in any browser, so the action is mouse-only"
        + " (WCAG 2.1.1, 2.5.7). Warn rather than suspect because the alternative path is"
        + " often elsewhere on the page, which this element-local view cannot see. The fix is"
        + " another route to the same result, not tabindex + Enter — that cannot start a drag.",
    },
    { id: "unprobed-handler-types", title: "Event types this gate does not probe", severity: "warn" },
    {
      id: "no-handlers-found",
      title: "The page presents controls and registers no handlers at all",
      severity: "warn",
      docs:
        "Warn, not suspect: a page of links and a form that posts legitimately needs none."
        + " Raise to suspect on an app where every control is expected to be wired.",
    },
] as const;

/**
 * The headline cross-check: a visible element with a pointer handler
 * that (a) was never discovered as interactive (no role/semantics),
 * (b) is not a delegation container for real interactive elements,
 * (c) is not itself inside one (a span inside a button is fine), and
 * (d) has no keyboard handler of its own — is operable by mouse only.
 * Keyboard and assistive-tech users cannot reach or fire it.
 */
export function deriveHandlerIssues(surface: HandlerSurface): HandlerIssue[] {
  const issues: HandlerIssue[] = [];
  const unprobedTypes = new Set<string>();
  // Types a probe actually exercised this run. The warn below says these are "NOT covered by
  // the interaction probes", and for a page whose drag was driven with real mouse input that
  // statement is simply false — it was covered, which is what the probe is for.
  const probedThisRun = new Set<string>();
  if (surface.dragProbe) {
    for (const row of surface.dragProbe) for (const t of row.ran) probedThisRun.add(t);
  }
  if (surface.realDragProbe) {
    // Exactly the types the recorder saw. Not inferred from the outcome: "a drop landed, so
    // dragleave must have fired" is unsound — a gesture can enter a target and drop there
    // without ever leaving it — and claiming coverage this run did not have is the same
    // failure as claiming a defect it did not measure.
    for (const row of surface.realDragProbe) {
      if (row.error) continue;
      for (const t of row.observedTypes ?? []) probedThisRun.add(t);
    }
  }
  if (surface.textInputProbe) {
    // Exactly what the recorder saw across the three drives — observed, not assumed. `insertText`
    // sends no key events, so `keydown` is NOT covered by this family and keeps saying so.
    for (const row of surface.textInputProbe) {
      if (row.error) continue;
      for (const t of row.observedTypes) probedThisRun.add(t);
    }
  }
  if (surface.menuProbe) {
    for (const row of surface.menuProbe) {
      if (!row.error && row.handlerCalls > 0) probedThisRun.add("contextmenu");
    }
  }
  if (surface.touchProbe) {
    for (const row of surface.touchProbe) {
      if (row.error) continue;
      for (const t of ["touchstart", "touchend", "touchcancel"]) {
        if (row.tapCalls > 0 && surface.elements.some((e) => e.path === row.path && e.types[t])) {
          probedThisRun.add(t);
        }
      }
      if (row.swipeRatio !== undefined) probedThisRun.add("touchmove");
    }
  }
  if (surface.hoverProbe) {
    // The probe hovers and focuses each trigger, so those types were genuinely exercised there.
    for (const row of surface.hoverProbe) {
      if (row.error) continue;
      for (const t of ["mouseenter", "mouseover", "mouseleave", "mouseout", "focus", "blur"]) {
        if (surface.elements.some((e) => e.path === row.path && e.types[t])) probedThisRun.add(t);
      }
    }
  }
  if (surface.wheelProbe) {
    for (const row of surface.wheelProbe) {
      if (row.error) continue;
      for (const t of ["wheel", "mousewheel", "scroll"]) {
        if (surface.elements.some((e) => e.path === row.path && e.types[t])) probedThisRun.add(t);
      }
    }
  }
  if (surface.pointerDragProbe) {
    for (const row of surface.pointerDragProbe) {
      if (row.error) continue;
      // The gesture drives exactly these three; `pointercancel` is not sent by a completed
      // drag, so it stays unprobed and keeps saying so.
      for (const t of ["pointerdown", "pointermove", "pointerup", "mousedown", "mousemove", "mouseup"]) {
        if (surface.elements.some((e) => e.path === row.path && e.types[t])) probedThisRun.add(t);
      }
    }
  }
  for (const e of surface.elements) {
    const hasPointer = Object.keys(e.types).some((t) => POINTER_TYPES.has(t));
    const hasKeyboard = Object.keys(e.types).some((t) => KEYBOARD_TYPES.has(t));
    // A framework delegation root registers the ENTIRE event vocabulary
    // (~80 types) up front, whether the app uses them or not. Listing those
    // as "unprobed" buries the handful of authored types that a reader
    // should actually check under a wall of noise, so only count types the
    // page wired to a specific element.
    if (Object.keys(e.types).length < 10 || !e.containsInteractive) {
      for (const t of Object.keys(e.types)) {
        if (!probedForElement(t, e, surface.interactionProbe) && !probedThisRun.has(t)) unprobedTypes.add(t);
      }
    }
    // ---- Probed drag behaviour ---------------------------------------------
    //
    // Only when `probeDrag` ran. `probe === undefined` means not measured, and inventing a
    // finding from data this gate did not collect is the failure mode the `draggable` field
    // is guarded against below for the same reason.
    const probe = surface.dragProbe?.find((row) => row.path === e.path);
    // A zone that visibly reacts to the drag and then refuses it is not a separate defect — it is
    // this one, made worse: the page tells the user the drop will work. Measured on a fixture
    // whose refusing zone highlights 99% of its own box on `dragenter`, so the affordance is
    // unmistakable. Folded into the message rather than raised as a second finding, because one
    // root cause reported twice is what `drag-source-inert` deliberately avoids.
    const hovered = surface.realDragProbe
      ?.flatMap((r) => r.hoverFeedback ?? [])
      .filter((h) => h.target === e.path)
      .reduce((max, h) => Math.max(max, h.ratio), 0) ?? 0;
    const highlight = hovered >= 0.02
      ? ` A real drag over it changed ${(hovered * 100).toFixed(0)}% of its own pixels, so it`
        + ` advertises itself as a drop zone and then rejects the drop — the user is told it will`
        + ` work.`
      : "";
    if (probe?.dragoverUnprevented === true) {
      // The static `drop-without-dragover` check passes this: a dragover handler DOES
      // exist. It just does not cancel, so the default action rejects the drop and the
      // wired `drop` never runs. Measured — `dispatchEvent` returned true for a dragover
      // that forgot `preventDefault()` and false for one that called it.
      issues.push({
        kind: "dragover-not-prevented",
        severity: "suspect",
        element: `${e.path} "${e.text}"`,
        message: `${e.path} "${e.text}" has a dragover handler that does not call `
          + `preventDefault(), so the browser rejects the drop and the drop handler never `
          + `runs. Measured by dispatching a dragover: no listener cancelled it.${highlight} Call `
          + `e.preventDefault() in the dragover handler (and in dragenter, if you rely on it).`,
      });
    }
    // A real drag can refute this one, and on the fixture it did. The synthetic probe dispatches
    // `dragstart` with a `DataTransfer` this code constructed, so "the handler set nothing" is
    // all it can see — but for a natively draggable element the BROWSER fills the payload in.
    // Measured on `<a href>`: the synthetic probe reports an empty transfer, and the real drop
    // received `text/plain="file:///…#x"`, the link's own URL. A target calling `getData()` there
    // reads the URL, not "", so the warn's premise does not hold. Only a payload actually
    // observed at a drop refutes it; no drop means no evidence, and the warn stands.
    const realDropPayload = surface.realDragProbe
      ?.find((r) => r.path === e.path)
      ?.timeline?.find((step) => step.type === "drop")?.received;
    if (probe?.transferredTypes?.length === 0 && !(realDropPayload && realDropPayload.length > 0)) {
      // Warn, not suspect: a page may carry its drag payload in its own JS state and never
      // touch the DataTransfer, which works in Chromium. It is still a defect across
      // browsers — Firefox and Safari will not start a drag with an empty DataTransfer —
      // and any target calling getData() reads "".
      issues.push({
        kind: "dragstart-transfers-nothing",
        severity: "warn",
        element: `${e.path} "${e.text}"`,
        message: `${e.path} "${e.text}" ran its dragstart handler and left the DataTransfer `
          + `empty, so a target calling getData() reads "". Chromium still starts the drag; `
          + `Firefox and Safari do not. Call e.dataTransfer.setData(<type>, <value>) unless `
          + `the payload deliberately lives in the page's own state.`,
      });
    }

    // ---- Probed pointer drag ------------------------------------------------
    //
    // The pixel numbers are reported and not graded, because 0% has several explanations.
    // This one has exactly one: the element's own listeners were registered, a real gesture
    // was delivered over its box, and NONE of them ran. Something is between the pointer and
    // the listener — an overlay, `pointer-events`, a detached node.
    //
    // Measured on three pads with identical registrations: the working pad and the inert pad
    // both invoked the full trio, and only the pad under a transparent sibling reported zero.
    // So this separates "unreachable" from "reachable but does nothing", which the pixels
    // cannot.
    const pointerProbe = surface.pointerDragProbe?.find((row) => row.path === e.path);
    if (pointerProbe && !pointerProbe.error && pointerProbe.handlerCalls === 0) {
      issues.push({
        kind: "pointer-drag-intercepted",
        severity: "suspect",
        element: `${e.path} "${e.text}"`,
        message: `${e.path} "${e.text}" has drag handlers that never ran: a real `
          + `pointerdown/pointermove/pointerup gesture was delivered over its box and none of `
          + `its own listeners was invoked. Something between the pointer and the element is `
          + `taking the events — an overlay or backdrop on top of it, \`pointer-events\` on an `
          + `ancestor, or a listener attached to a node that is no longer in the document. `
          + `Measured at 30%-70% across the element, so a surface that is only covered `
          + `elsewhere would not report this.`,
      });
    }

    // ---- Real HTML5 drag gesture --------------------------------------------
    //
    // The graded outcome of driving the drag rather than dispatching it: the page registers a
    // `dragstart` on a visible element, a real gesture was performed over it twice from two
    // points, and the browser started no drag at all. Measured separation on scratch fixtures
    // — a plain `draggable="true"` source fires `dragstart` and lands its drop; the same
    // source with `-webkit-user-drag: none`, or under a transparent sibling, fires nothing —
    // and neither of those two is visible to any static read.
    //
    // `draggable === false` is excluded because `drag-source-not-draggable` already names that
    // case with the specific fix. `dragstartFired` is only trusted when the row has no error:
    // a gesture that could not be performed measured nothing.
    const realProbe = surface.realDragProbe?.find((row) => row.path === e.path);
    if (realProbe && !realProbe.error && realProbe.gestures > 0 && !realProbe.dragstartFired && e.draggable !== false) {
      issues.push({
        kind: "drag-source-inert",
        severity: "suspect",
        element: `${e.path} "${e.text}"`,
        message: `${e.path} "${e.text}" has a dragstart handler and a real mouse drag over it `
          + `started no drag: the gesture was performed twice, from the centre and from 25% in, `
          + `and the browser fired no dragstart. Something stops the drag from beginning — `
          + `\`-webkit-user-drag: none\` on it or an ancestor, an element on top of it taking the `
          + `press, or \`draggable\` set on a different node than the handler. Note the element `
          + `IS draggable as far as the DOM is concerned, which is why the static check passes `
          + `it${realProbe.startedOn?.length ? `; the gesture started a drag on ${realProbe.startedOn.join(", ")} instead` : ""}.`,
      });
    }

    // `dragend` is where a drag ends whether it succeeded or not, so a source that never gets one
    // never runs its cleanup. The cause is the source leaving the document mid-drag, which the
    // optimistic-update pattern does by removing rather than hiding. Guarded on `dragstartFired`,
    // so a source that never dragged cannot be reported as having lost its dragend.
    const rowFor = surface.realDragProbe?.find((r) => r.path === e.path);
    if (rowFor?.dragstartFired && rowFor.timeline && !rowFor.timeline.some((step) => step.type === "dragend")) {
      issues.push({
        kind: "drag-source-detached-mid-drag",
        severity: "suspect",
        element: `${e.path} "${e.text}"`,
        message: `${e.path} "${e.text}" started a drag and never received a dragend: the element `
          + `left the document while the drag was in flight. Every cleanup wired to dragend — `
          + `restoring the placeholder, clearing the drag class, releasing the dragged model — is `
          + `skipped, and the drop still lands, so the drag looks like it worked. Move the item `
          + `with CSS or a placeholder instead of removing the node, or attach the cleanup to the `
          + `container rather than to the node being dragged.`,
      });
    }

    // A dragover handler slow enough that the drag stutters over this target, timed inside the
    // listener itself. `undefined` means no such handler ran under the wrapper — not that it was
    // fast.
    if (e.dragoverMs !== undefined && e.dragoverMs >= 50) {
      issues.push({
        kind: "dragover-handler-slow",
        severity: "warn",
        element: `${e.path} "${e.text}"`,
        message: `${e.path} "${e.text}" has a dragover handler that took ${e.dragoverMs.toFixed(0)}ms `
          + `in a single call. dragover fires every frame while the pointer is over the target, so `
          + `the drag stutters for as long as it stays here. Do the work once on dragenter, cache `
          + `anything read from layout, and keep the dragover handler to preventDefault() plus a `
          + `cheap decision.`,
      });
    }

    // A handler that calls preventDefault() where it can never work. Both facts come from the
    // listener patch: how it was registered, and whether the call it made ever cancelled anything.
    for (const rec of surface.cancelAttempts ?? []) {
      // The condition is "the call did nothing", not "the listener is passive": a preventDefault on
      // a non-cancelable event is the same defect with a different cause, and keying on `passive`
      // would have reported it with the wrong explanation. The message is worded from whichever
      // fact applies.
      if (rec.path !== e.path || rec.effective) continue;
      const why = rec.passive
        ? `the listener is registered { passive: true }, and a passive listener cannot cancel its `
          + `event — Chromium logs "Unable to preventDefault inside passive event listener `
          + `invocation" and carries on. Register it with { passive: false } if the cancel is `
          + `intended, or drop the call if it is not.`
        : `the event was not cancelable, so preventDefault() had nothing to cancel. Either the `
          + `default action is already gone by the time this runs, or the wrong event is being `
          + `listened for.`;
      issues.push({
        kind: "passive-listener-cannot-cancel",
        severity: "suspect",
        element: `${e.path} "${e.text}"`,
        message: `${e.path} "${e.text}" has a ${rec.type} handler that calls preventDefault(), and `
          + `the call did nothing: ${why} Whatever it was meant to stop — a scroll, a zoom, a `
          + `browser gesture — still happens.`,
      });
    }

    // A cancelled drag that left something behind. Both halves are required: the browser has to
    // have reported the cancel (otherwise the drop may legitimately have happened and changed the
    // page), and the pixels have to still differ. 2% is the same floor the hover measurement uses.
    const cancel = surface.realDragProbe?.find((r) => r.path === e.path)?.cancel;
    if (cancel?.cancelled && cancel.ratio !== undefined && cancel.ratio >= 0.02) {
      issues.push({
        kind: "drag-cancel-not-reverted",
        severity: "suspect",
        element: `${e.path} "${e.text}"`,
        message: `${e.path} "${e.text}" was dragged, Escape was pressed, and the browser cancelled `
          + `the drag — dragend reported dropEffect "none" and no drop ran — but `
          + `${(cancel.ratio * 100).toFixed(0)}% of the element's own box still differs from before `
          + `the gesture. A cancelled drag has to leave the page as it was. The usual cause is an `
          + `optimistic change made in dragstart (hiding or moving the item because it is `
          + `"leaving") that is only undone in drop, so pressing Escape strands it: undo it in `
          + `dragend instead, which fires whether the drag succeeded or not.`,
      });
    }

    // A declared drop target that a real drag could not reach. Reported per target, from the
    // gestures aimed at it — the source that was dragged is incidental, so the finding names the
    // target and what intercepted its events.
    const covered = surface.unreachableTargets?.find((u) => u.path === e.path);
    if (covered) {
      issues.push({
        kind: "drop-target-unreachable",
        severity: "suspect",
        element: `${e.path} "${e.text}"`,
        message: `${e.path} "${e.text}" is wired as a drop target and nothing can drop on it: `
          + `every sample point inside it — centre, 25%, 75% — hits ${covered.interceptedBy} `
          + `instead, so the pointer never reaches it. Its own handlers are fine, which is why `
          + `nothing else reports this: look for what is on top of it — an overlay or backdrop, a `
          + `sibling with \`position: absolute; inset: 0\`, or an ancestor's \`pointer-events\`.`,
      });
    }

    // ---- HTML5 drag and drop -----------------------------------------------
    //
    // Two of these are handlers that CANNOT FIRE, which is the same class as
    // `pointer-only-control` and just as invisible in a plain inventory: measured on a
    // fixture, a `dragstart` source missing `draggable` and a `drop` target missing
    // `dragover` were listed identically to the working pair beside them.
    const types = Object.keys(e.types);
    const pointerDrag = isPointerDragSurface(types);
    const dragSourceTypes = types.filter((t) => DRAG_SOURCE_TYPES.has(t));
    const dragTargetTypes = types.filter((t) => DRAG_TARGET_TYPES.has(t));

    // `e.draggable === false`, not `!e.draggable`: an older surface has no such field, and
    // treating "not collected" as "not draggable" would invent findings.
    if (dragSourceTypes.includes("dragstart") && e.draggable === false) {
      issues.push({
        kind: "drag-source-not-draggable",
        severity: "suspect",
        element: `${e.path} "${e.text}"`,
        message: `${e.path} "${e.text}" has a dragstart handler but is not draggable, so the `
          + `handler can never fire — the browser starts no drag on an element whose `
          + `\`draggable\` is false. Add \`draggable="true"\` (or move the handler to an `
          + `element that is draggable by default, like an <a href> or <img>).`,
      });
    }

    // The drop half of the contract. `dragover` (or `dragenter`) must call
    // `preventDefault()` or the browser's default action cancels the drop, and `drop` never
    // fires. Whether preventDefault is actually CALLED is not statically visible — that is
    // what the `--json` samples and an interact sequence are for — but the absence of any
    // dragover/dragenter handler at all, on the element or an ancestor it would bubble
    // through, is decisive on its own.
    if (
      dragTargetTypes.includes("drop")
      && !types.includes("dragover") && !types.includes("dragenter")
      && !e.ancestorTypes.includes("dragover") && !e.ancestorTypes.includes("dragenter")
    ) {
      issues.push({
        kind: "drop-without-dragover",
        severity: "suspect",
        element: `${e.path} "${e.text}"`,
        message: `${e.path} "${e.text}" has a drop handler but no dragover or dragenter `
          + `handler on it or any ancestor, so the drop can never fire. The default action `
          + `for dragover is "reject the drop"; a target must register dragover and call `
          + `preventDefault() on it.`,
      });
    }

    // Drag is not keyboard-operable, at all, in any browser — so a drag-only affordance
    // excludes keyboard and assistive-tech users the way a click-only div does, and needs a
    // different remedy: another way to perform the same action, not tabindex + Enter.
    // Warn rather than suspect: the alternative path is often elsewhere on the page (a
    // "move to" menu), which this element-local view cannot see.
    if (
      (dragSourceTypes.length > 0 || pointerDrag) && !hasKeyboard
      && !e.ancestorTypes.some((t) => KEYBOARD_TYPES.has(t))
      && e.visible
    ) {
      // Both drags, one finding: the remedy is identical and it is NOT the
      // `pointer-only-control` remedy. `tabindex` plus a key handler cannot start an HTML5
      // drag, and it cannot drag a canvas either.
      const how = dragSourceTypes.length > 0 ? dragSourceTypes.join("/") : "pointer drag";
      const why = dragSourceTypes.length > 0
        ? "HTML5 drag has no keyboard equivalent in any browser"
        : "a pointer-driven drag gesture has no keyboard equivalent";
      const fix = dragSourceTypes.length > 0
        ? 'move up/down controls, a "move to" menu, or cut/paste'
        : "arrow-key nudging, numeric position/size fields, or a menu action for the same edit";
      issues.push({
        kind: "drag-without-keyboard-alternative",
        severity: "warn",
        element: `${e.path} "${e.text}"`,
        message: `${e.path} "${e.text}" is operated by dragging (${how}) `
          + `with no keyboard handler on it or an ancestor. ${why}, so this action is `
          + `mouse-only (WCAG 2.1.1, and 2.5.7 Dragging Movements). Provide a non-drag path `
          + `to the same result — ${fix} — rather than tabindex and a key handler, which `
          + `cannot perform a drag.`,
      });
    }

    if (
      hasPointer && !hasKeyboard
      && e.ix === null
      && e.visible
      && !e.containsInteractive
      && !e.insideInteractive
      // A drag surface is reported by `drag-without-keyboard-alternative` instead. Both
      // findings are true of it, but their advice contradicts: this one says to add a role,
      // tabindex and key handling, and that does not make a canvas draggable. Measured on a
      // real SVG editor, whose canvas got exactly that advice for its
      // pointerdown/pointermove/pointerup trio.
      && !pointerDrag
    ) {
      issues.push({
        kind: "pointer-only-control",
        severity: "suspect",
        element: `${e.path} "${e.text}"`,
        message: `${e.path} "${e.text}" has a ${Object.keys(e.types).filter((t) => POINTER_TYPES.has(t)).join("/")} handler but no role, no keyboard handler, and no interactive descendant — mouse users can operate it, keyboard and assistive-tech users cannot. Give it a role + tabindex + key handling, or move the handler onto a real control.`,
      });
    }
  }
  for (const row of surface.textInputProbe ?? []) {
    if (row.error) continue;
    // The ASCII control has to have survived intact, or the loss is not attributable to the script:
    // a digits-only field loses both samples and says nothing about non-ASCII.
    if (!row.plainAscii.includes(TEXT_PROBE_ASCII)) continue;
    if (row.plainCjk.includes(TEXT_PROBE_CJK)) continue;
    issues.push({
      kind: "text-input-rejects-non-ascii",
      severity: "warn",
      element: `${row.path} "${row.text}"`,
      message: `${row.path} "${row.text}" kept ${JSON.stringify(TEXT_PROBE_ASCII)} and lost `
        + `${JSON.stringify(TEXT_PROBE_CJK)} — typing it left ${JSON.stringify(row.plainCjk)} in the `
        + `field. A name, address or comment in a non-Latin script disappears here. The ASCII sample `
        + `going in unchanged is what points at the script rather than at a length or format rule: `
        + `look for a filter on the input handler, or a pattern that assumes Latin characters. If the `
        + `field really only accepts Latin text, say so and reject the entry rather than swallowing `
        + `it.`,
    });
  }
  for (const row of surface.menuProbe ?? []) {
    if (row.error || row.handlerCalls === 0) continue;
    if (!row.prevented) {
      issues.push({
        kind: "contextmenu-not-prevented",
        severity: "suspect",
        element: `${row.path} "${row.text}"`,
        message: `${row.path} "${row.text}" ran its contextmenu handler on a real right-click and `
          + `nothing cancelled the event, so the browser's own menu opens too — the page's menu is at `
          + `best beside it. Call e.preventDefault() in the handler.`,
      });
    } else if (row.revealed.length === 0) {
      issues.push({
        kind: "contextmenu-replaces-nothing",
        severity: "warn",
        element: `${row.path} "${row.text}"`,
        message: `${row.path} "${row.text}" cancelled the right-click and nothing became visible, so `
          + `a user right-clicking here gets nothing at all — the browser's menu is gone and the `
          + `page put nothing in its place. If the replacement is drawn on a canvas or positioned `
          + `offscreen until placed, this cannot see it; if there is no replacement, do not cancel.`,
      });
    }
  }
  for (const row of surface.touchProbe ?? []) {
    if (row.error || row.tapCalls > 0) continue;
    issues.push({
      kind: "touch-handlers-not-invoked",
      severity: "suspect",
      element: `${row.path} "${row.text}"`,
      message: `${row.path} "${row.text}" has touch handlers that a real tap never invoked: the tap `
        + `landed on the middle of its own box and none of its listeners ran. Something is between `
        + `the finger and the listener — an overlay or backdrop on top of it, \`pointer-events\` on an `
        + `ancestor, or a listener attached to a node no longer in the document.`,
    });
  }
  // Hover triggers are NOT iterated with the handler surface, and that is the point: the common
  // form of this defect is a CSS `:hover` rule with no listener anywhere, so the trigger has no
  // entry in the surface at all. Keeping the rule inside the per-element loop reported the JS
  // trigger on the fixture and silently skipped the CSS one, which the probe had measured
  // correctly all along.
  for (const row of surface.hoverProbe ?? []) {
    if (row.error || row.revealedOnHover.length === 0 || row.revealedOnFocus.length > 0) continue;
    const what = row.revealedOnHover.slice(0, 3).map((label) => label.split("|")[0]).join(", ");
    // How many elements derive this same path. A toolbar of icon-only buttons with no id or class
    // collapses to ONE path, so the probe visits the first of them and the finding would read as
    // though it were about that one button. Measured on a real editor: 17 tooltip triggers, one
    // path, one finding. Naming the count is the difference between "this button" and "this
    // pattern" for the reader.
    const sharing = surface.elements.filter((e) => e.path === row.path).length;
    const alsoOn = sharing > 1
      ? ` ${sharing} elements on this page derive the same path, so this is the pattern rather than `
        + `one control — the probe drove the first of them.`
      : "";
    issues.push({
      kind: "hover-only-reveal",
      severity: "suspect",
      element: `${row.path} "${row.text}"`,
      message: `${row.path} "${row.text}" reveals ${what} on hover and nothing on focus, so a `
        + `keyboard or assistive-tech user never sees it (WCAG 1.4.13 Content on Hover or Focus, `
        + `2.1.1). `
        + (row.focusable
          ? `The trigger is focusable, so add the same reveal to :focus / :focus-visible, or a focus `
            + `handler beside the hover one.`
          : `The trigger cannot even be focused — give it tabindex="0" (or make it a button), then `
            + `reveal on focus as well as on hover.`) + alsoOn,
    });
  }
  // Disclose the blind spot instead of printing a clean bill of health.
  // React-style root delegation registers pointer handlers on the
  // container, not on the elements, so per-element attribution — the whole
  // basis of pointer-only-control detection — is unavailable. The
  // 2026-08-01 hard-target audit hit exactly this: a React page with a
  // `<div onClick>` and no keyboard path reported `status: ok`. A gate that
  // cannot see a defect class on this page must say so.
  // React 18/19 attach to the ROOT CONTAINER element, not to document, so
  // the signature is one element carrying a large, generic slab of event
  // types while containing the real controls — not a `globals` entry.
  const isDelegationRoot = (e: HandlerSurfaceEntry) =>
    Object.keys(e.types).length >= 10 && e.containsInteractive;
  const roots = surface.elements.filter(isDelegationRoot);
  const ownPointerHandlers = surface.elements
    .filter((e) => !isDelegationRoot(e) && Object.keys(e.types).some((t) => POINTER_TYPES.has(t))).length;
  const delegatedPointerTypes = [
    ...new Set([
      ...Object.keys(surface.globals).filter((t) => POINTER_TYPES.has(t)),
      ...roots.flatMap((r) => Object.keys(r.types).filter((t) => POINTER_TYPES.has(t))),
    ]),
  ];
  if (ownPointerHandlers === 0 && delegatedPointerTypes.length > 0) {
    issues.push({
      kind: "delegated-handlers-opaque",
      severity: "warn",
      element: "(page)",
      message: `Pointer handlers are registered only at the delegation root (${delegatedPointerTypes.sort().join(", ")}), with none on individual elements — the signature of framework root delegation (React and similar). Per-element attribution is unavailable, so pointer-only-control detection is BLIND on this page: a clean result here is not evidence that every control is keyboard-operable. Verify the interactive elements with 'check interactions' plus a 'verify flow' script that tabs to and activates them.`,
    });
  }
  if (unprobedTypes.size > 0) {
    // Two different sentences, because they call for two different next steps. Without a probe
    // the answer is "run the gate that probes"; with one it is "these are what it could not
    // reach". The single old sentence — "NOT covered by the interaction probes" — was written
    // for the second case and printed in both, which made a run that exercised nothing read as
    // a run with a few gaps.
    const message = surface.interactionProbe
      ? `Handler types registered but NOT exercised by this run's probes: ${[...unprobedTypes].sort().join(", ")}`
        + ` — the probe focuses a control and presses the key its role activates with, so a`
        + ` \`click\` handler on anything but a native control, and any type outside`
        + ` focus/blur/keyboard, is untested here. Verify those paths with a 'verify flow' script.`
      : `${unprobedTypes.size} handler type(s) registered and NONE exercised:`
        + ` ${[...unprobedTypes].sort().join(", ")} — this gate is an inventory and presses`
        + ` nothing. A clean result here says the wiring exists, not that it works. Run`
        + ` 'check interactions --handlers' to focus and activate the controls, add`
        + ` '--probe-drag' for the drag surfaces, or drive the rest with a 'verify flow' script.`;
    issues.push({
      kind: "unprobed-handler-types",
      severity: "warn",
      element: "(page)",
      message,
      types: [...unprobedTypes].sort(),
    });
  }
  // Controls present, no handlers anywhere. v7's agent-l, on a console whose three
  // buttons were all inert: "`registrations: 0 across 0 element(s)` → status **ok**;
  // zero listeners on a 3-button page is the finding."
  //
  // Three things produce it and the finding names all three, because only one is a
  // defect and the gate cannot tell which from here: the controls are dead (a real
  // defect, and `check interactions` reports it as `inert-control`), the handlers are
  // wired somewhere this gate cannot attribute (already covered above when a
  // delegation root IS visible — this fires when there is not even that), or the page
  // legitimately has none, e.g. a form that posts.
  //
  // `warn`, not `suspect`: a page of links and a submit-only form is a real page, and
  // failing it would be its own bad message. The count is what was missing.
  const controls = surface.visibleControls ?? 0;
  if (controls > 0 && surface.totalRegistrations === 0) {
    issues.push({
      kind: "no-handlers-found",
      severity: "warn",
      element: "(page)",
      message:
        `${controls} visible interactive control(s) and ZERO handler registrations —`
        + ` no listeners, no on* attributes, no on* properties, nothing on window/document.`
        + ` Either the controls are inert (check interactions reports that as inert-control),`
        + ` or they are wired somewhere this gate cannot see, or the page genuinely needs none`
        + ` (links, a form that posts). This gate cannot tell which; it can only tell you that`
        + ` a clean result here is not evidence of anything.`,
    });
  }
  return issues;
}

// ---------------------------------------------------------------------------
// Surface contract (reference vs attempt)

export type HandlerCategory = "pointer" | "keyboard" | "input" | "other";

export function categorizeHandlerType(type: string): HandlerCategory {
  if (POINTER_TYPES.has(type) || ["mouseover", "mouseenter", "mouseleave", "mouseout"].includes(type)) return "pointer";
  if (KEYBOARD_TYPES.has(type)) return "keyboard";
  if (["input", "change", "submit", "focus", "blur", "focusin", "focusout"].includes(type)) return "input";
  return "other";
}

export interface SurfaceMismatch {
  severity: "warn";
  identity: string;
  message: string;
}

/**
 * Structural cross-check of the wired event vocabulary. Identity is
 * the element's visible TEXT (paths/ids legitimately differ between
 * implementations); the effective vocabulary of an element merges its
 * own handler types with any handler-carrying ancestor's (delegation
 * is a legitimate implementation choice, not a mismatch). Comparison
 * is by CATEGORY (pointer/keyboard/input/other) — mousedown vs click
 * is an implementation detail. Everything here is a WARN: the
 * suspect-level authority for behavior is the interaction-map
 * response contract; this catches wiring the probes cannot fire.
 */
export function compareHandlerSurfaces(reference: HandlerSurface, attempt: HandlerSurface): SurfaceMismatch[] {
  const vocab = (s: HandlerSurface): Map<string, Set<HandlerCategory>> => {
    const m = new Map<string, Set<HandlerCategory>>();
    for (const e of s.elements) {
      if (!e.visible || !e.text) continue;
      const set = m.get(e.text) ?? new Set<HandlerCategory>();
      for (const t of [...Object.keys(e.types), ...e.ancestorTypes]) set.add(categorizeHandlerType(t));
      m.set(e.text, set);
    }
    return m;
  };
  const refVocab = vocab(reference);
  const attVocab = vocab(attempt);
  const mismatches: SurfaceMismatch[] = [];
  // Delegation across STRUCTURE: the reference may wire each cell, the
  // attempt one container handler. The cell then has no surface entry
  // at all — cover it through any attempt entry whose text CONTAINS
  // the identity (the container's text includes its children's).
  const coveredBy = (identity: string): Set<HandlerCategory> => {
    const direct = attVocab.get(identity);
    if (direct) return direct;
    const merged = new Set<HandlerCategory>();
    for (const e of attempt.elements) {
      if (e.visible && e.text.includes(identity)) {
        for (const t of [...Object.keys(e.types), ...e.ancestorTypes]) merged.add(categorizeHandlerType(t));
      }
    }
    return merged;
  };
  for (const [identity, refCats] of refVocab) {
    const attCats = coveredBy(identity);
    const lost = [...refCats].filter((c) => !attCats.has(c));
    if (lost.length > 0) {
      mismatches.push({
        severity: "warn",
        identity,
        message: `"${identity}": the reference wires ${lost.join("/")} handler(s) here; the attempt wires ${attCats.size > 0 ? [...attCats].join("/") + " only" : "nothing"}.`,
      });
    }
  }
  const refGlobalCats = new Set([...Object.keys(reference.globals)].map((k) => categorizeHandlerType(k.split(":")[1] ?? k)));
  const attGlobalCats = new Set([...Object.keys(attempt.globals)].map((k) => categorizeHandlerType(k.split(":")[1] ?? k)));
  const lostGlobal = [...refGlobalCats].filter((c) => !attGlobalCats.has(c));
  if (lostGlobal.length > 0) {
    mismatches.push({
      severity: "warn",
      identity: "(globals)",
      message: `window/document: the reference wires global ${lostGlobal.join("/")} handler(s); the attempt does not.`,
    });
  }
  return mismatches;
}

// ---------------------------------------------------------------------------
// Report + CLI

/**
 * The drag route as lines a reader can follow, wrapped rather than run together.
 *
 * `prevented` is annotated only where it changes the outcome — a `dragover` that did not cancel
 * is the reason no `drop` followed, and that is the single most common drag defect there is.
 * `stopPropagation` reads as `propagation stopped` rather than as `not prevented`, because the
 * page may well have cancelled the event before killing it and this cannot see which.
 */
export function formatDragTimeline(timeline: readonly DragTimelineStep[], perLine = 3): string[] {
  // `drag` fires on the SOURCE for every mouse move, interleaved with the target's `dragover`,
  // so it defeats consecutive-repeat coalescing and turned a one-gesture route into seven lines
  // of alternating noise. It also carries no routing information — the route is which targets
  // the drag crossed. Dropped from the print and kept in the JSON, then re-coalesced, which is
  // what turns four `dragover@div#bin` rows into one.
  const merged: DragTimelineStep[] = [];
  for (const step of timeline) {
    if (step.type === "drag") continue;
    const last = merged[merged.length - 1];
    if (last && last.type === step.type && last.path === step.path && last.prevented === step.prevented
      && !last.received && !step.received) {
      merged[merged.length - 1] = { ...last, count: last.count + step.count };
      continue;
    }
    merged.push(step);
  }
  const steps = merged.map((s) => {
    const repeat = s.count > 1 ? ` x${s.count}` : "";
    const note = s.prevented === true
      ? " (prevented)"
      : s.prevented === false
        ? " (NOT prevented — the drop is refused here)"
        : s.prevented === null
          ? " (propagation stopped — cannot tell)"
          : "";
    const got = s.received?.length
      ? ` [got ${s.received.map((r) => `${r.type}=${JSON.stringify(r.value)}`).join(", ")}]`
      : s.received
        ? " [got nothing]"
        : "";
    return `${s.type}@${s.path}${repeat}${note}${got}`;
  });
  const lines: string[] = [];
  for (let i = 0; i < steps.length; i += perLine) {
    lines.push((i === 0 ? "route: " : "       ") + steps.slice(i, i + perLine).join(" → "));
  }
  return lines;
}

/**
 * @param rules The project's effective rule settings, when the runner supplies them.
 *
 * Consulting them is what stops the prose from contradicting the verdict. Without it,
 * `--rule drag-source-inert=off` printed `status: 5 suspect issue(s)` in red, listed all five,
 * and exited 0 — measured, and the runner's own note said the five were suppressed. A rule set
 * to `off` is dropped here; one re-tuned to another severity is counted and printed at the
 * severity the project chose, so `=info` moves a line out of the suspect count rather than
 * leaving it red.
 */
export function formatHandlerSurface(
  surface: HandlerSurface,
  issues: HandlerIssue[],
  rules?: RuleView,
): string {
  const lines: string[] = [];
  lines.push(`${BOLD}${CYAN}vlmkit scan handlers${RESET}`);
  lines.push(`${DIM}source: ${surface.source}${RESET}`);
  lines.push("");
  const effective = (i: HandlerIssue) => rules?.effective(i.kind) ?? i.severity;
  issues = issues.filter((i) => effective(i) !== "off");
  const suspects = issues.filter((i) => effective(i) === "suspect").length;
  // `ok` only when there is nothing at all. It used to print green beside a warn,
  // which is the same self-contradiction `check design` had — a headline that the
  // lines under it disagree with.
  const warns = issues.length - suspects;
  lines.push(
    `status: ${
      suspects > 0
        ? `${RED}${suspects} suspect issue(s)${warns > 0 ? `, ${warns} warn` : ""}${RESET}`
        : warns > 0
          ? `${YELLOW}${warns} warn(s)${RESET}`
          : `${GREEN}ok${RESET}`
    }`,
  );
  // The control count is the denominator. `registrations: 0 across 0 element(s)`
  // read the same for a static document and for a page whose buttons are all dead.
  lines.push(
    `registrations: ${surface.totalRegistrations} across ${surface.elements.length} element(s)`
    + `${Object.keys(surface.globals).length > 0 ? ` + globals` : ""}`
    + `${surface.visibleControls !== undefined ? `, on a page presenting ${surface.visibleControls} control(s)` : ""}`,
  );
  lines.push("");
  for (const e of surface.elements) {
    const types = Object.entries(e.types).map(([t, n]) => (n > 1 ? `${t}×${n}` : t)).join(", ");
    const badge = e.ix !== null ? "" : e.containsInteractive ? ` ${DIM}(delegation container)${RESET}` : e.insideInteractive ? ` ${DIM}(inside a control)${RESET}` : ` ${YELLOW}(no role)${RESET}`;
    lines.push(`  - ${e.path} "${e.text}": ${types}${badge}`);
  }
  if (Object.keys(surface.globals).length > 0) {
    lines.push(`  - globals: ${Object.entries(surface.globals).map(([k, n]) => (n > 1 ? `${k}×${n}` : k)).join(", ")}`);
  }
  // Evidence, not a verdict. A 0% row is ambiguous — dead handlers, a gesture that started
  // somewhere ungrabbable, or feedback painted outside this element's box are
  // indistinguishable from here — so the numbers are printed and the reader decides. What
  // they do settle is that the pointer types were exercised, which is why they no longer
  // appear under "NOT covered by the interaction probes".
  if (surface.pointerDragProbe && surface.pointerDragProbe.length > 0) {
    lines.push("");
    lines.push(`${BOLD}Pointer-drag gesture (real mouse input):${RESET}`);
    for (const row of surface.pointerDragProbe) {
      if (row.error) {
        lines.push(`  - ${row.path}: ${YELLOW}not driven — ${row.error}${RESET}`);
        continue;
      }
      const pct = (n: number) => `${(n * 100).toFixed(2)}%`;
      const flat = row.feedbackRatio === 0 && row.committedRatio === 0;
      lines.push(
        `  - ${row.path}: feedback while held ${pct(row.feedbackRatio)}`
        + `, changed after release ${pct(row.committedRatio)}`
        + (flat
          ? ` ${YELLOW}(nothing moved — dead handlers, or the drag does not start here)${RESET}`
          : ""),
      );
    }
  }
  if (surface.textInputProbe && surface.textInputProbe.length > 0) {
    lines.push("");
    lines.push(`${BOLD}Typed into (plain, and through an IME composition):${RESET}`);
    for (const row of surface.textInputProbe) {
      if (row.error) {
        lines.push(`  - ${row.path}: ${YELLOW}not driven — ${row.error}${RESET}`);
        continue;
      }
      const kept = (typed: string, got: string) => got.includes(typed)
        ? `kept ${JSON.stringify(typed)}`
        : `${YELLOW}${JSON.stringify(typed)} became ${JSON.stringify(got)}${RESET}`;
      lines.push(
        `  - ${row.path}: ${kept(TEXT_PROBE_ASCII, row.plainAscii)}, ${kept(TEXT_PROBE_CJK, row.plainCjk)}`
        + `, composed ${JSON.stringify(row.composed)}`,
      );
    }
    if (surface.textInputCapped) {
      lines.push(`  ${DIM}${surface.textInputCapped} more field(s) not typed into (cap ${MAX_TEXT_FIELDS})${RESET}`);
    }
  }
  if (surface.menuProbe && surface.menuProbe.length > 0) {
    lines.push("");
    lines.push(`${BOLD}Right-click (real secondary click):${RESET}`);
    for (const row of surface.menuProbe) {
      if (row.error) {
        lines.push(`  - ${row.path}: ${YELLOW}not driven — ${row.error}${RESET}`);
        continue;
      }
      const shown = row.revealed.length > 0
        ? `revealed ${row.revealed.slice(0, 3).map((l) => l.split("|")[0]).join(", ")}`
        : "revealed nothing";
      lines.push(
        `  - ${row.path}: ${row.handlerCalls} handler call(s), `
        + `${row.prevented ? "browser menu cancelled" : `${YELLOW}browser menu NOT cancelled${RESET}`}, ${shown}`,
      );
    }
  }
  if (surface.touchProbe && surface.touchProbe.length > 0) {
    lines.push("");
    lines.push(`${BOLD}Touch (tap and swipe, touch emulation on):${RESET}`);
    lines.push(`  ${DIM}driven in a second page: touch emulation sets maxTouchPoints to 1 and`
      + ` "ontouchstart" in window to true, which a page may branch on${RESET}`);
    for (const row of surface.touchProbe) {
      if (row.error) {
        lines.push(`  - ${row.path}: ${YELLOW}not driven — ${row.error}${RESET}`);
        continue;
      }
      lines.push(
        `  - ${row.path}: tap invoked ${row.tapCalls} listener(s)`
        + (row.swipeRatio === undefined ? "" : `, a swipe changed ${(row.swipeRatio * 100).toFixed(2)}% of it`),
      );
    }
  }
  if (surface.hoverProbe && surface.hoverProbe.length > 0) {
    lines.push("");
    lines.push(`${BOLD}Hover, then focus (same trigger):${RESET}`);
    for (const row of surface.hoverProbe) {
      if (row.error) {
        lines.push(`  - ${row.path}: ${YELLOW}not driven — ${row.error}${RESET}`);
        continue;
      }
      const label = (list: string[]) => list.length === 0
        ? "nothing"
        : list.slice(0, 3).map((l) => l.split("|")[0]).join(", ") + (list.length > 3 ? ` +${list.length - 3}` : "");
      lines.push(
        `  - ${row.path}: hover reveals ${label(row.revealedOnHover)}, focus reveals ${label(row.revealedOnFocus)}`
        + (row.focusable ? "" : ` ${DIM}(not focusable)${RESET}`),
      );
    }
    if (surface.hoverProbeLimits) {
      const { unreadableSheets, capped } = surface.hoverProbeLimits;
      const notes = [
        unreadableSheets > 0 ? `${unreadableSheets} stylesheet(s) unreadable (another origin) — their :hover triggers were not found` : "",
        capped > 0 ? `${capped} more trigger(s) not visited (cap ${MAX_HOVER_TARGETS})` : "",
      ].filter(Boolean);
      if (notes.length > 0) lines.push(`  ${DIM}${notes.join("; ")}${RESET}`);
    }
  }
  if (surface.wheelProbe && surface.wheelProbe.length > 0) {
    lines.push("");
    lines.push(`${BOLD}Wheel gesture (real wheel input):${RESET}`);
    for (const row of surface.wheelProbe) {
      if (row.error) {
        lines.push(`  - ${row.path}: ${YELLOW}not driven — ${row.error}${RESET}`);
        continue;
      }
      // Evidence only. Consuming the wheel is what a map or a carousel is supposed to do.
      lines.push(
        `  - ${row.path}: a 200px wheel moved ${row.scrolledPx}px`
        + (row.scrolledPx === 0 && row.scrollable
          ? ` ${YELLOW}(nothing scrolled, though something here could — the handler consumed it)${RESET}`
          : row.scrollable ? "" : ` ${DIM}(nothing here scrolls anyway)${RESET}`),
      );
    }
  }
  // The real HTML5 drag. `started no drag` is the graded row; "no target accepted it" is
  // printed and NOT graded, because a page may legitimately pair a source with only some of
  // its targets and this cannot tell that apart from a broken one.
  if (surface.realDragProbe && surface.realDragProbe.length > 0) {
    lines.push("");
    lines.push(`${BOLD}HTML5 drag gesture (real mouse input):${RESET}`);
    for (const row of surface.realDragProbe) {
      if (row.error) {
        lines.push(`  - ${row.path}: ${YELLOW}not driven — ${row.error}${RESET}`);
        continue;
      }
      if (row.gestures === 0) {
        // Not "no drag started" — no drag was attempted. Saying otherwise would report a
        // measurement that never happened.
        lines.push(`  - ${row.path}: ${DIM}not driven — gesture budget spent on earlier sources${RESET}`);
        continue;
      }
      const tried = row.targetsTried.length > 0
        ? `, tried ${row.targetsTried.length} target(s)`
        : ", no drop target declared on the page";
      // What the target actually received, on the one line where it fits. The source side of
      // this is `dragstart-transfers-nothing`; this is the other end of the same wire, and
      // `getData()` is only readable during `drop` — measured, it returns "" everywhere else.
      const dropStep = row.timeline?.find((step) => step.type === "drop");
      const payload = dropStep?.received?.length
        ? ` ${DIM}[got ${dropStep.received.map((r) => `${r.type}=${JSON.stringify(r.value)}`).join(", ")}]${RESET}`
        : dropStep?.received
          ? ` ${YELLOW}[the target received nothing]${RESET}`
          : "";
      // A drop that works and shows nothing while hovered. Evidence, not a finding: the feedback
      // may be painted outside the zone's own box — a placeholder opening in a sibling list is
      // the common shape — which an element-local screenshot cannot see.
      const hover = row.hoverFeedback?.find((h) => h.target === row.droppedOn);
      const silent = hover && hover.ratio < 0.02
        ? ` ${DIM}(no visible change while hovering)${RESET}`
        : hover
          ? ` ${DIM}(highlighted ${(hover.ratio * 100).toFixed(0)}% while hovering)${RESET}`
          : "";
      const landed = row.droppedOn
        ? `${GREEN}dropped on ${row.droppedOn}${RESET}${payload}${silent}`
        : row.dragstartFired
          ? `${YELLOW}no target accepted it${RESET}`
          : `${RED}started no drag${RESET}`;
      // The Escape result, on the same line, because "it drops but Escape strands it" is one
      // sentence about one source.
      const cancelNote = !row.cancel
        ? ""
        : !row.cancel.started
          ? ` ${DIM}(no second drag to cancel — the source was gone by then)${RESET}`
          : !row.cancel.cancelled
          ? ` ${DIM}(Escape did not cancel it)${RESET}`
          : row.cancel.ratio === undefined
            ? ` ${DIM}(cancelled; revert not measured)${RESET}`
            : row.cancel.ratio >= 0.02
              ? ` ${RED}(Escape cancelled it and ${(row.cancel.ratio * 100).toFixed(0)}% of it stayed changed)${RESET}`
              : ` ${DIM}(Escape reverted it cleanly)${RESET}`;
      lines.push(
        `  - ${row.path}: ${row.dragstartFired ? "dragstart fired" : "no dragstart"}${tried} — ${landed}${cancelNote}`
        + (row.capped ? ` ${DIM}(gesture budget reached — not every target was tried)${RESET}` : ""),
      );
      // The route, printed only when the drag did not complete. That is when the question is
      // "where did it go instead", and printing it for a working source would bury the one
      // that failed under the ones that did not. `--json` carries it either way.
      if (!row.droppedOn && row.timeline && row.timeline.length > 0) {
        for (const line of formatDragTimeline(row.timeline)) lines.push(`      ${DIM}${line}${RESET}`);
      }
    }
  }
  if (issues.length > 0) {
    lines.push("");
    lines.push(`${BOLD}Issues:${RESET}`);
    for (const i of issues) {
      // The project's severity, not the rule's default: a line re-tuned to `info` printing
      // `suspect` in red is the same disagreement as an off rule printing at all.
      const severity = effective(i);
      const color = severity === "suspect" ? RED : YELLOW;
      lines.push(`  ${color}${severity}${RESET} [${i.kind}] ${i.message}`);
    }
  }
  return lines.join("\n");
}

/**
 * CLI entry removed: this module is measurement code now, not a command.
 * `scan handlers` is declared in `../gates/handlers.gate.ts` and driven by the core runner
 * (`@mizchi/vlmkit-core/plugin/runner.ts`), which owns argument parsing,
 * `--json`, `--advisory`, the run ledger and the exit code.
 */
