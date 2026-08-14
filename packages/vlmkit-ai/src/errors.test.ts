import { describe, it } from "vitest";
import assert from "node:assert/strict";
import { VrtConfigError } from "./errors.ts";
import { createUnifiedLLMClient, createLLMProvider } from "./llm-client.ts";
import { createReasoningPipeline } from "./reasoning-pipeline.ts";

const ENV_KEYS = [
  "GEMINI_API_KEY",
  "GOOGLE_AI_API_KEY",
  "ANTHROPIC_API_KEY",
  "OPENROUTER_API_KEY",
  "VLMKIT_LLM_PROVIDER",
  "VLMKIT_LLM_MODEL",
  "VLMKIT_VLM_MODEL",
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

  it("throws INVALID_PROVIDER for unknown VLMKIT_LLM_PROVIDER", () => {
    withCleanEnv({ VLMKIT_LLM_PROVIDER: "gpt5" }, () => {
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

  it("picks a provider from the keys present when none was requested", () => {
    // It used to hardcode gemini regardless of which keys existed, so a caller with
    // exactly one key got `MISSING_KEY: GEMINI_API_KEY … is required` — told to obtain a
    // key it did not need while the one it had was ignored. `createLLMProvider`, in the
    // same file, returned a working client for both of these.
    withCleanEnv({ ANTHROPIC_API_KEY: "k" }, () => {
      assert.equal(createUnifiedLLMClient()?.provider, "anthropic");
    });
    withCleanEnv({ OPENROUTER_API_KEY: "k" }, () => {
      assert.equal(createUnifiedLLMClient()?.provider, "openrouter");
    });
  });

  it("keeps gemini as the documented default when its key is present", () => {
    // The preference order exists so "default: gemini" stays true. Gemini wins whenever
    // it can, and only yields to another provider when it has no key at all.
    withCleanEnv({ GEMINI_API_KEY: "k", ANTHROPIC_API_KEY: "k", OPENROUTER_API_KEY: "k" }, () => {
      assert.equal(createUnifiedLLMClient()?.provider, "gemini");
    });
    withCleanEnv({ GOOGLE_AI_API_KEY: "k", OPENROUTER_API_KEY: "k" }, () => {
      assert.equal(createUnifiedLLMClient()?.provider, "gemini", "GOOGLE_AI_API_KEY is a Gemini key too");
    });
  });

  it("honours an explicit provider exactly, rather than substituting one that has a key", () => {
    // The other half of the contract. Asking for gemini and silently getting anthropic
    // would be its own wrong answer, so an explicit request that cannot be served is a
    // MISSING_KEY naming what *that* provider needs.
    withCleanEnv({ ANTHROPIC_API_KEY: "k", VLMKIT_LLM_PROVIDER: "gemini" }, () => {
      assert.throws(
        () => createUnifiedLLMClient(),
        (err: Error) =>
          err instanceof VrtConfigError && err.code === "MISSING_KEY"
          && /GEMINI_API_KEY/.test(err.message) && /provider "gemini"/.test(err.message),
      );
    });
    withCleanEnv({ ANTHROPIC_API_KEY: "k" }, () => {
      assert.throws(
        () => createUnifiedLLMClient({ provider: "openrouter" }),
        (err: Error) => err instanceof VrtConfigError && /OPENROUTER_API_KEY/.test(err.message),
      );
    });
  });

  it("names every key it would accept when nothing is requested and nothing is set", () => {
    // The old message pointed at gemini alone, which is only the right advice if the
    // caller asked for gemini. Nobody asked here.
    withCleanEnv({}, () => {
      assert.throws(
        () => createUnifiedLLMClient(),
        (err: Error) =>
          err instanceof VrtConfigError && err.code === "MISSING_KEY"
          && /GEMINI_API_KEY/.test(err.message)
          && /ANTHROPIC_API_KEY/.test(err.message)
          && /OPENROUTER_API_KEY/.test(err.message),
      );
    });
  });

  it("uses the current Anthropic Sonnet default model", () => {
    withCleanEnv({ ANTHROPIC_API_KEY: "test-key" }, () => {
      const client = createUnifiedLLMClient({ provider: "anthropic" });
      assert.equal(client?.model, "claude-sonnet-4-6");
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
    withCleanEnv({ ANTHROPIC_API_KEY: "test", VLMKIT_LLM_PROVIDER: "gemini" }, () => {
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
