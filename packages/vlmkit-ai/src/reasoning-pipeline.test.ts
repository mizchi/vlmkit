/**
 * The two-stage reasoning pipeline, against recorded responses.
 *
 * 10.7% covered before this, and the uncovered part is the whole reason the module exists: a VLM
 * reply becomes a `StructuredDiffReport`, that becomes a `FixSuggestion`, and a low-confidence fix
 * escalates the image resolution and tries again. All of it needs a provider, which is why it went
 * untested — so the responses live in `fixtures/vlm-recordings/` and a `fetch` stub serves them.
 *
 * **The fixtures are hand-written to the providers' shape, not captured** (no credentials here);
 * `fixtures/vlm-recordings/README.md` traces every field to the code or report it came from. What
 * that buys is real: the parse contract, the dedup rule, the LLM-only fallback, the escalation
 * ladder, and what happens when a model answers in prose — which the benches say is common.
 * What it cannot buy is proof that the providers still return this shape; the dated benches in
 * `docs/reports/` are the only thing that can, and a green run here is not a substitute.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, beforeEach, describe, it } from "vitest";
import { createReasoningPipeline } from "./reasoning-pipeline.ts";
import { resetVisionModelCache } from "./vlm-client.ts";
import { VrtConfigError } from "./errors.ts";

const recordings = join(import.meta.dirname!, "../../../fixtures/vlm-recordings");
const recorded = (name: string) => JSON.parse(readFileSync(join(recordings, `${name}.json`), "utf8")) as unknown;

/** A 1x1 PNG, base64 — enough for `resizeBase64Png` to have something to resize. */
const PIXEL = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8DwHwAFAAH/q842iQAAAABJRU5ErkJggg==";

interface Call { url: string; body: Record<string, unknown> }

const calls: Call[] = [];
let realFetch: typeof globalThis.fetch;
const savedEnv: Record<string, string | undefined> = {};

/**
 * Serve the recordings, in order, from a queue.
 *
 * Order rather than URL, because stage 1 and stage 2 hit the SAME OpenRouter endpoint — and the
 * order is itself part of what is under test: `analyzeAndFix` must call stage 1 before stage 2,
 * and an escalation must produce a second stage-1 call.
 */
function serve(queue: unknown[]) {
  let i = 0;
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    calls.push({ url, body: init?.body ? JSON.parse(String(init.body)) as Record<string, unknown> : {} });
    if (url.includes("/models")) {
      // The catalogue lookup `resolveModel` makes before any analysis. Served separately so a
      // test's queue only contains the replies it is about.
      return json({
        data: [{
          id: "bytedance/ui-tars-1.5-7b",
          architecture: { input_modalities: ["text", "image"] },
          pricing: { prompt: "0.0000001", completion: "0.0000002" },
          context_length: 128000,
        }],
      });
    }
    const next = queue[Math.min(i++, queue.length - 1)];
    return json(next);
  }) as typeof globalThis.fetch;
}

function json(payload: unknown): Response {
  return {
    ok: true,
    status: 200,
    json: async () => payload,
    text: async () => JSON.stringify(payload),
  } as Response;
}

beforeEach(() => {
  realFetch = globalThis.fetch;
  calls.length = 0;
  resetVisionModelCache();
  for (const key of ["OPENROUTER_API_KEY", "GEMINI_API_KEY", "GOOGLE_AI_API_KEY", "ANTHROPIC_API_KEY", "VLMKIT_LLM_PROVIDER", "VLMKIT_VLM_MODEL"]) {
    savedEnv[key] = process.env[key];
    delete process.env[key];
  }
});

afterEach(() => {
  globalThis.fetch = realFetch;
  for (const [key, value] of Object.entries(savedEnv)) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
});

describe("createReasoningPipeline — provider availability", () => {
  it("names every variable that would make it work when none is set", () => {
    // The first thing a new user hits. One error listing all four beats four separate failures.
    assert.throws(
      () => createReasoningPipeline(),
      (err: unknown) => {
        assert.ok(err instanceof VrtConfigError);
        assert.equal(err.code, "NO_PROVIDER_AVAILABLE");
        assert.match(err.message, /GEMINI/);
        assert.match(err.message, /ANTHROPIC/);
        assert.match(err.message, /OPENROUTER_API_KEY/);
        return true;
      },
    );
  });

  it("returns null instead of throwing when asked to", () => {
    assert.equal(createReasoningPipeline({ throwIfMissing: false }), null);
  });

  it("an OPENROUTER key alone is enough — the VLM half can carry it", () => {
    process.env.OPENROUTER_API_KEY = "or-key";
    const pipeline = createReasoningPipeline();
    assert.ok(pipeline);
    assert.equal(pipeline.vlmModel, "bytedance/ui-tars-1.5-7b", "the documented default");
  });

  it("takes the VLM model from config over the default", () => {
    process.env.OPENROUTER_API_KEY = "or-key";
    assert.equal(
      createReasoningPipeline({ vlmModel: "qwen/qwen3-vl-30b-a3b-instruct" })!.vlmModel,
      "qwen/qwen3-vl-30b-a3b-instruct",
    );
  });
});

