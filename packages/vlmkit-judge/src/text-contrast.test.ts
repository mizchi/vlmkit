import assert from "node:assert/strict";
import { describe, it } from "vitest";
import { TEXT_CONTRAST_MAX_CANDIDATES, textContrastCandidates, type TextContrastSample } from "./integrity.ts";

/**
 * The loop `COLLECT_TEXT_CONTRAST` used to run inside the page, now over its samples.
 * `check integrity --json` on 16 pages — one of them built to cross the cap, with text
 * over gradients before and after it — was byte-identical before and after the move.
 * These tests pin the loop's own contract: order, cap, and what is counted.
 */
const grey = (i: number, over: Partial<TextContrastSample> = {}): TextContrastSample => ({
  selector: `p:nth-of-type(${i})`,
  text: `row ${i}`,
  color: [150, 150, 150, 1],
  backgrounds: [[255, 255, 255, 1]],
  ...over,
});

describe("textContrastCandidates", () => {
  it("keeps what is below its floor and drops what clears it", () => {
    const { candidates } = textContrastCandidates([
      grey(1),
      grey(2, { color: [0, 0, 0, 1] }),
      grey(3, { fontSizePx: 24, color: [118, 118, 118, 1] }),
    ]);
    assert.deepEqual(candidates.map((c) => c.selector), ["p:nth-of-type(1)"]);
    assert.equal(candidates[0]!.fg, "rgb(150, 150, 150)");
    assert.equal(candidates[0]!.floor, 4.5);
  });

  it("stops at the cap, in document order", () => {
    const samples = Array.from({ length: 80 }, (_, i) => grey(i));
    const { candidates } = textContrastCandidates(samples);
    assert.equal(candidates.length, TEXT_CONTRAST_MAX_CANDIDATES);
    assert.equal(candidates.at(-1)!.selector, `p:nth-of-type(${TEXT_CONTRAST_MAX_CANDIDATES - 1})`);
  });

  it("counts refused text only up to the cap, as the page's loop did", () => {
    const samples: TextContrastSample[] = [
      { selector: "a", text: "over gradient", composite: true },
      ...Array.from({ length: 60 }, (_, i) => grey(i)),
      { selector: "b", text: "over gradient, past the cap", composite: true },
    ];
    assert.equal(textContrastCandidates(samples).skippedComposite, 1);
  });

  it("carries the exemption flags through for judgeTextContrast", () => {
    const [c] = textContrastCandidates([grey(1, { disabled: true, shadowed: true })]).candidates;
    assert.equal(c!.disabled, true);
    assert.equal(c!.shadowed, true);
  });
});
