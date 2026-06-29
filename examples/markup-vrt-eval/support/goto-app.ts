import type { Page } from "@playwright/test";

export async function gotoApp(page: Page): Promise<void> {
  const variant = process.env.MARKUP_EVAL_VARIANT;
  const suffix = variant ? `?variant=${encodeURIComponent(variant)}` : "";
  await page.goto(`/release-queue${suffix}`);
  await page.addStyleTag({
    content: `*, *::before, *::after { transition: none !important; animation: none !important; }
              * { caret-color: transparent !important; }`,
  });
  await page.waitForLoadState("domcontentloaded");
}
