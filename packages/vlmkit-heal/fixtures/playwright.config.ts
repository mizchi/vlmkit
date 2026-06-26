import { defineConfig } from "@playwright/test";

// Self-contained: tests navigate to the file:// URL of page.html, no webServer.
export default defineConfig({
  testDir: ".",
  reporter: "line",
  projects: [{ name: "chromium", use: {} }],
});
