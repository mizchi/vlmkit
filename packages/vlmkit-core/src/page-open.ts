/**
 * One way to open the page under test.
 *
 * Two mechanisms had grown up side by side, and they do not measure the same
 * document:
 *
 *   - `page.goto(pathToFileURL(file))` — the document has an origin, so
 *     `<link rel="stylesheet" href="style.css">`, `<img src="hero.png">` and
 *     relative scripts all resolve.
 *   - `page.setContent(await readFile(file))` — the document's base URL is
 *     `about:blank`, so every relative reference silently fails to load.
 *
 * Measured consequence (2026-08-02): a page with `p { color: #bbbbbb }` in an
 * external stylesheet — 1.92:1 on white, a clear WCAG failure — was reported by
 * `check a11y contrast` as **0 failures**, because the gate measured unstyled
 * markup. Inlining the same CSS in a `<style>` block made the same gate report
 * the failure correctly. Ten gates read a user's file and pushed it through
 * `setContent` with no base URL. All ten now navigate; the last two —
 * `check a11y focus` and `check drift component` — went across on 2026-08-10,
 * and they were the worst of the set because both read geometry rather than a
 * style value, so unstyled markup did not degrade the measurement, it inverted
 * it. `fixtures/external-assets/README.md` carries the before/after numbers.
 *
 * So: load by navigation whenever the bytes on disk are what we want, and when
 * a gate must mutate the HTML first (inflate text for i18n, force a theme,
 * delete a CSS rule), navigate to the source and *then* replace the markup, so
 * the document keeps a base URL its siblings resolve against.
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import type { Browser, Page, ViewportSize } from "playwright";
import { withAuthState } from "./auth-state.ts";
import { describeRedirect } from "./navigation-redirect.ts";

/**
 * Is this source already a URL, or is it a path that has to become one?
 *
 * `file:` belongs here and did not use to. This function said `https?` only, so a
 * `file://` source fell into the path branch and `resolve()` mangled it exactly the way
 * the comment on `resolveSource` warns about for `http`:
 *
 *     vlmkit check a11y contrast "file:///repo/fixtures/page.html"
 *     error: file not found: /repo/file:/repo/fixtures/page.html
 *
 * Measured — the same fixture passed as a plain path inspected 31 elements and found 2
 * contrast failures. Everything reaching a page through `openSource` / `sourceToUrl`
 * carried it: `check a11y contrast` / `touch` / `focus`, `check theme`, `stress i18n`,
 * `stress media`, `check tokens`, `check consistency`.
 *
 * It is also the clearest case of the duplication pattern in the repo. Eight modules
 * wrote their own `isUrl` — animation-eval, motion-detect, breakpoint-check, copy-check,
 * integrity-check, scroll-behavior, scroll-scan, media-variants — and all eight spell it
 * `/^(https?|file):\/\//`. They are right and the shared helper they were meant to
 * replace was wrong, which is why the commands that hand-rolled the check kept working
 * (`check story --gallery "file://$PWD/index.html"`, the recipe in CLAUDE.md, is fine)
 * while the ones written the documented way did not.
 *
 * Scoped to these two schemes rather than "anything with a scheme" on purpose: `data:`
 * and `about:` are not sources any caller resolves, and a bare Windows drive letter
 * (`C:\page.html`) must stay a path.
 */
export const isUrlSource = (source: string): boolean => /^(https?|file):\/\//.test(source);

/**
 * Normalize a source for storage and display: an absolute path for a file, the
 * URL untouched for a URL.
 *
 * `resolve()` alone mangles a URL into a path — `resolve("http://x/p.html")`
 * yields `<cwd>/http:/x/p.html`, which then fails as "file not found" and tells
 * the caller nothing about what actually went wrong.
 */
export function resolveSource(source: string): string {
  return isUrlSource(source) ? source : resolve(source);
}

/** File path or URL → a URL Playwright can navigate to. */
export function sourceToUrl(source: string): string {
  return isUrlSource(source) ? source : pathToFileURL(resolve(source)).href;
}

