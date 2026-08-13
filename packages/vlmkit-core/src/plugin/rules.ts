/**
 * Rule settings — the eslint-shaped layer that lets a project re-tune or
 * switch off one rule instead of one whole gate.
 *
 * `vlmkit.gates.json` could previously only silence at gate granularity:
 * drop `check integrity` from a page's list, or append a flag the gate
 * happened to implement (`--allow-invisible`, `--allow`). A project that
 * accepts one intentional `text-collision` pattern on one page had to
 * choose between an ad-hoc per-gate flag, if the gate author had thought to
 * add one, and turning the entire eighteen-rule gate off. Rule settings
 * make the narrow choice available for every gate uniformly, and — because
 * the rule table is declared — a typo is a config error rather than a
 * silently ineffective line.
 *
 * The two decisions inherited from `gate-config.ts` still hold: a
 * suppression must be enumerable, and a silenced finding is *reported as
 * silenced* rather than dropped. `applyRuleSettings` returns what it
 * suppressed and what it re-tuned, so the runner can print both.
 */

import { UsageError } from "../cli-error.ts";
import type { AnyGateDefinition, Finding, FindingSeverity, RuleDefinition } from "./contract.ts";
import { FINDING_SEVERITIES, ruleRef } from "./contract.ts";

/** `"off"` drops the finding; a severity re-tunes it (usually `suspect` → `warn`). */
export type RuleSetting = "off" | FindingSeverity;

export const RULE_SETTINGS: readonly RuleSetting[] = ["off", ...FINDING_SEVERITIES];

/**
 * Keys are `<gateId>/<ruleId>`, `<gateId>` (every rule of that gate), or a
 * bare `<ruleId>` when the settings block is already scoped to one gate.
 */
export type RuleSettings = Readonly<Record<string, RuleSetting>>;

export interface RuleDecision {
  ruleId: string;
  /** Effective severity, or `"off"`. */
  effective: RuleSetting;
  /** The gate's declared default, for reporting what changed. */
  declared: FindingSeverity;
  /** The settings key that decided this, when a setting applied. */
  via?: string;
}

export interface ResolvedRules {
  gateId: string;
  decisions: ReadonlyMap<string, RuleDecision>;
  /** Settings keys that matched no rule of this gate — typos, or stale entries. */
  unmatched: readonly string[];
}

export interface SuppressedFinding {
  finding: Finding;
  /** Settings key that silenced it. */
  via: string;
}

export interface RetunedFinding {
  finding: Finding;
  from: FindingSeverity;
  to: FindingSeverity;
  via: string;
}

export interface AppliedRules {
  /** Findings that survived, with severities re-tuned in place. */
  findings: readonly Finding[];
  suppressed: readonly SuppressedFinding[];
  retuned: readonly RetunedFinding[];
  /**
   * Rule ids a gate emitted that are absent from its own rule table. A gate
   * bug, not a user error: an undeclared rule cannot be documented or
   * configured, which is the drift this whole layer exists to prevent.
   */
  undeclared: readonly string[];
}

function isRuleSetting(value: unknown): value is RuleSetting {
  return typeof value === "string" && (RULE_SETTINGS as readonly string[]).includes(value);
}

/**
 * Parse and validate a settings object. Errors name the JSON path, matching
 * `parseGateConfig`'s convention so a bad rules block reads like any other
 * config defect.
 */
export function parseRuleSettings(raw: unknown, path: string): RuleSettings {
  if (typeof raw !== "object" || raw === null || Array.isArray(raw)) {
    throw new UsageError(`${path}: must be an object mapping rule references to settings`);
  }
  const out: Record<string, RuleSetting> = {};
  for (const [key, value] of Object.entries(raw as Record<string, unknown>)) {
    if (!key.trim()) throw new UsageError(`${path}: rule reference must be a non-empty string`);
    // A `//`-prefixed key is a comment, the convention this config already uses at the
    // top level — `examples/vlmkit.gates.json` carries `"//rules"` and
    // `"//suppressions"`. It was rejected one level down, inside the map, which is the
    // one place a reason matters most. v6's adoption agent, working to "assume I read
    // the diff and nothing else":
    //
    //   "`suppressions` have `reason` / `owner` / `expires` and an expired one re-fails
    //    the build. `rules` has none of that. […] So the only mechanism for 'the tool is
    //    wrong about this rule' is the one mechanism with no audit trail and no expiry."
    //
    // Accepting the comment does not give `rules` an expiry, but it does let the reason
    // live next to the decision instead of in a sibling string far from it.
    if (key.trim().startsWith("//")) continue;
    if (!isRuleSetting(value)) {
      throw new UsageError(
        `${path}["${key}"]: must be one of ${RULE_SETTINGS.join(", ")}, got ${JSON.stringify(value)}`,
      );
    }
    out[key.trim()] = value;
  }
  return out;
}

