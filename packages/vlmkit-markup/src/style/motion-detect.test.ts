import assert from "node:assert/strict";
import { describe, it } from "vitest";
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

/**
 * The gate must not assert that a rule is absent from CSS it never read.
 *
 * Found by a dogfood agent, which got `missing-reduced-motion` from here and
 * `reduced-motion: honored` from `check animation` on the same file, and wrote:
 * "Two gates, opposite verdicts, no way to tell which to trust." The cause was
 * `catch { // Cross-origin stylesheet; skip }` swallowing the `SecurityError` that
 * reading `cssRules` of a linked stylesheet throws for a `file://` document — i.e.
 * on the most common way this gate is invoked, every linked sheet was skipped.
 */
describe("motion: absence of a rule in unread CSS", () => {
  const animating = [{
    selector: ".card",
    tagName: "ARTICLE",
    animationName: "rise",
    animationDuration: "250ms",
    animationDelay: "0s",
    animationPlayState: "running",
    transitionProperty: "none",
    transitionDuration: "0s",
    transitionDelay: "0s",
  }];

  it("asserts the rule is missing only when every stylesheet was readable", () => {
    const report = analyzeMotionSamples({ source: "p.html", cssText: ".card { animation: rise 250ms; }", samples: animating });
    assert.deepEqual(report.issues.map((i) => i.kind), ["missing-reduced-motion", "running-animation"]);
  });

  it("downgrades to unreadable-stylesheet when a sheet could not be read", () => {
    const report = analyzeMotionSamples({
      source: "p.html",
      cssText: ".card { animation: rise 250ms; }",
      unreadableStylesheets: ["file:///repo/theme.css"],
      samples: animating,
    });
    const issue = report.issues.find((i) => i.kind === "unreadable-stylesheet");
    assert.ok(issue, `expected unreadable-stylesheet, got ${JSON.stringify(report.issues.map((i) => i.kind))}`);
    // A warn, not a suspect: absence is unproven, and the severity is the whole
    // difference between "your page is wrong" and "I could not tell".
    assert.equal(issue.severity, "warn");
    assert.match(issue.message, /file:\/\/\/repo\/theme\.css/);
    // And it must point at the gate that can answer without reading CSS text.
    assert.match(issue.message, /check animation/);
    assert.ok(!report.issues.some((i) => i.kind === "missing-reduced-motion"), "must not claim both");
  });

  it("says nothing about reduced motion when the rule was found, unread sheets or not", () => {
    const report = analyzeMotionSamples({
      source: "p.html",
      cssText: "@media (prefers-reduced-motion: reduce) { .card { animation: none; } }",
      unreadableStylesheets: ["file:///repo/other.css"],
      samples: animating,
    });
    assert.equal(report.hasReducedMotionRule, true);
    assert.ok(!report.issues.some((i) => i.kind === "missing-reduced-motion" || i.kind === "unreadable-stylesheet"));
  });
});

describe("motion: a linked file:// stylesheet is read (real browser)", () => {
  it("finds a prefers-reduced-motion rule that only exists in the linked sheet", { timeout: 120_000 }, async () => {
    // The end-to-end half: the page cannot read the sheet, so the caller has to.
    const { mkdtemp, writeFile } = await import("node:fs/promises");
    const { tmpdir } = await import("node:os");
    const { join } = await import("node:path");
    const dir = await mkdtemp(join(tmpdir(), "vlmkit-motion-"));
    await writeFile(join(dir, "theme.css"), `
      @keyframes rise { from { opacity: 0; } to { opacity: 1; } }
      .card { width: 100px; height: 40px; background: #248; animation: rise 250ms; }
      @media (prefers-reduced-motion: reduce) { .card { animation: none; } }
    `);
    await writeFile(join(dir, "page.html"), `<!doctype html><html><head><meta charset="utf-8">
      <link rel="stylesheet" href="theme.css"></head><body><div class="card"></div></body></html>`);

    const report = await runMotionDetection({ source: join(dir, "page.html") });
    assert.equal(report.hasReducedMotionRule, true, "the rule is in the linked sheet and must be found");
    assert.ok(
      !report.issues.some((i) => i.kind === "missing-reduced-motion" || i.kind === "unreadable-stylesheet"),
      `expected no reduced-motion issue, got ${JSON.stringify(report.issues.map((i) => i.kind))}`,
    );
  });
});
