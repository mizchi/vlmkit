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
});
