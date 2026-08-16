/**
 * Every command a harness invokes must still route.
 *
 * `scripts/smoke-all-clis.sh` was **0 of 22** — every command in it used the flat pre-0.6
 * spelling (`a11y-contrast`, `component-from-image`, `png-diff`) that the group rename
 * replaced, so each one died on "Unknown command". `Test.pkl` was worse: it invoked
 * `src/cli/vrt.ts`, a file that does not exist, so all 22 of its tests failed at spawn.
 *
 * Neither failure was visible. The bash script runs only through `pkf run smoke-all`, which
 * nothing in CI calls, and `Taskfile.pkl` described it as the suite's smoke gate the whole
 * time. `Test.pkl` is reached by `pkspec check` and `pkspec lint`, which verify that every
 * approved Scenario HAS a test and that descriptions are well-formed — not that the tests
 * run. So two harnesses advertised coverage they had not provided since the rename.
 *
 * `src/cli/binary-name.test.ts` could not catch it either: it greps the CLI's *own help
 * output* for `vrt`, and a dead command inside a shell script is not help output.
 *
 * This test closes that gap the cheap way — parse the commands out of the harnesses and ask
 * the CLI whether each one routes. It does not run the gates (that is the smoke's job, and
 * it needs a browser); routing is the part that silently rotted.
 */
import assert from "node:assert/strict";
import { describe, it } from "vitest";
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const ROOT = resolve(import.meta.dirname!, "..", "..");
const ENTRY = resolve(ROOT, "src", "cli", "vlmkit.ts");

const strip = (s: string): string => s.replace(/\x1b\[[0-9;]*m/g, "");

/** `--help` for a command, however it exits: groups without a leaf exit non-zero. */
function help(args: string[]): string {
  try {
    return strip(execFileSync(process.execPath, ["--experimental-strip-types", ENTRY, ...args], {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
      env: { ...process.env, NO_COLOR: "1" },
    }));
  } catch (e) {
    const err = e as { stdout?: string; stderr?: string };
    return strip((err.stdout ?? "") + (err.stderr ?? ""));
  }
}

/**
 * Commands invoked in the bash smoke, as written.
 *
 * Taken from the real invocation prefix rather than a hand-kept list, so a command added to
 * the script is covered without anyone remembering to add it here.
 */
function bashSmokeCommands(): string[] {
  const text = readFileSync(resolve(ROOT, "scripts", "smoke-all-clis.sh"), "utf8");
  const found = new Set<string>();
  for (const m of text.matchAll(/src\/cli\/vlmkit\.ts((?: +[a-z][\w-]*)+)/g)) {
    // Stop at the first token that is not a command word — the fixture path or a flag.
    const words = m[1]!.trim().split(/\s+/);
    if (words.length > 0) found.add(words.join(" "));
  }
  return [...found].sort();
}

/** The same, for the Pkl smoke, which interpolates the entry point as `\(vlmkit)`. */
function pklSmokeCommands(): string[] {
  const text = readFileSync(resolve(ROOT, "Test.pkl"), "utf8");
  const found = new Set<string>();
  for (const m of text.matchAll(/cmd = "\\\(vlmkit\)((?: +[a-z][\w-]*)+)/g)) {
    found.add(m[1]!.trim().split(/\s+/).join(" "));
  }
  return [...found].sort();
}

/**
 * Whether the CLI recognises a command.
 *
 * Asserting on the absence of "Unknown command" rather than on exit 0, because several
 * groups exit non-zero when handed no leaf and that is not the same as not existing.
 */
function routes(command: string): boolean {
  const text = help([...command.split(" "), "--help"]);
  return !/Unknown command/i.test(text);
}

describe("scripts/smoke-all-clis.sh", () => {
  const commands = bashSmokeCommands();

  it("names a plausible number of commands — guards against a parse that found nothing", () => {
    // Without this, a changed invocation prefix makes every assertion below vacuous and the
    // test reports success over an empty list. That is the exact failure mode being fixed.
    assert.ok(commands.length >= 15, `only parsed ${commands.length}: ${commands.join(", ")}`);
  });

  for (const command of bashSmokeCommands()) {
    it(`\`vlmkit ${command}\` routes`, () => {
      assert.ok(routes(command), `the smoke script invokes \`vlmkit ${command}\`, which does not route`);
    });
  }

  it("uses no flat pre-0.6 command spelling", () => {
    // The specific rot: each of these routed before the group rename and none does now.
    const renamed = [
      "a11y-contrast", "a11y-touch", "a11y-focus-order", "design-tokens", "theme-parity",
      "i18n-stress", "media-variants", "cross-browser", "component-consistency",
      "multi-page-consistency", "component-from-image", "component-extract", "png-diff",
    ];
    const offenders = commands.filter((c) => renamed.includes(c));
    assert.deepEqual(offenders, [], `flat pre-0.6 spellings: ${offenders.join(", ")}`);
  });
});

describe("Test.pkl", () => {
  it("invokes an entry point that exists", () => {
    // It invoked `src/cli/vrt.ts` — no such file since the rename — so all 22 tests failed
    // at spawn while `pkspec check` reported full Scenario coverage.
    const text = readFileSync(resolve(ROOT, "Test.pkl"), "utf8");
    const entry = /local vlmkit = "[^"]*?(src\/cli\/[\w.-]+)"/.exec(text)?.[1];
    assert.ok(entry, "Test.pkl no longer declares a `local vlmkit = \"… src/cli/…\"` entry point");
    assert.equal(entry, "src/cli/vlmkit.ts");
  });

  const commands = pklSmokeCommands();

  it("names a plausible number of commands", () => {
    assert.ok(commands.length >= 15, `only parsed ${commands.length}: ${commands.join(", ")}`);
  });

  for (const command of pklSmokeCommands()) {
    it(`\`vlmkit ${command}\` routes`, () => {
      assert.ok(routes(command), `Test.pkl invokes \`vlmkit ${command}\`, which does not route`);
    });
  }

  it("asserts on stdout the current CLI can actually print", () => {
    // `expectStdoutContains { "vrt a11y-touch" }` could never match: the gates print their
    // own header as `vlmkit <command>`. An assertion that cannot pass is not a weaker gate
    // than none, it is a false claim of one.
    const text = readFileSync(resolve(ROOT, "Test.pkl"), "utf8");
    const stale = [...text.matchAll(/expectStdoutContains \{[^}]*"(vrt[^"]*)"/g)].map((m) => m[1]!);
    assert.deepEqual(stale, [], `these expect stdout no gate emits: ${stale.join(", ")}`);
  });
});
