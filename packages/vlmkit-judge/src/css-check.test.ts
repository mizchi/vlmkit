import assert from "node:assert/strict";
import { describe, it } from "vite-plus/test";
import { isVendorDeclaration, judgeCssCheck, nearestMediaFeature, type DeclarationSample } from "./css-check.ts";

const decl = (over: Partial<DeclarationSample>): DeclarationSample => ({
  selector: ".a",
  property: "width",
  value: "100",
  sheet: "site.css",
  line: 3,
  propertyKnown: true,
  elements: 1,
  ...over,
});

describe("css-check judge", () => {
  it("a declaration the browser dropped is dropped-declaration, a known property with a bad value", () => {
    const [f, ...rest] = judgeCssCheck({ declarations: [decl({})], media: [] });
    assert.equal(rest.length, 0);
    assert.equal(f!.rule, "dropped-declaration");
    assert.equal(f!.severity, "suspect");
    assert.match(f!.message, /width: 100/);
    assert.match(f!.message, /site\.css:3/);
    assert.match(f!.message, /value/);
  });

  it("an unknown property says so, with the nearest known one", () => {
    const [f] = judgeCssCheck({
      declarations: [decl({ property: "colr", value: "red", propertyKnown: false, suggest: "color" })],
      media: [],
    });
    assert.equal(f!.rule, "dropped-declaration");
    assert.match(f!.message, /unknown property/);
    assert.match(f!.message, /`color`/);
  });

  it("a vendor-prefixed declaration Chromium does not know is info, not a defect", () => {
    assert.equal(isVendorDeclaration("-moz-appearance", "none"), true);
    assert.equal(isVendorDeclaration("display", "-moz-box"), true);
    assert.equal(isVendorDeclaration("display", "flexbox"), false);
    const [f] = judgeCssCheck({
      declarations: [decl({ property: "-moz-osx-font-smoothing", value: "grayscale", propertyKnown: false })],
      media: [],
    });
    assert.equal(f!.rule, "vendor-declaration-dropped");
    assert.equal(f!.severity, "info");
  });

  it("an @media whose feature the browser does not know never matches", () => {
    const [f] = judgeCssCheck({
      declarations: [],
      media: [
        {
          condition: "(prefers-reduce-motion: reduce)",
          sheet: "a.css",
          line: 2,
          unknownAtom: "prefers-reduce-motion: reduce",
        },
      ],
    });
    assert.equal(f!.rule, "unknown-media-feature");
    assert.match(f!.message, /prefers-reduced-motion/);
    assert.equal(nearestMediaFeature("prefers-reduce-motion"), "prefers-reduced-motion");
    assert.equal(nearestMediaFeature("zzzzzzzzzz"), null);
  });

  it("an @media that matches no width is left to veriss (static-css), not judged here", () => {
    assert.deepEqual(
      judgeCssCheck({
        declarations: [],
        media: [{ condition: "(min-width: 900px) and (max-width: 600px)", sheet: "a.css", unknownAtom: null }],
      }),
      [],
    );
  });

  it("a media query that can match says nothing", () => {
    assert.deepEqual(
      judgeCssCheck({
        declarations: [],
        media: [
          { condition: "(width >= 600px)", sheet: "a.css", unknownAtom: null },
          { condition: "(prefers-reduced-motion: reduce)", sheet: "a.css", unknownAtom: null },
        ],
      }),
      [],
    );
  });
});
