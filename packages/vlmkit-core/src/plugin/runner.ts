/**
 * The core gate runner — the part every gate stopped having to write.
 *
 * Measured on this repo before the plugin contract existed: 20 gate modules
 * had their own `parseArgs`, 22 their own `printUsage`, 22 called
 * `appendRunLedger` by hand, and only 6 used `applyGateExit`. The
 * consequences were not cosmetic. `check breakpoints` called
 * `process.exit(1)` directly, which truncates buffered stdout — the reason
 * `applyGateExit` exists. `check integrity` had no `--advisory` at all,
 * so the one gate most likely to be piloted before it gates CI was the one
 * gate that could not be. Two commands in the same group disagreed about
 * whether a finding should fail the command.
 *
 * So the runner owns the whole envelope: help, `--json`, `--advisory`, rule
 * settings, the ledger write, the verdict, the exit code. A gate contributes
 * measurement (`run`), projection (`findings`), and prose (`format`) — and
 * nothing else. What a gate cannot do is disagree with the contract.
 */

import { relative } from "node:path";
import { UsageError } from "../cli-error.ts";
import { GATE_EXIT_HELP } from "../gate-exit.ts";
import { authStateNotice, resetAuthStateNotice } from "../auth-state.ts";
import type { LedgerWrite } from "../run-ledger.ts";
import {
  LEDGER_RELATIVE_PATH,
  VLMKIT_IGNORE_ENTRIES,
  appendRunLedger,
  configureRunLedger,
  firstLedgerWrite,
  isGitIgnored,
  isGitRepo,
} from "../run-ledger.ts";
import { BOLD, CYAN, DIM, GREEN, RED, RESET, YELLOW } from "../terminal-colors.ts";
import type { AnyGateDefinition, Finding, GateContext, GateDefinition } from "./contract.ts";
import { gateCommandString } from "./contract.ts";
import type { AppliedRules, FindingCounts, RuleSettings } from "./rules.ts";
import { RULE_SETTINGS, applyRuleSettings, countFindings, resolveRules } from "./rules.ts";

/** Flags the runner owns. A gate's `parse` never sees these as its own. */
export const SHARED_GATE_FLAGS = [
  "--json",
  "--advisory",
  "--fail-on-suspect",
  "--rule",
  "--rules",
  "--timing",
  "--ledger",
  "--no-ledger",
  "--help",
  "-h",
] as const;

export interface SharedFlags {
  json: boolean;
  advisory: boolean;
  help: boolean;
  /** `--rules`: print the gate's rule table and exit without measuring. */
  listRules: boolean;
  /** `--rule <ref>=<setting>`, repeatable — a one-off override for this run. */
  ruleOverrides: RuleSettings;
  /**
   * `--timing`: include the per-phase breakdown in the output.
   *
   * Opt-in rather than always-on because the numbers differ every run, and
   * `--json` is a contract other tools diff and cache against.
   */
  timing: boolean;
  /**
   * `--ledger <path>`: where the append-only run record goes. It defaulted to
   * `.vlmkit/run-ledger.jsonl` with no flag at all and nothing announcing it,
   * so the only ways to find it were `ls` and reading the source — which is how
   * v6's adopting agent found it.
   */
  ledgerPath?: string;
  /** `--no-ledger`: the flag form of VLMKIT_NO_LEDGER=1. */
  noLedger: boolean;
}

/**
 * Read the shared flags. `--fail-on-suspect` is still accepted and still
 * does nothing: it was the documented way to opt *into* failing before
 * failing became the default, and scripts in the wild still pass it.
 */
