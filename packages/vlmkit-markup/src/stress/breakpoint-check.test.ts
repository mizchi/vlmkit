import { test } from "node:test";
import assert from "node:assert/strict";
import {
  analyzeBoundary,
  deriveBreakpointIssues,
  extractRangeSyntaxBreakpoints,
  formatBreakpointCheckReport,
  type BreakpointCheckReport,
  type ElementStyleSample,
  type WidthSample,
} from "./breakpoint-check.ts";

function styles(overrides: Partial<ElementStyleSample> = {}): ElementStyleSample {
  return {
    selector: "#nav",
    hidden: false,
    display: "flex",
    position: "static",
    float: "none",
    flexDirection: "row",
    flexWrap: "nowrap",
    gridColumnCount: 0,
    order: "0",
    textAlign: "start",
    ...overrides,
  };
}

function width(w: number, elements: ElementStyleSample[], horizontalOverflow = 0): WidthSample {
  return { width: w, horizontalOverflow, elements };
}

test("a clean transition satisfies the boundary invariant", () => {
  // Below: column (mobile). At + above: row (desktop) — B belongs to the upper regime.
  const below = width(767, [styles({ flexDirection: "column" })]);
  const at = width(768, [styles({ flexDirection: "row" })]);
  const above = width(769, [styles({ flexDirection: "row" })]);
  const { spikes, gaps } = analyzeBoundary(below, at, above);
  assert.equal(spikes.length, 0);
  assert.equal(gaps.length, 0);
});

test("a property matching neither neighbor is a boundary spike", () => {
  // Both regimes' rules apply at exactly B, producing a third state.
  const below = width(767, [styles({ flexDirection: "column" })]);
  const at = width(768, [styles({ flexDirection: "column-reverse" })]);
  const above = width(769, [styles({ flexDirection: "row" })]);
  const { spikes } = analyzeBoundary(below, at, above);
  assert.equal(spikes.length, 1);
  assert.deepEqual(spikes[0], {
    selector: "#nav",
    property: "flexDirection",
    below: "column",
    at: "column-reverse",
    above: "row",
  });
});

test("grid track count is compared as a count, not a computed px string", () => {
  const below = width(1023, [styles({ display: "grid", gridColumnCount: 2 })]);
  const at = width(1024, [styles({ display: "grid", gridColumnCount: 1 })]);
  const above = width(1025, [styles({ display: "grid", gridColumnCount: 3 })]);
  const { spikes } = analyzeBoundary(below, at, above);
  assert.equal(spikes.length, 1);
  assert.equal(spikes[0]!.property, "gridColumnCount");
  assert.equal(spikes[0]!.at, "1");
});

test("an element hidden only at exactly B is a boundary gap", () => {
  const below = width(767, [styles()]);
  const at = width(768, [styles({ hidden: true })]);
  const above = width(769, [styles()]);
  const { gaps, spikes } = analyzeBoundary(below, at, above);
  assert.equal(gaps.length, 1);
  assert.equal(gaps[0]!.kind, "hidden-only-at");
  // Hidden elements' other properties are not compared.
  assert.equal(spikes.length, 0);
});

test("an element visible only at exactly B is a boundary gap", () => {
  const below = width(767, [styles({ hidden: true })]);
  const at = width(768, [styles()]);
  const above = width(769, [styles({ hidden: true })]);
  const { gaps } = analyzeBoundary(below, at, above);
  assert.equal(gaps.length, 1);
  assert.equal(gaps[0]!.kind, "visible-only-at");
});

test("elements missing from a neighbor sample are skipped, not crashed on", () => {
  const below = width(767, []);
  const at = width(768, [styles()]);
  const above = width(769, [styles()]);
  const { spikes, gaps } = analyzeBoundary(below, at, above);
  assert.equal(spikes.length, 0);
  assert.equal(gaps.length, 0);
});

