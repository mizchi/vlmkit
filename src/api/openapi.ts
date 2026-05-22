const API_VERSION = "0.4.0";

type OpenApiSchema = Record<string, unknown>;

interface OpenApiMediaType {
  schema: OpenApiSchema;
}

interface OpenApiRequestBody {
  required?: boolean;
  content: Record<string, OpenApiMediaType>;
}

interface OpenApiResponse {
  description: string;
  content?: Record<string, OpenApiMediaType>;
}

interface OpenApiOperation {
  tags?: string[];
  summary?: string;
  requestBody?: OpenApiRequestBody;
  responses: Record<string, OpenApiResponse>;
}

interface OpenApiPathItem {
  get?: OpenApiOperation;
  post?: OpenApiOperation;
}

export interface OpenApiSpecOptions {
  serverUrl?: string;
}

export interface OpenApiSpec {
  openapi: string;
  info: {
    title: string;
    version: string;
    description: string;
  };
  servers: Array<{ url: string }>;
  tags: Array<{ name: string; description: string }>;
  paths: Record<string, OpenApiPathItem>;
  components: {
    schemas: Record<string, OpenApiSchema>;
  };
}

export function buildOpenApiSpec(options: OpenApiSpecOptions = {}): OpenApiSpec {
  const serverUrl = options.serverUrl ?? "http://127.0.0.1:3456";

  return {
    openapi: "3.1.0",
    info: {
      title: "vrt HTTP API",
      version: API_VERSION,
      description: "Visual regression testing, renderer comparison, reasoning, and smoke test endpoints.",
    },
    servers: [{ url: serverUrl }],
    tags: [
      { name: "meta", description: "Server metadata and schema discovery." },
      { name: "compare", description: "Visual diff and renderer comparison endpoints." },
      { name: "reason", description: "VLM/LLM reasoning and CSS fix suggestions." },
      { name: "smoke", description: "Interactive smoke testing endpoints." },
      { name: "dashboard", description: "Result listing and review UI support endpoints." },
    ],
    paths: {
      "/api/openapi.json": {
        get: {
          tags: ["meta"],
          summary: "Get the OpenAPI specification",
          responses: {
            "200": {
              description: "OpenAPI document",
              content: {
                "application/json": {
                  schema: {
                    type: "object",
                    description: "The current OpenAPI document for the vrt HTTP API.",
                  },
                },
              },
            },
          },
        },
      },
      "/api/status": {
        get: {
          tags: ["meta"],
          summary: "Get server status and backend availability",
          responses: {
            "200": jsonRefResponse("Current server status", "StatusResponse"),
          },
        },
      },
      "/api/compare": {
        post: {
          tags: ["compare"],
          summary: "Compare baseline and current HTML or URLs",
          requestBody: jsonRefBody("CompareRequest"),
          responses: {
            "200": jsonRefResponse("Per-viewport diff results", "CompareResponse"),
            "400": jsonRefResponse("Validation error", "ErrorResponse"),
            "413": jsonRefResponse("Request body too large", "ErrorResponse"),
          },
        },
      },
      "/api/compare-renderers": {
        post: {
          tags: ["compare"],
          summary: "Compare Chromium and Crater rendering for the same HTML",
          requestBody: jsonRefBody("CompareRenderersRequest"),
          responses: {
            "200": jsonRefResponse("Cross-renderer diff results", "CompareRenderersResponse"),
            "400": jsonRefResponse("Validation error", "ErrorResponse"),
            "503": jsonRefResponse("Crater backend unavailable", "ErrorResponse"),
          },
        },
      },
      "/api/reason": {
        post: {
          tags: ["reason"],
          summary: "Analyze a diff and optionally suggest CSS fixes",
          requestBody: jsonRefBody("ReasoningPipelineRequest"),
          responses: {
            "200": jsonRefResponse("Reasoning pipeline output", "ReasoningPipelineResponse"),
            "400": jsonRefResponse("Validation error", "ErrorResponse"),
            "500": jsonRefResponse("Pipeline failure", "ErrorResponse"),
            "503": jsonRefResponse("Reasoning backend unavailable", "ErrorResponse"),
          },
        },
      },
      "/api/execution-results": {
        get: {
          tags: ["dashboard"],
          summary: "List and search stored execution results",
          responses: {
            "200": jsonRefResponse("Stored execution result list", "ExecutionResultsResponse"),
            "501": jsonRefResponse("Execution result provider is not configured", "ErrorResponse"),
          },
        },
      },
      "/api/visual-diffs": {
        get: {
          tags: ["dashboard"],
          summary: "List stored visual diff display models",
          responses: {
            "200": jsonRefResponse("Stored visual diff display list", "VisualDiffDisplaysResponse"),
            "501": jsonRefResponse("Visual diff provider is not configured", "ErrorResponse"),
          },
        },
      },
      "/api/detection-series": {
        get: {
          tags: ["dashboard"],
          summary: "List benchmark detection-rate time-series points",
          responses: {
            "200": jsonRefResponse("Benchmark detection-rate series", "DetectionSeriesResponse"),
            "501": jsonRefResponse("Detection series provider is not configured", "ErrorResponse"),
          },
        },
      },
      "/api/component-status-matrix": {
        get: {
          tags: ["dashboard"],
          summary: "Build a component by viewport status matrix from a snapshot report",
          responses: {
            "200": jsonRefResponse("Component status matrix", "ComponentStatusMatrixResponse"),
            "501": jsonRefResponse("Component status matrix provider is not configured", "ErrorResponse"),
          },
        },
      },
      "/api/approvals": {
        get: {
          tags: ["dashboard"],
          summary: "List approval manifest rules for interactive review",
          responses: {
            "200": jsonRefResponse("Approval manifest list", "ApprovalListResponse"),
            "501": jsonRefResponse("Approval provider is not configured", "ErrorResponse"),
          },
        },
        post: {
          tags: ["dashboard"],
          summary: "Apply an interactive approval operation",
          requestBody: jsonRefBody("ApprovalOperationRequest"),
          responses: {
            "200": jsonRefResponse("Approval operation result", "ApprovalOperationResponse"),
            "400": jsonRefResponse("Validation error", "ErrorResponse"),
            "501": jsonRefResponse("Approval provider is not configured", "ErrorResponse"),
          },
        },
      },
      "/api/cloudflare/screenshot": {
        post: {
          tags: ["dashboard"],
          summary: "Capture a screenshot through Cloudflare Browser Run Quick Actions",
          requestBody: jsonRefBody("CloudflareScreenshotRequest"),
          responses: {
            "200": {
              description: "Screenshot image",
              content: {
                "image/png": {
                  schema: { type: "string", format: "binary" },
                },
              },
            },
            "400": jsonRefResponse("Validation error", "ErrorResponse"),
            "501": jsonRefResponse("Cloudflare Quick Actions provider is not configured", "ErrorResponse"),
          },
        },
      },
      "/api/cloudflare/crawl": {
        post: {
          tags: ["dashboard"],
          summary: "Start a Cloudflare Browser Run crawl job",
          requestBody: jsonRefBody("CloudflareCrawlRequest"),
          responses: {
            "200": jsonRefResponse("Started crawl job", "CloudflareCrawlStartResult"),
            "400": jsonRefResponse("Validation error", "ErrorResponse"),
            "501": jsonRefResponse("Cloudflare Quick Actions provider is not configured", "ErrorResponse"),
          },
        },
      },
      "/api/cloudflare/crawl/{jobId}": {
        get: {
          tags: ["dashboard"],
          summary: "Get a Cloudflare Browser Run crawl result",
          responses: {
            "200": jsonRefResponse("Crawl result", "CloudflareCrawlResult"),
            "400": jsonRefResponse("Validation error", "ErrorResponse"),
            "501": jsonRefResponse("Cloudflare Quick Actions provider is not configured", "ErrorResponse"),
          },
        },
      },
      "/api/cloudflare/crawl/{jobId}/routes": {
        get: {
          tags: ["dashboard"],
          summary: "Extract route candidates from a Cloudflare crawl result",
          responses: {
            "200": jsonRefResponse("Crawl route candidates", "CloudflareCrawlRoutesResponse"),
            "400": jsonRefResponse("Validation error", "ErrorResponse"),
            "501": jsonRefResponse("Cloudflare Quick Actions provider is not configured", "ErrorResponse"),
          },
        },
      },
      "/api/crater/layout": {
        post: {
          tags: ["compare"],
          summary: "Render HTML to Crater layout JSON through a JS/WASM module",
          requestBody: jsonRefBody("CraterWasmRenderRequest"),
          responses: {
            "200": jsonRefResponse("Crater layout tree and diagnostics", "CraterWasmRenderResult"),
            "400": jsonRefResponse("Validation error", "ErrorResponse"),
            "501": jsonRefResponse("Crater WASM layout provider is not configured", "ErrorResponse"),
          },
        },
      },
      "/api/smoke-test": {
        post: {
          tags: ["smoke"],
          summary: "Run an a11y smoke test against a target page",
          requestBody: jsonRefBody("SmokeTestRequest"),
          responses: {
            "200": jsonRefResponse("Smoke test result", "SmokeTestResponse"),
            "400": jsonRefResponse("Validation error", "ErrorResponse"),
          },
        },
      },
    },
    components: {
      schemas: buildSchemas(),
    },
  };
}

