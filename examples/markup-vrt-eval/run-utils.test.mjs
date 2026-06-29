import assert from "node:assert/strict";
import { test } from "node:test";
import { buildVlmRegionDiffArgs, summarizeVlmRegionDiff } from "./run-utils.mjs";

test("buildVlmRegionDiffArgs uses the current vlmkit diff region command", () => {
  assert.deepEqual(buildVlmRegionDiffArgs({
    baseline: "expected.png",
    actual: "actual.png",
    elementsJson: "elements.json",
    out: "region.json",
  }), [
    "node", "src/cli/vlmkit.ts", "diff", "region",
    "--baseline", "expected.png",
    "--variant", "actual.png",
    "--elements-json", "elements.json",
    "--out", "region.json",
    "--format", "json",
    "--max-tokens", "900",
  ]);
});

test("summarizeVlmRegionDiff keeps concise paint change handoff rows", () => {
  const summary = summarizeVlmRegionDiff({
    model: "anthropic/example",
    usage: { cost: 0.01 },
    summary: "Blocked badges changed color.",
    changes: [{
      selector: ".pill",
      selectorHint: "Release detail badge",
      property: "background-color",
      from: "#fee",
      to: "#eff",
      confidence: "high",
      region: "detail badge",
      description: "Badge changed from red to teal.",
    }],
  });

  assert.equal(summary.available, true);
  assert.equal(summary.model, "anthropic/example");
  assert.equal(summary.changeCount, 1);
  assert.equal(summary.changes[0]?.selector, ".pill");
  assert.equal(summary.changes[0]?.property, "background-color");
});
