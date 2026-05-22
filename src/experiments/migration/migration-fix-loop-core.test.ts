import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { MigrationFixCandidate } from "./migration-fix-candidates.ts";
import {
  applyMigrationFixToCss,
  applyMigrationFixToHtml,
  buildBaselineValueIndex,
  buildMigrationFixLoopMultiPrompt,
  buildMigrationFixLoopPrompt,
  correctMigrationFixesWithReport,
  parseMigrationFixMultiResponse,
  parseMigrationFixResponse,
  resolveMigrationFixFromBaselineHtml,
  summarizeMigrationReportConvergence,
  selectMigrationFixTarget,
  shouldIgnoreMigrationRerunError,
  type MigrationCompareReport,
} from "./migration-fix-loop-core.ts";

function createCandidate(
  overrides: Partial<MigrationFixCandidate> = {},
): MigrationFixCandidate {
  return {
    selector: ".card",
    property: "padding",
    value: "12px",
    category: "spacing",
    mediaCondition: null,
    score: 6,
    reasoning: "spacing mismatch",
    ...overrides,
  };
}

function createReport(): MigrationCompareReport {
  return {
    dir: "fixtures/migration/example",
    baseline: "before.html",
    variants: ["after.html"],
    viewports: [
      { width: 375, height: 812, label: "mobile", reason: "standard" },
      { width: 1280, height: 900, label: "desktop", reason: "standard" },
    ],
    results: [
      {
        variant: "after",
        viewport: "mobile",
        diffRatio: 0.01,
        diffPixels: 120,
        dominantCategory: "spacing",
        categorySummary: "3 spacing",
        paintTreeSummary: "1 geometry",
        paintTreeChangeCount: 1,
        fixCandidates: [createCandidate()],
      },
      {
        variant: "after",
        viewport: "desktop",
        diffRatio: 0.025,
        diffPixels: 420,
        dominantCategory: "layout-shift",
        categorySummary: "2 layout-shift, 1 spacing",
        paintTreeSummary: "2 geometry",
        paintTreeChangeCount: 2,
        fixCandidates: [
          createCandidate({
            selector: ".panel",
            property: "gap",
            category: "layout",
            score: 11,
            reasoning: "layout-shift mismatch; paint tree geometry bounds",
          }),
        ],
      },
    ],
  };
}

describe("selectMigrationFixTarget", () => {
  it("should choose the highest-impact non-zero result", () => {
    const target = selectMigrationFixTarget(createReport());

    assert.ok(target);
    assert.equal(target.variant, "after");
    assert.equal(target.variantFile, "after.html");
    assert.equal(target.viewport, "desktop");
    assert.equal(target.viewportWidth, 1280);
    assert.equal(target.diffPixels, 420);
    assert.equal(target.fixCandidates[0]?.selector, ".panel");
  });
});

describe("summarizeMigrationReportConvergence", () => {
  it("should report clean when every viewport is zero-diff", () => {
    const summary = summarizeMigrationReportConvergence({
      ...createReport(),
      results: createReport().results.map((result) => ({
        ...result,
        diffRatio: 0,
        diffPixels: 0,
      })),
    });

    assert.equal(summary.status, "clean");
    assert.equal(summary.remainingResults, 0);
    assert.equal(summary.cleanResults, 2);
    assert.equal(summary.approvedResults, 0);
  });

  it("should report approved when all remaining diffs are fully approved", () => {
    const summary = summarizeMigrationReportConvergence({
      ...createReport(),
      results: [
        {
          ...createReport().results[0],
          diffRatio: 0,
          diffPixels: 0,
          approved: true,
        },
      ],
    });

    assert.equal(summary.status, "approved");
    assert.equal(summary.remainingResults, 0);
    assert.equal(summary.approvedResults, 1);
  });

  it("should report remaining when unresolved diffs still exist", () => {
    const summary = summarizeMigrationReportConvergence(createReport());

    assert.equal(summary.status, "remaining");
    assert.equal(summary.remainingResults, 2);
    assert.equal(summary.variants[0]?.status, "remaining");
  });
});

