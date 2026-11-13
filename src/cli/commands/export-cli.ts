/**
 * `vlmkit export playwright <trace.json>`: a session trace (`vlmkit-trace/1`, from `vlmkit record`
 * or `vlmkit act --trace`) as an `@playwright/test` spec. Deterministic: the same trace gives the
 * same spec, and no model is asked. `--verify` runs the spec with Playwright's own runner, twice,
 * and exits 1 unless both pass: a recorded session that does not replay is not a test yet.
 */
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { isCliEntry } from "@mizchi/vlmkit-core/plugin/cli-entry.ts";
import { hasFlag, readFlag } from "@mizchi/vlmkit-core/arg-reader.ts";
import { UsageError } from "@mizchi/vlmkit-core/cli-error.ts";
import { DIM, GREEN, RED, RESET } from "@mizchi/vlmkit-core/terminal-colors.ts";
import { compileTrace, parseSessionTrace } from "@mizchi/vlmkit-judge/session-trace.ts";

const USAGE = `vlmkit export playwright <trace.json> [--out tests/recorded.spec.ts] [options]

Writes an @playwright/test spec from a session trace (vlmkit record, or vlmkit act --trace): each
step's action with its best locator (test id, role and name, label, placeholder, text, a CSS
path last), and each change the step was observed to make as an expect. Same trace, same spec.

Options:
  --out <file>         where to write the spec (default: print it)
  --title <text>       the test's title
  --base-url <origin>  URLs under this origin are written as paths, for your config's use.baseURL
  --verify [n]         run the spec n times (default 2) with @playwright/test; exit 1 unless every run passes`;

export async function main(argv = process.argv.slice(2)): Promise<number> {
  if (argv[0] !== "playwright" || argv.length < 2 || hasFlag(argv, "help") || argv.includes("-h")) {
    console.log(USAGE);
    return argv.length === 0 || argv[0] !== "playwright" ? 2 : 0;
  }
  const rest = argv.slice(1);
  const valued = new Set(["--out", "--title", "--base-url"]);
  const v = rest.indexOf("--verify");
  const verifyCount = v >= 0 && /^\d+$/.test(rest[v + 1] ?? "") ? v + 1 : -1;
  const positional = rest.filter(
    (a, i) => !a.startsWith("--") && i !== verifyCount && !(i > 0 && valued.has(rest[i - 1]!)),
  );
  if (positional.length !== 1) throw new UsageError(`export playwright takes one trace file, got ${positional.length}`);
  const tracePath = positional[0]!;
  const trace = parseSessionTrace(await readFile(tracePath, "utf8"), tracePath);
  const title = readFlag(rest, "title");
  const baseUrl = readFlag(rest, "base-url");
  const spec = compileTrace(trace, {
    tracePath,
    ...(title ? { title } : {}),
    ...(baseUrl ? { baseUrl } : {}),
  });
  const out = readFlag(rest, "out");
  if (out) {
    await mkdir(dirname(resolve(out)), { recursive: true });
    await writeFile(resolve(out), spec);
    console.log(
      `${GREEN}spec${RESET} ${resolve(out)}  ${DIM}${trace.steps.length} step(s), ${trace.steps.reduce((n, s) => n + s.expect.length, 0)} expect(s)${RESET}`,
    );
  } else if (!hasFlag(rest, "verify")) process.stdout.write(spec);

  if (hasFlag(rest, "verify")) {
    if (baseUrl)
      throw new UsageError(
        "--verify runs the spec as written; with --base-url it needs your project's config, so run it there",
      );
    const times = verifyCount >= 0 ? Math.max(1, Number(rest[verifyCount])) : 2;
    const { runSpec } = await import("@mizchi/vlmkit-markup/record/run-spec.ts");
    for (let i = 1; i <= times; i++) {
      const run = runSpec(spec);
      if (!run.passed) {
        console.log(`${RED}run ${i} of ${times} failed${RESET}\n${run.output.trim()}`);
        return 1;
      }
      console.log(`${GREEN}run ${i} of ${times} passed${RESET}`);
    }
  }
  return 0;
}

if (isCliEntry(import.meta.url, "export-cli")) {
  const { handleCliError } = await import("@mizchi/vlmkit-core/cli-error.ts");
  main()
    .then((code) => {
      process.exitCode = code;
    })
    .catch(handleCliError);
}
