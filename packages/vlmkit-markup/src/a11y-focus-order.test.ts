import { describe, it } from "vitest";
import assert from "node:assert/strict";
import { analyzeFocusOrderSteps, type FocusStep } from "./a11y-focus-order.ts";
import { classifyFocusOrderStep } from "./markup-core-a11y-focus-order.ts";

function step(overrides: Partial<FocusStep> & { x: number; y: number; path?: string }): FocusStep {
  return {
    tabIndex: overrides.tabIndex ?? 0,
    path: overrides.path ?? "button",
    tag: overrides.tag ?? "button",
    text: overrides.text ?? "btn",
    bbox: {
      x: overrides.x,
      y: overrides.y,
      width: overrides.bbox?.width ?? 80,
      height: overrides.bbox?.height ?? 24,
    },
    tabindexAttr: overrides.tabindexAttr ?? null,
  };
}

describe("classifyFocusOrderStep (MoonBit policy)", () => {
  it("ok: forward right within the same row", () => {
    const t = classifyFocusOrderStep({
      samePath: false,
      prev: { x: 0, y: 100 },
      cur: { x: 100, y: 100 },
    });
    assert.equal(t, "ok");
  });

  it("ok: forward down across rows", () => {
    const t = classifyFocusOrderStep({
      samePath: false,
      prev: { x: 0, y: 100 },
      cur: { x: 0, y: 150 },
    });
    assert.equal(t, "ok");
  });

  it("trap: same path AND bbox barely moves", () => {
    const t = classifyFocusOrderStep({
      samePath: true,
      prev: { x: 100, y: 100 },
      cur: { x: 102, y: 101 },
    });
    assert.equal(t, "trap");
  });

  it("same path but bbox shifted: not a trap (path-generator ambiguity)", () => {
    const t = classifyFocusOrderStep({
      samePath: true,
      prev: { x: 100, y: 100 },
      cur: { x: 200, y: 100 },
    });
    assert.equal(t, "ok");
  });

  it("reverse-left: same row, dx < -40", () => {
    const t = classifyFocusOrderStep({
      samePath: false,
      prev: { x: 200, y: 100 },
      cur: { x: 100, y: 100 },
    });
    assert.equal(t, "reverse-left");
  });

  it("reverse-left threshold boundary: dx = -41 triggers, dx = -39 does not", () => {
    const trigger = classifyFocusOrderStep({
      samePath: false,
      prev: { x: 100, y: 100 },
      cur: { x: 59, y: 100 },
    });
    assert.equal(trigger, "reverse-left");

    const noTrigger = classifyFocusOrderStep({
      samePath: false,
      prev: { x: 100, y: 100 },
      cur: { x: 61, y: 100 },
    });
    assert.equal(noTrigger, "ok");
  });

  it("reverse-up: dy < -24", () => {
    const t = classifyFocusOrderStep({
      samePath: false,
      prev: { x: 0, y: 100 },
      cur: { x: 0, y: 50 },
    });
    assert.equal(t, "reverse-up");
  });

  it("skip-row: dy > 200", () => {
    const t = classifyFocusOrderStep({
      samePath: false,
      prev: { x: 0, y: 100 },
      cur: { x: 0, y: 350 },
    });
    assert.equal(t, "skip-row");
  });

  it("trap takes precedence over reverse-up when same path", () => {
    // Realistic scenario: path generator collapses two siblings into the
    // same selector, but they live in different bboxes. With samePath but
    // a meaningful displacement, the classifier should NOT call it a
    // trap.
    const t = classifyFocusOrderStep({
      samePath: true,
      prev: { x: 0, y: 100 },
      cur: { x: 0, y: 60 }, // dy = -40 → would be reverse-up if path differed
    });
    assert.equal(t, "reverse-up");
  });
});

