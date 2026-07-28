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
 * Opt out with VLMKIT_NO_LEDGER=1 (e.g. CI bulk runs).
 */
import { appendFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";

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

export function appendRunLedger(entry: RunLedgerEntry, cwd = process.cwd()): void {
  if (process.env.VLMKIT_NO_LEDGER === "1") return;
  try {
    const dir = join(cwd, ".vlmkit");
    mkdirSync(dir, { recursive: true });
    const line = JSON.stringify({ ts: new Date().toISOString(), ...entry });
    appendFileSync(join(dir, "run-ledger.jsonl"), line + "\n");
  } catch {
    // Best-effort by design.
  }
}
