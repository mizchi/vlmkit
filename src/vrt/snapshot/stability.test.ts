import assert from "node:assert/strict";
import { describe, it } from "vitest";
import {
  aggregateStability,
  buildStabilityHistory,
  buildStabilityReport,
  formatStabilityHistorySummary,
  formatStabilitySummary,
  type StabilityIterationResult,
} from "./stability.ts";

function r(
  iteration: number,
  label: string,
  viewport: string,
  diffRatio: number,
  extra: Partial<StabilityIterationResult> = {},
): StabilityIterationResult {
  return {
    iteration,
    url: `http://localhost:3000/${label}`,
    label,
    viewport,
    diffRatio,
    ...extra,
  };
}

describe("aggregateStability", () => {
  it("ignores iteration 0 (baseline) and aggregates the rest", () => {
    const entries = aggregateStability([
      r(0, "home", "desktop", 0),
      r(1, "home", "desktop", 0),
      r(2, "home", "desktop", 0.005),
      r(3, "home", "desktop", 0),
    ]);

    assert.equal(entries.length, 1);
    const e = entries[0]!;
    assert.equal(e.comparisons, 3);
    assert.equal(e.positives, 1);
    assert.ok(Math.abs(e.falsePositiveRate - 1 / 3) < 1e-9);
    assert.equal(e.maxDiffRatio, 0.005);
  });

  it("respects threshold when classifying positives", () => {
    const entries = aggregateStability([
      r(1, "home", "desktop", 0.005),
      r(2, "home", "desktop", 0.02),
      r(3, "home", "desktop", 0.03),
    ], { threshold: 0.01 });

    assert.equal(entries[0]!.positives, 2);
    assert.equal(entries[0]!.comparisons, 3);
  });

  it("groups by (url, label, viewport) and sorts by FP rate desc", () => {
    const entries = aggregateStability([
      r(1, "home", "desktop", 0),
      r(2, "home", "desktop", 0),
      r(1, "about", "mobile", 0.1),
      r(2, "about", "mobile", 0.2),
    ]);

    assert.equal(entries.length, 2);
    assert.equal(entries[0]!.label, "about"); // 100% FP
    assert.equal(entries[1]!.label, "home"); // 0% FP
  });

  it("uses compensated diff for maxCompensatedDiffRatio", () => {
    const entries = aggregateStability([
      r(1, "home", "desktop", 0.05, { compensatedDiffRatio: 0.001 }),
      r(2, "home", "desktop", 0.05, { compensatedDiffRatio: 0.0005 }),
    ]);

    assert.equal(entries[0]!.maxDiffRatio, 0.05);
    assert.equal(entries[0]!.maxCompensatedDiffRatio, 0.001);
  });
});

describe("buildStabilityReport", () => {
  it("rolls up totals across all entries", () => {
    const report = buildStabilityReport({
      iterations: 4,
      urls: ["http://localhost:3000/home", "http://localhost:3000/about"],
      results: [
        r(0, "home", "desktop", 0),
        r(1, "home", "desktop", 0),
        r(2, "home", "desktop", 0.005),
        r(3, "home", "desktop", 0),
        r(0, "about", "mobile", 0),
        r(1, "about", "mobile", 0.1),
        r(2, "about", "mobile", 0.05),
        r(3, "about", "mobile", 0.01),
      ],
    });

    assert.equal(report.iterations, 4);
    assert.equal(report.totalComparisons, 6);
    assert.equal(report.totalPositives, 4);
    assert.ok(Math.abs(report.overallFalsePositiveRate - 4 / 6) < 1e-9);
  });

  it("returns 0% FP rate when no comparisons", () => {
    const report = buildStabilityReport({
      iterations: 1,
      urls: ["http://localhost:3000/"],
      results: [r(0, "home", "desktop", 0)],
    });
    assert.equal(report.totalComparisons, 0);
    assert.equal(report.overallFalsePositiveRate, 0);
  });
});

describe("formatStabilitySummary", () => {
  it("renders a multi-line text summary", () => {
    const report = buildStabilityReport({
      iterations: 3,
      urls: ["http://localhost:3000/home"],
      results: [
        r(0, "home", "desktop", 0),
        r(1, "home", "desktop", 0),
        r(2, "home", "desktop", 0.005),
      ],
    });

    const text = formatStabilitySummary(report);
    assert.match(text, /Stability run: 3 iterations/);
    assert.match(text, /Overall FP rate: 50\.00%/);
    assert.match(text, /home desktop: FP 50\.00%/);
  });
});

describe("buildStabilityHistory", () => {
  it("sorts reports by timestamp and computes run-to-run deltas", () => {
    const first = buildStabilityReport({
      timestamp: "2026-05-21T00:00:00.000Z",
      iterations: 3,
      urls: ["http://localhost/home"],
      results: [
        r(0, "home", "desktop", 0),
        r(1, "home", "desktop", 0),
        r(2, "home", "desktop", 0),
      ],
    });
    const second = buildStabilityReport({
      timestamp: "2026-05-22T00:00:00.000Z",
      iterations: 3,
      urls: ["http://localhost/home"],
      results: [
        r(0, "home", "desktop", 0),
        r(1, "home", "desktop", 0.02),
        r(2, "home", "desktop", 0),
      ],
    });

    const history = buildStabilityHistory([
      { reportPath: "second.json", report: second },
      { reportPath: "first.json", report: first },
    ]);

    assert.equal(history.runs.length, 2);
    assert.equal(history.runs[0]!.reportPath, "first.json");
    assert.equal(history.runs[1]!.reportPath, "second.json");
    assert.equal(history.runs[0]!.deltaFalsePositiveRate, undefined);
    assert.equal(history.runs[1]!.overallFalsePositiveRate, 0.5);
    assert.equal(history.runs[1]!.deltaFalsePositiveRate, 0.5);
    assert.equal(history.latest?.reportPath, "second.json");
    assert.equal(history.best?.reportPath, "first.json");
    assert.equal(history.worst?.reportPath, "second.json");
  });
});

describe("formatStabilityHistorySummary", () => {
  it("renders a compact time-series summary", () => {
    const history = buildStabilityHistory([
      {
        reportPath: "a.json",
        report: {
          timestamp: "2026-05-21T00:00:00.000Z",
          iterations: 3,
          urls: ["http://localhost/home"],
          threshold: 0,
          entries: [],
          totalComparisons: 2,
          totalPositives: 0,
          overallFalsePositiveRate: 0,
        },
      },
      {
        reportPath: "b.json",
        report: {
          timestamp: "2026-05-22T00:00:00.000Z",
          iterations: 3,
          urls: ["http://localhost/home"],
          threshold: 0,
          entries: [],
          totalComparisons: 2,
          totalPositives: 1,
          overallFalsePositiveRate: 0.5,
        },
      },
    ]);

    const text = formatStabilityHistorySummary(history);

    assert.match(text, /Stability history: 2 run/);
    assert.match(text, /Latest: 50\.00%/);
    assert.match(text, /Best: 0\.00%/);
    assert.match(text, /\+50\.00%/);
    assert.match(text, /b\.json/);
  });
});
