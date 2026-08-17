import { describe, it } from "vitest";
import assert from "node:assert/strict";
import type { PaintTreeChange } from "@mizchi/vlmkit-capture/crater-client.ts";
import type { VrtDiff, VrtSnapshot } from "@mizchi/vlmkit-core/types.ts";
import { parseApprovalManifest } from "../../vrt/snapshot/approval.ts";
import {
  analyzeVrtDiff,
  applyApprovalsToAnalysisSignals,
  applyCssFix,
  captureCraterForcedStateStyles,
  groupBySelector,
  normalizeValue,
  parseCssDeclarations,
  removeCssProperty,
  removeSelectorBlock,
  seededRandom,
} from "./css-challenge-core.ts";

const snapshot: VrtSnapshot = {
  testId: "page",
  testTitle: "page",
  projectName: "test",
  screenshotPath: "/tmp/current.png",
  baselinePath: "/tmp/baseline.png",
  status: "changed",
};

function createDiff(overrides: Partial<VrtDiff> = {}): VrtDiff {
  return {
    snapshot,
    diffPixels: 32,
    totalPixels: 1000,
    diffRatio: 0.032,
    regions: [{ x: 0, y: 0, width: 32, height: 32, diffPixelCount: 32 }],
    ...overrides,
  };
}

describe("applyApprovalsToAnalysisSignals", () => {
  it("should filter visual and paint tree signals by declaration context", () => {
    const manifest = parseApprovalManifest(JSON.stringify({
      rules: [
        {
          selector: ".card",
          property: "margin-left",
          category: "spacing",
          changeType: "geometry",
          tolerance: { pixels: 40, ratio: 0.05, geometryDelta: 4 },
          reason: "known spacing drift",
        },
      ],
    }));
    const paintTreeChanges: PaintTreeChange[] = [
      {
        path: "root > div[0]",
        type: "geometry",
        property: "bounds",
        before: "0,0 100x40",
        after: "0,3 100x40",
      },
    ];

    const result = applyApprovalsToAnalysisSignals(createDiff(), paintTreeChanges, {
      manifest,
      context: { selector: ".card", property: "margin-left", category: "spacing" },
    });

    assert.equal(result.vrtDiff?.diffPixels, 0);
    assert.equal(result.paintTreeChanges.length, 0);
    assert.equal(result.approvedVisualRules.length, 1);
    assert.equal(result.approvedPaintTreeMatches.length, 1);
  });

  it("should preserve signals in strict mode", () => {
    const manifest = parseApprovalManifest(JSON.stringify({
      rules: [
        {
          property: "background-color",
          category: "visual",
          changeType: "paint",
          tolerance: { pixels: 100, ratio: 0.5, colorDelta: 20 },
          reason: "known palette drift",
        },
      ],
    }));
    const paintTreeChanges: PaintTreeChange[] = [
      {
        path: "root > div[0]",
        type: "paint",
        property: "background",
        before: "[255,255,255,255]",
        after: "[245,245,245,255]",
      },
    ];

    const result = applyApprovalsToAnalysisSignals(createDiff(), paintTreeChanges, {
      manifest,
      context: { property: "background-color", category: "visual" },
      strict: true,
    });

    assert.equal(result.vrtDiff?.diffPixels, 32);
    assert.equal(result.paintTreeChanges.length, 1);
    assert.equal(result.approvedVisualRules.length, 0);
    assert.equal(result.approvedPaintTreeMatches.length, 0);
  });
});

describe("captureCraterForcedStateStyles", () => {
  it("captures forced hover styles keyed by the original selector", async () => {
    const calls: Array<{ selector: string; forcedStates: string[]; properties: string[] }> = [];
    const client = {
      getComputedStylesWithState: async (
        selector: string,
        forcedStates: string[],
        properties: string[],
      ) => {
        calls.push({ selector, forcedStates, properties });
        return {
          normal: { "text-decoration": "none" },
          forced: { "text-decoration": "underline" },
          diff: [{ property: "text-decoration", normal: "none", forced: "underline" }],
        };
      },
    };

    const styles = await captureCraterForcedStateStyles(
      client,
      [".footer a:hover", ".plain a"],
      ["text-decoration"],
    );

    assert.deepEqual(calls, [
      { selector: ".footer a:hover", forcedStates: ["hover"], properties: ["text-decoration"] },
    ]);
    assert.deepEqual(styles.get(".footer a:hover"), { "text-decoration": "underline" });
  });
});

describe("analyzeVrtDiff", () => {
  it("skips screenshot comparison when visual capture was skipped", async () => {
    const baseline = {
      a11yTree: { role: "document", name: "", children: [] },
      screenshotPath: "/missing-baseline.png",
      visualCaptureSkipped: true,
      computedStyles: new Map([[".card", { display: "block" }]]),
      hoverComputedStyles: new Map(),
    };
    const broken = {
      a11yTree: { role: "document", name: "", children: [] },
      screenshotPath: "/missing-broken.png",
      visualCaptureSkipped: true,
      computedStyles: new Map([[".card", { display: "none" }]]),
      hoverComputedStyles: new Map(),
    };

    const analysis = await analyzeVrtDiff(baseline, broken, "/tmp");

    assert.equal(analysis.vrtDiff, null);
    assert.equal(analysis.computedStyleDiffs.length, 1);
  });
});

