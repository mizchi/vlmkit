/**
 * Argv readers that take the array explicitly, and refuse to guess.
 *
 * `cli-args.ts` binds to `process.argv` at import time, which makes it
 * untestable and unusable from a dispatcher-driven leaf. The hand-rolled
 * readers that grew in its place all shared two silent failure modes:
 *
 *   - `--output --json` consumed `--json` as the output directory;
 *   - `--concurrency abc` produced `NaN`, and `NaN` does not fail loudly. It
 *     made `runPool` build zero lanes and "successfully" run nothing.
 *
 * So a missing value is an error, a value that looks like another flag is an
 * error, and a numeric flag is validated where it is read rather than wherever
 * the NaN eventually lands.
 */

import { UsageError } from "./cli-error.ts";

const flagName = (name: string) => (name.startsWith("-") ? name : `--${name}`);

/** A value must not itself look like a flag — `-1` is a value, `--json` is not. */
const looksLikeFlag = (value: string) => /^--/.test(value) || /^-[a-zA-Z]/.test(value);

export function hasFlag(argv: readonly string[], name: string): boolean {
  return argv.includes(flagName(name));
}

/**
 * Last occurrence wins, matching how shells and most CLIs behave when a flag is
 * repeated. Throws when the value is missing or is another flag.
 */
export function readFlag(argv: readonly string[], name: string): string | undefined {
  const flag = flagName(name);
  const index = argv.lastIndexOf(flag);
  if (index < 0) return undefined;
  const value = argv[index + 1];
  if (value === undefined) throw new UsageError(`${flag} needs a value`);
  if (looksLikeFlag(value)) throw new UsageError(`${flag} needs a value, got the next flag ${value}`);
  return value;
}

/** Every occurrence, for repeatable flags (`--gate`, `--only`, `--pages`). */
export function readAll(argv: readonly string[], name: string): string[] {
  const flag = flagName(name);
  const out: string[] = [];
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] !== flag) continue;
    const value = argv[i + 1];
    if (value === undefined) throw new UsageError(`${flag} needs a value`);
    if (looksLikeFlag(value)) throw new UsageError(`${flag} needs a value, got the next flag ${value}`);
    out.push(value);
    i++;
  }
  return out;
}

export interface NumberFlagOptions {
  min?: number;
  max?: number;
  integer?: boolean;
}

export function readNumber(
  argv: readonly string[],
  name: string,
  options: NumberFlagOptions = {},
): number | undefined {
  const raw = readFlag(argv, name);
  if (raw === undefined) return undefined;
  const flag = flagName(name);
  // Always parse the FULL value, even in integer mode: `parseInt("2.5")` is 2,
  // so parsing as an integer first would silently accept a fraction by
  // truncating it out of existence before the integrality check ran.
  const value = Number.parseFloat(raw);
  // `parseFloat("4abc")` is 4; a partially-numeric value is a typo, not a number.
  if (!Number.isFinite(value) || !/^-?\d+(\.\d+)?$/.test(raw.trim())) {
    throw new UsageError(`${flag} must be a number, got "${raw}"`);
  }
  if (options.integer && !Number.isInteger(value)) {
    throw new UsageError(`${flag} must be a whole number, got "${raw}"`);
  }
  if (options.min !== undefined && value < options.min) {
    throw new UsageError(`${flag} must be >= ${options.min}, got ${value}`);
  }
  if (options.max !== undefined && value > options.max) {
    throw new UsageError(`${flag} must be <= ${options.max}, got ${value}`);
  }
  return value;
}

export function readInt(argv: readonly string[], name: string, options: NumberFlagOptions = {}): number | undefined {
  return readNumber(argv, name, { ...options, integer: true });
}

/**
 * Arguments that are neither a flag nor a flag's value.
 *
 * The caller has to name the flags that take values, because argv alone cannot
 * tell `--concurrency 4` (a value) from `--quiet page.html` (a positional). The
 * hand-rolled version of this was a for-loop per CLI that advanced its own
 * index, i.e. the same knowledge encoded three times.
 */
export function readPositionals(argv: readonly string[], valueFlags: readonly string[] = []): string[] {
  const takesValue = new Set(valueFlags.map(flagName));
  const out: string[] = [];
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i]!;
    if (takesValue.has(arg)) {
      i++;
      continue;
    }
    if (arg.startsWith("-")) continue;
    out.push(arg);
  }
  return out;
}

/**
 * Split a command string into argv, honouring quotes.
 *
 * Needed because gate commands are authored as single strings — in a config
 * file (`"check copy --manifest copy/press kit.txt"`) or on the command line
 * (`--gate 'check breakpoints --mask ".hero, .promo"'`). Splitting on
 * whitespace would hand the gate `kit.txt` and `.promo"` as separate
 * arguments, which fails in a way that looks like the gate's fault.
 */
export function tokenizeCommand(command: string): string[] {
  const out: string[] = [];
  let current = "";
  let quote: '"' | "'" | null = null;
  let started = false;
  for (const char of command) {
    if (quote) {
      if (char === quote) quote = null;
      else current += char;
      continue;
    }
    if (char === '"' || char === "'") {
      quote = char;
      started = true;
      continue;
    }
    if (/\s/.test(char)) {
      if (started) out.push(current);
      current = "";
      started = false;
      continue;
    }
    current += char;
    started = true;
  }
  if (quote) throw new UsageError(`Unterminated ${quote} quote in command: ${command}`);
  if (started) out.push(current);
  return out;
}
