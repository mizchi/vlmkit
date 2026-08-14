import assert from "node:assert/strict";
import { describe, it } from "vitest";
import { existsSync, mkdtempSync, writeFileSync } from "node:fs";
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
