import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { IntegrityTextBlock } from "@mizchi/vlmkit-markup/inspect/integrity-check.ts";
import {
  compareFingerprints,
  formatComparison,
  pairMargins,
  type ProbeFingerprint,
} from "./font-determinism-probe.ts";

const block = (over: Partial<IntegrityTextBlock> & { selector: string }): IntegrityTextBlock => ({
  text: "x",
  x: 0,
  y: 0,
  width: 100,
  height: 20,
  overlay: false,
  zIndex: 0,
  ariaHidden: false,
  inkInset: 0,
  ...over,
});

describe("pairMargins", () => {
  it("measures each pair's distance from the ink floor", () => {
    // Two 20px blocks, no ink slack, offset by 10px: ink bands overlap 10px
    // against a floor of max(6, 0.5 * 20) = 10 — exactly on the line.
    const pairs = pairMargins([
      block({ selector: "#a", y: 0 }),
      block({ selector: "#b", y: 10 }),
    ], new Set());
    assert.equal(pairs.length, 1);
    assert.equal(pairs[0]!.oy, 10);
    assert.equal(pairs[0]!.threshold, 10);
    assert.equal(pairs[0]!.margin, 0);
  });

  it("subtracts ink slack from both sides", () => {
    // 3px of slack per edge shrinks each band by 6px, so a 10px box overlap
    // becomes a 4px ink overlap — and the floor drops with the ink height.
    const pairs = pairMargins([
      block({ selector: "#a", y: 0, inkInset: 3 }),
      block({ selector: "#b", y: 10, inkInset: 3 }),
    ], new Set());
    assert.equal(pairs[0]!.oy, 4);
    assert.equal(pairs[0]!.threshold, 7); // max(6, 0.5 * (20 - 6))
    assert.equal(pairs[0]!.margin, -3);
  });

  it("keeps near-misses, because those are what a metric shift moves", () => {
    // Bands clear each other by 5px. Excluding it would leave only pairs that
    // could never flip, which measures nothing.
    const pairs = pairMargins([
      block({ selector: "#a", y: 0 }),
      block({ selector: "#b", y: 25 }),
    ], new Set());
    assert.equal(pairs.length, 1);
    assert.equal(pairs[0]!.oy, -5);
  });

  it("drops pairs too far apart to ever flip, and non-overlapping columns", () => {
    assert.equal(pairMargins([block({ selector: "#a", y: 0 }), block({ selector: "#b", y: 200 })], new Set()).length, 0);
    assert.equal(pairMargins([block({ selector: "#a", x: 0 }), block({ selector: "#b", x: 500 })], new Set()).length, 0);
  });

  it("ignores nesting: a block containing another is not a collision", () => {
    const pairs = pairMargins([
      block({ selector: "#outer", x: 0, y: 0, width: 200, height: 60 }),
      block({ selector: "#inner", x: 10, y: 10, width: 50, height: 20 }),
    ], new Set());
    assert.deepEqual(pairs, []);
  });

  it("carries the gate's own report status through, either pair order", () => {
    const pairs = pairMargins([
      block({ selector: "#a", y: 0 }),
      block({ selector: "#b", y: 5 }),
    ], new Set(["#b x #a"]));
    assert.equal(pairs[0]!.reported, true);
  });

  it("sorts tightest-first", () => {
    const pairs = pairMargins([
      block({ selector: "#a", y: 0 }),
      block({ selector: "#b", y: 10 }),
      block({ selector: "#c", y: 26 }),
    ], new Set());
    assert.ok(Math.abs(pairs[0]!.margin) <= Math.abs(pairs[1]!.margin));
  });
});

describe("compareFingerprints", () => {
  const fingerprint = (
    label: string,
    pairs: { pair: string; margin: number; reported: boolean }[],
    inkInset = 2,
  ): ProbeFingerprint => ({
    label,
    platform: "linux-x64",
    browserVersion: "0",
    dpr: 1,
    fontStack: null,
    hinting: "default",
    fixtures: [{
      fixture: "page.html",
      blocks: [{ selector: "#a", height: 20, inkInset }],
      pairs: pairs.map((p) => ({ ...p, ox: 50, oy: 10, threshold: 10 - p.margin })),
      findings: pairs.filter((p) => p.reported).length,
      reportedPairs: pairs.filter((p) => p.reported).map((p) => p.pair),
    }],
  });

  it("calls the floor stable when nothing changed report status", () => {
    const c = compareFingerprints(
      fingerprint("linux", [{ pair: "#a x #b", margin: 4, reported: true }]),
      fingerprint("macos", [{ pair: "#a x #b", margin: 3, reported: true }]),
    );
    assert.equal(c.totalThresholdFlips, 0);
    assert.equal(c.totalGeometryFlips, 0);
    assert.equal(c.rows[0]!.maxMarginDelta, 1);
    assert.match(formatComparison(c), /FLOOR STABLE/);
  });

  it("indicts the floor when the same pair is judged differently", () => {
    const c = compareFingerprints(
      fingerprint("linux", [{ pair: "#a x #b", margin: 0.5, reported: true }]),
      fingerprint("macos", [{ pair: "#a x #b", margin: -0.5, reported: false }]),
    );
    assert.equal(c.totalThresholdFlips, 1);
    assert.equal(c.totalGeometryFlips, 0);
    assert.match(formatComparison(c), /FLOOR FRAGILE/);
  });

  it("separates a vanished overlap from a moved threshold", () => {
    // Measured case: substituting a proportional face for a monospace one made
    // two absolutely-positioned labels stop overlapping at all. Both verdicts
    // are right for their own rendering, so this must not read as fragility.
    const c = compareFingerprints(
      fingerprint("linux", [{ pair: "#total x #refund", margin: 5.8, reported: true }]),
      fingerprint("liberation", []),
    );
    assert.equal(c.totalThresholdFlips, 0);
    assert.equal(c.totalGeometryFlips, 1);
    const text = formatComparison(c);
    assert.match(text, /FLOOR STABLE/);
    assert.match(text, /the overlap itself changed/);
  });

  it("reports the tightest margin anywhere, since that flips first", () => {
    const c = compareFingerprints(
      fingerprint("linux", [{ pair: "#a x #b", margin: 9 }, { pair: "#c x #d", margin: -0.3 }].map(
        (p) => ({ ...p, reported: false }),
      )),
      fingerprint("macos", [{ pair: "#a x #b", margin: 9, reported: false }]),
    );
    assert.equal(c.tightestMargin?.margin, -0.3);
    assert.match(formatComparison(c), /tightest margin anywhere: -0\.3px/);
  });

  it("tracks ink drift per block", () => {
    const c = compareFingerprints(fingerprint("linux", [], 2.6), fingerprint("macos", [], 1.1));
    assert.equal(c.rows[0]!.maxInkInsetDelta, 1.5);
  });
});
