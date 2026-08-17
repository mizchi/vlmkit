/**
 * The gate plugin contract — one shape every deterministic gate declares
 * itself in, so the runner can drive gates it was never written against.
 *
 * Why this exists: gate identity used to be re-stated in four places that
 * could not be cross-checked — the CLI's `GROUPS` table, the MCP tool
 * definitions, `markup-verify`'s hardcoded `gate: "breakpoints" | ...`
 * union, and free-form gate strings in `vlmkit.gates.json`. Adding a gate
 * meant editing all four and hoping; a typo in the config surfaced as a
 * child process failing at run time rather than as a config error. Twenty
 * gate modules had also grown their own `parseArgs`, their own
 * `printUsage`, and their own exit-code decision (`check breakpoints`
 * called `process.exit(1)` directly, `check integrity` had no
 * `--advisory` at all, six modules used `applyGateExit`).
 *
 * A gate definition is data plus three pure-ish functions. The definition
 * is the single source of truth: the CLI derives its help from it, the MCP
 * server derives its tool schema from it, `vlmkit.gates.json` validates
 * against it, and the runner owns everything that used to be duplicated
 * (`--json`, `--advisory`, `--help`, the run ledger, the exit code).
 *
 * Layering rule: this module is types + two identity functions, with zero
 * imports beyond sibling core modules. Gate *implementations* live in the
 * package that owns their measurement code (`vlmkit-markup` for DOM/pixel
 * gates, `vlmkit-capture` for backend smoke checks) and are collected into
 * plugins there. Core never imports them — it only ever receives them.
 */

import type { RunLedgerEntry } from "../run-ledger.ts";

/**
 * Normalized finding severity.
 *
 * Gates disagreed on this vocabulary: most emit `"suspect" | "warn"`,
 * `check integrity` emits `"fail" | "warn"`. `gate-exit.ts` documents the
 * contract in terms of suspects ("a suspect fails the command"), so that is
 * the normal form and adapters map into it. `info` exists for findings a
 * gate wants to report without ever affecting a verdict.
 */
export type FindingSeverity = "suspect" | "warn" | "info";

export const FINDING_SEVERITIES: readonly FindingSeverity[] = ["suspect", "warn", "info"];

/**
 * One normalized finding. `rule` is the gate-local rule id — the same
 * string the gate's own report calls `kind`, so a migration is a rename
 * rather than a re-classification.
 */
export interface Finding {
  /** Gate-local rule id, e.g. `text-collision`. Must exist in the gate's rule table. */
  rule: string;
  severity: FindingSeverity;
  message: string;
  /** CSS selector the finding is attributed to, when the gate can attribute it. */
  selector?: string;
  /** Viewport width the finding was observed at, for multi-viewport gates. */
  viewport?: number;
  /** Arbitrary structured evidence, passed through to JSON output verbatim. */
  evidence?: Record<string, unknown>;
}

/**
 * A rule is the unit a user can re-tune or switch off, and the unit a
 * report attributes a finding to.
 *
 * `check layout` already proved this shape works as data (`LayoutRule` +
 * `evaluateLayoutRule`); this generalizes it. Declaring the table up front
 * is what makes rule-granular settings possible: without it, a config
 * saying `"text-collision": "off"` cannot be distinguished from a typo, and
 * suppression has to stay whole-gate (`vlmkit.gates.json` could only
 * silence `check integrity` entirely, or append a flag the gate happened to
 * implement).
 */
export interface RuleDefinition {
  /** Gate-local id. Stable — it appears in configs and reports. */
  id: string;
  /** One-line human name, used in `--rules` listings. */
  title: string;
  /**
   * The rule's *declared* severity: the highest severity a violation of it
   * can carry, and what `--rules` shows a reader deciding whether to tune it.
   *
   * A gate may still emit a lower severity for an individual finding when its
   * evidence is weaker — `check integrity` downgrades a `js-error` to `warn`
   * when the error fired after load, and a `failed-stylesheet` to `warn` when
   * the sheet was cross-origin. The runner preserves that judgment; only an
   * explicit rule setting overrides it.
   */
  severity: FindingSeverity;
  /** Why this rule exists / what a violation means. Shown by `vlmkit rules <gate>`. */
  docs?: string;
}

/**
 * Declarative description of a gate's inputs.
 *
 * The CLI can already read flags off argv itself, so this exists for the
 * consumers that cannot: the MCP server needs a JSON schema, and the docs
 * need a flag table. A gate still owns its `parse`, because several gates
 * have argument shapes no generic schema expresses well (`--allow`
 * mini-DSL, `--viewports 1280,768,375`). `inputs` is the machine-readable
 * summary of what `parse` accepts, not a replacement for it.
 */
