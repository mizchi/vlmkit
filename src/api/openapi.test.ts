import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { buildOpenApiSpec } from "./openapi.ts";

describe("buildOpenApiSpec", () => {
  it("documents the HTTP API surface and component refs", () => {
    const spec = buildOpenApiSpec({
      serverUrl: "http://127.0.0.1:4567",
    });

    assert.equal(spec.openapi, "3.1.0");
    assert.equal(spec.info.title, "vrt HTTP API");
    assert.equal(spec.servers[0]?.url, "http://127.0.0.1:4567");

    assert.ok(spec.paths["/api/openapi.json"]);
    assert.ok(spec.paths["/api/status"]);
    assert.ok(spec.paths["/api/compare"]);
    assert.ok(spec.paths["/api/compare-renderers"]);
    assert.ok(spec.paths["/api/execution-results"]);
    assert.ok(spec.paths["/api/visual-diffs"]);
    assert.ok(spec.paths["/api/reason"]);
    assert.ok(spec.paths["/api/smoke-test"]);

    const compare = spec.paths["/api/compare"]?.post;
    assert.equal(
      compare?.requestBody?.content?.["application/json"]?.schema?.$ref,
      "#/components/schemas/CompareRequest",
    );
    assert.equal(
      compare?.responses?.["200"]?.content?.["application/json"]?.schema?.$ref,
      "#/components/schemas/CompareResponse",
    );

    const smokeTest = spec.paths["/api/smoke-test"]?.post;
    assert.equal(
      smokeTest?.requestBody?.content?.["application/json"]?.schema?.$ref,
      "#/components/schemas/SmokeTestRequest",
    );
    assert.equal(
      smokeTest?.responses?.["200"]?.content?.["application/json"]?.schema?.$ref,
      "#/components/schemas/SmokeTestResponse",
    );

    assert.ok(spec.components.schemas.CompareRequest);
    assert.ok(spec.components.schemas.CompareResponse);
    assert.ok(spec.components.schemas.ReasoningPipelineRequest);
    assert.ok(spec.components.schemas.SmokeTestResponse);
    assert.ok(spec.components.schemas.ExecutionResultsResponse);
    assert.ok(spec.components.schemas.VisualDiffDisplaysResponse);
    assert.ok(spec.components.schemas.ErrorResponse);
  });
});
