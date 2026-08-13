import { describe, it } from "vitest";
import assert from "node:assert/strict";
import {
  buildPresenceMatrix,
  formatPresenceMatrix,
  type PresenceMatrixViewportInput,
} from "./presence-matrix.ts";

function vp(
  label: string,
  width: number,
  regions: Array<{ x: number; y: number; width: number; height: number }>,
): PresenceMatrixViewportInput {
  return { label, width, regions: regions.map((r) => ({ ...r, diffPixelCount: 100 })) };
}

describe("buildPresenceMatrix", () => {
  it("clusters regions that overlap across viewports into one row", () => {
    const matrix = buildPresenceMatrix([
      vp("1280", 1280, [{ x: 0, y: 100, width: 1280, height: 50 }]),
      vp("768", 768, [{ x: 0, y: 100, width: 768, height: 50 }]),
      vp("375", 375, [{ x: 0, y: 100, width: 375, height: 50 }]),
    ]);
    assert.equal(matrix.rows.length, 1);
    assert.deepEqual(matrix.rows[0]!.present.sort(), ["1280", "375", "768"]);
    assert.equal(matrix.rows[0]!.exclusive, false);
  });

  it("flags a viewport-exclusive region and hints the matching min-width media query", () => {
    const matrix = buildPresenceMatrix(
      [
        vp("1280", 1280, [{ x: 600, y: 3400, width: 200, height: 200 }]),
        vp("768", 768, []),
        vp("375", 375, []),
      ],
      [
        { value: 1200, type: "min-width" },
        { value: 768, type: "max-width" },
      ],
    );
    assert.equal(matrix.rows.length, 1);
    const row = matrix.rows[0]!;
    assert.deepEqual(row.present, ["1280"]);
    assert.deepEqual(row.absent.sort(), ["375", "768"]);
    assert.equal(row.exclusive, true);
    assert.ok(
      row.mediaHints.some((h) => /min-width:\s*1200px/.test(h)),
      `expected a min-width:1200 hint, got ${JSON.stringify(row.mediaHints)}`,
    );
    // The max-width:768 breakpoint does not separate {1280} from {768,375}.
    assert.ok(!row.mediaHints.some((h) => /max-width/.test(h)));
  });

  it("hints a max-width media query for a mobile-only region", () => {
    const matrix = buildPresenceMatrix(
      [
        vp("1280", 1280, []),
        vp("375", 375, [{ x: 0, y: 80, width: 375, height: 40 }]),
      ],
      [{ value: 768, type: "max-width" }],
    );
    const row = matrix.rows[0]!;
    assert.deepEqual(row.present, ["375"]);
    assert.equal(row.exclusive, true);
    assert.ok(row.mediaHints.some((h) => /max-width:\s*768px/.test(h)));
  });

  it("emits no media hints when no breakpoint cleanly separates present from absent", () => {
    const matrix = buildPresenceMatrix(
      [
        vp("1280", 1280, [{ x: 0, y: 0, width: 100, height: 100 }]),
        vp("768", 768, []),
      ],
      [{ value: 2000, type: "min-width" }],
    );
    assert.equal(matrix.rows[0]!.exclusive, true);
    assert.deepEqual(matrix.rows[0]!.mediaHints, []);
  });
});

describe("formatPresenceMatrix", () => {
  it("renders a region x viewport table with media hints", () => {
    const matrix = buildPresenceMatrix(
      [
        vp("1280", 1280, [{ x: 600, y: 3400, width: 200, height: 200 }]),
        vp("768", 768, []),
        vp("375", 375, []),
      ],
      [{ value: 1200, type: "min-width" }],
    );
    const text = formatPresenceMatrix(matrix);
    assert.match(text, /1280/);
    assert.match(text, /768/);
    assert.match(text, /min-width:\s*1200px/);
    // present marker present somewhere
    assert.match(text, /[✓x�—-]/);
  });

  it("returns a clear message when there are no regions", () => {
    const matrix = buildPresenceMatrix([vp("1280", 1280, []), vp("375", 375, [])]);
    const text = formatPresenceMatrix(matrix);
    assert.match(text, /no diff regions/i);
  });
});
