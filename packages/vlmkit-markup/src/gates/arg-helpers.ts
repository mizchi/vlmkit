/**
 * Argument helpers shared by the gate definitions.
 *
 * `@mizchi/vlmkit-core/arg-reader.ts` already refuses to guess (a missing
 * value is an error, `--output --json` does not consume the flag as a
 * value). These are the two or three shapes it does not cover, kept in one
 * place so gates stop re-implementing the loop that produced
 * `Number.parseInt(argv[++i] ?? "12", 10)` twenty times over — a form that
 * silently accepts `--max-findings --json` as `NaN`.
 */

import { readFlag, readInt, readPositionals } from "@mizchi/vlmkit-core/arg-reader.ts";
import { UsageError } from "@mizchi/vlmkit-core/cli-error.ts";

/**
 * Flags that take a value, so `readPositionals` does not mistake the value
 * for a positional. Extend per gate via the `valueFlags` argument.
 */
const COMMON_VALUE_FLAGS = [
  "--viewports",
  "--viewport",
  "--breakpoints",
  "--height",
  "--max-elements",
  "--max-findings",
  "--max-samples",
  "--sweep-step",
  "--timeout",
  "--wait-until",
  "--har",
  "--storage-state",
  "--allow",
  "--contract",
] as const;

export function firstPositional(
  argv: readonly string[],
  usage: string,
  valueFlags: readonly string[] = [],
): string {
  const positionals = readPositionals(argv, [...COMMON_VALUE_FLAGS, ...valueFlags]);
  const first = positionals[0];
  if (!first) throw new UsageError(`missing required argument. Usage: ${usage}`);
  return first;
}

/** `--breakpoints 768,1024` → `[768, 1024]`. Absent flag → `undefined`. */
export function numberList(argv: readonly string[], name: string): number[] | undefined {
  const raw = readFlag(argv, name);
  if (raw === undefined) return undefined;
  const values = raw.split(",").map((part) => part.trim()).filter(Boolean).map((part) => {
    const n = Number.parseInt(part, 10);
    if (!Number.isFinite(n)) throw new UsageError(`--${name}: "${part}" is not a number`);
    return n;
  });
  return values;
}

/** `--viewport 1280x720` → `{width, height}`. */
export function viewportFlag(
  argv: readonly string[],
  name = "viewport",
): { width: number; height: number } | undefined {
  const raw = readFlag(argv, name);
  if (raw === undefined) return undefined;
  const match = raw.match(/^(\d+)x(\d+)$/);
  if (!match) throw new UsageError(`--${name} expects <width>x<height>, got ${JSON.stringify(raw)}`);
  return { width: Number(match[1]), height: Number(match[2]) };
}

export function optionalInt(
  argv: readonly string[],
  name: string,
  options: { min?: number } = {},
): number | undefined {
  return readInt(argv, name, options);
}
