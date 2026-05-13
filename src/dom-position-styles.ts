/**
 * DOM-position-based selector alignment for migration diffs.
 *
 * Addresses the killer finding from `docs/reports/2026-05-12-subagent-eval.md`:
 * the migration-VRT scenario is class renames (`.card` → `.luna-panel`),
 * but `diffComputedStyles` matches selectors by literal string and so
 * produces zero verified entries for the entire rename. The subagent
 * eval showed this blind spot lets a fresh agent plateau at 10–24%
 * diff because it has to guess values from PNGs.
 *
 * This module captures `{ path, tag, classes, styles }` per
 * "interesting" element on each page, then matches across baseline and
 * variant by the position `path` (e.g. `main[0]>section[1]>article[0]>div[0]`),
 * which is invariant under class renames. Diff output names both
 * class strings + the property delta so the agent can rewrite the
 * variant's CSS class against the baseline's rendered values.
 *
 * Pure module. The browser-side capture script ships as a string fed
 * to `page.evaluate()`.
 */

import { TRACKED_PROPERTIES } from "./computed-style-capture.ts";

export interface PositionedElement {
  /** DOM path: `tag[childIndex]>tag[childIndex]>...` rooted at body. */
  path: string;
  /** Tag name (lower-case). */
  tag: string;
  /** Class string verbatim (or "" when absent). */
  classes: string;
  /** Tracked computed-style values. */
  styles: Record<string, string>;
  /**
   * Parent element's computed `display`. Used to annotate `display`-property
   * diffs where the value looks different but is actually flex/grid-item
   * coercion (CSS blockifies inline children of flex/grid containers).
   */
  parentDisplay?: string;
}

export interface DpEntry {
  path: string;
  tag: string;
  baselineClasses: string;
  variantClasses: string;
  property: string;
  baseline: string;
  variant: string;
  /**
   * For em-relative properties (`letter-spacing`, `line-height` etc.),
   * the value divided by the element's own font-size — exposes when a
   * single `em` rule produces several different px values across
   * elements with different font sizes.
   */
  baselineEm?: number;
  variantEm?: number;
  /**
   * Set on `display`-property rows when the parent on either side is a
   * flex/grid container. Helps the agent realize the difference may be
   * flex-item coercion (`inline-flex` → `flex`) rather than a real
   * source-CSS mismatch.
   */
  parentDisplayContext?: {
    baselineParent: string;
    variantParent: string;
    /** True when at least one parent is flex/grid/inline-flex/inline-grid. */
    isFlexOrGridItem: boolean;
  };
}

/** Properties for which em-normalization is informative. */
const EM_RELATIVE = new Set([
  "letter-spacing",
  "word-spacing",
  "line-height",
]);

/** Parent `display` values that coerce inline children to block-ish layouts. */
const FLEX_OR_GRID_DISPLAYS = new Set([
  "flex",
  "inline-flex",
  "grid",
  "inline-grid",
]);

function emEquivalent(value: string, fontSizePx: number): number | undefined {
  if (!value || value === "normal" || value === "auto" || fontSizePx <= 0) return undefined;
  // Already em? Trust the source.
  const emMatch = value.match(/^(-?\d+(?:\.\d+)?)em$/);
  if (emMatch) return Number(emMatch[1]);
  const pxMatch = value.match(/^(-?\d+(?:\.\d+)?)px$/);
  if (!pxMatch) return undefined;
  return Number(pxMatch[1]) / fontSizePx;
}

function parseFontSizePx(value: string | undefined): number {
  if (!value) return 0;
  const m = value.match(/^(\d+(?:\.\d+)?)px$/);
  return m ? Number(m[1]) : 0;
}

export interface DpResult {
  entries: DpEntry[];
  totalDiffs: number;
  /** path strings that appear only in one side (DOM structure drift). */
  pathsOnlyInBaseline: string[];
  pathsOnlyInVariant: string[];
  /** by-property + by-path aggregates, sorted desc. */
  byProperty: Array<{ property: string; count: number }>;
  byPath: Array<{ path: string; baselineClasses: string; variantClasses: string; count: number }>;
}

const EMPTY: DpResult = {
  entries: [],
  totalDiffs: 0,
  pathsOnlyInBaseline: [],
  pathsOnlyInVariant: [],
  byProperty: [],
  byPath: [],
};

