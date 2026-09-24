#!/usr/bin/env node
/**
 * `check integrity` — the browser half: sweep viewports, run the in-page
 * collectors, and hand what they return to the judges.
 *
 * The defect classes (A1-A13), every finding type and every pure judge live in
 * `@mizchi/vlmkit-judge/integrity.ts`, which runs on collected candidates and
 * never on a page. They are re-exported here so every existing import keeps working.
 *
 * CLI:
 *   vlmkit check integrity <html-or-url> [--viewports 1280,768,375] [--json]
 */
import { STABLE_SELECTOR_JS } from "@mizchi/vlmkit-core/stable-selector.ts";
import { CONTRAST_BACKGROUND_JS } from "../contrast-background.ts";
import { PNG } from "pngjs";
import { withAuthState } from "@mizchi/vlmkit-core/auth-state.ts";
import {
  applyAllowRules,
  type IntegrityAllowRule,
} from "./integrity-exemption.ts";
import type { RuleView } from "@mizchi/vlmkit-core/plugin/contract.ts";
import { applyHar, settlePage, sourceToUrl } from "@mizchi/vlmkit-core/page-open.ts";
import { describeRedirect } from "@mizchi/vlmkit-core/navigation-redirect.ts";
import { BOLD, CYAN, DIM, GREEN, RED, RESET, YELLOW } from "@mizchi/vlmkit-core/terminal-colors.ts";
import { extractComponentsFromRgba } from "../component/component-bbox.ts";
import { analyzeScrollSamples, COLLECT_SCROLL_SCRIPT, type ScrollScanInput } from "./scroll-scan.ts";
import { withBrowser } from "@mizchi/vlmkit-core/browser-launch.ts";
import {
  classifyRuntimeEvents,
  classifyRuntimeParty,
  correlateRuntimeEvents,
  findOccludedText,
  findTextCollisions,
  firstStackUrl,
  judgeAlignment,
  judgeClippedText,
  judgeCollapsedContainers,
  judgeNetworkFailures,
  judgeProtrusions,
  judgeRender,
  judgeResources,
  judgeTextContrast,
  judgeUnstyled,
  measureInkRatio,
  type AlignmentGroup,
  type ClipCandidate,
  type CollapseCandidate,
  type ContrastCandidate,
  type IntegrityExemption,
  type IntegrityFinding,
  type IntegrityReport,
  type IntegrityTextBlock,
  type IntegrityViewportStats,
  type NetworkFailure,
  type OcclusionCandidate,
  type ProtrusionCandidate,
  type ResourceSample,
  type RuntimeEvent,
  type StyleFingerprint,
  type TextCollisionOptions,
} from "@mizchi/vlmkit-judge/integrity.ts";

export * from "@mizchi/vlmkit-judge/integrity.ts";

// ---------------------------------------------------------------------------
// In-page collectors

