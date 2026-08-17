import assert from "node:assert/strict";
import { test } from "vitest";
import { summarizeVlmRegionDiff } from "./run-utils.mjs";

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
