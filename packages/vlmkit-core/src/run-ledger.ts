/**
 * Append-only run ledger for agent-loop tools.
 *
 * Every measurement invocation (`build page`, the dynamic gates,
 * `verify markup`) appends one JSONL line to `.vlmkit/run-ledger.jsonl`
 * under the working directory. This turns the "rounds" KPI from an agent
 * self-report into an auditable record: a verifier can check that the
 * agent actually re-measured after each fix, and how the headline numbers
 * moved round by round (see docs/knowledge.md "Markup Agent KPI" — round
 * counts were self-reported and unreliable in 5/5 S5 runs).
 *
 * Writes are best-effort: a ledger failure must never break the tool run.
 * Relocate with `--ledger <path>`, turn it off with `--no-ledger` or
 * VLMKIT_NO_LEDGER=1 (e.g. CI bulk runs).
 */
import { appendFileSync, existsSync, mkdirSync, readFileSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";

export interface RunLedgerEntry {
  /** Tool name, e.g. "build-page", "check-breakpoints", "verify-markup". */
  tool: string;
  /** Primary input (attempt HTML or URL). */
  source: string;
  /** Secondary input (target PNG, manifest, ...) when applicable. */
  target?: string;
  /** Headline numbers, tool-specific but flat (matched/missing/extra/status/diffRatio...). */
  headline: Record<string, string | number | boolean | null>;
}

/** Default location, relative to the working directory. */
export const LEDGER_RELATIVE_PATH = join(".vlmkit", "run-ledger.jsonl");

/**
 * The directories a vlmkit run creates under the working directory. Exported so
 * `gates init` can write them into `.gitignore` and the runner can name them in
 * the first-write notice — one list, so the two cannot disagree.
 *
 * v6's adopting agent had to discover both with `ls` and write the `.gitignore`
 * itself: "adopting the tool dirtied the repo silently."
 */
export const VLMKIT_IGNORE_ENTRIES = [".vlmkit/", "test-results/"] as const;

export interface LedgerWrite {
  /** Absolute path appended to. */
  path: string;
  /** True when this call brought the file into existence. */
  created: boolean;
}

export interface AppendRunLedgerOptions {
  cwd?: string;
  /**
   * Explicit target from `--ledger <path>`. A directory-less path is still
   * resolved against `cwd`, so `--ledger runs.jsonl` lands where the user is.
   */
  path?: string;
  /** `--no-ledger`. Checked here as well as at the call site so both paths agree. */
  disabled?: boolean;
}

/**
 * Run-level ledger settings, set once per process.
 *
 * This is here rather than threaded through the callers because the runner's
 * `gate.ledger` hook is NOT the only writer: sixteen call sites append directly
 * from inside measurement functions (`runDesignPolicyCheck`, `snapshot`,
 * `markup-verify`, ...). `--ledger` and `--no-ledger` implemented at the runner
 * alone would have silently missed fourteen of them — the same shape as the
 * `--wait-until` bug earlier this cycle, where three of 42 `.goto(` sites
 * hand-rolled their options and fixing `navigatePage` changed nothing.
 *
 * A module-level setting is the choke point that covers all of them, and the
 * ledger is already a process-wide side effect configured by a process-wide
 * signal (`VLMKIT_NO_LEDGER`).
 */
let runConfig: AppendRunLedgerOptions = {};
let firstWrite: LedgerWrite | null = null;

/** Replace the run-level settings. Called once per run; resets the first-write record. */
export function configureRunLedger(options: AppendRunLedgerOptions = {}): void {
  runConfig = { ...options };
  firstWrite = null;
}

/**
 * The append that brought the ledger into existence this run, if any.
 *
 * Reported by whoever prints, so a gate that writes from inside its measurement
 * gets the same announcement as one using the `gate.ledger` hook.
 */
export function firstLedgerWrite(): LedgerWrite | null {
  return firstWrite;
}

/**
 * Append one entry. Returns what was written, or `null` when the ledger is off
 * or the write failed — the caller uses that to announce a first write rather
 * than to decide anything.
 */
export function appendRunLedger(
  entry: RunLedgerEntry,
  options: AppendRunLedgerOptions | string = {},
): LedgerWrite | null {
  // Historically the second argument was `cwd`. Kept working because the call
  // sites outnumber the reasons to churn them.
  const explicit: AppendRunLedgerOptions = typeof options === "string" ? { cwd: options } : options;
  // The call site wins where it said something; the run-level settings fill the rest.
  // `--no-ledger` is the exception: it is a refusal, so a call site cannot re-enable it.
  const opts: AppendRunLedgerOptions = { ...runConfig, ...explicit };
  if (opts.disabled || runConfig.disabled || process.env.VLMKIT_NO_LEDGER === "1") return null;
  const cwd = opts.cwd ?? process.cwd();
  const target = opts.path ? resolve(cwd, opts.path) : resolve(cwd, LEDGER_RELATIVE_PATH);
  try {
    const created = !existsSync(target);
    mkdirSync(dirname(target), { recursive: true });
    const line = JSON.stringify({ ts: new Date().toISOString(), ...entry });
    appendFileSync(target, line + "\n");
    const write = { path: target, created };
    if (created && !firstWrite) firstWrite = write;
    return write;
  } catch {
    // Best-effort by design.
    return null;
  }
}

/**
 * Is `target` already covered by the working directory's `.gitignore`?
 *
 * A deliberately shallow read: the top-level `.gitignore` only, matching on the
 * literal entry. Shelling out to `git check-ignore` would be exact and would
 * also mean spawning a process on a path taken once per fresh checkout. The one
 * failure mode of guessing wrong is one extra advisory line, so the cheap check
 * is the right trade — but it must not guess wrong in the *other* direction,
 * which is why anything unreadable counts as "not ignored" rather than ignored.
 */
export function isGitIgnored(cwd: string, target: string): boolean {
  const rel = relative(cwd, target).split("\\").join("/");
  if (!rel || rel.startsWith("..")) return true; // Outside the tree: not ours to warn about.
  try {
    const text = readFileSync(join(cwd, ".gitignore"), "utf8");
    const lines = text.split("\n").map((l) => l.trim()).filter((l) => l && !l.startsWith("#"));
    const segments = rel.split("/");
    return lines.some((line) => {
      const bare = line.replace(/^\/+/, "").replace(/\/+$/, "");
      if (!bare) return false;
      return bare === rel || segments.includes(bare) || rel.startsWith(bare + "/");
    });
  } catch {
    return false;
  }
}

/** Is this working directory a git repo at all? Nothing to advise if it is not. */
export function isGitRepo(cwd: string): boolean {
  return existsSync(join(cwd, ".git"));
}
