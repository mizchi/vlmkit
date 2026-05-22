/**
 * vrt TypeScript Client SDK
 *
 * Type-safe client for all API server endpoints.
 * Works in Node.js / Deno / browsers.
 *
 * Usage:
 *   import { VrtClient } from "./client.ts";
 *   const client = new VrtClient("http://localhost:3456");
 *   const result = await client.compare({ baseline: { html: "..." }, current: { html: "..." } });
 */
import type {
  ApprovalListQuery,
  ApprovalListResponse,
  ApprovalOperationApiRequest,
  ApprovalOperationResponse,
  CloudflareCrawlRequest,
  CloudflareCrawlResult,
  CloudflareCrawlRoute,
  CloudflareCrawlStartResult,
  CloudflareScreenshotRequest,
  CloudflareScreenshotResult,
  ComponentStatusMatrixQuery,
  ComponentStatusMatrixResponse,
  CompareRequest, CompareResponse,
  CraterWasmRenderRequest,
  CraterWasmRenderResult,
  DetectionSeriesQuery,
  DetectionSeriesResponse,
  ExecutionResultsQuery,
  ExecutionResultsResponse,
  SmokeTestRequest, SmokeTestResponse,
  StatusResponse,
  HtmlSource,
  VisualDiffDisplaysResponse,
  Viewport,
} from "./api-types.ts";

export class VrtClient {
  private baseUrl: string;

  constructor(baseUrl = "http://localhost:3456") {
    this.baseUrl = baseUrl.replace(/\/$/, "");
  }

  async status(): Promise<StatusResponse> {
    return this.get("/api/status");
  }

  async compare(request: CompareRequest): Promise<CompareResponse> {
    return this.post("/api/compare", request);
  }

  async compareHtml(
    baseline: string,
    current: string,
    options?: { viewports?: Viewport[]; threshold?: number; baselineLabel?: string; currentLabel?: string },
  ): Promise<CompareResponse> {
    return this.compare({
      baseline: { html: baseline, label: options?.baselineLabel },
      current: { html: current, label: options?.currentLabel },
      viewports: options?.viewports,
      options: { threshold: options?.threshold },
    });
  }

  async compareUrls(
    baseline: string,
    current: string,
    options?: { viewports?: Viewport[]; threshold?: number },
  ): Promise<CompareResponse> {
    return this.compare({
      baseline: { url: baseline, label: baseline },
      current: { url: current, label: current },
      viewports: options?.viewports,
      options: { threshold: options?.threshold },
    });
  }

  async compareRenderers(
    html: string | HtmlSource,
    options?: { viewports?: Viewport[]; threshold?: number },
  ): Promise<{ status: string; results: any[]; meta: any }> {
    const source: HtmlSource = typeof html === "string" ? { html } : html;
    return this.post("/api/compare-renderers", {
      html: source,
      viewports: options?.viewports,
      threshold: options?.threshold,
    });
  }

  async smokeTest(request: SmokeTestRequest): Promise<SmokeTestResponse> {
    return this.post("/api/smoke-test", request);
  }

  async smokeTestHtml(
    html: string,
    options?: { maxActions?: number; seed?: number },
  ): Promise<SmokeTestResponse> {
    return this.smokeTest({
      target: { html },
      mode: "random",
      maxActions: options?.maxActions ?? 20,
      seed: options?.seed,
      blockExternalNavigation: true,
    });
  }

  async smokeTestUrl(
    url: string,
    options?: { maxActions?: number; seed?: number },
  ): Promise<SmokeTestResponse> {
    return this.smokeTest({
      target: { url },
      mode: "random",
      maxActions: options?.maxActions ?? 20,
      seed: options?.seed,
      blockExternalNavigation: true,
    });
  }

  async executionResults(query: ExecutionResultsQuery = {}): Promise<ExecutionResultsResponse> {
    return this.get(buildQueryPath("/api/execution-results", query));
  }

  async visualDiffs(query: ExecutionResultsQuery = {}): Promise<VisualDiffDisplaysResponse> {
    return this.get(buildQueryPath("/api/visual-diffs", query));
  }

