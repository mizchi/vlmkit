/**
 * Shared CLI argument helpers, kept as the ergonomic `process.argv`-bound
 * facade over `arg-reader.ts`.
 *
 * This used to be a standalone implementation, and it silently produced wrong
 * values. `getArg("seed", fallback)` returned whatever followed the flag, so
 * `fix-loop --seed --mode selector` yielded `"--mode"`, and the caller's
 * `parseInt` turned that into a `NaN` seed with no complaint. Every reader here
 * now delegates to `arg-reader`, which treats a flag-shaped value and a
 * non-numeric number as errors.
 *
 * `argv()` is read per call rather than captured at import time, so a leaf
 * reached through the CLI dispatcher — which rewrites `process.argv` before
 * loading the leaf — sees the arguments it was actually given.
 */
import {
  hasFlag as hasFlagIn,
  readAll,
  readFlag,
  readNumber,
  readPositionals,
} from "./arg-reader.ts";

const argv = (): string[] => process.argv.slice(2);

export function getArg(name: string, fallback: string): string;
export function getArg(name: string): string | undefined;
export function getArg(name: string, fallback?: string): string | undefined {
  const value = readFlag(argv(), name);
  // An empty value counts as absent, which is the behaviour callers were
  // written against (`--image ""` should fall back, not blank the path).
  return value === undefined || value === "" ? fallback : value;
}

/**
 * Numeric flags, validated. Callers used to write `parseInt(getArg(n, d), 10)`,
 * which is where a bad value became `NaN` — far from the flag that caused it.
 */
export function getIntArg(name: string, fallback: number, options: { min?: number; max?: number } = {}): number {
  return readNumber(argv(), name, { ...options, integer: true }) ?? fallback;
}

export function getFloatArg(name: string, fallback: number, options: { min?: number; max?: number } = {}): number {
  return readNumber(argv(), name, options) ?? fallback;
}

export function hasFlag(name: string): boolean {
  return hasFlagIn(argv(), name);
}

export function getArgValues(name: string): string[] {
  return readAll(argv(), name);
}

/**
 * Positional arguments.
 *
 * `valueFlags` names the flags that consume the next argument — required,
 * because argv alone cannot tell `--limit 30` from `--md model-name`. The old
 * implementation assumed *every* flag takes a value, which silently dropped a
 * positional that happened to follow a boolean flag.
 */
export function getPositionalArgs(valueFlags: readonly string[] = []): string[] {
  return readPositionals(argv(), valueFlags);
}

/** Raw argv tail, for callers doing their own scanning. */
export function getRawArgs(): string[] {
  return argv();
}

/**
 * @deprecated Captured at import time, so it is empty or stale in a leaf loaded
 * through the dispatcher. Use `getRawArgs()`.
 */
export const args = argv();
