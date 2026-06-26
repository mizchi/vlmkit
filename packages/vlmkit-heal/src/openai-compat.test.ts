import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { buildUserContent, parseChatCompletion } from "./openai-compat.ts";

describe("buildUserContent", () => {
  it("returns a plain string when there is no screenshot", () => {
    assert.equal(buildUserContent("hello"), "hello");
  });
  it("returns a text+image_url array with a data URL when given a screenshot", () => {
    const out = buildUserContent("look", Buffer.from("PNGBYTES"));
    assert.ok(Array.isArray(out));
    const arr = out as Array<{ type: string; image_url?: { url: string } }>;
    assert.equal(arr[0].type, "text");
    assert.equal(arr[1].type, "image_url");
    assert.match(arr[1].image_url!.url, /^data:image\/png;base64,/);
  });
});

describe("parseChatCompletion", () => {
  it("extracts content and token usage", () => {
    const r = parseChatCompletion({
      choices: [{ message: { content: "intentional-change" } }],
      usage: { prompt_tokens: 12, completion_tokens: 3 },
    });
    assert.equal(r.content, "intentional-change");
    assert.equal(r.promptTokens, 12);
    assert.equal(r.completionTokens, 3);
  });
  it("is defensive about missing fields", () => {
    const r = parseChatCompletion({});
    assert.equal(r.content, "");
    assert.equal(r.promptTokens, 0);
    assert.equal(r.completionTokens, 0);
  });
});
