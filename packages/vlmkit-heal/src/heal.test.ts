import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { heal } from "./heal.ts";
import type { HealOptions } from "./types.ts";
import type { HealDeps } from "./heal.ts";

function tmpTestFile(content = "// original test\n"): string {
  const dir = mkdtempSync(join(tmpdir(), "heal-loop-"));
  const file = join(dir, "x.spec.ts");
  writeFileSync(file, content);
  return file;
}

function baseOpts(testFile: string): HealOptions {
  return {
    testCommand: "noop",
    testFile,
    cwd: process.cwd(),
    observe: { tiers: [{ provider: "openrouter", model: "ui-tars", vision: true }] },
    codegen: {
      tiers: [
        { provider: "gemini", model: "flash-lite", vision: false },
        { provider: "anthropic", model: "sonnet", vision: false },
      ],
    },
    budgetUsd: 5,
    maxAttempts: 5,
  };
}

// runTest mock: fail on the first call, ok afterwards.
function failThenOk(failOutput: string): { runTest: HealDeps["runTest"]; calls: () => number } {
  let n = 0;
  return {
    calls: () => n,
    runTest: async () => {
      n++;
      return n === 1 ? { ok: false, stdout: "", stderr: failOutput } : { ok: true, stdout: "", stderr: "" };
    },
  };
}

