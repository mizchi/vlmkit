import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import {
  applyApprovalOperation,
  listApprovalManifest,
} from "./approval-operations.ts";

describe("approval operations", () => {
  it("lists an empty manifest when approval.json does not exist yet", async () => {
    const dir = await mkdtemp(join(tmpdir(), "approval-ops-"));
    const manifestPath = join(dir, "approval.json");
    try {
      const result = await listApprovalManifest(manifestPath);

      assert.equal(result.path, manifestPath);
      assert.equal(result.total, 0);
      assert.deepEqual(result.rules, []);
      assert.deepEqual(result.warnings, []);
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  it("adds validated rules and preserves them on disk", async () => {
    const dir = await mkdtemp(join(tmpdir(), "approval-ops-"));
    const manifestPath = join(dir, "approval.json");
    try {
      const result = await applyApprovalOperation(manifestPath, {
        action: "add",
        rule: {
          selector: ".hero",
          tolerance: { ratio: 0.01 },
          reason: "intentional hero art refresh",
          expires: "2026-08-15",
        },
      });

      assert.equal(result.action, "add");
      assert.equal(result.beforeCount, 0);
      assert.equal(result.afterCount, 1);
      assert.equal(result.added?.selector, ".hero");

      const raw = JSON.parse(await readFile(manifestPath, "utf-8")) as { rules: unknown[] };
      assert.equal(raw.rules.length, 1);
      assert.equal((raw.rules[0] as { selector?: string }).selector, ".hero");
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  it("removes rules by index without touching disk during dry-run", async () => {
    const dir = await mkdtemp(join(tmpdir(), "approval-ops-"));
    const manifestPath = join(dir, "approval.json");
    try {
      await applyApprovalOperation(manifestPath, {
        action: "add",
        rule: {
          selector: ".hero",
          reason: "intentional hero art refresh",
        },
      });

      const dryRun = await applyApprovalOperation(manifestPath, {
        action: "remove",
        index: 0,
        dryRun: true,
      });
      assert.equal(dryRun.dryRun, true);
      assert.equal(dryRun.afterCount, 0);

      const listed = await listApprovalManifest(manifestPath);
      assert.equal(listed.total, 1);

      const removed = await applyApprovalOperation(manifestPath, {
        action: "remove",
        index: 0,
      });
      assert.equal(removed.removed?.selector, ".hero");
      assert.equal((await listApprovalManifest(manifestPath)).total, 0);
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  it("rejects add operations without a matcher", async () => {
    const dir = await mkdtemp(join(tmpdir(), "approval-ops-"));
    const manifestPath = join(dir, "approval.json");
    try {
      await assert.rejects(
        () => applyApprovalOperation(manifestPath, {
          action: "add",
          rule: {
            reason: "would approve every visual diff",
          },
        }),
        /at least one matcher/i,
      );
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });
});
