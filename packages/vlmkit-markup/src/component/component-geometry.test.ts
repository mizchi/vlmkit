import assert from "node:assert/strict";
import { describe, it } from "vitest";
import { buildGeometryProfiles } from "./component-geometry.ts";
import type { MatchedBbox } from "./component-bbox.ts";

function mb(over: Partial<MatchedBbox>): MatchedBbox {
  return {
    rank: 0,
    baseline: { top: 0, left: 0, width: 100, height: 100, area: 10000, fillColor: "rgb(255,255,255)" },
    variant: { top: 0, left: 0, width: 100, height: 100, area: 10000, fillColor: "rgb(255,255,255)" },
    deltaTop: 0, deltaLeft: 0, deltaWidth: 0, deltaHeight: 0, iou: 1,
    ...over,
  };
}

describe("buildGeometryProfiles", () => {
  it("flags responsive-width mismatch (baseline shrinks, variant doesn't)", () => {
    const perVp = [
      {
        viewport: "mobile",
        matches: [mb({ rank: 0,
          baseline: { top: 0, left: 0, width: 343, height: 500, area: 0, fillColor: "" },
          variant:  { top: 0, left: 0, width: 343, height: 500, area: 0, fillColor: "" },
        })],
      },
      {
        viewport: "desktop",
        matches: [mb({ rank: 0,
          baseline: { top: 0, left: 0, width: 1180, height: 500, area: 0, fillColor: "" },
          variant:  { top: 0, left: 0, width: 343, height: 500, area: 0, fillColor: "" },
        })],
      },
    ];
    const profiles = buildGeometryProfiles(perVp);
    assert.equal(profiles.length, 1);
    assert.equal(profiles[0]!.baselineSpread.width, 1180 - 343);
    assert.equal(profiles[0]!.variantSpread.width, 0);
    assert.ok(profiles[0]!.responsiveMismatch);
    assert.equal(profiles[0]!.responsiveMismatch!.axis, "width");
    assert.match(profiles[0]!.responsiveMismatch!.interpretation, /variant likely missing/);
  });

  it("flags variant over-flex when its spread exceeds baseline's", () => {
    const perVp = [
      {
        viewport: "mobile",
        matches: [mb({
          baseline: { top: 0, left: 0, width: 360, height: 500, area: 0, fillColor: "" },
          variant:  { top: 0, left: 0, width: 343, height: 500, area: 0, fillColor: "" },
        })],
      },
      {
        viewport: "desktop",
        matches: [mb({
          baseline: { top: 0, left: 0, width: 360, height: 500, area: 0, fillColor: "" },
          variant:  { top: 0, left: 0, width: 1100, height: 500, area: 0, fillColor: "" },
        })],
      },
    ];
    const profiles = buildGeometryProfiles(perVp);
    assert.ok(profiles[0]!.responsiveMismatch);
    assert.match(profiles[0]!.responsiveMismatch!.interpretation, /over-flexing/);
  });

  it("does not flag when both spreads agree", () => {
    const perVp = [
      {
        viewport: "mobile",
        matches: [mb({
          baseline: { top: 0, left: 0, width: 343, height: 500, area: 0, fillColor: "" },
          variant:  { top: 0, left: 0, width: 340, height: 500, area: 0, fillColor: "" },
        })],
      },
      {
        viewport: "desktop",
        matches: [mb({
          baseline: { top: 0, left: 0, width: 1180, height: 500, area: 0, fillColor: "" },
          variant:  { top: 0, left: 0, width: 1175, height: 500, area: 0, fillColor: "" },
        })],
      },
    ];
    const profiles = buildGeometryProfiles(perVp);
    assert.equal(profiles[0]!.responsiveMismatch, undefined);
  });

  it("returns empty array on empty input", () => {
    assert.deepEqual(buildGeometryProfiles([]), []);
  });

  it("groups multi-rank matches separately", () => {
    const perVp = [
      {
        viewport: "mobile",
        matches: [
          mb({ rank: 0,
            baseline: { top: 0, left: 0, width: 343, height: 500, area: 0, fillColor: "" },
            variant:  { top: 0, left: 0, width: 343, height: 500, area: 0, fillColor: "" },
          }),
          mb({ rank: 1,
            baseline: { top: 600, left: 0, width: 200, height: 40, area: 0, fillColor: "" },
            variant:  { top: 600, left: 0, width: 200, height: 40, area: 0, fillColor: "" },
          }),
        ],
      },
    ];
    const profiles = buildGeometryProfiles(perVp);
    assert.equal(profiles.length, 2);
    assert.equal(profiles[0]!.rank, 0);
    assert.equal(profiles[1]!.rank, 1);
  });
});