/** Text blocks with the stacking metadata the collision exemptions need. */
export const COLLECT_OCCLUSIONS = `(() => {
  ${STABLE_SELECTOR_JS}
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
  ${STABLE_SELECTOR_JS}
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
    // The clip clamp. COLLECT_OCCLUSIONS computes the same intersection for the same
    // reason — glyphs are only painted inside every clipping ancestor — and this collector
    // not doing it is what made a masked "fade out" section collide with the section below.
    // Includes overflow auto/scroll, matching that collector: content scrolled out of a
    // scrollport is not painted where its box says either. The cost is a genuine collision
    // hidden inside a scrollport going unreported, which is the right side of the trade for a
    // fail-severity rule — a false fail on a real page is what makes a gate get turned off.
    let clipL = -Infinity, clipT = -Infinity, clipR = Infinity, clipB = Infinity;
    // Which ancestor owns each binding edge. Naming merely the nearest clipping ancestor sent
    // the reader to the wrong element: on vite.dev the innermost testimonial card also has
    // non-visible overflow, while the edge that actually cut the text is the masked wall
    // 800px up. The exemption names the element whose edge did the cutting.
    let ownerL = null, ownerT = null, ownerR = null, ownerB = null;
    for (let p = block; p && p !== document.documentElement; p = p.parentElement) {
      const pcs = getComputedStyle(p);
      const clipsX = pcs.overflowX !== "visible";
      const clipsY = pcs.overflowY !== "visible";
      if (!clipsX && !clipsY) continue;
      const pb = p.getBoundingClientRect();
      if (clipsX) {
        if (pb.left + scrollX > clipL) { clipL = pb.left + scrollX; ownerL = p; }
        if (pb.right + scrollX < clipR) { clipR = pb.right + scrollX; ownerR = p; }
      }
      if (clipsY) {
        if (pb.top + scrollY > clipT) { clipT = pb.top + scrollY; ownerT = p; }
        if (pb.bottom + scrollY < clipB) { clipB = pb.bottom + scrollY; ownerB = p; }
      }
    }
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
      b = { el: block, parts: [], x1: Infinity, y1: Infinity, x2: -Infinity, y2: -Infinity,
        ux1: Infinity, uy1: Infinity, ux2: -Infinity, uy2: -Infinity,
        overlay, zIndex, ariaHidden, clip: { l: clipL, t: clipT, r: clipR, b: clipB },
        owners: { l: ownerL, t: ownerT, r: ownerR, b: ownerB } };
      buckets.set(block, b);
    }
    b.parts.push(raw);
    for (const r of rects) {
      const x1 = r.left + scrollX, y1 = r.top + scrollY, x2 = r.right + scrollX, y2 = r.bottom + scrollY;
      // Unclipped box first: it is what decides whether a clipped-away block would have been
      // reported, which is the exemption the Node side prints.
      b.ux1 = Math.min(b.ux1, x1);
      b.uy1 = Math.min(b.uy1, y1);
      b.ux2 = Math.max(b.ux2, x2);
      b.uy2 = Math.max(b.uy2, y2);
      const vx1 = Math.max(x1, clipL), vy1 = Math.max(y1, clipT);
      const vx2 = Math.min(x2, clipR), vy2 = Math.min(y2, clipB);
      // A rect can be clipped to nothing while its siblings survive — a paragraph straddling
      // the fade line — so this is per-rect rather than per-block.
      if (vx2 - vx1 <= 0 || vy2 - vy1 <= 0) continue;
      b.x1 = Math.min(b.x1, vx1);
      b.y1 = Math.min(b.y1, vy1);
      b.x2 = Math.max(b.x2, vx2);
      b.y2 = Math.max(b.y2, vy2);
    }
  }
  return Array.from(buckets.values())
    .map((b) => {
      const clippedAway = !(b.x2 - b.x1 > 1 && b.y2 - b.y1 > 1);
      const uw = Math.round(b.ux2 - b.ux1), uh = Math.round(b.uy2 - b.uy1);
      const clipped = clippedAway
        || Math.round(b.x2 - b.x1) !== uw || Math.round(b.y2 - b.y1) !== uh;
      // The binding edge: how far past each clip boundary the pre-clip box reaches. The
      // largest overrun is the edge a reader has to go and look at.
      const overruns = [
        { px: b.clip.t - b.uy1, el: b.owners.t },
        { px: b.uy2 - b.clip.b, el: b.owners.b },
        { px: b.clip.l - b.ux1, el: b.owners.l },
        { px: b.ux2 - b.clip.r, el: b.owners.r },
      ].filter((o) => o.el && Number.isFinite(o.px) && o.px > 0).sort((x, y) => y.px - x.px);
      const clipper = overruns.length > 0 ? overruns[0].el : null;
      return {
        selector: stableSelector(b.el),
        text: b.parts.join(" ").replace(/\\s+/g, " ").trim(),
        // A clipped-away block reports its pre-clip box: the Node side needs a box to decide
        // whether it would have collided, and zero-size rows would just be dropped by the
        // filter below with nothing said about them.
        x: Math.round(clippedAway ? b.ux1 : b.x1),
        y: Math.round(clippedAway ? b.uy1 : b.y1),
        width: clippedAway ? uw : Math.round(b.x2 - b.x1),
        height: clippedAway ? uh : Math.round(b.y2 - b.y1),
        overlay: b.overlay,
        zIndex: b.zIndex,
        ariaHidden: b.ariaHidden,
        inkInset: inkInsetOf(b.el, b.parts.join(" ")),
        ...(clipped ? { unclipped: { x: Math.round(b.ux1), y: Math.round(b.uy1), width: uw, height: uh } } : {}),
        ...(clipped && clipper ? { clippedBy: stableSelector(clipper) } : {}),
        ...(clippedAway ? { clippedAway: true } : {}),
      };
    })
    .filter((t) => t.text.length > 0 && t.width > 1 && t.height > 1)
    .sort((a, b) => a.y - b.y || a.x - b.x);
})()`;

