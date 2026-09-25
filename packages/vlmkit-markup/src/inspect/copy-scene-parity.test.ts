import assert from "node:assert/strict";
import { describe, it } from "vitest";
import { chromium } from "playwright";
import { analyzeCopy, type CopyCheckReport } from "@mizchi/vlmkit-judge/copy.ts";
import { judgeSceneCopy, type SceneElement } from "@mizchi/vlmkit-judge/scene.ts";
import { COLLECT_RAW_TEXT, COLLECT_TEXT_VISIBILITY } from "./copy-check.ts";

/**
 * `check copy` on one page two ways: the real `COLLECT_RAW_TEXT` + `COLLECT_TEXT_VISIBILITY`
 * (what `runCopyCheck` feeds `analyzeCopy`), and the same page written out as a scene — each
 * text-bearing element's box, own opacity, text colour and background, which is what a
 * renderer that is not a browser knows. Every manifest line must come out the same: seen,
 * missing, or unseen for the same reason.
 *
 * The page holds one line per hiding vector the scene can describe, and one control each way:
 * a line that is simply visible and a line that is not on the page at all. `unreachable` is
 * not here because a scene cannot express it — the report names it as not evaluated.
 */
const HTML = `<!doctype html><html><body style="margin:0;background:#ffffff;color:#222;font:16px sans-serif">
  <p>Plainly visible line</p>
  <div style="opacity:0"><p>Hidden by an ancestor's opacity</p></div>
  <p><span style="font-size:0">Squeezed to nothing</span> and a visible tail</p>
  <p style="color:transparent">Painted with no alpha</p>
  <p><span style="position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0);white-space:nowrap">Screen reader only</span></p>
  <p style="color:#fcfcfc">White on white</p>
  <div style="background:#1b1f24;padding:8px"><p style="color:#1e2227">Dark on dark</p></div>
  <div style="background:#1b1f24;padding:8px"><p style="color:#e6e6e6">Light on dark reads fine</p></div>
</body></html>`;

const MANIFEST = [
  "Plainly visible line",
  "Hidden by an ancestor's opacity",
  "Squeezed to nothing",
  "Painted with no alpha",
  "Screen reader only",
  "White on white",
  "Dark on dark",
  "Light on dark reads fine",
  "Never on the page",
];

/** Every element with text of its own, plus every element that paints or fades (containers). */
const COLLECT_SCENE = `(() => {
  const out = [];
  const pathOf = new Map();
  for (const el of [document.body, ...document.body.querySelectorAll("*")]) {
    const parent = el.parentElement && pathOf.get(el.parentElement);
    const tag = el.tagName.toLowerCase();
    const own = (parent ? parent + ">" : "") + tag + "[" + out.length + "]";
    pathOf.set(el, own);
    const s = getComputedStyle(el);
    const r = el.getBoundingClientRect();
    let text = "";
    for (const n of el.childNodes) if (n.nodeType === 3) text += n.nodeValue || "";
    out.push({
      path: own, tag: tag,
      top: r.top, left: r.left, width: r.width, height: r.height,
      ...(text.trim() ? { text: text.trim(), color: s.color } : {}),
      background: s.backgroundColor,
      opacity: parseFloat(s.opacity),
    });
  }
  return out;
})()`;

const verdicts = (report: CopyCheckReport) => MANIFEST.map((line) => {
  const invisible = report.invisibleLines.find((l) => l.line === line);
  if (invisible) return `${line}: invisible (${invisible.reason})`;
  if (report.missingLines.includes(line)) return `${line}: missing`;
  return `${line}: visible`;
});

describe("check copy: DOM collectors vs scene adapter on one page", () => {
  it("sort every manifest line the same way", async () => {
    const browser = await chromium.launch();
    try {
      const tab = await browser.newPage({ viewport: { width: 800, height: 600 } });
      await tab.setContent(HTML);
      const pageText = await tab.evaluate(COLLECT_RAW_TEXT) as string;
      const { visible, invisible } = await tab.evaluate(COLLECT_TEXT_VISIBILITY) as { visible: string; invisible: { reason: string; text: string }[] };
      const dom = analyzeCopy({ source: "page", pageText, visibleText: visible, invisibleChunks: invisible, manifestLines: MANIFEST });
      const scene = judgeSceneCopy(await tab.evaluate(COLLECT_SCENE) as SceneElement[], { source: "scene", manifestLines: MANIFEST });

      // Not a vacuous agreement: the page itself must sort the lines into every class.
      assert.deepEqual(verdicts(dom), [
        "Plainly visible line: visible",
        "Hidden by an ancestor's opacity: invisible (hidden)",
        "Squeezed to nothing: invisible (zero-size)",
        "Painted with no alpha: invisible (transparent)",
        "Screen reader only: invisible (visually-hidden)",
        "White on white: invisible (camouflage)",
        "Dark on dark: invisible (camouflage)",
        "Light on dark reads fine: visible",
        "Never on the page: missing",
      ]);
      assert.deepEqual(verdicts(scene), verdicts(dom));
      assert.deepEqual(scene.issues.map((i) => i.kind).sort(), dom.issues.map((i) => i.kind).sort());
      assert.match(scene.coverageNotes[0]!, /covers 5 of its 7 reason classes/);
      assert.match(scene.coverageNotes[0]!, /unreachable \(needs a scroll extent/);
    } finally {
      await browser.close();
    }
  });
});
