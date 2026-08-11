import test from "node:test";
import assert from "node:assert/strict";
import { resolve } from "node:path";
import {
  formatIntrospectionProfile,
  introspectUiContractFromHtml,
  landmarkRegionsToUiContract,
  layoutContractToUiLayout,
  waitUntilForIntrospectionInput,
  type UiContractIntrospectionProfile,
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

test("landmarkRegionsToUiContract emits responsive rules from non-base captures", () => {
  const contract = landmarkRegionsToUiContract({
    screenId: "blog-home",
    viewports: [
      { label: "desktop", width: 1440, height: 900 },
      { label: "mobile", width: 390, height: 844 },
    ],
    captures: [
      {
        viewport: "desktop",
        landmarks: [
          region({
            role: "main",
            name: "Blog home",
            layout: {
              ...region({}).layout!,
              gridTemplateColumns: "760px 320px",
              clientWidth: 1080,
              scrollWidth: 1080,
            },
          }),
        ],
      },
      {
        viewport: "mobile",
        landmarks: [
          region({
            role: "main",
            name: "Blog home",
            layout: {
              ...region({}).layout!,
              gridTemplateColumns: "390px",
              minWidth: "0px",
              maxWidth: "none",
              clientWidth: 390,
              scrollWidth: 390,
            },
          }),
        ],
      },
    ],
  });

  const responsive = contract.screens[0]!.landmarks[0]!.responsive;
  assert.equal(responsive?.length, 1);
  assert.equal(responsive?.[0]?.viewport, "mobile");
  assert.deepEqual(responsive?.[0]?.display, {
    kind: "grid",
    columns: ["390px"],
    rows: ["auto", "1fr"],
  });
  assert.deepEqual(responsive?.[0]?.width, { kind: "fluid", max: 390 });
});

test("landmarkRegionsToUiContract matches responsive landmarks by role and name", () => {
  const contract = landmarkRegionsToUiContract({
    screenId: "shell",
    viewports: [
      { label: "desktop", width: 1440, height: 900 },
      { label: "mobile", width: 390, height: 844 },
    ],
    captures: [
      {
        viewport: "desktop",
        landmarks: [
          region({ role: "navigation", name: "Primary", path: "body[0]>nav[0]", order: 0 }),
          region({ role: "main", name: "Workspace", path: "body[0]>main[0]", order: 1 }),
        ],
      },
      {
        viewport: "mobile",
        landmarks: [
          region({
            role: "main",
            name: "Workspace",
            path: "body[0]>div[0]>main[0]",
            order: 0,
            layout: {
              ...region({}).layout!,
              gridTemplateColumns: "390px",
              clientWidth: 390,
              scrollWidth: 390,
            },
          }),
          region({
            role: "navigation",
            name: "Primary",
            path: "body[0]>div[0]>nav[0]",
            order: 1,
            layout: {
              ...region({}).layout!,
              maxHeight: "64px",
              clientHeight: 64,
              scrollHeight: 64,
            },
          }),
        ],
      },
    ],
  });

  const nav = contract.screens[0]!.landmarks.find((landmark) => landmark.id === "navigation-primary");
  const main = contract.screens[0]!.landmarks.find((landmark) => landmark.id === "main-workspace");
  assert.equal(nav?.responsive?.[0]?.height?.kind, "content");
  assert.deepEqual(main?.responsive?.[0]?.display, {
    kind: "grid",
    columns: ["390px"],
    rows: ["auto", "1fr"],
  });
});

test("landmarkRegionsToUiContract preserves landmark content, repeat, and slots", () => {
  const contract = landmarkRegionsToUiContract({
    screenId: "signal-slash",
    pattern: "expressive-menu",
    goal: "expressive-menu",
    viewports: [{ label: "desktop", width: 1440, height: 900 }],
    captures: [{
      viewport: "desktop",
      landmarks: [
        region({
          role: "navigation",
          name: "Primary commands",
          slots: [
            { id: "controls", kind: "control", marker: "selected", required: true },
            { id: "title", kind: "content", required: true },
          ],
          repeat: { kind: "list", itemName: "menu-item", itemCount: 5 },
          content: {
            kind: "list",
            density: "normal",
            itemCount: 5,
            textLength: 39,
            textRowCount: 5,
          },
        }),
      ],
    }],
    hints: {
      markers: [{ kind: "selected", selector: "[data-selected=\"true\"]", required: true }],
      requiredStates: [
        { id: "selected", kind: "selected", selector: "[data-selected=\"true\"]", required: true },
        { id: "hover", kind: "hover", selector: "button", required: true },
        { id: "focus-visible", kind: "focus-visible", selector: "button", required: true },
      ],
      composition: { style: "poster" },
    },
  });

  const landmark = contract.screens[0]!.landmarks[0]!;
  assert.deepEqual(landmark.slots, [
    { id: "controls", kind: "control", marker: "selected", required: true },
    { id: "title", kind: "content", required: true },
  ]);
  assert.deepEqual(landmark.repeat, {
    kind: "list",
    itemName: "menu-item",
    minItems: 5,
    maxItems: 5,
  });
  assert.deepEqual(landmark.content, {
    kind: "list",
    density: "normal",
    items: { exact: 5 },
    text: { maxLength: 39, rowCount: 5 },
  });
  assert.deepEqual(validateUiContract(contract), []);
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

test("formatIntrospectionProfile reports browser and viewport timing", () => {
  const summary = formatIntrospectionProfile({
    totalMs: 1520.4,
    browserLaunchMs: 410.2,
    browserCloseMs: 30.1,
    viewports: [
      {
        label: "desktop",
        width: 1440,
        height: 900,
        dpr: 1,
        totalMs: 600.3,
        navigateMs: 320.1,
        landmarkMs: 45.2,
        hintMs: 20.5,
        landmarks: 4,
      },
      {
        label: "mobile",
        width: 390,
        height: 844,
        dpr: 1,
        totalMs: 480.2,
        navigateMs: 260.1,
        landmarkMs: 35.2,
        hintMs: 0,
        landmarks: 3,
      },
    ],
  });

  assert.match(summary, /total 1520ms/);
  assert.match(summary, /browser launch 410ms/);
  assert.match(summary, /desktop 1440x900@1/);
  assert.match(summary, /landmarks 4/);
  assert.match(summary, /mobile 390x844@1/);
});

test("waitUntilForIntrospectionInput avoids networkidle for local files", () => {
  assert.equal(waitUntilForIntrospectionInput("fixtures/page.html"), "load");
  assert.equal(waitUntilForIntrospectionInput("/tmp/page.html"), "load");
  assert.equal(waitUntilForIntrospectionInput("file:///tmp/page.html"), "load");
  assert.equal(waitUntilForIntrospectionInput("https://example.com/page.html"), "networkidle");
  assert.equal(waitUntilForIntrospectionInput("http://example.com/page.html"), "networkidle");
});

/**
 * The producer, not the formatter.
 *
 * `formatIntrospectionProfile` above is fed hand-written numbers, and that is
 * precisely how a regression got through: a refactor moved the browser launch
 * and close inside a helper that owns both, the three assignments that lived in
 * the deleted `finally` went with it, and the profile started reporting
 * `browserLaunchMs 0.01 / browserCloseMs 0 / totalMs 0` for a run whose single
 * viewport took 2562ms. The formatter test stayed green because it never asks
 * anything to produce a profile.
 *
 * Asserted as invariants rather than durations: a wall-clock threshold would be
 * flaky on a loaded machine, but `totalMs` cannot be *smaller* than a phase it
 * contains no matter how fast or slow the host is.
 */
test("introspectUiContractFromHtml populates the profile it hands to onProfile", { timeout: 120_000 }, async () => {
  let profile: UiContractIntrospectionProfile | undefined;
  await introspectUiContractFromHtml({
    input: resolve(import.meta.dirname!, "../../../../fixtures/external-assets/page.html"),
    viewports: [{ label: "desktop", width: 1280, height: 800 }],
    onProfile: (p) => { profile = p; },
  });
  assert.ok(profile, "onProfile was never called");
  const viewportTotal = profile.viewports[0]?.totalMs ?? 0;
  assert.ok(viewportTotal > 0, `viewport totalMs should be measured, got ${viewportTotal}`);
  // The assertion the regression fails on: it reported total 0 against a
  // viewport of 2562ms.
  assert.ok(
    profile.totalMs >= viewportTotal,
    `totalMs (${profile.totalMs}) must contain the viewport it measured (${viewportTotal})`,
  );
  // Launching and closing a real Chromium is never free. Both were zero.
  assert.ok(profile.browserLaunchMs > 0, `browserLaunchMs should be measured, got ${profile.browserLaunchMs}`);
  assert.ok(profile.browserCloseMs > 0, `browserCloseMs should be measured, got ${profile.browserCloseMs}`);
  assert.ok(
    profile.totalMs >= profile.browserLaunchMs + profile.browserCloseMs,
    "totalMs must contain the launch and close it measured",
  );
});
