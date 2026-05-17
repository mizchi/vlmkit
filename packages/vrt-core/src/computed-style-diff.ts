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

export type ComputedStyleSnapshot = Record<string, Record<string, string>>;

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