  async detectionSeries(query: DetectionSeriesQuery = {}): Promise<DetectionSeriesResponse> {
    return this.get(buildQueryPath("/api/detection-series", query));
  }

  async componentStatusMatrix(
    query: ComponentStatusMatrixQuery = {},
  ): Promise<ComponentStatusMatrixResponse> {
    return this.get(buildQueryPath("/api/component-status-matrix", query));
  }

  async approvals(query: ApprovalListQuery = {}): Promise<ApprovalListResponse> {
    return this.get(buildQueryPath("/api/approvals", query));
  }

  async applyApproval(request: ApprovalOperationApiRequest): Promise<ApprovalOperationResponse> {
    return this.post("/api/approvals", request);
  }

  async cloudflareScreenshot(request: CloudflareScreenshotRequest): Promise<CloudflareScreenshotResult> {
    const res = await this.postRaw("/api/cloudflare/screenshot", request);
    const browserMsUsed = res.headers.get("x-browser-ms-used");
    return {
      bytes: await res.arrayBuffer(),
      contentType: res.headers.get("content-type") ?? "image/png",
      browserMsUsed: browserMsUsed ? Number(browserMsUsed) : undefined,
    };
  }

  async cloudflareStartCrawl(request: CloudflareCrawlRequest): Promise<CloudflareCrawlStartResult> {
    return this.post("/api/cloudflare/crawl", request);
  }

  async cloudflareCrawlResult(jobId: string): Promise<CloudflareCrawlResult> {
    return this.get(`/api/cloudflare/crawl/${encodeURIComponent(jobId)}`);
  }

  async cloudflareCrawlRoutes(
    jobId: string,
    query: { baseUrl?: string } = {},
  ): Promise<{ jobId: string; status: string; routes: CloudflareCrawlRoute[] }> {
    return this.get(buildQueryPath(`/api/cloudflare/crawl/${encodeURIComponent(jobId)}/routes`, query));
  }

  async craterLayout(request: CraterWasmRenderRequest): Promise<CraterWasmRenderResult> {
    return this.post("/api/crater/layout", request);
  }

  // ---- Reasoning Pipeline ----

  async reason(request: import("./api-types.ts").ReasoningPipelineRequest): Promise<import("./api-types.ts").ReasoningPipelineResponse> {
    return this.post("/api/reason", request);
  }

  async analyzeImage(heatmapBase64: string, textReport?: string): Promise<import("./api-types.ts").ReasoningPipelineResponse> {
    return this.reason({ heatmapBase64, textReport, stages: "analyze" });
  }

  async analyzeAndFix(options: {
    heatmapBase64?: string;
    textReport?: string;
    cssSource: string;
  }): Promise<import("./api-types.ts").ReasoningPipelineResponse> {
    return this.reason({ ...options, stages: "both" });
  }

  // ---- Helpers ----

  async isAvailable(): Promise<boolean> {
    try {
      await this.status();
      return true;
    } catch {
      return false;
    }
  }

  async waitForServer(timeoutMs = 10000): Promise<void> {
    const start = Date.now();
    while (Date.now() - start < timeoutMs) {
      if (await this.isAvailable()) return;
      await new Promise((r) => setTimeout(r, 500));
    }
    throw new Error(`Server not available at ${this.baseUrl} after ${timeoutMs}ms`);
  }

  // ---- Internal ----

  private async get<T>(path: string): Promise<T> {
    const res = await fetch(`${this.baseUrl}${path}`);
    if (!res.ok) throw new Error(`${res.status} ${res.statusText}: ${await res.text()}`);
    return res.json() as Promise<T>;
  }

  private async post<T>(path: string, body: unknown): Promise<T> {
    const res = await this.postRaw(path, body);
    return res.json() as Promise<T>;
  }

  private async postRaw(path: string, body: unknown): Promise<Response> {
    const res = await fetch(`${this.baseUrl}${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!res.ok) throw new Error(`${res.status} ${res.statusText}: ${await res.text()}`);
    return res;
  }
}

function buildQueryPath(path: string, query: object): string {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (value == null || value === "") continue;
    params.set(key, String(value));
  }
  const qs = params.toString();
  return qs ? `${path}?${qs}` : path;
}
