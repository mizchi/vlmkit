/**
 * User-declared exemptions for `check integrity`.
 *
 * The gate already exempts candidates it recognises as intentional patterns,
 * and lists them so the exemption is auditable. What was missing was the other
 * half: when a *new* intentional pattern trips a probe, the only options were to
 * change the markup or file an issue. `check copy` has had per-class acceptance
 * (`--allow-invisible`) since the silencing battery; this is the same idea for
 * integrity.
 *
 * Three rules keep an exemption from becoming a blindfold:
 *
 *   1. **A reason is required.** `--allow "text-collision@.kicker"` alone is
 *      rejected; the pattern must carry `;<reason>`. An exemption without a
 *      stated reason is the thing that gets re-approved forever.
 *   2. **An unknown kind is an error**, listing the valid kinds. `--allow
 *      text-colision` would otherwise silence nothing while looking like it
 *      worked — the worst outcome for a suppression flag.
 *   3. **Exempted findings stay in the report**, moved into `exempted` with the
 *      user's reason attached, and an exemption that matched nothing is
 *      reported too, so dead config gets deleted instead of accumulating.
 *
 * Lifecycle (owner, expiry, review) belongs in `vlmkit.gates.json`, which
 * already carries reason/owner/expires per suppression and stops applying an
 * expired one. This module is deliberately just the matcher.
 */
import { UsageError } from "@mizchi/vlmkit-core/cli-error.ts";
import type { IntegrityExemption, IntegrityFinding, IntegrityFindingKind } from "./integrity-check.ts";

export const INTEGRITY_FINDING_KINDS: IntegrityFindingKind[] = [
  "broken-image",
  "failed-stylesheet",
  "broken-font",
  "text-collision",
  "text-clipped",
  "collapsed-container",
  "page-overflow-x",
  "clipped-content",
  "nested-scroll",
  "container-protrusion",
  "invisible-text",
  "low-contrast-text",
  "near-misalignment",
  "occluded-text",
];

/**
 * Kinds that may never be exempted: they are not judgement calls about
 * intentional design, they are the page being broken or unmeasurable. Allowing
 * them would let a project silence "your JS threw" or "we followed a redirect
 * to the login page", which is how a gate becomes decoration.
 */
export const NON_EXEMPTABLE_KINDS: readonly string[] = [
  "js-error",
  "degenerate-render",
  "unstyled-page",
  "redirected",
];

export interface IntegrityAllowRule {
  kind: IntegrityFindingKind;
  /** Substring the finding's selector must contain. Omitted = any selector. */
  selector?: string;
  /** Viewport width this applies to. Omitted = every viewport. */
  viewport?: number;
  reason: string;
  /** The pattern as written, for reporting an unused rule back verbatim. */
  raw: string;
}

/**
 * `;` separates the reason, NOT `#`.
 *
 * `#` was the first choice and it is unusable: a selector with an ID
 * (`text-collision@#refund;...`) split at the selector's own `#`, silently
 * producing an empty selector — an exemption far broader than what was written.
 * A semicolon never appears in a CSS selector, and the reason may contain as
 * many as it likes since only the first one delimits.
 */
const SYNTAX = "<kind>[@<selector>][@<viewport>];<reason>";

/**
 * Parse `text-collision@.kicker@1280;negative leading is deliberate`.
 *
 * `@` separates the optional selector and viewport, the first `;` starts the
 * reason. Chosen over JSON on the command line because this has to be typable,
 * and over a bare `kind:selector` because the reason has to be non-optional.
 */
