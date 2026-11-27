import assert from "node:assert/strict";
import { describe, it } from "vite-plus/test";
import {
  inertReason,
  judgeInertDeclarations,
  mergeInertWidths,
  regimeWidths,
  type InertContext,
  type InertSample,
} from "./inert-declaration.ts";

const ctx = (over: Partial<InertContext> = {}): InertContext => ({
  tag: "div",
  display: "block",
  position: "static",
  float: "none",
  parentDisplay: "block",
  replaced: false,
  scrollContainer: false,
  overflowX: "visible",
  multicol: false,
  backgroundImage: false,
  borderStyle: { top: "none", right: "none", bottom: "none", left: "none" },
  flexWrap: "nowrap",
  ...over,
});

describe("inert declaration reasons", () => {
  it("an offset or z-index on a static box, and their controls", () => {
    assert.match(inertReason("top", "10px", ctx())!, /position: static/);
    assert.equal(inertReason("top", "10px", ctx({ position: "relative" })), null);
    assert.match(inertReason("z-index", "2", ctx())!, /position: static/);
    // A flex or grid item takes z-index while static.
    assert.equal(inertReason("z-index", "2", ctx({ parentDisplay: "flex" })), null);
    assert.equal(inertReason("inset", "0", ctx({ position: "absolute" })), null);
  });

  it("item properties under a parent that is not the right container", () => {
    assert.match(inertReason("flex-grow", "1", ctx())!, /not a flex item/);
    assert.equal(inertReason("flex-grow", "1", ctx({ parentDisplay: "inline-flex" })), null);
    // Out of flow: not a flex item either.
    assert.match(inertReason("flex", "1", ctx({ parentDisplay: "flex", position: "absolute" }))!, /not a flex item/);
    assert.match(inertReason("grid-column", "1 / 3", ctx({ parentDisplay: "flex" }))!, /not a grid item/);
    // An absolute child of a grid is placed by its grid lines.
    assert.equal(inertReason("grid-column", "1 / 3", ctx({ parentDisplay: "grid", position: "absolute" })), null);
    assert.match(inertReason("order", "2", ctx())!, /source order/);
    assert.match(inertReason("justify-self", "end", ctx({ parentDisplay: "flex" }))!, /justify-self/);
    // justify-self in block layout differs between browsers: not judged.
    assert.equal(inertReason("justify-self", "end", ctx()), null);
    assert.match(inertReason("float", "left", ctx({ parentDisplay: "grid" }))!, /float/);
  });

  it("container properties on a box that is not a flex or grid container", () => {
    for (const p of [
      "justify-content",
      "align-items",
      "flex-direction",
      "flex-wrap",
      "grid-template-columns",
      "grid-auto-flow",
    ])
      assert.ok(
        inertReason(
          p,
          p === "grid-template-columns"
            ? "1fr 1fr"
            : p === "flex-wrap"
              ? "wrap"
              : p === "grid-auto-flow"
                ? "column"
                : p === "flex-direction"
                  ? "column"
                  : "center",
          ctx(),
        ),
        p,
      );
    assert.equal(inertReason("align-items", "center", ctx({ display: "grid" })), null);
    // align-content applies to a block container.
    assert.equal(inertReason("align-content", "center", ctx()), null);
    assert.match(inertReason("align-content", "center", ctx({ display: "flex" }))!, /single-line/);
    assert.equal(inertReason("align-content", "center", ctx({ display: "flex", flexWrap: "wrap" })), null);
    assert.match(inertReason("gap", "1rem", ctx())!, /gap/);
    // column-gap spaces the columns of a multi-column box.
    assert.equal(inertReason("column-gap", "1rem", ctx({ multicol: true })), null);
  });

  it("an inline box takes no size, vertical margin or transform; a replaced one does", () => {
    for (const [p, v] of [
      ["width", "100px"],
      ["height", "2rem"],
      ["margin-top", "8px"],
      ["transform", "rotate(3deg)"],
    ])
      assert.match(inertReason(p, v, ctx({ display: "inline" }))!, /inline/, p);
    assert.equal(inertReason("width", "100px", ctx({ display: "inline", replaced: true, tag: "img" })), null);
    assert.equal(inertReason("width", "100px", ctx({ display: "inline-block" })), null);
    assert.match(inertReason("vertical-align", "middle", ctx())!, /vertical-align/);
    assert.equal(inertReason("vertical-align", "middle", ctx({ display: "inline-block" })), null);
    assert.equal(inertReason("vertical-align", "middle", ctx({ display: "table-cell" })), null);
  });

  it("paint properties missing their partner", () => {
    assert.match(inertReason("background-size", "cover", ctx())!, /background-image/);
    assert.equal(inertReason("background-size", "cover", ctx({ backgroundImage: true })), null);
    assert.match(inertReason("border-width", "2px", ctx())!, /border-style/);
    assert.equal(
      inertReason(
        "border-width",
        "2px",
        ctx({ borderStyle: { top: "solid", right: "none", bottom: "none", left: "none" } }),
      ),
      null,
    );
    assert.match(
      inertReason(
        "border-left-width",
        "2px",
        ctx({ borderStyle: { top: "solid", right: "solid", bottom: "solid", left: "none" } }),
      )!,
      /border-left-style/,
    );
    assert.match(inertReason("text-overflow", "ellipsis", ctx())!, /overflow/);
    assert.equal(inertReason("text-overflow", "ellipsis", ctx({ overflowX: "hidden" })), null);
    assert.match(inertReason("object-fit", "cover", ctx())!, /replaced/);
    assert.equal(inertReason("object-fit", "cover", ctx({ tag: "img", replaced: true })), null);
    assert.match(inertReason("scroll-snap-type", "x mandatory", ctx())!, /scroll container/);
    assert.equal(inertReason("scroll-snap-type", "x mandatory", ctx({ scrollContainer: true })), null);
    assert.equal(inertReason("scroll-snap-type", "y mandatory", ctx({ tag: "html" })), null);
    assert.match(inertReason("resize", "both", ctx())!, /overflow/);
    assert.match(inertReason("table-layout", "fixed", ctx())!, /table/);
    assert.match(inertReason("clip", "rect(0 0 0 0)", ctx())!, /absolute/);
  });

  it("initial values, CSS-wide keywords and var() are never called inert", () => {
    for (const [p, v] of [
      ["top", "auto"],
      ["z-index", "auto"],
      ["flex-grow", "0"],
      ["gap", "normal"],
      ["width", "auto"],
      ["top", "inherit"],
      ["top", "var(--t)"],
      ["order", "0"],
      ["float", "none"],
    ])
      assert.equal(inertReason(p, v, ctx({ display: p === "width" ? "inline" : "block" })), null, `${p}: ${v}`);
    assert.equal(inertReason("color", "red", ctx()), null);
  });

  it("boxes that are not drawn are not judged", () => {
    assert.equal(inertReason("top", "1px", ctx({ display: "none" })), null);
    assert.equal(inertReason("top", "1px", ctx({ display: "contents" })), null);
  });
});

