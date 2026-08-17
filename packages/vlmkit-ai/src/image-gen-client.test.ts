import assert from "node:assert/strict";
import { describe, it } from "vitest";
import {
  buildGenerationBody,
  estimateImageGenCost,
  parseGenerationResponse,
  resolveImageGenModel,
  type ImageGenModel,
} from "./image-gen-client.ts";

const gptImage2: ImageGenModel = resolveImageGenModel("gpt-image-2");

describe("resolveImageGenModel", () => {
  it("returns the registered gpt-image-2 model", () => {
    const m = resolveImageGenModel("gpt-image-2");
    assert.equal(m.id, "gpt-image-2");
    assert.equal(m.provider, "openai");
    assert.equal(typeof m.costPer1MOutputImageTokens, "number");
  });

  it("accepts the dated snapshot id", () => {
    const m = resolveImageGenModel("gpt-image-2-2026-04-21");
    assert.equal(m.id, "gpt-image-2-2026-04-21");
    assert.equal(m.provider, "openai");
  });

  it("throws on unknown id", () => {
    assert.throws(() => resolveImageGenModel("not-a-real-model"), /image generation model/i);
  });
});

describe("buildGenerationBody", () => {
  it("builds a JSON body with sane defaults", () => {
    const body = buildGenerationBody(gptImage2, { prompt: "A red square" });
    assert.equal(body.model, "gpt-image-2");
    assert.equal(body.prompt, "A red square");
    assert.equal(body.quality, "medium");
    assert.equal(body.size, "1024x1024");
    assert.equal(body.n, 1);
    assert.equal(body.output_format, "png");
    assert.equal(body.background, "opaque");
  });

  it("honors explicit quality/size/n/background", () => {
    const body = buildGenerationBody(gptImage2, {
      prompt: "x",
      quality: "high",
      size: "1536x1024",
      n: 3,
      background: "auto",
      outputFormat: "webp",
    });
    assert.equal(body.quality, "high");
    assert.equal(body.size, "1536x1024");
    assert.equal(body.n, 3);
    assert.equal(body.background, "auto");
    assert.equal(body.output_format, "webp");
  });

  it("rejects invalid quality / size values", () => {
    assert.throws(() => buildGenerationBody(gptImage2, { prompt: "x", quality: "ultra" as never }), /quality/);
    assert.throws(() => buildGenerationBody(gptImage2, { prompt: "x", size: "999x999" as never }), /size/);
  });

  it("rejects empty prompt", () => {
    assert.throws(() => buildGenerationBody(gptImage2, { prompt: "" }), /prompt/);
  });
});

describe("parseGenerationResponse", () => {
  it("decodes b64_json entries into Uint8Array", () => {
    const png1 = Buffer.from("PNG-bytes-1").toString("base64");
    const png2 = Buffer.from("PNG-bytes-2").toString("base64");
    const parsed = parseGenerationResponse({
      data: [{ b64_json: png1 }, { b64_json: png2 }],
      usage: {
        input_tokens: 100,
        output_tokens: 4000,
        input_tokens_details: { text_tokens: 100, image_tokens: 0 },
      },
    });
    assert.equal(parsed.images.length, 2);
    assert.equal(Buffer.from(parsed.images[0]).toString(), "PNG-bytes-1");
    assert.equal(Buffer.from(parsed.images[1]).toString(), "PNG-bytes-2");
    assert.equal(parsed.usage?.inputTextTokens, 100);
    assert.equal(parsed.usage?.outputTokens, 4000);
  });

  it("returns empty images when data is missing", () => {
    const parsed = parseGenerationResponse({});
    assert.deepEqual(parsed.images, []);
    assert.equal(parsed.usage, null);
  });

  it("skips entries without b64_json", () => {
    const parsed = parseGenerationResponse({ data: [{ url: "https://example/png" }, { b64_json: Buffer.from("X").toString("base64") }] });
    assert.equal(parsed.images.length, 1);
    assert.equal(Buffer.from(parsed.images[0]).toString(), "X");
  });
});

describe("estimateImageGenCost", () => {
  it("computes USD using per-1M token rates", () => {
    const cost = estimateImageGenCost(gptImage2, {
      inputTextTokens: 1_000_000, // $5
      inputImageTokens: 1_000_000, // $8
      outputTokens: 1_000_000, // $30
    });
    assert.equal(cost, 43);
  });

  it("returns 0 when usage is null", () => {
    assert.equal(estimateImageGenCost(gptImage2, null), 0);
  });

  it("rounds to 6 decimal places", () => {
    const cost = estimateImageGenCost(gptImage2, {
      inputTextTokens: 100,
      inputImageTokens: 0,
      outputTokens: 4000,
    });
    // 100 * 5 + 4000 * 30 = 500 + 120000 = 120500 ; /1e6 = 0.1205
    assert.equal(cost, 0.1205);
  });
});
