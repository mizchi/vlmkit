/**
 * `@mizchi/vlmkit-core/plugin` — the whole surface a gate plugin needs.
 *
 * A third-party gate has always been able to exist: `defineGate` and
 * `definePlugin` are exported, `vlmkit.config.json` takes a `"plugins"` array,
 * and a plugin's gate gets the same `--help`, `--json`, rule settings, ledger
 * and exit-code contract as `check integrity`. What was missing is a *declared*
 * entry point. An author had to deep-import five internal files
 * (`plugin/contract.ts`, `page-load.ts`, `arg-reader.ts`, `cli-error.ts`,
 * `terminal-colors.ts`) and guess which of them counted as public.
 *
 * Those five are exactly what the 27 bundled gates import — counted, not
 * guessed: 40 imports of the contract, 18 of `page-load`, 15 of `arg-reader`,
 * 11 of `cli-error`, 1 of `terminal-colors`. So this module re-exports that set
 * and nothing else. If a plugin needs something absent here, that is a gap in
 * this file worth reporting rather than a reason to reach past it.
 *
 * ```ts
 * import {
 *   defineGate, definePlugin, firstPositional, readInt,
 *   PAGE_LOAD_INPUTS, parsePageLoad, UsageError, DIM, RESET,
 * } from "@mizchi/vlmkit-core/plugin";
 * ```
 *
 * ## The four functions
 *
 * A gate is a declaration plus four functions, and the split is what keeps the
 * contract enforceable:
 *
 *   - `parse(argv, ctx)` — argv to your own options type. Throw `UsageError`.
 *   - `run(options, ctx)` — the measurement. Returns YOUR report shape.
 *   - `findings(report, options)` — project the report onto `Finding[]`. The one
 *     place per-rule work happens, so the runner can suppress and re-tune.
 *   - `format(report, rules?)` — the prose. `rules` is a `RuleView`: ask
 *     `effective(ruleId)` what a rule is worth *now* rather than re-deriving the
 *     runner's decisions and risking disagreement with them.
 *
 * What a gate deliberately cannot do: print, set an exit code, decide `--json`,
 * or write the ledger. The runner owns all four. A gate that printed would break
 * `--json` for every consumer downstream of it.
 *
 * ## Rules are declared, so they are addressable
 *
 * Every `Finding.rule` must appear in the gate's `rules` table. That is what
 * makes `--rule <gateId>/<ruleId>=off|warn|info|suspect`, `vlmkit rules`, and
 * `vlmkit.gates.json`'s per-page settings work for a plugin gate on day one. An
 * undeclared rule id cannot be documented or configured, so the runner reports
 * it as a gate bug.
 *
 * See `docs/authoring-gates.md` for the field-by-field walkthrough and
 * `examples/gate-plugin/` for a runnable two-gate plugin that imports only this
 * module.
 */

/**
 * The plugin API's compatibility marker.
 *
 * Bumped only when a change would break an existing plugin — a required field
 * added to `GateDefinition`, a callback's arguments changed, a helper removed.
 * Additive changes (a new optional field, a new export here) do not bump it.
 *
 * A plugin may assert against it to fail with its own message rather than a
 * `TypeError` three frames into the registry:
 *
 * ```ts
 * import { PLUGIN_API_VERSION } from "@mizchi/vlmkit-core/plugin";
 * if (PLUGIN_API_VERSION !== 1) throw new Error("built for plugin API 1");
 * ```
 */
export const PLUGIN_API_VERSION = 1 as const;

// The contract itself.
export {
  FINDING_SEVERITIES,
  GATE_CATEGORIES,
  GATE_CATEGORY_ORDER,
  defineGate,
  definePlugin,
  gateCommandString,
  ruleRef,
} from "./contract.ts";
export type {
  AnyGateDefinition,
  Finding,
  FindingSeverity,
  GateCategory,
  GateContext,
  GateDefinition,
  GateInput,
  RuleDefinition,
  RuleView,
  VlmkitPlugin,
} from "./contract.ts";

// Rule settings, for a plugin that wants to reason about them itself.
export type { AppliedRules, RuleSetting, RuleSettingEntry, RuleSettings } from "./rules.ts";
export { RULE_SETTINGS } from "./rules.ts";

/**
 * Page-load flags, for a gate that navigates.
 *
 * Spread `PAGE_LOAD_INPUTS` into `inputs` and call `parsePageLoad(argv)` in
 * `parse`. Declaring your own `--timeout` instead is the mistake that made
 * `--wait-until` silently ineffective on three bundled gates: the flag parsed,
 * and the navigation used a hand-rolled default anyway.
 */
export {
  DEFAULT_PAGE_LOAD_TIMEOUT_MS,
  DEFAULT_PAGE_LOAD_WAIT_UNTIL,
  PAGE_LOAD_INPUTS,
  PAGE_LOAD_VALUE_FLAGS,
  PAGE_LOAD_WAIT_UNTIL,
  navigationOptions,
  parsePageLoad,
  pickPageLoad,
} from "../page-load.ts";
export type { PageLoadOptions, PageLoadWaitUntil } from "../page-load.ts";

// argv reading — the primitives.
export {
  hasFlag,
  readAll,
  readChoice,
  readFlag,
  readInt,
  readNumber,
  readPositionals,
  tokenizeCommand,
} from "../arg-reader.ts";

/**
 * The shapes `arg-reader` does not cover, `firstPositional` above all — the
 * first line of almost every gate's `parse`.
 *
 * These lived in `vlmkit-markup/src/gates/arg-helpers.ts` until v7. Every one is
 * pure and imports nothing but core, so a plugin author reaching for
 * `firstPositional` was taking a dependency on the markup package to read argv.
 * `runOutputDir` is here for the same reason: two pages gated in a row must not
 * write `report.md` into one directory, and that is not a per-gate decision.
 */
export {
  firstPositional,
  firstPositionalOrUndefined,
  numberList,
  numberListFloat,
  optionalInt,
  runOutputDir,
  viewportFlag,
  vlmFlag,
  withoutOptionalValue,
} from "./args.ts";

/**
 * "Was this module run, or imported?" — the guard that lets a command module be
 * imported at all. Thirty modules here hand-rolled it, and eleven had no guard, so
 * importing one ran the command.
 */
export { isCliEntry } from "./cli-entry.ts";

/**
 * `UsageError` — the only error a gate should throw for bad input.
 *
 * The CLI prints it as one line with no stack trace, because the message
 * already names the flag and the fix and a trace only buries it.
 */
export { UsageError } from "../cli-error.ts";

// Colours, so a plugin's prose matches the bundled gates rather than inventing
// its own palette.
export { BOLD, CYAN, DIM, GREEN, RED, RESET, YELLOW, hr } from "../terminal-colors.ts";

/**
 * Project paths and env reading, for a gate with a default a project should set
 * once (a budget, a house palette) rather than repeat on every invocation, or
 * that needs somewhere under `.vlmkit/` to keep state.
 */
export { CONFIG_CANDIDATES, CONFIG_FILE, STATE_DIR, debugEnabled, readEnv, resolveStatePath } from "../project-config.ts";
