import test from "node:test";
import assert from "node:assert/strict";
import {
  landmarkRegionsToUiContract,
  layoutContractToUiLayout,
} from "./introspect-contract.ts";
import type { LandmarkRegion } from "../component/semantic-drilldown.ts";
import { validateUiContract } from "./ui-contract.ts";

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

test("layoutContractToUiLayout bounds fluid width from measured client width", () => {
  const layout = layoutContractToUiLayout(region({
    layout: {
      ...region({}).layout!,
      minWidth: "0px",
      maxWidth: "none",
      clientWidth: 640,
      scrollWidth: 640,
    },
  }).layout!);

  assert.deepEqual(layout.width, { kind: "fluid", max: 640 });
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

test("landmarkRegionsToUiContract preserves pattern, goal, and DOM hints", () => {
  const contract = landmarkRegionsToUiContract({
    screenId: "landing-home",
    pattern: "landing",
    goal: "landing",
    viewports: [{ label: "desktop", width: 1440, height: 900 }],
    captures: [{ viewport: "desktop", landmarks: [region({ role: "main", name: "Home" })] }],
    hints: {
      markers: [
        { kind: "primary-cta", selector: "[data-primary-cta]", required: true },
        { kind: "media-slot", selector: "[data-media-slot]", required: true },
        { kind: "next-section", selector: "[data-next-section]", required: true },
      ],
      states: [{ id: "selected-plan", kind: "selected", selector: "[data-selected=\"true\"]" }],
      requiredStates: [{ id: "selected-plan", kind: "selected", selector: "[data-selected=\"true\"]", required: true }],
      expectedScrollports: [
        {
          id: "plan-list",
          name: "plan-list",
          selector: "[data-scrollport=\"plan-list\"]",
          axis: "y",
          required: true,
          minOverflow: 1,
        },
      ],
      assets: [{ id: "hero-media", kind: "image", policy: "replaceable", slot: "hero" }],
    },
  });

  const screen = contract.screens[0]!;
  assert.equal(screen.pattern, "landing");
  assert.equal(screen.goal, "landing");
  assert.equal(screen.markers?.length, 3);
  assert.equal(screen.states?.[0]?.kind, "selected");
  assert.equal(screen.requiredStates?.[0]?.kind, "selected");
  assert.equal(screen.expectedScrollports?.[0]?.name, "plan-list");
  assert.equal(screen.assets?.[0]?.policy, "replaceable");
});

test("landmarkRegionsToUiContract preserves expressive composition hints", () => {
  const contract = landmarkRegionsToUiContract({
    screenId: "signal-slash",
    pattern: "expressive-menu",
    goal: "expressive-menu",
    viewports: [{ label: "desktop", width: 1440, height: 900 }],
    captures: [{ viewport: "desktop", landmarks: [region({ role: "main", name: "Night Dispatch" })] }],
    hints: {
      markers: [{ kind: "selected", selector: "[data-selected=\"true\"]", required: true }],
      states: [
        { id: "selected", kind: "selected", selector: "[data-selected=\"true\"]", required: true },
        { id: "focus-visible", kind: "focus-visible", selector: "button", required: true },
      ],
      requiredStates: [
        { id: "selected", kind: "selected", selector: "[data-selected=\"true\"]", required: true },
        { id: "hover", kind: "hover", selector: "button", required: true, minChangeRatio: 0.001 },
        { id: "focus-visible", kind: "focus-visible", selector: "button", required: true, minChangeRatio: 0.001 },
      ],
      composition: {
        style: "poster",
        axes: ["diagonal", "layered"],
        layers: [
          { id: "menu-slash", role: "content", target: "[data-composition-layer=\"menu-slash\"]", transform: "rotate(-5deg)" },
          { id: "foreground", role: "foreground", target: "[data-composition-layer=\"foreground\"]" },
        ],
        shapes: [
          { id: "slash-panel", kind: "slash-panel", target: "[data-shape=\"slash-panel\"]" },
          { id: "sticker", kind: "sticker", target: "[data-shape=\"sticker\"]" },
        ],
        contrast: { mode: "high", palette: ["#050505", "#e60012", "#ffffff"] },
      },
    },
  });

  const screen = contract.screens[0]!;
  assert.equal(screen.composition?.style, "poster");
  assert.equal(screen.requiredStates?.length, 3);
  assert.equal(screen.composition?.layers?.length, 2);
  assert.equal(screen.composition?.shapes?.[0]?.kind, "slash-panel");
  assert.deepEqual(validateUiContract(contract), []);
});
