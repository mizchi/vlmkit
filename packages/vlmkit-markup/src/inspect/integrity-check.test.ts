/**
 * S14b mutation battery + S14c false-positive audit for `check integrity`
 * (docs/design/creative-markup-eval.md).
 *
 * S14b: inject one defect class per page into otherwise-clean markup and
 * assert the gate reports THAT class. These are the design's acceptance
 * criterion (9/9 classes — the injections are deliberately unambiguous,
 * so a miss is a probe design bug, not a hard case).
 *
 * S14c: pages built ONLY from intentional patterns (hero overlay,
 * ellipsis truncation, absolute positioning anchor, aria-hidden
 * decoration) must come back verdict=clean with the candidates visible
 * in `exempted` — the exemption is the tool's judgment and must be
 * auditable, never silent.
 */
import assert from "node:assert";
import { test, describe } from "node:test";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  classifyRuntimeEvents,
  findTextCollisions,
  judgeClippedText,
  judgeCollapsedContainers,
  judgeNetworkFailures,
  judgeRender,
  judgeUnstyled,
  measureInkRatio,
  runIntegrityCheck,
  type IntegrityReport,
  type IntegrityTextBlock,
} from "./integrity-check.ts";

const DIR = mkdtempSync(join(tmpdir(), "integrity-"));
const ONE_VIEWPORT = [{ width: 1280, height: 800 }];

function page(name: string, body: string, head = ""): string {
  const file = join(DIR, name);
  writeFileSync(file, `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>t</title>${head}</head><body>${body}</body></html>`);
  return file;
}

function kinds(report: IntegrityReport): string[] {
  return report.findings.map((f) => f.kind);
}

function block(partial: Partial<IntegrityTextBlock>): IntegrityTextBlock {
  return { selector: "#x", text: "text", x: 0, y: 0, width: 100, height: 20, overlay: false, zIndex: 0, ariaHidden: false, ...partial };
}

// ---------------------------------------------------------------------------
// Pure-function units

