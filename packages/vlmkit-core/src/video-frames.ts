/**
 * The pure half of loading a recording through a decoder the user supplies (`vlmkit scan video`):
 * which frames to keep, how big the frames are shown, and which codecs reproduce their input.
 * No process and no file: `video-decode.ts` runs the user's own ffmpeg and ffprobe and brings
 * their output here.
 */
import { UsageError } from "@mizchi/vlmkit-judge/errors.ts";
import type { FramesVideo } from "@mizchi/vlmkit-judge/frames.ts";
import { browserDelayMs, type ImageTiming } from "./image-timing.ts";

/**
 * Codecs whose decoded frames are what was encoded, bit for bit (modulo a chroma subsampling the
 * encoder chose). Anything else is treated as lossy: x264 at `-qp 0` is lossless too, but nothing
 * in the stream says so, so it is not claimed. (Apple's rpza is a 4x4 vector quantizer: lossy.)
 */
export const LOSSLESS_CODECS: ReadonlySet<string> = new Set([
  "png",
  "apng",
  "gif",
  "ffv1",
  "ffvhuff",
  "huffyuv",
  "utvideo",
  "magicyuv",
  "lagarith",
  "qtrle",
  "rawvideo",
  "zmbv",
  "msrle",
  "bmp",
  "tiff",
  "r210",
  "v210",
  "v410",
  "flashsv",
  "flashsv2",
]);

/** A decoded frame of the stream: its position, when it is shown and whether it is a keyframe. */
export interface FrameRow {
  /** Position among the frames the recording shows. */
  index: number;
  /** When it is shown, on the stream's own timeline (a stream that starts 1.25s in has its first frame at 1250). */
  atMs: number;
  key: boolean;
  /** Which decoded frame it is (its index in the decoder's output), when that differs from `index`. */
  decoded?: number;
  /** Interlaced: which field of the decoded frame (0 first in time). */
  field?: 0 | 1;
}

/** One kept frame, with the instants that asked for it (`--at`). */
export interface ChosenFrame extends FrameRow {
  instants?: number[];
}

/** A time within this of a frame's start is that frame's: decimal input against a rational timestamp. */
const ON_FRAME_MS = 1e-6;

/**
 * Which frames to keep, as asked: a span with no `toMs` runs to the end (a looping image's end is
 * the frame on screen a pass and a second past `fromMs`: every window from there on repeats one
 * before it). `scanVideo` records the end it reached in the manifest's `VideoSelection`.
 */
export type SelectionRequest =
  | { kind: "all" }
  | { kind: "span"; fromMs: number; toMs?: number; leadInMs?: number }
  | { kind: "at"; atMs: number[] };

/** The frame on screen at `t`: the last one that began at or before it, or the first frame before any began. */
export function frameAt(rows: readonly FrameRow[], t: number): number {
  let lo = 0;
  let hi = rows.length - 1;
  if (hi < 0) throw new Error("frameAt: no frames");
  if (t < rows[0]!.atMs - ON_FRAME_MS) return 0;
  while (lo < hi) {
    const mid = (lo + hi + 1) >> 1;
    if (rows[mid]!.atMs <= t + ON_FRAME_MS) lo = mid;
    else hi = mid - 1;
  }
  return lo;
}

/**
 * The frames a selection keeps, in order. `span` keeps every frame on screen at some moment of
 * [from, to]; `at` keeps the frame on screen at each instant, once, with the instants it answers.
 */
export function chooseFrames(rows: readonly FrameRow[], selection: SelectionRequest, endMs?: number): ChosenFrame[] {
  if (rows.length === 0) return [];
  if (selection.kind === "all") return rows.map((r) => ({ ...r }));
  if (selection.kind === "span") {
    const end = recordingEndMs(rows, endMs);
    if (selection.fromMs > end + ON_FRAME_MS) {
      throw new UsageError(
        `--from ${selection.fromMs}ms is after the recording ends (its last frame is on screen until ${Number(end.toFixed(3))}ms)`,
      );
    }
    const from = frameAt(rows, Math.max(0, selection.fromMs - (selection.leadInMs ?? 0)));
    const to = selection.toMs === undefined ? rows.length - 1 : frameAt(rows, selection.toMs);
    return rows.slice(from, to + 1).map((r) => ({ ...r }));
  }
  const byFrame = new Map<number, number[]>();
  for (const t of selection.atMs) {
    const k = frameAt(rows, t);
    byFrame.set(k, [...(byFrame.get(k) ?? []), t]);
  }
  return [...byFrame.entries()].sort((a, b) => a[0] - b[0]).map(([k, instants]) => ({ ...rows[k]!, instants }));
}

