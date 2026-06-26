import { defineConfig } from "@playwright/test";

// Self-contained: tests navigate to the file:// URL of page.html, no webServer.
export default defineConfig({
  testDir: ".",
  reporter: "line",
  // Short timeout so a broken locator fails fast during heal (not 30s each).
  timeout: 8000,
  expect: { timeout: 3000 },
  projects: [{ name: "chromium", use: {} }],
});