export function parseSharedFlags(argv: readonly string[]): SharedFlags {
  const ruleOverrides: Record<string, RuleSettings[string]> = {};
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] !== "--rule") continue;
    const spec = argv[i + 1];
    if (spec === undefined || spec.startsWith("--")) throw new UsageError("--rule needs <ruleRef>=<off|suspect|warn|info>");
    const eq = spec.lastIndexOf("=");
    if (eq <= 0) throw new UsageError(`--rule expects <ruleRef>=<setting>, got ${JSON.stringify(spec)}`);
    const ref = spec.slice(0, eq).trim();
    const setting = spec.slice(eq + 1).trim();
    if (!(RULE_SETTINGS as readonly string[]).includes(setting)) {
      throw new UsageError(`--rule ${ref}: setting must be one of ${RULE_SETTINGS.join(", ")}, got ${JSON.stringify(setting)}`);
    }
    ruleOverrides[ref] = setting as RuleSettings[string];
  }
  const ledgerAt = argv.indexOf("--ledger");
  if (ledgerAt >= 0) {
    const value = argv[ledgerAt + 1];
    if (value === undefined || value.startsWith("--")) throw new UsageError("--ledger needs a path");
  }
  return {
    json: argv.includes("--json"),
    advisory: argv.includes("--advisory"),
    help: argv.includes("--help") || argv.includes("-h"),
    listRules: argv.includes("--rules"),
    timing: argv.includes("--timing"),
    ...(ledgerAt >= 0 ? { ledgerPath: argv[ledgerAt + 1] } : {}),
    noLedger: argv.includes("--no-ledger"),
    ruleOverrides,
  };
}

/** Drop the runner-owned flags so a gate's parser never has to know them. */
export function stripSharedFlags(argv: readonly string[]): string[] {
  const out: string[] = [];
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i]!;
    if (arg === "--rule" || arg === "--ledger") {
      i++; // also drop its value
      continue;
    }
    if ((SHARED_GATE_FLAGS as readonly string[]).includes(arg)) continue;
    out.push(arg);
  }
  return out;
}

/**
 * A `--rule` that names THIS gate and a rule it does not have is a typo, and a
 * typo that silences nothing is precisely the failure rule settings exist to
 * remove — so it fails the run instead of being ignored.
 *
 * Only that exact shape is checked. A key naming another gate, or a bare rule
 * id, must pass silently: `vlmkit gates` appends every `--rule` flag from
 * `defaults.rules` to every job, so a gate legitimately receives references
 * meant for its neighbours. Registry-wide validation of the config is
 * `validateRuleSettings`'s job, where the whole catalog is in view.
 */
function assertKnownRuleOverrides(gate: AnyGateDefinition, overrides: RuleSettings): void {
  const prefix = `${gate.id}/`;
  for (const key of Object.keys(overrides)) {
    if (!key.startsWith(prefix)) continue;
    const ruleId = key.slice(prefix.length);
    if (ruleId === "*" || gate.rules.some((rule) => rule.id === ruleId)) continue;
    throw new UsageError(
      `--rule ${key}: ${gate.id} has no rule "${ruleId}".`
      + ` Known: ${gate.rules.map((rule) => rule.id).join(", ")}`,
    );
  }
}

/**
 * Wall-clock ms per contract phase.
 *
 * The split exists to answer "where does a gate's time actually go", and the
 * answer shapes how a ruleset should be tuned. `run` is one measurement shared
 * by every rule the gate declares; `findings` is the only phase where per-rule
 * work happens, and it is a projection over an in-memory report. So the cost
 * unit is the **gate**, not the rule — which is exactly why `--rule x=off`
 * cannot make a run faster, and why `vlmkit bench gates` reports *attributed*
 * per-rule cost rather than pretending each rule was timed on its own.
 *
 * Always collected: five `performance.now()` reads are far below the noise
 * floor of a browser launch. Reported only when asked, because a timing field
 * is nondeterministic and `--json` has to stay byte-stable for equal inputs.
 */
export interface GateTiming {
  parseMs: number;
  runMs: number;
  /** `gate.findings` — the projection. Per-rule work lives here. */
  findingsMs: number;
  /** `applyRuleSettings` — suppression and re-tuning. */
  rulesMs: number;
  /** `gate.format`, or the JSON serialization when `--json` is set. */
  formatMs: number;
  ledgerMs: number;
  /** Everything above plus the runner's own overhead. */
  totalMs: number;
}

export interface GateOutcome<Report = unknown> {
  gateId: string;
  command: string;
  /** `fail` when a suspect survived rule settings; `--advisory` does not change it. */
  verdict: "pass" | "fail";
  report: Report;
  findings: readonly Finding[];
  counts: FindingCounts;
  rules: AppliedRules;
  /** Exit code the caller should adopt — `--advisory` is applied here. */
  exitCode: 0 | 1;
  /** Rendered output (prose or JSON), ready to write. */
  text: string;
  timing: GateTiming;
  /**
   * The run-ledger append, or `null` when the ledger is off or the gate declares
   * none. Surfaced so the CLI can announce a file it just brought into existence
   * instead of leaving it to be found with `ls`.
   */
  ledgerWrite: LedgerWrite | null;
}

