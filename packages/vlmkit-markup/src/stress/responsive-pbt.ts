/**
 * `check responsive`: responsive layout as a property-based test.
 *
 * The viewport is the generated input, the page's own media queries partition it, and
 * the layout judges are the properties:
 *
 *   1. **Partition.** Every media condition on the page (every sheet's `@media` and
 *      `@import` through the DevTools protocol, which reads cross-origin sheets the CSSOM
 *      cannot, plus `<link media>` and `<source media>`) is evaluated with `matchMedia`
 *      across the width range; where the matching set changes
 *      is a transition, and between two transitions is a regime. The numbers in the
 *      conditions only seed the sampling — `matchMedia` decides, so em units, range
 *      syntax, `calc()` and `not` all partition correctly, and a change no number
 *      predicted is bisected to the pixel.
 *   2. **Generate.** Both sides of every transition and both ends of the range first,
 *      then seeded random cases visiting the regimes round-robin, with height, text scale
 *      (`--text-scale`), colour scheme and reduced motion varied when the page reacts to
 *      them.
 *   3. **Check.** Each case is one resize of one loaded page (no reload), then
 *      `check integrity`'s layout judges — page overflow, clipped content, text collision,
 *      clipped text, protrusion, occlusion, collapsed containers — plus `text-starved`,
 *      the class the demo sites found only by eye.
 *   4. **Shrink.** Findings failing in the same cases are grouped; each group is shrunk
 *      in every dimension but width toward the base case, then its width is widened to
 *      the exact failing interval, which is anchored to the transitions (a breakpoint
 *      switched on too early reads as "starts at 700, clears at 872"), and the implied
 *      breakpoint move is tried on the real stylesheet before it is suggested. Last, the
 *      layout declarations on the element and its relatives are overridden one at a time
 *      in rank order (ddmin when no single one suffices) to name the one that causes it.
 *
 * Deterministic for a given seed. No VLM, no screenshots.
 */
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import type { Page } from "playwright";
import { STABLE_SELECTOR_JS } from "@mizchi/vlmkit-core/stable-selector.ts";
import { withAuthState } from "@mizchi/vlmkit-core/auth-state.ts";
import { describeRedirect } from "@mizchi/vlmkit-core/navigation-redirect.ts";
import { type PageLoadOptions, navigatePage } from "@mizchi/vlmkit-core/page-load.ts";
import { isUrlSource, settlePage, sourceToUrl } from "@mizchi/vlmkit-core/page-open.ts";
import { withBrowser } from "@mizchi/vlmkit-core/browser-launch.ts";
import { BOLD, CYAN, DIM, GREEN, RED, RESET, YELLOW } from "@mizchi/vlmkit-core/terminal-colors.ts";
import type { RuleView } from "@mizchi/vlmkit-core/plugin/contract.ts";
import { retuneNote, tierIssues } from "@mizchi/vlmkit-core/plugin/rule-prose.ts";
import {
  bisectChange,
  createRng,
  failingInterval,
  minimizeSubset,
  shrinkRecord,
  type ShrinkStep,
} from "@mizchi/vlmkit-judge/pbt.ts";
import {
  anchorInterval,
  baseCase,
  breakpointMoves,
  qualifyAnchor,
  rankCauseCandidates,
  caseShrinkers,
  describeCase,
  edgeCases,
  failureKey,
  generateCase,
  groupFailures,
  heightCandidates,
  judgeStarvedText,
  regimesFromSamples,
  unvariedFeatures,
  widthCandidates,
  type CaseOutcome,
  type CauseCandidate,
  type FailureAnchor,
  type MediaSample,
  type MediaTransition,
  type ResponsiveCase,
  type ResponsiveFinding,
  type ResponsiveSpace,
  type StarvedTextSample,
  type WidthRegime,
} from "@mizchi/vlmkit-judge/responsive.ts";
import {
  COLLECT_CLIP_CANDIDATES,
  COLLECT_COLLAPSE_CANDIDATES,
  COLLECT_INTEGRITY_TEXT,
  COLLECT_OCCLUSIONS,
  COLLECT_PROTRUSIONS,
  findOccludedText,
  findTextCollisions,
  judgeClippedText,
  judgeCollapsedContainers,
  judgeProtrusions,
  type ClipCandidate,
  type CollapseCandidate,
  type IntegrityFinding,
  type IntegrityTextBlock,
  type OcclusionCandidate,
  type ProtrusionCandidate,
} from "../inspect/integrity-check.ts";
import { analyzeScrollSamples, COLLECT_SCROLL_SCRIPT, type ScrollScanInput } from "../inspect/scroll-scan.ts";
import { CssInspector, type TaggedNode } from "./responsive-css.ts";

// ---------------------------------------------------------------------------
// Properties

/**
 * A property is a measurement taken at the current case. Built-ins wrap `check integrity`'s
 * collectors; a library caller can pass its own (`runResponsiveOnPage({ properties })`).
 */
export interface ResponsiveProperty {
  /** The finding kinds this property can produce. The oracle picks a property by kind. */
  kinds: readonly string[];
  measure(page: Page, viewport: { width: number; height: number }): Promise<ResponsiveFinding[]>;
}

const targetsOf = (f: IntegrityFinding): string[] => {
  const e = f.evidence ?? {};
  const picked = [e.a, e.b, e.child, e.parent, e.occluder]
    .filter((v): v is string => typeof v === "string" && !v.startsWith("("));
  if (picked.length > 0) return [...new Set(picked)];
  return f.selector && !f.selector.startsWith("(") ? [f.selector] : [];
};

const fromIntegrity = (f: IntegrityFinding): ResponsiveFinding => ({
  kind: f.kind as ResponsiveFinding["kind"],
  severity: f.severity,
  ...(f.selector !== undefined ? { selector: f.selector } : {}),
  targets: targetsOf(f),
  message: f.message,
  ...(f.evidence ? { evidence: f.evidence } : {}),
});

/**
 * Text blocks for `text-starved`: block-level boxes whose text is laid out in their own
 * inline formatting context (text nodes reached through inline elements only), with their
 * line count from `Range.getClientRects()`. A mid-word break is looked for only where the
 * box is already narrow, so the per-character probe stays cheap.
 */
