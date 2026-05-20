import test from "node:test";
import assert from "node:assert/strict";
import {
  buildSemanticDrilldown,
  describeScrollportStatus,
  describeLandmarkLayoutContract,
  normalizeLandmarkRole,
  selectNextSemanticDrilldown,
  type LandmarkRegion,
  type LandmarkLayoutContract,
  type ScrollportRegion,
} from "./semantic-drilldown.ts";
import type { LandscapeCellDiff } from "@mizchi/vlmkit-core/landscape-diff.ts";
import type { HeatmapRegion } from "@mizchi/vlmkit-core/heatmap-regions.ts";

function landmark(partial: Partial<LandmarkRegion>): LandmarkRegion {
  return {
    role: "main",
    name: "",
    path: "main[0]",
    bbox: { left: 0, top: 0, width: 100, height: 100 },
    order: 0,
    ...partial,
  };
}

function cell(partial: Partial<LandscapeCellDiff>): LandscapeCellDiff {
  return {
    row: 0,
    col: 0,
    x: 0,
    y: 0,
    width: 50,
    height: 50,
    score: 0.2,
    baseline: { r: 0, g: 0, b: 0, luma: 0, ink: 0, hex: "#000000" },
    current: { r: 255, g: 255, b: 255, luma: 255, ink: 0, hex: "#ffffff" },
    ...partial,
  };
}

function heat(partial: Partial<HeatmapRegion>): HeatmapRegion {
  return {
    left: 0,
    top: 0,
    width: 20,
    height: 20,
    area: 400,
    kind: "filled-rect",
    dominantColor: { r: 20, g: 40, b: 60, hex: "#14283c" },
    ...partial,
  };
}

test("normalizeLandmarkRole maps semantic HTML and concrete ARIA roles", () => {
  assert.equal(normalizeLandmarkRole({ tagName: "main" }), "main");
  assert.equal(normalizeLandmarkRole({ tagName: "nav" }), "navigation");
  assert.equal(normalizeLandmarkRole({ tagName: "div", role: "banner" }), "banner");
  assert.equal(normalizeLandmarkRole({ tagName: "div", role: "landmark" }), undefined);
});

test("normalizeLandmarkRole requires a useful name for section/form landmarks", () => {
  assert.equal(normalizeLandmarkRole({ tagName: "section" }), undefined);
  assert.equal(normalizeLandmarkRole({ tagName: "section", name: "Latest articles" }), "region");
  assert.equal(normalizeLandmarkRole({ tagName: "form" }), undefined);
  assert.equal(normalizeLandmarkRole({ tagName: "form", name: "Subscribe" }), "form");
});

test("buildSemanticDrilldown prioritizes layout flow for coarse landscape changes", () => {
  const rows = buildSemanticDrilldown({
    landmarks: [
      landmark({ role: "banner", path: "header[0]", bbox: { left: 0, top: 0, width: 320, height: 80 } }),
      landmark({ role: "main", path: "main[0]", bbox: { left: 0, top: 80, width: 320, height: 420 }, order: 1 }),
    ],
    landscapeCells: [
      cell({ x: 0, y: 90, width: 160, height: 120, score: 0.24 }),
    ],
    heatmapRegions: [
      heat({ left: 8, top: 96, width: 80, height: 24, area: 1600, kind: "text" }),
    ],
  });

  assert.equal(rows.length, 1);
  assert.equal(rows[0]!.landmark.role, "main");
  assert.equal(rows[0]!.flow, "layout");
  assert.ok(rows[0]!.layoutScore > rows[0]!.decorationScore);
});

test("buildSemanticDrilldown separates decoration flow when only local paint differs", () => {
  const rows = buildSemanticDrilldown({
    landmarks: [
      landmark({ role: "complementary", path: "aside[0]", bbox: { left: 200, top: 80, width: 120, height: 300 } }),
    ],
    landscapeCells: [
      cell({ x: 0, y: 0, width: 80, height: 80, score: 0.01 }),
    ],
    heatmapRegions: [
      heat({ left: 220, top: 120, width: 64, height: 64, area: 3200, kind: "image" }),
    ],
  });

  assert.equal(rows.length, 1);
  assert.equal(rows[0]!.flow, "decoration");
  assert.equal(rows[0]!.heatmapRegions[0]!.kind, "image");
});

