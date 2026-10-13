/**
 * The pure half of loading a recording through a decoder the user supplies (`vlmkit scan video`):
 * which frames to keep, how big the frames are shown, and which codecs reproduce their input.
 * No process and no file: `video-decode.ts` runs the user's own ffmpeg and ffprobe and brings
 * their output here.
 */
import { UsageError } from "@mizchi/vlmkit-judge/errors.ts";
import type { FramesVideo, VideoSelection } from "@mizchi/vlmkit-judge/frames.ts";
import { browserDelayMs, type ImageTiming } from "./image-timing.ts";

/**
 * Codecs whose decoded frames are what was encoded, bit for bit (modulo a chroma subsampling the
 * encoder chose). Anything else is treated as lossy: x264 at `-qp 0` is lossless too, but nothing
 * in the stream says so, so it is not claimed.
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
  "rpza",
  "msrle",
  "bmp",
  "tiff",
  "r210",
  "v210",
  "v410",
  "flashsv",
  "flashsv2",
]);

/** A decoded frame of the stream: its position, when it is shown (from the first frame) and whether it is a keyframe. */
export interface FrameRow {
  /** Position among the frames the recording shows. */
  index: number;
  atMs: number;
  key: boolean;
  /** Which decoded frame it is (its index in the decoder's output), when that differs from `index`. */
  decoded?: number;
}

/** One kept frame, with the instants that asked for it (`--at`). */
export interface ChosenFrame extends FrameRow {
  instants?: number[];
}

/** A time within this of a frame's start is that frame's: decimal input against a rational timestamp. */
const ON_FRAME_MS = 1e-6;

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
export function chooseFrames(rows: readonly FrameRow[], selection: VideoSelection): ChosenFrame[] {
  if (rows.length === 0) return [];
  if (selection.kind === "all") return rows.map((r) => ({ ...r }));
  if (selection.kind === "span") {
    const last = rows[rows.length - 1]!;
    if (selection.fromMs > last.atMs + ON_FRAME_MS) {
      throw new UsageError(
        `--from ${selection.fromMs}ms is after the recording's last frame (${Number(last.atMs.toFixed(3))}ms)`,
      );
    }
    return rows.slice(frameAt(rows, selection.fromMs), frameAt(rows, selection.toMs) + 1).map((r) => ({ ...r }));
  }
  const byFrame = new Map<number, number[]>();
  for (const t of selection.atMs) {
    const k = frameAt(rows, t);
    byFrame.set(k, [...(byFrame.get(k) ?? []), t]);
  }
  return [...byFrame.entries()].sort((a, b) => a[0] - b[0]).map(([k, instants]) => ({ ...rows[k]!, instants }));
}

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
    return { viewport: { width: frame.width, height: frame.height }, deviceScaleFactor: 1 };
  }
  if (!(Number.isFinite(displayWidth) && displayWidth >= 1)) {
    throw new UsageError(`--display-width is the width the video plays at, in CSS px (got ${displayWidth})`);
  }
  const deviceScaleFactor = frame.width / displayWidth;
  return {
    viewport: { width: displayWidth, height: Math.max(1, Math.round(frame.height / deviceScaleFactor)) },
    deviceScaleFactor,
  };
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
  container?: string;
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
  disposition?: { attached_pic?: number };
  tags?: Record<string, string>;
  side_data_list?: { side_data_type?: string; rotation?: number }[];
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

/**
 * The video stream to decode from `ffprobe -show_streams -show_format -of json`: the one asked for
 * by index, else the first that is not cover art (`attached_pic`). Refuses a file with none,
 * listing what it holds.
 */
export function pickVideoStream(probeJson: string, file: string, wanted?: number): VideoStream {
  let probe: { streams?: ProbeStream[]; format?: { format_name?: string } };
  try {
    probe = JSON.parse(probeJson);
  } catch {
    throw new Error(`ffprobe printed something that is not JSON for ${file}`);
  }
  const streams = probe.streams ?? [];
  const listing = streams.map((s) => `#${s.index} ${s.codec_type ?? "?"} ${s.codec_name ?? "?"}`).join(", ") || "none";
  const isVideo = (s: ProbeStream) => s.codec_type === "video" && !s.disposition?.attached_pic;
  const stream =
    wanted === undefined ? streams.find(isVideo) : streams.find((s) => s.index === wanted && s.codec_type === "video");
  if (!stream) {
    throw new UsageError(
      wanted === undefined
        ? `${file} holds no video stream to decode (streams: ${listing})`
        : `${file} has no video stream #${wanted} (streams: ${listing}); --stream takes a video stream's index`,
    );
  }
  const timeBase = ratio(stream.time_base, "/");
  if (!timeBase || !stream.width || !stream.height || !stream.codec_name) {
    throw new UsageError(`${file}: ffprobe gives video stream #${stream.index} no size, codec or time base`);
  }
  const sar = ratio(stream.sample_aspect_ratio, ":");
  const matrix = stream.side_data_list?.find(
    (d) => d.side_data_type === "Display Matrix" && typeof d.rotation === "number",
  );
  const rotateTag = stream.tags?.rotate !== undefined ? Number(stream.tags.rotate) : undefined;
  const rotation = matrix?.rotation ?? (Number.isFinite(rotateTag) ? rotateTag : undefined);
  return {
    index: stream.index ?? 0,
    codec: stream.codec_name,
    ...(stated(stream.profile) ? { profile: stream.profile } : {}),
    pixelFormat: stream.pix_fmt ?? "unknown",
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
    ...(probe.format?.format_name ? { container: probe.format.format_name } : {}),
  };
}

