/**
 * Getting a page's pixels: read a PNG, or render HTML in a browser and screenshot it.
 *
 * Split out of `page-compose.ts` for a reason that is not tidiness. That module is a
 * **CLI entry** — it runs `main()` as a side effect of evaluation, guarded by
 * `__VLMKIT_DISPATCHER_LEAF__`, which the dispatcher sets *just before* importing it.
 * `markup-verify.ts` needed these two functions and imported them from there, and
 * `markup-verify.ts` is in `verify.gate.ts`'s static graph. `runCli` composes the gate
 * registry to enumerate its verbs, so **every** invocation of the CLI evaluated
 * `page-compose.ts` with the env var unset, the guard read false, and the dispatcher's
 * later import was an ESM cache hit that ran nothing: `vlmkit build page` printed
 * nothing and exited 0, for any arguments, help included.
 *
 * `runGroupLeaf` already checks the legacy table before the registry to avoid exactly
 * this, and it was not enough — the registry is loaded earlier still, at command
 * registration. The durable fix is for no gate to statically reach a CLI-entry module,
 * which is what this file is for. `src/cli/cli-leaf-help.test.ts` spawns each leaf so
 * the next such import fails a test instead of silently deleting a command.
 *
 * These are IO, so they stay in TypeScript; the arithmetic they feed lives in
 * `page-compose-diff.ts`.
 */
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { PNG } from "pngjs";
import { settlePage } from "@mizchi/vlmkit-core/page-open.ts";

export async function loadPng(path: string): Promise<{ data: Uint8Array; width: number; height: number }> {
  const png = PNG.sync.read(await readFile(path));
  return {
    data: new Uint8Array(png.data.buffer, png.data.byteOffset, png.data.byteLength),
    width: png.width,
    height: png.height,
  };
}

export async function renderHtmlToPng(
  htmlPath: string,
  width: number,
  height: number,
): Promise<{ data: Uint8Array; width: number; height: number; screenshotPath: string }> {
  const { chromium } = await import("playwright");
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage({ viewport: { width, height } });
    await page.goto(pathToFileURL(resolve(htmlPath)).href, { waitUntil: "load" });
    // A screenshot samples the DOM at that instant. Measured 2026-08-02 on a
    // candidate that renders its cards 350ms after `load`: this capture held
    // 5.3% of the settled ink — the "Loading…" placeholder — so every component
    // came back missing and the kickback blamed the markup.
    await settlePage(page);
    // Viewport-only, like `build component`: the target screenshot is bounded
    // by the requested viewport, so a full-page capture of a taller candidate
    // would report below-the-fold content as extra components.
    // animations: "disabled" captures the rest pose (finite animations
    // fast-forwarded to completion, infinite ones at their initial state) —
    // otherwise an entrance animation is caught mid-flight and every fill /
    // IoU downstream reports phantom deltas (S5-r2 finding).
    // CI Chromium intermittently throws "Unable to capture screenshot"
    // (transient Page.captureScreenshot protocol error); one bounded retry
    // absorbs it without masking persistent failures.
    let buffer: Buffer;
    try {
      buffer = await page.screenshot({ fullPage: false, animations: "disabled" });
    } catch {
      await page.waitForTimeout(250);
      buffer = await page.screenshot({ fullPage: false, animations: "disabled" });
    }
    const png = PNG.sync.read(buffer);
    return {
      data: new Uint8Array(png.data.buffer, png.data.byteOffset, png.data.byteLength),
      width: png.width,
      height: png.height,
      screenshotPath: "",
    };
  } finally {
    await browser.close();
  }
}