/**
 * Wait for the page to stop moving: bounded network idle, then webfonts, then
 * one frame. Every part is best-effort — a page with a long-poll connection
 * never reaches network idle, and refusing to measure it would be worse than
 * measuring it slightly early.
 *
 * **A gate that navigates and does not call this measures the wrong document.**
 * `load` fires before a client-rendered view paints, and the failure is never
 * reported as "I looked too early" — it is reported as a defect in the page:
 *
 *   - 2026-08-01: `check interactions` said "interactive elements: 0" on a React
 *     page with a button, two links and a scroller. It measured the "Loading…"
 *     placeholder.
 *   - 2026-08-02: `verify flow` failed `count .card expected 2, measured 0` on a
 *     page where `check layout` measured 2 at the same instant, and
 *     `build page` screenshotted a candidate at 5.3% of its settled ink — so
 *     every component came back missing. Both blamed the markup.
 *
 * Playwright *actions* auto-wait, which is why this stayed hidden: a click on a
 * late-rendered element is safe. Reads are not — `page.evaluate`,
 * `page.screenshot` and `getBoundingClientRect` all sample the DOM at that
 * instant.
 *
 * `waitUntil` is not the axis. `goto(load)` followed by this settle waits for
 * network idle anyway, so the 8 `load` and 2 `domcontentloaded` call sites are
 * equivalent to the 71 `networkidle` ones **provided they settle**. The
 * difference that mattered was always the settle, never the load state.
 */
export async function settlePage(page: Page, settleMs = 250): Promise<void> {
  await page.waitForLoadState("networkidle", { timeout: 5000 }).catch(() => {});
  await page.evaluate(() => (document.fonts ? document.fonts.ready.then(() => undefined) : undefined))
    .catch(() => {});
  if (settleMs > 0) await page.waitForTimeout(settleMs);
}

/**
 * Install HAR replay on a page, when the caller asked for it.
 *
 * `notFound: "abort"` rather than Playwright's default `"fallback"`, and that is
 * a real trade the caller has to know about:
 *
 *   - `abort` is what makes `--har` solve the problem it was added for. The hang
 *     in issue #112 was a third-party request that never settles; `fallback`
 *     would let that same request through to the network and the run would hang
 *     exactly as before. `abort` is also what makes a HAR run reproducible
 *     offline, which is the other reason to record one.
 *   - The cost: an *incomplete* HAR turns every un-recorded subresource into a
 *     failed request. On gates that judge resources — `check integrity`'s
 *     `broken-image` / `failed-stylesheet` / `broken-font` rules — that reads as
 *     a defect in the page rather than as a gap in the recording, so HAR
 *     completeness silently becomes part of the verdict. Record with
 *     `browser.newContext({ recordHar: { path } })` over the same navigation the
 *     gate will perform, and treat new findings under `--har` as suspect until
 *     the recording has been refreshed.
 *
 * This was already the behaviour at `check integrity`'s and `check design`'s own
 * goto sites (both hardcoded `notFound: "abort"`); it lives here so the trade is
 * documented once and the gates that have since adopted `--har` cannot disagree
 * about it.
 */
export async function applyHar(page: Page, har?: string): Promise<HarReplay | null> {
  if (!har) return null;
  const path = resolve(har);
  await page.routeFromHAR(path, { notFound: "abort" });
  return trackHarMisses(page, path);
}

/**
 * What the recording contains, and what the run asked for that it did not.
 *
 * The paragraph above documents the cost of `notFound: "abort"` and then offers a
 * human instruction as the mitigation — "treat new findings under `--har` as
 * suspect". v5's CI agent hit it from the outside and named what that costs:
 *
 *   "there is **no staleness signal**: a new endpoint absent from the HAR is
 *    *aborted*, surfacing as a broken-resource **defect** rather than 'your fixture
 *    is out of date'. And the HAR is keyed on the full URL, so it is **port-bound**
 *    — change the port and it silently stops matching."
 *
 * Both are decidable from the file itself, so they do not have to be a caution in a
 * doc comment. A gate that judges resources can ask which failures were fixture
 * misses and blame the recording instead of the page.
 */
