import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { VrtConfigError } from "./errors.ts";
import { createUnifiedLLMClient, createLLMProvider } from "./llm-client.ts";
import { createReasoningPipeline } from "./reasoning-pipeline.ts";

const ENV_KEYS = [
  "GEMINI_API_KEY",
  "GOOGLE_AI_API_KEY",
  "ANTHROPIC_API_KEY",
  "OPENROUTER_API_KEY",
  "VRT_LLM_PROVIDER",
  "VRT_LLM_MODEL",
  "VRT_VLM_MODEL",
] as const;

function withCleanEnv(
  overrides: Partial<Record<typeof ENV_KEYS[number], string>>,
  fn: () => void | Promise<void>,
): void | Promise<void> {
  const saved: Record<string, string | undefined> = {};
  for (const k of ENV_KEYS) {
    saved[k] = process.env[k];
    delete process.env[k];
  }
  for (const [k, v] of Object.entries(overrides)) {
    if (v !== undefined) process.env[k] = v;
  }
  try {
    return fn();
  } finally {
    for (const [k, v] of Object.entries(saved)) {
      if (v === undefined) delete process.env[k];
      else process.env[k] = v;
    }
  }
}

describe("VrtConfigError", () => {
  it("carries the discriminant code", () => {
    const err = new VrtConfigError("MISSING_KEY", "GEMINI_API_KEY not set");
    assert.equal(err.code, "MISSING_KEY");
    assert.equal(err.name, "VrtConfigError");
    assert.match(err.message, /GEMINI_API_KEY/);
    assert.ok(err instanceof Error);
    assert.ok(err instanceof VrtConfigError);
  });
});

describe("createUnifiedLLMClient", () => {
  it("throws VrtConfigError MISSING_KEY when default provider has no key", () => {
    withCleanEnv({}, () => {
      assert.throws(
        () => createUnifiedLLMClient(),
        (err: Error) => err instanceof VrtConfigError && err.code === "MISSING_KEY",
      );
    });
  });

  it("throws INVALID_PROVIDER for unknown VRT_LLM_PROVIDER", () => {
    withCleanEnv({ VRT_LLM_PROVIDER: "gpt5" }, () => {
      assert.throws(
        () => createUnifiedLLMClient(),
        (err: Error) => err instanceof VrtConfigError && err.code === "INVALID_PROVIDER",
      );
    });
  });

  it("returns null when throwIfMissing: false and no key", () => {
    withCleanEnv({}, () => {
      const client = createUnifiedLLMClient({ throwIfMissing: false });
      assert.equal(client, null);
    });
  });

  it("returns a client when a key is set", () => {
    withCleanEnv({ GEMINI_API_KEY: "test-key" }, () => {
      const client = createUnifiedLLMClient();
      assert.notEqual(client, null);
    });
  });
});

describe("createLLMProvider", () => {
  it("throws NO_PROVIDER_AVAILABLE when every provider lacks a key", () => {
    withCleanEnv({}, () => {
      assert.throws(
        () => createLLMProvider(),
        (err: Error) =>
          err instanceof VrtConfigError && err.code === "NO_PROVIDER_AVAILABLE",
      );
    });
  });

  it("returns null when throwIfMissing: false and no provider available", () => {
    withCleanEnv({}, () => {
      const provider = createLLMProvider({ throwIfMissing: false });
      assert.equal(provider, null);
    });
  });

  it("falls back across providers", () => {
    // anthropic key set; default provider is gemini → falls back
    withCleanEnv({ ANTHROPIC_API_KEY: "test", VRT_LLM_PROVIDER: "gemini" }, () => {
      const provider = createLLMProvider();
      assert.notEqual(provider, null);
    });
  });
});

describe("createReasoningPipeline", () => {
  it("throws NO_PROVIDER_AVAILABLE when nothing is configured", () => {
    withCleanEnv({}, () => {
      assert.throws(
        () => createReasoningPipeline(),
        (err: Error) =>
          err instanceof VrtConfigError && err.code === "NO_PROVIDER_AVAILABLE",
      );
    });
  });

  it("returns null when throwIfMissing: false", () => {
    withCleanEnv({}, () => {
      const pipeline = createReasoningPipeline({ throwIfMissing: false });
      assert.equal(pipeline, null);
    });
  });
});
