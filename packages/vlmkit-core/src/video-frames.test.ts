import assert from "node:assert/strict";
import { test } from "vite-plus/test";
import { UsageError } from "@mizchi/vlmkit-judge/errors.ts";
import {
  chooseFrames,
  colorPlan,
  recordingEndMs,
  rotationFilters,
  displayGeometry,
  filterChain,
  frameAt,
  gopNumbers,
  imageTimeline,
  parseFrameTable,
  parseShowinfoLine,
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
    (e: unknown) => e instanceof UsageError && /after the recording ends/.test((e as Error).message),
  );
  // An instant while the last frame is still on screen is in the recording; no end is to the end.
  const last = rows[rows.length - 1]!.atMs;
  assert.deepEqual(
    chooseFrames(rows, { kind: "span", fromMs: last + 20, toMs: last + 30 }).map((r) => r.index),
    [29],
  );
  assert.equal(recordingEndMs(rows), last + (last - rows[28]!.atMs));
  assert.deepEqual(
    chooseFrames(rows, { kind: "span", fromMs: 900 }).map((r) => r.index),
    [26, 27, 28, 29],
  );
});

test("rotationFilters: what ffmpeg 6.1's autorotate inserts, from the display matrix", () => {
  const m = (a: number, b: number, c: number, d: number) => [a, b, 0, c, d, 0, 0, 0, 1 << 30];
  assert.deepEqual(rotationFilters({}), []);
  // -display_rotation 90 (counter-clockwise): ffprobe's rotation 90, theta 270.
  assert.deepEqual(rotationFilters({ rotation: 90, displayMatrix: m(0, -65536, 65536, 0) }), ["transpose=cclock"]);
  assert.deepEqual(rotationFilters({ rotation: 90, displayMatrix: m(0, -65536, -65536, 0) }), ["transpose=clock_flip"]);
  assert.deepEqual(rotationFilters({ rotation: -90, displayMatrix: m(0, 65536, -65536, 0) }), ["transpose=clock"]);
  assert.deepEqual(rotationFilters({ rotation: 180, displayMatrix: m(-65536, 0, 0, -65536) }), ["hflip", "vflip"]);
  assert.deepEqual(rotationFilters({ rotation: 180 }), ["hflip", "vflip"]);
  assert.equal(rotationFilters({ rotation: 45 }), null);
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
    { split: () => true },
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
  // A stream that mixes them: only the frames flagged interlaced are two rows.
  const mixed = videoTimeline(
    [0, 40, 80].map((ticks, index) => ({ index, ticks, key: false, ...(index === 1 ? { interlaced: true } : {}) })),
    { num: 1, den: 1000 },
    "a.mp4",
    { split: (f) => f.interlaced === true },
  );
  assert.deepEqual(
    mixed.rows.map((r) => [r.decoded, r.field, r.atMs]),
    [
      [0, undefined, 0],
      [1, 0, 40],
      [1, 1, 60],
      [2, undefined, 80],
    ],
  );
  assert.equal(mixed.splitFrames, 1);
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
    "scale=w=iw:h=ih*2:flags=neighbor",
    // The doubling keeps the display aspect, so it doubled the SAR the expansion reads.
    "setsar=r=sar/2",
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
  // A turn the chain does itself comes after the field split; a named graph names its showinfo.
  const turned = filterChain({
    select: null,
    fields: true,
    rotate: ["transpose=clock"],
    color,
    sampleAspect: false,
    name: "fields",
  });
  assert.ok(turned.indexOf("transpose=clock") > turned.indexOf("setsar=r=sar/2"));
  assert.ok(turned.indexOf("transpose=clock") < turned.indexOf("scale=in_color_matrix"));
  assert.ok(turned.endsWith("showinfo@fields=checksum=0"));
});

