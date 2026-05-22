import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { createApiApp } from "./api-app.ts";
import worker from "../../worker/index.ts";

describe("createApiApp", () => {
  it("exports a Cloudflare-compatible fetch handler", () => {
    assert.equal(typeof worker.fetch, "function");
  });

  it("serves status and openapi from the shared app factory", async () => {
    const app = createApiApp({
      resolveCraterAvailable: async () => false,
      resolveStorageStatus: () => ({
        r2: true,
        kv: true,
        d1: false,
        available: true,
      }),
    });

    const statusResponse = await app.request("http://vrt.local/api/status");
    assert.equal(statusResponse.status, 200);
    const status = await statusResponse.json() as {
      capabilities: string[];
      backends: Array<{ name: string; available: boolean }>;
      storage?: { r2: boolean; kv: boolean; d1: boolean; available: boolean };
    };
    assert.ok(status.capabilities.includes("openapi"));
    assert.ok(status.capabilities.includes("storage"));
    assert.equal(status.backends.find((backend) => backend.name === "crater")?.available, false);
    assert.equal(status.storage?.r2, true);
    assert.equal(status.storage?.kv, true);
    assert.equal(status.storage?.d1, false);

    const openApiResponse = await app.request("http://vrt.local/api/openapi.json");
    assert.equal(openApiResponse.status, 200);
    const spec = await openApiResponse.json() as {
      servers: Array<{ url: string }>;
      paths: Record<string, unknown>;
    };
    assert.equal(spec.servers[0]?.url, "http://vrt.local");
    assert.ok(spec.paths["/api/status"]);
    assert.ok(spec.paths["/api/openapi.json"]);
  });

  it("serves execution result list/search when a provider is configured", async () => {
    const app = createApiApp({
      resolveCraterAvailable: async () => false,
      listExecutionResults: async (query) => ({
        total: 1,
        results: [{
          runId: query.q === "daily" ? "daily-1" : "other",
          runType: "snapshot",
          latestCreatedAt: "2026-05-22T00:00:00.000Z",
          artifactCount: 1,
          artifactKinds: ["snapshot"],
          artifacts: [],
        }],
      }),
    });

    const response = await app.request("http://vrt.local/api/execution-results?q=daily&limit=5");

    assert.equal(response.status, 200);
    const body = await response.json() as {
      total: number;
      results: Array<{ runId: string }>;
    };
    assert.equal(body.total, 1);
    assert.equal(body.results[0]?.runId, "daily-1");
  });

  it("wires worker D1 storage into execution result search", async () => {
    const env = {
      VRT_DB: {
        async exec() {
          return {};
        },
        prepare() {
          return {
            bind() {
              return {
                async run() {
                  return {};
                },
                async all() {
                  return {
                    results: [{
                      run_id: "worker-run",
                      run_type: "snapshot",
                      artifact_kind: "snapshot",
                      artifact_path: "snapshot-report.json",
                      r2_key: "runs/worker-run/snapshot/snapshot-report.json",
                      content_type: "application/json",
                      created_at: "2026-05-22T00:00:00.000Z",
                    }],
                  };
                },
              };
            },
          };
        },
      },
    };

    const response = await worker.fetch(
      new Request("http://vrt.local/api/execution-results?q=worker"),
      env as never,
      {} as never,
    );

    assert.equal(response.status, 200);
    const body = await response.json() as {
      results: Array<{ runId: string }>;
    };
    assert.equal(body.results[0]?.runId, "worker-run");
  });

  it("serves visual diff display models when a provider is configured", async () => {
    const app = createApiApp({
      resolveCraterAvailable: async () => false,
      listVisualDiffDisplays: async () => ({
        total: 1,
        results: [{
          runId: "run-1",
          runType: "snapshot",
          displayKey: "home-desktop",
          latestCreatedAt: "2026-05-22T00:00:00.000Z",
          availableModes: ["side-by-side", "heatmap", "overlay"],
          assets: {},
        }],
      }),
    });

    const response = await app.request("http://vrt.local/api/visual-diffs?q=home");

    assert.equal(response.status, 200);
    const body = await response.json() as {
      total: number;
      results: Array<{ displayKey: string }>;
    };
    assert.equal(body.total, 1);
    assert.equal(body.results[0]?.displayKey, "home-desktop");
  });

  it("serves benchmark detection series when a provider is configured", async () => {
    const app = createApiApp({
      resolveCraterAvailable: async () => false,
      listDetectionSeries: async (query) => ({
        total: 2,
        points: [{
          runId: `${query.backend ?? "all"}:${query.fixture ?? "all"}`,
          createdAt: "2026-05-22T00:00:00.000Z",
          fixture: query.fixture ?? "page",
          backend: query.backend ?? "prescanner",
          trials: 10,
          detected: 8,
          detectionRate: 0.8,
          avgMsPerTrial: 380,
        }],
      }),
    });

    const response = await app.request("http://vrt.local/api/detection-series?backend=prescanner&fixture=page&limit=5");

    assert.equal(response.status, 200);
    const body = await response.json() as {
      total: number;
      points: Array<{ runId: string; detectionRate: number }>;
    };
    assert.equal(body.total, 2);
    assert.equal(body.points[0]?.runId, "prescanner:page");
    assert.equal(body.points[0]?.detectionRate, 0.8);
  });
});
