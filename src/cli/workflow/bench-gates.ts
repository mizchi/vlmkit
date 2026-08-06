/**
 * `vlmkit bench gates` — where a ruleset actually spends its time.
 *
 * The question this answers is "which gates and rules is my CI paying for, and
 * what is each one buying?" — so it reports cost *and* yield, because either
 * one alone is unactionable. A gate that takes 8s and finds real defects on
 * every page is worth 8s; a gate that takes 8s and has never fired on any page
 * in the corpus is 8s of nothing.
 *
 * ## What "per-rule efficiency" can and cannot mean here
 *
 * A gate performs ONE measurement (`run`) and then projects it onto findings
 * (`findings`). Every rule the gate declares reads that same report. So rules
 * are not separately executed and cannot be separately timed — measured on this
 * repo, `run` is 97-99% of a gate's wall clock and `findings` is under a
 * millisecond.
 *
 * That is a fact about the architecture, not a gap in the instrument, and two
 * consequences follow that a reader will otherwise guess wrong:
 *
 *   1. **Turning a rule off does not make a run faster.** Rule settings are
 *      applied to the findings *after* the measurement, by design — a silenced
 *      finding is still reported as silenced. `--probe-suppression` measures
 *      this rather than asserting it: it runs the slowest gate with every rule
 *      off and shows the delta, which is noise.
 *   2. **The cost unit is the gate.** To spend less, drop a gate or narrow its
 *      inputs (fewer viewports, no sweep). Pruning rules buys clarity, not time.
 *
 * So per-rule cost here is *attributed*: a run's measurement time is split
 * equally across the rules that fired in it. That is an allocation, and the
 * report labels it as one. It is still the number you want, because it ranks
 * rules by "share of the bill" and puts never-firing rules at zero next to the
 * gate they are riding on.
 *
 * ## Which gates run
 *
 * Derived from each gate's declared `inputs`, not from a list maintained here:
 * a gate runs from a bare page if its positional input is a page
 * (`kind: "path-or-url"`) and nothing else is required. That is 18 of the 26
 * built-ins. `verify markup` needs `--target`, `check equivalence` needs
 * `--target` and `--region`, `check asset` takes a PNG rather than a page — pass
 * `--gate "<command>"` to bench any of those with their arguments.
 */

import { writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { hasFlag, readAll, readFlag, readInt, readPositionals } from "@mizchi/vlmkit-core/arg-reader.ts";
import { UsageError } from "@mizchi/vlmkit-core/cli-error.ts";
import { tokenizeCommand } from "@mizchi/vlmkit-core/arg-reader.ts";
import type { AnyGateDefinition, GateCategory } from "@mizchi/vlmkit-core/plugin/contract.ts";
import { GATE_CATEGORIES, GATE_CATEGORY_ORDER } from "@mizchi/vlmkit-core/plugin/contract.ts";
import type { GateTiming } from "@mizchi/vlmkit-core/plugin/runner.ts";
import { runGate } from "@mizchi/vlmkit-core/plugin/runner.ts";
import { BOLD, CYAN, DIM, GREEN, RED, RESET, YELLOW } from "@mizchi/vlmkit-core/terminal-colors.ts";
import { loadGateRegistry } from "../gate-registry.ts";

const VALUE_FLAGS = ["--gate", "--repeat", "--category", "--out"];

export interface BenchGatesOptions {
  sources: string[];
  /** Explicit gate command strings, with their own flags. Empty = every benchable gate. */
  gates: string[];
  category?: GateCategory;
  repeat: number;
  format: "text" | "md" | "json";
  outPath?: string;
  /** Measure whether disabling rules changes the runtime. Costs two extra runs. */
  probeSuppression: boolean;
}

interface Sample {
  timing: GateTiming;
  findings: number;
  /**
   * Findings per rule id in this run. Counts, not a deduped set: a rule firing
   * three times in one run produced three findings, and collapsing that to
   * "fired" would rank a rule that reports one collision the same as one that
   * reports thirty.
   */
  fired: Map<string, number>;
}

export interface GateStat {
  command: string;
  gateId: string;
  category: GateCategory | null;
  plugin: string;
  runs: number;
  medianTotalMs: number;
  minTotalMs: number;
  maxTotalMs: number;
  medianRunMs: number;
  /** `run` as a share of total — how much of the cost is the measurement itself. */
  runSharePct: number;
  medianFindingsMs: number;
  medianFindings: number;
  rulesDeclared: number;
  /** Rules that fired at least once across all runs. */
  rulesFired: number;
  /** ms of measurement per finding produced. Null when the gate found nothing. */
  msPerFinding: number | null;
  error?: string;
}

export interface RuleStat {
  gateId: string;
  rule: string;
  declaredSeverity: string;
  /** Runs in which this rule produced at least one finding. */
  firedRuns: number;
  totalRuns: number;
  /** Findings per run, so the number does not scale with --repeat. */
  findings: number;
  /**
   * The gate's measurement time split equally across the rules that fired in
   * each run, averaged per run. An allocation of a shared cost, not an isolated
   * measurement — and per-run so it stays comparable across `--repeat` values
   * and against the gate's own median.
   */
  attributedMs: number;
  msPerFinding: number | null;
}

export interface SuppressionProbe {
  command: string;
  allRulesOnMs: number;
  allRulesOffMs: number;
  deltaMs: number;
  deltaPct: number;
}

export interface BenchGatesReport {
  sources: string[];
  repeat: number;
  gates: GateStat[];
  rules: RuleStat[];
  totals: {
    gates: number;
    benchedRuns: number;
    wallMs: number;
    measurementMs: number;
    projectionMs: number;
    rulesDeclared: number;
    rulesNeverFired: number;
  };
  suppressionProbe?: SuppressionProbe;
}

export function parseBenchGatesArgs(argv: readonly string[]): BenchGatesOptions {
  const sources = readPositionals(argv, VALUE_FLAGS);
  if (sources.length === 0) {
    throw new UsageError("missing required argument. Usage: vlmkit bench gates <html-or-url...>");
  }
  const repeat = readInt(argv, "repeat", { min: 1 }) ?? 3;
  const rawCategory = readFlag(argv, "category");
  if (rawCategory !== undefined && !(rawCategory in GATE_CATEGORIES)) {
    throw new UsageError(
      `--category: unknown category ${JSON.stringify(rawCategory)}.`
      + ` Valid: ${GATE_CATEGORY_ORDER.join(", ")}`,
    );
  }
  const outPath = readFlag(argv, "out");
  return {
    sources,
    gates: readAll(argv, "gate"),
    ...(rawCategory !== undefined ? { category: rawCategory as GateCategory } : {}),
    repeat,
    format: hasFlag(argv, "json") ? "json" : hasFlag(argv, "md") ? "md" : "text",
    ...(outPath ? { outPath } : {}),
    probeSuppression: hasFlag(argv, "probe-suppression"),
  };
}

/**
 * A gate is benchable from a bare page when its positional input is a *page*
 * and it requires nothing else. Read off `inputs` so adding a gate does not mean
 * editing a list here — the same property that lets the MCP server derive its
 * schemas.
 *
 * `kind: "path-or-url"` is what "a page" means in the contract, and that is the
 * test. `check asset` takes `kind: "path"` — a PNG — and handing it an HTML file
 * failed inside the PNG decoder with `unrecognised content at end of stream`,
 * which reads like a broken fixture rather than a gate that was never
 * applicable. Bench it explicitly with `--gate "check asset icon.png"`.
 */
export function isBenchable(gate: AnyGateDefinition): boolean {
  const inputs = gate.inputs ?? [];
  const positional = inputs.find((input) => input.positional === 0);
  if (!positional || positional.kind !== "path-or-url") return false;
  return !inputs.some((input) => input.required && input.positional === undefined);
}

function median(values: readonly number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[mid - 1]! + sorted[mid]!) / 2 : sorted[mid]!;
}

const round = (n: number) => Math.round(n * 10) / 10;

