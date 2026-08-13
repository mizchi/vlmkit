/**
 * `@mizchi/vlmkit-core/plugin/browser` — the browser-bound half of the plugin API.
 *
 * Separate from `./index.ts` on measurement, not taste. The main entry loads in
 * ~25ms; adding `browser-launch` to it costs ~441ms — 17x — because that module
 * pulls the capture chain even though Playwright itself stays lazy. A plugin that
 * only reads a file (the `house-gates.ts` example) would pay it for nothing.
 *
 * So the split mirrors the one `@mizchi/vlmkit-markup/rules` declares: the
 * deterministic surface costs nothing, and driving a browser is opt-in.
 *
 * ```ts
 * import { defineGate, firstPositional } from "@mizchi/vlmkit-core/plugin";
 * import { withBrowser, openSource } from "@mizchi/vlmkit-core/plugin/browser";
 *
 * run: async (options) => withBrowser(async (browser) => {
 *   const { page } = await openSource(browser, options.source, { viewport });
 *   const samples = await page.evaluate(MY_COLLECT_SCRIPT);
 *   await page.close();
 *   return judge(samples);            // pure, and testable without any of this
 * }),
 * ```
 *
 * Two reasons to use these rather than launching Playwright yourself:
 *
 *   - **`withBrowser` closes the browser on a throw.** A gate that leaks one
 *     leaks it per page in a `gates run`, and the failure surfaces later as a
 *     machine out of memory rather than as the gate's bug.
 *   - **`openSource` takes a path OR a url**, and loads a file through a real
 *     `file://` navigation rather than `setContent`. `setContent` drops the
 *     document's base URL, so relative stylesheets and images silently do not
 *     load — a gate built on it measures an unstyled page and reports findings
 *     that vanish when a human opens the same file.
 *
 * Keep the judging out of the callback. Everything a gate concludes should be a
 * pure function of what it collected, which is what lets a project test its own
 * rule without a browser at all.
 */

export { launchBrowser, withBrowser } from "../browser-launch.ts";
export { applyHar, openSource } from "../page-open.ts";
export type { HarReplay } from "../page-open.ts";
export { withAuthState } from "../auth-state.ts";
export { describeRedirect } from "../navigation-redirect.ts";

/**
 * The append-only run record.
 *
 * A gate declares `ledger` on its definition and the runner does the write, so
 * most plugins never call this. It is here for a gate whose measurement wants to
 * record something mid-run, and for a tool wrapping the gates rather than being
 * one. `--ledger <path>` / `--no-ledger` and the run-level settings apply either
 * way: the settings live on this module, not on the runner, because 14 of the 16
 * call sites append from inside measurement functions.
 */
export { appendRunLedger, configureRunLedger, firstLedgerWrite } from "../run-ledger.ts";
export type { LedgerWrite, RunLedgerEntry } from "../run-ledger.ts";
