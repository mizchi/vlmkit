/**
 * The browser half of session traces (`vlmkit-trace/1`, `@mizchi/vlmkit-judge/session-trace.ts`):
 * it watches a page while something drives it and writes down each step with what the step
 * changed.
 *
 * Two ways in, one trace:
 * - `step(run, action)`: a driver that knows what it is about to do (`vlmkit act`) hands over the
 *   action and a function that does it.
 * - `listen()`: a person clicks through the page. Listeners in the page report each click,
 *   change and key, and the recorder turns them into steps one at a time, in order.
 *
 * Per step: the page is read before (the last read) and twice after (after it settles, then
 * 350ms later, so a value still moving is not taken for an outcome), the two are diffed
 * (`diffObservations`), and each change gets a locator that Playwright itself resolves to that
 * one element, or it is dropped.
 */
import type { Locator, Page } from "playwright";
import {
  diffObservations,
  MAX_EXPECTATIONS_PER_STEP,
  TRACE_FORMAT,
  type LocatorCandidate,
  type ObservedChange,
  type ObservedElement,
  type PageObservation,
  type SessionTrace,
  type TraceAction,
  type TraceExpectation,
  type TraceStep,
  type TraceTarget,
} from "@mizchi/vlmkit-judge/session-trace.ts";

/** What the page script knows about an element, beyond the diff's fields. */
export interface RecordedElement extends ObservedElement {
  tag: string;
  testId?: string;
  label?: string;
  placeholder?: string;
  /** Measured in the page when it was read: does each candidate match this one element only. */
  unique?: { testId?: boolean; role?: boolean; label?: boolean; placeholder?: boolean; text?: boolean };
}

interface RecordedObservation extends PageObservation {
  elements: RecordedElement[];
}

