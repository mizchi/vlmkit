import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { diffWatchRuns, formatWatchDelta } from "./watch.ts";
import type { WireframeFixSuggestion } from "./wireframe-fix-candidates.ts";

function sug(over: Partial<WireframeFixSuggestion> & { deltaPx: number; viewports: string[]; rank?: number }): WireframeFixSuggestion {
  // Real wireframe evidence strings put the magnitude AFTER a colon
  // (`rank=N (bbox WxH): Δtop +24px on …`). The watcher's suggestion
  // key only uses the pre-colon prefix to stay stable across small
  // numeric drift between rounds; mirror that shape here so the
  // tests exercise the same key derivation.
  return {
    evidence: over.evidence ?? `component rank=${over.rank ?? 0}: Δtop ${over.deltaPx >= 0 ? "+" : ""}${over.deltaPx}px`,
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

describe("formatWatchDelta", () => {
  it("first-run mode labels the output", () => {
    const out = formatWatchDelta(
      { diffDelta: { mobile: { prev: 0.1, curr: 0.1, delta: 0 } }, resolved: [], persisted: [], newlyIntroduced: [] },
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
      },
      false,
    );
    assert.match(out, /resolved/);
    assert.match(out, /cleared by your last edit/);
  });

  it("clean state when nothing outstanding", () => {
    const out = formatWatchDelta(
      { diffDelta: {}, resolved: [], persisted: [], newlyIntroduced: [] },
      false,
    );
    assert.match(out, /clean/);
  });
});