/**
 * The CSS mutators — the functions that actually edit stylesheets.
 *
 * All four were untested. They are the highest-risk pure code in the experiment:
 * `removeCssProperty` creates the regression a trial is measured against, so a
 * mis-removal corrupts the experiment's *ground truth* rather than crashing, and
 * `applyCssFix` writes the model's proposed repair back into the sheet.
 *
 * Two real bugs came out of writing these, both fixed and both documented in the
 * module. Neither was reachable from the current corpus — verified across all 2,391
 * declarations in the ten fixtures, byte-identical output before and after the fix —
 * so no recorded bench number changes. They were one character of fixture authoring
 * away from firing.
 */
describe("parseCssDeclarations", () => {
  it("reads each property of a one-line rule as its own declaration", () => {
    const decls = parseCssDeclarations(".card { color: red; padding: 4px; }");
    assert.deepEqual(decls.map((d) => [d.selector, d.property, d.value]), [
      [".card", "color", "red"],
      [".card", "padding", "4px"],
    ]);
    assert.equal(decls[0]!.index, 0, "the line index is how every mutator finds it again");
  });

  it("only sees one-line rules, which is the fixture format", () => {
    // Worth pinning rather than leaving implicit: a multi-line rule is invisible to
    // the whole experiment, so a fixture reformatted by a prettier pass would silently
    // yield zero candidate declarations rather than an error.
    assert.deepEqual(parseCssDeclarations(".card {\n  color: red;\n}"), []);
  });

  it("skips comments and at-rules but records a rule's @media condition", () => {
    const css = [
      "/* a comment */",
      ".card { color: red; }",
      "@media (max-width: 600px) {",
      ".card { color: blue; }",
      "}",
      ".other { color: green; }",
    ].join("\n");
    const decls = parseCssDeclarations(css);
    assert.deepEqual(decls.map((d) => [d.value, d.mediaCondition]), [
      ["red", null],
      ["blue", "(max-width: 600px)"],
      ["green", null],
    ]);
  });

  it("keeps a var() value whole", () => {
    const decls = parseCssDeclarations(".b { color: var(--accent, #333); }");
    assert.equal(decls[0]!.value, "var(--accent, #333)");
  });
});

describe("groupBySelector", () => {
  it("groups by line, so the same selector twice stays two blocks", () => {
    // A selector repeated on two lines is two independently removable blocks; keying
    // on the selector alone would merge them and `removeSelectorBlock` would then
    // blank only one while reporting both.
    const css = ".card { color: red; padding: 4px; }\n.card { margin: 8px; }";
    const blocks = groupBySelector(parseCssDeclarations(css));
    assert.equal(blocks.length, 2);
    assert.deepEqual(blocks.map((b) => b.declarations.length), [2, 1]);
    assert.deepEqual(blocks.map((b) => b.index), [0, 1]);
  });
});

describe("removeSelectorBlock", () => {
  it("blanks the block's line and leaves every other line byte-identical", () => {
    const css = ".a { color: red; }\n.b { color: blue; }\n.c { color: green; }";
    const block = groupBySelector(parseCssDeclarations(css)).find((b) => b.selector === ".b")!;
    assert.equal(removeSelectorBlock(css, block), ".a { color: red; }\n\n.c { color: green; }");
    // The line survives as empty rather than being deleted, so every other
    // declaration's recorded `index` still points at its own line.
    assert.equal(removeSelectorBlock(css, block).split("\n").length, 3);
  });
});