/** Installed in every document; `window.__vlmkitRec`. */
export const RECORDER_SCRIPT = `(() => {
  if (window.__vlmkitRec) return;
  const doc = Math.random().toString(36).slice(2, 7);
  let n = 0;
  const keyOf = (el) => {
    let k = el.getAttribute("data-vlmkit-key");
    if (!k) { k = doc + "-" + (++n); el.setAttribute("data-vlmkit-key", k); }
    return k;
  };
  const INTERACTIVE = "a[href], button, input:not([type=hidden]), select, textarea, summary, [contenteditable=''], [contenteditable=true], [role=button], [role=link], [role=tab], [role=checkbox], [role=radio], [role=switch], [role=menuitem], [role=menuitemcheckbox], [role=menuitemradio], [role=option], [role=combobox], [role=textbox], [role=treeitem], [role=slider], [role=spinbutton]";
  const WATCHED = "dialog, details, [role=dialog], [role=alertdialog], [role=alert], [role=status], [role=log], [role=menu], [role=listbox], [role=tabpanel], [role=tooltip], [aria-live]";
  const STATES = ["aria-expanded", "aria-pressed", "aria-selected", "aria-checked", "aria-current"];
  const clean = (s) => (s || "").replace(/\\s+/g, " ").trim();
  const visible = (el) => {
    const r = el.getBoundingClientRect();
    if (r.width < 1 || r.height < 1) return false;
    if (el.checkVisibility) return el.checkVisibility({ opacityProperty: true, visibilityProperty: true });
    const cs = getComputedStyle(el);
    return cs.visibility !== "hidden" && cs.display !== "none" && Number(cs.opacity) > 0.05;
  };
  const roleOf = (el) => {
    const explicit = el.getAttribute("role");
    if (explicit) return explicit.split(/\\s+/)[0];
    const tag = el.tagName.toLowerCase();
    if (tag === "button") return "button";
    if (tag === "a" && el.hasAttribute("href")) return "link";
    if (tag === "select") return el.multiple || el.size > 1 ? "listbox" : "combobox";
    if (tag === "textarea") return "textbox";
    if (/^h[1-6]$/.test(tag)) return "heading";
    if (tag === "dialog") return "dialog";
    if (tag === "img" && el.getAttribute("alt")) return "img";
    if (tag === "li") return "listitem";
    if (tag === "option") return "option";
    if (tag === "output") return "status";
    if (tag === "input") {
      const t = (el.getAttribute("type") || "text").toLowerCase();
      if (t === "checkbox") return "checkbox";
      if (t === "radio") return "radio";
      if (t === "range") return "slider";
      if (t === "number") return "spinbutton";
      if (t === "search") return "searchbox";
      if (["button", "submit", "reset", "image"].includes(t)) return "button";
      if (["text", "email", "tel", "url", "password", ""].includes(t)) return "textbox";
    }
    return undefined;
  };
  // A label's own words: a control inside it (a select's options) is not part of its name.
  const labelOf = (el) => {
    if (!el.labels || !el.labels.length) return undefined;
    const copy = el.labels[0].cloneNode(true);
    for (const c of copy.querySelectorAll("input, select, textarea, button")) c.remove();
    return clean(copy.textContent) || undefined;
  };
  const nameOf = (el) => {
    const aria = el.getAttribute("aria-label");
    if (aria) return clean(aria);
    const by = el.getAttribute("aria-labelledby");
    if (by) {
      const t = by.split(/\\s+/).map((id) => document.getElementById(id)).filter(Boolean).map((e) => e.innerText).join(" ");
      if (clean(t)) return clean(t);
    }
    const label = labelOf(el);
    if (label) return label;
    const tag = el.tagName.toLowerCase();
    if (tag === "input" && ["button", "submit", "reset"].includes((el.type || "").toLowerCase())) return clean(el.value);
    if (tag === "img") return clean(el.getAttribute("alt"));
    if (!["input", "textarea", "select"].includes(tag)) {
      const t = clean(el.innerText);
      if (t) return t.slice(0, 120);
    }
    return clean(el.getAttribute("title") || el.getAttribute("placeholder") || "") || undefined;
  };
  const cssOf = (el) => {
    const esc = (s) => CSS.escape(s);
    if (el.id && document.querySelectorAll("#" + esc(el.id)).length === 1) return "#" + esc(el.id);
    const parts = [];
    for (let e = el; e && e.nodeType === 1 && e !== document.documentElement; e = e.parentElement) {
      if (e.id && document.querySelectorAll("#" + esc(e.id)).length === 1) { parts.unshift("#" + esc(e.id)); break; }
      const tag = e.tagName.toLowerCase();
      const same = e.parentElement ? [...e.parentElement.children].filter((c) => c.tagName === e.tagName) : [e];
      parts.unshift(same.length > 1 ? tag + ":nth-of-type(" + (same.indexOf(e) + 1) + ")" : tag);
    }
    return parts.join(" > ");
  };
  const controlled = () => {
    const ids = new Set();
    for (const c of document.querySelectorAll("[aria-controls]")) for (const id of c.getAttribute("aria-controls").split(/\\s+/)) ids.add(id);
    return ids;
  };
  const read = (el, kind) => {
    const tag = el.tagName.toLowerCase();
    const role = roleOf(el);
    const out = { key: keyOf(el), tag, css: cssOf(el), visible: visible(el), watched: kind === "watched", interactive: kind === "interactive", states: {} };
    const around = el.parentElement && el.parentElement.closest(WATCHED);
    if (around) out.within = keyOf(around);
    if (role) out.role = role;
    const name = nameOf(el);
    if (name) out.name = name;
    if (kind !== "interactive" || !["input", "select", "textarea"].includes(tag)) {
      const t = clean(el.innerText);
      if (t) out.text = t.slice(0, 200);
    }
    for (const s of STATES) if (el.hasAttribute(s)) out.states[s] = el.getAttribute(s);
    if (tag === "details" || tag === "dialog") out.states.open = el.open ? "true" : "false";
    if (tag === "input" && (el.type === "checkbox" || el.type === "radio")) out.checked = el.checked;
    else if (["input", "textarea"].includes(tag) || (tag === "select" && !el.multiple)) out.value = el.value;
    const testId = el.getAttribute("data-testid");
    if (testId) out.testId = testId;
    const label = labelOf(el);
    if (label) out.label = label;
    const ph = el.getAttribute("placeholder");
    if (ph) out.placeholder = ph;
    return out;
  };
  const leaves = () => {
    const out = [];
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    const seen = new Set();
    for (let t = walker.nextNode(); t && out.length < 600; t = walker.nextNode()) {
      const el = t.parentElement;
      if (!el || seen.has(el) || !clean(t.textContent)) continue;
      seen.add(el);
      if (/^(script|style|noscript|template)$/i.test(el.tagName)) continue;
      if (el.closest(INTERACTIVE)) continue;
      if (clean(el.innerText).length > 200) continue;
      if (!visible(el) && !el.hasAttribute("data-vlmkit-key")) continue;
      out.push(el);
    }
    return out;
  };
  const uniqueness = (el, r) => {
    const all = [...document.querySelectorAll("*")];
    const u = {};
    if (r.testId) u.testId = document.querySelectorAll('[data-testid="' + CSS.escape(r.testId) + '"]').length === 1;
    if (r.role && r.name) u.role = all.filter((e) => visible(e) && roleOf(e) === r.role && nameOf(e) === r.name).length === 1;
    if (r.label) u.label = [...document.querySelectorAll("input, select, textarea")].filter((e) => labelOf(e) === r.label).length === 1;
    if (r.placeholder) u.placeholder = document.querySelectorAll('[placeholder="' + CSS.escape(r.placeholder) + '"]').length === 1;
    if (r.text) u.text = all.filter((e) => visible(e) && e.children.length === 0 && clean(e.innerText) === r.text).length === 1;
    return u;
  };
  const observe = () => {
    const ctl = controlled();
    const els = new Map();
    for (const el of document.querySelectorAll(INTERACTIVE)) els.set(el, "interactive");
    for (const el of document.querySelectorAll(WATCHED)) if (!els.has(el)) els.set(el, "watched");
    for (const id of ctl) { const el = document.getElementById(id); if (el && !els.has(el)) els.set(el, "watched"); }
    for (const el of leaves()) if (!els.has(el)) els.set(el, "leaf");
    const elements = [];
    for (const [el, kind] of els) {
      if (kind === "interactive" && !visible(el) && !el.hasAttribute("data-vlmkit-key")) continue;
      elements.push(read(el, kind));
    }
    const a = document.activeElement;
    const focused = a && a !== document.body && a !== document.documentElement ? keyOf(a) : undefined;
    return { url: location.href, elements, focused };
  };
  const describe = (el) => {
    const target = el.closest(INTERACTIVE) || el;
    const r = read(target, "interactive");
    r.unique = uniqueness(target, r);
    return r;
  };
  window.__vlmkitRec = { observe, describe, keyOf, INTERACTIVE };
})()`;

