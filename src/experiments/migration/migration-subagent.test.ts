import assert from "node:assert/strict";
import { describe, it } from "vitest";
import type { MigrationFixCandidate } from "./migration-fix-candidates.ts";
import {
  buildMigrationSubagentTask,
  determineMigrationSubagentExitStatus,
  formatMigrationSubagentEvaluationMarkdown,
  selectMigrationFixTargetsByVariant,
  summarizeMigrationSubagentEvaluation,
} from "./migration-subagent.ts";
import type { MigrationCompareReport } from "./migration-fix-loop-core.ts";

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

function createBeforeReport(): MigrationCompareReport {
  return {
    dir: "fixtures/migration/example",
    baseline: "before.html",
    variants: ["after-a.html", "after-b.html"],
    viewports: [
      { width: 375, height: 812, label: "mobile", reason: "standard" },
      { width: 1280, height: 900, label: "desktop", reason: "standard" },
    ],
    results: [
      {
        variant: "after-a",
        viewport: "mobile",
        diffRatio: 0.03,
        diffPixels: 300,
        dominantCategory: "spacing",
        categorySummary: "3 spacing",
        paintTreeSummary: "1 geometry",
        paintTreeChangeCount: 1,
        fixCandidates: [createCandidate()],
      },
      {
        variant: "after-a",
        viewport: "desktop",
        diffRatio: 0.01,
        diffPixels: 100,
        dominantCategory: "spacing",
        categorySummary: "1 spacing",
        paintTreeSummary: "1 geometry",
        paintTreeChangeCount: 1,
        fixCandidates: [createCandidate()],
      },
      {
        variant: "after-b",
        viewport: "mobile",
        diffRatio: 0.05,
        diffPixels: 500,
        dominantCategory: "layout-shift",
        categorySummary: "2 layout-shift",
        paintTreeSummary: "2 geometry",
        paintTreeChangeCount: 2,
        fixCandidates: [
          createCandidate({
            selector: ".panel",
            property: "gap",
            value: "20px",
            category: "layout",
            score: 12,
            reasoning: "layout-shift mismatch",
          }),
        ],
      },
      {
        variant: "after-b",
        viewport: "desktop",
        diffRatio: 0.02,
        diffPixels: 200,
        dominantCategory: "layout-shift",
        categorySummary: "1 layout-shift",
        paintTreeSummary: "1 geometry",
        paintTreeChangeCount: 1,
        fixCandidates: [
          createCandidate({
            selector: ".panel",
            property: "gap",
            value: "20px",
            category: "layout",
            score: 8,
            reasoning: "layout-shift mismatch",
          }),
        ],
      },
    ],
  };
}

function createAfterReport(): MigrationCompareReport {
  return {
    ...createBeforeReport(),
    results: [
      {
        ...createBeforeReport().results[0]!,
        diffRatio: 0,
        diffPixels: 0,
      },
      {
        ...createBeforeReport().results[1]!,
        diffRatio: 0,
        diffPixels: 0,
      },
      {
        ...createBeforeReport().results[2]!,
        diffRatio: 0.015,
        diffPixels: 150,
      },
      {
        ...createBeforeReport().results[3]!,
        diffRatio: 0.01,
        diffPixels: 100,
      },
    ],
  };
}

describe("selectMigrationFixTargetsByVariant", () => {
  it("selects the highest-impact target for each variant", () => {
    const targets = selectMigrationFixTargetsByVariant(createBeforeReport());

    assert.equal(targets.length, 2);
    assert.deepEqual(
      targets.map((target) => [target.variant, target.viewport, target.diffPixels]),
      [
        ["after-a", "mobile", 300],
        ["after-b", "mobile", 500],
      ],
    );
  });
});

describe("buildMigrationSubagentTask", () => {
  it("packages a prompt and target metadata for an external fixer", () => {
    const target = selectMigrationFixTargetsByVariant(createBeforeReport())[0]!;
    const task = buildMigrationSubagentTask({
      baselineFile: "before.html",
      variantFile: "after-a.html",
      currentCss: ".card { padding: 8px; }",
      target,
    });

    assert.equal(task.variant, "after-a");
    assert.equal(task.viewport, "mobile");
    assert.equal(task.diffPixels, 300);
    assert.equal(task.fixCandidates[0]?.selector, ".card");
    assert.match(task.prompt, /Return exactly one CSS declaration change/);
    assert.match(task.prompt, /\.card \{ padding: 8px; \}/);
  });
});

describe("summarizeMigrationSubagentEvaluation", () => {
  it("reports resolved and improved success rates per variant", () => {
    const summary = summarizeMigrationSubagentEvaluation(
      createBeforeReport(),
      createAfterReport(),
    );

    assert.equal(summary.variantCount, 2);
    assert.equal(summary.resolvedCount, 1);
    assert.equal(summary.improvedCount, 2);
    assert.equal(summary.successRate, 0.5);
    assert.equal(summary.improvementRate, 1);
    assert.equal(summary.variants[0]?.variant, "after-a");
    assert.equal(summary.variants[0]?.resolved, true);
    assert.equal(summary.variants[1]?.variant, "after-b");
    assert.equal(summary.variants[1]?.resolved, false);
    assert.equal(summary.variants[1]?.improved, true);
  });
});

describe("determineMigrationSubagentExitStatus", () => {
  it("fails when success rate stays below threshold", () => {
    const result = determineMigrationSubagentExitStatus(
      summarizeMigrationSubagentEvaluation(createBeforeReport(), createAfterReport()),
      { minSuccessRate: 0.75 },
    );

    assert.equal(result.exitCode, 1);
    assert.match(result.reasons[0] ?? "", /success rate/i);
  });
});

describe("formatMigrationSubagentEvaluationMarkdown", () => {
  it("renders a compact evaluation summary", () => {
    const markdown = formatMigrationSubagentEvaluationMarkdown(
      summarizeMigrationSubagentEvaluation(createBeforeReport(), createAfterReport()),
      {
        beforeReportPath: "test-results/migration/diff-report.json",
        afterReportPath: "test-results/migration/migration-report.after.json",
      },
    );

    assert.match(markdown, /Success rate/);
    assert.match(markdown, /50\.0%/);
    assert.match(markdown, /after-a/);
    assert.match(markdown, /after-b/);
  });
});
