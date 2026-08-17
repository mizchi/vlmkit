/**
 * The VLM client — every VLM path in the repo goes through this file, and it had no tests.
 *
 * Coverage said 7.3%, which understated the problem: what was uncovered is the request SHAPING
 * and the response PARSING for three providers, i.e. the parts that decide whether a model gets
 * the image at all and whether the cost report is real. None of it needs a network — `fetch` is
 * called through the global, so a stub is enough, and a stub is also the only way to assert what
 * was SENT.
 *
 * The one thing tests cannot check here is that the three providers' wire formats are still what
 * these tests claim. That is what `docs/reports/` benches are for; this pins that the client
 * builds the format it believes in, and notices when a response does not match.
 */
import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, it, vi } from "vitest";

/**
 * The Gemini path goes through the `@google/generative-ai` SDK rather than `fetch`, so it needs a
 * module mock where the other two providers needed a `fetch` stub. Recorded calls, same idea: the
 * assertion is what the client SENT.
 */
const geminiCalls: Record<string, unknown>[] = [];
let geminiReply: { text: string; usage?: { promptTokenCount: number; candidatesTokenCount: number } } =
  { text: "gemini says ok", usage: { promptTokenCount: 900, candidatesTokenCount: 40 } };

vi.mock("@google/generative-ai", () => ({
  GoogleGenerativeAI: class {
    constructor(public apiKey: string) {}
    getGenerativeModel(config: { model: string }) {
      return {
        config,
        generateContent: async (request: Record<string, unknown>) => {
          geminiCalls.push({ ...request, __model: config.model, __apiKey: this.apiKey });
          return {
            response: {
              text: () => geminiReply.text,
              usageMetadata: geminiReply.usage,
            },
          };
        },
      };
    }
  },
}));
import {
  createVlmClient,
  isClaudeDirectModel,
  isGeminiDirectModel,
  listClaudeModels,
  listGeminiModels,
  listModels,
  resolveClaudeModel,
  resolveGeminiModel,
  resetVisionModelCache,
  resolveModel,
  type VlmModel,
} from "./vlm-client.ts";
import { VrtConfigError } from "./errors.ts";

const dir = mkdtempSync(join(tmpdir(), "vlmkit-vlm-client-"));

interface Capture {
  url: string;
  init?: RequestInit;
  body: Record<string, unknown>;
}

const captured: Capture[] = [];
let realFetch: typeof globalThis.fetch;

/** Stub `fetch` with a per-URL responder; every call is recorded for assertions. */
function stubFetch(responder: (url: string) => { status?: number; json?: unknown; text?: string }) {
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    const body = init?.body ? JSON.parse(String(init.body)) as Record<string, unknown> : {};
    captured.push({ url, ...(init ? { init } : {}), body });
    const r = responder(url);
    const status = r.status ?? 200;
    return {
      ok: status >= 200 && status < 300,
      status,
      json: async () => r.json,
      text: async () => r.text ?? JSON.stringify(r.json ?? ""),
    } as Response;
  }) as typeof globalThis.fetch;
}

const OPENROUTER_MODELS = {
  data: [
    {
      id: "vendor/cheap-vision",
      name: "Cheap Vision",
      architecture: { input_modalities: ["text", "image"], modality: "text+image->text" },
      pricing: { prompt: "0.0000001", completion: "0.0000004" },
      context_length: 131072,
    },
    {
      id: "vendor/pricey-vision",
      name: "Pricey Vision",
      architecture: { input_modalities: ["text", "image"], modality: "text+image->text" },
      pricing: { prompt: "0.00002", completion: "0.00006" },
      context_length: 200000,
    },
    {
      // Text-only: must never appear in a vision model list.
      id: "vendor/text-only",
      name: "Text Only",
      architecture: { input_modalities: ["text"], modality: "text->text" },
      pricing: { prompt: "0.0000001", completion: "0.0000002" },
      context_length: 8192,
    },
  ],
};

