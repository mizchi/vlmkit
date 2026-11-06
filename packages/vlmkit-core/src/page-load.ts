/**
 * The three page-load knobs every URL-capable gate needs, declared once.
 *
 * Why this module exists — measured 2026-08-10 against a React + MapLibre dev
 * server (issue #112). The page finished `domcontentloaded` at ~480ms and
 * rendered correctly, but one third-party request stayed in flight forever, so
 * every gate that hardcoded `goto(url, { waitUntil: "networkidle", timeout:
 * 30000 })` died with:
 *
 *     error: page load timed out (Timeout 30000ms exceeded)
 *
 * `check integrity` and `check design` could be told otherwise
 * (`--wait-until domcontentloaded`, `--timeout`, `--har`); the other 19
 * URL-accepting gates could not, so the only way to gate that app was to
 * hand-roll a Playwright harness that route-mocked the external hosts and
 * serialized the DOM to static HTML — lossy for canvas content, and something
 * every consumer with a data-driven SPA would have to reinvent.
 *
 * Three things live here, deliberately together rather than in three layers:
 *
 *   - `PAGE_LOAD_INPUTS` — the declarative `inputs` fragment a gate spreads,
 *     so `--help` and the MCP schema get the flags from the same source.
 *   - `parsePageLoad` — the argv reader a gate's `parse` spreads.
 *   - `navigatePage` / `applyHar` — the code that actually honours the values.
 *
 * Keeping the declaration next to the honouring is the whole point. The
 * alternative was 19 hand-written copies of the same three `inputs` entries and
 * the same three `readFlag` lines, which is how a flag ends up declared on a
 * gate that drops it on the floor. A test (`page-load.test.ts`) walks the live
 * registry and asserts the flags come from this fragment rather than from a
 * local copy.
 *
 * What is deliberately NOT here: the decision about *which* gates get the
 * flags. A gate that cannot honour one of them must not declare it — see
 * `check perf` (no `--har`: replaying responses off local disk would turn the
 * TTFB/LCP/FCP numbers the gate exists to report into disk-read times) and
 * `check drift component` (never navigates at all).
 */

import type { Page } from "playwright";
import { readChoice, readFlag, readInt } from "./arg-reader.ts";
import type { GateInput } from "./plugin/contract.ts";
import { applyHar, settlePage } from "./page-open.ts";

export { applyHar };

/** The navigation milestones a gate exposes. Playwright's `commit` is not one of
 *  them: no gate can read a document that has not parsed. */
export const PAGE_LOAD_WAIT_UNTIL = ["domcontentloaded", "load", "networkidle"] as const;

export type PageLoadWaitUntil = (typeof PAGE_LOAD_WAIT_UNTIL)[number];

/** Playwright's own default, restated so callers can name it. */
export const DEFAULT_PAGE_LOAD_TIMEOUT_MS = 30_000;

/** The default milestone every gate has always used. */
export const DEFAULT_PAGE_LOAD_WAIT_UNTIL: PageLoadWaitUntil = "networkidle";

/**
 * What a gate carries from argv down to its `page.goto`.
 *
 * Structurally a subset of `OpenPageOptions`, so a measurement module that
 * loads through `openSource` can forward this object as-is.
 */
export interface PageLoadOptions {
  /** Navigation milestone. Defaults to `networkidle`. */
  waitUntil?: PageLoadWaitUntil;
  /** Navigation timeout in milliseconds. Defaults to 30000. */
  timeout?: number;
  /** Replay network responses from a Playwright HAR. See `applyHar`. */
  har?: string;
  /**
   * `prefers-color-scheme` to emulate. Not one of the three load knobs: it is declared by
   * `COLOR_SCHEME_INPUT`, only on gates that honour it, and carried here so `pickPageLoad`
   * hands it to `openSource` with the rest.
   */
  colorScheme?: ColorScheme;
}

/** The schemes a gate can be asked to judge a page in. */
export const COLOR_SCHEMES = ["light", "dark"] as const;
export type ColorScheme = (typeof COLOR_SCHEMES)[number];

/**
 * `inputs` fragment. Spread at the END of a gate's `inputs` array so the
 * gate-specific flags stay first in `--help`.
 */
export const PAGE_LOAD_INPUTS: readonly GateInput[] = [
  {
    name: "timeout",
    placeholder: "ms",
    kind: "number",
    description: "Page navigation timeout",
    defaultDescription: String(DEFAULT_PAGE_LOAD_TIMEOUT_MS),
  },
  {
    name: "wait-until",
    kind: "string",
    description: "Navigation wait state (domcontentloaded for an SPA that never reaches network idle)",
    choices: PAGE_LOAD_WAIT_UNTIL,
    defaultDescription: DEFAULT_PAGE_LOAD_WAIT_UNTIL,
  },
  {
    name: "har",
    placeholder: "file",
    kind: "path",
    description: "Replay network responses from a Playwright HAR (requests absent from it are aborted)",
  },
];

