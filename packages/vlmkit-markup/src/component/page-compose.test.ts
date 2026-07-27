import { test } from "node:test";
import assert from "node:assert/strict";
import {
  composePageDiff,
  dominantPageColor,
  matchPageComponents,
  type PageComponent,
} from "./page-compose.ts";

/** White canvas with solid-color rects. */
function makePage(
  width: number,
  height: number,
  rects: Array<{ x: number; y: number; w: number; h: number; rgb: [number, number, number] }>,
): { data: Uint8Array; width: number; height: number } {
  const data = new Uint8Array(width * height * 4).fill(255);
  for (const rect of rects) {
    for (let y = rect.y; y < rect.y + rect.h; y++) {
      for (let x = rect.x; x < rect.x + rect.w; x++) {
        const i = (y * width + x) * 4;
        data[i] = rect.rgb[0];
        data[i + 1] = rect.rgb[1];
        data[i + 2] = rect.rgb[2];
        data[i + 3] = 255;
      }
    }
  }
  return { data, width, height };
}

const BLUE: [number, number, number] = [37, 99, 235];
const GRAY: [number, number, number] = [229, 231, 235];
const DARK: [number, number, number] = [31, 41, 55];

test("identical pages match every component with zero deltas", () => {
  const rects = [
    { x: 20, y: 20, w: 360, h: 80, rgb: BLUE },
    { x: 20, y: 140, w: 360, h: 120, rgb: GRAY },
    { x: 20, y: 300, w: 360, h: 60, rgb: DARK },
  ];
  const target = makePage(400, 400, rects);
  const current = makePage(400, 400, rects);
  const composition = composePageDiff(target, current);
  assert.equal(composition.matches.length, 3);
  assert.equal(composition.missing.length, 0);
  assert.equal(composition.extra.length, 0);
  assert.equal(composition.orderViolations.length, 0);
  assert.equal(composition.gapDeltas.length, 0);
  for (const m of composition.matches) {
    assert.equal(m.deltaTop, 0);
    assert.equal(m.deltaLeft, 0);
    assert.ok(m.iou > 0.95);
  }
});

test("a component absent from current is reported missing, not mispaired", () => {
  const target = makePage(400, 400, [
    { x: 20, y: 20, w: 360, h: 80, rgb: BLUE },
    { x: 20, y: 140, w: 360, h: 120, rgb: GRAY },
    { x: 20, y: 300, w: 360, h: 60, rgb: DARK },
  ]);
  const current = makePage(400, 400, [
    { x: 20, y: 20, w: 360, h: 80, rgb: BLUE },
    { x: 20, y: 300, w: 360, h: 60, rgb: DARK },
  ]);
  const composition = composePageDiff(target, current);
  assert.equal(composition.matches.length, 2);
  assert.equal(composition.missing.length, 1);
  const missing = composition.missing[0]!;
  assert.equal(missing.top, 140);
  assert.equal(missing.height, 120);
  // The two survivors matched in place.
  for (const m of composition.matches) {
    assert.equal(m.deltaTop, 0);
  }
});

test("an invented component is reported extra", () => {
  const target = makePage(400, 400, [
    { x: 20, y: 20, w: 360, h: 80, rgb: BLUE },
  ]);
  const current = makePage(400, 400, [
    { x: 20, y: 20, w: 360, h: 80, rgb: BLUE },
    { x: 20, y: 200, w: 200, h: 100, rgb: GRAY },
  ]);
  const composition = composePageDiff(target, current);
  assert.equal(composition.matches.length, 1);
  assert.equal(composition.extra.length, 1);
  assert.equal(composition.extra[0]!.top, 200);
});

