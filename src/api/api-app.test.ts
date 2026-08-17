import assert from "node:assert/strict";
import { describe, it } from "vitest";
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
          metadataOnly: 3,
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

  it("serves component status matrices when a provider is configured", async () => {
    const app = createApiApp({
      resolveCraterAvailable: async () => false,
      getComponentStatusMatrix: async (query) => ({
        timestamp: "2026-05-22T00:00:00.000Z",
        components: [query.label ?? "card"],
        viewports: [query.viewport ?? "desktop"],
        rows: [{
          component: query.label ?? "card",
          worstStatus: "diff",
          maxDiffRatio: 0.02,
          cells: [{
            component: query.label ?? "card",
            viewport: query.viewport ?? "desktop",
            status: "diff",
            isNew: false,
            diffRatio: 0.02,
            shiftOnly: false,
          }],
        }],
        summary: {
          totalCells: 1,
          passCount: 0,
          diffCount: 1,
          shiftOnlyCount: 0,
          newBaselineCount: 0,
          missingCount: 0,
          maxDiffRatio: 0.02,
        },
      }),
    });

    const response = await app.request("http://vrt.local/api/component-status-matrix?label=hero&viewport=mobile");

    assert.equal(response.status, 200);
    const body = await response.json() as {
      components: string[];
      viewports: string[];
      rows: Array<{ component: string; worstStatus: string }>;
    };
    assert.deepEqual(body.components, ["hero"]);
    assert.deepEqual(body.viewports, ["mobile"]);
    assert.equal(body.rows[0]?.worstStatus, "diff");
  });

  it("serves interactive approval list and operation providers", async () => {
    const app = createApiApp({
      resolveCraterAvailable: async () => false,
      listApprovals: async (query) => ({
        path: query.path ?? "approval.json",
        total: 1,
        rules: [{ selector: ".hero", reason: "intentional" }],
        warnings: [],
      }),
      applyApprovalOperation: async (request) => ({
        path: request.path ?? "approval.json",
        action: request.action,
        dryRun: request.dryRun ?? false,
        beforeCount: 0,
        afterCount: 1,
        added: request.action === "add" ? request.rule : undefined,
        total: 1,
        rules: request.action === "add" ? [request.rule] : [],
        warnings: [],
      }),
    });

    const listResponse = await app.request("http://vrt.local/api/approvals?path=approval.json");
    assert.equal(listResponse.status, 200);
    const list = await listResponse.json() as { total: number; rules: Array<{ selector?: string }> };
    assert.equal(list.total, 1);
    assert.equal(list.rules[0]?.selector, ".hero");

    const operationResponse = await app.request("http://vrt.local/api/approvals", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "add",
        path: "approval.json",
        rule: { selector: ".card", reason: "reviewed in dashboard" },
      }),
    });
    assert.equal(operationResponse.status, 200);
    const operation = await operationResponse.json() as { action: string; added?: { selector?: string } };
    assert.equal(operation.action, "add");
    assert.equal(operation.added?.selector, ".card");
  });

  it("serves Cloudflare Quick Actions providers when configured", async () => {
    const app = createApiApp({
      resolveCraterAvailable: async () => false,
      cloudflareQuickActions: {
        async screenshot() {
          return {
            bytes: new Uint8Array([1, 2, 3]).buffer,
            contentType: "image/png",
            browserMsUsed: 25,
          };
        },
        async startCrawl() {
          return { jobId: "crawl-1" };
        },
        async getCrawlResult() {
          return {
            id: "crawl-1",
            status: "completed",
            total: 1,
            finished: 1,
            records: [{
              url: "https://example.com/docs",
              status: "completed",
              metadata: { status: 200, url: "https://example.com/docs", title: "Docs" },
            }],
          };
        },
      },
    });

    const screenshotResponse = await app.request("http://vrt.local/api/cloudflare/screenshot", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url: "https://example.com" }),
    });
    assert.equal(screenshotResponse.status, 200);
    assert.equal(screenshotResponse.headers.get("content-type"), "image/png");
    assert.equal(screenshotResponse.headers.get("x-browser-ms-used"), "25");
    assert.deepEqual(new Uint8Array(await screenshotResponse.arrayBuffer()), new Uint8Array([1, 2, 3]));

    const crawlResponse = await app.request("http://vrt.local/api/cloudflare/crawl", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url: "https://example.com/docs", render: false }),
    });
    assert.equal(crawlResponse.status, 200);
    assert.equal((await crawlResponse.json() as { jobId: string }).jobId, "crawl-1");

    const routesResponse = await app.request("http://vrt.local/api/cloudflare/crawl/crawl-1/routes?baseUrl=https://example.com");
    assert.equal(routesResponse.status, 200);
    const routes = await routesResponse.json() as { routes: Array<{ path: string; title?: string }> };
    assert.deepEqual(routes.routes, [{ url: "https://example.com/docs", path: "/docs", title: "Docs" }]);
  });

  it("serves Crater WASM layout providers when configured", async () => {
    const app = createApiApp({
      resolveCraterAvailable: async () => false,
      craterWasmLayout: {
        async renderLayout(request) {
          return {
            backend: "crater-wasm",
            viewport: request.viewport,
            rawJson: "{}",
            elapsedMs: 1,
            layout: {
              id: request.html.includes("main") ? "main-root" : "root",
              x: 0,
              y: 0,
              width: request.viewport.width,
              height: request.viewport.height,
              margin: { top: 0, right: 0, bottom: 0, left: 0 },
              padding: { top: 0, right: 0, bottom: 0, left: 0 },
              border: { top: 0, right: 0, bottom: 0, left: 0 },
              children: [],
            },
            diagnostics: {
              nodeCount: 1,
              maxDepth: 1,
              rootBox: { x: 0, y: 0, width: request.viewport.width, height: request.viewport.height },
            },
          };
        },
      },
    });

    const statusResponse = await app.request("http://vrt.local/api/status");
    const status = await statusResponse.json() as {
      capabilities: string[];
      backends: Array<{ name: string; available: boolean }>;
    };
    assert.ok(status.capabilities.includes("crater-wasm-layout"));
    assert.equal(status.backends.find((backend) => backend.name === "crater-wasm")?.available, true);

    const layoutResponse = await app.request("http://vrt.local/api/crater/layout", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        html: "<main>Hello</main>",
        viewport: { width: 640, height: 360, label: "wide" },
      }),
    });

    assert.equal(layoutResponse.status, 200);
    const layout = await layoutResponse.json() as {
      backend: string;
      viewport: { width: number; height: number; label?: string };
      layout: { id: string; width: number; height: number };
      diagnostics: { nodeCount: number };
    };
    assert.equal(layout.backend, "crater-wasm");
    assert.equal(layout.viewport.label, "wide");
    assert.equal(layout.layout.id, "main-root");
    assert.equal(layout.layout.width, 640);
    assert.equal(layout.diagnostics.nodeCount, 1);
  });
});
