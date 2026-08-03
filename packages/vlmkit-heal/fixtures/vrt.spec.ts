import { test, expect } from "@playwright/test";

// VRT test. The committed baseline matches vrt-page.html as checked in. The
// vlmkit inspect smoke mutates the page (an intentional UI change) so this fails, then the
// heal loop asks the vision tier (ui-tars) whether to update the baseline.
test("dashboard visual", async ({ page }) => {
  await page.setViewportSize({ width: 480, height: 240 });
  await page.goto(new URL("./vrt-page.html", import.meta.url).href);
  await expect(page).toHaveScreenshot("dashboard.png", { animations: "disabled" });
});
