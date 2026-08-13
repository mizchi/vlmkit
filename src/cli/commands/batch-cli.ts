#!/usr/bin/env node
/**
 * `vlmkit batch` — run gates over many pages in parallel.
 *
 * The gate CLIs each take one source. A repo with twenty routes therefore
 * needs twenty invocations, which is why every project that adopted the gates
 * ended up hand-rolling a shell loop, and why nobody could answer "what does
 * this cost in CI".
 *
 * The runner spawns each (gate, page) pair as a child process and reads the
 * verdict off the **exit code** — the one thing every gate agrees on since
 * `gate-exit.ts` unified the contract (suspect/defect ⇒ non-zero, warn ⇒ zero).
 * That keeps the runner gate-agnostic: it needs no knowledge of any report
 * shape, so a new gate is batchable the day it lands. Child processes also
 * mean one page's crashed browser cannot take the run down.
 *
 * Timing is reported per job and in aggregate because the CI question is not
 * "did it pass" but "how long, and how do I shard it".
 */
import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { createHash } from "node:crypto";
import { glob } from "node:fs/promises";
import { mkdir, writeFile } from "node:fs/promises";
import { cpus } from "node:os";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { handleCliError } from "@mizchi/vlmkit-core/cli-error.ts";
import {
  hasFlag,
  readAll,
  readFlag,
  readInt,
  readPositionals,
  tokenizeCommand,
} from "@mizchi/vlmkit-core/arg-reader.ts";
import {
  VLMKIT_IGNORE_ENTRIES,
  appendRunLedger,
  isGitIgnored,
  isGitRepo,
} from "@mizchi/vlmkit-core/run-ledger.ts";
import { BOLD, CYAN, DIM, GREEN, RED, RESET, YELLOW } from "@mizchi/vlmkit-core/terminal-colors.ts";

export interface BatchJob {
  /** Gate command as typed, e.g. `check integrity` or `check design --min-reuse 4`. */
  gate: string;
  /** One page: a file path or a URL. */
  page: string;
  /**
   * Working directory for the gate process. Defaults to this process's.
   *
   * `vlmkit gates run` sets it to the config file's own directory, so a relative
   * path inside the config (`--har dashboard.har`, a `source` glob) resolves
   * against the config rather than against wherever the command was typed. See
   * the note on `runJobs`.
   */
  cwd?: string;
}

/**
 * A gate's own `--json` envelope, when the run asked for one.
 *
 * v7's agent-l: "findings arrive as one ANSI-escaped `output` string, not
 * structured." A CI job that wants the findings had to parse terminal text out of
 * a field meant for humans; the gates have emitted a structured envelope all along
 * and the batch runner simply never asked for it.
 */
export interface GateEnvelope {
  gate?: string;
  command?: string;
  verdict?: string;
  counts?: Record<string, number>;
  findings?: unknown[];
  suppressed?: unknown[];
  retuned?: unknown[];
  report?: unknown;
}

/**
 * Read a child's envelope, or null when it did not produce one.
 *
 * Null on anything unparseable rather than throwing: a gate that died in
 * navigation prints an error, and losing the whole run's JSON because one job
 * failed early would make the machine path less reliable than the prose one.
 */
export function parseGateEnvelope(stdout: string): GateEnvelope | null {
  const text = stdout.trim();
  if (!text.startsWith("{")) return null;
  try {
    const parsed = JSON.parse(text) as unknown;
    return typeof parsed === "object" && parsed !== null ? parsed as GateEnvelope : null;
  } catch {
    return null;
  }
}

export interface BatchJobResult extends BatchJob {
  exitCode: number;
  durationMs: number;
  output: string;
  /** The gate's own `--json` envelope, when the run was asked for JSON. */
  envelope?: GateEnvelope | null;
}

export interface BatchSummary {
  jobs: BatchJobResult[];
  passed: number;
  failed: number;
  /** Wall clock for the whole run. */
  wallMs: number;
  /** Sum of per-job durations — what a shell loop would have cost. */
  serialMs: number;
  concurrency: number;
  shard?: { index: number; total: number };
  /**
   * Artifact directories this run brought into existence that git is not ignoring.
   *
   * The per-gate notice cannot serve this path: gates run as child processes whose
   * stdout the runner suppresses. It also never covered `test-results/` at all —
   * a gate prints `report: <path>` but nothing says the directory is new and
   * untracked, which was half of the original complaint.
   */
  createdArtifacts?: string[];
}

