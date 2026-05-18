import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  determineSnapshotReportExitStatus,
  formatSnapshotSummaryMarkdown,
  parseSnapshotReportCliArgs,
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

describe("parseSnapshotReportCliArgs", () => {
  it("parses report path and thresholds", () => {
    const parsed = parseSnapshotReportCliArgs([
      "test-results/snapshots/ci/snapshot-report.json",
      "--max-false-positive-rate", "0",
      "--max-diff-ratio", "0.001",
      "--github-step-summary", "/tmp/summary.md",
      "--format", "json",
    ]);

    assert.equal(parsed.reportPath, "test-results/snapshots/ci/snapshot-report.json");
    assert.equal(parsed.maxFalsePositiveRate, 0);
    assert.equal(parsed.maxDiffRatio, 0.001);
    assert.equal(parsed.githubStepSummaryPath, "/tmp/summary.md");
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
