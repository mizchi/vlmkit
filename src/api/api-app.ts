import { Hono } from "hono";
import { extractCloudflareCrawlRoutes } from "@mizchi/vlmkit-capture/cloudflare-quick-actions.ts";
import type {
  ApprovalListQuery,
  ApprovalListResponse,
  ApprovalOperationApiRequest,
  ApprovalOperationResponse,
  CloudflareCrawlRequest,
  CloudflareCrawlResult,
  CloudflareCrawlStartResult,
  CloudflareScreenshotRequest,
  CloudflareScreenshotResult,
  ComponentStatusMatrixQuery,
  ComponentStatusMatrixResponse,
  CraterWasmRenderRequest,
  CraterWasmRenderResult,
  DetectionSeriesQuery,
  DetectionSeriesResponse,
  ExecutionResultsQuery,
  ExecutionResultsResponse,
  SmokeTestRequest,
  StatusResponse,
  StorageStatus,
  VisualDiffDisplaysResponse,
} from "./api-types.ts";
import { buildOpenApiSpec } from "./openapi.ts";
import { registerCompareRoute } from "./routes/compare.ts";
import { registerCompareRenderersRoute } from "./routes/compare-renderers.ts";
import { registerReasonRoute } from "./routes/reason.ts";
import { loadCraterAvailability } from "./routes/helpers.ts";

const API_VERSION = "0.4.0";
const DEFAULT_MAX_BODY_SIZE = 10 * 1024 * 1024;

export interface CreateApiAppOptions {
  maxBodySize?: number;
  serverUrl?: string;
  resolveCraterAvailable?: () => Promise<boolean>;
  resolveStorageStatus?: () => Promise<StorageStatus | undefined> | StorageStatus | undefined;
  listExecutionResults?: (query: ExecutionResultsQuery) => Promise<ExecutionResultsResponse> | ExecutionResultsResponse;
  listVisualDiffDisplays?: (query: ExecutionResultsQuery) => Promise<VisualDiffDisplaysResponse> | VisualDiffDisplaysResponse;
  listDetectionSeries?: (query: DetectionSeriesQuery) => Promise<DetectionSeriesResponse> | DetectionSeriesResponse;
  getComponentStatusMatrix?: (query: ComponentStatusMatrixQuery) => Promise<ComponentStatusMatrixResponse> | ComponentStatusMatrixResponse;
  listApprovals?: (query: ApprovalListQuery) => Promise<ApprovalListResponse> | ApprovalListResponse;
  applyApprovalOperation?: (request: ApprovalOperationApiRequest) => Promise<ApprovalOperationResponse> | ApprovalOperationResponse;
  cloudflareQuickActions?: {
    screenshot: (request: CloudflareScreenshotRequest) => Promise<CloudflareScreenshotResult> | CloudflareScreenshotResult;
    startCrawl: (request: CloudflareCrawlRequest) => Promise<CloudflareCrawlStartResult> | CloudflareCrawlStartResult;
    getCrawlResult: (jobId: string) => Promise<CloudflareCrawlResult> | CloudflareCrawlResult;
  };
  craterWasmLayout?: {
    renderLayout: (request: CraterWasmRenderRequest) => Promise<CraterWasmRenderResult> | CraterWasmRenderResult;
  };
}