export const COLLECT_STARVED_TEXT = `(() => {
  ${STABLE_SELECTOR_JS}
  const out = [];
  const vw = window.innerWidth;
  const INLINE = /^inline(?!-block|-flex|-grid|-table)/;
  const WORD = /[\\p{Script=Latin}\\p{Script=Greek}\\p{Script=Cyrillic}\\p{Nd}]/u;
  const SKIP = new Set(["SCRIPT", "STYLE", "NOSCRIPT", "TEMPLATE", "svg", "SVG", "MATH", "TEXTAREA", "INPUT", "SELECT", "OPTION"]);
  const range = document.createRange();
  for (const el of Array.from(document.querySelectorAll("body *"))) {
    if (out.length >= 400) break;
    if (SKIP.has(el.tagName) || el.closest("svg")) continue;
    const style = getComputedStyle(el);
    if (style.display === "none" || style.display === "contents" || INLINE.test(style.display)) continue;
    if (style.visibility !== "visible" || parseFloat(style.opacity) === 0) continue;
    if (style.writingMode && style.writingMode !== "horizontal-tb") continue;
    // Text reached through inline descendants only: a nested block measures itself.
    const nodes = [];
    let brs = 0;
    const walk = (node) => {
      for (const child of node.childNodes) {
        if (child.nodeType === 3) {
          if (child.nodeValue && child.nodeValue.trim()) nodes.push(child);
        } else if (child.nodeType === 1) {
          if (child.tagName === "BR") { brs++; continue; }
          if (SKIP.has(child.tagName)) continue;
          const cs = getComputedStyle(child);
          if (cs.display === "none") continue;
          if (INLINE.test(cs.display) || cs.display === "contents") walk(child);
        }
      }
    };
    walk(el);
    if (nodes.length === 0) continue;
    const text = nodes.map((n) => n.nodeValue).join("").replace(/\\s+/g, " ").trim();
    const chars = Array.from(text).length;
    if (chars < 3) continue;
    const rect = el.getBoundingClientRect();
    if (rect.width <= 2 || rect.height <= 2) continue;
    if (rect.right <= 0 || rect.left >= vw) continue;
    const fontSize = parseFloat(style.fontSize) || 16;
    const lineTops = [];
    const tolerance = fontSize * 0.5;
    for (const n of nodes) {
      range.selectNodeContents(n);
      for (const r of Array.from(range.getClientRects())) {
        if (r.width < 0.5 || r.height < 0.5) continue;
        const mid = r.top + r.height / 2;
        if (!lineTops.some((t) => Math.abs(t - mid) < tolerance)) lineTops.push(mid);
      }
    }
    const lines = lineTops.length;
    if (lines < 2) continue;
    const preserves = /^(pre|pre-wrap|pre-line|break-spaces)$/.test(style.whiteSpace);
    const newlines = preserves ? (nodes.map((n) => n.nodeValue).join("").trim().match(/\\n/g) || []).length : 0;
    const contentWidth = el.clientWidth - parseFloat(style.paddingLeft) - parseFloat(style.paddingRight);
    let brokenWord;
    if (contentWidth / fontSize < 12 && style.hyphens !== "auto") {
      outer: for (const n of nodes) {
        const value = n.nodeValue || "";
        if (value.length > 400) continue;
        let prevMid = null;
        for (let i = 0; i < value.length; i++) {
          range.setStart(n, i);
          range.setEnd(n, i + 1);
          const r = range.getBoundingClientRect();
          if (r.width < 0.5 && r.height < 0.5) continue;
          const mid = r.top + r.height / 2;
          if (prevMid !== null && Math.abs(mid - prevMid) >= tolerance && i > 0
            && WORD.test(value[i - 1]) && WORD.test(value[i]) && value[i - 1] !== "\\u00AD") {
            let a = i - 1, b = i;
            while (a > 0 && WORD.test(value[a - 1])) a--;
            while (b + 1 < value.length && WORD.test(value[b + 1])) b++;
            brokenWord = value.slice(a, b + 1);
            break outer;
          }
          prevMid = mid;
        }
      }
    }
    out.push({
      selector: stableSelector(el),
      text: text.length > 40 ? text.slice(0, 39) + "…" : text,
      chars,
      lines,
      authoredLines: Math.max(brs, newlines) + 1,
      contentWidth,
      fontSize,
      ...(brokenWord !== undefined ? { brokenWord } : {}),
    });
  }
  return out;
})()`;

export const BUILTIN_PROPERTIES: readonly ResponsiveProperty[] = [
  {
    kinds: ["page-overflow-x", "clipped-content"],
    measure: async (page) => {
      const scroll = await page.evaluate(COLLECT_SCROLL_SCRIPT) as Omit<ScrollScanInput, "source">;
      const report = analyzeScrollSamples({ source: "", ...scroll });
      return report.issues
        .filter((i) => i.kind === "page-overflow-x" || i.kind === "clipped-content")
        .map((i) => ({
          kind: i.kind as ResponsiveFinding["kind"],
          severity: i.kind === "page-overflow-x" ? "fail" as const : "warn" as const,
          ...(i.selector ? { selector: i.selector } : {}),
          targets: i.selector
            ? [i.selector]
            : scroll.page.overflowOffenders.slice(0, 3).map((o) => o.selector),
          message: i.message,
        }));
    },
  },
  {
    kinds: ["text-collision"],
    measure: async (page, viewport) =>
      findTextCollisions(await page.evaluate(COLLECT_INTEGRITY_TEXT) as IntegrityTextBlock[], viewport.width)
        .findings.map(fromIntegrity),
  },
  {
    kinds: ["text-clipped"],
    measure: async (page, viewport) =>
      judgeClippedText(await page.evaluate(COLLECT_CLIP_CANDIDATES) as ClipCandidate[], viewport.width)
        .findings.map(fromIntegrity),
  },
  {
    kinds: ["container-protrusion"],
    measure: async (page, viewport) =>
      judgeProtrusions(await page.evaluate(COLLECT_PROTRUSIONS) as ProtrusionCandidate[], viewport.width)
        .findings.map(fromIntegrity),
  },
  {
    kinds: ["occluded-text"],
    measure: async (page, viewport) =>
      findOccludedText(await page.evaluate(COLLECT_OCCLUSIONS) as OcclusionCandidate[], viewport.width)
        .findings.map(fromIntegrity),
  },
  {
    kinds: ["collapsed-container"],
    measure: async (page, viewport) =>
      judgeCollapsedContainers(await page.evaluate(COLLECT_COLLAPSE_CANDIDATES) as CollapseCandidate[], viewport.width)
        .findings.map(fromIntegrity),
  },
  {
    kinds: ["text-starved"],
    measure: async (page) => judgeStarvedText(await page.evaluate(COLLECT_STARVED_TEXT) as StarvedTextSample[]),
  },
];

// ---------------------------------------------------------------------------
// Options and report

