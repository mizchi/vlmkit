import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  aggregateStability,
  buildStabilityReport,
  formatStabilitySummary,
  type StabilityIterationResult,
} from "./snapshot-stability.ts";

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
