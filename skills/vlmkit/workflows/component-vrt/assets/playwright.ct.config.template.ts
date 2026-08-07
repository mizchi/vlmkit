/**
 * The `components` project for your `playwright.config.ts`.
 *
 * Needed only for *spec files* that use the `mount` fixture — which is
 * Playwright **1.62+**. `vlmkit check story` needs none of this: it drives the
 * gallery's `window.mount` directly and works on any version. Add this when you
 * also want behavioural component tests alongside the VRT loop.
 *
 * Merge the `projects` entry and `webServer` into your existing config rather
 * than replacing it.
 */
import { defineConfig, devices } from "@playwright/test";

const GALLERY = "http://localhost:5173/playwright/gallery/index.html";

export default defineConfig({
  projects: [
    {
      name: "components",
      testDir: "./tests/components",
      use: {
        ...devices["Desktop Chrome"],
        // baseURL IS the gallery URL: the mount fixture navigates here.
        baseURL: GALLERY,
        // A service worker can serve a stale gallery bundle, which reads as a
        // component that did not pick up your edit.
        serviceWorkers: "block",
        // The gallery is one page; reusing the context skips a per-test
        // navigation that buys nothing.
        reuseContext: true,
      },
    },
  ],
  webServer: {
    command: "npm run dev",
    url: GALLERY,
    reuseExistingServer: !process.env.CI,
  },
});
