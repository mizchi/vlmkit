import assert from "node:assert/strict";
import { afterEach, describe, it } from "vitest";
import { mkdirSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  CONFIG_CANDIDATES,
  CONFIG_FILE,
  ENV_SUFFIXES,
  STATE_DIR,
  debugEnabled,
  readEnv,
  resolveStatePath,
} from "./project-config.ts";

const fresh = (): string => mkdtempSync(join(tmpdir(), "project-config-"));

afterEach(() => {
  delete process.env.VLMKIT_LLM_MODEL;
  delete process.env.VRT_LLM_MODEL;
  delete process.env.DEBUG_VLMKIT;
  delete process.env.DEBUG_VRT;
});

describe("canonical project paths", () => {
  it("always writes state below .vlmkit, even if an old .vrt tree exists", () => {
    const dir = fresh();
    mkdirSync(join(dir, ".vrt", "baselines"), { recursive: true });
    assert.equal(resolveStatePath(dir, "baselines"), join(dir, STATE_DIR, "baselines"));
  });

  it("searches only canonical config filenames", () => {
    assert.equal(CONFIG_FILE, "vlmkit.config.json");
    assert.deepEqual(CONFIG_CANDIDATES, ["vlmkit.config.json", "vlmkit.config.toml"]);
  });
});

describe("canonical environment variables", () => {
  it("reads VLMKIT_* and ignores removed VRT_* names", () => {
    process.env.VRT_LLM_MODEL = "legacy";
    assert.equal(readEnv("LLM_MODEL"), undefined);
    process.env.VLMKIT_LLM_MODEL = "current";
    assert.equal(readEnv("LLM_MODEL"), "current");
  });

  it("uses only DEBUG_VLMKIT", () => {
    process.env.DEBUG_VRT = "1";
    assert.equal(debugEnabled(), false);
    process.env.DEBUG_VLMKIT = "1";
    assert.equal(debugEnabled(), true);
  });

  it("enumerates the supported suffix contract", () => {
    assert.ok(ENV_SUFFIXES.includes("LLM_MODEL"));
  });
});