export async function runBenchGates(options: BenchGatesOptions): Promise<BenchGatesReport> {
  const registry = await loadGateRegistry();
  const jobs: { gate: AnyGateDefinition; plugin: string; argv: string[] }[] = [];

  if (options.gates.length > 0) {
    for (const command of options.gates) {
      const tokens = tokenizeCommand(command);
      const resolved = registry.resolve(tokens);
      if (!resolved) {
        const suggestions = registry.suggest(tokens);
        throw new UsageError(
          `--gate "${command}": unknown gate`
          + (suggestions.length > 0 ? ` — did you mean ${suggestions.map((s) => `"${s}"`).join(", ")}?` : ""),
        );
      }
      const plugin = registry.list().find((e) => e.gate.id === resolved.gate.id)?.plugin ?? "?";
      jobs.push({ gate: resolved.gate, plugin, argv: resolved.rest });
    }
  } else {
    for (const { gate, plugin } of registry.list()) {
      if (!isBenchable(gate)) continue;
      if (options.category && gate.category !== options.category) continue;
      jobs.push({ gate, plugin, argv: [] });
    }
  }
  if (jobs.length === 0) throw new UsageError("no gates to bench (check --gate / --category)");

  const wallStart = performance.now();
  const gateStats: GateStat[] = [];
  const ruleStats: RuleStat[] = [];
  let benchedRuns = 0;

  for (const job of jobs) {
    const samples: Sample[] = [];
    let error: string | undefined;

    for (const source of options.sources) {
      for (let i = 0; i < options.repeat; i++) {
        try {
          const outcome = await runGate(job.gate, [source, ...job.argv], {
            // No ledger row per bench run: a benchmark must not pollute the
            // audit trail it is measuring, and the append is itself timed.
            ledger: false,
          });
          benchedRuns++;
          const fired = new Map<string, number>();
          for (const finding of outcome.findings) {
            fired.set(finding.rule, (fired.get(finding.rule) ?? 0) + 1);
          }
          samples.push({ timing: outcome.timing, findings: outcome.findings.length, fired });
        } catch (e) {
          // One gate failing must not abandon the whole bench — the row is
          // reported with its error so the table still shows what ran.
          error = e instanceof Error ? e.message : String(e);
          break;
        }
      }
      if (error) break;
    }

    const totals = samples.map((s) => s.timing.totalMs);
    const runs = samples.map((s) => s.timing.runMs);
    const medianRunMs = median(runs);
    const findings = samples.map((s) => s.findings);
    const firedEver = new Set(samples.flatMap((s) => [...s.fired.keys()]));
    const medianFindings = median(findings);

    gateStats.push({
      command: job.gate.command.join(" "),
      gateId: job.gate.id,
      category: job.gate.category ?? null,
      plugin: job.plugin,
      runs: samples.length,
      medianTotalMs: round(median(totals)),
      minTotalMs: round(Math.min(...totals, Infinity) === Infinity ? 0 : Math.min(...totals)),
      maxTotalMs: round(totals.length > 0 ? Math.max(...totals) : 0),
      medianRunMs: round(medianRunMs),
      runSharePct: round(median(totals) > 0 ? (medianRunMs / median(totals)) * 100 : 0),
      medianFindingsMs: Math.round(median(samples.map((s) => s.timing.findingsMs)) * 1000) / 1000,
      medianFindings,
      rulesDeclared: job.gate.rules.length,
      rulesFired: firedEver.size,
      msPerFinding: medianFindings > 0 ? round(medianRunMs / medianFindings) : null,
      ...(error ? { error } : {}),
    });

    // Attribution: split each run's measurement time across the rules that
    // fired in THAT run, so a rule firing only on one page of the corpus is not
    // charged for the pages where it stayed quiet.
    //
    // Averaged over runs rather than summed. A sum would scale with --repeat,
    // making the number incomparable both across bench invocations and against
    // the gate's own median on the same screen.
    const attributed = new Map<string, { ms: number; firedRuns: number; findings: number }>();
    for (const sample of samples) {
      const share = sample.fired.size > 0 ? sample.timing.runMs / sample.fired.size : 0;
      for (const [rule, count] of sample.fired) {
        const acc = attributed.get(rule) ?? { ms: 0, firedRuns: 0, findings: 0 };
        acc.ms += share;
        acc.firedRuns += 1;
        acc.findings += count;
        attributed.set(rule, acc);
      }
    }
    // Rule rows include never-fired rules on purpose: a rule at zero findings
    // across the whole corpus is the clearest thing this report can surface.
    for (const rule of job.gate.rules) {
      const acc = attributed.get(rule.id);
      const runs = Math.max(1, samples.length);
      // Both figures are per-run, so they read against each other and against
      // the gate's median on the same screen.
      const msPerRun = (acc?.ms ?? 0) / runs;
      const findingsPerRun = (acc?.findings ?? 0) / runs;
      ruleStats.push({
        gateId: job.gate.id,
        rule: rule.id,
        declaredSeverity: rule.severity,
        firedRuns: acc?.firedRuns ?? 0,
        totalRuns: samples.length,
        findings: Math.round(findingsPerRun * 10) / 10,
        attributedMs: round(msPerRun),
        msPerFinding: findingsPerRun > 0 ? round(msPerRun / findingsPerRun) : null,
      });
    }
  }

  let suppressionProbe: SuppressionProbe | undefined;
  if (options.probeSuppression) {
    suppressionProbe = await probeSuppression(jobs, gateStats, options);
  }

  const wallMs = round(performance.now() - wallStart);
  gateStats.sort((a, b) => b.medianTotalMs - a.medianTotalMs);
  ruleStats.sort((a, b) => b.attributedMs - a.attributedMs || a.rule.localeCompare(b.rule));

  return {
    sources: options.sources,
    repeat: options.repeat,
    gates: gateStats,
    rules: ruleStats,
    totals: {
      gates: gateStats.length,
      benchedRuns,
      wallMs,
      measurementMs: round(gateStats.reduce((n, g) => n + g.medianRunMs, 0)),
      projectionMs: Math.round(gateStats.reduce((n, g) => n + g.medianFindingsMs, 0) * 1000) / 1000,
      rulesDeclared: ruleStats.length,
      rulesNeverFired: ruleStats.filter((r) => r.firedRuns === 0).length,
    },
    ...(suppressionProbe ? { suppressionProbe } : {}),
  };
}

