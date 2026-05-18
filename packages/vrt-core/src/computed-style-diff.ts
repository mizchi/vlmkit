/**
 * Computed-style diff between two captured snapshots.
 *
 * Closes the dogfood gap from `docs/reports/2026-05-12-dogfood-shadcn-luna.md`
 * point 4: "Pixel-matching can't catch semantically-different CSS that
 * produces identical layout (margin-sibling vs flex gap)." Layered on top
 * of the existing `computed-style-capture` snapshot infrastructure.
 *
 * The diff lists (selector, property, before, after) tuples, plus a
 * by-property tally so the agent can see "12 selectors changed
 * `gap`, 8 changed `padding`" at a glance.
 */

export type { ComputedStyleSnapshot } from "./computed-style-capture.ts";
import type { ComputedStyleSnapshot } from "./computed-style-capture.ts";

export interface CsdEntry {
  selector: string;
  property: string;
  baseline: string;
  variant: string;
}

export interface CsdResult {
  /** Per-(selector, property) differences. */
  entries: CsdEntry[];
  /** Total differing (selector, property) pairs. */
  totalDiffs: number;
  /** Sorted property → count map (descending). */
  byProperty: Array<{ property: string; count: number }>;
  /** Sorted selector → count map (descending). */
  bySelector: Array<{ selector: string; count: number }>;
  /** Selectors present only in one side. */
  selectorsOnlyInBaseline: string[];
  selectorsOnlyInVariant: string[];
}

export interface CsdPerViewportSample {
  viewport: string;
  baseline: string;
  variant: string;
}

export interface CsdPerViewportEntry {
  selector: string;
  property: string;
  /** Viewports on which this (selector, property) pair differs. */
  viewports: string[];
  samples: CsdPerViewportSample[];
}

export interface CsdPerViewportResult {
  /** Total (selector, property, viewport) tuples — i.e. Σ per-viewport counts. */
  totalDiffs: number;
  byViewport: Array<{ viewport: string; count: number }>;
  /**
   * One row per unique (selector, property) pair, listing which viewports
   * it differs on and the actual baseline/variant samples per viewport.
   */
  bySelectorProperty: CsdPerViewportEntry[];
  /**
   * "selector|property" tokens for pairs that differ on every viewport.
   * A consumer rendering "fix the base rule" tables wants this subset.
   */
  universalPairs: string[];
  /**
   * "selector|property" tokens for pairs that differ on a strict subset
   * of viewports. Almost always a `@media` rule is missing or wrong.
   */
  breakpointGatedPairs: string[];
}

/**
 * Roll up N per-viewport CSD results into a single per-viewport report,
 * surfacing which pairs apply universally vs. which are breakpoint-gated.
 *
 * Stable iteration order: results are taken in the input array's order,
 * which is the same order migration-compare captures viewports (small →
 * large or whatever the caller chose).
 */
export function aggregateCsdByViewport(
  perViewport: ReadonlyArray<{ viewport: string; result: CsdResult }>,
): CsdPerViewportResult {
  const totalViewports = perViewport.length;
  const pairToEntry = new Map<string, CsdPerViewportEntry>();
  const byViewport: Array<{ viewport: string; count: number }> = [];

  for (const { viewport, result } of perViewport) {
    byViewport.push({ viewport, count: result.entries.length });
    for (const entry of result.entries) {
      const key = `${entry.selector}|${entry.property}`;
      const existing = pairToEntry.get(key);
      if (existing) {
        existing.viewports.push(viewport);
        existing.samples.push({ viewport, baseline: entry.baseline, variant: entry.variant });
      } else {
        pairToEntry.set(key, {
          selector: entry.selector,
          property: entry.property,
          viewports: [viewport],
          samples: [{ viewport, baseline: entry.baseline, variant: entry.variant }],
        });
      }
    }
  }

  const bySelectorProperty = [...pairToEntry.values()].sort((a, b) => {
    if (b.viewports.length !== a.viewports.length) return b.viewports.length - a.viewports.length;
    if (a.selector !== b.selector) return a.selector.localeCompare(b.selector);
    return a.property.localeCompare(b.property);
  });

  const universalPairs: string[] = [];
  const breakpointGatedPairs: string[] = [];
  for (const entry of bySelectorProperty) {
    const token = `${entry.selector}|${entry.property}`;
    if (totalViewports > 0 && entry.viewports.length === totalViewports) {
      universalPairs.push(token);
    } else {
      breakpointGatedPairs.push(token);
    }
  }

  return {
    totalDiffs: byViewport.reduce((sum, e) => sum + e.count, 0),
    byViewport,
    bySelectorProperty,
    universalPairs,
    breakpointGatedPairs,
  };
}

const EMPTY: CsdResult = {
  entries: [],
  totalDiffs: 0,
  byProperty: [],
  bySelector: [],
  selectorsOnlyInBaseline: [],
  selectorsOnlyInVariant: [],
};

/**
 * Diff two computed-style snapshots. Both inputs are
 * `Record<selector, Record<property, value>>`; produced by
 * `captureComputedStyleSnapshotInDom`.
 */
export function diffComputedStyles(
  baseline: ComputedStyleSnapshot,
  variant: ComputedStyleSnapshot,
): CsdResult {
  if (!baseline || !variant) return EMPTY;

  const entries: CsdEntry[] = [];
  const byProperty = new Map<string, number>();
  const bySelector = new Map<string, number>();

  const baselineSelectors = new Set(Object.keys(baseline));
  const variantSelectors = new Set(Object.keys(variant));
  const shared = [...baselineSelectors].filter((s) => variantSelectors.has(s));

  for (const selector of shared) {
    const b = baseline[selector] ?? {};
    const v = variant[selector] ?? {};
    const props = new Set([...Object.keys(b), ...Object.keys(v)]);
    for (const property of props) {
      const bv = b[property] ?? "";
      const vv = v[property] ?? "";
      if (bv !== vv) {
        entries.push({ selector, property, baseline: bv, variant: vv });
        byProperty.set(property, (byProperty.get(property) ?? 0) + 1);
        bySelector.set(selector, (bySelector.get(selector) ?? 0) + 1);
      }
    }
  }

  const selectorsOnlyInBaseline = [...baselineSelectors].filter((s) => !variantSelectors.has(s));
  const selectorsOnlyInVariant = [...variantSelectors].filter((s) => !baselineSelectors.has(s));

  const sortMap = (m: Map<string, number>) =>
    [...m.entries()]
      .map(([k, count]) => ({ key: k, count }))
      .sort((a, b) => b.count - a.count || a.key.localeCompare(b.key));

  return {
    entries,
    totalDiffs: entries.length,
    byProperty: sortMap(byProperty).map(({ key, count }) => ({ property: key, count })),
    bySelector: sortMap(bySelector).map(({ key, count }) => ({ selector: key, count })),
    selectorsOnlyInBaseline,
    selectorsOnlyInVariant,
  };
}
