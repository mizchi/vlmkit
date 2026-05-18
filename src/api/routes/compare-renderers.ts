import type { Hono } from "hono";
import type { HtmlSource } from "../api-types.ts";
import { loadCraterAvailability, resolveHtmlSource } from "./helpers.ts";

export interface CompareRenderersRouteOptions {
  resolveCraterAvailable?: () => Promise<boolean>;
}

export function registerCompareRenderersRoute(
  app: Hono,
  options: CompareRenderersRouteOptions = {},
): void {
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
}