export interface RunGateOptions {
  cwd?: string;
  /** Project-level rule settings; `--rule` overrides win over these. */
  rules?: RuleSettings;
  /** Set false to skip the ledger append (batch runs, tests). */
  ledger?: boolean;
}

/**
 * Run one gate end to end and return what happened. Deliberately does not
 * print or set `process.exitCode` — `runGateCli` does that, and tests get to
 * assert on an object instead of scraping stdout.
 */
export async function runGate<Report, Options>(
  gate: GateDefinition<Report, Options>,
  argv: readonly string[],
  options: RunGateOptions = {},
): Promise<GateOutcome<Report>> {
  const cwd = options.cwd ?? process.cwd();
  const t0 = performance.now();
  const shared = parseSharedFlags(argv);
  const gateArgv = stripSharedFlags(argv);
  const ctx: GateContext = { cwd, argv: gateArgv, json: shared.json };

  // BEFORE `gate.run`, because most ledger writes happen inside the measurement
  // functions rather than through the `gate.ledger` hook — 14 of the 16 call
  // sites. Configuring after would leave `--ledger`/`--no-ledger` honoured by the
  // hook and ignored by everything else.
  configureRunLedger({
    cwd,
    ...(shared.ledgerPath ? { path: shared.ledgerPath } : {}),
    ...(shared.noLedger ? { disabled: true } : {}),
  });
  // Same reason, same place: `withAuthState` records the session it applied from
  // inside the measurement, and a stale value from a previous gate in the same
  // process would make this one claim an authentication it never used.
  resetAuthStateNotice();

  const tParse = performance.now();
  const parsed = gate.parse(gateArgv, ctx);
  const tRun = performance.now();
  const report = await gate.run(parsed, ctx);
  const tFindings = performance.now();

  const settings: RuleSettings = { ...options.rules, ...shared.ruleOverrides };
  assertKnownRuleOverrides(gate, shared.ruleOverrides);
  const projected = gate.findings(report, parsed);
  const tRules = performance.now();
  const rules = applyRuleSettings(gate, projected, settings);
  const counts = countFindings(rules.findings);
  const verdict = counts.suspect > 0 ? "fail" : "pass";
  const tLedger = performance.now();

  if (options.ledger !== false && gate.ledger) {
    const entry = gate.ledger(report, parsed);
    if (entry) appendRunLedger(entry);
  }
  // Whichever call site got there first — the hook above or a direct append from
  // inside `gate.run`. The announcement should not depend on which.
  const ledgerWrite = firstLedgerWrite();
  const tFormat = performance.now();

  // `timing` is opt-in even under --json: it changes on every run, and the
  // envelope has to stay byte-stable for equal inputs so golden-file diffs and
  // cache keys keep working. Callers in-process always get it on the outcome.
  const timing: GateTiming = {
    parseMs: round(tRun - tParse),
    runMs: round(tFindings - tRun),
    findingsMs: round(tRules - tFindings),
    rulesMs: round(tLedger - tRules),
    ledgerMs: round(tFormat - tLedger),
    formatMs: 0,
    totalMs: 0,
  };

  // Prose is rendered first either way, so `formatMs` and `totalMs` hold real
  // numbers by the time the JSON payload is serialized. Under --json the prose
  // is not built at all, and `formatMs` then covers the serialization instead.
  // The view, not the raw AppliedRules: a formatter should ask "what is this rule worth
  // now", not re-derive the runner's decisions and risk disagreeing with them.
  const resolved = resolveRules(gate, settings);
  const ruleView = {
    effective: (ruleId: string) => resolved.decisions.get(ruleId)?.effective
      ?? gate.rules.find((r) => r.id === ruleId)?.severity
      ?? "warn",
  };
  const prose = shared.json ? "" : [gate.format(report, ruleView), formatRuleNotes(gate, rules)].filter(Boolean).join("\n");
  timing.formatMs = round(performance.now() - tFormat);
  timing.totalMs = round(performance.now() - t0);

  const text = shared.json
    ? JSON.stringify(
      {
        gate: gate.id,
        command: gateCommandString(gate),
        verdict,
        counts,
        findings: rules.findings,
        suppressed: rules.suppressed,
        retuned: rules.retuned,
        report,
        ...(shared.timing ? { timing } : {}),
      },
      null,
      2,
    )
    : prose;

  return {
    gateId: gate.id,
    command: gateCommandString(gate),
    verdict,
    report,
    findings: rules.findings,
    counts,
    rules,
    exitCode: verdict === "fail" && !shared.advisory ? 1 : 0,
    text,
    timing,
    ledgerWrite,
  };
}

