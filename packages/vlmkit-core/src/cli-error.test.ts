import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { formatMissingPlaywrightBrowserError } from "./cli-error.ts";

describe("formatMissingPlaywrightBrowserError", () => {
  it("names the resolved Playwright and invokes that installation's CLI", () => {
    const text = formatMissingPlaywrightBrowserError(
      new Error("browserType.launch: Executable doesn't exist at /cache/chromium-123/chrome"),
      {
        version: "1.61.0",
        cliPath: "/repo/node_modules/playwright/cli.js",
        nodePath: "/usr/local/bin/node",
      },
    );
    assert.match(text ?? "", /Playwright 1\.61\.0 browser executable is not installed/);
    assert.match(
      text ?? "",
      /\/usr\/local\/bin\/node \/repo\/node_modules\/playwright\/cli\.js install chromium/,
    );
  });

  it("does not claim unrelated launch errors are missing browsers", () => {
    assert.equal(
      formatMissingPlaywrightBrowserError(new Error("browserType.launch: Operation not permitted"), {
        version: "1.61.0",
        cliPath: "/repo/node_modules/playwright/cli.js",
        nodePath: "/usr/local/bin/node",
      }),
      null,
    );
  });
});
