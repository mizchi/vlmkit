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
import { type PageLoadOptions, applyHar, navigationOptions } from "@mizchi/vlmkit-core/page-load.ts";
import { settlePage } from "@mizchi/vlmkit-core/page-open.ts";
import { BOLD, CYAN, DIM, GREEN, RED, RESET, YELLOW } from "@mizchi/vlmkit-core/terminal-colors.ts";
import { DISCOVER_SCRIPT } from "./interaction-map.ts";
import { withBrowser } from "@mizchi/vlmkit-core/browser-launch.ts";
import { PNG } from "pngjs";
import type { Page } from "playwright";

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
  const origAdd = EventTarget.prototype.addEventListener;
  const origRemove = EventTarget.prototype.removeEventListener;
  const bump = (target) => {
    counts.set(target, (counts.get(target) || 0) + 1);
  };
  const wrapperFor = (type, listener) => {
    let perType = wrappers.get(listener);
    if (!perType) { perType = new Map(); wrappers.set(listener, perType); }
    const existing = perType.get(type);
    if (existing) return existing;
    // Preserves this and arguments, and returns whatever the page returned.
    const invoke = typeof listener === "function"
      ? function () { return listener.apply(this, arguments); }
      : function () { return listener.handleEvent.apply(listener, arguments); };
    const wrapped = function () {
      bump(this);
      return invoke.apply(this, arguments);
    };
    perType.set(type, wrapped);
    return wrapped;
  };
  EventTarget.prototype.addEventListener = function (type, listener, opts) {
    if (!listener) return origAdd.call(this, type, listener, opts);
    try {
      return origAdd.call(this, type, wrapperFor(String(type), listener), opts);
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
  window.__vlmkitResetCalls = (el) => { counts.delete(el); };
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
  const describe = (el) => {
    const parts = [];
    let cur = el;
    while (cur && cur !== document.body && cur.tagName && parts.length < 4) {
      let p = cur.tagName.toLowerCase();
      if (cur.id) p += "#" + cur.id;
      else if (typeof cur.className === "string" && cur.className.trim()) p += "." + cur.className.trim().split(/\\s+/)[0];
      parts.unshift(p);
      cur = cur.parentElement;
    }
    return parts.join(">");
  };
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
 * dragstart had set. All four signals are observable, so none of this needs a VLM or a
 * real OS-level drag — which CDP cannot drive anyway.
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
 * Unlike HTML5 drag — which CDP cannot drive, and which the synthetic-`DragEvent` probe
 * exists to work around — a pointer drag IS drivable: `mouse.down` / `mouse.move` /
 * `mouse.up` is the same input a user produces. So this measures the real thing.
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
async function probePointerDrags(
  page: Page,
  elements: readonly HandlerSurfaceEntry[],
): Promise<PointerDragProbe[]> {
  const surfaces = elements.filter((e) => e.visible && isPointerDragSurface(Object.keys(e.types)));
  const out: PointerDragProbe[] = [];
  for (const entry of surfaces) {
    const row: PointerDragProbe = { path: entry.path, feedbackRatio: 0, committedRatio: 0 };
    try {
      // Located by the same `data-vlmkit-*` stamp the surface used, so the probe cannot
      // drag a different element than the one it reports on. Falls back to the box of the
      // first element matching the path's last tag when no stamp exists.
      const handle = await page.evaluateHandle((path: string) => {
        const describe = (el: Element): string => {
          const parts: string[] = [];
          let cur: Element | null = el;
          while (cur && cur !== document.body && cur.tagName && parts.length < 4) {
            let p = cur.tagName.toLowerCase();
            if (cur.id) p += "#" + cur.id;
            else if (typeof cur.className === "string" && cur.className.trim()) {
              p += "." + cur.className.trim().split(/\s+/)[0];
            }
            parts.unshift(p);
            cur = cur.parentElement;
          }
          return parts.join(">");
        };
        for (const el of document.querySelectorAll("*")) if (describe(el) === path) return el;
        return null;
      }, entry.path);
      const el = handle.asElement();
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

export interface HandlerSurfaceOptions extends PageLoadOptions {
  source: string;
  storageState?: string;
  /**
   * Fire the drag sequence and record what ran. Off by default because dispatching runs
   * the page's own handlers — see `PROBE_DRAG_SCRIPT`.
   */
  probeDrag?: boolean;
}

export async function buildHandlerSurface(options: HandlerSurfaceOptions): Promise<HandlerSurface> {
  return await withBrowser(async (browser) => {
    const page = await browser.newPage(withAuthState({ viewport: { width: 1280, height: 800 } }, options.storageState));
    // Order matters and was measured: the invocation patch goes first so the registration
    // recorder below still sees the page's real listener rather than a wrapper. See
    // HANDLER_INVOCATION_PATCH_SCRIPT. Only for probe runs — the inventory has no use for it
    // and every patch is a chance to alter the page.
    if (options.probeDrag) await page.addInitScript(HANDLER_INVOCATION_PATCH_SCRIPT);
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
    // After the surface, so a probe that mutates the page cannot change what was
    // inventoried. Dispatching runs the page's own handlers, and a drop handler is exactly
    // the kind that rewrites the DOM.
    const dragProbe = options.probeDrag
      ? await page.evaluate(PROBE_DRAG_SCRIPT) as DragProbe[]
      : undefined;
    // Real mouse input, so this needs the Page rather than an evaluate. Only for the
    // elements already classified as pointer-drag surfaces — one on the editor this came
    // from, so the screenshot cost is bounded by how many drag surfaces a page has.
    const pointerDragProbe = options.probeDrag
      ? await probePointerDrags(page, raw.elements)
      : undefined;
    return {
      source: options.source,
      elements: raw.elements,
      globals: raw.globals,
      totalRegistrations: raw.total,
      visibleControls: raw.controls,
      ...(dragProbe ? { dragProbe } : {}),
      ...(pointerDragProbe && pointerDragProbe.length > 0 ? { pointerDragProbe } : {}),
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
export const PROBED_TYPES = new Set(["click", "keydown", "keyup", "keypress", "focus", "blur"]);

export interface HandlerIssue {
  kind: "pointer-only-control" | "unprobed-handler-types" | "delegated-handlers-opaque" | "no-handlers-found"
    | "drag-source-not-draggable" | "drop-without-dragover" | "drag-without-keyboard-alternative"
    | "dragover-not-prevented" | "dragstart-transfers-nothing" | "pointer-drag-intercepted";
  severity: "warn" | "suspect";
  element: string;
  message: string;
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
        if (!PROBED_TYPES.has(t) && !probedThisRun.has(t)) unprobedTypes.add(t);
      }
    }
    // ---- Probed drag behaviour ---------------------------------------------
    //
    // Only when `probeDrag` ran. `probe === undefined` means not measured, and inventing a
    // finding from data this gate did not collect is the failure mode the `draggable` field
    // is guarded against below for the same reason.
    const probe = surface.dragProbe?.find((row) => row.path === e.path);
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
          + `runs. Measured by dispatching a dragover: no listener cancelled it. Call `
          + `e.preventDefault() in the dragover handler (and in dragenter, if you rely on it).`,
      });
    }
    if (probe?.transferredTypes?.length === 0) {
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
    issues.push({
      kind: "unprobed-handler-types",
      severity: "warn",
      element: "(page)",
      message: `Handler types registered but NOT covered by the interaction probes: ${[...unprobedTypes].sort().join(", ")} — verify those paths manually or with an interact sequence.`,
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

export function formatHandlerSurface(surface: HandlerSurface, issues: HandlerIssue[]): string {
  const lines: string[] = [];
  lines.push(`${BOLD}${CYAN}vlmkit scan handlers${RESET}`);
  lines.push(`${DIM}source: ${surface.source}${RESET}`);
  lines.push("");
  const suspects = issues.filter((i) => i.severity === "suspect").length;
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
  if (issues.length > 0) {
    lines.push("");
    lines.push(`${BOLD}Issues:${RESET}`);
    for (const i of issues) {
      const color = i.severity === "suspect" ? RED : YELLOW;
      lines.push(`  ${color}${i.severity}${RESET} [${i.kind}] ${i.message}`);
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
