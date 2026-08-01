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
  judgeAlignment,
  judgeClippedText,
  judgeCollapsedContainers,
  judgeNetworkFailures,
  judgeProtrusions,
  judgeRender,
  judgeTextContrast,
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
    const visible = { textVisibleArea: 800, srOnlyShaped: false, replacement: false };
    const { findings, exempted } = judgeClippedText([
      { selector: "#cut", text: "long text", clipX: 60, clipY: 0, textOverflow: "clip", lineClamp: "none", ...visible },
      { selector: "#ell", text: "long text", clipX: 60, clipY: 0, textOverflow: "ellipsis", lineClamp: "none", ...visible },
      { selector: "#clamp", text: "long text", clipX: 0, clipY: 40, textOverflow: "clip", lineClamp: "2", ...visible },
    ], 1280);
    assert.deepEqual(findings.map((f) => f.selector), ["#cut"]);
    assert.equal(exempted.length, 2);
  });

  test("judgeClippedText: fully-hidden text — image replacement / sr-only exempt, no-signal warns (csszengarden dogfood)", () => {
    const hidden = { clipX: 0, clipY: 20, textOverflow: "clip", lineClamp: "none", textVisibleArea: 0 };
    const { findings, exempted } = judgeClippedText([
      { selector: "#kellum", text: "HTML", ...hidden, srOnlyShaped: false, replacement: true },
      { selector: "#sr", text: "Skip to content", ...hidden, srOnlyShaped: true, replacement: false },
      { selector: "#accident", text: "gone", ...hidden, srOnlyShaped: false, replacement: false },
      { selector: "#partial", text: "partially cut", clipX: 60, clipY: 0, textOverflow: "clip", lineClamp: "none", textVisibleArea: 500, srOnlyShaped: false, replacement: true },
    ], 1280);
    assert.equal(exempted.length, 2);
    assert.match(exempted[0]!.reason, /image replacement/);
    assert.match(exempted[1]!.reason, /sr-only/);
    assert.deepEqual(findings.map((f) => `${f.selector}:${f.severity}`), ["#accident:warn", "#partial:fail"]);
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

  test("judgeUnstyled: all declared stylesheets failed is fail; loaded or bare pages are null", () => {
    const base = { declaredStylesheets: 1, loadedStylesheets: 1, styleElements: 0, inlineStyleAttrs: 0 };
    assert.equal(judgeUnstyled({ ...base, loadedStylesheets: 0 }, 1280)?.severity, "fail");
    assert.equal(judgeUnstyled({ ...base, loadedStylesheets: 0, styleElements: 1 }, 1280), null); // <style> fallback exists
    assert.equal(judgeUnstyled({ ...base, declaredStylesheets: 0 }, 1280), null); // intentionally bare
    assert.equal(judgeUnstyled({ ...base }, 1280), null);
  });

  test("judgeNetworkFailures: same-origin stylesheet/script fail, cross-origin (third-party) warn, font/xhr warn", () => {
    const findings = judgeNetworkFailures([
      { url: "file:///x/app.css", resourceType: "stylesheet", reason: "net::ERR_FILE_NOT_FOUND" },
      { url: "file:///x/app.js", resourceType: "script", reason: "net::ERR_FILE_NOT_FOUND" },
      { url: "https://cdn.example/beacon.min.js", resourceType: "script", reason: "net::ERR_CONNECTION_RESET", crossOrigin: true },
      { url: "https://fonts.example/x.css", resourceType: "stylesheet", reason: "HTTP 404", crossOrigin: true },
      { url: "file:///x/a.woff2", resourceType: "font", reason: "HTTP 404" },
      { url: "https://x/api", resourceType: "xhr", reason: "HTTP 500" },
      { url: "file:///x/other", resourceType: "other", reason: "x" },
    ], 1280);
    assert.deepEqual(findings.map((f) => `${f.kind}:${f.severity}`),
      ["failed-stylesheet:fail", "js-error:fail", "js-error:warn", "failed-stylesheet:warn", "broken-font:warn", "js-error:warn"]);
    assert.match(findings[2]!.message, /Third-party/);
  });

  test("judgeRender: blank fails, invisible text fails, text-only page is NOT degenerate", () => {
    assert.equal(judgeRender({ componentCount: 0, inkRatio: 0, textBlocks: 0 }, 1280)?.severity, "fail");
    assert.equal(judgeRender({ componentCount: 0, inkRatio: 0.0002, textBlocks: 12 }, 1280)?.severity, "fail");
    assert.equal(judgeRender({ componentCount: 0, inkRatio: 0.03, textBlocks: 12 }, 1280), null);
    assert.equal(judgeRender({ componentCount: 6, inkRatio: 0.2, textBlocks: 20 }, 1280), null);
  });

  test("judgeProtrusions: in-flow fail, positioned badge and horizontal breakout exempt", () => {
    const { findings, exempted } = judgeProtrusions([
      { parent: ".card", child: "#wide-btn", amount: 40, positioned: false, negBreakout: false, axis: "horizontal" },
      { parent: ".card", child: "#badge", amount: 8, positioned: true, negBreakout: false, axis: "horizontal" },
      { parent: "article", child: "#bleed-img", amount: 24, positioned: false, negBreakout: true, axis: "horizontal" },
      { parent: ".note", child: "(text)", amount: 60, positioned: false, negBreakout: false, axis: "horizontal" },
    ], 1280);
    assert.deepEqual(findings.map((f) => f.selector), ["#wide-btn out of .card", "(text) out of .note"]);
    assert.ok(findings.every((f) => f.severity === "fail"));
    assert.equal(exempted.length, 2);
    assert.match(exempted[0]!.reason, /positioned overlay/);
    assert.match(exempted[1]!.reason, /breakout/);
  });

  test("judgeTextContrast: invisible fail, low-contrast warn, disabled/shadow exempt, composite skip visible", () => {
    const base = { text: "hello", fg: "rgb(255, 255, 255)", bg: "rgb(255, 255, 255)", disabled: false, shadowed: false };
    const { findings, exempted } = judgeTextContrast([
      { ...base, selector: "#ghost", ratio: 1.0 },
      { ...base, selector: "#dim", ratio: 2.4, fg: "rgb(150, 150, 150)" },
      { ...base, selector: "#off", ratio: 1.2, disabled: true },
      { ...base, selector: "#shadow", ratio: 1.1, shadowed: true },
    ], 5, 1280);
    assert.deepEqual(findings.map((f) => `${f.kind}:${f.severity}`), ["invisible-text:fail", "low-contrast-text:warn"]);
    assert.equal(exempted.length, 3); // disabled + shadowed + composite aggregate
    assert.match(exempted[2]!.reason, /5 text block\(s\) skipped/);
  });

  test("judgeAlignment: 2-8px deviant flagged, exact and clearly-offset silent, other-axis alignment exempt", () => {
    const child = (selector: string, left: number, top: number, width = 100) =>
      ({ selector, left, right: left + width, centerX: left + width / 2, top });
    // #c is 4px off a shared left edge -> flagged.
    const flagged = judgeAlignment([{ parent: "#stack", children: [child("#a", 20, 0), child("#b", 20, 40), child("#c", 24, 80)] }], 1280);
    assert.equal(flagged.length, 1);
    assert.equal(flagged[0]!.selector, "#c");
    assert.equal(flagged[0]!.severity, "warn");
    // Deliberate stagger (>8px) and exact alignment: silent.
    assert.equal(judgeAlignment([{ parent: "#s", children: [child("#a", 20, 0), child("#b", 60, 40), child("#c", 100, 80)] }], 1280).length, 0);
    assert.equal(judgeAlignment([{ parent: "#s", children: [child("#a", 20, 0), child("#b", 20, 40), child("#c", 20, 80)] }], 1280).length, 0);
    // Centered item in a left-aligned stack: off the left edge by 5px but
    // exactly on the shared center line -> intentional, silent.
    const centered = judgeAlignment([{
      parent: "#mix",
      children: [child("#a", 20, 0, 100), child("#b", 20, 40, 100), child("#c", 25, 80, 90)],
    }], 1280);
    assert.equal(centered.length, 0, JSON.stringify(centered));
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

  // 2026-08-01 hard-target audit: in a grid shell, one rigid child
  // stretches the track, so every stretched ancestor and sibling outranks
  // the culprit by right edge. The kickback named the sidebar and the page
  // shell — three selectors, none of them the thing to edit. The cause is
  // now measured (constrain the element, re-read scrollWidth) rather than
  // guessed from box geometry.
  test("M7b grid shell: overflow blames the rigid child, not the stretched shell", { timeout: 120_000 }, async () => {
    const file = page("m7b.html", `
      <div class="shell" style="display:grid;grid-template-columns:200px 1fr">
        <nav class="side"><strong>Nav</strong></nav>
        <main class="main" style="padding:20px">
          <h1>Report</h1>
          <p class="lede">Body copy that stretches to whatever the track allows.</p>
          <div class="rigid" style="width:900px;background:#eef">fixed 900px wide</div>
        </main>
      </div>`);
    const report = await runIntegrityCheck({ source: file, viewports: [{ width: 375, height: 700 }] });
    const overflow = report.findings.find((f) => f.kind === "page-overflow-x");
    assert.equal(overflow?.severity, "fail");
    assert.match(overflow!.message, /caused by:/);
    assert.match(overflow!.message, /\.rigid/);
    // The stretched shell must not be presented as the thing to fix.
    assert.doesNotMatch(overflow!.message, /caused by:[^.]*nav\.side/);
  });

  test("M8 404 stylesheet with no fallback: failed-stylesheet + unstyled-page fail", { timeout: 120_000 }, async () => {
    const file = page("m8.html", `<h1>Heading</h1><p>Body text long enough to paint.</p><a href="#x">a link</a>`,
      `<link rel="stylesheet" href="./missing.css">`);
    const report = await runIntegrityCheck({ source: file, viewports: ONE_VIEWPORT });
    assert.ok(kinds(report).includes("failed-stylesheet"), `got: ${kinds(report)}`);
    const unstyled = report.findings.find((f) => f.kind === "unstyled-page");
    assert.equal(unstyled?.severity, "fail");
  });

  test("M10 in-flow child wider than its painted card: container-protrusion fail; badge exempt", { timeout: 120_000 }, async () => {
    const file = page("m10.html", `
      <div id="card" style="position:relative;width:300px;border:1px solid #cbd5e1;border-radius:8px;padding:16px;background:#fff">
        <h3>Plan</h3>
        <button id="cta" style="width:400px;display:block">Choose this plan and start today</button>
        <span id="badge" style="position:absolute;top:-10px;right:-10px;background:#4f46e5;color:#fff;padding:2px 8px">New</span>
      </div>
      <div style="width:600px;height:150px;background:#456;margin-top:24px"></div>`);
    const report = await runIntegrityCheck({ source: file, viewports: ONE_VIEWPORT });
    const prot = report.findings.filter((f) => f.kind === "container-protrusion");
    assert.equal(prot.length, 1, JSON.stringify(report.findings.map((f) => `${f.kind} ${f.selector}`)));
    assert.match(prot[0]!.selector!, /#cta out of #card/);
    assert.equal(prot[0]!.severity, "fail");
    const ex = report.exempted.filter((e) => e.kind === "container-protrusion");
    assert.ok(ex.some((e) => e.selector?.includes("#badge") && /positioned overlay/.test(e.reason)), JSON.stringify(ex));
  });

  test("M11 white-on-white text: invisible-text fail; gradient text skipped visibly", { timeout: 120_000 }, async () => {
    const file = page("m11.html", `
      <div style="background:#fff;padding:16px">
        <p id="ghost" style="color:#fefefe">This sentence is invisible to every reader.</p>
        <p id="fine">This one is fine.</p>
      </div>
      <div style="background:linear-gradient(#345,#123);padding:16px">
        <p id="on-gradient" style="color:#89a">Composite background text.</p>
      </div>
      <div style="width:600px;height:150px;background:#456"></div>`);
    const report = await runIntegrityCheck({ source: file, viewports: ONE_VIEWPORT });
    const ghost = report.findings.find((f) => f.selector === "#ghost");
    assert.equal(ghost?.kind, "invisible-text");
    assert.equal(ghost?.severity, "fail");
    assert.ok(report.exempted.some((e) => e.kind === "low-contrast-text" && /skipped/.test(e.reason)),
      "composite-background skip is visible");
    assert.ok(!report.findings.some((f) => f.selector === "#fine" || f.selector === "#on-gradient"));
  });

  test("M12 one card 5px off a shared edge: near-misalignment warn; exact grid silent", { timeout: 120_000 }, async () => {
    const file = page("m12.html", `
      <div id="stack" style="padding:20px">
        <div style="width:300px;height:60px;background:#dbe2ea;margin:0 0 12px 0">Row one</div>
        <div style="width:300px;height:60px;background:#dbe2ea;margin:0 0 12px 0">Row two</div>
        <div id="off" style="width:300px;height:60px;background:#dbe2ea;margin:0 0 12px 5px">Row three</div>
        <div style="width:300px;height:60px;background:#dbe2ea">Row four</div>
      </div>`);
    const report = await runIntegrityCheck({ source: file, viewports: ONE_VIEWPORT });
    const near = report.findings.filter((f) => f.kind === "near-misalignment");
    assert.equal(near.length, 1, JSON.stringify(near.map((f) => f.selector)));
    assert.equal(near[0]!.selector, "#off");
    assert.equal(near[0]!.severity, "warn");
    assert.equal(report.verdict, "clean"); // warn does not flip the verdict
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

  test("image replacement (Kellum, text-indent) and sr-only stay clean; accidental full hide warns", { timeout: 120_000 }, async () => {
    const file = page("replacement.html", `
      <a id="kellum" href="#v" style="display:inline-block;overflow:hidden;width:40px;height:0;padding:40px 0 0 0;background:#c33">HTML</a>
      <a id="indent" href="#n" style="display:block;overflow:hidden;width:70px;height:70px;text-indent:100%;white-space:nowrap;background:url('data:image/gif;base64,R0lGODlhAQABAAAAACw=')">Next Designs</a>
      <span id="sr" style="position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0,0,0,0)">Skip to main content</span>
      <div id="accident" style="width:120px;height:0;overflow:hidden">Text nobody replaced</div>
      <div style="width:600px;height:200px;background:#357">content</div>`,
      `<style>body{font-family:system-ui;margin:0;padding:16px}#kellum::before{content:"\\2605";font-size:32px;color:#fff}</style>`);
    const report = await runIntegrityCheck({ source: file, viewports: ONE_VIEWPORT });
    assert.equal(report.verdict, "clean",
      `findings: ${JSON.stringify(report.findings.map((f) => `${f.kind} ${f.selector ?? ""} ${f.severity}`))}`);
    const reasons = report.exempted.filter((e) => e.kind === "text-clipped").map((e) => `${e.selector}:${e.reason}`);
    assert.ok(reasons.some((r) => r.startsWith("#kellum") && r.includes("image replacement")), reasons.join(" | "));
    assert.ok(reasons.some((r) => r.startsWith("#indent") && r.includes("image replacement")), reasons.join(" | "));
    assert.ok(reasons.some((r) => r.startsWith("#sr") && r.includes("sr-only")), reasons.join(" | "));
    const accident = report.findings.find((f) => f.selector === "#accident");
    assert.equal(accident?.severity, "warn");
    assert.match(accident!.message, /no replacement signal/);
  });

  test("M13 opacity:0 ancestor makes descendant text invisible-text (Codex #100 P1)", { timeout: 120_000 }, async () => {
    const file = page("m13.html", `
      <div style="opacity:0;background:#fff;padding:16px">
        <p id="vanished" style="color:#111">Readable color, invisible ancestor.</p>
      </div>
      <p id="fine" style="color:#111">Visible control text.</p>
      <div style="width:600px;height:150px;background:#456"></div>`);
    const report = await runIntegrityCheck({ source: file, viewports: ONE_VIEWPORT });
    const gone = report.findings.find((f) => f.selector === "#vanished");
    assert.ok(gone, JSON.stringify(report.findings.map((f) => `${f.kind} ${f.selector}`)));
    assert.equal(gone!.kind, "invisible-text");
    assert.ok(!report.findings.some((f) => f.selector === "#fine"));
  });

  test("failing @import inside a loaded stylesheet is not unstyled-page (Codex #100 P2)", { timeout: 120_000 }, async () => {
    const cssFile = join(DIR, "import-parent.css");
    writeFileSync(cssFile, `@import url("./missing-child.css");\nbody{background:#eef;font-family:system-ui;margin:0;padding:16px}`);
    const file = page("import-fail.html", `
      <p style="color:#123">Styled body copy.</p>
      <div style="width:600px;height:150px;background:#456"></div>`,
      `<link rel="stylesheet" href="./import-parent.css">`);
    const report = await runIntegrityCheck({ source: file, viewports: ONE_VIEWPORT });
    assert.ok(!report.findings.some((f) => f.kind === "unstyled-page"),
      `findings: ${JSON.stringify(report.findings.map((f) => `${f.kind} ${f.selector ?? ""}`))}`);
    assert.ok(report.findings.some((f) => f.kind === "failed-stylesheet" && /missing-child/.test(f.message)),
      `the missing @import child itself is still reported: ${JSON.stringify(report.findings.map((f) => `${f.kind} ${f.message}`))}`);
  });

  test("maxFindings caps text-collision rows (Codex #100 P2)", { timeout: 120_000 }, async () => {
    const rows = Array.from({ length: 5 }, (_, i) =>
      `<p style="position:absolute;top:${20 + i * 40}px;left:20px;width:220px;margin:0">Row ${i} left column text</p>
       <p style="position:absolute;top:${20 + i * 40}px;left:120px;width:220px;margin:0">Row ${i} overlapping right text</p>`).join("");
    const file = page("collision-cap.html", `${rows}<div style="position:absolute;top:260px;width:600px;height:120px;background:#456"></div>`);
    const capped = await runIntegrityCheck({ source: file, viewports: ONE_VIEWPORT, maxFindings: 1 });
    const collisionRows = capped.findings.filter((f) => f.kind === "text-collision" && f.selector !== "(page)");
    assert.equal(collisionRows.length, 1, JSON.stringify(capped.findings.map((f) => `${f.kind} ${f.selector}`)));
    // The overflow is never silent: the cap summary row names the remainder.
    assert.ok(capped.findings.some((f) => f.selector === "(page)" && /beyond the report cap/.test(f.message)));
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

// A13 — occluded text (first demanded by S19: a CSS figure's absolute part
// painted over "Block 0" / enemy HP while every other probe stayed clean).
test("M14 opaque sibling painted over text is occluded-text", { timeout: 120_000 }, async () => {
  const file = page("m14.html", `
    <div style="position:relative;width:600px;height:120px;background:#eee">
      <p id="covered" style="position:absolute;left:20px;top:40px;color:#111">Covered readout text</p>
      <div style="position:absolute;left:0;top:20px;width:280px;height:80px;background:#c94;z-index:2"></div>
      <p id="clear" style="position:absolute;left:320px;top:40px;color:#111">Clear readout text</p>
    </div>
    <div style="width:600px;height:200px;background:#456;margin-top:12px"></div>`);
  const report = await runIntegrityCheck({ source: file, viewports: ONE_VIEWPORT });
  const hit = report.findings.find((f) => f.kind === "occluded-text" && f.selector === "#covered");
  assert.ok(hit, JSON.stringify(report.findings.map((f) => `${f.kind} ${f.selector}`)));
  assert.ok(!report.findings.some((f) => f.selector === "#clear"));
});

// The S19 class plus one declaration: decorative art that paints over text
// but opts out of hit-testing. elementFromPoint skips pointer-events:none,
// so the probe forces hit-testing back on page-wide while sampling.
test("M14a2 pointer-events:none decorative overlay is still occluded-text", { timeout: 120_000 }, async () => {
  const file = page("m14a2.html", `
    <div style="position:relative;width:600px;height:120px;background:#eee">
      <p id="covered" style="position:absolute;left:20px;top:40px;color:#111">Covered readout text</p>
      <div style="position:absolute;left:0;top:20px;width:280px;height:80px;background:#c94;z-index:2;pointer-events:none"></div>
      <p id="clear" style="position:absolute;left:320px;top:40px;color:#111">Clear readout text</p>
    </div>
    <div style="width:600px;height:200px;background:#456;margin-top:12px"></div>`);
  const report = await runIntegrityCheck({ source: file, viewports: ONE_VIEWPORT });
  const hit = report.findings.find((f) => f.kind === "occluded-text" && f.selector === "#covered");
  assert.ok(hit, JSON.stringify(report.findings.map((f) => `${f.kind} ${f.selector}`)));
  assert.ok(!report.findings.some((f) => f.selector === "#clear"));
});

test("M14b transparent stretched-link overlay is NOT occluded-text", { timeout: 120_000 }, async () => {
  const file = page("m14b.html", `
    <div style="position:relative;width:400px;height:140px;background:#fff;border:1px solid #ccc;padding:16px">
      <h2 style="margin:0;color:#111">Card title stays readable</h2>
      <p style="color:#333">Body copy under a full-card link overlay.</p>
      <a href="#x" style="position:absolute;inset:0;z-index:3" aria-label="Open card"></a>
    </div>
    <div style="width:600px;height:200px;background:#456;margin-top:12px"></div>`);
  const report = await runIntegrityCheck({ source: file, viewports: ONE_VIEWPORT });
  assert.ok(!report.findings.some((f) => f.kind === "occluded-text"), JSON.stringify(report.findings));
});

test("M14c fixed bottom bar over scrollable content is exempted, not failed", { timeout: 120_000 }, async () => {
  const file = page("m14c.html", `
    <main style="padding:16px">
      ${Array.from({ length: 30 }, (_, i) => `<p style="color:#222">Paragraph ${i + 1} of scrollable content.</p>`).join("")}
    </main>
    <div style="position:fixed;left:0;right:0;bottom:0;height:64px;background:#14213d;color:#fff;padding:12px">Sticky cart bar</div>`);
  const report = await runIntegrityCheck({ source: file, viewports: ONE_VIEWPORT });
  assert.ok(!report.findings.some((f) => f.kind === "occluded-text"), JSON.stringify(report.findings));
  assert.ok(report.exempted.some((e) => e.kind === "occluded-text" && /viewport-pinned bar/.test(e.reason)));
});

test("M14d aria-hidden decorative text under a figure is exempted", { timeout: 120_000 }, async () => {
  const file = page("m14d.html", `
    <div style="position:relative;width:400px;height:120px;background:#fff">
      <span aria-hidden="true" style="position:absolute;left:10px;top:40px;color:#888">{ }</span>
      <div style="position:absolute;left:0;top:0;width:200px;height:120px;background:#5155d6"></div>
      <p style="position:absolute;left:220px;top:40px;color:#111">Visible label</p>
    </div>
    <div style="width:600px;height:200px;background:#456;margin-top:12px"></div>`);
  const report = await runIntegrityCheck({ source: file, viewports: ONE_VIEWPORT });
  assert.ok(!report.findings.some((f) => f.kind === "occluded-text"), JSON.stringify(report.findings));
  assert.ok(report.exempted.some((e) => e.kind === "occluded-text" && /aria-hidden/.test(e.reason)));
});
