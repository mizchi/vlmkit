export function createSampleSetChecks(report, gold) {
  const expectedSamples = sortedSampleNames(gold?.samples);
  const actualSamples = sortedUnique((report?.samples ?? []).map((sample) => sample.sample).filter(Boolean));
  const missingSamples = expectedSamples.filter((sample) => !actualSamples.includes(sample));
  const extraSamples = actualSamples.filter((sample) => !expectedSamples.includes(sample));
  return [
    actualSamples.length === expectedSamples.length
      ? pass("samples.count", { actual: actualSamples.length, expected: expectedSamples.length })
      : fail("samples.count", "sample count mismatch", {
        actual: actualSamples.length,
        expected: expectedSamples.length,
      }),
    missingSamples.length === 0
      ? pass("samples.missing", { missingSamples })
      : fail("samples.missing", "gold sample is missing from smoke report", { missingSamples }),
    extraSamples.length === 0
      ? pass("samples.extra", { extraSamples })
      : fail("samples.extra", "smoke report includes uncalibrated samples", { extraSamples }),
  ];
}

export function summarizeGoldCoverage(report, gold, checks) {
  const expectedSamples = sortedSampleNames(gold?.samples);
  const actualSamples = sortedUnique((report?.samples ?? []).map((sample) => sample.sample).filter(Boolean));
  const missingSamples = expectedSamples.filter((sample) => !actualSamples.includes(sample));
  const extraSamples = actualSamples.filter((sample) => !expectedSamples.includes(sample));
  return {
    expectedSampleCount: expectedSamples.length,
    actualSampleCount: actualSamples.length,
    matchedSampleCount: expectedSamples.filter((sample) => actualSamples.includes(sample)).length,
    missingSamples,
    extraSamples,
    passedChecks: checks.filter((check) => check.ok).length,
    failedChecks: checks.filter((check) => !check.ok).length,
  };
}

function sortedSampleNames(samples) {
  return sortedUnique(Object.keys(samples ?? {}));
}

function sortedUnique(values) {
  return [...new Set(values)].sort((a, b) => a.localeCompare(b));
}

function pass(id, value) {
  return { id, ok: true, value };
}

function fail(id, reason, value = null) {
  return { id, ok: false, reason, value };
}