export function diffDomPositionStyles(
  baseline: PositionedElement[],
  variant: PositionedElement[],
): DpResult {
  if (!baseline?.length || !variant?.length) return EMPTY;

  const baselineMap = new Map<string, PositionedElement>();
  const variantMap = new Map<string, PositionedElement>();
  for (const el of baseline) baselineMap.set(el.path, el);
  for (const el of variant) variantMap.set(el.path, el);

  const entries: DpEntry[] = [];
  const byProperty = new Map<string, number>();
  const byPath = new Map<string, { baselineClasses: string; variantClasses: string; count: number }>();

  const sharedPaths: string[] = [];
  for (const path of baselineMap.keys()) {
    if (variantMap.has(path)) sharedPaths.push(path);
  }

  for (const path of sharedPaths) {
    const b = baselineMap.get(path)!;
    const v = variantMap.get(path)!;
    if (b.tag !== v.tag) continue; // structural mismatch — skip

    const props = new Set<string>([...Object.keys(b.styles), ...Object.keys(v.styles)]);
    const bFontSize = parseFontSizePx(b.styles["font-size"]);
    const vFontSize = parseFontSizePx(v.styles["font-size"]);
    for (const property of props) {
      const bv = b.styles[property] ?? "";
      const vv = v.styles[property] ?? "";
      if (bv === vv) continue;
      const diffEntry: DpEntry = {
        path,
        tag: b.tag,
        baselineClasses: b.classes,
        variantClasses: v.classes,
        property,
        baseline: bv,
        variant: vv,
      };
      if (EM_RELATIVE.has(property)) {
        const baselineEm = emEquivalent(bv, bFontSize);
        const variantEm = emEquivalent(vv, vFontSize);
        if (baselineEm !== undefined) diffEntry.baselineEm = Math.round(baselineEm * 10000) / 10000;
        if (variantEm !== undefined) diffEntry.variantEm = Math.round(variantEm * 10000) / 10000;
      }
      if (property === "display") {
        const bp = b.parentDisplay ?? "";
        const vp = v.parentDisplay ?? "";
        if (bp || vp) {
          diffEntry.parentDisplayContext = {
            baselineParent: bp,
            variantParent: vp,
            isFlexOrGridItem: FLEX_OR_GRID_DISPLAYS.has(bp) || FLEX_OR_GRID_DISPLAYS.has(vp),
          };
        }
      }
      entries.push(diffEntry);
      byProperty.set(property, (byProperty.get(property) ?? 0) + 1);
      const entry = byPath.get(path) ?? { baselineClasses: b.classes, variantClasses: v.classes, count: 0 };
      entry.count += 1;
      byPath.set(path, entry);
    }
  }

  const pathsOnlyInBaseline = [...baselineMap.keys()].filter((p) => !variantMap.has(p));
  const pathsOnlyInVariant = [...variantMap.keys()].filter((p) => !baselineMap.has(p));

  const sortedByProperty = [...byProperty.entries()]
    .map(([property, count]) => ({ property, count }))
    .sort((a, b) => b.count - a.count || a.property.localeCompare(b.property));

  const sortedByPath = [...byPath.entries()]
    .map(([path, v]) => ({ path, baselineClasses: v.baselineClasses, variantClasses: v.variantClasses, count: v.count }))
    .sort((a, b) => b.count - a.count || a.path.localeCompare(b.path));

  return {
    entries,
    totalDiffs: entries.length,
    pathsOnlyInBaseline,
    pathsOnlyInVariant,
    byProperty: sortedByProperty,
    byPath: sortedByPath,
  };
}

/**
 * Browser-side capture script: walks the DOM from `<body>`, emits
 * `{path, tag, classes, styles}` for every element that has a class
 * attribute or is one of the semantic / interactive tags listed below.
 * `path` uses 0-based child indices among ALL children, so it's stable
 * across class renames as long as the tree shape is the same.
 */
