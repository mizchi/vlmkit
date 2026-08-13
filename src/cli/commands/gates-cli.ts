#!/usr/bin/env node
/**
 * `vlmkit gates` — drive the gates from one reviewed config instead of N npm
 * scripts, and make every suppression enumerable.
 *
 * The documented convention was a script per page. Three independent reviewers
 * raised the same two problems: it stops scaling around twenty pages, and once
 * a `--allow-invisible` is inlined in a script, auditing what has been silenced
 * repo-wide means grepping. `gates suppressions` is the answer to the second —
 * one command that lists every suppression with its reason, owner and expiry,
 * and exits non-zero when any of them has gone stale.
 *
 * Config format and the two decisions that make it reviewable (a reason is
 * mandatory; an expired suppression stops being applied) live in
 * `packages/vlmkit-core/src/gate-config.ts`.
 */
import { existsSync } from "node:fs";
import { readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { UsageError, handleCliError } from "@mizchi/vlmkit-core/cli-error.ts";
import { hasFlag, readAll, readFlag, readInt } from "@mizchi/vlmkit-core/arg-reader.ts";
import {
  GATE_CONFIG_FILENAMES,
  type GateConfig,
  type GatePlan,
  type ResolvedSuppression,
  parseGateConfig,
  resolveGatePlan,
  summarizeSuppressions,
} from "@mizchi/vlmkit-core/gate-config.ts";
import { BOLD, CYAN, DIM, GREEN, RED, RESET, YELLOW } from "@mizchi/vlmkit-core/terminal-colors.ts";
import {
  type BatchSummary,
  formatBatchSummary,
  parseShard,
  resolvePages,
  runJobs,
  shardPages,
} from "./batch-cli.ts";

export function findGateConfig(cwd = process.cwd()): string | null {
  for (const name of GATE_CONFIG_FILENAMES) {
    const candidate = resolve(cwd, name);
    if (existsSync(candidate)) return candidate;
  }
  return null;
}

async function loadConfig(explicit?: string): Promise<{ path: string; config: GateConfig }> {
  const path = explicit ? resolve(explicit) : findGateConfig();
  if (!path) {
    throw new UsageError(
      `No gate config found (looked for ${GATE_CONFIG_FILENAMES.join(", ")}).`
      + ` Create one with: vlmkit gates init --pages "routes/**/*.html"`,
    );
  }
  if (!existsSync(path)) throw new UsageError(`Gate config not found: ${path}`);
  return { path, config: parseGateConfig(await readFile(path, "utf-8")) };
}

/**
 * Expand glob sources into one entry per file. Without this a config entry of
 * `routes/**\/*.html` would hand the gate the pattern string itself, and the
 * config would be as tedious to maintain as the npm scripts it replaces.
 *
 * A pattern matching several files keeps its config id as a prefix
 * (`routes:routes/about.html`), so `--only` and per-page sharding still address
 * the group by the name the config gave it.
 */
export async function expandPlanSources(plan: GatePlan, baseDir?: string): Promise<GatePlan> {
  const expansions = new Map<string, string[]>();
  for (const job of plan.jobs) {
    if (expansions.has(job.source)) continue;
    // Globs expand against the CONFIG's directory when one is given, matching
    // where the gate processes will run. Omitted (library callers, tests) keeps
    // the process cwd.
    expansions.set(job.source, await resolvePages([job.source], baseDir));
  }
  const jobs: GatePlan["jobs"] = [];
  for (const job of plan.jobs) {
    const files = expansions.get(job.source)!;
    if (files.length === 0) {
      throw new UsageError(
        `Page "${job.pageId}": source matched no files: ${job.source}`
        + ` — fix the pattern or remove the entry rather than letting the gate run on nothing.`,
      );
    }
    for (const file of files) {
      jobs.push({
        ...job,
        source: file,
        pageId: files.length === 1 && file === job.source ? job.pageId : `${job.pageId}:${file}`,
      });
    }
  }
  return { ...plan, jobs };
}

/** Shard over PAGES, not jobs, so one page's gates stay on one runner. */
export function shardPlan(plan: GatePlan, shard?: { index: number; total: number }): GatePlan {
  if (!shard || shard.total === 1) return plan;
  const pages = [...new Set(plan.jobs.map((j) => j.pageId))].sort();
  const mine = new Set(shardPages(pages, shard));
  return { ...plan, jobs: plan.jobs.filter((j) => mine.has(j.pageId)) };
}

export function formatPlan(plan: GatePlan, configPath: string): string {
  const lines: string[] = [];
  lines.push("");
  lines.push(`${BOLD}${CYAN}vlmkit gates${RESET} ${DIM}${configPath}${RESET}`);
  lines.push("");
  const pages = [...new Set(plan.jobs.map((j) => j.pageId))];
  lines.push(`${pages.length} page(s), ${plan.jobs.length} gate run(s)`);
  lines.push("");
  let current = "";
  for (const job of plan.jobs) {
    if (job.pageId !== current) {
      current = job.pageId;
      lines.push(`${BOLD}${current}${RESET}${job.source === current ? "" : ` ${DIM}${job.source}${RESET}`}`);
    }
    const suffix = job.appliedSuppressions.length > 0
      ? ` ${YELLOW}[+${job.appliedSuppressions.length} suppression]${RESET}`
      : "";
    lines.push(`  vlmkit ${job.gate} ${job.source}${suffix}`);
  }
  if (plan.expired.length > 0) {
    lines.push("");
    lines.push(`${RED}${plan.expired.length} expired suppression(s) NOT applied${RESET} ${DIM}(see: vlmkit gates suppressions)${RESET}`);
  }
  return lines.join("\n");
}

export function formatSuppressions(suppressions: ResolvedSuppression[], soonDays = 30): string {
  const summary = summarizeSuppressions(suppressions, soonDays);
  const lines: string[] = [];
  lines.push("");
  lines.push(`${BOLD}${CYAN}vlmkit gates suppressions${RESET}`);
  lines.push("");
  if (summary.rows.length === 0) {
    lines.push(`${GREEN}No suppressions declared.${RESET}`);
    return lines.join("\n");
  }
  lines.push(
    `${summary.rows.length} total: ${summary.active} active, ${summary.permanent} permanent (no expiry),`
    + ` ${summary.expired > 0 ? `${RED}${summary.expired} expired${RESET}` : "0 expired"}`
    + `${summary.expiringSoon > 0 ? `, ${YELLOW}${summary.expiringSoon} expiring within ${soonDays}d${RESET}` : ""}`
    + `${summary.unowned > 0 ? `, ${YELLOW}${summary.unowned} unowned${RESET}` : ""}`,
  );
  lines.push("");
  for (const s of summary.rows) {
    const state = s.status === "expired"
      ? `${RED}EXPIRED ${-s.daysLeft!}d ago${RESET}`
      : s.status === "permanent"
        ? `${DIM}permanent${RESET}`
        : (s.daysLeft ?? Infinity) <= soonDays
          ? `${YELLOW}${s.daysLeft}d left${RESET}`
          : `${GREEN}${s.daysLeft}d left${RESET}`;
    lines.push(`  ${state}  ${BOLD}${s.scope}${RESET} ${DIM}/${RESET} ${s.gate} ${DIM}${s.flag}${RESET}`);
    lines.push(`      ${s.reason}${s.owner ? ` ${DIM}— ${s.owner}${RESET}` : ` ${YELLOW}(no owner)${RESET}`}`);
  }
  if (summary.expired > 0) {
    lines.push("");
    lines.push(
      `${RED}Expired suppressions are not applied${RESET} — the gate they silenced runs unmuted.`,
    );
    lines.push(`${DIM}Fix the page, or renew the entry with a new expiry and a re-stated reason.${RESET}`);
  }
  return lines.join("\n");
}

/**
 * Compact pre-run notice. The full inventory's counts read wrong for a filtered
 * subset ("1 total: 0 active"), and before a run the only thing that matters is
 * which gates are about to run unmuted and why.
 */
export function formatExpiredNotice(expired: ResolvedSuppression[]): string {
  if (expired.length === 0) return "";
  const lines = [
    `${RED}${expired.length} suppression(s) expired — the gate(s) below run unmuted:${RESET}`,
  ];
  for (const s of expired) {
    lines.push(
      `  ${RED}x${RESET} ${BOLD}${s.scope}${RESET} ${DIM}/${RESET} ${s.gate} ${DIM}${s.flag}${RESET}`
      + ` ${DIM}(expired ${-s.daysLeft!}d ago: ${s.reason})${RESET}`,
    );
  }
  lines.push(`${DIM}A failure below may be this, not a new regression. See: vlmkit gates suppressions${RESET}`);
  return lines.join("\n");
}

/**
 * Check the config's gate commands and rule references against the registry.
 *
 * This is the payoff for having a catalog at all. `check integrit page.html`
 * used to parse cleanly and then fail as a child process exiting non-zero,
 * which reads like a page defect; `"rules": { "text-colision": "off" }` used
 * to be impossible to state and, once possible, easy to misspell into a line
 * that silences nothing. Both now fail before a browser starts.
 *
 * An unresolvable command inside a gate group is now a hard error, not a
 * warning. While gates were still migrating it had to be a warning — the
 * registry did not know every gate, so rejecting an unknown string would have
 * rejected working configs. Every gate is registered now, so within the groups
 * the registry owns (`check`, `scan`, `stress`, `verify`) an unresolved command
 * cannot be anything but a mistake, and reporting it as a warning would leave
 * the run to fail later as a child process exiting non-zero — the failure mode
 * this whole check exists to remove.
 *
 * Groups the registry does not own stay unvalidated: `diff`, `build`,
 * `contract` and friends are artifact producers, not gates, and a config may
 * legitimately list one.
 */
async function validateAgainstRegistry(plan: GatePlan, configPath: string): Promise<void> {
  const { loadGateRegistry } = await import("../gate-registry.ts");
  const { validateGateCommands, validateRuleSettings } = await import("@mizchi/vlmkit-core/plugin/registry.ts");
  const registry = await loadGateRegistry();

  const ruleProblems: string[] = [];
  for (const job of plan.jobs) {
    if (Object.keys(job.rules).length === 0) continue;
    const gate = registry.resolve(job.baseGate.split(/\s+/).filter(Boolean))?.gate;
    ruleProblems.push(
      ...validateRuleSettings(registry, job.rules, gate).map((p) => `${job.pageId} / ${job.baseGate}: ${p}`),
    );
  }
  if (ruleProblems.length > 0) {
    throw new UsageError(
      `${configPath}: invalid rule setting(s):\n${[...new Set(ruleProblems)].map((p) => `  - ${p}`).join("\n")}`,
    );
  }

  const gateGroups = registry.groups();
  const unresolved = validateGateCommands(registry, [...new Set(plan.jobs.map((j) => j.baseGate))])
    .filter(({ command }) => gateGroups.has(command.trim().split(/\s+/)[0] ?? ""));
  if (unresolved.length > 0) {
    throw new UsageError(
      `${configPath}: ${unresolved.length} unknown gate command(s):\n`
      + unresolved.map((p) => `  - ${p.message}`).join("\n")
      + `\n\nRun \`vlmkit rules\` for the full list.`,
    );
  }
}

const STARTER_GATE = "check integrity";

/** Flags a URL-sourced scaffold needs to run at all. See `scaffoldConfig`. */
export const URL_SCAFFOLD_FLAGS = "--wait-until load --timeout 15000";

/**
 * What `gates init` writes, as a decision separate from writing it.
 *
 * A `http(s)` source needs the page-load flags or every gate in the scaffold dies in
 * navigation on any page that does not reach network idle — which is the whole class of
 * page a URL source implies. v5's CI agent got exactly that plan:
 *
 *   "`gates init` doesn't know what it scaffolded. Handed a `http://` source, it emits
 *    a plan that times out on every gate. It has the URL; it could scaffold
 *    `--wait-until`/`--timeout` or warn."
 *
 * Scaffolding the flags rather than warning, because a warning printed next to a config
 * that has already been written puts the work back on the reader. `load` rather than
 * `domcontentloaded`: it is the weakest milestone that still guarantees subresources,
 * and the gates settle after it anyway.
 */
export function scaffoldConfig(
  patterns: readonly string[],
  gates: readonly string[],
): { config: GateConfig; urlSources: string[] } {
  const sources = patterns.length > 0 ? [...patterns] : ["index.html"];
  const urlSources = sources.filter((source) => /^https?:\/\//.test(source));
  const declared = gates.length > 0 ? [...gates] : [STARTER_GATE];
  return {
    config: {
      defaults: {
        gates: urlSources.length > 0
          ? declared.map((gate) => `${gate} ${URL_SCAFFOLD_FLAGS}`)
          : declared,
      },
      pages: sources.map((source) => ({ source })),
    },
    urlSources,
  };
}

async function initConfig(args: string[]): Promise<void> {
  const path = resolve(readFlag(args, "path") ?? GATE_CONFIG_FILENAMES[0]!);
  if (existsSync(path) && !hasFlag(args, "force")) {
    throw new UsageError(`${path} already exists (pass --force to overwrite)`);
  }
  const patterns = readAll(args, "pages");
  const gates = readAll(args, "gate");
  const { config, urlSources } = scaffoldConfig(patterns, gates);
  // Parse what we are about to write: a scaffold that its own validator
  // rejects would be a rough first impression.
  parseGateConfig(JSON.stringify(config));
  await writeFile(path, `${JSON.stringify(config, null, 2)}\n`);
  console.log(`Wrote ${path}`);
  console.log(`  ${config.pages.length} page entr(ies), gates: ${config.defaults!.gates!.join(", ")}`);
  if (urlSources.length > 0) {
    console.log(
      `\n  Added --wait-until load --timeout 15000 because the source is a URL:`
      + ` the default \`networkidle\` milestone never fires on a page that holds a`
      + ` connection open (a stream, a poll), and every gate would time out having`
      + ` reported nothing. Drop them if this page does reach network idle.`,
    );
    console.log(
      `  For reproducible numbers, pin the network too:`
      + ` vlmkit snapshot record-har ${urlSources[0]} --out app.har`
      + `, then add --har app.har.`,
    );
  }
  console.log(`\nNext: vlmkit gates list    (see what would run)`);
  console.log(`      vlmkit gates run     (run it)`);
}

function printUsage(exitCode: number): never {
  console.log(`Usage: vlmkit gates <init|list|suppressions|run> [options]

One reviewed config (${GATE_CONFIG_FILENAMES[0]}) for which gates run on which
pages, plus every suppression in one auditable place.

  init            Scaffold a config
                    --pages <glob>   Page source, repeatable
                    --gate <cmd>     Default gate, repeatable
                    --path <file> --force
  list            Print the resolved page x gate plan without running it
  suppressions    Inventory: reason, owner, expiry, days left
                    --soon <days>       Highlight entries expiring within N days (30)
                    --require-expiry    Fail on permanent (never-reviewed) entries
                    --require-owner     Fail on entries with no owner
  run             Run the plan in parallel
                    --only <text>       Pages whose id/source contains this, repeatable
                    --concurrency <n> --shard <i/n> --output <dir>
                    --advisory          Exit 0 even on failures / stale config

Common: --config <file> --json

Exit codes: non-zero when a gate fails, and when a suppression has expired —
an expired entry is a config defect even if the page now passes. --advisory
opts out.`);
  process.exit(exitCode);
}

async function main(argv = process.argv.slice(2)): Promise<void> {
  const sub = argv[0];
  if (!sub || hasFlag(argv, "help") || hasFlag(argv, "-h")) printUsage(sub ? 0 : 1);
  const args = argv.slice(1);
  const json = hasFlag(args, "json");

  if (sub === "init") return initConfig(args);

  const { path, config } = await loadConfig(readFlag(args, "config"));
  const only = readAll(args, "only");
  const declared = resolveGatePlan(config, only.length > 0 ? { only } : {});
  await validateAgainstRegistry(declared, path);
  // `suppressions` is an inventory of the config, so it must not depend on the
  // filesystem: a broken glob should not hide what has been silenced.
  // Everything relative inside the config — a `source` glob, a `--har` or
  // `--manifest` path on a gate string — resolves against the CONFIG FILE, not
  // against wherever the command was typed. v5's CI agent hit the old behaviour on
  // the exact invocation this repo's own workflows use:
  //
  //   "`gates run --config fixtures/.../vlmkit.gates.json` from repo root dies with
  //    `page.routeFromHAR: ENOENT … open '/home/user/vlmkit/dashboard.har'` and a
  //    Playwright stack trace, not a config error. A committed config whose paths
  //    work from only one directory is not committed."
  //
  // Its workaround was `cd "$(dirname "$0")"` in a wrapper script, documented in
  // the script as a workaround. For a config at the repo root — where nearly all
  // of them live — this changes nothing, since the base and the cwd are the same
  // directory.
  const baseDir = dirname(resolve(path));
  const plan = sub === "suppressions" ? declared : await expandPlanSources(declared, baseDir);

  if (sub === "list") {
    if (json) console.log(JSON.stringify({ config: path, ...plan }, null, 2));
    else console.log(formatPlan(plan, path));
    return;
  }

  if (sub === "suppressions") {
    const soon = readInt(args, "soon", { min: 0 }) ?? 30;
    const summary = summarizeSuppressions(plan.suppressions, soon);
    if (json) console.log(JSON.stringify({ config: path, ...summary }, null, 2));
    else console.log(formatSuppressions(plan.suppressions, soon));
    const requireExpiry = hasFlag(args, "require-expiry");
    const requireOwner = hasFlag(args, "require-owner");
    const problems = summary.expired
      + (requireExpiry ? summary.permanent : 0)
      + (requireOwner ? summary.unowned : 0);
    if (problems > 0 && !hasFlag(args, "advisory")) process.exitCode = 1;
    return;
  }

  if (sub !== "run") {
    console.error(`Unknown gates subcommand: ${sub}\n`);
    printUsage(1);
  }

  // Read every flag before doing any work or printing anything: a typo in
  // --concurrency should not surface after the expiry notice, where it reads
  // like part of the run rather than a usage error.
  const shardSpec = readFlag(args, "shard");
  const shard = shardSpec ? parseShard(shardSpec) : undefined;
  const concurrency = readInt(args, "concurrency", { min: 1 });
  const output = readFlag(args, "output");
  const sharded = shardPlan(plan, shard);
  if (sharded.jobs.length === 0) {
    throw new UsageError(
      `No gate runs selected`
      + (only.length > 0 ? ` by --only ${only.join(", ")}` : "")
      + (shard ? ` in shard ${shard.index}/${shard.total}` : ""),
    );
  }
  // Print stale config BEFORE the run: a gate failing because its suppression
  // lapsed should not look like a fresh regression.
  if (sharded.expired.length > 0) {
    console.error(formatExpiredNotice(sharded.expired));
    console.error("");
  }
  const summary: BatchSummary = await runJobs(
    sharded.jobs.map((j) => ({ gate: j.gate, page: j.source, cwd: baseDir })),
    {
      ...(concurrency !== undefined ? { concurrency } : {}),
      ...(shard ? { shard } : {}),
      ...(output ? { output } : {}),
      quiet: hasFlag(args, "quiet") || json,
    },
  );
  const stale = sharded.expired.length;
  if (json) console.log(JSON.stringify({ config: path, expiredSuppressions: stale, ...summary }, null, 2));
  else {
    console.log(formatBatchSummary(summary, {
      showOutput: hasFlag(args, "show-output"),
      ...(output ? { outputDir: output } : {}),
    }));
    if (stale > 0) {
      console.log("");
      console.log(`${RED}${stale} suppression(s) expired${RESET} — stale config fails the run even when the gates pass.`);
    }
  }
  if ((summary.failed > 0 || stale > 0) && !hasFlag(args, "advisory")) process.exitCode = 1;
}

const isCliEntry = process.env.__VLMKIT_DISPATCHER_LEAF__ === "gates" ||
  (process.argv[1] ? resolve(process.argv[1]) === fileURLToPath(import.meta.url) : false);
if (isCliEntry) main().catch(handleCliError);
