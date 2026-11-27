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

  for (const rule of ["unknown-media-feature", "never-matching-media", "vendor-declaration-dropped"] as const)
    it(`${rule}: that rule and nothing else`, T, async () => {
      const r = await run(rule);
      assert.ok(r.findings.length > 0, JSON.stringify(r, null, 2));
      assert.deepEqual([...new Set(r.findings.map((f) => f.rule))], [rule], JSON.stringify(r.findings, null, 2));
    });

  it("a typo in a media feature is named with the feature it meant", T, async () => {
    const r = await run("unknown-media-feature");
    assert.match(r.findings[0]!.message, /did you mean `prefers-reduced-motion`/);
  });
});