describe("analyzeFocusOrderSteps", () => {
  it("returns no findings for clean L→R T→B traversal", () => {
    const steps = [
      step({ tabIndex: 0, path: "a", x: 0, y: 0 }),
      step({ tabIndex: 1, path: "b", x: 100, y: 0 }),
      step({ tabIndex: 2, path: "c", x: 0, y: 40 }),
      step({ tabIndex: 3, path: "d", x: 100, y: 40 }),
    ];
    assert.equal(analyzeFocusOrderSteps(steps).length, 0);
  });

  it("flags a trap with the correct from/to indices and message", () => {
    const steps = [
      step({ tabIndex: 0, path: "a", x: 0, y: 0 }),
      step({ tabIndex: 1, path: "trap", x: 100, y: 0 }),
      step({ tabIndex: 2, path: "trap", x: 102, y: 1 }),
    ];
    const findings = analyzeFocusOrderSteps(steps);
    assert.equal(findings.length, 1);
    assert.equal(findings[0]!.kind, "trap");
    assert.equal(findings[0]!.fromIndex, 1);
    assert.equal(findings[0]!.toIndex, 2);
    assert.match(findings[0]!.message, /Focus stayed on the same element/);
  });

  it("flags reverse-left and reverse-up as separate findings", () => {
    const steps = [
      step({ tabIndex: 0, path: "a", x: 0, y: 100 }),
      step({ tabIndex: 1, path: "b", x: 200, y: 100 }),
      step({ tabIndex: 2, path: "c", x: 100, y: 100 }), // reverse-left
      step({ tabIndex: 3, path: "d", x: 100, y: 40 }),  // reverse-up
    ];
    const findings = analyzeFocusOrderSteps(steps);
    assert.equal(findings.length, 2);
    assert.equal(findings[0]!.kind, "reverse");
    assert.match(findings[0]!.message, /moved left within the same row/);
    assert.equal(findings[1]!.kind, "reverse");
    assert.match(findings[1]!.message, /Focus moved up by/);
  });

  it("flags skip-row with the y delta in the message", () => {
    const steps = [
      step({ tabIndex: 0, path: "a", x: 0, y: 0 }),
      step({ tabIndex: 1, path: "b", x: 0, y: 250 }),
    ];
    const findings = analyzeFocusOrderSteps(steps);
    assert.equal(findings.length, 1);
    assert.equal(findings[0]!.kind, "skip-row");
    assert.match(findings[0]!.message, /Focus jumped down by 250px/);
  });
});

/**
 * Multi-column tab order, found by dogfooding vite.dev (2026-08-16).
 *
 * Its footer has three link columns at x=113 / 245 / 391, each running y=616 → 696. Tab order
 * goes down column one and on to the top of column two, which by `dy` alone is `reverse-up` at
 * suspect severity: four findings and exit 1 on an idiomatic layout. Reading order says a jump
 * into a column to the RIGHT is forward, and the previous element's width is what makes that
 * decidable — so the classifier takes it, and the caller drops the step.
 *
 * The geometry in these cases is the measured geometry from that page.
 */