describe("buildMigrationFixLoopPrompt", () => {
  it("should include target summary and exact response format", () => {
    const target = selectMigrationFixTarget(createReport());
    assert.ok(target);

    const prompt = buildMigrationFixLoopPrompt({
      baselineFile: "before.html",
      variantFile: "after.html",
      target,
      currentCss: ".panel { display: grid; gap: 24px; }",
    });

    assert.match(prompt, /Viewport[\s\S]*desktop \(1280px\)/);
    assert.match(prompt, /2 layout-shift, 1 spacing/);
    assert.match(prompt, /\.panel \{ display: grid; gap: 24px; \}/);
    assert.match(prompt, /SELECTOR: <css selector>/);
    assert.match(prompt, /MEDIA: <media condition or none>/);
  });
});

describe("parseMigrationFixResponse", () => {
  it("should parse selector, property, value, and media", () => {
    const fix = parseMigrationFixResponse(`SELECTOR: .panel
PROPERTY: gap
VALUE: 20px
MEDIA: (min-width: 768px)`);

    assert.deepEqual(fix, {
      selector: ".panel",
      property: "gap",
      value: "20px",
      mediaCondition: "(min-width: 768px)",
    });
  });

  it("should treat MEDIA: none as top-level", () => {
    const fix = parseMigrationFixResponse(`SELECTOR: .panel
PROPERTY: gap
VALUE: 20px
MEDIA: none`);

    assert.deepEqual(fix, {
      selector: ".panel",
      property: "gap",
      value: "20px",
      mediaCondition: null,
    });
  });
});

describe("resolveMigrationFixFromBaselineHtml", () => {
  it("should reuse baseline declaration when selector/property match", () => {
    const baselineHtml = `<!doctype html><style id="target-css">
.panel { gap: 20px; }
@media (min-width: 768px) {
  .panel { gap: 28px; }
}
</style>`;

    const fix = resolveMigrationFixFromBaselineHtml(
      baselineHtml,
      createCandidate({
        selector: ".panel",
        property: "gap",
        mediaCondition: "(min-width: 768px)",
      }),
    );

    assert.deepEqual(fix, {
      selector: ".panel",
      property: "gap",
      value: "28px",
      mediaCondition: "(min-width: 768px)",
    });
  });
});

describe("applyMigrationFixToHtml", () => {
  it("should replace an existing top-level declaration", () => {
    const html = `<!doctype html><style id="target-css">
.panel { display: grid; gap: 24px; }
</style>`;

    const nextHtml = applyMigrationFixToHtml(html, {
      selector: ".panel",
      property: "gap",
      value: "20px",
      mediaCondition: null,
    });

    assert.match(nextHtml, /\.panel \{ display: grid; gap: 20px; \}/);
  });

  it("should append a declaration inside the matching media block", () => {
    const html = `<!doctype html><style id="target-css">
.panel { display: grid; gap: 24px; }
@media (min-width: 768px) {
  .panel { gap: 28px; }
}
</style>`;

    const nextHtml = applyMigrationFixToHtml(html, {
      selector: ".panel",
      property: "padding",
      value: "32px",
      mediaCondition: "(min-width: 768px)",
    });

    assert.match(nextHtml, /@media \(min-width: 768px\) \{\n  \.panel \{ gap: 28px; padding: 32px; \}\n\}/);
  });
});

describe("parseMigrationFixMultiResponse", () => {
  it("parses a JSON array of fixes", () => {
    const raw = JSON.stringify({
      fixes: [
        { selector: ".btn", property: "padding", value: "12px", mediaCondition: null },
        { selector: ".hero", property: "gap", value: "24px", mediaCondition: "(max-width: 700px)" },
      ],
    });
    const fixes = parseMigrationFixMultiResponse(raw);
    assert.equal(fixes.length, 2);
    assert.deepEqual(fixes[0], { selector: ".btn", property: "padding", value: "12px", mediaCondition: null });
    assert.equal(fixes[1]?.mediaCondition, "(max-width: 700px)");
  });

  it("normalizes 'none' / empty mediaCondition strings to null", () => {
    const raw = JSON.stringify({
      fixes: [
        { selector: ".x", property: "color", value: "red", mediaCondition: "none" },
        { selector: ".y", property: "color", value: "blue", mediaCondition: "" },
      ],
    });
    const fixes = parseMigrationFixMultiResponse(raw);
    assert.equal(fixes[0]?.mediaCondition, null);
    assert.equal(fixes[1]?.mediaCondition, null);
  });

  it("strips prose / markdown fences around the JSON block", () => {
    const wrapped = "Sure! Here are the fixes:\n\n```json\n" +
      JSON.stringify({ fixes: [{ selector: ".a", property: "color", value: "red", mediaCondition: null }] }) +
      "\n```\n";
    assert.equal(parseMigrationFixMultiResponse(wrapped).length, 1);
  });

  it("returns an empty list when the JSON is malformed", () => {
    assert.deepEqual(parseMigrationFixMultiResponse("not json at all"), []);
    assert.deepEqual(parseMigrationFixMultiResponse("{ fixes: oops }"), []);
  });

  it("drops entries missing required fields", () => {
    const raw = JSON.stringify({
      fixes: [
        { selector: ".ok", property: "color", value: "red", mediaCondition: null },
        { selector: ".bad", property: "", value: "x" },
        { property: "color", value: "red" },
      ],
    });
    const fixes = parseMigrationFixMultiResponse(raw);
    assert.equal(fixes.length, 1);
    assert.equal(fixes[0]?.selector, ".ok");
  });
});

