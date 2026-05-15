import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { MatchedBbox } from "./component-bbox.ts";
import type { MatchedTextRow } from "./text-rows.ts";
import { parseDesignTokens } from "./design-md-tokens.ts";
import { generateWireframeFixCandidates } from "./wireframe-fix-candidates.ts";

const PAWS = parseDesignTokens(`---
spacing:
  xs: 4px
  sm: 12px
  gutter: 16px
  md: 24px
  lg: 40px
---`);

function bbox(rank: number, deltaTop: number, w = 200, h = 100): MatchedBbox {
  const baseline = { rank, top: 0, left: 0, width: w, height: h, area: w * h, fillColor: "rgb(0,0,0)" };
  const variant = { ...baseline, top: deltaTop };
  return { rank, baseline, variant, deltaTop, deltaLeft: 0, deltaWidth: 0, deltaHeight: 0, iou: 0.9 };
}

function row(text: string, deltaY: number): MatchedTextRow {
  return {
    rank: 0,
    baseline: { rank: 0, yCenter: 100, yTop: 95, yBottom: 105, ink: 10, text },
    variant: { rank: 0, yCenter: 100 + deltaY, yTop: 95 + deltaY, yBottom: 105 + deltaY, ink: 10, text },
    deltaY,
  };
}

describe("generateWireframeFixCandidates", () => {
  it("returns nothing when there are no significant deltas", () => {
    const out = generateWireframeFixCandidates({
      bboxByViewport: [{ viewport: "desktop", matches: [bbox(0, 1)] }],
      textRowsByViewport: [],
    });
    assert.equal(out.length, 0);
  });

  it("groups same-direction bbox shifts across viewports", () => {
    const out = generateWireframeFixCandidates({
      bboxByViewport: [
        { viewport: "desktop", matches: [bbox(0, 12)] },
        { viewport: "wide", matches: [bbox(0, 12)] },
      ],
      textRowsByViewport: [],
    });
    assert.equal(out.length, 1);
    assert.equal(out[0].viewports.length, 2);
    assert.equal(out[0].deltaPx, 12);
    assert.equal(out[0].confidence, "medium"); // No tokens → not snapped
  });

  it("snaps to nearest spacing token when tokens are provided", () => {
    const out = generateWireframeFixCandidates({
      bboxByViewport: [
        { viewport: "desktop", matches: [bbox(0, 24)] },
        { viewport: "wide", matches: [bbox(0, 24)] },
      ],
      textRowsByViewport: [],
      tokens: PAWS,
    });
    assert.equal(out.length, 1);
    assert.match(out[0].suggestion, /token: md \(24px\)/);
    assert.equal(out[0].confidence, "high");
  });

  it("flags single-viewport shifts as media-query-gated (medium with token)", () => {
    const out = generateWireframeFixCandidates({
      bboxByViewport: [{ viewport: "mobile", matches: [bbox(0, 16)] }],
      textRowsByViewport: [],
      tokens: PAWS,
    });
    // Single-viewport, snapped → high (we treat large + snapped as high).
    assert.equal(out.length, 1);
    assert.deepEqual(out[0].viewports, ["mobile"]);
    assert.match(out[0].suggestion, /token: gutter \(16px\)/);
  });

  it("includes text-row evidence when bbox bucket misses a shift", () => {
    const out = generateWireframeFixCandidates({
      bboxByViewport: [],
      textRowsByViewport: [
        {
          viewport: "mobile",
          matches: [row("Header", -16), row("Body line 1", -16), row("Body line 2", -16)],
        },
      ],
      tokens: PAWS,
    });
    assert.ok(out.some((s) => s.evidence.includes("text-row")));
    const tr = out.find((s) => s.evidence.includes("text-row"))!;
    assert.match(tr.suggestion, /token: gutter \(16px\)/);
  });

  it("sorts high confidence + large delta first", () => {
    const out = generateWireframeFixCandidates({
      bboxByViewport: [
        { viewport: "desktop", matches: [bbox(0, 24), bbox(1, 4)] },
        { viewport: "wide", matches: [bbox(0, 24), bbox(1, 4)] },
      ],
      textRowsByViewport: [],
      tokens: PAWS,
    });
    assert.ok(out.length >= 2);
    assert.equal(out[0].deltaPx, 24); // Larger delta surfaces first
  });

  it("flags opposite-sign deltas across viewports as a single divergent row (#29)", () => {
    // agent-c's round-3 scenario: rank 0 had +12 on mobile, -12 on
    // desktop/wide. Previously emitted as two independent global
    // suggestions; now emits ONE divergent row.
    const out = generateWireframeFixCandidates({
      bboxByViewport: [
        { viewport: "mobile", matches: [bbox(0, 12)] },
        { viewport: "desktop", matches: [bbox(0, -12)] },
        { viewport: "wide", matches: [bbox(0, -12)] },
      ],
      textRowsByViewport: [],
      tokens: PAWS,
    });
    const divergent = out.filter((s) => s.scope === "divergent");
    assert.equal(divergent.length, 1, "exactly one divergent row for rank 0");
    assert.match(divergent[0].evidence, /divergent/);
    assert.match(divergent[0].evidence, /mobile: \+12px/);
    assert.match(divergent[0].evidence, /desktop: -12px/);
    assert.match(divergent[0].suggestion, /media query/);
    assert.deepEqual(
      divergent[0].perViewport,
      [
        { viewport: "mobile", deltaPx: 12 },
        { viewport: "desktop", deltaPx: -12 },
        { viewport: "wide", deltaPx: -12 },
      ],
    );
    // No standalone +12 or -12 row for this rank — divergent replaces both.
    const nonDivergentRank0 = out.filter((s) => !s.evidence.includes("divergent") && s.evidence.includes("rank=0"));
    assert.equal(nonDivergentRank0.length, 0);
  });

  it("tags subset-coverage suggestions explicitly (#29)", () => {
    // rank 0 only seen on mobile out of 3 viewports — should be tagged
    // SUBSET so the agent knows not to apply globally.
    const out = generateWireframeFixCandidates({
      bboxByViewport: [
        { viewport: "mobile", matches: [bbox(0, 16)] },
        { viewport: "desktop", matches: [] },
        { viewport: "wide", matches: [] },
      ],
      textRowsByViewport: [],
      tokens: PAWS,
    });
    assert.equal(out.length, 1);
    assert.equal(out[0].scope, "subset");
    assert.match(out[0].evidence, /subset/);
    assert.match(out[0].evidence, /not seen on desktop, wide/);
  });

  it("uses scope=all when every viewport agrees", () => {
    const out = generateWireframeFixCandidates({
      bboxByViewport: [
        { viewport: "mobile", matches: [bbox(0, 24)] },
        { viewport: "desktop", matches: [bbox(0, 24)] },
        { viewport: "wide", matches: [bbox(0, 24)] },
      ],
      textRowsByViewport: [],
      tokens: PAWS,
    });
    assert.equal(out.length, 1);
    assert.equal(out[0].scope, "all");
    assert.doesNotMatch(out[0].evidence, /subset|divergent/);
  });
});
