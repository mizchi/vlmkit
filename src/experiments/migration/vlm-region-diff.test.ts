import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { parseVlmResponse } from "./vlm-region-diff.ts";

describe("parseVlmResponse", () => {
  it("parses a strict JSON response with regions", () => {
    const raw = JSON.stringify({
      verdict: "diff",
      regions: [
        { region: "background", baselineColor: "#050505", variantColor: "#070707", description: "darker on baseline" },
      ],
      summary: "One color shift detected",
    });
    const result = parseVlmResponse(raw);
    assert.equal(result.verdict, "diff");
    assert.equal(result.regions.length, 1);
    assert.equal(result.regions[0]?.baselineColor, "#050505");
    assert.equal(result.summary, "One color shift detected");
  });

  it("strips markdown fences around the JSON block", () => {
    const raw = "Sure! Here's the analysis:\n\n```json\n" +
      JSON.stringify({ verdict: "no-diff", regions: [], summary: "looks the same" }) +
      "\n```\n";
    const result = parseVlmResponse(raw);
    assert.equal(result.verdict, "no-diff");
  });

  it("falls back to uncertain when the JSON is malformed", () => {
    const result = parseVlmResponse("not json at all");
    assert.equal(result.verdict, "uncertain");
  });

  it("normalizes unrecognized verdicts to 'uncertain'", () => {
    const raw = JSON.stringify({ verdict: "weird", regions: [], summary: "x" });
    const result = parseVlmResponse(raw);
    assert.equal(result.verdict, "uncertain");
  });

  it("drops malformed region entries", () => {
    const raw = JSON.stringify({
      verdict: "diff",
      regions: [
        { region: "ok", baselineColor: "#aaa", variantColor: "#bbb", description: "good" },
        "not-an-object",
        { region: 42 },
      ],
      summary: "",
    });
    const result = parseVlmResponse(raw);
    assert.equal(result.regions.length, 2, "string entry dropped, missing-fields entry produces a partial");
    assert.equal(result.regions[0]?.region, "ok");
    assert.equal(result.regions[1]?.region, "(unnamed)");
  });
});
