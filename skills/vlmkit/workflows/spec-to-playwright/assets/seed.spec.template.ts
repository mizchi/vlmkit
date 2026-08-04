import { test, expect } from "@playwright/test";
import { gotoApp } from "./_helpers";

// Seed: proves the env boots to a known initial state. The planner runs this to
// understand the environment. Replace the assertion with your app's empty/initial state
// (e.g. a fresh todo list with `0 items left`).
test("seed: app boots", async ({ page }) => {
  await gotoApp(page);
  await expect(page.getByRole("heading").first()).toBeVisible();
});
