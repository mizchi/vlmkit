#!/usr/bin/env node
/**
 * Reference-free page integrity gate (`check integrity`).
 *
 * The reference-full gates (verify markup, check copy --target) need a
 * target image or manifest. Creative/zero-shot markup has neither —
 * but a page can still be *defective* in ways that need no reference:
 * JS errors that stopped UI construction, an empty render, broken
 * resources, colliding or clipped text, collapsed containers,
 * horizontal page overflow, and a stylesheet that never applied.
 *
 * This is Layer A of docs/design/creative-markup-eval.md: every probe
 * is deterministic (DOM measurement + pixel math), every finding
 * carries selector attribution, and every *exempted* candidate is kept
 * in the report with its reason — exemption is the tool's judgment,
 * never the consuming agent's.
 *
 * Defect classes (A1-A9):
 *   A1 js-error            pageerror/console.error, construction vs post-load
 *   A2 degenerate-render   screenshot has no components / almost no ink
 *   A3 broken-image / failed-stylesheet / broken-font
 *   A4 text-collision      in-flow text blocks overlap (overlay layers exempt)
 *   A5 text-clipped        text cut behind overflow:hidden (ellipsis exempt)
 *   A6 collapsed-container zero-height box with tall in-flow children
 *   A7 page-overflow-x / clipped-content / nested-scroll (scan scroll reuse)
 *   A8 unstyled-page       stylesheets declared but the page renders UA-default
 *   A9 all of the above swept across multiple viewports
 *
 * CLI:
 *   vlmkit check integrity <html-or-url> [--viewports 1280,768,375] [--json]
 */
import { resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { PNG } from "pngjs";
import { handleCliError } from "@mizchi/vlmkit-core/cli-error.ts";
import { appendRunLedger } from "@mizchi/vlmkit-core/run-ledger.ts";
import { BOLD, CYAN, DIM, GREEN, RED, RESET, YELLOW } from "@mizchi/vlmkit-core/terminal-colors.ts";
import { extractComponentsFromRgba } from "../component/component-bbox.ts";
import { analyzeScrollSamples, COLLECT_SCROLL_SCRIPT, type ScrollScanInput } from "./scroll-scan.ts";

export type IntegrityFindingKind =
  | "js-error"
  | "degenerate-render"
  | "broken-image"
  | "failed-stylesheet"
  | "broken-font"
  | "text-collision"
  | "text-clipped"
  | "collapsed-container"
  | "page-overflow-x"
  | "clipped-content"
  | "nested-scroll"
  | "unstyled-page";

export interface IntegrityFinding {
  kind: IntegrityFindingKind;
  /** fail = defect (flips the verdict); warn = suspicious but not conclusive. */
  severity: "fail" | "warn";
  /** Viewport width the finding was first observed at. */
  viewport: number;
  selector?: string;
  message: string;
  evidence?: Record<string, unknown>;
}

/**
 * A candidate the tool matched but exempted on an intentional-pattern
 * rule. Kept in the report so the exemption is visibly the TOOL's
 * judgment — a reviewing agent audits the rule, it does not re-litigate
 * the finding.
 */
export interface IntegrityExemption {
  kind: IntegrityFindingKind;
  viewport: number;
  selector?: string;
  reason: string;
}

export interface IntegrityViewportStats {
  width: number;
  height: number;
  components: number;
  inkRatio: number;
  textBlocks: number;
}

export interface IntegrityReport {
  source: string;
  verdict: "clean" | "defects";
  findings: IntegrityFinding[];
  exempted: IntegrityExemption[];
  viewports: IntegrityViewportStats[];
  /** Paste-ready fix list, one line per fail/warn, selector-attributed. */
  kickback: string[];
}

// ---------------------------------------------------------------------------
// A1 — runtime errors

export interface RuntimeEvent {
  type: "pageerror" | "console-error";
  text: string;
  /** Whether the error fired before or after the window load event. */
  phase: "construction" | "post-load";
}

export function classifyRuntimeEvents(events: RuntimeEvent[], viewport: number): IntegrityFinding[] {
  const findings: IntegrityFinding[] = [];
  for (const e of events) {
    if (e.type === "pageerror") {
      const fatal = e.phase === "construction";
      findings.push({
        kind: "js-error",
        severity: fatal ? "fail" : "warn",
        viewport,
        message: fatal
          ? `Uncaught exception during construction (before load): ${e.text} — the UI likely failed to build; fix the script before styling.`
          : `Uncaught exception after load: ${e.text} — initial render survived, but interactions may be broken.`,
        evidence: { phase: e.phase, text: e.text },
      });
    } else {
      findings.push({
        kind: "js-error",
        severity: "warn",
        viewport,
        message: `console.error during ${e.phase}: ${e.text}`,
        evidence: { phase: e.phase, text: e.text, channel: "console" },
      });
    }
  }
  return findings;
}

// ---------------------------------------------------------------------------
// A2 — degenerate render (pixel side)

/** Fraction of pixels that differ from the corner-sampled background. */
export function measureInkRatio(data: Uint8Array, width: number, height: number, tolerance = 12): number {
  if (width <= 0 || height <= 0) return 0;
  const corners = [
    0,
    (width - 1) * 4,
    (height - 1) * width * 4,
    ((height - 1) * width + width - 1) * 4,
  ];
  const counts = new Map<string, { n: number; r: number; g: number; b: number }>();
  for (const i of corners) {
    const r = data[i]!, g = data[i + 1]!, b = data[i + 2]!;
    const k = `${r >> 3},${g >> 3},${b >> 3}`;
    const c = counts.get(k) ?? { n: 0, r: 0, g: 0, b: 0 };
    c.n++; c.r += r; c.g += g; c.b += b;
    counts.set(k, c);
  }
  let bg = { n: -1, r: 255, g: 255, b: 255 };
  for (const c of counts.values()) if (c.n > bg.n) bg = c;
  const bgR = Math.round(bg.r / bg.n), bgG = Math.round(bg.g / bg.n), bgB = Math.round(bg.b / bg.n);
  let ink = 0;
  const total = width * height;
  for (let p = 0; p < total; p++) {
    const i = p * 4;
    if (Math.abs(data[i]! - bgR) > tolerance
      || Math.abs(data[i + 1]! - bgG) > tolerance
      || Math.abs(data[i + 2]! - bgB) > tolerance) ink++;
  }
  return ink / total;
}

export interface RenderStats {
  componentCount: number;
  inkRatio: number;
  /** DOM-side text blocks — a text-only page has few extractable components
   * (glyphs fall under minArea) but is NOT degenerate. */
  textBlocks: number;
}

export function judgeRender(stats: RenderStats, viewport: number): IntegrityFinding | null {
  const { componentCount, inkRatio, textBlocks } = stats;
  if (componentCount === 0 && textBlocks === 0) {
    return {
      kind: "degenerate-render",
      severity: "fail",
      viewport,
      message: `The rendered page contains no visual components and no text (ink ratio ${(inkRatio * 100).toFixed(2)}%) — nothing but background painted. Usual causes: a construction-phase JS error, a failed stylesheet, or content never appended to the DOM.`,
      evidence: { componentCount, inkRatio, textBlocks },
    };
  }
  if (textBlocks > 0 && inkRatio < 0.001 && componentCount === 0) {
    return {
      kind: "degenerate-render",
      severity: "fail",
      viewport,
      message: `The DOM holds ${textBlocks} text block(s) but almost nothing painted (ink ratio ${(inkRatio * 100).toFixed(2)}%) — the text is likely invisible (foreground equals background, zero-size font, or off-screen).`,
      evidence: { componentCount, inkRatio, textBlocks },
    };
  }
  if (inkRatio < 0.005 && componentCount < 3 && textBlocks < 5) {
    return {
      kind: "degenerate-render",
      severity: "warn",
      viewport,
      message: `Near-empty render: ${componentCount} component(s), ${textBlocks} text block(s), ${(inkRatio * 100).toFixed(2)}% ink. If the brief calls for a full page, most of it is missing.`,
      evidence: { componentCount, inkRatio, textBlocks },
    };
  }
  return null;
}

// ---------------------------------------------------------------------------
// A3 — broken resources

export interface ResourceSample {
  brokenImages: { selector: string; src: string }[];
  brokenFonts: string[];
}

export function judgeResources(sample: ResourceSample, viewport: number): IntegrityFinding[] {
  const findings: IntegrityFinding[] = [];
  for (const img of sample.brokenImages) {
    findings.push({
      kind: "broken-image",
      severity: "fail",
      viewport,
      selector: img.selector,
      message: `${img.selector} failed to load its image (${img.src}) — naturalWidth is 0; the page shows a broken-image box or nothing.`,
      evidence: { src: img.src },
    });
  }
  for (const family of sample.brokenFonts) {
    findings.push({
      kind: "broken-font",
      severity: "warn",
      viewport,
      message: `@font-face "${family}" failed to load — text falls back to the next family in the stack.`,
      evidence: { family },
    });
  }
  return findings;
}

/**
 * Subresource load failures observed on the wire (requestfailed +
 * non-OK responses). This is the authoritative stylesheet/script/font
 * detector: Chromium attaches an empty CSSStyleSheet to a 404
 * `<link>` — `link.sheet != null` even when the file never existed —
 * so DOM-side checks cannot see a dead stylesheet.
 */
export interface NetworkFailure {
  url: string;
  /** Playwright resourceType: stylesheet | image | font | script | fetch | xhr | ... */
  resourceType: string;
  reason: string;
}

export function judgeNetworkFailures(failures: NetworkFailure[], viewport: number): IntegrityFinding[] {
  const findings: IntegrityFinding[] = [];
  for (const f of failures) {
    const tail = f.url.split("/").pop() ?? f.url;
    switch (f.resourceType) {
      case "stylesheet":
        findings.push({
          kind: "failed-stylesheet",
          severity: "fail",
          viewport,
          message: `Stylesheet ${tail} failed to load (${f.reason}) — its rules are not applied.`,
          evidence: { url: f.url, reason: f.reason },
        });
        break;
      case "script":
        findings.push({
          kind: "js-error",
          severity: "fail",
          viewport,
          message: `Script ${tail} failed to load (${f.reason}) — everything it builds or wires is missing.`,
          evidence: { url: f.url, reason: f.reason, text: `script-load:${tail}` },
        });
        break;
      case "font":
        findings.push({
          kind: "broken-font",
          severity: "warn",
          viewport,
          message: `Font ${tail} failed to load (${f.reason}) — text falls back to the next family in the stack.`,
          evidence: { url: f.url, reason: f.reason },
        });
        break;
      case "image":
        findings.push({
          kind: "broken-image",
          severity: "fail",
          viewport,
          message: `Image ${tail} failed to load (${f.reason}).`,
          evidence: { url: f.url, reason: f.reason },
        });
        break;
      case "fetch":
      case "xhr":
        findings.push({
          kind: "js-error",
          severity: "warn",
          viewport,
          message: `Data request ${tail} failed (${f.reason}) — content depending on it is missing.`,
          evidence: { url: f.url, reason: f.reason, text: `request:${tail}` },
        });
        break;
      default:
        break;
    }
  }
  return findings;
}

// ---------------------------------------------------------------------------
// A4 — text collision

export interface IntegrityTextBlock {
  selector: string;
  text: string;
  x: number;
  y: number;
  width: number;
  height: number;
  /** Some ancestor (or self) is position:absolute/fixed — an overlay layer. */
  overlay: boolean;
  /** Effective z-index: nearest non-auto value on self/ancestors, else 0. */
  zIndex: number;
  /** Inside an aria-hidden="true" subtree (decorative). */
  ariaHidden: boolean;
}

export interface TextCollisionOptions {
  /** Minimum overlap on each axis (px) before a pair is considered. Default 6. */
  minOverlapPx?: number;
  /** Overlap area / smaller-block area ratio to count as collision. Default 0.25. */
  minOverlapRatio?: number;
  maxFindings?: number;
}

function clip(text: string, n = 40): string {
  return text.length > n ? `${text.slice(0, n - 1)}…` : text;
}

export function findTextCollisions(
  blocks: IntegrityTextBlock[],
  viewport: number,
  options: TextCollisionOptions = {},
): { findings: IntegrityFinding[]; exempted: IntegrityExemption[] } {
  const minPx = options.minOverlapPx ?? 6;
  const minRatio = options.minOverlapRatio ?? 0.25;
  const maxFindings = options.maxFindings ?? 12;
  const raw: { a: IntegrityTextBlock; b: IntegrityTextBlock; ox: number; oy: number; area: number }[] = [];
  const exempted: IntegrityExemption[] = [];

  for (let i = 0; i < blocks.length; i++) {
    for (let j = i + 1; j < blocks.length; j++) {
      const a = blocks[i]!, b = blocks[j]!;
      // One block containing the other is nesting (a wrapper block whose
      // own text and a child block both bucketed), not a collision.
      const ox = Math.min(a.x + a.width, b.x + b.width) - Math.max(a.x, b.x);
      const oy = Math.min(a.y + a.height, b.y + b.height) - Math.max(a.y, b.y);
      if (ox < minPx || oy < minPx) continue;
      const contains = (o: IntegrityTextBlock, p: IntegrityTextBlock) =>
        o.x <= p.x && o.y <= p.y && o.x + o.width >= p.x + p.width && o.y + o.height >= p.y + p.height;
      if (contains(a, b) || contains(b, a)) continue;
      const area = ox * oy;
      const smaller = Math.min(a.width * a.height, b.width * b.height);
      if (smaller <= 0 || area / smaller < minRatio) continue;

      const pair = { a, b, ox, oy, area };
      if (a.ariaHidden || b.ariaHidden) {
        exempted.push({
          kind: "text-collision",
          viewport,
          selector: `${a.selector} x ${b.selector}`,
          reason: "one side is aria-hidden (decorative layer)",
        });
        continue;
      }
      if (a.overlay !== b.overlay) {
        exempted.push({
          kind: "text-collision",
          viewport,
          selector: `${a.selector} x ${b.selector}`,
          reason: "intentional overlay: one block sits in a positioned (absolute/fixed) layer above the flow",
        });
        continue;
      }
      if (a.overlay && b.overlay && a.zIndex !== b.zIndex) {
        exempted.push({
          kind: "text-collision",
          viewport,
          selector: `${a.selector} x ${b.selector}`,
          reason: `intentional stacking: both are positioned layers with distinct z-index (${a.zIndex} vs ${b.zIndex})`,
        });
        continue;
      }
      raw.push(pair);
    }
  }

  raw.sort((p, q) => q.area - p.area);
  const findings = raw.slice(0, maxFindings).map((p) => ({
    kind: "text-collision" as const,
    severity: "fail" as const,
    viewport,
    selector: `${p.a.selector} x ${p.b.selector}`,
    message: `"${clip(p.a.text)}" (${p.a.selector}) overlaps "${clip(p.b.text)}" (${p.b.selector}) by ${p.ox}x${p.oy}px — same-layer text blocks must not overlap; check negative margins, absolute offsets, or missing clearing.`,
    evidence: { overlapX: p.ox, overlapY: p.oy, a: p.a.selector, b: p.b.selector },
  }));
  if (raw.length > maxFindings) {
    findings.push({
      kind: "text-collision",
      severity: "fail",
      viewport,
      selector: "(page)",
      message: `…and ${raw.length - maxFindings} more colliding pair(s) beyond the report cap — the layout is systematically broken at this width.`,
      evidence: { overlapX: 0, overlapY: 0, a: "(capped)", b: "(capped)" },
    });
  }
  return { findings, exempted };
}

// ---------------------------------------------------------------------------
// A5 — clipped text

export interface ClipCandidate {
  selector: string;
  text: string;
  clipX: number;
  clipY: number;
  textOverflow: string;
  lineClamp: string;
}

export function judgeClippedText(
  candidates: ClipCandidate[],
  viewport: number,
  maxFindings = 12,
): { findings: IntegrityFinding[]; exempted: IntegrityExemption[] } {
  const findings: IntegrityFinding[] = [];
  const exempted: IntegrityExemption[] = [];
  for (const c of candidates) {
    if (c.textOverflow === "ellipsis") {
      exempted.push({ kind: "text-clipped", viewport, selector: c.selector, reason: "text-overflow: ellipsis — intentional truncation" });
      continue;
    }
    if (c.lineClamp !== "none" && c.lineClamp !== "") {
      exempted.push({ kind: "text-clipped", viewport, selector: c.selector, reason: `-webkit-line-clamp: ${c.lineClamp} — intentional truncation` });
      continue;
    }
    if (findings.length >= maxFindings) continue;
    const axis = c.clipX >= c.clipY ? `${c.clipX}px of text horizontally` : `${c.clipY}px of text vertically`;
    findings.push({
      kind: "text-clipped",
      severity: "fail",
      viewport,
      selector: c.selector,
      message: `${c.selector} cuts off ${axis} behind overflow:hidden ("${clip(c.text)}") — readers lose content; widen the box, let it wrap, or add an intentional ellipsis.`,
      evidence: { clipX: c.clipX, clipY: c.clipY },
    });
  }
  return { findings, exempted };
}

// ---------------------------------------------------------------------------
// A6 — collapsed containers

export interface CollapseCandidate {
  selector: string;
  height: number;
  tallestChild: number;
  /** At least one tall child participates in normal flow (not absolute/fixed). */
  anyInFlowChild: boolean;
  overflowHidden: boolean;
}

export function judgeCollapsedContainers(
  candidates: CollapseCandidate[],
  viewport: number,
): { findings: IntegrityFinding[]; exempted: IntegrityExemption[] } {
  const findings: IntegrityFinding[] = [];
  const exempted: IntegrityExemption[] = [];
  for (const c of candidates) {
    if (!c.anyInFlowChild) {
      exempted.push({ kind: "collapsed-container", viewport, selector: c.selector, reason: "zero-height positioning anchor: all tall children are absolute/fixed" });
      continue;
    }
    if (c.overflowHidden) {
      exempted.push({ kind: "collapsed-container", viewport, selector: c.selector, reason: "overflow:hidden collapse — reads as an intentional hide (accordion/animation pattern)" });
      continue;
    }
    findings.push({
      kind: "collapsed-container",
      severity: "fail",
      viewport,
      selector: c.selector,
      message: `${c.selector} is ${c.height}px tall but holds in-flow children up to ${c.tallestChild}px — the container collapsed (classic float/height:0 bug); its content paints over whatever follows.`,
      evidence: { height: c.height, tallestChild: c.tallestChild },
    });
  }
  return { findings, exempted };
}

// ---------------------------------------------------------------------------
// A8 — unstyled page

export interface StyleFingerprint {
  declaredStylesheets: number;
  loadedStylesheets: number;
  styleElements: number;
  inlineStyleAttrs: number;
  uaFont: boolean;
  uaMargin: boolean;
  /** null when the page has no <a> to sample. */
  uaLinkColor: boolean | null;
}

export function judgeUnstyled(fp: StyleFingerprint, viewport: number): IntegrityFinding | null {
  const declaredAny = fp.declaredStylesheets + fp.styleElements > 0;
  if (!declaredAny) return null; // intentionally bare page — not this gate's call
  if (fp.declaredStylesheets > 0 && fp.loadedStylesheets === 0 && fp.styleElements === 0) {
    return {
      kind: "unstyled-page",
      severity: "fail",
      viewport,
      message: `All ${fp.declaredStylesheets} declared stylesheet(s) failed to load and there is no <style> fallback — the page renders with UA defaults.`,
      evidence: { ...fp },
    };
  }
  const uaSignals = [fp.uaFont, fp.uaMargin, fp.uaLinkColor !== false].filter(Boolean).length;
  if (fp.uaFont && fp.uaMargin && uaSignals >= 3) {
    return {
      kind: "unstyled-page",
      severity: "warn",
      viewport,
      message: `The page declares styling (${fp.declaredStylesheets} stylesheet(s), ${fp.styleElements} style element(s)) but renders with the UA-default fingerprint (serif default font, 8px body margin${fp.uaLinkColor === true ? ", default link blue" : ""}) — the CSS may not be reaching the elements.`,
      evidence: { ...fp },
    };
  }
  return null;
}

// ---------------------------------------------------------------------------
// In-page collectors

const STABLE_SELECTOR_FN = `
  function stableSelector(el) {
    const id = el.getAttribute && el.getAttribute("id");
    if (id) return "#" + CSS.escape(id);
    const classes = el.classList ? Array.from(el.classList).slice(0, 3) : [];
    if (classes.length > 0) {
      const selector = el.tagName.toLowerCase() + classes.map((c) => "." + CSS.escape(c)).join("");
      if (document.querySelectorAll(selector).length === 1) return selector;
    }
    const parent = el.parentElement;
    if (!parent) return el.tagName.toLowerCase();
    const siblings = Array.from(parent.children).filter((item) => item.tagName === el.tagName);
    return stableSelector(parent) + " > " + el.tagName.toLowerCase() + ":nth-of-type(" + (siblings.indexOf(el) + 1) + ")";
  }
`;

/** Text blocks with the stacking metadata the collision exemptions need. */
export const COLLECT_INTEGRITY_TEXT = `(() => {
  ${STABLE_SELECTOR_FN}
  const SKIP = new Set(["SCRIPT", "STYLE", "NOSCRIPT", "TEMPLATE"]);
  const buckets = new Map();
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  let node;
  while ((node = walker.nextNode())) {
    const raw = node.nodeValue || "";
    if (!raw.trim()) continue;
    const el = node.parentElement;
    if (!el || SKIP.has(el.tagName)) continue;
    const style = getComputedStyle(el);
    if (style.visibility === "hidden" || style.display === "none" || style.opacity === "0") continue;
    let block = el;
    while (block && block !== document.body) {
      const d = getComputedStyle(block).display;
      if (d !== "inline" && d !== "contents") break;
      block = block.parentElement;
    }
    if (!block) continue;
    const range = document.createRange();
    range.selectNodeContents(node);
    const rects = Array.from(range.getClientRects()).filter((r) => r.width > 0 && r.height > 0);
    if (rects.length === 0) continue;
    let b = buckets.get(block);
    if (!b) {
      let overlay = false;
      let zIndex = 0;
      let zFound = false;
      let ariaHidden = false;
      for (let p = block; p && p !== document.documentElement; p = p.parentElement) {
        const ps = getComputedStyle(p);
        if (ps.position === "absolute" || ps.position === "fixed") overlay = true;
        if (!zFound && ps.zIndex !== "auto") { zIndex = Number(ps.zIndex) || 0; zFound = true; }
        if (p.getAttribute && p.getAttribute("aria-hidden") === "true") ariaHidden = true;
      }
      b = { el: block, parts: [], x1: Infinity, y1: Infinity, x2: -Infinity, y2: -Infinity, overlay, zIndex, ariaHidden };
      buckets.set(block, b);
    }
    b.parts.push(raw);
    for (const r of rects) {
      b.x1 = Math.min(b.x1, r.left + scrollX);
      b.y1 = Math.min(b.y1, r.top + scrollY);
      b.x2 = Math.max(b.x2, r.right + scrollX);
      b.y2 = Math.max(b.y2, r.bottom + scrollY);
    }
  }
  return Array.from(buckets.values())
    .map((b) => ({
      selector: stableSelector(b.el),
      text: b.parts.join(" ").replace(/\\s+/g, " ").trim(),
      x: Math.round(b.x1),
      y: Math.round(b.y1),
      width: Math.round(b.x2 - b.x1),
      height: Math.round(b.y2 - b.y1),
      overlay: b.overlay,
      zIndex: b.zIndex,
      ariaHidden: b.ariaHidden,
    }))
    .filter((t) => t.text.length > 0 && t.width > 1 && t.height > 1)
    .sort((a, b) => a.y - b.y || a.x - b.x);
})()`;

export const COLLECT_CLIP_CANDIDATES = `(() => {
  ${STABLE_SELECTOR_FN}
  const CLIPPING = /^(hidden|clip)$/;
  const out = [];
  for (const el of Array.from(document.querySelectorAll("body *"))) {
    let direct = "";
    for (const n of el.childNodes) if (n.nodeType === 3) direct += n.nodeValue || "";
    if (!direct.trim()) continue;
    const style = getComputedStyle(el);
    if (style.display === "none" || style.visibility === "hidden") continue;
    const clipX = CLIPPING.test(style.overflowX) ? Math.max(0, el.scrollWidth - el.clientWidth) : 0;
    const lineH = parseFloat(style.lineHeight) || 16;
    const clipY = CLIPPING.test(style.overflowY) ? Math.max(0, el.scrollHeight - el.clientHeight) : 0;
    if (clipX < 4 && clipY < Math.max(4, lineH * 0.6)) continue;
    out.push({
      selector: stableSelector(el),
      text: direct.replace(/\\s+/g, " ").trim().slice(0, 80),
      clipX,
      clipY,
      textOverflow: style.textOverflow,
      lineClamp: style.webkitLineClamp || "none",
    });
  }
  return out;
})()`;

export const COLLECT_COLLAPSE_CANDIDATES = `(() => {
  ${STABLE_SELECTOR_FN}
  const out = [];
  for (const el of Array.from(document.querySelectorAll("body *"))) {
    if (el.children.length === 0) continue;
    const style = getComputedStyle(el);
    if (style.display === "none" || style.display === "contents" || style.display.startsWith("inline")) continue;
    if (style.visibility === "hidden") continue;
    const rect = el.getBoundingClientRect();
    if (rect.height > 4 || rect.width <= 0) continue;
    let tallest = 0;
    let anyInFlow = false;
    for (const child of el.children) {
      const cs = getComputedStyle(child);
      if (cs.display === "none" || cs.visibility === "hidden") continue;
      const ch = child.getBoundingClientRect().height;
      if (ch < 24) continue;
      if (ch > tallest) tallest = ch;
      if (cs.position !== "absolute" && cs.position !== "fixed") anyInFlow = true;
    }
    if (tallest === 0) continue;
    out.push({
      selector: stableSelector(el),
      height: Math.round(rect.height),
      tallestChild: Math.round(tallest),
      anyInFlowChild: anyInFlow,
      overflowHidden: /^(hidden|clip)$/.test(style.overflowY),
    });
  }
  return out;
})()`;

export const COLLECT_RESOURCES = `(() => {
  ${STABLE_SELECTOR_FN}
  const brokenImages = [];
  for (const img of Array.from(document.images)) {
    const src = img.getAttribute("src") || "";
    if (!src || src.startsWith("data:")) continue;
    if (img.complete && img.naturalWidth === 0) {
      brokenImages.push({ selector: stableSelector(img), src });
    }
  }
  let brokenFonts = [];
  try {
    brokenFonts = Array.from(document.fonts).filter((f) => f.status === "error").map((f) => f.family);
  } catch { brokenFonts = []; }
  return { brokenImages, brokenFonts: Array.from(new Set(brokenFonts)) };
})()`;

export const COLLECT_STYLE_FINGERPRINT = `(() => {
  const links = Array.from(document.querySelectorAll('link[rel~="stylesheet" i]'));
  const body = getComputedStyle(document.body);
  const a = document.querySelector("a[href]");
  return {
    declaredStylesheets: links.length,
    // Placeholder: link.sheet is non-null even for a 404, so the runner
    // overwrites this from the wire-observed stylesheet failures.
    loadedStylesheets: links.length,
    styleElements: document.querySelectorAll("style").length,
    inlineStyleAttrs: document.querySelectorAll("[style]").length,
    uaFont: /times/i.test(body.fontFamily),
    uaMargin: body.marginLeft === "8px" && body.marginTop === "8px",
    uaLinkColor: a ? getComputedStyle(a).color === "rgb(0, 0, 238)" : null,
  };
})()`;

// ---------------------------------------------------------------------------
// Runner

export interface IntegrityOptions {
  source: string;
  /** Sweep widths (default 1280, 768, 375). */
  viewports?: { width: number; height: number }[];
  maxFindings?: number;
  collision?: TextCollisionOptions;
}

export const DEFAULT_INTEGRITY_VIEWPORTS = [
  { width: 1280, height: 800 },
  { width: 768, height: 900 },
  { width: 375, height: 700 },
];

function isUrl(source: string): boolean {
  return /^(https?|file):\/\//.test(source);
}

function dedupeKey(f: IntegrityFinding): string {
  const extra = f.kind === "js-error"
    ? String(f.evidence?.text ?? f.message)
    : f.kind === "failed-stylesheet" || f.kind === "broken-font" || f.kind === "broken-image"
    ? String(f.evidence?.url ?? f.evidence?.src ?? f.evidence?.family ?? "")
    : "";
  return `${f.kind}|${f.selector ?? ""}|${extra}`;
}

export async function runIntegrityCheck(options: IntegrityOptions): Promise<IntegrityReport> {
  const viewports = options.viewports ?? DEFAULT_INTEGRITY_VIEWPORTS;
  const { chromium } = await import("playwright");
  const browser = await chromium.launch();
  const findings: IntegrityFinding[] = [];
  const exempted: IntegrityExemption[] = [];
  const stats: IntegrityViewportStats[] = [];
  const seen = new Set<string>();
  const push = (list: IntegrityFinding[]) => {
    for (const f of list) {
      const key = dedupeKey(f);
      if (seen.has(key)) continue;
      seen.add(key);
      findings.push(f);
    }
  };

  try {
    const url = isUrl(options.source) ? options.source : pathToFileURL(resolve(options.source)).href;
    for (let vi = 0; vi < viewports.length; vi++) {
      const viewport = viewports[vi]!;
      const page = await browser.newPage({ viewport });
      const events: RuntimeEvent[] = [];
      const netFailures: NetworkFailure[] = [];
      let loaded = false;
      page.on("load", () => { loaded = true; });
      page.on("pageerror", (err) => {
        events.push({ type: "pageerror", text: String(err?.message ?? err).slice(0, 200), phase: loaded ? "post-load" : "construction" });
      });
      page.on("console", (msg) => {
        if (msg.type() === "error") {
          events.push({ type: "console-error", text: msg.text().slice(0, 200), phase: loaded ? "post-load" : "construction" });
        }
      });
      page.on("requestfailed", (req) => {
        netFailures.push({ url: req.url(), resourceType: req.resourceType(), reason: req.failure()?.errorText ?? "failed" });
      });
      page.on("response", (res) => {
        if (!res.ok() && res.status() >= 400) {
          netFailures.push({ url: res.url(), resourceType: res.request().resourceType(), reason: `HTTP ${res.status()}` });
        }
      });
      await page.goto(url, { waitUntil: "networkidle", timeout: 30000 });
      await page.waitForTimeout(250); // let post-load timers throw before judging

      // A1
      push(classifyRuntimeEvents(events, viewport.width));

      // A3 (+A8 fingerprint on the first viewport — layout-independent)
      const resources = await page.evaluate(COLLECT_RESOURCES) as ResourceSample;
      push(judgeResources(resources, viewport.width));
      // Wire-side failures; skip image URLs the DOM probe already
      // attributed to a selector (same basename) to avoid double rows.
      const domImageTails = new Set(resources.brokenImages.map((i) => i.src.split("/").pop()));
      push(judgeNetworkFailures(
        netFailures.filter((f) => !(f.resourceType === "image" && domImageTails.has(f.url.split("/").pop()))),
        viewport.width,
      ));
      if (vi === 0) {
        const fp = await page.evaluate(COLLECT_STYLE_FINGERPRINT) as StyleFingerprint;
        // link.sheet is non-null even for a 404 (see judgeNetworkFailures) —
        // the wire is authoritative for how many stylesheets actually loaded.
        const stylesheetFailures = new Set(netFailures.filter((f) => f.resourceType === "stylesheet").map((f) => f.url)).size;
        fp.loadedStylesheets = Math.max(0, fp.declaredStylesheets - stylesheetFailures);
        const unstyled = judgeUnstyled(fp, viewport.width);
        if (unstyled) push([unstyled]);
      }

      // A4
      const blocks = await page.evaluate(COLLECT_INTEGRITY_TEXT) as IntegrityTextBlock[];
      const collisions = findTextCollisions(blocks, viewport.width, options.collision ?? {});
      push(collisions.findings);
      exempted.push(...collisions.exempted);

      // A5
      const clipCandidates = await page.evaluate(COLLECT_CLIP_CANDIDATES) as ClipCandidate[];
      const clipped = judgeClippedText(clipCandidates, viewport.width, options.maxFindings ?? 12);
      push(clipped.findings);
      exempted.push(...clipped.exempted);

      // A6
      const collapseCandidates = await page.evaluate(COLLECT_COLLAPSE_CANDIDATES) as CollapseCandidate[];
      const collapsed = judgeCollapsedContainers(collapseCandidates, viewport.width);
      push(collapsed.findings);
      exempted.push(...collapsed.exempted);

      // A7 — scan scroll delegation (page-overflow-x is a defect here)
      const scroll = await page.evaluate(COLLECT_SCROLL_SCRIPT) as Omit<ScrollScanInput, "source">;
      const scrollReport = analyzeScrollSamples({ source: options.source, ...scroll });
      const clippedSelectors = new Set(clipped.findings.map((f) => f.selector));
      for (const issue of scrollReport.issues) {
        if (issue.kind === "clipped-content" && issue.selector && clippedSelectors.has(issue.selector)) continue;
        push([{
          kind: issue.kind,
          severity: issue.kind === "page-overflow-x" ? "fail" : "warn",
          viewport: viewport.width,
          ...(issue.selector ? { selector: issue.selector } : {}),
          message: issue.message,
        }]);
      }

      // A2 — pixel side, last (after webfont/img settling)
      const shot = PNG.sync.read(await page.screenshot({ fullPage: true }));
      const components = extractComponentsFromRgba(shot.data, shot.width, shot.height);
      const inkRatio = measureInkRatio(shot.data, shot.width, shot.height);
      const render = judgeRender(
        { componentCount: components.length, inkRatio, textBlocks: blocks.length },
        viewport.width,
      );
      if (render) push([render]);

      stats.push({
        width: viewport.width,
        height: viewport.height,
        components: components.length,
        inkRatio: Number(inkRatio.toFixed(4)),
        textBlocks: blocks.length,
      });
      await page.close();
    }
  } finally {
    await browser.close();
  }

  const order: Record<"fail" | "warn", number> = { fail: 0, warn: 1 };
  findings.sort((a, b) => order[a.severity] - order[b.severity] || a.viewport - b.viewport);
  const kickback = findings.map((f) =>
    `[${f.kind}]${f.selector ? ` ${f.selector}` : ""} (viewport ${f.viewport}): ${f.message}`);
  const verdict = findings.some((f) => f.severity === "fail") ? "defects" : "clean";
  appendRunLedger({
    tool: "integrity-check",
    source: options.source,
    headline: {
      verdict,
      fails: findings.filter((f) => f.severity === "fail").length,
      warns: findings.filter((f) => f.severity === "warn").length,
      exempted: exempted.length,
    },
  });
  return { source: options.source, verdict, findings, exempted, viewports: stats, kickback };
}

// ---------------------------------------------------------------------------
// CLI

export function formatIntegrityReport(report: IntegrityReport): string {
  const lines: string[] = [];
  lines.push(`${BOLD}${CYAN}vlmkit check integrity${RESET}`);
  lines.push(`${DIM}source: ${report.source}${RESET}`);
  lines.push("");
  const fails = report.findings.filter((f) => f.severity === "fail").length;
  const warns = report.findings.length - fails;
  lines.push(`verdict: ${report.verdict === "clean" ? `${GREEN}CLEAN${RESET}` : `${RED}DEFECTS${RESET}`} (${fails} fail, ${warns} warn, ${report.exempted.length} exempted)`);
  for (const v of report.viewports) {
    lines.push(`${DIM}  ${v.width}x${v.height}: ${v.components} component(s), ink ${(v.inkRatio * 100).toFixed(1)}%, ${v.textBlocks} text block(s)${RESET}`);
  }
  if (report.findings.length > 0) {
    lines.push("");
    lines.push("Findings:");
    for (const f of report.findings) {
      const icon = f.severity === "fail" ? `${RED}x${RESET}` : `${YELLOW}!${RESET}`;
      lines.push(`  ${icon} [${f.kind}]${f.selector ? ` ${f.selector}` : ""} @${f.viewport}: ${f.message}`);
    }
  } else {
    lines.push("");
    lines.push(`${GREEN}No integrity defects detected.${RESET}`);
  }
  if (report.exempted.length > 0) {
    lines.push("");
    lines.push(`Exempted candidates (the tool's call — audit the rule, not the page):`);
    for (const e of report.exempted.slice(0, 15)) {
      lines.push(`  ${DIM}- [${e.kind}] ${e.selector ?? ""} @${e.viewport}: ${e.reason}${RESET}`);
    }
    if (report.exempted.length > 15) lines.push(`  ${DIM}… ${report.exempted.length - 15} more${RESET}`);
  }
  return lines.join("\n");
}

function printUsage(exitCode: number): never {
  console.log(`Usage: vlmkit check integrity <html-or-url> [options]

Reference-free integrity gate for creative/zero-shot markup: JS
construction failures, empty renders, broken resources, colliding or
clipped text, collapsed containers, page overflow, and unstyled pages —
swept across multiple viewports. Deterministic (DOM + pixels, no VLM);
intentional-pattern exemptions are reported, not silently dropped.

Options:
  --viewports <w,w,...>  Sweep widths (default: 1280,768,375)
  --max-findings <n>     Per-class report cap (default: 12)
  --json                 Print JSON report
Exit code is non-zero when the verdict is "defects".`);
  process.exit(exitCode);
}

async function main(argv = process.argv.slice(2)): Promise<void> {
  if (argv.includes("--help") || argv.includes("-h")) printUsage(0);
  let json = false;
  let maxFindings: number | undefined;
  let widths: number[] | undefined;
  const positional: string[] = [];
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i]!;
    if (arg === "--json") json = true;
    else if (arg === "--max-findings") maxFindings = Number.parseInt(argv[++i] ?? "12", 10);
    else if (arg === "--viewports") {
      widths = (argv[++i] ?? "").split(",").map((w) => Number.parseInt(w, 10)).filter((w) => w > 0);
      if (widths.length === 0) printUsage(1);
    } else if (!arg.startsWith("-")) positional.push(arg);
  }
  const source = positional[0];
  if (!source) printUsage(1);
  const heights: Record<number, number> = { 1280: 800, 768: 900, 375: 700 };
  const report = await runIntegrityCheck({
    source,
    ...(widths ? { viewports: widths.map((w) => ({ width: w, height: heights[w] ?? 800 })) } : {}),
    ...(maxFindings !== undefined ? { maxFindings } : {}),
  });
  if (json) console.log(JSON.stringify(report, null, 2));
  else console.log(formatIntegrityReport(report));
  if (report.verdict !== "clean") process.exit(1);
}

const isCliEntry = process.env.__VRT_DISPATCHER_LEAF__ === "integrity-check" ||
  (process.argv[1] ? resolve(process.argv[1]) === fileURLToPath(import.meta.url) : false);
if (isCliEntry) {
  main().catch(handleCliError);
}