/** Sub-microsecond precision is noise at this scale and makes tables unreadable. */
function round(ms: number): number {
  return Math.round(ms * 1000) / 1000;
}

/**
 * Suppression and re-tuning are reported, never silent — the same reason
 * `check integrity` prints its exemptions and `gates suppressions` exists.
 * A gate that passes because three rules were turned off must say so on the
 * same screen as the verdict.
 */
export function formatRuleNotes(gate: AnyGateDefinition, applied: AppliedRules): string {
  const lines: string[] = [];
  if (applied.suppressed.length > 0) {
    const byRule = new Map<string, number>();
    for (const s of applied.suppressed) byRule.set(s.finding.rule, (byRule.get(s.finding.rule) ?? 0) + 1);
    lines.push("");
    lines.push(
      `${YELLOW}${applied.suppressed.length} finding(s) suppressed by rule settings${RESET}`
      + ` ${DIM}(${[...byRule].map(([rule, n]) => `${rule} x${n}`).join(", ")})${RESET}`,
    );
  }
  if (applied.retuned.length > 0) {
    const byRule = new Map<string, RetuneNote>();
    for (const r of applied.retuned) byRule.set(r.finding.rule, { from: r.from, to: r.to });
    lines.push(
      `${DIM}re-tuned: ${[...byRule].map(([rule, n]) => `${rule} ${n.from}->${n.to}`).join(", ")}${RESET}`,
    );
  }
  if (applied.undeclared.length > 0) {
    // A gate bug, surfaced where the gate's author will see it: an
    // undeclared rule cannot be documented or configured.
    lines.push("");
    lines.push(
      `${RED}${gate.id} emitted undeclared rule id(s): ${applied.undeclared.join(", ")}${RESET}`
      + ` ${DIM}— add them to the gate's rules table.${RESET}`,
    );
  }
  return lines.join("\n");
}

interface RetuneNote {
  from: Finding["severity"];
  to: Finding["severity"];
}

/** `vlmkit <gate> --rules` — the tunable surface, without measuring anything. */
export function formatRuleTable(gate: AnyGateDefinition): string {
  const lines: string[] = [];
  lines.push("");
  lines.push(`${BOLD}${CYAN}${gateCommandString(gate)}${RESET} ${DIM}${gate.id}${RESET}`);
  lines.push("");
  lines.push(`${gate.rules.length} rule(s). Tune with ${DIM}--rule ${gate.id}/<id>=<off|suspect|warn|info>${RESET}`);
  lines.push(`or in ${DIM}vlmkit.gates.json${RESET} under ${DIM}"rules"${RESET}.`);
  lines.push("");
  const width = Math.max(...gate.rules.map((r) => r.id.length));
  for (const rule of gate.rules) {
    const severity = rule.severity === "suspect" ? `${RED}suspect${RESET}` : rule.severity === "warn" ? `${YELLOW}warn${RESET}` : `${DIM}info${RESET}`;
    lines.push(`  ${rule.id.padEnd(width)}  ${severity.padEnd(16)} ${rule.title}`);
    if (rule.docs) lines.push(`  ${" ".repeat(width)}  ${DIM}${rule.docs}${RESET}`);
  }
  return lines.join("\n");
}

/**
 * Help text, composed from the definition. The shared-flag block is appended
 * here rather than copied into every gate's usage string, which is how the
 * `--advisory` contract drifted out of `check integrity` in the first place.
 */