export interface HarReplay {
  /** Absolute path of the recording in use. */
  path: string;
  /** Origins the recording actually contains, deduped, in first-seen order. */
  origins: readonly string[];
  /** True when the recording holds no entry for this exact URL. */
  isMiss(url: string): boolean;
  /** URLs requested so far that the recording does not contain, in request order. */
  misses(): readonly string[];
  /**
   * Set when the recording contains nothing for the origin actually being visited —
   * the port-bound failure mode, where every single request misses and the page
   * measures as entirely broken. Null when at least one origin matches.
   */
  originMismatch(pageUrl: string): string | null;
}

function trackHarMisses(page: Page, path: string): HarReplay {
  // Read the recording rather than inferring from failures: "not in the file" is a
  // different claim from "the request failed", and only the first one indicts the
  // fixture. A malformed or unreadable HAR yields an empty set, which makes
  // `isMiss` true for everything — the honest answer, since nothing can be replayed.
  const recorded = new Set<string>();
  const origins: string[] = [];
  try {
    const har = JSON.parse(readFileSync(path, "utf-8")) as { log?: { entries?: { request?: { url?: string } }[] } };
    for (const entry of har.log?.entries ?? []) {
      const url = entry.request?.url;
      if (!url) continue;
      recorded.add(url);
      const origin = originOfUrl(url);
      if (origin && !origins.includes(origin)) origins.push(origin);
    }
  } catch {
    // Left empty on purpose; see above.
  }
  const missed: string[] = [];
  const isMiss = (url: string) => !recorded.has(url);
  // A test double or a non-Playwright page need not implement the event API. The file
  // has already been read by this point, so `isMiss` still answers correctly; only the
  // running list of observed misses goes unpopulated.
  const instrumentable = typeof page?.on === "function" && typeof page?.goto === "function";
  if (!instrumentable) {
    return {
      path,
      origins,
      isMiss,
      misses: () => missed,
      originMismatch: (pageUrl: string) => {
        const target = originOfUrl(pageUrl);
        if (!target || origins.length === 0) return null;
        return origins.includes(target) ? null : target;
      },
    };
  }
  page.on("requestfailed", (request) => {
    const url = request.url();
    if (isMiss(url) && !missed.includes(url)) missed.push(url);
  });

  // The port-bound case is worse than a wrong verdict: the DOCUMENT request misses
  // too, so `page.goto` throws `net::ERR_FAILED` and the caller gets a raw Playwright
  // stack with no mention of the recording. Explained here because this is the only
  // layer that knows both the origins on file and the origin being asked for.
  const originalGoto = page.goto.bind(page);
  page.goto = async (url, gotoOptions) => {
    try {
      return await originalGoto(url, gotoOptions);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      const target = originOfUrl(url);
      if (!/ERR_FAILED/.test(message) || !target || origins.length === 0 || origins.includes(target)) throw error;
      const explained = new Error(
        `the --har recording holds nothing for ${target}, so even the page itself was aborted.\n`
        + `  ${path}\n`
        + `  it recorded: ${origins.join(", ")}\n`
        + `  A HAR is keyed on the full URL, so a different host or port stops matching entirely.`
        + ` Re-record against ${target}, or serve the page on the recorded origin.`,
      );
      explained.cause = error;
      throw explained;
    }
  };

  return {
    path,
    origins,
    isMiss,
    misses: () => missed,
    originMismatch: (pageUrl: string) => {
      const target = originOfUrl(pageUrl);
      if (!target || origins.length === 0) return null;
      return origins.includes(target) ? null : target;
    },
  };
}

function originOfUrl(url: string): string | null {
  try {
    return new URL(url).origin;
  } catch {
    return null;
  }
}

