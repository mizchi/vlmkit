import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { analyzeA11yTouchSamples, type A11yTouchRawSample } from "./a11y-touch.ts";
import {
  requiredTouchSide,
  touchTargetBelowRequired,
  touchTargetInCluster,
} from "./markup-core-a11y-touch.ts";

function sample(overrides: Partial<A11yTouchRawSample> & { width: number; height: number; x?: number; y?: number; path?: string }): A11yTouchRawSample {
  return {
    path: overrides.path ?? "button[0]",
    tag: overrides.tag ?? "button",
    text: overrides.text ?? "btn",
    bbox: {
      x: overrides.x ?? 0,
      y: overrides.y ?? 0,
      width: overrides.width,
      height: overrides.height,
    },
  };
}

describe("requiredTouchSide", () => {
  it("AAA → 44", () => assert.equal(requiredTouchSide("AAA"), 44));
  it("AA → 24", () => assert.equal(requiredTouchSide("AA"), 24));
});

describe("touchTargetBelowRequired", () => {
  it("AAA: 32 px is below required", () => {
    assert.equal(touchTargetBelowRequired(32, "AAA"), true);
  });
  it("AAA: 44 px is at the boundary (NOT below)", () => {
    assert.equal(touchTargetBelowRequired(44, "AAA"), false);
  });
  it("AA: 24 px is at the boundary (NOT below)", () => {
    assert.equal(touchTargetBelowRequired(24, "AA"), false);
  });
  it("AA: 12 px is below", () => {
    assert.equal(touchTargetBelowRequired(12, "AA"), true);
  });
});

describe("touchTargetInCluster", () => {
  it("centers within 24 px → cluster", () => {
    assert.equal(touchTargetInCluster({ x: 100, y: 100 }, { x: 110, y: 110 }), true);
  });
  it("centers exactly 24 px apart → NOT cluster (strict less-than)", () => {
    assert.equal(touchTargetInCluster({ x: 100, y: 100 }, { x: 100, y: 124 }), false);
  });
  it("centers 30 px apart → not cluster", () => {
    assert.equal(touchTargetInCluster({ x: 100, y: 100 }, { x: 130, y: 100 }), false);
  });
});

describe("analyzeA11yTouchSamples", () => {
  it("flags small targets but not full-size ones", () => {
    const findings = analyzeA11yTouchSamples([
      sample({ path: ".small", width: 32, height: 32 }),
      sample({ path: ".ok", width: 48, height: 48 }),
    ]);
    assert.equal(findings.length, 1);
    assert.equal(findings[0]!.path, ".small");
    assert.equal(findings[0]!.minSide, 32);
    assert.equal(findings[0]!.required, 44);
  });

  it("respects the WCAG AA level (24 px threshold)", () => {
    const findings = analyzeA11yTouchSamples(
      [sample({ path: ".aa-ok", width: 32, height: 32 })],
      "AA",
    );
    assert.equal(findings.length, 0);
  });

  it("keeps identical siblings separate, so a plain toolbar measures like a classed one", () => {
    // v7. Dedupe keyed on the generated CSS path, which three `<button>`s in one
    // `<div class="z">` share, so a whole toolbar collapsed to one element — and
    // cluster detection, which compares each target against the OTHERS, had
    // nothing left to compare against. Same pixels, and the verdict moved with
    // the markup:
    //   distinct classes -> inspected 3 | failures 3 | clustered 3
    //   identical markup -> inspected 1 | failures 1 | clustered 0
    const row = (path: string) => [
      sample({ path, x: 0, y: 0, width: 20, height: 20 }),
      sample({ path, x: 22, y: 0, width: 20, height: 20 }),
      sample({ path, x: 44, y: 0, width: 20, height: 20 }),
    ];
    const shared = analyzeA11yTouchSamples(row("main>div.z>button"), "AA");
    assert.equal(shared.length, 3, "three rendered buttons are three targets");
    assert.equal(shared.filter((f) => f.cluster).length, 3, "and they are adjacent");

    const classed = analyzeA11yTouchSamples([
      sample({ path: ".a", x: 0, y: 0, width: 20, height: 20 }),
      sample({ path: ".b", x: 22, y: 0, width: 20, height: 20 }),
      sample({ path: ".c", x: 44, y: 0, width: 20, height: 20 }),
    ], "AA");
    assert.equal(classed.length, shared.length, "class names must not change the measurement");
  });

  it("still collapses one element sampled twice, which is what the dedupe was for", () => {
    const findings = analyzeA11yTouchSamples([
      sample({ path: "main>button", x: 8, y: 8, width: 20, height: 20 }),
      sample({ path: "main>button", x: 8, y: 8, width: 20, height: 20 }),
    ], "AA");
    assert.equal(findings.length, 1);
  });

  it("does not report a target at the floor, whatever its spacing", () => {
    // WCAG 2.5.8 sizes targets; it does not condemn a compliant one for being
    // adjacent. The old help said "clustered targets are flagged", which read as
    // the opposite and is what sent v7's agent-m looking for a bug here.
    const findings = analyzeA11yTouchSamples([
      sample({ path: ".a", x: 0, y: 0, width: 24, height: 24 }),
      sample({ path: ".b", x: 28, y: 0, width: 24, height: 24 }),
    ], "AA");
    assert.deepEqual(findings, []);
  });

  it("marks a target as `cluster: true` when another center is within 24 px", () => {
    const findings = analyzeA11yTouchSamples([
      sample({ path: ".a", x: 0, y: 0, width: 32, height: 32 }),
      sample({ path: ".b", x: 5, y: 5, width: 32, height: 32 }),
    ]);
    // Both are small; both should mark cluster.
    assert.equal(findings.length, 2);
    assert.equal(findings[0]!.cluster, true);
    assert.equal(findings[1]!.cluster, true);
  });

  it("marks `cluster: false` when targets are well-spaced", () => {
    const findings = analyzeA11yTouchSamples([
      sample({ path: ".a", x: 0, y: 0, width: 32, height: 32 }),
      sample({ path: ".b", x: 200, y: 0, width: 32, height: 32 }),
    ]);
    assert.equal(findings.length, 2);
    assert.equal(findings[0]!.cluster, false);
    assert.equal(findings[1]!.cluster, false);
  });

  it("dedupes by path — first sample wins", () => {
    const findings = analyzeA11yTouchSamples([
      sample({ path: ".dup", width: 30, height: 30, text: "first" }),
      sample({ path: ".dup", width: 40, height: 40, text: "second" }),
    ]);
    assert.equal(findings.length, 1);
    assert.equal(findings[0]!.text, "first");
    assert.equal(findings[0]!.minSide, 30);
  });

  it("sorts findings by minSide ascending (worst first)", () => {
    const findings = analyzeA11yTouchSamples([
      sample({ path: ".medium", width: 40, height: 40 }),
      sample({ path: ".tiny", width: 16, height: 16 }),
      sample({ path: ".small", width: 28, height: 28 }),
    ]);
    assert.equal(findings.length, 3);
    assert.equal(findings[0]!.minSide, 16);
    assert.equal(findings[1]!.minSide, 28);
    assert.equal(findings[2]!.minSide, 40);
  });
});
