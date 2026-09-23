import assert from "node:assert/strict";
import { describe, it } from "vitest";
import { chromium } from "playwright";
import { CONTRAST_BACKGROUND_JS } from "./contrast-background.ts";

/**
 * `parseColor` against a real browser, because the thing it gets wrong is what a
 * real browser returns from `getComputedStyle`.
 *
 * The version that shipped matched `rgba?(…)` only, on the assumption that
 * computed values are always serialised that way. They are not: Chromium returns
 * NON-LEGACY colour functions verbatim, so a Tailwind v4 page whose tokens are
 * `oklch()` reports `lab(1.90334 0.278696 -5.48866)` and the regex returned null.
 *
 * Every caller drops a colour it cannot parse, so the effect on
 * `vlmkit check a11y contrast` at tailwindcss.com/docs/flex-basis was:
 *
 *   before   inspected 10 text-bearing element(s)  — 1 "failure", #ffffff on
 *            #ffffff at 1.00:1, which is what an unreadable background looks
 *            like once it falls through to the white default
 *   after    inspected 501 text-bearing element(s) — 4 failures, all real:
 *            #99a1af on #ffffff at 2.60:1 (text-gray-400), #00a6f4 on #ffffff
 *            at 2.71:1 (text-sky-500), and the same pair inverted on a badge
 *
 * 566 of that page's 576 text-bearing elements had an unreadable text colour.
 * The other 13 pages of the live corpus had none — plus 4 `oklch()` backgrounds
 * on MDN — so this is not a broad blindness, it is a TOTAL one on any page built
 * with a current colour syntax, reported as a clean page with a plausible
 * coverage count. `docs/reports/2026-09-23-color-roles-v1.md`.
 *
 * These assert on parsed VALUES rather than on the source, because the source is
 * exactly what looked correct. A syntax the browser accepts and this returns
 * null for is the bug, whatever the implementation.
 */

/** `parseColor` for a list of CSS colour strings, in one page. */
async function parseInBrowser(values: readonly string[]): Promise<(number[] | null)[]> {
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage();
    await page.goto("about:blank");
    return await page.evaluate(
      `((values) => {
        ${CONTRAST_BACKGROUND_JS}
        return values.map((v) => {
          const c = parseColor(v);
          return c === null ? null : c.map((n) => Math.round(n * 1000) / 1000);
        });
      })(${JSON.stringify(values)})`,
    ) as (number[] | null)[];
  } finally {
    await browser.close();
  }
}

describe("parseColor", () => {
  // One browser launch for the whole table: a page per assertion is ~30x the cost
  // and this is a pure function of the string.
  const CASES: { css: string; expect: number[] | null; why: string }[] = [
    // The legacy fast path, which is exact and must stay exact.
    { css: "rgb(1, 2, 3)", expect: [1, 2, 3, 1], why: "computed serialisation of an opaque colour" },
    { css: "rgba(1, 2, 3, 0.5)", expect: [1, 2, 3, 0.5], why: "…and of a translucent one" },
    { css: "rgba(0, 0, 0, 0)", expect: [0, 0, 0, 0], why: "the computed value of `transparent`" },
    { css: "rgb(255 0 0 / 0.25)", expect: [255, 0, 0, 0.25], why: "the space/slash form" },

    // The syntaxes that returned null. Values are what Chromium rasterises, which
    // is the colour on screen and the sRGB WCAG luminance is defined on.
    { css: "lab(1.90334 0.278696 -5.48866)", expect: [3, 7, 18, 1], why: "Tailwind v4 gray-950 as computed" },
    { css: "lab(98.1434 -0.369519 -1.05966)", expect: [248, 250, 252, 1], why: "…and slate-50" },
    { css: "oklch(0.7 0.15 250)", expect: [75, 163, 247, 1], why: "oklch as authored" },
    { css: "oklab(0.5 0.1 -0.1)", expect: [129, 69, 154, 1], why: "oklab" },
    { css: "lch(50% 40 200)", expect: [0, 136, 141, 1], why: "lch" },
    { css: "color(srgb 0.2 0.4 0.6)", expect: [51, 102, 153, 1], why: "the color() function" },
    { css: "color-mix(in oklab, red, blue)", expect: [140, 83, 162, 1], why: "color-mix" },
    { css: "hsl(200 50% 40%)", expect: [51, 119, 153, 1], why: "hsl" },
    { css: "#abc", expect: [170, 187, 204, 1], why: "a short hex, as an inline style would give" },
    { css: "rebeccapurple", expect: [102, 51, 153, 1], why: "a named colour" },
    { css: "transparent", expect: [0, 0, 0, 0], why: "the keyword, not just its computed form" },

    // An out-of-sRGB-gamut colour is mapped the way the compositor maps it rather
    // than refused: a number a reader can see beats no number.
    { css: "oklch(0.9 0.4 140)", expect: [0, 255, 0, 1], why: "out of gamut, mapped not dropped" },

    // Still null, and that matters: null is the honest "cannot read", and a caller
    // is entitled to treat it as a refusal rather than as a colour.
    { css: "not-a-color", expect: null, why: "a value the browser itself rejects" },
    { css: "", expect: null, why: "an empty string" },
  ];

  it("resolves every colour syntax a browser accepts, and only refuses what it rejects", async () => {
    const got = await parseInBrowser(CASES.map((c) => c.css));
    const wrong: string[] = [];
    CASES.forEach((c, i) => {
      const actual = got[i];
      if (c.expect === null) {
        if (actual !== null) wrong.push(`${c.css} (${c.why}): expected null, got [${actual}]`);
        return;
      }
      if (actual === null) {
        wrong.push(`${c.css} (${c.why}): returned null — a colour the browser can paint`);
        return;
      }
      // Within a unit per channel: the translucent path divides the alpha back out
      // of rasterised bytes, so it is accurate rather than exact.
      const close = c.expect.every((want, ch) => Math.abs((actual[ch] ?? NaN) - want) <= 1.001);
      if (!close) wrong.push(`${c.css} (${c.why}): expected [${c.expect}], got [${actual}]`);
    });
    assert.deepEqual(wrong, [], `\n  ${wrong.join("\n  ")}\n`);
  }, 60_000);

  it("carries the invariants the fragment is interpolated under", async () => {
    // Restated here as well as in a11y-contrast.test.ts because this file is where
    // the canvas branch was added, and a backtick in its comments is the failure.
    assert.equal(CONTRAST_BACKGROUND_JS.includes("`"), false, "no backticks in the fragment");
    assert.equal(CONTRAST_BACKGROUND_JS.includes("${"), false, "no interpolation in the fragment");
    // The regex character classes have to survive the template literal: `\s`
    // written singly is eaten and splits on the letter s. The repo-wide sweep in
    // src/util/browser-script-escapes.test.ts reads `_JS` names now — it did not
    // when this was written — and names this constant so the coverage cannot be
    // lost again by a rename. This assertion stays as the local, exact one.
    assert.match(CONTRAST_BACKGROUND_JS, /split\(\/\[,\\\/\\s\]\+\//);
  });
});