/**
 * Which settings key applies to a rule, most specific first.
 *
 * Specificity beats declaration order deliberately: a config that turns a
 * whole gate down to `warn` and then names one rule `suspect` means the
 * narrow line, regardless of which key JSON happened to list first.
 */
function candidateKeys(gateId: string, ruleId: string): string[] {
  return [ruleRef(gateId, ruleId), ruleId, `${gateId}/*`, gateId];
}

export function resolveRules(gate: AnyGateDefinition, settings: RuleSettings = {}): ResolvedRules {
  const decisions = new Map<string, RuleDecision>();
  const used = new Set<string>();
  for (const rule of gate.rules) {
    let decision: RuleDecision = { ruleId: rule.id, effective: rule.severity, declared: rule.severity };
    for (const key of candidateKeys(gate.id, rule.id)) {
      const setting = settings[key];
      if (setting === undefined) continue;
      used.add(key);
      decision = { ruleId: rule.id, effective: setting, declared: rule.severity, via: key };
      break;
    }
    decisions.set(rule.id, decision);
  }
  // A bare-ruleId key is only meaningful inside a gate-scoped block; a key
  // naming another gate is not this gate's problem, so it is not "unmatched"
  // here. The registry-wide validator catches genuinely unknown references.
  const unmatched = Object.keys(settings)
    .filter((key) => !used.has(key))
    .filter((key) => key === gate.id || key === `${gate.id}/*` || key.startsWith(`${gate.id}/`) || !key.includes("/"));
  return { gateId: gate.id, decisions, unmatched };
}

/** Apply resolved settings to a gate's findings. */
export function applyRuleSettings(
  gate: AnyGateDefinition,
  findings: readonly Finding[],
  settings: RuleSettings = {},
): AppliedRules {
  const resolved = resolveRules(gate, settings);
  const kept: Finding[] = [];
  const suppressed: SuppressedFinding[] = [];
  const retuned: RetunedFinding[] = [];
  const undeclared: string[] = [];
  for (const finding of findings) {
    const decision = resolved.decisions.get(finding.rule);
    if (!decision) {
      if (!undeclared.includes(finding.rule)) undeclared.push(finding.rule);
      kept.push(finding);
      continue;
    }
    if (decision.effective === "off") {
      suppressed.push({ finding, via: decision.via ?? gate.id });
      continue;
    }
    // Only an explicit setting re-tunes. A gate is free to emit a severity
    // that differs from its rule default (integrity downgrades some
    // findings on evidence), and that judgment must survive.
    if (decision.via && decision.effective !== finding.severity) {
      retuned.push({ finding, from: finding.severity, to: decision.effective, via: decision.via });
      kept.push({ ...finding, severity: decision.effective });
      continue;
    }
    kept.push(finding);
  }
  return { findings: kept, suppressed, retuned, undeclared };
}

export interface FindingCounts {
  suspect: number;
  warn: number;
  info: number;
}

export function countFindings(findings: readonly Finding[]): FindingCounts {
  return {
    suspect: findings.filter((f) => f.severity === "suspect").length,
    warn: findings.filter((f) => f.severity === "warn").length,
    info: findings.filter((f) => f.severity === "info").length,
  };
}

/**
 * Validate a definition before it is registered. Cheap invariants, but each
 * one is a defect that used to be discoverable only by running the gate:
 * duplicate rule ids make a setting ambiguous, a non-slug id breaks config
 * keys, and an empty command cannot be dispatched.
 */
export function validateGateDefinition(gate: AnyGateDefinition): string[] {
  const problems: string[] = [];
  if (!/^[a-z0-9]+(?:[.-][a-z0-9]+)*$/.test(gate.id)) {
    problems.push(`id "${gate.id}" must be lowercase dot/dash-separated (e.g. check.integrity)`);
  }
  if (gate.command.length === 0) problems.push(`${gate.id}: command must have at least one token`);
  for (const token of gate.command) {
    if (!/^[a-z0-9-]+$/.test(token)) problems.push(`${gate.id}: command token "${token}" must be a lowercase slug`);
  }
  if (gate.rules.length === 0) {
    problems.push(`${gate.id}: rules table is empty — a gate with no declared rules cannot be tuned or documented`);
  }
  const seen = new Set<string>();
  for (const rule of gate.rules as readonly RuleDefinition[]) {
    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(rule.id)) {
      problems.push(`${gate.id}: rule id "${rule.id}" must be a lowercase slug`);
    }
    if (seen.has(rule.id)) problems.push(`${gate.id}: duplicate rule id "${rule.id}"`);
    seen.add(rule.id);
    if (!rule.title.trim()) problems.push(`${gate.id}/${rule.id}: title is required`);
  }
  return problems;
}
