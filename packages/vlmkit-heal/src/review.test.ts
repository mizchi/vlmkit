import { describe, it } from "vitest";
import assert from "node:assert/strict";
import { resolveIntent, parseReview, buildReviewPrompt } from "./review.ts";

describe("resolveIntent", () => {
  it("prefers expectedChange, then gitContext, then vision-only", () => {
    assert.equal(resolveIntent({ expectedChange: "x", gitContext: "y" }).intentSource, "expectedChange");
    assert.equal(resolveIntent({ gitContext: "y" }).intentSource, "gitContext");
    assert.equal(resolveIntent({}).intentSource, "vision-only");
  });
  it("includes the chosen signal text", () => {
    assert.match(resolveIntent({ expectedChange: "badge turns red" }).text, /badge turns red/);
    assert.match(resolveIntent({ gitContext: "feat: red badge" }).text, /red badge/);
    assert.equal(resolveIntent({}).text, "");
  });
});

describe("parseReview", () => {
  it("parses verdict + confidence + reason from the model's tagged output", () => {
    const r = parseReview("VERDICT: accept\nCONFIDENCE: 0.92\nREASON: matches the declared badge change", "expectedChange", 0.001);
    assert.equal(r.verdict, "accept");
    assert.equal(r.confidence, 0.92);
    assert.match(r.reason, /badge change/);
    assert.equal(r.intentSource, "expectedChange");
    assert.equal(r.costUsd, 0.001);
  });
  it("defaults to unsure on unparseable output", () => {
    const r = parseReview("I think maybe?", "vision-only", 0);
    assert.equal(r.verdict, "unsure");
  });
  it("clamps confidence to 0..1", () => {
    assert.equal(parseReview("VERDICT: reject\nCONFIDENCE: 1.5", "vision-only", 0).confidence, 1);
    assert.equal(parseReview("VERDICT: reject\nCONFIDENCE: -0.2", "vision-only", 0).confidence, 0);
  });
});

describe("buildReviewPrompt", () => {
  it("asks for the tagged format and notes vision-only when no intent", () => {
    const p = buildReviewPrompt({ intentSource: "vision-only", text: "" });
    assert.match(p, /VERDICT:/);
    assert.match(p, /CONFIDENCE:/);
    assert.match(p, /no declared intent|vision/i);
  });
  it("embeds the declared intent when present", () => {
    const p = buildReviewPrompt({ intentSource: "expectedChange", text: "badge turns red" });
    assert.match(p, /badge turns red/);
  });
});
