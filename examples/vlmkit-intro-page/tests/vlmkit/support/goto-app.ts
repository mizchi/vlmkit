import type { Page } from "@playwright/test";

export async function gotoApp(page: Page) {
  const baseUrl = process.env.VLMKIT_MARKUP_BASE_URL
    ?? process.env.PLAYWRIGHT_BASE_URL
    ?? "http://127.0.0.1:4190";
  await page.goto(baseUrl);
}