/**
 * When the last frame leaves the screen: `endMs` when the stream says how long it is shown, else
 * as long after it began as the gap before it (the rate it was shown at), or at once for one frame.
 */
export function recordingEndMs(rows: readonly FrameRow[], endMs?: number): number {
  const last = rows[rows.length - 1]!;
  if (endMs !== undefined && endMs > last.atMs) return endMs;
  return rows.length > 1 ? last.atMs + (last.atMs - rows[rows.length - 2]!.atMs) : last.atMs;
}

/** The largest side a recording is judged at, in CSS px: the judge keeps several arrays per CSS px. */
export const MAX_DISPLAY_PX = 4096;

/**
 * How big the frames are shown, as the frames contract states it: the viewport in CSS px and the
 * frame pixels per CSS px. A video has no page, so by default one frame pixel is one CSS pixel;
 * `displayWidth` is the width it plays at (a 1920px recording in a 1280px player is 1.5 pixels per
 * CSS px). `check flash` measures its 341x256 field and its area limit in those CSS px.
 */
export function displayGeometry(
  frame: { width: number; height: number },
  displayWidth?: number,
): { viewport: { width: number; height: number }; deviceScaleFactor: number } {
  if (displayWidth === undefined) {
    if (frame.width > MAX_DISPLAY_PX || frame.height > MAX_DISPLAY_PX) {
      throw new UsageError(
        `the frames are ${frame.width}x${frame.height}, and one frame pixel per CSS px is over the ${MAX_DISPLAY_PX} a side the judge takes: say how wide it plays, e.g. --display-width 1920`,
      );
    }
    return { viewport: { width: frame.width, height: frame.height }, deviceScaleFactor: 1 };
  }
  if (!(Number.isFinite(displayWidth) && displayWidth >= 1)) {
    throw new UsageError(`--display-width is the width the video plays at, in CSS px (got ${displayWidth})`);
  }
  const deviceScaleFactor = frame.width / displayWidth;
  const viewport = { width: displayWidth, height: Math.max(1, Math.round(frame.height / deviceScaleFactor)) };
  if (viewport.width > MAX_DISPLAY_PX || viewport.height > MAX_DISPLAY_PX) {
    throw new UsageError(
      `--display-width ${displayWidth} shows the video at ${viewport.width}x${viewport.height} CSS px; the judge works per CSS px and takes at most ${MAX_DISPLAY_PX} a side`,
    );
  }
  return { viewport, deviceScaleFactor };
}

/**
 * The filters ffmpeg 6.1's own autorotate inserts for a stream's display matrix
 * (`fftools/ffmpeg_filter.c`), for a chain that has to turn the frames itself — after splitting an
 * interlaced frame into its fields, which autorotate would otherwise turn first (a quarter turn
 * makes rows of columns, and a half turn reverses the field order). `[]` for none; null for a turn
 * that is not a quarter one, which ffmpeg does with `rotate` and black corners.
 */
export function rotationFilters(stream: Pick<VideoStream, "rotation" | "displayMatrix">): string[] | null {
  const m = stream.displayMatrix;
  if (stream.rotation === undefined && !m) return [];
  // get_rotation(): the matrix's counter-clockwise angle, negated, in [0, 360).
  let theta = -Math.round(stream.rotation ?? 0);
  theta -= 360 * Math.floor(theta / 360 + 0.9 / 360);
  if (Math.abs(theta - 90) < 1) return [`transpose=${m && m[3]! > 0 ? "cclock_flip" : "clock"}`];
  if (Math.abs(theta - 180) < 1) {
    return [...(!m || m[0]! < 0 ? ["hflip"] : []), ...(!m || m[4]! < 0 ? ["vflip"] : [])];
  }
  if (Math.abs(theta - 270) < 1) return [`transpose=${m && m[3]! < 0 ? "clock_flip" : "cclock"}`];
  if (Math.abs(theta) > 1) return null;
  return m && m[4]! < 0 ? ["vflip"] : [];
}

/** What ffprobe says about the one video stream that is decoded. */
export interface VideoStream {
  /** The stream's index in the file (ffprobe's `index`), which `-map 0:<index>` names. */
  index: number;
  codec: string;
  profile?: string;
  pixelFormat: string;
  width: number;
  height: number;
  /** `num:den`, absent when 1:1 or not stated. */
  sampleAspect?: string;
  /** Seconds per timestamp tick. */
  timeBase: { num: number; den: number };
  colorSpace?: string;
  colorRange?: string;
  colorTransfer?: string;
  colorPrimaries?: string;
  fieldOrder?: string;
  /** Degrees, from the display matrix (side data) or the legacy `rotate` tag. */
  rotation?: number;
  /** The display matrix's nine entries (16.16 fixed point, row by row), when the stream has one. */
  displayMatrix?: number[];
  /** How long the stream says it lasts (its own duration, or Matroska's DURATION tag), in ms. */
  durationMs?: number;
  container?: string;
  /**
   * The stream carries transparency: a pixel format with alpha, or a VP8/VP9 WebM whose
   * `alpha_mode` tag says so (ffprobe reports those as plain yuv420p, and only libvpx decodes it).
   */
  alpha?: "pixels" | "libvpx" | "libvpx-vp9";
}

