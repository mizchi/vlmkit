import assert from "node:assert/strict";
import { describe, it } from "vitest";
import { chromium } from "playwright";
import {
  blendColor,
  contrastRatio,
  parseColor,
  type Rgb,
  type Rgba,
} from "@mizchi/vlmkit-judge/color.ts";
import { sceneContrastCandidates, type SceneElement } from "@mizchi/vlmkit-judge/scene.ts";
import { CONTRAST_BACKGROUND_JS } from "./contrast-background.ts";
import { COLLECT_TEXT_CONTRAST, type ContrastCandidate } from "./inspect/integrity-check.ts";

/**
 * The browser's colour arithmetic and the judge's are two copies of one definition — the
 * page's is a string that runs inside `page.evaluate`, the judge's is what a scene from any
 * other renderer is measured with. This file is what keeps them one definition.
 *
 * The first half runs the page's functions in Node (the rgb() path touches no DOM) against
 * the judge's over a grid of inputs. The second runs the real `COLLECT_TEXT_CONTRAST` on a
 * page, collects the same page as a scene, and requires the scene adapter to produce the
 * same candidates: same colours, same ratio, same floor.
 */
const page = new Function(`${CONTRAST_BACKGROUND_JS}; return { parseColor, blendColor, contrastRatio };`)() as {
  parseColor(s: string): number[] | null;
  blendColor(base: Rgb, over: Rgba): number[];
  contrastRatio(a: Rgb, b: Rgb): number;
};

const levels = [0, 17, 64, 119, 128, 148, 200, 255];

describe("colour arithmetic: page script vs judge", () => {
  it("parses every rgb()/rgba() serialisation the same way", () => {
    for (const s of ["rgb(1, 2, 3)", "rgba(10, 20, 30, 0.4)", "rgb(1 2 3 / 0.5)", "rgba(0, 0, 0, 0)"]) {
      assert.deepEqual(parseColor(s), page.parseColor(s), s);
    }
  });

  it("computes identical contrast ratios over a grid of greys and hues", () => {
    for (const a of levels) {
      for (const b of levels) {
        const x: Rgb = [a, b, 255 - a];
        const y: Rgb = [b, 255 - b, a];
        assert.equal(contrastRatio(x, y), page.contrastRatio(x, y), `${x} vs ${y}`);
      }
    }
  });

  it("blends identically at every alpha", () => {
    for (const alpha of [0, 0.1, 0.33, 0.5, 0.9, 1]) {
      const over: Rgba = [10, 200, 90, alpha];
      assert.deepEqual(blendColor([250, 240, 230], over), page.blendColor([250, 240, 230], over));
    }
  });
});

/**
 * Text over solid backgrounds only: the page composites a missing background over white and
 * the scene refuses instead, so the fixture gives `body` an opaque one and the two agree by
 * construction there. Everything else — nesting, translucency, opacity, large text — varies.
 */
const HTML = `<!doctype html><html><body style="margin:0;background:#ffffff;font:16px sans-serif">
  <p style="color:#777777">grey body text</p>
  <p style="color:#949494;font-size:24px">large grey text</p>
  <p style="color:#949494;font-size:19px;font-weight:700">bold nineteen</p>
  <div style="background:#555555;padding:8px"><span style="color:#777777">grey on dark</span></div>
  <div style="background:rgba(0,0,0,0.5);padding:8px"><span style="color:#808080">on translucent</span></div>
  <div style="opacity:0.35;padding:8px"><span style="color:#000000">faded black</span></div>
  <div style="background:#101010;padding:8px"><span style="color:#141414">invisible</span></div>
  <p style="color:#000000">plenty of contrast</p>
</body></html>`;

/** A scene of the same page: every element, with only the facts a renderer knows. */
const COLLECT_SCENE = `(() => {
  const out = [];
  const pathOf = (el) => {
    const parts = [];
    for (let n = el; n && n !== document.documentElement; n = n.parentElement) {
      const siblings = n.parentElement ? Array.from(n.parentElement.children).filter((c) => c.tagName === n.tagName) : [n];
      parts.unshift(n.tagName.toLowerCase() + "[" + siblings.indexOf(n) + "]");
    }
    return parts.join(">");
  };
  for (const el of [document.body, ...document.body.querySelectorAll("*")]) {
    const s = getComputedStyle(el);
    const r = el.getBoundingClientRect();
    let direct = "";
    for (const n of el.childNodes) if (n.nodeType === 3) direct += n.nodeValue || "";
    out.push({
      path: pathOf(el), tag: el.tagName.toLowerCase(),
      top: r.top, left: r.left, width: r.width, height: r.height,
      ...(direct.trim() ? { text: direct, color: s.color } : {}),
      background: s.backgroundColor,
      ...(s.backgroundImage !== "none" ? { backgroundImage: true } : {}),
      opacity: parseFloat(s.opacity),
      fontSize: parseFloat(s.fontSize),
      fontWeight: parseFloat(s.fontWeight),
    });
  }
  return out;
})()`;

describe("text contrast: DOM collector vs scene adapter on one page", () => {
  it("produce the same candidates", async () => {
    const browser = await chromium.launch();
    try {
      const tab = await browser.newPage({ viewport: { width: 800, height: 600 } });
      await tab.setContent(HTML);
      const dom = await tab.evaluate(COLLECT_TEXT_CONTRAST) as { candidates: ContrastCandidate[] };
      const scene = await tab.evaluate(COLLECT_SCENE) as SceneElement[];
      const byPath = new Map(scene.map((e) => [e.path, e]));
      const fromScene = sceneContrastCandidates(scene.filter((e) => e.color !== undefined), byPath, 800);

      const key = (c: ContrastCandidate) => ({
        text: c.text, ratio: c.ratio, fg: c.fg, bg: c.bg, floor: c.floor, large: c.large, fontSizePx: c.fontSizePx,
      });
      const sort = (list: ContrastCandidate[]) => list.map(key).sort((a, b) => a.text.localeCompare(b.text));
      assert.ok(dom.candidates.length >= 5, `fixture should produce candidates, got ${JSON.stringify(dom.candidates)}`);
      assert.deepEqual(sort(fromScene.candidates), sort(dom.candidates));
      assert.deepEqual(fromScene.refused, [], "every text element in the fixture sits on an opaque background");
    } finally {
      await browser.close();
    }
  });
});
