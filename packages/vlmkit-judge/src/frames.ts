/**
 * `vlmkit-frames/1`: a numbered sequence of screenshots and the times they show.
 *
 * Every command that captures a page at several instants writes the same thing: one PNG per
 * frame, named so a shell glob sorts them in time order, and a `frames.json` beside them that
 * says what each frame is. `snapshot strip --manifest` reads it back, and so can anything else —
 * a model handed the files in order sees `n` as its image index (the zoom loop's `Image i`).
 *
 * The time a frame shows is the key, not its file name or its position: two runs at the same
 * instants give the same names, and a strip plays the real gaps between frames instead of an
 * even beat.
 *
 * Pure: names, the time-list grammar, thinning and validation. The captures are the callers'.
 */
import { UsageError } from "./errors.ts";

export const FRAMES_FORMAT = "vlmkit-frames/1";

/** The held page clock's frame: `requestAnimationFrame` at 60fps, frame n at `(n * 1000) / 60`. */
export const frameTimeMs = (n: number): number => (n * 1000) / 60;

/** An instant for a reader: whole ms as they are, a fractional one (`1f` = 16.666…) to 0.01ms. */
export const formatInstant = (ms: number): string =>
  Number.isInteger(ms) ? String(ms) : String(Number(ms.toFixed(2)));

/** A sequence longer than this is refused rather than captured: it is a typo in a range. */
export const MAX_FRAMES = 1000;

export interface FrameEntry {
  /** 0-based position in the sequence: the image index a reader is given. */
  n: number;
  /** The PNG, relative to `frames.json`. */
  file: string;
  /** The instant the frame shows, in ms on the sequence's clock (see `FramesSource.clock`). */
  atMs: number;
  /** What the frame is when a time alone does not say: `rest`, a step's name. */
  label?: string;
  /**
   * False when two consecutive captures never agreed: something on the page moves outside what
   * the capture holds (a `<video>`, an animated image, a worker, or with the wall clock a script).
   * The frame is still written; it is one moment of that motion, not a measurement of the instant.
   */
  stable: boolean;
  /** Wall clock only: when the frame was actually shot, in ms after the sequence's anchor. */
  shotMs?: number;
  /**
   * Stream clock only: the frame's position among the frames the recording shows, from 0 — a
   * decoded frame hidden behind a successor with its timestamp is not counted, an interlaced
   * frame's two fields are two, and every pass of a looped GIF / APNG counts. Consecutive frames
   * whose indices are consecutive leave nothing of the recording out.
   */
  index?: number;
  /** Stream clock only: the decoder marked the frame a keyframe (where a lossy codec re-quantizes). */
  key?: boolean;
  /** Stream clock only: which field of an interlaced frame this is (0 first in time), line-doubled. */
  field?: 0 | 1;
}

export interface FramesSource {
  /** The command that wrote it: `check animation`, `check integrity --timeline`, `inspect interact`. */
  tool: string;
  url: string;
  viewport: { width: number; height: number };
  /** Device pixels per CSS pixel: a frame is `viewport x deviceScaleFactor` pixels. */
  deviceScaleFactor: number;
  /** The browser build, because what renders (and what decodes) is version-bound. */
  browser?: string;
  /**
   * `held`: page time on the held clock. rAF, timers, `Date` and every animation move only when
   *   the capture advances them, so a frame at 250ms is the page at 250ms of its own time.
   * `wall`: ms after an action, in real time. CSS and Web Animations are held and seeked to that
   *   offset, so their frames are exact; scripts run on the real clock and are wherever they were
   *   when the frame was shot (`shotMs`).
   * `stream`: a recording's own presentation timestamps (`scan video`). A frame is shown from its
   *   `atMs` until the next frame's, and 0 is the recording's first frame. The frames are the whole
   *   content: nothing happened between two consecutive ones that the recording holds.
   */
  clock: FramesClock;
  /** `scan video`: the recording the frames were decoded from, and how. */
  video?: FramesVideo;
  /** `inspect interact`: the `frames` step this sequence records. */
  step?: string;
  /**
   * Regions, in CSS px, whose pixels the capture could not hold to the sequence's clock: a
   * `<video>` it paused, an animated image or one whose bytes could not be read, pixels that
   * changed while nothing was advanced. `check flash` writes it and leaves those pixels out of
   * its count when it reads the sequence back, so judging the saved frames gives the same answer
   * as judging the page did.
   */
  unmeasured?: UnmeasuredRegion[];
  /**
   * `check flash`: what its sweep decided, so a saved sequence is judged again the same way.
   * `still`: nothing on the page was held or scheduled, so one frame is the whole sequence.
   * `windowMs`: the page time swept. `windowFrom`: where that came from, the `option` given, the
   * held `animations`' own lengths, the `default` for a page that only schedules timers or frames,
   * or `still`. `truncated`: the window was cut at the sweep's cap, shorter than the motion it was
   * chosen for.
   */
  sweep?: FramesSweep;
}