describe("pure judges", () => {
  test("classifyRuntimeEvents: construction pageerror is fail, post-load is warn", () => {
    const findings = classifyRuntimeEvents([
      { type: "pageerror", text: "boom", phase: "construction" },
      { type: "pageerror", text: "later", phase: "post-load" },
      { type: "console-error", text: "fetch failed", phase: "post-load" },
    ], 1280);
    assert.deepEqual(findings.map((f) => f.severity), ["fail", "warn", "warn"]);
    assert.ok(findings[0]!.message.includes("before load"));
  });

  test("findTextCollisions: same-layer overlap fails, overlay/aria-hidden exempt, containment skipped", () => {
    const inFlowPair = findTextCollisions([
      block({ selector: "#a", x: 0, y: 0, width: 100, height: 20 }),
      block({ selector: "#b", x: 40, y: 8, width: 100, height: 20 }),
    ], 1280);
    assert.equal(inFlowPair.findings.length, 1);
    assert.equal(inFlowPair.findings[0]!.severity, "fail");
    assert.match(inFlowPair.findings[0]!.selector!, /#a x #b/);

    const overlay = findTextCollisions([
      block({ selector: "#caption" }),
      block({ selector: "#hero-title", x: 20, y: 4, overlay: true, zIndex: 2 }),
    ], 1280);
    assert.equal(overlay.findings.length, 0);
    assert.equal(overlay.exempted.length, 1);
    assert.match(overlay.exempted[0]!.reason, /overlay/);

    const decorative = findTextCollisions([
      block({ selector: "#real" }),
      block({ selector: "#ghost", x: 10, y: 2, ariaHidden: true }),
    ], 1280);
    assert.equal(decorative.findings.length, 0);
    assert.match(decorative.exempted[0]!.reason, /aria-hidden/);

    const nested = findTextCollisions([
      block({ selector: "#outer", x: 0, y: 0, width: 200, height: 100 }),
      block({ selector: "#inner", x: 10, y: 10, width: 50, height: 20 }),
    ], 1280);
    assert.equal(nested.findings.length + nested.exempted.length, 0);
  });

  test("two absolute layers with distinct z-index are exempt; same z-index collide", () => {
    const distinct = findTextCollisions([
      block({ selector: "#toast", overlay: true, zIndex: 10 }),
      block({ selector: "#modal", x: 30, y: 5, overlay: true, zIndex: 20 }),
    ], 1280);
    assert.equal(distinct.findings.length, 0);
    assert.equal(distinct.exempted.length, 1);

    const same = findTextCollisions([
      block({ selector: "#p1", overlay: true, zIndex: 0 }),
      block({ selector: "#p2", x: 30, y: 5, overlay: true, zIndex: 0 }),
    ], 1280);
    assert.equal(same.findings.length, 1);
  });

  test("judgeClippedText: clip fails, ellipsis and line-clamp exempt", () => {
    const { findings, exempted } = judgeClippedText([
      { selector: "#cut", text: "long text", clipX: 60, clipY: 0, textOverflow: "clip", lineClamp: "none" },
      { selector: "#ell", text: "long text", clipX: 60, clipY: 0, textOverflow: "ellipsis", lineClamp: "none" },
      { selector: "#clamp", text: "long text", clipX: 0, clipY: 40, textOverflow: "clip", lineClamp: "2" },
    ], 1280);
    assert.deepEqual(findings.map((f) => f.selector), ["#cut"]);
    assert.equal(exempted.length, 2);
  });

  test("judgeCollapsedContainers: in-flow fail, anchor and overflow-hidden exempt", () => {
    const { findings, exempted } = judgeCollapsedContainers([
      { selector: "#float-bug", height: 0, tallestChild: 120, anyInFlowChild: true, overflowHidden: false },
      { selector: "#anchor", height: 0, tallestChild: 90, anyInFlowChild: false, overflowHidden: false },
      { selector: "#accordion", height: 0, tallestChild: 200, anyInFlowChild: true, overflowHidden: true },
    ], 1280);
    assert.deepEqual(findings.map((f) => f.selector), ["#float-bug"]);
    assert.equal(exempted.length, 2);
  });

  test("judgeUnstyled: all-failed is fail, UA fingerprint is warn, bare page is null", () => {
    const base = { declaredStylesheets: 1, loadedStylesheets: 1, styleElements: 0, inlineStyleAttrs: 0, uaFont: false, uaMargin: false, uaLinkColor: false as boolean | null };
    assert.equal(judgeUnstyled({ ...base, loadedStylesheets: 0 }, 1280)?.severity, "fail");
    assert.equal(judgeUnstyled({ ...base, uaFont: true, uaMargin: true, uaLinkColor: true }, 1280)?.severity, "warn");
    assert.equal(judgeUnstyled({ ...base, declaredStylesheets: 0 }, 1280), null);
    assert.equal(judgeUnstyled({ ...base }, 1280), null);
  });

  test("judgeNetworkFailures: stylesheet/script fail, font/xhr warn, other types ignored", () => {
    const findings = judgeNetworkFailures([
      { url: "file:///x/app.css", resourceType: "stylesheet", reason: "net::ERR_FILE_NOT_FOUND" },
      { url: "file:///x/app.js", resourceType: "script", reason: "net::ERR_FILE_NOT_FOUND" },
      { url: "file:///x/a.woff2", resourceType: "font", reason: "HTTP 404" },
      { url: "https://x/api", resourceType: "xhr", reason: "HTTP 500" },
      { url: "file:///x/other", resourceType: "other", reason: "x" },
    ], 1280);
    assert.deepEqual(findings.map((f) => `${f.kind}:${f.severity}`),
      ["failed-stylesheet:fail", "js-error:fail", "broken-font:warn", "js-error:warn"]);
  });

  test("judgeRender: blank fails, invisible text fails, text-only page is NOT degenerate", () => {
    assert.equal(judgeRender({ componentCount: 0, inkRatio: 0, textBlocks: 0 }, 1280)?.severity, "fail");
    assert.equal(judgeRender({ componentCount: 0, inkRatio: 0.0002, textBlocks: 12 }, 1280)?.severity, "fail");
    assert.equal(judgeRender({ componentCount: 0, inkRatio: 0.03, textBlocks: 12 }, 1280), null);
    assert.equal(judgeRender({ componentCount: 6, inkRatio: 0.2, textBlocks: 20 }, 1280), null);
  });

  test("measureInkRatio: quarter-filled buffer measures ~0.25", () => {
    const w = 40, h = 40;
    const data = new Uint8Array(w * h * 4).fill(255);
    for (let y = 0; y < 20; y++) {
      for (let x = 0; x < 20; x++) {
        const i = (y * w + x) * 4;
        data[i] = 20; data[i + 1] = 20; data[i + 2] = 20;
      }
    }
    const ratio = measureInkRatio(data, w, h);
    assert.ok(Math.abs(ratio - 0.25) < 0.01, `ratio ${ratio}`);
  });
});

// ---------------------------------------------------------------------------
// S14b — mutation battery (browser)

describe("S14b mutation battery", () => {
  test("M1 construction throw on a blank body: js-error fail + degenerate-render fail", { timeout: 120_000 }, async () => {
    const file = page("m1.html", `<script>
      throw new Error("init exploded");
      // the builder below never runs
      </script>`);
    const report = await runIntegrityCheck({ source: file, viewports: ONE_VIEWPORT });
    assert.equal(report.verdict, "defects");
    const jsError = report.findings.find((f) => f.kind === "js-error");
    assert.equal(jsError?.severity, "fail");
    assert.match(jsError!.message, /before load/);
    assert.ok(kinds(report).includes("degenerate-render"), `got: ${kinds(report)}`);
  });

  test("M2 post-load throw: js-error warn only (initial render survives)", { timeout: 120_000 }, async () => {
    const file = page("m2.html", `<h1>Title</h1><div style="width:600px;height:300px;background:#334">content</div>
      <script>setTimeout(() => { throw new Error("interaction handler dead"); }, 50);</script>`);
    const report = await runIntegrityCheck({ source: file, viewports: ONE_VIEWPORT });
    const jsError = report.findings.find((f) => f.kind === "js-error");
    assert.equal(jsError?.severity, "warn");
    assert.match(jsError!.message, /after load/);
  });

  test("M3 404 image: broken-image fail with src evidence", { timeout: 120_000 }, async () => {
    const file = page("m3.html", `<h1>Gallery</h1><img id="hero" src="./does-not-exist.png" alt="hero" width="400" height="200">
      <div style="width:600px;height:200px;background:#586">filler</div>`);
    const report = await runIntegrityCheck({ source: file, viewports: ONE_VIEWPORT });
    const broken = report.findings.find((f) => f.kind === "broken-image");
    assert.equal(broken?.severity, "fail");
    assert.equal(broken?.selector, "#hero");
    assert.match(String(broken?.evidence?.src), /does-not-exist/);
  });

  test("M4 same-layer text collision (negative margin + absolute same z): text-collision fail", { timeout: 120_000 }, async () => {
    const file = page("m4.html", `
      <div id="first" style="width:300px;line-height:20px">The first paragraph of body copy sits here.</div>
      <div id="second" style="width:300px;line-height:20px;margin-top:-14px">The second paragraph got pulled up over it.</div>
      <div style="position:relative;height:120px;width:400px;background:#eee">
        <span id="abs1" style="position:absolute;left:10px;top:10px">Overlapping label one</span>
        <span id="abs2" style="position:absolute;left:24px;top:14px">Overlapping label two</span>
      </div>
      <div style="width:600px;height:150px;background:#456"></div>`);
    const report = await runIntegrityCheck({ source: file, viewports: ONE_VIEWPORT });
    const collisions = report.findings.filter((f) => f.kind === "text-collision");
    assert.ok(collisions.length >= 2, `expected both pairs, got ${JSON.stringify(collisions.map((c) => c.selector))}`);
    assert.ok(collisions.some((c) => c.selector?.includes("#first") && c.selector?.includes("#second")));
    assert.ok(collisions.some((c) => c.selector?.includes("#abs1") && c.selector?.includes("#abs2")));
  });

  test("M5 40px box clipping text: text-clipped fail, no duplicate clipped-content row", { timeout: 120_000 }, async () => {
    const file = page("m5.html", `<div id="tight" style="width:40px;height:20px;overflow:hidden;white-space:nowrap">A headline far too long for this box</div>
      <div style="width:600px;height:200px;background:#654"></div>`);
    const report = await runIntegrityCheck({ source: file, viewports: ONE_VIEWPORT });
    const clipped = report.findings.filter((f) => f.selector === "#tight");
    assert.equal(clipped.length, 1, `expected exactly one finding for #tight, got ${JSON.stringify(clipped.map((c) => c.kind))}`);
    assert.equal(clipped[0]!.kind, "text-clipped");
    assert.equal(clipped[0]!.severity, "fail");
  });

  test("M6 uncleared floats: collapsed-container fail", { timeout: 120_000 }, async () => {
    const file = page("m6.html", `
      <div id="cards">
        <div style="float:left;width:200px;height:120px;background:#a33">card A</div>
        <div style="float:left;width:200px;height:120px;background:#3a3">card B</div>
      </div>
      <p style="clear:none">Text that the floats paint over.</p>`);
    const report = await runIntegrityCheck({ source: file, viewports: ONE_VIEWPORT });
    const collapsed = report.findings.find((f) => f.kind === "collapsed-container");
    assert.equal(collapsed?.severity, "fail");
    assert.equal(collapsed?.selector, "#cards");
  });

  test("M7 fixed 1500px element: page-overflow-x fail", { timeout: 120_000 }, async () => {
    const file = page("m7.html", `<h1>Wide</h1><div style="width:1500px;height:80px;background:#279">too wide</div>`);
    const report = await runIntegrityCheck({ source: file, viewports: ONE_VIEWPORT });
    const overflow = report.findings.find((f) => f.kind === "page-overflow-x");
    assert.equal(overflow?.severity, "fail");
  });

  test("M8 404 stylesheet with no fallback: failed-stylesheet + unstyled-page fail", { timeout: 120_000 }, async () => {
    const file = page("m8.html", `<h1>Heading</h1><p>Body text long enough to paint.</p><a href="#x">a link</a>`,
      `<link rel="stylesheet" href="./missing.css">`);
    const report = await runIntegrityCheck({ source: file, viewports: ONE_VIEWPORT });
    assert.ok(kinds(report).includes("failed-stylesheet"), `got: ${kinds(report)}`);
    const unstyled = report.findings.find((f) => f.kind === "unstyled-page");
    assert.equal(unstyled?.severity, "fail");
  });

  test("M9 375-only overflow: finding attributed to the 375 viewport", { timeout: 180_000 }, async () => {
    const file = page("m9.html", `<h1>Responsive-ish</h1>
      <div style="width:700px;height:100px;background:#933">fixed-width band</div>`);
    const report = await runIntegrityCheck({
      source: file,
      viewports: [{ width: 1280, height: 800 }, { width: 375, height: 700 }],
    });
    const overflow = report.findings.find((f) => f.kind === "page-overflow-x");
    assert.equal(overflow?.viewport, 375);
    assert.equal(report.viewports.length, 2);
  });
});

// ---------------------------------------------------------------------------
// S14c — false-positive audit (intentional patterns must stay clean)

describe("S14c false-positive audit", () => {
  test("intentional patterns: verdict clean, candidates visible in exempted", { timeout: 120_000 }, async () => {
    const file = page("clean.html", `
      <section id="hero" style="position:relative;width:900px;height:300px;background:linear-gradient(#345,#123)">
        <p id="flow-caption" style="padding-top:120px;text-align:center;color:#89a">A subtitle sitting in normal flow</p>
        <h1 id="hero-title" style="position:absolute;left:0;right:0;top:100px;z-index:2;text-align:center;color:#fff">Hero title layered over the caption</h1>
        <span aria-hidden="true" style="position:absolute;left:0;right:0;top:104px;text-align:center;color:rgba(255,255,255,.15);font-size:40px">DECOR</span>
      </section>
      <div id="truncated" style="width:160px;overflow:hidden;white-space:nowrap;text-overflow:ellipsis">An intentionally truncated long product name</div>
      <div id="anchor" style="position:relative;height:0">
        <div style="position:absolute;top:8px;left:8px;width:120px;height:60px;background:#fed;border:1px solid #ca8">tooltip</div>
      </div>
      <div style="margin-top:90px;width:600px;height:180px;background:#464">content block</div>
      <p>Regular closing copy with <a href="#top">a link</a>.</p>`,
      `<style>body{font-family:system-ui,sans-serif;margin:0;padding:16px}</style>`);
    const report = await runIntegrityCheck({ source: file, viewports: ONE_VIEWPORT });
    assert.equal(report.verdict, "clean",
      `expected clean, findings: ${JSON.stringify(report.findings.map((f) => `${f.kind} ${f.selector ?? ""}`))}`);
    const reasons = report.exempted.map((e) => e.reason).join(" | ");
    assert.match(reasons, /overlay|aria-hidden/, "hero overlay pattern recorded as exempted");
    assert.match(reasons, /ellipsis/, "ellipsis truncation recorded as exempted");
    assert.match(reasons, /anchor/, "zero-height positioning anchor recorded as exempted");
  });

  test("clean multi-viewport run stays clean and reports per-viewport stats", { timeout: 180_000 }, async () => {
    const file = page("clean-mv.html", `
      <header style="max-width:100%;padding:24px;background:#234;color:#fff"><h1>Site</h1></header>
      <main style="max-width:100%;padding:24px">
        <p>Body copy that wraps normally at any width.</p>
        <div style="max-width:100%;height:160px;background:#487"></div>
      </main>`,
      `<style>*{box-sizing:border-box}body{margin:0;font-family:system-ui,sans-serif}</style>`);
    const report = await runIntegrityCheck({ source: file });
    assert.equal(report.verdict, "clean",
      `findings: ${JSON.stringify(report.findings.map((f) => `${f.kind} ${f.selector ?? ""} @${f.viewport}`))}`);
    assert.deepEqual(report.viewports.map((v) => v.width), [1280, 768, 375]);
    assert.ok(report.viewports.every((v) => v.components > 0));
  });
});
