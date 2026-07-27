import { test } from "node:test";
import assert from "node:assert/strict";
import {
  mediaQueryForViewport,
  scaffoldUiContract,
  scaffoldUiContractScreen,
} from "./scaffold-contract.ts";
import type { UiContract, UiContractScreen } from "./ui-contract.ts";

const VIEWPORTS = [
  { label: "desktop", width: 1280, height: 800 },
  { label: "mobile", width: 375, height: 720 },
];

function landingScreen(): UiContractScreen {
  return {
    id: "landing-home",
    pattern: "landing",
    viewports: VIEWPORTS,
    landmarks: [
      {
        id: "hero",
        role: "banner",
        name: "Hero",
        markers: [
          { kind: "hero-title", name: "Big headline" },
          { kind: "primary-cta", name: "Get started" },
        ],
        layout: {
          width: { kind: "fluid" },
          height: { kind: "content", min: 320 },
          display: { kind: "flex", direction: "column", gap: 16 },
          scroll: { x: false, y: false },
        },
      },
      {
        id: "features",
        role: "main",
        name: "Features",
        repeat: { kind: "grid", itemName: "feature", minItems: 3 },
        layout: {
          width: { kind: "fluid", max: 1120 },
          height: { kind: "content" },
          display: { kind: "grid", columns: ["1fr", "1fr", "1fr"], rows: [], gap: { row: 24, column: 24 } },
          scroll: { x: false, y: false },
        },
        responsive: [
          {
            viewport: "mobile",
            display: { kind: "flex", direction: "column", gap: 16 },
          },
        ],
      },
      {
        id: "footer",
        role: "contentinfo",
        name: "Footer",
        layout: {
          width: { kind: "fluid" },
          height: { kind: "content" },
          display: { kind: "block" },
          scroll: { x: false, y: false },
        },
      },
    ],
  };
}

test("scaffold emits semantic tags per landmark role", () => {
  const { html, landmarkIds } = scaffoldUiContractScreen(landingScreen());
  assert.deepEqual(landmarkIds, ["hero", "features", "footer"]);
  assert.match(html, /<header id="hero" aria-label="Hero">/);
  assert.match(html, /<main id="features">/);
  assert.match(html, /<footer id="footer" aria-label="Footer">/);
});

test("scaffold compiles layout policies into CSS", () => {
  const { html } = scaffoldUiContractScreen(landingScreen());
  assert.match(html, /#features \{[^}]*max-width: 1120px/s);
  assert.match(html, /#features \{[^}]*grid-template-columns: 1fr 1fr 1fr/s);
  assert.match(html, /#features \{[^}]*gap: 24px 24px/s);
  assert.match(html, /#hero \{[^}]*flex-direction: column/s);
  assert.match(html, /#hero \{[^}]*min-height: 320px/s);
});

test("responsive rules compile into max-width media queries against the narrower viewport", () => {
  const { html } = scaffoldUiContractScreen(landingScreen());
  assert.match(html, /@media \(max-width: 375px\) \{\s*#features \{[^}]*flex-direction: column/s);
});

test("mediaQueryForViewport picks min-width for the widest viewport", () => {
  assert.equal(mediaQueryForViewport(VIEWPORTS[1], VIEWPORTS), "@media (max-width: 375px)");
  assert.equal(mediaQueryForViewport(VIEWPORTS[0], VIEWPORTS), "@media (min-width: 1280px)");
});

test("markers render dedicated elements", () => {
  const { html } = scaffoldUiContractScreen(landingScreen());
  assert.match(html, /<h1 data-marker="hero-title">Big headline<\/h1>/);
  assert.match(html, /<a class="button" data-marker="primary-cta" href="#">Get started<\/a>/);
});

test("repeat contracts materialize min items", () => {
  const { html } = scaffoldUiContractScreen(landingScreen());
  const matches = html.match(/data-repeat-item="feature"/g) ?? [];
  assert.equal(matches.length, 3);
});

test("nested landmarks render inside their parent", () => {
  const screen = landingScreen();
  screen.landmarks.push({
    id: "hero-search",
    role: "search",
    name: "Site search",
    parentId: "hero",
    layout: {
      width: { kind: "intrinsic" },
      height: { kind: "content" },
      display: { kind: "block" },
      scroll: { x: false, y: false },
    },
  });
  const { html } = scaffoldUiContractScreen(screen);
  const heroOpen = html.indexOf('<header id="hero"');
  const heroClose = html.indexOf("</header>");
  const search = html.indexOf('<form id="hero-search" role="search"');
  assert.ok(search > heroOpen && search < heroClose, "search form nests inside hero");
});

test("scrollport height policy emits max-height + overflow and filler for expected scrollports", () => {
  const screen = landingScreen();
  screen.expectedScrollports = [{ id: "feed-scroll", landmarkId: "features", axis: "y", required: true }];
  screen.landmarks[1].layout.height = { kind: "scrollport", max: 480 };
  const { html } = scaffoldUiContractScreen(screen);
  assert.match(html, /#features \{[^}]*max-height: 480px/s);
  assert.match(html, /#features \{[^}]*overflow-y: auto/s);
  assert.match(html, /data-scrollport="feed-scroll"/);
  assert.match(html, /scroll-filler-y/);
});

test("state contracts emit hover / focus-visible stub rules", () => {
  const screen = landingScreen();
  screen.landmarks[0].states = [
    { id: "cta-hover", kind: "hover", selector: ".button" },
    { id: "cta-focus", kind: "focus-visible", selector: ".button" },
  ];
  const { html } = scaffoldUiContractScreen(screen);
  assert.match(html, /\.button:hover \{ filter: brightness\(0\.94\); \}/);
  assert.match(html, /\.button:focus-visible \{ outline: 2px solid/);
});

test("decoration palette becomes :root custom properties", () => {
  const screen = landingScreen();
  screen.decoration = {
    palette: [
      { role: "background", value: "#f6f7fb" },
      { role: "accent", value: "#2563eb" },
    ],
    typography: [{ role: "heading", size: 32, weight: 700 }],
  };
  const { html } = scaffoldUiContractScreen(screen);
  assert.match(html, /--color-background: #f6f7fb;/);
  assert.match(html, /--color-accent: #2563eb;/);
  assert.match(html, /\.type-heading \{[^}]*font-size: 32px/s);
});

test("scaffoldUiContract filters by screen id and surfaces validation issues", () => {
  const contract: UiContract = { version: 1, screens: [landingScreen()] };
  const all = scaffoldUiContract(contract);
  assert.equal(all.screens.length, 1);
  const none = scaffoldUiContract(contract, { screenId: "nope" });
  assert.equal(none.screens.length, 0);
});

test("grid areas on root landmarks produce a screen-level grid", () => {
  const screen = landingScreen();
  screen.landmarks[0].gridArea = "top";
  screen.landmarks[1].gridArea = "content";
  screen.landmarks[2].gridArea = "bottom";
  const { html } = scaffoldUiContractScreen(screen);
  assert.match(html, /\.screen \{\s*display: grid/);
  assert.match(html, /grid-template-areas: "top" "content" "bottom"/);
  assert.match(html, /style="grid-area: content"/);
});
