import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  analyzeMotionSamples,
  parseCssTimeList,
  runMotionDetection,
} from "./motion-detect.ts";

describe("parseCssTimeList", () => {
  it("parses comma-separated CSS time values to milliseconds", () => {
    assert.deepEqual(parseCssTimeList("150ms, 2s, 0s"), [150, 2000, 0]);
  });
});

describe("analyzeMotionSamples", () => {
  it("flags motion declarations without a reduced-motion rule", () => {
    const report = analyzeMotionSamples({
      source: "inline",
      cssText: ".card { animation: pulse 1s infinite; }",
      samples: [{
        selector: ".card",
        tagName: "DIV",
        animationName: "pulse",
        animationDuration: "1s",
        animationDelay: "0s",
        animationPlayState: "running",
        transitionProperty: "all",
        transitionDuration: "0s",
        transitionDelay: "0s",
      }],
    });

    assert.equal(report.activeAnimationCount, 1);
    assert.equal(report.runningAnimationCount, 1);
    assert.ok(report.issues.some((issue) => issue.kind === "missing-reduced-motion"));
    assert.ok(report.issues.some((issue) => issue.kind === "running-animation"));
  });

  it("accepts motion when reduced-motion CSS is present", () => {
    const report = analyzeMotionSamples({
      source: "inline",
      cssText: "@media (prefers-reduced-motion: reduce) { * { animation: none; } }",
      samples: [{
        selector: ".card",
        tagName: "DIV",
        animationName: "pulse",
        animationDuration: "1s",
        animationDelay: "0s",
        animationPlayState: "paused",
        transitionProperty: "opacity",
        transitionDuration: "200ms",
        transitionDelay: "0s",
      }],
    });

    assert.equal(report.activeAnimationCount, 1);
    assert.equal(report.activeTransitionCount, 1);
    assert.equal(report.issues.some((issue) => issue.kind === "missing-reduced-motion"), false);
  });
});

describe("runMotionDetection", () => {
  it("samples active CSS motion from rendered HTML", async () => {
    const report = await runMotionDetection({
      source: "inline",
      html: `<!doctype html>
        <style>
          @keyframes pulse { from { opacity: .5; } to { opacity: 1; } }
          .card { animation: pulse 1s infinite; transition: transform 200ms; }
        </style>
        <div class="card">Loading</div>`,
    });

    assert.equal(report.activeAnimationCount, 1);
    assert.equal(report.activeTransitionCount, 1);
    assert.ok(report.samples.some((sample) => sample.selector.includes("card")));
  });
});