describe("heal", () => {
  it("fixes a locator failure by applying a codegen patch (verdict=fixed)", async () => {
    const testFile = tmpTestFile();
    const m = failThenOk("locator resolved to 0 elements");
    const result = await heal(baseOpts(testFile), {
      runTest: m.runTest,
      codegen: {
        propose: async () => ({ newTestSource: "// patched test\n", costUsd: 0.001 }),
      },
    });
    assert.equal(result.verdict, "fixed");
    assert.ok(result.attempts.some((a) => a.phase === "codegen"));
    assert.equal(readFileSync(testFile, "utf8"), "// patched test\n");
  });

  it("gives up when the shared budget is exhausted (verdict=give-up)", async () => {
    const testFile = tmpTestFile();
    const result = await heal(
      { ...baseOpts(testFile), budgetUsd: 0.5 },
      {
        runTest: async () => ({ ok: false, stdout: "", stderr: "some other error" }),
        codegen: { propose: async () => ({ newTestSource: "// p\n", costUsd: 0.6 }) },
      },
    );
    assert.equal(result.verdict, "give-up");
    assert.ok(result.attempts.length >= 1);
  });

  it("leaves the test file unchanged on give-up (no unverified patch left behind)", async () => {
    const testFile = tmpTestFile("// ORIGINAL SOURCE\n");
    await heal(
      { ...baseOpts(testFile), budgetUsd: 0.5 },
      {
        // never passes, so the applied patch is never verified
        runTest: async () => ({ ok: false, stdout: "", stderr: "locator resolved to 0 elements" }),
        codegen: { propose: async () => ({ newTestSource: "// BAD UNVERIFIED PATCH\n", costUsd: 0.6 }) },
      },
    );
    assert.equal(readFileSync(testFile, "utf8"), "// ORIGINAL SOURCE\n");
  });

  it("updates the baseline when review accepts a vrt-diff (verdict=fixed), without calling codegen", async () => {
    const testFile = tmpTestFile();
    const m = failThenOk("Error: Screenshot comparison failed");
    let sawBaseline: Buffer | undefined;
    const result = await heal(baseOpts(testFile), {
      runTest: m.runTest,
      updateSnapshotsCommand: "noop --update-snapshots",
      captureVrt: async () => ({ baseline: Buffer.from("BEFORE"), actual: Buffer.from("AFTER") }),
      reviewVrt: async ({ baselinePng }) => {
        sawBaseline = baselinePng;
        return { verdict: "accept", confidence: 0.95, reason: "matches intent", intentSource: "expectedChange", costUsd: 0.0002 };
      },
      codegen: {
        propose: async () => {
          throw new Error("codegen must NOT be called on the accept path");
        },
      },
    });
    assert.equal(result.verdict, "fixed");
    assert.equal(result.finalPatch, "baseline-update");
    assert.ok(result.attempts.some((a) => a.phase === "observe"));
    assert.equal(sawBaseline?.toString(), "BEFORE");
  });

  it("uses updateSnapshotsCommand from HealOptions when a vrt-diff is accepted", async () => {
    const testFile = tmpTestFile();
    const commands: string[] = [];
    let normalRuns = 0;
    const result = await heal(
      {
        ...baseOpts(testFile),
        updateSnapshotsCommand: "custom update snapshots",
      },
      {
        runTest: async (command) => {
          commands.push(command);
          if (command === "custom update snapshots") return { ok: true, stdout: "", stderr: "" };
          normalRuns++;
          return normalRuns === 1
            ? { ok: false, stdout: "", stderr: "Error: Screenshot comparison failed" }
            : { ok: true, stdout: "", stderr: "" };
        },
        captureVrt: async () => ({ baseline: Buffer.from("B"), actual: Buffer.from("A") }),
        reviewVrt: async () => ({ verdict: "accept", confidence: 0.95, reason: "intended", intentSource: "expectedChange", costUsd: 0.0001 }),
        codegen: { propose: async () => { throw new Error("codegen must NOT run"); } },
      },
    );

    assert.equal(result.verdict, "fixed");
    assert.ok(commands.includes("custom update snapshots"));
  });

  it("returns needs-review when review accepts but below acceptThreshold", async () => {
    const testFile = tmpTestFile();
    const result = await heal(
      { ...baseOpts(testFile), acceptThreshold: 0.8 },
      {
        runTest: async () => ({ ok: false, stdout: "", stderr: "Error: Screenshot comparison failed" }),
        captureVrt: async () => ({ baseline: Buffer.from("B"), actual: Buffer.from("A") }),
        reviewVrt: async () => ({ verdict: "accept", confidence: 0.6, reason: "looks intentional, not sure", intentSource: "vision-only", costUsd: 0.0001 }),
        codegen: { propose: async () => { throw new Error("codegen must NOT run on needs-review"); } },
      },
    );
    assert.equal(result.verdict, "needs-review");
  });

  it("downgrades an accept to needs-review when the strong observe tier disagrees (confirmAccept)", async () => {
    const testFile = tmpTestFile();
    const opts: HealOptions = {
      ...baseOpts(testFile),
      observe: { tiers: [
        { provider: "openrouter", model: "cheap", vision: true },
        { provider: "openrouter", model: "strong", vision: true },
      ]},
    };
    let strongCalled = false;
    const result = await heal(opts, {
      runTest: async () => ({ ok: false, stdout: "", stderr: "Error: Screenshot comparison failed" }),
      captureVrt: async () => ({ baseline: Buffer.from("B"), actual: Buffer.from("A") }),
      reviewVrt: async ({ tier }) => {
        if (tier.model === "strong") {
          strongCalled = true;
          return { verdict: "reject", confidence: 0.9, reason: "collateral breakage", intentSource: "expectedChange", costUsd: 0.001 };
        }
        return { verdict: "accept", confidence: 0.99, reason: "looks intended", intentSource: "expectedChange", costUsd: 0.0001 };
      },
      codegen: { propose: async () => { throw new Error("codegen must NOT run on the VRT path"); } },
    });
    assert.equal(result.verdict, "needs-review");
    assert.equal(strongCalled, true, "the strong tier must confirm an accept");
  });

  it("accepts and updates the baseline when both tiers accept (verdict=fixed)", async () => {
    const testFile = tmpTestFile();
    const opts: HealOptions = {
      ...baseOpts(testFile),
      observe: { tiers: [
        { provider: "openrouter", model: "cheap", vision: true },
        { provider: "openrouter", model: "strong", vision: true },
      ]},
    };
    const m = failThenOk("Error: Screenshot comparison failed");
    const result = await heal(opts, {
      runTest: m.runTest,
      updateSnapshotsCommand: "noop --update-snapshots",
      captureVrt: async () => ({ baseline: Buffer.from("B"), actual: Buffer.from("A") }),
      reviewVrt: async () => ({ verdict: "accept", confidence: 0.95, reason: "intended", intentSource: "expectedChange", costUsd: 0.0001 }),
      codegen: { propose: async () => { throw new Error("codegen must NOT run on the accept path"); } },
    });
    assert.equal(result.verdict, "fixed");
    assert.equal(result.finalPatch, "baseline-update");
  });

  it("skips confirmation when confirmAccept is false (single review accepts -> fixed)", async () => {
    const testFile = tmpTestFile();
    const m = failThenOk("Error: Screenshot comparison failed");
    let reviewCalls = 0;
    const result = await heal(
      { ...baseOpts(testFile), confirmAccept: false },
      {
        runTest: m.runTest,
        updateSnapshotsCommand: "noop --update-snapshots",
        captureVrt: async () => ({ baseline: Buffer.from("B"), actual: Buffer.from("A") }),
        reviewVrt: async () => { reviewCalls++; return { verdict: "accept", confidence: 0.95, reason: "ok", intentSource: "expectedChange", costUsd: 0.0001 }; },
        codegen: { propose: async () => { throw new Error("codegen must NOT run"); } },
      },
    );
    assert.equal(result.verdict, "fixed");
    assert.equal(reviewCalls, 1, "no confirmation review when confirmAccept is false");
  });

  it("reports flaky (not fixed, no patch) when verify intermittently fails", async () => {
    const testFile = tmpTestFile("// ORIGINAL\n");
    // pattern per iteration: gate=ok, v1=ok, v2=FAIL -> flaky signal each round
    let call = 0;
    let codegenCalled = false;
    const result = await heal(
      { ...baseOpts(testFile), maxAttempts: 5, flakyThreshold: 2 },
      {
        runTest: async () => {
          const phase = call++ % 3;
          return phase === 2
            ? { ok: false, stdout: "", stderr: "intermittent failure" }
            : { ok: true, stdout: "", stderr: "" };
        },
        codegen: {
          propose: async () => {
            codegenCalled = true;
            return { newTestSource: "// PATCH\n", costUsd: 0.001 };
          },
        },
      },
    );
    assert.equal(result.verdict, "flaky");
    assert.equal(codegenCalled, false, "must not patch a flaky test");
    assert.equal(readFileSync(testFile, "utf8"), "// ORIGINAL\n");
  });

  it("reports a regression when review rejects a vrt-diff (verdict=regression)", async () => {
    const testFile = tmpTestFile();
    const result = await heal(baseOpts(testFile), {
      runTest: async () => ({ ok: false, stdout: "", stderr: "toHaveScreenshot pixels differ" }),
      captureVrt: async () => ({ baseline: Buffer.from("B"), actual: Buffer.from("A") }),
      reviewVrt: async () => ({ verdict: "reject", confidence: 0.9, reason: "broken layout", intentSource: "vision-only", costUsd: 0.0002 }),
      codegen: { propose: async () => ({ newTestSource: "x", costUsd: 0 }) },
    });
    assert.equal(result.verdict, "regression");
  });
});
