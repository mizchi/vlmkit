import { defineConfig, devices } from "@playwright/test";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const exampleDir = dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  testDir: exampleDir,
  testMatch: ["tests/vlmkit/**/*.spec.ts"],
  timeout: 30_000,
  fullyParallel: false,
  reporter: [["list"]],
  outputDir: resolve(exampleDir, "test-results"),
  expect: {
    timeout: 5_000,
    toHaveScreenshot: {
      animations: "disabled",
      maxDiffPixelRatio: 0.01,
    },
  },
  use: {
    baseURL: process.env.VLMKIT_MARKUP_BASE_URL ?? "http://127.0.0.1:4183/dashboard",
    trace: "on-first-retry",
    screenshot: "only-on-failure",
    viewport: { width: 1280, height: 760 },
    deviceScaleFactor: 1,
    colorScheme: "light",
    locale: "en-US",
    timezoneId: "UTC",
    ...devices["Desktop Chrome"],
  },
});
