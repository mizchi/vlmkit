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
import { glob } from "node:fs/promises";
import { mkdir, writeFile } from "node:fs/promises";
import { cpus } from "node:os";
import { basename, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { handleCliError } from "@mizchi/vlmkit-core/cli-error.ts";
import { appendRunLedger } from "@mizchi/vlmkit-core/run-ledger.ts";
import { BOLD, CYAN, DIM, GREEN, RED, RESET, YELLOW } from "@mizchi/vlmkit-core/terminal-colors.ts";

export interface BatchJob {
  /** Gate command as typed, e.g. `check integrity` or `check design --min-reuse 4`. */
  gate: string;
  /** One page: a file path or a URL. */
  page: string;
}

export interface BatchJobResult extends BatchJob {
  exitCode: number;
  durationMs: number;
  output: string;
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

function runJob(job: BatchJob, cliEntry: string): Promise<BatchJobResult> {
  const args = [...process.execArgv, cliEntry, ...job.gate.split(/\s+/).filter(Boolean), job.page];
  const started = Date.now();
  return new Promise((resolveJob) => {
    const child = spawn(process.execPath, args, {
      stdio: ["ignore", "pipe", "pipe"],
      // The child is one more gate run; it must not inherit the marker that
      // tells a leaf module "you are the CLI entry".
      env: { ...process.env, __VRT_DISPATCHER_LEAF__: "" },
    });
    let output = "";
    child.stdout.on("data", (d) => { output += d; });
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
      });
    });
  });
}

const slug = (s: string) => s.replace(/[^a-zA-Z0-9._-]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 80);

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
  const started = Date.now();
  let done = 0;
  const results = await runPool(jobs, concurrency, (job) => runJob(job, cliEntry), (result) => {
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
  };
  if (options.output) {
    await mkdir(options.output, { recursive: true });
    await Promise.all(results.map((r) =>
      writeFile(join(options.output!, `${slug(r.gate)}--${slug(basename(r.page))}.txt`), r.output)
    ));
    await writeFile(
      join(options.output, "batch-summary.json"),
      JSON.stringify({ ...summary, jobs: summary.jobs.map(({ output: _output, ...rest }) => rest) }, null, 2),
    );
  }
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
  });
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

export function formatBatchSummary(summary: BatchSummary, options: { showOutput?: boolean } = {}): string {
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
  lines.push(
    summary.failed === 0
      ? `verdict: ${GREEN}ALL PASS${RESET} (${summary.passed}/${summary.jobs.length})`
      : `verdict: ${RED}${summary.failed} FAILED${RESET} (${summary.passed} passed)`,
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
  // A run can never finish faster than its slowest single job: that is the
  // floor more concurrency cannot buy through, and the number to shard against.
  lines.push("");
  const failures = summary.jobs.filter((j) => j.exitCode !== 0);
  if (failures.length > 0) {
    lines.push(`${BOLD}Failures${RESET}`);
    for (const f of failures) {
      lines.push(`  ${RED}x${RESET} ${f.gate} ${f.page} ${DIM}(exit ${f.exitCode}, ${(f.durationMs / 1000).toFixed(1)}s)${RESET}`);
    }
    lines.push("");
    if (options.showOutput) {
      for (const f of failures) {
        lines.push(`${BOLD}${DIM}--- ${f.gate} ${f.page}${RESET}`);
        lines.push(f.output.trimEnd());
        lines.push("");
      }
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
  if (argv.includes("--help") || argv.includes("-h")) printUsage(0);
  const gates: string[] = [];
  const patterns: string[] = [];
  let concurrency: number | undefined;
  let shard: { index: number; total: number } | undefined;
  let output: string | undefined;
  let json = false;
  let quiet = false;
  let showOutput = false;
  let advisory = false;
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i]!;
    if (arg === "--gate") gates.push(argv[++i] ?? "");
    else if (arg === "--concurrency") concurrency = Number.parseInt(argv[++i] ?? "", 10);
    else if (arg === "--shard") shard = parseShard(argv[++i] ?? "");
    else if (arg === "--output") output = argv[++i];
    else if (arg === "--json") json = true;
    else if (arg === "--quiet") quiet = true;
    else if (arg === "--show-output") showOutput = true;
    else if (arg === "--advisory") advisory = true;
    else if (!arg.startsWith("-")) patterns.push(arg);
  }
  if (gates.length === 0 || gates.some((g) => !g.trim())) {
    console.error("At least one --gate is required, e.g. --gate \"check integrity\"\n");
    printUsage(1);
  }
  if (patterns.length === 0) printUsage(1);
  if (concurrency !== undefined && (!Number.isFinite(concurrency) || concurrency < 1)) {
    throw new Error(`--concurrency must be >= 1, got "${concurrency}"`);
  }
  const summary = await runBatch({
    gates,
    patterns,
    ...(concurrency !== undefined ? { concurrency } : {}),
    ...(shard ? { shard } : {}),
    ...(output ? { output } : {}),
    quiet,
  });
  if (json) console.log(JSON.stringify(summary, null, 2));
  else console.log(formatBatchSummary(summary, { showOutput }));
  if (summary.failed > 0 && !advisory) process.exitCode = 1;
}

const isCliEntry = process.env.__VRT_DISPATCHER_LEAF__ === "batch" ||
  (process.argv[1] ? resolve(process.argv[1]) === fileURLToPath(import.meta.url) : false);
if (isCliEntry) main().catch(handleCliError);