test("selectNextSemanticDrilldown prefers layout before decoration even when decoration is larger", () => {
  const rows = buildSemanticDrilldown({
    landmarks: [
      landmark({ role: "complementary", path: "aside[0]", bbox: { left: 0, top: 0, width: 100, height: 100 } }),
      landmark({ role: "region", path: "section[0]", bbox: { left: 120, top: 0, width: 100, height: 100 }, order: 1 }),
    ],
    landscapeCells: [
      cell({ x: 120, y: 0, width: 50, height: 50, score: 0.1 }),
    ],
    heatmapRegions: [
      heat({ left: 0, top: 0, width: 100, height: 100, area: 10000 }),
    ],
  });

  assert.equal(rows[0]!.flow, "decoration");
  const next = selectNextSemanticDrilldown(rows);
  assert.equal(next?.landmark.role, "region");
  assert.equal(next?.flow, "layout");
});

test("describeLandmarkLayoutContract exposes bounded grid scrollports", () => {
  const contract: LandmarkLayoutContract = {
    display: "grid",
    gridTemplateColumns: "subgrid",
    gridTemplateRows: "120px 1fr",
    minWidth: "320px",
    maxWidth: "1120px",
    minHeight: "0px",
    maxHeight: "none",
    overflowX: "visible",
    overflowY: "auto",
    clientWidth: 720,
    clientHeight: 480,
    scrollWidth: 720,
    scrollHeight: 960,
  };

  assert.deepEqual(describeLandmarkLayoutContract(contract), {
    width: "bounded 320px..1120px",
    height: "scrollport-y",
    scroll: "y",
    grid: "grid subgrid-columns",
  });
});

test("describeLandmarkLayoutContract keeps measured fluid width visible", () => {
  const contract: LandmarkLayoutContract = {
    display: "block",
    gridTemplateColumns: "none",
    gridTemplateRows: "none",
    minWidth: "0px",
    maxWidth: "none",
    minHeight: "0px",
    maxHeight: "none",
    overflowX: "visible",
    overflowY: "visible",
    clientWidth: 1180,
    clientHeight: 600,
    scrollWidth: 1180,
    scrollHeight: 600,
  };

  assert.deepEqual(describeLandmarkLayoutContract(contract), {
    width: "fluid measured 1180px",
    height: "content",
    scroll: "none",
    grid: "block",
  });
});

function scrollport(partial: Partial<ScrollportRegion>): ScrollportRegion {
  return {
    name: "messages",
    path: "[data-scrollport][0]",
    bbox: { left: 0, top: 0, width: 320, height: 480 },
    order: 0,
    explicit: true,
    overflowX: "visible",
    overflowY: "auto",
    clientWidth: 320,
    clientHeight: 480,
    scrollWidth: 320,
    scrollHeight: 960,
    ...partial,
  };
}

test("describeScrollportStatus accepts explicit independent scrollports", () => {
  assert.deepEqual(describeScrollportStatus(scrollport({})), {
    status: "ok",
    scroll: "y",
    reason: "independent scrollport",
  });
});

test("describeScrollportStatus flags overflowing content without scroll overflow", () => {
  assert.deepEqual(describeScrollportStatus(scrollport({ overflowY: "visible" })), {
    status: "broken",
    scroll: "none",
    reason: "content overflows but overflow is not scrollable",
  });
});

test("describeScrollportStatus flags scrollport markers without overflowing content", () => {
  assert.deepEqual(describeScrollportStatus(scrollport({ scrollHeight: 480 })), {
    status: "empty",
    scroll: "none",
    reason: "marked as scrollport but content does not overflow",
  });
});