export const COLLECT_CLIP_CANDIDATES = `(() => {
  ${STABLE_SELECTOR_JS}
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
  ${STABLE_SELECTOR_JS}
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
  ${STABLE_SELECTOR_JS}
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
  ${STABLE_SELECTOR_JS}
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
  ${STABLE_SELECTOR_JS}
  ${CONTRAST_BACKGROUND_JS}
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
    // Shared with check a11y contrast via CONTRAST_BACKGROUND_JS. It used to be inline here and
    // reimplemented, differently and worse, in the other gate — which reported the inverse of
    // the truth on a gradient. One resolution, one answer.
    const resolved = resolveTextBackground(el);
    if (resolved.composite) { skippedComposite++; continue; }
    const bg = resolved.bg;
    const fgColor = parseColor(style.color) || [0, 0, 0, 1];
    const fg = blendColor(bg, [fgColor[0], fgColor[1], fgColor[2], fgColor[3] * inheritedOpacity(el)]);
    const r = contrastRatio(fg, bg);
    // WCAG's floor depends on the text's size, and this used to be a flat 3:1 —
    // which is the LARGE-text floor applied to everything. A dogfood agent found
    // what that means in practice: 13px body text at 3.03:1 is a WCAG AA failure,
    // \`check a11y contrast\` reports it as "3.03:1 (need 4.5)", and this gate said
    // CLEAN and exited 0. "Fixing only to satisfy criterion 1 would have left the
    // low-vision reporter failed with a green gate."
    //
    // Large = 24px, or 18.66px at weight 700+ (WCAG 2.2's 18pt / 14pt bold).
    const fontSizePx = parseFloat(style.fontSize) || 16;
    const weight = parseFloat(style.fontWeight) || (/bold/i.test(style.fontWeight) ? 700 : 400);
    const large = fontSizePx >= 24 || (fontSizePx >= 18.66 && weight >= 700);
    const floor = large ? 3 : 4.5;
    if (r >= floor) continue;
    candidates.push({
      selector: stableSelector(el),
      text: direct.replace(/\\s+/g, " ").trim().slice(0, 60),
      ratio: Math.round(r * 100) / 100,
      fg: "rgb(" + fg.map(Math.round).join(", ") + ")",
      bg: "rgb(" + bg.map(Math.round).join(", ") + ")",
      disabled: el.closest("[disabled], [aria-disabled='true']") != null,
      shadowed: style.textShadow !== "none",
      fontSizePx: Math.round(fontSizePx * 10) / 10,
      large: large,
      floor: floor,
    });
  }
  return { candidates, skippedComposite };
})()`;