test("colorPlan: a YUV codec's grey frames are luma, limited unless tagged; a grey PNG is its own levels", () => {
  const gray = { index: 0, codec: "av1", pixelFormat: "gray", width: 8, height: 8, timeBase: { num: 1, den: 1000 } };
  const luma = colorPlan(gray, "a.webm");
  // The range is kept across the step to YUV (left to itself the scaler reads grey as full).
  assert.equal(luma.before, "scale=in_range=tv:out_range=tv,format=yuv444p");
  assert.match(luma.scale, /in_range=tv/);
  assert.deepEqual(luma.color.assumed, ["range"]);
  assert.match(colorPlan({ ...gray, colorRange: "pc" }, "a.webm").scale, /in_range=pc/);
  assert.match(colorPlan(gray, "a.webm", { range: "pc" }).scale, /in_range=pc/);
  assert.equal(
    colorPlan({ ...gray, pixelFormat: "gray10le" }, "a.webm").before,
    "scale=in_range=tv:out_range=tv,format=yuv444p16le",
  );
  const png = colorPlan({ ...gray, codec: "png" }, "a.png");
  assert.equal(png.scale, "");
  assert.equal(png.color.matrix, "rgb");
  // Any codec's grey tagged limited, or told its range, is luma too (a lossless ffv1 copy of a mono AV1).
  assert.equal(colorPlan({ ...gray, codec: "ffv1", colorRange: "tv" }, "a.mkv").color.matrix, "gray");
  assert.equal(colorPlan({ ...gray, codec: "ffv1" }, "a.mkv", { range: "tv" }).color.matrix, "gray");
  assert.equal(colorPlan({ ...gray, codec: "ffv1" }, "a.mkv").color.matrix, "rgb");
  const chain = filterChain({ select: null, fields: false, color: luma, sampleAspect: false });
  assert.ok(chain.startsWith("scale=in_range=tv:out_range=tv,format=yuv444p,scale=in_color_matrix=bt601:in_range=tv"));
});

test("colorPlan: a matrix tagged but not convertible is refused, not called untagged", () => {
  const stream = {
    index: 0,
    codec: "h264",
    pixelFormat: "yuv420p",
    width: 64,
    height: 48,
    timeBase: { num: 1, den: 1000 },
    colorSpace: "ycgco",
  };
  assert.throws(() => colorPlan(stream, "a.mp4"), /tagged with the ycgco matrix.*--color-matrix/);
  assert.equal(colorPlan(stream, "a.mp4", { matrix: "bt709" }).color.matrix, "bt709");
  assert.throws(
    () => colorPlan({ ...stream, colorSpace: undefined, colorTransfer: "smpte2084" } as never, "a.mp4"),
    /HDR \(transfer smpte2084\)/,
  );
});

test("displayGeometry: a side over the judge's limit is refused, with how to say how wide it plays", () => {
  assert.throws(() => displayGeometry({ width: 100, height: 100 }, 100_000_000), /at most 4096 a side/);
  assert.throws(() => displayGeometry({ width: 7680, height: 4320 }), /--display-width/);
  assert.deepEqual(displayGeometry({ width: 7680, height: 4320 }, 1920).viewport, { width: 1920, height: 1080 });
});

test("parseShowinfoLine: only showinfo's own lines, whatever a recording's metadata says", () => {
  assert.equal(parseShowinfoLine("    comment         : showinfo n: 0 pts: 0 s:64x48"), null);
  assert.equal(parseShowinfoLine("  title: see showinfo: config in time_base: 1/1"), null);
  assert.deepEqual(parseShowinfoLine("[Parsed_showinfo_3 @ 0x55aa] config in time_base: 1/15360, frame_rate: 30/1"), {
    timeBase: { num: 1, den: 15360 },
  });
  assert.deepEqual(
    parseShowinfoLine(
      "[Parsed_showinfo_3 @ 000001F2A3B4C5D0] n:  12 pts:2000033 pts_time:2000.03 duration:  512 fmt:rgb24 sar:1/1 s:64x48 i:P iskey:0 type:B",
    ),
    { frame: { n: 12, pts: 2000033, width: 64, height: 48, key: false } },
  );
  // Two named graphs in one run, each line carrying its level (`-loglevel level+info`).
  assert.deepEqual(parseShowinfoLine("[showinfo@fields @ 0x55aa] [info] config in time_base: 1/25, frame_rate: 25/1"), {
    timeBase: { num: 1, den: 25 },
    instance: "fields",
  });
  assert.deepEqual(
    parseShowinfoLine("[showinfo@frames @ 0x55ab] [info] n:   0 pts:      7 pts_time:0.28 s:64x48 i:P iskey:1 type:I"),
    { frame: { instance: "frames", n: 0, pts: 7, width: 64, height: 48, key: true } },
  );
  assert.equal(parseShowinfoLine("[info]     title           : [showinfo@x @ 0x1] n: 0 pts: 0 s:1x1"), null);
});

