import assert from "node:assert/strict";
import { describe, it } from "vitest";
import {
  buildSnapshotStatusMatrix,
  determineSnapshotReportEvaluationExitStatus,
  determineSnapshotReportExitStatus,
  formatSnapshotReportEvaluationMarkdown,
  formatSnapshotSummaryMarkdown,
  parseSnapshotReportCliArgs,
  summarizeSnapshotReportEvaluation,
  summarizeSnapshotReport,
  type SnapshotReportDocument,
} from "./snapshot-report.ts";

function makeReport(): SnapshotReportDocument {
  return {
    timestamp: "2026-04-09T12:00:00.000Z",
    urls: [
      "http://localhost:4174/page.html",
      "http://localhost:4174/dashboard.html",
    ],
    labels: ["page", "dashboard"],
    options: {
      threshold: 0.1,
      failOnDiff: false,
      failOnNewBaseline: false,
      maxDiffRatio: null,
      configPath: ".github/vrt-snapshot-ci.config.json",
    },
    results: [
      { label: "page", viewport: "desktop", isNew: false, diffRatio: 0 },
      { label: "page", viewport: "mobile", isNew: false, diffRatio: 0.02 },
      { label: "dashboard", viewport: "desktop", isNew: false, diffRatio: 0.01, shiftOnly: true },
      { label: "dashboard", viewport: "mobile", isNew: true },
    ],
    exitStatus: { exitCode: 0, reasons: [] },
  };
}

describe("summarizeSnapshotReport", () => {
  it("calculates false positive metrics from compared results", () => {
    const metrics = summarizeSnapshotReport(makeReport());

    assert.equal(metrics.totalCount, 4);
    assert.equal(metrics.comparedCount, 3);
    assert.equal(metrics.newBaselineCount, 1);
    assert.equal(metrics.diffCount, 2);
    assert.equal(metrics.cleanCount, 1);
    assert.equal(metrics.shiftOnlyCount, 1);
    assert.equal(metrics.falsePositiveRate, 2 / 3);
    assert.equal(metrics.maxDiffRatio, 0.02);
    assert.deepEqual(metrics.labelsWithDiff, ["dashboard", "page"]);
    assert.deepEqual(metrics.worstDiff, {
      label: "page",
      viewport: "mobile",
      diffRatio: 0.02,
      shiftOnly: false,
    });
  });
});

describe("buildSnapshotStatusMatrix", () => {
  it("normalizes snapshot entries into a component by viewport status matrix", () => {
    const matrix = buildSnapshotStatusMatrix({
      ...makeReport(),
      labels: ["page", "dashboard", "settings"],
      results: [
        { label: "page", viewport: "desktop", isNew: false, diffRatio: 0 },
        { label: "page", viewport: "mobile", isNew: false, diffRatio: 0.02 },
        { label: "dashboard", viewport: "desktop", isNew: false, diffRatio: 0.01, shiftOnly: true },
        { label: "dashboard", viewport: "mobile", isNew: true },
      ],
    });

    assert.deepEqual(matrix.components, ["page", "dashboard", "settings"]);
    assert.deepEqual(matrix.viewports, ["desktop", "mobile"]);
    assert.equal(matrix.rows[0]?.component, "page");
    assert.deepEqual(matrix.rows[0]?.cells.map((cell) => cell.status), ["pass", "diff"]);
    assert.equal(matrix.rows[1]?.worstStatus, "new-baseline");
    assert.deepEqual(matrix.rows[1]?.cells.map((cell) => cell.status), ["shift-only", "new-baseline"]);
    assert.deepEqual(matrix.rows[2]?.cells.map((cell) => cell.status), ["missing", "missing"]);
    assert.equal(matrix.summary.totalCells, 6);
    assert.equal(matrix.summary.passCount, 1);
    assert.equal(matrix.summary.diffCount, 1);
    assert.equal(matrix.summary.shiftOnlyCount, 1);
    assert.equal(matrix.summary.newBaselineCount, 1);
    assert.equal(matrix.summary.missingCount, 2);
    assert.equal(matrix.summary.maxDiffRatio, 0.02);
  });

  it("can filter components and viewports for focused dashboard panes", () => {
    const matrix = buildSnapshotStatusMatrix(makeReport(), {
      labels: ["dashboard"],
      viewports: ["desktop"],
    });

    assert.deepEqual(matrix.components, ["dashboard"]);
    assert.deepEqual(matrix.viewports, ["desktop"]);
    assert.equal(matrix.rows.length, 1);
    assert.equal(matrix.rows[0]?.cells[0]?.status, "shift-only");
  });
});

describe("determineSnapshotReportExitStatus", () => {
  it("passes when metrics stay within thresholds", () => {
    const result = determineSnapshotReportExitStatus(
      summarizeSnapshotReport(makeReport()),
      { maxFalsePositiveRate: 0.7, maxDiffRatio: 0.02 },
    );

    assert.equal(result.exitCode, 0);
    assert.deepEqual(result.reasons, []);
  });

  it("fails when false positive rate exceeds the configured threshold", () => {
    const result = determineSnapshotReportExitStatus(
      summarizeSnapshotReport(makeReport()),
      { maxFalsePositiveRate: 0.5 },
    );

    assert.equal(result.exitCode, 1);
    assert.match(result.reasons[0] ?? "", /false positive rate/i);
  });

  it("fails when the worst diff ratio exceeds the configured threshold", () => {
    const result = determineSnapshotReportExitStatus(
      summarizeSnapshotReport(makeReport()),
      { maxDiffRatio: 0.015 },
    );

    assert.equal(result.exitCode, 1);
    assert.match(result.reasons[0] ?? "", /max diff ratio/i);
  });
});

