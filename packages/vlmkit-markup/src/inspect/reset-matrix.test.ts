/**
 * `vlmkit check reset` on fixtures/reset-matrix/, in real Chromium, Firefox and WebKit: each defect
 * comes back on exactly the UA × reset branches it lives in, the clean page says nothing in any branch,
 * and veriss's decided branches agree with what the browser drew.
 *
 * The textarea fixture is held on Chromium and Firefox only: WebKit's form controls differ by platform
 * (macOS WebKit gives a textarea padding 2px 5px, which veriss's Linux profile does not model), so its
 * WebKit branches are a property of the machine, not of the page.
 */
import assert from "node:assert/strict";
import { join } from "node:path";
import { describe, it } from "vite-plus/test";
import { resetInitScript, runResetMatrix, type ResetMatrixReport } from "./reset-matrix.ts";

const dir = join(import.meta.dirname, "../../../../fixtures/reset-matrix");
const T = { timeout: 300_000 };
const only = (r: ResetMatrixReport) => r.summary.onlyIn.map((f) => [f.kind, f.selector ?? "", f.summary]);
const veriss = (r: ResetMatrixReport) => {
  assert.ok(!("skipped" in r.veriss), JSON.stringify(r.veriss));
  return (r.veriss as Exclude<ResetMatrixReport["veriss"], { skipped: string }>).comparison;
};

describe("check reset on fixtures/reset-matrix", () => {
  it("list-padding: the UA list padding pushes the chip out unless the reset removes it, in every UA", T, async () => {
    const r = await runResetMatrix({ source: join(dir, "list-padding.html") });
    assert.equal(r.summary.space.measured, 21, JSON.stringify(r.summary.unmeasured));
    assert.deepEqual(r.widths, [1920, 320]);
    assert.deepEqual(only(r), [
      [
        "container-protrusion",
        "div.chip out of li.item",
        "none, modern-normalize, normalize, sanitize, josh-comeau (any UA)",
      ],
    ]);
    // Only at the wide width: on a phone the card is the whole width.
    assert.deepEqual(Object.values(r.summary.onlyIn[0]!.widths)[0], [1920]);
    assert.deepEqual(r.summary.holdsEverywhere, []);
    const c = veriss(r);
    assert.deepEqual([c.pairs, c.decided, c.agreedPairs, c.disagreements.length], [42, 42, 42, 0]);
    assert.equal(c.compared, 15);
    assert.deepEqual(
      r.findings.map((f) => [f.rule, f.severity]),
      [["branch-defect", "suspect"]],
    );
  });

  it("textarea-border: Firefox's 2px textarea border overflows the page without a box-sizing reset", T, async () => {
    const r = await runResetMatrix({ source: join(dir, "textarea-border.html"), uas: ["chromium", "firefox"] });
    assert.deepEqual(only(r), [["page-overflow-x", "textarea.note", "firefox × none, normalize"]]);
    const c = veriss(r);
    assert.deepEqual(c.disagreements, []);
    // veriss claims firefox × none and is right; normalize and destyle are Unknown for it (overflow: auto).
    assert.deepEqual(c.perBranch["firefox:none"], { pairs: 1, decided: 1, agreedPairs: 1, compared: 1, agreed: 1 });
    assert.equal(c.perBranch["firefox:normalize"]!.decided, 0);
  });

  it("heading-margin: the UA margins push the card's text out unless the reset zeroes them", T, async () => {
    const r = await runResetMatrix({ source: join(dir, "heading-margin.html") });
    assert.deepEqual(only(r), [
      ["container-protrusion", "p.meta out of article.card", "none, modern-normalize, normalize, sanitize (any UA)"],
    ]);
  });

  it("clean: nothing in any branch", T, async () => {
    const r = await runResetMatrix({ source: join(dir, "clean.html") });
    assert.equal(r.summary.space.measured, 21);
    assert.deepEqual(r.findings, [], JSON.stringify(r.findings, null, 2));
  });

  it("the reset is the document's first stylesheet before the page's own, in every engine", T, async () => {
    const { BROWSER_ENGINES } = await import("@mizchi/vlmkit-core/browser-launch.ts");
    for (const engine of ["chromium", "firefox", "webkit"] as const) {
      const browser = await BROWSER_ENGINES[engine].launch();
      try {
        const page = await browser.newPage();
        await page.addInitScript(resetInitScript("li { padding: 7px }"));
        await page.goto(`file://${join(dir, "list-padding.html")}`);
        const got = await page.evaluate(() => [
          document.styleSheets.length,
          (document.styleSheets[0]!.ownerNode as Element).hasAttribute("data-vlmkit-reset"),
          getComputedStyle(document.querySelector("li")!).paddingTop,
        ]);
        assert.deepEqual(got, [2, true, "7px"], engine);
      } finally {
        await browser.close();
      }
    }
  });
});
