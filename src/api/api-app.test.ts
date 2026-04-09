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
    });

    const statusResponse = await app.request("http://vrt.local/api/status");
    assert.equal(statusResponse.status, 200);
    const status = await statusResponse.json() as {
      capabilities: string[];
      backends: Array<{ name: string; available: boolean }>;
    };
    assert.ok(status.capabilities.includes("openapi"));
    assert.equal(status.backends.find((backend) => backend.name === "crater")?.available, false);

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
});
