import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  DEFAULT_WORKFLOW_CAPTURE_ROUTES,
  parseWorkflowCaptureConfig,
  parseWorkflowCaptureEnv,
  parseWorkflowCliArgs,
  resolveWorkflowPaths,
  resolveWorkflowRouteUrl,
} from "./workflow-config.ts";

describe("parseWorkflowCaptureConfig", () => {
  it("reuses top-level baseUrl and routes from vrt.config.json", () => {
    const config = parseWorkflowCaptureConfig(`{
      "baseUrl": "http://localhost:3000",
      "routes": [
        "/",
        { "path": "/issues?severity=critical", "label": "critical-issues", "waitFor": "main" }
      ]
    }`);

    assert.equal(config.baseUrl, "http://localhost:3000");
    assert.deepEqual(config.routes, [
      { name: "root", path: "/" },
      { name: "critical-issues", path: "/issues?severity=critical", waitFor: "main" },
    ]);
  });

  it("supports workflow-scoped overrides including captureSpec", () => {
    const config = parseWorkflowCaptureConfig(`{
      "baseUrl": "http://localhost:3000",
      "routes": ["/"],
      "workflow": {
        "baseUrl": "http://127.0.0.1:4173",
        "routes": [
          { "path": "/dashboard", "name": "dashboard", "waitFor": "[data-ready]" }
        ],
        "captureSpec": "./e2e/custom-vrt-capture.spec.ts"
      }
    }`);

    assert.equal(config.baseUrl, "http://127.0.0.1:4173");
    assert.equal(config.captureSpec, "./e2e/custom-vrt-capture.spec.ts");
    assert.deepEqual(config.routes, [
      { name: "dashboard", path: "/dashboard", waitFor: "[data-ready]" },
    ]);
  });
});

describe("parseWorkflowCliArgs", () => {
  it("uses config routes by default", () => {
    const options = parseWorkflowCliArgs([], {
      baseUrl: "http://localhost:3000",
      routes: [{ name: "root", path: "/" }],
      captureSpec: "./e2e/custom.spec.ts",
    });

    assert.equal(options.baseUrl, "http://localhost:3000");
    assert.equal(options.captureSpec, "./e2e/custom.spec.ts");
    assert.deepEqual(options.routes, [{ name: "root", path: "/" }]);
  });

  it("lets --capture-spec override the config default", () => {
    const options = parseWorkflowCliArgs([
      "--capture-spec",
      "./playwright/vrt.spec.ts",
    ], {
      captureSpec: "./e2e/custom.spec.ts",
    });

    assert.equal(options.captureSpec, "./playwright/vrt.spec.ts");
  });

  it("ignores --config because loading happens before parsing", () => {
    const options = parseWorkflowCliArgs([
      "--config",
      "./fixtures/vrt.config.json",
    ], {
      routes: [{ name: "root", path: "/" }],
    });

    assert.deepEqual(options.routes, [{ name: "root", path: "/" }]);
  });
});

describe("parseWorkflowCaptureEnv", () => {
  it("uses built-in routes when no manifest is provided", () => {
    assert.deepEqual(parseWorkflowCaptureEnv({}), DEFAULT_WORKFLOW_CAPTURE_ROUTES);
  });

  it("parses route manifests from env", () => {
    const routes = parseWorkflowCaptureEnv({
      VRT_ROUTES_JSON: JSON.stringify([
        { path: "/", name: "home" },
        { path: "/issues?severity=critical", label: "critical-issues", waitFor: "main" },
      ]),
    });

    assert.deepEqual(routes, [
      { name: "home", path: "/" },
      { name: "critical-issues", path: "/issues?severity=critical", waitFor: "main" },
    ]);
  });
});

describe("resolveWorkflowRouteUrl", () => {
  it("resolves relative routes against baseUrl", () => {
    assert.equal(
      resolveWorkflowRouteUrl({ name: "issues", path: "/issues?severity=critical" }, "http://localhost:3000"),
      "http://localhost:3000/issues?severity=critical",
    );
  });

  it("passes through absolute URLs", () => {
    assert.equal(
      resolveWorkflowRouteUrl({ name: "issues", path: "https://example.com/issues" }, "http://localhost:3000"),
      "https://example.com/issues",
    );
  });
});

describe("resolveWorkflowPaths", () => {
  it("roots workflow artifacts under the target project directory", () => {
    const paths = resolveWorkflowPaths("/tmp/external-app");

    assert.equal(paths.baselinesDir, "/tmp/external-app/baselines");
    assert.equal(paths.snapshotsDir, "/tmp/external-app/snapshots");
    assert.equal(paths.outputDir, "/tmp/external-app/output");
    assert.equal(paths.reportPath, "/tmp/external-app/vrt-report.json");
    assert.equal(paths.expectationPath, "/tmp/external-app/expectation.json");
    assert.equal(paths.specPath, "/tmp/external-app/spec.json");
  });
});