describe("judgeInertDeclarations", () => {
  const sample = (contexts: (InertContext | null)[], over = {}) => ({
    selector: ".x",
    property: "top",
    value: "4px",
    sheet: "site.css",
    line: 7,
    contexts,
    confirmed: true,
    ...over,
  });

  it("reported only when inert on every element it matches, and confirmed by removing it", () => {
    const [f, ...rest] = judgeInertDeclarations([sample([ctx(), ctx()])]);
    assert.equal(rest.length, 0);
    assert.equal(f!.rule, "inert-declaration");
    assert.equal(f!.severity, "warn");
    assert.match(f!.message, /\.x `top: 4px` \(site\.css:7\)/);
    assert.match(f!.message, /2 elements/);
    // Effective on one element (a shared class): not a mistake.
    assert.deepEqual(judgeInertDeclarations([sample([ctx(), ctx({ position: "relative" })])]), []);
    // Removing it changed the page: the table was wrong here, so nothing is claimed.
    assert.deepEqual(judgeInertDeclarations([sample([ctx()], { confirmed: false })]), []);
    assert.deepEqual(judgeInertDeclarations([sample([])]), []);
    assert.deepEqual(judgeInertDeclarations([sample([null])]), []);
  });
});

describe("inert across widths", () => {
  it("one width inside each width regime the page's media queries make", () => {
    assert.deepEqual(regimeWidths([]), [1280]);
    assert.deepEqual(regimeWidths(["(max-width: 760px)"]), [320, 1920]);
    assert.deepEqual(
      regimeWidths(["(min-width: 600px)", "(min-width: 64em)", "(prefers-color-scheme: dark)"]),
      [320, 812, 1920],
    );
    // More regimes than `cap`: a regime left out could be the one where the declaration works, so no widths (not
    // judged) rather than a thinned set. 20 breakpoints are 21 regimes.
    const breakpoints = Array.from({ length: 20 }, (_, i) => `(min-width: ${400 + i * 70}px)`);
    assert.deepEqual(regimeWidths(breakpoints, 320, 1920, 5), []);
    assert.equal(regimeWidths(breakpoints, 320, 1920, 21).length, 21);
  });
  it("a width the query matches exactly is a sample of its own", () => {
    // (width: 600px) matches at 600 only: neither side's middle shows it.
    assert.ok(regimeWidths(["(width: 600px)"]).includes(600));
    assert.ok(regimeWidths(["(width = 600px)", "(min-width: 900px)"]).includes(600));
    // It counts toward the cap like a regime.
    assert.deepEqual(regimeWidths(["(width: 777px)", "(min-width: 600px)"], 320, 1920, 3), []);
    assert.ok(regimeWidths(["(width: 777px)", "(min-width: 600px)"], 320, 1920, 4).includes(777));
  });
  it("a width query it cannot place in px partitions nothing: no widths, so nothing is judged across them", () => {
    assert.deepEqual(regimeWidths(["(max-width: calc(600px + 1px))"]), []);
    assert.deepEqual(regimeWidths(["(min-width: 600px)", "(max-width: 50vw)"]), []);
    assert.deepEqual(regimeWidths(["(min-width: min(40em, 700px))"]), []);
    // Range syntax and em stay readable; a function elsewhere in the query does not matter.
    assert.deepEqual(regimeWidths(["(400px <= width <= 700px)"]), [320, 550, 1920]);
    assert.deepEqual(regimeWidths(["(min-width: 40em) and (min-resolution: calc(1dppx * 2))"]), [320, 1920]);
  });

  const s = (width: number, over: Partial<InertSample> = {}) => ({
    key: "k",
    width,
    sample: {
      selector: ".x",
      property: "grid-column",
      value: "2",
      sheet: "a.css",
      contexts: [],
      confirmed: true,
      ...over,
    } as InertSample,
  });
  it("inert at every width it matches: kept, with those widths", () => {
    const [m] = mergeInertWidths([s(320), s(1280)]);
    assert.deepEqual(m!.widths, [320, 1280]);
    assert.equal(m!.confirmed, true);
  });
  it("effective at one width (a declaration for desktop that a mobile query makes inert): dropped", () => {
    assert.deepEqual(mergeInertWidths([s(375), { key: "k", width: 1280, sample: null }]), []);
    // Unconfirmed at one width: not confirmed.
    assert.equal(mergeInertWidths([s(375), s(1280, { confirmed: false })])[0]!.confirmed, false);
  });
  it("the message names the widths", () => {
    const [f] = judgeInertDeclarations(
      mergeInertWidths([
        s(320, { contexts: [ctx({ parentDisplay: "flex" })] }),
        s(1280, { contexts: [ctx({ parentDisplay: "flex" })] }),
      ]),
    );
    assert.match(f!.message, /at 320 and 1280px/);
  });
});
