import assert from "node:assert/strict";
import { test } from "vite-plus/test";
import { UsageError } from "@mizchi/vlmkit-judge/errors.ts";
import { chooseFrames, displayGeometry, frameAt, type FrameRow } from "./video-frames.ts";

/** 30fps on a 1/30000 time base: frame k begins at k * 1001 / 30 ms, never a whole number. */
const rows: FrameRow[] = Array.from({ length: 30 }, (_, index) => ({
  index,
  atMs: (index * 1001) / 30,
  key: index % 10 === 0,
}));

test("frameAt: the frame on screen is the last one that began at or before the instant", () => {
  assert.equal(frameAt(rows, 0), 0);
  assert.equal(frameAt(rows, -5), 0, "before the first frame began, the first frame");
  assert.equal(frameAt(rows, rows[3]!.atMs), 3, "on a frame's start, that frame (not the one before)");
  assert.equal(frameAt(rows, rows[3]!.atMs - 1e-9), 3, "a decimal instant a hair below a rational start");
  assert.equal(frameAt(rows, rows[3]!.atMs - 0.01), 2);
  assert.equal(frameAt(rows, rows[3]!.atMs + 30), 3, "mid-interval: the frame still showing (floor, not ceil)");
  assert.equal(frameAt(rows, 1e9), 29, "past the end, the last frame");
});

test("chooseFrames: all, a span by what was on screen, and instants once per frame", () => {
  assert.equal(chooseFrames(rows, { kind: "all" }).length, 30);
  const span = chooseFrames(rows, { kind: "span", fromMs: 50, toMs: 120 });
  // 50ms is inside frame 1 (33.37–66.73), 120ms inside frame 3 (100.1–133.47).
  assert.deepEqual(
    span.map((r) => r.index),
    [1, 2, 3],
  );
  const at = chooseFrames(rows, { kind: "at", atMs: [0, 10, 100.1, 500] });
  assert.deepEqual(
    at.map((r) => [r.index, r.instants]),
    [
      [0, [0, 10]],
      [3, [100.1]],
      [14, [500]],
    ],
  );
  assert.throws(
    () => chooseFrames(rows, { kind: "span", fromMs: 5000, toMs: 6000 }),
    (e: unknown) => e instanceof UsageError && /after the recording's last frame/.test((e as Error).message),
  );
});

test("displayGeometry: one frame pixel per CSS pixel, or the width it plays at", () => {
  assert.deepEqual(displayGeometry({ width: 1920, height: 1080 }), {
    viewport: { width: 1920, height: 1080 },
    deviceScaleFactor: 1,
  });
  assert.deepEqual(displayGeometry({ width: 1920, height: 1080 }, 1280), {
    viewport: { width: 1280, height: 720 },
    deviceScaleFactor: 1.5,
  });
  assert.deepEqual(displayGeometry({ width: 320, height: 240 }, 1280), {
    viewport: { width: 1280, height: 960 },
    deviceScaleFactor: 0.25,
  });
  assert.throws(() => displayGeometry({ width: 10, height: 10 }, 0), UsageError);
});