beforeEach(() => {
  realFetch = globalThis.fetch;
  captured.length = 0;
  // The OpenRouter list is cached in module state, so without this the first test's catalogue is
  // the catalogue every later test sees — which is how the ambiguous-match case here silently
  // became an unknown-model case instead.
  resetVisionModelCache();
});

afterEach(() => {
  globalThis.fetch = realFetch;
});

describe("model catalogues", () => {
  it("knows its own direct-provider ids without a network call", () => {
    // These three predicates route every later decision, and they are pure string work — so a
    // wrong answer here misroutes a request rather than failing loudly.
    assert.equal(isGeminiDirectModel("gemini:gemini-2.0-flash"), true);
    assert.equal(isGeminiDirectModel("google/gemini-2.0-flash"), false, "an OpenRouter id, not direct");
    assert.equal(isClaudeDirectModel("claude:claude-haiku-4-5-20251001"), true);
    assert.equal(isClaudeDirectModel("anthropic/claude-haiku-4-5"), false);

    assert.ok(listGeminiModels().every((m) => m.id.startsWith("gemini:")));
    assert.ok(listClaudeModels().every((m) => m.id.startsWith("claude:")));
    // Returned by value: a caller that sorts the list must not reorder the module's own.
    const first = listClaudeModels();
    first.sort((a, b) => b.promptCostPer1k - a.promptCostPer1k);
    assert.deepEqual(listClaudeModels().map((m) => m.id), listClaudeModels().map((m) => m.id));
    assert.notDeepEqual(first.map((m) => m.id), listClaudeModels().map((m) => m.id));
  });

  it("resolves a direct model with or without its prefix", () => {
    assert.equal(resolveGeminiModel("gemini:gemini-2.0-flash")?.id, "gemini:gemini-2.0-flash");
    assert.equal(resolveGeminiModel("gemini-2.0-flash")?.id, "gemini:gemini-2.0-flash");
    assert.equal(resolveGeminiModel("gpt-4o"), undefined);
    assert.equal(resolveClaudeModel("claude-haiku-4-5-20251001")?.id, "claude:claude-haiku-4-5-20251001");
    assert.equal(resolveClaudeModel("haiku"), undefined, "no fuzzy matching on the direct list");
  });

  it("lists only image-capable OpenRouter models, cheapest first", async () => {
    stubFetch(() => ({ json: OPENROUTER_MODELS }));
    const models = await listModels({ includeGemini: false, includeClaude: false });
    assert.ok(!models.some((m) => m.id === "vendor/text-only"), "text-only model must be filtered out");
    const costs = models.map((m) => m.promptCostPer1k);
    assert.deepEqual(costs, [...costs].sort((a, b) => a - b), "sorted by prompt cost");
  });

  it("filters by max cost and truncates to the limit", async () => {
    stubFetch(() => ({ json: OPENROUTER_MODELS }));
    const cheap = await listModels({ maxCost: 1e-6, includeGemini: false, includeClaude: false });
    assert.deepEqual(cheap.map((m) => m.id), ["vendor/cheap-vision"]);
    const limited = await listModels({ limit: 1, includeGemini: false, includeClaude: false });
    assert.equal(limited.length, 1);
  });

  it("fetches the catalogue once and serves the rest from cache", async () => {
    // The cache is the reason `resetVisionModelCache` had to exist. Its purpose is untested
    // otherwise: a bench that resolves 8 models would hit the models endpoint 8 times.
    stubFetch(() => ({ json: OPENROUTER_MODELS }));
    await listModels({ includeGemini: false, includeClaude: false });
    await listModels({ includeGemini: false, includeClaude: false });
    assert.equal(captured.length, 1, "the second call used the cache");
    resetVisionModelCache();
    await listModels({ includeGemini: false, includeClaude: false });
    assert.equal(captured.length, 2, "and the reset makes it fetch again");
  });

  it("names the status when the models endpoint refuses", async () => {
    // A 429 on the catalogue endpoint is a real and common failure (it is unauthenticated and
    // rate-limited), and it happens before any model is chosen — so an opaque error here reads as
    // "the model does not exist".
    stubFetch(() => ({ status: 429, json: {} }));
    await assert.rejects(() => listModels(), /OpenRouter API error: 429/);
  });

  it("mixes the direct providers into the list by default", async () => {
    stubFetch(() => ({ json: OPENROUTER_MODELS }));
    const all = await listModels();
    assert.ok(all.some((m) => m.id.startsWith("gemini:")), "gemini included unless excluded");
    assert.ok(all.some((m) => m.id.startsWith("claude:")));
    assert.ok(all.some((m) => m.id === "vendor/cheap-vision"));
  });
});

