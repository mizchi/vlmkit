/**
 * Declaring which style differences between instances are deliberate.
 *
 * `check drift component` answers "these N instances should look the same", and a
 * design system's variants are the standing exception: a featured card *is* meant
 * to differ from a plain one, in specific properties, on purpose. Without a way to
 * say so, the gate is permanently red on any page with a variant, and three
 * separate dogfood agents hit that wall in three different ways:
 *
 *   - "It also flags `.card--featured` at 95.87%, which the brief *requires* to
 *     look different."
 *   - the next one got past it by moving the accent into a property the gate did
 *     not then track, which is how `outline-*` ended up on the tracked list;
 *   - "drift lists intentional (colour) and unintentional (geometry) drift in one
 *     undifferentiated list — I found no way to bless expected properties."
 *
 * Modelled on `check integrity --allow`, deliberately, down to the syntax and the
 * two properties that make it reviewable rather than a mute: an exempted delta is
 * still listed, and a rule that matched nothing is reported. The adoption report
 * that asked for this in the first place (issue #112, item 4) singled those out —
 * "we like that a lot — the exemption is auditable rather than silent."
 *
 * What differs from integrity's version is the unit. There, a rule exempts a
 * finding *kind*; here it exempts a *property*, because "this variant may differ
 * in its background and border" is the shape of the real permission, and a
 * whole-instance exemption would hide the geometry mistake sitting next to the
 * intentional colour.
 */
import { UsageError } from "@mizchi/vlmkit-core/cli-error.ts";

export interface DriftAllowRule {
  /** Property name, optionally ending in `*` to cover a family. */
  property: string;
  /** Substring the instance's selector must contain. Omitted = any instance. */
  selector?: string;
  reason: string;
  /** The pattern as written, for reporting an unused rule back verbatim. */
  raw: string;
}

const SYNTAX = "<property>[@<selector>];<reason>";

/**
 * Parse `background-color@.card--featured;variant accent`.
 *
 * `;` delimits the reason rather than `#`, for the reason integrity's parser
 * documents: `#` is part of an ID selector and splitting on it silently produces
 * an exemption broader than the one written.
 */
export function parseDriftAllowRule(spec: string): DriftAllowRule {
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
  if (!reason) {
    throw new UsageError(`--allow reason is empty in "${spec}". Say why this difference is intentional.`);
  }
  const [property = "", ...rest] = spec.slice(0, cut).split("@").map((p) => p.trim());
  if (!property) {
    throw new UsageError(`--allow needs a property name: ${SYNTAX} (got "${spec}").`);
  }
  // A bare `*` would exempt the whole comparison, which is `--rule
  // instance-drift=off` wearing a disguise — and unlike that flag it would not
  // show up in the re-tuned line the runner prints.
  if (property === "*") {
    throw new UsageError(
      `--allow "*" would exempt every property, which is \`--rule instance-drift=off\`.`
      + ` Name the properties a variant may differ in, or turn the rule off explicitly.`,
    );
  }
  const rule: DriftAllowRule = { property, reason, raw: spec };
  const selector = rest.find((part) => part.length > 0);
  if (selector) rule.selector = selector;
  return rule;
}

export function parseDriftAllowRules(specs: readonly string[]): DriftAllowRule[] {
  return specs.filter((s) => s.trim()).map(parseDriftAllowRule);
}

/** `padding-*` covers the four sides; an exact name covers only itself. */
export function propertyMatches(pattern: string, property: string): boolean {
  if (!pattern.includes("*")) return pattern === property;
  // Anchored at both ends, so `border-*-color` matches `border-top-color` and not
  // `border-top-color-something`. Only `*` is special; everything else is literal.
  const source = pattern.split("*").map((part) => part.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("[^\\s]*");
  return new RegExp(`^${source}$`).test(property);
}

export interface StyleDelta {
  property: string;
  reference: string;
  candidate: string;
}

export interface ExemptedStyleDelta extends StyleDelta {
  /** The user's reason, prefixed with the rule that matched. */
  reason: string;
}

export interface AppliedDriftExemptions {
  /** Deltas the verdict still counts. */
  styleDeltas: StyleDelta[];
  /** Deltas moved out, with the reason recorded so a reader can disagree. */
  exempted: ExemptedStyleDelta[];
  /**
   * Rules that matched nothing on this instance. Aggregated by the caller across
   * instances before reporting, since a rule scoped to one variant legitimately
   * matches nothing on the others.
   */
  usedRaw: string[];
}

export function applyDriftAllowRules(
  styleDeltas: readonly StyleDelta[],
  instanceSelector: string,
  rules: readonly DriftAllowRule[],
): AppliedDriftExemptions {
  if (rules.length === 0) return { styleDeltas: [...styleDeltas], exempted: [], usedRaw: [] };
  const kept: StyleDelta[] = [];
  const exempted: ExemptedStyleDelta[] = [];
  const usedRaw = new Set<string>();
  for (const delta of styleDeltas) {
    const rule = rules.find((r) =>
      propertyMatches(r.property, delta.property)
      && (r.selector === undefined || instanceSelector.includes(r.selector)));
    if (!rule) {
      kept.push(delta);
      continue;
    }
    usedRaw.add(rule.raw);
    exempted.push({ ...delta, reason: `user exemption (${rule.raw.split(";")[0]}): ${rule.reason}` });
  }
  return { styleDeltas: kept, exempted, usedRaw: [...usedRaw] };
}

export const DRIFT_ALLOW_HELP = `Declare a style difference intentional, repeatable. Syntax:
  ${SYNTAX}
e.g. --allow "background-color@.card--featured;variant accent"
     --allow "border-*-color@.card--featured;variant accent"
A reason is required; \`*\` covers a family (\`padding-*\`); a bare \`*\` is refused
because that is \`--rule instance-drift=off\`; an exempted difference is still
listed under "exempted"; a rule matching nothing is reported.`;
