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
 * A gate definition.
 *
 * `Report` is the gate's existing report type — migration wraps the
 * existing `run*` / `format*` functions rather than rewriting them, so the
 * measurement code stays untouched and the diff stays reviewable.
 */
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
  /** Project the report onto the normalized finding list. */
  findings: (report: Report) => readonly Finding[];
  /** Human output. The runner decides whether it is called at all (`--json`). */
  format: (report: Report) => string;
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
