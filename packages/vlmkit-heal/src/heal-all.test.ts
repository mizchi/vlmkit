import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { healAll } from "./heal-all.ts";
import type { HealOptions } from "./types.ts";
import type { HealDeps } from "./heal.ts";

function tmpFile(): string {
  const dir = mkdtempSync(join(tmpdir(), "heal-all-"));
  const f = join(dir, "x.spec.ts");
  writeFileSync(f, "// original\n");
  return f;
}

function opts(testCommand: string, testFile: string): HealOptions {
  return {
    testCommand,
    testFile,
    cwd: process.cwd(),
    observe: { tiers: [{ provider: "openrouter", model: "o", vision: true }] },
    codegen: { tiers: [{ provider: "openrouter", model: "c", vision: false }] },
    budgetUsd: 5,
    maxAttempts: 4,
  };
}

// Each distinct testCommand: first run fails, then passes -> heal patches once.
function deps(): Partial<HealDeps> {
  const calls = new Map<string, number>();
  return {
    runTest: async (cmd) => {
      const n = calls.get(cmd) ?? 0;
      calls.set(cmd, n + 1);
      return n === 0
        ? { ok: false, stdout: "", stderr: "locator resolved to 0 elements" }
        : { ok: true, stdout: "", stderr: "" };
    },
    observe: { observe: async () => ({ verdict: "unknown", costUsd: 0 }) },
    codegen: { propose: async () => ({ newTestSource: "// fixed\n", costUsd: 0.3 }) },
  };
}

describe("healAll", () => {
  it("heals every file when there is no cross-file budget", async () => {
    const items = [opts("test a", tmpFile()), opts("test b", tmpFile())];
    const r = await healAll(items, undefined, deps());
    assert.equal(r.fixed, 2);
    assert.equal(r.entries.every((e) => !e.skipped), true);
    assert.ok(Math.abs(r.totalCostUsd - 0.6) < 1e-9);
  });

  it("skips remaining files once the cross-file budget is reached", async () => {
    const items = [opts("test a", tmpFile()), opts("test b", tmpFile())];
    const r = await healAll(items, { totalBudgetUsd: 0.2 }, deps());
    assert.equal(r.entries[0].skipped, false);
    assert.equal(r.entries[0].result?.verdict, "fixed");
    assert.equal(r.entries[1].skipped, true);
    assert.equal(r.entries[1].result, null);
    assert.equal(r.fixed, 1);
  });
});
