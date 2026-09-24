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
import { sceneContrastCandidates, sceneToColorRolesInput, type SceneElement } from "@mizchi/vlmkit-judge/scene.ts";
import { judgeColorRoles, type ColorRolesInput } from "@mizchi/vlmkit-judge/color-roles.ts";
import { COLLECT_COLOR_ROLES } from "./style/color-roles.ts";
import { textContrastCandidates, type TextContrastSample } from "@mizchi/vlmkit-judge/integrity.ts";
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
      const { samples } = await tab.evaluate(COLLECT_TEXT_CONTRAST) as { samples: TextContrastSample[] };
      // The page ships facts only; the ratio is never computed in the browser.
      assert.ok(samples.length > 0 && samples.every((sample) => !("ratio" in sample)), JSON.stringify(samples[0]));
      const dom = textContrastCandidates(samples);
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

/**
 * `check color` on one page two ways: the real `COLLECT_COLOR_ROLES`, and the same page
 * collected as a scene with roles taken from the tags. Borders are uniform and the body
 * paints an opaque background, which is where the two collectors describe the same facts;
 * inside that, the judge must measure every field and link identically.
 */
const COLOR_HTML = `<!doctype html><html><body style="margin:0;background:#f7f7f5;color:#222;font:16px sans-serif">
  <div style="background:#ffffff;padding:16px">
    <input id="faint" style="background:#ffffff;border:1px solid #eeeeee">
    <input id="framed" style="background:#ffffff;border:1px solid #767676">
    <input id="filled" style="background:#e4e4e4;border:0">
    <textarea id="shadowed" style="background:#ffffff;border:0;box-shadow:0 0 0 1px #999"></textarea>
  </div>
  <p style="color:#333333">A sentence long enough to be prose with <a href="#a" style="color:#3a6ea5;text-decoration:none">a bare link</a> inside it.</p>
  <p style="color:#333333;background:rgba(0,0,120,0.08)">Another sentence of prose with <a href="#b" style="color:#555555;text-decoration:underline">an underlined link</a> in it.</p>
  <p style="color:#444444">Prose once more, where <a href="#c" style="color:#444444;text-decoration:none">the link is the body ink</a> exactly.</p>
</body></html>`;

const COLLECT_COLOR_SCENE = `(() => {
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
    // Each text node trimmed on its own, the way the page's ownText() counts a flow's prose:
    // the spaces either side of an inline link are layout, not characters of the sentence.
    let direct = "";
    for (const n of el.childNodes) if (n.nodeType === 3) direct += (n.nodeValue || "").trim();
    const tag = el.tagName.toLowerCase();
    const role = tag === "input" || tag === "textarea" ? "field" : tag === "a" ? "link" : undefined;
    const border = parseFloat(s.borderTopWidth) || 0;
    out.push({
      path: pathOf(el), tag: tag,
      top: r.top, left: r.left, width: r.width, height: r.height,
      ...(direct.trim() ? { text: direct } : {}),
      color: s.color,
      background: s.backgroundColor,
      fontWeight: parseFloat(s.fontWeight),
      ...(role ? { role: role } : {}),
      ...(border > 0 && s.borderTopStyle !== "none" ? { border: border, borderColor: s.borderTopColor } : {}),
      ...(s.textDecorationLine.indexOf("underline") !== -1 ? { underline: true } : {}),
      ...(s.boxShadow !== "none" ? { shadow: true } : {}),
    });
  }
  return out;
})()`;

describe("check color: DOM collector vs scene adapter on one page", () => {
  it("measure every field and link the same", async () => {
    const browser = await chromium.launch();
    try {
      const tab = await browser.newPage({ viewport: { width: 800, height: 600 } });
      await tab.setContent(COLOR_HTML);
      const dom = judgeColorRoles(await tab.evaluate(COLLECT_COLOR_ROLES) as ColorRolesInput);
      const elements = await tab.evaluate(COLLECT_COLOR_SCENE) as SceneElement[];
      const scene = judgeColorRoles(sceneToColorRolesInput(elements, { width: 800, height: 600 }));

      const controls = (r: typeof dom) => r.controls.map((c) => ({ onHex: c.onHex, fillHex: c.fillHex, fillRatio: c.fillRatio, borderHex: c.borderHex, borderRatio: c.borderRatio, best: c.best, hasShadow: c.hasShadow }));
      const links = (r: typeof dom) => r.links.map((l) => ({ linkHex: l.linkHex, bodyHex: l.bodyHex, vsBody: l.vsBody, underlined: l.underlined, sameInk: l.sameInk, proseChars: l.proseChars }));
      assert.equal(dom.controls.length, 4);
      assert.equal(dom.links.length, 3);
      assert.deepEqual(controls(scene), controls(dom));
      assert.deepEqual(links(scene), links(dom));
      const findingKinds = (r: typeof dom) => r.findings.map((f) => f.kind).sort();
      assert.deepEqual(findingKinds(scene), findingKinds(dom));
      assert.ok(findingKinds(dom).includes("control-boundary-invisible"), findingKinds(dom).join(", "));
      assert.ok(findingKinds(dom).includes("color-only-link"), findingKinds(dom).join(", "));
    } finally {
      await browser.close();
    }
  });
});
