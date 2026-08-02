import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { mkdtempSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import {
  type BatchJobResult,
  type BatchSummary,
  buildJobs,
  formatBatchSummary,
  jobLogName,
  parseShard,
  resolvePages,
  runBatch,
  runPool,
  shardPages,
} from "./batch-cli.ts";

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