/** `1/3` → `{index: 1, total: 3}`. Throws on anything else, loudly. */
export function parseShard(spec: string): { index: number; total: number } {
  const m = /^(\d+)\/(\d+)$/.exec(spec.trim());
  if (!m) throw new Error(`--shard expects <index>/<total> (1-based), got "${spec}"`);
  const index = Number.parseInt(m[1]!, 10);
  const total = Number.parseInt(m[2]!, 10);
  if (total < 1) throw new Error(`--shard total must be >= 1, got ${total}`);
  if (index < 1 || index > total) throw new Error(`--shard index must be 1..${total}, got ${index}`);
  return { index, total };
}

/**
 * Stride sharding, not contiguous blocks. Pages in the same directory tend to
 * cost the same (a routes/admin/** subtree of dense tables is uniformly slow),
 * so slicing contiguously hands one shard the whole expensive subtree. Stride
 * spreads neighbours across shards.
 */
export function shardPages(pages: string[], shard?: { index: number; total: number }): string[] {
  if (!shard || shard.total === 1) return pages;
  return pages.filter((_, i) => i % shard.total === shard.index - 1);
}

/**
 * Expand positional arguments into a sorted, deduplicated page list. A URL or
 * a plain existing path passes through untouched; anything containing a glob
 * metacharacter is expanded against the cwd.
 */
export async function resolvePages(patterns: string[], cwd = process.cwd()): Promise<string[]> {
  const out = new Set<string>();
  for (const pattern of patterns) {
    if (/^https?:\/\//.test(pattern)) {
      out.add(pattern);
      continue;
    }
    if (!/[*?[\]{}]/.test(pattern)) {
      out.add(pattern);
      continue;
    }
    for await (const hit of glob(pattern, { cwd })) out.add(hit);
  }
  return [...out].sort();
}

/** Flags that consume the next argv entry, so positionals can be told apart. */
const VALUE_FLAGS = ["gate", "concurrency", "shard", "output"];

/** Flat job queue: every gate against every page. */
export function buildJobs(gates: string[], pages: string[]): BatchJob[] {
  return pages.flatMap((page) => gates.map((gate) => ({ gate, page })));
}

/**
 * Bounded-concurrency pool. Deliberately not `Promise.all` in chunks: a chunk
 * barrier idles the pool for the tail of every chunk, which is exactly the
 * waste a batch runner exists to remove.
 */
export async function runPool<T, R>(
  items: T[],
  limit: number,
  worker: (item: T, index: number) => Promise<R>,
  onSettled?: (result: R, index: number) => void,
): Promise<R[]> {
  // A NaN limit used to make `Array.from({length: NaN})` produce zero lanes, so
  // the pool ran NOTHING and returned a list of holes — which then read as
  // success downstream. Fail here instead of somewhere unrelated.
  if (!Number.isFinite(limit) || limit < 1) {
    throw new Error(`runPool needs a concurrency limit >= 1, got ${limit}`);
  }
  const results = new Array<R>(items.length);
  let cursor = 0;
  const lanes = Array.from({ length: Math.max(1, Math.min(limit, items.length)) }, async () => {
    for (;;) {
      const index = cursor++;
      if (index >= items.length) return;
      const result = await worker(items[index]!, index);
      results[index] = result;
      onSettled?.(result, index);
    }
  });
  await Promise.all(lanes);
  return results;
}

export interface BatchOptions {
  gates: string[];
  patterns: string[];
  concurrency?: number;
  shard?: { index: number; total: number };
  output?: string;
  quiet?: boolean;
  /**
   * Ask each child for its `--json` envelope, so the run's machine output carries
   * structured findings rather than the gates' terminal text.
   */
  json?: boolean;
  /** Injected in tests; defaults to the CLI entry this process was started from. */
  cliEntry?: string;
}

/** Default width: leave the machine a core, and don't run 32 browsers at once. */
export function defaultConcurrency(): number {
  return Math.max(1, Math.min(4, cpus().length - 1));
}

function cliEntryPath(explicit?: string): string {
  const entry = explicit ?? process.env.__VLMKIT_CLI_ENTRY__;
  if (entry) return entry;
  // Fall back to the sibling entry module, which is correct for a dev checkout
  // and for the bundled dist (both keep vlmkit next to the commands dir).
  return resolve(fileURLToPath(import.meta.url), "../../vlmkit.ts");
}