export type FramesClock = "held" | "wall" | "stream";

/** How `scan video` chose its frames from the recording. */
export type VideoSelection =
  | { kind: "all" }
  /**
   * The frames on screen at some moment of [fromMs, toMs]: the one showing at `fromMs` through the
   * one at `toMs` (as far as the recording went, when asked for more). `leadInMs`: the frames of
   * that much time before `fromMs` are in the sequence too, as the history the windows ending
   * inside the span need (`check flash` judges only those, counted from that history).
   */
  | { kind: "span"; fromMs: number; toMs: number; leadInMs?: number }
  /** The frame on screen at each instant (the last one that began at or before it). */
  | { kind: "at"; atMs: number[] };

export interface FramesVideo {
  /** The recording, as given. */
  file: string;
  /** What decoded it: the user's own `ffmpeg x.y`, spawned, or `import` for frames another decoder wrote. */
  decoder: string;
  /** The stream's codec as the decoder names it (`h264`, `vp8`, `ffv1`); `unknown` for an import. */
  codec: string;
  /**
   * The codec reproduces what it was given exactly (png, ffv1, qtrle, ...). False when it is lossy or
   * not known to be lossless: two frames that showed one picture can then differ by codec noise,
   * most of all across a keyframe, and comparing them byte for byte is comparing the codec.
   */
  lossless: boolean;
  /**
   * Frames the recording shows (a looped GIF / APNG: as far as it was written), when it was read to
   * its end. An import has it only when told the directory holds every frame (`--every-frame`):
   * without it, nothing says another tool did not thin them.
   */
  streamFrames?: number;
  /** Decoded frames never on screen: each shared its timestamp with the next, which replaced it at once. */
  hidden?: number;
  /**
   * `browser`: a GIF / APNG timed as a browser plays it — each frame held for its stored delay, or
   * 100ms when that is 10ms or less (Chromium) — rather than by the decoder's timestamps.
   */
  timing?: "browser";
  /** A GIF / APNG's looping: how many times it plays (`null` forever), one pass, and how many passes are written. */
  loop?: { plays: number | null; passFrames: number; passMs: number; passes: number };
  selection: VideoSelection;
  /**
   * The conversion to 8-bit sRGB the frames were written with: the YUV matrix (swscale's name,
   * `rgb` for frames stored as RGB, `gray` for a YUV codec's luma-only frames) and range, the
   * stream's transfer and primaries as tagged, and which of matrix and range the stream did not
   * state (so the value is the convention, BT.601 limited, not the stream's own word).
   */
  color?: {
    matrix: string;
    range: "tv" | "pc";
    transfer?: string;
    primaries?: string;
    assumed: string[];
  };
  /** The stream's pixel format (`yuv420p`: chroma at half resolution, so a 1px colour edge is not exact). */
  pixelFormat?: string;
  /**
   * Interlaced: the frames the decoder flagged interlaced (or, for a codec that flags none, every
   * frame of a stream tagged interlaced) were each split into their two fields, line-doubled, at
   * twice the frame rate; the progressive ones stay one frame each.
   */
  fields?: boolean;
  /** Transparent pixels were composited over this colour (the page behind them is not known). */
  background?: "white" | "black";
  /** What the decoding did not do or could not vouch for, for the reader. */
  notes?: string[];
  /** The decoder's own error lines (a truncated file decodes what it holds and exits 0). */
  decodeErrors?: string[];
  /** The demuxer reported corrupt or lost packets: frames may be missing between the ones here. */
  damaged?: boolean;
  /** The decoded stream's index in the file (`-map 0:<stream>`, `-select_streams <stream>`). */
  stream?: number;
  /** Degrees the frames were turned to stand upright, from the stream's display matrix. */
  rotation?: number;
  /** A sample aspect ratio other than 1:1, resampled to square pixels (`2:1` doubled each row). */
  sampleAspect?: string;
  /** `tt`, `bb`, `tb`, `bt`: the stream's field order as tagged. Which frames were split is `fields`'s. */
  fieldOrder?: string;
}

