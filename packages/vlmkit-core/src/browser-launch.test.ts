import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { BROWSER_ENGINES, BrowserLaunchError, launchBrowser, withBrowser } from "./browser-launch.ts";
import { handleCliError } from "./cli-error.ts";

/**
 * The three properties the helper exists to provide. Each is stated as
 * something that was measurably NOT true of the 65 hand-rolled launch sites:
 *
 *   1. a thrown body still closes the browser (9 sites closed on the straight
 *      line and leaked a Chromium process on any throw),
 *   2. the engine parameter reaches the engine the caller named (the one
 *      multi-engine site had its own `ENGINE_BY_NAME` table),
 *   3. the missing-browser diagnosis comes out of the *launch*, so a library
 *      caller sees it — it used to exist only inside `handleCliError`.
 */

describe("withBrowser", () => {
  it("closes the browser when the callback throws", async () => {
    // A real Chromium is too slow and too environment-dependent for a leak
    // assertion, so the guarantee is checked against a stub Browser: what
    // matters is that `finally` runs, not which process it kills.
    let closed = 0;
    const stub = { close: async () => { closed++; } };
    const boom = new Error("measurement blew up");

    const original = BROWSER_ENGINES.chromium;
    BROWSER_ENGINES.chromium = { launch: async () => stub } as never;
    try {
      await assert.rejects(withBrowser(async () => { throw boom; }), /measurement blew up/);
      assert.equal(closed, 1, "browser must be closed even though the callback threw");
    } finally {
      BROWSER_ENGINES.chromium = original;
    }
  });

  it("closes the browser on the success path and returns the callback's value", async () => {
    let closed = 0;
    const original = BROWSER_ENGINES.chromium;
    BROWSER_ENGINES.chromium = { launch: async () => ({ close: async () => { closed++; } }) } as never;
    try {
      assert.equal(await withBrowser(async () => 42), 42);
      assert.equal(closed, 1);
    } finally {
      BROWSER_ENGINES.chromium = original;
    }
  });
});

describe("engine selection", () => {
  it("launches the engine the caller named, and chromium by default", async () => {
    const calls: string[] = [];
    const saved = { ...BROWSER_ENGINES };
    for (const name of ["chromium", "firefox", "webkit"] as const) {
      BROWSER_ENGINES[name] = {
        launch: async () => { calls.push(name); return { close: async () => {} }; },
      } as never;
    }
    try {
      await withBrowser(async () => {}, { engine: "webkit" });
      await withBrowser(async () => {}, { engine: "firefox" });
      await withBrowser(async () => {});
      assert.deepEqual(calls, ["webkit", "firefox", "chromium"]);
    } finally {
      Object.assign(BROWSER_ENGINES, saved);
    }
  });

  it("passes launch options through verbatim — the 4 sites with `args` depend on it", async () => {
    let seen: unknown;
    const original = BROWSER_ENGINES.chromium;
    BROWSER_ENGINES.chromium = {
      launch: async (opts: unknown) => { seen = opts; return { close: async () => {} }; },
    } as never;
    try {
      const args = ["--font-render-hinting=none", "--disable-lcd-text"];
      await withBrowser(async () => {}, { launch: { args } });
      assert.deepEqual(seen, { args });
      // Bare launch must stay bare: `launch(undefined)` is what 60 sites did.
      await withBrowser(async () => {});
      assert.equal(seen, undefined);
    } finally {
      BROWSER_ENGINES.chromium = original;
    }
  });
});

describe("launch-failure diagnosis at the helper", () => {
  const MISSING = "browserType.launch: Executable doesn't exist at /cache/chromium-1234/chrome-linux/chrome";

  it("surfaces the missing-browser diagnosis from the launch, not only from handleCliError", async () => {
    const original = BROWSER_ENGINES.chromium;
    BROWSER_ENGINES.chromium = { launch: async () => { throw new Error(MISSING); } } as never;
    try {
      // A library caller — no CLI, no `handleCliError` — must get the actionable
      // text and the install command aimed at the resolved Playwright.
      const error = await launchBrowser().then(() => null, (e) => e as Error);
      assert.ok(error instanceof BrowserLaunchError, `expected BrowserLaunchError, got ${error?.name}`);
      assert.match(error.message, /browser executable is not installed/);
      assert.match(error.message, /install chromium/);
      // The original stays reachable for anyone who wants the stack.
      assert.match(String((error as { cause?: Error }).cause?.message), /Executable doesn't exist/);
    } finally {
      BROWSER_ENGINES.chromium = original;
    }
  });

  it("prefers a caller-supplied diagnosis (the sandbox detector lives in vlmkit-capture)", async () => {
    const original = BROWSER_ENGINES.chromium;
    BROWSER_ENGINES.chromium = { launch: async () => { throw new Error(MISSING); } } as never;
    try {
      const error = await launchBrowser({ diagnose: () => "error: sandbox says no." })
        .then(() => null, (e) => e as Error);
      assert.match(error?.message ?? "", /sandbox says no/);
    } finally {
      BROWSER_ENGINES.chromium = original;
    }
  });

  it("leaves an unrecognized launch failure exactly as it was", async () => {
    const raw = new Error("browserType.launch: something nobody has a hint for");
    const original = BROWSER_ENGINES.chromium;
    BROWSER_ENGINES.chromium = { launch: async () => { throw raw; } } as never;
    try {
      // Wrapping everything would have routed the navigation / timeout branches
      // of `handleCliError` into its generic `console.error(e)` fallthrough.
      const error = await launchBrowser().then(() => null, (e) => e);
      assert.equal(error, raw);
    } finally {
      BROWSER_ENGINES.chromium = original;
    }
  });

  it("handleCliError prints a BrowserLaunchError verbatim, with no second `error:` prefix", () => {
    const writes: string[] = [];
    const stderr = process.stderr.write;
    const exit = process.exit;
    process.stderr.write = ((s: string) => { writes.push(s); return true; }) as never;
    process.exit = ((code?: number) => { throw new Error(`exit:${code}`); }) as never;
    try {
      assert.throws(
        () => handleCliError(new BrowserLaunchError("error: Playwright 1.61.1 browser executable is not installed.\n       run: node cli.js install chromium")),
        /exit:1/,
      );
      assert.deepEqual(writes, [
        "error: Playwright 1.61.1 browser executable is not installed.\n       run: node cli.js install chromium\n",
      ]);
    } finally {
      process.stderr.write = stderr;
      process.exit = exit;
    }
  });
});
