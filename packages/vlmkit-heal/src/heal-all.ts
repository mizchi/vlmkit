import { heal, type HealDeps } from "./heal.ts";
import type { HealOptions, HealResult } from "./types.ts";

export interface HealAllEntry {
  testFile: string;
  /** null when skipped because the cross-file budget was exhausted. */
  result: HealResult | null;
  skipped: boolean;
}

export interface HealAllResult {
  entries: HealAllEntry[];
  totalCostUsd: number;
  fixed: number;
}

export interface HealAllOptions {
  /** Optional cap across ALL files; once cumulative spend reaches it, remaining files are skipped. */
  totalBudgetUsd?: number;
}

/**
 * Heal several test files sequentially (e.g. a whole failing suite). Each file
 * keeps its own per-run `budgetUsd`; `totalBudgetUsd` is an outer cap across the
 * batch so a runaway suite can't overspend.
 */
export async function healAll(
  items: HealOptions[],
  opts?: HealAllOptions,
  deps?: Partial<HealDeps>,
): Promise<HealAllResult> {
  const entries: HealAllEntry[] = [];
  let totalCostUsd = 0;

  for (const item of items) {
    if (opts?.totalBudgetUsd != null && totalCostUsd >= opts.totalBudgetUsd) {
      entries.push({ testFile: item.testFile, result: null, skipped: true });
      continue;
    }
    const result = await heal(item, deps);
    totalCostUsd += result.totalCostUsd;
    entries.push({ testFile: item.testFile, result, skipped: false });
  }

  return {
    entries,
    totalCostUsd,
    fixed: entries.filter((e) => e.result?.verdict === "fixed").length,
  };
}
