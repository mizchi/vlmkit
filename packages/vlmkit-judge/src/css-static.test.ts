import assert from "node:assert/strict";
import { describe, it } from "vite-plus/test";
import type { CssCheckFinding } from "./css-check.ts";
import { locateLine, mergeStaticFindings, staticRule, type SheetSpan, type StaticWarning } from "./css-static.ts";

const sheets: SheetSpan[] = [
  { sheet: "intact.css", firstFileLine: 1, lines: 5 },
  { sheet: "<style> in page.html", firstFileLine: 9, lines: 10 },
];

describe("css-static: veriss's findings in check css", () => {
  it("which veriss codes check css reports, and as which rule", () => {
    assert.equal(staticRule("W_CSS_COLOR_INVALID"), "static-css");
    assert.equal(staticRule("W_HTML_RESTRUCTURED"), "static-css");
    assert.equal(staticRule("W_CSS_MEDIA_NEVER"), "static-css");
    assert.equal(staticRule("W_LAYOUT_DECLARATION_INERT"), "inert-declaration");
    // A shorthand and its longhand in one rule is how hand-written CSS overrides one side: not reported.
    assert.equal(staticRule("W_CSS_SHORTHAND_CONFLICT"), null);
    // Layout and accessibility are other gates' questions.
    assert.equal(staticRule("E_LAYOUT_PAGE_OVERFLOW"), null);
    assert.equal(staticRule("W_A11Y_HEADING_ORDER"), null);
  });

  it("a line of the joined CSS is put back in its sheet", () => {
    assert.deepEqual(locateLine(3, sheets), { sheet: "intact.css", line: 3 });
    // Joined with one newline: line 6 is the second sheet's first line, which sits at line 9 of page.html.
    assert.deepEqual(locateLine(6, sheets), { sheet: "<style> in page.html", line: 9 });
    assert.deepEqual(locateLine(13, sheets), { sheet: "<style> in page.html", line: 16 });
    assert.equal(locateLine(99, sheets), null);
  });

  const w = (over: Partial<StaticWarning>): StaticWarning => ({
    code: "W_CSS_COLOR_INVALID",
    message: ".button { color: #12345 }: not a valid color",
    selector: ".button",
    property: "color",
    line: 13,
    ...over,
  });
  const own = (over: Partial<CssCheckFinding>): CssCheckFinding => ({
    rule: "dropped-declaration",
    severity: "suspect",
    selector: ".button",
    property: "color",
    sheet: "<style> in page.html",
    line: 16,
    message: ".button `color: #12345` is ignored",
    ...over,
  });

  it("a veriss finding on a declaration the browser also judged is one finding, the browser's, saying both agree", () => {
    const out = mergeStaticFindings([own({})], [w({})], sheets);
    assert.equal(out.length, 1);
    assert.equal(out[0]!.rule, "dropped-declaration");
    assert.match(out[0]!.message, /veriss agrees \(W_CSS_COLOR_INVALID\)/);
  });

  it("a veriss finding of its own is static-css (warn), located in its sheet, with its code", () => {
    const [f] = mergeStaticFindings(
      [],
      [
        w({
          code: "W_CSS_MEDIA_NEVER",
          property: undefined,
          selector: undefined,
          message: "@media … matches no viewport",
          line: 2,
        }),
      ],
      sheets,
    );
    assert.equal(f!.rule, "static-css");
    assert.equal(f!.severity, "warn");
    assert.equal(f!.sheet, "intact.css");
    assert.equal(f!.line, 2);
    assert.match(f!.message, /^\[W_CSS_MEDIA_NEVER\] @media/);
    assert.match(f!.message, /\(intact\.css:2\)/);
  });

  it("veriss's inert declarations join the browser's inert-declaration, once per declaration", () => {
    const inertOwn = own({
      rule: "inert-declaration",
      severity: "warn",
      property: "top",
      selector: ".note",
      message: ".note `top: 4px` does nothing",
    });
    const inertStatic = w({
      code: "W_LAYOUT_DECLARATION_INERT",
      property: "top",
      selector: ".note",
      message: ".note: top has no effect",
    });
    assert.equal(mergeStaticFindings([inertOwn], [inertStatic], sheets).length, 1);
    const [f] = mergeStaticFindings(
      [],
      [w({ code: "W_LAYOUT_DECLARATION_INERT", property: "right", message: "input: right: 0 has no effect" })],
      sheets,
    );
    assert.equal(f!.rule, "inert-declaration");
    assert.equal(f!.severity, "warn");
    // The same declaration on several elements is reported once.
    assert.equal(
      mergeStaticFindings(
        [],
        [w({ code: "W_LAYOUT_DECLARATION_INERT" }), w({ code: "W_LAYOUT_DECLARATION_INERT", message: "another box" })],
        sheets,
      ).length,
      1,
    );
  });
});
