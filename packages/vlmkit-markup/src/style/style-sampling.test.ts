import assert from "node:assert/strict";
import { describe, it } from "vitest";
import { chromium } from "playwright";
import { STYLE_SAMPLING_JS } from "./style-sampling.ts";

describe("STYLE_SAMPLING_JS", () => {
  it("interpolates into a template literal without escaping", () => {
    // It is spliced into three collectors. One backtick ends the host literal,
    // and a `${` would be filled in by the host module rather than by the page.
    assert.equal(STYLE_SAMPLING_JS.includes("`"), false, "no backticks");
    assert.equal(STYLE_SAMPLING_JS.includes("${"), false, "no interpolation");
    // The class split has to survive the template literal as a regex, not as /s+/.
    assert.match(STYLE_SAMPLING_JS, /split\(\/\\s\+\/\)/);
  });

  /**
   * Values, in a real browser — `className` is only an SVGAnimatedString in one.
   * `check color` carried its own `path`, reading the class through
   * `(className || "").toString()`, and named `<svg class="icon">` `svg.[object`.
   */
  it("names elements the same way for every style gate, SVG included", async () => {
    const page = `<!doctype html><meta charset="utf-8"><title>t</title>
      <main id="m"><div class="card wide"><p class="lead"><a href="#x">link</a></p></div></main>
      <div class="bar"><svg class="icon" width="10" height="10"></svg></div>
      <div id="gone" style="display: none">x</div>
      <div id="clear" style="opacity: 0">x</div>
      <div id="shown">x</div>`;
    const browser = await chromium.launch();
    try {
      const tab = await browser.newPage();
      await tab.setContent(page);
      const got = await tab.evaluate(`(() => {
        ${STYLE_SAMPLING_JS}
        const q = (s) => document.querySelector(s);
        return {
          link: path(q("a")), anchored: path(q("div.card")), svg: path(q("svg")),
          gone: visible(q("#gone")), clear: visible(q("#clear")), shown: visible(q("#shown")),
          len: px("14.25px"), none: px("auto"),
        };
      })()`) as Record<string, unknown>;

      // Three segments at most, the first class of each; an id ends the walk.
      assert.equal(got.link, "div.card>p.lead>a");
      assert.equal(got.anchored, "main#m>div.card");
      assert.equal(got.svg, "div.bar>svg", "an SVG's class is not read, rather than read as [object ...]");

      assert.equal(got.gone, false, "display: none");
      assert.equal(got.clear, false, "opacity: 0");
      assert.equal(got.shown, true);

      assert.equal(got.len, 14.3);
      assert.equal(got.none, 0, "a keyword reads as 0, not NaN");
    } finally {
      await browser.close();
    }
  }, 60_000);
});
