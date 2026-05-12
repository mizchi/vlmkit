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
}

export interface DpEntry {
  path: string;
  tag: string;
  baselineClasses: string;
  variantClasses: string;
  property: string;
  baseline: string;
  variant: string;
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
    for (const property of props) {
      const bv = b.styles[property] ?? "";
      const vv = v.styles[property] ?? "";
      if (bv === vv) continue;
      entries.push({
        path,
        tag: b.tag,
        baselineClasses: b.classes,
        variantClasses: v.classes,
        property,
        baseline: bv,
        variant: vv,
      });
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
      out.push({
        path: path,
        tag: tag,
        classes: (el.getAttribute("class") || "").trim(),
        styles: styles
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
