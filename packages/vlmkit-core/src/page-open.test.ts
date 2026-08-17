import assert from "node:assert/strict";
import { afterAll, describe, it } from "vitest";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import type { Browser } from "playwright";
import { isUrlSource, openHtml, openSource, resolveSource, sourceToUrl } from "./page-open.ts";
import { launchBrowser } from "./browser-launch.ts";

describe("isUrlSource / sourceToUrl", () => {
  it("distinguishes URLs from paths", () => {
    assert.equal(isUrlSource("https://example.com/"), true);
    assert.equal(isUrlSource("http://localhost:3000"), true);
    assert.equal(isUrlSource("routes/index.html"), false);
    assert.equal(isUrlSource("/abs/index.html"), false);
  });

  it("counts file:// as a URL, because resolve() destroys one", () => {
    // This said `https?` only, and a `file://` source therefore took the path branch:
    //   vlmkit check a11y contrast "file:///repo/fixtures/page.html"
    //   error: file not found: /repo/file:/repo/fixtures/page.html
    // Every gate that loads through `openSource` carried it. Eight modules had already
    // hand-rolled `/^(https?|file):\/\//` for themselves and were right.
    assert.equal(isUrlSource("file:///abs/page.html"), true);
    assert.equal(sourceToUrl("file:///abs/page.html"), "file:///abs/page.html");
    // The whole point: idempotent. A source that is already a file URL must survive a
    // second trip through the normalizer unchanged.
    assert.equal(sourceToUrl(sourceToUrl("page.html")), sourceToUrl("page.html"));
    assert.equal(resolveSource("file:///abs/page.html"), "file:///abs/page.html");
  });

  it("still treats a scheme-less path as a path", () => {
    // A Windows drive letter is not a URL, and neither is anything else without `//`.
    assert.equal(isUrlSource("C:\\pages\\index.html"), false);
    assert.equal(isUrlSource("data:text/html,<p>x"), false);
    assert.equal(isUrlSource("file-picker.html"), false, "a filename starting with `file` is a filename");
  });

  it("turns a path into a file URL and leaves a URL alone", () => {
    assert.equal(sourceToUrl("https://example.com/a"), "https://example.com/a");
    assert.equal(sourceToUrl("page.html"), pathToFileURL(resolve("page.html")).href);
  });
});

describe("openSource / openHtml (real browser)", () => {
  const dir = mkdtempSync(join(tmpdir(), "page-open-"));
  writeFileSync(join(dir, "style.css"), "body { background: rgb(1, 2, 3); } p { color: rgb(4, 5, 6); }");
  writeFileSync(
    join(dir, "page.html"),
    '<!doctype html><meta charset="utf-8"><link rel="stylesheet" href="style.css"><body><p>hello</p></body>',
  );
  const page = join(dir, "page.html");
  let browser: Browser | undefined;
  const getBrowser = async (): Promise<Browser> => {
    if (!browser) {
      browser = await launchBrowser();
    }
    return browser;
  };
  afterAll(async () => {
    await browser?.close();
  });

  const colorOf = async (p: import("playwright").Page) =>
    p.evaluate(() => getComputedStyle(document.querySelector("p")!).color);

  it("resolves a relative stylesheet when navigating to the file", async () => {
    const { page: opened, redirect } = await openSource(await getBrowser(), page, { viewport: { width: 800, height: 600 } });
    assert.equal(await colorOf(opened), "rgb(4, 5, 6)");
    assert.equal(redirect, null);
    await opened.close();
  });

  it("resolves it for mutated HTML too, given the source it came from", async () => {
    const { readFile } = await import("node:fs/promises");
    const html = (await readFile(page, "utf-8")).replace("hello", "HELLO WORLD");
    const opened = await openHtml(await getBrowser(), html, { baseSource: page });
    assert.equal(await colorOf(opened), "rgb(4, 5, 6)");
    assert.match(await opened.textContent("p") ?? "", /HELLO WORLD/);
    await opened.close();
  });

  it("demonstrates the defect this exists to fix: no base, no stylesheet", async () => {
    const { readFile } = await import("node:fs/promises");
    const html = await readFile(page, "utf-8");
    const opened = await openHtml(await getBrowser(), html); // baseSource omitted
    assert.equal(await colorOf(opened), "rgb(0, 0, 0)", "unstyled — this is what the gates were measuring");
    await opened.close();
  });
});

/**
 * The fourth part of the settle: entrance animations.
 *
 * Added because `check integrity` reported a contrast failure at 4.12:1 on a card whose colour
 * is 5.8:1 — it had measured the card at `opacity: 0.2` mid-flight through a 960ms deal
 * animation, and reported it as a defect in the page, with a selector.
 */
describe("settlePage waits for finite animations", () => {
  const dir = mkdtempSync(join(tmpdir(), "settle-anim-"));
  let browser: Browser | undefined;
  const getBrowser = async (): Promise<Browser> => (browser ??= await launchBrowser());
  afterAll(async () => { await browser?.close(); });

  /** A page whose text fades from transparent to opaque over `ms`, with an optional spinner. */
  const animatedPage = (name: string, ms: number, infinite = false): string => {
    const file = join(dir, name);
    writeFileSync(file, `<!doctype html><meta charset="utf-8"><style>
      @keyframes fade { from { opacity: 0.05 } to { opacity: 1 } }
      @keyframes spin { from { transform: rotate(0) } to { transform: rotate(360deg) } }
      p { animation: fade ${ms}ms linear forwards; }
      ${infinite ? ".spinner { animation: spin 400ms linear infinite; }" : ""}
    </style><body><p>hello</p>${infinite ? '<div class="spinner">x</div>' : ""}</body>`);
    return file;
  };

  const opacityOf = async (p: import("playwright").Page) =>
    Number.parseFloat(await p.evaluate(() => getComputedStyle(document.querySelector("p")!).opacity));

  it("measures the settled opacity, not a mid-flight frame", async () => {
    // Without the animation wait, `openSource` returns while the text is still near-transparent
    // and every colour read is of a composite that exists for 600ms.
    const { page } = await openSource(await getBrowser(), animatedPage("fade.html", 600), {
      viewport: { width: 400, height: 300 },
      settleMs: 0,
    });
    assert.equal(await opacityOf(page), 1, "the fade has finished");
    await page.close();
  });

  it("does not hang on an infinite animation, and still waits for the finite one", async () => {
    // The property that makes this safe in the shared settle: a spinner never finishes. If it
    // were awaited, every gate would hang on every page with one — so this must return, and it
    // must still have waited for the fade.
    const started = Date.now();
    const { page } = await openSource(await getBrowser(), animatedPage("spinner.html", 500, true), {
      viewport: { width: 400, height: 300 },
      settleMs: 0,
    });
    const elapsed = Date.now() - started;
    assert.equal(await opacityOf(page), 1, "the finite fade was awaited");
    assert.ok(elapsed < 8000, `returned in ${elapsed}ms rather than hanging on the spinner`);
    await page.close();
  });

  it("gives up at the cap rather than stalling a run on a long intro", async () => {
    // A 30s intro is not worth a run. `settlePage` is called directly here because `openSource`
    // does not expose the cap — the point is that the cap is honoured, not how it is plumbed.
    const { page } = await openSource(await getBrowser(), animatedPage("slow.html", 30_000), {
      viewport: { width: 400, height: 300 },
      settleMs: 0,
      animationCapMs: 300,
    });
    const opacity = await opacityOf(page);
    assert.ok(opacity < 1, `measured mid-animation at the cap (opacity ${opacity}), as intended`);
    await page.close();
  });
});
