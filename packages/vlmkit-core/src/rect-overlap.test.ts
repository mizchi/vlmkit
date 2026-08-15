import assert from "node:assert/strict";
import { test } from "vitest";
import { overlapArea, iou } from "./rect-overlap.ts";

const box = (left: number, top: number, width: number, height: number) => ({ left, top, width, height });

test("overlapping boxes report the shared area, in either argument order", () => {
  const a = box(0, 0, 10, 10);
  const b = box(5, 5, 10, 10);
  assert.equal(overlapArea(a, b), 25);
  assert.equal(overlapArea(b, a), 25);
});

test("a fully contained box overlaps by its own whole area", () => {
  assert.equal(overlapArea(box(0, 0, 100, 100), box(10, 20, 5, 4)), 20);
});

test("disjoint boxes overlap by 0 on each axis independently", () => {
  const a = box(0, 0, 10, 10);
  assert.equal(overlapArea(a, box(20, 0, 10, 10)), 0); // apart on x only
  assert.equal(overlapArea(a, box(0, 20, 10, 10)), 0); // apart on y only
  assert.equal(overlapArea(a, box(20, 20, 10, 10)), 0); // apart on both
});

test("boxes that only touch along an edge overlap by 0, not by a negative area", () => {
  // The reason each axis is clamped with Math.max(0, …) *before* multiplying: two negatives
  // multiply to a positive, so a box diagonally away from another would report an overlap.
  assert.equal(overlapArea(box(0, 0, 10, 10), box(10, 0, 10, 10)), 0);
  assert.equal(overlapArea(box(0, 0, 10, 10), box(30, 30, 10, 10)), 0);
});

test("iou is 1 for identical boxes and 0 for disjoint ones", () => {
  assert.equal(iou(box(3, 4, 20, 8), box(3, 4, 20, 8)), 1);
  assert.equal(iou(box(0, 0, 10, 10), box(50, 50, 10, 10)), 0);
});

test("iou halves as one box grows to twice the other, fully containing it", () => {
  // inter = 100, union = 100 + 200 - 100 = 200
  assert.equal(iou(box(0, 0, 10, 10), box(0, 0, 20, 10)), 0.5);
});

test("two empty boxes give 0 rather than NaN", () => {
  // A NaN here would fail every comparison it is put into: `NaN > threshold` is false, so the
  // pair would read as "not similar" in some callers and be silently dropped in others.
  const zero = iou(box(0, 0, 0, 0), box(0, 0, 0, 0));
  assert.equal(Number.isNaN(zero), false);
  assert.equal(zero, 0);
});