/**
 * Reports what a person does, installed beside `RECORDER_SCRIPT`. The page is read in the event's
 * own capture-phase listener, before the page's handlers run, so each step's "before" is exact
 * however fast the next one follows. Its "after" is read when the page has been quiet for 400ms
 * (no mutation; 2s at most) or, if something else happens first, at that moment. A value that
 * changes while nothing is happening (a clock) is reported as volatile and never an outcome.
 *
 * Text is reported as one fill per field: from focus to the moment focus leaves it, Enter is
 * pressed in it, or anything else happens.
 */
const LISTEN_SCRIPT = `(() => {
  if (window.__vlmkitListening) return;
  window.__vlmkitListening = true;
  const rec = () => window.__vlmkitRec;
  let lastCall = Promise.resolve();
  const call = (ev) => { try { lastCall = Promise.resolve(window.__vlmkitRecord(ev)).catch(() => {}); } catch {} };
  // Event ids are this document's: a page navigated to starts counting again.
  const doc = Math.random().toString(36).slice(2, 10);
  const valueOf = (el) => (el.isContentEditable ? el.innerText : el.value);
  const selected = (el) => (el.multiple ? [...el.selectedOptions].map((o) => o.value) : el.value);
  const isText = (el) => !!el && (el.tagName === "TEXTAREA" || el.isContentEditable || (el.tagName === "INPUT" && !["checkbox", "radio", "button", "submit", "reset", "range", "color", "file"].includes((el.type || "text").toLowerCase())));
  let lastSnap = null;
  const snap = () => (lastSnap = rec().observe());
  const volatile = new Set();
  let id = 0, open = null, quiet = null, cap = null, lastEvent = 0, prevIdle = null;
  const sig = (e) => JSON.stringify([e.text, e.value, e.checked, e.states, e.visible]);
  setInterval(() => {
    if (!rec() || open || Date.now() - lastEvent < 500) return;
    const s = snap();
    if (prevIdle) {
      const was = new Map(prevIdle.elements.map((e) => [e.key, sig(e)]));
      for (const e of s.elements) if (was.has(e.key) && was.get(e.key) !== sig(e)) volatile.add(e.key);
    }
    prevIdle = s;
  }, 450);
  // The previous step's "after" is the next one's "before" when something new happens first.
  const close = (at) => {
    if (!open) return;
    const o = open;
    open = null;
    clearTimeout(quiet); clearTimeout(cap);
    call({ type: "after", id: o, after: at || snap(), volatile: [...volatile] });
    prevIdle = null;
  };
  const mo = new MutationObserver(() => { if (open) { clearTimeout(quiet); quiet = setTimeout(() => close(), 400); } });
  const watch = () => { if (document.documentElement) mo.observe(document.documentElement, { subtree: true, childList: true, attributes: true, characterData: true }); };
  watch();
  const begin = (ev, before) => {
    close(before);
    lastEvent = Date.now();
    open = doc + ":" + ++id;
    call({ ...ev, id: open, before, volatile: [...volatile] });
    quiet = setTimeout(() => close(), 400);
    cap = setTimeout(() => close(), 2000);
  };
  let field = null;
  const flush = () => {
    if (!field) return;
    const f = field;
    field = null;
    if (f.told) call({ type: "typed", id: doc });
    if (valueOf(f.el) === f.sent) return;
    begin({ type: "fill", target: rec().describe(f.el), value: valueOf(f.el) }, f.before);
  };
  const arm = (el) => { if (!field || field.el !== el) { flush(); field = { el, before: snap(), sent: valueOf(el) }; } };
  // Stopping: the field being typed in is a step, and the step still open is closed.
  window.__vlmkitFinish = async () => { flush(); close(); await lastCall; };
  document.addEventListener("focusin", (e) => { if (rec() && isText(e.target)) arm(e.target); }, true);
  document.addEventListener("focusout", (e) => { if (rec() && field && e.target === field.el) flush(); }, true);
  // Node is told a field holds an edit not yet sent, so a window closed mid-edit is counted as lost.
  // beforeinput comes before the value changes: a field cleared by the page after Enter is armed
  // with its cleared value, so a one-character edit is still an edit.
  document.addEventListener("beforeinput", (e) => { if (rec() && isText(e.target)) arm(e.target); }, true);
  document.addEventListener("input", (e) => {
    if (!rec() || !isText(e.target)) return;
    arm(e.target);
    if (!field.told) { field.told = true; call({ type: "typing", id: doc }); }
  }, true);
  // A select's change fires after its value changed: the page before it had the value it had on focus.
  const selectWas = new WeakMap();
  document.addEventListener("focusin", (e) => { if (rec() && e.target.tagName === "SELECT") selectWas.set(e.target, selected(e.target)); }, true);
  window.addEventListener("click", (e) => {
    if (!e.isTrusted || !rec()) return;
    const el = e.target.closest ? e.target.closest(rec().INTERACTIVE) || e.target : e.target;
    if (!el || el.tagName === "SELECT" || el.tagName === "OPTION" || isText(el)) return;
    if (el.tagName === "LABEL" && el.control) return;
    flush();
    const before = snap();
    if (el.tagName === "INPUT" && (el.type === "checkbox" || el.type === "radio")) {
      // The box is already toggled when click is dispatched: the page before it had the other state.
      const key = rec().keyOf(el);
      for (const o of before.elements) if (o.key === key) o.checked = !el.checked;
      begin({ type: el.checked ? "check" : "uncheck", target: rec().describe(el) }, before);
      return;
    }
    begin({ type: "click", target: rec().describe(el) }, before);
  }, true);
  window.addEventListener("change", (e) => {
    if (!rec() || e.target.tagName !== "SELECT") return;
    flush();
    const el = e.target;
    // Its value before: from focus, else from the last time the page was read.
    const key = rec().keyOf(el);
    const prev = selectWas.has(el) ? selectWas.get(el) : lastSnap && (lastSnap.elements.find((o) => o.key === key) || {}).value;
    const before = snap();
    if (prev !== undefined) for (const o of before.elements) if (o.key === key) o.value = prev;
    selectWas.set(el, selected(el));
    begin({ type: "select", target: rec().describe(el), value: selected(el) }, before);
  }, true);
  window.addEventListener("keydown", (e) => {
    if (!e.isTrusted || !rec()) return;
    const el = document.activeElement;
    const text = isText(el);
    const keys = ["Escape", "Tab", "ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "Home", "End"];
    // Held modifiers are part of the key: Shift+Tab goes back.
    const mods = (e.ctrlKey ? "Control+" : "") + (e.altKey ? "Alt+" : "") + (e.metaKey ? "Meta+" : "") + (e.shiftKey ? "Shift+" : "");
    if (e.key === "Enter" && text) {
      flush();
      begin({ type: "press", key: mods + "Enter", target: rec().describe(el) }, snap());
      // The page's own handler may clear the field after this listener; typing again re-arms it.
    } else if (keys.includes(e.key) && !(text && e.key.startsWith("Arrow"))) {
      flush();
      const target = el && el !== document.body && el !== document.documentElement ? rec().describe(el) : undefined;
      begin({ type: "press", key: mods + e.key, ...(target ? { target } : {}) }, snap());
    }
  }, true);
})()`;

