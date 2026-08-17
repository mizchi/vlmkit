/**
 * Diff-region granularity and attribution, for small frames.
 *
 * Both come from vlmkit#117, reported against a 640x360 canvas HUD whose only change was
 * an HP bar's fill (`(106,16) 90x20`). Reproduced before changing anything: the region came
 * back as `(96,0) 128x64` — larger than the `200x20` element that caused it — and the
 * selector named `.hud-root`, the full frame, instead of `.hp-bar`.
 *
 * The issue filed those as two problems. They are one. `regionCoverage` carries weight 0.7,
 * so a region coarser than the element hands a containing ancestor a free `1.0` while
 * starving the leaf; the resulting 0.391-vs-0.385 near-tie is the symptom, not a second
 * defect. The arithmetic below is asserted directly, because "the grid caused the
 * misattribution" is the claim the fix rests on and it is cheap to state as a test rather
 * than as a paragraph.
 *
 * None of this had coverage. `heatmap-regions.test.ts` asserts exact bboxes from
 * `findHeatmapRegionsFromRgba`, which is a different function; nothing exercised
 * `detectDiffRegions`' grid at all, so the suite stayed green through the change that
 * introduced the bug and through the change that fixed it.
 */
import assert from "node:assert/strict";
import { describe, it } from "vitest";
import { adaptiveRegionCellSize } from "@mizchi/vlmkit-core/heatmap.ts";
import {
  matchRegionBboxToElement,
  matchRegionBboxToElements,
  type RegionElementRect,
} from "./region-selector-match.ts";

/** The elements-json from the issue, verbatim. */
const HUD: RegionElementRect[] = [
  { path: "hud[0]", tag: "hud", id: "hud", classes: "hud-root", top: 0, left: 0, width: 640, height: 360 },
  { path: "hud[0]>bar[0]", tag: "bar", id: "hp_bar", classes: "hp-bar", top: 16, left: 16, width: 200, height: 20 },
  { path: "hud[0]>panel[1]", tag: "panel", id: "score_panel", classes: "score-panel", top: 16, left: 500, width: 124, height: 20 },
  { path: "hud[0]>button[2]", tag: "button", id: "pause_button", classes: "pause-button", top: 320, left: 270, width: 100, height: 28 },
];

describe("adaptiveRegionCellSize", () => {
  it("keeps 32px wherever it was already working", () => {
    // Page screenshots. Changing these would move region bboxes that already appear in
    // baselines, approvals and reports, so the buckets exist to leave them alone.
    assert.equal(adaptiveRegionCellSize(1280, 720), 32);
    assert.equal(adaptiveRegionCellSize(1280, 4000), 32);
    assert.equal(adaptiveRegionCellSize(720, 720), 32);
  });

  it("refines small frames, where 32px cannot be right", () => {
    assert.equal(adaptiveRegionCellSize(640, 360), 8, "the reported HUD size");
    assert.equal(adaptiveRegionCellSize(320, 240), 8, "a dot-art HUD");
    assert.equal(adaptiveRegionCellSize(640, 480), 16);
  });

  it("keys off the short side, not the area", () => {
    // A 2000x300 strip is small in the dimension that matters: a 32px cell is a tenth of
    // its height. Area-based bucketing would call it large and keep the coarse grid.
    assert.equal(adaptiveRegionCellSize(2000, 300), 8);
    assert.equal(adaptiveRegionCellSize(300, 2000), 8);
  });

  it("is bucketed, so nearby sizes do not shift region geometry", () => {
    // A continuous function (min/40 or similar) would give a different grid for almost
    // every image, changing bboxes on pages nobody was complaining about.
    for (const height of [720, 800, 900, 1080, 1200]) {
      assert.equal(adaptiveRegionCellSize(1280, height), 32, `height ${height}`);
    }
  });
});

