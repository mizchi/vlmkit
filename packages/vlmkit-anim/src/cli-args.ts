/**
 * The argv readers and the error printer the CLI needs, kept here so this
 * package depends on nothing in the vlmkit workspace: it is a standalone tool
 * that shares vlmkit's *evaluation* tooling (the `check animation` gate reads
 * its pages like any other), not vlmkit's CLI plumbing. The semantics match
 * `@mizchi/vlmkit-core/arg-reader.ts` — a missing value is an error, a value
 * that looks like another flag is an error, a numeric flag is validated where
 * it is read — so a reader used to one is not surprised by the other.
 */

/** A bad flag or missing argument: the caller's typo, printed as one line rather than a stack trace. */
export class UsageError extends Error {
  override readonly name = "UsageError";
}

const flagName = (name: string): string => (name.startsWith("-") ? name : `--${name}`);
const looksLikeFlag = (value: string): boolean => /^--/.test(value) || /^-[a-zA-Z]/.test(value);

export function hasFlag(argv: readonly string[], name: string): boolean {
  return argv.includes(flagName(name));
}

/** Last occurrence wins. Throws when the value is missing or is another flag. */
export function readFlag(argv: readonly string[], name: string): string | undefined {
  const flag = flagName(name);
  const index = argv.lastIndexOf(flag);
  if (index < 0) return undefined;
  const value = argv[index + 1];
  if (value === undefined) throw new UsageError(`${flag} needs a value`);
  if (looksLikeFlag(value)) throw new UsageError(`${flag} needs a value, got the next flag ${value}`);
  return value;
}

export function readInt(argv: readonly string[], name: string, opts: { min?: number; max?: number } = {}): number | undefined {
  const raw = readFlag(argv, name);
  if (raw === undefined) return undefined;
  const n = Number(raw);
  if (!Number.isInteger(n)) throw new UsageError(`${flagName(name)} must be an integer, got ${JSON.stringify(raw)}`);
  if (opts.min !== undefined && n < opts.min) throw new UsageError(`${flagName(name)} must be >= ${opts.min}, got ${n}`);
  if (opts.max !== undefined && n > opts.max) throw new UsageError(`${flagName(name)} must be <= ${opts.max}, got ${n}`);
  return n;
}

/** Arguments that are neither a flag nor the value of a flag named in `valueFlags`. */
export function readPositionals(argv: readonly string[], valueFlags: readonly string[] = []): string[] {
  const out: string[] = [];
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (valueFlags.includes(a)) {
      i++;
      continue;
    }
    if (a.startsWith("-")) continue;
    out.push(a);
  }
  return out;
}

/** One line for a usage error or a missing file; the whole error for anything else. Exits 1. */
export function handleCliError(e: unknown): never {
  const err = e as { name?: string; code?: string; message?: string; path?: string };
  if (err?.name === "UsageError") process.stderr.write(`error: ${err.message}\n`);
  else if (err?.code === "ENOENT") process.stderr.write(`error: file not found: ${err.path ?? String(err.message ?? e).match(/'([^']+)'/)?.[1] ?? "?"}\n`);
  else if (err?.code === "EISDIR") process.stderr.write(`error: expected a .json file, got a directory${err.path ? `: ${err.path}` : ""}\n`);
  else console.error(e);
  process.exit(1);
}
