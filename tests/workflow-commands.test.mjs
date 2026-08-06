/**
 * Every `vlmkit` command a workflow invokes must still exist.
 *
 * Two CI jobs were running commands the CLI had removed:
 *
 *   - `vlmkit compare …` (renamed to `diff html` in 0.9.1) — the `compare` job
 *     failed with "Unknown command" and an empty artifact, which reads like a
 *     broken fixture rather than a stale workflow.
 *   - `vlmkit smoke …` (now `inspect smoke`) — that step ends in `|| true`, so
 *     it kept reporting success while running nothing at all. Worse than a
 *     failure: a green job that measures nothing.
 *
 * Neither is detectable from inside the CLI, and CI cannot detect it either
 * when the step swallows the exit code. So it is checked here, at unit-test
 * speed, against the real dispatcher.
 *
 * Scope, stated honestly: this catches an unknown *verb* (`compare`) and an
 * unknown *group leaf* (`smoke` under no group, `foo` under `inspect`), because
 * those are the two things the dispatcher rejects by name. It does NOT catch a
 * misspelled sub-mode a command parses itself — `snapshot stabilityy` would be
 * read as a URL. Flags and arguments are out of scope too; this is a command
 * existence check, not a workflow simulator.
 */
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { readFile, readdir } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, it } from "node:test";

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "..");
const workflowDir = join(repoRoot, ".github/workflows");
const CLI = join(repoRoot, "src/cli/vlmkit.ts");

/**
 * Command tokens are the words after `vlmkit.ts` up to the first flag, line
 * continuation, or shell metacharacter. Two tokens is the deepest the
 * dispatcher goes (`diff html`, `inspect smoke`, `check a11y contrast` is three
 * but no workflow invokes one), and taking more would start matching arguments.
 */
function extractCommands(yaml) {
  const found = new Set();
  for (const match of yaml.matchAll(/vlmkit\.ts\s+([^\n\\|&;>]*)/g)) {
    const tokens = [];
    for (const token of match[1].trim().split(/\s+/)) {
      if (!token || token.startsWith("-") || token.startsWith("$") || token.startsWith('"')) break;
      tokens.push(token);
      if (tokens.length === 2) break;
    }
    if (tokens.length > 0) found.add(tokens.join(" "));
  }
  return found;
}

async function workflowCommands() {
  const byCommand = new Map();
  for (const entry of await readdir(workflowDir)) {
    if (!entry.endsWith(".yml") && !entry.endsWith(".yaml")) continue;
    const yaml = await readFile(join(workflowDir, entry), "utf8");
    for (const command of extractCommands(yaml)) {
      const files = byCommand.get(command) ?? [];
      files.push(entry);
      byCommand.set(command, files);
    }
  }
  return byCommand;
}

/**
 * `--help` rather than a bare invocation: `vlmkit bench` with no arguments
 * would run a fifteen-trial benchmark. Every group and leaf answers `--help`
 * without doing work.
 */
function resolves(command) {
  const r = spawnSync(
    process.execPath,
    ["--experimental-strip-types", CLI, ...command.split(" "), "--help"],
    { encoding: "utf8", env: { ...process.env, NO_COLOR: "1" } },
  );
  const output = `${r.stdout ?? ""}${r.stderr ?? ""}`;
  const unknown = output.match(/Unknown (?:command|\w+ subcommand): .*/);
  return { ok: unknown === null, reason: unknown?.[0] ?? "", output };
}

describe("workflow CLI invocations", { timeout: 300_000 }, async () => {
  const byCommand = await workflowCommands();

  it("finds the commands the workflows actually run", () => {
    // A guard on the extractor, not on the CLI. If a refactor breaks the regex
    // this file would silently check nothing and pass, which is the failure
    // mode it exists to prevent elsewhere.
    assert.ok(byCommand.size >= 5, `only extracted ${byCommand.size} commands: ${[...byCommand.keys()]}`);
    assert.ok(byCommand.has("diff html"), "expected the VRT compare job's command");
  });

  for (const [command, files] of byCommand) {
    it(`\`vlmkit ${command}\` resolves (${files.join(", ")})`, () => {
      const { ok, reason } = resolves(command);
      assert.ok(ok, `${files.join(", ")} runs \`vlmkit ${command}\`, but the CLI says: ${reason}`);
    });
  }
});
