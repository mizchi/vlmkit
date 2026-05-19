import test from "node:test";
import assert from "node:assert/strict";
import {
  summarizeUiContractLandmark,
  validateUiContract,
  type UiContract,
} from "./ui-contract.ts";

const valid: UiContract = {
  version: 1,
  screens: [
    {
      id: "blog-home",
      viewports: [
        { label: "desktop", width: 1536, height: 1024 },
        { label: "mobile", width: 432, height: 911, dpr: 2 },
      ],
      landmarks: [
        {
          id: "main",
          role: "main",
          name: "Blog home",
          layout: {
            width: { kind: "fluid", min: 320, max: 1324 },
            height: { kind: "content" },
            display: {
              kind: "grid",
              columns: ["minmax(0, 760px)", "minmax(280px, 360px)"],
              rows: ["auto", "1fr"],
              areas: [["content", "rail"]],
              gap: { row: 48, column: 64 },
            },
            scroll: { x: false, y: false },
          },
        },
        {
          id: "rail",
          role: "complementary",
          name: "Topics",
          layout: {
            width: { kind: "fixed", value: 360 },
            height: { kind: "scrollport", max: 720 },
            display: { kind: "subgrid", axis: "rows" },
            scroll: { x: false, y: true },
          },
        },
      ],
    },
  ],
};

test("validateUiContract accepts landmark layout contracts", () => {
  assert.deepEqual(validateUiContract(valid), []);
});

test("validateUiContract rejects abstract landmark role", () => {
  const contract = structuredClone(valid);
  contract.screens[0]!.landmarks[0]!.role = "landmark" as never;
  const issues = validateUiContract(contract);
  assert.ok(issues.some((issue) => issue.message.includes("abstract")));
});

test("validateUiContract requires fluid width constraints", () => {
  const contract = structuredClone(valid);
  contract.screens[0]!.landmarks[0]!.layout.width = { kind: "fluid" };
  const issues = validateUiContract(contract);
  assert.ok(issues.some((issue) => issue.message.includes("min or max")));
});

test("summarizeUiContractLandmark keeps layout and scroll decisions visible", () => {
  assert.equal(
    summarizeUiContractLandmark(valid.screens[0]!.landmarks[1]!),
    "complementary \"Topics\": fixed 360px, scrollport max 720px, scroll-y, subgrid rows",
  );
});

test("summarizeUiContractLandmark shows unbounded fluid width explicitly", () => {
  const landmark = structuredClone(valid.screens[0]!.landmarks[0]!);
  landmark.layout.width = { kind: "fluid" };
  assert.match(summarizeUiContractLandmark(landmark), /fluid unbounded/);
  assert.ok(validateUiContract({ version: 1, screens: [{ id: "x", viewports: [{ label: "desktop", width: 1, height: 1 }], landmarks: [landmark] }] }).length > 0);
});
