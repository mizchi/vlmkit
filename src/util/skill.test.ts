import assert from "node:assert/strict";
import { afterAll, beforeAll, beforeEach, describe, it } from "vitest";
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import {
  checkArgv,
  checkStatus,
  checkToFlags,
  diagnoseLaunchFailure,
  listSkills,
  loadSkill,
  renderSkillReport,
  runSkill,
  toolCommand,
  type Skill,
  type SkillRunResult,
} from "./skill.ts";

/**
 * `vlmkit skill` — per-project check playbooks.
 *
 * This module was at 0% coverage and entirely broken: `runOneCheck` spawned
 * `src/vrt.ts`, a path that stopped existing when 0.9.0 renamed the entry to
 * `src/cli/vlmkit.ts`, so every check in every skill died in Node's module
 * resolution. The report rendered those deaths as `exit 1` with a stack-trace tail,
 * which reads as "the checks found problems".
 *
 * Most of what is asserted here is pure — the argv a check becomes, the flag
 * mapping, the launch-failure diagnosis, the markdown. `runSkill` itself spawns the
 * real CLI, so exactly one test does that, with the cheapest gate available.
 */

const dir = mkdtempSync(join(tmpdir(), "vlmkit-skill-"));
const skillsDir = join(dir, ".vrt-skills");
mkdirSync(skillsDir, { recursive: true });

function skillFile(name: string, skill: Partial<Skill>): void {
  writeFileSync(join(skillsDir, `${name}.json`), JSON.stringify({ name, checks: [], ...skill }));
}

const fixture = join(dir, "page.html");
writeFileSync(fixture, `<!doctype html><meta charset="utf-8"><title>card</title>
<style>
  body { margin: 0; font: 16px sans-serif; background: #fff; }
  .card { padding: 13px; background: #eeeeee; color: #bbbbbb; }
</style>
<body><div class="card">Low contrast card</div></body>`);