export interface GateInput {
  /** Flag name without dashes, or `"source"` / `"target"` for positionals. */
  name: string;
  /**
   * Display name in help output, when it differs from `name`. Every gate's
   * documented usage line says `<html-or-url>`, which is a better prompt for
   * a human than the option key the schema needs.
   */
  placeholder?: string;
  kind: "path-or-url" | "path" | "string" | "number" | "boolean" | "string-list" | "number-list";
  description: string;
  required?: boolean;
  /** Positional index; omit for flags. */
  positional?: number;
  /** Closed value set, for `--wait-until`-style flags. */
  choices?: readonly string[];
  /** Repeatable flag (`--allow`, `--only`). */
  repeatable?: boolean;
  /** Default, for help text only. */
  defaultDescription?: string;
}

/** Everything the runner hands a gate that the gate should not read from globals. */
export interface GateContext {
  cwd: string;
  /** Raw argv after the command tokens, for gates that need a flag `parse` dropped. */
  argv: readonly string[];
  /** True when the caller asked for JSON, so a gate can skip building prose. */
  json: boolean;
}

/**
 * What kind of question a gate answers.
 *
 * These are not CLI groups. `check`/`scan`/`stress`/`verify` say how a command
 * is spelled; a category says what a failure MEANS, which is what a reader
 * picking gates for a project actually needs. `scan scroll` and `check
 * breakpoints` are spelled differently and answer the same kind of question.
 *
 * Kept small on purpose. A taxonomy with a bucket per gate classifies nothing,
 * and the useful cut is the one a person makes when deciding what to run:
 * "is the page broken", "does it behave", "does it look like our system",
 * "is it done", "is my tooling working".
 */
export const GATE_CATEGORIES = {
  correctness: "Is the page broken, on its own terms? No reference needed.",
  behavior: "Does it respond correctly to size, scroll, motion and input?",
  "design-system": "Does it conform to the design language the project declares?",
  verdict: "Is this attempt done? Aggregates other signals into one answer.",
  infrastructure: "Is the measurement toolchain itself working?",
} as const;

export type GateCategory = keyof typeof GATE_CATEGORIES;

export const GATE_CATEGORY_ORDER: readonly GateCategory[] = [
  // Roughly the order a project adopts them: stop shipping broken pages, then
  // broken behavior, then drift, then gate the whole thing.
  "correctness",
  "behavior",
  "design-system",
  "verdict",
  "infrastructure",
];

/**
 * A gate definition.
 *
 * `Report` is the gate's existing report type — migration wraps the
 * existing `run*` / `format*` functions rather than rewriting them, so the
 * measurement code stays untouched and the diff stays reviewable.
 */
/**
 * What a gate's `format` may ask about the project's rule settings.
 *
 * Deliberately one question rather than the whole `AppliedRules` object: a formatter
 * needs "what is this rule worth now", and handing it the suppressed/retuned lists
 * would invite it to re-derive the runner's decisions and disagree with them.
 */
export interface RuleView {
  /**
   * Effective setting for a rule id, after project config and `--rule`, falling back to the
   * severity the gate DECLARED for it.
   *
   * That fallback is why `setting` exists. `applyRuleSettings` re-tunes a finding only when
   * there is an explicit setting — a gate is free to emit a severity that differs from its
   * table (integrity emits `js-error` as a warn after load and a fail during construction),
   * and that judgement survives. A formatter reading only `effective` cannot reproduce this,
   * and `check integrity` printed the proof: a post-load `js-error` rendered as
   * `DEFECTS (1 fail, 0 warn)` directly above the runner's `exits 0 — 1 warn(s)`.
   */
  effective(ruleId: string): "off" | FindingSeverity;
  /**
   * The EXPLICIT project setting for a rule id, or `undefined` when nobody set one.
   *
   * This is the one a formatter wants: `setting(rule) ?? theSeverityTheFindingWasEmittedAt`
   * is exactly what the runner does to the finding list, so the prose and the exit code
   * cannot disagree.
   */
  setting(ruleId: string): "off" | FindingSeverity | undefined;
}

