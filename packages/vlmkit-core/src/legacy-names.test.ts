/**
 * The `vrt` → `vlmkit` rename of state paths, config filenames and env vars is
 * only safe if the old names keep working. These tests are the proof, because
 * the failure mode is silent: a project whose baselines live in `.vrt/baselines`
 * would report every route as a new baseline, which reads as "nothing to
 * approve" rather than as an error.
 */
import assert from "node:assert/strict";
import { afterEach, describe, it } from "node:test";
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  CONFIG_CANDIDATES,
  CONFIG_FILE,
  ENV_SUFFIXES,
  LEGACY_CONFIG_FILE,
  LEGACY_STATE_DIR,
  STATE_DIR,
  readEnv,
  resetLegacyNotices,
  resolveStatePath,
} from "./legacy-names.ts";

const fresh = (): string => mkdtempSync(join(tmpdir(), "legacy-names-"));
afterEach(() => resetLegacyNotices());

describe("state paths prefer the new directory but never abandon the old one", () => {
  it("resolves to .vlmkit/<entry> in a project with neither", () => {
    const dir = fresh();
    assert.equal(resolveStatePath(dir, "baselines"), join(dir, STATE_DIR, "baselines"));
  });

  it("resolves to .vrt/<entry> when that is where the history is", () => {
    // The case that would have lost every approved baseline.
    const dir = fresh();
    mkdirSync(join(dir, LEGACY_STATE_DIR, "baselines"), { recursive: true });
    assert.equal(resolveStatePath(dir, "baselines"), join(dir, LEGACY_STATE_DIR, "baselines"));
  });

  it("prefers .vlmkit/<entry> when both exist", () => {
    const dir = fresh();
    mkdirSync(join(dir, LEGACY_STATE_DIR, "baselines"), { recursive: true });
    mkdirSync(join(dir, STATE_DIR, "baselines"), { recursive: true });
    assert.equal(resolveStatePath(dir, "baselines"), join(dir, STATE_DIR, "baselines"));
  });

  it("decides per entry, not per directory", () => {
    // `.vlmkit/` already exists in any project that ran a gate (run ledger,
    // gates, markup-loop), so a per-directory check would resolve to the new
    // location immediately and skip the legacy baselines sitting next to it.
    const dir = fresh();
    mkdirSync(join(dir, STATE_DIR, "gates"), { recursive: true });
    mkdirSync(join(dir, LEGACY_STATE_DIR, "baselines"), { recursive: true });
    assert.equal(resolveStatePath(dir, "baselines"), join(dir, LEGACY_STATE_DIR, "baselines"));
    assert.equal(resolveStatePath(dir, "gates"), join(dir, STATE_DIR, "gates"));
  });
});

describe("config filename search order", () => {
  it("lists new names before legacy ones, JSON before TOML", () => {
    assert.deepEqual(CONFIG_CANDIDATES.map((c) => c.name), [
      CONFIG_FILE, "vlmkit.config.toml", LEGACY_CONFIG_FILE, "vrt.config.toml",
    ]);
    assert.deepEqual(CONFIG_CANDIDATES.map((c) => c.legacy), [false, false, true, true]);
  });

  it("every candidate is a real filename a project could have on disk", () => {
    const dir = fresh();
    for (const { name } of CONFIG_CANDIDATES) {
      writeFileSync(join(dir, name), "{}");
    }
    // Nothing to assert beyond "these are writable filenames" — the point is
    // that the list is filenames, not patterns, so the caller can name them all
    // in a not-found error.
    assert.equal(CONFIG_CANDIDATES.length, 4);
  });
});

describe("env vars read the new name and fall back to the old", () => {
  const clear = (suffix: string) => {
    delete process.env[`VLMKIT_${suffix}`];
    delete process.env[`VRT_${suffix}`];
  };

  it("returns undefined when neither is set", () => {
    clear("LLM_MODEL");
    assert.equal(readEnv("LLM_MODEL"), undefined);
  });

  it("reads VLMKIT_* first", () => {
    clear("LLM_MODEL");
    process.env.VLMKIT_LLM_MODEL = "new";
    process.env.VRT_LLM_MODEL = "old";
    assert.equal(readEnv("LLM_MODEL"), "new");
    clear("LLM_MODEL");
  });

  it("falls back to VRT_* so an existing CI keeps working", () => {
    clear("VLM_MODEL");
    process.env.VRT_VLM_MODEL = "bytedance/ui-tars-1.5-7b";
    assert.equal(readEnv("VLM_MODEL"), "bytedance/ui-tars-1.5-7b");
    clear("VLM_MODEL");
  });

  it("treats an empty string as unset, matching the previous `||` reads", () => {
    clear("BASE_URL");
    process.env.VLMKIT_BASE_URL = "";
    process.env.VRT_BASE_URL = "http://localhost:3000";
    assert.equal(readEnv("BASE_URL"), "http://localhost:3000");
    clear("BASE_URL");
  });

  it("every suffix in ENV_SUFFIXES resolves through the same path", () => {
    // Guards against a suffix being listed in docs but never routed.
    for (const suffix of ENV_SUFFIXES) {
      clear(suffix);
      process.env[`VRT_${suffix}`] = `legacy-${suffix}`;
      assert.equal(readEnv(suffix), `legacy-${suffix}`, suffix);
      clear(suffix);
    }
  });
});

describe("the legacy notice is printed once, not per call", () => {
  it("announces a given old name a single time", () => {
    const dir = fresh();
    mkdirSync(join(dir, LEGACY_STATE_DIR, "runs"), { recursive: true });
    const lines: string[] = [];
    const write = process.stderr.write.bind(process.stderr);
    process.stderr.write = ((chunk: string) => { lines.push(String(chunk)); return true; }) as typeof process.stderr.write;
    try {
      resolveStatePath(dir, "runs");
      resolveStatePath(dir, "runs");
      resolveStatePath(dir, "runs");
    } finally {
      process.stderr.write = write;
    }
    const notices = lines.filter((l) => l.includes("[vlmkit legacy]"));
    assert.equal(notices.length, 1, notices.join(""));
    assert.match(notices[0]!, /\.vrt\/runs.*\.vlmkit\/runs.*1\.0\.0/);
  });
});
