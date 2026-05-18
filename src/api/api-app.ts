import { Hono } from "hono";
import type {
  CompareRequest,
  CompareResponse,
  HtmlSource,
  SmokeTestRequest,
  StorageStatus,
  StatusResponse,
  ViewportResult,
  PixelDiffResult,
} from "./api-types.ts";
import { buildOpenApiSpec } from "./openapi.ts";

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

  app.post("/api/compare", async (c) => {
    let body: CompareRequest;
    try {
      body = await c.req.json<CompareRequest>();
    } catch {
      return c.json({ error: "Invalid JSON body" }, 400);
    }

    if (!body.baseline || !body.current) {
      return c.json({ error: "Missing baseline or current in request body" }, 400);
    }
    if (!body.baseline.html && !body.baseline.url) {
      return c.json({ error: "baseline must have html or url" }, 400);
    }
    if (!body.current.html && !body.current.url) {
      return c.json({ error: "current must have html or url" }, 400);
    }

    const baselineHtml = await resolveHtmlSource(body.baseline);
    const currentHtml = await resolveHtmlSource(body.current);
    if (!baselineHtml || !currentHtml) {
      return c.json({ error: "Failed to resolve baseline or current HTML" }, 400);
    }

    const { chromium } = await import("playwright");
    const { compareScreenshots } = await import("@mizchi/vrt-core/heatmap.ts");
    const { discoverViewports } = await import("@mizchi/vrt-capture/viewport-discovery.ts");
    const { mkdir, rm } = await import("node:fs/promises");
    const { join } = await import("node:path");

    const tmpDir = join(process.cwd(), "test-results", "api", crypto.randomUUID());
    await mkdir(tmpDir, { recursive: true });

    const viewports = body.viewports ?? (() => {
      const combined = baselineHtml + currentHtml;
      const discovery = discoverViewports(combined, {
        maxViewports: body.discover?.maxViewports ?? 7,
        randomSamples: body.discover?.randomSamples ?? 1,
      });
      return discovery.viewports;
    })();

    const browser = await chromium.launch();
    const startTime = Date.now();
    const viewportResults: ViewportResult[] = [];

    try {
      for (const vp of viewports) {
        const width = vp.width;
        const height = vp.height ?? 900;
        const label = vp.label ?? `${width}x${height}`;

        const { capturePageState, diffComputedStyles } = await import("../experiments/css-challenge/css-challenge-core.ts");
        const captureOpts = {
          captureHover: body.options?.hoverEmulation ?? false,
        };

        const baseState = await capturePageState(
          browser,
          { width, height },
          baselineHtml,
          join(tmpDir, `baseline-${label}.png`),
          captureOpts,
        );
        const curState = await capturePageState(
          browser,
          { width, height },
          currentHtml,
          join(tmpDir, `current-${label}.png`),
          captureOpts,
        );

        const diff = await compareScreenshots({
          testId: label,
          testTitle: label,
          projectName: "api",
          screenshotPath: curState.screenshotPath,
          baselinePath: baseState.screenshotPath,
          status: "changed",
        }, { outputDir: tmpDir, threshold: body.options?.threshold ?? 0.1 });

        const pixelDiff: PixelDiffResult = {
          diffPixels: diff?.diffPixels ?? 0,
          totalPixels: diff?.totalPixels ?? 0,
          diffRatio: diff?.diffRatio ?? 0,
          regions: diff?.regions ?? [],
        };

        let computedStyleDiff: ViewportResult["computedStyleDiff"];
        if (body.options?.computedStyle !== false) {
          const csDiffs = diffComputedStyles(baseState.computedStyles, curState.computedStyles);
          if (csDiffs.length > 0) {
            computedStyleDiff = {
              changes: csDiffs.map((entry) => ({
                selector: entry.selector,
                property: entry.property,
                before: entry.before,
                after: entry.after,
              })),
              count: csDiffs.length,
            };
          }
        }

        viewportResults.push({
          viewport: { width, height, label },
          pixelDiff,
          computedStyleDiff,
          status: pixelDiff.diffRatio === 0 ? "pass" : "fail",
        });
      }
    } finally {
      await browser.close();
    }

    const response: CompareResponse = {
      status: viewportResults.every((result) => result.status === "pass") ? "pass" : "fail",
      viewports: viewportResults,
      meta: {
        backend: body.backend ?? "chromium",
        elapsedMs: Date.now() - startTime,
        viewportCount: viewportResults.length,
        baselineLabel: body.baseline.label,
        currentLabel: body.current.label,
      },
    };

    await rm(tmpDir, { recursive: true, force: true }).catch(() => {});
    return c.json(response);
  });

  app.post("/api/compare-renderers", async (c) => {
    const body = await c.req.json<{
      html: HtmlSource;
      viewports?: { width: number; height: number; label?: string }[];
      threshold?: number;
    }>();

    const html = await resolveHtmlSource(body.html);
    if (!html) return c.json({ error: "Missing html" }, 400);

    const craterAvailable = options.resolveCraterAvailable
      ? await options.resolveCraterAvailable()
      : await loadCraterAvailability();
    if (!craterAvailable) {
      return c.json({ error: "Crater BiDi server not available on ws://127.0.0.1:9222" }, 503);
    }

    const { chromium: pw } = await import("playwright");
    const { compareScreenshots } = await import("@mizchi/vrt-core/heatmap.ts");
    const { discoverViewports } = await import("@mizchi/vrt-capture/viewport-discovery.ts");
    const { CraterClient } = await import("@mizchi/vrt-capture/crater-client.ts");
    const { mkdir, rm, writeFile } = await import("node:fs/promises");
    const { join } = await import("node:path");
    const tmpDir = join(process.cwd(), "test-results", "api", `renderers-${Date.now()}`);
    await mkdir(tmpDir, { recursive: true });

    const viewports = body.viewports ?? discoverViewports(html, { maxViewports: 5, randomSamples: 0 }).viewports;
    const startTime = Date.now();
    const results: Array<{
      viewport: { width: number; height: number; label: string };
      chromiumDiffRatio: number;
      craterDiffRatio: number;
      crossDiffRatio: number;
      paintTreeChanges: number;
    }> = [];

    const browser = await pw.launch();
    const crater = new CraterClient();
    await crater.connect();

    try {
      for (const vp of viewports) {
        const width = vp.width;
        const height = vp.height ?? 900;
        const label = vp.label ?? `${width}x${height}`;

        const chromiumPage = await browser.newPage({ viewport: { width, height } });
        await chromiumPage.setContent(html, { waitUntil: "networkidle" });
        const chromiumPath = join(tmpDir, `chromium-${label}.png`);
        await chromiumPage.screenshot({ path: chromiumPath, fullPage: true });
        await chromiumPage.close();

        await crater.setViewport(width, height);
        await crater.setContent(html);
        const { png: craterPng } = await crater.capturePng();
        const craterPath = join(tmpDir, `crater-${label}.png`);
        await writeFile(craterPath, craterPng);

        const crossDiff = await compareScreenshots({
          testId: `cross-${label}`,
          testTitle: `Chromium vs Crater ${label}`,
          projectName: "renderer-compare",
          screenshotPath: craterPath,
          baselinePath: chromiumPath,
          status: "changed",
        }, { outputDir: tmpDir, threshold: body.threshold ?? 0.1 });

        results.push({
          viewport: { width, height, label },
          chromiumDiffRatio: 0,
          craterDiffRatio: crossDiff?.diffRatio ?? 0,
          crossDiffRatio: crossDiff?.diffRatio ?? 0,
          paintTreeChanges: 0,
        });
      }
    } finally {
      await crater.close();
      await browser.close();
    }

    await rm(tmpDir, { recursive: true, force: true }).catch(() => {});
    return c.json({
      status: results.every((result) => result.crossDiffRatio === 0) ? "match" : "differs",
      results,
      meta: {
        elapsedMs: Date.now() - startTime,
        viewportCount: results.length,
        backends: ["chromium", "crater"],
      },
    });
  });

  app.post("/api/reason", async (c) => {
    let body: import("./api-types.ts").ReasoningPipelineRequest;
    try {
      body = await c.req.json();
    } catch {
      return c.json({ error: "Invalid JSON body" }, 400);
    }

    if (!body.heatmapBase64 && !body.currentBase64 && !body.textReport) {
      return c.json({ error: "Need at least one of: heatmapBase64, currentBase64, textReport" }, 400);
    }

    const { createReasoningPipeline } = await import("@mizchi/vrt-ai/reasoning-pipeline.ts");
    const pipeline = createReasoningPipeline({
      vlmModel: body.vlmModel,
      llmProvider: body.llmProvider,
    });

    if (!pipeline) {
      return c.json({ error: "No VLM/LLM API keys configured (OPENROUTER_API_KEY, GEMINI_API_KEY, or ANTHROPIC_API_KEY)" }, 503);
    }

    const start = Date.now();
    const stages = body.stages ?? (body.cssSource ? "both" : "analyze");

    try {
      const response: import("./api-types.ts").ReasoningPipelineResponse = {
        totalCostUsd: 0,
        totalLatencyMs: 0,
      };

      if (stages === "analyze" || stages === "both") {
        const analysis = await pipeline.analyze({
          heatmapBase64: body.heatmapBase64,
          baselineBase64: body.baselineBase64,
          currentBase64: body.currentBase64,
          textReport: body.textReport,
        });
        response.analysis = {
          changes: analysis.changes,
          summary: analysis.summary,
          regression: analysis.regression,
          model: analysis.vlmModel,
          latencyMs: analysis.vlmLatencyMs,
          costUsd: analysis.vlmCostUsd,
        };
        response.totalCostUsd += analysis.vlmCostUsd;
      }

      if ((stages === "fix" || stages === "both") && body.cssSource) {
        const report = response.analysis ?? {
          changes: [],
          summary: body.textReport ?? "",
          regression: false,
          raw: "",
          vlmModel: "none",
          vlmLatencyMs: 0,
          vlmCostUsd: 0,
        };
        const fix = await pipeline.suggestFix(report as any, body.cssSource);
        response.fix = {
          fixes: fix.fixes,
          explanation: fix.explanation,
          confidence: fix.confidence,
          model: fix.llmModel,
          latencyMs: fix.llmLatencyMs,
          costUsd: fix.llmCostUsd,
        };
        response.totalCostUsd += fix.llmCostUsd;
      }

      response.totalLatencyMs = Date.now() - start;
      return c.json(response);
    } catch (error: any) {
      return c.json({ error: error.message?.slice(0, 200) ?? "Pipeline error" }, 500);
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

    const { runSmokeTest } = await import("@mizchi/vrt-markup/inspect/smoke-runner.ts");
    const result = await runSmokeTest(body);
    return c.json(result);
  });

  return app;
}

async function loadCraterAvailability(): Promise<boolean> {
  const { isCraterAvailable } = await import("@mizchi/vrt-capture/crater-client.ts");
  return await isCraterAvailable();
}

async function resolveHtmlSource(source: HtmlSource): Promise<string | null> {
  if (source.html) return source.html;
  if (!source.url) return null;

  try {
    if (!source.url.startsWith("http://") && !source.url.startsWith("https://")) {
      return null;
    }
    const parsed = new URL(source.url);
    const hostname = parsed.hostname;
    if (
      hostname === "localhost"
      || hostname.startsWith("127.")
      || hostname.startsWith("10.")
      || hostname.startsWith("172.")
      || hostname.startsWith("192.168.")
      || hostname === "169.254.169.254"
      || hostname === "[::1]"
      || hostname === "0.0.0.0"
    ) {
      return null;
    }
    const res = await fetch(source.url);
    return await res.text();
  } catch {
    return null;
  }
}
