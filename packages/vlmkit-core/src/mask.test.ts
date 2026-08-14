import assert from "node:assert/strict";
import { afterAll, describe, it } from "vitest";
import type { Browser, Page } from "playwright";
import { launchBrowser } from "./browser-launch.ts";
import { applyMask, formatMaskProblems, MaskTally, parseMaskSelectors } from "./mask.ts";

/**
 * One malformed `--mask` selector used to silently disable every mask after it.
 *
 * The masks went in as a single stylesheet, one `sel { visibility: hidden !important; }`
 * line each, and CSS error recovery on a bad selector consumes until it can
 * resynchronize — which eats the following rules. Measured with
 * `[".a", ".b:not(", ".c"]`: the browser kept exactly ONE rule (`.a`), and both `.b` and
 * `.c` stayed visible. A stray paren from a shell quote was enough.
 *
 * These use a real browser because the defect *is* the browser's CSS parser. A unit test
 * over the generated string could not see it — the string was correct.
 */

let browser: Browser | undefined;
const getBrowser = async (): Promise<Browser> => {
  if (!browser) browser = await launchBrowser();
  return browser;
};
afterAll(async () => {
  await browser?.close();
});

/** A page with four named divs, so "did this one get hidden" is directly observable. */
async function fixture(): Promise<Page> {
  const page = await (await getBrowser()).newPage();
  await page.setContent(
    `<!doctype html><body><div class="keep">K</div><div class="a">A</div>`
    + `<div class="b">B</div><div class="c">C</div></body>`,
  );
  return page;
}

const visibility = (page: Page, selector: string) =>
  page.$eval(selector, (el) => getComputedStyle(el).visibility);

describe("applyMask", () => {
  it("hides every valid selector even when one of them is invalid", async () => {
    const page = await fixture();
    try {
      const result = await applyMask(page, [".a", ".b:not(", ".c"]);
      // The whole point: `.c` comes AFTER the malformed selector and must still be hidden.
      assert.equal(await visibility(page, ".a"), "hidden");
      assert.equal(await visibility(page, ".c"), "hidden", ".c follows the bad selector and was collateral damage");
      // `.b` is what the caller got wrong; it cannot be masked and is reported instead.
      assert.equal(await visibility(page, ".b"), "visible");
      assert.equal(await visibility(page, ".keep"), "visible", "an unmasked element stays visible");

      assert.deepEqual(result.invalid, [".b:not("]);
      assert.deepEqual(result.applied, [".a", ".c"]);
      assert.deepEqual(result.unmatched, []);
    } finally {
      await page.close();
    }
  });

  it("separates 'not valid CSS' from 'valid but matched nothing'", async () => {
    // Two different user errors with two different fixes, and the old code reported
    // neither: both were indistinguishable from a mask that worked.
    const page = await fixture();
    try {
      const result = await applyMask(page, [".a", ".typo", "]bad["]);
      assert.deepEqual(result.applied, [".a"]);
      assert.deepEqual(result.unmatched, [".typo"]);
      assert.deepEqual(result.invalid, ["]bad["]);
      assert.equal(await visibility(page, ".a"), "hidden");
    } finally {
      await page.close();
    }
  });

  it("still hides an element that appears after the mask was applied", async () => {
    // Why a zero-match selector is injected anyway rather than withheld: a lazily
    // mounted region must be covered when it arrives.
    const page = await fixture();
    try {
      const result = await applyMask(page, [".later"]);
      assert.deepEqual(result.unmatched, [".later"]);
      await page.evaluate(() => {
        const el = document.createElement("div");
        el.className = "later";
        document.body.append(el);
      });
      assert.equal(await visibility(page, ".later"), "hidden");
    } finally {
      await page.close();
    }
  });

  it("reports nothing to report when every selector applies", async () => {
    const page = await fixture();
    try {
      const result = await applyMask(page, [".a", ".b"]);
      assert.deepEqual(result, { applied: [".a", ".b"], invalid: [], unmatched: [] });
      assert.equal(formatMaskProblems(result.invalid, result.unmatched), null);
    } finally {
      await page.close();
    }
  });

  it("is a no-op for an empty selector list", async () => {
    const page = await fixture();
    try {
      assert.deepEqual(await applyMask(page, []), { applied: [], invalid: [], unmatched: [] });
      assert.equal(await visibility(page, ".a"), "visible");
    } finally {
      await page.close();
    }
  });
});

describe("MaskTally", () => {
  it("reports an invalid selector once, however many pages hit it", () => {
    // Callers apply masks inside a loop over pages × viewports; saying it every time
    // would bury the run's actual output.
    const tally = new MaskTally();
    tally.add({ applied: [".a"], invalid: [".bad("], unmatched: [] });
    assert.deepEqual(tally.takeNewInvalid(), [".bad("]);
    tally.add({ applied: [".a"], invalid: [".bad("], unmatched: [] });
    assert.deepEqual(tally.takeNewInvalid(), [], "already said");
  });

  it("only counts a selector as unmatched when it matched nothing anywhere", () => {
    // A mask legitimately targets a region that exists on one route only, so per-page
    // "matched nothing" is not a finding. Never matching on any page is.
    const tally = new MaskTally();
    tally.add({ applied: [], invalid: [], unmatched: [".only-on-home", ".typo"] });
    tally.add({ applied: [".only-on-home"], invalid: [], unmatched: [".typo"] });
    assert.deepEqual(tally.neverMatched(), [".typo"]);
  });

  it("has nothing to say about a clean run", () => {
    const tally = new MaskTally();
    tally.add({ applied: [".a"], invalid: [], unmatched: [] });
    assert.deepEqual(tally.takeNewInvalid(), []);
    assert.deepEqual(tally.neverMatched(), []);
    assert.equal(formatMaskProblems([], []), null);
  });
});

describe("formatMaskProblems", () => {
  it("names both states, distinctly", () => {
    const text = formatMaskProblems([".bad("], [".typo"])!;
    assert.match(text, /invalid CSS, masking nothing: \.bad\(/);
    assert.match(text, /matched no element on any page: \.typo/);
  });
});

describe("parseMaskSelectors", () => {
  it("accepts comma-separated and repeated flags alike", () => {
    assert.deepEqual(parseMaskSelectors(["--mask", ".stars,.carousel"]), [".stars", ".carousel"]);
    assert.deepEqual(parseMaskSelectors(["--mask", ".stars", "--mask", ".carousel"]), [".stars", ".carousel"]);
    assert.deepEqual(parseMaskSelectors(["--mask", " .a , .b "]), [".a", ".b"]);
    assert.deepEqual(parseMaskSelectors(["--other", ".x"]), []);
  });
});