function runJob(job: BatchJob, cliEntry: string, json = false): Promise<BatchJobResult> {
  // Quote-aware: a gate flag can legitimately carry a value with spaces
  // (`--manifest "copy/press kit.txt"`, `--mask ".hero, .promo"`), and a plain
  // whitespace split would hand those to the gate as several arguments.
  const args = [
    ...process.execArgv,
    cliEntry,
    ...tokenizeCommand(job.gate),
    job.page,
    // Under `--json` the children are asked for JSON too, so the run's machine
    // output carries the gates' own envelopes instead of their terminal text.
    ...(json ? ["--json"] : []),
  ];
  const started = Date.now();
  return new Promise((resolveJob) => {
    const child = spawn(process.execPath, args, {
      ...(job.cwd ? { cwd: job.cwd } : {}),
      stdio: ["ignore", "pipe", "pipe"],
      // The child is one more gate run; it must not inherit the marker that
      // tells a leaf module "you are the CLI entry".
      env: { ...process.env, __VLMKIT_DISPATCHER_LEAF__: "" },
    });
    // Merged for display, and kept SEPARATE for parsing. `output` interleaves both
    // streams the way a terminal would; a JSON envelope has to be read from stdout
    // alone or a stderr diagnostic lands in the middle of it — which is exactly how
    // the webServer's greeting corrupted `--json` before this.
    let output = "";
    let stdout = "";
    child.stdout.on("data", (d) => { output += d; stdout += d; });
    child.stderr.on("data", (d) => { output += d; });
    child.on("error", (err) => {
      resolveJob({ ...job, exitCode: 127, durationMs: Date.now() - started, output: `${output}${err.message}\n` });
    });
    child.on("close", (code, signal) => {
      resolveJob({
        ...job,
        exitCode: code ?? (signal ? 129 : 1),
        durationMs: Date.now() - started,
        output,
        ...(json ? { envelope: parseGateEnvelope(stdout) } : {}),
      });
    });
  });
}

const slug = (s: string) => s.replace(/[^a-zA-Z0-9._-]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 80);

/**
 * Per-job log filename. Uses the whole source path, not its basename: with
 * `routes/a/index.html` and `routes/b/index.html` a basename-derived name
 * collided, so two concurrent writes raced and one page's failing report was
 * lost. The trailing hash keeps that guarantee when the 80-char cap truncates
 * two long paths to the same prefix.
 */
export function jobLogName(job: BatchJob): string {
  const hash = createHash("sha1").update(`${job.gate}\u0000${job.page}`).digest("hex").slice(0, 6);
  return `${slug(job.gate)}--${slug(job.page)}-${hash}.txt`;
}

/**
 * Run an explicit job list. Split out from `runBatch` so a caller that already
 * knows its (gate, page) pairs — `vlmkit gates run`, where the pairing comes
 * from a config file rather than a cross product — reuses the same pool,
 * timing, log capture and summary instead of reimplementing them.
 */
