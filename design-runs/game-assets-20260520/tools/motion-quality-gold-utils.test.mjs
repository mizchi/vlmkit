import assert from "node:assert/strict";
import test from "node:test";

import {
  createSampleSetChecks,
  summarizeGoldCoverage,
} from "./motion-quality-gold-utils.mjs";

test("createSampleSetChecks fails when the smoke report has uncalibrated extra samples", () => {
  const report = {
    samples: [
      { sample: "LookAround" },
      { sample: "Goodbye" },
      { sample: "SpinKick" },
    ],
  };
  const gold = {
    samples: {
      LookAround: {},
      Goodbye: {},
    },
  };

  const checks = createSampleSetChecks(report, gold);

  assert.equal(checks.find((check) => check.id === "samples.count")?.ok, false);
  assert.deepEqual(checks.find((check) => check.id === "samples.extra")?.value?.extraSamples, ["SpinKick"]);
  assert.deepEqual(summarizeGoldCoverage(report, gold, checks), {
    expectedSampleCount: 2,
    actualSampleCount: 3,
    matchedSampleCount: 2,
    missingSamples: [],
    extraSamples: ["SpinKick"],
    passedChecks: 1,
    failedChecks: 2,
  });
});

