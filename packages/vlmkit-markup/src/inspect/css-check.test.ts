/**
 * `vlmkit check css` on fixtures/css-check/: the intact page (a linked file: stylesheet the
 * CSSOM cannot read, var(), color-mix(), range-syntax media) is silent, and each mutant
 * (`build.mjs`) is named by the one rule its defect is about.
 */
import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, it } from "vite-plus/test";
import { runCssCheck } from "./css-check.ts";

const dir = join(import.meta.dirname, "../../../../fixtures/css-check");
const run = (name: string) => runCssCheck({ source: join(dir, `${name}.html`) });
const T = { timeout: 120_000 };

describe("check css on fixtures/css-check", () => {
  it("the intact page says nothing, and its linked sheet was read", T, async () => {
    const r = await run("intact");
    assert.deepEqual(r.findings, [], JSON.stringify(r.findings, null, 2));
    assert.ok(r.inspected.elements > 5, JSON.stringify(r.inspected));
    assert.ok(r.inspected.media >= 4, `media read: ${r.inspected.media}`);
    assert.ok(r.inspected.sheets >= 2, `sheets read: ${r.inspected.sheets}`);
  });

  it("dropped-declaration: each declaration the browser threw away, once, with its line", T, async () => {
    const r = await run("dropped-declaration");
    assert.deepEqual([...new Set(r.findings.map((f) => f.rule))], ["dropped-declaration"]);
    const said = r.findings.map((f) => f.message).join("\n");
    for (const d of ["width: calc(100%-10px)", "color: #12345", "margin-top: 4", "colr: #374151"])
      assert.ok(said.includes(d), `${d} in\n${said}`);
    assert.equal(r.findings.length, 4, said);
    assert.match(said, /did you mean `color`/);
    for (const f of r.findings) assert.ok(f.line !== undefined && f.line > 10, JSON.stringify(f));
  });

  for (const rule of ["unknown-media-feature", "vendor-declaration-dropped", "inert-declaration"] as const)
    it(`${rule}: that rule and nothing else`, T, async () => {
      const r = await run(rule);
      assert.ok(r.findings.length > 0, JSON.stringify(r, null, 2));
      assert.deepEqual([...new Set(r.findings.map((f) => f.rule))], [rule], JSON.stringify(r.findings, null, 2));
    });

  it("inert-declaration: each declaration that does nothing where it is, confirmed by removing it", T, async () => {
    const r = await run("inert-declaration");
    assert.deepEqual(
      [...new Set(r.findings.map((f) => f.rule))],
      ["inert-declaration"],
      JSON.stringify(r.findings, null, 2),
    );
    const said = r.findings.map((f) => f.message).join("\n");
    for (const d of ["top: 4px", "flex: 1", "background-size: cover", "justify-content: center"])
      assert.ok(said.includes(d), `${d} in\n${said}`);
    assert.equal(r.findings.length, 4, said);
    assert.match(said, /position: static/);
    assert.match(said, /not a flex item/);
  });

  it("never-matching-media is veriss's now: static-css, W_CSS_MEDIA_NEVER, in its sheet", T, async () => {
    const r = await run("never-matching-media");
    assert.ok(!("skipped" in r.static), JSON.stringify(r.static));
    assert.deepEqual([...new Set(r.findings.map((f) => f.rule))], ["static-css"], JSON.stringify(r.findings, null, 2));
    assert.match(r.findings[0]!.message, /^\[W_CSS_MEDIA_NEVER\]/);
    assert.match(r.findings[0]!.message, /never-matching-media\.html:\d+/);
  });

  it("where veriss and the browser judged one declaration, it is one finding saying both agree", T, async () => {
    const r = await run("dropped-declaration");
    const said = r.findings.map((f) => f.message).join("\n");
    assert.equal(r.findings.length, 4, said);
    // calc(), the hex colour and the unitless length: veriss knows those grammars. The misspelt property: only the browser.
    assert.equal(r.findings.filter((f) => /veriss agrees/.test(f.message)).length, 3, said);
    assert.doesNotMatch(r.findings.find((f) => f.message.includes("colr"))!.message, /veriss agrees/);
  });

  it("a typo in a media feature is named with the feature it meant", T, async () => {
    const r = await run("unknown-media-feature");
    assert.match(r.findings[0]!.message, /did you mean `prefers-reduced-motion`/);
  });

  // What veriss is given must be the page the browser laid out: an element left out moves its siblings' positions, and
  // a sheet's media condition left out applies its rules everywhere.
  it("veriss reads the rendered page as it is: sibling positions and each sheet's media kept", T, async () => {
    const dir = mkdtempSync(join(tmpdir(), "css-check-veriss-"));
    const page = (name: string, html: string) => {
      const file = join(dir, `${name}.html`);
      writeFileSync(
        file,
        `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>${name}</title><style>*{margin:0}html,body{display:grid;grid-template-columns:minmax(0,1fr)}.box{position:relative;top:4px;height:20px}</style></head><body>${html}</body></html>`,
      );
      return file;
    };
    const inertTop = async (file: string) =>
      (await runCssCheck({ source: file })).findings
        .filter((f) => f.rule === "inert-declaration")
        .map((f) => f.message);
    // The script stays the first child: .box is not :first-child, so it stays relative and top works. (veriss also
    // says, rightly, that .box:first-child never matches for that reason: static-css, not asserted here.)
    assert.deepEqual(
      await inertTop(
        page(
          "first-child",
          `<script>void 0</script><div class="box"></div><style>.box:first-child{position:static}</style>`,
        ),
      ),
      [],
    );
    // A sheet for a width no viewport has never applies.
    assert.deepEqual(
      await inertTop(
        page("sheet-media", `<div class="box"></div><style media="(max-width: 1px)">.box{position:static}</style>`),
      ),
      [],
    );
    // The control: the same static rule with no condition is inert, and veriss says so too (it was given the height).
    const control = (
      await runCssCheck({ source: page("control", `<div class="box"></div><style>.box{position:static}</style>`) })
    ).findings;
    assert.ok(
      control.some(
        (f) => f.rule === "inert-declaration" && /veriss agrees \(W_LAYOUT_DECLARATION_INERT\)/.test(f.message),
      ),
      JSON.stringify(control),
    );
  });

  // The browser knows each loaded image's natural size; veriss is given it (`images`), so an img sized by its file's
  // ratio is decided instead of Unknown (veriss trusts width/height attributes only under trustImageAttributes).
  it("veriss gets the natural size of every image the page loaded", T, async () => {
    const dir = mkdtempSync(join(tmpdir(), "css-check-images-"));
    const square =
      "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==";
    const file = join(dir, "img.html");
    writeFileSync(
      file,
      `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>img</title><style>*{margin:0}html,body{display:grid;grid-template-columns:minmax(0,1fr)}img{display:block;width:120px;height:auto}</style></head><body><img src="${square}" width="120" height="30" alt="a square"></body></html>`,
    );
    const r = await runCssCheck({ source: file });
    assert.ok(!("skipped" in r.static), JSON.stringify(r.static));
    const s = r.static as { unknown: Record<string, number>; images: number };
    assert.equal(s.unknown.U_LAYOUT_IMAGE, undefined, JSON.stringify(s.unknown));
    assert.equal(s.images, 1);
  });
});