export interface GateDefinition<Report = unknown, Options = unknown> {
  /**
   * Stable machine id, `<group>.<leaf>` — `check.integrity`. Used by rule
   * settings, the ledger, and plugin conflict detection. Never localized,
   * never renamed without a deprecation.
   */
  id: string;
  /**
   * CLI path tokens: `["check", "integrity"]`. This is also the key
   * `vlmkit.gates.json` matches, which is why the config can now be
   * validated against the registry instead of trusting the string.
   */
  command: readonly string[];
  title: string;
  /** One-line capability summary — CLI group help, MCP tool description. */
  summary: string;
  /**
   * What KIND of question this gate answers. See `GATE_CATEGORIES`.
   *
   * Deliberately separate from the plugin a gate ships in. A plugin is a unit
   * of distribution — it is where the code lives and what a project installs.
   * A category is a unit of meaning: `check crater` ships in `vlmkit-capture`
   * because that is where the Crater client is, and it is `infrastructure`
   * because that is the question it answers. One plugin may hold gates in
   * several categories, and one category spans plugins — so collapsing the two
   * would force a wrong choice on anyone adding a gate.
   *
   * Optional, and uncategorized gates are listed under "other" rather than
   * rejected: a project's first house gate should not have to pick a taxonomy
   * before it can run.
   */
  category?: GateCategory;
  /** Full `--help` body, minus the shared flags the runner appends. */
  usage?: string;
  /** Rule table. Every `Finding.rule` a gate emits must appear here. */
  rules: readonly RuleDefinition[];
  inputs?: readonly GateInput[];
  /**
   * Parse argv into the gate's options. Throw `UsageError` for bad input —
   * the runner turns that into usage output plus exit 1, so gates stop
   * calling `process.exit` from inside a parser.
   */
  parse: (argv: readonly string[], ctx: GateContext) => Options;
  /** Do the measurement. No printing, no exit codes. */
  run: (options: Options, ctx: GateContext) => Promise<Report> | Report;
  /**
   * Project the report onto the normalized finding list.
   *
   * `options` is passed because a flag can legitimately decide a finding's
   * severity: `check crater --require` promotes an unreachable backend from
   * `info` to `suspect`, which is the whole purpose of the flag. Most gates
   * ignore the second argument.
   */
  findings: (report: Report, options: Options) => readonly Finding[];
  /**
   * Human output. The runner decides whether it is called at all (`--json`).
   *
   * `rules` is how a gate's prose learns what the project's rule settings did. Without
   * it, `--rule x=off` printed `3 finding(s) suppressed by rule settings` and then
   * printed all three anyway, because the prose is rendered from the gate's own report
   * while suppression happens on the normalized finding list. v6's adopting agent hit
   * the re-tuning half of the same gap: "with `component-drift=info` the output still
   * prints `verdict: DRIFT` and still renders the finding with a yellow `!`. […] So the
   * noise I re-tuned away is still in every CI log."
   *
   * Optional, and a gate that ignores it renders exactly as before — so this is not a
   * migration all 27 gates must do at once. A gate whose prose lists findings should
   * consult it; one that only prints a summary has nothing to consult it about.
   */
  format: (report: Report, rules?: RuleView) => string;
  /**
   * One line describing what was measured — not what was wrong. The findings
   * already say what was wrong; this says the context needed to read them
   * ("checked 768, 1024px", "3 container(s), page overflow-x 0px").
   *
   * Two consumers need exactly this and cannot get it from `format` (too long)
   * or from the findings (a clean run has none): `verify markup`, which folds
   * other gates into its verdict and names them in its kickback, and the MCP
   * server's one-line verdict. Optional — the runner falls back to the finding
   * counts, which is correct but tells a reader less.
   */
  headline?: (report: Report) => string;
  /**
   * Ledger headline. Returning `null` opts a gate out. The runner does the
   * appending, so `VLMKIT_NO_LEDGER` and failure-swallowing stay in one place.
   */
  ledger?: (report: Report, options: Options) => RunLedgerEntry | null;
}

/** A definition with its type parameters erased, for registries and lists. */
export type AnyGateDefinition = GateDefinition<any, any>;

/**
 * A plugin is a named bundle of gates. Built-in gates ship as plugins too
 * (`vlmkit-markup` exports one), so "add a gate" is the same operation for
 * this repo and for a third party — there is no privileged built-in path.
 */
export interface VlmkitPlugin {
  /** Unique plugin name, reported in conflict errors and `vlmkit rules --plugins`. */
  name: string;
  version?: string;
  gates: readonly AnyGateDefinition[];
}

/** Identity helper that pins the type parameters at the definition site. */
export function defineGate<Report, Options>(
  definition: GateDefinition<Report, Options>,
): GateDefinition<Report, Options> {
  return definition;
}

/** Identity helper for plugin authors; also the documented entry point. */
export function definePlugin(plugin: VlmkitPlugin): VlmkitPlugin {
  return plugin;
}

/** `check integrity` — the human-facing form of `command`. */
export function gateCommandString(gate: AnyGateDefinition): string {
  return gate.command.join(" ");
}

/** Fully-qualified rule reference used in configs: `check.integrity/text-collision`. */
export function ruleRef(gateId: string, ruleId: string): string {
  return `${gateId}/${ruleId}`;
}
