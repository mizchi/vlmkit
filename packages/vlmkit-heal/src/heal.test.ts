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
      observe: { observe: async () => ({ verdict: "unknown", costUsd: 0 }) },
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
        observe: { observe: async () => ({ verdict: "unknown", costUsd: 0 }) },
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
        observe: { observe: async () => ({ verdict: "unknown", costUsd: 0 }) },
        codegen: { propose: async () => ({ newTestSource: "// BAD UNVERIFIED PATCH\n", costUsd: 0.6 }) },
      },
    );
    assert.equal(readFileSync(testFile, "utf8"), "// ORIGINAL SOURCE\n");
  });

  it("updates the baseline when a vrt-diff is intentional (verdict=fixed), without calling codegen", async () => {
    const testFile = tmpTestFile();
    const m = failThenOk("Error: Screenshot comparison failed");
    let observedScreenshot: Buffer | undefined;
    const result = await heal(baseOpts(testFile), {
      runTest: m.runTest,
      updateSnapshotsCommand: "noop --update-snapshots",
      captureActual: async () => Buffer.from("fake-png-bytes"),
      observe: {
        observe: async ({ screenshotPng }) => {
          observedScreenshot = screenshotPng;
          return { verdict: "intentional-change", costUsd: 0.0002 };
        },
      },
      codegen: {
        propose: async () => {
          throw new Error("codegen must NOT be called on the intentional-change path");
        },
      },
    });
    assert.equal(result.verdict, "fixed");
    assert.equal(result.finalPatch, "baseline-update");
    assert.ok(result.attempts.some((a) => a.phase === "observe"));
    assert.equal(observedScreenshot?.toString(), "fake-png-bytes");
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
        observe: { observe: async () => ({ verdict: "unknown", costUsd: 0 }) },
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

  it("reports a regression when the vision tier says so (verdict=regression)", async () => {
    const testFile = tmpTestFile();
    const result = await heal(baseOpts(testFile), {
      runTest: async () => ({ ok: false, stdout: "", stderr: "toHaveScreenshot pixels differ" }),
      observe: { observe: async () => ({ verdict: "regression", costUsd: 0.0002 }) },
      codegen: { propose: async () => ({ newTestSource: "x", costUsd: 0 }) },
    });
    assert.equal(result.verdict, "regression");
  });
});
