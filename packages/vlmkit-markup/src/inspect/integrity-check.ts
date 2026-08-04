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
 *   A8 unstyled-page       every declared stylesheet failed to load (wire-detected)
 *   A9 all of the above swept across multiple viewports
 *   A10 container-protrusion  in-flow child sticks out of a painted parent
 *                             (positioned overlays and breakouts exempt)
 *   A11 invisible-text / low-contrast-text  solid backgrounds only;
 *                             composite backgrounds are skipped visibly
 *   A12 near-misalignment  siblings share an edge exactly, one is 2-8px off
 *
 * CLI:
 *   vlmkit check integrity <html-or-url> [--viewports 1280,768,375] [--json]
 */
import { resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { PNG } from "pngjs";
import { readChoice, readFlag, readInt } from "@mizchi/vlmkit-core/arg-reader.ts";
import { handleCliError } from "@mizchi/vlmkit-core/cli-error.ts";
import { withAuthState } from "@mizchi/vlmkit-core/auth-state.ts";
import { appendRunLedger } from "@mizchi/vlmkit-core/run-ledger.ts";
import {
  ALLOW_HELP,
  applyAllowRules,
  type IntegrityAllowRule,
  parseAllowRules,
} from "./integrity-exemption.ts";
import { describeRedirect } from "@mizchi/vlmkit-core/navigation-redirect.ts";
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
  | "unstyled-page"
  | "container-protrusion"
  | "invisible-text"
  | "low-contrast-text"
  | "near-misalignment"
  | "occluded-text"
  | "redirected";

export interface IntegrityFinding {
  kind: IntegrityFindingKind;
  /** fail = defect (flips the verdict); warn = suspicious but not conclusive. */
  severity: "fail" | "warn";
  /**
   * Canonical viewport width for this finding: the WIDEST width it was observed
   * at. Widest rather than "first swept" because the sweep is sorted internally
   * — attribution must not depend on the order the caller listed its widths in.
   */
  viewport: number;
  /**
   * Every swept width where this finding appeared, widest first. A defect
   * present everywhere reads very differently from a mobile-only one, and the
   * single `viewport` field could not tell them apart.
   */
  viewports?: number[];
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
  /**
   * `--allow` rules that matched nothing this run. Surfaced so an exemption
   * outliving the pattern it covered gets deleted instead of quietly widening
   * the blind spot.
   */
  unusedAllowRules?: IntegrityAllowRule[];
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
  /** Origin differs from the page's — third-party resource (danluu
   * dogfood: a failing analytics beacon must not hard-fail the page's
   * own markup integrity; a failing same-origin build script must). */
  crossOrigin?: boolean;
}

export function judgeNetworkFailures(failures: NetworkFailure[], viewport: number): IntegrityFinding[] {
  const findings: IntegrityFinding[] = [];
  for (const f of failures) {
    const tail = f.url.split("/").pop() ?? f.url;
    switch (f.resourceType) {
      case "stylesheet":
        findings.push({
          kind: "failed-stylesheet",
          severity: f.crossOrigin ? "warn" : "fail",
          viewport,
          message: f.crossOrigin
            ? `Third-party stylesheet ${tail} failed to load (${f.reason}) — its rules are not applied; the page's own styling is unaffected.`
            : `Stylesheet ${tail} failed to load (${f.reason}) — its rules are not applied.`,
          evidence: { url: f.url, reason: f.reason, crossOrigin: f.crossOrigin ?? false },
        });
        break;
      case "script":
        findings.push({
          kind: "js-error",
          severity: f.crossOrigin ? "warn" : "fail",
          viewport,
          message: f.crossOrigin
            ? `Third-party script ${tail} failed to load (${f.reason}) — usually analytics/widgets; the page's own scripts are unaffected.`
            : `Script ${tail} failed to load (${f.reason}) — everything it builds or wires is missing.`,
          evidence: { url: f.url, reason: f.reason, text: `script-load:${tail}`, crossOrigin: f.crossOrigin ?? false },
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
  /**
   * Vertical slack (px) between this block's line box and the actual glyph
   * ink inside it, per edge — half of (line-box height - (ascent+descent))
   * from canvas font metrics. Used to shrink boxes to their ink band before
   * the overlap test, which is what keeps a `line-height: 0.8` or negative
   * `margin-bottom` pull-up from reading as a collision. Absent (0) when
   * the metrics were unavailable.
   */
  inkInset?: number;
}

export interface TextCollisionOptions {
  /** Minimum horizontal ink overlap (px) before a pair is considered. Default 6. */
  minOverlapPx?: number;
  /**
   * Vertical ink overlap as a fraction of the SHORTER block's ink height.
   * Default 0.5 — the two glyph bands must genuinely sit on top of each
   * other, not merely graze.
   *
   * This replaced an overlap-area / smaller-block-area ratio (0.25), which
   * measured the wrong thing: the corpus in
   * fixtures/collision-fp-corpus shows a real 25x12px graze scoring 0.172
   * by area while a legitimate `line-height: 1` stack scores 0.077 and a
   * designed pull-up 0.137 — overlapping populations. By ink fraction the
   * same three are 1.000 / 0.077 / 0.137: a 7x gap around this threshold.
   */
  minInkOverlapFraction?: number;
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
  const minInkFraction = options.minInkOverlapFraction ?? 0.5;
  const maxFindings = options.maxFindings ?? 12;
  const raw: { a: IntegrityTextBlock; b: IntegrityTextBlock; ox: number; oy: number; area: number }[] = [];
  const exempted: IntegrityExemption[] = [];

  for (let i = 0; i < blocks.length; i++) {
    for (let j = i + 1; j < blocks.length; j++) {
      const a = blocks[i]!, b = blocks[j]!;
      // One block containing the other is nesting (a wrapper block whose
      // own text and a child block both bucketed), not a collision.
      const ox = Math.min(a.x + a.width, b.x + b.width) - Math.max(a.x, b.x);
      // Compare INK bands vertically, not line boxes. Designed negative
      // leading (`line-height: 0.8`) and the kicker/heading pull-up
      // (`margin-bottom: -0.15em`) overlap boxes by several px while the
      // glyphs keep a clear gap — measured 2px on the kicker idiom, which
      // this gate used to report as a collision. Shrinking each block to its
      // measured ink band can only REMOVE findings, so it carries none of
      // the cry-wolf risk of lowering the floor itself.
      const aInk = a.inkInset ?? 0;
      const bInk = b.inkInset ?? 0;
      const aTop = a.y + aInk, aBottom = a.y + a.height - aInk;
      const bTop = b.y + bInk, bBottom = b.y + b.height - bInk;
      const oy = Math.min(aBottom, bBottom) - Math.max(aTop, bTop);
      if (ox < minPx || oy < minPx) continue;
      const contains = (o: IntegrityTextBlock, p: IntegrityTextBlock) =>
        o.x <= p.x && o.y <= p.y && o.x + o.width >= p.x + p.width && o.y + o.height >= p.y + p.height;
      if (contains(a, b) || contains(b, a)) continue;
      const area = ox * oy;
      // Require the glyph bands to genuinely intersect vertically, measured
      // against the shorter block's ink height. An area ratio cannot express
      // this: a real graze and a designed negative-leading stack land in the
      // same range by area, but are 1.000 vs 0.077-0.137 by ink fraction.
      const minInkHeight = Math.min(
        Math.max(1, a.height - 2 * aInk),
        Math.max(1, b.height - 2 * bInk),
      );
      if (oy < Math.max(2, minInkFraction * minInkHeight)) continue;

      const pair = { a, b, ox, oy: Math.round(oy * 10) / 10, area };
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
  /** px² of the element's direct text rects that remain inside its box. */
  textVisibleArea: number;
  /** ≤2px on both axes — the sr-only/visually-hidden box shape. */
  srOnlyShaped: boolean;
  /** background-image or ::before/::after content present — image-replacement signal. */
  replacement: boolean;
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
    // Partial cut vs full hide (csszengarden dogfood, 2026-07-30): a
    // genuinely broken box cuts PART of the text; image replacement
    // (Kellum padding, text-indent 100%/-9999px) and sr-only hide ALL
    // of it. Fully-hidden text with a replacement signal is a pattern,
    // not a defect.
    if (c.textVisibleArea < 4) {
      if (c.srOnlyShaped || c.replacement) {
        exempted.push({
          kind: "text-clipped",
          viewport,
          selector: c.selector,
          reason: c.srOnlyShaped
            ? "visually-hidden (sr-only) pattern — 1px box, text for AT only"
            : "image replacement — text fully hidden, background-image/pseudo-content carries the visual",
        });
        continue;
      }
      if (findings.length >= maxFindings) continue;
      findings.push({
        kind: "text-clipped",
        severity: "warn",
        viewport,
        selector: c.selector,
        message: `${c.selector} hides ALL of its text ("${clip(c.text)}") behind overflow:hidden but shows no replacement signal (no background-image, pseudo-content, or sr-only box) — either an unfinished visually-hidden pattern or an accidental full clip; verify intent.`,
        evidence: { clipX: c.clipX, clipY: c.clipY, textVisibleArea: c.textVisibleArea },
      });
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
  /** Resolved URLs of the declared <link rel=stylesheet> elements. */
  declaredHrefs?: string[];
  loadedStylesheets: number;
  styleElements: number;
  inlineStyleAttrs: number;
}

// The earlier UA-default-fingerprint warn branch (serif font + 8px body
// margin + link blue despite loaded stylesheets) was retired 2026-07-30:
// zero true positives since launch, one false positive (danluu.com's
// deliberate 4-rule minimalism), and the class it aimed at is carried by
// the wire-detected fail branch below.
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
  return null;
}

// ---------------------------------------------------------------------------
// A10 — container protrusion (bbox sticks out of a painted parent)

export interface ProtrusionCandidate {
  parent: string;
  /** "(text)" when the parent's own text overflows its box. */
  child: string;
  /** Largest px the child border-box exceeds the parent padding box by. */
  amount: number;
  /** Child is absolute/fixed — badge/notification overlay pattern. */
  positioned: boolean;
  /** Child carries a negative horizontal margin — full-bleed breakout. */
  negBreakout: boolean;
  /** Protrusion axis for the message. */
  axis: "horizontal" | "vertical";
}

export function judgeProtrusions(
  candidates: ProtrusionCandidate[],
  viewport: number,
  maxFindings = 12,
): { findings: IntegrityFinding[]; exempted: IntegrityExemption[] } {
  const findings: IntegrityFinding[] = [];
  const exempted: IntegrityExemption[] = [];
  for (const c of candidates) {
    const sel = `${c.child} out of ${c.parent}`;
    if (c.positioned) {
      exempted.push({ kind: "container-protrusion", viewport, selector: sel, reason: "positioned overlay (badge/notification pattern) — the protrusion is authored" });
      continue;
    }
    if (c.negBreakout && c.axis === "horizontal") {
      exempted.push({ kind: "container-protrusion", viewport, selector: sel, reason: "negative horizontal margin — full-bleed/breakout pattern" });
      continue;
    }
    if (findings.length >= maxFindings) continue;
    findings.push({
      kind: "container-protrusion",
      severity: "fail",
      viewport,
      selector: sel,
      message: c.child === "(text)"
        ? `Text inside ${c.parent} sticks out ${c.amount}px past its painted box (overflow is visible) — a long word or fixed width; allow wrapping (overflow-wrap) or widen the box.`
        : `${c.child} sticks out ${c.amount}px (${c.axis}) past its painted parent ${c.parent} — the child is wider/taller than the container allows; shrink it, let it wrap, or make the overflow an authored overlay (position + z-index).`,
      evidence: { parent: c.parent, child: c.child, amount: c.amount, axis: c.axis },
    });
  }
  return { findings, exempted };
}

// ---------------------------------------------------------------------------
// A11 — invisible / low-contrast text (solid backgrounds only)

export interface ContrastCandidate {
  selector: string;
  text: string;
  /** WCAG contrast ratio after alpha/opacity compositing. */
  ratio: number;
  fg: string;
  bg: string;
  disabled: boolean;
  /** text-shadow present — may carry the contrast the fill lacks. */
  shadowed: boolean;
}

export function judgeTextContrast(
  candidates: ContrastCandidate[],
  skippedComposite: number,
  viewport: number,
  maxFindings = 12,
): { findings: IntegrityFinding[]; exempted: IntegrityExemption[] } {
  const findings: IntegrityFinding[] = [];
  const exempted: IntegrityExemption[] = [];
  for (const c of candidates) {
    if (c.disabled) {
      exempted.push({ kind: "low-contrast-text", viewport, selector: c.selector, reason: "disabled control — reduced contrast is the platform convention" });
      continue;
    }
    if (c.shadowed) {
      exempted.push({ kind: "low-contrast-text", viewport, selector: c.selector, reason: "text-shadow present — the shadow may carry the contrast the fill lacks (not measurable deterministically)" });
      continue;
    }
    if (findings.length >= maxFindings) continue;
    if (c.ratio < 1.15) {
      findings.push({
        kind: "invisible-text",
        severity: "fail",
        viewport,
        selector: c.selector,
        message: `${c.selector} renders "${clip(c.text)}" in ${c.fg} on ${c.bg} (contrast ${c.ratio.toFixed(2)}:1) — the text is effectively invisible.`,
        evidence: { ratio: c.ratio, fg: c.fg, bg: c.bg },
      });
    } else {
      findings.push({
        kind: "low-contrast-text",
        severity: "warn",
        viewport,
        selector: c.selector,
        message: `${c.selector} renders "${clip(c.text)}" at contrast ${c.ratio.toFixed(2)}:1 (${c.fg} on ${c.bg}) — below the 3:1 floor even for large text.`,
        evidence: { ratio: c.ratio, fg: c.fg, bg: c.bg },
      });
    }
  }
  if (skippedComposite > 0) {
    exempted.push({
      kind: "low-contrast-text",
      viewport,
      selector: "(page)",
      reason: `${skippedComposite} text block(s) skipped: background-image/gradient in the stack — composite-background contrast is not deterministically measurable (Layer B territory)`,
    });
  }
  return { findings, exempted };
}

// ---------------------------------------------------------------------------
// A12 — near-misalignment (exactly aligned and clearly offset are both fine;
// a 2-8px deviation from siblings that otherwise share an edge is a bug)

export interface AlignmentGroup {
  parent: string;
  children: { selector: string; left: number; right: number; centerX: number; top: number }[];
}

const ALIGN_AXES = ["left", "centerX", "right", "top"] as const;

export function judgeAlignment(
  groups: AlignmentGroup[],
  viewport: number,
  maxFindings = 8,
): IntegrityFinding[] {
  const findings: IntegrityFinding[] = [];
  const flagged = new Set<string>();
  for (const group of groups) {
    if (group.children.length < 3) continue;
    // Per axis: the modal value (rounded to .5px) among the children.
    const modes = new Map<(typeof ALIGN_AXES)[number], { value: number; count: number }>();
    for (const axis of ALIGN_AXES) {
      const counts = new Map<number, number>();
      for (const ch of group.children) {
        const v = Math.round(ch[axis] * 2) / 2;
        counts.set(v, (counts.get(v) ?? 0) + 1);
      }
      let best = { value: 0, count: 0 };
      for (const [value, count] of counts) if (count > best.count) best = { value, count };
      modes.set(axis, best);
    }
    for (const axis of ALIGN_AXES) {
      const mode = modes.get(axis)!;
      // Require a real shared edge: at least 2 exact members AND at most
      // 2 deviants (a majority is aligned; scattered values mean the axis
      // is simply not the alignment axis of this group).
      if (mode.count < 2 || group.children.length - mode.count > 2) continue;
      for (const ch of group.children) {
        const dev = Math.abs(Math.round(ch[axis] * 2) / 2 - mode.value);
        if (dev < 2 || dev > 8) continue;
        // Exactly aligned on another axis (e.g. a centered item in a
        // left-aligned stack) reads as intentional — skip.
        const alignedElsewhere = ALIGN_AXES.some((other) => {
          if (other === axis) return false;
          const m = modes.get(other)!;
          return m.count >= 2 && Math.abs(Math.round(ch[other] * 2) / 2 - m.value) < 1;
        });
        if (alignedElsewhere) continue;
        if (flagged.has(ch.selector) || findings.length >= maxFindings) continue;
        flagged.add(ch.selector);
        findings.push({
          kind: "near-misalignment",
          severity: "warn",
          viewport,
          selector: ch.selector,
          message: `${ch.selector} is off its siblings' shared ${axis === "centerX" ? "center line" : `${axis} edge`} by ${dev}px inside ${group.parent} — siblings align exactly; a 2-8px deviation is almost always an accident (stray margin/padding), not a design choice.`,
          evidence: { axis, deviation: dev, parent: group.parent, sharedValue: mode.value },
        });
      }
    }
  }
  return findings;
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
// ---------------------------------------------------------------------------
// A13 — occluded text (z-index / paint-order cover)
//
// Text painted OVER by an opaque non-related element. First observed in the
// wild in S19 (game UI): a CSS figure's absolutely-positioned part covered
// "Block 0" and half the enemy HP at 375px while every other probe stayed
// clean — text-collision is text-vs-text, invisible-text is style-based,
// and neither sees paint order. Detection is hit-testing: sample points on
// each text rect's glyph band and ask elementFromPoint who actually paints
// there. A point is occluded when the hit element is unrelated (not self,
// ancestor, or descendant — whitespace points hit ancestors and stay fine)
// AND the occluder paints opaquely (solid background-color alpha >= 0.5, a
// background-image, or a replaced element). Transparent overlays — the
// stretched-link card pattern, scrims under 0.5 alpha — never flag, which
// is what kept this probe demand-gated until a real case appeared.
// Coverage note: samples only what is inside the viewport at load (no
// scroll sweep), which matches how the defect class was observed.
//
// Hit-testing has one blind spot that has to be closed deliberately:
// `elementFromPoint` skips `pointer-events: none` elements, and that is
// exactly how decorative overlays are built (gradient scrims, absolutely
// positioned SVG/CSS art, ::before washes). An occluder that paints over
// text but opts out of hit-testing would be invisible to the probe — the
// S19 defect class with one extra declaration. So sampling runs with
// pointer-events forced back on page-wide, then restores. False positives
// stay closed by the opaque-paint requirement: a transparent click-catcher
// now hit-tests on top but still never flags.

export interface OcclusionCandidate {
  selector: string;
  text: string;
  occluder: string;
  /** occluded sample points / total sampled points, 0..1 */
  coverage: number;
  sampled: number;
  ariaHidden: boolean;
  /**
   * The occluder is a viewport-pinned bar (position fixed / sticky) and the
   * page has enough scroll range for this text to move out from under it —
   * the standard bottom-bar-over-scrollable-content pattern (S15's mobile
   * cart bar), readable after a scroll, so exempt rather than fail.
   */
  pinnedEscapable: boolean;
}

export const COLLECT_OCCLUSIONS = `(() => {
  ${STABLE_SELECTOR_FN}
  const SKIP = new Set(["SCRIPT", "STYLE", "NOSCRIPT", "TEMPLATE"]);
  const alphaOf = (color) => {
    const m = /rgba?\\(([^)]+)\\)/.exec(color || "");
    if (!m) return 0;
    const p = m[1].split(",").map((s) => parseFloat(s));
    return p.length >= 4 ? p[3] : 1;
  };
  const OPAQUE_TAGS = new Set(["IMG", "CANVAS", "VIDEO", "SVG", "PICTURE"]);
  // Effective opacity: CSS opacity multiplies down the ancestor chain, and an
  // element that paints nothing cannot occlude anything. Found on a real
  // authenticated app (2026-08-01 Swag Labs audit): the styled-select pattern
  // puts a native <select> with opacity 0.001 over a visible span, and its
  // background-color alpha is 1 — so an alpha-only test called a deliberately
  // invisible overlay an opaque occluder.
  const effectiveOpacity = (el) => {
    let o = 1;
    for (let p = el; p && p.nodeType === 1; p = p.parentElement) {
      const cs = getComputedStyle(p);
      if (cs.visibility === "hidden" || cs.display === "none") return 0;
      const v = parseFloat(cs.opacity);
      if (Number.isFinite(v)) o *= v;
      if (o < 0.05) return o;
    }
    return o;
  };
  const paintsOpaquely = (el) => {
    if (effectiveOpacity(el) < 0.5) return false;
    if (OPAQUE_TAGS.has(el.tagName)) return true;
    const cs = getComputedStyle(el);
    if ((cs.backgroundImage || "none") !== "none") return true;
    return alphaOf(cs.backgroundColor) >= 0.5;
  };
  const out = [];
  // Force hit-testing back on so pointer-events:none overlays are visible
  // to elementFromPoint (see the note above). Removed in the finally.
  const peOverride = document.createElement("style");
  peOverride.textContent = "*, *::before, *::after { pointer-events: auto !important; }";
  document.head.appendChild(peOverride);
  try {
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  let node;
  while ((node = walker.nextNode())) {
    if (!(node.nodeValue || "").trim()) continue;
    const el = node.parentElement;
    if (!el || SKIP.has(el.tagName)) continue;
    const style = getComputedStyle(el);
    if (style.visibility === "hidden" || style.display === "none" || style.opacity === "0") continue;
    const range = document.createRange();
    range.selectNodeContents(node);
    const rects = Array.from(range.getClientRects()).filter((r) => r.width >= 4 && r.height >= 4);
    if (rects.length === 0) continue;
    // Occlusion is only meaningful where the glyphs are actually painted.
    // Text clipped away by its own / an ancestor's overflow box (sr-only,
    // Kellum image replacement, text-indent tricks) is the invisible-text
    // probes' business — hit-testing those points would blame whatever
    // happens to be painted there. Clamp sampling to the ancestor clip.
    let clip = { left: 0, top: 0, right: innerWidth, bottom: innerHeight };
    for (let p = el; p && p !== document.body; p = p.parentElement) {
      const pcs = getComputedStyle(p);
      const clipsX = pcs.overflowX !== "visible";
      const clipsY = pcs.overflowY !== "visible";
      if (!clipsX && !clipsY) continue;
      const b = p.getBoundingClientRect();
      if (clipsX) { clip.left = Math.max(clip.left, b.left); clip.right = Math.min(clip.right, b.right); }
      if (clipsY) { clip.top = Math.max(clip.top, b.top); clip.bottom = Math.min(clip.bottom, b.bottom); }
    }
    if (clip.right - clip.left < 4 || clip.bottom - clip.top < 4) continue;
    let sampled = 0;
    let occluded = 0;
    const hits = new Map();
    for (const r of rects.slice(0, 3)) {
      const y = r.top + r.height / 2;
      if (y < clip.top || y >= clip.bottom) continue;
      for (const fx of [0.125, 0.375, 0.625, 0.875]) {
        const x = r.left + r.width * fx;
        if (x < clip.left || x >= clip.right) continue;
        sampled++;
        const hit = document.elementFromPoint(x, y);
        if (!hit || hit === el || el.contains(hit) || hit.contains(el)) continue;
        if (!paintsOpaquely(hit)) continue;
        occluded++;
        hits.set(hit, (hits.get(hit) || 0) + 1);
      }
    }
    if (sampled >= 3 && occluded >= 2 && occluded / sampled >= 0.5) {
      let top = null;
      for (const [h, n] of hits) if (!top || n > top[1]) top = [h, n];
      let pinnedEscapable = false;
      if (top) {
        let pinned = null;
        for (let p = top[0]; p && p !== document.body; p = p.parentElement) {
          const pos = getComputedStyle(p).position;
          if (pos === "fixed" || pos === "sticky") { pinned = p; break; }
        }
        if (pinned) {
          const maxScroll = Math.max(0, document.documentElement.scrollHeight - innerHeight);
          const textBottom = rects[0].bottom;
          const barTop = pinned.getBoundingClientRect().top;
          pinnedEscapable = maxScroll >= textBottom - barTop;
        }
      }
      out.push({
        selector: stableSelector(el),
        text: (node.nodeValue || "").replace(/\\s+/g, " ").trim().slice(0, 60),
        occluder: top ? stableSelector(top[0]) : "?",
        coverage: occluded / sampled,
        sampled,
        ariaHidden: !!el.closest('[aria-hidden="true"]'),
        pinnedEscapable,
      });
    }
  }
  return out;
  } finally {
    peOverride.remove();
  }
})()`;

export function findOccludedText(
  candidates: OcclusionCandidate[],
  viewport: number,
): { findings: IntegrityFinding[]; exempted: IntegrityExemption[] } {
  const findings: IntegrityFinding[] = [];
  const exempted: IntegrityExemption[] = [];
  for (const c of candidates) {
    if (c.ariaHidden) {
      exempted.push({
        kind: "occluded-text",
        viewport,
        selector: c.selector,
        reason: "aria-hidden subtree — decorative text; being painted over is not a reading defect",
      });
      continue;
    }
    if (c.pinnedEscapable) {
      exempted.push({
        kind: "occluded-text",
        viewport,
        selector: c.selector,
        reason: `under viewport-pinned bar ${c.occluder} — scrollable content moves out from beneath it (fixed/sticky bar pattern)`,
      });
      continue;
    }
    findings.push({
      kind: "occluded-text",
      severity: "fail",
      viewport,
      selector: c.selector,
      message: `"${clip(c.text)}" (${c.selector}) is painted over by an opaque element ${c.occluder} @${viewport} — ${Math.round(c.coverage * 100)}% of sampled glyph points hit the occluder instead of the text. Move or shrink the covering element, or reorder the stacking so the text stays readable.`,
      evidence: { text: c.text, occluder: c.occluder, coverage: c.coverage },
    });
  }
  return { findings, exempted };
}

export const COLLECT_INTEGRITY_TEXT = `(() => {
  // Glyph ink is smaller than the line box it sits in. Measure the slack so
  // the collision test can compare ink bands instead of boxes: a designed
  // negative-leading or pull-up overlaps boxes while the glyphs keep a clear
  // gap (measured 2px on the kicker/heading idiom, which the box test
  // reported as a collision).
  const inkCtx = (() => { try { return document.createElement("canvas").getContext("2d"); } catch { return null; } })();
  const inkInsetOf = (el, text) => {
    if (!inkCtx || !text) return 0;
    try {
      const cs = getComputedStyle(el);
      inkCtx.font = [cs.fontStyle, cs.fontWeight, cs.fontSize, cs.fontFamily].filter(Boolean).join(" ");
      const m = inkCtx.measureText(text.slice(0, 200));
      const ink = (m.actualBoundingBoxAscent || 0) + (m.actualBoundingBoxDescent || 0);
      if (!(ink > 0)) return 0;
      const fontSize = parseFloat(cs.fontSize) || 0;
      const lh = cs.lineHeight === "normal" ? fontSize * 1.2 : (parseFloat(cs.lineHeight) || fontSize);
      // Never claim more slack than the box has, never negative (tight
      // leading makes lh < ink, i.e. zero slack rather than anti-slack).
      return Math.max(0, Math.min((lh - ink) / 2, fontSize * 0.5));
    } catch { return 0; }
  };
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
    // Self-style checks miss content-visibility skipping, which is how a
    // CLOSED <details> hides its subtree: the descendants keep layout boxes
    // (measured 184x56 at y=9137 inside MDN's collapsed sidebar) while being
    // invisible. Stacked hidden items overlap perfectly, so they read as
    // collisions. checkVisibility() is the only reliable test for it.
    if (typeof el.checkVisibility === "function"
      && !el.checkVisibility({ visibilityProperty: true, opacityProperty: true, contentVisibilityAuto: true })) continue;
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
      inkInset: inkInsetOf(b.el, b.parts.join(" ")),
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
    // How much of the element's own text actually stays visible inside
    // its box — the partial-cut vs fully-hidden discriminator.
    const box = el.getBoundingClientRect();
    let textVisibleArea = 0;
    for (const n of el.childNodes) {
      if (n.nodeType !== 3 || !(n.nodeValue || "").trim()) continue;
      const range = document.createRange();
      range.selectNodeContents(n);
      for (const r of range.getClientRects()) {
        const ix = Math.min(r.right, box.right) - Math.max(r.left, box.left);
        const iy = Math.min(r.bottom, box.bottom) - Math.max(r.top, box.top);
        if (ix > 0 && iy > 0) textVisibleArea += ix * iy;
      }
    }
    let replacement = style.backgroundImage !== "none";
    for (const pseudo of ["::before", "::after"]) {
      const content = getComputedStyle(el, pseudo).content;
      if (content && content !== "none" && content !== "normal" && content !== '""') replacement = true;
    }
    out.push({
      selector: stableSelector(el),
      text: direct.replace(/\\s+/g, " ").trim().slice(0, 80),
      clipX,
      clipY,
      textOverflow: style.textOverflow,
      lineClamp: style.webkitLineClamp || "none",
      textVisibleArea: Math.round(textVisibleArea),
      srOnlyShaped: el.clientWidth <= 2 && el.clientHeight <= 2,
      replacement,
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

export const COLLECT_PROTRUSIONS = `(() => {
  ${STABLE_SELECTOR_FN}
  const out = [];
  const hasAlpha = (bg) => {
    const m = (bg || "").match(/rgba?\\(([^)]+)\\)/);
    if (!m) return false;
    const parts = m[1].split(",").map(parseFloat);
    return (parts[3] === undefined ? 1 : parts[3]) > 0;
  };
  for (const el of Array.from(document.querySelectorAll("body *"))) {
    if (out.length >= 60) break;
    const style = getComputedStyle(el);
    if (style.display === "none" || style.visibility === "hidden") continue;
    if (style.overflowX !== "visible" && style.overflowY !== "visible") continue; // clipping is A5/A7's domain
    const bordered = ["Top", "Right", "Bottom", "Left"].some((s) =>
      parseFloat(style["border" + s + "Width"]) > 0 && style["border" + s + "Style"] !== "none");
    const painted = bordered || hasAlpha(style.backgroundColor) || style.backgroundImage !== "none";
    if (!painted) continue;
    const rect = el.getBoundingClientRect();
    if (rect.width < 24 || rect.height < 16) continue;
    const box = {
      left: rect.left + parseFloat(style.borderLeftWidth),
      right: rect.right - parseFloat(style.borderRightWidth),
      top: rect.top + parseFloat(style.borderTopWidth),
      bottom: rect.bottom - parseFloat(style.borderBottomWidth),
    };
    for (const child of Array.from(el.children)) {
      const cs = getComputedStyle(child);
      if (cs.display === "none" || cs.visibility === "hidden") continue;
      const cr = child.getBoundingClientRect();
      if (cr.width <= 0 || cr.height <= 0) continue;
      const overX = Math.max(cr.right - box.right, box.left - cr.left);
      const overY = Math.max(cr.bottom - box.bottom, box.top - cr.top);
      const over = Math.max(overX, overY);
      if (over < 4) continue;
      out.push({
        parent: stableSelector(el),
        child: stableSelector(child),
        amount: Math.round(over),
        positioned: cs.position === "absolute" || cs.position === "fixed",
        negBreakout: parseFloat(cs.marginLeft) < 0 || parseFloat(cs.marginRight) < 0,
        axis: overX >= overY ? "horizontal" : "vertical",
      });
    }
    let direct = "";
    for (const n of el.childNodes) if (n.nodeType === 3) direct += n.nodeValue || "";
    if (direct.trim() && el.scrollWidth - el.clientWidth >= 4 && style.overflowX === "visible") {
      out.push({
        parent: stableSelector(el),
        child: "(text)",
        amount: el.scrollWidth - el.clientWidth,
        positioned: false,
        negBreakout: false,
        axis: "horizontal",
      });
    }
  }
  return out;
})()`;

export const COLLECT_TEXT_CONTRAST = `(() => {
  ${STABLE_SELECTOR_FN}
  const parseColor = (s) => {
    const m = (s || "").match(/rgba?\\(([^)]+)\\)/);
    if (!m) return null;
    const p = m[1].split(",").map(parseFloat);
    return [p[0], p[1], p[2], p[3] === undefined ? 1 : p[3]];
  };
  const blend = (bg, c) => {
    const a = c[3];
    return [bg[0] * (1 - a) + c[0] * a, bg[1] * (1 - a) + c[1] * a, bg[2] * (1 - a) + c[2] * a];
  };
  const lum = (c) => {
    const f = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); };
    return 0.2126 * f(c[0]) + 0.7152 * f(c[1]) + 0.0722 * f(c[2]);
  };
  const ratio = (a, b) => {
    const l1 = lum(a), l2 = lum(b);
    return (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);
  };
  const candidates = [];
  let skippedComposite = 0;
  for (const el of Array.from(document.querySelectorAll("body *"))) {
    if (candidates.length >= 60) break;
    let direct = "";
    for (const n of el.childNodes) if (n.nodeType === 3) direct += n.nodeValue || "";
    if (!direct.trim()) continue;
    const style = getComputedStyle(el);
    if (style.display === "none" || style.visibility === "hidden" || style.opacity === "0") continue;
    const rect = el.getBoundingClientRect();
    if (rect.width <= 2 || rect.height <= 2) continue;
    // Text fully hidden behind clipping overflow (image replacement,
    // Kellum, text-indent) is AT-only — its paint contrast is meaningless.
    if (/^(hidden|clip)$/.test(style.overflowX) || /^(hidden|clip)$/.test(style.overflowY)) {
      let visibleArea = 0;
      for (const n of el.childNodes) {
        if (n.nodeType !== 3 || !(n.nodeValue || "").trim()) continue;
        const range = document.createRange();
        range.selectNodeContents(n);
        for (const r of range.getClientRects()) {
          const ix = Math.min(r.right, rect.right) - Math.max(r.left, rect.left);
          const iy = Math.min(r.bottom, rect.bottom) - Math.max(r.top, rect.top);
          if (ix > 0 && iy > 0) visibleArea += ix * iy;
        }
      }
      if (visibleArea < 4) continue;
    }
    // Same rule one level up: a clipping ancestor whose box the element
    // does not intersect (collapsed dropdown: height-0 overflow-hidden
    // list; text-indent pushed past a clipping parent) hides the text.
    let clippedByAncestor = false;
    for (let p = el.parentElement; p && p !== document.documentElement; p = p.parentElement) {
      const ps = getComputedStyle(p);
      if (!/^(hidden|clip)$/.test(ps.overflowX) && !/^(hidden|clip)$/.test(ps.overflowY)) continue;
      const pr = p.getBoundingClientRect();
      const ix = Math.min(rect.right, pr.right) - Math.max(rect.left, pr.left);
      const iy = Math.min(rect.bottom, pr.bottom) - Math.max(rect.top, pr.top);
      if (ix < 2 || iy < 2) { clippedByAncestor = true; break; }
    }
    if (clippedByAncestor) continue;
    let composite = false;
    const chain = [];
    for (let p = el; p; p = p.parentElement) {
      const ps = getComputedStyle(p);
      if (ps.backgroundImage !== "none") { composite = true; break; }
      const c = parseColor(ps.backgroundColor);
      if (c && c[3] > 0) chain.push(c);
      if (c && c[3] >= 1) break;
    }
    if (composite) { skippedComposite++; continue; }
    let bg = [255, 255, 255];
    for (const c of chain.reverse()) bg = blend(bg, c);
    let opacity = 1;
    for (let p = el; p && p !== document.documentElement; p = p.parentElement) {
      // parseFloat(...) || 1 would turn an ancestor's opacity: 0 into 1 —
      // opacity is not inherited, so this chain is the only place a
      // fully-transparent ancestor can be seen. Preserve finite zeros.
      const po = parseFloat(getComputedStyle(p).opacity);
      opacity *= Number.isFinite(po) ? po : 1;
    }
    const fgColor = parseColor(style.color) || [0, 0, 0, 1];
    const fg = blend(bg, [fgColor[0], fgColor[1], fgColor[2], fgColor[3] * opacity]);
    const r = ratio(fg, bg);
    if (r >= 3) continue;
    candidates.push({
      selector: stableSelector(el),
      text: direct.replace(/\\s+/g, " ").trim().slice(0, 60),
      ratio: Math.round(r * 100) / 100,
      fg: "rgb(" + fg.map(Math.round).join(", ") + ")",
      bg: "rgb(" + bg.map(Math.round).join(", ") + ")",
      disabled: el.closest("[disabled], [aria-disabled='true']") != null,
      shadowed: style.textShadow !== "none",
    });
  }
  return { candidates, skippedComposite };
})()`;

export const COLLECT_ALIGN_GROUPS = `(() => {
  ${STABLE_SELECTOR_FN}
  const groups = [];
  for (const parent of Array.from(document.querySelectorAll("body *"))) {
    if (groups.length >= 40) break;
    if (parent.children.length < 3) continue;
    const byTag = new Map();
    for (const child of Array.from(parent.children)) {
      const cs = getComputedStyle(child);
      if (cs.display === "none" || cs.visibility === "hidden") continue;
      if (cs.position === "absolute" || cs.position === "fixed") continue;
      const r = child.getBoundingClientRect();
      if (r.width < 12 || r.height < 12) continue;
      const key = child.tagName;
      if (!byTag.has(key)) byTag.set(key, []);
      byTag.get(key).push({
        selector: stableSelector(child),
        left: r.left,
        right: r.right,
        centerX: (r.left + r.right) / 2,
        top: r.top,
      });
    }
    for (const children of byTag.values()) {
      if (children.length >= 3) groups.push({ parent: stableSelector(parent), children });
    }
  }
  return groups;
})()`;

export const COLLECT_STYLE_FINGERPRINT = `(() => {
  const links = Array.from(document.querySelectorAll('link[rel~="stylesheet" i]'));
  return {
    declaredStylesheets: links.length,
    declaredHrefs: links.map((l) => l.href),
    // Placeholder: link.sheet is non-null even for a 404, so the runner
    // overwrites this from the wire-observed stylesheet failures.
    loadedStylesheets: links.length,
    styleElements: document.querySelectorAll("style").length,
    inlineStyleAttrs: document.querySelectorAll("[style]").length,
  };
})()`;

// ---------------------------------------------------------------------------
// Runner

export interface IntegrityOptions {
  /**
   * Playwright storage-state file so gates can measure pages behind a
   * login. Falls back to VLMKIT_STORAGE_STATE. See auth-state.ts.
   */
  storageState?: string;
  source: string;
  /** Playwright navigation milestone. Defaults to networkidle. */
  waitUntil?: "domcontentloaded" | "load" | "networkidle";
  /** Navigation timeout in milliseconds. Defaults to 30000. */
  timeout?: number;
  /** Replay network responses from a Playwright HAR for deterministic URL gates. */
  har?: string;
  /** Sweep widths (default 1280, 768, 375). */
  viewports?: { width: number; height: number }[];
  maxFindings?: number;
  collision?: TextCollisionOptions;
  /**
   * User-declared exemptions for intentional patterns. Matched findings move
   * into `exempted` with the caller's reason; see integrity-exemption.ts.
   */
  allow?: readonly IntegrityAllowRule[];
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
  // Sorted widest-first, whatever order the caller gave. Findings are deduped
  // across the sweep, so the retained one used to be whichever width came
  // first: `--viewports 375,768,1280` attributed a page-wide defect to 375 and
  // `1280,768,375` to 1280. That made `--allow "...@1280"` silently
  // order-dependent, and read as "mobile only" for something present everywhere.
  const viewports = [...(options.viewports ?? DEFAULT_INTEGRITY_VIEWPORTS)]
    .sort((a, b) => b.width - a.width);
  const { chromium } = await import("playwright");
  const browser = await chromium.launch();
  const findings: IntegrityFinding[] = [];
  const exempted: IntegrityExemption[] = [];
  const stats: IntegrityViewportStats[] = [];
  // key -> the retained finding, so a repeat at a narrower width records its
  // width instead of being dropped without trace.
  const seen = new Map<string, IntegrityFinding>();
  const push = (list: IntegrityFinding[]) => {
    for (const f of list) {
      const key = dedupeKey(f);
      const existing = seen.get(key);
      if (existing) {
        existing.viewports ??= [existing.viewport];
        if (!existing.viewports.includes(f.viewport)) existing.viewports.push(f.viewport);
        continue;
      }
      seen.set(key, f);
      findings.push(f);
    }
  };

  try {
    const url = isUrl(options.source) ? options.source : pathToFileURL(resolve(options.source)).href;
    for (let vi = 0; vi < viewports.length; vi++) {
      const viewport = viewports[vi]!;
      const page = await browser.newPage(withAuthState({ viewport }, options.storageState));
      if (options.har) {
        await page.routeFromHAR(resolve(options.har), { notFound: "abort" });
      }
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
      const pageOrigin = (() => { try { return new URL(url).origin; } catch { return ""; } })();
      const originOf = (u: string) => { try { return new URL(u).origin; } catch { return pageOrigin; } };
      page.on("requestfailed", (req) => {
        netFailures.push({ url: req.url(), resourceType: req.resourceType(), reason: req.failure()?.errorText ?? "failed", crossOrigin: originOf(req.url()) !== pageOrigin });
      });
      page.on("response", (res) => {
        if (!res.ok() && res.status() >= 400) {
          netFailures.push({ url: res.url(), resourceType: res.request().resourceType(), reason: `HTTP ${res.status()}`, crossOrigin: originOf(res.url()) !== pageOrigin });
        }
      });
      await page.goto(url, {
        waitUntil: options.waitUntil ?? "networkidle",
        timeout: options.timeout ?? 30000,
      });
      // Network idle is not font-ready: with `font-display: swap` the text
      // reflows AFTER idle, so every geometry probe below would measure
      // fallback metrics on some runs and webfont metrics on others — the
      // exact non-determinism the gate promises not to have. Cheap when
      // there are no webfonts (already-resolved promise).
      await page.evaluate(() => (document.fonts ? document.fonts.ready.then(() => undefined) : undefined));
      await page.waitForTimeout(250); // let post-load timers throw before judging

      // Never report on a URL we did not measure. An auth-walled route
      // 302s to /login and everything below would judge the login page —
      // previously yielding a CLEAN verdict for a page that never
      // rendered. Fail, don't warn: a green gate on the wrong page is the
      // worst outcome this tool can produce.
      if (vi === 0) {
        const redirect = describeRedirect(url, page.url());
        if (redirect) {
          push([{ kind: "redirected", severity: "fail", viewport: viewport.width, message: redirect }]);
        }
      }

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
        // Only count failures of the DECLARED link URLs: a failing @import
        // inside a successfully loaded sheet is also wire-typed "stylesheet"
        // and would otherwise zero out loadedStylesheets on a styled page.
        const declaredUrls = new Set(fp.declaredHrefs ?? []);
        const stylesheetFailures = new Set(
          netFailures.filter((f) => f.resourceType === "stylesheet" && declaredUrls.has(f.url)).map((f) => f.url),
        ).size;
        fp.loadedStylesheets = Math.max(0, fp.declaredStylesheets - stylesheetFailures);
        const unstyled = judgeUnstyled(fp, viewport.width);
        if (unstyled) push([unstyled]);
      }

      // A4
      const blocks = await page.evaluate(COLLECT_INTEGRITY_TEXT) as IntegrityTextBlock[];
      // The top-level cap applies to every finding class; an explicit
      // per-class collision option still wins.
      const collisions = findTextCollisions(blocks, viewport.width, {
        ...(options.maxFindings !== undefined ? { maxFindings: options.maxFindings } : {}),
        ...(options.collision ?? {}),
      });
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

      // A10 — container protrusion
      const protrusionCandidates = await page.evaluate(COLLECT_PROTRUSIONS) as ProtrusionCandidate[];
      const protrusions = judgeProtrusions(protrusionCandidates, viewport.width, options.maxFindings ?? 12);
      push(protrusions.findings);
      exempted.push(...protrusions.exempted);

      // A11 — invisible / low-contrast text (solid backgrounds only)
      const contrastSample = await page.evaluate(COLLECT_TEXT_CONTRAST) as { candidates: ContrastCandidate[]; skippedComposite: number };
      const contrast = judgeTextContrast(contrastSample.candidates, contrastSample.skippedComposite, viewport.width, options.maxFindings ?? 12);
      push(contrast.findings);
      exempted.push(...contrast.exempted);

      // A12 — near-misalignment among siblings sharing an edge
      const alignGroups = await page.evaluate(COLLECT_ALIGN_GROUPS) as AlignmentGroup[];
      push(judgeAlignment(alignGroups, viewport.width));

      // A13 — occluded text (paint-order cover by an opaque unrelated element)
      const occlusionCandidates = await page.evaluate(COLLECT_OCCLUSIONS) as OcclusionCandidate[];
      const occlusions = findOccludedText(occlusionCandidates, viewport.width);
      push(occlusions.findings);
      exempted.push(...occlusions.exempted);

      // A7 — scan scroll delegation (page-overflow-x is a defect here)
      const scroll = await page.evaluate(COLLECT_SCROLL_SCRIPT) as Omit<ScrollScanInput, "source">;
      const scrollReport = analyzeScrollSamples({ source: options.source, ...scroll });
      // The text probe already ruled on these selectors — as findings OR
      // as exemptions (an sr-only span must not resurface as a
      // clipped-content warn from the scroll sweep).
      const clippedSelectors = new Set([
        ...clipped.findings.map((f) => f.selector),
        ...clipped.exempted.map((e) => e.selector),
      ]);
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

  // User exemptions apply BEFORE the verdict, and every exempted finding is
  // moved into `exempted` rather than dropped — the suppression stays visible in
  // the report and in --json.
  const allowed = applyAllowRules(findings, options.allow ?? []);
  findings.length = 0;
  findings.push(...allowed.findings);
  exempted.push(...allowed.exempted);

  const order: Record<"fail" | "warn", number> = { fail: 0, warn: 1 };
  findings.sort((a, b) => order[a.severity] - order[b.severity] || a.viewport - b.viewport);
  const kickback = findings.map((f) =>
    `[${f.kind}]${f.selector ? ` ${f.selector}` : ""} (viewport ${
      f.viewports && f.viewports.length > 1 ? f.viewports.join(",") : f.viewport
    }): ${f.message}`);
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
  return {
    source: options.source,
    verdict,
    findings,
    exempted,
    viewports: stats,
    kickback,
    ...(allowed.unusedRules.length > 0 ? { unusedAllowRules: allowed.unusedRules } : {}),
  };
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
      // Show every width it appeared at: "@1280" and "@1280,768,375" are
      // different bugs to fix, and the caller cannot tell them apart otherwise.
      const at = f.viewports && f.viewports.length > 1 ? f.viewports.join(",") : String(f.viewport);
      lines.push(`  ${icon} [${f.kind}]${f.selector ? ` ${f.selector}` : ""} @${at}: ${f.message}`);
    }
  } else {
    lines.push("");
    lines.push(`${GREEN}No integrity defects detected.${RESET}`);
  }
  if (report.exempted.length > 0) {
    const user = report.exempted.filter((e) => e.reason.startsWith("user exemption"));
    const tool = report.exempted.filter((e) => !e.reason.startsWith("user exemption"));
    // Split by who decided. A reviewer auditing a tool exemption is checking the
    // rule; auditing a user exemption is checking a colleague's judgement call,
    // and conflating the two hides which is which.
    for (const [label, rows] of [
      ["Exempted candidates (the tool's call — audit the rule, not the page)", tool],
      ["Exempted by --allow (your call — the finding was real and accepted)", user],
    ] as const) {
      if (rows.length === 0) continue;
      lines.push("");
      lines.push(`${label}:`);
      for (const e of rows.slice(0, 15)) {
        lines.push(`  ${DIM}- [${e.kind}] ${e.selector ?? ""} @${e.viewport}: ${e.reason}${RESET}`);
      }
      if (rows.length > 15) lines.push(`  ${DIM}… ${rows.length - 15} more${RESET}`);
    }
  }
  if (report.unusedAllowRules && report.unusedAllowRules.length > 0) {
    lines.push("");
    lines.push(`${YELLOW}${report.unusedAllowRules.length} --allow rule(s) matched nothing${RESET}`);
    for (const r of report.unusedAllowRules) {
      lines.push(`  ${DIM}- ${r.raw}${RESET}`);
    }
    lines.push(`${DIM}Delete them: an exemption kept past the pattern it covered only widens the blind spot.${RESET}`);
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
  --timeout <ms>         Page navigation timeout (default: 30000)
  --wait-until <state>   domcontentloaded, load, or networkidle (default)
  --har <file>           Replay network responses from a Playwright HAR
  --json                 Print JSON report
  --storage-state <file> Playwright storage state, to measure pages behind
                         a login (or set VLMKIT_STORAGE_STATE)
${ALLOW_HELP}
Exit code is non-zero when the verdict is "defects".`);
  process.exit(exitCode);
}

async function main(argv = process.argv.slice(2)): Promise<void> {
  if (argv.includes("--help") || argv.includes("-h")) printUsage(0);
  let json = false;
  let maxFindings: number | undefined;
  let widths: number[] | undefined;
  const storageState = readFlag(argv, "storage-state");
  const har = readFlag(argv, "har");
  const timeout = readInt(argv, "timeout", { min: 1 });
  const waitUntil = readChoice(
    argv,
    "wait-until",
    ["domcontentloaded", "load", "networkidle"] as const,
  );
  const allowSpecs: string[] = [];
  const positional: string[] = [];
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i]!;
    if (arg === "--json") json = true;
    else if (arg === "--max-findings") maxFindings = Number.parseInt(argv[++i] ?? "12", 10);
    else if (arg === "--storage-state" || arg === "--har" || arg === "--timeout" || arg === "--wait-until") i++;
    else if (arg === "--allow") allowSpecs.push(argv[++i] ?? "");
    else if (arg === "--viewports") {
      widths = (argv[++i] ?? "").split(",").map((w) => Number.parseInt(w, 10)).filter((w) => w > 0);
      if (widths.length === 0) printUsage(1);
    } else if (!arg.startsWith("-")) positional.push(arg);
  }
  const source = positional[0];
  if (!source) printUsage(1);
  const heights: Record<number, number> = { 1280: 800, 768: 900, 375: 700 };
  // Parsed before the browser starts, so a typo in an exemption fails in
  // milliseconds instead of after a three-viewport sweep.
  const allow = parseAllowRules(allowSpecs);
  const report = await runIntegrityCheck({
    source,
    ...(widths ? { viewports: widths.map((w) => ({ width: w, height: heights[w] ?? 800 })) } : {}),
    ...(maxFindings !== undefined ? { maxFindings } : {}),
    ...(storageState ? { storageState } : {}),
    ...(timeout !== undefined ? { timeout } : {}),
    ...(waitUntil ? { waitUntil } : {}),
    ...(har ? { har } : {}),
    ...(allow.length > 0 ? { allow } : {}),
  });
  if (json) console.log(JSON.stringify(report, null, 2));
  else console.log(formatIntegrityReport(report));
  if (report.verdict !== "clean") process.exit(1);
}

const isCliEntry = process.env.__VLMKIT_DISPATCHER_LEAF__ === "integrity-check" ||
  (process.argv[1] ? resolve(process.argv[1]) === fileURLToPath(import.meta.url) : false);
if (isCliEntry) {
  main().catch(handleCliError);
}
