/**
 * The `issues[]` half of rule-aware prose, shared by the gates whose reports have that shape.
 *
 * Seven gates — `check copy`, `check breakpoints`, `check scroll`, `check motion`,
 * `check animation`, `check asset`, `scan scroll` — all map `issue.kind` to a rule id and
 * `issue.severity` to the emitted severity, and all render the same three things from it: a
 * `status:` line, an `Issues:` block, and a green "nothing found" line when the block is empty.
 * Migrating them one at a time produced the same fifteen lines seven times, and the two
 * mistakes that are easy to make in those fifteen lines are exactly the ones the earlier
 * migrations made:
 *
 *   - reading `issue.severity` for the icon after tiering, so a rule re-tuned to `warn` still
 *     printed a red failure marker (`check tokens`, `check theme`);
 *   - keeping the green "No X detected." line when every row was hidden by a setting, which
 *     reports a clean page for defects the project asked not to hear about (`check design`).
 *
 * `applyRuleTiers` in `@mizchi/vlmkit-core/plugin/rule-tier.ts` stays the primitive; this is
 * the projection of it that these seven reports need. Gates with bespoke report shapes —
 * `check layout`'s per-viewport checks, `check story`'s outcomes, `verify markup`'s targets —
 * call the primitive directly, because a helper that fit those too would take more
 * configuration than the code it replaced.
 */
import type { FindingSeverity, RuleView } from "@mizchi/vlmkit-core/plugin/contract.ts";
import { applyRuleTiers, hiddenByRuleNote, type TieredRow } from "@mizchi/vlmkit-core/plugin/rule-tier.ts";

/** The shape all seven reports' rows already have. */
export interface IssueLike {
  kind: string;
  severity: FindingSeverity;
}

export interface TieredIssues<T> {
  /** Rows whose rule is still on, each carrying the severity to print it at. */
  shown: TieredRow<T>[];
  /**
   * The gate's own `status:` word, computed from what survives.
   *
   * `ok` when nothing survives — including when the only reason nothing survives is that the
   * rows were turned off. That is the honest word for it: the project said these do not count,
   * and `note` is printed alongside so the screen still says how many were dropped.
   */
  status: "ok" | "info" | "warn" | "suspect";
  /** `hiddenByRuleNote`'s line, or undefined when the settings dropped nothing. */
  note?: string;
}

/**
 * Tier a report's `issues[]` and derive the status word.
 *
 * Callers keep their own icons and wording — the palettes and the glyphs (`x` vs `✗`) differ
 * per gate and are not worth unifying — but they must read `tier` from the returned rows rather
 * than `severity` from their own, which is the point of routing through here.
 */
export function tierIssues<T extends IssueLike>(
  issues: readonly T[],
  rules?: RuleView,
): TieredIssues<T> {
  const { shown, hiddenByRule } = applyRuleTiers(
    issues,
    (issue) => ({ rule: issue.kind, emitted: issue.severity }),
    rules,
  );
  const status = shown.some((s) => s.tier === "suspect") ? "suspect"
    : shown.some((s) => s.tier === "warn") ? "warn"
    : shown.length > 0 ? "info"
    : "ok";
  const note = hiddenByRuleNote(hiddenByRule);
  return { shown, status, ...(note ? { note } : {}) };
}

/**
 * ` [kind re-tuned to warn]`, or `""` when the row prints at the severity it was emitted at.
 *
 * Without it a demoted row is indistinguishable from one the gate itself graded that way, and
 * the reader has no way to tell a measurement from a policy. The suffix names the rule id
 * because that is the string they would edit to change it back.
 */
export function retuneNote<T extends IssueLike>(entry: TieredRow<T>): string {
  return entry.tier === entry.row.severity ? "" : ` [${entry.row.kind} re-tuned to ${entry.tier}]`;
}