export interface OpenPageOptions {
  viewport?: ViewportSize;
  deviceScaleFactor?: number;
  /** `prefers-color-scheme` for the page's context (theme-parity opens both). */
  colorScheme?: "light" | "dark" | "no-preference";
  /** Playwright storage state for pages behind a login. */
  storageState?: string;
  waitUntil?: "load" | "domcontentloaded" | "networkidle" | "commit";
  timeout?: number;
  /**
   * Replay network responses from a Playwright HAR. Applied before navigation,
   * so the document request itself comes from the recording. See `applyHar` for
   * why un-recorded requests are aborted rather than passed through.
   */
  har?: string;
  /** Extra quiet time after load. 0 skips it. */
  settleMs?: number;
  /** Skip settling entirely (a gate that measures load timing does its own). */
  skipSettle?: boolean;
}

export interface OpenedPage {
  page: Page;
  /**
   * Human-readable note when a URL redirected somewhere meaningful (a login
   * wall), else null. Gates surface this so an auth-walled route cannot come
   * back CLEAN by measuring the login page.
   */
  redirect: string | null;
}

function pageOptions(options: OpenPageOptions) {
  return withAuthState({
    ...(options.viewport ? { viewport: options.viewport } : {}),
    ...(options.deviceScaleFactor !== undefined ? { deviceScaleFactor: options.deviceScaleFactor } : {}),
    ...(options.colorScheme ? { colorScheme: options.colorScheme } : {}),
  }, options.storageState);
}

/**
 * Open a file or URL by navigation, so relative assets resolve.
 */
export async function openSource(
  browser: Browser,
  source: string,
  options: OpenPageOptions = {},
): Promise<OpenedPage> {
  const page = await browser.newPage(pageOptions(options));
  await applyHar(page, options.har);
  await page.goto(sourceToUrl(source), {
    waitUntil: options.waitUntil ?? "networkidle",
    timeout: options.timeout ?? 30000,
  });
  if (!options.skipSettle) await settlePage(page, options.settleMs ?? 250);
  return {
    page,
    redirect: isUrlSource(source) ? describeRedirect(source, page.url()) : null,
  };
}

export interface OpenHtmlOptions extends OpenPageOptions {
  /**
   * The file or URL this HTML came from. The page navigates there first, so the
   * document keeps that base URL and the mutated copy still resolves the
   * stylesheets and images sitting next to the original.
   *
   * Omit only for HTML synthesized from nothing.
   */
  baseSource?: string;
}

/**
 * Open HTML a gate has rewritten in memory (inflated text, forced theme,
 * deleted rule).
 *
 * Prefer `openSource` when the bytes on disk are what should be measured.
 *
 * Navigate-then-replace, because the obvious alternative does not work.
 * Measured on the same one-line fixture (external `style.css` setting
 * `p { color: rgb(4,5,6) }`):
 *
 *   setContent + injected `<base href="file:///dir/">`  ->  rgb(0, 0, 0)
 *   goto(file) then setContent                          ->  rgb(4, 5, 6)
 *
 * A `<base>` cannot rescue it: the `setContent` document has an opaque origin,
 * and Chromium blocks a `file://` subresource from one. Navigating first gives
 * the document a real base URL, and `setContent` replaces the markup without
 * discarding it.
 */
export async function openHtml(
  browser: Browser,
  html: string,
  options: OpenHtmlOptions = {},
): Promise<Page> {
  const page = await browser.newPage(pageOptions(options));
  await applyHar(page, options.har);
  if (options.baseSource) {
    await page.goto(sourceToUrl(options.baseSource), {
      waitUntil: "domcontentloaded",
      timeout: options.timeout ?? 30000,
    });
  }
  await page.setContent(html, {
    waitUntil: options.waitUntil ?? "networkidle",
    timeout: options.timeout ?? 30000,
  });
  if (!options.skipSettle) await settlePage(page, options.settleMs ?? 250);
  return page;
}