export const DOM_POSITION_STYLES_BROWSER_SCRIPT = `JSON.stringify((function(){
  var TRACKED = ${JSON.stringify(TRACKED_PROPERTIES)};
  var SEMANTIC = new Set([
    "main","header","nav","footer","aside","article","section",
    "h1","h2","h3","h4","h5","h6","p","a","button","input","select","textarea",
    "label","blockquote","pre","code","table","thead","tbody","tr","th","td",
    "ul","ol","li","img","span"
  ]);
  var out = [];
  function walk(el, parentPath, indexAmongChildren) {
    var tag = el.tagName.toLowerCase();
    var path = parentPath === "" ? tag + "[0]" : parentPath + ">" + tag + "[" + indexAmongChildren + "]";
    var hasClass = el.hasAttribute && el.hasAttribute("class");
    var interesting = hasClass || SEMANTIC.has(tag);
    if (interesting) {
      var cs = getComputedStyle(el);
      var styles = {};
      for (var i = 0; i < TRACKED.length; i++) {
        var p = TRACKED[i];
        styles[p] = cs.getPropertyValue(p);
      }
      // Capture parent display so the diff layer can flag flex/grid-item coercion.
      var parentDisplay = "";
      if (el.parentElement) {
        try { parentDisplay = getComputedStyle(el.parentElement).getPropertyValue("display"); } catch (e) { parentDisplay = ""; }
      }
      out.push({
        path: path,
        tag: tag,
        classes: (el.getAttribute("class") || "").trim(),
        styles: styles,
        parentDisplay: parentDisplay
      });
    }
    var children = el.children;
    for (var j = 0; j < children.length; j++) {
      walk(children[j], path, j);
    }
  }
  if (document.body) walk(document.body, "", 0);
  return out;
})())`;

export function parseDomPositionStyles(value: unknown): PositionedElement[] {
  if (Array.isArray(value)) return value as PositionedElement[];
  if (typeof value !== "string") return [];
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed as PositionedElement[] : [];
  } catch {
    return [];
  }
}

// ----------------------------------------------------------------------
// Per-viewport variant
// ----------------------------------------------------------------------

export interface DpEntryWithViewport extends DpEntry {
  viewport: string;
}

export interface DpSample {
  viewport: string;
  baseline: string;
  variant: string;
  /** Em-normalized values when the property is em-relative. */
  baselineEm?: number;
  variantEm?: number;
}

export interface DpPerViewportResult {
  /** All per-viewport diff tuples (entries[i] carries its viewport). */
  entries: DpEntryWithViewport[];
  /** Total tuples across all viewports (before any caller-side cap). */
  totalDiffs: number;
  /**
   * Compact verification index: `${variantClassToken}::${property}` strings
   * for every real delta. Used by `diff-for-agent` to gate heuristic
   * fix-candidate ✓/✗ marks. Stored unconditionally (cheap; tens of KB
   * worst-case) so verification stays accurate even when `entries` and
   * `byPathProperty` are capped for report-size reasons.
   */
  verifiedPairs: string[];
  /**
   * (path, property) → viewport-list. Same property at same position can
   * differ on some viewports and not others (media-query-gated rules).
   * Sorted by number of viewports descending.
   */
  byPathProperty: Array<{
    path: string;
    property: string;
    baselineClasses: string;
    variantClasses: string;
    viewports: string[];
    samples: DpSample[];
    /** Set on `display`-property pairs when at least one parent is flex/grid. */
    parentDisplayContext?: {
      baselineParent: string;
      variantParent: string;
      isFlexOrGridItem: boolean;
    };
  }>;
  /** Per-viewport tally so the caller can see which viewport is worst. */
  byViewport: Array<{ viewport: string; count: number }>;
  /** Property → total viewport-occurrences, sorted desc. */
  byProperty: Array<{ property: string; count: number }>;
  /** Path → total viewport-occurrences + class names, sorted desc. */
  byPath: Array<{
    path: string;
    baselineClasses: string;
    variantClasses: string;
    count: number;
  }>;
}

const EMPTY_PV: DpPerViewportResult = {
  entries: [],
  totalDiffs: 0,
  verifiedPairs: [],
  byPathProperty: [],
  byViewport: [],
  byProperty: [],
  byPath: [],
};

/**
 * Diff DOM-position style captures across N viewports.
 *
 * Inputs are maps of viewport-label → captured element list. Each viewport
 * is diffed independently (same `diffDomPositionStyles` per-viewport
 * semantics), then results are merged with a viewport label per tuple and
 * a (path, property) cross-viewport aggregate so the agent can spot
 * "this delta appears at every viewport" vs "this delta only appears at
 * mobile" (the latter usually means a missing or wrong media query).
 */
