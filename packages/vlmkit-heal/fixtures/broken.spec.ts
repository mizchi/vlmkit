import { test, expect } from "@playwright/test";

// INTENTIONALLY BROKEN: the button's accessible name is "Start", not "Begin".
// The heal loop should rewrite "Begin" -> "Start" and make this pass.
test("clicks the start button", async ({ page }) => {
  await page.goto(new URL("./page.html", import.meta.url).href);
  await page.getByRole("button", { name: "Begin" }).click();
  await expect(page.getByTestId("result")).toHaveText("clicked");
});
