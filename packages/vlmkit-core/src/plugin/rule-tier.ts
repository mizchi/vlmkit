/**
 * What a rule is worth *right now*, for formatters that render their own prose.
 *
 * A gate's `format(report, rules?)` receives a `RuleView`, and the whole reason it exists is
 * that suppression happens on the runner's normalized finding list while the prose renders
 * from the raw report. A rule-blind formatter therefore prints findings that were suppressed
 * and counts them on its own status line, under a verdict and exit code that do not — one
 * screen contradicting itself, which the runner has to disclaim.
 *
 * Every migrated formatter needs the same three steps: map its own row to a rule id, ask
 * what that rule is set to, drop the rows that are off and re-label the rest. That is what
 * this file is; without it each gate re-derives the runner's decisions and gets to disagree
 * with them in its own way.
 *
 * `check integrity` did it by hand first and keeps its own version, because it translates into
 * its own `fail`/`warn` vocabulary — its findings say `fail` where every other gate says
 * `suspect`. Writing this file is what exposed the bug in that hand-rolled copy: it asked the
 * rule view for the rule's *effective* severity, which falls back to the gate's table, so a
 * finding the measurement deliberately emitted as a warn printed as a failure. See `ruleTier`.
 */
import type { FindingSeverity, RuleView } from "./contract.ts";

/** A rule's effective setting: a severity, or `off` when the project turned it off. */
export type RuleTier = "off" | FindingSeverity;

/**
 * What to print a row as: the explicit project setting, or the severity the finding was
 * emitted at.
 *
 * `emitted` — not the gate's declared table severity — because that is exactly what
 * `applyRuleSettings` keeps: "only an explicit setting re-tunes. A gate is free to emit a
 * severity that differs from its rule default, and that judgment must survive." Reading
 * `rules.effective()` here instead looks equivalent and is not: it falls back to the table, so
 * a finding emitted `warn` under a rule declared `suspect` renders as a failure over an exit 0.
 * That is not hypothetical — `check integrity` printed `DEFECTS (1 fail, 0 warn)` directly
 * above `exits 0 — 1 warn(s)` for a post-load `js-error`, which is the bug that produced this
 * function.
 *
 * `rules` is optional in `format`, and undefined means nobody applied settings — a direct
 * library call or a test. The emitted severity is the honest answer there too.
 */
export function ruleTier(rules: RuleView | undefined, ruleId: string, emitted: FindingSeverity): RuleTier {
  return rules?.setting(ruleId) ?? emitted;
}

/**
 * A `RuleView` from a plain map of explicit settings — for tests, and for anything else that
 * needs to render prose under a hypothetical configuration.
 *
 * It exists so a stub cannot get the `effective` / `setting` split wrong. Hand-written stubs
 * supplied only `effective`, which is the lossy half: a formatter under such a stub reads a
 * severity for EVERY rule and can never see "nobody set this one", so a test built on it
 * cannot reproduce the case the real runner hits most often — no settings at all.
 */
export function ruleViewFrom(
  settings: Readonly<Record<string, RuleTier>>,
  fallback: FindingSeverity = "warn",
): RuleView {
  return {
    setting: (ruleId) => settings[ruleId],
    effective: (ruleId) => settings[ruleId] ?? fallback,
  };
}

export interface TieredRow<T> {
  row: T;
  tier: FindingSeverity;
}

export interface TieredRows<T> {
  /** Rows whose rule is still on, each carrying its effective severity. */
  shown: TieredRow<T>[];
  /** Rows dropped because their rule is `off`, keyed by rule id for the disclosure line. */
  hiddenByRule: Map<string, number>;
}

/**
 * Split rows into "still worth printing" and "turned off", by rule id.
 *
 * The hidden rows are returned counted rather than discarded because a formatter that
 * silently prints fewer lines is a report that quietly measures less than it did yesterday.
 * The runner already prints `N finding(s) suppressed by rule settings`; a migrated formatter
 * uses this to keep its own body and counts consistent with that line instead of contradicting
 * it.
 */
export function applyRuleTiers<T>(
  rows: readonly T[],
  ruleOf: (row: T) => { rule: string; emitted: FindingSeverity },
  rules?: RuleView,
): TieredRows<T> {
  const shown: TieredRow<T>[] = [];
  const hiddenByRule = new Map<string, number>();
  for (const row of rows) {
    const { rule, emitted } = ruleOf(row);
    const tier = ruleTier(rules, rule, emitted);
    if (tier === "off") {
      hiddenByRule.set(rule, (hiddenByRule.get(rule) ?? 0) + 1);
      continue;
    }
    shown.push({ row, tier });
  }
  return { shown, hiddenByRule };
}

/**
 * One line naming what the settings removed, or `undefined` when nothing was.
 *
 * Deliberately not styled with colour codes: the callers are eight formatters with their own
 * palettes, and they wrap this in their own `DIM`. Deliberately not silent when the count is
 * zero either — it returns `undefined` so a formatter cannot print an empty bullet.
 */
export function hiddenByRuleNote(hiddenByRule: Map<string, number>): string | undefined {
  if (hiddenByRule.size === 0) return undefined;
  const total = [...hiddenByRule.values()].reduce((a, b) => a + b, 0);
  const detail = [...hiddenByRule].map(([rule, n]) => `${rule} x${n}`).join(", ");
  return `${total} finding(s) not shown — rule turned off (${detail})`;
}
