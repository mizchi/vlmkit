import assert from "node:assert/strict";
import test from "node:test";

import {
  attachNormalizationReadiness,
  summarizeNormalizationSelection,
} from "./motion-normalization-selection-utils.mjs";

test("attachNormalizationReadiness blocks default changes until enough clean comparisons exist", () => {
  const groups = [
    {
      id: "stance-width-adapter",
      recommendation: "promotable",
      automatic: false,
      comparedSampleCount: 2,
      decisions: {
        candidateImproved: 2,
        candidateRegressed: 0,
        candidateTradeoff: 0,
        stable: 0,
        missingComparison: 0,
        missingSampleComparison: 0,
      },
    },
    {
      id: "root-scale-to-model",
      recommendation: "promotable",
      automatic: false,
      comparedSampleCount: 3,
      decisions: {
        candidateImproved: 3,
        candidateRegressed: 0,
        candidateTradeoff: 0,
        stable: 0,
        missingComparison: 0,
        missingSampleComparison: 0,
      },
    },
  ];

  const readyGroups = attachNormalizationReadiness(groups);

  assert.equal(readyGroups[0].readiness.status, "needs-more-samples");
  assert.equal(readyGroups[0].readiness.defaultChangeReady, false);
  assert.equal(readyGroups[1].readiness.status, "ready");
  assert.equal(readyGroups[1].readiness.defaultChangeReady, true);
  assert.equal(summarizeNormalizationSelection(readyGroups, { summary: { runnable: 5, blocked: 1 } }).readyDefaultChanges, 1);
});