interface ProbeStream {
  index?: number;
  codec_type?: string;
  codec_name?: string;
  profile?: string;
  pix_fmt?: string;
  width?: number;
  height?: number;
  sample_aspect_ratio?: string;
  time_base?: string;
  color_space?: string;
  color_range?: string;
  color_transfer?: string;
  color_primaries?: string;
  field_order?: string;
  duration?: string;
  disposition?: { attached_pic?: number; default?: number };
  tags?: Record<string, string>;
  side_data_list?: { side_data_type?: string; rotation?: number; displaymatrix?: string }[];
}

const stated = (value: string | undefined): string | undefined =>
  value === undefined || value === "" || value === "unknown" || value === "unspecified" ? undefined : value;

function ratio(raw: string | undefined, sep: string): { num: number; den: number } | null {
  const m = raw?.match(new RegExp(`^(\\d+)${sep}(\\d+)$`));
  if (!m) return null;
  const num = Number(m[1]);
  const den = Number(m[2]);
  return num > 0 && den > 0 ? { num, den } : null;
}

const ALPHA_FORMAT = /^(yuva|rgba|bgra|argb|abgr|gbrap|ya8|ya16|pal8$)/;

/**
 * The video stream to decode from `ffprobe -show_streams -show_format -of json`: the one asked for
 * by index, else not cover art (`attached_pic`), with a size, the default-disposition one first,
 * then the largest. That is not ffmpeg's own choice — ffmpeg 6.1 takes a larger non-default stream
 * over a smaller default one (measured) — but the stream a file marks as the one to play. It is mapped by its absolute index:
 * `-map 0:v:0` is the first by index, which in an mkv can be a one-frame cover track. Refuses a
 * file with none, listing what it holds.
 */
