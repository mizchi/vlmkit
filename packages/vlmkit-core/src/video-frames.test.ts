import assert from "node:assert/strict";
import { test } from "vite-plus/test";
import { UsageError } from "@mizchi/vlmkit-judge/errors.ts";
import {
  chooseFrames,
  colorPlan,
  displayGeometry,
  filterChain,
  frameAt,
  imageTimeline,
  pickVideoStream,
  videoTimeline,
  type FrameRow,
} from "./video-frames.ts";

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

const probe = (streams: Record<string, unknown>[]) =>
  JSON.stringify({
    streams: streams.map((s) => ({ codec_type: "video", time_base: "1/1000", width: 320, height: 240, ...s })),
  });

test("pickVideoStream: what ffmpeg itself picks — not cover art, the default one, then the largest", () => {
  // An mkv cover track at index 0 without the attached_pic flag, the real video marked default.
  assert.equal(
    pickVideoStream(
      probe([
        { index: 0, codec_name: "png", width: 640, height: 640, disposition: { default: 0 } },
        { index: 1, codec_name: "h264", disposition: { default: 1 } },
      ]),
      "a.mkv",
    ).index,
    1,
  );
  assert.equal(
    pickVideoStream(
      probe([
        { index: 0, codec_name: "h264", width: 160, height: 120 },
        { index: 1, codec_name: "h264" },
        { index: 2, codec_name: "mjpeg", width: 1000, height: 1000, disposition: { attached_pic: 1 } },
      ]),
      "a.mp4",
    ).index,
    1,
    "the largest when none is default; cover art never",
  );
  assert.throws(
    () => pickVideoStream(JSON.stringify({ streams: [{ index: 0, codec_type: "audio", codec_name: "aac" }] }), "a.m4a"),
    /holds no video stream.*#0 audio aac/,
  );
  assert.throws(() => pickVideoStream(probe([{ index: 0 }]), "a.mkv"), /no decoder for video stream #0/);
  assert.equal(
    pickVideoStream(probe([{ index: 0, codec_name: "vp9", tags: { alpha_mode: "1" } }]), "a.webm").alpha,
    "libvpx-vp9",
    "WebM alpha is only in a tag, and only libvpx decodes it",
  );
  assert.equal(pickVideoStream(probe([{ index: 0, codec_name: "qtrle", pix_fmt: "argb" }]), "a.mov").alpha, "pixels");
  assert.equal(
    pickVideoStream(probe([{ index: 0, codec_name: "h264", pix_fmt: "yuv420p" }]), "a.mp4").alpha,
    undefined,
  );
});

test("videoTimeline: a frame that shares its timestamp with the next is never shown; negative starts move to 0", () => {
  const frames = [0, 0, 0, 33, 33, 67].map((ticks, index) => ({ index, ticks, key: index === 0 }));
  const t = videoTimeline(frames, { num: 1, den: 1000 }, "a.mkv");
  assert.equal(t.hidden, 3);
  assert.deepEqual(
    t.rows.map((r) => [r.decoded, r.atMs]),
    [
      [2, 0],
      [4, 33],
      [5, 67],
    ],
  );
  const negative = videoTimeline(
    [-40, 0, 40].map((ticks, index) => ({ index, ticks, key: false })),
    { num: 1, den: 1000 },
    "a.mkv",
  );
  assert.deepEqual(
    negative.rows.map((r) => r.atMs),
    [0, 40, 80],
  );
  const fields = videoTimeline(
    [0, 40, 80].map((ticks, index) => ({ index, ticks, key: false })),
    { num: 1, den: 1000 },
    "a.mp4",
    { fields: true },
  );
  assert.deepEqual(
    fields.rows.map((r) => [r.decoded, r.field, r.atMs]),
    [
      [0, 0, 0],
      [0, 1, 20],
      [1, 0, 40],
      [1, 1, 60],
      [2, 0, 80],
      [2, 1, 100],
    ],
  );
  assert.throws(
    () =>
      videoTimeline(
        [0, 40, 20].map((ticks, index) => ({ index, ticks, key: false })),
        { num: 1, den: 1000 },
        "a.mp4",
      ),
    /shown before frame 1/,
  );
});

test("imageTimeline: delays clamped as Chromium clamps them, looped one pass and a second more", () => {
  const decoded = [0, 1, 2].map((index) => ({ index, ticks: index, key: true }));
  const t = imageTimeline(decoded, { format: "gif", storedMs: [10, 50, 400], plays: null })!;
  // 100 + 50 + 400 = 550ms a pass; 1 + ceil(1000 / 550) = 3 passes.
  assert.deepEqual(t.loop, { plays: null, passFrames: 3, passMs: 550, passes: 3 });
  assert.deepEqual(
    t.rows.slice(0, 4).map((r) => r.atMs),
    [0, 100, 150, 550],
  );
  assert.equal(imageTimeline(decoded, { format: "gif", storedMs: [100, 100], plays: null }), null, "counts disagree");
  assert.equal(imageTimeline(decoded, { format: "apng", storedMs: [100, 100, 100], plays: 2 })!.loop!.passes, 2);
});

test("filterChain: the measured order of every step", () => {
  const color = colorPlan(
    { index: 0, codec: "h264", pixelFormat: "yuv420p", width: 10, height: 10, timeBase: { num: 1, den: 1 } },
    "a.mp4",
  );
  assert.equal(
    filterChain({ select: null, fields: false, color, sampleAspect: false }),
    "scale=in_color_matrix=bt601:in_range=tv:flags=accurate_rnd+full_chroma_int,format=rgb24," +
      "setparams=color_primaries=unknown:color_trc=unknown:colorspace=unknown,sidedata=mode=delete:type=ICC_PROFILE,showinfo=checksum=0",
  );
  const all = filterChain({
    select: "select='eq(n,3)'",
    fields: true,
    color,
    alpha: { background: "white" },
    sampleAspect: true,
  });
  const order = [
    "select=",
    "separatefields",
    "scale=in_color_matrix",
    "format=rgba",
    "negate",
    "premultiply",
    "negate",
    "format=rgb24",
    "iw*sar",
    "setsar=1",
    "setparams",
    "sidedata",
    "showinfo",
  ];
  let at = -1;
  for (const step of order) {
    const next = all.indexOf(step, at + 1);
    assert.ok(next > at, `${step} after the step before it in ${all}`);
    at = next;
  }
  assert.ok(
    filterChain({ select: null, fields: false, color, alpha: { background: "black" }, sampleAspect: false }).includes(
      "format=rgba,premultiply=inplace=1,format=rgb24",
    ),
  );
});
