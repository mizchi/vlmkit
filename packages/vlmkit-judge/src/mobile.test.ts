import assert from "node:assert/strict";
import { describe, it } from "vite-plus/test";
import {
  coversSafeArea,
  isCarousel,
  keyboardMode,
  overlapPx,
  parseViewportMeta,
  swipeLanding,
  zoomBlocked,
} from "./mobile.ts";

describe("viewport meta", () => {
  it("reads directives as browsers do, and finds zoom turned off or capped", () => {
    const m = parseViewportMeta("width=device-width; initial-scale=1, User-Scalable=NO");
    assert.equal(m.directives["user-scalable"], "no");
    assert.match(zoomBlocked(m)!, /user-scalable=no/);
    assert.match(zoomBlocked(parseViewportMeta("width=device-width, user-scalable=0"))!, /user-scalable=0/);
    assert.match(zoomBlocked(parseViewportMeta("width=device-width, maximum-scale=1.5"))!, /200%/);
    assert.equal(zoomBlocked(parseViewportMeta("width=device-width, maximum-scale=5")), null);
    assert.equal(zoomBlocked(parseViewportMeta("width=device-width, user-scalable=yes")), null);
    assert.equal(zoomBlocked(parseViewportMeta(null)), null);
  });
  it("knows viewport-fit=cover and interactive-widget", () => {
    assert.equal(coversSafeArea(parseViewportMeta("width=device-width, viewport-fit=cover")), true);
    assert.equal(coversSafeArea(parseViewportMeta("width=device-width")), false);
    assert.equal(keyboardMode(parseViewportMeta("interactive-widget=resizes-content")), "resizes-content");
    assert.equal(keyboardMode(parseViewportMeta("width=device-width")), "resizes-visual");
  });
});

describe("swipeLanding", () => {
  const slides = (scrollLeft: number) => [0, 1, 2].map((i) => ({ left: i * 390 - scrollLeft, width: 390 }));
  it("a slide lined up by its start, centre or end is on a slide; part-way is between", () => {
    assert.deepEqual(swipeLanding({ scrollLeft: 390, maxScroll: 780, clientWidth: 390, items: slides(390) }), {
      aligned: true,
      offBy: 0,
    });
    const between = swipeLanding({ scrollLeft: 234, maxScroll: 780, clientWidth: 390, items: slides(234) });
    assert.equal(between.aligned, false);
    assert.equal(between.offBy, 156);
    // Centred cards narrower than the scroller.
    const cards = [
      { left: -280, width: 300 },
      { left: 45, width: 300 },
    ];
    assert.equal(swipeLanding({ scrollLeft: 325, maxScroll: 600, clientWidth: 390, items: cards }).aligned, true);
    // The scroll's own ends count as resting places.
    assert.equal(
      swipeLanding({ scrollLeft: 780, maxScroll: 780, clientWidth: 390, items: slides(780 - 50) }).aligned,
      true,
    );
  });
  it("a carousel's items are at least half its width; chips are not one", () => {
    assert.equal(isCarousel(390, [390, 390, 390]), true);
    assert.equal(isCarousel(390, [80, 90, 70, 100, 85]), false);
    assert.equal(isCarousel(390, [390]), false);
  });
  it("overlapPx", () => {
    assert.equal(overlapPx({ top: 10, bottom: 30 }, { top: 0, bottom: 47 }), 20);
    assert.equal(overlapPx({ top: 50, bottom: 70 }, { top: 0, bottom: 47 }), 0);
  });
});
