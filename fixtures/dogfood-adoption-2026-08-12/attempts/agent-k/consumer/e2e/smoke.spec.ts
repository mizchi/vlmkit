import { expect, test } from "@playwright/test";

// The project's own e2e suite, excluded from vitest by config. Kept so the
// consumer has a real Playwright pin of its own.
test("orders list renders", async ({ page }) => {
  await page.goto("/");
  await expect(page.locator("h1")).toContainText("Orders");
});
