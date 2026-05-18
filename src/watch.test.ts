import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { detectZeroCrossings, diffWatchRuns, formatWatchDelta } from "./watch.ts";
import type { WireframeFixSuggestion } from "./experiments/migration/wireframe-fix-candidates.ts";

function sug(over: Partial<WireframeFixSuggestion> & { deltaPx: number; viewports: string[]; rank?: number; bboxDims?: string }): WireframeFixSuggestion {
  // Real wireframe evidence strings put the magnitude AFTER a colon
  // (`rank=N (bbox WxH): Δtop +24px on …`). The watcher's suggestion
  // key only uses the pre-colon prefix to stay stable across small
  // numeric drift between rounds; mirror that shape here so the
  // tests exercise the same key derivation.
  return {
    evidence: over.evidence ?? `component rank=${over.rank ?? 0} (bbox ${over.bboxDims ?? "200x100"}): Δtop ${over.deltaPx >= 0 ? "+" : ""}${over.deltaPx}px`,
    hypothesis: "...",
    suggestion: "...",
    viewports: over.viewports,
    confidence: over.confidence ?? "high",
    deltaPx: over.deltaPx,
    scope: over.scope ?? "subset",
  };
}

describe("diffWatchRuns", () => {
  it("first run: every current suggestion is newlyIntroduced", () => {
    const curr = {
      timestamp: "now",
      diffByViewport: { mobile: 0.1, desktop: 0.02 },
      suggestions: [sug({ deltaPx: 24, viewports: ["mobile"] })],
    };
    const delta = diffWatchRuns(null, curr);
    assert.equal(delta.newlyIntroduced.length, 1);
    assert.equal(delta.resolved.length, 0);
    assert.equal(delta.persisted.length, 0);
  });

  it("identifies resolved suggestions (existed before, gone now)", () => {
    const prev = {
      timestamp: "t0",
      diffByViewport: { mobile: 0.1 },
      suggestions: [sug({ deltaPx: 24, viewports: ["mobile"] })],
    };
    const curr = {
      timestamp: "t1",
      diffByViewport: { mobile: 0.02 },
      suggestions: [] as WireframeFixSuggestion[],
    };
    const delta = diffWatchRuns(prev, curr);
    assert.equal(delta.resolved.length, 1);
    assert.equal(delta.newlyIntroduced.length, 0);
  });

  it("identifies persisted suggestions", () => {
    const s = sug({ deltaPx: 24, viewports: ["mobile"] });
    const delta = diffWatchRuns(
      { timestamp: "t0", diffByViewport: {}, suggestions: [s] },
      { timestamp: "t1", diffByViewport: {}, suggestions: [s] },
    );
    assert.equal(delta.persisted.length, 1);
    assert.equal(delta.resolved.length, 0);
    assert.equal(delta.newlyIntroduced.length, 0);
  });

  it("identifies newlyIntroduced suggestions (the regression-from-last-edit signal)", () => {
    const delta = diffWatchRuns(
      { timestamp: "t0", diffByViewport: {}, suggestions: [] },
      { timestamp: "t1", diffByViewport: {}, suggestions: [sug({ deltaPx: 16, viewports: ["desktop"] })] },
    );
    assert.equal(delta.newlyIntroduced.length, 1);
    assert.equal(delta.newlyIntroduced[0].viewports[0], "desktop");
  });

  it("treats near-magnitude same-direction same-viewport same-scope as the same row across runs", () => {
    // The bucketed key collapses Δ +24 / +25 / +27 into one identity so
    // a row converging gradually doesn't show up as resolved+newly each round.
    const prev = sug({ deltaPx: 24, viewports: ["mobile"], scope: "subset" });
    const curr = sug({ deltaPx: 25, viewports: ["mobile"], scope: "subset" });
    const delta = diffWatchRuns(
      { timestamp: "t0", diffByViewport: {}, suggestions: [prev] },
      { timestamp: "t1", diffByViewport: {}, suggestions: [curr] },
    );
    assert.equal(delta.persisted.length, 1);
    assert.equal(delta.resolved.length, 0);
    assert.equal(delta.newlyIntroduced.length, 0);
  });

  it("does NOT collapse rows with opposite signs (a +24 row and a -24 row are different)", () => {
    const a = sug({ deltaPx: 24, viewports: ["mobile"], scope: "subset" });
    const b = sug({ deltaPx: -24, viewports: ["mobile"], scope: "subset" });
    const delta = diffWatchRuns(
      { timestamp: "t0", diffByViewport: {}, suggestions: [a] },
      { timestamp: "t1", diffByViewport: {}, suggestions: [b] },
    );
    assert.equal(delta.resolved.length, 1);
    assert.equal(delta.newlyIntroduced.length, 1);
  });

  it("captures per-viewport diff% delta", () => {
    const delta = diffWatchRuns(
      { timestamp: "t0", diffByViewport: { mobile: 0.1, desktop: 0.02 }, suggestions: [] },
      { timestamp: "t1", diffByViewport: { mobile: 0.02, desktop: 0.04 }, suggestions: [] },
    );
    assert.ok(delta.diffDelta.mobile.delta < 0); // mobile improved
    assert.ok(delta.diffDelta.desktop.delta > 0); // desktop regressed
  });
});