/**
 * `--color-scheme light|dark`, for a gate whose judgement reads paint (contrast, invisible
 * text, palette). Kept apart from `PAGE_LOAD_INPUTS` on purpose: a gate that declares it must
 * honour it (`applyColorScheme` before its navigation, or `pickPageLoad` into `openSource`),
 * and most load-honouring gates have no reason to.
 *
 * Why it exists: no paint-reading gate emulated `prefers-color-scheme`, so a page that follows
 * the OS theme had its dark theme judged by eye only (the demo sites took `?theme=dark` instead).
 */
export const COLOR_SCHEME_INPUT: GateInput = {
  name: "color-scheme",
  kind: "string",
  description: "Emulate prefers-color-scheme while judging (a page that follows the OS theme)",
  choices: COLOR_SCHEMES,
  defaultDescription: "light",
};

/** Read `--color-scheme`; absent gives an absent key. */
export function parseColorScheme(argv: readonly string[]): { colorScheme?: ColorScheme } {
  const colorScheme = readChoice(argv, "color-scheme", COLOR_SCHEMES);
  return colorScheme ? { colorScheme } : {};
}

/** Emulate the scheme on a page before it navigates, so its first style already matches. */
export async function applyColorScheme(page: Page, colorScheme: ColorScheme | undefined): Promise<void> {
  if (colorScheme) await page.emulateMedia({ colorScheme });
}

/** The flag spellings, for `readPositionals` value-flag lists. */
export const PAGE_LOAD_VALUE_FLAGS: readonly string[] = ["--timeout", "--wait-until", "--har"];

/** `--color-scheme`'s spelling, for the value-flag lists of the gates that declare it. */
export const COLOR_SCHEME_VALUE_FLAGS: readonly string[] = ["--color-scheme"];

/**
 * Read the three flags off argv. Absent flags produce absent keys, so spreading
 * the result never overwrites a gate's own default with `undefined`.
 */
export function parsePageLoad(argv: readonly string[]): PageLoadOptions {
  const timeout = readInt(argv, "timeout", { min: 1 });
  const waitUntil = readChoice(argv, "wait-until", PAGE_LOAD_WAIT_UNTIL);
  const har = readFlag(argv, "har");
  return {
    ...(timeout !== undefined ? { timeout } : {}),
    ...(waitUntil ? { waitUntil } : {}),
    ...(har ? { har } : {}),
  };
}

/**
 * Narrow a wider options object down to these three keys, plus `colorScheme` when set.
 *
 * For measurement modules that load through `openSource`: spreading the whole
 * gate options object into it would also hand over `outputDir`, `reportPath` and
 * friends, and `OpenPageOptions` is not an index type, so the extra keys would
 * pass silently today and collide the day one of those names is reused.
 */
export function pickPageLoad(options: PageLoadOptions): PageLoadOptions {
  return {
    ...(options.waitUntil ? { waitUntil: options.waitUntil } : {}),
    ...(options.timeout !== undefined ? { timeout: options.timeout } : {}),
    ...(options.har ? { har: options.har } : {}),
    ...(options.colorScheme ? { colorScheme: options.colorScheme } : {}),
  };
}

/**
 * The `goto` / `setContent` option object, with the call site's own historical
 * default preserved.
 *
 * `defaultWaitUntil` exists because the gates did not all start from
 * `networkidle`: `check interactions`, `scan handlers` and `verify flow` navigate
 * at `load` and then call `settlePage`, which is why those three already survive
 * a page that never reaches network idle. Passing a single global default here
 * would have silently *broken* them while fixing the others.
 */
export function navigationOptions(
  options: PageLoadOptions = {},
  defaultWaitUntil: PageLoadWaitUntil = DEFAULT_PAGE_LOAD_WAIT_UNTIL,
): { waitUntil: PageLoadWaitUntil; timeout: number } {
  return {
    waitUntil: options.waitUntil ?? defaultWaitUntil,
    timeout: options.timeout ?? DEFAULT_PAGE_LOAD_TIMEOUT_MS,
  };
}

/**
 * Navigate honouring all three options — the call site that replaces a
 * hardcoded `page.goto(url, { waitUntil: "networkidle", timeout: 30000 })`.
 *
 * The settle is conditional on purpose. With no flags passed this is
 * byte-for-byte the old behaviour, so adopting the helper changes no timings.
 * When the caller *relaxes* the milestone below the call site's own default it
 * settles as well (`settlePage`: bounded 5s network-idle wait, webfonts, one
 * quiet frame), because otherwise `--wait-until domcontentloaded` would hand a
 * gate the pre-render DOM and the gate would report the placeholder as a defect
 * — the failure mode `settle-consistency.test.ts` exists to pin. For the #112
 * SPA that reproduces the hand-rolled harness's behaviour: parse, wait as long
 * as is bounded, then measure the rendered page instead of timing out.
 *
 * Call sites that settle unconditionally already (the `load` three) should call
 * `navigationOptions(options, "load")` + their own `settlePage` instead, so the
 * settle is not done twice.
 */
export async function navigatePage(page: Page, url: string, options: PageLoadOptions = {}): Promise<void> {
  await applyHar(page, options.har);
  await page.goto(url, navigationOptions(options));
  if (options.waitUntil && options.waitUntil !== DEFAULT_PAGE_LOAD_WAIT_UNTIL) {
    await settlePage(page, 0);
  }
}