describe("resolveModel", () => {
  it("prefers the direct providers over an API lookup", async () => {
    // No fetch stub on purpose: resolving a direct id must not touch the network at all, and a
    // real `fetch` here would try to reach openrouter.ai from a sandbox.
    stubFetch(() => { throw new Error("resolveModel must not fetch for a direct id"); });
    assert.equal((await resolveModel("gemini:gemini-2.0-flash")).id, "gemini:gemini-2.0-flash");
    assert.equal((await resolveModel("claude:claude-sonnet-4-6")).id, "claude:claude-sonnet-4-6");
    assert.equal(captured.length, 0);
  });

  it("takes an exact id, then a unique substring", async () => {
    stubFetch(() => ({ json: OPENROUTER_MODELS }));
    assert.equal((await resolveModel("vendor/pricey-vision")).id, "vendor/pricey-vision");
    assert.equal((await resolveModel("pricey")).id, "vendor/pricey-vision");
  });

  it("names the alternatives when a substring is ambiguous", async () => {
    stubFetch(() => ({
      json: {
        data: [
          { id: "a/vision-pro", architecture: { input_modalities: ["image"] }, pricing: { prompt: "0.000001" } },
          { id: "b/vision-max", architecture: { input_modalities: ["image"] }, pricing: { prompt: "0.000002" } },
        ],
      },
    }));
    // The error is the product here: a caller typing `vision` needs the candidate ids back, not
    // a silent pick between two models with different costs.
    await assert.rejects(
      () => resolveModel("vision-"),
      (err: unknown) => {
        assert.ok(err instanceof VrtConfigError);
        assert.equal(err.code, "MULTIPLE_MATCHES");
        assert.match(err.message, /a\/vision-pro/);
        assert.match(err.message, /b\/vision-max/);
        return true;
      },
    );
  });

  it("takes a segment match when exactly one id has it", async () => {
    // The case the escape hatch is for, and the reason it cannot simply be removed: `qwen3-vl`
    // must mean the model called that, not the 30b variant that also contains the string.
    stubFetch(() => ({
      json: {
        data: [
          { id: "qwen/qwen3-vl", architecture: { input_modalities: ["image"] }, pricing: { prompt: "0.000001" } },
          { id: "qwen/qwen3-vl-30b-a3b-instruct", architecture: { input_modalities: ["image"] }, pricing: { prompt: "0.000002" } },
        ],
      },
    }));
    assert.equal((await resolveModel("qwen3-vl")).id, "qwen/qwen3-vl");
  });

  it("accepts a numeric index into the sorted list", async () => {
    stubFetch(() => ({ json: OPENROUTER_MODELS }));
    const zero = await resolveModel("0");
    assert.equal(zero.id, "vendor/cheap-vision", "index 0 is the cheapest");
  });

  it("says what to do when the model is unknown", async () => {
    stubFetch(() => ({ json: OPENROUTER_MODELS }));
    await assert.rejects(
      () => resolveModel("no-such-model-anywhere"),
      (err: unknown) => {
        assert.ok(err instanceof VrtConfigError);
        assert.equal(err.code, "INVALID_MODEL");
        assert.match(err.message, /--list/, "the message names the way to find a real one");
        return true;
      },
    );
  });
});