export async function runJobs(
  jobs: BatchJob[],
  options: Omit<BatchOptions, "gates" | "patterns"> = {},
): Promise<BatchSummary> {
  if (jobs.length === 0) throw new Error("No jobs to run");
  const concurrency = options.concurrency ?? defaultConcurrency();
  const cliEntry = cliEntryPath(options.cliEntry);
  // Which artifact directories already existed. Each gate runs as a CHILD process
  // and its own first-write notice goes to a stdout this runner suppresses, so a
  // `gates run` — the path an adopter actually uses — announced nothing at all.
  // Snapshotting first keeps the report to what THIS run created, rather than
  // nagging on every run about directories the reader has already seen.
  // Every job in a `gates run` shares one cwd (the config's directory) and a bare
  // `batch` sets none, so the common case is a single directory. If they ever
  // disagree, fall back to this process's — reporting one directory's artifacts as
  // another's would be worse than reporting none.
  const jobCwds = new Set(jobs.map((j) => j.cwd ?? process.cwd()));
  const artifactCwd = jobCwds.size === 1 ? [...jobCwds][0]! : process.cwd();
  const preexisting = new Set(
    VLMKIT_IGNORE_ENTRIES.filter((entry) => existsSync(join(artifactCwd, entry.replace(/\/+$/, "")))),
  );
  const started = Date.now();
  let done = 0;
  const results = await runPool(jobs, concurrency, (job) => runJob(job, cliEntry, options.json === true), (result) => {
    done++;
    if (options.quiet) return;
    const status = result.exitCode === 0 ? `${GREEN}pass${RESET}` : `${RED}fail${RESET}`;
    process.stderr.write(
      `${DIM}[${String(done).padStart(String(jobs.length).length)}/${jobs.length}]${RESET} `
      + `${status} ${DIM}${(result.durationMs / 1000).toFixed(1)}s${RESET} ${result.gate} ${result.page}\n`,
    );
  });
  const summary: BatchSummary = {
    jobs: results,
    passed: results.filter((r) => r.exitCode === 0).length,
    failed: results.filter((r) => r.exitCode !== 0).length,
    wallMs: Date.now() - started,
    serialMs: results.reduce((sum, r) => sum + r.durationMs, 0),
    concurrency,
    ...(options.shard ? { shard: options.shard } : {}),
    ...(() => {
      const created = VLMKIT_IGNORE_ENTRIES
        .filter((entry) => !preexisting.has(entry))
        .filter((entry) => existsSync(join(artifactCwd, entry.replace(/\/+$/, ""))))
        .filter((entry) => !isGitIgnored(artifactCwd, join(artifactCwd, entry.replace(/\/+$/, ""))));
      return created.length > 0 && isGitRepo(artifactCwd) ? { createdArtifacts: created } : {};
    })(),
  };
  if (options.output) {
    await mkdir(options.output, { recursive: true });
    await Promise.all(results.map((r) => writeFile(join(options.output!, jobLogName(r)), r.output)));
    await writeFile(
      join(options.output, "batch-summary.json"),
      JSON.stringify({ ...summary, jobs: summary.jobs.map(({ output: _output, ...rest }) => rest) }, null, 2),
    );
  }
  // Into the SAME ledger the children write, not this process's cwd.
  //
  // v7's agent-l noticed the outputs were not where the config was, and the precise
  // defect turned out to be worse than "wrong directory": the children run with the
  // config's directory as their cwd, so `test-results/` and their ledger lines went
  // there, while this append used `process.cwd()`. One `gates run --config
  // ../proj/...` from a sibling directory therefore produced TWO ledgers, in two
  // places, each holding half the run.
  appendRunLedger({
    tool: "batch",
    source: [...new Set(jobs.map((j) => j.page))].join(" ").slice(0, 200),
    headline: {
      gates: new Set(jobs.map((j) => j.gate)).size,
      pages: new Set(jobs.map((j) => j.page)).size,
      failed: summary.failed,
      wallMs: summary.wallMs,
      concurrency,
    },
  }, { cwd: artifactCwd });
  return summary;
}

export async function runBatch(options: BatchOptions): Promise<BatchSummary> {
  const pages = shardPages(await resolvePages(options.patterns), options.shard);
  if (pages.length === 0) {
    throw new Error(
      `No pages matched: ${options.patterns.join(", ")}`
      + (options.shard ? ` (after --shard ${options.shard.index}/${options.shard.total})` : ""),
    );
  }
  return runJobs(buildJobs(options.gates, pages), options);
}

/**
 * Did this job's gate actually measure the page, or die before it started?
 *
 * CI has to tell those apart and the summary used to make them identical. v5's CI
 * agent, on four gates that all died in navigation:
 *
 *   "`verdict: 4 FAILED (0 passed)` with zero reasons and no distinction between
 *    'gate found defects' and 'gate never ran'. CI cannot tell a broken page from a
 *    broken harness."
 *
 * The signal is in the output the child already produced: every gate prints a
 * `verdict:` or `status:` line, or a JSON report under `--json`. A harness failure
 * prints an `error:` line and nothing else.
 */
/**
 * Warns a passing job reported, from the runner's own exit-intent line.
 *
 * `gates run` printed `ALL PASS (6/6)` and nothing else, so an adopting project
 * saw none of the findings. v7's agent-l: "Adopt it naively and you learn
 * nothing. Only `--output` preserves them."
 *
 * Read from `exits 0 — N warn(s) did not fail this command`, which `runGateCli`
 * emits for EVERY gate exactly when it exits 0 with warns — verified across the
 * gate set rather than assumed, after `gateReported` was built on a convention
 * only 8 of 12 gates followed. A gate with no warns prints no line and
 * contributes 0, which is correct by construction; a FAILING job prints none
 * either, and its warns stay behind the re-run hint the failure block already
 * gives.
 */
