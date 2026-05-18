import { Hono } from "hono";
import type {
  SmokeTestRequest,
  StatusResponse,
  StorageStatus,
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

    const { runSmokeTest } = await import("@mizchi/vrt-markup/inspect/smoke-runner.ts");
    const result = await runSmokeTest(body);
    return c.json(result);
  });

  return app;
}