describe("createVlmClient — missing keys", () => {
  const gemini = listGeminiModels()[0]!;
  const claude = listClaudeModels()[0]!;
  const openRouter: VlmModel = {
    id: "vendor/cheap-vision", name: "Cheap", promptCostPer1k: 1e-7,
    completionCostPer1k: 4e-7, contextLength: 1000, modality: "text+image->text",
  };

  it("names the exact variable each provider needs", async () => {
    // Three providers, three different variables, and the failure is at the start of a long
    // pipeline — so the message has to name the one to set.
    for (const [model, pattern] of [
      [gemini, /GEMINI_API_KEY/],
      [claude, /ANTHROPIC_API_KEY/],
      [openRouter, /OPENROUTER_API_KEY/],
    ] as const) {
      await assert.rejects(
        () => createVlmClient(model, { apiKey: undefined, ...({}) }),
        (err: unknown) => {
          assert.ok(err instanceof VrtConfigError, `${model.id} threw ${err}`);
          assert.equal(err.code, "MISSING_KEY");
          assert.match(err.message, pattern);
          assert.match(err.message, new RegExp(model.id.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
          return true;
        },
      );
    }
  });

  it("returns null instead of throwing for the legacy caller", async () => {
    assert.equal(await createVlmClient(openRouter, { throwIfMissing: false }), null);
  });
});

describe("Anthropic requests", () => {
  const claude = listClaudeModels()[0]!;
  const reply = {
    content: [{ type: "text", text: "CHANGE: color #fff -> #000" }, { type: "thinking", text: "ignored" }],
    usage: { input_tokens: 1200, output_tokens: 80 },
  };

  it("sends the image before the prompt, with the version header", async () => {
    stubFetch(() => ({ json: reply }));
    const client = await createVlmClient(claude, { apiKey: "k" });
    const res = await client!.analyzeImage("BASE64IMAGE", "what changed?");

    const call = captured[0]!;
    assert.equal(call.url, "https://api.anthropic.com/v1/messages");
    assert.equal((call.init!.headers as Record<string, string>)["x-api-key"], "k");
    assert.equal((call.init!.headers as Record<string, string>)["anthropic-version"], "2023-06-01");
    const content = (call.body.messages as { content: Record<string, unknown>[] }[])[0]!.content;
    assert.equal(content[0]!.type, "image", "image first — the prompt refers to it");
    assert.deepEqual(content[0]!.source, { type: "base64", media_type: "image/png", data: "BASE64IMAGE" });
    assert.equal(content[1]!.type, "text");
    assert.equal(call.body.max_tokens, 1024, "the documented default");

    // Only text blocks are joined: a `thinking` block in the reply is not part of the answer.
    assert.equal(res.content, "CHANGE: color #fff -> #000");
    assert.equal(res.promptTokens, 1200);
    assert.equal(res.completionTokens, 80);
    assert.equal(res.totalTokens, 1280);
    // The cost expression this repo's benches are quoted in: per-1k times tokens/1000.
    assert.ok(Math.abs(res.costUsd - ((1200 / 1000) * claude.promptCostPer1k + (80 / 1000) * claude.completionCostPer1k)) < 1e-12);
    assert.ok(res.latencyMs >= 0);
  });

  it("labels which screenshot is which in a diff request", async () => {
    // The labels are the whole reason a two-image request works: without them the model has two
    // unnamed images and reports the delta in an arbitrary direction.
    stubFetch(() => ({ json: reply }));
    const client = await createVlmClient(claude, { apiKey: "k" });
    await client!.analyzeDiff("BASE", "CUR", "describe the delta", { maxTokens: 256 });
    const content = (captured[0]!.body.messages as { content: Record<string, unknown>[] }[])[0]!.content;
    assert.deepEqual(content.map((c) => c.type), ["text", "image", "text", "image", "text"]);
    assert.match(String(content[0]!.text), /Baseline/i);
    assert.match(String(content[2]!.text), /Current/i);
    assert.equal((content[1]!.source as { data: string }).data, "BASE");
    assert.equal((content[3]!.source as { data: string }).data, "CUR");
    assert.equal(captured[0]!.body.max_tokens, 256, "the override is honoured");
  });

  it("reads an image off disk and base64s it", async () => {
    stubFetch(() => ({ json: reply }));
    const file = join(dir, "shot.png");
    writeFileSync(file, Buffer.from([0x89, 0x50, 0x4e, 0x47]));
    const client = await createVlmClient(claude, { apiKey: "k" });
    await client!.analyzeImageFile(file, "prompt");
    const content = (captured[0]!.body.messages as { content: Record<string, unknown>[] }[])[0]!.content;
    assert.equal((content[0]!.source as { data: string }).data, Buffer.from([0x89, 0x50, 0x4e, 0x47]).toString("base64"));
  });

  it("surfaces the provider's own error body", async () => {
    // A 401 with an empty message is the single most common real failure, and it must not arrive
    // as `undefined is not a function` three frames later.
    stubFetch(() => ({ status: 401, text: "{\"error\":{\"message\":\"invalid x-api-key\"}}" }));
    const client = await createVlmClient(claude, { apiKey: "bad" });
    await assert.rejects(() => client!.analyzeImage("IMG", "p"), /Anthropic API error: 401.*invalid x-api-key/s);
  });
});

describe("OpenRouter requests", () => {
  const model: VlmModel = {
    id: "vendor/cheap-vision", name: "Cheap", promptCostPer1k: 1e-7,
    completionCostPer1k: 4e-7, contextLength: 1000, modality: "text+image->text",
  };
  const reply = {
    choices: [{ message: { content: "ok" } }],
    usage: { prompt_tokens: 500, completion_tokens: 20 },
  };

  it("authorizes with a bearer token and sends a data URL", async () => {
    stubFetch(() => ({ json: reply }));
    const client = await createVlmClient(model, { apiKey: "or-key" });
    const res = await client!.analyzeImage("IMGDATA", "what changed?");
    const call = captured[0]!;
    assert.equal(call.url, "https://openrouter.ai/api/v1/chat/completions");
    assert.equal((call.init!.headers as Record<string, string>).Authorization, "Bearer or-key");
    assert.equal(call.body.model, model.id);
    const serialized = JSON.stringify(call.body);
    assert.match(serialized, /data:image\/png;base64,IMGDATA/, "OpenRouter takes a data URL, not a blob");
    assert.equal(res.content, "ok");
    // Summed from the two fields, because this reply omits `total_tokens` — as several models
    // OpenRouter serves do. Reading it directly is what put `undefined` into a token count that
    // ends up quoted in `docs/reports/` benches.
    assert.equal(res.totalTokens, 520);
  });

  it("prefers the provider's own total when it sends one", async () => {
    // A total that exceeds prompt+completion is not a bug to correct: a model billing reasoning
    // tokens reports them there and nowhere else.
    stubFetch(() => ({
      json: {
        choices: [{ message: { content: "ok" } }],
        usage: { prompt_tokens: 500, completion_tokens: 20, total_tokens: 700 },
      },
    }));
    const client = await createVlmClient(model, { apiKey: "or-key" });
    const res = await client!.analyzeImage("IMG", "p");
    assert.equal(res.totalTokens, 700);
  });

  it("reports zeros rather than NaN when usage is absent entirely", async () => {
    stubFetch(() => ({ json: { choices: [{ message: { content: "ok" } }] } }));
    const client = await createVlmClient(model, { apiKey: "or-key" });
    const res = await client!.analyzeImage("IMG", "p");
    assert.equal(res.totalTokens, 0);
    assert.equal(res.costUsd, 0);
    assert.equal(res.content, "ok", "the answer still comes back");
  });

  it("surfaces a non-2xx as an error naming the status", async () => {
    stubFetch(() => ({ status: 429, text: "rate limited" }));
    const client = await createVlmClient(model, { apiKey: "or-key" });
    await assert.rejects(() => client!.analyzeImage("IMG", "p"), /429/);
  });
});

describe("Gemini requests", () => {
  const gemini = listGeminiModels()[0]!;

  beforeEach(() => {
    geminiCalls.length = 0;
    geminiReply = { text: "gemini says ok", usage: { promptTokenCount: 900, candidatesTokenCount: 40 } };
  });

  it("strips the `gemini:` prefix before naming the model to the SDK", async () => {
    // The prefix is vlmkit's routing marker, not part of the model id. Sending it through would
    // ask Google for a model called `gemini:gemini-2.5-flash-preview-05-20`.
    const client = await createVlmClient(gemini, { apiKey: "g-key" });
    await client!.analyzeImage("IMGDATA", "what changed?");
    assert.equal(geminiCalls.length, 1);
    assert.equal(geminiCalls[0]!.__model, gemini.id.replace("gemini:", ""));
    assert.equal(geminiCalls[0]!.__apiKey, "g-key");
  });

  it("sends the image as inlineData ahead of the prompt", async () => {
    const client = await createVlmClient(gemini, { apiKey: "g-key" });
    await client!.analyzeImage("IMGDATA", "what changed?", { maxTokens: 512 });
    const call = geminiCalls[0]!;
    const parts = (call.contents as { parts: Record<string, unknown>[] }[])[0]!.parts;
    assert.deepEqual(parts[0]!.inlineData, { mimeType: "image/png", data: "IMGDATA" });
    assert.equal(parts[1]!.text, "what changed?");
    assert.deepEqual(call.generationConfig, { maxOutputTokens: 512 });
  });

  it("maps usageMetadata onto the same cost fields as the other providers", async () => {
    // The reason this matters: `docs/reports/` benches compare providers on `costUsd` and
    // `totalTokens`, and Gemini reports usage under different field names
    // (`promptTokenCount` / `candidatesTokenCount`).
    const client = await createVlmClient(gemini, { apiKey: "g-key" });
    const res = await client!.analyzeImage("IMG", "p");
    assert.equal(res.content, "gemini says ok");
    assert.equal(res.promptTokens, 900);
    assert.equal(res.completionTokens, 40);
    assert.equal(res.totalTokens, 940);
    assert.ok(Math.abs(res.costUsd - ((900 / 1000) * gemini.promptCostPer1k + (40 / 1000) * gemini.completionCostPer1k)) < 1e-15);
    assert.equal(res.model, gemini.id, "the reported id keeps the prefix, so a report says which provider ran");
  });

  it("reports zero usage rather than NaN when the SDK omits it", async () => {
    geminiReply = { text: "no usage" };
    const client = await createVlmClient(gemini, { apiKey: "g-key" });
    const res = await client!.analyzeImage("IMG", "p");
    assert.equal(res.totalTokens, 0);
    assert.equal(res.costUsd, 0);
    assert.equal(res.content, "no usage");
  });

  it("also accepts GOOGLE_AI_API_KEY", async () => {
    // Two variable names for one provider, both documented. A client that read only one of them
    // failed with MISSING_KEY for a caller who had set the other.
    const previous = process.env.GOOGLE_AI_API_KEY;
    delete process.env.GEMINI_API_KEY;
    process.env.GOOGLE_AI_API_KEY = "from-google-var";
    try {
      const client = await createVlmClient(gemini);
      await client!.analyzeImage("IMG", "p");
      assert.equal(geminiCalls[0]!.__apiKey, "from-google-var");
    } finally {
      if (previous === undefined) delete process.env.GOOGLE_AI_API_KEY;
      else process.env.GOOGLE_AI_API_KEY = previous;
    }
  });
});
