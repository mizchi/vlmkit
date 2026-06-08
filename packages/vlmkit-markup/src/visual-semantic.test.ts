import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { classifyVisualDiff } from "./visual-semantic.ts";
import type { VrtDiff, DiffRegion } from "@mizchi/vlmkit-core/types.ts";

function makeDiff(regions: DiffRegion[], totalPixels = 1_000_000): VrtDiff {
  const diffPixels = regions.reduce((s, r) => s + r.diffPixelCount, 0);
  return {
    snapshot: {
      testId: "test-1",
      testTitle: "Test",
      projectName: "default",
      screenshotPath: "/tmp/test.png",
      baselinePath: "/tmp/baseline.png",
      status: "changed",
    },
    diffPixels,
    totalPixels,
    diffRatio: diffPixels / totalPixels,
    regions,
  };
}

describe("classifyVisualDiff", () => {
  it("should classify small square as icon-change", () => {
    const diff = makeDiff([
      { x: 10, y: 10, width: 32, height: 32, diffPixelCount: 800 },
    ]);
    const result = classifyVisualDiff(diff);
    assert.equal(result.changes.length, 1);
    assert.equal(result.changes[0].type, "icon-change");
  });

  it("should classify wide thin region as text-change", () => {
    const diff = makeDiff([
      { x: 50, y: 100, width: 400, height: 20, diffPixelCount: 2000 },
    ]);
    const result = classifyVisualDiff(diff);
    assert.equal(result.changes[0].type, "text-change");
  });

  it("should classify high-density region as color-change", () => {
    const diff = makeDiff([
      { x: 0, y: 0, width: 200, height: 100, diffPixelCount: 18000 },
    ]);
    const result = classifyVisualDiff(diff);
    assert.equal(result.changes[0].type, "color-change");
  });

  it("includes sampled color pairs in color-change descriptions", () => {
    const diff = makeDiff([
      {
        x: 0,
        y: 0,
        width: 200,
        height: 100,
        diffPixelCount: 18000,
        colorSample: {
          baseline: { r: 107, g: 114, b: 128, hex: "#6b7280" },
          current: { r: 140, g: 144, b: 153, hex: "#8c9099" },
          distance: 54,
        },
      },
    ]);
    const result = classifyVisualDiff(diff);
    assert.match(result.changes[0].description, /#6b7280 -> #8c9099/);
  });

  it("classifies a region with a translation estimate as layout-shift with offset", () => {
    const diff = makeDiff([
      {
        x: 555,
        y: 3488,
        width: 224,
        height: 192,
        diffPixelCount: 9000,
        shift: { dx: 36, dy: 0, confidence: 0.91 },
        colorSample: {
          baseline: { r: 255, g: 255, b: 255, hex: "#ffffff" },
          current: { r: 255, g: 255, b: 255, hex: "#ffffff" },
          distance: 0,
        },
      },
    ]);
    const result = classifyVisualDiff(diff);
    assert.equal(result.changes[0].type, "layout-shift");
    assert.match(result.changes[0].description, /\+36/);
    assert.doesNotMatch(result.changes[0].description, /#ffffff -> #ffffff/);
  });

  it("classifies a vertical-dominant measured shift as reflow (draft 04)", () => {
    const diff = makeDiff([
      {
        x: 0,
        y: 2000,
        width: 1200,
        height: 300,
        diffPixelCount: 50000,
        shift: { dx: 0, dy: 120, confidence: 0.88 },
        colorSample: {
          baseline: { r: 255, g: 255, b: 255, hex: "#ffffff" },
          current: { r: 255, g: 255, b: 255, hex: "#ffffff" },
          distance: 0,
        },
      },
    ]);
    const result = classifyVisualDiff(diff);
    assert.equal(result.changes[0].type, "reflow");
    assert.match(result.changes[0].description, /reflow/i);
    assert.match(result.changes[0].description, /\+120/);
  });

  it("keeps a horizontal-dominant measured shift as layout-shift, not reflow", () => {
    const diff = makeDiff([
      {
        x: 555,
        y: 3488,
        width: 224,
        height: 192,
        diffPixelCount: 9000,
        shift: { dx: 36, dy: 0, confidence: 0.91 },
      },
    ]);
    const result = classifyVisualDiff(diff);
    assert.equal(result.changes[0].type, "layout-shift");
  });

  it("does not call a recolored band a layout shift when no movement was measured", () => {
    const diff = makeDiff([
      {
        x: 64,
        y: 1888,
        width: 1152,
        height: 160,
        diffPixelCount: 150000,
        regionType: "shift",
        colorSample: {
          baseline: { r: 248, g: 249, b: 250, hex: "#f8f9fa" },
          current: { r: 180, g: 209, b: 250, hex: "#b4d1fa" },
          distance: 79,
        },
      },
    ]);
    const result = classifyVisualDiff(diff);
    assert.notEqual(result.changes[0].type, "layout-shift");
    assert.match(result.changes[0].description, /#f8f9fa -> #b4d1fa/);
  });

  it("omits identical color samples from element-added descriptions", () => {
    const diff = makeDiff([
      {
        x: 10,
        y: 10,
        width: 300,
        height: 300,
        diffPixelCount: 5000,
        colorSample: {
          baseline: { r: 255, g: 255, b: 255, hex: "#ffffff" },
          current: { r: 255, g: 255, b: 255, hex: "#ffffff" },
          distance: 0,
        },
      },
    ]);
    const result = classifyVisualDiff(diff);
    assert.doesNotMatch(result.changes[0].description, /#ffffff -> #ffffff/);
  });

  it("surfaces the peak glyph color on a text-change region (draft 11)", () => {
    const diff = makeDiff([
      {
        x: 50,
        y: 100,
        width: 400,
        height: 20,
        diffPixelCount: 600,
        colorSample: {
          baseline: { r: 200, g: 200, b: 200, hex: "#c8c8c8" },
          current: { r: 205, g: 195, b: 195, hex: "#cdc3c3" },
          distance: 9,
          peak: {
            baseline: { r: 51, g: 51, b: 51, hex: "#333333" },
            current: { r: 204, g: 0, b: 0, hex: "#cc0000" },
            distance: 222,
          },
        },
      },
    ]);
    const result = classifyVisualDiff(diff);
    assert.equal(result.changes[0].type, "text-change");
    // The glyph core color, not the antialiasing-muddied mean.
    assert.match(result.changes[0].description, /#333333 -> #cc0000/);
    assert.doesNotMatch(result.changes[0].description, /#c8c8c8/);
  });

  it("should classify large region as layout-shift", () => {
    const diff = makeDiff([
      { x: 0, y: 0, width: 1000, height: 500, diffPixelCount: 100000 },
    ]);
    const result = classifyVisualDiff(diff);
    assert.equal(result.changes[0].type, "layout-shift");
  });

  it("flags a shape-derived layout-shift as having no measured offset (draft 12)", () => {
    // Large region, no `shift` field: the label comes from the shape
    // heuristic, not a measured translation. The description must not read
    // as if an offset was found.
    const diff = makeDiff([
      { x: 0, y: 0, width: 1000, height: 500, diffPixelCount: 100000 },
    ]);
    const result = classifyVisualDiff(diff);
    assert.equal(result.changes[0].type, "layout-shift");
    assert.match(result.changes[0].description, /no translation measured/);
  });

  it("notes no measured translation on a wide-band region hint (draft 12)", () => {
    const diff = makeDiff([
      {
        x: 20,
        y: 80,
        width: 48,
        height: 48,
        diffPixelCount: 1800,
        regionType: "shift",
      },
    ]);
    const result = classifyVisualDiff(diff);
    assert.equal(result.changes[0].type, "layout-shift");
    assert.match(result.changes[0].description, /no translation measured/);
  });

  it("should trust shift region hints as layout-shift", () => {
    const diff = makeDiff([
      {
        x: 20,
        y: 80,
        width: 48,
        height: 48,
        diffPixelCount: 1800,
        regionType: "shift",
      },
    ]);

    const result = classifyVisualDiff(diff);

    assert.equal(result.changes[0].type, "layout-shift");
    assert.match(result.changes[0].description, /region hint/);
  });

  it("should classify removed elements when a non-background region becomes background", () => {
    const diff = makeDiff([
      {
        x: 100,
        y: 120,
        width: 220,
        height: 80,
        diffPixelCount: 16000,
        colorSample: {
          baseline: { r: 30, g: 64, b: 175, hex: "#1e40af" },
          current: { r: 255, g: 255, b: 255, hex: "#ffffff" },
          distance: 330,
        },
      },
    ]);

    const result = classifyVisualDiff(diff);

    assert.equal(result.changes[0].type, "element-removed");
  });

  it("should classify added elements when background becomes a non-background region", () => {
    const diff = makeDiff([
      {
        x: 100,
        y: 120,
        width: 220,
        height: 80,
        diffPixelCount: 16000,
        colorSample: {
          baseline: { r: 255, g: 255, b: 255, hex: "#ffffff" },
          current: { r: 30, g: 64, b: 175, hex: "#1e40af" },
          distance: 330,
        },
      },
    ]);

    const result = classifyVisualDiff(diff);

    assert.equal(result.changes[0].type, "element-added");
  });

  it("should group adjacent layout shifts", () => {
    const diff = makeDiff([
      { x: 0, y: 100, width: 500, height: 200, diffPixelCount: 60000 },
      { x: 500, y: 120, width: 300, height: 180, diffPixelCount: 40000 },
    ]);
    const result = classifyVisualDiff(diff);
    // Both should be layout shifts, and grouped into 1
    const layoutShifts = result.changes.filter(
      (c) => c.type === "layout-shift"
    );
    assert.equal(layoutShifts.length, 1);
  });

  it("should generate summary", () => {
    const diff = makeDiff([
      { x: 10, y: 10, width: 32, height: 32, diffPixelCount: 800 },
      { x: 50, y: 100, width: 400, height: 20, diffPixelCount: 2000 },
    ]);
    const result = classifyVisualDiff(diff);
    assert.ok(result.summary.includes("icon-change"));
    assert.ok(result.summary.includes("text-change"));
  });

  it("should handle empty diff", () => {
    const diff = makeDiff([]);
    const result = classifyVisualDiff(diff);
    assert.equal(result.changes.length, 0);
    assert.equal(result.summary, "no changes");
  });
});