export function parseAllowRule(spec: string): IntegrityAllowRule {
  const cut = spec.indexOf(";");
  if (cut < 0) {
    throw new UsageError(
      `--allow needs a reason: ${SYNTAX} (got "${spec}").`
      + (spec.includes("#")
        ? ` The reason is separated by ";", not "#" — "#" is part of an ID selector.`
        : "")
      + ` An exemption without a stated reason cannot be reviewed.`,
    );
  }
  const reason = spec.slice(cut + 1).trim();
  if (!reason) throw new UsageError(`--allow reason is empty in "${spec}". Say why this pattern is intentional.`);
  const parts = spec.slice(0, cut).split("@").map((p) => p.trim());
  const kind = parts[0] ?? "";
  if (!INTEGRITY_FINDING_KINDS.includes(kind as IntegrityFindingKind)) {
    if (NON_EXEMPTABLE_KINDS.includes(kind)) {
      throw new UsageError(
        `--allow cannot exempt "${kind}": it reports the page being broken or unmeasurable,`
        + ` not an intentional design pattern. Fix the page.`,
      );
    }
    throw new UsageError(
      `--allow: unknown finding kind "${kind}". Valid kinds: ${INTEGRITY_FINDING_KINDS.join(", ")}`,
    );
  }
  const rule: IntegrityAllowRule = { kind: kind as IntegrityFindingKind, reason, raw: spec };
  for (const part of parts.slice(1)) {
    if (!part) continue;
    if (/^\d+$/.test(part)) rule.viewport = Number.parseInt(part, 10);
    else rule.selector = part;
  }
  return rule;
}

export function parseAllowRules(specs: readonly string[]): IntegrityAllowRule[] {
  return specs.filter((s) => s.trim()).map(parseAllowRule);
}

export function ruleMatches(rule: IntegrityAllowRule, finding: IntegrityFinding): boolean {
  if (rule.kind !== finding.kind) return false;
  if (rule.viewport !== undefined) {
    // Against every width the finding appeared at, not just the canonical one:
    // a finding present at 1280/768/375 must be exemptable by any of them.
    const observed = finding.viewports ?? [finding.viewport];
    if (!observed.includes(rule.viewport)) return false;
  }
  if (rule.selector !== undefined) {
    // Substring, not an exact match: the finding's selector is a generated path
    // (`main>div.card>p.kicker`), so equality would break the moment an
    // unrelated ancestor gained a class.
    if (!finding.selector?.includes(rule.selector)) return false;
  }
  return true;
}

export interface AppliedExemptions {
  findings: IntegrityFinding[];
  /** Findings moved out, with the user's reason recorded. */
  exempted: IntegrityExemption[];
  /**
   * Rules that matched nothing. Reported so a rule kept alive past the defect
   * it covered gets deleted rather than quietly widening the blind spot.
   */
  unusedRules: IntegrityAllowRule[];
}

export function applyAllowRules(
  findings: readonly IntegrityFinding[],
  rules: readonly IntegrityAllowRule[],
): AppliedExemptions {
  if (rules.length === 0) return { findings: [...findings], exempted: [], unusedRules: [] };
  const kept: IntegrityFinding[] = [];
  const exempted: IntegrityExemption[] = [];
  const used = new Set<string>();
  for (const finding of findings) {
    const rule = rules.find((r) => ruleMatches(r, finding));
    if (!rule) {
      kept.push(finding);
      continue;
    }
    used.add(rule.raw);
    exempted.push({
      kind: finding.kind,
      viewport: finding.viewport,
      ...(finding.selector ? { selector: finding.selector } : {}),
      reason: `user exemption (${rule.raw.split(";")[0]}): ${rule.reason}`,
    });
  }
  return { findings: kept, exempted, unusedRules: rules.filter((r) => !used.has(r.raw)) };
}

export const ALLOW_HELP = `  --allow <rule>      Exempt an intentional pattern, repeatable. Syntax:
                        ${SYNTAX}
                      e.g. --allow "near-misalignment@.badge;optically centred"
                           --allow "text-collision@#refund@1280;deliberate graze"
                      A reason is required; an unknown kind is an error; an
                      exempted finding is still listed under "exempted"; a rule
                      matching nothing is reported. Kinds that mean the page is
                      broken (${NON_EXEMPTABLE_KINDS.join(", ")}) cannot be exempted.`;