export interface FramesSweep {
  still: boolean;
  windowMs: number;
  windowFrom: "option" | "animations" | "default" | "still";
  truncated: boolean;
}

export interface UnmeasuredRegion {
  /**
   * `video`: paused at load. `animated-image`: runs on the browser's clock. `unreadable-image`:
   * an image whose bytes could not be read, so whether it animates is not known. `uncontrolled`:
   * changed with the clock held.
   */
  reason: UnmeasuredReason;
  rect: { x: number; y: number; width: number; height: number };
  /** The element, as the style gates print it, when one is known. */
  path?: string;
}

export type UnmeasuredReason = "video" | "animated-image" | "unreadable-image" | "uncontrolled";

const UNMEASURED_REASONS: readonly UnmeasuredReason[] = ["video", "animated-image", "unreadable-image", "uncontrolled"];
const SWEEP_WINDOW_FROM: readonly FramesSweep["windowFrom"][] = ["option", "animations", "default", "still"];
const FRAMES_CLOCKS: readonly FramesClock[] = ["held", "wall", "stream"];

export interface FramesManifest {
  format: typeof FRAMES_FORMAT;
  source: FramesSource;
  frames: FrameEntry[];
}

/**
 * `0006-t000100.png`: the position zero-padded so a glob sorts in sequence order (`frame-2` sorts
 * before `frame-10`, which silently scrambles a numbered sequence), then the instant in whole ms
 * for a reader. The exact instant is in `frames.json`.
 */
export function frameFileName(n: number, atMs: number): string {
  return `${String(n).padStart(4, "0")}-t${String(Math.max(0, Math.round(atMs))).padStart(6, "0")}.png`;
}

/** A parsed time, with its frame count kept when it was written in frames so a range stays exact. */
interface ParsedTime {
  ms: number;
  frames?: number;
}

const TIME_HELP = "a time is 1500, 1500ms, 1.5s, 00:01.500 or 6f (60fps frames); a range is 0..1s/100ms";

/**
 * Within a hair of a whole ms or of a 60fps frame boundary, exactly on it. Decimal seconds are
 * binary fractions: `16.15 * 1000` is 16149.999999999998, which the held clock compares as
 * "before frame 969" and a timer due at 16150 as "not yet". And `0 + 5 * (1000 / 60)` is one ulp
 * off `frameTimeMs(5)`, so the same frame written two ways would be two instants.
 */
function snap(ms: number): number {
  const whole = Math.round(ms);
  if (Math.abs(ms - whole) < 1e-6) return whole;
  const frame = Math.round((ms * 60) / 1000);
  return Math.abs(ms - frameTimeMs(frame)) < 1e-6 ? frameTimeMs(frame) : ms;
}

function parseTime(token: string, flag: string): ParsedTime {
  const unit = token.match(/^(\d+(?:\.\d+)?)(ms|s|f)?$/);
  if (unit) {
    const value = Number(unit[1]);
    if (unit[2] === "f") {
      if (!Number.isInteger(value)) throw new UsageError(`${flag}: "${token}" is not a whole frame. ${TIME_HELP}`);
      return { ms: frameTimeMs(value), frames: value };
    }
    const ms = snap(unit[2] === "s" ? value * 1000 : value);
    // A whole frame (0 included) counts as written in frames, so `0..1s/5f` is computed in frames.
    const frame = (ms * 60) / 1000;
    return Number.isInteger(frame) ? { ms, frames: frame } : { ms };
  }
  // mm:ss(.sss) or hh:mm:ss(.sss), the form a video player shows.
  const clock = token.match(/^(?:(\d+):)?(\d+):(\d{2}(?:\.\d+)?)$/);
  if (clock) {
    const [hours, minutes, seconds] = [Number(clock[1] ?? 0), Number(clock[2]), Number(clock[3])];
    if (seconds >= 60 || (clock[1] !== undefined && minutes >= 60)) {
      throw new UsageError(`${flag}: "${token}" is not a time of day. ${TIME_HELP}`);
    }
    const ms = snap(((hours * 60 + minutes) * 60 + seconds) * 1000);
    const frame = (ms * 60) / 1000;
    return Number.isInteger(frame) ? { ms, frames: frame } : { ms };
  }
  throw new UsageError(`${flag}: "${token}" is not a time. ${TIME_HELP}`);
}

