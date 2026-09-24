import { test } from "vitest";
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

test("names the shortfall when the measured cause explains only part of the overflow", () => {
  // Two rigid siblings in one row: probed individually, neutralizing either leaves the
  // other overflowing, so both measure 0 and no single element can be blamed. Reporting
  // only the named cause made a 77-of-439px answer read as the whole story, and v4's
  // repair agent had to work the remainder out from flex-shrink by hand.
  const report = analyzeScrollSamples(input({
    page: {
      viewportWidth: 375,
      viewportHeight: 720,
      scrollWidth: 814,
      scrollHeight: 900,
      overflowOffenders: [
        { selector: "#publish", right: 814, width: 130, relieves: 77 },
        { selector: ".card:nth-of-type(2)", right: 500, width: 220, relieves: 0 },
        { selector: ".card:nth-of-type(3)", right: 760, width: 220, relieves: 0 },
      ],
    },
  }));
  const issue = report.issues.find((i) => i.kind === "page-overflow-x");
  assert.ok(issue);
  assert.match(issue!.message, /#publish/);
  // 439 total minus the 77 the named cause relieves.
  assert.match(issue!.message, /leaves 362px, which no single element relieves/);
  assert.match(issue!.message, /2 other element\(s\) past the edge were probed individually/);
});

test("stays quiet about a shortfall when the named cause accounts for all of it", () => {
  const report = analyzeScrollSamples(input({
    page: {
      viewportWidth: 768,
      viewportHeight: 720,
      scrollWidth: 814,
      scrollHeight: 900,
      overflowOffenders: [{ selector: "#publish", right: 814, width: 130, relieves: 46 }],
    },
  }));
  const issue = report.issues.find((i) => i.kind === "page-overflow-x");
  assert.ok(issue);
  assert.doesNotMatch(issue!.message, /no single element relieves/);
});

test("does not sum overlapping relief into a claim larger than the overflow", () => {
  // Two independently positioned elements can each relieve the same overflow, so the
  // accounted figure is the best single fix, not the total.
  const report = analyzeScrollSamples(input({
    page: {
      viewportWidth: 375,
      viewportHeight: 720,
      scrollWidth: 475,
      scrollHeight: 900,
      overflowOffenders: [
        { selector: ".a", right: 475, width: 200, relieves: 100 },
        { selector: ".b", right: 470, width: 200, relieves: 100 },
      ],
    },
  }));
  const issue = report.issues.find((i) => i.kind === "page-overflow-x");
  assert.ok(issue);
  assert.doesNotMatch(issue!.message, /no single element relieves/);
});

/**
 * Five of six demo sites (2026-09-23) carried a false-positive note per screen-reader-only span:
 * `! clipped-content #meta-SB-103 > span:nth-of-type(5): … clips 173px of its content behind
 * overflow: hidden`, on the same elements `check integrity` exempted as the sr-only pattern. And
 * a checkout's plain <textarea> came back as a "dead scrollport" for the UA's own overflow: auto.
 */
test("the sr-only box is not cut-off content, and a textarea is not a declared scrollport", () => {
  const report = analyzeScrollSamples(input({
    elements: [
      el({ selector: "span.sr-only", overflowX: "hidden", overflowY: "hidden", overflowAmountX: 173, overflowAmountY: 18, clientWidth: 1, clientHeight: 1 }),
      el({ selector: "div.card", overflowX: "hidden", overflowY: "hidden", overflowAmountX: 0, overflowAmountY: 40, clientWidth: 300, clientHeight: 120 }),
      el({ selector: "textarea#notes", tagName: "TEXTAREA", overflowX: "auto", overflowY: "auto", overflowAmountX: 0, overflowAmountY: 0 }),
      el({ selector: "div.panel", overflowX: "visible", overflowY: "auto", overflowAmountX: 0, overflowAmountY: 0 }),
    ],
  }));
  assert.deepEqual(report.clipped.map((c) => c.selector), ["div.card"], "a real clip still reports");
  assert.equal(report.visuallyHidden, 1);
  assert.deepEqual(report.deadScrollports.map((d) => d.selector), ["div.panel"], "an authored dead scrollport still reports");
  assert.match(formatScrollScanReport(report), /1 visually-hidden \(sr-only\) box\(es\) not reported as clipped/);
});
