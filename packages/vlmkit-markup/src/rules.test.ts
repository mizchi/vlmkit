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

/**
 * Every browser-script constant has to be syntactically valid JavaScript.
 *
 * These are 22 template literals that TypeScript never looks inside. A typo in one does not
 * fail the build or the typecheck — it fails inside `page.evaluate`, at which point the gate
 * either throws something opaque or, worse, returns nothing and reads as a clean page.
 * `new Function` compiles without executing, so this is a sub-millisecond check that names
 * the constant and shows the syntax error.
 *
 * **What this deliberately does NOT check, having tried:** a stray backtick. Writing prose
 * with backticks in a comment *inside* one of these literals terminates the string, and I
 * did it twice in two commits — the build failed with `PARSE_ERROR: Expected a semicolon or
 * an implicit semicolon after a statement` pointing at a comment, which names neither the
 * cause nor what the file was doing. But it cannot be caught from the constant's *value*:
 * the correct way to include one is `\``, and after evaluation that is an ordinary backtick,
 * indistinguishable from a stray one. `COLLECT_DESIGN_SAMPLES` has ten of them, all escaped
 * and all correct — asserting on backticks flagged it immediately. An unescaped backtick is
 * a compile error, so the compiler already owns that case; what it does not own is the
 * *inside* of the string, which is what this checks.
 */
describe("browser-script constants are valid JavaScript", () => {
  const scripts = Object.entries(rules)
    .filter((entry): entry is [string, string] => typeof entry[1] === "string")
    .filter(([name]) => /SCRIPT$|^COLLECT_|_JS$/.test(name));

  it("finds the script constants at all, or the check below is vacuous", () => {
    assert.ok(scripts.length >= 12, `only found ${scripts.length} script constants in the rules barrel`);
  });

  for (const [name, source] of scripts) {
    it(`${name} parses`, () => {
      // Compile, do not run: these reference `document` and `window`, which are absent here.
      assert.doesNotThrow(
        () => new Function(source),
        (err: Error) => new Error(`${name} is not valid JavaScript: ${err.message}`) as never,
      );
    });
  }
});