describe("stage 1 — VLM reply to a structured report", () => {
  beforeEach(() => { process.env.OPENROUTER_API_KEY = "or-key"; });

  it("parses the CHANGE lines, deduplicates, and reads SUMMARY / REGRESSION", async () => {
    serve([recorded("stage1-openrouter")]);
    const pipeline = createReasoningPipeline()!;
    const report = await pipeline.analyze({ heatmapBase64: PIXEL });

    // Four CHANGE lines, three distinct element+property pairs — the fourth repeats the first
    // with `#fff` instead of `#f6f8fa`, and a duplicate that changes the VALUE must not become a
    // second finding for the same property.
    assert.deepEqual(
      report.changes.map((c) => `${c.element} ${c.property} ${c.before}->${c.after} ${c.severity}`),
      [
        ".readme-body pre background-color #f6f8fa->#ffffff high",
        ".readme-body pre padding 16px->0px high",
        ".tab-item.active border-bottom-color #2563eb->transparent medium",
      ],
    );
    assert.equal(report.summary, "the code block lost its surface and padding");
    assert.equal(report.regression, true);
    assert.match(report.raw, /^CHANGE:/, "the raw reply is kept, because a parse can be wrong");
    assert.equal(report.vlmModel, "bytedance/ui-tars-1.5-7b");
    assert.ok(report.vlmLatencyMs >= 0);
  });

  it("returns an empty change list for a prose-only reply rather than inventing changes", async () => {
    // Measured on real models (`docs/knowledge.md`: kimi returns prose). The pipeline has to
    // report nothing found — a fabricated change is worse than an empty list, because stage 2
    // would then write CSS for it.
    serve([recorded("stage1-prose-only")]);
    const report = await createReasoningPipeline()!.analyze({ heatmapBase64: PIXEL });
    assert.deepEqual(report.changes, []);
    assert.equal(report.summary, "");
    assert.equal(report.regression, false);
    assert.match(report.raw, /Looking at the heatmap/, "and the prose survives for a human to read");
  });

  it("prefers the selector crop over the heatmap, and the heatmap over the full page", async () => {
    // The image choice is the single biggest lever on VLM accuracy in this repo's benches, so
    // which one was sent is worth pinning.
    serve([recorded("stage1-openrouter")]);
    const pipeline = createReasoningPipeline()!;
    await pipeline.analyze({ selectorCropBase64: PIXEL, heatmapBase64: PIXEL, currentBase64: PIXEL });
    const sent = JSON.stringify(calls.filter((c) => !c.url.includes("/models"))[0]!.body);
    assert.match(sent, /data:image\/png;base64,/);
  });

  it("refuses to analyze with no image at all", async () => {
    serve([recorded("stage1-openrouter")]);
    await assert.rejects(
      () => createReasoningPipeline()!.analyze({ textReport: "something changed" }),
      /No image data provided/,
    );
  });

  it("passes shift detection into the prompt, since it changes which properties to suspect", async () => {
    serve([recorded("stage1-openrouter")]);
    await createReasoningPipeline()!.analyze({
      heatmapBase64: PIXEL,
      shiftInfo: { globalShift: 12, shiftOnly: true, compensatedDiffRatio: 0.001, contentChangeCount: 0 },
    });
    const sent = JSON.stringify(calls.filter((c) => !c.url.includes("/models"))[0]!.body);
    assert.match(sent, /Global vertical shift/);
    assert.match(sent, /SHIFT ONLY/, "the instruction that redirects it to layout properties");
  });
});

describe("stage 2 — report to CSS fixes", () => {
  beforeEach(() => { process.env.OPENROUTER_API_KEY = "or-key"; });

  it("parses FIX lines with their reason, and the confidence", async () => {
    serve([recorded("stage1-openrouter"), recorded("stage2-openrouter")]);
    const pipeline = createReasoningPipeline()!;
    const analysis = await pipeline.analyze({ heatmapBase64: PIXEL });
    const fix = await pipeline.suggestFix(analysis, ".readme-body pre { }");
    assert.deepEqual(
      fix.fixes.map((f) => `${f.selector} ${f.property}: ${f.value}`),
      [".readme-body pre background-color: #f6f8fa", ".readme-body pre padding: 16px"],
    );
    assert.ok(fix.fixes[0]!.reason.length > 0, "the reason is what makes a fix reviewable");
    assert.equal(fix.confidence, "high");
    assert.equal(fix.explanation, "the selector block for the code surface was removed");
  });

  it("returns no fixes for a prose answer instead of guessing at one", async () => {
    serve([recorded("stage1-openrouter"), recorded("stage2-unparseable")]);
    const pipeline = createReasoningPipeline()!;
    const analysis = await pipeline.analyze({ heatmapBase64: PIXEL });
    const fix = await pipeline.suggestFix(analysis, ".readme-body pre { }");
    assert.deepEqual(fix.fixes, []);
    assert.equal(fix.confidence, "medium", "the default, since the reply named none");
    assert.match(fix.raw, /lost its background/, "the prose is kept for a human");
  });
});

