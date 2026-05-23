import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { analyzeA11yContrastSamples, type A11yContrastRawSample } from "./a11y-contrast.ts";
import { evaluateA11yContrast } from "./markup-core-a11y-contrast.ts";

function sample(overrides: Partial<A11yContrastRawSample> = {}): A11yContrastRawSample {
  return {
    path: "div[0]",
    tag: "p",
    text: "lorem ipsum",
    fontSize: 14,
    fontWeight: 400,
    foreground: { r: 100, g: 100, b: 100 },
    background: { r: 255, g: 255, b: 255 },
    bbox: { x: 0, y: 0, width: 100, height: 20 },
    ...overrides,
  };
}

describe("evaluateA11yContrast (MoonBit policy)", () => {
  it("black on white is AAA (21:1)", () => {
    const out = evaluateA11yContrast({
      foreground: { r: 0, g: 0, b: 0 },
      background: { r: 255, g: 255, b: 255 },
      fontSize: 14,
      fontWeight: 400,
    });
    assert.equal(out.level, "AAA");
    assert.equal(out.requiredAA, 4.5);
    assert.ok(out.ratio >= 20.99, `ratio ${out.ratio} should be ~21`);
  });

  it("muted #9ca3af on white fails for body text (motivating case)", () => {
    const out = evaluateA11yContrast({
      foreground: { r: 0x9c, g: 0xa3, b: 0xaf },
      background: { r: 255, g: 255, b: 255 },
      fontSize: 14,
      fontWeight: 400,
    });
    assert.equal(out.level, "fail");
    assert.equal(out.requiredAA, 4.5);
    assert.ok(out.ratio > 2.5 && out.ratio < 3.5, `expected ~2.9, got ${out.ratio}`);
  });

  it("recognizes large text threshold at 18 px regular", () => {
    const out = evaluateA11yContrast({
      foreground: { r: 0x77, g: 0x77, b: 0x77 },
      background: { r: 255, g: 255, b: 255 },
      fontSize: 18,
      fontWeight: 400,
    });
    assert.equal(out.requiredAA, 3.0);
  });

  it("recognizes large text threshold at 14 px bold", () => {
    const out = evaluateA11yContrast({
      foreground: { r: 0x77, g: 0x77, b: 0x77 },
      background: { r: 255, g: 255, b: 255 },
      fontSize: 14,
      fontWeight: 700,
    });
    assert.equal(out.requiredAA, 3.0);
  });

  it("AA-large path: 3.5 ratio with large text → AA-large, not fail", () => {
    // #757575 on white ≈ 4.6:1; #888888 on white ≈ 3.5:1 — pick a color in
    // the gap.
    const out = evaluateA11yContrast({
      foreground: { r: 0x88, g: 0x88, b: 0x88 },
      background: { r: 255, g: 255, b: 255 },
      fontSize: 18,
      fontWeight: 400,
    });
    assert.equal(out.level, "AA-large");
  });
});

describe("analyzeA11yContrastSamples", () => {
  it("only surfaces failing samples", () => {
    const findings = analyzeA11yContrastSamples([
      sample({ path: ".ok", foreground: { r: 0, g: 0, b: 0 } }),
      sample({ path: ".fail", foreground: { r: 0x9c, g: 0xa3, b: 0xaf } }),
    ]);
    assert.equal(findings.length, 1);
    assert.equal(findings[0]!.path, ".fail");
    assert.equal(findings[0]!.level, "fail");
  });

  it("dedupes by path — first sample wins", () => {
    const findings = analyzeA11yContrastSamples([
      sample({ path: ".dup", foreground: { r: 0x9c, g: 0xa3, b: 0xaf }, text: "first" }),
      sample({ path: ".dup", foreground: { r: 0xff, g: 0x00, b: 0x00 }, text: "second" }),
    ]);
    assert.equal(findings.length, 1);
    assert.equal(findings[0]!.text, "first");
  });

  it("sorts findings by ratio ascending (worst first)", () => {
    const findings = analyzeA11yContrastSamples([
      sample({ path: ".bad", foreground: { r: 0x9c, g: 0xa3, b: 0xaf } }),
      sample({ path: ".worse", foreground: { r: 0xcc, g: 0xcc, b: 0xcc } }),
    ]);
    assert.equal(findings.length, 2);
    assert.ok(findings[0]!.ratio <= findings[1]!.ratio);
  });

  it("annotates with hex colors and required AA threshold", () => {
    const findings = analyzeA11yContrastSamples([
      sample({ foreground: { r: 0x9c, g: 0xa3, b: 0xaf } }),
    ]);
    const f = findings[0]!;
    assert.equal(f.foreground.hex, "#9ca3af");
    assert.equal(f.background.hex, "#ffffff");
    assert.equal(f.requiredAA, 4.5);
  });
});