export interface ResponsiveOptions extends PageLoadOptions {
  source: string;
  storageState?: string;
  /** Seed for the case stream (default 1). Printed with every failure. */
  seed?: number;
  /** Cases evaluated, edge cases included (default 60). */
  runs?: number;
  minWidth?: number;
  maxWidth?: number;
  minHeight?: number;
  maxHeight?: number;
  /** The height most cases use and failures shrink toward (default 900). */
  height?: number;
  /** Largest text scale to generate; enables the text-scale dimension (e.g. 2). */
  textScale?: number;
  /** Replay exactly one case instead of generating: the width plus any pinned dimension. */
  replay?: Partial<ResponsiveCase> & { width: number };
  /** Failure groups to shrink and explain (default 8). The rest are listed unshrunk. */
  maxShrinks?: number;
  /** Skip the declaration search (ddmin over overrides). */
  noCause?: boolean;
  /** Properties to check; defaults to the built-ins. */
  properties?: readonly ResponsiveProperty[];
}

/** A declaration the cause search overrode; see `CauseCandidate` in the judge package. */
export type CauseDeclaration = CauseCandidate;

export interface ResponsiveCause {
  declarations: CauseDeclaration[];
  /** Other single declarations whose override also clears it, in rank order. */
  alternatives: CauseDeclaration[];
  /** Candidates tried. */
  candidates: number;
  attempts: number;
  /** False when the search ran out of budget: the set clears it but may not be minimal. */
  complete: boolean;
  /** Widths across the interval where the same override was re-checked and held. */
  holdsAt: number[];
  /** Widths where it did not. */
  failsAt: number[];
}

export interface ResponsiveFailure {
  kind: string;
  severity: "fail" | "warn";
  selectors: string[];
  /** The representative finding's message, re-measured at the shrunk case when shrunk. */
  message: string;
  /** Cases (of `cases`) this group failed in. */
  failingCases: number;
  firstCase: ResponsiveCase;
  shrunk?: {
    case: ResponsiveCase;
    steps: ShrinkStep[];
    /** Dimensions the failure still needs besides width. */
    needs: ("height" | "textScale" | "colorScheme" | "reducedMotion")[];
    interval: { lo: number; hi: number; atMin: boolean; atMax: boolean };
    anchor: FailureAnchor;
    /**
     * The anchor's breakpoint move, tried: the conditions rewritten in the stylesheet, the
     * failure re-checked across the interval, and every property re-checked there for a
     * failure the move would introduce.
     */
    move?: BreakpointMoveCheck;
    /** Generated widths where this group also failed outside the interval. */
    alsoFailsAt: number[];
    attempts: number;
    exhausted: boolean;
  };
  cause?: ResponsiveCause;
  /** Why no cause was named, when none was. */
  causeNote?: string;
  reproduce: string;
}

export interface BreakpointMoveCheck {
  moves: { from: string; to: string }[];
  /** Conditions found and rewritten in readable stylesheets. */
  rewritten: number;
  /** True when the failure cleared at every checked width and nothing new failed. */
  verified: boolean;
  checkedAt: number[];
  /** Widths where the failure survived the move. */
  stillFailsAt: number[];
  /** Failure keys the move introduced at the checked widths. */
  introduces: string[];
}

export type ResponsiveIssueKind = ResponsiveFinding["kind"] | "redirected" | "untested-media-feature";

export interface ResponsiveIssue {
  kind: ResponsiveIssueKind;
  severity: "suspect" | "warn" | "info";
  message: string;
  selector?: string;
  viewport?: number;
  /** Index into `failures` for the rows that describe one. */
  failure?: number;
}

export interface ResponsiveReport {
  source: string;
  seed: number;
  space: ResponsiveSpace;
  /** Distinct media conditions found on the page. */
  conditions: string[];
  transitions: MediaTransition[];
  regimes: (WidthRegime & { cases: number; failingCases: number })[];
  unvaried: { feature: string; conditions: string[] }[];
  /** `@container` rules: they follow the viewport only indirectly, and are not partitioned on. */
  containerQueries: number;
  stylesheets?: { crossOrigin: number; fetched: number };
  properties: string[];
  cases: number;
  failingCases: number;
  replay?: ResponsiveCase;
  failures: ResponsiveFailure[];
  issues: ResponsiveIssue[];
  timing: { partitionMs: number; casesMs: number; shrinkMs: number };
}

// ---------------------------------------------------------------------------
// In-page helpers

const COLLECT_MEDIA_CONDITIONS = `(() => {
  const conditions = new Set();
  const crossOrigin = [];
  let container = 0;
  const add = (text) => {
    const t = (text || "").trim();
    if (t && t !== "all" && t !== "screen") conditions.add(t);
  };
  const walk = (rules) => {
    for (const rule of Array.from(rules || [])) {
      if (typeof CSSContainerRule !== "undefined" && rule instanceof CSSContainerRule) container++;
      if (rule instanceof CSSMediaRule) add(rule.media.mediaText);
      if (rule instanceof CSSImportRule) {
        add(rule.media && rule.media.mediaText);
        try { if (rule.styleSheet) walk(rule.styleSheet.cssRules); } catch {}
      }
      if (rule.cssRules) walk(rule.cssRules);
    }
  };
  for (const sheet of Array.from(document.styleSheets)) {
    add(sheet.media && sheet.media.mediaText);
    try {
      walk(sheet.cssRules);
    } catch {
      if (sheet.href) crossOrigin.push(sheet.href);
    }
  }
  for (const source of Array.from(document.querySelectorAll("source[media], link[media]"))) {
    add(source.getAttribute("media"));
  }
  return { conditions: Array.from(conditions), crossOrigin, container };
})()`;

/** Settle after a case change: two frames, and finish the transitions the resize started. */
const SETTLE = `(async () => {
  const frame = () => new Promise((r) => requestAnimationFrame(() => r()));
  await frame();
  if (typeof document.getAnimations === "function") {
    for (const a of document.getAnimations()) {
      const t = a.effect && a.effect.getComputedTiming ? a.effect.getComputedTiming() : null;
      if (t && t.iterations !== Infinity && t.endTime !== Infinity) { try { a.finish(); } catch {} }
    }
  }
  await frame();
})()`;

/**
 * The elements the cause search looks at, tagged with `data-vlmkit-pbt` so the override
 * and the DevTools protocol can find them again: the failing element, four ancestors, the
 * flex/grid siblings it (or its nearest flex/grid-placed ancestor) sits among, and three
 * levels of descendants — a box that clips or overflows is often sized by something
 * inside it (a table's min-width, a rigid price column). Declarations are read by
 * `CssInspector.causeCandidates`, which sees cross-origin sheets the CSSOM cannot.
 */
