import assert from "node:assert/strict";
import { describe, it } from "vitest";
import { execSync } from "node:child_process";
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { chromium } from "playwright";
import { STABLE_SELECTOR_JS } from "@mizchi/vlmkit-core/stable-selector.ts";
import { runMotionDetection } from "./style/motion-detect.ts";

/**
 * A finding's selector must match exactly one element.
 *
 * That is the property the whole reporting surface rests on: it is what makes a
 * finding actionable, what lets two findings be told apart, and what
 * `--allow "<selector>;<reason>"` matches against.
 *
 * Six gates carried their own copy of `stableSelector` and three had lost the
 * recursive call, returning `p:nth-of-type(1)` — the first `<p>` of *every* parent.
 * `check animation` on the fixture below reported three findings on two different
 * elements, all three carrying the identical selector `div:nth-of-type(1)`.
 *
 * These tests assert the property, not the source, because the source is exactly what
 * was allowed to diverge. The last case is the one that catches a seventh copy.
 */

const dir = mkdtempSync(join(tmpdir(), "vlmkit-selector-"));

/**
 * Built to make an ambiguous selector likely rather than possible: repeated tags as
 * first children of different parents, a class shared by several elements (so the
 * `tag.class` branch must fall through on uniqueness), a unique class, and an id.
 */
const html = `<!doctype html><meta charset="utf-8"><title>selectors</title>
<style>
  body { margin: 0; font: 16px sans-serif; }
  section { padding: 8px; }
  .box { width: 80px; height: 80px; background: #2d6cdf;
         animation: slide 1s linear infinite alternate; }
  .only-one { outline: 1px solid #333; }
  @keyframes slide { to { transform: translateX(120px); } }
</style>
<body>
  <section id="alpha">
    <div class="box"></div>
    <div class="box"></div>
    <p>first p under alpha</p>
  </section>
  <section id="beta">
    <div class="box only-one"></div>
    <p>first p under beta</p>
  </section>
  <section>
    <p>first p under an unnamed section</p>
    <span><span><p>deeply nested first p</p></span></span>
  </section>
</body>`;
const fixture = join(dir, "page.html");
writeFileSync(fixture, html);

describe("STABLE_SELECTOR_JS", () => {
  it("names every element in the document uniquely", async () => {
    const browser = await chromium.launch();
    try {
      const page = await browser.newPage({ viewport: { width: 900, height: 700 } });
      await page.setContent(html);
      const rows = await page.evaluate(`(() => {
        ${STABLE_SELECTOR_JS}
        return Array.from(document.querySelectorAll("body, body *")).map((el) => {
          const selector = stableSelector(el);
          let matches = -1;
          try { matches = document.querySelectorAll(selector).length; } catch { matches = -2; }
          return { tag: el.tagName.toLowerCase(), selector, matches, self: matches === 1 && document.querySelector(selector) === el };
        });
      })()`) as Array<{ tag: string; selector: string; matches: number; self: boolean }>;

      assert.ok(rows.length >= 12, `fixture got smaller: only ${rows.length} elements`);
      const ambiguous = rows.filter((r) => r.matches !== 1);
      assert.deepEqual(
        ambiguous.map((r) => `${r.selector} matches ${r.matches}`),
        [],
        "a selector that does not resolve to exactly one element names nothing",
      );
      // Unique is not enough — it has to be the element it was generated FOR.
      assert.deepEqual(rows.filter((r) => !r.self).map((r) => r.selector), []);
      // And distinct elements must get distinct selectors, which is the property that
      // lets two findings be told apart.
      const selectors = rows.map((r) => r.selector);
      assert.equal(new Set(selectors).size, selectors.length, "two elements share a selector");
    } finally {
      await browser.close();
    }
  }, 60_000);

  it("prefers an id, then a unique class, then the path", async () => {
    const browser = await chromium.launch();
    try {
      const page = await browser.newPage({ viewport: { width: 900, height: 700 } });
      await page.setContent(html);
      const of = await page.evaluate(`(() => {
        ${STABLE_SELECTOR_JS}
        const pick = (sel) => stableSelector(document.querySelector(sel));
        return {
          id: pick("#alpha"),
          uniqueClass: pick(".only-one"),
          sharedClass: pick("#alpha .box"),
          nested: pick("span span p"),
        };
      })()`) as Record<string, string>;

      assert.equal(of.id, "#alpha", "an id needs no path");
      assert.equal(of.uniqueClass, "div.box.only-one", "a class combination that matches once is the most useful name");
      // `.box` matches three elements, so the class branch must fall through rather
      // than emit a selector that names all of them.
      assert.equal(of.sharedClass, "#alpha > div:nth-of-type(1)");
      // Recursion stops at the nearest id — `#alpha > …` above proves that — but with
      // no id on the way up it walks to `html`, since `body` has neither an id nor a
      // unique class. So an id-less page gets long paths; they are still exact, which is
      // what the property requires. (I first asserted this started at `body`.)
      assert.equal(
        of.nested,
        "html > body:nth-of-type(1) > section:nth-of-type(3) > span:nth-of-type(1) > span:nth-of-type(1) > p:nth-of-type(1)",
      );
    } finally {
      await browser.close();
    }
  }, 60_000);
});

describe("the one copy that is not the shared string", () => {
  it("`check motion` names distinct elements distinctly", async () => {
    // `motion-detect.ts` passes a real typed arrow to `page.evaluate`, so it cannot
    // interpolate `STABLE_SELECTOR_JS` and carries its own copy. This is what holds the
    // two in agreement: before the fix it reported both `.box` elements as
    // `div:nth-of-type(1)`.
    const report = await runMotionDetection({ source: fixture });
    const selectors = report.samples.map((sample) => sample.selector).filter(Boolean);
    assert.ok(selectors.length >= 2, `expected several animated elements, got ${selectors.length}`);
    assert.equal(new Set(selectors).size, selectors.length, `duplicate selectors: ${JSON.stringify(selectors)}`);
    for (const s of selectors) {
      assert.ok(!/^[a-z]+:nth-of-type/.test(s), `\`${s}\` has no ancestor path, so it names every such first child`);
    }
  }, 120_000);
});

describe("no seventh copy", () => {
  it("only the shared module and motion-detect define `stableSelector`", () => {
    // The check that survives the next refactor. A new gate copying the helper is how
    // this happened the first time, and a copy is invisible to any test of behaviour it
    // is not yet wired into.
    const root = resolve(import.meta.dirname, "..", "..", "..");
    const files = execSync("git ls-files '*.ts'", { cwd: root, encoding: "utf8" })
      .trim().split("\n").filter(Boolean);
    assert.ok(files.length > 200, `git ls-files returned ${files.length}`);
    const definers = files.filter((rel) => {
      if (rel.endsWith(".test.ts")) return false;
      return /function stableSelector\b/.test(readFileSync(resolve(root, rel), "utf8"));
    });
    assert.deepEqual(
      definers.sort(),
      [
        "packages/vlmkit-core/src/stable-selector.ts",
        "packages/vlmkit-markup/src/style/motion-detect.ts",
      ],
      "a new copy of `stableSelector` — interpolate STABLE_SELECTOR_JS instead. Three of "
      + "the original six copies had silently lost the recursive call.",
    );
  });
});
