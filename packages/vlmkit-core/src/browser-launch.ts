/**
 * The one place a browser is launched.
 *
 * Measured before this module existed (2026-08-10, repo-wide grep for
 * `.launch(`): **65 call sites, no shared helper.** Grouped by what they pass
 * and what they do around it:
 *
 *   60  bare `launch()`          — no options at all
 *    4  `launch({ args })`       — font-hinting / GPU flags (probes + design-runs)
 *    1  `launch({ headless })`
 *
 *   51  close in a `finally`
 *    9  close on the straight line after the body (leaks on any throw)
 *    4  never close in that scope (browser handed to a caller)
 *    1  `return chromium.launch()` (the `CaptureBackend` factory)
 *
 * Three separate changes had to work around the absence of a choke point:
 *
 *   1. Missing-browser diagnosis got bolted onto `handleCliError` instead of
 *      onto the launch, so only the CLI ever gets it — a library caller of
 *      `runIntegrityCheck` sees a raw Playwright stack.
 *   2. `--timeout` / `--wait-until` / `--har` were threaded through 20 gates and
 *      got a shared *navigation* helper (`page-open.ts`); the launch did not.
 *   3. Every site repeats its own `try { … } finally { await browser.close() }`,
 *      and the 9 that forgot the `finally` leak a Chromium process whenever the
 *      measurement throws.
 *
 * Two entry points, because the sites genuinely come in two shapes:
 *
 *   - `withBrowser(fn)` for the 51 scoped sites — close is guaranteed, and a
 *     thrown callback can no longer leak.
 *   - `launchBrowser()` for the 5 sites that hand the browser to someone else
 *     (`CaptureBackend.launch`, `createBrowser()` in css-challenge-core, the
 *     nullable `fileSources ? null : launch()` in diff-pr). They get the
 *     diagnosis; they keep owning the close, because there is no scope to close
 *     at.
 *
 * Deliberately NOT in the `@mizchi/vlmkit-core` barrel: this module imports
 * Playwright at module load, same as `element-compare.ts` and `mask.ts`. Deep
 * import it (`@mizchi/vlmkit-core/browser-launch.ts`).
 */
import { chromium, firefox, webkit, type Browser, type BrowserType, type LaunchOptions } from "playwright";
import { formatMissingPlaywrightBrowserError } from "./cli-error.ts";

export type BrowserEngine = "chromium" | "firefox" | "webkit";

/**
 * Engine name → Playwright browser type.
 *
 * Only `stress/cross-browser.ts` needs more than Chromium (it had its own
 * `ENGINE_BY_NAME` table); the other 64 sites are Chromium-only, which is why
 * `engine` defaults to `"chromium"` rather than being required.
 */
export const BROWSER_ENGINES: Record<BrowserEngine, BrowserType> = { chromium, firefox, webkit };

export const ALL_BROWSER_ENGINES: readonly BrowserEngine[] = ["chromium", "firefox", "webkit"];

/**
 * A launch that failed for a reason we can explain.
 *
 * `message` is the *finished* operator-facing text, "error: " prefix and all —
 * `handleCliError` writes it verbatim so the CLI output is byte-identical to
 * what it printed when the same diagnosis lived only in the error handler.
 * `cause` keeps the original Playwright error for anyone who wants the stack.
 */
export class BrowserLaunchError extends Error {
  override readonly name = "BrowserLaunchError";
  constructor(message: string, options?: { cause?: unknown }) {
    super(message, options);
  }
}

export interface LaunchBrowserOptions {
  /** Defaults to `"chromium"`. */
  engine?: BrowserEngine;
  /**
   * Passed to `browserType.launch()` verbatim. The 4 sites that pass `args`
   * (font-hinting determinism, headless GPU) depend on this being untouched —
   * dropping an arg silently changes what gets rendered.
   */
  launch?: LaunchOptions;
  /**
   * Extra diagnosis tried *before* the built-in missing-browser one, for the
   * failure modes a single package cannot know about. The css-challenge and
   * migration entry points pass the Codex/macOS sandbox detector that lives in
   * `@mizchi/vlmkit-capture` — core cannot import it (capture depends on core),
   * so it arrives as a hook instead of a second copy.
   *
   * Return the finished message, or `null` to decline.
   */
  diagnose?: (error: unknown) => string | null;
}

/**
 * Turn a launch failure into something an operator can act on, or leave it
 * exactly as it was.
 *
 * Rethrowing the original untouched when nothing recognizes it is the point:
 * `handleCliError` still has branches for navigation failures, timeouts and the
 * raw missing-browser shape, and wrapping every error would have routed them
 * all into the generic `console.error(e)` fallthrough.
 */
function diagnoseLaunchFailure(error: unknown, options: LaunchBrowserOptions): unknown {
  const extra = options.diagnose?.(error);
  if (extra) return new BrowserLaunchError(extra, { cause: error });
  // Every engine, not just chromium. `formatMissingPlaywrightBrowserError` reads
  // the engine off the executable path Playwright printed
  // (`firefox-1490/`, `webkit-2247/`, `chromium_headless_shell-1228/`), so a
  // missing Firefox names `cli.js install firefox` — covered by
  // `cli-error.test.ts`'s "asks for the engine that actually failed". It used to
  // hard-code chromium, which is why gating this to chromium was once right.
  const missing = formatMissingPlaywrightBrowserError(error);
  if (missing) return new BrowserLaunchError(missing, { cause: error });
  return error;
}

/**
 * Launch a browser and hand it to the caller, who owns closing it.
 *
 * Prefer `withBrowser` — this exists for the handful of sites that cannot have
 * a scope (a factory that returns a Browser, a browser owned by a session).
 */