export function pickVideoStream(probeJson: string, file: string, wanted?: number): VideoStream {
  let probe: { streams?: ProbeStream[]; format?: { format_name?: string } };
  try {
    probe = JSON.parse(probeJson);
  } catch {
    throw new Error(`ffprobe printed something that is not JSON for ${file}`);
  }
  const streams = probe.streams ?? [];
  const listing =
    streams
      .map(
        (s) =>
          `#${s.index} ${s.codec_type ?? "?"} ${s.codec_name ?? "(no decoder)"}${s.disposition?.attached_pic ? " cover art" : ""}`,
      )
      .join(", ") || "none";
  const candidates = streams
    .filter(
      (s) => s.codec_type === "video" && !s.disposition?.attached_pic && (s.width ?? 0) > 0 && (s.height ?? 0) > 0,
    )
    .sort(
      (a, b) =>
        (b.disposition?.default ?? 0) - (a.disposition?.default ?? 0) ||
        (b.width ?? 0) * (b.height ?? 0) - (a.width ?? 0) * (a.height ?? 0) ||
        (a.index ?? 0) - (b.index ?? 0),
    );
  const stream =
    wanted === undefined ? candidates[0] : streams.find((s) => s.index === wanted && s.codec_type === "video");
  if (!stream) {
    throw new UsageError(
      wanted === undefined
        ? `${file} holds no video stream to decode (streams: ${listing})`
        : `${file} has no video stream #${wanted} (streams: ${listing}); --stream takes a video stream's index`,
    );
  }
  if (!stream.codec_name) {
    throw new UsageError(`${file}: this ffmpeg has no decoder for video stream #${stream.index} (streams: ${listing})`);
  }
  const timeBase = ratio(stream.time_base, "/");
  if (!timeBase || !stream.width || !stream.height) {
    throw new UsageError(`${file}: ffprobe gives video stream #${stream.index} no size or time base`);
  }
  const sar = ratio(stream.sample_aspect_ratio, ":");
  const matrix = stream.side_data_list?.find(
    (d) => d.side_data_type === "Display Matrix" && typeof d.rotation === "number",
  );
  const rotateTag = stream.tags?.rotate !== undefined ? Number(stream.tags.rotate) : undefined;
  const rotation = matrix?.rotation ?? (Number.isFinite(rotateTag) ? rotateTag : undefined);
  // ffprobe prints it as three `00000000:  a  b  u` rows.
  const entries = (matrix?.displaymatrix ?? "")
    .split("\n")
    .flatMap((row) =>
      row
        .replace(/^\s*[0-9a-f]+:/i, "")
        .trim()
        .split(/\s+/)
        .filter(Boolean),
    )
    .map(Number);
  const displayMatrix = entries.length === 9 && entries.every(Number.isFinite) ? entries : undefined;
  const tagged = stream.tags?.DURATION?.match(/^(\d+):(\d+):(\d+(?:\.\d+)?)$/);
  const seconds = tagged
    ? Number(tagged[1]) * 3600 + Number(tagged[2]) * 60 + Number(tagged[3])
    : stream.duration !== undefined
      ? Number(stream.duration)
      : Number.NaN;
  const pixelFormat = stream.pix_fmt ?? "unknown";
  const alpha =
    stream.tags?.alpha_mode === "1" && (stream.codec_name === "vp9" || stream.codec_name === "vp8")
      ? stream.codec_name === "vp9"
        ? "libvpx-vp9"
        : "libvpx"
      : ALPHA_FORMAT.test(pixelFormat)
        ? "pixels"
        : undefined;
  return {
    index: stream.index ?? 0,
    codec: stream.codec_name,
    ...(stated(stream.profile) ? { profile: stream.profile } : {}),
    pixelFormat,
    width: stream.width,
    height: stream.height,
    ...(sar && sar.num !== sar.den ? { sampleAspect: `${sar.num}:${sar.den}` } : {}),
    timeBase,
    ...(stated(stream.color_space) ? { colorSpace: stream.color_space } : {}),
    ...(stated(stream.color_range) ? { colorRange: stream.color_range } : {}),
    ...(stated(stream.color_transfer) ? { colorTransfer: stream.color_transfer } : {}),
    ...(stated(stream.color_primaries) ? { colorPrimaries: stream.color_primaries } : {}),
    ...(stated(stream.field_order) && stream.field_order !== "progressive" ? { fieldOrder: stream.field_order } : {}),
    ...(rotation ? { rotation } : {}),
    ...(displayMatrix ? { displayMatrix } : {}),
    ...(Number.isFinite(seconds) && seconds > 0 ? { durationMs: seconds * 1000 } : {}),
    ...(probe.format?.format_name ? { container: probe.format.format_name } : {}),
    ...(alpha ? { alpha } : {}),
  };
}

/** A frame as ffprobe lists it, its timestamp still in ticks. */
export interface ProbedFrame {
  index: number;
  /** `best_effort_timestamp`, in the stream's time base: what ffmpeg itself gives a decoded frame as its pts. */
  ticks: number;
  key: boolean;
  /** The decoder marked it interlaced (two fields woven into one frame). */
  interlaced?: boolean;
  /** Its decoded size, before rotation. */
  width?: number;
  height?: number;
  /** How long it is shown, in the stream's time base, when the stream says (a packet duration). */
  durationTicks?: number;
}

/**
 * `ffprobe -show_entries frame=best_effort_timestamp,key_frame,interlaced_frame -of json`: every
 * decoded frame, in the order the decoder outputs them, which is the order they are shown. A frame
 * without a timestamp cannot be placed and is refused; the order is checked by `videoTimeline`
 * (a timestamp that goes back is refused, an equal one hides the frame before it).
 */
export function parseFrameTable(framesJson: string, file: string): ProbedFrame[] {
  let parsed: {
    frames?: {
      best_effort_timestamp?: number;
      pts?: number;
      duration?: number;
      pkt_duration?: number;
      key_frame?: number;
      interlaced_frame?: number;
      width?: number;
      height?: number;
    }[];
  };
  try {
    parsed = JSON.parse(framesJson);
  } catch {
    throw new Error(`ffprobe printed something that is not JSON for ${file}'s frames`);
  }
  const frames = parsed.frames ?? [];
  if (frames.length === 0) throw new UsageError(`${file}: the video stream decodes to no frames`);
  return frames.map((f, index) => {
    const ticks = f.best_effort_timestamp ?? f.pts;
    if (typeof ticks !== "number" || !Number.isFinite(ticks)) {
      throw new UsageError(
        `${file}: decoded frame ${index} has no timestamp, so when it is shown is not known (a raw elementary stream carries none). ` +
          `Re-encode it losslessly at its rate first (a copy cannot give reordered frames a time), e.g. ffmpeg -r 30 -i ${file} -c:v ffv1 timed.mkv`,
      );
    }
    return {
      index,
      ticks,
      key: f.key_frame === 1,
      ...(f.interlaced_frame === 1 ? { interlaced: true } : {}),
      ...(f.width && f.height ? { width: f.width, height: f.height } : {}),
      ...((f.duration ?? f.pkt_duration ?? 0) > 0 ? { durationTicks: (f.duration ?? f.pkt_duration)! } : {}),
    };
  });
}