/**
 * Parse a list of instants: `0,150,300`, `0,1.5s`, `00:00.250`, `6f`, and ranges `0..1s/100ms`
 * (the end is included when a step lands on it). Sorted, deduplicated, in ms; fractional ms are
 * kept, so `1f` is 16.666…ms and not 16 or 17. A value within 1e-6ms of a whole ms or of a frame
 * boundary is put exactly on it.
 *
 * A range's values are computed as `start + i * step`, never by adding the step up: summing
 * `1000 / 60` drifted above a frame boundary, and the held clock then ran one frame short. A range
 * whose step is in frames and whose start is on a frame (`0..1s/5f`, `6f..60f/6f`) is computed in
 * frames for the same reason.
 *
 * `flag` names the flag in the error, e.g. `--timeline-at`.
 */
export function parseInstants(raw: string, flag: string, options: { max?: number } = {}): number[] {
  const max = options.max ?? MAX_FRAMES;
  const out = new Set<number>();
  const add = (ms: number) => {
    out.add(ms);
    if (out.size > max) {
      throw new UsageError(`${flag}: more than ${max} instants. Use a larger step or a shorter range.`);
    }
  };
  for (const token of raw
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean)) {
    const range = token.match(/^(.+?)\.\.(.+?)(?:\/(.+))?$/);
    if (!range) {
      add(parseTime(token, flag).ms);
      continue;
    }
    if (range[3] === undefined) {
      throw new UsageError(`${flag}: the range "${token}" needs a step, e.g. ${range[1]}..${range[2]}/100ms`);
    }
    const [from, to, step] = [parseTime(range[1]!, flag), parseTime(range[2]!, flag), parseTime(range[3], flag)];
    if (step.ms <= 0) throw new UsageError(`${flag}: the range "${token}" has a zero step.`);
    if (to.ms < from.ms) throw new UsageError(`${flag}: the range "${token}" ends before it starts.`);
    const inFrames = from.frames !== undefined && step.frames !== undefined && Number.isInteger(step.frames);
    for (let i = 0; ; i++) {
      const ms = snap(inFrames ? frameTimeMs(from.frames! + i * step.frames!) : from.ms + i * step.ms);
      if (ms > to.ms + 1e-9) break;
      // Counted by step as well as by distinct value: a step below the float resolution at the
      // start (1000000..1000001/1e-19) adds the same value forever and the set never grows.
      if (i >= max) throw new UsageError(`${flag}: more than ${max} instants. Use a larger step or a shorter range.`);
      add(ms);
    }
  }
  return [...out].sort((a, b) => a - b);
}

/**
 * At most `max` of `values`, evenly spaced, keeping both ends: the first and last are the bounds
 * of whatever the sequence shows. May return fewer than `max` when rounding picks one twice.
 */
export function thinEvenly<T>(values: readonly T[], max: number): T[] {
  if (values.length <= max) return [...values];
  if (max < 2) return values.slice(0, Math.max(0, max));
  const step = (values.length - 1) / (max - 1);
  return [...new Set(Array.from({ length: max }, (_, i) => values[Math.round(i * step)]!))];
}

/**
 * How long each frame plays, from the instants it shows: the gap to the next frame, and for the
 * last one the average gap (200ms when there is only one). Taken between the rounded instants, so
 * sixty 16.67ms frames play for 1000ms and not 60 x 17.
 */
export function playbackDelays(atMs: readonly number[]): number[] {
  const at = atMs.map((t) => Math.round(t));
  const gaps = at.slice(1).map((t, i) => t - at[i]!);
  const hold = gaps.length > 0 ? Math.round(gaps.reduce((a, b) => a + b, 0) / gaps.length) : 200;
  return [...gaps, hold];
}

