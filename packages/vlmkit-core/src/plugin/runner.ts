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

import { UsageError } from "../cli-error.ts";
import { appendRunLedger } from "../run-ledger.ts";
import { BOLD, CYAN, DIM, GREEN, RED, RESET, YELLOW } from "../terminal-colors.ts";
import type { AnyGateDefinition, Finding, GateContext, GateDefinition } from "./contract.ts";
import { gateCommandString } from "./contract.ts";
import type { AppliedRules, FindingCounts, RuleSettings } from "./rules.ts";
import { RULE_SETTINGS, applyRuleSettings, countFindings } from "./rules.ts";

/** Flags the runner owns. A gate's `parse` never sees these as its own. */
export const SHARED_GATE_FLAGS = ["--json", "--advisory", "--fail-on-suspect", "--rule", "--rules", "--help", "-h"] as const;

export interface SharedFlags {
  json: boolean;
  advisory: boolean;
  help: boolean;
  /** `--rules`: print the gate's rule table and exit without measuring. */
  listRules: boolean;
  /** `--rule <ref>=<setting>`, repeatable — a one-off override for this run. */
  ruleOverrides: RuleSettings;
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
  return {
    json: argv.includes("--json"),
    advisory: argv.includes("--advisory"),
    help: argv.includes("--help") || argv.includes("-h"),
    listRules: argv.includes("--rules"),
    ruleOverrides,
  };
}

/** Drop the runner-owned flags so a gate's parser never has to know them. */
export function stripSharedFlags(argv: readonly string[]): string[] {
  const out: string[] = [];
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i]!;
    if (arg === "--rule") {
      i++; // also drop its value
      continue;
    }
    if ((SHARED_GATE_FLAGS as readonly string[]).includes(arg)) continue;
    out.push(arg);
  }
  return out;
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
  const shared = parseSharedFlags(argv);
  const gateArgv = stripSharedFlags(argv);
  const ctx: GateContext = { cwd, argv: gateArgv, json: shared.json };
  const parsed = gate.parse(gateArgv, ctx);
  const report = await gate.run(parsed, ctx);

  const settings: RuleSettings = { ...options.rules, ...shared.ruleOverrides };
  const rules = applyRuleSettings(gate, gate.findings(report, parsed), settings);
  const counts = countFindings(rules.findings);
  const verdict = counts.suspect > 0 ? "fail" : "pass";

  if (options.ledger !== false && gate.ledger) {
    const entry = gate.ledger(report, parsed);
    if (entry) appendRunLedger(entry, cwd);
  }

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
      },
      null,
      2,
    )
    : [gate.format(report), formatRuleNotes(gate, rules)].filter(Boolean).join("\n");

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
  };
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
  lines.push("  --advisory              Print findings but exit 0 (default: a suspect exits 1)");
  lines.push("  --rule <ref>=<setting>  Re-tune or disable one rule (off|suspect|warn|info), repeatable");
  lines.push("  --rules                 List this gate's rules and exit");
  // Listed rather than hidden: it appears in published docs and in scripts, so
  // a reader who finds it needs to be told it no longer does anything — the
  // failing default it used to opt into is now the default.
  lines.push("  --fail-on-suspect       Accepted no-op (a suspect already exits 1)");
  lines.push("  -h, --help              Show this help");
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
  out(outcome.text);
  return outcome.exitCode;
}

/** One-line verdict for aggregate runners (`verify markup`, `batch`, MCP). */
export function formatGateVerdict(outcome: GateOutcome): string {
  const state = outcome.verdict === "pass" ? `${GREEN}ok${RESET}` : `${RED}${outcome.counts.suspect} suspect${RESET}`;
  const warns = outcome.counts.warn > 0 ? `, ${outcome.counts.warn} warn` : "";
  return `${outcome.command}: ${state}${warns}`;
}
