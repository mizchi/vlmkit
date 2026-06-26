import type { ModelRouter, RouterOptions } from "./types.ts";

/**
 * Shared budget accumulator. One instance is injected into both the observe
 * and codegen routers so their costs sum into a single cap.
 */
export interface Budget {
  budgetUsd: number;
  add(n: number): void;
  total(): number;
}

export function createModelRouter(opts: RouterOptions, budget: Budget): ModelRouter {
  const escalateAfter = opts.escalateAfter ?? 1;
  let tierIndex = 0;
  let failuresAtTier = 0;

  return {
    current() {
      return opts.tiers[tierIndex];
    },
    escalate() {
      failuresAtTier++;
      if (failuresAtTier >= escalateAfter) {
        failuresAtTier = 0;
        tierIndex = Math.min(tierIndex + 1, opts.tiers.length - 1);
      }
    },
    record(r) {
      budget.add(r.costUsd);
    },
    spentUsd() {
      return budget.total();
    },
    exhausted() {
      return budget.total() >= budget.budgetUsd;
    },
  };
}
