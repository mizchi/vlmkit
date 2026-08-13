import assert from "node:assert/strict";
import { describe, it } from "vitest";
import {
  buildToHaveScreenshotArgs,
  toHaveScreenshotWithDiagnostics,
  type PlaywrightExpectLike,
  type ToHaveScreenshotArgs,
} from "./to-have-screenshot.ts";

describe("buildToHaveScreenshotArgs", () => {
  it("preserves explicit args when provided", () => {
    const args: ToHaveScreenshotArgs = ["home.png", { fullPage: true }];
    assert.equal(buildToHaveScreenshotArgs({ args, name: "ignored.png" }), args);
  });

  it("builds Playwright-compatible matcher signatures", () => {
    assert.deepEqual(buildToHaveScreenshotArgs({}), []);
    assert.deepEqual(buildToHaveScreenshotArgs({ options: { fullPage: true } }), [{ fullPage: true }]);
    assert.deepEqual(buildToHaveScreenshotArgs({ name: "home.png" }), ["home.png"]);
    assert.deepEqual(
      buildToHaveScreenshotArgs({ name: ["home", "desktop.png"], options: { threshold: 0.2 } }),
      [["home", "desktop.png"], { threshold: 0.2 }],
    );
  });
});

describe("toHaveScreenshotWithDiagnostics", () => {
  it("delegates to Playwright expect(page).toHaveScreenshot and skips diagnostics on pass", async () => {
    const target = { kind: "page" };
    const calls: unknown[][] = [];
    let diagnosticCalled = false;
    const expectLike: PlaywrightExpectLike = (actual) => {
      assert.equal(actual, target);
      return {
        toHaveScreenshot(...args) {
          calls.push(args);
        },
      };
    };

    await toHaveScreenshotWithDiagnostics({
      expect: expectLike,
      target,
      name: "home.png",
      options: { fullPage: true },
      onFailure: () => {
        diagnosticCalled = true;
      },
    });

    assert.deepEqual(calls, [["home.png", { fullPage: true }]]);
    assert.equal(diagnosticCalled, false);
  });

  it("runs diagnostics and rethrows the matcher error on failure", async () => {
    const matcherError = new Error("screenshot mismatch");
    let receivedError: unknown;
    let receivedTitle = "";
    const expectLike: PlaywrightExpectLike = () => ({
      toHaveScreenshot() {
        throw matcherError;
      },
    });

    await assert.rejects(
      toHaveScreenshotWithDiagnostics({
        expect: expectLike,
        target: {},
        testInfo: { title: "visual home", status: "failed", expectedStatus: "passed" },
        onFailure: ({ error, testInfo }) => {
          receivedError = error;
          receivedTitle = testInfo?.title ?? "";
        },
      }),
      matcherError,
    );

    assert.equal(receivedError, matcherError);
    assert.equal(receivedTitle, "visual home");
  });
});