function buildSchemas(): Record<string, OpenApiSchema> {
  return {
    ErrorResponse: {
      type: "object",
      properties: {
        error: { type: "string" },
      },
      required: ["error"],
    },
    BackendStatus: {
      type: "object",
      properties: {
        name: { type: "string" },
        available: { type: "boolean" },
        version: { type: "string" },
      },
      required: ["name", "available"],
    },
    StorageStatus: {
      type: "object",
      properties: {
        r2: { type: "boolean" },
        kv: { type: "boolean" },
        d1: { type: "boolean" },
        available: { type: "boolean" },
      },
      required: ["r2", "kv", "d1", "available"],
    },
    StatusResponse: {
      type: "object",
      properties: {
        version: { type: "string" },
        capabilities: arrayOf({ type: "string" }),
        backends: arrayOf(ref("BackendStatus")),
        storage: ref("StorageStatus"),
      },
      required: ["version", "capabilities", "backends"],
    },
    HtmlSource: {
      type: "object",
      properties: {
        html: { type: "string" },
        url: { type: "string", format: "uri" },
        label: { type: "string" },
      },
    },
    Viewport: {
      type: "object",
      properties: {
        width: { type: "number" },
        height: { type: "number" },
        label: { type: "string" },
      },
      required: ["width", "height"],
    },
    DiscoverOptions: {
      type: "object",
      properties: {
        backend: {
          type: "string",
          enum: ["regex", "crater", "auto"],
        },
        randomSamples: { type: "number" },
        maxViewports: { type: "number" },
      },
    },
    VlmReasoningOptions: {
      type: "object",
      properties: {
        tier: {
          type: "string",
          enum: ["free", "cheap", "mid", "premium"],
        },
        model: { type: "string" },
        prompt: { type: "string" },
        maxTokens: { type: "number" },
      },
    },
    CompareOptions: {
      type: "object",
      properties: {
        threshold: { type: "number" },
        computedStyle: { type: "boolean" },
        hoverEmulation: { type: "boolean" },
        paintTree: { type: "boolean" },
        a11y: { type: "boolean" },
        generateHeatmap: { type: "boolean" },
        vlmReasoning: ref("VlmReasoningOptions"),
      },
    },
    CompareRequest: {
      type: "object",
      properties: {
        baseline: ref("HtmlSource"),
        current: ref("HtmlSource"),
        viewports: arrayOf(ref("Viewport")),
        discover: ref("DiscoverOptions"),
        backend: {
          type: "string",
          enum: ["chromium", "crater", "prescanner"],
        },
        options: ref("CompareOptions"),
      },
      required: ["baseline", "current"],
    },
    DiffRegion: {
      type: "object",
      properties: {
        x: { type: "number" },
        y: { type: "number" },
        width: { type: "number" },
        height: { type: "number" },
        diffPixelCount: { type: "number" },
      },
      required: ["x", "y", "width", "height", "diffPixelCount"],
    },
    PixelDiffResult: {
      type: "object",
      properties: {
        diffPixels: { type: "number" },
        totalPixels: { type: "number" },
        diffRatio: { type: "number" },
        heatmapBase64: { type: "string" },
        regions: arrayOf(ref("DiffRegion")),
      },
      required: ["diffPixels", "totalPixels", "diffRatio", "regions"],
    },
    ComputedStyleChange: {
      type: "object",
      properties: {
        selector: { type: "string" },
        property: { type: "string" },
        before: { type: "string" },
        after: { type: "string" },
      },
      required: ["selector", "property", "before", "after"],
    },
    ComputedStyleDiffResult: {
      type: "object",
      properties: {
        changes: arrayOf(ref("ComputedStyleChange")),
        count: { type: "number" },
      },
      required: ["changes", "count"],
    },
    ViewportResult: {
      type: "object",
      properties: {
        viewport: ref("Viewport"),
        pixelDiff: ref("PixelDiffResult"),
        computedStyleDiff: ref("ComputedStyleDiffResult"),
        status: {
          type: "string",
          enum: ["pass", "fail", "approved"],
        },
      },
      required: ["viewport", "pixelDiff", "status"],
    },
    CompareMeta: {
      type: "object",
      properties: {
        backend: { type: "string" },
        elapsedMs: { type: "number" },
        viewportCount: { type: "number" },
        baselineLabel: { type: "string" },
        currentLabel: { type: "string" },
      },
      required: ["backend", "elapsedMs", "viewportCount"],
    },
    CompareResponse: {
      type: "object",
      properties: {
        status: {
          type: "string",
          enum: ["pass", "fail", "approved"],
        },
        viewports: arrayOf(ref("ViewportResult")),
        meta: ref("CompareMeta"),
      },
      required: ["status", "viewports", "meta"],
    },
    CompareRenderersRequest: {
      type: "object",
      properties: {
        html: ref("HtmlSource"),
        viewports: arrayOf(ref("Viewport")),
        threshold: { type: "number" },
      },
      required: ["html"],
    },
    RendererCompareResult: {
      type: "object",
      properties: {
        viewport: ref("Viewport"),
        chromiumDiffRatio: { type: "number" },
        craterDiffRatio: { type: "number" },
        crossDiffRatio: { type: "number" },
        paintTreeChanges: { type: "number" },
      },
      required: ["viewport", "chromiumDiffRatio", "craterDiffRatio", "crossDiffRatio", "paintTreeChanges"],
    },
    CompareRenderersResponse: {
      type: "object",
      properties: {
        status: {
          type: "string",
          enum: ["match", "differs"],
        },
        results: arrayOf(ref("RendererCompareResult")),
        meta: {
          type: "object",
          properties: {
            elapsedMs: { type: "number" },
            viewportCount: { type: "number" },
            backends: arrayOf({ type: "string" }),
          },
          required: ["elapsedMs", "viewportCount", "backends"],
        },
      },
      required: ["status", "results", "meta"],
    },
    ExecutionResultArtifact: {
      type: "object",
      properties: {
        runId: { type: "string" },
        runType: { type: "string" },
        artifactKind: { type: "string" },
        artifactPath: { type: "string" },
        r2Key: { type: "string" },
        kvKey: { type: "string" },
        contentType: { type: "string" },
        createdAt: { type: "string" },
      },
      required: ["runId", "runType", "artifactKind", "artifactPath", "r2Key", "kvKey", "contentType", "createdAt"],
    },
    ExecutionResultRecord: {
      type: "object",
      properties: {
        runId: { type: "string" },
        runType: { type: "string" },
        latestCreatedAt: { type: "string" },
        artifactCount: { type: "number" },
        artifactKinds: arrayOf({ type: "string" }),
        artifacts: arrayOf(ref("ExecutionResultArtifact")),
      },
      required: ["runId", "runType", "latestCreatedAt", "artifactCount", "artifactKinds", "artifacts"],
    },
    ExecutionResultsResponse: {
      type: "object",
      properties: {
        total: { type: "number" },
        results: arrayOf(ref("ExecutionResultRecord")),
      },
      required: ["total", "results"],
    },
    VisualDiffAssets: {
      type: "object",
      properties: {
        baseline: ref("ExecutionResultArtifact"),
        current: ref("ExecutionResultArtifact"),
        heatmap: ref("ExecutionResultArtifact"),
        triptych: ref("ExecutionResultArtifact"),
      },
    },
    VisualDiffDisplayRecord: {
      type: "object",
      properties: {
        runId: { type: "string" },
        runType: { type: "string" },
        displayKey: { type: "string" },
        latestCreatedAt: { type: "string" },
        availableModes: arrayOf({
          type: "string",
          enum: ["side-by-side", "heatmap", "overlay", "triptych"],
        }),
        assets: ref("VisualDiffAssets"),
      },
      required: ["runId", "runType", "displayKey", "latestCreatedAt", "availableModes", "assets"],
    },
    VisualDiffDisplaysResponse: {
      type: "object",
      properties: {
        total: { type: "number" },
        results: arrayOf(ref("VisualDiffDisplayRecord")),
      },
      required: ["total", "results"],
    },
    DetectionSeriesPoint: {
      type: "object",
      properties: {
        runId: { type: "string" },
        createdAt: { type: "string" },
        fixture: { type: "string" },
        backend: {
          type: "string",
          enum: ["chromium", "crater", "prescanner"],
        },
        trials: { type: "number" },
        detected: { type: "number" },
        detectionRate: { type: "number" },
        avgMsPerTrial: { type: "number" },
      },
      required: [
        "runId",
        "createdAt",
        "fixture",
        "backend",
        "trials",
        "detected",
        "detectionRate",
        "avgMsPerTrial",
      ],
    },
    DetectionSeriesResponse: {
      type: "object",
      properties: {
        total: { type: "number" },
        points: arrayOf(ref("DetectionSeriesPoint")),
      },
      required: ["total", "points"],
    },
    ComponentStatusMatrixCell: {
      type: "object",
      properties: {
        component: { type: "string" },
        viewport: { type: "string" },
        status: {
          type: "string",
          enum: ["pass", "diff", "shift-only", "new-baseline", "missing"],
        },
        isNew: { type: "boolean" },
        diffRatio: { type: "number" },
        shiftOnly: { type: "boolean" },
      },
      required: ["component", "viewport", "status", "isNew", "shiftOnly"],
    },
    ComponentStatusMatrixRow: {
      type: "object",
      properties: {
        component: { type: "string" },
        cells: arrayOf(ref("ComponentStatusMatrixCell")),
        worstStatus: {
          type: "string",
          enum: ["pass", "diff", "shift-only", "new-baseline", "missing"],
        },
        maxDiffRatio: { type: "number" },
      },
      required: ["component", "cells", "worstStatus", "maxDiffRatio"],
    },
    ComponentStatusMatrixSummary: {
      type: "object",
      properties: {
        totalCells: { type: "number" },
        passCount: { type: "number" },
        diffCount: { type: "number" },
        shiftOnlyCount: { type: "number" },
        newBaselineCount: { type: "number" },
        missingCount: { type: "number" },
        maxDiffRatio: { type: "number" },
      },
      required: [
        "totalCells",
        "passCount",
        "diffCount",
        "shiftOnlyCount",
        "newBaselineCount",
        "missingCount",
        "maxDiffRatio",
      ],
    },
    ComponentStatusMatrixResponse: {
      type: "object",
      properties: {
        timestamp: { type: "string" },
        components: arrayOf({ type: "string" }),
        viewports: arrayOf({ type: "string" }),
        rows: arrayOf(ref("ComponentStatusMatrixRow")),
        summary: ref("ComponentStatusMatrixSummary"),
      },
      required: ["timestamp", "components", "viewports", "rows", "summary"],
    },
    ApprovalTolerance: {
      type: "object",
      properties: {
        pixels: { type: "number" },
        ratio: { type: "number" },
        geometryDelta: { type: "number" },
        colorDelta: { type: "number" },
      },
    },
    ApprovalRule: {
      type: "object",
      properties: {
        kind: {
          type: "string",
          enum: [
            "visual",
            "a11y-contrast",
            "a11y-touch",
            "a11y-focus-order",
            "a11y-semantic",
            "media-variant",
            "cross-browser",
          ],
        },
        selector: { type: "string" },
        property: { type: "string" },
        category: { type: "string" },
        changeType: { type: "string" },
        tolerance: ref("ApprovalTolerance"),
        reason: { type: "string" },
        issue: { type: "string" },
        expires: { type: "string" },
      },
      required: ["reason"],
    },
    ApprovalWarning: {
      type: "object",
      properties: {
        rule: ref("ApprovalRule"),
        message: { type: "string" },
      },
      required: ["rule", "message"],
    },
    ApprovalListResponse: {
      type: "object",
      properties: {
        path: { type: "string" },
        total: { type: "number" },
        rules: arrayOf(ref("ApprovalRule")),
        warnings: arrayOf(ref("ApprovalWarning")),
      },
      required: ["path", "total", "rules", "warnings"],
    },
    ApprovalOperationRequest: {
      type: "object",
      properties: {
        path: { type: "string" },
        action: {
          type: "string",
          enum: ["add", "remove"],
        },
        rule: ref("ApprovalRule"),
        index: { type: "number" },
        dryRun: { type: "boolean" },
      },
      required: ["action"],
    },
    ApprovalOperationResponse: {
      type: "object",
      properties: {
        path: { type: "string" },
        action: {
          type: "string",
          enum: ["add", "remove"],
        },
        dryRun: { type: "boolean" },
        beforeCount: { type: "number" },
        afterCount: { type: "number" },
        added: ref("ApprovalRule"),
        removed: ref("ApprovalRule"),
        total: { type: "number" },
        rules: arrayOf(ref("ApprovalRule")),
        warnings: arrayOf(ref("ApprovalWarning")),
      },
      required: [
        "path",
        "action",
        "dryRun",
        "beforeCount",
        "afterCount",
        "total",
        "rules",
        "warnings",
      ],
    },
    CloudflareViewport: {
      type: "object",
      properties: {
        width: { type: "number" },
        height: { type: "number" },
        deviceScaleFactor: { type: "number" },
      },
      required: ["width", "height"],
    },
    CloudflareScreenshotRequest: {
      type: "object",
      properties: {
        url: { type: "string" },
        html: { type: "string" },
        viewport: ref("CloudflareViewport"),
        selector: { type: "string" },
        screenshotOptions: {
          type: "object",
          properties: {
            fullPage: { type: "boolean" },
            omitBackground: { type: "boolean" },
            type: {
              type: "string",
              enum: ["png", "jpeg", "webp"],
            },
            quality: { type: "number" },
          },
        },
        gotoOptions: { type: "object" },
        userAgent: { type: "string" },
      },
    },
    CloudflareCrawlRequest: {
      type: "object",
      properties: {
        url: { type: "string" },
        limit: { type: "number" },
        depth: { type: "number" },
        formats: arrayOf({
          type: "string",
          enum: ["html", "markdown", "json"],
        }),
        render: { type: "boolean" },
        maxAge: { type: "number" },
        options: { type: "object" },
        gotoOptions: { type: "object" },
      },
      required: ["url"],
    },
    CloudflareCrawlStartResult: {
      type: "object",
      properties: {
        jobId: { type: "string" },
      },
      required: ["jobId"],
    },
    CloudflareCrawlRecord: {
      type: "object",
      properties: {
        url: { type: "string" },
        status: {
          type: "string",
          enum: ["queued", "errored", "completed", "disallowed", "skipped", "cancelled"],
        },
        metadata: {
          type: "object",
          properties: {
            status: { type: "number" },
            url: { type: "string" },
            title: { type: "string" },
          },
        },
        html: { type: "string" },
        markdown: { type: "string" },
      },
      required: ["url", "status"],
    },
    CloudflareCrawlResult: {
      type: "object",
      properties: {
        id: { type: "string" },
        status: { type: "string" },
        browserSecondsUsed: { type: "number" },
        total: { type: "number" },
        finished: { type: "number" },
        records: arrayOf(ref("CloudflareCrawlRecord")),
      },
      required: ["id", "status", "records"],
    },
    CloudflareCrawlRoute: {
      type: "object",
      properties: {
        url: { type: "string" },
        path: { type: "string" },
        title: { type: "string" },
      },
      required: ["url", "path"],
    },
    CloudflareCrawlRoutesResponse: {
      type: "object",
      properties: {
        jobId: { type: "string" },
        status: { type: "string" },
        routes: arrayOf(ref("CloudflareCrawlRoute")),
      },
      required: ["jobId", "status", "routes"],
    },
    CraterWasmViewport: {
      type: "object",
      properties: {
        width: { type: "number" },
        height: { type: "number" },
        label: { type: "string" },
      },
      required: ["width", "height"],
    },
    CraterBoxRect: {
      type: "object",
      properties: {
        top: { type: "number" },
        right: { type: "number" },
        bottom: { type: "number" },
        left: { type: "number" },
      },
      required: ["top", "right", "bottom", "left"],
    },
    CraterLayoutNode: {
      type: "object",
      properties: {
        id: { type: "string" },
        x: { type: "number" },
        y: { type: "number" },
        width: { type: "number" },
        height: { type: "number" },
        margin: ref("CraterBoxRect"),
        padding: ref("CraterBoxRect"),
        border: ref("CraterBoxRect"),
        children: arrayOf(ref("CraterLayoutNode")),
      },
      required: ["id", "x", "y", "width", "height", "margin", "padding", "border", "children"],
    },
    CraterLayoutRootBox: {
      type: "object",
      properties: {
        x: { type: "number" },
        y: { type: "number" },
        width: { type: "number" },
        height: { type: "number" },
      },
      required: ["x", "y", "width", "height"],
    },
    CraterLayoutDiagnostics: {
      type: "object",
      properties: {
        nodeCount: { type: "number" },
        maxDepth: { type: "number" },
        rootBox: ref("CraterLayoutRootBox"),
      },
      required: ["nodeCount", "maxDepth", "rootBox"],
    },
    CraterWasmRenderRequest: {
      type: "object",
      properties: {
        html: { type: "string" },
        viewport: ref("CraterWasmViewport"),
      },
      required: ["html", "viewport"],
    },
    CraterWasmRenderResult: {
      type: "object",
      properties: {
        backend: {
          type: "string",
          enum: ["crater-wasm"],
        },
        viewport: ref("CraterWasmViewport"),
        layout: ref("CraterLayoutNode"),
        rawJson: { type: "string" },
        elapsedMs: { type: "number" },
        diagnostics: ref("CraterLayoutDiagnostics"),
      },
      required: ["backend", "viewport", "layout", "rawJson", "elapsedMs", "diagnostics"],
    },
    ReasoningPipelineRequest: {
      type: "object",
      properties: {
        heatmapBase64: { type: "string" },
        baselineBase64: { type: "string" },
        currentBase64: { type: "string" },
        textReport: { type: "string" },
        cssSource: { type: "string" },
        stages: {
          type: "string",
          enum: ["analyze", "fix", "both"],
        },
        vlmModel: { type: "string" },
        llmProvider: {
          type: "string",
          enum: ["gemini", "anthropic", "openrouter"],
        },
      },
    },
    ReasoningChange: {
      type: "object",
      properties: {
        element: { type: "string" },
        property: { type: "string" },
        before: { type: "string" },
        after: { type: "string" },
        severity: {
          type: "string",
          enum: ["low", "medium", "high"],
        },
      },
      required: ["element", "property", "before", "after", "severity"],
    },
    ReasoningFix: {
      type: "object",
      properties: {
        selector: { type: "string" },
        property: { type: "string" },
        value: { type: "string" },
        reason: { type: "string" },
      },
      required: ["selector", "property", "value", "reason"],
    },
    ReasoningPipelineResponse: {
      type: "object",
      properties: {
        analysis: {
          type: "object",
          properties: {
            changes: arrayOf(ref("ReasoningChange")),
            summary: { type: "string" },
            regression: { type: "boolean" },
            model: { type: "string" },
            latencyMs: { type: "number" },
            costUsd: { type: "number" },
          },
          required: ["changes", "summary", "regression", "model", "latencyMs", "costUsd"],
        },
        fix: {
          type: "object",
          properties: {
            fixes: arrayOf(ref("ReasoningFix")),
            explanation: { type: "string" },
            confidence: {
              type: "string",
              enum: ["high", "medium", "low"],
            },
            model: { type: "string" },
            latencyMs: { type: "number" },
            costUsd: { type: "number" },
          },
          required: ["fixes", "explanation", "confidence", "model", "latencyMs", "costUsd"],
        },
        totalCostUsd: { type: "number" },
        totalLatencyMs: { type: "number" },
      },
      required: ["totalCostUsd", "totalLatencyMs"],
    },
    SmokeTestRequest: {
      type: "object",
      properties: {
        target: ref("HtmlSource"),
        mode: {
          type: "string",
          enum: ["random", "reasoning"],
        },
        maxActions: { type: "number" },
        seed: { type: "number" },
        blockExternalNavigation: { type: "boolean" },
        llmProvider: { type: "string" },
      },
      required: ["target", "mode"],
    },
    SmokeAction: {
      type: "object",
      properties: {
        step: { type: "number" },
        target: {
          type: "object",
          properties: {
            role: { type: "string" },
            name: { type: "string" },
            selector: { type: "string" },
          },
          required: ["role", "name"],
        },
        action: {
          type: "string",
          enum: ["click", "type", "check", "uncheck", "select", "hover", "focus"],
        },
        value: { type: "string" },
        result: {
          type: "string",
          enum: ["ok", "error", "navigation", "timeout"],
        },
        elapsedMs: { type: "number" },
      },
      required: ["step", "target", "action", "result", "elapsedMs"],
    },
    SmokeError: {
      type: "object",
      properties: {
        step: { type: "number" },
        type: {
          type: "string",
          enum: ["console-error", "uncaught-exception", "timeout", "crash", "a11y-regression"],
        },
        message: { type: "string" },
        stack: { type: "string" },
      },
      required: ["step", "type", "message"],
    },
    A11yNodeCompact: {
      type: "object",
      properties: {
        role: { type: "string" },
        name: { type: "string" },
        children: arrayOf(ref("A11yNodeCompact")),
      },
      required: ["role", "name"],
    },
    A11ySnapshot: {
      type: "object",
      properties: {
        step: { type: "number" },
        tree: ref("A11yNodeCompact"),
        interactiveCount: { type: "number" },
        landmarkCount: { type: "number" },
        issues: arrayOf({ type: "string" }),
      },
      required: ["step", "tree", "interactiveCount", "landmarkCount", "issues"],
    },
    SmokeTestMeta: {
      type: "object",
      properties: {
        totalActions: { type: "number" },
        totalErrors: { type: "number" },
        elapsedMs: { type: "number" },
        seed: { type: "number" },
        mode: {
          type: "string",
          enum: ["random", "reasoning"],
        },
      },
      required: ["totalActions", "totalErrors", "elapsedMs", "mode"],
    },
    SmokeTestResponse: {
      type: "object",
      properties: {
        status: {
          type: "string",
          enum: ["pass", "crash", "error"],
        },
        actions: arrayOf(ref("SmokeAction")),
        errors: arrayOf(ref("SmokeError")),
        snapshots: arrayOf(ref("A11ySnapshot")),
        meta: ref("SmokeTestMeta"),
      },
      required: ["status", "actions", "errors", "meta"],
    },
  };
}

function ref(name: string): OpenApiSchema {
  return { $ref: `#/components/schemas/${name}` };
}

function arrayOf(items: OpenApiSchema): OpenApiSchema {
  return { type: "array", items };
}

function jsonRefBody(schemaName: string): OpenApiRequestBody {
  return {
    required: true,
    content: {
      "application/json": {
        schema: ref(schemaName),
      },
    },
  };
}

function jsonRefResponse(description: string, schemaName: string): OpenApiResponse {
  return {
    description,
    content: {
      "application/json": {
        schema: ref(schemaName),
      },
    },
  };
}
