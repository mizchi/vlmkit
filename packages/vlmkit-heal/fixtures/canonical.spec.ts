import { test, expect } from "@playwright/test";

// Canonical GREEN test for app.html. The dogfood harness mutates copies of this
// (breaking a locator or an assertion) and checks the heal loop restores green.
test("dashboard submit flow", async ({ page }) => {
  await page.goto(new URL("./app.html", import.meta.url).href);
  await expect(page.getByRole("heading")).toHaveText("Dashboard");
  await page.getByPlaceholder("Email address").fill("a@b.com");
  await page.getByRole("button", { name: "Submit" }).click();
  await expect(page.getByTestId("result")).toHaveText("submitted");
  await expect(page.getByTestId("items").getByRole("listitem")).toHaveCount(2);
});