/** What a recording shows, frame by frame, and what was done to the decoder's frames to get it. */
export interface StreamTimeline {
  rows: FrameRow[];
  /** Decoded frames never on screen: each shares its timestamp with the next, which replaces it at once. */
  hidden: number;
  /** A GIF / APNG: its frames held as a browser holds them, and looped as it loops. */
  timing?: "browser";
  loop?: { plays: number | null; passFrames: number; passMs: number; passes: number };
  /** Interlaced: each split frame is two rows, its fields, at twice the frame rate. */
  fields?: boolean;
  /** How many decoded frames were split (a stream can mix progressive and interlaced frames). */
  splitFrames?: number;
  /** When the last frame leaves the screen, when the stream says how long it is shown. */
  endMs?: number;
}

/**
 * The frames a video shows, at their presentation times on the stream's own timeline — the one a
 * browser's `video.currentTime` counts (measured: a video that starts 0.7s in shows frame 9 at
 * 1.0s, not frame 30), so `--at 1s` is the frame a player shows at 1s. A frame is dropped when the
 * next one begins at the same instant (the one on screen then is the later; measured:
 * `-fps_mode passthrough` keeps both, and a recording with 0, 0, 0, 33, 33ms exists). Timestamps
 * that go back are refused. A frame `split` says is interlaced is its two fields: the second
 * halfway to the next frame, so a flicker at field rate is in the sequence (woven, it was a still
 * comb, measured); a progressive one, in the same stream, is one row.
 */
export function videoTimeline(
  frames: readonly ProbedFrame[],
  timeBase: { num: number; den: number },
  file: string,
  options: { split?: (frame: ProbedFrame) => boolean } = {},
): StreamTimeline {
  const ms = (ticks: number) => (ticks * 1000 * timeBase.num) / timeBase.den;
  // A timeline that would start before 0 (negative timestamps) is moved to start at 0.
  const origin = Math.min(0, ms(frames[0]!.ticks));
  const shown: { f: ProbedFrame; at: number }[] = [];
  let hidden = 0;
  for (const [i, f] of frames.entries()) {
    const next = frames[i + 1];
    if (next && next.ticks < f.ticks) {
      throw new UsageError(
        `${file}: decoded frame ${i + 1} is shown before frame ${i} (timestamps ${f.ticks}, ${next.ticks}): its frames cannot be put in time order`,
      );
    }
    if (next && next.ticks === f.ticks) {
      hidden++;
      continue;
    }
    shown.push({ f, at: ms(f.ticks) - origin });
  }
  const split = shown.length > 1 ? options.split : undefined;
  let splitFrames = 0;
  const rows: FrameRow[] = [];
  for (const [k, { f, at }] of shown.entries()) {
    const fields = split?.(f) === true;
    rows.push({ index: rows.length, atMs: at, key: f.key, decoded: f.index, ...(fields ? { field: 0 as const } : {}) });
    if (fields) {
      splitFrames++;
      // Halfway to the next frame; the last frame's second field is as far after it as the gap before.
      const gap = k + 1 < shown.length ? shown[k + 1]!.at - at : at - shown[k - 1]!.at;
      rows.push({ index: rows.length, atMs: at + gap / 2, key: false, decoded: f.index, field: 1 });
    }
  }
  const last = shown[shown.length - 1]!;
  const endMs = last.f.durationTicks !== undefined ? last.at + ms(last.f.durationTicks) : undefined;
  return {
    rows,
    hidden,
    ...(splitFrames > 0 ? { fields: true, splitFrames } : {}),
    ...(endMs !== undefined ? { endMs } : {}),
  };
}

/** Rows a looping image is unrolled to at most: past that, an instant is too far into the loop to write out. */
export const MAX_LOOP_ROWS = 100_000;

/**
 * The frames an animated GIF / APNG shows in a browser: each held for its stored delay, or 100ms
 * when that is 10ms or less (Chromium 141 and 149, measured), and the animation repeated as the
 * browser repeats it, as long as it plays. Unrolled up to `untilMs` — by default one pass and a
 * second more, which holds every one-second window of a loop — so an instant or a span further on
 * is the frame the loop has reached there, never the last one written. An APNG plays the frames
 * its `acTL` declares, when it holds more (measured: Chromium never showed a third `fcTL` frame of
 * an `acTL` saying two). Null when the file's own frame count is not the decoder's, or an APNG
 * declares more than it holds.
 */