export function createApiApp(options: CreateApiAppOptions = {}) {
  const maxBodySize = options.maxBodySize ?? DEFAULT_MAX_BODY_SIZE;
  const app = new Hono();

  app.use("*", async (c, next) => {
    const contentLength = parseInt(c.req.header("content-length") ?? "0", 10);
    if (contentLength > maxBodySize) {
      return c.json({ error: `Request body too large (max ${maxBodySize} bytes)` }, 413);
    }
    await next();
  });

  app.get("/api/openapi.json", (c) => {
    const serverUrl = options.serverUrl ?? new URL(c.req.url).origin;
    return c.json(buildOpenApiSpec({ serverUrl }));
  });

  app.get("/api/status", async (c) => {
    const craterAvailable = options.resolveCraterAvailable
      ? await options.resolveCraterAvailable()
      : await loadCraterAvailability();
    const storage = options.resolveStorageStatus
      ? await options.resolveStorageStatus()
      : undefined;
    const status: StatusResponse = {
      version: API_VERSION,
      capabilities: [
        "compare",
        "compare-renderers",
        "smoke-test",
        "reason",
        "report",
        "openapi",
        ...(storage?.available ? ["storage"] : []),
        ...(options.listExecutionResults ? ["execution-results"] : []),
        ...(options.listVisualDiffDisplays ? ["visual-diffs"] : []),
        ...(options.listDetectionSeries ? ["detection-series"] : []),
        ...(options.getComponentStatusMatrix ? ["component-status-matrix"] : []),
        ...(options.listApprovals && options.applyApprovalOperation ? ["approvals"] : []),
        ...(options.cloudflareQuickActions ? ["cloudflare-quick-actions"] : []),
        ...(options.craterWasmLayout ? ["crater-wasm-layout"] : []),
      ],
      backends: [
        { name: "chromium", available: true },
        { name: "crater", available: craterAvailable },
        { name: "crater-wasm", available: Boolean(options.craterWasmLayout) },
      ],
      storage,
    };
    return c.json(status);
  });

  registerCompareRoute(app);
  registerCompareRenderersRoute(app, {
    resolveCraterAvailable: options.resolveCraterAvailable,
  });
  registerReasonRoute(app);

  app.get("/api/execution-results", async (c) => {
    if (!options.listExecutionResults) {
      return c.json({ error: "Execution result provider is not configured" }, 501);
    }
    return c.json(await options.listExecutionResults(parseResultQuery(new URL(c.req.url))));
  });

  app.get("/api/visual-diffs", async (c) => {
    if (!options.listVisualDiffDisplays) {
      return c.json({ error: "Visual diff provider is not configured" }, 501);
    }
    const query = parseResultQuery(new URL(c.req.url));
    return c.json(await options.listVisualDiffDisplays(query));
  });

  app.get("/api/detection-series", async (c) => {
    if (!options.listDetectionSeries) {
      return c.json({ error: "Detection series provider is not configured" }, 501);
    }
    return c.json(await options.listDetectionSeries(parseDetectionSeriesQuery(new URL(c.req.url))));
  });

  app.get("/api/component-status-matrix", async (c) => {
    if (!options.getComponentStatusMatrix) {
      return c.json({ error: "Component status matrix provider is not configured" }, 501);
    }
    return c.json(await options.getComponentStatusMatrix(parseComponentStatusMatrixQuery(new URL(c.req.url))));
  });

  app.get("/api/approvals", async (c) => {
    if (!options.listApprovals) {
      return c.json({ error: "Approval provider is not configured" }, 501);
    }
    return c.json(await options.listApprovals(parseApprovalListQuery(new URL(c.req.url))));
  });

  app.post("/api/approvals", async (c) => {
    if (!options.applyApprovalOperation) {
      return c.json({ error: "Approval provider is not configured" }, 501);
    }
    let body: ApprovalOperationApiRequest;
    try {
      body = await c.req.json<ApprovalOperationApiRequest>();
    } catch {
      return c.json({ error: "Invalid JSON body" }, 400);
    }
    try {
      return c.json(await options.applyApprovalOperation(body));
    } catch (error) {
      return c.json({ error: errorMessage(error) }, 400);
    }
  });

  app.post("/api/cloudflare/screenshot", async (c) => {
    if (!options.cloudflareQuickActions) {
      return c.json({ error: "Cloudflare Quick Actions provider is not configured" }, 501);
    }
    let body: CloudflareScreenshotRequest;
    try {
      body = await c.req.json<CloudflareScreenshotRequest>();
    } catch {
      return c.json({ error: "Invalid JSON body" }, 400);
    }
    try {
      const result = await options.cloudflareQuickActions.screenshot(body);
      const headers = new Headers({ "content-type": result.contentType });
      if (result.browserMsUsed !== undefined) {
        headers.set("x-browser-ms-used", String(result.browserMsUsed));
      }
      return new Response(result.bytes, { status: 200, headers });
    } catch (error) {
      return c.json({ error: errorMessage(error) }, 400);
    }
  });

  app.post("/api/cloudflare/crawl", async (c) => {
    if (!options.cloudflareQuickActions) {
      return c.json({ error: "Cloudflare Quick Actions provider is not configured" }, 501);
    }
    let body: CloudflareCrawlRequest;
    try {
      body = await c.req.json<CloudflareCrawlRequest>();
    } catch {
      return c.json({ error: "Invalid JSON body" }, 400);
    }
    try {
      return c.json(await options.cloudflareQuickActions.startCrawl(body));
    } catch (error) {
      return c.json({ error: errorMessage(error) }, 400);
    }
  });

  app.get("/api/cloudflare/crawl/:jobId/routes", async (c) => {
    if (!options.cloudflareQuickActions) {
      return c.json({ error: "Cloudflare Quick Actions provider is not configured" }, 501);
    }
    try {
      const result = await options.cloudflareQuickActions.getCrawlResult(c.req.param("jobId"));
      return c.json({
        jobId: result.id,
        status: result.status,
        routes: extractCloudflareCrawlRoutes(result, {
          baseUrl: new URL(c.req.url).searchParams.get("baseUrl") ?? undefined,
        }),
      });
    } catch (error) {
      return c.json({ error: errorMessage(error) }, 400);
    }
  });

  app.get("/api/cloudflare/crawl/:jobId", async (c) => {
    if (!options.cloudflareQuickActions) {
      return c.json({ error: "Cloudflare Quick Actions provider is not configured" }, 501);
    }
    try {
      return c.json(await options.cloudflareQuickActions.getCrawlResult(c.req.param("jobId")));
    } catch (error) {
      return c.json({ error: errorMessage(error) }, 400);
    }
  });

  app.post("/api/crater/layout", async (c) => {
    if (!options.craterWasmLayout) {
      return c.json({ error: "Crater WASM layout provider is not configured" }, 501);
    }
    let body: CraterWasmRenderRequest;
    try {
      body = await c.req.json<CraterWasmRenderRequest>();
    } catch {
      return c.json({ error: "Invalid JSON body" }, 400);
    }
    if (typeof body.html !== "string" || !body.viewport) {
      return c.json({ error: "Missing html or viewport" }, 400);
    }
    try {
      return c.json(await options.craterWasmLayout.renderLayout(body));
    } catch (error) {
      return c.json({ error: errorMessage(error) }, 400);
    }
  });

  app.post("/api/smoke-test", async (c) => {
    let body: SmokeTestRequest;
    try {
      body = await c.req.json<SmokeTestRequest>();
    } catch {
      return c.json({ error: "Invalid JSON body" }, 400);
    }

    if (!body.target?.html && !body.target?.url) {
      return c.json({ error: "Missing target.html or target.url" }, 400);
    }
    if (body.target.url && !body.target.url.startsWith("http://") && !body.target.url.startsWith("https://")) {
      return c.json({ error: "target.url must use http:// or https://" }, 400);
    }
    if (typeof body.maxActions === "number" && (body.maxActions < 1 || body.maxActions > 1000)) {
      return c.json({ error: "maxActions must be 1-1000" }, 400);
    }

    const { runSmokeTest } = await import("@mizchi/vlmkit-markup/inspect/smoke-runner.ts");
    const result = await runSmokeTest(body);
    return c.json(result);
  });

  return app;
}

