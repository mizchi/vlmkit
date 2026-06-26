import { test, expect } from "@playwright/test";
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";

// Genuinely flaky: passes on most runs but fails every 3rd run, driven by a
// persisted counter. The gate run and the 1st verify run pass; the 2nd verify
// run fails — exactly the "gate green but verify red" instability signal.
const counter = fileURLToPath(new URL("./_flaky_count.txt", import.meta.url));

test("intermittent dashboard check", async ({ page }) => {
  const n = existsSync(counter) ? Number(readFileSync(counter, "utf8")) : 0;
  writeFileSync(counter, String(n + 1));
  await page.goto(new URL("./app.html", import.meta.url).href);
  await expect(page.getByRole("heading")).toHaveText("Dashboard");
  expect(n % 3, `run #${n}`).not.toBe(2);
});