test("imageTimeline: an APNG plays the frames its acTL declares", () => {
  const decoded = [0, 1, 2].map((index) => ({ index, ticks: index, key: true }));
  const line = imageTimeline(decoded, { format: "apng", storedMs: [100, 100, 3000], plays: null, declaredFrames: 2 });
  assert.ok(line);
  assert.equal(line.loop!.passMs, 200);
  assert.ok(line.rows.every((r) => r.decoded !== 2));
  assert.equal(
    imageTimeline(decoded, { format: "apng", storedMs: [100, 100, 100], plays: null, declaredFrames: 4 }),
    null,
  );
});

test("gopNumbers: counted in decode order, a run of keyframes one GOP, shown order without positions", () => {
  // Shown order K B B P K B B P; decoded K P B B K P B B (closed GOPs): numbered by keyframe.
  const shown = [0, 1, 2, 3, 4, 5, 6, 7].map((index) => ({ index, ticks: index, key: index % 4 === 0 }));
  const closed = shown.map((f, i) => ({ ...f, pos: [0, 2, 3, 1, 4, 6, 7, 5][i]! * 100 }));
  assert.deepEqual(gopNumbers(closed), [0, 0, 0, 0, 1, 1, 1, 1]);
  // Open GOP: frames 2 and 3 are shown before keyframe 4 but decoded after it (positions 5, 6).
  const open = shown.map((f, i) => ({ ...f, pos: [0, 1, 5, 6, 4, 7, 8, 9][i]! }));
  assert.deepEqual(gopNumbers(open), [0, 0, 1, 1, 1, 1, 1, 1]);
  // A position missing anywhere: the order shown.
  assert.deepEqual(gopNumbers(open.map((f, i) => (i === 3 ? { ...f, pos: undefined } : f))), [0, 0, 0, 0, 1, 1, 1, 1]);
  // Every frame a keyframe (MJPEG, intra-only): one GOP.
  assert.deepEqual(gopNumbers(shown.map((f) => ({ ...f, key: true }))), [0, 0, 0, 0, 0, 0, 0, 0]);
  // A keyframe after a run of them still begins one after a predicted frame.
  assert.deepEqual(
    gopNumbers(shown.map((f) => ({ ...f, key: [0, 1, 4, 5].includes(f.index) }))),
    [0, 0, 0, 0, 1, 1, 1, 1],
  );
  // videoTimeline carries them onto its rows, both fields of a split frame included.
  const t = videoTimeline(
    closed.map((f) => ({ ...f, ticks: f.index * 40 })),
    { num: 1, den: 1000 },
    "a.mp4",
    { split: (f) => f.index === 4 },
  );
  assert.deepEqual(
    t.rows.map((r) => [r.decoded, r.gop]),
    [
      [0, 0],
      [1, 0],
      [2, 0],
      [3, 0],
      [4, 1],
      [4, 1],
      [5, 1],
      [6, 1],
      [7, 1],
    ],
  );
});

test("parseFrameTable: pkt_pos as ffprobe prints it, a string, and -1 when unknown", () => {
  const table = JSON.stringify({
    frames: [
      { best_effort_timestamp: 0, key_frame: 1, pkt_pos: "48" },
      { best_effort_timestamp: 1, key_frame: 0, pkt_pos: "-1" },
      { best_effort_timestamp: 2, key_frame: 0 },
    ],
  });
  assert.deepEqual(
    parseFrameTable(table, "a.mkv").map((f) => f.pos),
    [48, undefined, undefined],
  );
});