describe("removeCssProperty", () => {
  it("removes the named declaration and nothing else", () => {
    const css = ".card { color: red; padding: 4px; margin: 8px; }";
    const target = parseCssDeclarations(css).find((d) => d.property === "padding")!;
    const out = removeCssProperty(css, target);
    const left = parseCssDeclarations(out).map((d) => d.property);
    assert.deepEqual(left, ["color", "margin"]);
  });

  it("does not match a property name that is the tail of a longer one", () => {
    // The bug. `\s*color\s*:\s*red\s*;?` matches inside `border-color: red`, and
    // `String.replace` takes the first match, so this produced
    // `.card { border- color: red; }` — mangling a property the caller never named
    // and leaving the one it did name in place.
    const css = ".card { border-color: red; color: red; }";
    const target = parseCssDeclarations(css).find((d) => d.property === "color")!;
    const out = removeCssProperty(css, target);
    assert.equal(out, ".card { border-color: red; }");
    assert.deepEqual(parseCssDeclarations(out).map((d) => d.property), ["border-color"]);
  });

  it("does not match a value that is the head of a longer one", () => {
    const css = ".card { font-family: redwood; color: red; }";
    const target = parseCssDeclarations(css).find((d) => d.property === "color")!;
    assert.equal(removeCssProperty(css, target), ".card { font-family: redwood; }");
  });

  it("works when the same value appears on several properties", () => {
    // The shape the corpus actually has — `.tab-item.active { color: #2563eb;
    // border-bottom-color: #2563eb; }` — in both orders, since only one of them was
    // ever exercised.
    for (const css of [
      ".t { color: #2563eb; border-bottom-color: #2563eb; }",
      ".t { border-bottom-color: #2563eb; color: #2563eb; }",
    ]) {
      const target = parseCssDeclarations(css).find((d) => d.property === "color")!;
      const left = parseCssDeclarations(removeCssProperty(css, target)).map((d) => d.property);
      assert.deepEqual(left, ["border-bottom-color"], `wrong property removed from ${css}`);
    }
  });

  it("escapes regex metacharacters in the value", () => {
    // A value like `var(--x)` or `calc(100% - 1px)` is full of them; an unescaped
    // `(` would make the pattern throw or match the wrong span.
    const css = ".b { width: calc(100% - 1px); color: red; }";
    const target = parseCssDeclarations(css).find((d) => d.property === "width")!;
    assert.equal(removeCssProperty(css, target), ".b { color: red; }");
  });

  it("removes the only declaration, leaving an empty but parseable rule", () => {
    const css = ".a { color: red; }";
    const target = parseCssDeclarations(css)[0]!;
    const out = removeCssProperty(css, target);
    assert.match(out, /^\.a \{\s*\}$/);
    assert.deepEqual(parseCssDeclarations(out), []);
  });
});

describe("applyCssFix", () => {
  it("appends the declaration to the matching rule", () => {
    assert.equal(
      applyCssFix(".a { color: red; }\n.b { margin: 0; }", { selector: ".b", property: "padding", value: "4px" }),
      ".a { color: red; }\n.b { margin: 0; padding: 4px; }",
    );
  });

  it("terminates a body that has no trailing semicolon before appending", () => {
    // The bug. A trailing semicolon is optional in CSS, so `.card { color: red }` is
    // legal — and concatenating onto it produced `.card { color: red padding: 4px; }`,
    // destroying the declaration already there. In the loop the apply-and-rollback
    // gate catches the diff explosion but blames the model's fix, not the applier.
    const out = applyCssFix(".card { color: red }", { selector: ".card", property: "padding", value: "4px" });
    assert.equal(out, ".card { color: red; padding: 4px; }");
    assert.deepEqual(
      parseCssDeclarations(out).map((d) => [d.property, d.value]),
      [["color", "red"], ["padding", "4px"]],
      "both declarations must survive, which is what concatenation destroyed",
    );
  });

  it("fills an emptied rule without a leading semicolon", () => {
    // This is the loop's own round trip: remove the only declaration, then apply a
    // fix to the rule that is left.
    const css = ".a { color: red; }";
    const emptied = removeCssProperty(css, parseCssDeclarations(css)[0]!);
    const out = applyCssFix(emptied, { selector: ".a", property: "color", value: "blue" });
    assert.equal(out, ".a { color: blue; }");
    assert.deepEqual(parseCssDeclarations(out).map((d) => d.value), ["blue"]);
  });

  it("returns the CSS untouched when no rule matches", () => {
    const css = ".a { color: red; }";
    assert.equal(applyCssFix(css, { selector: ".nope", property: "color", value: "blue" }), css);
  });

  it("only fills the first matching rule", () => {
    // Documented as-is rather than asserted as desirable: with the selector on two
    // lines the fix lands on the first, which is what the loop's rollback gate then
    // measures. Pinned so a change to it is deliberate.
    const out = applyCssFix(".a { color: red; }\n.a { margin: 0; }", { selector: ".a", property: "padding", value: "4px" });
    assert.equal(out, ".a { color: red; padding: 4px; }\n.a { margin: 0; }");
  });
});

describe("normalizeValue", () => {
  it("collapses whitespace and drops a trailing semicolon", () => {
    assert.equal(normalizeValue("  1px   solid   red ;"), "1px solid red");
    assert.equal(normalizeValue("red"), "red");
    // A semicolon inside the value is not a terminator and must survive.
    assert.equal(normalizeValue(`url("a;b.png")`), `url("a;b.png")`);
  });
});

describe("seededRandom", () => {
  it("is reproducible for a seed and different across seeds", () => {
    // The whole bench is "seed 11 is the hard case"; a generator that is not
    // reproducible makes every recorded seed meaningless.
    const a = seededRandom(11);
    const b = seededRandom(11);
    const first = Array.from({ length: 8 }, () => a());
    assert.deepEqual(first, Array.from({ length: 8 }, () => b()));
    const other = seededRandom(12);
    assert.notDeepEqual(first, Array.from({ length: 8 }, () => other()));
  });

  it("stays in [0, 1)", () => {
    for (const seed of [0, 1, 11, 42, 0x7ffffffe]) {
      const next = seededRandom(seed);
      for (let i = 0; i < 200; i++) {
        const v = next();
        assert.ok(v >= 0 && v < 1, `seed ${seed} produced ${v}`);
      }
    }
  });
});