export function imageTimeline(
  decoded: readonly ProbedFrame[],
  timing: ImageTiming,
  untilMs?: number,
): StreamTimeline | null {
  if (timing.storedMs.length !== decoded.length || decoded.length === 0) return null;
  const declared = timing.declaredFrames;
  if (declared !== undefined && (declared < 1 || declared > decoded.length)) return null;
  const n = declared ?? decoded.length;
  const delays = timing.storedMs.slice(0, n).map(browserDelayMs);
  const passMs = delays.reduce((a, b) => a + b, 0);
  const until = n > 1 ? Math.max(untilMs ?? 0, passMs + 1000) : 0;
  const plays = timing.plays ?? Number.POSITIVE_INFINITY;
  const rows: FrameRow[] = [];
  let at = 0;
  for (let p = 0; p < plays; p++) {
    for (let k = 0; k < n; k++) {
      // Stop at the first frame that begins past `until`, once every frame has been shown once.
      if (rows.length >= n && at > until) break;
      if (rows.length >= MAX_LOOP_ROWS) {
        throw new UsageError(
          `an instant ${Math.round(until)}ms into a looping image is more than ${MAX_LOOP_ROWS} of its frames away; the loop repeats every ${Math.round(passMs)}ms, so ask for one within its first passes`,
        );
      }
      rows.push({ index: rows.length, atMs: at, key: decoded[k]!.key, decoded: decoded[k]!.index });
      at += delays[k]!;
    }
    if (rows.length >= n && at > until) break;
  }
  return {
    rows,
    hidden: 0,
    timing: "browser",
    loop: { plays: timing.plays, passFrames: n, passMs, passes: Math.ceil(rows.length / n) },
  };
}

/** One `showinfo` line: the frame the filter graph handed on, as written. */
export interface ShowinfoFrame {
  /** The instance's name (`showinfo@<name>`), when the graph named it. */
  instance?: string;
  n: number;
  pts: number;
  width: number;
  height: number;
  key?: boolean;
}

/** showinfo's own prefix: a recording's metadata printed at info level must not read as a frame. */
// The pointer is printed with %p: `0x55…` on glibc, bare uppercase hex on Windows.
// With `-loglevel level+info`, the level follows the prefix: `[showinfo@frames @ 0x…] [info] n: …`.
const SHOWINFO_LINE = /^\[(?:Parsed_showinfo_\d+|showinfo@(\w+)) @ (?:0x)?[0-9a-fA-F]+\] (?:\[info\] )?(.*)$/;
const SHOWINFO_FRAME = /^n:\s*(\d+)\s+pts:\s*(-?\d+)\b.*?\bs:(\d+)x(\d+)(?:.*?\biskey:([01]))?/;
const SHOWINFO_CONFIG = /^config in time_base:\s*(\d+)\/(\d+)/;

/** A line of ffmpeg's stderr: a showinfo frame, the time base showinfo counts in, or neither. */
export function parseShowinfoLine(
  line: string,
): { frame: ShowinfoFrame } | { timeBase: { num: number; den: number }; instance?: string } | null {
  const prefix = line.match(SHOWINFO_LINE);
  if (!prefix) return null;
  const instance = prefix[1];
  const body = prefix[2]!;
  const named = instance !== undefined ? { instance } : {};
  const config = body.match(SHOWINFO_CONFIG);
  if (config) return { timeBase: { num: Number(config[1]), den: Number(config[2]) }, ...named };
  const m = body.match(SHOWINFO_FRAME);
  if (!m) return null;
  return {
    frame: {
      ...named,
      n: Number(m[1]),
      pts: Number(m[2]),
      width: Number(m[3]),
      height: Number(m[4]),
      ...(m[5] !== undefined ? { key: m[5] === "1" } : {}),
    },
  };
}

/** HDR transfers: relative luminance, which WCAG 2.3.1's thresholds are written in, is an SDR quantity. */
const HDR_TRANSFERS = new Set(["smpte2084", "arib-std-b67"]);

/** swscale's names for the YUV matrices ffprobe reports. */
const MATRIX_FOR: Record<string, string> = {
  bt709: "bt709",
  smpte170m: "smpte170m",
  bt470bg: "bt470",
  bt2020nc: "bt2020",
  bt2020c: "bt2020",
  fcc: "fcc",
  smpte240m: "smpte240m",
};

/** The matrices `--color-matrix` takes: swscale's own names. */
export const COLOR_MATRICES: readonly string[] = ["bt601", "bt709", "bt2020", "smpte170m", "bt470", "fcc", "smpte240m"];