export function formatGateHelp(gate: AnyGateDefinition): string {
  const lines: string[] = [];
  const positionals = (gate.inputs ?? [])
    .filter((i) => i.positional !== undefined)
    .sort((a, b) => a.positional! - b.positional!)
    .map((i) => (i.required === false ? `[${i.placeholder ?? i.name}]` : `<${i.placeholder ?? i.name}>`))
    .join(" ");
  lines.push(`Usage: vlmkit ${gateCommandString(gate)}${positionals ? ` ${positionals}` : ""} [options]`);
  lines.push("");
  lines.push(gate.usage?.trim() || gate.summary);
  const flags = (gate.inputs ?? []).filter((i) => i.positional === undefined);
  if (flags.length > 0) {
    lines.push("");
    lines.push("Options:");
    const width = Math.max(...flags.map((f) => flagLabel(f).length), 22);
    for (const flag of flags) {
      const suffix = flag.defaultDescription ? ` (default: ${flag.defaultDescription})` : "";
      lines.push(`  ${flagLabel(flag).padEnd(width)}  ${flag.description}${suffix}`);
    }
  }
  lines.push("");
  lines.push("Shared options (every gate):");
  lines.push("  --json                  Print the JSON report");
  // `GATE_EXIT_HELP`, not a copy of it. The constant exists so every gate documents
  // the exit-code contract identically, and this — its only call site — held a
  // byte-identical duplicate instead, which is precisely the divergence it was
  // introduced to prevent.
  lines.push(GATE_EXIT_HELP);
  lines.push("  --rule <ref>=<setting>  Re-tune or disable one rule (off|suspect|warn|info), repeatable");
  lines.push("  --rules                 List this gate's rules and exit");
  lines.push("  --timing                Add the per-phase ms breakdown to the output");
  // The ledger wrote to the repo with no flag and no mention anywhere in any output,
  // which made it findable only by `ls` — v6's adopting agent found it that way and
  // wrote the `.gitignore` by hand. Declaring the write is half the fix; being able
  // to move it or refuse it is the other half.
  lines.push(`  --ledger <path>         Where to append the run record (default: ${LEDGER_RELATIVE_PATH})`);
  lines.push("  --no-ledger             Do not write the run record at all");
  // Listed rather than hidden: it appears in published docs and in scripts, so
  // a reader who finds it needs to be told it no longer does anything — the
  // failing default it used to opt into is now the default.
  lines.push("  --fail-on-suspect       Accepted no-op (a suspect already exits 1)");
  lines.push("  -h, --help              Show this help");
  // Every gate's help said how to persist a *rule setting* and nothing about the
  // flags above it, so a fix that lived in a flag read as unrepeatable. v4's repair
  // agent, who reached green with two `--allow` declarations: "my fix lives in a
  // shell command that a CI job would have to duplicate. I do not know whether an
  // exemption can be committed alongside the page, and the output does not say." It
  // can — a `"gates"` entry is a full command, tokenized quote-aware — which makes
  // this a documentation gap rather than a missing feature.
  lines.push("");
  lines.push("Persisting: a `\"gates\"` entry in vlmkit.gates.json is the whole command, so any");
  lines.push("flag above belongs there and is committed with the page. Quoted values survive:");
  lines.push(`  "gates": ["${gateCommandString(gate)} --some-flag \\"a value with spaces\\""]`);
  lines.push("Rule settings also have their own `\"rules\"` block.");
  return lines.join("\n");
}

function flagLabel(input: NonNullable<AnyGateDefinition["inputs"]>[number]): string {
  // `placeholder` wins for flags too: the documented usage says
  // `--manifest <file>` and `--frames <dir>`, which tell a reader more than
  // the generic `<path>` the kind would produce.
  const value = input.kind === "boolean"
    ? ""
    : input.placeholder
      ? ` <${input.placeholder}>`
      : input.kind === "number"
        ? " <n>"
        : input.kind === "number-list" || input.kind === "string-list"
          ? " <list>"
          : input.kind === "path" || input.kind === "path-or-url"
            ? " <path>"
            : input.choices
              ? ` <${input.choices.join("|")}>`
              : " <value>";
  return `--${input.name}${value}${input.repeatable ? " (repeatable)" : ""}`;
}

export interface GateCliIo {
  out?: (text: string) => void;
  err?: (text: string) => void;
}

/**
 * A gate's own headline line, which the runner may annotate.
 *
 * Every gate opens its prose with `verdict:` or `status:`. That convention is already
 * load-bearing elsewhere — `batch-cli`'s `gateReported()` uses exactly this pattern to
 * tell "the gate measured the page" from "the gate never ran" — so formalizing it here
 * is recognising a contract rather than inventing one.
 */