/** A frame as ffprobe lists it, its timestamp still in ticks. */
export interface ProbedFrame {
  index: number;
  /** `best_effort_timestamp`, in the stream's time base: what ffmpeg itself gives a decoded frame as its pts. */
  ticks: number;
  key: boolean;
}

/**
 * `ffprobe -show_entries frame=best_effort_timestamp,key_frame -of json`: every decoded frame, in
 * the order the decoder outputs them, which is the order they are shown. A frame without a
 * timestamp cannot be placed and is refused, as is one that does not come after the one before.
 */
export function parseFrameTable(framesJson: string, file: string): ProbedFrame[] {
  let parsed: { frames?: { best_effort_timestamp?: number; pts?: number; key_frame?: number }[] };
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
          `Put it in a container at its rate first, e.g. ffmpeg -r 30 -i ${file} -c copy timed.mkv`,
      );
    }
    return { index, ticks, key: f.key_frame === 1 };
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
}

/**
 * The frames a video shows, in ms from the first: the decoder's timestamps, a frame dropped when
 * the next one begins at the same instant (the one on screen then is the later; measured: `-fps_mode
 * passthrough` keeps both, and a recording with 0, 0, 0, 33, 33ms exists). Timestamps that go back
 * are refused.
 */
export function videoTimeline(
  frames: readonly ProbedFrame[],
  timeBase: { num: number; den: number },
  file: string,
): StreamTimeline {
  const t0 = frames[0]!.ticks;
  const rows: FrameRow[] = [];
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
    rows.push({
      index: rows.length,
      atMs: ((f.ticks - t0) * 1000 * timeBase.num) / timeBase.den,
      key: f.key,
      decoded: f.index,
    });
  }
  return { rows, hidden };
}

/**
 * The frames an animated GIF / APNG shows in a browser: each held for its stored delay, or 100ms
 * when that is 10ms or less (Chromium 141 and 149, measured), and the animation repeated as the
 * browser repeats it — as many passes as it plays, at most enough to cover one pass and one second
 * more, since every one-second window of a loop is then in the sequence. Null when the file's own
 * frame count is not the decoder's (then the decoder's timing stands).
 */
export function imageTimeline(decoded: readonly ProbedFrame[], timing: ImageTiming): StreamTimeline | null {
  const n = decoded.length;
  if (timing.storedMs.length !== n || n === 0) return null;
  const delays = timing.storedMs.map(browserDelayMs);
  const passMs = delays.reduce((a, b) => a + b, 0);
  const cover = n > 1 ? 1 + Math.ceil(1000 / passMs) : 1;
  const passes = timing.plays === null ? cover : Math.max(1, Math.min(timing.plays, cover));
  const rows: FrameRow[] = [];
  for (let p = 0; p < passes; p++) {
    let at = p * passMs;
    for (let k = 0; k < n; k++) {
      rows.push({ index: rows.length, atMs: at, key: decoded[k]!.key, decoded: decoded[k]!.index });
      at += delays[k]!;
    }
  }
  return { rows, hidden: 0, timing: "browser", loop: { plays: timing.plays, passFrames: n, passMs, passes } };
}

/** One `showinfo` line: the frame the filter graph handed on, as written. */
export interface ShowinfoFrame {
  n: number;
  pts: number;
  width: number;
  height: number;
  key?: boolean;
}

const SHOWINFO_FRAME = /\bn:\s*(\d+)\s+pts:\s*(-?\d+)\b.*?\bs:(\d+)x(\d+)(?:.*?\biskey:([01]))?/;
const SHOWINFO_CONFIG = /\bconfig in time_base:\s*(\d+)\/(\d+)/;

/** A line of ffmpeg's stderr: a showinfo frame, the time base showinfo counts in, or neither. */
export function parseShowinfoLine(
  line: string,
): { frame: ShowinfoFrame } | { timeBase: { num: number; den: number } } | null {
  if (!line.includes("showinfo")) return null;
  const config = line.match(SHOWINFO_CONFIG);
  if (config) return { timeBase: { num: Number(config[1]), den: Number(config[2]) } };
  const m = line.match(SHOWINFO_FRAME);
  if (!m) return null;
  return {
    frame: {
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

export interface ColorPlan {
  /** `scale` options for the YUV to RGB step (matrix, range, and the rounding that holds them to ±1). */
  scale: string;
  color: NonNullable<FramesVideo["color"]>;
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
      `${file} is HDR (transfer ${stream.colorTransfer}): WCAG 2.3.1's luminance thresholds are for SDR, and ffmpeg passes HDR code values through as if they were SDR. ` +
        "Tone-map it to the SDR version you publish and scan that, e.g. " +
        `ffmpeg -i ${file} -vf zscale=t=linear:npl=100,format=gbrpf32le,zscale=p=bt709,tonemap=hable,zscale=t=bt709:m=bt709:r=tv,format=yuv420p sdr.mp4`,
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
  if (isRgbFormat(stream.pixelFormat)) {
    return {
      scale: "",
      color: { matrix: "rgb", range: "pc", ...extra, assumed: [], ...(notes.length ? { notes } : {}) },
    };
  }
  const assumed: string[] = [];
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
    color: { matrix, range, ...extra, assumed, ...(notes.length ? { notes } : {}) },
  };
}
