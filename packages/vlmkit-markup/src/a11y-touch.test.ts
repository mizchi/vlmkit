import { describe, it } from "vitest";
import assert from "node:assert/strict";
import { analyzeA11yTouch, analyzeA11yTouchSamples, type A11yTouchRawSample } from "./a11y-touch.ts";
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
    ...(overrides.display !== undefined ? { display: overrides.display } : {}),
    ...(overrides.inSentence !== undefined ? { inSentence: overrides.inSentence } : {}),
  };
}

/** A link in running text — the Inline exception's case. */
function inProse(overrides: Parameters<typeof sample>[0]): A11yTouchRawSample {
  return sample({ tag: "a", display: "inline", inSentence: true, ...overrides });
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
    ], "AAA");
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
    // At AAA on purpose. The same case at AA is now spacing-exempt — one isolated 20x20
    // button clears every neighbour because it has none — and a test about the dedupe
    // must not be able to pass or fail on the exception logic.
    const findings = analyzeA11yTouchSamples([
      sample({ path: "main>button", x: 8, y: 8, width: 20, height: 20 }),
      sample({ path: "main>button", x: 8, y: 8, width: 20, height: 20 }),
    ], "AAA");
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
    ], "AAA");
    // Both are small; both should mark cluster.
    assert.equal(findings.length, 2);
    assert.equal(findings[0]!.cluster, true);
    assert.equal(findings[1]!.cluster, true);
  });

  it("marks `cluster: false` when targets are well-spaced", () => {
    const findings = analyzeA11yTouchSamples([
      sample({ path: ".a", x: 0, y: 0, width: 32, height: 32 }),
      sample({ path: ".b", x: 200, y: 0, width: 32, height: 32 }),
    ], "AAA");
    assert.equal(findings.length, 2);
    assert.equal(findings[0]!.cluster, false);
    assert.equal(findings[1]!.cluster, false);
  });

  it("dedupes by path AND position — one element sampled twice is one target", () => {
    // Renamed from "dedupes by path — first sample wins", which named the defect
    // `targetKey` was written to fix rather than the behaviour: the key is the path plus
    // the rounded position, so identical siblings stay separate. Both samples here are at
    // the same position, which only one element can be, so collapsing them is right.
    const findings = analyzeA11yTouchSamples([
      sample({ path: ".dup", width: 30, height: 30, text: "first" }),
      sample({ path: ".dup", width: 40, height: 40, text: "second" }),
    ], "AAA");
    assert.equal(findings.length, 1);
    assert.equal(findings[0]!.text, "first");
    assert.equal(findings[0]!.minSide, 30);
  });

  it("does not apply the Inline exception to samples that never measured display", () => {
    // The compatibility direction. A caller that built samples by hand, or a run recorded
    // before `display` existed, must keep its findings rather than gain an exemption from
    // a field that was never measured — same policy as `FocusStep.pinned`.
    const findings = analyzeA11yTouchSamples([
      sample({ path: "p>a", width: 40, height: 18 }),
    ], "AAA");
    assert.equal(findings.length, 1);
    assert.equal(findings[0]!.exception, undefined);
  });

  it("sorts findings by minSide ascending (worst first)", () => {
    const findings = analyzeA11yTouchSamples([
      sample({ path: ".medium", width: 40, height: 40 }),
      sample({ path: ".tiny", width: 16, height: 16 }),
      sample({ path: ".small", width: 28, height: 28 }),
    ], "AAA");
    assert.equal(findings.length, 3);
    assert.equal(findings[0]!.minSide, 16);
    assert.equal(findings[1]!.minSide, 28);
    assert.equal(findings[2]!.minSide, 40);
  });
});

/**
 * The WCAG exceptions, which are the reason this gate is usable on a real page.
 *
 * Before them the AAA default failed 17 of 18 targets on Bootstrap's dashboard example
 * and 37 of 38 on vite.dev — both unmodified vendor defaults, so no project adopting
 * either framework could pass, and a gate nobody can pass gets turned off whole. Every
 * case below is a criterion clause, not a tuning knob.
 */
