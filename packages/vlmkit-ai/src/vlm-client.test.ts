import { describe, it } from "vitest";
import assert from "node:assert/strict";
import {
  isClaudeDirectModel,
  isGeminiDirectModel,
  listClaudeModels,
  listGeminiModels,
  resolveClaudeModel,
  resolveGeminiModel,
} from "./vlm-client.ts";

describe("vlm-client direct-provider model registry", () => {
  it("identifies Gemini direct model IDs by prefix", () => {
    assert.equal(isGeminiDirectModel("gemini:gemini-2.0-flash"), true);
    assert.equal(isGeminiDirectModel("claude:claude-haiku-4-5-20251001"), false);
    assert.equal(isGeminiDirectModel("qwen/qwen3-vl-8b-instruct"), false);
  });

  it("identifies Claude direct model IDs by prefix", () => {
    assert.equal(isClaudeDirectModel("claude:claude-haiku-4-5-20251001"), true);
    assert.equal(isClaudeDirectModel("gemini:gemini-2.0-flash"), false);
    assert.equal(isClaudeDirectModel("meta-llama/llama-4-scout"), false);
  });

  it("resolves Claude model by full prefixed ID", () => {
    const model = resolveClaudeModel("claude:claude-haiku-4-5-20251001");
    assert.ok(model);
    assert.equal(model.id, "claude:claude-haiku-4-5-20251001");
    assert.equal(model.modality, "text+image->text");
  });

  it("resolves Claude model by bare model ID", () => {
    const model = resolveClaudeModel("claude-sonnet-4-6");
    assert.ok(model);
    assert.equal(model.id, "claude:claude-sonnet-4-6");
  });

  it("returns undefined for unknown Claude ID", () => {
    assert.equal(resolveClaudeModel("claude:gpt-4"), undefined);
  });

  it("lists Claude models with monotonic prompt cost", () => {
    const models = listClaudeModels();
    assert.ok(models.length >= 3, "expected at least haiku/sonnet/opus");
    for (let i = 1; i < models.length; i++) {
      assert.ok(
        models[i].promptCostPer1k >= models[i - 1].promptCostPer1k,
        `Claude tier ${models[i].id} should not be cheaper than ${models[i - 1].id}`,
      );
    }
  });

  it("Gemini registry and Claude registry are disjoint", () => {
    const geminiIds = new Set(listGeminiModels().map((m) => m.id));
    const claudeIds = new Set(listClaudeModels().map((m) => m.id));
    for (const id of claudeIds) {
      assert.equal(geminiIds.has(id), false, `${id} should not be in Gemini registry`);
    }
    for (const id of geminiIds) {
      assert.equal(claudeIds.has(id), false, `${id} should not be in Claude registry`);
    }
  });

  it("does not resolve Gemini IDs as Claude", () => {
    assert.equal(resolveClaudeModel("gemini:gemini-2.0-flash"), undefined);
    assert.equal(resolveGeminiModel("claude:claude-haiku-4-5-20251001"), undefined);
  });
});
