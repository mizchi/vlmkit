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
import { describe, it } from "vitest";

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

/**
 * Contexts GitHub rejects inside a job-level `env:` block.
 *
 * Learned the hard way: `${{ runner.temp }}` there makes the whole workflow file
 * invalid, and an invalid workflow file is nearly invisible. GitHub does not
 * report a syntax error on the PR — it creates a zero-second "failed" run with no
 * jobs, whose display name is the file path instead of the workflow's `name`. The
 * job simply never appears among the PR's checks, so nothing turns red that a
 * reader would connect to the file they just wrote. It cost two pushes to notice.
 *
 * The allowed set at that position is github / inputs / matrix / needs / secrets
 * / strategy / vars, so anything else is a validation error.
 *
 * Scope, stated honestly: this checks ONE position for this ONE class of error.
 * `actionlint` checks every position and much more, and is the right tool if
 * these files grow — this is the dependency-free guard for the specific mistake
 * that has already been made once.
 */
const CONTEXTS_ALLOWED_IN_JOB_ENV = new Set([
  "github",
  "inputs",
  "matrix",
  "needs",
  "secrets",
  "strategy",
  "vars",
]);

/**
 * The `env:` mapping directly under a job, by indentation.
 *
 * A real YAML parse would be better, but the repo has no YAML dependency and
 * pulling one in for this would be a larger change than the check. Job-level
 * `env:` is at exactly four spaces in every file here (two for the job id, two
 * more for its keys), and a step's `env:` is deeper, so indentation separates
 * them unambiguously.
 */
function jobLevelEnvBlocks(yaml) {
  const blocks = [];
  const lines = yaml.split("\n");
  for (let i = 0; i < lines.length; i++) {
    if (!/^ {4}env:\s*$/.test(lines[i])) continue;
    for (let j = i + 1; j < lines.length; j++) {
      const line = lines[j];
      if (line.trim() === "" || line.trimStart().startsWith("#")) continue;
      // Left the block once indentation returns to the job-key level or above.
      if (!/^ {6,}/.test(line)) break;
      blocks.push({ line: j + 1, text: line });
    }
  }
  return blocks;
}

describe("workflow expression contexts", async () => {
  const files = (await readdir(workflowDir)).filter((f) => f.endsWith(".yml") || f.endsWith(".yaml"));

  it("finds the job-level env blocks it is meant to check", async () => {
    // Same extractor guard as above: a parser that matches nothing passes
    // vacuously, which is the exact failure this file exists to prevent.
    let total = 0;
    for (const file of files) {
      total += jobLevelEnvBlocks(await readFile(join(workflowDir, file), "utf8")).length;
    }
    assert.ok(total > 0, "extracted no job-level env entries from any workflow");
  });

  for (const file of files) {
    it(`${file} uses only contexts allowed in a job-level env block`, async () => {
      const yaml = await readFile(join(workflowDir, file), "utf8");
      for (const { line, text } of jobLevelEnvBlocks(yaml)) {
        for (const match of text.matchAll(/\$\{\{\s*([a-zA-Z_][\w-]*)\s*\./g)) {
          const context = match[1];
          assert.ok(
            CONTEXTS_ALLOWED_IN_JOB_ENV.has(context),
            `${file}:${line} uses \${{ ${context}.… }} in a job-level env block.`
              + ` GitHub rejects the whole FILE for this, reporting a zero-second failed run with no`
              + ` jobs rather than an error. Allowed here: ${[...CONTEXTS_ALLOWED_IN_JOB_ENV].join(", ")}.`
              + ` For runner.temp, set the variable in a step via $RUNNER_TEMP and $GITHUB_ENV instead.`,
          );
        }
      }
    });
  }
});
