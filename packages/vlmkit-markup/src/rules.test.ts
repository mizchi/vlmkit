import assert from "node:assert/strict";
import { describe, it } from "vitest";
import * as rules from "./rules.ts";

/**
 * Guards on the two claims `rules.ts` makes about itself. Both are the kind of
 * property that decays silently: one careless import inside a judge, or one
 * renamed export, and the module still compiles while no longer being what it
 * says it is.
 */
describe("@mizchi/vlmkit-markup/rules — the deterministic layer", () => {
  it("loads no browser", () => {
    // The headline claim. A consumer importing this to test a rule against its
    // own fixtures must not pay for a browser, and a judge that quietly grew an
    // `import { chromium }` would break that without breaking any other test.
    //
    // `moduleLoadList` covers what the loader has actually pulled in, so this
    // catches a transitive import a grep over this file would miss.
    // `moduleLoadList` is a Node internal with no type declaration; the cast is
    // the whole reason to name it in one place rather than inline.
    const loaded = (process as unknown as { moduleLoadList?: string[] }).moduleLoadList ?? [];
    const browserish = loaded.filter((m: string) => /playwright|chromium|puppeteer/i.test(m));
    assert.deepEqual(browserish, [], `importing ./rules.ts loaded: ${browserish.join(", ")}`);
  });

  it("exports a judge and a collector for every gate family it names", () => {
    // The barrel's value is that a consumer does not have to know which internal
    // file a rule lives in. A rename that drops one of these leaves the module
    // compiling and the promise broken.
    for (const name of [
      // collectors — the browser-side halves
      "COLLECT_DESIGN_SAMPLES",
      "COLLECT_INTEGRITY_TEXT",
      "COLLECT_OCCLUSIONS",
      "COLLECT_RESOURCES",
      "COLLECT_SCROLL_SCRIPT",
      "COLLECT_SURFACE_SCRIPT",
      "COLLECT_TEXT_BLOCKS",
      "A11Y_CONTRAST_SAMPLE_SCRIPT",
      "A11Y_TOUCH_SAMPLE_SCRIPT",
      "DISCOVER_SCRIPT",
      // judges — the pure halves
      "judgeDesignPolicy",
      "judgeTextContrast",
      "judgeAlignment",
      "judgeRender",
      "analyzeA11yContrastSamples",
      "analyzeA11yTouchSamples",
      "analyzeScrollSamples",
      "analyzeCopy",
      "analyzeMotionSamples",
      "deriveHandlerIssues",
      "deriveInteractionIssues",
      "deriveAnimationIssues",
      "deriveBreakpointIssues",
      // exemptions — both forms
      "parseSelectorAllowRules",
      "applySelectorAllowRules",
      "parseAllowRules",
      "applyAllowRules",
    ]) {
      assert.ok(name in rules, `./rules.ts no longer exports ${name}`);
    }
  });

  it("exports no run* or format* function", () => {
    // Deliberately absent: a `run*` owns a browser and a filesystem, and a
    // `format*` is the gate's prose. Letting either in would make the purity
    // guard above a coin flip on which one a consumer imported first.
    const leaked = Object.keys(rules).filter((k) => /^(run|format)[A-Z]/.test(k));
    assert.deepEqual(leaked, [], `browser-bound or prose exports leaked in: ${leaked.join(", ")}`);
  });

  it("judges a page's samples without a page", () => {
    // The end-to-end shape the module exists for: samples in, findings out, no
    // driver of any kind.
    const report = rules.judgeDesignPolicy({
      samples: [
        { role: "button", selector: "button#a", signature: "p10|r8|white", described: "a" },
        { role: "button", selector: "button#b", signature: "p10|r8|white", described: "b" },
        { role: "button", selector: "button#c", signature: "p2|r0|blue", described: "c" },
      ],
      spacing: [],
      skipped: 0,
      statefulSkipped: 0,
    });
    assert.equal(report.verdict, "drift");
    assert.equal(report.findings[0]?.kind, "component-drift");

    // And the same for a11y, where the WCAG floor is size-aware.
    assert.equal(rules.requiredTouchSide("AA"), 24);
    assert.equal(rules.analyzeA11yTouchSamples([
      { path: ".x", tag: "button", text: "x", bbox: { x: 0, y: 0, width: 20, height: 20 } },
    ], "AA").length, 1);
  });
});
