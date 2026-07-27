import { test } from "node:test";
import assert from "node:assert/strict";
import {
  analyzeScrollSamples,
  formatScrollScanReport,
  type ScrollElementSample,
  type ScrollScanInput,
} from "./scroll-scan.ts";

function el(overrides: Partial<ScrollElementSample> = {}): ScrollElementSample {
  return {
    selector: ".feed",
    tagName: "DIV",
    overflowX: "visible",
    overflowY: "auto",
    overflowAmountX: 0,
    overflowAmountY: 240,
    clientWidth: 320,
    clientHeight: 400,
    bbox: { x: 20, y: 80, width: 320, height: 400 },
    ...overrides,
  };
}

function input(overrides: Partial<ScrollScanInput> = {}): ScrollScanInput {
  return {
    source: "fixture.html",
    page: {
      viewportWidth: 1280,
      viewportHeight: 720,
      scrollWidth: 1280,
      scrollHeight: 2000,
      overflowOffenders: [],
    },
    elements: [],
    ...overrides,
  };
}

test("a real y-scroller is inventoried with axis and overflow amount", () => {
  const report = analyzeScrollSamples(input({ elements: [el()] }));
  assert.equal(report.containers.length, 1);
  const c = report.containers[0]!;
  assert.equal(c.axis, "y");
  assert.equal(c.overflowAmountY, 240);
  assert.equal(report.issues.length, 0);
  assert.equal(report.page.verticalScroll, 1280);
});

test("containers emit ready-to-paste expectedScrollports entries", () => {
  const report = analyzeScrollSamples(input({
    elements: [
      el({ selector: "#feed", scrollportAttr: "activity-feed" }),
      el({ selector: ".carousel", overflowX: "auto", overflowY: "visible", overflowAmountX: 900, overflowAmountY: 0 }),
    ],
  }));
  assert.equal(report.expectedScrollports.length, 2);
  assert.deepEqual(report.expectedScrollports[0], {
    id: "activity-feed",
    selector: "#feed",
    axis: "y",
    required: true,
    minOverflow: 240,
  });
  assert.equal(report.expectedScrollports[1]!.axis, "x");
  assert.equal(report.expectedScrollports[1]!.minOverflow, 900);
});

test("declared scrollable with fitting content is a dead scrollport, not a container", () => {
  const report = analyzeScrollSamples(input({
    elements: [el({ overflowAmountY: 0 })],
  }));
  assert.equal(report.containers.length, 0);
  assert.equal(report.deadScrollports.length, 1);
  assert.equal(report.deadScrollports[0]!.selector, ".feed");
  assert.equal(report.issues.length, 0);
});

test("page-level horizontal overflow raises a suspect naming the offenders", () => {
  const report = analyzeScrollSamples(input({
    page: {
      viewportWidth: 375,
      viewportHeight: 720,
      scrollWidth: 480,
      scrollHeight: 900,
      overflowOffenders: [{ selector: ".hero-image", right: 480, width: 460 }],
    },
  }));
  assert.equal(report.page.horizontalOverflow, 105);
  const issue = report.issues.find((i) => i.kind === "page-overflow-x");
  assert.ok(issue);
  assert.equal(issue!.severity, "suspect");
  assert.match(issue!.message, /105px/);
  assert.match(issue!.message, /\.hero-image/);
});

test("overflow:hidden clipping past the threshold raises clipped-content", () => {
  const report = analyzeScrollSamples(input({
    elements: [
      el({ selector: ".teaser", overflowY: "hidden", overflowAmountY: 120 }),
      el({ selector: ".rounded", overflowY: "hidden", overflowAmountY: 4 }), // below threshold
    ],
  }));
  assert.equal(report.clipped.length, 1);
  assert.equal(report.clipped[0]!.selector, ".teaser");
  const issue = report.issues.find((i) => i.kind === "clipped-content");
  assert.ok(issue);
  assert.equal(issue!.severity, "warn");
  assert.match(issue!.message, /120px/);
});

test("nested same-page scrollers raise nested-scroll", () => {
  const report = analyzeScrollSamples(input({
    elements: [
      el({ selector: ".outer" }),
      el({ selector: ".inner", ancestorScroller: ".outer" }),
    ],
  }));
  const issue = report.issues.find((i) => i.kind === "nested-scroll");
  assert.ok(issue);
  assert.equal(issue!.selector, ".inner");
  assert.match(issue!.message, /\.outer/);
});

test("formatScrollScanReport renders inventory and issues", () => {
  const report = analyzeScrollSamples(input({
    elements: [el({ scrollportAttr: "feed" })],
    page: {
      viewportWidth: 375,
      viewportHeight: 720,
      scrollWidth: 480,
      scrollHeight: 900,
      overflowOffenders: [{ selector: ".wide", right: 480, width: 400 }],
    },
  }));
  const text = formatScrollScanReport(report);
  assert.match(text, /scroll containers: 1/);
  assert.match(text, /\.feed: axis=y overflow=240px/);
  assert.match(text, /\[data-scrollport="feed"\]/);
  assert.match(text, /page-overflow-x/);
  assert.match(text, /expectedScrollports/);
});