test("swapped sections produce an order violation", () => {
  const target = makePage(400, 500, [
    { x: 20, y: 20, w: 360, h: 100, rgb: GRAY },
    { x: 20, y: 160, w: 360, h: 100, rgb: DARK },
  ]);
  const current = makePage(400, 500, [
    { x: 20, y: 20, w: 360, h: 100, rgb: DARK },
    { x: 20, y: 160, w: 360, h: 100, rgb: GRAY },
  ]);
  // Same geometry both sides — spatial matching pairs by position, so the
  // *fill* swap is what surfaces: matched pairs report large fillDistance.
  const composition = composePageDiff(target, current);
  assert.equal(composition.matches.length, 2);
  for (const m of composition.matches) {
    assert.ok(m.fillDistance > 100, `fill swap should surface, got ${m.fillDistance}`);
  }
});

test("order violation fires when a matched section moved across another", () => {
  // Target: small badge above a wide card. Current: badge below the card.
  const target = makePage(400, 500, [
    { x: 20, y: 20, w: 120, h: 40, rgb: BLUE },
    { x: 20, y: 100, w: 360, h: 150, rgb: GRAY },
  ]);
  const current = makePage(400, 500, [
    { x: 20, y: 440, w: 120, h: 40, rgb: BLUE },
    { x: 20, y: 100, w: 360, h: 150, rgb: GRAY },
  ]);
  const composition = composePageDiff(target, current, { maxCenterDistance: 0.9 });
  assert.equal(composition.orderViolations.length, 1);
});

test("stacking gap deltas are reported with direction", () => {
  const target = makePage(400, 500, [
    { x: 20, y: 20, w: 360, h: 100, rgb: BLUE },
    { x: 20, y: 140, w: 360, h: 100, rgb: GRAY }, // gap 20
  ]);
  const current = makePage(400, 500, [
    { x: 20, y: 20, w: 360, h: 100, rgb: BLUE },
    { x: 20, y: 180, w: 360, h: 100, rgb: GRAY }, // gap 60
  ]);
  const composition = composePageDiff(target, current);
  assert.equal(composition.gapDeltas.length, 1);
  const gap = composition.gapDeltas[0]!;
  assert.equal(gap.targetGap, 20);
  assert.equal(gap.currentGap, 60);
  assert.equal(gap.delta, 40);
});

test("full-bleed dark header does not poison background detection", () => {
  // A dark bar spanning the full top edge dominates perimeter sampling;
  // the shared dominant-color background keeps both sides comparable.
  const header = { x: 0, y: 0, w: 400, h: 60, rgb: [15, 23, 42] as [number, number, number] };
  const card = { x: 40, y: 100, w: 320, h: 120, rgb: GRAY };
  const target = makePage(400, 400, [header, card]);
  const current = makePage(400, 400, [header, card]);
  const bg = dominantPageColor(target);
  assert.ok(bg[0] > 240 && bg[1] > 240 && bg[2] > 240, `page bg should be white-ish, got ${bg}`);
  const composition = composePageDiff(target, current);
  assert.equal(composition.matches.length, 2);
  assert.equal(composition.missing.length, 0);
  assert.equal(composition.extra.length, 0);
  for (const m of composition.matches) assert.ok(m.iou > 0.95);
});

test("matchPageComponents pairs by position even when area ranks differ", () => {
  const mk = (index: number, left: number, top: number, w: number, h: number): PageComponent => ({
    index, left, top, width: w, height: h, area: w * h, fillColor: "rgb(0, 0, 0)", hex: "#000000",
  });
  // Target: big hero at top, small button below. Current is the same but the
  // hero shrank — by area rank the button could outrank it on one side.
  const target = [mk(0, 0, 0, 300, 200), mk(1, 0, 250, 80, 40)];
  const current = [mk(0, 0, 250, 80, 40), mk(1, 0, 0, 150, 120)];
  const { matches, missing, extra } = matchPageComponents(target, current, 400, 400);
  assert.equal(matches.length, 2);
  assert.equal(missing.length, 0);
  assert.equal(extra.length, 0);
  const hero = matches.find((m) => m.target.index === 0)!;
  assert.equal(hero.current.index, 1, "hero pairs with the shrunk hero, not the button");
});