describe("applyMigrationFixToCss whitespace tolerance", () => {
  it("matches a rule with non-canonical descendant-combinator whitespace", () => {
    const css = ".kpi  strong { display: inline; margin-top: 12px; }";
    const next = applyMigrationFixToCss(css, {
      selector: ".kpi strong",
      property: "display",
      value: "block",
      mediaCondition: null,
    });
    // Value updated in place; original selector formatting preserved.
    assert.match(next, /display: block/);
    assert.equal(next.includes("display: inline"), false);
  });

  it("matches a rule with extra spaces around child combinator", () => {
    const css = ".a  >  b { color: red; }";
    const next = applyMigrationFixToCss(css, {
      selector: ".a>b",
      property: "color",
      value: "blue",
      mediaCondition: null,
    });
    assert.match(next, /color: blue/);
    assert.equal(next.includes("color: red"), false);
  });
});

describe("applyMigrationFixToCss multi-line block in-place update", () => {
  it("updates a single property inside a multi-line block without appending", () => {
    const css = `.stage {
  padding: 36px 52px 40px;
  background: linear-gradient(to right, red, blue), var(--black);
}`;
    const next = applyMigrationFixToCss(css, {
      selector: ".stage",
      property: "padding",
      value: "34px",
      mediaCondition: null,
    });
    assert.match(next, /padding: 34px;/);
    // The other declaration must survive.
    assert.match(next, /background: linear-gradient/);
    // Must NOT append a longhand at end of stylesheet.
    assert.equal(next.includes(".stage { padding: 34px"), false, "should be updated in place, not appended");
    // Sanity: single occurrence of `.stage`.
    assert.equal((next.match(/\.stage/g) ?? []).length, 1);
  });

  it("inserts a new property into a multi-line block when not present", () => {
    const css = `.card {
  padding: 16px;
  background: white;
}`;
    const next = applyMigrationFixToCss(css, {
      selector: ".card",
      property: "border-radius",
      value: "8px",
      mediaCondition: null,
    });
    assert.match(next, /border-radius: 8px;/);
    assert.match(next, /padding: 16px;/);
    // New declaration should be inserted inside the block, indented.
    assert.match(next, /background: white;\s+border-radius: 8px;/);
    // Block count unchanged (no append).
    assert.equal((next.match(/\.card/g) ?? []).length, 1);
  });

  it("updates a rule nested in @media", () => {
    const css = `.box { color: red; }
@media (max-width: 700px) {
  .box {
    color: red;
    padding: 8px;
  }
}`;
    const next = applyMigrationFixToCss(css, {
      selector: ".box",
      property: "padding",
      value: "16px",
      mediaCondition: "(max-width: 700px)",
    });
    // The @media `.box` padding gets updated, not the top-level one.
    assert.match(next, /@media \(max-width: 700px\)[\s\S]*padding: 16px;/);
    // Original top-level `.box { color: red; }` untouched.
    assert.match(next, /^\.box \{ color: red; \}/);
  });

  it("returns unchanged CSS when the value already matches", () => {
    const css = `.btn {\n  color: blue;\n  padding: 8px;\n}`;
    const next = applyMigrationFixToCss(css, {
      selector: ".btn",
      property: "color",
      value: "blue",
      mediaCondition: null,
    });
    assert.equal(next, css);
  });
});

