import assert from "node:assert/strict";
import { describe, it } from "vitest";
import { chromium } from "playwright";
import { judgeDesignPolicy, type DesignPolicyInput } from "@mizchi/vlmkit-judge/design-policy.ts";
import { sceneToDesignPolicyInput, type SceneElement } from "@mizchi/vlmkit-judge/scene.ts";
import { buildDesignSampleScript } from "./design-policy.ts";

/**
 * `check design` on one page two ways: the real `COLLECT_DESIGN_SAMPLES`, and the same page
 * collected as a scene with roles taken from the tags and the signature fields read off
 * computed style. Both go through `judgeDesignPolicy`; the roles, their reuse and the
 * drifting instance must come out the same.
 */
const HTML = `<!doctype html><html><body style="margin:0;background:#fff;font:16px sans-serif">
  <h1 style="font-size:32px;font-weight:700">Title</h1>
  <h2 style="font-size:24px">Section</h2>
  <button style="padding:8px 16px;border-radius:6px;border:0;background:#2563eb;color:#fff;font-size:14px;font-weight:600">Save</button>
  <button style="padding:8px 16px;border-radius:6px;border:0;background:#2563eb;color:#fff;font-size:14px;font-weight:600">Send</button>
  <button style="padding:8px 16px;border-radius:6px;border:0;background:#2563eb;color:#fff;font-size:14px;font-weight:600">Share</button>
  <button style="padding:10px 18px;border-radius:4px;border:0;background:#1d4ed8;color:#fff;font-size:14px;font-weight:600">Drift</button>
  <button style="padding:8px 16px;border-radius:6px;border:1px solid #ccc;background:#fff;font-size:14px;font-weight:600">Cancel</button>
</body></html>`;

const COLLECT_SCENE = `(() => {
  const out = [];
  for (const el of [document.body, ...document.body.querySelectorAll("*")]) {
    const s = getComputedStyle(el);
    const r = el.getBoundingClientRect();
    const tag = el.tagName.toLowerCase();
    let text = "";
    for (const n of el.childNodes) if (n.nodeType === 3) text += n.nodeValue || "";
    const f = (v) => Math.round(parseFloat(v) * 10) / 10;
    out.push({
      path: tag + "[" + out.length + "]", tag: tag,
      top: r.top, left: r.left, width: r.width, height: r.height,
      ...(tag === "button" ? { role: "button" } : {}),
      ...(text.trim() ? { text: text } : {}),
      padding: [f(s.paddingTop), f(s.paddingRight), f(s.paddingBottom), f(s.paddingLeft)],
      radius: f(s.borderTopLeftRadius),
      border: f(s.borderTopWidth),
      background: s.backgroundColor,
      fontSize: f(s.fontSize),
      fontWeight: parseFloat(s.fontWeight),
    });
  }
  return out;
})()`;

describe("check design: DOM collector vs scene adapter on one page", () => {
  it("find the same roles, reuse and drift", async () => {
    const browser = await chromium.launch();
    try {
      const tab = await browser.newPage({ viewport: { width: 800, height: 600 } });
      await tab.setContent(HTML);
      const domInput = await tab.evaluate(buildDesignSampleScript()) as DesignPolicyInput;
      assert.ok(domInput.samples.every((s) => !("signature" in s)), "the collector ships style facts, not signatures");
      const dom = judgeDesignPolicy(domInput);
      const scene = judgeDesignPolicy(sceneToDesignPolicyInput(await tab.evaluate(COLLECT_SCENE) as SceneElement[]));

      const roles = (r: typeof dom) => r.roles.map((x) => ({ role: x.role, instances: x.instances, signatures: x.signatures }));
      assert.deepEqual(roles(scene), roles(dom));
      // The parts of a drift finding that do not name a page-specific selector: how many
      // styles the role renders, and the dominant style's full signature, spelled out.
      const drift = (r: typeof dom) => r.findings
        .filter((f) => f.kind === "component-drift")
        .map((f) => [
          /\d+ "[^"]+" elements render \d+ distinct styles/.exec(f.message)?.[0],
          /Dominant style, used \d+x: [^.]*/.exec(f.message)?.[0],
        ]);
      assert.equal(dom.verdict, "drift");
      assert.equal(scene.verdict, dom.verdict);
      assert.ok(drift(dom).length > 0 && drift(dom).every(([a, b]) => a && b), JSON.stringify(dom.findings));
      assert.deepEqual(drift(scene), drift(dom));
    } finally {
      await browser.close();
    }
  });
});
