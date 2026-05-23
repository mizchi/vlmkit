import { describe, it } from "node:test";
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
