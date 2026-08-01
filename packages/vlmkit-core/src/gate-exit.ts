/**
 * One exit-code contract for every gate.
 *
 * Measured during the 2026-08-01 round-10 audit, the behaviour was
 * incoherent: verdict gates (integrity DEFECTS, layout VIOLATED, flow
 * FAILED, markup NOT DONE) exited non-zero on their own, `check
 * interactions` and `scan handlers` also exited non-zero on a suspect, but
 * `check copy`, `check asset` and `scan scroll` exited ZERO unless you
 * remembered `--fail-on-suspect`. Two commands in the same `scan` group
 * disagreed. Worse, the safe-looking default was the dangerous one: a
 * pre-push or CI command that printed a defect and exited 0.
 *
 * The contract is now: **a suspect fails the command.** A verification tool
 * whose default is "found a defect, exiting 0" is a footgun; the burden
 * belongs on the person who wants to ignore findings, not on the person who
 * wants them enforced.
 *
 * `--advisory` opts back into print-and-succeed for gates being piloted
 * before they gate CI — which is the rollout order the docs recommend.
 * `--fail-on-suspect` is kept as an accepted no-op so existing scripts and
 * the published documentation keep working.
 *
 * Warns never affect the exit code, under any flag.
 */

export interface GateExitFlags {
  /** Print findings and exit 0 even when suspects exist. */
  advisory: boolean;
}

/** Parse the shared exit-code flags out of an argv array. */
export function parseGateExitFlags(argv: readonly string[]): GateExitFlags {
  return { advisory: argv.includes("--advisory") };
}

/**
 * Decide the process exit code. `hasSuspect` should count only
 * defect-severity findings; warn-level findings must not reach it.
 */
export function gateExitCode(hasSuspect: boolean, flags: GateExitFlags): 0 | 1 {
  if (!hasSuspect) return 0;
  return flags.advisory ? 0 : 1;
}

/** Shared help text so every gate documents the contract identically. */
export const GATE_EXIT_HELP =
  "  --advisory              Print findings but exit 0 (default: a suspect exits 1)";

/**
 * Apply the contract. Sets `process.exitCode` rather than calling
 * `process.exit` so buffered stdout is not truncated.
 */
export function applyGateExit(hasSuspect: boolean, flags: GateExitFlags): void {
  const code = gateExitCode(hasSuspect, flags);
  if (code !== 0) process.exitCode = code;
}
