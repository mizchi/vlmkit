import assert from "node:assert/strict";
import { test } from "vitest";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { authStateNotice, readStorageState, resetAuthStateNotice, STORAGE_STATE_ENV, storageStatePath, withAuthState } from "./auth-state.ts";

const withEnv = async (value: string | undefined, fn: () => Promise<void> | void) => {
  const prev = process.env[STORAGE_STATE_ENV];
  if (value === undefined) delete process.env[STORAGE_STATE_ENV];
  else process.env[STORAGE_STATE_ENV] = value;
  try {
    await fn();
  } finally {
    if (prev === undefined) delete process.env[STORAGE_STATE_ENV];
    else process.env[STORAGE_STATE_ENV] = prev;
  }
};

test("explicit path beats env; blank values are ignored", async () => {
  await withEnv("from-env.json", () => {
    assert.equal(storageStatePath("explicit.json"), "explicit.json");
    assert.equal(storageStatePath(), "from-env.json");
    assert.equal(storageStatePath("  "), "from-env.json");
  });
  await withEnv(undefined, () => {
    assert.equal(storageStatePath(), undefined);
  });
});

test("valid storage state is accepted and injected into page options", async () => {
  const dir = await mkdtemp(join(tmpdir(), "auth-state-"));
  try {
    const file = join(dir, "auth.json");
    await writeFile(file, JSON.stringify({ cookies: [{ name: "sid", value: "abc" }], origins: [] }));
    const state = readStorageState(file);
    assert.equal(state.cookies.length, 1);

    await withEnv(undefined, () => {
      const opts = withAuthState({ viewport: { width: 1280, height: 800 } }, file);
      assert.equal(opts.storageState, resolve(file));
      assert.deepEqual(opts.viewport, { width: 1280, height: 800 });
    });
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("no auth configured leaves page options untouched", async () => {
  await withEnv(undefined, () => {
    const base = { viewport: { width: 375, height: 700 } };
    const opts = withAuthState(base);
    assert.deepEqual(opts, base);
    assert.equal("storageState" in opts, false);
  });
});

test("bad storage state throws before navigation, with a usable hint", async () => {
  const dir = await mkdtemp(join(tmpdir(), "auth-state-bad-"));
  try {
    assert.throws(() => readStorageState(join(dir, "nope.json")), /not found[\s\S]*codegen --save-storage/);

    const bad = join(dir, "bad.json");
    await writeFile(bad, "{not json");
    assert.throws(() => readStorageState(bad), /not valid JSON/);

    const wrong = join(dir, "wrong.json");
    await writeFile(wrong, JSON.stringify({ token: "abc" }));
    assert.throws(() => readStorageState(wrong), /no "cookies" or "origins" array/);

    const empty = join(dir, "empty.json");
    await writeFile(empty, JSON.stringify({ cookies: [], origins: [] }));
    assert.throws(() => readStorageState(empty), /authenticate nothing/);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("env-configured auth applies without an explicit flag", async () => {
  const dir = await mkdtemp(join(tmpdir(), "auth-state-env-"));
  try {
    const file = join(dir, "auth.json");
    await writeFile(file, JSON.stringify({ cookies: [{ name: "sid", value: "z" }] }));
    await withEnv(file, () => {
      const opts = withAuthState({ viewport: { width: 800, height: 600 } });
      assert.equal(opts.storageState, resolve(file));
    });
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

/**
 * The notice existed and was never called, so the gates could measure a logged-in
 * page while saying nothing about it. `VLMKIT_STORAGE_STATE` makes that the easy case
 * rather than the exotic one: no flag reaches the command line, so without a notice
 * "the dashboard" and "the login wall it redirected to" produce indistinguishable
 * reports.
 */
test("the notice reports what was applied, not what was configured", async () => {
  const dir = await mkdtemp(join(tmpdir(), "vlmkit-auth-notice-"));
  const file = join(dir, "auth.json");
  await writeFile(file, JSON.stringify({
    cookies: [{ name: "s", value: "v", domain: "127.0.0.1", path: "/" }],
    origins: [],
  }));
  try {
    resetAuthStateNotice();
    assert.equal(authStateNotice(), null, "an unauthenticated run must say nothing");

    // Configured but never applied: a gate that ignores auth must not claim to have
    // used it. This is why the notice reads from `withAuthState` rather than from
    // `storageStatePath`.
    await withEnv(file, () => {
      resetAuthStateNotice();
      assert.equal(storageStatePath(), file, "the env var is configured");
      assert.equal(authStateNotice(), null, "configured is not applied");
    });

    // Applied through the env var, with no explicit argument — the silent case.
    await withEnv(file, () => {
      resetAuthStateNotice();
      const options = withAuthState({ viewport: { width: 800, height: 600 } });
      assert.equal(options.storageState, resolve(file));
      assert.equal(authStateNotice(), `auth: storage state from ${resolve(file)}`);
    });

    // Applied explicitly.
    resetAuthStateNotice();
    withAuthState({}, file);
    assert.match(authStateNotice() ?? "", /^auth: storage state from \//, "the path is absolute");

    // A reset between gates clears it, so the second gate in one process does not
    // inherit the first one's session in its output.
    resetAuthStateNotice();
    assert.equal(authStateNotice(), null);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});
