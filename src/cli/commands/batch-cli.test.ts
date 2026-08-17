import assert from "node:assert/strict";
import { describe, it } from "vitest";
import { mkdtempSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { buildJobs, formatBatchSummary, gateReported, gateVerb, jobLogName, parseGateEnvelope, parseShard, reportedWarns, resolvePages, runBatch, runPool, shardPages, type BatchJobResult, type BatchSummary } from "./batch-cli.ts";

/** Colour codes out, so an assertion on the prose is not one on the palette. */
const plain = (text: string): string => text.replace(/\u001B\[[0-9;]*m/g, "");

describe("parseShard", () => {
  it("parses 1-based index/total", () => {
    assert.deepEqual(parseShard("2/3"), { index: 2, total: 3 });
    assert.deepEqual(parseShard(" 1/1 "), { index: 1, total: 1 });
  });

  it("rejects malformed and out-of-range specs instead of guessing", () => {
    for (const bad of ["", "2", "2-3", "a/b", "0/3", "4/3", "2/0", "-1/3"]) {
      assert.throws(() => parseShard(bad), /--shard/, `expected "${bad}" to throw`);
    }
  });
});

describe("shardPages", () => {
  const pages = Array.from({ length: 10 }, (_, i) => `p${i}.html`);

  it("passes everything through without a shard", () => {
    assert.deepEqual(shardPages(pages), pages);
    assert.deepEqual(shardPages(pages, { index: 1, total: 1 }), pages);
  });

  it("strides so neighbouring pages land in different shards", () => {
    // Contiguous slicing would hand shard 1 p0..p3; pages in one directory
    // usually cost the same, so that concentrates the expensive subtree.
    assert.deepEqual(shardPages(pages, { index: 1, total: 3 }), ["p0.html", "p3.html", "p6.html", "p9.html"]);
    assert.deepEqual(shardPages(pages, { index: 2, total: 3 }), ["p1.html", "p4.html", "p7.html"]);
  });

  it("partitions: every page runs exactly once across all shards", () => {
    const seen = [1, 2, 3, 4].flatMap((index) => shardPages(pages, { index, total: 4 }));
    assert.deepEqual([...seen].sort(), [...pages].sort());
    assert.equal(new Set(seen).size, pages.length);
  });
});

describe("resolvePages", () => {
  const dir = mkdtempSync(join(tmpdir(), "batch-glob-"));

  it("expands globs to a sorted, deduplicated list", async () => {
    for (const name of ["b.html", "a.html", "c.txt"]) writeFileSync(join(dir, name), "<p>x");
    const pages = await resolvePages(["*.html", "*.html"], dir);
    assert.deepEqual(pages, ["a.html", "b.html"]);
  });

  it("passes URLs and literal paths through untouched", async () => {
    const pages = await resolvePages(["https://example.com/a", "routes/does-not-exist.html"], dir);
    assert.deepEqual(pages, ["https://example.com/a", "routes/does-not-exist.html"]);
  });
});

describe("buildJobs", () => {
  it("crosses every gate with every page", () => {
    const jobs = buildJobs(["check integrity", "check design"], ["a.html", "b.html"]);
    assert.equal(jobs.length, 4);
    assert.deepEqual(jobs.map((j) => `${j.gate}|${j.page}`), [
      "check integrity|a.html",
      "check design|a.html",
      "check integrity|b.html",
      "check design|b.html",
    ]);
  });
});

describe("runPool", () => {
  it("never exceeds the concurrency limit", async () => {
    let live = 0;
    let peak = 0;
    await runPool(Array.from({ length: 12 }, (_, i) => i), 3, async (i) => {
      live++;
      peak = Math.max(peak, live);
      await new Promise((r) => setTimeout(r, 5 + (i % 3)));
      live--;
      return i;
    });
    assert.equal(peak, 3);
  });

  it("preserves input order regardless of completion order", async () => {
    const out = await runPool([30, 5, 20, 1], 4, async (ms) => {
      await new Promise((r) => setTimeout(r, ms));
      return ms;
    });
    assert.deepEqual(out, [30, 5, 20, 1]);
  });

  it("keeps every lane fed instead of waiting on a chunk barrier", async () => {
    // One slow item must not stop the other lanes from draining the queue:
    // with chunked Promise.all the fast items behind the barrier would idle.
    const finishOrder: number[] = [];
    await runPool([100, 1, 1, 1], 2, async (ms, i) => {
      await new Promise((r) => setTimeout(r, ms));
      finishOrder.push(i);
      return i;
    });
    assert.deepEqual(finishOrder, [1, 2, 3, 0]);
  });

  it("refuses an unusable limit instead of silently running nothing", async () => {
    // A NaN limit made `Array.from({length: NaN})` build zero lanes: the pool
    // ran nothing, returned holes, and read as success downstream.
    await assert.rejects(runPool([1, 2], Number.NaN, async (x) => x), /concurrency limit >= 1, got NaN/);
    await assert.rejects(runPool([1, 2], 0, async (x) => x), /concurrency limit >= 1, got 0/);
  });

  it("handles an empty queue", async () => {
    assert.deepEqual(await runPool([], 4, async () => 1), []);
  });
});

describe("jobLogName", () => {
  it("distinguishes same-named pages in different directories", () => {
    // `routes/a/index.html` and `routes/b/index.html` used to derive the same
    // filename from their basename, so two concurrent writes raced and one
    // page's failing report was lost.
    const a = jobLogName({ gate: "check integrity", page: "routes/a/index.html" });
    const b = jobLogName({ gate: "check integrity", page: "routes/b/index.html" });
    assert.notEqual(a, b);
    assert.match(a, /routes-a-index\.html/);
  });

  it("distinguishes same-path different-gate jobs, and same-path URLs", () => {
    assert.notEqual(
      jobLogName({ gate: "check integrity", page: "a.html" }),
      jobLogName({ gate: "check design", page: "a.html" }),
    );
    assert.notEqual(
      jobLogName({ gate: "check integrity", page: "https://x.test/checkout" }),
      jobLogName({ gate: "check integrity", page: "https://y.test/checkout" }),
    );
  });

  it("is stable for the same job and filesystem-safe", () => {
    const job = { gate: "check copy --manifest c.txt", page: "https://x.test/a?b=1" };
    assert.equal(jobLogName(job), jobLogName(job));
    assert.match(jobLogName(job), /^[a-zA-Z0-9._-]+\.txt$/);
  });

  it("stays unique when two long paths truncate to the same prefix", () => {
    const long = (tail: string) => `routes/${"deeply/nested/".repeat(8)}${tail}.html`;
    assert.notEqual(
      jobLogName({ gate: "check integrity", page: long("one") }),
      jobLogName({ gate: "check integrity", page: long("two") }),
    );
  });
});

/** ANSI out, so an assertion matches the words rather than the colour codes. */
const strip = (t: string) => t.replace(/\x1B\[[0-9;]*m/g, "");

describe("formatBatchSummary", () => {
  const job = (over: Partial<BatchJobResult> = {}): BatchJobResult => ({
    gate: "check design",
    page: "a.html",
    exitCode: 0,
    durationMs: 1000,
    output: "",
    ...over,
  });
  const summary = (jobs: BatchJobResult[]): BatchSummary => ({
    jobs,
    passed: jobs.filter((j) => j.exitCode === 0).length,
    failed: jobs.filter((j) => j.exitCode !== 0).length,
    wallMs: 2000,
    serialMs: jobs.reduce((s, j) => s + j.durationMs, 0),
    concurrency: 2,
  });

  it("surfaces warns a passing gate found, which the summary used to hide entirely", () => {
    // v7's agent-l adopted it into a repo they did not own: "`gates run` prints
    // `ALL PASS (6/6)` and shows none of the 10 warn findings. Adopt it naively and
    // you learn nothing. Only `--output` preserves them."
    const text = plain(formatBatchSummary(summary([
      job({ gate: "check tokens --wait-until load", output: "  exits 0 — 20 warn(s) did not fail this command." }),
      job({ gate: "check design", page: "b.html", output: "  exits 0 — 1 warn(s) did not fail this command." }),
      job({ gate: "check copy", page: "c.html", output: "clean" }),
    ])));
    assert.match(text, /ALL PASS/);
    assert.match(text, /21 warn\(s\) in 2 passing gate\(s\)/);
    assert.match(text, /20\s+check tokens/);
    assert.match(text, /1\s+check design/);
    assert.doesNotMatch(text, /check copy/);
    assert.match(text, /--show-output/);
  });

  it("stays quiet about warns when --show-output already prints them", () => {
    const text = plain(formatBatchSummary(
      summary([job({ output: "  exits 0 — 5 warn(s) did not fail this command." })]),
      { showOutput: true },
    ));
    assert.doesNotMatch(text, /warn\(s\) in \d+ passing gate/);
  });

  it("does not count warns from a FAILING job, whose re-run hint already covers it", () => {
    const text = plain(formatBatchSummary(summary([
      job({ exitCode: 1, output: "  exits 0 — 9 warn(s) did not fail this command.\nverdict: DEFECTS" }),
    ])));
    assert.doesNotMatch(text, /9 warn/);
  });

  it("names the untracked paths the run created, once for the whole run", () => {
    // Found by re-evaluating the v6 adoption scenario after shipping the per-gate
    // first-write notice: the gates run as CHILD processes whose stdout this runner
    // suppresses, so `gates run` — the path an adopter actually uses — announced
    // nothing at all. It also never covered `test-results/`: a gate prints
    // `report: <path>` but nothing says the directory is new and untracked.
    const text = plain(formatBatchSummary({
      ...summary([job()]),
      createdArtifacts: [".vlmkit/", "test-results/"],
    }));
    assert.match(text, /This run created 2 untracked path\(s\)/);
    assert.match(text, /\.vlmkit\/\s+an append-only record of every gate run/);
    assert.match(text, /test-results\/\s+the gates' own reports and screenshots/);
    assert.match(text, /Neither is in \.gitignore/);
    assert.match(text, /gates init/);
  });

  it("says \"is not\" rather than \"is\" when only one path appeared", () => {
    // The pluralized branch read "It is in .gitignore." — the opposite of the truth,
    // in the one line whose whole job is to say the path is untracked.
    const text = plain(formatBatchSummary({ ...summary([job()]), createdArtifacts: [".vlmkit/"] }));
    assert.match(text, /This run created 1 untracked path\(s\)/);
    assert.match(text, /It is not in \.gitignore/);
    assert.doesNotMatch(text, /Neither/);
  });

  it("stays silent when the run created nothing new", () => {
    assert.doesNotMatch(plain(formatBatchSummary(summary([job()]))), /untracked path/);
  });

  it("reports the pass case with occupancy, not a speedup claim", () => {
    // Job time inflates under contention, so total/wall measures how many jobs
    // were in flight — it is not the gain over running serially.
    const text = formatBatchSummary(summary([job(), job({ page: "b.html" })]));
    assert.match(text, /ALL PASS/);
    assert.match(text, /wall 2\.0s, job time 2\.0s total \(avg 1\.0 jobs in flight\)/);
    assert.doesNotMatch(text, /speedup/i);
  });

  it("names every failing job with its exit code", () => {
    const text = formatBatchSummary(summary([
      job(),
      job({ page: "bad.html", exitCode: 1, output: "verdict: DEFECTS" }),
    ]));
    assert.match(text, /1 FAILED/);
    assert.match(text, /bad\.html .*exit 1/);
    assert.match(text, /vlmkit check design bad\.html/); // re-run hint
    assert.doesNotMatch(text, /verdict: DEFECTS/); // output withheld unless asked
  });

  it("prints failing reports inline on request", () => {
    const text = formatBatchSummary(
      summary([job({ page: "bad.html", exitCode: 1, output: "verdict: DEFECTS" })]),
      { showOutput: true },
    );
    assert.match(text, /verdict: DEFECTS/);
  });

  it("separates a gate that found defects from one that never ran", () => {
    // v5's CI agent, on four gates that all died in navigation: "`verdict: 4 FAILED
    // (0 passed)` with zero reasons and no distinction between 'gate found defects'
    // and 'gate never ran'. CI cannot tell a broken page from a broken harness."
    const text = strip(formatBatchSummary(summary([
      job({ page: "ok.html" }),
      job({ page: "bad.html", exitCode: 1, output: "verdict: DEFECTS (1 fail)" }),
      job({
        page: "http://localhost:1/",
        exitCode: 1,
        output: "error: page load timed out after 30000ms waiting for `networkidle`\n  1 request(s) still open:",
      }),
    ])));
    assert.match(text, /1 FAILED, 1 DID NOT RUN \(1 passed\)/);
    // And the reason is inline, because re-running to find out why the harness broke
    // is a whole extra cycle and in CI there may not be one.
    assert.match(text, /did not run: error: page load timed out after 30000ms/);
  });

  it("keeps the plain FAILED count when every failure is a real report", () => {
    const text = strip(formatBatchSummary(summary([
      job({ page: "bad.html", exitCode: 1, output: "status: suspect\n\nIssues:" }),
    ])));
    assert.match(text, /1 FAILED \(0 passed\)/);
    assert.doesNotMatch(text, /DID NOT RUN/);
  });

  it("counts a --json report as having run, since a report needs no prose", () => {
    const text = strip(formatBatchSummary(summary([
      job({ page: "bad.html", exitCode: 1, output: '{"findings":[{"kind":"page-overflow-x"}]}' }),
    ])));
    assert.doesNotMatch(text, /DID NOT RUN/);
    // Truncated JSON is not a report.
    const cut = strip(formatBatchSummary(summary([
      job({ page: "bad.html", exitCode: 1, output: '{"findings":[' }),
    ])));
    assert.match(cut, /DID NOT RUN/);
  });

  it("points at the log directory instead of offering the flag that was just passed", () => {
    const text = strip(formatBatchSummary(
      summary([job({ page: "bad.html", exitCode: 1, output: "verdict: DEFECTS" })]),
      { outputDir: "/tmp/logs" },
    ));
    assert.match(text, /Full logs: \/tmp\/logs/);
    assert.doesNotMatch(text, /pass --output <dir>/);
  });

  it("surfaces the slowest jobs, which is what sharding has to balance", () => {
    const jobs = Array.from({ length: 6 }, (_, i) => job({ page: `p${i}.html`, durationMs: (i + 1) * 1000 }));
    const text = formatBatchSummary(summary(jobs));
    assert.match(text, /Slowest jobs/);
    assert.match(text.replace(/\x1B\[\d+m/g, ""), /6\.0s\s+pass\s+check design p5\.html/);
    assert.ok(text.indexOf("p5.html") < text.indexOf("p2.html"), "slowest first");
  });
});

describe("runBatch (spawns real gates)", () => {
  const CLI = resolve("src/cli/vlmkit.ts");
  const FIXTURES = "fixtures/auto-markup-proof/creative";

  it("runs a gate over several pages and aggregates the verdicts", async () => {
    const summary = await runBatch({
      gates: ["check design"],
      patterns: [`${FIXTURES}/attempt-s1{8,9}-haiku.html`],
      concurrency: 2,
      quiet: true,
      cliEntry: CLI,
    });
    assert.equal(summary.jobs.length, 2, JSON.stringify(summary.jobs.map((j) => j.page)));
    assert.equal(summary.failed, 0, summary.jobs.map((j) => j.output).join("\n"));
    assert.equal(summary.concurrency, 2);
    assert.ok(summary.serialMs > 0);
    assert.ok(summary.jobs.every((j) => j.output.includes("check design")));
  });

  it("reports a page whose gate exits non-zero as failed, and keeps going", async () => {
    const dir = mkdtempSync(join(tmpdir(), "batch-out-"));
    const summary = await runBatch({
      gates: ["check design"],
      patterns: [`${FIXTURES}/attempt-s18-haiku.html`, "no-such-page.html"],
      concurrency: 2,
      quiet: true,
      output: dir,
      cliEntry: CLI,
    });
    assert.equal(summary.jobs.length, 2);
    assert.equal(summary.failed, 1);
    assert.equal(summary.passed, 1);
    const failed = summary.jobs.find((j) => j.exitCode !== 0)!;
    assert.equal(failed.page, "no-such-page.html");
    // Logs for both jobs plus the machine-readable summary.
    const written = readdirSync(dir);
    assert.equal(written.length, 3);
    const persisted = JSON.parse(readFileSync(join(dir, "batch-summary.json"), "utf-8"));
    assert.equal(persisted.failed, 1);
    assert.equal(persisted.jobs.length, 2);
    assert.ok(!("output" in persisted.jobs[0]), "per-job logs are files, not JSON blobs");
  });

  it("refuses to silently pass when nothing matched", async () => {
    await assert.rejects(
      runBatch({ gates: ["check design"], patterns: ["fixtures/**/*.no-such-ext"], quiet: true, cliEntry: CLI }),
      /No pages matched/,
    );
  });

  it("runs only its own shard", async () => {
    const summary = await runBatch({
      gates: ["check design"],
      patterns: [`${FIXTURES}/attempt-s1*-haiku.html`],
      shard: { index: 1, total: 5 },
      concurrency: 1,
      quiet: true,
      cliEntry: CLI,
    });
    assert.equal(summary.jobs.length, 1);
    assert.deepEqual(summary.shard, { index: 1, total: 5 });
  });
});

describe("gateReported", () => {
  // Real output shapes, captured from the gates. The first version of this keyed on a
  // `verdict:` / `status:` line, which 4 of 12 gates do not print — so a gate that
  // measured the page and failed was reported to CI as "DID NOT RUN". v6's adoption
  // agent called that disqualifying, and was right.
  const A11Y_CONTRAST = [
    "  vlmkit check a11y contrast",
    "  html: /repo/page.html",
    "  inspected 31 text-bearing element(s)",
    "  ✗ 2 contrast failure(s)",
    "    button.primary — 3.22:1 (need 4.5) — `#ffffff` on `#2da44e`",
  ].join("\n");

  const A11Y_TOUCH = "  vlmkit check a11y touch\n  inspected 6 interactive element(s)\n  ✓ 0 undersized target(s)";
  const TOKENS = "  vlmkit check tokens\n  scale: 4 8 16\n  ✗ 2 off-scale value(s)";

  it("counts a gate with no verdict line as having run", () => {
    for (const [name, output] of [["a11y contrast", A11Y_CONTRAST], ["a11y touch", A11Y_TOUCH], ["tokens", TOKENS]] as const) {
      assert.equal(gateReported(output), true, `${name} reported a measurement and must not read as "did not run"`);
      assert.doesNotMatch(output, /^\s*(verdict|status):/m, `fixture for ${name} must not contain the line, or it proves nothing`);
    }
  });

  it("still counts the gates that do print a verdict", () => {
    assert.equal(gateReported("vlmkit check integrity\n\nverdict: DEFECTS (1 fail)"), true);
    assert.equal(gateReported("vlmkit check breakpoints\n\nstatus: warn"), true);
  });

  it("sees the banner through colour codes", () => {
    assert.equal(gateReported("  \u001B[1m\u001B[36mvlmkit check a11y focus\u001B[0m\n  3 stop(s)"), true);
  });

  it("counts a harness failure as not having run", () => {
    // What `handleCliError` prints, and what an unhandled throw prints. Neither carries
    // a banner, which is the whole distinction.
    assert.equal(gateReported("error: page load timed out after 30000ms waiting for `networkidle`"), false);
    assert.equal(gateReported("page.routeFromHAR: ENOENT: no such file or directory\n    at foo (/x.mjs:1:1)"), false);
    assert.equal(gateReported(""), false);
  });

  it("counts a --json report as having run, and a truncated one as not", () => {
    assert.equal(gateReported('{"findings":[{"kind":"page-overflow-x"}]}'), true);
    assert.equal(gateReported('{"findings":['), false);
  });
});

describe("reportedWarns", () => {
  it("reads the runner's own exit-intent line, ANSI and all", () => {
    assert.equal(reportedWarns("\u001B[2m  exits 0 — 20 warn(s) did not fail this command.\u001B[0m"), 20);
    assert.equal(reportedWarns("  exits 0 - 3 warn(s) did not fail this command."), 3);
  });

  it("is 0 for a gate that printed no such line, which is correct by construction", () => {
    // The runner emits it exactly when a gate exits 0 with warns, so absence means
    // no warns. Verified across the gate set rather than assumed — the mistake
    // `gateReported` made was trusting a convention only 8 of 12 gates followed.
    assert.equal(reportedWarns("vlmkit check copy\nverdict: CLEAN"), 0);
    assert.equal(reportedWarns(""), 0);
  });
});

describe("gateVerb", () => {
  it("keeps the command and drops flags and their values", () => {
    assert.equal(gateVerb("check design --wait-until load --timeout 15000"), "check design");
    assert.equal(gateVerb("check integrity"), "check integrity");
    assert.equal(gateVerb("check a11y contrast --level AA"), "check a11y contrast");
  });
});

describe("parseGateEnvelope", () => {
  it("reads a gate's own --json envelope, so findings arrive structured", () => {
    // v7's agent-l: "findings arrive as one ANSI-escaped `output` string, not
    // structured." The gates have emitted an envelope all along; the batch runner
    // never asked for one.
    const env = parseGateEnvelope(JSON.stringify({
      gate: "check.design",
      command: "check design",
      verdict: "pass",
      counts: { suspect: 0, warn: 1, info: 0 },
      findings: [{ rule: "component-drift", severity: "warn", message: "…" }],
    }));
    assert.equal(env?.command, "check design");
    assert.equal(env?.counts?.warn, 1);
    assert.equal(env?.findings?.length, 1);
  });

  it("returns null rather than throwing when the child printed prose", () => {
    // A gate that died in navigation prints an error. Losing the whole run's JSON
    // because one job failed early would make the machine path less reliable than
    // the prose one.
    assert.equal(parseGateEnvelope("error: file not found: missing.html\n"), null);
    assert.equal(parseGateEnvelope(""), null);
    assert.equal(parseGateEnvelope("{ not json"), null);
  });

  it("is not fooled by a JSON-looking line buried in prose", () => {
    assert.equal(parseGateEnvelope("vlmkit check design\n{\"verdict\":\"pass\"}"), null);
  });
});