describe("analyzeA11yTouch — the criteria's own exceptions", () => {
  it("excuses an isolated undersized target at AA, and reports it at AAA", () => {
    // WCAG 2.5.8's Spacing exception: a 24px circle on a lone 20x20 button intersects
    // nothing, so the effective tap area is the empty space around it. 2.5.5 has no
    // spacing exception, so AAA still wants the box grown.
    const lone = [sample({ path: ".lone", width: 20, height: 20 })];
    const aa = analyzeA11yTouch(lone, "AA");
    assert.deepEqual(aa.failures, []);
    assert.equal(aa.wcagExempt.length, 1);
    assert.equal(aa.wcagExempt[0]!.exception, "spacing");

    const aaa = analyzeA11yTouch(lone, "AAA");
    assert.equal(aaa.failures.length, 1);
    assert.deepEqual(aaa.wcagExempt, []);
  });

  it("reports a row of adjacent icon buttons at AA — the case spacing does not excuse", () => {
    // Centers 22px apart, so the 24px circles overlap. This is the pattern the criterion
    // is actually aimed at, and it must survive the exception being implemented.
    const row = analyzeA11yTouch([
      sample({ path: ".a", x: 0, y: 0, width: 20, height: 20 }),
      sample({ path: ".b", x: 22, y: 0, width: 20, height: 20 }),
      sample({ path: ".c", x: 44, y: 0, width: 20, height: 20 }),
    ], "AA");
    assert.equal(row.failures.length, 3);
    assert.deepEqual(row.wcagExempt, []);
    assert.equal(row.failures.every((f) => f.cluster), true);
  });

  it("measures a compliant neighbour by its box, not its center", () => {
    // The asymmetry in the criterion, and the one place a center-to-center check gives the
    // wrong answer. The 20x20 target's circle is centered at (10,10) with a 12px radius,
    // so it reaches x=22. A 300px-wide button starting at x=20 is inside that, and the
    // exception does not apply — while its CENTER is at x=170, 160px away, which any
    // center-based test would have called clear.
    const beside = analyzeA11yTouch([
      sample({ path: ".small", x: 0, y: 0, width: 20, height: 20 }),
      sample({ path: ".wide", x: 20, y: 0, width: 300, height: 40 }),
    ], "AA");
    assert.equal(beside.failures.length, 1, "the small one is a real failure");
    assert.equal(beside.failures[0]!.path, ".small");
    assert.equal(beside.failures[0]!.cluster, false, "the wide button is not below the floor");
    assert.deepEqual(beside.wcagExempt, []);

    // Same pair, the wide button moved to x=28 — past the circle's reach at x=22.
    const clear = analyzeA11yTouch([
      sample({ path: ".small", x: 0, y: 0, width: 20, height: 20 }),
      sample({ path: ".wide", x: 28, y: 0, width: 300, height: 40 }),
    ], "AA");
    assert.deepEqual(clear.failures, []);
    assert.equal(clear.wcagExempt[0]!.exception, "spacing");
  });

  it("excuses a link in a sentence at BOTH levels", () => {
    // 2.5.5 and 2.5.8 both carry the Inline exception: the line-height sizes the box and
    // growing it would break the prose.
    for (const level of ["AA", "AAA"] as const) {
      const analysis = analyzeA11yTouch([inProse({ path: "p>a", width: 40, height: 18 })], level);
      assert.deepEqual(analysis.failures, [], level);
      assert.equal(analysis.wcagExempt[0]!.exception, "inline", level);
    }
  });

  it("needs both inline display and surrounding text before excusing anything", () => {
    // A nav item is a lone `<a>` in an `<li>`: inline, but nothing in the block
    // constrains it, so the author can grow it. And an inline-BLOCK control carries its
    // own height, so prose around it changes nothing.
    const navItem = analyzeA11yTouch([
      sample({ path: "li>a", width: 40, height: 18, display: "inline", inSentence: false }),
    ], "AAA");
    assert.equal(navItem.failures.length, 1);

    const inlineBlock = analyzeA11yTouch([
      sample({ path: "p>button", width: 40, height: 18, display: "inline-block", inSentence: true }),
    ], "AAA");
    assert.equal(inlineBlock.failures.length, 1);
    assert.equal(inlineBlock.failures[0]!.exception, undefined);
  });

  it("prefers the Inline exception over Spacing, and still annotates the crowding", () => {
    // Two adjacent links in one sentence. Inline excuses them where Spacing would not,
    // and `cluster` stays true — a reader auditing the exemption wants to see exactly the
    // adjacency it is excusing.
    const analysis = analyzeA11yTouch([
      inProse({ path: "p>a.one", x: 0, y: 0, width: 16, height: 16 }),
      inProse({ path: "p>a.two", x: 18, y: 0, width: 16, height: 16 }),
    ], "AA");
    assert.deepEqual(analysis.failures, []);
    assert.equal(analysis.wcagExempt.length, 2);
    assert.equal(analysis.wcagExempt.every((f) => f.exception === "inline"), true);
    assert.equal(analysis.wcagExempt.every((f) => f.cluster), true);
  });

  it("counts every distinct target as inspected, exempt or not", () => {
    // `inspectedCount` used to be the dedup map's size in one path and the sample count in
    // another. It is the number of distinct rendered targets, and it must not shrink
    // because targets became exempt — that would report a smaller measurement as an
    // improvement.
    const analysis = analyzeA11yTouch([
      sample({ path: ".big", x: 0, y: 0, width: 48, height: 48 }),
      sample({ path: ".lone", x: 300, y: 0, width: 20, height: 20 }),
      inProse({ path: "p>a", x: 0, y: 300, width: 40, height: 18 }),
    ], "AA");
    assert.equal(analysis.inspectedCount, 3);
    assert.equal(analysis.failures.length, 0);
    assert.equal(analysis.wcagExempt.length, 2);
    assert.equal(analysis.required, 24);
  });

  it("`analyzeA11yTouchSamples` returns failures only, never the exempted ones", () => {
    // The compat surface `vlmkit diff-pr` and the `rules` barrel use. If exemptions leaked
    // into it, a CI gate counting `.length` would fail on targets WCAG excuses.
    const samples = [
      sample({ path: ".lone", x: 0, y: 0, width: 20, height: 20 }),
      sample({ path: ".a", x: 200, y: 0, width: 16, height: 16 }),
      sample({ path: ".b", x: 210, y: 0, width: 16, height: 16 }),
    ];
    const failures = analyzeA11yTouchSamples(samples, "AA");
    assert.deepEqual(failures.map((f) => f.path).sort(), [".a", ".b"]);
    assert.equal(failures.every((f) => f.exception === undefined), true);
    assert.equal(analyzeA11yTouch(samples, "AA").wcagExempt.length, 1);
  });
});

describe("the default level", () => {
  it("is AA, and matches what `vlmkit diff-pr` already used", () => {
    // Changed in 0.11.0. The CLI gate defaulted to AAA while `src/a11y-on-page.ts` — the
    // diff-pr path — defaulted to AA, so one page could pass CI and fail the CLI. This
    // asserts the direction of the fix, because "the default" is otherwise only visible in
    // the gate's argv parsing and nothing would notice it drifting back.
    const thirtyTwo = [sample({ path: ".btn", width: 32, height: 32 })];
    assert.deepEqual(analyzeA11yTouchSamples(thirtyTwo), [], "32px clears the AA floor");
    assert.equal(analyzeA11yTouch(thirtyTwo).required, 24);
    assert.equal(analyzeA11yTouchSamples(thirtyTwo, "AAA").length, 1, "and not the AAA one");
  });
});