/**
 * `check design --wait-until load --timeout 15000` -> `check design`.
 *
 * Everything before the first flag. Slicing to a fixed token count split the
 * command mid-flag, and filtering flags out afterwards kept `load` — a flag's
 * value reading as part of the command name.
 */
export function gateVerb(gate: string): string {
  const tokens = gate.trim().split(/\s+/);
  const firstFlag = tokens.findIndex((t) => t.startsWith("-"));
  return (firstFlag === -1 ? tokens : tokens.slice(0, firstFlag)).join(" ");
}

export function reportedWarns(output: string): number {
  const m = /exits 0 [—-] (\d+) warn\(s\)/.exec(stripAnsi(output));
  return m ? Number.parseInt(m[1]!, 10) : 0;
}

export function gateReported(output: string): boolean {
  // The banner, not the verdict line. The first version of this keyed on
  // `verdict:` / `status:`, and I justified that by saying the convention was already
  // load-bearing here — citing this very function, which I had written the same day.
  // Circular, and wrong: **4 of 12 gates print no such line at all.**
  // `check a11y contrast`, `check a11y touch`, `check a11y focus` and `check tokens`
  // go straight from their header to their findings. So a gate that measured the page
  // and found a real WCAG failure was reported to CI as "DID NOT RUN", which v6's
  // adoption agent caught and called disqualifying:
  //
  //   "A gate runner that reports a real accessibility failure as 'did not run' is
  //    worse than no runner: the first time someone checks and finds it *did* run,
  //    they stop reading the summary, and then they stop reading the gate."
  //
  // Every one of the 12 gates checked prints `vlmkit <command>` as its first
  // non-empty line, indented or not, and a harness failure prints `error: …` or a
  // raw stack and no banner. Verified across all of them rather than assumed twice.
  if (/^\s*vlmkit\s+\S/m.test(stripAnsi(output))) return true;
  if (/^\s*(verdict|status):/m.test(output)) return true;
  // `--json` in the gate string: a report is a report even without prose.
  const trimmed = output.trim();
  if (trimmed.startsWith("{") || trimmed.startsWith("[")) {
    try {
      JSON.parse(trimmed);
      return true;
    } catch {
      // A truncated report is not a report.
    }
  }
  return false;
}

