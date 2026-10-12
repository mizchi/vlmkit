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
   */
  clock: "held" | "wall";
  /** `inspect interact`: the `frames` step this sequence records. */
  step?: string;
  /**
   * Regions, in CSS px, whose pixels the capture could not hold to the sequence's clock: a
   * `<video>` it paused, an animated image, pixels that changed while nothing was advanced.
   * `check flash` writes it and leaves those pixels out of its count when it reads the sequence
   * back, so judging the saved frames gives the same answer as judging the page did.
   */
  unmeasured?: UnmeasuredRegion[];
}

export interface UnmeasuredRegion {
  /** `video`: paused at load. `animated-image`: runs on the browser's clock. `uncontrolled`: changed with the clock held. */
  reason: "video" | "animated-image" | "uncontrolled";
  rect: { x: number; y: number; width: number; height: number };
  /** The element, as the style gates print it, when one is known. */
  path?: string;
}

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
  return manifest as FramesManifest;
}