const TAG_CAUSE_NODES = `((targets) => {
  ${STABLE_SELECTOR_JS}
  const nodes = [];
  const roleOf = new Map();
  const addNode = (el, role) => {
    if (!el || el === document.body || el === document.documentElement || roleOf.has(el)) return;
    roleOf.set(el, role);
    nodes.push(el);
  };
  for (const sel of targets) {
    let el = null;
    try { el = document.querySelector(sel); } catch {}
    if (!el) continue;
    addNode(el, "target");
    let p = el.parentElement;
    for (let depth = 0; p && depth < 4; depth++, p = p.parentElement) addNode(p, "ancestor");
    for (let q = el; q && q.parentElement && q !== document.body; q = q.parentElement) {
      const pd = getComputedStyle(q.parentElement).display;
      if (!/flex|grid/.test(pd)) continue;
      for (const sib of Array.from(q.parentElement.children).slice(0, 12)) if (sib !== q) addNode(sib, "sibling");
      break;
    }
    let frontier = [el];
    for (let depth = 0; depth < 3 && frontier.length > 0; depth++) {
      const next = [];
      for (const n of frontier) for (const child of Array.from(n.children)) {
        if (nodes.length >= 60) break;
        if (/^(SCRIPT|STYLE|TEMPLATE)$/.test(child.tagName)) continue;
        addNode(child, "descendant");
        next.push(child);
      }
      frontier = next.slice(0, 30);
    }
  }
  return nodes.map((el, index) => {
    el.setAttribute("data-vlmkit-pbt", String(index));
    return { index, element: stableSelector(el), role: roleOf.get(el) };
  });
})`;

const APPLY_OVERRIDES = `((overrides) => {
  const saved = [];
  for (const o of overrides) {
    const el = document.querySelector('[data-vlmkit-pbt="' + o.node + '"]');
    if (!el) continue;
    saved.push({ node: o.node, property: o.property, value: el.style.getPropertyValue(o.property), priority: el.style.getPropertyPriority(o.property) });
    el.style.setProperty(o.property, o.override, "important");
  }
  window.__vlmkitPbtSaved = saved;
})`;

const RESTORE_OVERRIDES = `(() => {
  for (const s of (window.__vlmkitPbtSaved || []).reverse()) {
    const el = document.querySelector('[data-vlmkit-pbt="' + s.node + '"]');
    if (!el) continue;
    if (s.value) el.style.setProperty(s.property, s.value, s.priority);
    else el.style.removeProperty(s.property);
  }
  window.__vlmkitPbtSaved = [];
})()`;

const CLEAR_TAGS = `(() => { for (const el of Array.from(document.querySelectorAll("[data-vlmkit-pbt]"))) el.removeAttribute("data-vlmkit-pbt"); })()`;

// ---------------------------------------------------------------------------
// The runner

interface Harness {
  page: Page;
  /** Null off Chromium: the cause search and the breakpoint move are then not run. */
  css: CssInspector | null;
  current: ResponsiveCase | null;
  baseFontSize: string;
  baseInlineFontSize: { value: string; priority: string };
  properties: readonly ResponsiveProperty[];
}

async function applyCase(h: Harness, c: ResponsiveCase): Promise<void> {
  const prev = h.current;
  if (!prev || prev.width !== c.width || prev.height !== c.height) {
    await h.page.setViewportSize({ width: c.width, height: c.height });
  }
  if (!prev || prev.colorScheme !== c.colorScheme || prev.reducedMotion !== c.reducedMotion) {
    await h.page.emulateMedia({ colorScheme: c.colorScheme, reducedMotion: c.reducedMotion });
  }
  if (!prev || prev.textScale !== c.textScale) {
    await h.page.evaluate(({ scale, base, inline }) => {
      const root = document.documentElement;
      if (scale === 1) {
        if (inline.value) root.style.setProperty("font-size", inline.value, inline.priority);
        else root.style.removeProperty("font-size");
      } else {
        root.style.setProperty("font-size", `${parseFloat(base) * scale}px`, "important");
      }
    }, { scale: c.textScale, base: h.baseFontSize, inline: h.baseInlineFontSize });
  }
  h.current = c;
  await h.page.evaluate(SETTLE);
}

async function measureAll(h: Harness, c: ResponsiveCase): Promise<ResponsiveFinding[]> {
  await applyCase(h, c);
  const findings: ResponsiveFinding[] = [];
  for (const property of h.properties) findings.push(...await property.measure(h.page, c));
  // As in `check integrity`: a box whose text the clip probe already ruled on is not also clipped content.
  const clippedText = new Set(findings.filter((f) => f.kind === "text-clipped").map((f) => f.selector));
  return findings.filter((f) => !(f.kind === "clipped-content" && f.selector && clippedText.has(f.selector)));
}

async function measureKey(h: Harness, c: ResponsiveCase, key: string, kind: string): Promise<ResponsiveFinding | null> {
  await applyCase(h, c);
  const property = h.properties.find((p) => p.kinds.includes(kind));
  if (!property) return null;
  const findings = await property.measure(h.page, c);
  return findings.find((f) => failureKey(f) === key) ?? null;
}

const matchSignature = async (page: Page, conditions: readonly string[], width: number, height: number): Promise<string[]> => {
  await page.setViewportSize({ width, height });
  return await page.evaluate(
    (conds) => new Promise<string[]>((r) => requestAnimationFrame(() => r(conds.filter((c) => {
      try { return matchMedia(c).matches; } catch { return false; }
    })))),
    [...conditions],
  );
};

async function partition(
  page: Page,
  conditions: readonly string[],
  space: ResponsiveSpace,
): Promise<{ transitions: MediaTransition[]; regimes: WidthRegime[] }> {
  if (conditions.length === 0) {
    return { transitions: [], regimes: [{ from: space.minWidth, to: space.maxWidth, matches: [] }] };
  }
  const samples = new Map<number, MediaSample>();
  const sample = async (w: number) => {
    if (samples.has(w) || w < space.minWidth || w > space.maxWidth) return;
    samples.set(w, { width: w, matches: await matchSignature(page, conditions, w, space.defaultHeight) });
  };
  const seeds = new Set<number>([space.minWidth, space.maxWidth, ...widthCandidates(conditions)]);
  // A coarse grid catches conditions whose numbers do not parse (calc(), env(), orientation at the default height).
  for (let w = space.minWidth; w <= space.maxWidth; w += 80) seeds.add(w);
  for (const w of [...seeds].sort((a, b) => a - b)) await sample(w);
  for (let round = 0; round < 6; round++) {
    const { unresolved } = regimesFromSamples([...samples.values()], space.minWidth, space.maxWidth);
    if (unresolved.length === 0) break;
    for (const [lo, hi] of unresolved) {
      const loSig = samples.get(lo)!.matches;
      const at = await bisectChange(lo, hi, async (x) => {
        await sample(x);
        const sig = samples.get(x)!.matches;
        return sig.length === loSig.length && sig.every((m) => loSig.includes(m));
      });
      await sample(at - 1);
      await sample(at);
    }
  }
  const { transitions, regimes } = regimesFromSamples([...samples.values()], space.minWidth, space.maxWidth);
  return { transitions, regimes };
}

