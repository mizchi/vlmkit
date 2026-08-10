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
  // Chromium only, and not out of caution: `formatMissingPlaywrightBrowserError`
  // hard-codes `install chromium` in the command it prints (cli-error.ts:58), so
  // on a missing Firefox it would tell the operator to install the wrong browser.
  // Extending that message per engine is a change to the message, which this
  // refactor deliberately does not make.
  if ((options.engine ?? "chromium") === "chromium") {
    const missing = formatMissingPlaywrightBrowserError(error);
    if (missing) return new BrowserLaunchError(missing, { cause: error });
  }
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
    return await engine.launch(options.launch);
  } catch (error) {
    throw diagnoseLaunchFailure(error, options);
  }
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
