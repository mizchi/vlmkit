import type { Hono } from "hono";
import type {
  CompareRequest,
  CompareResponse,
  PixelDiffResult,
  ViewportResult,
} from "../api-types.ts";
import { resolveHtmlSource } from "./helpers.ts";

export function registerCompareRoute(app: Hono): void {
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

        const { capturePageState, diffComputedStyles } = await import("../../experiments/css-challenge/css-challenge-core.ts");
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
}