describe("applyMigrationFixToCss appendIfMissing", () => {
  it("appends a new declaration block when the selector is not in the stylesheet", () => {
    const css = ".existing { color: red; }";
    const next = applyMigrationFixToCss(
      css,
      { selector: ".new", property: "padding", value: "12px", mediaCondition: null },
      { appendIfMissing: true },
    );
    assert.match(next, /\.new \{ padding: 12px; \}/);
  });

  it("wraps the new declaration in @media when mediaCondition is set", () => {
    const css = ".hero { gap: 16px; }";
    const next = applyMigrationFixToCss(
      css,
      { selector: ".hero", property: "padding", value: "24px", mediaCondition: "(max-width: 700px)" },
      { appendIfMissing: true },
    );
    assert.match(next, /@media \(max-width: 700px\) \{\n  \.hero \{ padding: 24px; \}\n\}/);
  });

  it("returns unchanged CSS when appendIfMissing is false and no rule matches", () => {
    const css = ".existing { color: red; }";
    const next = applyMigrationFixToCss(
      css,
      { selector: ".missing", property: "padding", value: "12px", mediaCondition: null },
    );
    assert.equal(next, css);
  });
});

describe("buildMigrationFixLoopMultiPrompt", () => {
  it("includes maxFixes and asks for JSON output with mediaCondition guidance", () => {
    const prompt = buildMigrationFixLoopMultiPrompt({
      baselineFile: "target.html",
      variantFile: "current.html",
      target: {
        variantFile: "current.html",
        viewport: "mobile",
        viewportWidth: 375,
        diffRatio: 0.16,
        diffPixels: 1000,
        dominantCategory: "layout-shift",
        categorySummary: "3 layout-shift",
        paintTreeSummary: "no changes",
        fixCandidates: [],
        category: "layout-shift",
        score: 0,
        reasoning: "test",
      } as any,
      currentCss: ".x { color: red; }",
      maxFixes: 5,
    });
    assert.match(prompt, /up to 5 high-confidence/);
    assert.match(prompt, /"fixes"/);
    assert.match(prompt, /max-width: 700px/);
  });
});

