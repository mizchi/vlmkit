import test from "node:test";
import assert from "node:assert/strict";
import {
  evaluateComponentGoal,
  getComponentGoalProfile,
  listComponentGoals,
} from "./component-goal.ts";

test("app goal accepts practical AI mock convergence without pixel perfection", () => {
  const result = evaluateComponentGoal({
    goal: "app",
    pixelDiffRatio: 0.2257,
    landscapeDiffRatio: 0.0252,
  });

  assert.equal(result.status, "pass");
  assert.equal(result.primaryMetric, "landscape");
  assert.match(result.summary, /landscape 2\.52% <= 3\.00%/);
  assert.match(result.summary, /pixel 22\.57% <= 25\.00%/);
});

test("app goal sends borderline practical output to visual review", () => {
  const result = evaluateComponentGoal({
    goal: "app",
    pixelDiffRatio: 0.31,
    landscapeDiffRatio: 0.041,
  });

  assert.equal(result.status, "review");
  assert.match(result.summary, /review/);
});

test("layout goal ignores high pixel diff when coarse structure is good", () => {
  const result = evaluateComponentGoal({
    goal: "layout",
    pixelDiffRatio: 0.42,
    landscapeDiffRatio: 0.026,
  });

  assert.equal(result.status, "pass");
  assert.equal(result.primaryMetric, "landscape");
});

test("pixel goal remains strict for screenshot reproduction", () => {
  const result = evaluateComponentGoal({
    goal: "pixel",
    pixelDiffRatio: 0.04,
    landscapeDiffRatio: 0.004,
  });

  assert.equal(result.status, "review");
  assert.equal(result.primaryMetric, "pixel");
});

test("app-shell goal fails when an explicit scrollport is broken", () => {
  const result = evaluateComponentGoal({
    goal: "app-shell",
    pixelDiffRatio: 0.04,
    landscapeDiffRatio: 0.0014,
    scrollports: { total: 3, ok: 2, broken: 1, empty: 0 },
  });

  assert.equal(result.status, "fail");
  assert.equal(result.primaryMetric, "landscape");
  assert.match(result.summary, /scrollports 2\/3 ok, 1 broken/);
});

test("app-shell goal sends missing scrollport evidence to review", () => {
  const result = evaluateComponentGoal({
    goal: "app-shell",
    pixelDiffRatio: 0.02,
    landscapeDiffRatio: 0.001,
  });

  assert.equal(result.status, "review");
  assert.match(result.summary, /no explicit scrollports/);
});

test("app-shell goal fails when contract expected scrollports are missing", () => {
  const result = evaluateComponentGoal({
    goal: "app-shell",
    pixelDiffRatio: 0.02,
    landscapeDiffRatio: 0.001,
    scrollports: {
      total: 2,
      ok: 2,
      broken: 0,
      empty: 0,
      expected: {
        total: 3,
        ok: 2,
        missing: 1,
        broken: 0,
        empty: 0,
        missingNames: ["messages"],
        brokenNames: [],
        emptyNames: [],
      },
    },
  });

  assert.equal(result.status, "fail");
  assert.match(result.summary, /expected 2\/3 ok/);
  assert.match(result.summary, /1 expected missing: messages/);
});

test("landing goal passes when first-viewport evidence is present", () => {
  const result = evaluateComponentGoal({
    goal: "landing",
    pixelDiffRatio: 0.08,
    landscapeDiffRatio: 0.0112,
    landing: {
      heroVisible: true,
      primaryCtaVisible: true,
      nextSectionHintVisible: true,
      mediaSlotVisible: true,
    },
  });

  assert.equal(result.status, "pass");
  assert.equal(result.primaryMetric, "landscape");
  assert.match(result.summary, /landing hero ok, CTA ok, next hint ok, media slot ok/);
});

test("landing goal fails when the primary CTA is not visible", () => {
  const result = evaluateComponentGoal({
    goal: "landing",
    pixelDiffRatio: 0.04,
    landscapeDiffRatio: 0.01,
    landing: {
      heroVisible: true,
      primaryCtaVisible: false,
      nextSectionHintVisible: true,
      mediaSlotVisible: true,
    },
  });

  assert.equal(result.status, "fail");
  assert.match(result.summary, /CTA missing/);
});

