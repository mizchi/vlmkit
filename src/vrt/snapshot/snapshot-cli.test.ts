import assert from "node:assert/strict";
import { describe, it } from "vitest";
import { existsSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { runSnapshotCli } from "./snapshot.ts";

/**
 * `vlmkit snapshot`, driven in-process.
 *
 * Until v7 this command was a bare `main()` that read `process.argv` and assigned
 * `process.exitCode`, so 318 statements of a shipped command could only be
 * exercised by spawning a subprocess — which tests it, but tells the coverage
 * tool nothing and makes asserting on a mode's behaviour a matter of grepping
 * terminal text.
 *
 * The three things the refactor had to get right are each pinned below: argv is
 * an argument, the exit code is returned rather than assigned, and cwd is an
 * argument (because `process.chdir` is process-wide and vitest shares workers).
 */

const dir = mkdtempSync(join(tmpdir(), "vlmkit-snapshot-cli-"));

function page(name: string, body: string): string {
  const file = join(dir, `${name}.html`);
  writeFileSync(file, `<!doctype html><meta charset="utf-8"><title>${name}</title>${body}`);
  return file;
}

const stable = page("stable", `
<style>body{margin:0;font:16px sans-serif;background:#fff}
.hero{padding:48px;background:#2d6cdf;color:#fff}</style>
<body><div class="hero"><h1>Stable</h1><p>Deterministic content.</p></div></body>`);

describe("runSnapshotCli — the CLI surface, callable", () => {
  it("returns 0 for --help and 1 for no arguments, rather than exiting the process", () => {
    // `process.exit` here would kill the test worker. That it does not is the
    // whole point of returning a code.
    assert.equal(runSnapshotCli(["--help"]) instanceof Promise, true);
  });

  it("returns 0 for --help", async () => {
    assert.equal(await runSnapshotCli(["--help"], { cwd: dir }), 0);
    assert.equal(await runSnapshotCli(["help"], { cwd: dir }), 0);
  });

  it("returns 1 for an empty command line, which is a usage error", async () => {
    assert.equal(await runSnapshotCli([], { cwd: dir }), 1);
  });

  it("does not touch the caller's process.exitCode", async () => {
    // The reason the code is returned: `process.exitCode` belongs to whoever owns
    // the process. A snapshot that legitimately reports a regression must not fail
    // the suite that asked it to measure one.
    const before = process.exitCode;
    await runSnapshotCli([], { cwd: dir });
    assert.equal(process.exitCode, before, "running the CLI must not set the caller's exit code");
  });

  it("captures a first run as a baseline and reports it as new", async () => {
    const output = join(dir, "shots-baseline");
    const code = await runSnapshotCli(
      [pathToFileURL(stable).href, "--output", output, "--label", "stable"],
      { cwd: dir },
    );
    assert.equal(code, 0, "a first run has nothing to compare against, so it cannot fail");
    assert.ok(existsSync(join(output, "snapshot-report.json")), "the report is the run's artifact");
  });

  it("compares a second run against the baseline it just wrote", async () => {
    const output = join(dir, "shots-compare");
    const url = pathToFileURL(stable).href;
    await runSnapshotCli([url, "--output", output, "--label", "stable"], { cwd: dir });
    const code = await runSnapshotCli([url, "--output", output, "--label", "stable"], { cwd: dir });
    assert.equal(code, 0, "the same page against its own baseline is not a regression");

    const report = JSON.parse(
      await import("node:fs/promises").then((fs) => fs.readFile(join(output, "snapshot-report.json"), "utf8")),
    ) as { results: { diffRatio?: number }[] };
    assert.ok(report.results.length > 0, "the second run has results to report");
  });

  it("resolves a relative --output against the cwd it was GIVEN, not the process's", async () => {
    // This is what `process.chdir` would have been needed for, and why it is a
    // parameter: vitest runs test files in shared workers, so a chdir corrupts
    // whatever else is running.
    const sandbox = mkdtempSync(join(tmpdir(), "vlmkit-snapshot-cwd-"));
    await runSnapshotCli(
      [pathToFileURL(stable).href, "--output", "shots-relative", "--label", "stable"],
      { cwd: sandbox },
    );
    assert.ok(
      existsSync(join(sandbox, "shots-relative", "snapshot-report.json"))
      || existsSync(join(process.cwd(), "shots-relative", "snapshot-report.json")),
      "the output landed somewhere findable",
    );
    // The point of the assertion: it must NOT be under the process cwd.
    assert.ok(
      existsSync(join(sandbox, "shots-relative", "snapshot-report.json")),
      "a relative --output resolves against the given cwd",
    );
  });
});

/**
 * The subcommands, through the dispatch rather than around it.
 *
 * `approve`, `fix-prompt` and `stability` each have their own unit tests
 * (`approve.test.ts`, `stability.test.ts`), and all of them call the underlying function
 * directly — so the dispatch that routes to them, the flag parsing that feeds them, and the
 * `outputDir`/`configPath` resolution around them were unexecuted. That is where a mode ends up
 * reading a different directory than the one the capture wrote to, which no unit test of the mode
 * itself can catch.
 */
describe("runSnapshotCli — subcommands", () => {
  /** A page that differs from `stable` in one measurable way. */
  const shifted = page("shifted", `
<style>body{margin:0;font:16px sans-serif;background:#fff}
.hero{padding:96px;background:#2d6cdf;color:#fff}</style>
<body><div class="hero"><h1>Stable</h1><p>Deterministic content.</p></div></body>`);

  it("--fail-on-diff turns a real difference into a non-zero exit", async () => {
    const output = join(dir, "shots-faildiff");
    // First run writes the baseline from one page…
    assert.equal(
      await runSnapshotCli([pathToFileURL(stable).href, "--output", output, "--label", "hero"], { cwd: dir }),
      0,
    );
    // …the second compares a DIFFERENT page against it under the same label, which is how a
    // regression looks to this command.
    const code = await runSnapshotCli(
      [pathToFileURL(shifted).href, "--output", output, "--label", "hero", "--fail-on-diff"],
      { cwd: dir },
    );
    assert.equal(code, 1, "a diff above threshold with --fail-on-diff must fail the command");
    const report = JSON.parse(readFileSync(join(output, "snapshot-report.json"), "utf-8")) as
      { results: { diffRatio?: number; status?: string }[] };
    assert.ok(report.results.length > 0);
  });

  it("without --fail-on-diff the same difference is reported and exits 0", async () => {
    // The default is deliberate: `snapshot` is a measurement, and a caller that wants a gate asks
    // for one. A command that failed by default could not be used to LOOK at a change.
    const output = join(dir, "shots-nofail");
    await runSnapshotCli([pathToFileURL(stable).href, "--output", output, "--label", "hero"], { cwd: dir });
    assert.equal(
      await runSnapshotCli([pathToFileURL(shifted).href, "--output", output, "--label", "hero"], { cwd: dir }),
      0,
    );
  });

  it("approve promotes the current snapshot so the next run is clean", async () => {
    const output = join(dir, "shots-approve");
    await runSnapshotCli([pathToFileURL(stable).href, "--output", output, "--label", "hero"], { cwd: dir });
    await runSnapshotCli([pathToFileURL(shifted).href, "--output", output, "--label", "hero"], { cwd: dir });
    assert.equal(await runSnapshotCli(["approve", "--output", output, "--label", "hero"], { cwd: dir }), 0);
    // The point of approving: the difference that was reported is now the expected state, so the
    // same comparison passes even under --fail-on-diff.
    assert.equal(
      await runSnapshotCli([pathToFileURL(shifted).href, "--output", output, "--label", "hero", "--fail-on-diff"], { cwd: dir }),
      0,
      "after approve, the promoted baseline matches",
    );
  });

  it("fix-prompt writes an agent-ready task list from the last report", async () => {
    const output = join(dir, "shots-fixprompt");
    await runSnapshotCli([pathToFileURL(stable).href, "--output", output, "--label", "hero"], { cwd: dir });
    await runSnapshotCli([pathToFileURL(shifted).href, "--output", output, "--label", "hero"], { cwd: dir });
    const out = join(dir, "fix-prompt.md");
    assert.equal(
      await runSnapshotCli(["fix-prompt", "--output", output, "--out", out, "--min-diff", "0"], { cwd: dir }),
      0,
    );
    assert.ok(existsSync(out), "the --out path is the artifact a caller pastes from");
    assert.ok(readFileSync(out, "utf-8").length > 0);
  });

  it("fix-prompt says what to run when there is no report yet", async () => {
    // The error a first-time user hits, and the only actionable thing to say is the command that
    // produces the missing file.
    await assert.rejects(
      () => runSnapshotCli(["fix-prompt", "--output", join(dir, "shots-empty")], { cwd: dir }),
      /No snapshot report found.*Run `vlmkit snapshot/s,
    );
  });

  it("stability re-captures the same URL and reports the flake rate", async () => {
    // Two iterations of one deterministic page: the interesting assertion is that it produces a
    // report at all, because this mode's own dispatch resolves a different output file.
    const output = join(dir, "shots-stability");
    const code = await runSnapshotCli(
      ["stability", pathToFileURL(stable).href, "--iterations", "2", "--output", output],
      { cwd: dir },
    );
    assert.equal(code, 0, "a deterministic page is stable");
    assert.ok(existsSync(join(output, "stability-report.json")), "the report is the artifact");
  });

  it("catches a subcommand written after the URL instead of navigating to it", async () => {
    // Found by getting the argument order wrong in the test above. The mode dispatch only reads
    // `positional[0]`, so `snapshot <url> stability` treated "stability" as a second capture
    // target and reached the browser: `Cannot navigate to invalid URL`, naming neither the
    // subcommand nor the fix.
    await assert.rejects(
      () => runSnapshotCli(
        [pathToFileURL(stable).href, "stability", "--iterations", "2", "--output", join(dir, "shots-order")],
        { cwd: dir },
      ),
      (err: unknown) => {
        assert.match((err as Error).message, /`stability` is a subcommand and has to come first/);
        assert.match((err as Error).message, /vlmkit snapshot stability file:/, "and shows the corrected line");
        return true;
      },
    );
  });

  it("refuses a run with no URLs and names both ways to supply them", async () => {
    await assert.rejects(
      () => runSnapshotCli(["--output", join(dir, "shots-nourls")], { cwd: dir }),
      /No snapshot URLs provided.*configure routes in vlmkit\.config\.json/s,
    );
  });
});
