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
 * `setContent` with no base URL.
 *
 * So: load by navigation whenever the bytes on disk are what we want, and when
 * a gate must mutate the HTML first (inflate text for i18n, force a theme,
 * delete a CSS rule), navigate to the source and *then* replace the markup, so
 * the document keeps a base URL its siblings resolve against.
 */
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import type { Browser, Page, ViewportSize } from "playwright";
import { withAuthState } from "./auth-state.ts";
import { describeRedirect } from "./navigation-redirect.ts";

export const isUrlSource = (source: string): boolean => /^https?:\/\//.test(source);

/** File path or URL → a URL Playwright can navigate to. */
export function sourceToUrl(source: string): string {
  return isUrlSource(source) ? source : pathToFileURL(resolve(source)).href;
}

/**
 * Wait for the page to stop moving: bounded network idle, then webfonts, then
 * one frame. Every part is best-effort — a page with a long-poll connection
 * never reaches network idle, and refusing to measure it would be worse than
 * measuring it slightly early.
 */
export async function settlePage(page: Page, settleMs = 250): Promise<void> {
  await page.waitForLoadState("networkidle", { timeout: 5000 }).catch(() => {});
  await page.evaluate(() => (document.fonts ? document.fonts.ready.then(() => undefined) : undefined))
    .catch(() => {});
  if (settleMs > 0) await page.waitForTimeout(settleMs);
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
