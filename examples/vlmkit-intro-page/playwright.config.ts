import { defineConfig } from "@playwright/test";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const exampleDir = dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  testDir: resolve(exampleDir, "tests/vlmkit"),
  testMatch: ["**/*.spec.ts"],
  timeout: 30_000,
  fullyParallel: false,
  workers: 1,
  reporter: [["list"]],
  outputDir: resolve(exampleDir, "test-results"),
  expect: {
    timeout: 5_000,
    toHaveScreenshot: {
      animations: "disabled",
      maxDiffPixelRatio: 0.005,
    },
  },
  use: {
    baseURL: process.env.VLMKIT_MARKUP_BASE_URL ?? "http://127.0.0.1:4190",
    trace: "on-first-retry",
    screenshot: "only-on-failure",
    deviceScaleFactor: 1,
    colorScheme: "light",
    locale: "ja-JP",
    timezoneId: "Asia/Tokyo",
  },
  projects: [
    { name: "desktop", use: { viewport: { width: 1280, height: 800 } } },
    { name: "mobile", use: { viewport: { width: 375, height: 812 } } },
  ],
  webServer: {
    command: "node server.mjs",
    cwd: exampleDir,
    url: "http://127.0.0.1:4190",
    reuseExistingServer: true,
    timeout: 10_000,
  },
});
