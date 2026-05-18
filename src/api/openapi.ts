const API_VERSION = "0.4.0";

type OpenApiSchema = Record<string, unknown>;

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
  paths: Record<string, Record<string, unknown>>;
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

function jsonRefBody(schemaName: string): OpenApiSchema {
  return {
    required: true,
    content: {
      "application/json": {
        schema: ref(schemaName),
      },
    },
  };
}

function jsonRefResponse(description: string, schemaName: string): OpenApiSchema {
  return {
    description,
    content: {
      "application/json": {
        schema: ref(schemaName),
      },
    },
  };
}
