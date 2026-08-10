import assert from "node:assert/strict";
import { after, describe, it } from "node:test";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import type { Browser } from "playwright";
import { isUrlSource, openHtml, openSource, sourceToUrl } from "./page-open.ts";
import { launchBrowser } from "./browser-launch.ts";

describe("isUrlSource / sourceToUrl", () => {
  it("distinguishes URLs from paths", () => {
    assert.equal(isUrlSource("https://example.com/"), true);
    assert.equal(isUrlSource("http://localhost:3000"), true);
    assert.equal(isUrlSource("routes/index.html"), false);
    assert.equal(isUrlSource("/abs/index.html"), false);
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
  after(async () => {
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