/**
 * Measure the claim everyone assumes is false: does switching every rule off
 * make the gate faster?
 *
 * Run on the slowest gate, because that is where a saving would show up if one
 * existed. Two runs each way, taking the min, so a cold first run does not
 * decide it.
 */
async function probeSuppression(
  jobs: readonly { gate: AnyGateDefinition; argv: string[] }[],
  stats: readonly GateStat[],
  options: BenchGatesOptions,
): Promise<SuppressionProbe | undefined> {
  const slowest = [...stats].filter((s) => !s.error).sort((a, b) => b.medianTotalMs - a.medianTotalMs)[0];
  if (!slowest) return undefined;
  const job = jobs.find((j) => j.gate.id === slowest.gateId);
  if (!job) return undefined;
  const source = options.sources[0]!;

  const time = async (rules: Record<string, "off"> | undefined) => {
    const runs: number[] = [];
    for (let i = 0; i < 2; i++) {
      const outcome = await runGate(job.gate, [source, ...job.argv], {
        ledger: false,
        ...(rules ? { rules } : {}),
      });
      runs.push(outcome.timing.totalMs);
    }
    return Math.min(...runs);
  };

  const on = await time(undefined);
  const off = await time({ [`${job.gate.id}/*`]: "off" });
  return {
    command: slowest.command,
    allRulesOnMs: round(on),
    allRulesOffMs: round(off),
    deltaMs: round(off - on),
    deltaPct: round(on > 0 ? ((off - on) / on) * 100 : 0),
  };
}

