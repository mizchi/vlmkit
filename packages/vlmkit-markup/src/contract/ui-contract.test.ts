import test from "node:test";
import assert from "node:assert/strict";
import {
  summarizeUiContractScreen,
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

test("validateUiContract accepts enriched landing contracts", () => {
  const contract = structuredClone(valid);
  const screen = contract.screens[0]!;
  screen.pattern = "landing";
  screen.goal = "landing";
  screen.markers = [
    { kind: "primary-cta", selector: "[data-primary-cta]", required: true },
    { kind: "media-slot", selector: "[data-media-slot]", required: true },
    { kind: "next-section", selector: "[data-next-section]", required: true },
  ];
  screen.states = [
    { id: "cta-focus", kind: "focus-visible", selector: "[data-primary-cta]" },
  ];
  screen.content = {
    kind: "static",
    text: { rowCount: 12, maxLength: 420 },
  };
  screen.decoration = {
    typography: [
      { role: "hero-title", family: "system-serif", size: 56, lineHeight: 1.08 },
    ],
    palette: [
      { role: "surface", value: "#f8faf7", token: "surface" },
    ],
    media: [
      { slot: "hero-preview", crop: "cover", aspectRatio: "16/10" },
    ],
  };
  screen.assets = [
    { id: "hero-preview", kind: "image", policy: "replaceable", slot: "hero" },
  ];
  screen.landmarks[0]!.slots = [
    { id: "hero", kind: "media", marker: "media-slot", required: true },
  ];

  assert.deepEqual(validateUiContract(contract), []);
  assert.match(summarizeUiContractScreen(screen), /landing/);
  assert.match(summarizeUiContractScreen(screen), /markers 3/);
});

test("validateUiContract enforces pattern-specific evidence", () => {
  const landing = structuredClone(valid);
  landing.screens[0]!.pattern = "landing";
  landing.screens[0]!.goal = "landing";
  landing.screens[0]!.markers = [
    { kind: "primary-cta", selector: "[data-primary-cta]", required: true },
  ];
  assert.ok(validateUiContract(landing).some((issue) => issue.message.includes("media-slot")));

  const appShell = structuredClone(valid);
  appShell.screens[0]!.pattern = "app-shell";
  appShell.screens[0]!.goal = "app-shell";
  assert.ok(validateUiContract(appShell).some((issue) => issue.message.includes("scrollport")));
  assert.ok(validateUiContract(appShell).some((issue) => issue.message.includes("expectedScrollports")));
  assert.ok(validateUiContract(appShell).some((issue) => issue.message.includes("selected state")));
  assert.ok(validateUiContract(appShell).some((issue) => issue.message.includes("scrolled state")));

  const canvas = structuredClone(valid);
  canvas.screens[0]!.pattern = "canvas";
  canvas.screens[0]!.goal = "canvas";
  canvas.screens[0]!.canvas = {
    stateHook: "window.__gameState",
    requiredStateFields: ["mode", "frame", "score"],
    frameDelta: true,
  };
  assert.ok(validateUiContract(canvas).some((issue) => issue.message.includes("playerX")));
});

test("validateUiContract accepts app-shell expected scrollports and required states", () => {
  const contract = structuredClone(valid);
  const screen = contract.screens[0]!;
  screen.pattern = "app-shell";
  screen.goal = "app-shell";
  screen.sourceOfTruth = "viewport-shell";
  screen.markers = [
    { kind: "scrollport", name: "channels", selector: "[data-scrollport=\"channels\"]", required: true },
    { kind: "selected", selector: "[aria-current=\"page\"]", required: true },
  ];
  screen.expectedScrollports = [
    {
      id: "channels",
      name: "channels",
      selector: "[data-scrollport=\"channels\"]",
      axis: "y",
      required: true,
      minOverflow: 1,
    },
  ];
  screen.requiredStates = [
    { id: "active-route", kind: "selected", selector: "[aria-current=\"page\"]", required: true },
    { id: "channels-scrolled", kind: "scrolled", selector: "[data-scrollport=\"channels\"]", required: true },
  ];

  assert.deepEqual(validateUiContract(contract), []);
  assert.match(summarizeUiContractScreen(screen), /expected scrollports 1/);
  assert.match(summarizeUiContractScreen(screen), /required states 2/);
});

test("validateUiContract validates expected scrollports and required states", () => {
  const contract = structuredClone(valid);
  const screen = contract.screens[0]!;
  screen.expectedScrollports = [
    { id: "", axis: "vertical" as never, required: true, minOverflow: -1 },
    { id: "dup", axis: "y" },
    { id: "dup", axis: "x" },
  ];
  screen.requiredStates = [
    { id: "", kind: "hover", required: true, minChangeRatio: 2 },
    { id: "dup", kind: "pressed" as never, selector: "button" },
    { id: "dup", kind: "focus-visible", selector: "button" },
  ];

  const issues = validateUiContract(contract);
  assert.ok(issues.some((issue) => issue.message.includes("expected scrollport id")));
  assert.ok(issues.some((issue) => issue.message.includes("unknown expected scrollport axis")));
  assert.ok(issues.some((issue) => issue.message.includes("required expected scrollport")));
  assert.ok(issues.some((issue) => issue.message.includes("minOverflow")));
  assert.ok(issues.some((issue) => issue.message.includes("required state id")));
  assert.ok(issues.some((issue) => issue.message.includes("required state must declare selector")));
  assert.ok(issues.some((issue) => issue.message.includes("unknown state kind")));
  assert.ok(issues.some((issue) => issue.message.includes("required state id must be unique")));
  assert.ok(issues.some((issue) => issue.message.includes("minChangeRatio")));
});

test("validateUiContract validates hierarchy and rich metadata ranges", () => {
  const contract = structuredClone(valid);
  contract.screens[0]!.landmarks[1]!.parentId = "missing-parent";
  contract.screens[0]!.landmarks[1]!.slots = [{ id: "", kind: "content" }];
  contract.screens[0]!.landmarks[1]!.content = {
    kind: "list",
    items: { min: 4, max: 2 },
  };
  contract.screens[0]!.landmarks[1]!.assets = [
    { id: "", kind: "image", policy: "replaceable" },
  ];

  const issues = validateUiContract(contract);
  assert.ok(issues.some((issue) => issue.message.includes("unknown parentId")));
  assert.ok(issues.some((issue) => issue.message.includes("slot id is required")));
  assert.ok(issues.some((issue) => issue.message.includes("min cannot exceed max")));
  assert.ok(issues.some((issue) => issue.message.includes("asset id is required")));
});

test("validateUiContract accepts expressive menu composition contracts", () => {
  const contract = structuredClone(valid);
  const screen = contract.screens[0]!;
  screen.pattern = "expressive-menu";
  screen.goal = "expressive-menu";
  screen.sourceOfTruth = "semantic-dom";
  screen.markers = [
    { kind: "selected", selector: "[data-selected=\"true\"]", required: true },
  ];
  screen.states = [
    { id: "selected-menu-item", kind: "selected", selector: "[data-selected=\"true\"]", required: true },
    { id: "menu-focus", kind: "focus-visible", selector: "button", required: true },
  ];
  screen.requiredStates = [
    { id: "selected-menu-item", kind: "selected", selector: "[data-selected=\"true\"]", required: true },
    { id: "menu-hover", kind: "hover", selector: "button", required: true, minChangeRatio: 0.001 },
    { id: "menu-focus", kind: "focus-visible", selector: "button", required: true, minChangeRatio: 0.001 },
  ];
  screen.composition = {
    style: "poster",
    axes: ["diagonal", "layered"],
    contrast: {
      mode: "high",
      minRatio: 4.5,
      palette: ["#050505", "#e60012", "#ffffff"],
    },
    layers: [
      { id: "background", role: "background", z: 0 },
      { id: "menu-slash", role: "content", z: 10, overlap: "avoid-text" },
      { id: "accent", role: "accent", z: 20, transform: "rotate(-8deg)" },
    ],
    shapes: [
      { id: "slash-panel", kind: "slash-panel", role: "menu" },
      { id: "sticker", kind: "sticker", role: "selected item" },
    ],
    motion: [
      { id: "menu-hover", trigger: "hover", effect: "slam", durationMs: 140 },
    ],
  };

  assert.deepEqual(validateUiContract(contract), []);
  assert.match(summarizeUiContractScreen(screen), /expressive-menu/);
  assert.match(summarizeUiContractScreen(screen), /composition poster/);
});

test("validateUiContract requires expressive menu composition and state evidence", () => {
  const contract = structuredClone(valid);
  contract.screens[0]!.pattern = "expressive-menu";
  const issues = validateUiContract(contract);
  assert.ok(issues.some((issue) => issue.message.includes("composition")));
  assert.ok(issues.some((issue) => issue.message.includes("selected or focus-visible")));
  assert.ok(issues.some((issue) => issue.message.includes("require hover state")));

  contract.screens[0]!.composition = {
    style: "zigzag" as never,
    axes: ["sideways" as never],
    contrast: { mode: "extreme" as never, minRatio: 0, palette: ["red"] },
    layers: [{ id: "", role: "backdrop" as never }, { id: "dup", role: "content" }, { id: "dup", role: "accent" }],
    shapes: [{ id: "", kind: "triangle" as never }],
    motion: [{ id: "", trigger: "tap" as never, effect: "wiggle" as never, durationMs: -1 }],
  };
  const richerIssues = validateUiContract(contract);
  assert.ok(richerIssues.some((issue) => issue.message.includes("unknown composition style")));
  assert.ok(richerIssues.some((issue) => issue.message.includes("unknown composition axis")));
  assert.ok(richerIssues.some((issue) => issue.message.includes("unknown composition layer role")));
  assert.ok(richerIssues.some((issue) => issue.message.includes("unknown composition shape kind")));
  assert.ok(richerIssues.some((issue) => issue.message.includes("unknown motion trigger")));
  assert.ok(richerIssues.some((issue) => issue.message.includes("unknown motion effect")));
  assert.ok(richerIssues.some((issue) => issue.message.includes("unknown contrast mode")));
  assert.ok(richerIssues.some((issue) => issue.message.includes("contrast minRatio")));
  assert.ok(richerIssues.some((issue) => issue.message.includes("hex color")));
  assert.ok(richerIssues.some((issue) => issue.message.includes("composition layer id")));
  assert.ok(richerIssues.some((issue) => issue.message.includes("composition layer id must be unique")));
  assert.ok(richerIssues.some((issue) => issue.message.includes("composition shape id")));
  assert.ok(richerIssues.some((issue) => issue.message.includes("motion id")));
  assert.ok(richerIssues.some((issue) => issue.message.includes("durationMs")));
});