/** Read a `frames.json`. Throws a UsageError naming what is wrong with it. */
export function parseFramesManifest(text: string): FramesManifest {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch (error) {
    throw new UsageError(`not a frames manifest: ${(error as Error).message}`);
  }
  const manifest = raw as Partial<FramesManifest> | null;
  if (!manifest || manifest.format !== FRAMES_FORMAT) {
    throw new UsageError(`not a frames manifest: expected "format": "${FRAMES_FORMAT}".`);
  }
  if (!Array.isArray(manifest.frames) || manifest.frames.length === 0) {
    throw new UsageError("frames manifest: it lists no frames.");
  }
  manifest.frames.forEach((frame, i) => {
    if (
      !frame ||
      typeof frame.file !== "string" ||
      frame.file === "" ||
      typeof frame.atMs !== "number" ||
      !Number.isFinite(frame.atMs)
    ) {
      throw new UsageError(`frames manifest: frame ${i} needs a "file" and a numeric "atMs".`);
    }
    // A path that leaves the manifest's directory is not one of its frames: `..`, a root (`/`,
    // `\\`), a drive (`C:`) or a UNC share, on either separator.
    if (/^[\\/]|^[A-Za-z]:/.test(frame.file) || frame.file.split(/[\\/]/).includes("..")) {
      throw new UsageError(`frames manifest: frame ${i}'s file "${frame.file}" is outside the manifest's directory.`);
    }
  });
  // What `check flash` reads back. Unchecked, a malformed region crashed it with a raw TypeError
  // halfway through the count instead of naming the field.
  const source = (manifest.source ?? {}) as Partial<FramesSource>;
  if (source.unmeasured !== undefined) checkUnmeasured(source.unmeasured);
  if (source.sweep !== undefined) checkSweep(source.sweep);
  if (source.clock !== undefined) oneOf("source.clock", source.clock, FRAMES_CLOCKS);
  // Read by every judge of the frames; a malformed one crashed check flash's report mid-format.
  if (source.viewport !== undefined) {
    const vp = source.viewport as unknown;
    if (!isObject(vp) || !finite(vp.width) || !finite(vp.height) || vp.width <= 0 || vp.height <= 0) {
      refuse("source.viewport", "must be { width, height } in CSS px, both > 0");
    }
  }
  if (source.deviceScaleFactor !== undefined && (!finite(source.deviceScaleFactor) || source.deviceScaleFactor <= 0)) {
    refuse("source.deviceScaleFactor", "must be a finite number > 0");
  }
  if (source.video !== undefined) checkVideo(source.video);
  if (source.clock === "stream") {
    // What `check flash` reads to decide the sequence leaves nothing out: unchecked, a missing
    // index read as a gap and a repeated one as nothing missing.
    manifest.frames.forEach((frame, i) => {
      if (!Number.isSafeInteger(frame.index) || frame.index! < 0) {
        refuse(`frames[${i}].index`, "must be a whole number >= 0 on the stream clock");
      }
      if (i > 0 && !(frame.index! > manifest.frames![i - 1]!.index!)) {
        refuse(`frames[${i}].index`, `must be greater than frame ${i - 1}'s`);
      }
      if (frame.key !== undefined && typeof frame.key !== "boolean") refuse(`frames[${i}].key`, "must be a boolean");
      if (frame.field !== undefined && frame.field !== 0 && frame.field !== 1)
        refuse(`frames[${i}].field`, "must be 0 or 1");
    });
  }
  return manifest as FramesManifest;
}

const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const finite = (value: unknown): value is number => typeof value === "number" && Number.isFinite(value);

function refuse(field: string, what: string): never {
  throw new UsageError(`frames manifest: "${field}" ${what}.`);
}

function oneOf(field: string, value: unknown, allowed: readonly string[]): void {
  if (!allowed.includes(value as string))
    refuse(field, `is ${JSON.stringify(value)}; it is one of ${allowed.join(", ")}`);
}

function checkUnmeasured(unmeasured: unknown): void {
  if (!Array.isArray(unmeasured)) refuse("source.unmeasured", "must be an array");
  unmeasured.forEach((region: unknown, i) => {
    const field = `source.unmeasured[${i}]`;
    if (!isObject(region)) refuse(field, "must be an object");
    oneOf(`${field}.reason`, region.reason, UNMEASURED_REASONS);
    const rect = region.rect;
    if (!isObject(rect)) refuse(`${field}.rect`, "must be an object");
    for (const key of ["x", "y"]) {
      if (!finite(rect[key]) || rect[key] < 0) refuse(`${field}.rect.${key}`, "must be a finite number >= 0");
    }
    for (const key of ["width", "height"]) {
      if (!finite(rect[key]) || rect[key] <= 0) refuse(`${field}.rect.${key}`, "must be a finite number > 0");
    }
    if (region.path !== undefined && typeof region.path !== "string") refuse(`${field}.path`, "must be a string");
  });
}