export function formatBenchGates(report: BenchGatesReport): string {
  const lines: string[] = [];
  lines.push("");
  lines.push(`${BOLD}${CYAN}vlmkit bench gates${RESET}`);
  lines.push(
    `${DIM}${report.sources.length} source(s) x ${report.repeat} repeat(s) — `
    + `${report.totals.benchedRuns} runs in ${(report.totals.wallMs / 1000).toFixed(1)}s${RESET}`,
  );
  lines.push("");

  const w = { cmd: 21, ms: 9, share: 7, find: 8, rules: 11 };
  lines.push(
    `${BOLD}${"gate".padEnd(w.cmd)}${"median".padStart(w.ms)}${"min".padStart(w.ms)}${"max".padStart(w.ms)}`
    + `${"run%".padStart(w.share)}${"findings".padStart(w.find)}${"rules".padStart(w.rules)}${RESET}`,
  );
  for (const gate of report.gates) {
    if (gate.error) {
      lines.push(`${gate.command.padEnd(w.cmd)}${RED}${"error".padStart(w.ms)}${RESET}  ${DIM}${gate.error.slice(0, 60)}${RESET}`);
      continue;
    }
    const fired = `${gate.rulesFired}/${gate.rulesDeclared}`;
    lines.push(
      gate.command.padEnd(w.cmd)
      + `${gate.medianTotalMs.toFixed(0)}ms`.padStart(w.ms)
      + `${gate.minTotalMs.toFixed(0)}ms`.padStart(w.ms)
      + `${gate.maxTotalMs.toFixed(0)}ms`.padStart(w.ms)
      + `${gate.runSharePct.toFixed(0)}%`.padStart(w.share)
      + `${gate.medianFindings}`.padStart(w.find)
      + fired.padStart(w.rules),
    );
  }

  lines.push("");
  lines.push(
    `${DIM}run% is the share of the gate's time spent in its measurement. The rest is`
    + ` parse + projection + prose;\nthe projection across every gate above totals`
    + ` ${report.totals.projectionMs.toFixed(2)}ms.${RESET}`,
  );

  // Only the rules that cost something, plus the never-fired list, which is the
  // actionable half. A full 115-row table is not read by anyone.
  const fired = report.rules.filter((r) => r.firedRuns > 0);
  if (fired.length > 0) {
    lines.push("");
    lines.push(`${BOLD}attributed cost per rule${RESET} ${DIM}(top ${Math.min(12, fired.length)})${RESET}`);
    lines.push(
      `${DIM}Each run's measurement time split across the rules that fired in it — an`
      + ` allocation of a\nshared cost, not an isolated timing. Rules are not separately`
      + ` executed.${RESET}`,
    );
    lines.push("");
    for (const rule of fired.slice(0, 12)) {
      lines.push(
        `  ${`${rule.gateId}/${rule.rule}`.padEnd(46)}`
        + `${rule.attributedMs.toFixed(0)}ms`.padStart(8)
        + `${`${rule.firedRuns}/${rule.totalRuns} runs`.padStart(12)}`
        + `${DIM} ${rule.declaredSeverity}${RESET}`,
      );
    }
  }

  const never = report.rules.filter((r) => r.firedRuns === 0);
  if (never.length > 0) {
    lines.push("");
    lines.push(
      `${YELLOW}${never.length} of ${report.totals.rulesDeclared} rules never fired on this corpus.${RESET}`,
    );
    lines.push(
      `${DIM}Not dead weight by itself — a rule that never fires is a defect class you do not`
      + `\nhave. It is only worth pruning if you also do not want the check. Widen the corpus`
      + `\nbefore concluding a rule is untested.${RESET}`,
    );
  }

  if (report.suppressionProbe) {
    const p = report.suppressionProbe;
    lines.push("");
    lines.push(`${BOLD}does turning rules off save time?${RESET} ${DIM}(${p.command}, the slowest gate)${RESET}`);
    lines.push(`  all rules on   ${p.allRulesOnMs.toFixed(0)}ms`);
    lines.push(`  all rules off  ${p.allRulesOffMs.toFixed(0)}ms`);
    lines.push(
      `  ${GREEN}delta ${p.deltaMs >= 0 ? "+" : ""}${p.deltaMs.toFixed(0)}ms (${p.deltaPct.toFixed(1)}%)${RESET}`
      + ` ${DIM}— noise. Rule settings are applied to the findings AFTER the\n`
      + `  measurement, so suppression costs nothing and saves nothing. To spend less,`
      + ` drop a\n  gate or narrow its inputs.${RESET}`,
    );
  }
  lines.push("");
  return lines.join("\n");
}