export function diffPositionStylesAcrossViewports(
  baselineByVp: Map<string, PositionedElement[]> | Record<string, PositionedElement[]>,
  variantByVp: Map<string, PositionedElement[]> | Record<string, PositionedElement[]>,
): DpPerViewportResult {
  const baselineMap = baselineByVp instanceof Map ? baselineByVp : new Map(Object.entries(baselineByVp));
  const variantMap = variantByVp instanceof Map ? variantByVp : new Map(Object.entries(variantByVp));
  if (baselineMap.size === 0 || variantMap.size === 0) return EMPTY_PV;

  const entries: DpEntryWithViewport[] = [];
  const byViewport = new Map<string, number>();

  for (const [viewport, baselineList] of baselineMap) {
    const variantList = variantMap.get(viewport);
    if (!variantList) continue;
    const perVp = diffDomPositionStyles(baselineList, variantList);
    for (const e of perVp.entries) entries.push({ ...e, viewport });
    byViewport.set(viewport, (byViewport.get(viewport) ?? 0) + perVp.entries.length);
  }

  // Aggregate per (path, property) — same delta on multiple viewports is
  // typically one source rule; differing-viewport deltas are media-query
  // gated.
  const ppKey = (path: string, property: string) => `${path} ${property}`;
  const aggregated = new Map<string, {
    path: string;
    property: string;
    baselineClasses: string;
    variantClasses: string;
    viewports: string[];
    samples: DpSample[];
    parentDisplayContext?: { baselineParent: string; variantParent: string; isFlexOrGridItem: boolean };
  }>();
  for (const e of entries) {
    const k = ppKey(e.path, e.property);
    const sample: DpSample = {
      viewport: e.viewport,
      baseline: e.baseline,
      variant: e.variant,
    };
    if (e.baselineEm !== undefined) sample.baselineEm = e.baselineEm;
    if (e.variantEm !== undefined) sample.variantEm = e.variantEm;
    const existing = aggregated.get(k);
    if (existing) {
      existing.viewports.push(e.viewport);
      // De-dupe samples by (baseline, variant) — most deltas are identical
      // across affected viewports (e.g. `height: 48px → 33px` everywhere it
      // applies). Keep at most one sample per unique value-pair so the
      // report stays compact when shipped as JSON.
      const alreadySeen = existing.samples.some(
        (s) => s.baseline === e.baseline && s.variant === e.variant,
      );
      if (!alreadySeen) {
        existing.samples.push(sample);
      }
    } else {
      aggregated.set(k, {
        path: e.path,
        property: e.property,
        baselineClasses: e.baselineClasses,
        variantClasses: e.variantClasses,
        viewports: [e.viewport],
        samples: [sample],
        parentDisplayContext: e.parentDisplayContext,
      });
    }
  }
  const byPathProperty = [...aggregated.values()].sort((a, b) =>
    b.viewports.length - a.viewports.length
    || a.path.localeCompare(b.path)
    || a.property.localeCompare(b.property),
  );

  const byProperty = new Map<string, number>();
  for (const e of entries) byProperty.set(e.property, (byProperty.get(e.property) ?? 0) + 1);
  const byPath = new Map<string, { baselineClasses: string; variantClasses: string; count: number }>();
  for (const e of entries) {
    const cur = byPath.get(e.path) ?? { baselineClasses: e.baselineClasses, variantClasses: e.variantClasses, count: 0 };
    cur.count += 1;
    byPath.set(e.path, cur);
  }

  // Compact verification set: `${variantClassToken}::${property}` plus a
  // bare `::property` fallback used by tag-only candidates. Unbounded
  // because each entry is short and downstream consumers gate on it for
  // ✓/✗ accuracy even when entries/byPathProperty are capped.
  const verifiedPairsSet = new Set<string>();
  for (const e of entries) {
    const tokens = e.variantClasses.split(/\s+/).filter(Boolean);
    for (const cls of tokens) verifiedPairsSet.add(`.${cls}::${e.property}`);
    verifiedPairsSet.add(`::${e.property}`);
  }
  const verifiedPairs = [...verifiedPairsSet].sort();

  return {
    entries,
    totalDiffs: entries.length,
    verifiedPairs,
    byPathProperty,
    byViewport: [...byViewport.entries()].map(([viewport, count]) => ({ viewport, count }))
      .sort((a, b) => b.count - a.count || a.viewport.localeCompare(b.viewport)),
    byProperty: [...byProperty.entries()].map(([property, count]) => ({ property, count }))
      .sort((a, b) => b.count - a.count || a.property.localeCompare(b.property)),
    byPath: [...byPath.entries()].map(([path, v]) => ({ path, baselineClasses: v.baselineClasses, variantClasses: v.variantClasses, count: v.count }))
      .sort((a, b) => b.count - a.count || a.path.localeCompare(b.path)),
  };
}