const VERDICT_LINE = /^\s*(?:\u001B\[[0-9;]*m)*(verdict|status):/;

/**
 * Put `line` directly under the gate's verdict line.
 *
 * Falls back to appending when a gate has no such line, so a gate that does not follow
 * the convention keeps the previous behaviour instead of losing the annotation. This is
 * the one place the runner touches gate-owned prose, which is why it is a single
 * insertion at a documented anchor rather than a rewrite.
 */
export function withExitIntent(text: string, line: string): string {
  const lines = text.split("\n");
  const at = lines.findIndex((l) => VERDICT_LINE.test(l));
  if (at < 0) return `${text}\n${line}`;
  return [...lines.slice(0, at + 1), line, ...lines.slice(at + 1)].join("\n");
}

/**
 * Is this run measuring a live URL that nothing has pinned?
 *
 * v5's CI agent was asked whether a run was reproducible and had to answer it by
 * writing a jitter server and diffing outputs itself: "No gate says its input was
 * unpinned. Four gates hit a live URL and returned verdicts with nothing indicating a
 * re-run could differ."
 *
 * The runner can tell, from what it already has: the gate declares `--har` (so pinning
 * is available for it), argv names an http(s) source, and no `--har` was passed. Said
 * once per run rather than measured — the agent asked for `--repeat 2 --require-stable`,
 * but the question it was actually answering is "could this differ", and that is
 * decidable without running anything twice.
 */
export function unpinnedLiveInput(gate: AnyGateDefinition, argv: readonly string[]): string | null {
  const acceptsHar = (gate.inputs ?? []).some((input) => input.name === "har");
  if (!acceptsHar || argv.includes("--har")) return null;
  const url = argv.find((arg) => /^https?:\/\//.test(arg));
  if (!url) return null;
  return `${DIM}  ${url} is live and not pinned — a re-run may measure different data.`
    + ` Pin it: vlmkit snapshot record-har ${url} --out app.har, then --har app.har${RESET}`;
}

/**
 * Announce a file this run brought into existence in an un-ignored spot.
 *
 * The run ledger has always been written to `.vlmkit/run-ledger.jsonl` with no
 * flag, no mention in any output, and an env-var opt-out. v6's adopting agent:
 * "adopting the tool dirtied the repo silently. `--output` covers stdout logs;
 * `test-results/` and `.vlmkit/run-ledger.jsonl` have no flag and nothing
 * announces them. The agent found them with `ls` and wrote the `.gitignore`
 * itself." The gates that write reports already print `report: <path>`; the
 * ledger was the one genuinely silent write.
 *
 * Only on CREATION, and only when the path is not already ignored. A line on
 * every run would be noise on a file that gets one appended line per gate, and
 * the moment worth reporting is the moment the repo changed shape.
 */
export function newOutputNotice(write: LedgerWrite | null, cwd: string): string | null {
  if (!write?.created) return null;
  if (!isGitRepo(cwd) || isGitIgnored(cwd, write.path)) return null;
  const rel = relative(cwd, write.path).split("\\").join("/") || write.path;
  // A relocated ledger gets advice about ITSELF. Printing the canned pair after
  // `--ledger runs/x.jsonl` would name two directories the run did not write and
  // omit the one it did — advice that does not apply is worse than none.
  const entries = rel === LEDGER_RELATIVE_PATH.split("\\").join("/")
    ? [...VLMKIT_IGNORE_ENTRIES]
    : [rel];
  return [
    `${DIM}  created ${rel} — an append-only record of every gate run, one line each.${RESET}`,
    `${DIM}  It is not in .gitignore. Ignore it${entries.length > 1 ? " (`vlmkit gates init` writes these)" : ""}:${RESET}`,
    ...entries.map((entry) => `${DIM}    ${entry}${RESET}`),
    `${DIM}  Or move it with --ledger <path>, or turn it off with --no-ledger.${RESET}`,
  ].join("\n");
}

/**
 * CLI adapter: handle `--help` / `--rules`, run the gate, write the output,
 * return the exit code. A migrated gate's whole `main()` becomes one call.
 */
export async function runGateCli<Report, Options>(
  gate: GateDefinition<Report, Options>,
  argv: readonly string[],
  options: RunGateOptions & GateCliIo = {},
): Promise<0 | 1> {
  const out = options.out ?? ((text: string) => console.log(text));
  const shared = parseSharedFlags(argv);
  if (shared.help) {
    out(formatGateHelp(gate));
    return 0;
  }
  if (shared.listRules) {
    out(formatRuleTable(gate));
    return 0;
  }
  const outcome = await runGate(gate, argv, options);
  // Say when warns did not fail the command, and name the flag that makes one fail.
  //
  // A dogfood agent working to a "these gates exit 0" criterion nearly shipped the very
  // defect it was sent to fix: "`check animation` exits 0 while printing `settle: never
  // (infinite animation)`. That is verbatim the reported bug […] demoted to `warn`. Had
  // I trusted the success criterion I'd have shipped it broken. There is
  // `--fail-on-suspect` (documented as `Accepted no-op`) but no `--fail-on-warn`."
  //
  // The escalation existed the whole time — `--rule <id>=suspect` exits 1 — and was
  // findable only by reading the rule-settings docs. A passing run that is hiding a warn
  // should say so on the spot, not in a document.
  //
  // Placed under the VERDICT rather than appended, because appending was not enough. A
  // later agent hit the same ambiguity from the other side: "`verdict: DRIFT` (yellow) +
  // exit 0 is a coin-flip in CI. The only line that resolves it […] is the last line,
  // below the findings." The distance was the defect, not the absence.
  if (outcome.exitCode === 0 && outcome.counts.warn > 0 && !shared.json) {
    const ids = [...new Set(outcome.findings.filter((f) => f.severity === "warn").map((f) => f.rule))];
    out(withExitIntent(
      outcome.text,
      `${DIM}  exits 0 — ${outcome.counts.warn} warn(s) did not fail this command.`
      + ` To gate on one: --rule ${ids[0]}=suspect${ids.length > 1 ? ` (also: ${ids.slice(1).join(", ")})` : ""}${RESET}`,
    ));
  } else {
    out(outcome.text);
  }
  // Provenance, not verdict — so it goes after the report rather than competing with
  // the exit-intent line for the space under the verdict.
  if (!shared.json) {
    const unpinned = unpinnedLiveInput(gate, argv);
    if (unpinned) out(unpinned);
    const created = newOutputNotice(outcome.ledgerWrite, options.cwd ?? process.cwd());
    if (created) out(created);
    // Whether the measurement was authenticated is provenance too, and it is the
    // piece a reader cannot recover from the report: `VLMKIT_STORAGE_STATE` puts no
    // flag on the command line, so without this line "the dashboard" and "the login
    // wall it redirected to" look identical.
    const auth = authStateNotice();
    if (auth) out(`  ${DIM}${auth}${RESET}`);
  }
  // Under --json the breakdown is already inside the envelope; appending it to
  // stdout as prose would put non-JSON on a stream a client is parsing.
  if (shared.timing && !shared.json) out(formatGateTiming(outcome));
  return outcome.exitCode;
}

/**
 * The phase breakdown as one block.
 *
 * Shows `run` as a share of the total because that share is the actionable
 * number: it says whether a slow gate is slow at measuring (nothing to tune
 * but the page) or slow at everything else (a formatter doing real work — the
 * defect `formatA11yTouchReport` had, where a "formatter" ran a policy).
 */
export function formatGateTiming(outcome: GateOutcome): string {
  const t = outcome.timing;
  const share = t.totalMs > 0 ? (t.runMs / t.totalMs) * 100 : 0;
  const row = (label: string, ms: number) =>
    `  ${label.padEnd(10)} ${`${ms.toFixed(1)}ms`.padStart(9)}`;
  return [
    "",
    `${BOLD}${CYAN}timing${RESET} ${DIM}${outcome.command}${RESET}`,
    row("parse", t.parseMs),
    `${row("run", t.runMs)}  ${DIM}${share.toFixed(1)}% of total — the measurement, shared by every rule${RESET}`,
    `${row("findings", t.findingsMs)}  ${DIM}the projection; the only per-rule phase${RESET}`,
    row("rules", t.rulesMs),
    row("format", t.formatMs),
    row("ledger", t.ledgerMs),
    `  ${BOLD}${"total".padEnd(10)}${`${t.totalMs.toFixed(1)}ms`.padStart(9)}${RESET}`,
  ].join("\n");
}