export function formatBenchGatesMarkdown(report: BenchGatesReport): string {
  const lines: string[] = [];
  lines.push("## Gate benchmark");
  lines.push("");
  lines.push(
    `${report.sources.length} source(s) × ${report.repeat} repeat(s), `
    + `${report.totals.benchedRuns} runs in ${(report.totals.wallMs / 1000).toFixed(1)}s.`,
  );
  lines.push("");
  lines.push("| gate | category | median | min | max | run % | findings | rules fired | ms/finding |");
  lines.push("|---|---|--:|--:|--:|--:|--:|--:|--:|");
  for (const g of report.gates) {
    if (g.error) {
      lines.push(`| \`${g.command}\` | ${g.category ?? "—"} | error | | | | | | ${g.error.slice(0, 40)} |`);
      continue;
    }
    lines.push(
      `| \`${g.command}\` | ${g.category ?? "—"} | ${g.medianTotalMs.toFixed(0)}ms |`
      + ` ${g.minTotalMs.toFixed(0)}ms | ${g.maxTotalMs.toFixed(0)}ms | ${g.runSharePct.toFixed(0)}% |`
      + ` ${g.medianFindings} | ${g.rulesFired}/${g.rulesDeclared} |`
      + ` ${g.msPerFinding === null ? "—" : `${g.msPerFinding.toFixed(0)}ms`} |`,
    );
  }
  lines.push("");
  lines.push(
    "`run %` is the share spent in the gate's measurement. Every rule the gate declares reads"
    + " that one measurement, so the projection is the remainder — "
    + `${report.totals.projectionMs.toFixed(2)}ms across every gate above.`,
  );

  const fired = report.rules.filter((r) => r.firedRuns > 0);
  if (fired.length > 0) {
    lines.push("");
    lines.push("### Attributed cost per rule");
    lines.push("");
    lines.push(
      "Each run's measurement time split equally across the rules that fired in it. This is an"
      + " allocation of a shared cost, not an isolated timing — rules are not separately executed.",
    );
    lines.push("");
    lines.push("| rule | declared | fired | findings/run | attributed/run | ms/finding |");
    lines.push("|---|---|--:|--:|--:|--:|");
    for (const r of fired.slice(0, 20)) {
      lines.push(
        `| \`${r.gateId}/${r.rule}\` | ${r.declaredSeverity} | ${r.firedRuns}/${r.totalRuns} |`
        + ` ${r.findings} | ${r.attributedMs.toFixed(0)}ms |`
        + ` ${r.msPerFinding === null ? "—" : `${r.msPerFinding.toFixed(0)}ms`} |`,
      );
    }
  }

  const never = report.rules.filter((r) => r.firedRuns === 0);
  if (never.length > 0) {
    lines.push("");
    lines.push(`### Rules that never fired (${never.length} of ${report.totals.rulesDeclared})`);
    lines.push("");
    lines.push(
      "A rule that never fires is a defect class this corpus does not contain — not dead weight"
      + " by itself. Widen the corpus before concluding a rule is untested.",
    );
    lines.push("");
    lines.push(never.map((r) => `\`${r.gateId}/${r.rule}\``).join(", "));
  }

  if (report.suppressionProbe) {
    const p = report.suppressionProbe;
    lines.push("");
    lines.push("### Does turning rules off save time?");
    lines.push("");
    lines.push(`Measured on \`${p.command}\`, the slowest gate:`);
    lines.push("");
    lines.push("| | ms |");
    lines.push("|---|--:|");
    lines.push(`| all rules on | ${p.allRulesOnMs.toFixed(0)} |`);
    lines.push(`| all rules off | ${p.allRulesOffMs.toFixed(0)} |`);
    lines.push(`| delta | ${p.deltaMs >= 0 ? "+" : ""}${p.deltaMs.toFixed(0)} (${p.deltaPct.toFixed(1)}%) |`);
    lines.push("");
    lines.push(
      "Noise. Rule settings are applied to the findings **after** the measurement — by design, so"
      + " a silenced finding can still be reported as silenced. Pruning rules buys clarity, not"
      + " time; to spend less, drop a gate or narrow its inputs.",
    );
  }
  return lines.join("\n");
}

export function benchGatesUsage(): string {
  return `vlmkit bench gates <html-or-url...> [options]

Measure where a ruleset spends its time: per-gate wall clock with a phase split,
and per-rule attributed cost plus yield.

Runs every gate that works from a bare page (its positional input is a page and
nothing else is required — 18 of the 26 built-ins). Name the others explicitly
with --gate, including their arguments.

Options:
  --gate "<command>"       Gate to bench, with its own flags; repeatable
  --category <name>        Only gates in one category
                             (correctness, behavior, design-system, verdict, infrastructure)
  --repeat <n>             Runs per gate per source (default 3)
  --probe-suppression      Also measure whether --rule ...=off changes the runtime
  --md                     Markdown output
  --json                   JSON output
  --out <path>             Write the output to a file as well
  -h, --help               Show this help

Per-rule cost is ATTRIBUTED, not isolated: a gate performs one measurement and
every rule it declares reads that same report, so rules cannot be timed
separately. See the module docstring for what follows from that.

Examples:
  vlmkit bench gates page.html
  vlmkit bench gates page.html --category correctness --repeat 5
  vlmkit bench gates a.html b.html --md --out docs/reports/gate-bench.md
  vlmkit bench gates page.html --gate "check breakpoints --sweep" --probe-suppression`;
}

export async function benchGatesCli(argv: readonly string[]): Promise<void> {
  const options = parseBenchGatesArgs(argv);
  const report = await runBenchGates(options);
  const text = options.format === "json"
    ? JSON.stringify(report, null, 2)
    : options.format === "md"
    ? formatBenchGatesMarkdown(report)
    : formatBenchGates(report);
  console.log(text);
  if (options.outPath) {
    const path = resolve(options.outPath);
    writeFileSync(path, `${text}\n`);
    if (options.format !== "json") console.log(`\nWritten to ${path}`);
  }
}