describe("multi-column tab order", () => {
  it("a jump to the top of the next column is not a reverse", () => {
    const t = classifyFocusOrderStep({
      samePath: false,
      prev: { x: 113, y: 696, width: 52 },   // last link of column one
      cur: { x: 245, y: 616 },               // first link of column two
    });
    assert.equal(t, "column-advance");
  });

  it("a jump back up in the SAME column is still a reverse", () => {
    // Also from that page: two stacked lists at x=391, tabbed lower-first. This is the finding
    // the fix had to keep, and the reason the rule is "strictly right of" rather than "moved
    // right at all".
    const t = classifyFocusOrderStep({
      samePath: true,
      prev: { x: 391, y: 696, width: 85 },
      cur: { x: 391, y: 355 },
    });
    assert.equal(t, "reverse-up");
  });

  it("overlapping columns are not columns", () => {
    // 40px to the right while still overlapping horizontally is not a column boundary; a real
        // tabindex mistake inside one column can move slightly right, and must survive.
    const t = classifyFocusOrderStep({
      samePath: false,
      prev: { x: 100, y: 700, width: 200 },
      cur: { x: 140, y: 600 },
    });
    assert.equal(t, "reverse-up");
  });

  it("without a measured width the pre-column verdict stands", () => {
    // The legacy positional path sends no width. Absent must mean "cannot conclude", never
    // "assume columns" — an accessibility gate that silently stops reporting is worse than one
    // that over-reports.
    const t = classifyFocusOrderStep({
      samePath: false,
      prev: { x: 113, y: 696 },
      cur: { x: 245, y: 616 },
    });
    assert.equal(t, "reverse-up");
  });

  it("the analyzer drops column advances and keeps the rest", () => {
    const steps = [
      step({ x: 113, y: 616, bbox: { width: 42, height: 20 } as never }),
      step({ x: 113, y: 656, bbox: { width: 48, height: 20 } as never }),
      step({ x: 113, y: 696, bbox: { width: 52, height: 20 } as never }),
      step({ x: 245, y: 616, bbox: { width: 41, height: 20 } as never }),   // column advance
      step({ x: 245, y: 656, bbox: { width: 33, height: 20 } as never }),
      step({ x: 245, y: 696, bbox: { width: 66, height: 20 } as never }),
      step({ x: 391, y: 616, bbox: { width: 125, height: 20 } as never }),  // column advance
      step({ x: 391, y: 355, bbox: { width: 84, height: 20 } as never }),   // real reverse
    ];
    const findings = analyzeFocusOrderSteps(steps);
    assert.deepEqual(findings.map((f) => `${f.kind} ${f.fromIndex}->${f.toIndex}`), ["reverse 6->7"]);
  });
});

/**
 * Viewport-pinned elements, found by dogfooding Bootstrap's dashboard example (2026-08-16).
 *
 * Its theme switcher is `position: fixed bottom-0 end-0` and sits eleventh in `<body>`, so Tab
 * reaches it FIRST and the next step goes to the navbar at y=0: `[reverse] Focus moved up by
 * 662px`, exit 1, on the idiom skip links are built from. One of those two `y` values is a screen
 * position and the other a document position, and comparing them says nothing about reading order.
 */
describe("viewport-pinned focus steps", () => {
  const pinned = (over: Partial<FocusStep> & { x: number; y: number }): FocusStep =>
    ({ ...step(over), pinned: true });

  it("a reverse into or out of a pinned element is not a finding", () => {
    // Both directions: a fixed control tabbed first (Bootstrap's case) and one tabbed last.
    assert.deepEqual(analyzeFocusOrderSteps([
      pinned({ x: 1200, y: 662, path: "button#bd-theme" }),
      step({ x: 0, y: 0, path: "a.navbar-brand" }),
    ]), []);
    assert.deepEqual(analyzeFocusOrderSteps([
      step({ x: 0, y: 600, path: "a.footer-link" }),
      pinned({ x: 1200, y: 20, path: "button#to-top" }),
    ]), []);
  });

  it("a trap on a pinned element is still a finding", () => {
    // Identity, not geometry: focus stuck on one element is a trap wherever that element is
    // painted, and a pinned dialog is a common place to get stuck.
    const findings = analyzeFocusOrderSteps([
      pinned({ x: 1200, y: 662, path: "button#bd-theme" }),
      pinned({ x: 1200, y: 662, path: "button#bd-theme" }),
    ]);
    assert.deepEqual(findings.map((f) => f.kind), ["trap"]);
  });

  it("in-flow reverses are untouched by the pinned rule", () => {
    // The regression guard: this is the finding the gate exists for, and it must not be swept up.
    const findings = analyzeFocusOrderSteps([
      step({ x: 100, y: 600, path: "a.one" }),
      step({ x: 100, y: 200, path: "a.two" }),
    ]);
    assert.deepEqual(findings.map((f) => f.kind), ["reverse"]);
  });

  it("steps with no `pinned` field analyse exactly as before", () => {
    // Optional on purpose: a caller that built steps by hand, or a recorded run from before the
    // field existed, must not silently lose every reverse finding.
    const findings = analyzeFocusOrderSteps([
      { ...step({ x: 100, y: 600, path: "a.one" }), pinned: undefined },
      { ...step({ x: 100, y: 200, path: "a.two" }), pinned: undefined },
    ]);
    assert.deepEqual(findings.map((f) => f.kind), ["reverse"]);
  });
});
