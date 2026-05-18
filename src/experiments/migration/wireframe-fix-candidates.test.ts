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

  it("trusts allViewports input over observation-derived universe (agent-d round-3 regression)", () => {
    // When desktop/wide produce zero meaningful deltas, they won't
    // appear in bboxByViewport. Without an explicit allViewports
    // input the generator would derive the universe as just {mobile}
    // → mobile-only suggestion would be tagged "all" (safe-to-go-
    // global), which is exactly wrong.
    const out = generateWireframeFixCandidates({
      bboxByViewport: [
        { viewport: "mobile", matches: [bbox(0, 12)] },
        // desktop / wide omitted — fully converged on those viewports
      ],
      textRowsByViewport: [],
      tokens: PAWS,
      allViewports: ["mobile", "desktop", "wide"],
    });
    assert.equal(out.length, 1);
    assert.equal(out[0].scope, "subset", "mobile-only delta must be tagged subset, not all");
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

  it("names a candidate selector when DOM-position-diff matches the bbox magnitude (#30)", () => {
    const out = generateWireframeFixCandidates({
      bboxByViewport: [
        { viewport: "mobile", matches: [bbox(0, 24)] },
        { viewport: "desktop", matches: [bbox(0, 24)] },
        { viewport: "wide", matches: [bbox(0, 24)] },
      ],
      textRowsByViewport: [],
      tokens: PAWS,
      allViewports: ["mobile", "desktop", "wide"],
      domPositionEntries: [
        // A clean matching rule: .profile got an extra 24px of top padding.
        {
          path: "body[0]>main[0]>section[1]",
          tag: "section",
          baselineClasses: "profile",
          variantClasses: "profile",
          property: "padding-top",
          baseline: "0px",
          variant: "24px",
          viewport: "mobile",
        },
        // Unrelated property (color) — should be ignored.
        {
          path: "body[0]>main[0]",
          tag: "main",
          baselineClasses: "page",
          variantClasses: "page",
          property: "color",
          baseline: "rgb(0,0,0)",
          variant: "rgb(0,0,0)",
          viewport: "mobile",
        },
      ],
    });
    assert.ok(out[0].candidates && out[0].candidates.length === 1);
    assert.equal(out[0].candidates[0].selector, ".profile");
    assert.equal(out[0].candidates[0].property, "padding-top");
    // Direction: "current → target" — what the agent has vs what the
    // baseline has. Reading the arrow left-to-right matches the agent
    // action ("change from 24px to 0px"). See agent-e v5 report for
    // the bug this notation replaces.
    assert.equal(out[0].candidates[0].current, "24px");
    assert.equal(out[0].candidates[0].target, "0px");
  });

  it("does not crash when DOM-position-diff input is missing", () => {
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
    assert.equal(out[0].candidates, undefined);
  });

  it("filters DP entries by viewport so candidates don't leak across breakpoints", () => {
    const out = generateWireframeFixCandidates({
      bboxByViewport: [
        // Mobile-only Δtop +24 → subset.
        { viewport: "mobile", matches: [bbox(0, 24)] },
      ],
      textRowsByViewport: [],
      tokens: PAWS,
      allViewports: ["mobile", "desktop", "wide"],
      domPositionEntries: [
        // Same magnitude on DESKTOP — must NOT show up as a mobile candidate.
        {
          path: "body[0]>section[0]",
          tag: "section",
          baselineClasses: "card",
          variantClasses: "card",
          property: "margin-top",
          baseline: "0px",
          variant: "24px",
          viewport: "desktop",
        },
      ],
    });
    assert.equal(out[0].scope, "subset");
    assert.equal(out[0].candidates, undefined,
      "desktop entry should not be surfaced as a candidate for a mobile-only suggestion");
  });

  it("flags same-sign-different-magnitude responsive divergence as MAG-DIVERGENT (#31)", () => {
    // Mobile needs +24 (md token), desktop needs +40 (lg token).
    // Same sign, spread = 16px ≥ threshold. Per-viewport snap finds
    // a different token for each viewport — exactly the responsive
    // case agent-d called out where a single global value can't
    // satisfy both ends.
    const out = generateWireframeFixCandidates({
      bboxByViewport: [
        { viewport: "mobile", matches: [bbox(0, -24)] },
        { viewport: "desktop", matches: [bbox(0, -40)] },
        { viewport: "wide", matches: [bbox(0, -40)] },
      ],
      textRowsByViewport: [],
      tokens: PAWS,
    });
    const md = out.filter((s) => s.scope === "magnitude-divergent");
    assert.equal(md.length, 1);
    assert.match(md[0].evidence, /magnitude-divergent/);
    assert.match(md[0].evidence, /mobile: -24px/);
    assert.match(md[0].evidence, /desktop: -40px/);
    assert.match(md[0].suggestion, /distinct per-viewport/);
    assert.match(md[0].suggestion, /token: md \(24px\)/);
    assert.match(md[0].suggestion, /token: lg \(40px\)/);
    // No separate SUBSET rows for the same rank — merged into one.
    const sameRankSubset = out.filter((s) => s.scope === "subset" && s.evidence.includes("rank=0"));
    assert.equal(sameRankSubset.length, 0);
  });

  it("does NOT flag MAG-DIVERGENT when magnitudes are within tolerance (≤8px spread)", () => {
    // 24 vs 28 — within the threshold; should fall through to subset/all.
    const out = generateWireframeFixCandidates({
      bboxByViewport: [
        { viewport: "mobile", matches: [bbox(0, 24)] },
        { viewport: "desktop", matches: [bbox(0, 28)] },
        { viewport: "wide", matches: [bbox(0, 28)] },
      ],
      textRowsByViewport: [],
      tokens: PAWS,
    });
    // 24 and 28 round to the same magnitude bucket — should be one row.
    assert.ok(out.every((s) => s.scope !== "magnitude-divergent"));
  });

  it("marks one suggestion HIGH-IMPACT when its magnitude dominates (G2)", () => {
    // One 40px shift + several 12px shifts → the 40px row dominates.
    const out = generateWireframeFixCandidates({
      bboxByViewport: [
        // rank 0: huge mobile-only shift (40px)
        { viewport: "mobile", matches: [bbox(0, 40)] },
        // rank 2, 3, 4: small shifts (12px) across multiple viewports
        { viewport: "desktop", matches: [bbox(2, 12), bbox(3, 12), bbox(4, 12)] },
        { viewport: "wide", matches: [bbox(2, 12), bbox(3, 12), bbox(4, 12)] },
      ],
      textRowsByViewport: [],
      tokens: PAWS,
      allViewports: ["mobile", "desktop", "wide"],
    });
    const high = out.filter((s) => s.isHighImpact);
    assert.equal(high.length, 1, "exactly one suggestion should be HIGH-IMPACT");
    assert.equal(high[0].deltaPx, 40);
  });

  it("does NOT mark HIGH-IMPACT when magnitudes are similar", () => {
    const out = generateWireframeFixCandidates({
      bboxByViewport: [
        { viewport: "mobile", matches: [bbox(0, 24), bbox(1, 20)] },
        { viewport: "desktop", matches: [bbox(0, 24), bbox(1, 20)] },
      ],
      textRowsByViewport: [],
      tokens: PAWS,
      allViewports: ["mobile", "desktop", "wide"],
    });
    const high = out.filter((s) => s.isHighImpact);
    assert.equal(high.length, 0, "20 and 24 are within 1.5× — no winner");
  });

  it("marks size-cascading candidates with cascades=true (F2)", () => {
    const out = generateWireframeFixCandidates({
      bboxByViewport: [
        { viewport: "mobile", matches: [bbox(0, 24)] },
        { viewport: "desktop", matches: [bbox(0, 24)] },
        { viewport: "wide", matches: [bbox(0, 24)] },
      ],
      textRowsByViewport: [],
      tokens: PAWS,
      allViewports: ["mobile", "desktop", "wide"],
      domPositionEntries: [
        // height change — should cascade
        {
          path: "body[0]>main[0]>section[1]",
          tag: "section", baselineClasses: "profile", variantClasses: "profile",
          property: "height", baseline: "100px", variant: "76px", viewport: "mobile",
        },
        // margin-top — does NOT cascade (changes the element's own offset, not siblings')
        {
          path: "body[0]>main[0]>div[2]",
          tag: "div", baselineClasses: "stats", variantClasses: "stats",
          property: "margin-top", baseline: "24px", variant: "0px", viewport: "mobile",
        },
      ],
    });
    const cs = out[0].candidates;
    assert.ok(cs);
    const height = cs!.find((c) => c.property === "height");
    const marginTop = cs!.find((c) => c.property === "margin-top");
    assert.equal(height?.cascades, true, "height should be flagged as cascading");
    assert.equal(marginTop?.cascades, false, "margin-top should NOT cascade");
  });

  it("MAG-DIVERGENT emits an overshoot prediction (F3)", () => {
    const out = generateWireframeFixCandidates({
      bboxByViewport: [
        // 24 on mobile, 40 on desktop — same sign, spread = 16 ≥ 8.
        { viewport: "mobile", matches: [bbox(0, -24)] },
        { viewport: "desktop", matches: [bbox(0, -40)] },
        { viewport: "wide", matches: [bbox(0, -40)] },
      ],
      textRowsByViewport: [],
      tokens: PAWS,
    });
    const md = out.find((s) => s.scope === "magnitude-divergent");
    assert.ok(md);
    // Applying 40px globally overshoots mobile by 16px (40 - 24).
    assert.match(md!.suggestion, /applying 40px globally would overshoot mobile by 16px/);
  });

  it("emits a STRUCTURAL meta-suggestion when 3+ candidates share a parent path (F1)", () => {
    const sharedParent = "body[0]>main[0]>section.profile";
    const out = generateWireframeFixCandidates({
      bboxByViewport: [
        // Heterogeneous magnitudes (24, 40, 48) → fires STRUCTURAL.
        { viewport: "mobile", matches: [bbox(0, 24), bbox(1, 40), bbox(2, 48)] },
        { viewport: "desktop", matches: [bbox(0, 24), bbox(1, 40), bbox(2, 48)] },
        { viewport: "wide", matches: [bbox(0, 24), bbox(1, 40), bbox(2, 48)] },
      ],
      textRowsByViewport: [],
      tokens: PAWS,
      allViewports: ["mobile", "desktop", "wide"],
      domPositionEntries: [
        {
          path: `${sharedParent}>h2.name`,
          tag: "h2", baselineClasses: "name", variantClasses: "name",
          property: "margin-top", baseline: "0px", variant: "24px", viewport: "mobile",
        },
        {
          path: `${sharedParent}>p.meta`,
          tag: "p", baselineClasses: "meta", variantClasses: "meta",
          property: "margin-top", baseline: "0px", variant: "40px", viewport: "mobile",
        },
        {
          path: `${sharedParent}>span.badge`,
          tag: "span", baselineClasses: "badge", variantClasses: "badge",
          property: "margin-top", baseline: "0px", variant: "48px", viewport: "mobile",
        },
      ],
    });
    const structural = out.filter((s) => s.scope === "structural");
    assert.equal(structural.length, 1);
    assert.match(structural[0].evidence, /3 suggestions all blame children of/);
    assert.match(structural[0].evidence, /section\.profile/);
    assert.match(structural[0].evidence, /range/);
    assert.match(structural[0].suggestion, /restructuring/);
    // Structural row leads the output.
    assert.equal(out[0], structural[0]);
  });

  it("does NOT emit STRUCTURAL when child magnitudes are homogeneous (agent-g v7 false-positive)", () => {
    // Three children of the same parent, all needing the same +24px
    // — the right answer is per-child tuning, not restructuring.
    // Pre-fix this would have fired STRUCTURAL erroneously.
    const sharedParent = "body[0]>main[0]>section.profile";
    const out = generateWireframeFixCandidates({
      bboxByViewport: [
        { viewport: "mobile", matches: [bbox(0, 24), bbox(1, 24), bbox(2, 24)] },
        { viewport: "desktop", matches: [bbox(0, 24), bbox(1, 24), bbox(2, 24)] },
        { viewport: "wide", matches: [bbox(0, 24), bbox(1, 24), bbox(2, 24)] },
      ],
      textRowsByViewport: [],
      tokens: PAWS,
      allViewports: ["mobile", "desktop", "wide"],
      domPositionEntries: [
        {
          path: `${sharedParent}>h2.name`,
          tag: "h2", baselineClasses: "name", variantClasses: "name",
          property: "margin-top", baseline: "0px", variant: "24px", viewport: "mobile",
        },
        {
          path: `${sharedParent}>p.meta`,
          tag: "p", baselineClasses: "meta", variantClasses: "meta",
          property: "margin-top", baseline: "0px", variant: "24px", viewport: "mobile",
        },
        {
          path: `${sharedParent}>span.badge`,
          tag: "span", baselineClasses: "badge", variantClasses: "badge",
          property: "margin-top", baseline: "0px", variant: "24px", viewport: "mobile",
        },
      ],
    });
    assert.equal(out.filter((s) => s.scope === "structural").length, 0);
  });

  it("does NOT emit STRUCTURAL when the parent is the document root (agent-g v7 false-positive)", () => {
    // Children of `body[0]` (single-segment parent) — too generic
    // to claim a layout-strategy mismatch.
    const out = generateWireframeFixCandidates({
      bboxByViewport: [
        { viewport: "mobile", matches: [bbox(0, 24), bbox(1, 40), bbox(2, 60)] },
      ],
      textRowsByViewport: [],
      tokens: PAWS,
      allViewports: ["mobile", "desktop", "wide"],
      domPositionEntries: [
        {
          path: "body[0]>header",
          tag: "header", baselineClasses: "", variantClasses: "",
          property: "margin-top", baseline: "0px", variant: "24px", viewport: "mobile",
        },
        {
          path: "body[0]>main",
          tag: "main", baselineClasses: "", variantClasses: "",
          property: "margin-top", baseline: "0px", variant: "40px", viewport: "mobile",
        },
        {
          path: "body[0]>footer",
          tag: "footer", baselineClasses: "", variantClasses: "",
          property: "margin-top", baseline: "0px", variant: "60px", viewport: "mobile",
        },
      ],
    });
    assert.equal(out.filter((s) => s.scope === "structural").length, 0,
      "body-rooted clusters are too generic to claim layout-strategy mismatch");
  });

  it("does NOT emit STRUCTURAL when only 2 candidates share a parent (threshold = 3)", () => {
    const sharedParent = "body[0]>main[0]>section.profile";
    const out = generateWireframeFixCandidates({
      bboxByViewport: [
        { viewport: "mobile", matches: [bbox(0, 24), bbox(1, 24)] },
      ],
      textRowsByViewport: [],
      tokens: PAWS,
      allViewports: ["mobile", "desktop", "wide"],
      domPositionEntries: [
        {
          path: `${sharedParent}>h2.name`,
          tag: "h2", baselineClasses: "name", variantClasses: "name",
          property: "margin-top", baseline: "0px", variant: "24px", viewport: "mobile",
        },
        {
          path: `${sharedParent}>p.meta`,
          tag: "p", baselineClasses: "meta", variantClasses: "meta",
          property: "margin-top", baseline: "0px", variant: "24px", viewport: "mobile",
        },
      ],
    });
    assert.equal(out.filter((s) => s.scope === "structural").length, 0);
  });

  it("emits a REFLOW row when mobile magnitude is ≥3× others AND mobile has extra text rows (#33)", () => {
    // Agent-g v7 scenario: mobile avatar pushed +132px because
    // the headline wrapped to 3 extra lines. Spacing-token
    // suggestion would mislead — the fix is typography upstream.
    const out = generateWireframeFixCandidates({
      bboxByViewport: [
        { viewport: "mobile", matches: [bbox(4, 132)] },
        { viewport: "desktop", matches: [bbox(4, 20)] },
        { viewport: "wide", matches: [bbox(4, 20)] },
      ],
      textRowsByViewport: [
        { viewport: "mobile", matches: [], baselineRowCount: 8, variantRowCount: 11 },
        { viewport: "desktop", matches: [], baselineRowCount: 7, variantRowCount: 7 },
        { viewport: "wide", matches: [], baselineRowCount: 7, variantRowCount: 7 },
      ],
      tokens: PAWS,
      allViewports: ["mobile", "desktop", "wide"],
    });
    const reflow = out.filter((s) => s.scope === "reflow");
    assert.equal(reflow.length, 1, "REFLOW should fire on rank=4");
    assert.match(reflow[0].evidence, /asymmetric/);
    assert.match(reflow[0].evidence, /mobile variant has \+3 text rows/);
    assert.match(reflow[0].suggestion, /typography cascade/);
    assert.match(reflow[0].suggestion, /max-width.*font-size/);
    // Reflow row leads the output (alongside structural).
    const idxOfReflow = out.findIndex((s) => s.scope === "reflow");
    const firstNonLead = out.findIndex((s) => s.scope !== "reflow" && s.scope !== "structural");
    if (firstNonLead >= 0) assert.ok(idxOfReflow < firstNonLead, "reflow leads non-structural rows");
  });

  it("emits a CASCADE-flavored REFLOW when row counts match but magnitude is ≥ 60px (agent-h v8)", () => {
    // Agent-h's case: row counts identical (text-rows.ts detects
    // page-level bands not line-level wraps) but the +132px mobile
    // shift is way too big to be a spacing token on a 64×64
    // component. The relaxed gate fires REFLOW with cascade-flavored
    // suggestion text — telling the agent to look upstream rather
    // than apply a 132px spacing fix to this element.
    const out = generateWireframeFixCandidates({
      bboxByViewport: [
        { viewport: "mobile", matches: [bbox(0, 132)] },
        { viewport: "desktop", matches: [bbox(0, 20)] },
        { viewport: "wide", matches: [bbox(0, 20)] },
      ],
      textRowsByViewport: [
        // Same row count on both sides — wrap-confirmed gate fails.
        { viewport: "mobile", matches: [], baselineRowCount: 8, variantRowCount: 8 },
      ],
      tokens: PAWS,
      allViewports: ["mobile", "desktop", "wide"],
    });
    const reflow = out.filter((s) => s.scope === "reflow");
    assert.equal(reflow.length, 1, "REFLOW should still fire via the cascade gate");
    assert.match(reflow[0].evidence, /too large to plausibly be a spacing token/);
    assert.match(reflow[0].suggestion, /upstream cascade/);
    assert.match(reflow[0].suggestion, /NOT close the delta/i);
  });

  it("does NOT emit REFLOW when magnitude is small AND row counts match (both gates fail)", () => {
    // 40 / 12 = 3.3× asymmetry, magnitude 40 < 60 floor, row counts equal.
    // Should fall through to the existing MAG-DIVERGENT branch.
    const out = generateWireframeFixCandidates({
      bboxByViewport: [
        { viewport: "mobile", matches: [bbox(0, 40)] },
        { viewport: "desktop", matches: [bbox(0, 12)] },
        { viewport: "wide", matches: [bbox(0, 12)] },
      ],
      textRowsByViewport: [
        { viewport: "mobile", matches: [], baselineRowCount: 8, variantRowCount: 8 },
      ],
      tokens: PAWS,
      allViewports: ["mobile", "desktop", "wide"],
    });
    assert.equal(out.filter((s) => s.scope === "reflow").length, 0);
    // Should fall through to MAG-DIVERGENT.
    assert.equal(out.filter((s) => s.scope === "magnitude-divergent").length, 1);
  });

  it("does NOT emit REFLOW when asymmetry is below the 3× threshold", () => {
    const out = generateWireframeFixCandidates({
      bboxByViewport: [
        // 40 / 20 = 2× — below the 3× asymmetry guard.
        { viewport: "mobile", matches: [bbox(0, 40)] },
        { viewport: "desktop", matches: [bbox(0, 20)] },
        { viewport: "wide", matches: [bbox(0, 20)] },
      ],
      textRowsByViewport: [
        { viewport: "mobile", matches: [], baselineRowCount: 8, variantRowCount: 10 },
      ],
      tokens: PAWS,
      allViewports: ["mobile", "desktop", "wide"],
    });
    assert.equal(out.filter((s) => s.scope === "reflow").length, 0);
  });

  it("falls back to CASCADE-flavored REFLOW when row-count info is absent but magnitude is large", () => {
    // Without row-count data the wrap gate can't fire, but the
    // large-magnitude gate (≥ 60px) catches the case anyway. The
    // suggestion is the cascade flavor (look upstream) since we
    // can't claim text wrap specifically.
    const out = generateWireframeFixCandidates({
      bboxByViewport: [
        { viewport: "mobile", matches: [bbox(0, 132)] },
        { viewport: "desktop", matches: [bbox(0, 20)] },
        { viewport: "wide", matches: [bbox(0, 20)] },
      ],
      textRowsByViewport: [
        { viewport: "mobile", matches: [] },
      ],
      tokens: PAWS,
      allViewports: ["mobile", "desktop", "wide"],
    });
    const reflow = out.filter((s) => s.scope === "reflow");
    assert.equal(reflow.length, 1);
    assert.match(reflow[0].suggestion, /upstream cascade/);
    assert.doesNotMatch(reflow[0].suggestion, /typography cascade/,
      "without row-count data we can't claim text wrap specifically");
  });

  it("appends a ⚠ converging warning when multiple suggestions blame the same selector (#34)", () => {
    // Two distinct suggestions both name `.container` on mobile.
    // Cumulative magnitude (24 + 16 = 40) exceeds the larger single
    // magnitude (24) by 16px, which is over the 8px overage gate.
    const out = generateWireframeFixCandidates({
      bboxByViewport: [
        { viewport: "mobile", matches: [bbox(0, 24), bbox(1, 16)] },
        { viewport: "desktop", matches: [bbox(0, 24), bbox(1, 16)] },
        { viewport: "wide", matches: [bbox(0, 24), bbox(1, 16)] },
      ],
      textRowsByViewport: [],
      tokens: PAWS,
      allViewports: ["mobile", "desktop", "wide"],
      domPositionEntries: [
        {
          path: "body[0]>main[0]>div.container",
          tag: "div", baselineClasses: "container", variantClasses: "container",
          property: "margin-top", baseline: "0px", variant: "24px", viewport: "mobile",
        },
        {
          path: "body[0]>main[0]>div.container",
          tag: "div", baselineClasses: "container", variantClasses: "container",
          property: "padding-top", baseline: "0px", variant: "16px", viewport: "mobile",
        },
      ],
    });
    // Find the lead suggestion that carries the warning (the first
    // among those touching `.container`).
    const withWarning = out.find((s) => s.suggestion.includes("converge on .container"));
    assert.ok(withWarning, "a converging warning should be appended");
    assert.match(withWarning!.suggestion, /2 suggestions converge on .container.*mobile.*cumulative .*= 40px/);
    assert.match(withWarning!.suggestion, /compound overshoot/);
  });

  it("does NOT warn when only one suggestion touches a selector", () => {
    const out = generateWireframeFixCandidates({
      bboxByViewport: [
        { viewport: "mobile", matches: [bbox(0, 24)] },
        { viewport: "desktop", matches: [bbox(0, 24)] },
        { viewport: "wide", matches: [bbox(0, 24)] },
      ],
      textRowsByViewport: [],
      tokens: PAWS,
      allViewports: ["mobile", "desktop", "wide"],
      domPositionEntries: [
        {
          path: "body[0]>div.solo",
          tag: "div", baselineClasses: "solo", variantClasses: "solo",
          property: "margin-top", baseline: "0px", variant: "24px", viewport: "mobile",
        },
      ],
    });
    assert.ok(!out.some((s) => s.suggestion.includes("converge on")));
  });

  it("does NOT warn when cumulative is within tolerance of max single", () => {
    // 24 + 4 = 28. max single = 24. overage = 4 ≤ 8 → no warning.
    const out = generateWireframeFixCandidates({
      bboxByViewport: [
        { viewport: "mobile", matches: [bbox(0, 24), bbox(1, 4)] },
      ],
      textRowsByViewport: [],
      tokens: PAWS,
      allViewports: ["mobile", "desktop", "wide"],
      domPositionEntries: [
        {
          path: "body[0]>div.x",
          tag: "div", baselineClasses: "x", variantClasses: "x",
          property: "margin-top", baseline: "0px", variant: "24px", viewport: "mobile",
        },
        {
          path: "body[0]>div.x",
          tag: "div", baselineClasses: "x", variantClasses: "x",
          property: "padding-top", baseline: "0px", variant: "4px", viewport: "mobile",
        },
      ],
    });
    assert.ok(!out.some((s) => s.suggestion.includes("converge on")));
  });

  it("STRUCTURAL names the specific parent layout-strategy mismatch (#35)", () => {
    // 3 children of `body[0]>main[0]>section.profile` with
    // heterogeneous deltas, AND the parent's `display` differs
    // between baseline and variant. STRUCTURAL should now name the
    // display delta in the suggestion text.
    const sharedParent = "body[0]>main[0]>section.profile";
    const out = generateWireframeFixCandidates({
      bboxByViewport: [
        { viewport: "mobile", matches: [bbox(0, 24), bbox(1, 40), bbox(2, 60)] },
      ],
      textRowsByViewport: [],
      tokens: PAWS,
      allViewports: ["mobile", "desktop", "wide"],
      domPositionEntries: [
        // Child entries that drive the STRUCTURAL detection
        {
          path: `${sharedParent}>h2.name`,
          tag: "h2", baselineClasses: "name", variantClasses: "name",
          property: "margin-top", baseline: "0px", variant: "24px", viewport: "mobile",
        },
        {
          path: `${sharedParent}>p.meta`,
          tag: "p", baselineClasses: "meta", variantClasses: "meta",
          property: "margin-top", baseline: "0px", variant: "40px", viewport: "mobile",
        },
        {
          path: `${sharedParent}>span.badge`,
          tag: "span", baselineClasses: "badge", variantClasses: "badge",
          property: "margin-top", baseline: "0px", variant: "60px", viewport: "mobile",
        },
        // Parent-level entry that names the actual layout-strategy mismatch
        {
          path: sharedParent,
          tag: "section", baselineClasses: "profile", variantClasses: "profile",
          property: "display", baseline: "grid", variant: "flex", viewport: "mobile",
        },
        {
          path: sharedParent,
          tag: "section", baselineClasses: "profile", variantClasses: "profile",
          property: "grid-template-columns", baseline: "64px 1fr", variant: "none", viewport: "mobile",
        },
      ],
    });
    const structural = out.find((s) => s.scope === "structural");
    assert.ok(structural);
    assert.match(structural!.evidence, /parent layout deltas: display: flex \(now\) → grid \(target\)/);
    assert.match(structural!.evidence, /grid-template-columns: none \(now\) → 64px 1fr \(target\)/);
    assert.match(structural!.suggestion, /change `.+`'s layout to match/);
  });

  it("STRUCTURAL falls back to generic suggestion when parent properties match (#35)", () => {
    const sharedParent = "body[0]>main[0]>section.profile";
    const out = generateWireframeFixCandidates({
      bboxByViewport: [
        { viewport: "mobile", matches: [bbox(0, 24), bbox(1, 40), bbox(2, 60)] },
      ],
      textRowsByViewport: [],
      tokens: PAWS,
      allViewports: ["mobile", "desktop", "wide"],
      domPositionEntries: [
        // No parent-level entries → fall back to generic message
        {
          path: `${sharedParent}>h2.name`,
          tag: "h2", baselineClasses: "name", variantClasses: "name",
          property: "margin-top", baseline: "0px", variant: "24px", viewport: "mobile",
        },
        {
          path: `${sharedParent}>p.meta`,
          tag: "p", baselineClasses: "meta", variantClasses: "meta",
          property: "margin-top", baseline: "0px", variant: "40px", viewport: "mobile",
        },
        {
          path: `${sharedParent}>span.badge`,
          tag: "span", baselineClasses: "badge", variantClasses: "badge",
          property: "margin-top", baseline: "0px", variant: "60px", viewport: "mobile",
        },
      ],
    });
    const structural = out.find((s) => s.scope === "structural");
    assert.ok(structural);
    assert.doesNotMatch(structural!.evidence, /parent layout deltas/);
    assert.match(structural!.suggestion, /Parent's layout properties match/);
  });

  it("emits ⚠ cross-edit when ≥ 2 distinct cascading selectors land on the same suggestion (#36)", () => {
    // .container (padding-bottom — cascades) AND .hero (margin-bottom
    // — cascades) both bound to a single suggestion. Applying both
    // edits compounds.
    const out = generateWireframeFixCandidates({
      bboxByViewport: [
        { viewport: "mobile", matches: [bbox(0, 24)] },
        { viewport: "desktop", matches: [bbox(0, 24)] },
        { viewport: "wide", matches: [bbox(0, 24)] },
      ],
      textRowsByViewport: [],
      tokens: PAWS,
      allViewports: ["mobile", "desktop", "wide"],
      domPositionEntries: [
        {
          path: "body[0]>main[0]>div.container",
          tag: "div", baselineClasses: "container", variantClasses: "container",
          property: "padding-bottom", baseline: "0px", variant: "24px", viewport: "mobile",
        },
        {
          path: "body[0]>main[0]>div.container>section.hero",
          tag: "section", baselineClasses: "hero", variantClasses: "hero",
          property: "margin-bottom", baseline: "0px", variant: "24px", viewport: "mobile",
        },
      ],
    });
    const withCross = out.find((s) => s.suggestion.includes("cross-edit"));
    assert.ok(withCross);
    assert.match(withCross!.suggestion, /cross-edit:.*\.container.*\.hero.*cascade-affect/);
    assert.match(withCross!.suggestion, /compounds/);
  });

  it("STRUCTURAL with parent gap delta warns about non-zero pre-existing child margins (V9a)", () => {
    // Agent-i v9: parent edit collided with still-present
    // margin-top: spacing.lg on children → +5pp mobile regression.
    // STRUCTURAL now annotates the conflicting child margins so the
    // agent clears them at the same time.
    const sharedParent = "body[0]>main[0]>section.profile";
    const out = generateWireframeFixCandidates({
      bboxByViewport: [
        { viewport: "mobile", matches: [bbox(0, 24), bbox(1, 40), bbox(2, 60)] },
      ],
      textRowsByViewport: [],
      tokens: PAWS,
      allViewports: ["mobile", "desktop", "wide"],
      domPositionEntries: [
        // Parent introduces a new gap.
        {
          path: sharedParent,
          tag: "section", baselineClasses: "profile", variantClasses: "profile",
          property: "gap", baseline: "16px", variant: "0px", viewport: "mobile",
        },
        // Child entries (so STRUCTURAL fires).
        {
          path: `${sharedParent}>div.card-1`,
          tag: "div", baselineClasses: "card-1", variantClasses: "card-1",
          property: "margin-top", baseline: "0px", variant: "24px", viewport: "mobile",
        },
        {
          path: `${sharedParent}>div.card-2`,
          tag: "div", baselineClasses: "card-2", variantClasses: "card-2",
          property: "margin-top", baseline: "0px", variant: "40px", viewport: "mobile",
        },
        {
          path: `${sharedParent}>div.card-3`,
          tag: "div", baselineClasses: "card-3", variantClasses: "card-3",
          property: "margin-top", baseline: "0px", variant: "60px", viewport: "mobile",
        },
      ],
    });
    const structural = out.find((s) => s.scope === "structural");
    assert.ok(structural);
    assert.match(structural!.suggestion, /ALSO clear non-zero child margins/);
    assert.match(structural!.suggestion, /\.card-1\.margin-top: 24px/);
    assert.match(structural!.suggestion, /\.card-2\.margin-top: 40px/);
  });

  it("STRUCTURAL with non-gap parent deltas does NOT warn about child margins (V9a)", () => {
    // When the structural delta is display flip (not gap introduction),
    // the child-margin warning shouldn't fire — the new display may
    // legitimately want existing margins preserved.
    const sharedParent = "body[0]>main[0]>section.profile";
    const out = generateWireframeFixCandidates({
      bboxByViewport: [
        { viewport: "mobile", matches: [bbox(0, 24), bbox(1, 40), bbox(2, 60)] },
      ],
      textRowsByViewport: [],
      tokens: PAWS,
      allViewports: ["mobile", "desktop", "wide"],
      domPositionEntries: [
        {
          path: sharedParent,
          tag: "section", baselineClasses: "profile", variantClasses: "profile",
          property: "align-items", baseline: "center", variant: "stretch", viewport: "mobile",
        },
        {
          path: `${sharedParent}>div.card-1`,
          tag: "div", baselineClasses: "card-1", variantClasses: "card-1",
          property: "margin-top", baseline: "0px", variant: "24px", viewport: "mobile",
        },
        {
          path: `${sharedParent}>div.card-2`,
          tag: "div", baselineClasses: "card-2", variantClasses: "card-2",
          property: "margin-top", baseline: "0px", variant: "40px", viewport: "mobile",
        },
        {
          path: `${sharedParent}>div.card-3`,
          tag: "div", baselineClasses: "card-3", variantClasses: "card-3",
          property: "margin-top", baseline: "0px", variant: "60px", viewport: "mobile",
        },
      ],
    });
    const structural = out.find((s) => s.scope === "structural");
    assert.ok(structural);
    assert.doesNotMatch(structural!.suggestion, /ALSO clear non-zero child margins/);
  });

  it("emits intrinsic-height warning when component bbox heights differ (V9b)", () => {
    // Agent-i v9: cards visually shorter due to undersized internal
    // padding, not missing margin. Bbox heightDelta surfaces this.
    const heightSmall = (): MatchedBbox => {
      const baseline = { rank: 0, top: 0, left: 0, width: 200, height: 100, area: 20000, fillColor: "rgb(0,0,0)" };
      const variant = { ...baseline, top: 24, height: 60 }; // variant is 40px shorter
      return { rank: 0, baseline, variant, deltaTop: 24, deltaLeft: 0, deltaWidth: 0, deltaHeight: -40, iou: 0.5 };
    };
    const out = generateWireframeFixCandidates({
      bboxByViewport: [
        { viewport: "mobile", matches: [heightSmall()] },
        { viewport: "desktop", matches: [heightSmall()] },
        { viewport: "wide", matches: [heightSmall()] },
      ],
      textRowsByViewport: [],
      tokens: PAWS,
      allViewports: ["mobile", "desktop", "wide"],
    });
    // Suggestion text should hint at intrinsic height
    const withHint = out.find((s) => s.suggestion.includes("component height differs intrinsically"));
    assert.ok(withHint, "intrinsic-height hint should fire on |Δheight| ≥ 8px");
    assert.match(withHint!.suggestion, /60px \(now\) → 100px \(target\)/);
    assert.match(withHint!.suggestion, /check this component's own padding/);
  });

  it("does NOT mark intrinsic-height when |Δheight| < 8px (V9b)", () => {
    const heightOK = (): MatchedBbox => {
      const baseline = { rank: 0, top: 0, left: 0, width: 200, height: 100, area: 20000, fillColor: "rgb(0,0,0)" };
      const variant = { ...baseline, top: 24, height: 98 }; // Δheight = -2 (subpixel)
      return { rank: 0, baseline, variant, deltaTop: 24, deltaLeft: 0, deltaWidth: 0, deltaHeight: -2, iou: 0.95 };
    };
    const out = generateWireframeFixCandidates({
      bboxByViewport: [
        { viewport: "mobile", matches: [heightOK()] },
        { viewport: "desktop", matches: [heightOK()] },
        { viewport: "wide", matches: [heightOK()] },
      ],
      textRowsByViewport: [],
      tokens: PAWS,
      allViewports: ["mobile", "desktop", "wide"],
    });
    assert.ok(!out.some((s) => s.suggestion.includes("component height differs intrinsically")));
  });

  it("does NOT emit ⚠ cross-edit when only one cascading selector is present (#36)", () => {
    const out = generateWireframeFixCandidates({
      bboxByViewport: [
        { viewport: "mobile", matches: [bbox(0, 24)] },
        { viewport: "desktop", matches: [bbox(0, 24)] },
        { viewport: "wide", matches: [bbox(0, 24)] },
      ],
      textRowsByViewport: [],
      tokens: PAWS,
      allViewports: ["mobile", "desktop", "wide"],
      domPositionEntries: [
        // Single cascading candidate
        {
          path: "body[0]>main[0]>div.container",
          tag: "div", baselineClasses: "container", variantClasses: "container",
          property: "padding-bottom", baseline: "0px", variant: "24px", viewport: "mobile",
        },
        // Non-cascading (margin-top doesn't cascade siblings)
        {
          path: "body[0]>main[0]>section.hero",
          tag: "section", baselineClasses: "hero", variantClasses: "hero",
          property: "margin-top", baseline: "0px", variant: "24px", viewport: "mobile",
        },
      ],
    });
    assert.ok(!out.some((s) => s.suggestion.includes("cross-edit")));
  });

  it("does NOT mark HIGH-IMPACT when the leading magnitude is too small (< 12px)", () => {
    // 8 vs 4 — 2× ratio but the leading magnitude is only 8px,
    // not enough to be worth a HIGH-IMPACT badge on its own.
    const out = generateWireframeFixCandidates({
      bboxByViewport: [
        { viewport: "mobile", matches: [bbox(0, 8)] },
        { viewport: "desktop", matches: [bbox(0, 8)] },
        { viewport: "wide", matches: [bbox(1, 4)] },
      ],
      textRowsByViewport: [],
      tokens: PAWS,
      allViewports: ["mobile", "desktop", "wide"],
    });
    assert.equal(out.filter((s) => s.isHighImpact).length, 0);
  });

  it("tolerates ±2px between bbox magnitude and DP entry magnitude", () => {
    const out = generateWireframeFixCandidates({
      bboxByViewport: [
        { viewport: "mobile", matches: [bbox(0, 24)] },
        { viewport: "desktop", matches: [bbox(0, 24)] },
        { viewport: "wide", matches: [bbox(0, 24)] },
      ],
      textRowsByViewport: [],
      tokens: PAWS,
      domPositionEntries: [
        {
          path: "body[0]>section[1]",
          tag: "section",
          baselineClasses: "profile",
          variantClasses: "profile",
          property: "padding-top",
          // 25 - 0 = 25, vs target 24 → within tolerance.
          baseline: "0px",
          variant: "25px",
          viewport: "mobile",
        },
      ],
    });
    assert.ok(out[0].candidates && out[0].candidates.length === 1);
  });
});