/** Primaries an sRGB display shows without a gamut conversion (BT.601's are close enough to be read as one). */
const SRGB_PRIMARIES = new Set(["bt709", "smpte170m"]);

const isRgbFormat = (pixelFormat: string) =>
  /^(rgb|bgr|argb|abgr|rgba|bgra|gbr|pal8|gray|ya|monob|monow|x?rgb)/.test(pixelFormat);

/**
 * Codecs whose grey frames are a YUV stream's luma alone (AV1 Main 4:0:0, HEVC RExt, H.264 High
 * 4:0:0): limited range unless tagged otherwise, as their colour is. A grey PNG, GIF or FFV1 frame
 * is a picture's own grey levels.
 */
const LUMA_GRAY_CODECS = new Set(["h264", "hevc", "av1", "vvc", "vp9", "mpeg4", "jpeg2000"]);

export interface ColorPlan {
  /** `scale` options for the YUV to RGB step (matrix, range, and the rounding that holds them to ±1); empty for RGB frames. */
  scale: string;
  /**
   * A filter before that step: luma-only frames become YUV with neutral chroma first, since
   * swscale converts grey to RGB without applying a range (measured: limited 16 stayed 16).
   */
  before?: string;
  color: NonNullable<FramesVideo["color"]>;
  /** What the conversion did not do, for the reader. */
  notes: string[];
}

/**
 * The conversion to 8-bit sRGB, stated rather than left to the decoder's default (measured with
 * ffmpeg 6.1, `docs/reports/2026-10-13-scan-video-v1.md`):
 *
 * - A tagged matrix and range are the stream's own word and are used.
 * - An untagged matrix is BT.601, and an untagged range limited: ffmpeg's own default at every
 *   size, Chromium's for VP9 at every size, and what ffmpeg's encoder and Playwright's recordVideo
 *   write. Chrome guesses BT.709 for untagged H.264 from 720 lines up, and that guess misreads
 *   ffmpeg's default 720p output by 39 levels, so it is not copied. What was assumed is recorded,
 *   and `--color-matrix` / `--color-range` override it: a wrong matrix flipped a green strobe's
 *   verdict (ΔL 0.229 read as 0.019).
 * - `accurate_rnd+full_chroma_int` holds tagged colours to ±1 level (0 on 10-bit); the default
 *   rounding errs by 2 to 3, and `accurate_rnd` alone by more.
 * - An HDR transfer is refused: ffmpeg passes PQ and HLG code values through as if SDR.
 */
export function colorPlan(
  stream: VideoStream,
  file: string,
  override: { matrix?: string; range?: "tv" | "pc" } = {},
): ColorPlan {
  if (stream.colorTransfer && HDR_TRANSFERS.has(stream.colorTransfer)) {
    throw new UsageError(
      `${file} is HDR (transfer ${stream.colorTransfer}): WCAG 2.3.1's luminance thresholds are for SDR, and ffmpeg passes HDR code values through as if they were SDR (100-nit white lands near 130/255). ` +
        "Tone-map it to the SDR version you publish and scan that, e.g. " +
        `ffmpeg -i ${file} -vf zscale=t=linear:npl=100,format=gbrpf32le,zscale=p=bt709,tonemap=hable,zscale=t=bt709:m=bt709:r=tv,format=yuv420p sdr.mp4 (zscale needs an ffmpeg built with libzimg)`,
    );
  }
  if (override.matrix !== undefined && !COLOR_MATRICES.includes(override.matrix)) {
    throw new UsageError(`--color-matrix is one of ${COLOR_MATRICES.join(", ")} (got ${override.matrix})`);
  }
  const notes: string[] = [];
  if (stream.colorPrimaries && !SRGB_PRIMARIES.has(stream.colorPrimaries)) {
    notes.push(`primaries ${stream.colorPrimaries} shown as sRGB: the gamut is not converted`);
  }
  const extra = {
    ...(stream.colorTransfer ? { transfer: stream.colorTransfer } : {}),
    ...(stream.colorPrimaries ? { primaries: stream.colorPrimaries } : {}),
  };
  const lumaOnly = /^gray/.test(stream.pixelFormat) && LUMA_GRAY_CODECS.has(stream.codec);
  if (lumaOnly) {
    const assumedRange: string[] = [];
    let range: "tv" | "pc";
    if (override.range) range = override.range;
    else if (stream.colorRange === "pc" || stream.colorRange === "tv") range = stream.colorRange;
    else {
      range = "tv";
      assumedRange.push("range");
    }
    return {
      before: /^gray$/.test(stream.pixelFormat) ? "format=yuv444p" : "format=yuv444p16le",
      scale: `in_color_matrix=bt601:in_range=${range}:flags=accurate_rnd+full_chroma_int`,
      color: { matrix: "gray", range, ...extra, assumed: assumedRange },
      notes,
    };
  }
  if (isRgbFormat(stream.pixelFormat)) {
    return { scale: "", color: { matrix: "rgb", range: "pc", ...extra, assumed: [] }, notes };
  }
  const assumed: string[] = [];
  if (!override.matrix && stream.colorSpace && !MATRIX_FOR[stream.colorSpace] && stream.colorSpace !== "gbr") {
    throw new UsageError(
      `${file} is tagged with the ${stream.colorSpace} matrix, which this conversion cannot apply: say which to read it with, --color-matrix ${COLOR_MATRICES.join(" | ")}`,
    );
  }
  let matrix = override.matrix ?? (stream.colorSpace ? MATRIX_FOR[stream.colorSpace] : undefined);
  if (!matrix) {
    matrix = "bt601";
    assumed.push("matrix");
    if (stream.colorPrimaries === "bt709" || stream.colorTransfer === "bt709") {
      notes.push(
        "the stream tags BT.709 primaries or transfer but no matrix (a WebM container can say BT.709 where ffprobe cannot see it): if it was encoded as BT.709, pass --color-matrix bt709",
      );
    }
  }
  let range: "tv" | "pc";
  if (override.range) range = override.range;
  else if (stream.colorRange === "pc" || stream.colorRange === "tv") range = stream.colorRange;
  else if (/^yuvj/.test(stream.pixelFormat)) range = "pc";
  else {
    range = "tv";
    assumed.push("range");
  }
  return {
    scale: `in_color_matrix=${matrix}:in_range=${range}:flags=accurate_rnd+full_chroma_int`,
    color: { matrix, range, ...extra, assumed },
    notes,
  };
}