const settle = async (page: Page, ms = 250) => {
  await page.waitForLoadState("domcontentloaded").catch(() => {});
  await page
    .evaluate(
      (wait) =>
        new Promise<void>((r) => requestAnimationFrame(() => requestAnimationFrame(() => setTimeout(() => r(), wait)))),
      ms,
    )
    .catch(() => {});
};

const describeEl = (e: RecordedElement) =>
  `${e.role ?? e.tag}${e.name ? ` ${JSON.stringify(e.name.slice(0, 60))}` : e.text ? ` ${JSON.stringify(e.text.slice(0, 60))}` : ""}`;

/** The locator candidates an element's fields offer, best first, before any is verified. */
function candidates(e: RecordedElement): LocatorCandidate[] {
  const out: LocatorCandidate[] = [];
  if (e.testId) out.push({ by: "testid", value: e.testId });
  if (e.role && e.name && e.name.length <= 120) out.push({ by: "role", role: e.role, name: e.name });
  if (e.label) out.push({ by: "label", value: e.label });
  if (e.placeholder) out.push({ by: "placeholder", value: e.placeholder });
  if (e.text && e.text.length <= 80 && !e.interactive) out.push({ by: "text", value: e.text });
  out.push({ by: "css", value: e.css });
  return out;
}

function playwrightLocator(page: Page, c: LocatorCandidate): Locator {
  switch (c.by) {
    case "testid":
      return page.getByTestId(c.value);
    case "role":
      return page.getByRole(c.role as Parameters<Page["getByRole"]>[0], { name: c.name, exact: true });
    case "label":
      return page.getByLabel(c.value, { exact: true });
    case "placeholder":
      return page.getByPlaceholder(c.value, { exact: true });
    case "text":
      return page.getByText(c.value, { exact: true });
    case "css":
      return page.locator(c.value);
  }
}