describe("attribution on the vlmkit#117 HUD", () => {
  it("blamed the full-frame ancestor at the old 32px grid", () => {
    // The reproduction, kept as a test so the fix is anchored to a real failure rather
    // than to a description of one. `(96,0) 128x64` is what a 32px grid produced.
    const coarse = { left: 96, top: 0, width: 128, height: 64 };
    const scores = matchRegionBboxToElements(coarse, HUD, 4);
    const byName = new Map(scores.map((m) => [m.selector, m.evidence.score]));
    // The issue quoted 0.391 / 0.385; `roundMetric` keeps four places, so these are the
    // same numbers at full reported precision. The gap is 0.0058.
    assert.equal(byName.get(".hud-root"), 0.3909, "ancestor score");
    assert.equal(byName.get(".hp-bar"), 0.3851, "real cause, 0.0058 behind");
  });

  it("picks the real cause at that same coarse region, via the near-tie rule", () => {
    // Insurance for cases where the grid cannot be fine enough: a 0.006 gap is not signal,
    // and the smaller box is the more useful answer.
    const coarse = { left: 96, top: 0, width: 128, height: 64 };
    assert.equal(matchRegionBboxToElement(coarse, HUD)?.selector, ".hp-bar");
  });

  it("picks the real cause at the adaptive grid, without needing the tie-break", () => {
    // What the CLI now produces for this frame: (104,16) 96x24. Here the leaf wins on
    // score outright, which is the actual fix — the tie-break is a second line of defence.
    const tight = { left: 104, top: 16, width: 96, height: 24 };
    const best = matchRegionBboxToElements(tight, HUD, 4);
    assert.equal(best[0]?.selector, ".hp-bar");
    assert.ok(
      best[0]!.evidence.score - (best[1]?.evidence.score ?? 0) > 0.2,
      `expected a decisive win, got ${JSON.stringify(best.map((m) => [m.selector, m.evidence.score]))}`,
    );
  });
});

describe("near-tie rule does not reorder same-scale candidates", () => {
  it("leaves similarly-sized siblings on score order", () => {
    // The rule requires the winner to be at most half the area of the loser. Without that
    // bound, a few thousandths of score would reshuffle overlapping siblings arbitrarily.
    const siblings: RegionElementRect[] = [
      { path: "a", tag: "div", classes: "left", top: 0, left: 0, width: 100, height: 40 },
      { path: "b", tag: "div", classes: "right", top: 0, left: 60, width: 96, height: 40 },
    ];
    const region = { left: 0, top: 0, width: 100, height: 40 };
    const ranked = matchRegionBboxToElements(region, siblings, 2);
    assert.equal(ranked[0]?.selector, ".left", "the better-covered sibling still wins");
    assert.ok(
      ranked[0]!.evidence.score >= ranked[1]!.evidence.score,
      "ranking must stay score-ordered among same-scale candidates",
    );
  });
});

describe("ranked candidates", () => {
  it("returns runners-up best-first", () => {
    const region = { left: 96, top: 0, width: 128, height: 64 };
    const ranked = matchRegionBboxToElements(region, HUD, 3);
    assert.ok(ranked.length >= 2, `expected at least 2 candidates, got ${ranked.length}`);
    assert.deepEqual(
      ranked.map((m) => m.selector).slice(0, 2),
      [".hp-bar", ".hud-root"],
      "the real cause first, the ancestor it beat second",
    );
  });

  it("honours the limit and still applies the coverage floor", () => {
    const region = { left: 96, top: 0, width: 128, height: 64 };
    assert.equal(matchRegionBboxToElements(region, HUD, 1).length, 1);
    // `.score-panel` and `.pause-button` do not intersect this region at all, so a limit
    // above the number of real candidates must not invent any.
    assert.ok(matchRegionBboxToElements(region, HUD, 10).length <= 2);
  });

  it("agrees with the singular helper on the winner", () => {
    // `matchRegionBboxToElement` is now a wrapper; if the two disagreed, every existing
    // caller would silently get a different answer from the new one.
    for (const region of [
      { left: 96, top: 0, width: 128, height: 64 },
      { left: 104, top: 16, width: 96, height: 24 },
      { left: 500, top: 16, width: 32, height: 32 },
      { left: 270, top: 320, width: 64, height: 32 },
    ]) {
      assert.equal(
        matchRegionBboxToElement(region, HUD)?.selector ?? null,
        matchRegionBboxToElements(region, HUD, 1)[0]?.selector ?? null,
        `disagreement at ${JSON.stringify(region)}`,
      );
    }
  });

  it("returns nothing when no element explains the region", () => {
    const empty = { left: 400, top: 200, width: 16, height: 16 };
    // Only `.hud-root` covers this, at 100% region coverage — so it IS returned. The
    // assertion worth making is that a zero-area region yields nothing at all.
    assert.deepEqual(matchRegionBboxToElements({ left: 0, top: 0, width: 0, height: 0 }, HUD), []);
    assert.equal(matchRegionBboxToElements(empty, HUD, 3).length, 1);
  });
});