async function explainCause(
  h: Harness,
  c: ResponsiveCase,
  key: string,
  kind: string,
  targets: readonly string[],
  interval: { lo: number; hi: number },
  anchor: FailureAnchor | undefined,
): Promise<{ cause?: ResponsiveCause; note?: string }> {
  if (targets.length === 0) return { note: "no element to attribute it to (nothing past the edge relieves it alone)" };
  if (!h.css) return { note: "not searched — reading the page's cascade needs Chromium's DevTools protocol" };
  await applyCase(h, c);
  const tagged = await h.page.evaluate(`${TAG_CAUSE_NODES}(${JSON.stringify(targets)})`) as TaggedNode[];
  try {
    const collected = await h.css.causeCandidates(tagged);
    if (collected.length === 0) {
      return { note: "no inline-size declaration on the element, its relatives or its flex/grid siblings to test" };
    }
    const candidates = rankCauseCandidates(collected, anchor);
    let attempts = 0;
    const clears = async (subset: (CauseDeclaration & { node: number })[], at: ResponsiveCase = c): Promise<boolean> => {
      attempts++;
      await applyCase(h, at);
      await h.page.evaluate(`${APPLY_OVERRIDES}(${JSON.stringify(subset)})`);
      await h.page.evaluate(SETTLE);
      const property = h.properties.find((p) => p.kinds.includes(kind))!;
      const still = (await property.measure(h.page, at)).some((f) => failureKey(f) === key);
      await h.page.evaluate(RESTORE_OVERRIDES);
      await h.page.evaluate(SETTLE);
      return !still;
    };
    // Single declarations first, in rank order: a one-declaration answer is 1-minimal by
    // construction, and the ranking makes the first one found the one to change. Up to
    // three are kept, because "this, or that" is how a squeeze is usually fixed.
    const singles: (CauseDeclaration & { node: number })[] = [];
    for (const candidate of candidates.slice(0, 16)) {
      if (await clears([candidate])) singles.push(candidate);
      if (singles.length >= 3) break;
    }
    let chosen: (CauseDeclaration & { node: number })[];
    let complete = true;
    if (singles.length > 0) {
      chosen = [singles[0]!];
    } else {
      const result = await minimizeSubset(candidates, (s) => clears(s), 32);
      if (!result) {
        return {
          note: `overriding all ${candidates.length} candidate declaration(s) on the element, its relatives and flex/grid siblings does not clear it — the size comes from content (a long word, an image, a table's min-content) or from script`,
        };
      }
      chosen = result.subset;
      complete = result.complete;
    }
    const holdsAt: number[] = [];
    const failsAt: number[] = [];
    const checkWidths = [...new Set([interval.lo, Math.round((interval.lo + interval.hi) / 2), interval.hi])]
      .filter((w) => w !== c.width);
    for (const w of checkWidths) {
      ((await clears(chosen, { ...c, width: w })) ? holdsAt : failsAt).push(w);
    }
    const strip = ({ node: _node, ...rest }: CauseDeclaration & { node: number }): CauseDeclaration => rest;
    return {
      cause: {
        declarations: chosen.map(strip),
        alternatives: singles.slice(1).map(strip),
        candidates: candidates.length,
        attempts,
        complete,
        holdsAt: [c.width, ...holdsAt].sort((a, b) => a - b),
        failsAt,
      },
    };
  } finally {
    await h.page.evaluate(CLEAR_TAGS);
  }
}

/**
 * Try the anchor's suggestion instead of only printing it: rewrite the conditions in the
 * stylesheet (`CSS.setMediaText`), re-check the failure across the interval, and re-check every property there, so
 * a move that trades this failure for another one is reported as such.
 */
async function checkBreakpointMove(
  h: Harness,
  c: ResponsiveCase,
  moves: { from: string; to: string }[],
  key: string,
  interval: { lo: number; hi: number },
): Promise<BreakpointMoveCheck> {
  const widths = [...new Set([interval.lo, Math.round((interval.lo + interval.hi) / 2), interval.hi])];
  const before = new Map<number, Set<string>>();
  for (const w of widths) before.set(w, new Set((await measureAll(h, { ...c, width: w })).map(failureKey)));
  const rewritten = h.css ? await h.css.moveConditions(moves) : 0;
  const stillFailsAt: number[] = [];
  const introduces = new Set<string>();
  try {
    if (rewritten > 0) {
      for (const w of widths) {
        // Force a re-apply: the viewport has not changed, the stylesheet has.
        h.current = null;
        const after = (await measureAll(h, { ...c, width: w })).map(failureKey);
        if (after.includes(key)) stillFailsAt.push(w);
        for (const k of after) if (k !== key && !before.get(w)!.has(k)) introduces.add(k);
      }
    }
  } finally {
    await h.css?.restoreConditions();
    h.current = null;
    await applyCase(h, c);
  }
  return {
    moves,
    rewritten,
    verified: rewritten > 0 && stillFailsAt.length === 0 && introduces.size === 0,
    checkedAt: widths,
    stillFailsAt,
    introduces: [...introduces],
  };
}

const reproduceLine = (source: string, c: ResponsiveCase, space: ResponsiveSpace): string => {
  const parts = [`vlmkit check responsive ${source}`, `--width ${c.width}`, `--height ${c.height}`];
  if (c.textScale !== 1) parts.push(`--text-scale ${c.textScale}`);
  if (c.colorScheme !== (space.colorSchemes[0] ?? "light")) parts.push(`--color-scheme ${c.colorScheme}`);
  if (c.reducedMotion === "reduce") parts.push("--reduced-motion");
  return parts.join(" ");
};

/** Build the ladder `1, 1.25, …, max`. */
export function textScaleLadder(max: number | undefined): number[] {
  if (max === undefined || max <= 1) return [1];
  const out = [1];
  for (let s = 1.25; s < max - 1e-9; s += 0.25) out.push(Number(s.toFixed(2)));
  out.push(Number(max.toFixed(2)));
  return out;
}

/**
 * The PBT loop on a page that is already loaded. Exposed for library use: a Playwright
 * test can navigate and log in its own way, then hand the page over.
 */
