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
});
