import { describe, it } from "vitest";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { A11Y_CONTRAST_SAMPLE_SCRIPT, analyzeA11yContrastSamples, type A11yContrastRawSample } from "./a11y-contrast.ts";
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

  it("dedupes by CASE, not by path — same path with different colours is two findings", () => {
    // This test used to assert the opposite ("dedupes by path — first sample wins"), and that
    // assertion was the defect written down as intent. `shortPath` keeps a tag plus its first two
    // classes per ancestor, so Bootstrap's sidebar links all serialize to
    // `…>li.nav-item>a.nav-link.d-flex` — including the `.active` one, which is white on blue and
    // passes at exactly 4.50. Keying on the path alone kept that one and dropped ELEVEN failing
    // links, so `check a11y contrast` reported **0 failures on a page with 11** while
    // `check integrity`'s own contrast rule reported them correctly at the same moment.
    const findings = analyzeA11yContrastSamples([
      sample({ path: ".dup", foreground: { r: 0x9c, g: 0xa3, b: 0xaf }, text: "first" }),
      sample({ path: ".dup", foreground: { r: 0xff, g: 0x00, b: 0x00 }, text: "second" }),
    ]);
    assert.equal(findings.length, 2, "different colours under one path are different cases");
    assert.deepEqual(findings.map((f) => f.text).sort(), ["first", "second"]);
  });

  it("still collapses genuinely identical cases, and counts the elements", () => {
    // The dedup is still worth having: many text nodes of one element, and many elements sharing a
    // selector AND colours AND type size, are one thing to fix. But "1 contrast failure" reads as
    // one link, so the count travels with the finding — `check integrity` says "11 element(s)" for
    // the same defect and the two gates should not describe one page differently.
    const findings = analyzeA11yContrastSamples([
      sample({ path: ".same", foreground: { r: 0x9c, g: 0xa3, b: 0xaf }, text: "one" }),
      sample({ path: ".same", foreground: { r: 0x9c, g: 0xa3, b: 0xaf }, text: "two" }),
      sample({ path: ".same", foreground: { r: 0x9c, g: 0xa3, b: 0xaf }, text: "three" }),
    ]);
    assert.equal(findings.length, 1);
    assert.equal(findings[0]!.elements, 3);
    assert.equal(findings[0]!.text, "one", "the first is the representative");
  });

  it("a different font size under one path is a different case", () => {
    // The threshold itself depends on size (4.5 normal, 3.0 large), so two sizes under one
    // selector can land on opposite sides of the line.
    const findings = analyzeA11yContrastSamples([
      sample({ path: ".mixed", foreground: { r: 0x9c, g: 0xa3, b: 0xaf }, fontSize: 14 }),
      sample({ path: ".mixed", foreground: { r: 0x9c, g: 0xa3, b: 0xaf }, fontSize: 28, fontWeight: 700 }),
    ]);
    assert.ok(findings.length >= 1);
    assert.ok(findings.every((f) => f.elements === 1), "neither collapses into the other");
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

/**
 * The CLI path and the library path must be the SAME path.
 *
 * `runA11yContrast` (what `check a11y contrast` calls) re-implemented the dedup and the finding
 * construction that `analyzeA11yContrastSamples` (what `vlmkit diff-pr` calls) already did. Fixing
 * the exported one left the CLI reporting 0 failures on a page with 11 — the copies had drifted,
 * which is what two copies do. This asserts the duplication has not come back, in the same shape
 * as `tests/settle-page-single-definition.test.mjs`.
 */
describe("one contrast analysis, not two", () => {
  it("runA11yContrast delegates instead of re-deriving findings", () => {
    const source = readFileSync(new URL("./a11y-contrast.ts", import.meta.url), "utf8");
    const run = source.slice(source.indexOf("export async function runA11yContrast"));
    const body = run.slice(0, run.indexOf("\nexport ", 1));
    assert.match(body, /analyzeA11yContrastSamples\(samples\)/, "it calls the shared analysis");
    // The tells of a second copy: its own dedup map, or its own call to the evaluator.
    assert.doesNotMatch(body, /new Map<string, A11yContrastRawSample>/, "no private dedup map");
    assert.doesNotMatch(body, /evaluateA11yContrast\(/, "no private verdict loop");
  });

  it("the reported element count is the samples, not the deduped cases", () => {
    // `inspected N text-bearing element(s)` said 10 on a page with 105 samples, because it reported
    // the size of the dedup map — a coverage claim off by 10x, in the reassuring direction.
    const source = readFileSync(new URL("./a11y-contrast.ts", import.meta.url), "utf8");
    assert.match(source, /totalText: samples\.length/);
    assert.doesNotMatch(source, /totalText: byPath\.size/);
  });
});

/**
 * The composite-background refusal.
 *
 * Found by dogfooding `examples/solitaire/`, whose toolbar is `rgba(0,0,0,0.28)` over a green
 * gradient: this gate reported **9 failures at 1.08:1** for near-white text on a near-black
 * bar, having fallen back to white for a background its style walk could not see. Not a
 * near-miss — the inverse of the truth. `check integrity` got the same page right and said why,
 * so the exemption existed in the toolkit and the contrast specialist did not have it.
 */
describe("backgrounds the style walk cannot resolve", () => {
  const composite = (overrides = {}) => ({
    path: "header>h1",
    tag: "h1",
    text: "Klondike Solitaire",
    fontSize: 17,
    fontWeight: 600,
    bbox: { x: 0, y: 0, width: 200, height: 24 },
    foreground: { r: 242, g: 247, b: 242 },
    background: { r: 255, g: 255, b: 255 },
    composite: true,
    ...overrides,
  });

  it("is not reported as a failure, however bad the guessed ratio looks", () => {
    // #f2f7f2 on #ffffff is 1.08:1 and would be the worst failure on the page. The sample says
    // the background is unknown, so there is no verdict to give.
    assert.deepEqual(analyzeA11yContrastSamples([composite()]), []);
  });

  it("still measures every sample whose background WAS resolved", () => {
    // The refusal must not become a blanket excuse: one unmeasurable element alongside a real
    // failure leaves the real failure reported.
    const findings = analyzeA11yContrastSamples([
      composite(),
      {
        path: "p.muted",
        tag: "p",
        text: "Too muted to read",
        fontSize: 14,
        fontWeight: 400,
        bbox: { x: 0, y: 40, width: 200, height: 20 },
        foreground: { r: 156, g: 163, b: 175 },
        background: { r: 255, g: 255, b: 255 },
      },
    ]);
    assert.equal(findings.length, 1);
    assert.equal(findings[0].path, "p.muted");
  });

  it("treats a sample without the field as measured, so recorded runs keep working", () => {
    // Optional on purpose — the same compatibility direction as `FocusStep.pinned` and
    // `A11yTouchRawSample.display`. Absent means "measured normally", not "unknown".
    const findings = analyzeA11yContrastSamples([composite({ composite: undefined })]);
    assert.equal(findings.length, 1, "1.08:1 is a failure once the background is trusted");
    assert.equal(findings[0].ratio < 1.5, true);
  });
});

describe("CONTRAST_BACKGROUND_JS", () => {
  it("is shared with check integrity rather than reimplemented", async () => {
    // The fragment exists because two gates resolved the background differently and disagreed
    // about one page. If a future edit inlines a second copy, this is what notices.
    const { CONTRAST_BACKGROUND_JS } = await import("./contrast-background.ts");
    assert.match(CONTRAST_BACKGROUND_JS, /function resolveTextBackground/);
    assert.match(CONTRAST_BACKGROUND_JS, /backgroundImage/);
    assert.ok(
      A11Y_CONTRAST_SAMPLE_SCRIPT.includes("function resolveTextBackground"),
      "the sampler must be built from the fragment",
    );
    // No backticks: the fragment is interpolated into template literals, and one backtick ends
    // the script. It happened three times in one session before this was written down.
    assert.equal(CONTRAST_BACKGROUND_JS.includes("`"), false, "no backticks in the fragment");
    assert.equal(CONTRAST_BACKGROUND_JS.includes("${"), false, "no interpolation in the fragment");
  });
});