export async function launchBrowser(options: LaunchBrowserOptions = {}): Promise<Browser> {
  const engine = BROWSER_ENGINES[options.engine ?? "chromium"];
  try {
    return instrumentNavigation(await engine.launch(options.launch));
  } catch (error) {
    throw diagnoseLaunchFailure(error, options);
  }
}

/** How many still-pending requests to name in a timeout. Enough to see a pattern, not a log dump. */
const NAMED_PENDING_REQUESTS = 3;

/**
 * Make every page this browser opens explain its own navigation timeouts.
 *
 * Done at the launch rather than at the navigation because there are **42
 * `.goto(` call sites across 20 files**, three of which hand-roll the same
 * `{ waitUntil: options.waitUntil ?? "networkidle", timeout: options.timeout ?? 30000 }`
 * — so a fix applied to `navigatePage` reaches one of them and looks finished.
 * Wrapping `newPage` here is the only edit that covers all 42.
 *
 * The whole failure used to be one line — `error: page load timed out (Timeout
 * 30000ms exceeded)` — and two dogfood agents working on separate tasks
 * independently called it the worst thing they hit:
 *
 *   "It doesn't say the default wait state is `networkidle`, doesn't say
 *    `--wait-until` exists, doesn't say a request is still open, doesn't name it.
 *    The tool *knows* the milestone it was waiting on and that `/api/live` is in
 *    flight."
 *
 *   "Dead end as guidance, useful as evidence. Reproduced the reported symptom;
 *    told me nothing about how to proceed."
 *
 * It is #112's item 1 restated: "the timeout error reads like the tool can't
 * handle the page rather than like a hint to change approach". Everything needed
 * is present at the moment of failure; it just was not said.
 */
function instrumentNavigation(browser: Browser): Browser {
  // A test double or a custom backend need not implement `newPage`, and the
  // diagnosis is not worth turning a missing optional method into a TypeError at
  // launch — the caller loses a browser either way.
  if (typeof browser?.newPage !== "function") return browser;
  const originalNewPage = browser.newPage.bind(browser);
  browser.newPage = async (...args: Parameters<Browser["newPage"]>) => {
    const page = await originalNewPage(...args);
    const inflight = new Map<string, number>();
    page.on("request", (r) => inflight.set(r.url(), Date.now()));
    page.on("requestfinished", (r) => inflight.delete(r.url()));
    page.on("requestfailed", (r) => inflight.delete(r.url()));
    const originalGoto = page.goto.bind(page);
    page.goto = async (url, gotoOptions) => {
      try {
        return await originalGoto(url, gotoOptions);
      } catch (error) {
        throw explainNavigationTimeout(error, gotoOptions, inflight);
      }
    };
    return page;
  };
  return browser;
}

/**
 * Restate a navigation timeout as the three things the caller needs: which
 * milestone was waited on, what was still open, and which flag ends the wait.
 *
 * Any other error passes through untouched — `cli-error.ts` already has branches
 * for a refused connection, an unresolvable host and a blocked port, and this
 * must not shadow them.
 */
function explainNavigationTimeout(
  error: unknown,
  gotoOptions: { waitUntil?: string; timeout?: number } | undefined,
  inflight: ReadonlyMap<string, number>,
): unknown {
  const message = error instanceof Error ? error.message : String(error);
  if (!/Timeout \d+ms exceeded/i.test(message)) return error;

  // Playwright's own defaults, named so the message can state what it waited on
  // even when the call site passed nothing.
  const waitUntil = gotoOptions?.waitUntil ?? "load";
  const timeout = gotoOptions?.timeout ?? Number(message.match(/Timeout (\d+)ms/i)?.[1] ?? 30_000);

  const now = Date.now();
  const pending = [...inflight.entries()]
    .sort((a, b) => a[1] - b[1])
    .map(([requestUrl, at]) => `${requestUrl} (open ${((now - at) / 1000).toFixed(1)}s)`);

  const lines = [`page load timed out after ${timeout}ms waiting for \`${waitUntil}\``];
  if (pending.length > 0) {
    // The pending list is the evidence that the page itself is fine: a held-open
    // stream is not a page that failed to render.
    lines.push(
      `  ${pending.length} request(s) still open:`,
      ...pending.slice(0, NAMED_PENDING_REQUESTS).map((p) => `    ${p}`),
      ...(pending.length > NAMED_PENDING_REQUESTS ? [`    and ${pending.length - NAMED_PENDING_REQUESTS} more`] : []),
    );
  }
  if (waitUntil === "networkidle") {
    // Only worth saying when `networkidle` is what is being waited on: it is the
    // one milestone a single long-lived connection blocks forever, and it is the
    // default every gate uses, so this is the common case.
    lines.push(
      "  The page may have rendered long before this — `networkidle` needs every connection to close,",
      "  which a stream or a poll never does. Try `--wait-until load` (or `domcontentloaded`),",
      "  or pin the network with `--har <file>`. Raising `--timeout` will not help an endpoint that never closes.",
    );
  } else {
    lines.push("  Raise `--timeout <ms>`, or relax `--wait-until` further.");
  }
  const explained = new Error(lines.join("\n"));
  explained.cause = error;
  return explained;
}

/**
 * Launch a browser, run `fn`, and close the browser whether `fn` throws or not.
 *
 * The `finally` is deliberately not `.catch(() => {})`-guarded: the 51 sites
 * this replaces all wrote `finally { await browser.close(); }`, so a close
 * failure masking a body failure is pre-existing behaviour, not something this
 * refactor gets to change.
 */
export async function withBrowser<T>(
  fn: (browser: Browser) => Promise<T>,
  options: LaunchBrowserOptions = {},
): Promise<T> {
  const browser = await launchBrowser(options);
  try {
    return await fn(browser);
  } finally {
    await browser.close();
  }
}