/**
 * The verified locators for an element. Present on the page: each candidate must resolve, through
 * Playwright, to exactly this element. Gone from it (a hidden expectation, or a click that removed
 * its own button): a candidate must resolve to nothing visible now, and for a step's target the
 * page's own count when it was read must have been one.
 */
async function verify(
  page: Page,
  e: RecordedElement,
  mode: "present" | "gone",
  options: { notByText?: boolean } = {},
): Promise<TraceTarget | null> {
  const ok: LocatorCandidate[] = [];
  // Present and shown: Playwright decides. Gone, or hidden by the step itself (a dialog's button
  // that closed its dialog): the page's own count when the target was read decides.
  const present =
    mode === "present" && (await page.locator(`[data-vlmkit-key="${e.key}"]`).filter({ visible: true }).count()) > 0;
  for (const c of candidates(e)) {
    // An element held to its text cannot be found by that text: the mutant that changes it would
    // not be found, not fail on the value.
    if (options.notByText && (c.by === "text" || (c.by === "role" && c.name === e.text))) continue;
    const loc = playwrightLocator(page, c);
    try {
      if (present) {
        if ((await loc.count()) !== 1) continue;
        if ((await loc.getAttribute("data-vlmkit-key", { timeout: 1000 })) !== e.key) continue;
      } else {
        const inPage =
          c.by === "css" ||
          (c.by === "testid" && e.unique?.testId) ||
          (c.by === "role" && e.unique?.role) ||
          (c.by === "label" && e.unique?.label) ||
          (c.by === "placeholder" && e.unique?.placeholder) ||
          (c.by === "text" && e.unique?.text);
        if (mode === "present" && !inPage) continue; // the element is gone, and the page never said this was unique
        if (mode === "gone" && (await loc.filter({ visible: true }).count()) !== 0) continue;
      }
      ok.push(c);
    } catch {
      /* a candidate Playwright cannot evaluate is not one */
    }
  }
  return ok.length ? { locators: ok, describe: describeEl(e) } : null;
}

