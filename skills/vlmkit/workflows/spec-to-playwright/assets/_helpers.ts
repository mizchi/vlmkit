import type { Page } from "@playwright/test";

// Determinism layer for stable VRT. The planner/generator must read this to
// understand the preconditions. Open the app ONLY via gotoApp (never bare goto).
export async function gotoApp(page: Page): Promise<void> {
  await page.goto("/");
  await page.addStyleTag({
    content: `*, *::before, *::after { transition: none !important; animation: none !important; }
              * { caret-color: transparent !important; }`,
  });
  await page.evaluate(() => document.fonts.ready);
}