describe("buildBaselineValueIndex + correctMigrationFixesWithReport", () => {
  const report: MigrationCompareReport = {
    baseline: "target.html",
    variants: ["current.html"],
    viewports: [],
    results: [],
    computedStyleDiff: [{
      variantFile: "current.html",
      result: {
        entries: [
          { selector: ".btn", property: "background-color", baseline: "rgb(29, 78, 216)", variant: "rgb(37, 99, 235)" },
          { selector: ".hero", property: "padding", baseline: "24px", variant: "16px" },
        ],
      },
    }],
    domPositionDiffPerViewport: [{
      variantFile: "current.html",
      result: {
        entries: [
          { path: "body[0]>div[0]", baselineClasses: "actions", variantClasses: "actions", property: "margin-top", baseline: "34px", variant: "32px", viewport: "mobile" },
        ],
      },
    }],
  };

  it("indexes baseline values by selector+property", () => {
    const idx = buildBaselineValueIndex(report, "current.html");
    assert.equal(idx.global.size > 0, true);
    // Spot-check: a known (selector, property) pair has the right baseline
    const found = [...idx.global.entries()].find(([k]) => k.startsWith(".btn") && k.endsWith("background-color"));
    assert.ok(found, "should index .btn background-color");
    assert.equal(found?.[1], "rgb(29, 78, 216)");
  });

  it("overrides a hallucinated value with the indexed baseline", () => {
    const idx = buildBaselineValueIndex(report, "current.html");
    const result = correctMigrationFixesWithReport(
      [{ selector: ".btn", property: "background-color", value: "rgb(0, 0, 255)", mediaCondition: null }],
      idx,
    );
    assert.equal(result.corrections.length, 1);
    assert.equal(result.fixes[0]?.value, "rgb(29, 78, 216)");
  });

  it("keeps the proposal as-is when no baseline is indexed", () => {
    const idx = buildBaselineValueIndex(report, "current.html");
    const result = correctMigrationFixesWithReport(
      [{ selector: ".unknown", property: "color", value: "red", mediaCondition: null }],
      idx,
    );
    assert.equal(result.corrections.length, 0);
    assert.equal(result.fixes[0]?.value, "red");
  });

  it("drops proposals with path-style selectors", () => {
    const idx = buildBaselineValueIndex(report, "current.html");
    const result = correctMigrationFixesWithReport(
      [
        { selector: ".page>header[1]", property: "padding", value: "8px", mediaCondition: null },
        { selector: ">nav[1]", property: "gap", value: "4px", mediaCondition: null },
        { selector: ".real", property: "padding", value: "8px", mediaCondition: null },
      ],
      idx,
    );
    assert.equal(result.fixes.length, 1, "only .real survives");
    assert.equal(result.dropped.length, 2);
    assert.match(result.dropped[0]?.reason ?? "", /path-style/);
  });

  it("flags viewport-variant pairs and excludes them from `global`", () => {
    const multiViewportReport: MigrationCompareReport = {
      baseline: "target.html",
      variants: ["current.html"],
      viewports: [],
      results: [],
      domPositionDiffPerViewport: [{
        variantFile: "current.html",
        result: {
          entries: [
            { path: "body[0]", baselineClasses: "stage", variantClasses: "stage", property: "padding", baseline: "34px", variant: "20px", viewport: "wide" },
            { path: "body[0]", baselineClasses: "stage", variantClasses: "stage", property: "padding", baseline: "20px", variant: "20px", viewport: "mobile" },
            { path: "body[0]", baselineClasses: "card", variantClasses: "card", property: "color", baseline: "red", variant: "blue", viewport: "wide" },
            { path: "body[0]", baselineClasses: "card", variantClasses: "card", property: "color", baseline: "red", variant: "blue", viewport: "mobile" },
          ],
        },
      }],
    };
    const idx = buildBaselineValueIndex(multiViewportReport, "current.html");
    assert.ok(idx.viewportVariant.has(".stage padding"), "two distinct baselines for .stage padding → variant");
    assert.ok(!idx.global.has(".stage padding"), "should be excluded from `global`");
    assert.ok(idx.global.has(".card color"), ".card color is universal across viewports");
    assert.ok(!idx.viewportVariant.has(".card color"));
  });

  it("drops viewport-variant proposals that lack a mediaCondition", () => {
    const multiViewportReport: MigrationCompareReport = {
      baseline: "target.html",
      variants: ["current.html"],
      viewports: [],
      results: [],
      domPositionDiffPerViewport: [{
        variantFile: "current.html",
        result: {
          entries: [
            { path: "body[0]", baselineClasses: "stage", variantClasses: "stage", property: "padding", baseline: "34px", variant: "20px", viewport: "wide" },
            { path: "body[0]", baselineClasses: "stage", variantClasses: "stage", property: "padding", baseline: "20px", variant: "20px", viewport: "mobile" },
          ],
        },
      }],
    };
    const idx = buildBaselineValueIndex(multiViewportReport, "current.html");
    const result = correctMigrationFixesWithReport(
      [
        { selector: ".stage", property: "padding", value: "16px", mediaCondition: null }, // dropped
        { selector: ".stage", property: "padding", value: "34px", mediaCondition: "(min-width: 980px)" }, // kept
      ],
      idx,
    );
    assert.equal(result.fixes.length, 1, "only the media-gated proposal survives");
    assert.equal(result.fixes[0]?.mediaCondition, "(min-width: 980px)");
    assert.equal(result.dropped.length, 1);
    assert.match(result.dropped[0]?.reason ?? "", /viewport-variant/);
  });

  it("drops proposals that target computed-layout properties", () => {
    const idx = buildBaselineValueIndex(report, "current.html");
    const result = correctMigrationFixesWithReport(
      [
        { selector: ".page", property: "height", value: "1334.41px", mediaCondition: null },
        { selector: ".page", property: "width", value: "1280px", mediaCondition: null },
        { selector: ".page", property: "padding", value: "8px", mediaCondition: null },
      ],
      idx,
    );
    assert.equal(result.fixes.length, 1, "only .page padding survives");
    assert.equal(result.dropped.length, 2);
    assert.match(result.dropped[0]?.reason ?? "", /computed-layout/);
  });
});

describe("shouldIgnoreMigrationRerunError", () => {
  it("should ignore known Playwright sandbox launch failures", () => {
    assert.equal(
      shouldIgnoreMigrationRerunError(new Error("browserType.launch: ... Operation not permitted ... MachPortRendezvousServer")),
      true,
    );
  });

  it("should preserve unrelated rerun errors", () => {
    assert.equal(
      shouldIgnoreMigrationRerunError(new Error("migration compare failed: diff output missing")),
      false,
    );
  });
});