export interface RecorderOptions {
  recordedBy: string;
  colorScheme?: "light" | "dark";
  reducedMotion?: "reduce" | "no-preference";
}

interface HumanEvent extends Partial<Omit<RawStep, "type">> {
  type: RawStep["type"] | "after" | "typing" | "typed";
  id: string;
  before?: RecordedObservation;
  after?: RecordedObservation;
  volatile?: string[];
}

export interface RawStep {
  type: "click" | "fill" | "select" | "check" | "uncheck" | "press" | "goto";
  target?: RecordedElement;
  value?: string | string[];
  key?: string;
  url?: string;
}

export class TraceRecorder {
  private page: Page;
  private last: RecordedObservation | null = null;
  private steps: TraceStep[] = [];
  private queue: Promise<void> = Promise.resolve();
  private startUrl = "";
  private dropped = 0;

  constructor(
    page: Page,
    private options: RecorderOptions,
  ) {
    this.page = page;
  }

  /** How many observed changes were left out because no locator resolved to their element. */
  get droppedExpectations(): number {
    return this.dropped;
  }

  async start(): Promise<void> {
    await this.page.addInitScript(RECORDER_SCRIPT);
    await this.page.evaluate(RECORDER_SCRIPT);
    if (!this.startUrl) this.startUrl = this.page.url();
    this.last = await this.observe();
  }

  /** The page a rolled-back driver reopened (and replayed the kept steps on); read afresh. */
  async rebind(page: Page): Promise<void> {
    this.page = page;
    await this.start();
  }

  /** How many steps are recorded: a driver compares it across an action to know whether one was added. */
  get stepCount(): number {
    return this.steps.length;
  }

  /** Forget the last step (the driver rolled it back). */
  discardLast(): void {
    this.steps.pop();
  }

  private async observe(): Promise<RecordedObservation> {
    await this.page.evaluate(RECORDER_SCRIPT).catch(() => {});
    return (await this.page.evaluate("window.__vlmkitRec.observe()")) as RecordedObservation;
  }