/** Colour codes off, so a pattern matches the words rather than the escapes. */
function stripAnsi(text: string): string {
  return text.replace(/\u001B\[[0-9;]*m/g, "");
}

/** The one line worth putting in the summary for a job that never ran. */
export function gateFailureReason(output: string): string {
  const lines = stripAnsi(output).split("\n").map((l) => l.trimEnd()).filter((l) => l.trim());
  // `error: …` is what `handleCliError` prints; fall back to the first line, which
  // for an unhandled throw is the exception message.
  return (lines.find((l) => /^error:/i.test(l)) ?? lines[0] ?? "no output").slice(0, 300);
}

export function formatBatchSummary(
  summary: BatchSummary,
  options: { showOutput?: boolean; outputDir?: string } = {},
): string {
  const lines: string[] = [];
  const pages = new Set(summary.jobs.map((j) => j.page));
  const gates = [...new Set(summary.jobs.map((j) => j.gate))];
  lines.push("");
  lines.push(`${BOLD}${CYAN}vlmkit batch${RESET}`);
  lines.push(
    `${DIM}${pages.size} page(s) x ${gates.length} gate(s) = ${summary.jobs.length} job(s),`
    + ` concurrency ${summary.concurrency}`
    + (summary.shard ? `, shard ${summary.shard.index}/${summary.shard.total}` : "")
    + `${RESET}`,
  );
  lines.push("");
  // Split the failure count, because "the page is broken" and "the run is broken"
  // call for different actions and used to print as one number.
  const neverRan = summary.jobs.filter((j) => j.exitCode !== 0 && !gateReported(j.output));
  lines.push(
    summary.failed === 0
      ? `verdict: ${GREEN}ALL PASS${RESET} (${summary.passed}/${summary.jobs.length})`
      : neverRan.length === 0
        ? `verdict: ${RED}${summary.failed} FAILED${RESET} (${summary.passed} passed)`
        : `verdict: ${RED}${summary.failed - neverRan.length} FAILED${RESET},`
          + ` ${YELLOW}${neverRan.length} DID NOT RUN${RESET} (${summary.passed} passed)`,
  );
  const wall = summary.wallMs / 1000;
  const busy = summary.serialMs / 1000;
  const slowest = [...summary.jobs].sort((a, b) => b.durationMs - a.durationMs)[0];
  // "avg in flight", NOT speedup. Job time inflates under contention (measured:
  // 9 integrity runs on 4 cores summed to 34.9s at concurrency 1 and 64.9s at
  // concurrency 8), so busy/wall would have claimed 5.9x where the real gain
  // over a serial run was 3.2x. Reporting occupancy keeps the number honest.
  lines.push(
    `${DIM}  wall ${wall.toFixed(1)}s, job time ${busy.toFixed(1)}s total`
    + ` (avg ${(busy / Math.max(wall, 0.001)).toFixed(1)} jobs in flight),`
    + ` slowest job ${((slowest?.durationMs ?? 0) / 1000).toFixed(1)}s${RESET}`,
  );
  // Warns a passing job found, said on the summary. Without this the adoption path
  // reported `ALL PASS (6/6)` and showed none of ten findings — the one number an
  // adopting project is running the tool to get.
  if (!options.showOutput) {
    const warned = summary.jobs
      .filter((j) => j.exitCode === 0)
      .map((j) => ({ gate: gateVerb(j.gate), warns: reportedWarns(j.output) }))
      .filter((j) => j.warns > 0);
    const total = warned.reduce((sum, j) => sum + j.warns, 0);
    if (total > 0) {
      lines.push("");
      lines.push(
        `${YELLOW}${total} warn(s)${RESET} in ${warned.length} passing gate(s) — not shown above,`
        + ` and they did not fail the run:`,
      );
      for (const j of warned) lines.push(`${DIM}    ${String(j.warns).padStart(3)}  ${j.gate}${RESET}`);
      lines.push(
        `${DIM}See them: --show-output, or --output <dir> to keep every log.`
        + ` Gate on one: --rule <id>=suspect.${RESET}`,
      );
    }
  }
  // A run can never finish faster than its slowest single job: that is the
  // floor more concurrency cannot buy through, and the number to shard against.
  //
  // Where the run wrote, said ONCE for the whole run. The per-gate first-write
  // notice cannot reach here — each gate is a child process whose stdout this
  // runner suppresses — so a `gates run`, which is the path an adopter actually
  // uses, announced nothing. It also covers `test-results/`, which the per-gate
  // notice never did: a gate prints `report: <path>` but nothing says the
  // directory is new and untracked.
  if (summary.createdArtifacts && summary.createdArtifacts.length > 0) {
    lines.push("");
    lines.push(`${DIM}This run created ${summary.createdArtifacts.length} untracked path(s):${RESET}`);
    for (const entry of summary.createdArtifacts) {
      // Described per entry, because they are different things and only one of
      // them is announced anywhere else: a gate prints `report: <path>` for what
      // it writes under test-results/, while the ledger prints nothing here.
      const what = entry === ".vlmkit/"
        ? "an append-only record of every gate run, one line each"
        : "the gates' own reports and screenshots";
      lines.push(`${DIM}    ${entry.padEnd(15)} ${what}${RESET}`);
    }
    lines.push(
      `${DIM}${summary.createdArtifacts.length === 1 ? "It is not" : "Neither is"} in .gitignore.`
      + ` \`vlmkit gates init\` writes ${summary.createdArtifacts.length === 1 ? "that entry" : "those entries"} for you.${RESET}`,
    );
  }
  lines.push("");
  const failures = summary.jobs.filter((j) => j.exitCode !== 0);
  if (failures.length > 0) {
    lines.push(`${BOLD}Failures${RESET}`);
    for (const f of failures) {
      const ran = gateReported(f.output);
      const mark = ran ? `${RED}x${RESET}` : `${YELLOW}!${RESET}`;
      lines.push(`  ${mark} ${f.gate} ${f.page} ${DIM}(exit ${f.exitCode}, ${(f.durationMs / 1000).toFixed(1)}s)${RESET}`);
      // The reason goes inline for a job that never ran. Re-running to find out why
      // the harness broke is a whole extra cycle, and in CI there may not be one.
      if (!ran) lines.push(`      ${YELLOW}did not run:${RESET} ${gateFailureReason(f.output)}`);
    }
    lines.push("");
    if (options.showOutput) {
      for (const f of failures) {
        lines.push(`${BOLD}${DIM}--- ${f.gate} ${f.page}${RESET}`);
        lines.push(f.output.trimEnd());
        lines.push("");
      }
    } else if (options.outputDir) {
      // The old text offered `--output <dir>` even when `--output <dir>` had just
      // been passed, which reads as "your flag did nothing".
      lines.push(`${DIM}Full logs: ${options.outputDir}${RESET}`);
      lines.push("");
    } else {
      lines.push(`${DIM}Re-run one to see its report, or pass --output <dir> to keep every log:${RESET}`);
      lines.push(`  vlmkit ${failures[0]!.gate} ${failures[0]!.page}`);
      lines.push("");
    }
  }
  const slowJobs = [...summary.jobs].sort((a, b) => b.durationMs - a.durationMs).slice(0, 5);
  if (summary.jobs.length > 5) {
    lines.push(`${BOLD}Slowest jobs${RESET} ${DIM}(shard against these)${RESET}`);
    for (const j of slowJobs) {
      const mark = j.exitCode === 0 ? `${GREEN}pass${RESET}` : `${RED}fail${RESET}`;
      lines.push(`  ${(j.durationMs / 1000).toFixed(1).padStart(6)}s  ${mark}  ${j.gate} ${j.page}`);
    }
  }
  return lines.join("\n");
}

function printUsage(exitCode: number): never {
  console.log(`Usage: vlmkit batch --gate "<gate>" [--gate ...] <page-or-glob...> [options]

Run gates over many pages in parallel. Each (gate, page) pair runs as its own
process; the verdict is that process's exit code, so every gate is batchable
without the runner knowing anything about its report.

Options:
  --gate <cmd>          Gate command, repeatable. Quote it with its own flags:
                        --gate "check integrity" --gate "check design --min-reuse 4"
  --concurrency <n>     Parallel jobs (default: min(4, cores - 1))
  --shard <i/n>         Run only shard i of n (1-based, stride-sliced)
  --output <dir>        Write every job's log plus batch-summary.json
  --show-output         Print failing jobs' reports inline
  --json                Print the summary as JSON
  --quiet               No per-job progress lines
  --advisory            Print failures but exit 0

Exit code: non-zero if any job failed, unless --advisory.

Examples:
  vlmkit batch --gate "check integrity" "routes/**/*.html"
  vlmkit batch --gate "check integrity" --gate "check design" "dist/**/*.html" --concurrency 8
  vlmkit batch --gate "check integrity" "routes/**/*.html" --shard 2/3 --output ci-logs/`);
  process.exit(exitCode);
}

async function main(argv = process.argv.slice(2)): Promise<void> {
  if (hasFlag(argv, "help") || hasFlag(argv, "-h")) printUsage(0);
  const gates = readAll(argv, "gate");
  const patterns = readPositionals(argv, VALUE_FLAGS);
  const concurrency = readInt(argv, "concurrency", { min: 1 });
  const shardSpec = readFlag(argv, "shard");
  const output = readFlag(argv, "output");
  const json = hasFlag(argv, "json");
  if (gates.length === 0 || gates.some((g) => !g.trim())) {
    console.error("At least one --gate is required, e.g. --gate \"check integrity\"\n");
    printUsage(1);
  }
  if (patterns.length === 0) printUsage(1);
  const summary = await runBatch({
    gates,
    patterns,
    ...(concurrency !== undefined ? { concurrency } : {}),
    ...(shardSpec ? { shard: parseShard(shardSpec) } : {}),
    ...(output ? { output } : {}),
    quiet: hasFlag(argv, "quiet"),
  });
  if (json) console.log(JSON.stringify(summary, null, 2));
  else console.log(formatBatchSummary(summary, {
      showOutput: hasFlag(argv, "show-output"),
      ...(output ? { outputDir: output } : {}),
    }));
  if (summary.failed > 0 && !hasFlag(argv, "advisory")) process.exitCode = 1;
}

const isCliEntry = process.env.__VLMKIT_DISPATCHER_LEAF__ === "batch" ||
  (process.argv[1] ? resolve(process.argv[1]) === fileURLToPath(import.meta.url) : false);
if (isCliEntry) main().catch(handleCliError);
