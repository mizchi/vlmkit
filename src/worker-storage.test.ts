import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  buildWorkerArtifactKey,
  createWorkerStorage,
  detectWorkerStorageCapabilities,
  normalizeWorkerArtifactPath,
  type WorkerD1Like,
  type WorkerKVNamespaceLike,
  type WorkerR2BucketLike,
} from "../worker/storage.ts";

class FakeR2Bucket implements WorkerR2BucketLike {
  puts: Array<{ key: string; value: string; options?: { httpMetadata?: { contentType?: string }; customMetadata?: Record<string, string> } }> = [];

  async put(key: string, value: string | ArrayBuffer | Uint8Array, options?: { httpMetadata?: { contentType?: string }; customMetadata?: Record<string, string> }) {
    this.puts.push({
      key,
      value: typeof value === "string" ? value : String(value),
      options,
    });
  }
}

class FakeKVNamespace implements WorkerKVNamespaceLike {
  puts: Array<{ key: string; value: string }> = [];

  async put(key: string, value: string): Promise<void> {
    this.puts.push({ key, value });
  }
}

class FakeD1Database implements WorkerD1Like {
  execCalls: string[] = [];
  prepared: Array<{ sql: string; values: unknown[] }> = [];

  async exec(query: string): Promise<unknown> {
    this.execCalls.push(query);
    return {};
  }

  prepare(query: string) {
    return {
      bind: (...values: unknown[]) => ({
        run: async () => {
          this.prepared.push({ sql: query, values });
          return { success: true };
        },
      }),
    };
  }
}

describe("normalizeWorkerArtifactPath", () => {
  it("removes leading slashes, dot segments, and duplicate separators", () => {
    assert.equal(
      normalizeWorkerArtifactPath("/runs/../snapshots//daily/./snapshot-report.json"),
      "snapshots/daily/snapshot-report.json",
    );
  });
});

describe("buildWorkerArtifactKey", () => {
  it("builds a stable R2 object key per run and artifact kind", () => {
    assert.equal(
      buildWorkerArtifactKey({
        runId: "run-123",
        artifactKind: "snapshot",
        artifactPath: "reports/snapshot-report.json",
      }),
      "runs/run-123/snapshot/reports/snapshot-report.json",
    );
  });
});

describe("detectWorkerStorageCapabilities", () => {
  it("reports available Cloudflare bindings independently", () => {
    const caps = detectWorkerStorageCapabilities({
      VRT_ARTIFACTS: new FakeR2Bucket(),
      VRT_INDEX: new FakeKVNamespace(),
    });

    assert.deepEqual(caps, {
      r2: true,
      kv: true,
      d1: false,
      available: true,
    });
  });
});

describe("createWorkerStorage", () => {
  it("writes json artifacts to R2, KV, and D1 metadata tables", async () => {
    const r2 = new FakeR2Bucket();
    const kv = new FakeKVNamespace();
    const d1 = new FakeD1Database();
    const storage = createWorkerStorage({
      VRT_ARTIFACTS: r2,
      VRT_INDEX: kv,
      VRT_DB: d1,
    });

    await storage.ensureSchema();
    const record = await storage.putJsonArtifact({
      runId: "run-123",
      artifactKind: "migration",
      artifactPath: "reports/migration-report.json",
      payload: { status: "clean", viewports: 7 },
      contentType: "application/json",
      runType: "migration-blind",
    });

    assert.equal(record.r2Key, "runs/run-123/migration/reports/migration-report.json");
    assert.equal(r2.puts.length, 1);
    assert.equal(r2.puts[0]?.key, record.r2Key);
    assert.equal(r2.puts[0]?.options?.httpMetadata?.contentType, "application/json");

    assert.equal(kv.puts.length, 1);
    assert.equal(kv.puts[0]?.key, "artifacts:run-123:migration:reports/migration-report.json");

    assert.equal(d1.execCalls.length, 1);
    assert.match(d1.execCalls[0] ?? "", /CREATE TABLE IF NOT EXISTS vrt_artifacts/);
    assert.equal(d1.prepared.length, 1);
    assert.match(d1.prepared[0]?.sql ?? "", /INSERT INTO vrt_artifacts/);
    assert.equal(d1.prepared[0]?.values[0], "run-123");
    assert.equal(d1.prepared[0]?.values[1], "migration-blind");
  });
});
