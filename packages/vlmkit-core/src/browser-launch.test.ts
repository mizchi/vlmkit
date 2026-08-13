import assert from "node:assert/strict";
import { describe, it } from "vitest";
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
      assert.match(error.message, /has no chromium browser executable installed/);
      assert.match(error.message, /cli\.js install chromium/);
      // Not `npx playwright install`: that resolves the *project's* Playwright,
      // which in a tree with two versions downloads a different browser build
      // and leaves the launch failing (issue #112).
      assert.match(error.message, /resolved: playwright@/);
      // The original stays reachable for anyone who wants the stack.
      assert.match(String((error as { cause?: Error }).cause?.message), /Executable doesn't exist/);
    } finally {
      BROWSER_ENGINES.chromium = original;
    }
  });

  it("names the engine that actually failed, not always chromium", async () => {
    // This diagnosis was gated to chromium when `formatMissingPlaywrightBrowserError`
    // hard-coded `install chromium`; it now reads the engine off the executable
    // path, so gating it only suppressed a correct answer. Telling an operator to
    // install chromium when firefox is what is missing is worse than saying
    // nothing, which is why the gate was right before and wrong after.
    const original = BROWSER_ENGINES.firefox;
    BROWSER_ENGINES.firefox = {
      launch: async () => {
        throw new Error("browserType.launch: Executable doesn't exist at /cache/firefox-1490/firefox/firefox");
      },
    } as never;
    try {
      const error = await launchBrowser({ engine: "firefox" }).then(() => null, (e) => e as Error);
      assert.ok(error instanceof BrowserLaunchError, `expected BrowserLaunchError, got ${error?.name}`);
      assert.match(error.message, /has no firefox browser executable installed/);
      assert.match(error.message, /cli\.js install firefox/);
      assert.doesNotMatch(error.message, /install chromium/);
    } finally {
      BROWSER_ENGINES.firefox = original;
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

/**
 * The fourth property, added after two dogfood agents independently reported the
 * navigation timeout as a dead end: a page opened by this helper explains its own
 * timeout. Instrumenting at the launch rather than at `navigatePage` is deliberate
 * — there are 42 `.goto(` call sites and three of them hand-roll the same options
 * object, so a fix at one navigation helper reaches a fraction of them.
 */
describe("navigation timeout diagnosis", () => {
  /** A stub page whose `goto` fails the way Playwright's does. */
  function stubBrowser(gotoError: Error, requests: string[] = []) {
    const handlers = new Map<string, ((r: { url(): string }) => void)[]>();
    const page = {
      on(event: string, fn: (r: { url(): string }) => void) {
        handlers.set(event, [...(handlers.get(event) ?? []), fn]);
      },
      async goto(_url: string, _options?: unknown) {
        // Fire the request events the real browser would have fired before the
        // navigation gave up, so the pending set is non-empty.
        for (const url of requests) {
          for (const fn of handlers.get("request") ?? []) fn({ url: () => url });
        }
        throw gotoError;
      },
    };
    return { close: async () => {}, newPage: async () => page };
  }

  async function timeoutMessage(gotoOptions: unknown, requests: string[]): Promise<string> {
    const original = BROWSER_ENGINES.chromium;
    BROWSER_ENGINES.chromium = {
      launch: async () => stubBrowser(new Error("Timeout 30000ms exceeded"), requests),
    } as never;
    try {
      return await withBrowser(async (browser) => {
        const page = await browser.newPage();
        try {
          await page.goto("http://localhost:1/", gotoOptions as never);
          return "did not throw";
        } catch (e) {
          return e instanceof Error ? e.message : String(e);
        }
      });
    } finally {
      BROWSER_ENGINES.chromium = original;
    }
  }

  it("names the milestone, the open requests, and the flag that ends the wait", async () => {
    const message = await timeoutMessage(
      { waitUntil: "networkidle", timeout: 30_000 },
      ["http://localhost:1/api/live", "http://localhost:1/api/poll"],
    );
    assert.match(message, /waiting for `networkidle`/);
    assert.match(message, /2 request\(s\) still open/);
    assert.match(message, /api\/live/);
    // The way out has to be in the failure, not only in `--help`: that is the
    // whole finding.
    assert.match(message, /--wait-until load/);
    assert.match(message, /--har/);
    // And the one thing that does NOT help, said so nobody spends a round on it.
    assert.match(message, /Raising `--timeout` will not help/);
  });

  it("does not offer the networkidle advice when a different milestone timed out", async () => {
    const message = await timeoutMessage({ waitUntil: "load", timeout: 5000 }, []);
    assert.match(message, /waiting for `load`/);
    assert.match(message, /after 5000ms/);
    assert.doesNotMatch(message, /networkidle needs every connection/);
    assert.match(message, /Raise `--timeout <ms>`/);
  });

  it("names Playwright's own default milestone when the call site passed none", async () => {
    // 42 call sites; some pass nothing. The message must still say what it waited
    // on rather than inventing `networkidle`.
    const message = await timeoutMessage(undefined, []);
    assert.match(message, /waiting for `load`/);
  });

  it("leaves a non-timeout navigation error untouched, so the other branches still diagnose it", async () => {
    const original = BROWSER_ENGINES.chromium;
    const refused = new Error("net::ERR_CONNECTION_REFUSED at http://localhost:1/");
    BROWSER_ENGINES.chromium = { launch: async () => stubBrowser(refused) } as never;
    try {
      const thrown = await withBrowser(async (browser) => {
        const page = await browser.newPage();
        try {
          await page.goto("http://localhost:1/");
          return null;
        } catch (e) {
          return e;
        }
      });
      assert.equal(thrown, refused, "the original error object must reach cli-error.ts unwrapped");
    } finally {
      BROWSER_ENGINES.chromium = original;
    }
  });

  it("survives a backend that does not implement newPage", async () => {
    const original = BROWSER_ENGINES.chromium;
    BROWSER_ENGINES.chromium = { launch: async () => ({ close: async () => {} }) } as never;
    try {
      assert.equal(await withBrowser(async () => "ran"), "ran");
    } finally {
      BROWSER_ENGINES.chromium = original;
    }
  });
});
