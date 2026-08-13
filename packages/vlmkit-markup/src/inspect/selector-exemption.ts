/**
 * The `<selector>;<reason>` exemption form, shared by the gates whose findings
 * are attributed to one element and whose rule table is small enough that naming
 * the rule adds nothing.
 *
 * There were already three exemption parsers in this package — `integrity-exemption`
 * (`<kind>[@<selector>][@<viewport>];<reason>`, because that gate has 19 rules and
 * three viewports), `drift-exemption` (`<property>[@<selector>];<reason>`, because
 * that gate's findings are per computed property), and one inside `design-policy`.
 * The third is this shape exactly, so v7 extracted it here rather than writing a
 * fourth copy for the a11y gates, which is what the alternative was.
 *
 * The three properties every exemption in this repo has, and the reasons they are
 * not negotiable:
 *
 *   1. **A reason is required.** An exemption nobody can review gets approved again
 *      a year later by a reader who cannot tell what it was for.
 *   2. **A rule that matched nothing is reported.** Kept past the defect it covered,
 *      it is a blind spot for a variant that is no longer there.
 *   3. **A bare `*` is refused.** That is `--rule <id>=off` in disguise, and unlike
 *      that flag it would not appear in the runner's `re-tuned:` line.
 */
import { UsageError } from "@mizchi/vlmkit-core/cli-error.ts";

export interface SelectorAllowRule {
  /** Substring the finding's selector must contain. */
  selector: string;
  reason: string;
  /** As written, so an unused rule is reported back verbatim. */
  raw: string;
}

/**
 * Parse `--allow ".btn--primary;the primary action is deliberately distinct"`.
 *
 * `;` delimits the reason rather than `#`, because `#` is part of an ID selector
 * and splitting on it silently produces a broader exemption than the one written.
 */
export function parseSelectorAllowRules(
  specs: readonly string[],
  options: { ruleId?: string } = {},
): SelectorAllowRule[] {
  const offSuggestion = options.ruleId ? `\`--rule ${options.ruleId}=off\`` : "turning the rule off";
  const rules: SelectorAllowRule[] = [];
  for (const spec of specs) {
    if (!spec.trim()) continue;
    const cut = spec.indexOf(";");
    if (cut < 0) {
      throw new UsageError(
        `--allow needs a reason: <selector>;<reason> (got "${spec}").`
        + (spec.includes("#") ? ` The reason is separated by ";", not "#" — "#" is part of an ID selector.` : "")
        + ` An exemption without a stated reason cannot be reviewed.`,
      );
    }
    const selector = spec.slice(0, cut).trim();
    const reason = spec.slice(cut + 1).trim();
    if (!selector) throw new UsageError(`--allow needs a selector: <selector>;<reason> (got "${spec}").`);
    if (!reason) throw new UsageError(`--allow reason is empty in "${spec}". Say why this is intentional.`);
    if (selector === "*") {
      throw new UsageError(
        `--allow "*" would exempt everything, which is ${offSuggestion}.`
        + ` Name what is deliberately different, or turn the rule off explicitly.`,
      );
    }
    rules.push({ selector, reason, raw: spec });
  }
  return rules;
}

export interface SelectorExemption<T> {
  finding: T;
  rule: SelectorAllowRule;
}

export interface AppliedSelectorAllow<T> {
  kept: T[];
  exempted: SelectorExemption<T>[];
  /** Rules that matched nothing — property 2 above. */
  unused: SelectorAllowRule[];
}

/**
 * Partition findings by the rules that exempt them.
 *
 * Substring, not equality: a finding's selector is a generated path
 * (`main>div.card>button.action`), so an exact match would break the moment an
 * unrelated ancestor gained a class.
 */
export function applySelectorAllowRules<T>(
  findings: readonly T[],
  rules: readonly SelectorAllowRule[],
  selectorOf: (finding: T) => string | undefined,
): AppliedSelectorAllow<T> {
  if (rules.length === 0) return { kept: [...findings], exempted: [], unused: [] };
  const kept: T[] = [];
  const exempted: SelectorExemption<T>[] = [];
  const used = new Set<string>();
  for (const finding of findings) {
    const selector = selectorOf(finding);
    const rule = selector === undefined ? undefined : rules.find((r) => selector.includes(r.selector));
    if (!rule) {
      kept.push(finding);
      continue;
    }
    used.add(rule.raw);
    exempted.push({ finding, rule });
  }
  return { kept, exempted, unused: rules.filter((r) => !used.has(r.raw)) };
}

/**
 * Help text for a gate's `--allow`, with the gate's own rule id in the `*` refusal.
 *
 * `extra` carries what is true of this gate only — the shape of its selectors, or
 * a threshold interaction a reader has to know about.
 */
export function selectorAllowHelp(options: { ruleId: string; example: string; extra?: string }): string {
  return `Exempt one element, repeatable. Syntax:
  <selector>;<reason>
e.g. --allow "${options.example}"
Use the selector AS PRINTED in the finding — it is an id-preferring path, so
\`button#export\` matches and \`.btn--primary\` does not (a rule matching nothing is
reported, so the mistake is loud rather than silent). A reason is required; a bare
\`*\` is refused because that is \`--rule ${options.ruleId}=off\`; an exempted finding
is still listed as exempted rather than disappearing.${options.extra ? `\n${options.extra}` : ""}`;
}
