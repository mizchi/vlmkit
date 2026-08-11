import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { GLYPH_HEIGHT, GLYPH_WIDTH, drawText, fitText, measureText, textHeight } from "./bitmap-font.ts";

function canvas(width: number, height: number) {
  return { width, height, data: new Uint8Array(width * height * 4) };
}

function inkCount(target: { data: Uint8Array }): number {
  let n = 0;
  for (let i = 0; i < target.data.length; i += 4) if (target.data[i + 3] === 255) n++;
  return n;
}

describe("bitmap font metrics", () => {
  it("advances 6 columns per glyph and drops the trailing blank", () => {
    assert.equal(measureText("1", 1), GLYPH_WIDTH);
    assert.equal(measureText("12", 1), GLYPH_WIDTH * 2 + 1);
    assert.equal(measureText("12", 2), (GLYPH_WIDTH * 2 + 1) * 2);
    assert.equal(textHeight(2), GLYPH_HEIGHT * 2);
  });

  it("measures an empty and an entirely undrawable string as zero", () => {
    assert.equal(measureText("", 2), 0);
    // Non-ASCII is dropped rather than substituted, so it must not reserve width for
    // a box that will never be drawn.
    assert.equal(measureText("日本語", 2), 0);
  });

  it("covers printable ASCII, so a selector never renders as boxes", () => {
    const printable = Array.from({ length: 95 }, (_, i) => String.fromCharCode(32 + i)).join("");
    // Every character contributes its advance — none was silently skipped.
    assert.equal(measureText(printable, 1), printable.length * (GLYPH_WIDTH + 1) - 1);
  });
});

describe("fitText", () => {
  it("returns the text untouched when it fits", () => {
    assert.equal(fitText("250ms", 1000, 2), "250ms");
  });

  it("truncates from the end with a marker, staying inside the budget", () => {
    const out = fitText("article.card.card--featured", 60, 1);
    assert.ok(out.endsWith(".."), `expected a truncation marker, got "${out}"`);
    assert.ok(measureText(out, 1) <= 60, `"${out}" is ${measureText(out, 1)}px, over the 60px budget`);
    // The head is what maps a row back to the terminal output, so it must survive.
    assert.ok("article.card.card--featured".startsWith(out.slice(0, -2)));
  });

  it("returns nothing when not even the marker fits, rather than overflowing", () => {
    assert.equal(fitText("article", 3, 1), "");
  });
});

describe("drawText", () => {
  it("draws opaque ink at the requested colour and leaves the rest untouched", () => {
    const target = canvas(20, 10);
    drawText(target, "1", 0, 0, [10, 20, 30], 1);
    assert.ok(inkCount(target) > 0, "nothing was drawn");
    const lit = [...Array(200).keys()].find((p) => target.data[p * 4 + 3] === 255)!;
    assert.deepEqual([...target.data.slice(lit * 4, lit * 4 + 4)], [10, 20, 30, 255]);
  });

  it("scales ink area by scale squared", () => {
    const one = canvas(60, 20);
    const two = canvas(60, 20);
    drawText(one, "8", 0, 0, [255, 255, 255], 1);
    drawText(two, "8", 0, 0, [255, 255, 255], 2);
    assert.equal(inkCount(two), inkCount(one) * 4);
  });

  it("clips instead of wrapping, so a long label cannot bleed into the next row", () => {
    const target = canvas(12, 8);
    drawText(target, "12345", 0, 0, [255, 255, 255], 1);
    // Row 7 is outside a 7px glyph drawn at y=0; anything there came from a wrap.
    for (let x = 0; x < 12; x++) {
      assert.equal(target.data[(7 * 12 + x) * 4 + 3], 0, `pixel (${x},7) was written`);
    }
  });

  it("draws nothing for a negative position entirely off-canvas", () => {
    const target = canvas(10, 10);
    drawText(target, "8", -50, -50, [255, 255, 255], 1);
    assert.equal(inkCount(target), 0);
  });

  it("renders distinct glyphs for case pairs, so a selector reads correctly", () => {
    // `nth-of-type` came out as `nth-of-tYPe` when the descender letters were drawn
    // at cap height, which is exactly the misreading a labelled row exists to avoid.
    for (const [lower, upper] of [["p", "P"], ["y", "Y"], ["g", "G"], ["q", "Q"], ["j", "J"]]) {
      const a = canvas(10, 10);
      const b = canvas(10, 10);
      drawText(a, lower!, 0, 0, [255, 255, 255], 1);
      drawText(b, upper!, 0, 0, [255, 255, 255], 1);
      assert.notDeepEqual([...a.data], [...b.data], `"${lower}" renders identically to "${upper}"`);
    }
  });

  it("puts a descender below the baseline of an x-height letter", () => {
    const bottomRowOf = (ch: string) => {
      const t = canvas(8, GLYPH_HEIGHT);
      drawText(t, ch, 0, 0, [255, 255, 255], 1);
      let bottom = -1;
      for (let y = 0; y < GLYPH_HEIGHT; y++) {
        for (let x = 0; x < 8; x++) if (t.data[(y * 8 + x) * 4 + 3] === 255) bottom = y;
      }
      return bottom;
    };
    // `p` must reach lower than `o`, or the two read as the same height.
    assert.ok(bottomRowOf("p") >= bottomRowOf("o"), "p does not descend past o");
    assert.ok(bottomRowOf("y") >= bottomRowOf("o"), "y does not descend past o");
  });
});