function parsePositiveInt(value: string | null): number | undefined {
  if (value == null || value === "") return undefined;
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : undefined;
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function parseResultQuery(url: URL): ExecutionResultsQuery {
  return {
    q: url.searchParams.get("q") ?? undefined,
    runType: url.searchParams.get("runType") ?? undefined,
    artifactKind: url.searchParams.get("artifactKind") ?? undefined,
    limit: parsePositiveInt(url.searchParams.get("limit")),
    offset: parseNonNegativeInt(url.searchParams.get("offset")),
  };
}

function parseDetectionSeriesQuery(url: URL): DetectionSeriesQuery {
  const backend = url.searchParams.get("backend");
  return {
    backend: backend === "chromium" || backend === "crater" || backend === "prescanner"
      ? backend
      : undefined,
    fixture: url.searchParams.get("fixture") ?? undefined,
    limit: parsePositiveInt(url.searchParams.get("limit")),
  };
}

function parseComponentStatusMatrixQuery(url: URL): ComponentStatusMatrixQuery {
  return {
    report: url.searchParams.get("report") ?? undefined,
    label: url.searchParams.get("label") ?? undefined,
    viewport: url.searchParams.get("viewport") ?? undefined,
  };
}

function parseApprovalListQuery(url: URL): ApprovalListQuery {
  return {
    path: url.searchParams.get("path") ?? undefined,
  };
}

function parseNonNegativeInt(value: string | null): number | undefined {
  if (value == null || value === "") return undefined;
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : undefined;
}