  /** Describe the element a locator resolves to, before acting on it. */
  async describe(locator: Locator): Promise<RecordedElement> {
    await this.page.evaluate(RECORDER_SCRIPT).catch(() => {});
    return (await locator.evaluate((el) =>
      (window as unknown as { __vlmkitRec: { describe(e: Element): unknown } }).__vlmkitRec.describe(el),
    )) as RecordedElement;
  }

  /** A driver's step: describe its target, run it, and record what it changed. */
  async step(
    run: () => Promise<void>,
    raw: Omit<RawStep, "target"> & { locator?: Locator },
  ): Promise<TraceStep | null> {
    const before = this.last ?? (await this.observe());
    const target = raw.locator ? await this.describe(raw.locator) : undefined;
    const action = await this.toAction({ ...raw, ...(target ? { target } : {}) }, "present");
    await run();
    return this.record(before, action, target?.key);
  }

  private async toAction(raw: RawStep, mode: "present" | "gone"): Promise<TraceAction | null> {
    if (raw.type === "goto") return { action: "goto", url: raw.url! };
    const target = raw.target ? await verify(this.page, raw.target, mode) : null;
    if (raw.type === "press") return { action: "press", key: raw.key!, ...(target ? { target } : {}) };
    if (!target) return null;
    if (raw.type === "select") return { action: "select", target, value: raw.value ?? "" };
    if (raw.type === "fill") return { action: "fill", target, value: String(raw.value ?? "") };
    return { action: raw.type, target };
  }

  private async record(
    before: RecordedObservation,
    action: TraceAction | null,
    targetKey?: string,
  ): Promise<TraceStep | null> {
    await settle(this.page);
    const after = await this.observe();
    await this.page.waitForTimeout(350);
    const again = await this.observe();
    this.last = again;
    if (!action) return null;
    return this.finish(before, after, again, action, targetKey);
  }

  private async finish(
    before: PageObservation,
    after: PageObservation,
    again: PageObservation,
    action: TraceAction,
    targetKey?: string,
    volatile: Set<string> = new Set(),
  ): Promise<TraceStep> {
    const changes = diffObservations(before, after, again, targetKey).filter(
      (c) =>
        (!("element" in c) || !volatile.has(c.element.key)) &&
        // Typing moves focus nowhere: a fill is read when the next action begins, whose mousedown has moved it.
        !(action.action === "fill" && c.kind === "focused"),
    );
    const expect: TraceExpectation[] = [];
    for (const c of changes) {
      if (expect.length >= MAX_EXPECTATIONS_PER_STEP) break;
      const e = await this.expectation(c);
      if (e) expect.push(e);
      else this.dropped++;
    }
    const step = { action, expect };
    this.steps.push(step);
    return step;
  }

  private async expectation(c: ObservedChange): Promise<TraceExpectation | null> {
    if (c.kind === "url") return { kind: "url", path: c.path };
    const target = await verify(this.page, c.element as RecordedElement, c.kind === "hidden" ? "gone" : "present", {
      notByText: c.kind === "text",
    });
    if (!target) return null;
    switch (c.kind) {
      case "state":
        return { kind: "state", target, attr: c.attr, value: c.value };
      case "checked":
        return { kind: "checked", target, value: c.value };
      case "value":
        return { kind: "value", target, value: c.value };
      case "text":
        return { kind: "text", target, value: c.value };
      default:
        return { kind: c.kind, target };
    }
  }

  /**
   * Record what a person does in the page until `stop()`: each click, change, fill and key the
   * page reports, in order, with the page as it was right before it and once it settled, and a
   * navigation nothing on the page started as a `goto`.
   */
  async listen(): Promise<void> {
    await this.page.exposeBinding("__vlmkitRecord", (_src, ev: HumanEvent) => {
      if (ev.type === "typing" || ev.type === "typed") {
        this.typing = ev.type === "typing";
        return;
      }
      if (ev.type === "after") {
        const waiting = this.afters.get(ev.id);
        if (waiting) waiting(ev);
        else this.afterSeen.set(ev.id, ev);
        return;
      }
      this.lastEventAt = Date.now();
      this.queue = this.queue
        .then(() => this.human(ev))
        .catch(() => {
          this.lost++;
        });
    });
    await this.page.addInitScript(LISTEN_SCRIPT);
    await this.page.evaluate(LISTEN_SCRIPT);
    this.page.on("framenavigated", (frame) => {
      if (frame !== this.page.mainFrame()) return;
      this.navigations++;
      this.typing = false; // a new document holds no edit yet
      if (Date.now() - this.lastEventAt < 1500) return; // a click or a submit started it
      const url = frame.url();
      this.queue = this.queue
        .then(async () => {
          await this.record(await this.observe(), { action: "goto", url });
        })
        .catch(() => {});
    });
  }

