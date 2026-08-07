/**
 * The positional dispatch is written twice. This checks the two copies agree.
 *
 * `markup-core-api/main.mbt` (the direct-JS entry point) and
 * `markup-core-cli/main.mbt` (the spawned one) each carry a hand-written
 * `match args { ["cmd", a, b, …] }` table over the same 61 commands — 1,487 lines
 * that have to stay in step, with nothing checking that they did. The JSON
 * boundary avoids the problem by construction (one dispatch, in the shared
 * package) and has a test asserting so; this is the equivalent for the older path,
 * which is not going away soon.
 *
 * The failure this prevents is quiet by nature. Both backends are reachable at
 * runtime — the direct module normally, the CLI when it will not load — so a
 * command implemented in only one of them, or wired to different arguments,
 * produces correct results until the day something falls back, and then produces
 * wrong ones with no error.
 *
 * ## Scope, stated honestly
 *
 * Two levels, and neither is "all 61 commands are equivalent":
 *
 *   1. **Names, complete.** Both tables must accept exactly the same command set.
 *      This is the whole of the drift class where a command is added to one file
 *      and forgotten in the other.
 *   2. **Behaviour, sampled.** A handful of invocations chosen for their shape —
 *      the 36-argument one, a list-returning one, a boolean one — replayed through
 *      both backends and compared. Full behavioural equivalence would need valid
 *      arguments for every command, which is a fixture corpus, not a test.
 *
 * A malformed argv here is self-reporting: the direct call raises or returns
 * something the assertion rejects, so these samples cannot silently degrade into
 * comparing two error messages.
 */
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, it } from "node:test";
import { ensureMarkupCoreCli } from "./markup-core-runtime.ts";

const packageRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const apiSource = join(packageRoot, "markup-core-api/main.mbt");
const cliSource = join(packageRoot, "markup-core-cli/main.mbt");
const apiModule = join(packageRoot, "_build/js/debug/build/markup-core-api/markup-core-api.js");
const cliModule = join(packageRoot, "_build/js/debug/build/markup-core-cli/markup-core-cli.js");

/**
 * Command names a dispatch table accepts, read from its `match` arms.
 *
 * `--json` is excluded: it is the JSON boundary's marker, handled before the
 * positional table and deliberately present in only one of the two files.
 */
async function dispatchCommands(path: string): Promise<string[]> {
  const source = await readFile(path, "utf8");
  const names = new Set<string>();
  for (const match of source.matchAll(/\[\s*\n?\s*"([a-z0-9-]+)"/g)) names.add(match[1]!);
  names.delete("--json");
  return [...names].sort();
}

/**
 * Direct-JS backend, called the way `runMarkupCore` calls it — **including the
 * empty-argument sentinel**, which is not optional.
 *
 * The direct entry point takes one tab-joined string, and a tab-join cannot
 * represent an empty trailing argument: `["cmd", ""]` and `["cmd"]` both encode to
 * the same thing. So production substitutes `__VLMKIT_EMPTY_ARG__` and MoonBit
 * substitutes it back. Skipping that here made `component-probe-states ""` return
 * the usage message from one backend and an empty string from the other, which
 * looked like a backend asymmetry and was this helper not speaking the protocol.
 *
 * It is also one more cost of the positional design: a legal value that has to be
 * escaped because the encoding has no room for it.
 */
const DIRECT_EMPTY_ARG = "__VLMKIT_EMPTY_ARG__";

function callDirect(argv: readonly string[]): string {
  const api = createRequire(import.meta.url)(apiModule) as {
    run_markup_core: (command: string, encodedArgs: string) => unknown;
  };
  const encoded = argv.slice(1).map((arg) => (arg === "" ? DIRECT_EMPTY_ARG : arg)).join("\t");
  const result = api.run_markup_core(argv[0]!, encoded);
  if (typeof result === "object" && result !== null && "$tag" in result) {
    const tagged = result as { $tag: number; _0: unknown };
    if (tagged.$tag !== 1) throw new Error(`direct call raised: ${String(tagged._0)}`);
    return String(tagged._0).trim();
  }
  return String(result).trim();
}

/** Spawned backend. */
function callSpawned(argv: readonly string[]): string {
  const result = spawnSync(process.execPath, [cliModule, ...argv], { encoding: "utf8" });
  assert.equal(result.status, 0, `CLI exited ${result.status}: ${result.stdout}${result.stderr}`);
  return result.stdout.trim();
}

/**
 * Invocations chosen for shape, with the argument encoding the TypeScript
 * wrappers use (`doubleArg` / `intArg` / `boolArg` and "null" for absent).
 */
const SAMPLES: { label: string; argv: string[]; expect: (output: string) => void }[] = [
  {
    // The extreme case: 36 positional arguments, where a pair swapped between the
    // two tables is least likely to be noticed by reading.
    label: "component-goal-status (36 args)",
    argv: [
      "component-goal-status",
      "landing",
      "0.04", "0.01",
      "0.02", "0.03", "0.05", "0.06",
      "0", "0", "0", "0", "0", "0", "0",
      "true", "true", "true", "false", "true",
      "0", "false", "false", "null", "null", "0",
      "false", "0", "0", "false", "0", "false", "false", "false", "0", "null", "null",
    ],
    expect: (output) =>
      assert.ok(["pass", "review", "fail"].includes(output), `unexpected verdict ${JSON.stringify(output)}`),
  },
  {
    label: "ui-contract-state-issue-ids (pipe-joined list out)",
    argv: ["ui-contract-state-issue-ids", "s1", "hover", "true", "false", "false"],
    expect: (output) => assert.equal(output, "state-target-required"),
  },
  {
    label: "ui-contract-layout-issue-ids (several ids out)",
    argv: ["ui-contract-layout-issue-ids", "fluid", "false", "false", "0", "grid", "0", "0", "grid", "0", "0"],
    expect: (output) => assert.ok(output.includes("layout-width-fluid-bounds"), output),
  },
  {
    label: "is-component-probe-state (boolean out)",
    argv: ["is-component-probe-state", "hover"],
    expect: (output) => assert.equal(output, "true"),
  },
  {
    label: "component-probe-states (empty-ish input)",
    argv: ["component-probe-states", ""],
    expect: (output) => assert.equal(typeof output, "string"),
  },
];

describe("markup-core positional dispatch", { timeout: 240_000 }, () => {
  it("both entry points accept exactly the same commands", async () => {
    const [api, cli] = await Promise.all([dispatchCommands(apiSource), dispatchCommands(cliSource)]);
    // Guard the extractor: a regex that matches nothing would pass vacuously,
    // which is the failure mode this file exists to prevent elsewhere.
    assert.ok(api.length >= 50, `only extracted ${api.length} commands from the API dispatch`);
    assert.deepEqual(
      api,
      cli,
      "the two positional dispatch tables have drifted."
      + " A command in only one of them works until something falls back to the other backend,"
      + " and then answers wrongly with no error. Prefer adding new logic to the JSON boundary"
      + " (docs/design/moonbit-boundary.md), which has one dispatch by construction.",
    );
  });

  describe("both backends answer identically", () => {
    for (const sample of SAMPLES) {
      it(sample.label, () => {
        ensureMarkupCoreCli();
        const direct = callDirect(sample.argv);
        // A malformed argv shows up here rather than as two matching errors.
        sample.expect(direct);
        assert.equal(callSpawned(sample.argv), direct);
      });
    }
  });
});