let lines: string[] = [];
const realLog = console.log;
beforeAll(() => { console.log = (...a: unknown[]) => { lines.push(a.map(String).join(" ")); }; });
afterAll(() => { console.log = realLog; });
beforeEach(() => { lines = []; });
const output = () => lines.join("\n").replace(/\[[0-9;]*m/g, "");

describe("toolCommand", () => {
  it("passes a canonical multi-token command through unchanged", () => {
    assert.deepEqual(toolCommand("check a11y contrast"), ["check", "a11y", "contrast"]);
    assert.deepEqual(toolCommand("stress media"), ["stress", "media"]);
    assert.deepEqual(toolCommand("check integrity"), ["check", "integrity"]);
  });

  it("maps every pre-0.9 single-token name to the command that replaced it", () => {
    // These are what existing `.vrt-skills/*.json` files contain, and the reason a
    // legacy map exists at all. The old code had them in a `KNOWN_TOOLS` set used to
    // *validate*, which meant a skill naming a removed command passed validation and
    // then failed at spawn.
    assert.deepEqual(toolCommand("a11y-contrast"), ["check", "a11y", "contrast"]);
    assert.deepEqual(toolCommand("a11y-focus-order"), ["check", "a11y", "focus"]);
    assert.deepEqual(toolCommand("design-tokens"), ["check", "tokens"]);
    assert.deepEqual(toolCommand("theme-parity"), ["check", "theme"]);
    assert.deepEqual(toolCommand("i18n-stress"), ["stress", "i18n"]);
    assert.deepEqual(toolCommand("media-variants"), ["stress", "media"]);
    assert.deepEqual(toolCommand("component-consistency"), ["check", "drift", "component"]);
    assert.deepEqual(toolCommand("multi-page-consistency"), ["check", "drift", "pages"]);
    assert.deepEqual(toolCommand("interact"), ["inspect", "interact"]);
    assert.deepEqual(toolCommand("explore"), ["inspect", "explore"]);
    assert.deepEqual(toolCommand("component-from-image"), ["build", "component"]);
    // `diff browsers`, not `stress cross-browser` — the module is
    // `stress/cross-browser.ts` but the command is registered under `diff`. I wrote
    // the map from the file path first and this was the entry it got wrong.
    assert.deepEqual(toolCommand("cross-browser"), ["diff", "browsers"]);
  });

  it("leaves an unknown name alone so the CLI is the one to reject it", () => {
    // Validation belongs to the CLI, which cannot disagree with what is installed.
    assert.deepEqual(toolCommand("a11y-kontrast"), ["a11y-kontrast"]);
  });

  it("every legacy alias points at a command that exists", async () => {
    // The guard that matters. A hand-maintained table of command names is exactly
    // what rotted here once already — `KNOWN_TOOLS` still listed the pre-0.9 names
    // after 0.9.0 removed them, and nothing noticed because nothing compared it to
    // the CLI. So compare it to the CLI: the gate registry and the legacy leaf table
    // together are every command `vlmkit` accepts.
    const [{ loadGateRegistry }, { legacySpecLeaves }] = await Promise.all([
      import("../cli/gate-registry.ts"),
      import("../cli/cli.ts"),
    ]);
    const known = new Set<string>();
    for (const { gate } of (await loadGateRegistry()).list()) known.add(gate.command.join(" "));
    for (const [group, leaf] of legacySpecLeaves()) known.add(`${group} ${leaf}`);
    assert.ok(known.size > 30, `only ${known.size} commands resolved — the lookup is broken, not the map`);

    // Drive every alias through `toolCommand`, since that is what a skill file's
    // `tool` field goes through.
    const aliases = [
      "a11y-contrast", "a11y-touch", "a11y-focus-order", "design-tokens", "theme-parity",
      "i18n-stress", "media-variants", "cross-browser", "component-consistency",
      "multi-page-consistency", "interact", "explore", "perf", "component-from-image",
    ];
    const dangling = aliases
      .map((a) => [a, toolCommand(a).join(" ")] as const)
      .filter(([, target]) => !known.has(target));
    assert.deepEqual(
      dangling.map(([a, t]) => `${a} → ${t}`),
      [],
      "a legacy alias points at a command that no longer exists; update the map, "
      + "and prefer the CLI's own tables over the module's file path — `cross-browser` "
      + "lives in `stress/` but its command is `diff browsers`",
    );
  });
});

describe("checkArgv", () => {
  it("puts the target as the first positional and the output dir last", () => {
    assert.deepEqual(
      checkArgv("check tokens", "page.html", ["--strict"], "/out/tokens"),
      ["check", "tokens", "page.html", "--strict", "--output-dir", "/out/tokens"],
    );
  });

  it("gives `check drift pages` no positional, under either spelling of its name", () => {
    // It takes its pages through repeatable --urls / --files, so a positional would
    // look like a stray argument and the gate would reject the whole invocation.
    for (const name of ["check drift pages", "multi-page-consistency"]) {
      const argv = checkArgv(name, "page.html", ["--selector", ".footer"], "/out/d");
      assert.ok(!argv.includes("page.html"), `${name} should not take a positional: ${argv.join(" ")}`);
      assert.deepEqual(argv.slice(0, 3), ["check", "drift", "pages"]);
    }
  });
});

describe("checkToFlags", () => {
  it("maps camelCase keys to kebab-case flags and drops `tool`", () => {
    // Real flags on real gates: `--level` on `check a11y touch`, `--wait-until` from
    // the shared page-load set, `--pixel-tolerance` on the drift gates. A made-up
    // flag would still exercise the transformation but would read as documenting a
    // capability that does not exist.
    assert.deepEqual(
      checkToFlags({ tool: "check a11y touch", level: "AA", waitUntil: "domcontentloaded" }, {}),
      ["--level", "AA", "--wait-until", "domcontentloaded"],
    );
    assert.deepEqual(
      checkToFlags({ tool: "check drift component", pixelTolerance: 0.05 }, {}),
      ["--pixel-tolerance", "0.05"],
    );
  });

  it("renders booleans as bare flags, and omits a false one entirely", () => {
    assert.deepEqual(checkToFlags({ tool: "check tokens", strict: true }, {}), ["--strict"]);
    assert.deepEqual(checkToFlags({ tool: "check tokens", strict: false }, {}), []);
    assert.deepEqual(checkToFlags({ tool: "diff browsers", allowSkipped: true }, {}), ["--allow-skipped"]);
  });

  it("joins an array with commas, as the gates' own parsers expect", () => {
    assert.deepEqual(
      checkToFlags({ tool: "stress media", variants: ["forced-colors", "rtl"] }, {}),
      ["--variants", "forced-colors,rtl"],
    );
  });

  it("skips null and undefined rather than passing the string 'null'", () => {
    assert.deepEqual(checkToFlags({ tool: "check tokens", scale: null, mode: undefined }, {}), []);
  });

  it("inherits the skill's default selector only where a tool needs one", () => {
    const withSelector = checkToFlags({ tool: "multi-page-consistency" }, { selector: ".card" });
    assert.deepEqual(withSelector, ["--selector", ".card"]);
    // A check that named its own selector keeps it.
    assert.deepEqual(
      checkToFlags({ tool: "multi-page-consistency", selector: ".footer" }, { selector: ".card" }),
      ["--selector", ".footer"],
    );
    // And a tool that takes no selector is not handed one.
    assert.deepEqual(checkToFlags({ tool: "check tokens" }, { selector: ".card" }), []);
  });
});

describe("diagnoseLaunchFailure", () => {
  it("recognises the CLI rejecting the command, and suggests the replacement", () => {
    const why = diagnoseLaunchFailure("design-tokens", "Unknown command: design-tokens page.html\n");
    assert.ok(why);
    assert.match(why, /not a vlmkit command/);
    assert.match(why, /did you mean `check tokens`/, "a legacy name has a known replacement to offer");
  });

  it("recognises it without a suggestion when there is none to make", () => {
    const why = diagnoseLaunchFailure("a11y-kontrast", "Unknown command: a11y-kontrast\n");
    assert.ok(why);
    assert.doesNotMatch(why, /did you mean/);
  });

  it("names a broken CLI entry as a vlmkit bug, not a finding", () => {
    // This is the exact output the old code produced for every check, and rendered
    // as a failing check.
    const why = diagnoseLaunchFailure("check tokens", "Error: Cannot find module '/x/src/vrt.ts'\n  code: 'MODULE_NOT_FOUND'");
    assert.ok(why);
    assert.match(why, /vlmkit bug, not a finding/);
  });

  it("says nothing about a check that ran and reported findings", () => {
    assert.equal(
      diagnoseLaunchFailure("check tokens", "  vlmkit check tokens\n  ✗ 3 off-scale value(s)\n"),
      undefined,
    );
  });
});

describe("loadSkill / listSkills", () => {
  it("reads a skill and fills in the name from the filename", () => {
    skillFile("unnamed", { name: undefined as unknown as string, checks: [{ tool: "check tokens" }] });
    return loadSkill("unnamed", dir).then((skill) => {
      assert.equal(skill.name, "unnamed");
      assert.equal(skill.checks.length, 1);
    });
  });

  it("refuses a file whose `checks` is not an array", async () => {
    writeFileSync(join(skillsDir, "bad.json"), JSON.stringify({ name: "bad", checks: "all of them" }));
    await assert.rejects(() => loadSkill("bad", dir), /`checks` must be an array/);
  });

  it("lists skills by name, sorted, without the extension", async () => {
    skillFile("alpha", { checks: [] });
    skillFile("zulu", { checks: [] });
    const names = await listSkills(dir);
    assert.ok(names.includes("alpha") && names.includes("zulu"));
    assert.deepEqual(names, [...names].sort(), "sorted, so the listing is stable");
    assert.ok(!names.some((n) => n.endsWith(".json")));
  });

  it("returns nothing for a project with no skills directory", async () => {
    assert.deepEqual(await listSkills(mkdtempSync(join(tmpdir(), "vlmkit-noskills-"))), []);
  });
});

describe("renderSkillReport", () => {
  const result = (over: Partial<SkillRunResult["results"][number]>): SkillRunResult["results"][number] => ({
    tool: "check tokens",
    command: ["check", "tokens"],
    args: [],
    exitCode: 0,
    durationMs: 1400,
    outputDir: "/out/check-tokens",
    stdoutTail: "  ✓ every value on scale",
    ...over,
  });

  it("names the command it actually spawned, not just the alias written in the file", () => {
    const md = renderSkillReport(
      { name: "card", checks: [] },
      "page.html",
      [result({ tool: "design-tokens" })],
    );
    assert.match(md, /`design-tokens`/, "the file's spelling, so the reader can find it");
    assert.match(md, /`vlmkit check tokens`/, "and what ran, so they can reproduce it");
  });

  it("does not mark a non-zero check as a warning", () => {
    // The row read `⚠ 2` before, because exit 2 was special-cased as "warned". It was a
    // malformed `--ignore-region` value in the skill file. Measured end to end.
    const md = renderSkillReport(
      { name: "card", checks: [] },
      "x.png",
      [result({ tool: "diff png", command: ["diff", "png"], exitCode: 2 })],
    );
    assert.match(md, /✗ 2/, "a non-zero exit is a failed check");
    assert.doesNotMatch(md, /⚠/, "nothing here warned");
  });

  it("shows the check's own flags, so the command column can be pasted", () => {
    // The column printed `vlmkit diff browsers` for a check declared as
    // `diff browsers --engines chromium`, so the one line a reader would copy to reproduce
    // the run was not the run.
    const md = renderSkillReport(
      { name: "card", checks: [] },
      "a.html",
      [result({
        tool: "diff browsers",
        command: ["diff", "browsers"],
        args: ["--engines", "chromium"],
      })],
    );
    assert.match(md, /`vlmkit diff browsers --engines chromium`/);
  });

  it("segregates checks that never ran and gives them no exit code", () => {
    // The whole point: a runner that could not launch anything must not render as
    // failing checks. The old table gave a MODULE_NOT_FOUND an `✗ 1`.
    const md = renderSkillReport(
      { name: "stale", checks: [] },
      "page.html",
      [
        result({ tool: "a11y-kontrast", exitCode: 1, launchFailure: "`a11y-kontrast` is not a vlmkit command" }),
        result({ tool: "check tokens", exitCode: 1, stdoutTail: "✗ 3 off-scale value(s)" }),
      ],
    );
    assert.match(md, /Checks: \*\*1\*\* of 2 ran/);
    assert.match(md, /## 1 check\(s\) did not run/);
    assert.match(md, /not a finding about the target/);
    // The did-not-run row is in the prose section, above the table, without a code.
    const table = md.slice(md.indexOf("| Check |"));
    assert.doesNotMatch(table, /a11y-kontrast/, "a check that never ran has no row in the results table");
    assert.match(table, /check tokens/);
  });

  it("says so plainly when nothing ran at all", () => {
    const md = renderSkillReport(
      { name: "all-stale", checks: [] },
      "page.html",
      [result({ tool: "x", exitCode: 1, launchFailure: "`x` is not a vlmkit command" })],
    );
    assert.match(md, /Checks: \*\*0\*\* of 1 ran/);
    assert.match(md, /_\(none ran\)_/);
  });

  it("omits the did-not-run section when every check ran", () => {
    const md = renderSkillReport({ name: "ok", checks: [] }, "page.html", [result({})]);
    assert.doesNotMatch(md, /did not run/);
    assert.match(md, /Checks: \*\*1\*\*/);
  });
});

describe("runSkill", () => {
  it("spawns the real CLI, so a check reports findings about the page", async () => {
    // The one test here that launches processes, because it is the one thing the
    // pure tests cannot prove: that the entry it resolves is a CLI that runs.
    // `check a11y contrast` on a 1.65:1 card is a deterministic non-zero finding.
    skillFile("live", { description: "Card checks", selector: ".card", checks: [
      { tool: "a11y-contrast" },
      { tool: "a11y-kontrast" },
    ] });
    process.env.__VLMKIT_CLI_ENTRY__ = resolve(import.meta.dirname, "..", "cli", "vlmkit.ts");
    try {
      const result = await runSkill("live", fixture, join(dir, "out-live"), { cwd: dir });
      assert.equal(result.results.length, 2);

      const [contrast, typo] = result.results;
      assert.equal(contrast!.launchFailure, undefined, `the legacy alias should have resolved: ${contrast!.stdoutTail}`);
      assert.deepEqual(contrast!.command, ["check", "a11y", "contrast"]);
      assert.equal(contrast!.exitCode, 1, "a 1.65:1 contrast ratio is a failure");
      assert.match(contrast!.stdoutTail, /1\.65:1/, "the finding is about the page, not about module resolution");
      assert.doesNotMatch(contrast!.stdoutTail, /MODULE_NOT_FOUND/);

      assert.ok(typo!.launchFailure, "a typo'd tool must be reported as not having run");
      assert.match(typo!.launchFailure!, /not a vlmkit command/);

      // Each check gets its own directory, named for the tool as written.
      assert.notEqual(contrast!.outputDir, typo!.outputDir);
      assert.match(readFileSync(result.reportPath, "utf-8"), /Checks: \*\*1\*\* of 2 ran/);
      assert.match(output(), /did not run/);
    } finally {
      delete process.env.__VLMKIT_CLI_ENTRY__;
    }
  }, 60_000);
});

/**
 * A check's exit code has to be read against the contract that produced it.
 *
 * Three sites read `exitCode` directly and two special-cased `=== 2` as "warned". That
 * stopped being true when `gate-exit.ts` unified the contract to two outcomes and
 * `check perf` was migrated off exit 2 — after which the only producers of 2 were a
 * `png-diff` usage error and `diff browsers` on a narrowed engine list, neither a warning.
 *
 * Measured before the fix, on `{"tool": "diff png", "ignore-region": "0,300,640"}`: the
 * terminal printed `! diff png exit 2`, the report row read `⚠ 2`, and `skill run` exited
 * 2. A malformed value in the skill file, reported as a warning.
 */
describe("checkStatus", () => {
  it("treats every non-zero exit from a check that ran as a failure", () => {
    assert.equal(checkStatus({ exitCode: 1 }), "fail");
    assert.equal(checkStatus({ exitCode: 2 }), "fail", "2 is not a warning — it was a usage error");
    assert.equal(checkStatus({ exitCode: 3 }), "fail", "an unforeseen code counted as neither before");
    assert.equal(checkStatus({ exitCode: 127 }), "fail");
  });

  it("passes only on 0", () => {
    // A gate that merely warned exits 0 under the shared contract, which is how a warn is
    // supposed to reach here — via `--json` counts, not via the exit code.
    assert.equal(checkStatus({ exitCode: 0 }), "pass");
  });

  it("keeps 'did not run' separate from 'ran and failed', whatever the code says", () => {
    // The distinction that made the report honest about coverage: a check whose tool name
    // is stale never ran, and reporting it as a failure of the page is a report lying
    // about what it measured.
    assert.equal(checkStatus({ exitCode: 1, launchFailure: "unknown command" }), "did-not-run");
    assert.equal(checkStatus({ exitCode: 0, launchFailure: "unknown command" }), "did-not-run",
      "a launch failure outranks a zero exit");
  });
});
