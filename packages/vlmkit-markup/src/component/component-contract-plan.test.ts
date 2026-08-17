import { test } from "vitest";
import assert from "node:assert/strict";
import {
  deriveComponentContractPlan,
  isComponentProbeState,
  isForcedPseudoState,
  mergeComponentProbeStates,
} from "./component-contract-plan.ts";

test("deriveComponentContractPlan separates probes from expectations", () => {
  const plan = deriveComponentContractPlan({
    version: 1,
    screens: [
      {
        id: "shell",
        pattern: "app-shell",
        goal: "app-shell",
        viewports: [{ label: "desktop", width: 1440, height: 900 }],
        requiredStates: [
          { id: "hover", kind: "hover", selector: "button", required: true },
          { id: "focus", kind: "focus-visible", selector: "button", required: true },
          { id: "scrolled", kind: "scrolled", selector: "[data-scrollport=\"messages\"]", required: true },
        ],
        expectedScrollports: [
          { id: "messages", name: "messages", selector: "[data-scrollport=\"messages\"]", axis: "y", required: true },
        ],
        canvas: {
          stateHook: "window.__gameState",
          requiredStateFields: ["mode", "frame", "playerX", "playerY", "score", "assetsReady"],
        },
        landmarks: [
          {
            id: "main",
            role: "main",
            name: "",
            layout: {
              width: { kind: "fluid", max: 960 },
              height: { kind: "content" },
              display: { kind: "block" },
              scroll: { x: false, y: false },
            },
          },
        ],
      },
    ],
  });

  assert.equal(plan.goal, "app-shell");
  assert.deepEqual(plan.probes.states, ["hover", "focus-visible", "scrolled"]);
  assert.equal(plan.probes.scrollTargets[0]?.selector, "[data-scrollport=\"messages\"]");
  assert.equal(plan.expectations.scrollports[0]?.name, "messages");
  assert.equal(plan.expectations.canvas?.stateHook, "window.__gameState");
});

test("mergeComponentProbeStates keeps explicit and contract-derived states unique", () => {
  assert.deepEqual(
    mergeComponentProbeStates(["hover", "scrolled"], ["hover", "focus-visible"]),
    ["hover", "scrolled", "focus-visible"],
  );
  assert.equal(mergeComponentProbeStates(undefined, []), undefined);
});

test("component probe state guards delegate to markup-core policy", () => {
  assert.equal(isComponentProbeState("hover"), true);
  assert.equal(isComponentProbeState("scrolled"), true);
  assert.equal(isComponentProbeState("selected"), false);
  assert.equal(isForcedPseudoState("focus-visible"), true);
  assert.equal(isForcedPseudoState("scrolled"), false);
});