test("deriveBreakpointIssues maps spikes/gaps to suspects and overflow to warn", () => {
  const issues = deriveBreakpointIssues([
    {
      value: 768,
      raw: ["(min-width: 768px)"],
      samples: [
        { width: 767, horizontalOverflow: 0 },
        { width: 768, horizontalOverflow: 24 },
        { width: 769, horizontalOverflow: 0 },
      ],
      spikes: [{ selector: "#nav", property: "flexDirection", below: "column", at: "column-reverse", above: "row" }],
      gaps: [{ selector: ".sidebar", kind: "hidden-only-at" }],
    },
  ]);
  assert.equal(issues.length, 3);
  const spike = issues.find((i) => i.kind === "boundary-spike")!;
  assert.equal(spike.severity, "suspect");
  assert.match(spike.message, /max-width: 767px vs min-width: 769px/);
  const gap = issues.find((i) => i.kind === "boundary-gap")!;
  assert.equal(gap.severity, "suspect");
  assert.match(gap.message, /disappears at exactly 768px/);
  const overflow = issues.find((i) => i.kind === "overflow-at-boundary")!;
  assert.equal(overflow.severity, "warn");
  assert.match(overflow.message, /24px at 768px/);
});

test("formatBreakpointCheckReport renders per-breakpoint verdicts", () => {
  const results = [
    {
      value: 768,
      raw: ["(min-width: 768px)"],
      samples: [
        { width: 767, horizontalOverflow: 0 },
        { width: 768, horizontalOverflow: 0 },
        { width: 769, horizontalOverflow: 0 },
      ],
      spikes: [],
      gaps: [],
    },
    {
      value: 1024,
      raw: ["(min-width: 1024px)"],
      samples: [
        { width: 1023, horizontalOverflow: 0 },
        { width: 1024, horizontalOverflow: 0 },
        { width: 1025, horizontalOverflow: 0 },
      ],
      spikes: [{ selector: "#nav", property: "display", below: "flex", at: "block", above: "grid" }],
      gaps: [],
    },
  ];
  const report: BreakpointCheckReport = {
    source: "fixture.html",
    breakpoints: results,
    checkedValues: [768, 1024],
    issues: deriveBreakpointIssues(results),
  };
  const text = formatBreakpointCheckReport(report);
  assert.match(text, /breakpoints checked: 768, 1024px/);
  assert.match(text, /768px: .*clean/);
  assert.match(text, /1024px: 1 spike\(s\), 0 gap\(s\)/);
  assert.match(text, /boundary-spike #nav/);
});

test("extractRangeSyntaxBreakpoints parses modern range media queries", () => {
  const css = `
    @media (width >= 768px) { a { color: red } }
    @media (width < 480px) { a { color: blue } }
    @media (48rem < width) { a { color: green } }
    @media (400px <= width <= 700px) { a { color: teal } }
  `;
  const found = extractRangeSyntaxBreakpoints(css);
  const values = found.map((b) => b.value);
  // width >= 768 → 768; width < 480 → 479; 48rem(768) < width → 769;
  // 400 <= width <= 700 → 400 and 700.
  assert.deepEqual(values, [400, 479, 700, 768, 769]);
  assert.match(found.find((b) => b.value === 768)!.raw, /width >= 768px/);
});

test("extractRangeSyntaxBreakpoints ignores non-width and legacy conditions", () => {
  const css = `
    @media (min-width: 768px) { a { color: red } }   /* legacy — extractBreakpoints' job */
    @media (height >= 500px) { a { color: blue } }
    @media print { a { color: black } }
  `;
  assert.deepEqual(extractRangeSyntaxBreakpoints(css), []);
});

test("formatBreakpointCheckReport says so when nothing was discovered", () => {
  const report: BreakpointCheckReport = { source: "x.html", breakpoints: [], checkedValues: [], issues: [] };
  const text = formatBreakpointCheckReport(report);
  assert.match(text, /none discovered/);
  assert.match(text, /--breakpoints/);
});
