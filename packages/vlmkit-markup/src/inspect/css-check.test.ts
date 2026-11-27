/**
 * `vlmkit check css` on fixtures/css-check/: the intact page (a linked file: stylesheet the
 * CSSOM cannot read, var(), color-mix(), range-syntax media) is silent, and each mutant
 * (`build.mjs`) is named by the one rule its defect is about.
 */
import assert from "node:assert/strict";
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
});
