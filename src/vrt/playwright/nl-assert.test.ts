import assert from "node:assert/strict";
import { describe, it } from "vitest";
import {
  captureNlAssertImage,
  nlAssert,
  NlAssertError,
  type NlAssertReviewer,
} from "./nl-assert.ts";

describe("captureNlAssertImage", () => {
  it("uses an explicit screenshot when supplied", async () => {
    const screenshot = Buffer.from("direct");
    let called = false;

    const image = await captureNlAssertImage({
      screenshot,
      target: {
        screenshot() {
          called = true;
          return Buffer.from("target");
        },
      },
    });

    assert.equal(image, screenshot);
    assert.equal(called, false);
  });

  it("captures from a Playwright-like target", async () => {
    const calls: unknown[] = [];
    const image = await captureNlAssertImage({
      screenshotOptions: { fullPage: true },
      target: {
        screenshot(options) {
          calls.push(options);
          return Buffer.from("page");
        },
      },
    });

    assert.deepEqual([...image as Buffer], [...Buffer.from("page")]);
    assert.deepEqual(calls, [{ fullPage: true }]);
  });
});

describe("nlAssert", () => {
  it("passes assertion text, screenshot, and metadata to the reviewer", async () => {
    const screenshot = Buffer.from("image");
    const reviewerCalls: unknown[] = [];
    const reviewer: NlAssertReviewer = (request) => {
      reviewerCalls.push(request);
      return {
        pass: true,
        reasoning: "The primary button is visible.",
        confidence: 0.92,
      };
    };

    const result = await nlAssert({
      assertion: "Primary button is visible",
      screenshot,
      metadata: { viewport: "desktop" },
      reviewer,
    });

    assert.equal(result.pass, true);
    assert.deepEqual(reviewerCalls, [{
      assertion: "Primary button is visible",
      image: screenshot,
      metadata: { viewport: "desktop" },
    }]);
  });

  it("throws NlAssertError when the reviewer rejects the assertion", async () => {
    const result = {
      pass: false,
      reasoning: "The primary button is missing.",
      evidence: ["No visible call-to-action in the screenshot."],
    };

    await assert.rejects(
      nlAssert({
        assertion: "Primary button is visible",
        screenshot: Buffer.from("image"),
        reviewer: () => result,
      }),
      (error) => {
        assert.ok(error instanceof NlAssertError);
        assert.equal(error.assertion, "Primary button is visible");
        assert.equal(error.result, result);
        assert.match(error.message, /primary button is missing/i);
        return true;
      },
    );
  });
});
