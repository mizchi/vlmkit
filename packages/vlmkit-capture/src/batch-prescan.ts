/**
 * Crater v0.18.0 `batchRender` driver for prescanner detection.
 *
 * Renders baseline + multiple broken variants in one BiDi call and returns
 * the paint-tree diff per variant. This is the fast path for prescanner
 * mode: instead of doing N × (setContent + capturePaintTree) for N trials
 * at a single viewport, do one `batchRender` and diff the returned trees.
 *
 * Computed-style and forced-state signals still require the per-viewport
 * capture flow — `batchRender` only returns paint trees. Use this driver
 * alongside the existing capture loop, not as a wholesale replacement.
 */
import type {
  CraterClient,
  CraterCssMutation,
  PaintNode,
  PaintTreeChange,
} from "./crater-client.ts";
import { diffPaintTrees } from "./crater-client.ts";

export interface BatchPrescanRequest {
  /** Stable id (echoed back in the result). */
  id: string;
  /** CSS mutations describing how this variant diverges from the baseline. */
  mutations: CraterCssMutation[];
}

export interface BatchPrescanResult {
  id: string;
  /** Paint-tree changes vs. the baseline tree. Empty when the variant looks identical. */
  changes: PaintTreeChange[];
  /** The variant's paint tree, when Crater returned one (kept for downstream inspection). */
  paintTree?: PaintNode | null;
  /** True when Crater silently dropped the variant (no `paintTree` in the response). */
  missing: boolean;
}

export interface BatchPrescanOptions {
  /** Skip variants whose `mutations` array is empty — Crater would no-op them anyway. */
  skipEmptyMutations?: boolean;
}

/**
 * Drive `batchRender` and return per-variant paint-tree diffs against a
 * caller-supplied baseline tree. The baseline tree must come from a render
 * of the unmodified `baseHtml` at the same viewport.
 *
 * The caller is responsible for collecting `baselinePaintTree` (e.g. via
 * the existing `capturePageStateCrater` flow at the same viewport).
 */
export async function runBatchPrescan(
  client: Pick<CraterClient, "batchRender">,
  baseHtml: string,
  viewport: { width: number; height: number },
  baselinePaintTree: PaintNode,
  requests: BatchPrescanRequest[],
  options: BatchPrescanOptions = {},
): Promise<BatchPrescanResult[]> {
  const skipEmpty = options.skipEmptyMutations ?? true;
  const callable = skipEmpty
    ? requests.filter((req) => req.mutations.length > 0)
    : requests;

  if (callable.length === 0) return [];

  const batch = await client.batchRender(
    baseHtml,
    viewport,
    callable.map((req) => ({ id: req.id, mutations: req.mutations })),
  );

  const byId = new Map<string, PaintNode | null | undefined>();
  for (const entry of batch.results ?? []) {
    byId.set(entry.id, entry.paintTree ?? null);
  }

  return callable.map((req) => {
    const tree = byId.get(req.id);
    if (tree === undefined || tree === null) {
      return { id: req.id, changes: [], missing: true };
    }
    const changes = diffPaintTrees(baselinePaintTree, tree);
    return { id: req.id, changes, paintTree: tree, missing: false };
  });
}

/**
 * Build a Crater `mutations` payload for "remove a single CSS declaration"
 * — the css-challenge property-mode trial shape.
 */
export function mutationsForPropertyRemoval(
  selector: string,
  property: string,
): CraterCssMutation[] {
  return [{ selector, property, action: "remove" }];
}

/**
 * Build a Crater `mutations` payload for "remove every declaration in a
 * selector block" — the css-challenge selector-mode trial shape.
 */
export function mutationsForSelectorBlockRemoval(
  selector: string,
  properties: string[],
): CraterCssMutation[] {
  return properties.map((property) => ({ selector, property, action: "remove" }));
}

/**
 * True when at least one of the batch-prescan results found a paint-tree
 * signal. Used to short-circuit follow-up per-viewport captures.
 */
export function hasAnyBatchPrescanSignal(results: BatchPrescanResult[]): boolean {
  return results.some((result) => !result.missing && result.changes.length > 0);
}