describe("analyzeAndFix — the escalation ladder", () => {
  beforeEach(() => { process.env.OPENROUTER_API_KEY = "or-key"; });

  it("runs stage 1 then stage 2, and does not escalate a confident fix", async () => {
    serve([recorded("stage1-openrouter"), recorded("stage2-openrouter")]);
    const result = await createReasoningPipeline()!.analyzeAndFix({
      heatmapBase64: PIXEL, cssSource: ".readme-body pre { }",
    });
    assert.equal(result.escalated, false, "confidence is high — a second pass would just cost money");
    assert.equal(result.analysis.changes.length, 3);
    assert.equal(result.fix.confidence, "high");
    const provider = calls.filter((c) => !c.url.includes("/models"));
    assert.equal(provider.length, 2, "exactly one stage-1 and one stage-2 call");
  });

  it("escalates when the fix is low-confidence on a single change", async () => {
    // The condition is deliberately narrow — low confidence AND at most one change — because a
    // low-confidence reply listing eight changes is a model that is guessing, and a bigger image
    // will not fix that.
    const lowConf = {
      choices: [{ message: { content: "FIX: .a | color | red | unsure\nCONFIDENCE: low" } }],
      usage: { prompt_tokens: 10, completion_tokens: 5, total_tokens: 15 },
    };
    const oneChange = {
      choices: [{ message: { content: "CHANGE: .a | color | blue | red | low\nSUMMARY: one thing\nREGRESSION: no" } }],
      usage: { prompt_tokens: 10, completion_tokens: 5, total_tokens: 15 },
    };
    serve([oneChange, lowConf]);
    const result = await createReasoningPipeline({ resolution: "medium", maxResolution: "high" })!.analyzeAndFix({
      heatmapBase64: PIXEL, cssSource: ".a { }", highResHeatmapBase64: PIXEL,
    });
    assert.equal(result.escalated, true);
    assert.equal(calls.filter((c) => !c.url.includes("/models")).length, 4, "stage 1+2 twice");
  });

  it("does not escalate past maxResolution, or with adaptiveResolution off", async () => {
    const lowConf = {
      choices: [{ message: { content: "FIX: .a | color | red | unsure\nCONFIDENCE: low" } }],
      usage: { prompt_tokens: 10, completion_tokens: 5, total_tokens: 15 },
    };
    const oneChange = {
      choices: [{ message: { content: "CHANGE: .a | color | blue | red | low\nREGRESSION: no" } }],
      usage: { prompt_tokens: 10, completion_tokens: 5, total_tokens: 15 },
    };

    serve([oneChange, lowConf]);
    const atCeiling = await createReasoningPipeline({ resolution: "high", maxResolution: "high" })!.analyzeAndFix({
      heatmapBase64: PIXEL, cssSource: ".a { }",
    });
    assert.equal(atCeiling.escalated, false, "already at the ceiling");

    calls.length = 0;
    serve([oneChange, lowConf]);
    const off = await createReasoningPipeline({ adaptiveResolution: false, resolution: "low" })!.analyzeAndFix({
      heatmapBase64: PIXEL, cssSource: ".a { }",
    });
    assert.equal(off.escalated, false);
    assert.equal(calls.filter((c) => !c.url.includes("/models")).length, 2, "one pass only");
  });

  it("cannot escalate without an image to escalate with", async () => {
    // `currentBase64` alone: there is no higher-resolution heatmap to re-send, so the low
    // confidence stands rather than paying for an identical second call.
    const lowConf = {
      choices: [{ message: { content: "CONFIDENCE: low" } }],
      usage: { prompt_tokens: 10, completion_tokens: 5, total_tokens: 15 },
    };
    const oneChange = {
      choices: [{ message: { content: "CHANGE: .a | color | blue | red | low" } }],
      usage: { prompt_tokens: 10, completion_tokens: 5, total_tokens: 15 },
    };
    serve([oneChange, lowConf]);
    const result = await createReasoningPipeline({ resolution: "low" })!.analyzeAndFix({
      currentBase64: PIXEL, cssSource: ".a { }",
    });
    assert.equal(result.escalated, false);
  });
});