export const COLLECT_ALIGN_GROUPS = `(() => {
  ${STABLE_SELECTOR_JS}
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
   * Set when the gate ran in image mode (`--elements`, optionally `--image`): no DOM, no
   * browser, rules judged from element rects and frame pixels. See `integrity-image.ts`.
   *
   * Declared here rather than as a separate options type because the gate has one
   * `parse` and one `run`, and splitting the type would mean two gates in the registry
   * for what is one command with two input adapters.
   */
  imageMode?: {
    elementsPath: string;
    imagePath?: string;
    maxFindings?: number;
    viewport?: number;
  };
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

  await withBrowser(async (browser) => {
    const url = sourceToUrl(options.source);
    for (let vi = 0; vi < viewports.length; vi++) {
      const viewport = viewports[vi]!;
      const page = await browser.newPage(withAuthState({ viewport }, options.storageState));
      // Through `applyHar`, not a local `routeFromHAR`: the shared helper reads the
      // recording and can therefore tell a request the fixture never held from a
      // resource the page actually broke. Without that, an out-of-date HAR reads as
      // a page full of broken resources — v5's CI agent: "a new endpoint absent from
      // the HAR is *aborted*, surfacing as a broken-resource **defect** rather than
      // 'your fixture is out of date'."
      const harReplay = await applyHar(page, options.har);
      const events: RuntimeEvent[] = [];
      const netFailures: NetworkFailure[] = [];
      let loaded = false;
      page.on("load", () => { loaded = true; });
      page.on("pageerror", (err) => {
        // The stack's first frame, so a throw from inside a vendor bundle is attributed to
        // the vendor rather than to the page that loaded it.
        const sourceUrl = firstStackUrl(err?.stack);
        events.push({
          type: "pageerror",
          text: String(err?.message ?? err).slice(0, 200),
          phase: loaded ? "post-load" : "construction",
          ...(sourceUrl !== undefined ? { sourceUrl } : {}),
          party: classifyRuntimeParty(sourceUrl, url),
        });
      });
      page.on("console", (msg) => {
        if (msg.type() !== "error") return;
        const text = msg.text().slice(0, 200);
        // The browser logs "Failed to load resource" for a request `--har` aborted,
        // and that console line carries no URL — so it would be reported as the
        // page's own JS error while the request itself is correctly blamed on the
        // fixture. Only skipped when there IS a fixture miss to explain it, so a real
        // broken resource on a HAR-less run still reports.
        if (harReplay && harReplay.misses().length > 0 && /Failed to load resource/i.test(text)) return;
        // `msg.location().url` is the script the console.error was called from — and for
        // the browser's own resource notices it is the URL that failed, which is what
        // `correlateRuntimeEvents` matches against the wire to drop the echo.
        const sourceUrl = msg.location()?.url || undefined;
        events.push({
          type: "console-error",
          text,
          phase: loaded ? "post-load" : "construction",
          ...(sourceUrl !== undefined ? { sourceUrl } : {}),
          party: classifyRuntimeParty(sourceUrl, url),
        });
      });
      const pageOrigin = (() => { try { return new URL(url).origin; } catch { return ""; } })();
      const originOf = (u: string) => { try { return new URL(u).origin; } catch { return pageOrigin; } };
      page.on("requestfailed", (req) => {
        netFailures.push({
          url: req.url(),
          resourceType: req.resourceType(),
          reason: req.failure()?.errorText ?? "failed",
          crossOrigin: originOf(req.url()) !== pageOrigin,
          ...(harReplay?.isMiss(req.url()) ? { harMiss: true } : {}),
        });
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
      // `settlePage`, not a hand-rolled pair, and the reason this gate needs all three parts is
      // worth keeping at the call site: network idle is not font-ready — with `font-display: swap`
      // the text reflows AFTER idle, so every geometry probe below would measure fallback metrics
      // on some runs and webfont metrics on others, which is the exact non-determinism this gate
      // promises not to have. The trailing 250ms is what lets a post-load timer throw before
      // anything is judged. Cheap when there are no webfonts: an already-resolved promise.
      await settlePage(page, 250);

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

      // A1. Correlated against the wire first: both streams are complete by now (the
      // navigation and `settlePage` above have finished), which is why this cannot be done
      // inside the console handler — Playwright does not guarantee `requestfailed` arrives
      // before the console line describing it.
      push(classifyRuntimeEvents(correlateRuntimeEvents(events, netFailures).events, viewport.width));

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
  });

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
  // No ledger append here. `integrityGate.ledger` writes the row, so the
  // runner owns it — which is what makes `--json`-only callers, the MCP
  // server, and `verify markup`'s folded-in gates all record once and obey
  // VLMKIT_NO_LEDGER. This function appended a second `integrity-check` row
  // on top of the gate's `check-integrity` one, double-counting run history.
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

export function formatIntegrityReport(report: IntegrityReport, rules?: RuleView): string {
  const lines: string[] = [];
  lines.push(`${BOLD}${CYAN}vlmkit check integrity${RESET}`);
  lines.push(`${DIM}source: ${report.source}${RESET}`);
  lines.push("");
  // Honour the project's rule settings in the PROSE, not only in the exit code.
  // `--rule low-contrast-text=off` used to print `3 finding(s) suppressed by rule
  // settings` and then print all three anyway, and count them on the verdict line —
  // because the prose renders from this report while suppression happens on the
  // runner's normalized finding list. v6's adopting agent hit the re-tuning half:
  // "the noise I re-tuned away is still in every CI log."
  //
  // `severityFor` maps a finding kind to what the settings made of it. A gate finding
  // kind IS the rule id here, which is what makes this a lookup rather than a guess.
  const severityFor = (kind: string, emitted: "fail" | "warn"): "fail" | "warn" | "info" | "off" => {
    // `setting`, NOT `effective`. `effective` falls back to the gate's rule TABLE, and this
    // gate deliberately emits some kinds at either severity depending on evidence —
    // `js-error` is a fail during construction and a warn after load, and `text-clipped` and
    // `degenerate-render` do the same. The runner keeps the emitted severity unless a setting
    // says otherwise ("only an explicit setting re-tunes"), so reading the table here printed
    // this, two adjacent lines, on a page that throws after load:
    //
    //     verdict: DEFECTS (1 fail, 0 warn, 0 exempted)
    //       exits 0 — 1 warn(s) did not fail this command.
    //
    // The rule-aware prose this function exists for was fixing the suppression half of the
    // contradiction while introducing an upgrade half.
    const setting = rules?.setting(kind);
    if (!setting) return emitted;
    const effective = setting;
    if (effective === "off") return "off";
    // The runner's vocabulary is suspect/warn/info; this gate's is fail/warn. `suspect`
    // is this gate's `fail`. `info` gets its own tier rather than collapsing into
    // `warn`: a rule demoted to informational is still worth printing, and printing it
    // as a warning is exactly the "I re-tuned it and nothing changed" the demotion was
    // meant to answer.
    if (effective === "suspect") return "fail";
    if (effective === "info") return "info";
    return "warn";
  };
  const shown = report.findings
    .map((f) => ({ finding: f, severity: severityFor(f.kind, f.severity) }))
    .filter((f) => f.severity !== "off");
  const fails = shown.filter((f) => f.severity === "fail").length;
  const warns = shown.filter((f) => f.severity === "warn").length;
  const infos = shown.length - fails - warns;
  // Three words, not two. `CLEAN` used to print whenever nothing FAILED, so a run
  // with warns read as `CLEAN (0 fail, 3 warn, 0 exempted)` — a verdict contradicting
  // its own counts, which v5's repair agent called "a coin-flip in CI" about the
  // equivalent line on `check design`. Widening the contrast floor made it common
  // rather than rare, so it is fixed here rather than recorded.
  //
  // `report.verdict` keeps its two values: it is the JSON contract, and it means
  // exactly "did anything fail". Only the printed word gains the middle case.
  const word = fails > 0
    ? `${RED}DEFECTS${RESET}`
    : warns > 0
      ? `${YELLOW}NO DEFECTS, ${warns} WARN${RESET}`
      : `${GREEN}CLEAN${RESET}`;
  // The exit code is NOT appended here. The runner inserts it directly under this line
  // for every gate (`withExitIntent`), so stating it here too would print it twice —
  // and one gate saying it while twenty-six do not is the divergence that put the
  // `--wait-until` hint on two gates out of four.
  lines.push(
    `verdict: ${word} (${fails} fail, ${warns} warn`
    + (infos > 0 ? `, ${infos} info` : "")
    + `, ${report.exempted.length} exempted)`,
  );
  for (const v of report.viewports) {
    lines.push(`${DIM}  ${v.width}x${v.height}: ${v.components} component(s), ink ${(v.inkRatio * 100).toFixed(1)}%, ${v.textBlocks} text block(s)${RESET}`);
  }
  if (shown.length > 0) {
    lines.push("");
    lines.push("Findings:");
    for (const { finding: f, severity } of shown) {
      const icon = severity === "fail"
        ? `${RED}x${RESET}`
        : severity === "info" ? `${DIM}i${RESET}` : `${YELLOW}!${RESET}`;
      // Show every width it appeared at: "@1280" and "@1280,768,375" are
      // different bugs to fix, and the caller cannot tell them apart otherwise.
      const at = f.viewports && f.viewports.length > 1 ? f.viewports.join(",") : String(f.viewport);
      lines.push(`  ${icon} [${f.kind}]${f.selector ? ` ${f.selector}` : ""} @${at}: ${f.message}`);
    }
  } else {
    lines.push("");
    lines.push(`${GREEN}No integrity defects detected.${RESET}`);
  }
  // Image mode evaluates 6 of 18 rules. A bare "No integrity defects detected." would let
  // that read as full coverage, which is the one way this feature could do harm: the value
  // of a gate is what a clean result rules out, and a clean result over a third of the
  // rules rules out a third as much. Printed next to the verdict, not in a footnote.
  const coverage = report as Partial<{
    skippedRules: { rule: string; reason: string }[];
    inertRules: { rule: string; reason: string }[];
  }>;
  if (coverage.skippedRules && coverage.skippedRules.length > 0) {
    lines.push("");
    lines.push(
      `${YELLOW}Coverage: image mode — ${coverage.skippedRules.length} rule(s) cannot be`
      + ` evaluated without a DOM${RESET}`,
    );
    for (const skipped of coverage.skippedRules) {
      lines.push(`${DIM}  - ${skipped.rule}: ${skipped.reason}${RESET}`);
    }
    if (coverage.inertRules && coverage.inertRules.length > 0) {
      lines.push(
        `${DIM}  ${coverage.inertRules.length} rule(s) ran with no input to judge:${RESET}`,
      );
      for (const inert of coverage.inertRules) {
        lines.push(`${DIM}  - ${inert.rule}: ${inert.reason}${RESET}`);
      }
    }
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

/**
 * CLI entry removed: this module is measurement code now, not a command.
 * `check integrity` is declared in `../gates/integrity.gate.ts` and driven by the core
 * runner (`@mizchi/vlmkit-core/plugin/runner.ts`), which owns argument
 * parsing, `--json`, `--advisory`, the run ledger and the exit code.
 */