  private lastEventAt = 0;
  private navigations = 0;
  private afters = new Map<string, (ev: HumanEvent) => void>();
  private afterSeen = new Map<string, HumanEvent>();
  private lost = 0;
  private typing = false;

  /** Events the page reported that could not be recorded (the window closed before they were read). */
  get lostSteps(): number {
    return this.lost;
  }

  /** The page's "after" for an event, or none when the page navigated away before it settled. */
  private waitAfter(id: string, navigationsAtStart: number): Promise<HumanEvent | null> {
    const seen = this.afterSeen.get(id);
    if (seen) {
      this.afterSeen.delete(id);
      return Promise.resolve(seen);
    }
    return new Promise((resolve) => {
      const timer = setInterval(() => {
        if (this.navigations !== navigationsAtStart || Date.now() > deadline) {
          clearInterval(timer);
          this.afters.delete(id);
          const late = this.afterSeen.get(id) ?? null;
          this.afterSeen.delete(id);
          resolve(late);
        }
      }, 50);
      const deadline = Date.now() + 3000;
      this.afters.set(id, (ev) => {
        clearInterval(timer);
        this.afters.delete(id);
        this.afterSeen.delete(id);
        resolve(ev);
      });
    });
  }

  private async human(ev: HumanEvent): Promise<void> {
    const navs = this.navigations;
    const done = await this.waitAfter(ev.id, navs);
    let after = done?.after ?? null;
    if (!after) {
      await settle(this.page);
      after = await this.observe();
    }
    const action = await this.toAction(ev as RawStep, "present");
    // Volatile: what the page saw change on its own, and what changes between two reads now.
    const volatile = new Set([...(ev.volatile ?? []), ...(done?.volatile ?? [])]);
    const r1 = await this.observe();
    await this.page.waitForTimeout(300);
    const r2 = await this.observe();
    const sig = (e: ObservedElement) => JSON.stringify([e.text, e.value, e.checked, e.states, e.visible]);
    const was = new Map(r1.elements.map((e) => [e.key, sig(e)]));
    for (const e of r2.elements) if (was.has(e.key) && was.get(e.key) !== sig(e)) volatile.add(e.key);
    this.last = r2;
    if (!action) return;
    await this.finish(ev.before!, after, after, action, ev.target?.key, volatile);
  }

  /** Resolves when every event reported so far has been recorded. */
  idle(): Promise<void> {
    return this.queue;
  }

  /** Wait for every reported event to be recorded, and return the trace. */
  async stop(): Promise<SessionTrace> {
    const finished = await this.page
      .evaluate(() => (window as unknown as { __vlmkitFinish?: () => Promise<void> }).__vlmkitFinish?.())
      .then(() => true)
      .catch(() => false);
    // The window closed while a field held an edit: that fill never reached here.
    if (!finished && this.typing) this.lost++;
    await this.queue;
    const viewport = this.page.viewportSize() ?? { width: 1280, height: 800 };
    return {
      format: TRACE_FORMAT,
      source: { recordedBy: this.options.recordedBy, url: this.startUrl },
      start: {
        url: this.startUrl,
        viewport,
        ...(this.options.colorScheme ? { colorScheme: this.options.colorScheme } : {}),
        ...(this.options.reducedMotion ? { reducedMotion: this.options.reducedMotion } : {}),
      },
      steps: this.steps,
    };
  }
}
