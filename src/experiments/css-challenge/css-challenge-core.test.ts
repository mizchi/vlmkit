import { describe, it } from "vitest";
import assert from "node:assert/strict";
import type { PaintTreeChange } from "@mizchi/vlmkit-capture/crater-client.ts";
import type { VrtDiff, VrtSnapshot } from "@mizchi/vlmkit-core/types.ts";
import { parseApprovalManifest } from "../../vrt/snapshot/approval.ts";
import {
  analyzeVrtDiff,
  applyApprovalsToAnalysisSignals,
  captureCraterForcedStateStyles,
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
