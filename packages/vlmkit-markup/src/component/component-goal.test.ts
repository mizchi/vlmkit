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

test("unknown goal falls back to app profile", () => {
  assert.equal(getComponentGoalProfile("unknown").goal, "app");
});

test("goal list is stable for CLI help", () => {
  assert.deepEqual(listComponentGoals(), ["app", "layout", "pixel", "draft", "app-shell", "landing"]);
});
