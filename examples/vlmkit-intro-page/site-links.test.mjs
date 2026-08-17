/**
 * The live route between the two published pages, in a real browser.
 *
 * Separate from `page.test.mjs` so that file stays BROWSER-FREE, which is load-bearing:
 * `skill-package.yml` runs it on any change under `.claude/skills/**` — the intro page lists all
 * 13 specialised skills, so a skills change can break it — and that job installs neither pnpm
 * dependencies nor Playwright. Putting a `chromium.launch()` in `page.test.mjs` made it unrunnable
 * in one of the two workflows that run it, which is how CI found this.
 *
 * The static half of the same subject — the arrow nested beside the translated span, and the
 * mobile collapse hiding only the scroll-spy anchors — stays in `page.test.mjs`, where it costs
 * nothing. What needs a browser is only what cannot be read off the source: whether the link is
 * actually tappable at each width, whether the locale toggle destroys it, and whether clicking it
 * arrives.
 */
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterAll, beforeAll, describe, it } from "vitest";
import { chromium } from "playwright";

const exampleDir = dirname(fileURLToPath(import.meta.url));
const PORT = 4293;
const BASE = `http://127.0.0.1:${PORT}`;

let server;
let browser;

beforeAll(async () => {
  server = spawn(process.execPath, [join(exampleDir, "server.mjs")], {
    env: { ...process.env, PORT: String(PORT) },
    stdio: "ignore",
  });
  for (let attempt = 0; attempt < 60; attempt++) {
    try { await fetch(`${BASE}/`); break; } catch { await new Promise((r) => setTimeout(r, 100)); }
  }
  browser = await chromium.launch();
}, 120_000);

afterAll(async () => {
  await browser?.close();
  server?.kill();
});

describe("the route to the playable demo", () => {
  it("is tappable at every width, including where the nav collapses", async () => {
    const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
    await page.goto(`${BASE}/?lang=en&theme=light`, { waitUntil: "networkidle" });

    for (const width of [1280, 900, 768, 375, 320]) {
      await page.setViewportSize({ width, height: 820 });
      const box = await page.locator(".nav-demo").boundingBox();
      // 44px is WCAG 2.5.5's AAA target size, which the header meets everywhere else.
      assert.ok(box && box.width > 0 && box.height >= 44, `not tappable at ${width}px`);
      assert.equal(
        await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth),
        0,
        `the header overflows at ${width}px`,
      );
    }
    await page.close();
  });

  it("keeps its arrow through a locale round trip", async () => {
    const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
    await page.goto(`${BASE}/?lang=en&theme=light`, { waitUntil: "networkidle" });

    assert.match(await page.locator(".nav-demo").textContent(), /Playable demo\s*→/);
    await page.locator("[data-locale-toggle]").click();
    assert.match(await page.locator(".nav-demo").textContent(), /遊べるデモ\s*→/, "the arrow did not survive ja");
    await page.locator("[data-locale-toggle]").click();
    assert.match(await page.locator(".nav-demo").textContent(), /Playable demo\s*→/, "the arrow did not survive the round trip");
    await page.close();
  });

  it("goes there, and the demo comes back", async () => {
    const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
    await page.goto(`${BASE}/?lang=en&theme=light`, { waitUntil: "networkidle" });

    await page.locator(".nav-demo").click();
    await page.waitForLoadState("load");
    assert.match(page.url(), /\/solitaire\/$/);
    assert.match(await page.title(), /Klondike Solitaire/);

    await page.locator(".site-link").click();
    await page.waitForLoadState("load");
    assert.match(await page.title(), /vlmkit — VLM-assisted UI verification/);
    await page.close();
  });
});
