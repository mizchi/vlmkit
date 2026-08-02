import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { CSS_BENCH_OUTPUT_ROOT } from "./css-challenge-fixtures.ts";
import { parseCssChallengeBenchArgs } from "./css-challenge-bench.ts";

describe("parseCssChallengeBenchArgs", () => {
  it("parses explicit flags including output-root", () => {
    const options = parseCssChallengeBenchArgs([
      "--fixture", "dashboard",
      "--fixture", "page",
      "--trials", "5",
      "--start-seed", "10",
      "--backend", "prescanner",
      "--approval", "approval.json",
      "--strict",
      "--suggest-approval",
      "--output-root", "artifacts/css-bench",
      "--no-db",
      "--no-llm",
    ]);

    assert.equal(options.trials, 5);
    assert.equal(options.startSeed, 10);
    assert.equal(options.saveDb, false);
    assert.deepEqual(options.fixtureArgs, ["dashboard", "page"]);
    assert.equal(options.backend, "prescanner");
    assert.equal(options.approvalPath, "approval.json");
    assert.equal(options.strict, true);
    assert.equal(options.suggestApproval, true);
    assert.equal(options.outputRoot, "artifacts/css-bench");
    assert.equal(options.enableLlm, false);
  });

  it("uses defaults when flags are omitted", () => {
    const options = parseCssChallengeBenchArgs([]);

    assert.equal(options.trials, 20);
    assert.equal(options.startSeed, 1);
    assert.equal(options.saveDb, true);
    assert.deepEqual(options.fixtureArgs, []);
    assert.equal(options.backend, "chromium");
    assert.equal(options.approvalPath, "");
    assert.equal(options.strict, false);
    assert.equal(options.suggestApproval, false);
    assert.equal(options.outputRoot, CSS_BENCH_OUTPUT_ROOT);
    assert.equal(options.enableLlm, true);
  });
});

describe("parseCssChallengeBenchArgs — numeric validation", () => {
  it("rejects a non-numeric trials count instead of running NaN trials", () => {
    // The inline reader this replaced produced NaN, so the bench reported
    // numbers from a loop that never ran the requested count.
    assert.throws(() => parseCssChallengeBenchArgs(["--trials", "abc"]), /--trials must be a number/);
    assert.throws(() => parseCssChallengeBenchArgs(["--trials", "0"]), /--trials must be >= 1/);
  });

  it("rejects a flag swallowed as a value", () => {
    assert.throws(
      () => parseCssChallengeBenchArgs(["--trials", "--no-db"]),
      /--trials needs a value, got the next flag --no-db/,
    );
  });

  it("keeps the documented defaults", () => {
    const options = parseCssChallengeBenchArgs([]);
    assert.equal(options.trials, 20);
    assert.equal(options.startSeed, 1);
  });
});
