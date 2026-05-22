import { describe, it } from "node:test";
import assert from "node:assert/strict";
import type { ViewportDetectionResult } from "./detection-types.ts";
import {
  hasAnyDetectionSignal,
  hasCraterPrescanSignal,
  resolvePrescannerTrial,
  summarizePrescannerTrials,
} from "./prescanner.ts";

function makeViewportResult(
  overrides: Partial<ViewportDetectionResult> = {},
): ViewportDetectionResult {
  return {
    width: 1280,
    height: 900,
    visualDiffDetected: false,
    visualDiffRatio: 0,
    a11yDiffDetected: false,
    a11yChangeCount: 0,
    computedStyleDiffCount: 0,
    hoverDiffDetected: false,
    paintTreeDiffCount: 0,
    ...overrides,
  };
}

describe("hasCraterPrescanSignal", () => {
  it("treats paint tree changes as crater detection", () => {
    assert.equal(hasCraterPrescanSignal([
      makeViewportResult({ paintTreeDiffCount: 2 }),
    ]), true);
  });

  it("treats native computed style changes as crater detection", () => {
    assert.equal(hasCraterPrescanSignal([
      makeViewportResult({ computedStyleDiffCount: 3 }),
    ]), true);
  });

  it("treats forced hover style changes as crater detection", () => {
    assert.equal(hasCraterPrescanSignal([
      makeViewportResult({ hoverDiffDetected: true }),
    ]), true);
  });
});

describe("hasAnyDetectionSignal", () => {
  it("treats chromium-only signals as detection", () => {
    assert.equal(hasAnyDetectionSignal([
      makeViewportResult({ computedStyleDiffCount: 1 }),
    ]), true);
    assert.equal(hasAnyDetectionSignal([
      makeViewportResult({ hoverDiffDetected: true }),
    ]), true);
  });
});

describe("resolvePrescannerTrial", () => {
  it("resolves on crater without fallback when crater sees a signal", () => {
    const resolution = resolvePrescannerTrial([
      makeViewportResult({ visualDiffDetected: true, visualDiffRatio: 0.02 }),
    ]);

    assert.deepEqual(resolution, {
      craterDetected: true,
      fallbackUsed: false,
      finalDetected: true,
      resolvedBy: "crater",
      metadataOnly: false,
      craterSignal: "visual",
    });
  });

  it("classifies metadata-only crater wins by first matching signal", () => {
    const resolution = resolvePrescannerTrial([
      makeViewportResult({
        visualCaptureSkipped: true,
        paintTreeDiffCount: 3,
        computedStyleDiffCount: 1,
      }),
    ]);

    assert.equal(resolution.resolvedBy, "crater");
    assert.equal(resolution.metadataOnly, true);
    assert.equal(resolution.craterSignal, "paint-tree");
  });

  it("classifies computed-style as the next signal when no paint tree diff", () => {
    const resolution = resolvePrescannerTrial([
      makeViewportResult({
        visualCaptureSkipped: true,
        computedStyleDiffCount: 2,
      }),
    ]);

    assert.equal(resolution.craterSignal, "computed-style");
    assert.equal(resolution.metadataOnly, true);
  });

  it("classifies forced-state as the signal when only hover diff fires", () => {
    const resolution = resolvePrescannerTrial([
      makeViewportResult({ visualCaptureSkipped: true, hoverDiffDetected: true }),
    ]);

    assert.equal(resolution.craterSignal, "forced-state");
  });

  it("falls back to chromium when crater is silent and detects chromium-only signals", () => {
    const resolution = resolvePrescannerTrial(
      [makeViewportResult({ visualCaptureSkipped: true })],
      [makeViewportResult({ computedStyleDiffCount: 2 })],
    );

    assert.deepEqual(resolution, {
      craterDetected: false,
      fallbackUsed: true,
      finalDetected: true,
      resolvedBy: "chromium",
      metadataOnly: true,
      craterSignal: "none",
    });
  });

  it("returns pass when both crater and chromium are silent", () => {
    const resolution = resolvePrescannerTrial(
      [makeViewportResult()],
      [makeViewportResult()],
    );

    assert.deepEqual(resolution, {
      craterDetected: false,
      fallbackUsed: true,
      finalDetected: false,
      resolvedBy: "none",
      metadataOnly: false,
      craterSignal: "none",
    });
  });
});

describe("summarizePrescannerTrials", () => {
  it("counts crater resolution and chromium fallback separately", () => {
    const summary = summarizePrescannerTrials([
      { craterDetected: true, fallbackUsed: false, finalDetected: true, resolvedBy: "crater", metadataOnly: false, craterSignal: "visual" },
      { craterDetected: false, fallbackUsed: true, finalDetected: true, resolvedBy: "chromium", metadataOnly: false, craterSignal: "none" },
      { craterDetected: false, fallbackUsed: true, finalDetected: false, resolvedBy: "none", metadataOnly: false, craterSignal: "none" },
    ]);

    assert.deepEqual(summary, {
      total: 3,
      detected: 2,
      craterResolved: 1,
      chromiumFallbacks: 2,
      chromiumDetected: 1,
      passedAfterFallback: 1,
      metadataOnly: 0,
      craterBySignal: { paintTree: 0, computedStyle: 0, forcedState: 0, visual: 1 },
    });
  });

  it("counts metadata-only crater wins and per-signal breakdown", () => {
    const summary = summarizePrescannerTrials([
      { craterDetected: true, fallbackUsed: false, finalDetected: true, resolvedBy: "crater", metadataOnly: true, craterSignal: "paint-tree" },
      { craterDetected: true, fallbackUsed: false, finalDetected: true, resolvedBy: "crater", metadataOnly: true, craterSignal: "computed-style" },
      { craterDetected: true, fallbackUsed: false, finalDetected: true, resolvedBy: "crater", metadataOnly: false, craterSignal: "forced-state" },
    ]);

    assert.equal(summary.craterResolved, 3);
    assert.equal(summary.metadataOnly, 2);
    assert.deepEqual(summary.craterBySignal, {
      paintTree: 1,
      computedStyle: 1,
      forcedState: 1,
      visual: 0,
    });
  });
});
