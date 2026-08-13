import assert from "node:assert/strict";
import { describe, it } from "vitest";
import {
  buildWorkerArtifactKey,
  buildWorkerExecutionResults,
  buildWorkerVisualDiffDisplays,
  createWorkerStorage,
  detectWorkerStorageCapabilities,
  normalizeWorkerArtifactPath,
  type WorkerD1Like,
  type WorkerKVNamespaceLike,
  type WorkerR2BucketLike,
} from "./storage.ts";

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
  rows: unknown[] = [];

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
        all: async () => {
          this.prepared.push({ sql: query, values });
          return { results: this.rows };
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

  it("lists execution results grouped by run id from D1 artifact rows", async () => {
    const d1 = new FakeD1Database();
    d1.rows = [
      {
        run_id: "run-a",
        run_type: "snapshot",
        artifact_kind: "snapshot",
        artifact_path: "snapshot-report.json",
        r2_key: "runs/run-a/snapshot/snapshot-report.json",
        content_type: "application/json",
        created_at: "2026-05-22T00:00:00.000Z",
      },
      {
        run_id: "run-a",
        run_type: "snapshot",
        artifact_kind: "heatmap",
        artifact_path: "home_heatmap.png",
        r2_key: "runs/run-a/heatmap/home_heatmap.png",
        content_type: "image/png",
        created_at: "2026-05-22T00:00:01.000Z",
      },
    ];
    const storage = createWorkerStorage({ VRT_DB: d1 });

    const result = await storage.listExecutionResults({ q: "heatmap" });

    assert.equal(result.total, 1);
    assert.equal(result.results[0]?.runId, "run-a");
    assert.equal(result.results[0]?.artifactCount, 2);
    assert.deepEqual(result.results[0]?.artifactKinds, ["heatmap", "snapshot"]);
  });
});

describe("buildWorkerExecutionResults", () => {
  it("searches across run metadata and artifact paths", () => {
    const result = buildWorkerExecutionResults([
      {
        runId: "daily-1",
        runType: "snapshot",
        artifactKind: "snapshot",
        artifactPath: "snapshot-report.json",
        r2Key: "runs/daily-1/snapshot/snapshot-report.json",
        kvKey: "artifacts:daily-1:snapshot:snapshot-report.json",
        contentType: "application/json",
        createdAt: "2026-05-22T00:00:00.000Z",
      },
      {
        runId: "migration-1",
        runType: "migration-blind",
        artifactKind: "heatmap",
        artifactPath: "diffs/home_heatmap.png",
        r2Key: "runs/migration-1/heatmap/diffs/home_heatmap.png",
        kvKey: "artifacts:migration-1:heatmap:diffs/home_heatmap.png",
        contentType: "image/png",
        createdAt: "2026-05-22T00:01:00.000Z",
      },
    ], { q: "home", limit: 10 });

    assert.equal(result.total, 1);
    assert.equal(result.results[0]?.runId, "migration-1");
  });
});

describe("buildWorkerVisualDiffDisplays", () => {
  it("groups baseline/current/heatmap artifacts into dashboard display models", () => {
    const result = buildWorkerVisualDiffDisplays([
      {
        runId: "run-1",
        runType: "snapshot",
        artifactKind: "baseline",
        artifactPath: "home-desktop-baseline.png",
        r2Key: "runs/run-1/baseline/home-desktop-baseline.png",
        kvKey: "artifacts:run-1:baseline:home-desktop-baseline.png",
        contentType: "image/png",
        createdAt: "2026-05-22T00:00:00.000Z",
      },
      {
        runId: "run-1",
        runType: "snapshot",
        artifactKind: "current",
        artifactPath: "home-desktop-current.png",
        r2Key: "runs/run-1/current/home-desktop-current.png",
        kvKey: "artifacts:run-1:current:home-desktop-current.png",
        contentType: "image/png",
        createdAt: "2026-05-22T00:00:01.000Z",
      },
      {
        runId: "run-1",
        runType: "snapshot",
        artifactKind: "heatmap",
        artifactPath: "home-desktop_heatmap.png",
        r2Key: "runs/run-1/heatmap/home-desktop_heatmap.png",
        kvKey: "artifacts:run-1:heatmap:home-desktop_heatmap.png",
        contentType: "image/png",
        createdAt: "2026-05-22T00:00:02.000Z",
      },
    ], { q: "home" });

    assert.equal(result.total, 1);
    assert.equal(result.results[0]?.displayKey, "home-desktop");
    assert.deepEqual(result.results[0]?.availableModes, ["heatmap", "overlay", "side-by-side"]);
    assert.equal(result.results[0]?.assets.baseline?.artifactKind, "baseline");
    assert.equal(result.results[0]?.assets.current?.artifactKind, "current");
    assert.equal(result.results[0]?.assets.heatmap?.artifactKind, "heatmap");
  });
});
