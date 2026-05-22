import { Hono } from "hono";
import type {
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
      ],
      backends: [
        { name: "chromium", available: true },
        { name: "crater", available: craterAvailable },
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

function parseResultQuery(url: URL): ExecutionResultsQuery {
  return {
    q: url.searchParams.get("q") ?? undefined,
    runType: url.searchParams.get("runType") ?? undefined,
    artifactKind: url.searchParams.get("artifactKind") ?? undefined,
    limit: parsePositiveInt(url.searchParams.get("limit")),
    offset: parseNonNegativeInt(url.searchParams.get("offset")),
  };
}

function parseNonNegativeInt(value: string | null): number | undefined {
  if (value == null || value === "") return undefined;
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : undefined;
}
