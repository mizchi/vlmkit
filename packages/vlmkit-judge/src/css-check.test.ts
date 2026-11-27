import assert from "node:assert/strict";
import { describe, it } from "vite-plus/test";
import {
  isVendorDeclaration,
  judgeCssCheck,
  MEDIA_ATOM_PROBE_JS,
  nearestMediaFeature,
  type DeclarationSample,
} from "./css-check.ts";

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

describe("MEDIA_ATOM_PROBE_JS: which (…) groups are asked of the browser", () => {
  // A stand-in for matchMedia: a known feature matches exactly one of (f) and not (f); an unknown one matches neither.
  const probe = (cond: string) => {
    const asked: string[] = [];
    const known = (atom: string) => /^\((?:min-width|max-width|width|prefers-reduced-motion|hover)\b/.test(atom);
    const window = {
      matchMedia: (q: string) => {
        const atom = q.replace(/^not /, "");
        asked.push(atom);
        return { matches: known(atom) && !q.startsWith("not ") };
      },
    };
    const found = new Function("window", "cond", `${MEDIA_ATOM_PROBE_JS}; return unknownMediaAtom(cond);`)(
      window,
      cond,
    );
    return { found, asked: [...new Set(asked)] };
  };
  it("a function in a feature's value is part of the feature, not an atom", () => {
    assert.deepEqual(probe("(min-width: calc(40em + 1px))"), { found: null, asked: ["(min-width: calc(40em + 1px))"] });
    assert.equal(probe("(max-width: min(50vw, 600px)) and (hover: hover)").found, null);
  });
  it("a misspelt feature is still found, also inside a nested condition", () => {
    assert.equal(probe("(min-widht: 600px)").found, "min-widht: 600px");
    assert.equal(
      probe("not ((hover: hover) and (prefers-reduce-motion: reduce))").found,
      "prefers-reduce-motion: reduce",
    );
    assert.equal(probe("screen and (min-widht: calc(1px + 2px))").found, "min-widht: calc(1px + 2px)");
  });
});

describe("judgeCssCheck: a redirected page is never a clean result", () => {
  it("a redirect note is a suspect finding of its own, first", () => {
    const [f, ...rest] = judgeCssCheck({
      declarations: [],
      media: [],
      redirect: "redirected from https://app.example/settings to https://app.example/login",
    });
    assert.equal(rest.length, 0);
    assert.equal(f!.rule, "redirected");
    assert.equal(f!.severity, "suspect");
    assert.match(f!.message, /login/);
    assert.match(f!.message, /not the page asked for/);
    assert.deepEqual(judgeCssCheck({ declarations: [], media: [], redirect: null }), []);
  });
});
