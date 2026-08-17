import assert from "node:assert/strict";
import { describe, it } from "vitest";
import {
  type LandmarkLayoutContract,
  type ScrollportRegion,
  describeLandmarkLayoutContract,
  describeScrollportStatus,
  normalizeLandmarkRole,
} from "./semantic-drilldown.ts";

/**
 * The pure half of the drilldown: how a measured box is classified. The capture
 * half needs a `Page`; these three functions are the decisions, and they are what
 * `check drift component`'s scrollport evidence and the landmark contract read.
 */

const region = (over: Partial<ScrollportRegion> = {}): ScrollportRegion => ({
  name: "rail",
  path: "main>div.rail",
  bbox: { left: 0, top: 0, width: 400, height: 200 },
  order: 0,
  explicit: true,
  overflowX: "hidden",
  overflowY: "hidden",
  clientWidth: 400,
  clientHeight: 200,
  scrollWidth: 400,
  scrollHeight: 200,
  ...over,
});

describe("describeScrollportStatus", () => {
  it("calls a box that both overflows and scrolls an ok scrollport, naming the axis", () => {
    const x = describeScrollportStatus(region({ overflowX: "auto", scrollWidth: 900 }));
    assert.deepEqual({ status: x.status, scroll: x.scroll }, { status: "ok", scroll: "x" });

    const y = describeScrollportStatus(region({ overflowY: "scroll", scrollHeight: 900 }));
    assert.deepEqual({ status: y.status, scroll: y.scroll }, { status: "ok", scroll: "y" });

    const both = describeScrollportStatus(region({
      overflowX: "auto", overflowY: "auto", scrollWidth: 900, scrollHeight: 900,
    }));
    assert.equal(both.scroll, "xy");
  });

  it("calls content that overflows an UNSCROLLABLE box broken, which is the defect", () => {
    // The whole point of the check: a rail built with `overflow: hidden` and more
    // content than fits does not scroll, and the content past the edge is
    // unreachable. Distinguishing this from "empty" is what makes it actionable.
    const status = describeScrollportStatus(region({ overflowX: "hidden", scrollWidth: 900 }));
    assert.equal(status.status, "broken");
    assert.equal(status.scroll, "none");
    assert.match(status.reason, /overflow is not scrollable/);
  });

  it("tolerates a 1px overflow, which is rounding rather than content", () => {
    // Sub-pixel layout routinely leaves scrollWidth one greater than clientWidth.
    // Without the tolerance every second box would report as overflowing.
    assert.equal(describeScrollportStatus(region({ overflowX: "auto", scrollWidth: 401 })).scroll, "none");
    assert.equal(describeScrollportStatus(region({ overflowX: "auto", scrollWidth: 402 })).scroll, "x");
  });

  it("treats a scrollable box with nothing to scroll as its own state", () => {
    // `overflow: auto` and content that fits: built and never filled. Not broken —
    // there is nothing wrong with the CSS — but not evidence of a working rail either.
    const status = describeScrollportStatus(region({ overflowX: "auto", overflowY: "auto" }));
    assert.notEqual(status.status, "ok");
    assert.equal(status.scroll, "none");
  });

  it("counts `auto` and `scroll` as scrollable, and nothing else", () => {
    // These values arrive from `getComputedStyle`, not from the stylesheet, which is
    // why the set is this short: Chromium normalizes the deprecated `overlay` to
    // `auto` before it can be read, so a page using it is already covered and
    // matching on it here would be dead code.
    for (const keyword of ["auto", "scroll"]) {
      assert.equal(
        describeScrollportStatus(region({ overflowX: keyword, scrollWidth: 900 })).scroll,
        "x",
        `${keyword} is a scrollable overflow`,
      );
    }
    for (const keyword of ["hidden", "visible", "clip"]) {
      assert.equal(
        describeScrollportStatus(region({ overflowX: keyword, scrollWidth: 900 })).scroll,
        "none",
        `${keyword} does not scroll`,
      );
    }
  });
});

