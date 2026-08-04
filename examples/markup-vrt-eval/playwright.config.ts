import { defineConfig, devices } from "@playwright/test";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const exampleDir = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(exampleDir, "../..");
const outRoot = resolve(repoRoot, ".vlmkit/markup-vrt-eval");

export default defineConfig({
  testDir: repoRoot,
  testMatch: [
    "examples/markup-vrt-eval/tests/**/*.spec.ts",
    ".vlmkit/markup-vrt-eval/generated/**/*.spec.ts",
  ],
  timeout: 45_000,
  fullyParallel: false,
  reporter: [["list"], ["json", { outputFile: resolve(outRoot, "playwright-report.json") }]],
  outputDir: resolve(outRoot, "test-results"),
  expect: {
    timeout: 5_000,
    toHaveScreenshot: {
      animations: "disabled",
      maxDiffPixelRatio: 0.01,
    },
  },
  use: {
    baseURL: "http://127.0.0.1:4173",
    trace: "on-first-retry",
    screenshot: "only-on-failure",
    viewport: { width: 1280, height: 760 },
    deviceScaleFactor: 1,
    colorScheme: "light",
    locale: "en-US",
    timezoneId: "UTC",
  },
  webServer: {
    command: "node server.mjs",
    cwd: exampleDir,
    url: "http://127.0.0.1:4173/release-queue",
    timeout: 30_000,
    reuseExistingServer: true,
  },
  projects: [
    { name: "chromium", use: { ...devices["Desktop Chrome"] } },
  ],
});