/** What `-vf` does to each decoded frame, in order. Pure, so the chain is tested without ffmpeg. */
export interface FilterPlan {
  /** `select='…'` on decoded indices, or null for every frame. */
  select: string | null;
  /** Split each frame into its two fields, each line-doubled back to the frame's height. */
  fields: boolean;
  /** Turn the frames (after the field split), for a decode that runs with `-autorotate 0`. */
  rotate?: readonly string[];
  /** The showinfo instance's name, so two graphs in one run are told apart. */
  name?: string;
  color: ColorPlan;
  /** Composite transparent pixels over this, not drop the alpha (which shows the colour under them). */
  alpha?: { background: "white" | "black" };
  /** Resample non-square pixels to square (in RGB, nearest: exact, no blended colours). */
  sampleAspect: boolean;
}

/**
 * The filter chain. Measured, each step's place: `select` first (it counts decoded frames);
 * fields split before the colour conversion, and the line-doubling's doubled sample aspect undone
 * (`scale` keeps the display aspect, so an 8:9 field came out 16:9 and the frame twice as wide);
 * then the turn, if the chain does it; alpha composited after the conversion, by premultiplying (over
 * black) or by premultiplying the negative and negating back (over white), so every frame keeps its
 * timestamp — an `overlay` on a colour source would take that source's constant rate; the SAR
 * resample after RGB, nearest, since bicubic in YUV blended a red/blue edge into (197,0,52); the
 * colour tags and an ICC profile stripped only after `format=rgb24` (before it, the matrix falls
 * back to BT.601); and showinfo without its checksums, which doubled the cost of a 1080p decode.
 */
export function filterChain(plan: FilterPlan): string {
  const rgb = plan.alpha ? "format=rgba" : "format=rgb24";
  const composite = plan.alpha
    ? plan.alpha.background === "black"
      ? ["premultiply=inplace=1", "format=rgb24"]
      : ["negate", "premultiply=inplace=1", "negate", "format=rgb24"]
    : [];
  return [
    plan.select,
    ...(plan.fields ? ["separatefields", "scale=w=iw:h=ih*2:flags=neighbor", "setsar=r=sar/2:max=10000"] : []),
    ...(plan.rotate ?? []),
    plan.color.before ?? null,
    plan.color.scale ? `scale=${plan.color.scale}` : null,
    rgb,
    ...composite,
    ...(plan.sampleAspect
      ? ["scale=w='if(gte(sar,1),iw*sar,iw)':h='if(gte(sar,1),ih,ih/sar)':flags=neighbor", "setsar=1"]
      : []),
    "setparams=color_primaries=unknown:color_trc=unknown:colorspace=unknown",
    "sidedata=mode=delete:type=ICC_PROFILE",
    plan.name ? `showinfo@${plan.name}=checksum=0` : "showinfo=checksum=0",
  ]
    .filter(Boolean)
    .join(",");
}
