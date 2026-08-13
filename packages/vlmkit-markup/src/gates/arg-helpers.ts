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

import { createHash } from "node:crypto";
import { basename, join, resolve } from "node:path";
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
  // `check integrity --elements <json> --image <png>`: without these, the flag values
  // would be read as the positional page source and image mode would look like it had
  // been given a page.
  "--elements",
  "--image",
] as const;

export function firstPositional(
  argv: readonly string[],
  usage: string,
  valueFlags: readonly string[] = [],
): string {
  const first = firstPositionalOrUndefined(argv, valueFlags);
  if (!first) throw new UsageError(`missing required argument. Usage: ${usage}`);
  return first;
}

/**
 * The first positional, or `undefined` when there is none.
 *
 * For gates whose source is optional because another flag supplies the input — the
 * distinction `check integrity` needs in order to *reject* being given both a page and
 * `--elements` rather than silently preferring one.
 */
export function firstPositionalOrUndefined(
  argv: readonly string[],
  valueFlags: readonly string[] = [],
): string | undefined {
  return readPositionals(argv, [...COMMON_VALUE_FLAGS, ...valueFlags])[0];
}

/**
 * Drop an optionally-valued flag and whatever value it consumed.
 *
 * `readPositionals` takes a list of flags that *always* take a value, which
 * cannot express `--vlm` (bare = default model, or `--vlm <id>`). Listing it
 * would make bare `--vlm page.html` eat the source; omitting it made
 * `--vlm <model> page.html` return the model id AS the source — the gate then
 * tried to open `bytedance/ui-tars-1.5-7b` as a file. Both `check copy` and
 * `check equivalence` shipped the second bug.
 *
 * The rule here is `vlmFlag`'s rule, so the two cannot disagree about which
 * token is the model: the next token is the value iff it does not start with
 * `-`. With that token removed, `--vlm page.html --target t.png` has no
 * positional left and fails with the usage line, which is the honest outcome
 * for a genuinely ambiguous command line.
 */
export function withoutOptionalValue(argv: readonly string[], name: string): string[] {
  const flag = `--${name}`;
  const out: string[] = [];
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i]!;
    if (arg !== flag) {
      out.push(arg);
      continue;
    }
    const next = argv[i + 1];
    if (next !== undefined && !next.startsWith("-")) i++;
  }
  return out;
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

/**
 * Like `numberList`, but for scales that are legitimately fractional
 * (`--tolerance`-adjacent flags such as `--radius-scale 0,2,4.5`).
 */
export function numberListFloat(argv: readonly string[], name: string): number[] | undefined {
  const raw = readFlag(argv, name);
  if (raw === undefined) return undefined;
  return raw.split(",").map((part) => part.trim()).filter(Boolean).map((part) => {
    const n = Number.parseFloat(part);
    if (!Number.isFinite(n)) throw new UsageError(`--${name}: "${part}" is not a number`);
    return n;
  });
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

/**
 * `--vlm` (use the default model) or `--vlm <model-id>`. Returns `undefined`
 * when the flag is absent, which is the "stay deterministic" default —
 * every gate that accepts a VLM works without one.
 *
 * `readFlag` cannot express this: the value is optional, so a bare `--vlm`
 * followed by another flag must not consume it.
 */
export function vlmFlag(argv: readonly string[], name = "vlm"): string | true | undefined {
  const index = argv.lastIndexOf(`--${name}`);
  if (index < 0) return undefined;
  const next = argv[index + 1];
  return next !== undefined && !next.startsWith("-") ? next : true;
}

/**
 * Default output directory for a gate run, keyed on what the run measured.
 *
 * One directory per gate is a clobber waiting to happen, and it has now bitten twice.
 * v2's evidence agent read somebody else's report out of `check drift component`'s
 * shared path — "`cat test-results/component-consistency/report.md` returned a
 * *different* run [...] A parallel agent had clobbered it. I trusted the terminal."
 * That was fixed for drift alone. v5's repair agent then noticed `check a11y contrast`
 * writing to the repo root, and measuring it showed the same defect: two pages one
 * after the other share `report.md` AND `page.png`, so the second silently replaces
 * the first.
 *
 * `discriminator` is for a gate where the source is not the whole question - drift
 * passes its `--selector`, since two selectors on one page are two different runs.
 */
export function runOutputDir(gateDir: string, source: string, discriminator = ""): string {
  const name = basename(source).replace(/\.[^.]+$/, "") || "page";
  // Hashed, not embedded: a URL source or a long selector is not a path component, and
  // two sources can share a basename. The readable half stays first so the directory is
  // still recognisable at a glance.
  const hash = createHash("sha1").update(resolve(source) + " " + discriminator).digest("hex").slice(0, 8);
  return join(process.cwd(), "test-results", gateDir, name.replace(/[^A-Za-z0-9._-]+/g, "-") + "-" + hash);
}
