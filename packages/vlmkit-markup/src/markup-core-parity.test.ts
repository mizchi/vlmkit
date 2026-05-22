import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import {
  computeComponentGoalStatus,
  computeSemanticDrilldownPolicy,
  getMarkupCoreRuntimeBackend,
  runMarkupCore,
  type MarkupCoreSemanticDrilldownPolicy,
} from "./markup-core-runtime.ts";
import type {
  ComponentCanvasEvidence,
  ComponentExpressiveMenuEvidence,
  ComponentLandingEvidence,
  ComponentScrollportEvidence,
  ComponentGoalProfile,
  ComponentGoalStatus,
} from "./component/component-goal.ts";

interface ComponentGoalStatusFixture {
  id: string;
  input: {
    goal: string;
    pixelDiffRatio: number;
    landscapeDiffRatio: number;
    pass: ComponentGoalProfile["pass"];
    review: ComponentGoalProfile["review"];
    scrollports?: ComponentScrollportEvidence;
    landing?: ComponentLandingEvidence;
    canvas?: ComponentCanvasEvidence;
    expressiveMenu?: ComponentExpressiveMenuEvidence;
  };
  expectedStatus: ComponentGoalStatus;
}

interface SemanticDrilldownPolicyFixture {
  id: string;
  input: {
    layoutScore: number;
    decorationScore: number;
    heatmapKindCount: number;
  };
  expected: MarkupCoreSemanticDrilldownPolicy;
}

interface MarkupCoreParityFixture {
  componentGoalStatus: ComponentGoalStatusFixture[];
  semanticDrilldownPolicy: SemanticDrilldownPolicyFixture[];
}

const fixturePath = fileURLToPath(
  new URL("../fixtures/markup-core/parity.json", import.meta.url),
);
const fixture = JSON.parse(
  readFileSync(fixturePath, "utf8"),
) as MarkupCoreParityFixture;

test("markup-core component goal fixtures match TS bridge and CLI", () => {
  for (const entry of fixture.componentGoalStatus) {
    assert.equal(
      computeComponentGoalStatus(entry.input),
      entry.expectedStatus,
      `${entry.id} TS bridge`,
    );
    assert.equal(
      runMarkupCore(componentGoalCliArgs(entry.input)),
      entry.expectedStatus,
      `${entry.id} CLI`,
    );
  }
  assert.equal(getMarkupCoreRuntimeBackend(), "direct-js");
});

test("markup-core semantic drilldown fixtures match TS bridge and CLI", () => {
  for (const entry of fixture.semanticDrilldownPolicy) {
    const policy = computeSemanticDrilldownPolicy(
      entry.input.layoutScore,
      entry.input.decorationScore,
      entry.input.heatmapKindCount,
    );
    assert.deepEqual(policy, entry.expected, `${entry.id} TS bridge`);

    const [flow, priorityScore, reasonId] = runMarkupCore([
      "semantic-drilldown-policy",
      doubleArg(entry.input.layoutScore),
      doubleArg(entry.input.decorationScore),
      intArg(entry.input.heatmapKindCount),
    ]).split("|");
    assert.equal(flow, entry.expected.flow, `${entry.id} CLI flow`);
    assert.equal(reasonId, entry.expected.reasonId, `${entry.id} CLI reason`);
    assert.equal(
      Number(priorityScore),
      entry.expected.priorityScore,
      `${entry.id} CLI priority`,
    );
  }
});

function componentGoalCliArgs(
  input: ComponentGoalStatusFixture["input"],
): string[] {
  return [
    "component-goal-status",
    input.goal,
    doubleArg(input.pixelDiffRatio),
    doubleArg(input.landscapeDiffRatio),
    optionalDoubleArg(input.pass.landscape),
    optionalDoubleArg(input.pass.pixel),
    optionalDoubleArg(input.review.landscape),
    optionalDoubleArg(input.review.pixel),
    intArg(input.scrollports?.total),
    intArg(input.scrollports?.broken),
    intArg(input.scrollports?.empty),
    intArg(input.scrollports?.expected?.total),
    intArg(input.scrollports?.expected?.missing),
    intArg(input.scrollports?.expected?.broken),
    intArg(input.scrollports?.expected?.empty),
    boolArg(Boolean(input.landing)),
    boolArg(input.landing?.heroVisible),
    boolArg(input.landing?.primaryCtaVisible),
    boolArg(input.landing?.nextSectionHintVisible),
    boolArg(input.landing?.mediaSlotVisible),
    intArg(input.canvas?.canvasCount),
    boolArg(input.canvas?.nonblank),
    boolArg(input.canvas?.frameDelta),
    optionalBoolArg(input.canvas?.inputResponsive),
    optionalBoolArg(
      input.canvas?.stateHook
        ? input.canvas.stateHookPresent !== false
        : undefined,
    ),
    intArg(input.canvas?.missingStateFields?.length),
    boolArg(Boolean(input.expressiveMenu)),
    intArg(input.expressiveMenu?.compositionLayers),
    intArg(input.expressiveMenu?.compositionShapes),
    boolArg(input.expressiveMenu?.selectedVisible),
    intArg(input.expressiveMenu?.focusableItemCount),
    boolArg(input.expressiveMenu?.semanticMenuText),
    boolArg(input.expressiveMenu?.diagonalEvidence),
    boolArg(input.expressiveMenu?.highContrast),
    intArg(input.expressiveMenu?.lowContrastItemCount),
    optionalBoolArg(input.expressiveMenu?.hoverChanged),
    optionalBoolArg(input.expressiveMenu?.focusVisibleChanged),
  ];
}

function doubleArg(value: number): string {
  return String(Number.isFinite(value) ? value : 0);
}

function optionalDoubleArg(value: number | undefined): string {
  return typeof value === "number" && Number.isFinite(value)
    ? String(value)
    : "null";
}

function intArg(value: number | undefined): string {
  return typeof value === "number" && Number.isFinite(value)
    ? String(Math.trunc(value))
    : "0";
}

function boolArg(value: boolean | undefined): string {
  return value ? "true" : "false";
}

function optionalBoolArg(value: boolean | null | undefined): string {
  return typeof value === "boolean" ? String(value) : "null";
}
