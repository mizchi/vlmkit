import assert from "node:assert/strict";
import { test } from "node:test";
import {
  buildQualityFailures,
  evaluateExpectedChange,
  renderHtmlReport,
  renderMarkdown,
} from "./run-report.mjs";

test("evaluateExpectedChange approves expected visual-only selector drift", () => {
  const approval = evaluateExpectedChange(makeRepairContext(), {
    expectedFailureKind: "vrt-diff",
    expectedDriftKind: "visual-only",
    allowedPrimaryCauses: ["layout"],
    allowedSelectors: [".metric"],
  }, true);

  assert.equal(approval.approved, true);
  assert.deepEqual(approval.reasons, []);
});

test("evaluateExpectedChange rejects when the expected regression is not observed", () => {
  const approval = evaluateExpectedChange(makeRepairContext(), {
    expectedFailureKind: "vrt-diff",
    expectedDriftKind: "visual-only",
    allowedPrimaryCauses: ["layout"],
    allowedSelectors: [".metric"],
  }, false);

  assert.equal(approval.approved, false);
  assert.match(approval.reasons.join("\n"), /visual regression was not detected/);
});

test("buildQualityFailures keeps the gate list separate from orchestration", () => {
  const repairContext = makeRepairContext();
  const expectedChangeApproval = {
    approved: true,
    reasons: [],
  };

  assert.deepEqual(buildQualityFailures({
    planHasSingleScenario: true,
    generatedScreenshotAssertions: 2,
    generatedDirectPageGoto: false,
    generatedCommentLines: 0,
    generatedUsesReleaseRowTestId: true,
    visualRegressionDetected: true,
    repairContext,
    visualContext: { viewports: [{}, {}, {}] },
    stabilityRuns: [{ exitCode: 0 }, { exitCode: 0 }],
    expectedChangeApproval,
  }), []);

  const failures = buildQualityFailures({
    planHasSingleScenario: false,
    generatedScreenshotAssertions: 1,
    generatedDirectPageGoto: true,
    generatedCommentLines: 1,
    generatedUsesReleaseRowTestId: false,
    visualRegressionDetected: false,
    repairContext,
    visualContext: { viewports: [{}] },
    stabilityRuns: [{ exitCode: 1 }],
    expectedChangeApproval: {
      approved: false,
      reasons: ["selector allowlist missed"],
    },
  });

  assert.equal(failures.length, 9);
  assert.equal(failures.some((failure) => failure.includes("exactly one scenario")), true);
  assert.equal(failures.some((failure) => failure.includes("expected-change approval failed")), true);
});

test("renderMarkdown includes VLM rows and omits null artifacts", () => {
  const markdown = renderMarkdown(makeReport({
    artifacts: {
      reportPath: ".vrt/markup-vrt-eval/report.json",
      vlmRegionDiffPath: null,
    },
  }));

  assert.match(markdown, /### VLM Region Diff/);
  assert.match(markdown, /\.pill: background-color `#fee` -> `#eff` \(high\)/);
  assert.match(markdown, /reportPath: `\.vrt\/markup-vrt-eval\/report\.json`/);
  assert.doesNotMatch(markdown, /vlmRegionDiffPath/);
});

test("renderHtmlReport escapes report data and relativizes local artifacts", () => {
  const html = renderHtmlReport(makeReport({
    scenario: "<script>alert(1)</script>",
  }), {
    artifacts: {
      expectedPng: ".vrt/markup-vrt-eval/test-results/expected.png",
      actualPng: null,
      diffPng: null,
    },
  });

  assert.match(html, /test-results\/expected\.png/);
  assert.doesNotMatch(html, /\.vrt\/markup-vrt-eval\/test-results\/expected\.png/);
  assert.doesNotMatch(html, /<script>alert\(1\)<\/script>/);
  assert.match(html, /&lt;script&gt;alert\(1\)&lt;\/script&gt;/);
});

function makeRepairContext() {
  return {
    failure: {
      kind: "vrt-diff",
      screenshotName: "release-queue-initial.png",
    },
    imageDiff: {
      changedPixels: 10,
      diffRatio: 0.1,
      bbox: { left: 1, top: 2, width: 3, height: 4 },
      selectorMatches: [{
        selector: ".queue",
        confidence: "medium",
        evidence: { score: 0.7 },
      }],
      edgeCandidates: [{
        selector: ".metric",
        reason: "4px from diff top",
        score: 1,
      }],
    },
    repairHints: ["Inspect .metric min-height."],
    styleAttribution: {
      changedProperties: [{
        selector: ".metric",
        property: "min-height",
        before: "116px",
        after: "148px",
        category: "layout",
        score: 8.3,
      }],
    },
    drift: {
      kind: "visual-only",
      primaryCause: "layout",
    },
    semanticDiff: {
      changed: false,
    },
  };
}

function makeReport(overrides = {}) {
  const report = {
    provider: "anthropic",
    scenario: "Release Queue",
    qualityFailures: [],
    steps: [{
      name: "observe",
      exitCode: 0,
      durationMs: 123,
    }],
    metrics: {
      visualRegressionDetected: true,
      planHasSingleScenario: true,
      locatorRoleCount: 8,
      locatorTestIdCount: 7,
      generatedLineCount: 28,
      generatedScreenshotAssertions: 2,
      generatedDirectPageGoto: false,
      generatedCommentLines: 0,
      generatedUsesReleaseRowTestId: true,
      runtimeGateRuns: 2,
      stabilityChecksPassed: true,
      stabilityCheckRuns: 2,
      repairContextAvailable: true,
      repairHintCount: 1,
      repairSelectorMatchCount: 1,
      cssAttributionCount: 1,
      driftKind: "visual-only",
      driftPrimaryCause: "layout",
      viewportContextCount: 3,
      expectedChangeApproved: true,
      vlmRegionDiffStatus: "written",
      vlmRegionChangeCount: 1,
    },
    repair: {
      failureKind: "vrt-diff",
      screenshotName: "release-queue-initial.png",
      diffRatio: 0.1,
      bbox: { left: 1, top: 2, width: 3, height: 4 },
      selectorMatches: [{ selector: ".queue", confidence: "medium" }],
      edgeCandidates: [{ selector: ".metric", reason: "4px from diff top" }],
      cssAttribution: [{
        selector: ".metric",
        property: "min-height",
        before: "116px",
        after: "148px",
        category: "layout",
        score: 8.3,
      }],
      semanticChanged: false,
      hints: ["Inspect .metric min-height."],
    },
    vlmRegionSummary: {
      available: true,
      model: "anthropic/example",
      cost: 0.01,
      summary: "Badge changed color.",
      changes: [{
        selector: ".pill",
        property: "background-color",
        from: "#fee",
        to: "#eff",
        confidence: "high",
        region: "detail badge",
      }],
    },
    artifacts: {
      reportPath: ".vrt/markup-vrt-eval/report.json",
    },
  };
  return {
    ...report,
    ...overrides,
    metrics: { ...report.metrics, ...overrides.metrics },
    repair: { ...report.repair, ...overrides.repair },
    vlmRegionSummary: { ...report.vlmRegionSummary, ...overrides.vlmRegionSummary },
    artifacts: { ...report.artifacts, ...overrides.artifacts },
  };
}
