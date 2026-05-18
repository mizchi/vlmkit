import type { Hono } from "hono";
import type {
  ReasoningPipelineRequest,
  ReasoningPipelineResponse,
} from "../api-types.ts";

export function registerReasonRoute(app: Hono): void {
  app.post("/api/reason", async (c) => {
    let body: ReasoningPipelineRequest;
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
      const response: ReasoningPipelineResponse = {
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
}
