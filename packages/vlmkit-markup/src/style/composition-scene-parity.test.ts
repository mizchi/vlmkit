import assert from "node:assert/strict";
import { readdirSync } from "node:fs";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { describe, it } from "vitest";
import { chromium } from "playwright";
import { judgeComposition, type CompositionInput } from "@mizchi/vlmkit-judge/composition.ts";
import { sceneToCompositionInput, type SceneElement } from "@mizchi/vlmkit-judge/scene.ts";
import { COLLECT_COMPOSITION } from "./composition.ts";
import { STYLE_SAMPLING_JS } from "./style-sampling.ts";

/**
 * `check composition` on the paired-mutant fixtures two ways: the real `COLLECT_COMPOSITION`,
 * and the same page written out as a scene — boxes in frame coordinates, direct text, font,
 * background, border, radius, and `overlay` for out-of-flow boxes, which is what a renderer
 * that is not a browser knows. Both go through `judgeComposition`; the whole report must
 * come out the same, selectors aside (the scene's are its own paths, mapped back here).
 *
 * The scene skips what the page collector treats as not drawn — invisible boxes, an SVG's
 * internals, `display: contents` — because a renderer does not emit what it does not paint.
 */
const FIXTURES = resolve(import.meta.dirname!, "../../../../fixtures/composition");

const COLLECT_SCENE = `(() => {
  ${STYLE_SAMPLING_JS}
  const out = [];
  const pathOf = new Map();
  for (const el of document.querySelectorAll("body *")) {
    if (el.closest("svg")) continue;
    if (!visible(el)) continue;
    const s = getComputedStyle(el);
    if (s.display === "contents") continue;
    let parentPath = "";
    for (let p = el.parentElement; p; p = p.parentElement) {
      if (pathOf.has(p)) { parentPath = pathOf.get(p) + ">"; break; }
    }
    const tag = el.tagName.toLowerCase();
    const own = parentPath + tag + "[" + out.length + "]";
    pathOf.set(el, own);
    const r = el.getBoundingClientRect();
    let text = "";
    for (const n of el.childNodes) if (n.nodeType === 3) text += n.nodeValue || "";
    const round = (v) => Math.round(v * 10) / 10;
    out.push({
      path: own, tag: tag, dom: path(el),
      top: round(r.y + window.scrollY), left: round(r.x), width: round(r.width), height: round(r.height),
      ...(text.trim() ? { text: text } : {}),
      ...(s.position === "absolute" || s.position === "fixed" ? { overlay: true } : {}),
      fontSize: px(s.fontSize),
      fontWeight: Number(s.fontWeight) || 400,
      background: s.backgroundColor,
      border: px(s.borderTopWidth),
      radius: px(s.borderTopLeftRadius),
    });
  }
  return out;
})()`;

/** The scene report with every scene path replaced by the DOM selector of the same element. */
function mapSelectors(report: unknown, scene: readonly (SceneElement & { dom: string })[]): unknown {
  const bySceneePath = new Map(scene.map((e) => [e.path, e.dom]));
  const paths = [...bySceneePath.keys()].sort((a, b) => b.length - a.length);
  const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const pattern = new RegExp(paths.map(escape).join("|"), "g");
  return JSON.parse(JSON.stringify(report).replace(pattern, (m) => JSON.stringify(bySceneePath.get(m)!).slice(1, -1)));
}

/**
 * Two shapes the fixtures do not contain, each of which the adapter has to handle the way the
 * page does: a section whose only boundary is its corner radius (so its heading's gaps are
 * not judged — one inversion, not two), and a 1px rule between a heading and its content,
 * which the page does not collect as a box and the scene must not either.
 */
const EDGE_CASES = `<!doctype html><html><body style="margin:0;font:16px sans-serif">
<main style="padding:24px 40px;width:700px">
  <h1 style="font-size:36px;margin:0 0 16px">Settings</h1>
  <p style="margin:0">Intro paragraph of body text that is long enough to count as prose.</p>
  <section style="margin-top:12px;border-radius:8px">
    <h2 style="font-size:22px;margin:0">Account</h2>
    <p style="margin:36px 0 0">The account section body, a real paragraph of text under its heading.</p>
  </section>
  <section style="margin-top:12px">
    <h2 style="font-size:22px;margin:0">Billing</h2>
    <div style="height:1px;background:#ddd"></div>
    <p style="margin:36px 0 0">Billing body, another real paragraph of text under its heading here.</p>
  </section>
  <p style="margin:12px 0 0">Closing paragraph of body text, the last one on this page.</p>
</main></body></html>`;

describe("check composition: DOM collector vs scene adapter on the paired mutants", () => {
  const pages = readdirSync(FIXTURES).filter((f) => f.endsWith(".html")).sort();

  it("covers every fixture, intact and broken", () => {
    assert.ok(pages.length >= 7 && pages.includes("composed.html"), pages.join(", "));
  });

  it("judge every page the same way", async () => {
    const browser = await chromium.launch();
    try {
      const verdicts: string[] = [];
      for (const file of [...pages, "edge-cases"]) {
        const tab = await browser.newPage({ viewport: { width: 1280, height: 900 } });
        if (file === "edge-cases") await tab.setContent(EDGE_CASES);
        else await tab.goto(pathToFileURL(join(FIXTURES, file)).href);
        const input = await tab.evaluate(COLLECT_COMPOSITION) as CompositionInput;
        const dom = judgeComposition(input);
        const elements = await tab.evaluate(COLLECT_SCENE) as (SceneElement & { dom: string })[];
        const scene = judgeComposition(sceneToCompositionInput(elements, input.viewport));
        assert.deepEqual(mapSelectors(scene, elements), dom, file);
        verdicts.push(`${file}: ${dom.verdict} [${dom.findings.map((f) => f.kind).join(", ")}]`);
        await tab.close();
      }
      // Not a vacuous pass: the broken fixtures must actually report, the intact one must not.
      const report = verdicts.join("\n");
      assert.match(report, /proximity-broken\.html: \w+ \[[^\]]*proximity-inversion/, report);
      assert.match(report, /hierarchy-broken\.html: \w+ \[[^\]]*flat-heading-step/, report);
      assert.match(report, /rail-broken\.html: \w+ \[[^\]]*rail-near-miss/, report);
      assert.match(report, /edge-cases: \w+ \[proximity-inversion\]$/m, report);
    } finally {
      await browser.close();
    }
  });
});