function checkSweep(sweep: unknown): void {
  if (!isObject(sweep)) refuse("source.sweep", "must be an object");
  if (typeof sweep.still !== "boolean") refuse("source.sweep.still", "must be a boolean");
  if (!finite(sweep.windowMs) || sweep.windowMs < 0) refuse("source.sweep.windowMs", "must be a finite number >= 0");
  oneOf("source.sweep.windowFrom", sweep.windowFrom, SWEEP_WINDOW_FROM);
  if (typeof sweep.truncated !== "boolean") refuse("source.sweep.truncated", "must be a boolean");
}

function checkVideo(video: unknown): void {
  if (!isObject(video)) refuse("source.video", "must be an object");
  for (const key of ["file", "decoder", "codec"]) {
    if (typeof video[key] !== "string" || video[key] === "") refuse(`source.video.${key}`, "must be a string");
  }
  if (typeof video.lossless !== "boolean") refuse("source.video.lossless", "must be a boolean");
  if (
    video.streamFrames !== undefined &&
    (!Number.isSafeInteger(video.streamFrames) || (video.streamFrames as number) < 1)
  ) {
    refuse("source.video.streamFrames", "must be a whole number >= 1");
  }
  const selection = video.selection;
  if (!isObject(selection)) refuse("source.video.selection", "must be an object");
  oneOf("source.video.selection.kind", selection.kind, ["all", "span", "at"]);
  if (selection.kind === "span") {
    if (selection.leadInMs !== undefined && (!finite(selection.leadInMs) || (selection.leadInMs as number) < 0)) {
      refuse("source.video.selection.leadInMs", "must be a finite number >= 0");
    }
    for (const key of ["fromMs", "toMs"]) {
      if (!finite(selection[key]) || (selection[key] as number) < 0) {
        refuse(`source.video.selection.${key}`, "must be a finite number >= 0");
      }
    }
  }
  if (
    selection.kind === "at" &&
    (!Array.isArray(selection.atMs) || !selection.atMs.every((t) => finite(t) && t >= 0))
  ) {
    refuse("source.video.selection.atMs", "must be an array of finite numbers >= 0");
  }
  if (video.color !== undefined) {
    const color = video.color;
    if (!isObject(color)) refuse("source.video.color", "must be an object");
    if (typeof color.matrix !== "string") refuse("source.video.color.matrix", "must be a string");
    oneOf("source.video.color.range", color.range, ["tv", "pc"]);
    for (const key of ["assumed", "notes"]) {
      const list = color[key];
      if (
        (key === "assumed" || list !== undefined) &&
        (!Array.isArray(list) || !list.every((a) => typeof a === "string"))
      ) {
        refuse(`source.video.color.${key}`, "must be an array of strings");
      }
    }
  }
  if (video.rotation !== undefined && !finite(video.rotation)) refuse("source.video.rotation", "must be a number");
  if (video.hidden !== undefined && (!Number.isSafeInteger(video.hidden) || (video.hidden as number) < 0)) {
    refuse("source.video.hidden", "must be a whole number >= 0");
  }
  if (video.timing !== undefined) oneOf("source.video.timing", video.timing, ["browser"]);
  if (video.loop !== undefined) {
    const loop = video.loop;
    if (!isObject(loop)) refuse("source.video.loop", "must be an object");
    if (loop.plays !== null && (!Number.isSafeInteger(loop.plays) || (loop.plays as number) < 1)) {
      refuse("source.video.loop.plays", "must be a whole number >= 1, or null for forever");
    }
    for (const key of ["passFrames", "passes"]) {
      if (!Number.isSafeInteger(loop[key]) || (loop[key] as number) < 1)
        refuse(`source.video.loop.${key}`, "must be a whole number >= 1");
    }
    if (!finite(loop.passMs) || (loop.passMs as number) <= 0)
      refuse("source.video.loop.passMs", "must be a finite number > 0");
  }
  for (const key of ["sampleAspect", "fieldOrder"]) {
    if (video[key] !== undefined && typeof video[key] !== "string") refuse(`source.video.${key}`, "must be a string");
  }
}
