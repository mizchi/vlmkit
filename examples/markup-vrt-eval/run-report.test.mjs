import assert from "node:assert/strict";
import { test } from "node:test";
import {
  buildQualityFailures,
  buildReport,
  renderReportArtifacts,
} from "./run-report.mjs";

test("run-report exposes only the orchestration API used across module boundaries", async () => {
  const reportModule = await import("./run-report.mjs");

  assert.deepEqual(Object.keys(reportModule).sort(), [
    "buildQualityFailures",
    "buildReport",
    "renderReportArtifacts",
  ]);
});

test("buildReport owns expected-change approval and repair image artifact mapping", () => {
  const report = buildReport(makeReportInput());

  assert.equal(report.expectedChangeApproval.approved, true);
  assert.deepEqual(report.expectedChangeApproval.reasons, []);
  assert.deepEqual(report.repair.artifacts, {
    expectedPng: ".vrt/markup-vrt-eval/test-results/expected.png",
    actualPng: ".vrt/markup-vrt-eval/test-results/actual.png",
    diffPng: ".vrt/markup-vrt-eval/test-results/diff.png",
  });
});

test("buildReport rejects expected change approval when the expected regression is not observed", () => {
  const report = buildReport(makeReportInput({ visualRegressionDetected: false }));

  assert.equal(report.expectedChangeApproval.approved, false);
  assert.match(report.expectedChangeApproval.reasons.join("\n"), /visual regression was not detected/);
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
  const { markdown } = renderReportArtifacts({
    report: makeReport({
      artifacts: {
        reportPath: ".vrt/markup-vrt-eval/report.json",
        vlmRegionDiffPath: null,
      },
    }),
    guardrailSources: makeGuardrailSources(),
  });

  assert.match(markdown, /### VLM Region Diff/);
  assert.match(markdown, /\.pill: background-color `#fee` -> `#eff` \(high\)/);
  assert.match(markdown, /reportPath: `\.vrt\/markup-vrt-eval\/report\.json`/);
  assert.doesNotMatch(markdown, /vlmRegionDiffPath/);
});

test("renderReportArtifacts escapes HTML data and uses report-contained image artifacts", () => {
  const { html } = renderReportArtifacts({
    report: makeReport({
      scenario: "<script>alert(1)</script>",
      repair: {
        artifacts: {
          expectedPng: ".vrt/markup-vrt-eval/test-results/expected.png",
          actualPng: null,
          diffPng: null,
        },
      },
    }),
    guardrailSources: makeGuardrailSources(),
  });

  assert.match(html, /test-results\/expected\.png/);
  assert.doesNotMatch(html, /\.vrt\/markup-vrt-eval\/test-results\/expected\.png/);
  assert.doesNotMatch(html, /<script>alert\(1\)<\/script>/);
  assert.match(html, /&lt;script&gt;alert\(1\)&lt;\/script&gt;/);
});

test("renderReportArtifacts surfaces CI-friendly dogfood status", () => {
  const { githubStepSummary } = renderReportArtifacts({
    report: makeReport(),
    guardrailSources: makeGuardrailSources(),
  });

  assert.match(githubStepSummary, /# Markup VRT Dogfood/);
  assert.match(githubStepSummary, /\| Quality gate failures \| 0 \|/);
  assert.match(githubStepSummary, /\| Visual regression \| detected \|/);
  assert.match(githubStepSummary, /\| Diff ratio \| 10\.00% \|/);
  assert.match(githubStepSummary, /Inspect \.metric min-height\./);
  assert.doesNotMatch(githubStepSummary, /undefined|null/);
});

test("renderReportArtifacts combines request, plan, locators, repair signals, and VLM handoff", () => {
  const { guardrailContext } = renderReportArtifacts({
    report: makeReport(),
    guardrailSources: makeGuardrailSources(),
  });

  assert.match(guardrailContext, /# Markup VRT Heal Guardrail Context/);
  assert.match(guardrailContext, /Do not weaken the scenario/);
  assert.match(guardrailContext, /Keep the blocked filter and detail panel scenario/);
  assert.match(guardrailContext, /release-row-invoice-export/);
  assert.match(guardrailContext, /\.metric: min-height `116px` -> `148px`/);
  assert.match(guardrailContext, /\.pill: background-color `#fee` -> `#eff`/);
});

function makeReportInput(overrides = {}) {
  const input = {
    provider: "anthropic",
    scenario: "Release Queue",
    steps: [{ name: "observe", exitCode: 0, durationMs: 123 }],
    generatedSource: [
      "test('Release Queue', async ({ page }) => {",
      "  await expect(page.getByTestId(\"release-row-invoice-export\")).toBeVisible();",
      "  await expect(page).toHaveScreenshot('initial.png');",
      "  await expect(page).toHaveScreenshot('filtered.png');",
      "});",
    ].join("\n"),
    plan: "# Plan\n### Blocked filter and Invoice Export detail panel\n",
    locators: {
      roles: ['button "Blocked"'],
      testIds: ["release-row-invoice-export"],
    },
    visualContext: { viewports: [{}, {}, {}] },
    repairContext: makeRepairContext(),
    stabilityRuns: [{ exitCode: 0 }, { exitCode: 0 }],
    visualRegressionDetected: true,
    expectedChange: {
      expectedFailureKind: "vrt-diff",
      expectedDriftKind: "visual-only",
      allowedPrimaryCauses: ["layout"],
      allowedSelectors: [".metric"],
    },
    vlmRegionDiffStatus: "written",
    vlmRegionSummary: makeVlmRegionSummary(),
    artifacts: {
      reportPath: ".vrt/markup-vrt-eval/report.json",
    },
  };
  return {
    ...input,
    ...overrides,
    locators: { ...input.locators, ...overrides.locators },
    visualContext: { ...input.visualContext, ...overrides.visualContext },
    repairContext: { ...input.repairContext, ...overrides.repairContext },
    expectedChange: { ...input.expectedChange, ...overrides.expectedChange },
    vlmRegionSummary: { ...input.vlmRegionSummary, ...overrides.vlmRegionSummary },
    artifacts: { ...input.artifacts, ...overrides.artifacts },
  };
}

function makeGuardrailSources() {
  return {
    requestMarkdown: "# Request\nKeep the blocked filter and detail panel scenario.",
    planMarkdown: "# Plan\n### Blocked filter and Invoice Export detail panel",
    locatorInventory: {
      roles: ['button "Blocked"'],
      testIds: ["release-row-invoice-export"],
    },
    generationRulesMarkdown: "- Use gotoApp(page).",
  };
}

function makeVlmRegionSummary() {
  return {
    available: true,
    model: "anthropic/example",
    cost: 0.01,
    summary: "Badge changed color.",
    changeCount: 1,
    changes: [{
      selector: ".pill",
      property: "background-color",
      from: "#fee",
      to: "#eff",
      confidence: "high",
      region: "detail badge",
    }],
  };
}

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
    artifacts: {
      expectedPng: ".vrt/markup-vrt-eval/test-results/expected.png",
      actualPng: ".vrt/markup-vrt-eval/test-results/actual.png",
      diffPng: ".vrt/markup-vrt-eval/test-results/diff.png",
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
      artifacts: {
        expectedPng: ".vrt/markup-vrt-eval/test-results/expected.png",
        actualPng: ".vrt/markup-vrt-eval/test-results/actual.png",
        diffPng: ".vrt/markup-vrt-eval/test-results/diff.png",
      },
      semanticChanged: false,
      hints: ["Inspect .metric min-height."],
    },
    vlmRegionSummary: makeVlmRegionSummary(),
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
