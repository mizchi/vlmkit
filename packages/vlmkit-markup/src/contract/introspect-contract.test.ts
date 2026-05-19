import test from "node:test";
import assert from "node:assert/strict";
import {
  landmarkRegionsToUiContract,
  layoutContractToUiLayout,
} from "./introspect-contract.ts";
import type { LandmarkRegion } from "../component/semantic-drilldown.ts";

function region(partial: Partial<LandmarkRegion>): LandmarkRegion {
  return {
    role: "main",
    name: "Blog home",
    path: "body[0]>main[0]",
    bbox: { left: 0, top: 0, width: 960, height: 640 },
    order: 0,
    layout: {
      display: "grid",
      gridTemplateColumns: "minmax(0px, 760px) 360px",
      gridTemplateRows: "auto 1fr",
      minWidth: "320px",
      maxWidth: "1324px",
      minHeight: "0px",
      maxHeight: "none",
      overflowX: "visible",
      overflowY: "visible",
      clientWidth: 960,
      clientHeight: 640,
      scrollWidth: 960,
      scrollHeight: 640,
    },
    ...partial,
  };
}

test("layoutContractToUiLayout maps bounded grid layout", () => {
  const layout = layoutContractToUiLayout(region({}).layout!);
  assert.deepEqual(layout.width, { kind: "fluid", min: 320, max: 1324 });
  assert.deepEqual(layout.height, { kind: "content" });
  assert.deepEqual(layout.scroll, { x: false, y: false });
  assert.equal(layout.display.kind, "grid");
});

test("layoutContractToUiLayout maps scrollports", () => {
  const layout = layoutContractToUiLayout(region({
    layout: {
      ...region({}).layout!,
      overflowY: "auto",
      maxHeight: "720px",
      clientHeight: 480,
      scrollHeight: 960,
    },
  }).layout!);
  assert.deepEqual(layout.height, { kind: "scrollport", max: 720 });
  assert.deepEqual(layout.scroll, { x: false, y: true });
});

test("landmarkRegionsToUiContract builds draft contract from captured landmarks", () => {
  const contract = landmarkRegionsToUiContract({
    screenId: "blog-home",
    viewports: [{ label: "desktop", width: 1536, height: 1024 }],
    captures: [{
      viewport: "desktop",
      landmarks: [
        region({ role: "main", name: "Blog home" }),
        region({
          role: "complementary",
          name: "Topics",
          path: "body[0]>aside[0]",
          order: 1,
          bbox: { left: 960, top: 120, width: 360, height: 420 },
        }),
      ],
    }],
  });

  assert.equal(contract.version, 1);
  assert.equal(contract.screens[0]!.landmarks.length, 2);
  assert.equal(contract.screens[0]!.landmarks[1]!.id, "complementary-topics");
});