describe("detectZeroCrossings", () => {
  it("flags a component whose Δtop flipped sign between rounds (G1)", () => {
    const prev = {
      timestamp: "t0",
      diffByViewport: { mobile: 0.1 },
      suggestions: [sug({ rank: 0, deltaPx: 24, viewports: ["mobile"] })],
    };
    const curr = {
      timestamp: "t1",
      diffByViewport: { mobile: 0.05 },
      suggestions: [sug({ rank: 0, deltaPx: -16, viewports: ["mobile"] })],
    };
    const z = detectZeroCrossings(prev, curr);
    assert.equal(z.length, 1);
    assert.equal(z[0].prev.deltaPx, 24);
    assert.equal(z[0].curr.deltaPx, -16);
    // Damping: half the prev magnitude, sign reversed → -12 to walk back.
    assert.equal(z[0].dampedTargetPx, -12);
    assert.match(z[0].message, /overshot|added too much|removed too much/i);
    assert.match(z[0].message, /try damping ~50%/);
  });

  it("does NOT flag when magnitudes are below the significance floor (6px)", () => {
    const prev = {
      timestamp: "t0", diffByViewport: {},
      suggestions: [sug({ rank: 0, deltaPx: 4, viewports: ["mobile"] })],
    };
    const curr = {
      timestamp: "t1", diffByViewport: {},
      suggestions: [sug({ rank: 0, deltaPx: -4, viewports: ["mobile"] })],
    };
    assert.equal(detectZeroCrossings(prev, curr).length, 0);
  });

  it("does NOT flag same-sign rounds (no zero crossing)", () => {
    const prev = {
      timestamp: "t0", diffByViewport: {},
      suggestions: [sug({ rank: 0, deltaPx: 24, viewports: ["mobile"] })],
    };
    const curr = {
      timestamp: "t1", diffByViewport: {},
      suggestions: [sug({ rank: 0, deltaPx: 8, viewports: ["mobile"] })],
    };
    assert.equal(detectZeroCrossings(prev, curr).length, 0);
  });

  it("skips text-row suggestions (they lack stable component identity)", () => {
    const prev = {
      timestamp: "t0", diffByViewport: {},
      suggestions: [{
        ...sug({ deltaPx: 16, viewports: ["mobile"] }),
        evidence: '7 text-row(s) shifted Δy +16px on mobile (e.g. "Hello")',
      }],
    };
    const curr = {
      timestamp: "t1", diffByViewport: {},
      suggestions: [{
        ...sug({ deltaPx: -8, viewports: ["mobile"] }),
        evidence: '7 text-row(s) shifted Δy -8px on mobile (e.g. "Hello")',
      }],
    };
    assert.equal(detectZeroCrossings(prev, curr).length, 0);
  });

  it("diffWatchRuns now surfaces zeroCrossings on its result", () => {
    const prev = {
      timestamp: "t0", diffByViewport: { mobile: 0.1 },
      suggestions: [sug({ rank: 1, deltaPx: 24, viewports: ["mobile"] })],
    };
    const curr = {
      timestamp: "t1", diffByViewport: { mobile: 0.05 },
      suggestions: [sug({ rank: 1, deltaPx: -16, viewports: ["mobile"] })],
    };
    const delta = diffWatchRuns(prev, curr);
    assert.equal(delta.zeroCrossings.length, 1);
  });
});

describe("formatWatchDelta", () => {
  it("first-run mode labels the output", () => {
    const out = formatWatchDelta(
      { diffDelta: { mobile: { prev: 0.1, curr: 0.1, delta: 0 } }, resolved: [], persisted: [], newlyIntroduced: [], zeroCrossings: [] },
      true,
    );
    assert.match(out, /first run/);
  });

  it("newly-introduced gets a loud red header", () => {
    const out = formatWatchDelta(
      {
        diffDelta: { mobile: { prev: 0, curr: 0.05, delta: 0.05 } },
        resolved: [],
        persisted: [],
        newlyIntroduced: [sug({ deltaPx: 24, viewports: ["mobile"] })],
        zeroCrossings: [],
      },
      false,
    );
    assert.match(out, /newly introduced/);
    assert.match(out, /likely regressed something/);
  });

  it("resolved listed when present", () => {
    const out = formatWatchDelta(
      {
        diffDelta: {},
        resolved: [sug({ deltaPx: 24, viewports: ["mobile"] })],
        persisted: [],
        newlyIntroduced: [],
        zeroCrossings: [],
      },
      false,
    );
    assert.match(out, /resolved/);
    assert.match(out, /cleared by your last edit/);
  });

  it("zeroCrossings rendered loudly with damping advice", () => {
    const out = formatWatchDelta(
      {
        diffDelta: {},
        resolved: [], persisted: [], newlyIntroduced: [],
        zeroCrossings: [{
          componentPrefix: "component rank=0 (bbox 200x100)",
          prev: { deltaPx: 24, viewports: ["mobile"] },
          curr: { deltaPx: -16, viewports: ["mobile"] },
          dampedTargetPx: -12,
          message: "component rank=0 (bbox 200x100) flipped sign (+24px → -16px). Your last edit added too much; try damping ~50% (next edit ≈ -12px).",
        }],
      },
      false,
    );
    assert.match(out, /zero-crossing/);
    assert.match(out, /overshot/);
    assert.match(out, /damping ~50%/);
  });

  it("clean state when nothing outstanding", () => {
    const out = formatWatchDelta(
      { diffDelta: {}, resolved: [], persisted: [], newlyIntroduced: [], zeroCrossings: [] },
      false,
    );
    assert.match(out, /clean/);
  });
});
