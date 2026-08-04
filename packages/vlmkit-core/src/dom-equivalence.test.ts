import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { verifyDomEquivalence, type DomFingerprint } from "./dom-equivalence.ts";

function fp(over: Partial<DomFingerprint> = {}): DomFingerprint {
  return {
    headingTexts: ["Command Center", "Response controls", "Daily snapshot", "Review dialog"],
    buttonTexts: ["Ship update", "Preview draft", "Archive notes", "Cancel", "Publish now"],
    inputValues: ["Billing export stalls for enterprise accounts", "EU daytime shift"],
    elementCount: 47,
    ...over,
  };
}

describe("verifyDomEquivalence", () => {
  it("returns ok when fingerprints match exactly", () => {
    const r = verifyDomEquivalence(fp(), fp());
    assert.equal(r.ok, true);
    assert.equal(r.warnings.length, 0);
  });

  it("flags renamed headings (the 2026-05-12 dogfood case)", () => {
    const baseline = fp();
    const variant = fp({
      headingTexts: ["Command Center", "Response controls", "Queue metrics", "Pause confirmation"],
    });
    const r = verifyDomEquivalence(baseline, variant);
    assert.equal(r.ok, false);
    const headingWarning = r.warnings.find((w) => w.code === "heading-mismatch");
    assert.ok(headingWarning);
    assert.match(headingWarning!.message, /Queue metrics/);
    assert.match(headingWarning!.message, /Daily snapshot/);
  });

  it("flags renamed buttons", () => {
    const r = verifyDomEquivalence(
      fp(),
      fp({ buttonTexts: ["Ship update", "Preview draft", "Discard", "Cancel", "Publish now"] }),
    );
    const w = r.warnings.find((w) => w.code === "button-mismatch");
    assert.ok(w);
    assert.match(w!.message, /Discard/);
    assert.match(w!.message, /Archive notes/);
  });

  it("flags reordered content (same elements, different sequence)", () => {
    const r = verifyDomEquivalence(
      fp(),
      fp({ headingTexts: ["Daily snapshot", "Command Center", "Response controls", "Review dialog"] }),
    );
    const w = r.warnings.find((w) => w.code === "heading-mismatch");
    assert.ok(w);
    assert.match(w!.message, /reordered/);
  });

  it("flags element-count drift above 5%", () => {
    const r = verifyDomEquivalence(fp({ elementCount: 100 }), fp({ elementCount: 120 }));
    const w = r.warnings.find((w) => w.code === "element-count-mismatch");
    assert.ok(w);
    assert.match(w!.message, /20\.0%/);
  });

  it("does not flag element-count drift below threshold", () => {
    const r = verifyDomEquivalence(fp({ elementCount: 100 }), fp({ elementCount: 102 }));
    const w = r.warnings.find((w) => w.code === "element-count-mismatch");
    assert.equal(w, undefined);
  });

  it("ignores whitespace differences in text content", () => {
    const r = verifyDomEquivalence(
      fp(),
      fp({ headingTexts: ["Command   Center", "Response controls", "Daily snapshot", "Review dialog"] }),
    );
    assert.equal(r.ok, true);
  });

  it("flags input values changing", () => {
    const r = verifyDomEquivalence(
      fp(),
      fp({ inputValues: ["Different input value", "EU daytime shift"] }),
    );
    const w = r.warnings.find((w) => w.code === "input-mismatch");
    assert.ok(w);
  });

  it("handles empty fingerprints", () => {
    const r = verifyDomEquivalence(
      { headingTexts: [], buttonTexts: [], inputValues: [], elementCount: 0 },
      { headingTexts: [], buttonTexts: [], inputValues: [], elementCount: 0 },
    );
    assert.equal(r.ok, true);
  });
});