describe("describeLandmarkLayoutContract", () => {
  // Every field, built from the interface rather than cast into shape: the bound
  // fields are plain strings and `""` is what "no rule" looks like, which is the
  // distinction the width description turns on.
  const contract = (over: Partial<LandmarkLayoutContract> = {}): LandmarkLayoutContract => ({
    display: "block",
    gridTemplateColumns: "none",
    gridTemplateRows: "none",
    minWidth: "0px",
    maxWidth: "none",
    minHeight: "0px",
    maxHeight: "none",
    overflowX: "visible",
    overflowY: "visible",
    clientWidth: 800,
    clientHeight: 600,
    scrollWidth: 800,
    scrollHeight: 600,
    ...over,
  });

  it("describes a width bounded on both sides, one side, or neither", () => {
    assert.match(describeLandmarkLayoutContract(contract({ minWidth: "320px", maxWidth: "1200px" })).width, /bounded 320px\.\.1200px/);
    assert.match(describeLandmarkLayoutContract(contract({ maxWidth: "1200px" })).width, /bounded max 1200px/);
    assert.match(describeLandmarkLayoutContract(contract({ minWidth: "320px" })).width, /bounded min 320px/);
  });

  it("falls back to the measured width when nothing bounds it", () => {
    // "fluid measured 800px" says more than "fluid": a reader comparing two
    // renders wants the number that came out, not just the absence of a rule.
    assert.match(describeLandmarkLayoutContract(contract()).width, /fluid measured 800px/);
    assert.match(describeLandmarkLayoutContract(contract({ clientWidth: 0 })).width, /fluid-unbounded/);
  });

  it("reports a scrolling landmark's height as a scrollport rather than a number", () => {
    const scrolling = describeLandmarkLayoutContract(contract({ overflowY: "auto", scrollHeight: 2000 }));
    assert.equal(scrolling.scroll, "y");
    assert.equal(scrolling.height, "scrollport-y");
  });

  it("applies the same 1px tolerance as the scrollport check", () => {
    assert.equal(describeLandmarkLayoutContract(contract({ overflowY: "auto", scrollHeight: 601 })).scroll, "none");
    assert.equal(describeLandmarkLayoutContract(contract({ overflowY: "auto", scrollHeight: 602 })).scroll, "y");
  });
});

describe("normalizeLandmarkRole", () => {
  it("reads an explicit role, case-insensitively", () => {
    // A page using `<nav>` and one using `role="navigation"` describe the same
    // landmark, and treating them as different would report a rewrite as a
    // structural change.
    assert.equal(normalizeLandmarkRole({ tagName: "div", role: "navigation" }), "navigation");
    assert.equal(normalizeLandmarkRole({ tagName: "div", role: "NAVIGATION" }), "navigation");
    assert.equal(normalizeLandmarkRole({ tagName: "nav" }), "navigation");
  });

  it("refuses a nameless region or form, which the ARIA spec does not treat as a landmark", () => {
    // The subtlety worth pinning: `role="region"` becomes a landmark only with an
    // accessible name. Counting nameless ones would inflate every page's landmark
    // list with anonymous wrappers.
    assert.equal(normalizeLandmarkRole({ tagName: "div", role: "region" }), undefined);
    assert.equal(normalizeLandmarkRole({ tagName: "div", role: "region", name: "  " }), undefined);
    assert.equal(normalizeLandmarkRole({ tagName: "div", role: "region", name: "Filters" }), "region");
    assert.equal(normalizeLandmarkRole({ tagName: "div", role: "form" }), undefined);
    assert.equal(normalizeLandmarkRole({ tagName: "div", role: "form", name: "Signup" }), "form");
  });

  it("applies the same rule to a bare <section>, which is a region only when named", () => {
    assert.equal(normalizeLandmarkRole({ tagName: "section" }), undefined);
    assert.equal(normalizeLandmarkRole({ tagName: "SECTION", name: "Pricing" }), "region");
  });

  it("returns undefined for an element that is not a landmark at all", () => {
    assert.equal(normalizeLandmarkRole({ tagName: "button" }), undefined);
    assert.equal(normalizeLandmarkRole({ tagName: "div" }), undefined);
    // `role="landmark"` is not a role; it is a category name people write by mistake.
    assert.equal(normalizeLandmarkRole({ tagName: "div", role: "landmark" }), undefined);
  });
});