export async function runResponsiveOnPage(page: Page, options: Omit<ResponsiveOptions, keyof PageLoadOptions | "storageState">): Promise<Omit<ResponsiveReport, "issues"> & { issues: ResponsiveIssue[] }> {
  const properties = options.properties ?? BUILTIN_PROPERTIES;
  const seed = options.seed ?? 1;
  const runs = Math.max(1, options.runs ?? 60);
  const t0 = Date.now();

  const css = await CssInspector.open(page);
  const collected = await page.evaluate(COLLECT_MEDIA_CONDITIONS) as { conditions: string[]; crossOrigin: string[]; container: number };
  const conditions = new Set(collected.conditions);
  // The protocol reads every sheet, cross-origin ones included; the fetch below is the
  // fallback for a browser without it.
  if (css) for (const c of await css.mediaConditions()) conditions.add(c);
  let fetched = css ? collected.crossOrigin.length : 0;
  for (const href of css ? [] : collected.crossOrigin.slice(0, 20)) {
    try {
      const css = href.startsWith("file:")
        ? await readFile(fileURLToPath(href), "utf-8")
        : await (async () => {
          const res = await fetch(href);
          if (!res.ok) throw new Error(String(res.status));
          return await res.text();
        })();
      for (const m of css.matchAll(/@media\s+([^{]+)\{/g)) {
        const text = m[1]!.trim();
        if (text && text !== "all" && text !== "screen") conditions.add(text);
      }
      fetched++;
    } catch {
      // Unreachable: counted in report.stylesheets.
    }
  }
  const conditionList = [...conditions];
  const reactsTo = (feature: string) => conditionList.some((c) => c.includes(feature));

  const widthNumbers = widthCandidates(conditionList);
  const heightNumbers = heightCandidates(conditionList);
  const maxWidth = options.maxWidth ?? Math.max(1440, (widthNumbers[widthNumbers.length - 1] ?? 0) + 160);
  const space: ResponsiveSpace = {
    minWidth: options.minWidth ?? 320,
    maxWidth,
    minHeight: options.minHeight ?? Math.min(480, ...heightNumbers.map((h) => h - 40).filter((h) => h > 200)),
    maxHeight: options.maxHeight ?? Math.max(1000, ...heightNumbers.map((h) => h + 40)),
    defaultHeight: options.height ?? 900,
    textScales: textScaleLadder(options.textScale),
    colorSchemes: reactsTo("prefers-color-scheme") ? ["light", "dark"] : ["light"],
    reducedMotions: reactsTo("prefers-reduced-motion") ? ["no-preference", "reduce"] : ["no-preference"],
  };
  if (space.minWidth > space.maxWidth) throw new RangeError(`--min-width ${space.minWidth} is above --max-width ${space.maxWidth}`);

  const baseFontSize = await page.evaluate(() => getComputedStyle(document.documentElement).fontSize);
  const baseInlineFontSize = await page.evaluate(() => ({
    value: document.documentElement.style.getPropertyValue("font-size"),
    priority: document.documentElement.style.getPropertyPriority("font-size"),
  }));
  const h: Harness = { page, css, current: null, baseFontSize, baseInlineFontSize, properties };

  const { transitions, regimes } = await partition(page, conditionList, space);
  const tPartition = Date.now();

  // Cases: the replayed one, or edges then seeded randoms.
  let cases: ResponsiveCase[];
  if (options.replay) {
    cases = [{ ...baseCase(space, options.replay.width), ...options.replay }];
  } else {
    const rng = createRng(seed);
    cases = edgeCases(space, transitions).slice(0, runs);
    for (let i = 0; cases.length < runs; i++) cases.push(generateCase(rng, space, regimes, i, heightNumbers));
  }

  const outcomes: CaseOutcome[] = [];
  for (let index = 0; index < cases.length; index++) {
    outcomes.push({ index, case: cases[index]!, findings: await measureAll(h, cases[index]!) });
  }
  const tCases = Date.now();

  const groups = groupFailures(outcomes);
  const maxShrinks = options.replay ? 0 : Math.max(0, options.maxShrinks ?? 8);
  const failures: ResponsiveFailure[] = [];
  for (const [gi, group] of groups.entries()) {
    const first = outcomes[group.cases[0]!]!;
    const failure: ResponsiveFailure = {
      kind: group.kind,
      severity: group.severity,
      selectors: group.selectors,
      message: group.representative.message,
      failingCases: group.cases.length,
      firstCase: first.case,
      reproduce: reproduceLine(options.source ?? "<page>", first.case, space),
    };
    if (gi < maxShrinks) {
      const key = group.keys[0]!;
      const kind = group.kind;
      let attempts = 0;
      const stillFails = async (c: ResponsiveCase) => {
        attempts++;
        return (await measureKey(h, c, key, kind)) !== null;
      };
      const dims = await shrinkRecord(first.case, caseShrinkers(space), stillFails, 24);
      const interval = await failingInterval(
        dims.value.width,
        space.minWidth,
        space.maxWidth,
        (w) => stillFails({ ...dims.value, width: w }),
        40,
      );
      const rawAnchor = anchorInterval(interval.lo, interval.hi, transitions, space.minWidth, space.maxWidth);
      const witnessWidth = rawAnchor.kind === "ends-at-breakpoint" && interval.lo !== space.minWidth ? interval.hi : interval.lo;
      const witness: ResponsiveCase = { ...dims.value, width: witnessWidth };
      const atWitness = await measureKey(h, witness, key, kind);
      const needs = (["height", "textScale", "colorScheme", "reducedMotion"] as const)
        .filter((d) => witness[d] !== baseCase(space, witness.width)[d]);
      const anchor = qualifyAnchor(rawAnchor, needs.map((d) => ({ dimension: d, value: witness[d] })));
      const moves = breakpointMoves(rawAnchor, interval.lo, interval.hi, space.minWidth);
      const move = moves.length > 0 ? await checkBreakpointMove(h, witness, moves, key, interval) : undefined;
      const alsoFailsAt = [...new Set(group.cases
        .map((i) => outcomes[i]!.case.width)
        .filter((w) => w < interval.lo || w > interval.hi))].sort((a, b) => a - b);
      failure.shrunk = {
        case: witness,
        steps: dims.steps,
        needs,
        interval: { lo: interval.lo, hi: interval.hi, atMin: interval.atMin, atMax: interval.atMax },
        anchor,
        ...(move ? { move } : {}),
        alsoFailsAt,
        attempts,
        exhausted: dims.exhausted || interval.exhausted,
      };
      failure.reproduce = reproduceLine(options.source ?? "<page>", witness, space);
      if (atWitness) failure.message = atWitness.message;
      if (!options.noCause) {
        const targets = atWitness?.targets ?? group.representative.targets;
        const explained = await explainCause(h, witness, key, kind, targets, interval, rawAnchor);
        if (explained.cause) failure.cause = explained.cause;
        if (explained.note) failure.causeNote = explained.note;
      }
    }
    failures.push(failure);
  }
  const tShrink = Date.now();

  const failingIndexes = new Set(outcomes.filter((o) => o.findings.length > 0).map((o) => o.index));
  const regimeStats = regimes.map((r) => {
    const inRegime = outcomes.filter((o) => o.case.width >= r.from && o.case.width <= r.to);
    return { ...r, cases: inRegime.length, failingCases: inRegime.filter((o) => failingIndexes.has(o.index)).length };
  });
  const unvaried = unvariedFeatures(conditionList);
  const report = {
    source: options.source ?? "<page>",
    seed,
    space,
    conditions: conditionList,
    transitions,
    regimes: regimeStats,
    unvaried,
    containerQueries: collected.container,
    ...(collected.crossOrigin.length > 0 ? { stylesheets: { crossOrigin: collected.crossOrigin.length, fetched } } : {}),
    properties: [...new Set(properties.flatMap((p) => p.kinds))],
    cases: outcomes.length,
    failingCases: failingIndexes.size,
    ...(options.replay ? { replay: cases[0]! } : {}),
    failures,
    issues: [] as ResponsiveIssue[],
    timing: { partitionMs: tPartition - t0, casesMs: tCases - tPartition, shrinkMs: tShrink - tCases },
  };
  report.issues = deriveResponsiveIssues(report);
  await css?.close();
  return report;
}

export async function runResponsiveCheck(options: ResponsiveOptions): Promise<ResponsiveReport> {
  return await withBrowser(async (browser) => {
    const page = await browser.newPage(withAuthState(
      { viewport: { width: options.replay?.width ?? 1280, height: options.height ?? 900 } },
      options.storageState,
    ));
    const url = sourceToUrl(options.source);
    await navigatePage(page, url, options);
    await settlePage(page, 100);
    const redirect = isUrlSource(options.source) ? describeRedirect(options.source, page.url()) : null;
    const report = await runResponsiveOnPage(page, options);
    await page.close();
    if (redirect) report.issues.unshift({ kind: "redirected", severity: "suspect", message: redirect });
    return report;
  });
}

// ---------------------------------------------------------------------------
// Issues and formatting

const range = (lo: number, hi: number) => (lo === hi ? `${lo}px` : `${lo}-${hi}px`);

const describeDeclaration = (d: CauseDeclaration): string => {
  const where = [
    d.rule === "style attribute" ? "style attribute" : `${d.rule} in ${d.sheet}`,
    ...d.media.map((m) => (m.startsWith("@container") ? m : `@media ${m}`)),
  ].join(", ");
  const who = d.role === "target" ? "" : ` (${d.role} ${d.element})`;
  return `\`${d.property}: ${d.value}\`${who} — ${where}`;
};

export function describeMove(move: BreakpointMoveCheck): string {
  const rewrite = move.moves.map((m) => `${m.from} → ${m.to}`).join(", ");
  if (move.rewritten === 0) return `${rewrite}: not tried — no stylesheet rule with that condition could be rewritten (inline media attribute, or not Chromium)`;
  if (move.verified) return `${rewrite}: verified — rewritten in the stylesheet, the failure clears at ${move.checkedAt.join(", ")}px and nothing else fails there`;
  const parts: string[] = [];
  if (move.stillFailsAt.length > 0) parts.push(`still fails at ${move.stillFailsAt.join(", ")}px`);
  if (move.introduces.length > 0) parts.push(`introduces ${move.introduces.slice(0, 3).join(", ")}${move.introduces.length > 3 ? " …" : ""}`);
  return `${rewrite}: tried and rejected — ${parts.join("; ")}`;
}

export function describeCause(cause: ResponsiveCause): string {
  // One rule applied to several instances (two rows' price columns) is one declaration to change.
  const byRule = new Map<string, { decl: CauseDeclaration; count: number }>();
  for (const d of cause.declarations) {
    const k = `${d.rule}|${d.sheet}|${d.property}|${d.value}|${d.media.join("&")}`;
    const entry = byRule.get(k);
    if (entry) entry.count++;
    else byRule.set(k, { decl: d, count: 1 });
  }
  const decls = [...byRule.values()].map(({ decl, count }) =>
    count === 1 ? describeDeclaration(decl) : `${describeDeclaration({ ...decl, role: "target" })} (on ${count} elements)`);
  const holds = cause.failsAt.length === 0
    ? `clears it at ${cause.holdsAt.join(", ")}px`
    : `clears it at ${cause.holdsAt.join(", ")}px but not at ${cause.failsAt.join(", ")}px`;
  const alternatives = cause.alternatives.length > 0
    ? `; also clears it alone: ${cause.alternatives.map(describeDeclaration).join("; ")}`
    : "";
  return `${decls.join(" + ")}; overriding ${cause.declarations.length === 1 ? "it" : "them"} to ${cause.declarations.map((d) => `\`${d.override}\``).join(" / ")} ${holds}${cause.complete ? "" : " (search budget ran out: may not be minimal)"}${alternatives}`;
}

export function deriveResponsiveIssues(report: Omit<ResponsiveReport, "issues">): ResponsiveIssue[] {
  const issues: ResponsiveIssue[] = [];
  for (const [index, f] of report.failures.entries()) {
    const where = f.shrunk
      ? `fails at ${range(f.shrunk.interval.lo, f.shrunk.interval.hi)}${f.shrunk.needs.length > 0 ? ` (needs ${f.shrunk.needs.join(", ")})` : ""} — ${f.shrunk.anchor.diagnosis}`
      : `failed in ${f.failingCases} case(s), first at ${describeCase(f.firstCase, report.space)}`;
    const more = f.selectors.length > 1 ? ` (+${f.selectors.length - 1} more failing in the same cases)` : "";
    const cause = f.cause ? `; cause: ${describeCause(f.cause)}` : f.causeNote ? `; cause: ${f.causeNote}` : "";
    const suggestion = f.shrunk?.move
      ? `; breakpoint move ${describeMove(f.shrunk.move)}`
      : f.shrunk?.anchor.suggestion ? `; ${f.shrunk.anchor.suggestion}` : "";
    issues.push({
      kind: f.kind as ResponsiveIssueKind,
      severity: f.severity === "fail" ? "suspect" : "warn",
      ...(f.selectors[0] && f.selectors[0] !== "(page)" ? { selector: f.selectors[0] } : {}),
      viewport: f.shrunk?.case.width ?? f.firstCase.width,
      failure: index,
      message: `${where}${more}. ${f.message}${cause}${suggestion}. Reproduce: ${f.reproduce}`,
    });
  }
  for (const u of report.unvaried) {
    issues.push({
      kind: "untested-media-feature",
      severity: "info",
      message: `(${u.feature}) is not varied — ${u.conditions.length} condition(s) using it were measured only as headless Chromium reports it: ${u.conditions.slice(0, 3).join("; ")}${u.conditions.length > 3 ? " …" : ""}`,
    });
  }
  return issues;
}

export function formatResponsiveReport(report: ResponsiveReport, rules?: RuleView): string {
  const lines: string[] = [];
  const { shown, status, note } = tierIssues(report.issues, rules);
  const s = report.space;
  lines.push(`${BOLD}${CYAN}vlmkit check responsive${RESET}`);
  lines.push(`${DIM}source: ${report.source}${RESET}`);
  lines.push("");
  lines.push(`status: ${status}`);
  for (const entry of shown.filter((e) => e.row.kind === "redirected")) {
    lines.push(`${RED}x ${entry.row.message}${retuneNote(entry)}${RESET}`);
  }
  if (report.replay) {
    lines.push(`replay: ${describeCase(report.replay, s)} — one case, not shrunk`);
  } else {
    lines.push(`seed ${report.seed} · ${report.cases} cases · widths ${s.minWidth}-${s.maxWidth} · heights ${s.minHeight}-${s.maxHeight}`
      + (s.textScales.length > 1 ? ` · text ${s.textScales.join("/")}x` : "")
      + (s.colorSchemes.length > 1 ? " · light/dark" : "")
      + (s.reducedMotions.length > 1 ? " · reduced motion" : ""));
  }
  lines.push(`media: ${report.conditions.length} condition(s) → ${report.regimes.length} width regime(s)`
    + (report.transitions.length > 0 ? ` (transitions at ${report.transitions.map((t) => t.width).join(", ")}px)` : "")
    + (report.containerQueries > 0 ? ` · ${report.containerQueries} @container rule(s) followed indirectly` : ""));
  if (report.stylesheets && report.stylesheets.fetched < report.stylesheets.crossOrigin) {
    lines.push(`${YELLOW}note: ${report.stylesheets.crossOrigin - report.stylesheets.fetched} cross-origin stylesheet(s) unreadable — their media queries are not partitioned on${RESET}`);
  }
  for (const r of report.regimes) {
    const verdict = r.failingCases === 0 ? `${GREEN}clean${RESET}` : `${YELLOW}${r.failingCases}/${r.cases} case(s) failing${RESET}`;
    lines.push(`  ${range(r.from, r.to).padEnd(12)} ${String(r.cases).padStart(3)} case(s) ${verdict}${r.matches.length > 0 ? ` ${DIM}${r.matches.slice(0, 2).join(" · ")}${r.matches.length > 2 ? " …" : ""}${RESET}` : ""}`);
  }
  lines.push(`properties: ${report.properties.join(", ")}`);

  // Through `shown`, so `--rule text-starved=off` hides the block as well as the exit code's reason.
  const visibleFailures = shown
    .filter((e) => e.row.failure !== undefined)
    .map((e) => ({ ...report.failures[e.row.failure!]!, tier: e.tier, retune: retuneNote(e) }));
  if (visibleFailures.length === 0) {
    lines.push("");
    lines.push(report.failures.length === 0
      ? `${GREEN}No property failed in ${report.cases} case(s).${RESET}`
      : `${GREEN}Every failure is on a rule turned off.${RESET}`);
  }
  for (const f of visibleFailures.slice(0, 20)) {
    const icon = f.tier === "suspect" ? `${RED}x${RESET}` : f.tier === "warn" ? `${YELLOW}!${RESET}` : `${DIM}i${RESET}`;
    lines.push("");
    lines.push(`${icon} ${BOLD}${f.kind}${RESET}${f.retune} ${f.selectors[0]}${f.selectors.length > 1 ? ` ${DIM}+${f.selectors.length - 1}: ${f.selectors.slice(1, 4).join(", ")}${f.selectors.length > 4 ? " …" : ""}${RESET}` : ""}`);
    if (f.shrunk) {
      const sh = f.shrunk;
      const edges = `${sh.interval.atMin ? "≤" : ""}${range(sh.interval.lo, sh.interval.hi)}${sh.interval.atMax ? "+" : ""}`;
      lines.push(`    fails at ${edges}${sh.needs.length > 0 ? ` and needs ${sh.needs.map((d) => `${d}=${String(sh.case[d])}`).join(", ")}` : ""} ${DIM}(${f.failingCases} generated case(s); shrunk from ${describeCase(f.firstCase, s)} in ${sh.attempts} checks${sh.exhausted ? ", budget ran out" : ""})${RESET}`);
      if (sh.alsoFailsAt.length > 0) lines.push(`    also failed at ${sh.alsoFailsAt.slice(0, 8).join(", ")}px — outside that interval, a second range`);
      lines.push(`    ${sh.anchor.diagnosis}`);
      if (sh.move) {
        const colour = sh.move.verified ? GREEN : YELLOW;
        lines.push(`    ${colour}→ move the breakpoint: ${describeMove(sh.move)}${RESET}`);
      } else if (sh.anchor.suggestion) {
        lines.push(`    ${GREEN}→ ${sh.anchor.suggestion}${RESET}`);
      }
    } else {
      lines.push(`    failed in ${f.failingCases} case(s), first at ${describeCase(f.firstCase, s)} ${DIM}(not shrunk: over --max-shrinks)${RESET}`);
    }
    lines.push(`    ${f.message}`);
    if (f.cause) lines.push(`    cause: ${describeCause(f.cause)}`);
    else if (f.causeNote) lines.push(`    ${DIM}cause: ${f.causeNote}${RESET}`);
    lines.push(`    ${DIM}reproduce: ${f.reproduce}${RESET}`);
  }
  if (visibleFailures.length > 20) lines.push(`\n… ${visibleFailures.length - 20} more (use --json for all)`);
  const infos = shown.filter((e) => e.row.kind === "untested-media-feature");
  if (infos.length > 0) {
    lines.push("");
    for (const entry of infos) lines.push(`${DIM}i ${entry.row.message}${RESET}`);
  }
  lines.push("");
  lines.push(`${DIM}timing: partition ${report.timing.partitionMs}ms · cases ${report.timing.casesMs}ms · shrink ${report.timing.shrinkMs}ms${RESET}`);
  if (note) lines.push(`${DIM}${note}${RESET}`);
  return lines.join("\n");
}