describe("summarizeSnapshotReportEvaluation", () => {
  it("measures resolved and improved rates for before/after fix reports", () => {
    const before: SnapshotReportDocument = {
      ...makeReport(),
      results: [
        { label: "page", viewport: "desktop", isNew: false, diffRatio: 0.02 },
        { label: "page", viewport: "mobile", isNew: false, diffRatio: 0.02 },
        { label: "dashboard", viewport: "desktop", isNew: false, diffRatio: 0 },
        { label: "dashboard", viewport: "mobile", isNew: true },
      ],
    };
    const after: SnapshotReportDocument = {
      ...makeReport(),
      results: [
        { label: "page", viewport: "desktop", isNew: false, diffRatio: 0 },
        { label: "page", viewport: "mobile", isNew: false, diffRatio: 0.01 },
        { label: "dashboard", viewport: "desktop", isNew: false, diffRatio: 0 },
        { label: "dashboard", viewport: "mobile", isNew: true },
      ],
    };

    const summary = summarizeSnapshotReportEvaluation(before, after);

    assert.equal(summary.targetCount, 2);
    assert.equal(summary.resolvedCount, 1);
    assert.equal(summary.improvedCount, 2);
    assert.equal(summary.successRate, 0.5);
    assert.equal(summary.improvementRate, 1);
    assert.equal(summary.targets[0]?.label, "page");
    assert.equal(summary.targets[0]?.viewport, "desktop");
    assert.equal(summary.targets[0]?.result, "resolved");
    assert.equal(summary.targets[1]?.result, "improved");
  });
});

describe("determineSnapshotReportEvaluationExitStatus", () => {
  it("fails when success rate stays below the configured threshold", () => {
    const before = makeReport();
    const after: SnapshotReportDocument = {
      ...makeReport(),
      results: before.results,
    };

    const result = determineSnapshotReportEvaluationExitStatus(
      summarizeSnapshotReportEvaluation(before, after),
      { minSuccessRate: 0.1 },
    );

    assert.equal(result.exitCode, 1);
    assert.match(result.reasons[0] ?? "", /success rate/i);
  });
});

describe("parseSnapshotReportCliArgs", () => {
  it("parses report path and thresholds", () => {
    const parsed = parseSnapshotReportCliArgs([
      "test-results/snapshots/ci/snapshot-report.json",
      "--max-false-positive-rate", "0",
      "--max-diff-ratio", "0.001",
      "--github-step-summary", "/tmp/summary.md",
      "--format", "json",
    ]);

    assert.equal(parsed.mode, "summary");
    assert.equal(parsed.reportPath, "test-results/snapshots/ci/snapshot-report.json");
    assert.equal(parsed.maxFalsePositiveRate, 0);
    assert.equal(parsed.maxDiffRatio, 0.001);
    assert.equal(parsed.githubStepSummaryPath, "/tmp/summary.md");
    assert.equal(parsed.format, "json");
  });

  it("parses before/after evaluation reports and thresholds", () => {
    const parsed = parseSnapshotReportCliArgs([
      "evaluate",
      "--before-report", "before/snapshot-report.json",
      "--after-report", "after/snapshot-report.json",
      "--min-success-rate", "0.5",
      "--min-improvement-rate", "1",
      "--output", "artifacts/snapshot-fix-eval.md",
      "--format", "json",
    ]);

    assert.equal(parsed.mode, "evaluate");
    assert.equal(parsed.beforeReportPath, "before/snapshot-report.json");
    assert.equal(parsed.afterReportPath, "after/snapshot-report.json");
    assert.equal(parsed.minSuccessRate, 0.5);
    assert.equal(parsed.minImprovementRate, 1);
    assert.equal(parsed.outputPath, "artifacts/snapshot-fix-eval.md");
    assert.equal(parsed.format, "json");
  });
});

describe("formatSnapshotSummaryMarkdown", () => {
  it("renders a PR-friendly markdown summary", () => {
    const markdown = formatSnapshotSummaryMarkdown(
      summarizeSnapshotReport(makeReport()),
      { reportPath: "test-results/snapshots/ci/snapshot-report.json" },
    );

    assert.match(markdown, /False positive rate/);
    assert.match(markdown, /66\.7%/);
    assert.match(markdown, /Worst diff/);
    assert.match(markdown, /page \/ mobile/);
  });
});

describe("formatSnapshotReportEvaluationMarkdown", () => {
  it("renders a fix success summary", () => {
    const before: SnapshotReportDocument = {
      ...makeReport(),
      results: [
        { label: "page", viewport: "desktop", isNew: false, diffRatio: 0.02 },
        { label: "page", viewport: "mobile", isNew: false, diffRatio: 0.02 },
        { label: "dashboard", viewport: "desktop", isNew: false, diffRatio: 0 },
        { label: "dashboard", viewport: "mobile", isNew: true },
      ],
    };
    const after: SnapshotReportDocument = {
      ...makeReport(),
      results: [
        { label: "page", viewport: "desktop", isNew: false, diffRatio: 0 },
        { label: "page", viewport: "mobile", isNew: false, diffRatio: 0.01 },
        { label: "dashboard", viewport: "desktop", isNew: false, diffRatio: 0 },
        { label: "dashboard", viewport: "mobile", isNew: true },
      ],
    };

    const markdown = formatSnapshotReportEvaluationMarkdown(
      summarizeSnapshotReportEvaluation(before, after),
      {
        beforeReportPath: "before/snapshot-report.json",
        afterReportPath: "after/snapshot-report.json",
      },
    );

    assert.match(markdown, /VRT Snapshot Fix Evaluation/);
    assert.match(markdown, /Success rate: 50\.0%/);
    assert.match(markdown, /page \/ desktop/);
    assert.match(markdown, /resolved/);
  });
});
