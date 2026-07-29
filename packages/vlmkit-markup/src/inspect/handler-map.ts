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
import { fileURLToPath, pathToFileURL } from "node:url";
import { handleCliError } from "@mizchi/vlmkit-core/cli-error.ts";
import { appendRunLedger } from "@mizchi/vlmkit-core/run-ledger.ts";
import { BOLD, CYAN, DIM, GREEN, RED, RESET, YELLOW } from "@mizchi/vlmkit-core/terminal-colors.ts";
import { DISCOVER_SCRIPT } from "./interaction-map.ts";

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
}

export interface HandlerSurface {
  source: string;
  elements: HandlerSurfaceEntry[];
  /** window/document registrations: type -> count. */
  globals: Record<string, number>;
  totalRegistrations: number;
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

const COMMON_ON_PROPS = [
  "onclick", "ondblclick", "onmousedown", "onmouseup", "onpointerdown", "onpointerup",
  "onkeydown", "onkeyup", "onkeypress", "oninput", "onchange", "onsubmit",
  "onfocus", "onblur", "onmouseover", "onmouseenter", "ontouchstart",
];

/**
 * Serialize the recorded registrations + on*-scan into a per-element
 * surface. Runs AFTER DISCOVER_SCRIPT so data-vlmkit-ix stamps exist.
 */
const COLLECT_SURFACE_SCRIPT = `
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
      text: (el.textContent || "").replace(/\\s+/g, " ").trim().slice(0, 40),
      types,
      samples,
      visible: style.display !== "none" && style.visibility !== "hidden" && rect.width > 0 && rect.height > 0,
      containsInteractive: !!el.querySelector("[data-vlmkit-ix]"),
      insideInteractive: !!(el.parentElement && el.parentElement.closest("[data-vlmkit-ix]")),
    });
  }
  return { elements: out, globals, total };
})()
`;

export async function buildHandlerSurface(options: { source: string }): Promise<HandlerSurface> {
  const { chromium } = await import("playwright");
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
    await page.addInitScript(HANDLER_PATCH_SCRIPT);
    const url = /^(https?|file):\/\//.test(options.source)
      ? options.source
      : pathToFileURL(resolve(options.source)).href;
    await page.goto(url, { waitUntil: "load", timeout: 30000 });
    await page.evaluate(DISCOVER_SCRIPT); // stamp interactive elements for cross-referencing
    const raw = await page.evaluate(COLLECT_SURFACE_SCRIPT) as {
      elements: HandlerSurfaceEntry[];
      globals: Record<string, number>;
      total: number;
    };
    return {
      source: options.source,
      elements: raw.elements,
      globals: raw.globals,
      totalRegistrations: raw.total,
    };
  } finally {
    await browser.close();
  }
}

// ---------------------------------------------------------------------------
// Cross-check issues

const POINTER_TYPES = new Set(["click", "dblclick", "mousedown", "mouseup", "pointerdown", "pointerup", "touchstart"]);
const KEYBOARD_TYPES = new Set(["keydown", "keyup", "keypress"]);

/** Event types the interaction probes actually fire. */
export const PROBED_TYPES = new Set(["click", "keydown", "keyup", "keypress", "focus", "blur"]);

export interface HandlerIssue {
  kind: "pointer-only-control" | "unprobed-handler-types";
  severity: "warn" | "suspect";
  element: string;
  message: string;
}

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
  for (const e of surface.elements) {
    const hasPointer = Object.keys(e.types).some((t) => POINTER_TYPES.has(t));
    const hasKeyboard = Object.keys(e.types).some((t) => KEYBOARD_TYPES.has(t));
    for (const t of Object.keys(e.types)) {
      if (!PROBED_TYPES.has(t)) unprobedTypes.add(t);
    }
    if (
      hasPointer && !hasKeyboard
      && e.ix === null
      && e.visible
      && !e.containsInteractive
      && !e.insideInteractive
    ) {
      issues.push({
        kind: "pointer-only-control",
        severity: "suspect",
        element: `${e.path} "${e.text}"`,
        message: `${e.path} "${e.text}" has a ${Object.keys(e.types).filter((t) => POINTER_TYPES.has(t)).join("/")} handler but no role, no keyboard handler, and no interactive descendant — mouse users can operate it, keyboard and assistive-tech users cannot. Give it a role + tabindex + key handling, or move the handler onto a real control.`,
      });
    }
  }
  if (unprobedTypes.size > 0) {
    issues.push({
      kind: "unprobed-handler-types",
      severity: "warn",
      element: "(page)",
      message: `Handler types registered but NOT covered by the interaction probes: ${[...unprobedTypes].sort().join(", ")} — verify those paths manually or with an interact sequence.`,
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
  lines.push(`status: ${suspects === 0 ? `${GREEN}ok${RESET}` : `${RED}${suspects} suspect issue(s)${RESET}`}`);
  lines.push(`registrations: ${surface.totalRegistrations} across ${surface.elements.length} element(s)${Object.keys(surface.globals).length > 0 ? ` + globals` : ""}`);
  lines.push("");
  for (const e of surface.elements) {
    const types = Object.entries(e.types).map(([t, n]) => (n > 1 ? `${t}×${n}` : t)).join(", ");
    const badge = e.ix !== null ? "" : e.containsInteractive ? ` ${DIM}(delegation container)${RESET}` : e.insideInteractive ? ` ${DIM}(inside a control)${RESET}` : ` ${YELLOW}(no role)${RESET}`;
    lines.push(`  - ${e.path} "${e.text}": ${types}${badge}`);
  }
  if (Object.keys(surface.globals).length > 0) {
    lines.push(`  - globals: ${Object.entries(surface.globals).map(([k, n]) => (n > 1 ? `${k}×${n}` : k)).join(", ")}`);
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

function printUsage(exitCode: number): never {
  console.log(`Usage: vlmkit scan handlers <html-or-url> [options]

Enumerates every event callback wired on the page (addEventListener
via an init-script patch + on* attributes/properties) into a
per-element event surface, and cross-checks it against the a11y
interaction discovery. Headline detection: pointer-only controls —
click handlers on role-less elements no keyboard user can operate.

Framework caveat: React-style root delegation appears as one listener
on the delegation root; per-element granularity is a vanilla/Web
Components property.

Options:
  --json    Print JSON report`);
  process.exit(exitCode);
}

async function main(argv = process.argv.slice(2)): Promise<void> {
  if (argv.includes("--help") || argv.includes("-h")) printUsage(0);
  const json = argv.includes("--json");
  const source = argv.find((a) => !a.startsWith("-"));
  if (!source) printUsage(1);

  const surface = await buildHandlerSurface({ source });
  const issues = deriveHandlerIssues(surface);
  appendRunLedger({
    tool: "scan-handlers",
    source,
    headline: {
      registrations: surface.totalRegistrations,
      elements: surface.elements.length,
      suspects: issues.filter((i) => i.severity === "suspect").length,
    },
  });
  if (json) console.log(JSON.stringify({ surface, issues }, null, 2));
  else console.log(formatHandlerSurface(surface, issues));
  if (issues.some((i) => i.severity === "suspect")) process.exit(1);
}

const isCliEntry = process.env.__VRT_DISPATCHER_LEAF__ === "handler-map" ||
  (process.argv[1] ? resolve(process.argv[1]) === fileURLToPath(import.meta.url) : false);
if (isCliEntry) {
  main().catch(handleCliError);
}
