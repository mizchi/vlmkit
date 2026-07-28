import { test } from "node:test";
import assert from "node:assert/strict";
import {
  analyzeScrollBehavior,
  type ScrollBehaviorInput,
  type StickyFixedSample,
  type SnapSample,
} from "./scroll-behavior.ts";

function sample(overrides: Partial<StickyFixedSample> = {}): StickyFixedSample {
  return {
    selector: "header.top",
    position: "sticky",
    stickyTopPx: 0,
    before: { x: 0, y: 100, width: 1280, height: 60 },
    after: { x: 0, y: 0, width: 1280, height: 60 },
    documentTop: 100,
    ...overrides,
  };
}

function input(overrides: Partial<ScrollBehaviorInput> = {}): ScrollBehaviorInput {
  return { source: "x.html", pageScrolled: 1000, stickyFixed: [], snaps: [], ...overrides };
}

test("a fixed element that holds its viewport bbox is clean", () => {
  const report = analyzeScrollBehavior(input({
    stickyFixed: [sample({ position: "fixed", before: { x: 1200, y: 640, width: 56, height: 56 }, after: { x: 1200, y: 640, width: 56, height: 56 } })],
  }));
  assert.deepEqual(report.issues, []);
});

test("a fixed element that moves with the page raises fixed-drifts", () => {
  const report = analyzeScrollBehavior(input({
    stickyFixed: [sample({ position: "fixed", before: { x: 1200, y: 640, width: 56, height: 56 }, after: { x: 1200, y: -360, width: 56, height: 56 } })],
  }));
  assert.equal(report.issues.length, 1);
  assert.equal(report.issues[0]!.kind, "fixed-drifts");
  assert.equal(report.issues[0]!.severity, "suspect");
  assert.match(report.issues[0]!.message, /transformed ancestor/);
});

test("an engaged sticky element holding its top offset is clean and counted", () => {
  const report = analyzeScrollBehavior(input({
    stickyFixed: [sample()], // documentTop 100, scrolled 1000 → engaged; after.y === top (0)
  }));
  assert.equal(report.engagedSticky, 1);
  assert.deepEqual(report.issues, []);
});

test("an engaged sticky element that scrolled away raises sticky-not-sticking", () => {
  const report = analyzeScrollBehavior(input({
    stickyFixed: [sample({ after: { x: 0, y: -900, width: 1280, height: 60 } })],
  }));
  assert.equal(report.issues.length, 1);
  assert.equal(report.issues[0]!.kind, "sticky-not-sticking");
  assert.match(report.issues[0]!.message, /parent/);
});

test("a sticky element the scroll never reached is inventory only", () => {
  const report = analyzeScrollBehavior(input({
    pageScrolled: 200,
    stickyFixed: [sample({ documentTop: 2400, after: { x: 0, y: 2200, width: 1280, height: 60 } })],
  }));
  assert.equal(report.engagedSticky, 0);
  assert.deepEqual(report.issues, []);
});

test("fixed checks are skipped when the page cannot scroll", () => {
  const report = analyzeScrollBehavior(input({
    pageScrolled: 0,
    stickyFixed: [sample({ position: "fixed", after: { x: 50, y: 50, width: 56, height: 56 } })],
  }));
  assert.deepEqual(report.issues, []);
});

function snap(overrides: Partial<SnapSample> = {}): SnapSample {
  return {
    selector: "div.carousel",
    axis: "x",
    strictness: "mandatory",
    settledOffset: 300,
    candidateOffsets: [0, 300, 600],
    childCount: 3,
    ...overrides,
  };
}

test("a mandatory snap container settled on a child edge is clean", () => {
  const report = analyzeScrollBehavior(input({ snaps: [snap()] }));
  assert.deepEqual(report.issues, []);
});

test("a mandatory snap container settled off every edge raises snap-not-snapping", () => {
  const report = analyzeScrollBehavior(input({ snaps: [snap({ settledOffset: 150 })] }));
  assert.equal(report.issues.length, 1);
  assert.equal(report.issues[0]!.kind, "snap-not-snapping");
  assert.equal(report.issues[0]!.severity, "warn");
});

test("a mandatory snap container with no snap-aligned children is flagged", () => {
  const report = analyzeScrollBehavior(input({
    snaps: [snap({ candidateOffsets: [], childCount: 0, settledOffset: 512 })],
  }));
  assert.equal(report.issues.length, 1);
  assert.equal(report.issues[0]!.kind, "snap-not-snapping");
  assert.match(report.issues[0]!.message, /NO child declares scroll-snap-align/);
});

test("proximity snap containers are never flagged", () => {
  const report = analyzeScrollBehavior(input({ snaps: [snap({ strictness: "proximity", settledOffset: 150 })] }));
  assert.deepEqual(report.issues, []);
});