test("canvas goal passes with nonblank frame delta and input evidence", () => {
  const result = evaluateComponentGoal({
    goal: "canvas",
    pixelDiffRatio: 0.0095,
    landscapeDiffRatio: 0.0002,
    canvas: {
      canvasCount: 1,
      nonblank: true,
      frameDelta: true,
      inputResponsive: true,
    },
  });

  assert.equal(result.status, "pass");
  assert.match(result.summary, /canvas nonblank ok, frame delta ok, input ok/);
});

test("canvas goal fails when no canvas is detected", () => {
  const result = evaluateComponentGoal({
    goal: "canvas",
    pixelDiffRatio: 0.01,
    landscapeDiffRatio: 0.001,
  });

  assert.equal(result.status, "fail");
  assert.match(result.summary, /no canvas evidence/);
});

test("expressive-menu goal passes with semantic composition evidence", () => {
  const result = evaluateComponentGoal({
    goal: "expressive-menu",
    pixelDiffRatio: 0.31,
    landscapeDiffRatio: 0.034,
    expressiveMenu: {
      compositionLayers: 3,
      compositionShapes: 3,
      selectedVisible: true,
      focusableItemCount: 5,
      semanticMenuText: true,
      diagonalEvidence: true,
      highContrast: true,
      minMenuContrastRatio: 5.06,
      lowContrastItemCount: 0,
      hoverChanged: true,
      focusVisibleChanged: true,
    },
  });

  assert.equal(result.status, "pass");
  assert.equal(result.primaryMetric, "landscape");
  assert.match(result.summary, /expressive selected ok, menu text ok/);
  assert.match(result.summary, /composition 3 layers\/3 shapes/);
});

test("expressive-menu goal fails when selected state or contrast evidence is missing", () => {
  const result = evaluateComponentGoal({
    goal: "expressive-menu",
    pixelDiffRatio: 0.05,
    landscapeDiffRatio: 0.01,
    expressiveMenu: {
      compositionLayers: 3,
      compositionShapes: 2,
      selectedVisible: false,
      focusableItemCount: 4,
      semanticMenuText: true,
      diagonalEvidence: true,
      highContrast: false,
      minMenuContrastRatio: 2.8,
      lowContrastItemCount: 1,
      hoverChanged: true,
      focusVisibleChanged: true,
    },
  });

  assert.equal(result.status, "fail");
  assert.match(result.summary, /selected missing/);
  assert.match(result.summary, /contrast missing/);
  assert.match(result.summary, /contrast min 2\.80/);
  assert.match(result.summary, /1 low contrast/);
});

test("expressive-menu goal reviews missing state probes and fails inert state probes", () => {
  const noProbe = evaluateComponentGoal({
    goal: "expressive-menu",
    pixelDiffRatio: 0.05,
    landscapeDiffRatio: 0.01,
    expressiveMenu: {
      compositionLayers: 3,
      compositionShapes: 2,
      selectedVisible: true,
      focusableItemCount: 4,
      semanticMenuText: true,
      diagonalEvidence: true,
      highContrast: true,
      minMenuContrastRatio: 5.06,
      lowContrastItemCount: 0,
      hoverChanged: null,
      focusVisibleChanged: null,
    },
  });
  assert.equal(noProbe.status, "review");
  assert.match(noProbe.summary, /state probes missing/);

  const inert = evaluateComponentGoal({
    goal: "expressive-menu",
    pixelDiffRatio: 0.05,
    landscapeDiffRatio: 0.01,
    expressiveMenu: {
      compositionLayers: 3,
      compositionShapes: 2,
      selectedVisible: true,
      focusableItemCount: 4,
      semanticMenuText: true,
      diagonalEvidence: true,
      highContrast: true,
      minMenuContrastRatio: 5.06,
      lowContrastItemCount: 0,
      hoverChanged: false,
      focusVisibleChanged: false,
    },
  });
  assert.equal(inert.status, "fail");
  assert.match(inert.summary, /hover inert/);
  assert.match(inert.summary, /focus inert/);
});

test("unknown goal falls back to app profile", () => {
  assert.equal(getComponentGoalProfile("unknown").goal, "app");
});

test("goal list is stable for CLI help", () => {
  assert.deepEqual(listComponentGoals(), ["app", "layout", "pixel", "draft", "app-shell", "landing", "canvas", "expressive-menu"]);
});
